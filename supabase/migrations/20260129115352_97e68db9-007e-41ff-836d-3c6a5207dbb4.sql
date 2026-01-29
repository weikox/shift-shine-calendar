-- Add companions column to calendar_days table
ALTER TABLE public.calendar_days 
ADD COLUMN companions text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.calendar_days.companions IS 'List of companion names assigned for this day shift';