-- Operational features for client management.
-- Prerequisite: run the base schema migration first:
-- supabase/migrations/20260713190735_f87a2acf-1d5b-4933-87a2-8422fa563cf1.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'invoice_status'
  ) THEN
    RAISE EXCEPTION 'Base schema is missing. Run 20260713190735_f87a2acf-1d5b-4933-87a2-8422fa563cf1.sql before this migration.';
  END IF;
END $$;

ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'sent';

CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.website_check_status AS ENUM ('up', 'down', 'warning', 'unknown');
CREATE TYPE public.alert_type AS ENUM ('domain', 'hosting', 'ssl', 'maintenance', 'invoice', 'task');
CREATE TYPE public.alert_status AS ENUM ('open', 'dismissed', 'resolved');
CREATE TYPE public.report_status AS ENUM ('draft', 'ready', 'sent');

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS domain_expires_at DATE,
  ADD COLUMN IF NOT EXISTS hosting_expires_at DATE,
  ADD COLUMN IF NOT EXISTS ssl_expires_at DATE,
  ADD COLUMN IF NOT EXISTS maintenance_renewal_date DATE,
  ADD COLUMN IF NOT EXISTS monitor_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.activity_logs
  ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments_admin_all" ON public.task_comments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "task_comments_client_own_select" ON public.task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.client_id = public.current_client_id()));
CREATE POLICY "task_comments_client_own_insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.client_id = public.current_client_id()));

CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_attachments_admin_all" ON public.task_attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "task_attachments_client_own_select" ON public.task_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.client_id = public.current_client_id()));
CREATE POLICY "task_attachments_client_own_insert" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.client_id = public.current_client_id()));

CREATE TABLE public.website_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  status website_check_status NOT NULL DEFAULT 'unknown',
  uptime_percent NUMERIC(5,2),
  response_time_ms INTEGER,
  status_code INTEGER,
  ssl_valid BOOLEAN,
  ssl_expires_at DATE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_checks TO authenticated;
GRANT ALL ON public.website_checks TO service_role;
ALTER TABLE public.website_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "website_checks_admin_all" ON public.website_checks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "website_checks_client_own_select" ON public.website_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id AND w.client_id = public.current_client_id()));

CREATE TABLE public.renewal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  status alert_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.renewal_alerts TO authenticated;
GRANT ALL ON public.renewal_alerts TO service_role;
ALTER TABLE public.renewal_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "renewal_alerts_admin_all" ON public.renewal_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "renewal_alerts_client_own_select" ON public.renewal_alerts FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'pending',
  method TEXT,
  reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_admin_all" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "payments_client_own_select" ON public.payments FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE TABLE public.monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  status report_status NOT NULL DEFAULT 'draft',
  tasks_done INTEGER NOT NULL DEFAULT 0,
  uptime_percent NUMERIC(5,2),
  changes_count INTEGER NOT NULL DEFAULT 0,
  hours_spent NUMERIC(7,2) NOT NULL DEFAULT 0,
  costs_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  summary TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_reports_admin_all" ON public.monthly_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "monthly_reports_client_own_select" ON public.monthly_reports FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
