CREATE POLICY "Anon can mark documentos_completos"
ON public.submissions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (documentos_completos = true);