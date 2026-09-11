-- --------------------------------------------------
-- 001_initial_schema.sql
-- Initial Schema for HR Recruitment Management System
-- --------------------------------------------------

-- --------------------------------------------------
-- CLEANUP PREVIOUS ATTEMPTS (Safely Re-runnable)
-- --------------------------------------------------
DROP TABLE IF EXISTS public.data_access_requests CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.onboarding_handoffs CASCADE;
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.offer_templates CASCADE;
DROP TABLE IF EXISTS public.interview_evaluations CASCADE;
DROP TABLE IF EXISTS public.interviews CASCADE;
DROP TABLE IF EXISTS public.ai_interview_evaluations CASCADE;
DROP TABLE IF EXISTS public.ai_interviews CASCADE;
DROP TABLE IF EXISTS public.assessment_responses CASCADE;
DROP TABLE IF EXISTS public.assessments CASCADE;
DROP TABLE IF EXISTS public.candidate_access_tokens CASCADE;
DROP TABLE IF EXISTS public.shortlisting_decisions CASCADE;
DROP TABLE IF EXISTS public.ml_evaluations CASCADE;
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.job_requirements CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP TYPE IF EXISTS application_source_enum CASCADE;
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS application_status_enum CASCADE;
DROP TYPE IF EXISTS candidate_access_stage_enum CASCADE;
DROP TYPE IF EXISTS assessment_result_enum CASCADE;
DROP TYPE IF EXISTS offer_status_enum CASCADE;
DROP TYPE IF EXISTS email_status_enum CASCADE;
DROP TYPE IF EXISTS data_access_request_type_enum CASCADE;
DROP TYPE IF EXISTS data_access_request_status_enum CASCADE;

-- --------------------------------------------------
-- EXTENSIONS
-- --------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------
-- ENUMS
-- --------------------------------------------------

CREATE TYPE application_source_enum AS ENUM ('website', 'email');

CREATE TYPE user_role_enum AS ENUM ('hr_admin', 'interviewer');

CREATE TYPE application_status_enum AS ENUM (
    'application_received', 'under_review', 'ml_evaluated', 'shortlisted', 'non_shortlisted', 
    'assessment_invited', 'assessment_passed', 'assessment_failed', 'ai_interview_invited', 
    'ai_interview_completed', 'interview_scheduled', 'interview_completed', 'interview_selected', 
    'interview_rejected', 'final_selected', 'offer_generated', 'offer_sent', 'offer_accepted', 
    'offer_declined', 'offer_negotiating', 'offer_expired', 'onboarding_handoff_ready', 'withdrawn'
);

CREATE TYPE candidate_access_stage_enum AS ENUM ('assessment', 'ai_interview');

CREATE TYPE assessment_result_enum AS ENUM ('pass', 'fail');

CREATE TYPE offer_status_enum AS ENUM ('generated', 'sent', 'accepted', 'declined', 'negotiating', 'expired');

CREATE TYPE email_status_enum AS ENUM ('pending', 'queued', 'sent', 'failed', 'bounced');

CREATE TYPE data_access_request_type_enum AS ENUM ('access', 'erasure');

CREATE TYPE data_access_request_status_enum AS ENUM ('pending', 'fulfilled');


-- --------------------------------------------------
-- TRIGGER FUNCTION FOR UPDATED_AT
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------
-- TABLE: users
-- --------------------------------------------------
CREATE TABLE public.users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role_enum NOT NULL,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    invited_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: job_requirements
-- --------------------------------------------------
CREATE TABLE public.job_requirements (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_title TEXT NOT NULL,
    department TEXT NOT NULL,
    required_skills TEXT[] DEFAULT '{}',
    preferred_skills TEXT[] DEFAULT '{}',
    education TEXT,
    experience_min NUMERIC NULL,
    experience_max NUMERIC NULL,
    share_prior_round_feedback BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_job_requirements
BEFORE UPDATE ON public.job_requirements
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: applications
-- --------------------------------------------------
CREATE TABLE public.applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL DEFAULT gen_random_uuid(), 
    candidate_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    department TEXT,
    position TEXT,
    position_id UUID NULL REFERENCES public.job_requirements(position_id) ON DELETE SET NULL,
    source application_source_enum,
    application_date TIMESTAMPTZ DEFAULT NOW(),
    resume_url TEXT,
    education JSONB,
    skills JSONB,
    experience JSONB,
    projects JSONB,
    portfolio TEXT,
    github TEXT,
    linkedin TEXT,
    current_status application_status_enum,
    duplicate_of UUID NULL REFERENCES public.applications(application_id) ON DELETE SET NULL,
    retention_expires_at TIMESTAMPTZ NULL,
    email_bounced BOOLEAN DEFAULT FALSE,
    email_bounce_reason TEXT NULL,
    consent_version TEXT,
    consented_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_applications
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: ml_evaluations
-- --------------------------------------------------
CREATE TABLE public.ml_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.job_requirements(position_id) ON DELETE CASCADE,
    model_version TEXT NOT NULL,
    predicted_class TEXT CHECK (predicted_class IN ('good_intern', 'bad_intern')),
    match_score NUMERIC,
    matching_skills TEXT[] DEFAULT '{}',
    missing_skills TEXT[] DEFAULT '{}',
    relevant_experience JSONB,
    relevant_projects JSONB,
    recommendation TEXT,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------
-- TABLE: shortlisting_decisions
-- --------------------------------------------------
CREATE TABLE public.shortlisting_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    reason TEXT,
    decided_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------
-- TABLE: candidate_access_tokens
-- --------------------------------------------------
CREATE TABLE public.candidate_access_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    stage candidate_access_stage_enum,
    token_hash TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------
-- TABLE: assessments
-- --------------------------------------------------
CREATE TABLE public.assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.job_requirements(position_id) ON DELETE CASCADE,
    questions_json JSONB NOT NULL,
    candidate_rated_skills JSONB,
    pass_threshold NUMERIC NOT NULL,
    score NUMERIC NULL,
    result assessment_result_enum NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    access_token_id UUID NULL REFERENCES public.candidate_access_tokens(token_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_assessments
BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: assessment_responses
-- --------------------------------------------------
CREATE TABLE public.assessment_responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    selected_option TEXT,
    is_correct BOOLEAN,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assessment_id, question_index)
);

-- --------------------------------------------------
-- TABLE: ai_interviews
-- --------------------------------------------------
CREATE TABLE public.ai_interviews (
    ai_interview_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.job_requirements(position_id) ON DELETE CASCADE,
    questions_json JSONB NOT NULL,
    answers_json JSONB,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    access_token_id UUID NULL REFERENCES public.candidate_access_tokens(token_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_ai_interviews
BEFORE UPDATE ON public.ai_interviews
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: ai_interview_evaluations (RESERVED)
-- --------------------------------------------------
-- COMMENT: This table is reserved for future LLM functionality. LLM functionality is NOT currently implemented.
CREATE TABLE public.ai_interview_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_interview_id UUID NOT NULL REFERENCES public.ai_interviews(ai_interview_id) ON DELETE CASCADE,
    question_index INTEGER,
    ai_score NUMERIC,
    ai_reasoning TEXT,
    aggregate_score NUMERIC,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------
-- TABLE: interviews
-- --------------------------------------------------
CREATE TABLE public.interviews (
    interview_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    depends_on_round UUID NULL REFERENCES public.interviews(interview_id) ON DELETE SET NULL,
    date DATE,
    time TIME,
    interviewer_id UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    type TEXT,
    location TEXT,
    meeting_link TEXT,
    calendar_event_id TEXT NULL,
    status TEXT,
    attendance TEXT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_interviews
BEFORE UPDATE ON public.interviews
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: interview_evaluations
-- --------------------------------------------------
CREATE TABLE public.interview_evaluations (
    evaluation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL UNIQUE REFERENCES public.interviews(interview_id) ON DELETE CASCADE,
    technical NUMERIC,
    communication NUMERIC,
    problem_solving NUMERIC,
    project_knowledge NUMERIC,
    confidence NUMERIC,
    overall_score NUMERIC,
    notes TEXT,
    decision TEXT,
    decided_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_interview_evaluations
BEFORE UPDATE ON public.interview_evaluations
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: offer_templates
-- --------------------------------------------------
CREATE TABLE public.offer_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    department TEXT NULL,
    region TEXT NULL,
    version INTEGER NOT NULL,
    html_body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, version)
);

CREATE TRIGGER set_timestamp_offer_templates
BEFORE UPDATE ON public.offer_templates
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: offers
-- --------------------------------------------------
CREATE TABLE public.offers (
    offer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    template_id UUID NULL REFERENCES public.offer_templates(template_id) ON DELETE SET NULL,
    template_version INTEGER,
    email TEXT,
    designation TEXT,
    department TEXT,
    joining_date DATE,
    end_date DATE,
    duration TEXT,
    stipend NUMERIC,
    reporting_manager TEXT,
    offer_issue_date DATE,
    offer_expiry_date DATE,
    pdf_url TEXT NULL,
    email_status email_status_enum,
    offer_status offer_status_enum,
    response_date TIMESTAMPTZ NULL,
    generated_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_offers
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: onboarding_handoffs
-- --------------------------------------------------
CREATE TABLE public.onboarding_handoffs (
    handoff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL UNIQUE REFERENCES public.offers(offer_id) ON DELETE CASCADE,
    document_checklist JSONB,
    it_provisioning_requested BOOLEAN DEFAULT FALSE,
    hris_handoff_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_onboarding_handoffs
BEFORE UPDATE ON public.onboarding_handoffs
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: email_logs
-- --------------------------------------------------
CREATE TABLE public.email_logs (
    email_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    offer_id UUID NULL REFERENCES public.offers(offer_id) ON DELETE CASCADE,
    template_id UUID NULL REFERENCES public.offer_templates(template_id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    status email_status_enum,
    sent_at TIMESTAMPTZ NULL,
    error TEXT NULL,
    retry_count INTEGER DEFAULT 0,
    bounce_type TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_email_logs
BEFORE UPDATE ON public.email_logs
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: audit_logs
-- --------------------------------------------------
-- The audit log is APPEND ONLY. No updated_at trigger is added.
CREATE TABLE public.audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hr_user UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    role TEXT,
    action TEXT NOT NULL,
    candidate_id UUID NULL,
    application_id UUID NULL REFERENCES public.applications(application_id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    previous_status TEXT NULL,
    new_status TEXT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Database-level protection against updates or deletes on audit_logs
REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC;

-- --------------------------------------------------
-- TABLE: data_access_requests
-- --------------------------------------------------
CREATE TABLE public.data_access_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NULL,
    email TEXT,
    request_type data_access_request_type_enum,
    status data_access_request_status_enum DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    fulfilled_at TIMESTAMPTZ NULL,
    fulfilled_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    export_file_url TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_data_access_requests
BEFORE UPDATE ON public.data_access_requests
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- INDEXES
-- --------------------------------------------------
CREATE INDEX idx_applications_email ON public.applications(email);
CREATE INDEX idx_applications_current_status ON public.applications(current_status);
CREATE INDEX idx_applications_position_id ON public.applications(position_id);
CREATE INDEX idx_applications_application_date ON public.applications(application_date);

CREATE INDEX idx_ml_evaluations_application_id ON public.ml_evaluations(application_id);
CREATE INDEX idx_ml_evaluations_position_id ON public.ml_evaluations(position_id);

CREATE INDEX idx_assessments_application_id ON public.assessments(application_id);
CREATE INDEX idx_assessments_result ON public.assessments(result);

CREATE INDEX idx_ai_interviews_application_id ON public.ai_interviews(application_id);

CREATE INDEX idx_candidate_access_tokens_token_hash ON public.candidate_access_tokens(token_hash);
CREATE INDEX idx_candidate_access_tokens_application_id ON public.candidate_access_tokens(application_id);
CREATE INDEX idx_candidate_access_tokens_expires_at ON public.candidate_access_tokens(expires_at);

CREATE INDEX idx_interviews_application_id ON public.interviews(application_id);
CREATE INDEX idx_interviews_interviewer_id ON public.interviews(interviewer_id);
CREATE INDEX idx_interviews_date ON public.interviews(date);

CREATE INDEX idx_offers_application_id ON public.offers(application_id);
CREATE INDEX idx_offers_offer_status ON public.offers(offer_status);

CREATE INDEX idx_email_logs_application_id ON public.email_logs(application_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);

CREATE INDEX idx_audit_logs_application_id ON public.audit_logs(application_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);

CREATE INDEX idx_data_access_requests_email ON public.data_access_requests(email);
CREATE INDEX idx_data_access_requests_status ON public.data_access_requests(status);

-- --------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------
-- Enabling RLS without adding policies effectively denies all access 
-- to the tables for any role except superuser or those with bypassrls.
-- This enforces the React -> FastAPI -> Supabase architecture.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlisting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_requests ENABLE ROW LEVEL SECURITY;
