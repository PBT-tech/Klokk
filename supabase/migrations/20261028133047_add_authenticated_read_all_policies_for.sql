-- Authenticated users also need to read public event data (e.g. when an
-- organiser who has a Klokk account opens a participant link for an event
-- they don't own). These mirror the anon read policies.

CREATE POLICY "events authenticated read all" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "slots authenticated read all" ON public.time_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "named authenticated read all" ON public.named_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "responses authenticated read all" ON public.participant_responses FOR SELECT TO authenticated USING (true);