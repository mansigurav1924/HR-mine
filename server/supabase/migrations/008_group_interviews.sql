-- --------------------------------------------------
-- TABLE: interview_batches
-- --------------------------------------------------
CREATE TABLE public.interview_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    interviewer_id UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    round_number INTEGER NOT NULL DEFAULT 1,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    mode TEXT DEFAULT 'online',
    calendar_provider TEXT DEFAULT 'google',
    calendar_event_id TEXT NULL,
    meeting_link TEXT NULL,
    calendar_sync_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'scheduled',
    created_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_interview_batches
BEFORE UPDATE ON public.interview_batches
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- --------------------------------------------------
-- TABLE: interview_batch_candidates
-- --------------------------------------------------
CREATE TABLE public.interview_batch_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.interview_batches(batch_id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    invitation_status TEXT DEFAULT 'pending',
    attendance_status TEXT DEFAULT 'pending',
    evaluation_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(batch_id, application_id)
);
