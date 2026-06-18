ALTER TABLE public.network_devices ADD COLUMN IF NOT EXISTS group_key text;
CREATE INDEX IF NOT EXISTS network_devices_group_key_idx ON public.network_devices(group_key);