-- --------------------------------------------------
-- 007_indexes_hardening.sql
-- Performance Indexes for Search, Filtering & Audit Logs
-- --------------------------------------------------

-- Applications indexes
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(current_status);
CREATE INDEX IF NOT EXISTS idx_applications_department ON public.applications(department);
CREATE INDEX IF NOT EXISTS idx_applications_position_id ON public.applications(position_id);
CREATE INDEX IF NOT EXISTS idx_applications_email ON public.applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_app_date ON public.applications(application_date);

-- Interviews indexes
CREATE INDEX IF NOT EXISTS idx_interviews_app_id ON public.interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer_id ON public.interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON public.interviews(date);

-- Offers indexes
CREATE INDEX IF NOT EXISTS idx_offers_app_id ON public.offers(application_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers(offer_status);
CREATE INDEX IF NOT EXISTS idx_offers_issue_date ON public.offers(offer_issue_date);

-- Onboarding handoffs indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_offer_id ON public.onboarding_handoffs(offer_id);

-- Candidate access tokens indexes
CREATE INDEX IF NOT EXISTS idx_candidate_tokens_hash ON public.candidate_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_candidate_tokens_app_id ON public.candidate_access_tokens(application_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_app_id ON public.audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hr_user ON public.audit_logs(hr_user);
