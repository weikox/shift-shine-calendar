-- Create bucket for transaction documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-documents', 'transaction-documents', false);

-- RLS policies for the bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Table for document references
CREATE TABLE public.transaction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for the table
CREATE POLICY "Users can view their own transaction documents"
ON public.transaction_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transaction documents"
ON public.transaction_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transaction documents"
ON public.transaction_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transaction documents"
ON public.transaction_documents FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_transaction_documents_updated_at
BEFORE UPDATE ON public.transaction_documents
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();