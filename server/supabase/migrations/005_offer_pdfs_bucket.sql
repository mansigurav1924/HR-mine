-- Create the private offer-pdfs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-pdfs', 'offer-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for offer-pdfs
-- Note: As a private bucket, only authenticated users (or service roles) should access it.
-- The backend uses the service role key to generate signed URLs, so RLS policies here
-- only need to allow the service role (which bypasses RLS) or authenticated HR admins if they access directly.

CREATE POLICY "Allow authenticated HR full access to offer-pdfs" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'offer-pdfs')
WITH CHECK (bucket_id = 'offer-pdfs');
