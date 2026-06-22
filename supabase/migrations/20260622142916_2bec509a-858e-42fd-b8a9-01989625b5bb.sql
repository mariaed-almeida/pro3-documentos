DROP POLICY IF EXISTS "Anon can view own submission" ON public.submissions;
DROP POLICY IF EXISTS "Anon can view documents" ON public.documents;
REVOKE SELECT ON public.submissions FROM anon;
REVOKE SELECT ON public.documents FROM anon;