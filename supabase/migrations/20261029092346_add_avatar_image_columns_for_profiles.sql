-- Profile image for organisers (stored in profiles table).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Profile image for named participants (invited people).
ALTER TABLE public.named_participants ADD COLUMN IF NOT EXISTS avatar_url text;

-- Profile image for open-invite participant responses (no account required).
ALTER TABLE public.participant_responses ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow signed-in organisers to manage avatars they own, and anon uploads
-- for participant avatars on the public response path. Files live in the
-- `avatars` storage bucket; access is granted via storage.objects policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.participant_responses TO anon;
GRANT SELECT ON public.participant_responses TO authenticated;
GRANT ALL ON public.participant_responses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.named_participants TO authenticated;
GRANT ALL ON public.named_participants TO service_role;

-- Storage bucket access for avatar uploads.
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'avatars');
CREATE POLICY "avatars auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars anon upload" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars auth upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars auth update own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars auth delete own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars admin all" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');