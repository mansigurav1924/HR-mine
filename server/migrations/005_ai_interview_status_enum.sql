-- Migration 005: Add AI interview statuses
ALTER TYPE candidate_access_stage_enum ADD VALUE IF NOT EXISTS 'ai_interview';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'ai_interview_invited';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'ai_interview_opened';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'ai_interview_completed';
ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'human_interview_ready';
