-- Create the AI Interviews table if it doesn't already exist (from initial schema)
-- The initial schema should already have it, but we add safe constraints

ALTER TABLE public.ai_interviews
ADD COLUMN hr_review_status TEXT DEFAULT 'pending',
ADD COLUMN hr_technical_score NUMERIC NULL CHECK (hr_technical_score >= 1 AND hr_technical_score <= 5),
ADD COLUMN hr_problem_solving_score NUMERIC NULL CHECK (hr_problem_solving_score >= 1 AND hr_problem_solving_score <= 5),
ADD COLUMN hr_communication_score NUMERIC NULL CHECK (hr_communication_score >= 1 AND hr_communication_score <= 5),
ADD COLUMN hr_project_knowledge_score NUMERIC NULL CHECK (hr_project_knowledge_score >= 1 AND hr_project_knowledge_score <= 5),
ADD COLUMN hr_notes TEXT NULL,
ADD COLUMN reviewed_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
ADD COLUMN reviewed_at TIMESTAMPTZ NULL,
ADD COLUMN candidate_profile_confirmed BOOLEAN DEFAULT false;
