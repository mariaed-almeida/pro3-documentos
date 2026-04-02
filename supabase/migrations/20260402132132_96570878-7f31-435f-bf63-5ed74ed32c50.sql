
-- 1. Trigger to restrict which columns can be updated on submissions
CREATE OR REPLACE FUNCTION public.restrict_submission_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only allow changes to status, observacoes, updated_at
  IF NEW.cliente IS DISTINCT FROM OLD.cliente
    OR NEW.campanha IS DISTINCT FROM OLD.campanha
    OR NEW.numero_pi IS DISTINCT FROM OLD.numero_pi
    OR NEW.nome_veiculo IS DISTINCT FROM OLD.nome_veiculo
    OR NEW.cidade IS DISTINCT FROM OLD.cidade
    OR NEW.contato_nome IS DISTINCT FROM OLD.contato_nome
    OR NEW.contato_email IS DISTINCT FROM OLD.contato_email
    OR NEW.contato_telefone IS DISTINCT FROM OLD.contato_telefone
    OR NEW.tipo_veiculo IS DISTINCT FROM OLD.tipo_veiculo
    OR NEW.data_envio IS DISTINCT FROM OLD.data_envio
  THEN
    RAISE EXCEPTION 'Only status and observacoes fields can be updated';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_submission_update
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_submission_update();

-- 2. Add file size limit to storage upload policy
DROP POLICY IF EXISTS "Anyone can upload documents" ON storage.objects;
CREATE POLICY "Anyone can upload documents with limits"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'documentos'
    AND (octet_length(owner::text) IS NOT NULL OR true)
    AND (CASE
      WHEN name LIKE '%.pdf' THEN true
      WHEN name LIKE '%.PDF' THEN true
      WHEN name LIKE '%.jpg' THEN true
      WHEN name LIKE '%.JPG' THEN true
      WHEN name LIKE '%.jpeg' THEN true
      WHEN name LIKE '%.JPEG' THEN true
      WHEN name LIKE '%.png' THEN true
      WHEN name LIKE '%.PNG' THEN true
      WHEN name LIKE '%.doc' THEN true
      WHEN name LIKE '%.DOC' THEN true
      WHEN name LIKE '%.docx' THEN true
      WHEN name LIKE '%.DOCX' THEN true
      ELSE false
    END)
  );

-- 3. Set max file size on bucket (10MB)
UPDATE storage.buckets 
SET file_size_limit = 10485760
WHERE id = 'documentos';
