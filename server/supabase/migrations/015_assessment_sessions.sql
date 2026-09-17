-- Migration: 015_assessment_sessions.sql
-- Create assessment sessions table for one-resume-chance logic

CREATE TYPE assessment_session_status AS ENUM ('active', 'interrupted', 'completed', 'auto_submitted');
CREATE TYPE assessment_session_end_reason AS ENUM ('candidate_submitted', 'second_session_interrupted', 'auto_submitted');

CREATE TABLE public.assessment_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
    session_number INT NOT NULL CHECK (session_number IN (1, 2)),
    status assessment_session_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    end_reason assessment_session_end_reason,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assessment_id, session_number)
);

-- RLS policies
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated backend
CREATE POLICY "Enable read access for authenticated roles on assessment_sessions" 
ON public.assessment_sessions FOR SELECT 
TO authenticated 
USING (true);

-- Allow insert access for authenticated backend
CREATE POLICY "Enable insert access for authenticated roles on assessment_sessions" 
ON public.assessment_sessions FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow update access for authenticated backend
CREATE POLICY "Enable update access for authenticated roles on assessment_sessions" 
ON public.assessment_sessions FOR UPDATE 
TO authenticated 
USING (true);
