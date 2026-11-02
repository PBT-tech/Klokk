-- Klokk: token-gated data access, server-side limits, retention and expiry.
-- Participants no longer talk to the database directly. The app's server
-- functions use the service role and look events up by their secret token, so
-- the anon role gets no access to event data at all.

-- ---------------------------------------------------------------------------
-- 1. Remove anonymous and cross-organiser read access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "events anon read" ON public.events;
DROP POLICY IF EXISTS "slots anon read" ON public.time_slots;
DROP POLICY IF EXISTS "named anon read" ON public.named_participants;
DROP POLICY IF EXISTS "responses anon read" ON public.participant_responses;
DROP POLICY IF EXISTS "responses anon insert" ON public.participant_responses;
DROP POLICY IF EXISTS "responses anon update" ON public.participant_responses;

-- Added by a later migration: let any signed-in user read every organiser's data.
DROP POLICY IF EXISTS "events authenticated read all" ON public.events;
DROP POLICY IF EXISTS "slots authenticated read all" ON public.time_slots;
DROP POLICY IF EXISTS "named authenticated read all" ON public.named_participants;
DROP POLICY IF EXISTS "responses authenticated read all" ON public.participant_responses;

REVOKE ALL ON public.events FROM anon;
REVOKE ALL ON public.time_slots FROM anon;
REVOKE ALL ON public.named_participants FROM anon;
REVOKE ALL ON public.participant_responses FROM anon;
REVOKE ALL ON public.chat_messages FROM anon;

-- Normalise participant emails to lowercase (lookups are exact matches). If two
-- rows for one event differ only by case, keep the most recent submission.
DELETE FROM public.participant_responses a
USING public.participant_responses b
WHERE a.event_id = b.event_id AND lower(a.email) = lower(b.email)
  AND (a.submitted_at, a.id) < (b.submitted_at, b.id);
UPDATE public.participant_responses SET email = lower(email) WHERE email <> lower(email);

-- ---------------------------------------------------------------------------
-- 2. Columns: lifetime event counter and custom confirmed time
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS events_created int NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS confirmed_custom_date date;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS confirmed_custom_start text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS confirmed_custom_end text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Back-fill the counter from events that still exist.
UPDATE public.profiles p
SET events_created = GREATEST(p.events_created,
  (SELECT count(*) FROM public.events e WHERE e.owner_id = p.id));

-- ---------------------------------------------------------------------------
-- 3. Plan limits enforced in the database
--    free: 3 events lifetime, 35 participants hard cap
--    casual: 35 included (overage is billed, not blocked)
--    organiser: 80 hard cap
--    teams: unlimited
-- ---------------------------------------------------------------------------
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
BEGIN
  SELECT coalesce(plan, 'free'), events_created, coalesce(email_verified, false)
    INTO v_plan, v_created, v_verified
    FROM public.profiles WHERE id = NEW.owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_verified THEN
    RAISE EXCEPTION 'Verify your email before creating an event' USING ERRCODE = 'P0001';
  END IF;
  IF v_plan = 'free' AND v_created >= 3 THEN
    RAISE EXCEPTION 'Free plan limit reached: 3 events' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles SET events_created = events_created + 1 WHERE id = NEW.owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_enforce_limits ON public.events;
CREATE TRIGGER events_enforce_limits
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_limits();

CREATE OR REPLACE FUNCTION public.enforce_participant_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- A repeat submission from the same email is an edit, not a new participant.
    IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
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

DROP TRIGGER IF EXISTS responses_enforce_cap ON public.participant_responses;
CREATE TRIGGER responses_enforce_cap
  BEFORE INSERT ON public.participant_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_participant_cap();

DROP TRIGGER IF EXISTS named_enforce_cap ON public.named_participants;
CREATE TRIGGER named_enforce_cap
  BEFORE INSERT ON public.named_participants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_participant_cap();

-- ---------------------------------------------------------------------------
-- 4. Retention purge (PRD F8 / Data Security)
--    free plan: deleted 90 days after the event was created
--    paid plans: deleted 12 months after the event closed (or its deadline)
--    Responses, slots, named participants and chat cascade with the event.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH doomed AS (
    SELECT e.id
    FROM public.events e
    JOIN public.profiles p ON p.id = e.owner_id
    WHERE (coalesce(p.plan, 'free') = 'free' AND e.created_at < now() - interval '90 days')
       OR (coalesce(p.plan, 'free') <> 'free'
           AND coalesce(e.closed_at, e.deadline) < now() - interval '12 months')
  )
  DELETE FROM public.events WHERE id IN (SELECT id FROM doomed);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Auto-expire events whose deadline has passed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_overdue_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.events
  SET status = 'expired'
  WHERE deadline < now() AND status IN ('awaiting_responses', 'ready_to_confirm');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_overdue_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_overdue_events() TO service_role;

-- Schedule both with pg_cron when the extension is available. If it is not,
-- the /api/cron/maintenance route (called by an external scheduler) runs the
-- same two functions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('klokk-expire-events', '*/15 * * * *', 'SELECT public.expire_overdue_events()');
    PERFORM cron.schedule('klokk-purge-events', '30 3 * * *', 'SELECT public.purge_expired_events()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Stop signed-in users resetting their own lifetime event counter.
--    Redefines the trigger function from 20261102000000 to also protect
--    events_created.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_protect_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.email_verified := coalesce(
        (SELECT u.email_confirmed_at IS NOT NULL FROM auth.users u WHERE u.id = NEW.id), false);
      NEW.plan := 'free';
      NEW.events_created := 0;
    ELSE
      NEW.email_verified := OLD.email_verified;
      NEW.plan := OLD.plan;
      NEW.events_created := OLD.events_created;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
