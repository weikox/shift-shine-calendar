-- Add unique constraint to notes table to prevent duplicate user_id + type combinations
ALTER TABLE public.notes ADD CONSTRAINT notes_user_id_type_unique UNIQUE (user_id, type);