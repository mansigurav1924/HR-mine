-- =============================================================
-- 013_offer_tracking.sql
-- Offer Tracking, Expiry, Candidate Response, Gmail Correlation
-- =============================================================

-- ----------------------------------------------------------------
-- 1. Extend offer_status_enum with new statuses
--    (PostgreSQL requires separate ADD VALUE statements)
-- ----------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'viewed' AND enumtypid = 'offer_status_enum'::regtype) THEN
        ALTER TYPE offer_status_enum ADD VALUE 'viewed';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'discussion_requested' AND enumtypid = 'offer_status_enum'::regtype) THEN
        ALTER TYPE offer_status_enum ADD VALUE 'discussion_requested';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = 'offer_status_enum'::regtype) THEN
        ALTER TYPE offer_status_enum ADD VALUE 'cancelled';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'withdrawn' AND enumtypid = 'offer_status_enum'::regtype) THEN
        ALTER TYPE offer_status_enum ADD VALUE 'withdrawn';
    END IF;
END $$;

-- ----------------------------------------------------------------
-- 2. Extend candidate_access_stage_enum to include 'offer'
-- ----------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'offer' AND enumtypid = 'candidate_access_stage_enum'::regtype) THEN
        ALTER TYPE candidate_access_stage_enum ADD VALUE 'offer';
    END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. Add tracking columns to the offers table
-- ----------------------------------------------------------------

-- View tracking
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;

-- PDF access tracking
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pdf_first_accessed_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pdf_last_accessed_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pdf_access_count INT DEFAULT 0;

-- Discussion
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS discussion_message TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS discussion_requested_at TIMESTAMPTZ;

-- Gmail correlation
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

-- Reminder tracking
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0;

-- Deadline extension history
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS old_expiry_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS expiry_extended_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS expiry_extended_at TIMESTAMPTZ;

-- Offer status (promote to enum-backed column if not already there)
-- The existing column is 'offer_status' using the enum. Also add the TEXT 'offer_status' alias
-- NOTE: existing schema uses both 'status' (TEXT) and 'offer_status' (enum). Normalise.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS offer_status offer_status_enum;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS email_status email_status_enum DEFAULT 'pending';

-- Timestamp fields normalisation
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS offer_issue_date DATE;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS offer_expiry_date DATE;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS response_date TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ----------------------------------------------------------------
-- 4. Create offer_events table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_id UUID NOT NULL REFERENCES public.offers(offer_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    -- e.g. OFFER_GENERATED, OFFER_SENT, OFFER_VIEWED, OFFER_PDF_ACCESSED,
    --      OFFER_REPLY_RECEIVED, OFFER_REPLY_CLASSIFIED, OFFER_DISCUSSION_REQUESTED,
    --      OFFER_ACCEPTED, OFFER_DECLINED, OFFER_EXPIRED, OFFER_REMINDER_SENT,
    --      OFFER_EXPIRY_EXTENDED, OFFER_CANCELLED, OFFER_WITHDRAWN
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    actor_type TEXT, -- 'candidate', 'hr_admin', 'system'
    actor_id TEXT,   -- user_id or 'system'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_events_offer_id ON public.offer_events(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_events_type ON public.offer_events(event_type);
CREATE INDEX IF NOT EXISTS idx_offer_events_occurred_at ON public.offer_events(occurred_at DESC);

-- ----------------------------------------------------------------
-- 5. Create offer_communications table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_communications (
    communication_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_id UUID REFERENCES public.offers(offer_id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(application_id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    channel TEXT DEFAULT 'email',
    provider TEXT DEFAULT 'gmail',
    gmail_message_id TEXT,
    gmail_thread_id TEXT,
    message_type TEXT,  -- 'offer_sent', 'reminder', 'reply', 'discussion_notification'
    reply_intent TEXT,  -- 'interested', 'not_interested', 'discussion_required', 'needs_more_time', 'unclear'
    intent_confidence FLOAT,  -- NULL for rule-based, 0-1 for future ML
    raw_excerpt TEXT,   -- sanitized first 500 chars of reply
    received_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    hr_classification TEXT,  -- HR can override: 'interested', 'not_interested', etc.
    hr_classified_at TIMESTAMPTZ,
    hr_classified_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_comm_offer_id ON public.offer_communications(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_comm_gmail_thread ON public.offer_communications(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_offer_comm_direction ON public.offer_communications(direction);

-- ----------------------------------------------------------------
-- 6. RLS policies (allow authenticated users to read offer data)
-- ----------------------------------------------------------------
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read offer_events"
    ON public.offer_events FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert offer_events"
    ON public.offer_events FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read offer_communications"
    ON public.offer_communications FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert offer_communications"
    ON public.offer_communications FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update offer_communications"
    ON public.offer_communications FOR UPDATE
    USING (auth.role() = 'authenticated');
