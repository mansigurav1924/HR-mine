-- Migration 002: 30-second per-question timer + integrity penalty scoring
-- Add timer columns to assessments, response_status to assessment_responses
-- Existing rows: new columns default to NULL/0 so no existing data is broken.

-- ── assessments: timer + scoring columns ──────────────────────────────────────

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS question_started_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS question_deadline_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_question_index  INTEGER,
  ADD COLUMN IF NOT EXISTS raw_score               NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS integrity_penalty       NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_score          NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS timed_out_count         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS integrity_policy_snapshot JSONB;

-- ── assessment_responses: status + audit columns ──────────────────────────────

ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS response_status  TEXT DEFAULT 'answered',
  ADD COLUMN IF NOT EXISTS marks_awarded    NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timed_out_at    TIMESTAMPTZ;

-- Backfill response_status for existing answered rows
UPDATE assessment_responses
  SET response_status = CASE
    WHEN is_correct = TRUE  THEN 'answered_correct'
    WHEN is_correct = FALSE THEN 'answered_incorrect'
    ELSE 'answered'
  END
WHERE response_status IS NULL OR response_status = 'answered';

-- Index for quick timer lookups
CREATE INDEX IF NOT EXISTS idx_assessments_deadline ON assessments(assessment_id, question_deadline_at)
  WHERE question_deadline_at IS NOT NULL;
