CREATE TABLE IF NOT EXISTS public.network_sede_config (
  location text PRIMARY KEY,
  fing_url text,
  microcut_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_sede_config TO authenticated;
GRANT ALL ON public.network_sede_config TO service_role;

ALTER TABLE public.network_sede_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read sede config"
  ON public.network_sede_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated write sede config"
  ON public.network_sede_config FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_network_sede_config_updated_at
BEFORE UPDATE ON public.network_sede_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();