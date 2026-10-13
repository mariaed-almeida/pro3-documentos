-- Baseline do projeto pro3-documentos.
-- Substitui as migrations geradas pelo Lovable: schema limpo, papéis de acesso,
-- trilha de auditoria e políticas de RLS fechadas por padrão.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Papéis e perfis
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('operador', 'financeiro', 'admin');

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.admins_iniciais (email text primary key);
insert into private.admins_iniciais (email) values ('pedro.furlan@ambcorporativo.com.br');

-- Funções de apoio às políticas. Ficam em schema não exposto pela Data API.
create function private.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = _role) $$;

create function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles where user_id = (select auth.uid())) $$;

create function private.can_operate()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role in ('operador', 'admin')) $$;

-- Permite ao envio anônimo anexar documentos só a um envio recém-criado.
create function private.envio_aberto(_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.submissions where id = _id and created_at > now() - interval '30 minutes' and not documentos_completos) $$;

revoke all on function private.has_role(public.app_role), private.is_staff(), private.can_operate(), private.envio_aberto(uuid) from public;
grant execute on function private.has_role(public.app_role), private.is_staff(), private.can_operate() to authenticated;
grant execute on function private.envio_aberto(uuid) to anon, authenticated;

-- Cria o perfil de cada usuário novo e concede admin aos e-mails iniciais já confirmados.
create function private.handle_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email;

  if new.email_confirmed_at is not null
     and exists (select 1 from private.admins_iniciais where lower(email) = lower(new.email)) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_change
after insert or update of email_confirmed_at on auth.users
for each row execute function private.handle_user();

-- ---------------------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cnpj text,
  contrato_info text[] not null default '{}',
  observacoes_nf text[] not null default '{}',
  endereco_postal text,
  texto_obrigatorio_nf text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  cliente text not null references public.clientes (nome) on update cascade,
  nome text not null,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cliente, nome)
);

-- ---------------------------------------------------------------------------
-- Envios
-- ---------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.submissions (id) on delete set null,
  cliente text not null,
  campanha text not null,
  numero_pi text not null,
  tipo_veiculo text not null,
  outro_tipo text,
  nome_veiculo text not null,
  cidade text not null default '',
  contato_nome text not null,
  contato_email text not null,
  contato_telefone text not null,
  status text not null default 'recebido'
    check (status in ('recebido', 'em_revisao', 'aprovado', 'cancelado')),
  observacoes text,
  documentos_completos boolean not null default false,
  analise_ia jsonb,
  decidido_por uuid references auth.users (id) on delete set null,
  decidido_em timestamptz,
  data_envio timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_status_idx on public.submissions (status);
create index submissions_data_envio_idx on public.submissions (data_envio desc);
create index submissions_pi_idx on public.submissions (cliente, lower(trim(numero_pi)));
create index submissions_parent_idx on public.submissions (parent_id);
create index submissions_decidido_por_idx on public.submissions (decidido_por);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  doc_type text not null,
  doc_label text not null,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index documents_submission_idx on public.documents (submission_id);

create table public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  ator_id uuid references auth.users (id) on delete set null,
  tipo text not null,
  de_status text,
  para_status text,
  detalhe text,
  created_at timestamptz not null default now()
);
create index submission_events_submission_idx on public.submission_events (submission_id, created_at);
create index submission_events_ator_idx on public.submission_events (ator_id);

-- Liga reenvios ao envio anterior do mesmo PI.
create function private.link_reenvio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.parent_id is null then
    select id into new.parent_id
    from public.submissions s
    where s.cliente = new.cliente and lower(trim(s.numero_pi)) = lower(trim(new.numero_pi))
    order by s.data_envio desc
    limit 1;
  end if;
  return new;
end;
$$;
create trigger submissions_link_reenvio before insert on public.submissions
for each row execute function private.link_reenvio();

create function private.touch_submission()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then
    new.decidido_por = (select auth.uid());
    new.decidido_em = now();
  end if;
  return new;
end;
$$;
create trigger submissions_touch before update on public.submissions
for each row execute function private.touch_submission();

create function private.log_submission_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.submission_events (submission_id, tipo, para_status)
    values (new.id, 'envio', new.status);
  elsif new.status is distinct from old.status then
    insert into public.submission_events (submission_id, ator_id, tipo, de_status, para_status, detalhe)
    values (new.id, (select auth.uid()), 'status', old.status, new.status,
            case when new.status = 'em_revisao' then new.observacoes end);
  elsif new.analise_ia is distinct from old.analise_ia and new.analise_ia is not null then
    insert into public.submission_events (submission_id, tipo) values (new.id, 'analise_ia');
  end if;
  return new;
end;
$$;
create trigger submissions_log_insert after insert on public.submissions
for each row execute function private.log_submission_event();
create trigger submissions_log_update after update on public.submissions
for each row execute function private.log_submission_event();

-- Marca o envio como completo (dispara a pré-análise). Substitui o UPDATE anônimo
-- que antes valia para qualquer linha.
create function public.concluir_envio(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  n int;
begin
  update public.submissions s
  set documentos_completos = true
  where s.id = p_id
    and not s.documentos_completos
    and s.created_at > now() - interval '30 minutes'
    and exists (select 1 from public.documents d where d.submission_id = p_id);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.concluir_envio(uuid) from public;
grant execute on function public.concluir_envio(uuid) to anon, authenticated;

-- Chama a edge function de pré-análise quando o envio fica completo.
-- URL e segredo vêm do Vault; sem eles, nada é enviado.
create function private.trigger_analise_ia()
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
    url := base_url || '/functions/v1/analisar-documentacao',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body := jsonb_build_object('type', 'UPDATE', 'table', 'submissions',
                               'record', to_jsonb(new), 'old_record', to_jsonb(old)),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;
create trigger on_documentos_completos_analise_ia
after update of documentos_completos on public.submissions
for each row
when (new.documentos_completos is true and old.documentos_completos is distinct from true)
execute function private.trigger_analise_ia();

-- ---------------------------------------------------------------------------
-- Permissões de tabela e RLS
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.campanhas enable row level security;
alter table public.submissions enable row level security;
alter table public.documents enable row level security;
alter table public.submission_events enable row level security;

revoke all on public.user_roles, public.profiles, public.clientes, public.campanhas,
  public.submissions, public.documents, public.submission_events from anon, authenticated;

grant select, insert, update, delete on public.user_roles to authenticated;
grant select, update (nome, ativo) on public.profiles to authenticated;
grant select on public.clientes, public.campanhas to anon;
grant select, insert, update, delete on public.clientes, public.campanhas to authenticated;
grant insert on public.submissions, public.documents to anon;
grant select, insert on public.submissions, public.documents to authenticated;
grant update (status, observacoes) on public.submissions to authenticated;
grant select on public.submission_events to authenticated;

-- user_roles
create policy "ver proprios papeis ou admin" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('admin')));
create policy "admin concede papeis" on public.user_roles for insert to authenticated
  with check ((select private.has_role('admin')));
create policy "admin altera papeis" on public.user_roles for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy "admin remove papeis" on public.user_roles for delete to authenticated
  using ((select private.has_role('admin')));

-- profiles
create policy "equipe ve perfis" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy "editar proprio perfil ou admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.has_role('admin')))
  with check (id = (select auth.uid()) or (select private.has_role('admin')));

-- clientes
create policy "clientes ativos sao publicos" on public.clientes for select to anon, authenticated
  using (ativo or (select private.is_staff()));
create policy "admin cria clientes" on public.clientes for insert to authenticated
  with check ((select private.has_role('admin')));
create policy "admin altera clientes" on public.clientes for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy "admin remove clientes" on public.clientes for delete to authenticated
  using ((select private.has_role('admin')));

-- campanhas
create policy "campanhas ativas sao publicas" on public.campanhas for select to anon, authenticated
  using (ativa or (select private.is_staff()));
create policy "operacao cria campanhas" on public.campanhas for insert to authenticated
  with check ((select private.can_operate()));
create policy "operacao altera campanhas" on public.campanhas for update to authenticated
  using ((select private.can_operate())) with check ((select private.can_operate()));
create policy "operacao remove campanhas" on public.campanhas for delete to authenticated
  using ((select private.can_operate()));

-- submissions
create policy "veiculo cria envio" on public.submissions for insert to anon, authenticated
  with check (
    status = 'recebido' and not documentos_completos and analise_ia is null
    and parent_id is null and decidido_por is null and decidido_em is null
  );
create policy "equipe ve envios" on public.submissions for select to authenticated
  using ((select private.is_staff()));
create policy "operacao decide envios" on public.submissions for update to authenticated
  using ((select private.can_operate())) with check ((select private.can_operate()));

-- documents
create policy "veiculo anexa documento" on public.documents for insert to anon, authenticated
  with check ((select private.envio_aberto(submission_id)));
create policy "equipe ve documentos" on public.documents for select to authenticated
  using ((select private.is_staff()));

-- submission_events
create policy "equipe ve historico" on public.submission_events for select to authenticated
  using ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array[
  'application/pdf', 'image/jpeg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Caminho esperado: cliente/campanha/pi/arquivo
create policy "veiculo envia arquivo" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'documentos'
    and array_length(storage.foldername(name), 1) = 3
    and lower(name) ~ '\.(pdf|jpe?g|png|docx?|xlsx)$'
  );
create policy "equipe le arquivos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------------
insert into public.clientes (nome, cnpj, contrato_info, observacoes_nf, endereco_postal, texto_obrigatorio_nf) values
('ALESC', '83.599.191/0001-87',
  array['Contrato nº 031/2023', 'Edital nº 001/2022'],
  array[
    'A Nota Fiscal deve ser emitida somente após o término da veiculação.',
    'Utilize o modelo 62 (conforme Ajuste SINIEF nº 7/2022).',
    'O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.',
    'Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.',
    'Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.'],
  'Av. Prefeito Osmar Cunha, 416, Sala 905 — Ed. Koerich Empresarial Rio Branco — Florianópolis/SC — CEP 88.015-100',
  null),
('Prefeitura de Chapecó', '83.021.808/0001-82',
  array['Contrato nº 371/2025', 'Concorrência nº 186/2025'],
  array[
    'A Nota Fiscal deve ser emitida somente após o término da veiculação.',
    'Faturar o valor líquido diretamente contra a Prefeitura de Chapecó.',
    'O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.',
    'Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.',
    'Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.'],
  'Av. Nereu Ramos, 75D, Sala 707A — Centro Profissional Chapecó — Chapecó/SC — CEP 89801-023',
  null),
('Prefeitura de Xanxerê', '83.009.860/0001-13',
  array['Processo Licitatório nº 0066/2025', 'Concorrência nº 0001/2025', 'Contrato nº 0180/2025'],
  array[
    'A Nota Fiscal deve ser emitida somente após o término da veiculação.',
    'Faturar o valor líquido diretamente contra a Prefeitura de Xanxerê.',
    'A NF deve conter o texto: "Documento emitido em nome do tomador do serviço aos cuidados da Agência Pro3 Comunicação".',
    'O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.',
    'Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.',
    'Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.'],
  'Rua Ouro Preto, 315 — Bairro Tonial — Xanxerê/SC — CEP 89820-000',
  'Documento emitido em nome do tomador do serviço aos cuidados da Agência Pro3 Comunicação');

insert into public.campanhas (cliente, nome) values
  ('ALESC', '2026 - Demandas Bancadas Regionais - Fevereiro'),
  ('ALESC', '2026 - Institucional'),
  ('ALESC', '2026 - Sessões Especiais'),
  ('Prefeitura de Xanxerê', '2026 - Obras e Infraestrutura'),
  ('Prefeitura de Xanxerê', '2026 - Saúde Municipal'),
  ('Prefeitura de Xanxerê', '2026 - Educação'),
  ('Prefeitura de Chapecó', '2026 - Desenvolvimento Urbano'),
  ('Prefeitura de Chapecó', '2026 - Cultura e Turismo'),
  ('Prefeitura de Chapecó', '2026 - Serviços Públicos');
