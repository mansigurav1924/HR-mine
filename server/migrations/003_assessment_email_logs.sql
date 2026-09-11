-- Migration 003: Assessment Email Logs and Idempotency
-- Adds `email_type` and `assessment_id` to `email_logs` table to track assessment result emails.

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS email_type TEXT,
  ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Idempotency: A candidate should only receive ONE successful email per email type per assessment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_assessment_type_success
  ON email_logs(assessment_id, email_type)
  WHERE assessment_id IS NOT NULL AND status = 'sent';
