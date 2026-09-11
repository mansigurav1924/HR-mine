# HR Recruitment Management System - Database Schema

This directory contains the database migrations and seed files for the HR Recruitment Management System built on Supabase PostgreSQL.

## Migration Files
- `migrations/001_initial_schema.sql`: Contains the complete initial database structure including tables, enums, triggers, indexes, and Row Level Security configurations.

## How to execute the migration
1. Open your Supabase project dashboard.
2. Navigate to the **SQL Editor** on the left sidebar.
3. Click **New Query**.
4. Copy the entire contents of `migrations/001_initial_schema.sql` and paste it into the query window.
5. Click **Run**.
6. To confirm the tables exist, navigate to the **Table Editor** on the left sidebar. You should see all 18 tables under the `public` schema.

## Seeding the HR Admin Account
Because the application disables public signups, you must manually create your first HR user and link it to the public schema:
1. In the Supabase dashboard, go to **Authentication** > **Users** and click **Add user**.
2. Enter an email and password for your HR admin.
3. Open `seed/001_hr_admin.example.sql` and copy its contents.
4. Go to the **SQL Editor**, create a new query, and paste the code.
5. **Replace** the placeholder `YOUR_HR_EMAIL` with the email you just created.
6. Click **Run**. Your user is now linked as an `hr_admin`.

## Security & Row Level Security (RLS) Configuration
- **RLS is enabled** on every recruitment table in the `public` schema.
- **No permissive policies** (e.g., `USING (true)`) are created. 
- Because of this, the frontend React application **must not** and **cannot** query these tables directly via the Supabase Javascript client. The database will reject the requests.
- **FastAPI Service**: The FastAPI backend is configured with the `SUPABASE_SECRET_KEY` (service role key), which securely bypasses RLS on the server side to perform required operations on behalf of the application logic. This enforces an architecture of `React -> FastAPI -> Supabase`.
- **Audit Logs**: The `audit_logs` table has additional PostgreSQL protections (`REVOKE UPDATE, DELETE`) ensuring it is strictly append-only.

## Development Rollback
If you need to safely rollback or reset the schema during development:
1. You can go to the Supabase Database settings and reset the project.
2. Alternatively, you can drop the `public` schema and recreate it using the SQL Editor:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   -- Then re-run 001_initial_schema.sql
   ```
