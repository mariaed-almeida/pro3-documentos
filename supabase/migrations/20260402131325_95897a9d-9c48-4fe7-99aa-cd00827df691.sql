
-- 1. Tighten submissions: restrict SELECT and UPDATE to authenticated only
DROP POLICY IF EXISTS "Anyone can view submissions" ON public.submissions;
CREATE POLICY "Authenticated users can view submissions"
  ON public.submissions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can update submissions" ON public.submissions;
CREATE POLICY "Authenticated users can update submissions"
  ON public.submissions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- 2. Tighten documents: restrict SELECT to authenticated only
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;
CREATE POLICY "Authenticated users can view documents"
  ON public.documents FOR SELECT TO authenticated
  USING (true);

-- 3. Make storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'documentos';

-- 4. Drop public storage SELECT policy and create authenticated-only
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
CREATE POLICY "Authenticated users can view storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');
