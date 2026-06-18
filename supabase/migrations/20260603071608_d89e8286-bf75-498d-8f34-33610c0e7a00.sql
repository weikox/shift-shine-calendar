
CREATE TABLE public.network_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mac TEXT NOT NULL UNIQUE,
  ip TEXT,
  hostname TEXT,
  vendor TEXT,
  label TEXT,
  location TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.network_device_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.network_devices(id) ON DELETE CASCADE,
  location TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ndev_sessions_device ON public.network_device_sessions(device_id);
CREATE INDEX idx_ndev_sessions_started ON public.network_device_sessions(started_at DESC);
CREATE INDEX idx_ndev_sessions_open ON public.network_device_sessions(device_id) WHERE ended_at IS NULL;
CREATE INDEX idx_ndev_location ON public.network_devices(location);

GRANT SELECT, UPDATE ON public.network_devices TO authenticated;
GRANT SELECT ON public.network_device_sessions TO authenticated;
GRANT ALL ON public.network_devices TO service_role;
GRANT ALL ON public.network_device_sessions TO service_role;

ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view devices"
  ON public.network_devices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update device labels"
  ON public.network_devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view device sessions"
  ON public.network_device_sessions FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_network_devices_updated
  BEFORE UPDATE ON public.network_devices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.network_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.network_device_sessions;
