CREATE POLICY "Anyone can view network devices" ON public.network_devices FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can view device sessions" ON public.network_device_sessions FOR SELECT TO anon USING (true);
GRANT SELECT ON public.network_devices TO anon;
GRANT SELECT ON public.network_device_sessions TO anon;