
CREATE POLICY "tx-docs upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tx-docs read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tx-docs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tx-docs delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
