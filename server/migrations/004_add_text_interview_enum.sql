-- Migration 004: Add text_interview to candidate_access_stage_enum

ALTER TYPE candidate_access_stage_enum ADD VALUE IF NOT EXISTS 'text_interview';
