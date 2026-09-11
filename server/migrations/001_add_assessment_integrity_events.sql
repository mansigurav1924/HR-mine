-- Migration: Add assessment_integrity_events table
-- Tracks lightweight browser-side integrity signals during MCQ assessments.
-- Signals are for HR review only. They do NOT affect score or pass/fail automatically.

CREATE TABLE IF NOT EXISTS assessment_integrity_events (
    event_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id  UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
    event_type     TEXT NOT NULL CHECK (event_type IN (
        'TAB_SWITCH',
        'WINDOW_BLUR',
        'WINDOW_FOCUS',
        'FULLSCREEN_ENTERED',
        'FULLSCREEN_EXIT',
        'FULLSCREEN_REENTERED',
        'FULLSCREEN_UNSUPPORTED',
        'COPY_ATTEMPT',
        'PASTE_ATTEMPT',
        'CUT_ATTEMPT'
    )),
    question_index INTEGER,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata       JSONB
);

CREATE INDEX IF NOT EXISTS idx_integrity_events_assessment_id ON assessment_integrity_events(assessment_id);
CREATE INDEX IF NOT EXISTS idx_integrity_events_occurred_at   ON assessment_integrity_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_integrity_events_event_type    ON assessment_integrity_events(assessment_id, event_type);

ALTER TABLE assessment_integrity_events ENABLE ROW LEVEL SECURITY;
