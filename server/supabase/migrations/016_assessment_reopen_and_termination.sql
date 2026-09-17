-- Migration: 016_assessment_reopen_and_termination.sql
-- Add reopen_count, termination_reason, and completed_at columns to assessments if they do not exist

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_reason TEXT;

-- Drop and recreate the view if it relies on a strict column set (optional, usually ALTER TABLE is enough)
-- Update existing rows where reopen_count is NULL
UPDATE public.assessments SET reopen_count = 0 WHERE reopen_count IS NULL;

-- Make sure the schema cache is refreshed in PostgREST
NOTIFY pgrst, 'reload schema';
