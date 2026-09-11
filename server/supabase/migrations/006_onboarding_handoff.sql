-- Add new fields to the existing onboarding_handoffs table
ALTER TABLE public.onboarding_handoffs
ADD COLUMN created_by UUID NULL REFERENCES public.users(user_id),
ADD COLUMN completed_at TIMESTAMPTZ NULL,
ADD COLUMN handoff_notes TEXT NULL;
