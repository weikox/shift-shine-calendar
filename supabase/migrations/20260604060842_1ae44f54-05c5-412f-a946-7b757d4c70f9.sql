CREATE POLICY "Anyone can update devices" ON public.network_devices FOR UPDATE TO anon USING (true) WITH CHECK (true);
GRANT UPDATE ON public.network_devices TO anon;