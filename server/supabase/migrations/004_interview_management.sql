ALTER TABLE public.interviews
ADD COLUMN mode TEXT NULL CHECK (mode IN ('online', 'offline')),
ADD COLUMN scheduled_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
ADD COLUMN reschedule_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN reschedule_request_reason TEXT NULL,
ADD COLUMN reschedule_requested_at TIMESTAMPTZ NULL,
ADD COLUMN reschedule_requested_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Enforce constraints on existing columns if they are not already constrained strictly
ALTER TABLE public.interviews
DROP CONSTRAINT IF EXISTS interviews_attendance_check,
ADD CONSTRAINT interviews_attendance_check CHECK (attendance IN ('pending', 'present', 'absent', 'no_show'));

ALTER TABLE public.interviews
DROP CONSTRAINT IF EXISTS interviews_status_check,
ADD CONSTRAINT interviews_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled'));

-- Evaluation table constraints
ALTER TABLE public.interview_evaluations
DROP CONSTRAINT IF EXISTS interview_evaluations_decision_check,
ADD CONSTRAINT interview_evaluations_decision_check CHECK (decision IN ('selected', 'rejected'));
