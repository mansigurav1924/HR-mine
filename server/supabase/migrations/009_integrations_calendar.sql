-- --------------------------------------------------
-- 009_integrations_calendar.sql
-- Integration credentials and interview calendar sync fields
-- --------------------------------------------------

-- 1. Integration Credentials table for OAuth tokens (encrypted at rest)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    integration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL, -- 'google', 'microsoft'
    account_email TEXT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    token_expiry TIMESTAMPTZ NULL,
    granted_scopes TEXT[] NULL,
    connected_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_integration_provider_user UNIQUE(provider, connected_by)
);

CREATE TRIGGER set_timestamp_integration_credentials
BEFORE UPDATE ON public.integration_credentials
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- 2. Interview table calendar sync tracking fields
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS calendar_provider TEXT NULL, -- 'google', 'outlook'
ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT NULL, -- 'synced', 'failed', 'pending'
ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS calendar_last_error TEXT NULL,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45;
