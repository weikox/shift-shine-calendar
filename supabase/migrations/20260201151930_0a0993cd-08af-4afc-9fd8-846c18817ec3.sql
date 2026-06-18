-- Add is_holiday_shift column to calendar_days table
ALTER TABLE public.calendar_days 
ADD COLUMN is_holiday_shift boolean DEFAULT false;