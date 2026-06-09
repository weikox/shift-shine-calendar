ALTER TABLE public.network_devices ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_ndev_archived ON public.network_devices(is_archived);