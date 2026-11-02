-- Prevent signed-in clients from writing privileged profile columns.
-- email_verified is derived from auth.users.email_confirmed_at; plan is server-controlled.

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
    ELSE
      NEW.email_verified := OLD.email_verified;
      NEW.plan := OLD.plan;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged ON public.profiles;
CREATE TRIGGER profiles_protect_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_privileged();

-- Keep email_verified in sync when the user confirms their email.
CREATE OR REPLACE FUNCTION public.sync_profile_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.profiles SET email_verified = (NEW.email_confirmed_at IS NOT NULL) WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_verified();

-- Backfill from auth.users so existing rows are correct.
UPDATE public.profiles p
SET email_verified = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u WHERE u.id = p.id;
