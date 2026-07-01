-- Habilita pg_net para chamadas HTTP a partir do banco
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função trigger: quando documentos_completos passa para true, chama a Edge Function
CREATE OR REPLACE FUNCTION public.trigger_analise_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text := 'https://fvadyiuendhtqxddsmfw.supabase.co/functions/v1/analisar-documentacao';
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YWR5aXVlbmRodHF4ZGRzbWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjAwNzYsImV4cCI6MjA5MDYzNjA3Nn0.V1xaxzFslyhTK8BlHElFv3OA4Xzmn6naUbeA8Pjtg4c';
BEGIN
  IF NEW.documentos_completos IS TRUE AND (OLD.documentos_completos IS DISTINCT FROM TRUE) THEN
    PERFORM extensions.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'submissions',
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_documentos_completos_analise_ia ON public.submissions;

CREATE TRIGGER on_documentos_completos_analise_ia
AFTER UPDATE OF documentos_completos ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_analise_ia();