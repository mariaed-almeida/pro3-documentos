-- E-mails do sistema: protocolo ao veículo e devolução com pendências.
-- Chave e remetente do provedor ficam no Vault; cada tentativa de envio é registrada.

create or replace function public.obter_segredo(p_nome text)
returns text language sql stable security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_nome and p_nome in ('anthropic_api_key', 'resend_api_key', 'email_from')
$$;

create table public.emails_enviados (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions (id) on delete cascade,
  tipo text not null check (tipo in ('protocolo', 'devolucao')),
  para text not null,
  assunto text not null,
  status text not null check (status in ('enviado', 'falhou', 'nao_configurado')),
  erro text,
  provider_id text,
  created_at timestamptz not null default now()
);
create index emails_enviados_submission_idx on public.emails_enviados (submission_id, created_at desc);

alter table public.emails_enviados enable row level security;
revoke all on public.emails_enviados from anon, authenticated;
grant select on public.emails_enviados to authenticated;
create policy "equipe ve emails enviados" on public.emails_enviados for select to authenticated
  using ((select private.is_staff()));

-- Quando o envio fica completo, pede o e-mail de protocolo (mesmo mecanismo da pré-análise).
create function private.trigger_email_protocolo()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'analise_webhook_secret';
  if base_url is null or secret is null then
    return new;
  end if;
  perform net.http_post(
    url := base_url || '/functions/v1/enviar-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('tipo', 'protocolo', 'submissionId', new.id),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;
revoke all on function private.trigger_email_protocolo() from public, anon, authenticated;

create trigger on_documentos_completos_email_protocolo
after update of documentos_completos on public.submissions
for each row
when (new.documentos_completos is true and old.documentos_completos is distinct from true)
execute function private.trigger_email_protocolo();
