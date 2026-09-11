-- =============================================================
-- 014_manager_directory.sql
-- Manager Directory, Profile Completion Tokens, and Department Mapping
-- =============================================================

-- ----------------------------------------------------------------
-- 1. Create Enums
-- ----------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE manager_profile_status_enum AS ENUM ('invited', 'active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ----------------------------------------------------------------
-- 2. Create reporting_managers table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_managers (
    manager_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NULL,
    designation TEXT NULL,
    contact_number TEXT NULL,
    alternate_contact TEXT NULL,
    location TEXT NULL,
    bio TEXT NULL,
    profile_status manager_profile_status_enum NOT NULL DEFAULT 'invited',
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMPTZ NULL,
    profile_completed_at TIMESTAMPTZ NULL,
    created_by UUID NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 3. Create manager_departments table (M:N Mapping)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manager_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES public.reporting_managers(manager_id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(department_id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(manager_id, department_id)
);

-- ----------------------------------------------------------------
-- 4. Create manager_profile_tokens table (Auth-Free Setup)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manager_profile_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES public.reporting_managers(manager_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 5. Extend offers table
-- ----------------------------------------------------------------
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES public.reporting_managers(manager_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reporting_manager_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS reporting_manager_designation_snapshot TEXT,
ADD COLUMN IF NOT EXISTS reporting_manager_department_snapshot TEXT;

-- ----------------------------------------------------------------
-- 6. Extend onboarding_handoffs table
-- ----------------------------------------------------------------
ALTER TABLE public.onboarding_handoffs
ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES public.reporting_managers(manager_id) ON DELETE SET NULL;
