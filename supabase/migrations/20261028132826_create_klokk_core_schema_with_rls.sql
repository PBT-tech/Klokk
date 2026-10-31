-- Klokk core schema: profiles, events, slots, named participants, responses, chat, SMS usage.

-- Profiles (mirrors auth.users with app-specific data)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  email_verified boolean DEFAULT false,
  plan text DEFAULT 'free',
  sms_credits int DEFAULT 240,
  sms_auto_top_up boolean DEFAULT false,
  sms_low_balance_threshold int DEFAULT 50,
  notification_prefs jsonb DEFAULT '{"eventUpdates":{"email":true,"sms":false},"reminders":{"email":true,"sms":false},"chatMessages":{"email":true,"sms":false}}'::jsonb,
  embed_settings jsonb DEFAULT '{"accentOverride":"#c9a84c","domainAllowlist":[],"embedExpiry":""}'::jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  participation_mode text NOT NULL CHECK (participation_mode IN ('minimum','named')),
  minimum_count int,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_responses' CHECK (status IN ('awaiting_responses','ready_to_confirm','confirmed','expired','cancelled','closed')),
  confirmed_slot_id text,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events anon read" ON public.events FOR SELECT TO anon USING (true);
CREATE POLICY "events owner read" ON public.events FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "events owner insert" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "events owner update" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "events owner delete" ON public.events FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Time slots
CREATE TABLE public.time_slots (
  id text PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL
);
GRANT SELECT ON public.time_slots TO anon;
GRANT SELECT, INSERT, DELETE ON public.time_slots TO authenticated;
GRANT ALL ON public.time_slots TO service_role;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots anon read" ON public.time_slots FOR SELECT TO anon USING (true);
CREATE POLICY "slots owner read" ON public.time_slots FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = time_slots.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "slots owner insert" ON public.time_slots FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = time_slots.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "slots owner delete" ON public.time_slots FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = time_slots.event_id AND e.owner_id = auth.uid()));

-- Named participants
CREATE TABLE public.named_participants (
  id text PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL
);
GRANT SELECT ON public.named_participants TO anon;
GRANT SELECT, INSERT, DELETE ON public.named_participants TO authenticated;
GRANT ALL ON public.named_participants TO service_role;
ALTER TABLE public.named_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "named anon read" ON public.named_participants FOR SELECT TO anon USING (true);
CREATE POLICY "named owner read" ON public.named_participants FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = named_participants.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "named owner insert" ON public.named_participants FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = named_participants.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "named owner delete" ON public.named_participants FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = named_participants.event_id AND e.owner_id = auth.uid()));

-- Participant responses (public, no account needed)
CREATE TABLE public.participant_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  slot_ids text[] DEFAULT '{}',
  submitted_at timestamptz DEFAULT now(),
  UNIQUE (event_id, email)
);
GRANT SELECT, INSERT, UPDATE ON public.participant_responses TO anon;
GRANT SELECT ON public.participant_responses TO authenticated;
GRANT ALL ON public.participant_responses TO service_role;
ALTER TABLE public.participant_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "responses anon read" ON public.participant_responses FOR SELECT TO anon USING (true);
CREATE POLICY "responses anon insert" ON public.participant_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "responses anon update" ON public.participant_responses FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "responses owner read" ON public.participant_responses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = participant_responses.event_id AND e.owner_id = auth.uid()));

-- Chat messages (organiser-scoped)
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  author_name text NOT NULL,
  author_email text,
  is_organiser boolean DEFAULT false,
  text text NOT NULL,
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat owner read" ON public.chat_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_messages.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "chat owner insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_messages.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "chat owner update" ON public.chat_messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_messages.event_id AND e.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_messages.event_id AND e.owner_id = auth.uid()));
CREATE POLICY "chat owner delete" ON public.chat_messages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = chat_messages.event_id AND e.owner_id = auth.uid()));

-- SMS usage log
CREATE TABLE public.sms_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date timestamptz DEFAULT now(),
  recipient text NOT NULL,
  event_id uuid,
  event_title text,
  type text NOT NULL,
  credits int NOT NULL
);
GRANT SELECT, INSERT ON public.sms_usage TO authenticated;
GRANT ALL ON public.sms_usage TO service_role;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms self read" ON public.sms_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sms self insert" ON public.sms_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);