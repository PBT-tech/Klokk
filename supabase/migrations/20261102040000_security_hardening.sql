-- Klokk: security hardening from the Ship Gate review. Run after 20261102030000.

-- ---------------------------------------------------------------------------
-- 1. Persistent rate limiting for public endpoints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

-- Returns true when the call is allowed, false when the limit is exceeded.
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.rate_limits AS r (key, window_start, count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds)
                        THEN now() ELSE r.window_start END,
    count = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds)
                 THEN 1 ELSE r.count + 1 END
  RETURNING r.count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day' $$;

-- ---------------------------------------------------------------------------
-- 2. Participant edit secret: only the person who submitted can change a response
-- ---------------------------------------------------------------------------
ALTER TABLE public.participant_responses ADD COLUMN IF NOT EXISTS edit_token_hash text;

-- ---------------------------------------------------------------------------
-- 3. Profile identity: email comes from auth.users and clients cannot change it;
--    SMS credits and billing fields are server-only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_protect_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' AND pg_trigger_depth() = 1 THEN
    IF TG_OP = 'INSERT' THEN
      NEW.email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.id);
      NEW.email_verified := coalesce(
        (SELECT u.email_confirmed_at IS NOT NULL FROM auth.users u WHERE u.id = NEW.id), false);
      NEW.plan := 'free';
      NEW.events_created := 0;
      NEW.billing_interval := NULL;
      NEW.plan_renews_at := NULL;
      NEW.extra_seats := 0;
      NEW.billing_status := 'active';
      NEW.sms_credits := 240;
    ELSE
      NEW.email := OLD.email;
      NEW.email_verified := OLD.email_verified;
      NEW.plan := OLD.plan;
      NEW.events_created := OLD.events_created;
      NEW.billing_interval := OLD.billing_interval;
      NEW.plan_renews_at := OLD.plan_renews_at;
      NEW.extra_seats := OLD.extra_seats;
      NEW.billing_status := OLD.billing_status;
      NEW.sms_credits := OLD.sms_credits;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Keep profiles.email in step with the confirmed auth email.
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- One account per email address (billing is matched on it).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
    ON public.profiles (lower(email)) WHERE email IS NOT NULL AND email <> '';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles_email_unique not created (duplicate emails exist): %', SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Events: owners cannot rewrite their token, owner or creation date
--    (the creation date drives free-plan retention).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.events_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' AND pg_trigger_depth() = 1 THEN
    NEW.token := OLD.token;
    NEW.owner_id := OLD.owner_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_protect_immutable ON public.events;
CREATE TRIGGER events_protect_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_protect_immutable();

-- ---------------------------------------------------------------------------
-- 5. Overage records survive event deletion so they can still be invoiced
-- ---------------------------------------------------------------------------
ALTER TABLE public.overage_invoices DROP CONSTRAINT IF EXISTS overage_invoices_event_id_fkey;
ALTER TABLE public.overage_invoices ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- 6. Billing: apply a paid order atomically (record + every grant, or nothing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_billing_order(p_user uuid, p_order text, p_grants jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g jsonb;
BEGIN
  INSERT INTO public.billing_orders (order_id, user_id, summary)
  VALUES (p_order, p_user, p_grants)
  ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN false; -- already applied
  END IF;

  FOR g IN SELECT * FROM jsonb_array_elements(p_grants) LOOP
    IF g->>'kind' = 'pack' THEN
      INSERT INTO public.event_credit_packs (user_id, order_id, events_total, purchased_at, expires_at)
      VALUES (p_user, p_order || ':' || (g->>'priceId'),
              (g->>'events')::int * (g->>'qty')::int, now(), now() + interval '3 months');
      UPDATE public.profiles SET plan = 'casual' WHERE id = p_user AND plan = 'free';
    ELSIF g->>'kind' = 'subscription' THEN
      UPDATE public.profiles SET
        plan = g->>'plan',
        billing_interval = g->>'interval',
        plan_renews_at = now() + CASE WHEN g->>'interval' = 'year' THEN interval '1 year' ELSE interval '1 month' END,
        billing_status = 'active'
      WHERE id = p_user;
    ELSIF g->>'kind' = 'seat' THEN
      UPDATE public.profiles SET extra_seats = extra_seats + (g->>'qty')::int WHERE id = p_user;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Function hygiene: pin search_path (with pg_temp last) and remove EXECUTE
--    from roles that never need to call these directly.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.enforce_event_limits() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_participant_cap() SET search_path = public, pg_temp;
ALTER FUNCTION public.purge_expired_events() SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_overdue_events() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_profile_email_verified() SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.enforce_event_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_participant_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_protect_privileged() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email_verified() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.events_protect_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_billing_order(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_billing_order(uuid, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. A participant editing their own response must still work when the event is full.
--    An upsert runs the BEFORE INSERT trigger even when it ends up updating a row,
--    so detect an existing row for the same participant and let it through.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_participant_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan text;
  v_cap int;
  v_count int;
BEGIN
  SELECT coalesce(p.plan, 'free') INTO v_plan
    FROM public.events e JOIN public.profiles p ON p.id = e.owner_id
    WHERE e.id = NEW.event_id;

  v_cap := CASE v_plan WHEN 'free' THEN 35 WHEN 'organiser' THEN 80 ELSE NULL END;
  IF v_cap IS NULL THEN
    RETURN NEW; -- casual (overage billed) and teams (unlimited)
  END IF;

  IF TG_TABLE_NAME = 'participant_responses' THEN
    IF EXISTS (SELECT 1 FROM public.participant_responses
               WHERE event_id = NEW.event_id AND email = NEW.email) THEN
      RETURN NEW; -- an edit (the upsert will update this row), not a new participant
    END IF;
    SELECT count(*) INTO v_count FROM public.participant_responses WHERE event_id = NEW.event_id;
  ELSE
    SELECT count(*) INTO v_count FROM public.named_participants WHERE event_id = NEW.event_id;
  END IF;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'Participant limit reached (% on this plan)', v_cap USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_participant_cap() FROM PUBLIC, anon, authenticated;
