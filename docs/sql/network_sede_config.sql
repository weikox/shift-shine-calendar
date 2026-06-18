-- Ejecutar en el SQL Editor de Supabase para añadir la
-- configuración por sede del Monitor de red (URL del agente Fing
-- y umbral de microcortes en segundos).

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

DROP POLICY IF EXISTS "authenticated read sede config" ON public.network_sede_config;
CREATE POLICY "authenticated read sede config"
  ON public.network_sede_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated write sede config" ON public.network_sede_config;
CREATE POLICY "authenticated write sede config"
  ON public.network_sede_config FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
