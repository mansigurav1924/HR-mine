-- Migration 011: Final Selection Decisions Table
-- Stores full auditable HR decision history for Final Selection stage
-- Do NOT modify previous migrations

-- Create final_selection_decisions table
CREATE TABLE IF NOT EXISTS final_selection_decisions (
    decision_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    decision        TEXT NOT NULL CHECK (decision IN ('selected', 'rejected', 'hold')),
    hr_notes        TEXT,
    reason          TEXT,
    hold_review_date DATE,
    decided_by      UUID NOT NULL,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by application
CREATE INDEX IF NOT EXISTS idx_fsd_application_id ON final_selection_decisions(application_id);

-- Index for listing decisions by actor
CREATE INDEX IF NOT EXISTS idx_fsd_decided_by ON final_selection_decisions(decided_by);

-- Add offer_eligible computed flag on applications (nullable, set by backend)
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS offer_eligible BOOLEAN DEFAULT FALSE;

-- Add final decision tracking columns on applications
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS final_decision_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS final_decision_by UUID,
    ADD COLUMN IF NOT EXISTS final_decision_notes TEXT,
    ADD COLUMN IF NOT EXISTS final_rejection_reason TEXT;
