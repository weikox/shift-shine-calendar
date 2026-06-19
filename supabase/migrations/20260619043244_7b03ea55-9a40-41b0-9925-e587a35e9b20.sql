
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE public.calendar_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  shift TEXT,
  note TEXT,
  companions TEXT[] DEFAULT '{}',
  is_holiday_shift BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_days TO authenticated;
GRANT ALL ON public.calendar_days TO service_role;
ALTER TABLE public.calendar_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar_days select" ON public.calendar_days FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own calendar_days insert" ON public.calendar_days FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar_days update" ON public.calendar_days FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own calendar_days delete" ON public.calendar_days FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.calendar_days FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_calendar_days_user_date ON public.calendar_days(user_id, date);

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  recurrence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar_events select" ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own calendar_events insert" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar_events update" ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own calendar_events delete" ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_calendar_events_user_dates ON public.calendar_events(user_id, start_date, end_date);

CREATE TABLE public.calendar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  cell_size TEXT DEFAULT 'medium',
  holidays JSONB DEFAULT '[]'::jsonb,
  companions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_config TO authenticated;
GRANT ALL ON public.calendar_config TO service_role;
ALTER TABLE public.calendar_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar_config select" ON public.calendar_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own calendar_config insert" ON public.calendar_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar_config update" ON public.calendar_config FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.calendar_config FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts select" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own accounts delete" ON public.accounts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso','gasto')),
  pending BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own transactions insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own transactions delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_transactions_user_month ON public.transactions(user_id, month);

CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transfers select" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own transfers insert" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transfers update" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own transfers delete" ON public.transfers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_transfers_user_month ON public.transfers(user_id, month);

CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  storage_method TEXT DEFAULT 'cloud' CHECK (storage_method IN ('local','cloud','hybrid')),
  auto_sync BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own app_settings select" ON public.app_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own app_settings insert" ON public.app_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own app_settings update" ON public.app_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pizarra','nevera')),
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes select" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own notes insert" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes update" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own notes delete" ON public.notes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.transaction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_documents TO authenticated;
GRANT ALL ON public.transaction_documents TO service_role;
ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx_docs select" ON public.transaction_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tx_docs insert" ON public.transaction_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tx_docs update" ON public.transaction_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tx_docs delete" ON public.transaction_documents FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transaction_documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  username TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own links select" ON public.links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own links insert" ON public.links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own links update" ON public.links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own links delete" ON public.links FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.links FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.monthly_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'fixed',
  tx_type TEXT NOT NULL DEFAULT 'gasto',
  estimated_amount NUMERIC,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_task_templates TO authenticated;
GRANT ALL ON public.monthly_task_templates TO service_role;
ALTER TABLE public.monthly_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tpl select" ON public.monthly_task_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tpl insert" ON public.monthly_task_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tpl update" ON public.monthly_task_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tpl delete" ON public.monthly_task_templates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.monthly_task_templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_task_templates_user ON public.monthly_task_templates(user_id, sort_order);

CREATE TABLE public.monthly_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.monthly_task_templates(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  transaction_id UUID,
  amount NUMERIC NOT NULL,
  completion_date DATE NOT NULL,
  document_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_task_completions TO authenticated;
GRANT ALL ON public.monthly_task_completions TO service_role;
ALTER TABLE public.monthly_task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cmp select" ON public.monthly_task_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own cmp insert" ON public.monthly_task_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cmp update" ON public.monthly_task_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own cmp delete" ON public.monthly_task_completions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.monthly_task_completions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_task_completions_month ON public.monthly_task_completions(user_id, month);

CREATE TABLE public.network_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mac TEXT NOT NULL UNIQUE,
  ip TEXT,
  hostname TEXT,
  vendor TEXT,
  label TEXT,
  location TEXT,
  is_mobile BOOLEAN NOT NULL DEFAULT false,
  group_key TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, UPDATE ON public.network_devices TO authenticated;
GRANT ALL ON public.network_devices TO service_role;
ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view devices" ON public.network_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update devices" ON public.network_devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_network_devices_updated BEFORE UPDATE ON public.network_devices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_ndev_location ON public.network_devices(location);
CREATE INDEX idx_ndev_group_key ON public.network_devices(group_key);
CREATE INDEX idx_ndev_archived ON public.network_devices(is_archived);

CREATE TABLE public.network_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.network_devices(id) ON DELETE CASCADE,
  location TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.network_device_sessions TO authenticated;
GRANT ALL ON public.network_device_sessions TO service_role;
ALTER TABLE public.network_device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view sessions" ON public.network_device_sessions FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_ndev_sessions_device ON public.network_device_sessions(device_id);
CREATE INDEX idx_ndev_sessions_started ON public.network_device_sessions(started_at DESC);
CREATE INDEX idx_ndev_sessions_open ON public.network_device_sessions(device_id) WHERE ended_at IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.network_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.network_device_sessions;
