-- --------------------------------------------------
-- 008_candidate_verified_skills.sql
-- Candidate Verified Skills and Timestamp Tracking
-- --------------------------------------------------

ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS candidate_verified_skills JSONB NULL,
ADD COLUMN IF NOT EXISTS skills_verified_at TIMESTAMPTZ NULL;
