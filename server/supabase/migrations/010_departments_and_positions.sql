-- 010_departments_and_positions.sql

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- 2. Alter job_requirements table (Positions)
ALTER TABLE public.job_requirements
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(department_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS job_code TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS number_of_openings INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Internship',
ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'Remote',
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS application_open_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS application_close_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS publication_status TEXT DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS manual_application_status TEXT;

-- 3. Alter applications table to reference department_id
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(department_id) ON DELETE SET NULL;

-- 4. Data Migration: Auto-create departments from existing data in job_requirements and applications
DO $$ 
DECLARE
    dept_name TEXT;
    new_dept_id UUID;
BEGIN
    -- Get distinct departments from existing applications
    FOR dept_name IN (SELECT DISTINCT department FROM public.applications WHERE department IS NOT NULL AND department != '')
    LOOP
        -- Insert if not exists
        INSERT INTO public.departments (name)
        VALUES (dept_name)
        ON CONFLICT (name) DO NOTHING;
    END LOOP;

    -- Get distinct departments from existing job_requirements
    FOR dept_name IN (SELECT DISTINCT department FROM public.job_requirements WHERE department IS NOT NULL AND department != '')
    LOOP
        -- Insert if not exists
        INSERT INTO public.departments (name)
        VALUES (dept_name)
        ON CONFLICT (name) DO NOTHING;
    END LOOP;

    -- Update job_requirements with correct department_id
    UPDATE public.job_requirements j
    SET department_id = d.department_id
    FROM public.departments d
    WHERE j.department = d.name;

    -- Update applications with correct department_id
    UPDATE public.applications a
    SET department_id = d.department_id
    FROM public.departments d
    WHERE a.department = d.name;
END $$;
