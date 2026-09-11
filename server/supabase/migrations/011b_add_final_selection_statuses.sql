-- Migration 011b: Add Final Selection statuses to the application_status_enum
-- AND extend the enum with all missing statuses needed for the full pipeline

-- Add missing statuses to the enum
-- NOTE: Postgres requires each value to be added individually
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'interview_selected';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'human_interview_completed';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'final_review_pending';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'final_selected';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'final_rejected';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'final_hold';
