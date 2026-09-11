-- --------------------------------------------------
-- MIGRATION: 002_assessment_override.sql
-- PURPOSE: Add safe HR override fields to assessments
-- --------------------------------------------------

ALTER TABLE public.assessments
ADD COLUMN calculated_result assessment_result_enum NULL,
ADD COLUMN override_reason TEXT NULL,
ADD COLUMN overridden_by UUID NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
ADD COLUMN overridden_at TIMESTAMPTZ NULL;

-- The existing `result` column will now serve as the "effective_result".
-- When an assessment is naturally scored, `calculated_result` and `result` are set identical.
-- When HR overrides, `result` is updated, and the override metadata is populated.
