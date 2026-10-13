-- Medição de faturamento (uma por PI) e liberação de pagamento.

create type public.status_medicao as enum ('em_medicao', 'aguardando_liberacao', 'liberado', 'pago', 'cancelado');

create table public.medicoes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete restrict,
  valor_bruto numeric(14, 2) not null check (valor_bruto >= 0),
  comissao_agencia numeric(14, 2) not null default 0 check (comissao_agencia >= 0),
  valor_liquido numeric(14, 2) generated always as (valor_bruto - comissao_agencia) stored,
  periodo_inicio date,
  periodo_fim date,
  numero_nf text,
  observacoes text,
  status public.status_medicao not null default 'em_medicao',
  criado_por uuid references auth.users (id) on delete set null,
  enviado_por uuid references auth.users (id) on delete set null,
  enviado_em timestamptz,
  liberado_por uuid references auth.users (id) on delete set null,
  liberado_em timestamptz,
  previsao_pagamento date,
  pago_por uuid references auth.users (id) on delete set null,
  pago_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (comissao_agencia <= valor_bruto),
  check (periodo_fim is null or periodo_inicio is null or periodo_fim >= periodo_inicio)
);
create index medicoes_status_idx on public.medicoes (status);
create index medicoes_criado_por_idx on public.medicoes (criado_por);
create index medicoes_enviado_por_idx on public.medicoes (enviado_por);
create index medicoes_liberado_por_idx on public.medicoes (liberado_por);
create index medicoes_pago_por_idx on public.medicoes (pago_por);

create table public.medicao_eventos (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references public.medicoes (id) on delete cascade,
  ator_id uuid references auth.users (id) on delete set null,
  tipo text not null,
  de_status public.status_medicao,
  para_status public.status_medicao,
  detalhe text,
  created_at timestamptz not null default now()
);
create index medicao_eventos_medicao_idx on public.medicao_eventos (medicao_id, created_at);
create index medicao_eventos_ator_idx on public.medicao_eventos (ator_id);

create function private.touch_medicao()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger medicoes_touch before update on public.medicoes
for each row execute function private.touch_medicao();

-- Cria a medição de um PI já aprovado.
create function public.criar_medicao(
  p_submission uuid, p_valor_bruto numeric, p_comissao numeric default 0,
  p_inicio date default null, p_fim date default null, p_nf text default null, p_obs text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  novo uuid;
begin
  if not (select private.can_operate()) then
    raise exception 'Sem permissão para criar medição' using errcode = '42501';
  end if;
  if not exists (select 1 from public.submissions where id = p_submission and status = 'aprovado') then
    raise exception 'Só é possível medir PI com documentação aprovada';
  end if;
  insert into public.medicoes (submission_id, valor_bruto, comissao_agencia, periodo_inicio, periodo_fim, numero_nf, observacoes, criado_por)
  values (p_submission, p_valor_bruto, coalesce(p_comissao, 0), p_inicio, p_fim, nullif(trim(p_nf), ''), nullif(trim(p_obs), ''), (select auth.uid()))
  returning id into novo;
  insert into public.medicao_eventos (medicao_id, ator_id, tipo, para_status)
  values (novo, (select auth.uid()), 'criada', 'em_medicao');
  return novo;
end;
$$;

-- Máquina de estados do pagamento, com o papel exigido em cada passo.
create function public.mudar_status_medicao(
  p_id uuid, p_para public.status_medicao, p_data date default null, p_detalhe text default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  m public.medicoes;
  uid uuid := (select auth.uid());
  ok boolean := false;
begin
  select * into m from public.medicoes where id = p_id for update;
  if not found then
    raise exception 'Medição não encontrada';
  end if;

  if m.status = 'em_medicao' and p_para = 'aguardando_liberacao' then
    if not (select private.can_operate()) then raise exception 'Sem permissão' using errcode = '42501'; end if;
    if m.valor_bruto <= 0 then raise exception 'Informe o valor da medição antes de enviar'; end if;
    update public.medicoes set status = p_para, enviado_por = uid, enviado_em = now() where id = p_id;
    ok := true;
  elsif m.status = 'aguardando_liberacao' and p_para = 'liberado' then
    if not ((select private.has_role('financeiro')) or (select private.has_role('admin'))) then
      raise exception 'Só o financeiro libera pagamento' using errcode = '42501';
    end if;
    update public.medicoes set status = p_para, liberado_por = uid, liberado_em = now(), previsao_pagamento = p_data where id = p_id;
    ok := true;
  elsif m.status = 'aguardando_liberacao' and p_para = 'em_medicao' then
    if not ((select private.has_role('financeiro')) or (select private.has_role('admin'))) then
      raise exception 'Sem permissão' using errcode = '42501';
    end if;
    if coalesce(trim(p_detalhe), '') = '' then raise exception 'Informe o motivo da devolução'; end if;
    update public.medicoes set status = p_para, enviado_por = null, enviado_em = null where id = p_id;
    ok := true;
  elsif m.status = 'liberado' and p_para = 'pago' then
    if not ((select private.has_role('financeiro')) or (select private.has_role('admin'))) then
      raise exception 'Só o financeiro registra pagamento' using errcode = '42501';
    end if;
    update public.medicoes set status = p_para, pago_por = uid, pago_em = coalesce(p_data, current_date) where id = p_id;
    ok := true;
  elsif m.status <> 'pago' and m.status <> 'cancelado' and p_para = 'cancelado' then
    if not (select private.has_role('admin')) then raise exception 'Só o admin cancela medição' using errcode = '42501'; end if;
    update public.medicoes set status = p_para where id = p_id;
    ok := true;
  end if;

  if not ok then
    raise exception 'Transição de % para % não permitida', m.status, p_para;
  end if;

  insert into public.medicao_eventos (medicao_id, ator_id, tipo, de_status, para_status, detalhe)
  values (p_id, uid, 'status', m.status, p_para, nullif(trim(coalesce(p_detalhe, '')), ''));
end;
$$;

revoke all on function public.criar_medicao(uuid, numeric, numeric, date, date, text, text) from public, anon;
revoke all on function public.mudar_status_medicao(uuid, public.status_medicao, date, text) from public, anon;
grant execute on function public.criar_medicao(uuid, numeric, numeric, date, date, text, text) to authenticated;
grant execute on function public.mudar_status_medicao(uuid, public.status_medicao, date, text) to authenticated;

alter table public.medicoes enable row level security;
alter table public.medicao_eventos enable row level security;
revoke all on public.medicoes, public.medicao_eventos from anon, authenticated;
grant select on public.medicoes, public.medicao_eventos to authenticated;
-- Valores só mudam enquanto a medição está em preparo; status passa pelas funções acima.
grant update (valor_bruto, comissao_agencia, periodo_inicio, periodo_fim, numero_nf, observacoes) on public.medicoes to authenticated;

create policy "equipe ve medicoes" on public.medicoes for select to authenticated using ((select private.is_staff()));
create policy "operacao edita medicao em preparo" on public.medicoes for update to authenticated
  using (status = 'em_medicao' and (select private.can_operate()))
  with check (status = 'em_medicao' and (select private.can_operate()));
create policy "equipe ve historico de medicao" on public.medicao_eventos for select to authenticated using ((select private.is_staff()));
