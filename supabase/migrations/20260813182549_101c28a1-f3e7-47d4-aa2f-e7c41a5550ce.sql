CREATE OR REPLACE FUNCTION public.trigger_analise_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  edge_url text := 'https://fvadyiuendhtqxddsmfw.supabase.co/functions/v1/analisar-documentacao';
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YWR5aXVlbmRodHF4ZGRzbWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjAwNzYsImV4cCI6MjA5MDYzNjA3Nn0.V1xaxzFslyhTK8BlHElFv3OA4Xzmn6naUbeA8Pjtg4c';
BEGIN
  IF NEW.documentos_completos IS TRUE AND (OLD.documentos_completos IS DISTINCT FROM TRUE) THEN
    PERFORM net.http_post(
      url := edge_url,
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'submissions',
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      timeout_milliseconds := 10000
    );
  END IF;
  RETURN NEW;
END;
$function$;