ALTER TABLE ai_interviews
ADD COLUMN IF NOT EXISTS completion_mode VARCHAR(50),
ADD COLUMN IF NOT EXISTS score INTEGER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
