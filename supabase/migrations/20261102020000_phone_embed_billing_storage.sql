-- Klokk: optional participant phone, embed widget, billing/credit packs, and
-- tighter avatar storage rules. Run after 20261102010000.

-- ---------------------------------------------------------------------------
-- 1. Optional participant phone number (recorded, never required)
-- ---------------------------------------------------------------------------
ALTER TABLE public.participant_responses ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.participant_responses
  DROP CONSTRAINT IF EXISTS participant_responses_phone_format;
ALTER TABLE public.participant_responses
  ADD CONSTRAINT participant_responses_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+?[0-9 ()\-]{6,20}$');

-- ---------------------------------------------------------------------------
-- 2. Embed widget (F10): revocable, expiring, signed links + analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.embed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS embed_tokens_event_idx ON public.embed_tokens(event_id);
CREATE INDEX IF NOT EXISTS embed_tokens_owner_idx ON public.embed_tokens(owner_id);
ALTER TABLE public.embed_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.embed_tokens TO authenticated;
GRANT ALL ON public.embed_tokens TO service_role;
DROP POLICY IF EXISTS "embed owner read" ON public.embed_tokens;
DROP POLICY IF EXISTS "embed owner insert" ON public.embed_tokens;
DROP POLICY IF EXISTS "embed owner update" ON public.embed_tokens;
CREATE POLICY "embed owner read" ON public.embed_tokens
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "embed owner insert" ON public.embed_tokens
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));
CREATE POLICY "embed owner update" ON public.embed_tokens
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.embed_events (
  id bigserial PRIMARY KEY,
  embed_id uuid NOT NULL REFERENCES public.embed_tokens(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('view', 'interaction', 'submit')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS embed_events_embed_idx ON public.embed_events(embed_id);
ALTER TABLE public.embed_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.embed_events TO authenticated;
GRANT ALL ON public.embed_events TO service_role;
DROP POLICY IF EXISTS "embed events owner read" ON public.embed_events;
CREATE POLICY "embed events owner read" ON public.embed_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.embed_tokens t WHERE t.id = embed_id AND t.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Billing: subscription fields, credit packs, orders, price map
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_interval text
  CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_renews_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extra_seats int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'active'
  CHECK (billing_status IN ('active', 'past_due', 'cancelled'));

-- Casual credit packs: each pack covers N events and expires 3 months after purchase.
CREATE TABLE IF NOT EXISTS public.event_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE,
  events_total int NOT NULL CHECK (events_total > 0),
  events_used int NOT NULL DEFAULT 0 CHECK (events_used >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (events_used <= events_total)
);
CREATE INDEX IF NOT EXISTS event_credit_packs_user_idx ON public.event_credit_packs(user_id);
ALTER TABLE public.event_credit_packs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.event_credit_packs TO authenticated;
GRANT ALL ON public.event_credit_packs TO service_role;
DROP POLICY IF EXISTS "packs owner read" ON public.event_credit_packs;
CREATE POLICY "packs owner read" ON public.event_credit_packs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Orders already applied (makes claiming an order idempotent). Service role only.
CREATE TABLE IF NOT EXISTS public.billing_orders (
  order_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_orders FROM anon, authenticated;
GRANT ALL ON public.billing_orders TO service_role;

-- Customers must not be able to change their own billing state.
CREATE OR REPLACE FUNCTION public.profiles_protect_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- pg_trigger_depth() = 1 means the statement came straight from the client. Updates
  -- made by our own trusted trigger functions (e.g. counting a new event) run nested
  -- at depth 2 or more and must not be reverted.
  IF coalesce(auth.role(), '') = 'authenticated' AND pg_trigger_depth() = 1 THEN
    IF TG_OP = 'INSERT' THEN
      NEW.email_verified := coalesce(
        (SELECT u.email_confirmed_at IS NOT NULL FROM auth.users u WHERE u.id = NEW.id), false);
      NEW.plan := 'free';
      NEW.events_created := 0;
      NEW.billing_interval := NULL;
      NEW.plan_renews_at := NULL;
      NEW.extra_seats := 0;
      NEW.billing_status := 'active';
    ELSE
      NEW.email_verified := OLD.email_verified;
      NEW.plan := OLD.plan;
      NEW.events_created := OLD.events_created;
      NEW.billing_interval := OLD.billing_interval;
      NEW.plan_renews_at := OLD.plan_renews_at;
      NEW.extra_seats := OLD.extra_seats;
      NEW.billing_status := OLD.billing_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Event creation: free = 3 lifetime; casual = consumes one credit from the pack
-- that expires soonest; organiser/teams = unlimited.
CREATE OR REPLACE FUNCTION public.enforce_event_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_created int;
  v_verified boolean;
  v_status text;
  v_renews timestamptz;
  v_pack uuid;
BEGIN
  SELECT coalesce(plan, 'free'), events_created, coalesce(email_verified, false),
         billing_status, plan_renews_at
    INTO v_plan, v_created, v_verified, v_status, v_renews
    FROM public.profiles WHERE id = NEW.owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_verified THEN
    RAISE EXCEPTION 'Verify your email before creating an event' USING ERRCODE = 'P0001';
  END IF;

  IF v_plan = 'free' THEN
    IF v_created >= 3 THEN
      RAISE EXCEPTION 'Free plan limit reached: 3 events. Buy a credit pack or subscribe to create more.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_plan = 'casual' THEN
    SELECT id INTO v_pack FROM public.event_credit_packs
      WHERE user_id = NEW.owner_id AND events_used < events_total AND expires_at > now()
      ORDER BY expires_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF v_pack IS NULL THEN
      RAISE EXCEPTION 'No event credits left. Buy another credit pack or subscribe.'
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.event_credit_packs SET events_used = events_used + 1 WHERE id = v_pack;
  ELSE
    -- organiser / teams: subscription must be in good standing
    IF v_status = 'cancelled' OR (v_renews IS NOT NULL AND v_renews < now() - interval '3 days') THEN
      RAISE EXCEPTION 'Your subscription is not active. Renew to create more events.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.profiles SET events_created = events_created + 1 WHERE id = NEW.owner_id;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Avatars: stop anonymous uploads and cross-user overwrites
--    Participant avatars are now uploaded by a server function; organisers may
--    only write under organisers/<their user id>/.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "avatars anon upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth update own" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth delete own" ON storage.objects;

CREATE POLICY "avatars auth upload own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organisers'
    AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "avatars auth update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organisers'
    AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organisers'
    AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "avatars auth delete own" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organisers'
    AND (storage.foldername(name))[2] = auth.uid()::text);
