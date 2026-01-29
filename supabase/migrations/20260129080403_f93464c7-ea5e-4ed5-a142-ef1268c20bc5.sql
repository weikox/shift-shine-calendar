-- Add companions column to calendar_config table
ALTER TABLE public.calendar_config 
ADD COLUMN companions TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.calendar_config.companions IS 'List of possible shift companions';