DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
CREATE POLICY "Anyone can create submissions"
ON public.submissions
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create documents" ON public.documents;
CREATE POLICY "Anyone can create documents"
ON public.documents
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can view own submission" ON public.submissions;
CREATE POLICY "Anon can view own submission"
ON public.submissions
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon can view documents" ON public.documents;
CREATE POLICY "Anon can view documents"
ON public.documents
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anyone can upload documents with limits" ON storage.objects;
CREATE POLICY "Anyone can upload documents with limits"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    name LIKE '%.pdf' OR name LIKE '%.PDF'
    OR name LIKE '%.jpg' OR name LIKE '%.JPG'
    OR name LIKE '%.jpeg' OR name LIKE '%.JPEG'
    OR name LIKE '%.png' OR name LIKE '%.PNG'
    OR name LIKE '%.doc' OR name LIKE '%.DOC'
    OR name LIKE '%.docx' OR name LIKE '%.DOCX'
  )
);