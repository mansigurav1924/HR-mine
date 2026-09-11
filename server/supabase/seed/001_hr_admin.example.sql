-- --------------------------------------------------
-- 001_hr_admin.example.sql
-- Seed script to link an existing Supabase Auth user to the public.users table.
-- --------------------------------------------------

-- INSTRUCTIONS:
-- 1. Create a user inside the Supabase Dashboard (Authentication -> Users -> Add user).
-- 2. Replace 'YOUR_HR_EMAIL' with the exact email address you used in step 1.
-- 3. Execute this script in the Supabase SQL Editor.

DO $$
DECLARE
    target_user_id UUID;
    target_email TEXT := 'mgurav2412@gmail.com'; -- REPLACE THIS WITH REAL EMAIL
BEGIN
    -- Find the auth user by email
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email LIMIT 1;
    
    IF target_user_id IS NOT NULL THEN
        -- Insert into public.users if not already exists
        INSERT INTO public.users (user_id, email, role, mfa_enabled)
        VALUES (target_user_id, target_email, 'hr_admin', FALSE)
        ON CONFLICT (user_id) DO UPDATE 
        SET role = 'hr_admin';
        
        RAISE NOTICE 'User % successfully linked to public.users as hr_admin.', target_email;
    ELSE
        RAISE EXCEPTION 'User % not found in auth.users. Please create the user in the Supabase Auth dashboard first.', target_email;
    END IF;
END $$;
