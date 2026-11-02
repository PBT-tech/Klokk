-- Klokk: de-duplicate limit-warning emails and overage invoices. Service role only.

CREATE TABLE IF NOT EXISTS public.limit_warnings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- the zero uuid stands for "not tied to one event"
  event_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  kind text NOT NULL CHECK (kind IN
    ('participants_near', 'participants_reached', 'free_events_low', 'credits_low', 'pack_expiring',
     'retention_soon')),
  -- a period key lets recurring warnings (e.g. credits low) be sent again after a new purchase
  period text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, kind, period)
);
ALTER TABLE public.limit_warnings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.limit_warnings FROM anon, authenticated;
GRANT ALL ON public.limit_warnings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.limit_warnings_id_seq TO service_role;

-- One overage invoice per event (Casual plan, participants above 35).
CREATE TABLE IF NOT EXISTS public.overage_invoices (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participants int NOT NULL,
  blocks int NOT NULL,
  amount numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  hl_invoice_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.overage_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.overage_invoices FROM anon, authenticated;
GRANT ALL ON public.overage_invoices TO service_role;
-- Organisers may read their own overage records (shown in Plan & billing).
GRANT SELECT ON public.overage_invoices TO authenticated;
DROP POLICY IF EXISTS "overage owner read" ON public.overage_invoices;
CREATE POLICY "overage owner read" ON public.overage_invoices
  FOR SELECT TO authenticated USING (user_id = auth.uid());
