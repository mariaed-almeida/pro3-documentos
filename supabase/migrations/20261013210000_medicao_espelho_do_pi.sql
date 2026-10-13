-- A medição passa a nascer do PI: valores, período e vencimento vêm do pedido de inserção,
-- sem digitar duas vezes. Medições sem PI continuam possíveis (preenchimento manual).

alter table public.medicoes
  add column pedido_id uuid references public.pedidos_insercao (id) on delete set null,
  add column vencimento date;
create index medicoes_pedido_idx on public.medicoes (pedido_id);

-- Vencimento do PI: DFM conta a partir do fim do mês da emissão; DD, da data de emissão.
create function private.vencimento_pi(_emissao date, _dias integer, _base text)
returns date language sql immutable set search_path = ''
as $$
  select case when _base = 'DFM'
    then ((date_trunc('month', _emissao) + interval '1 month - 1 day')::date + _dias)
    else (_emissao + _dias)
  end
$$;

-- Ao emitir um PI, liga os envios que já chegaram com o mesmo cliente e número.
create function private.ligar_envios_ao_pi()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'emitido' and old.status is distinct from 'emitido' then
    update public.submissions s
    set pedido_id = new.id
    from public.clientes c
    where c.id = new.cliente_id
      and s.cliente = c.nome
      and s.pedido_id is null
      and regexp_replace(s.numero_pi, '\D', '', 'g') = new.numero::text;
  end if;
  return new;
end;
$$;
create trigger pedidos_ligam_envios after update on public.pedidos_insercao
for each row execute function private.ligar_envios_ao_pi();

-- Ao aprovar os documentos de um envio ligado a um PI, a medição é criada com os valores do PI.
create function private.medicao_a_partir_do_pi()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  p public.pedidos_insercao;
  nova uuid;
begin
  if new.status <> 'aprovado' or old.status = 'aprovado' or new.pedido_id is null then
    return new;
  end if;
  if exists (select 1 from public.medicoes where submission_id = new.id) then
    return new;
  end if;
  select * into p from public.pedidos_insercao where id = new.pedido_id and status = 'emitido';
  if not found or p.valor_bruto <= 0 then
    return new;
  end if;
  insert into public.medicoes (
    submission_id, pedido_id, valor_bruto, comissao_agencia, periodo_inicio, periodo_fim, vencimento, criado_por
  ) values (
    new.id, p.id, p.valor_bruto, p.comissao,
    make_date(p.ano, p.mes, 1),
    (make_date(p.ano, p.mes, 1) + interval '1 month - 1 day')::date,
    private.vencimento_pi(p.data_emissao, p.prazo_dias, p.prazo_base),
    (select auth.uid())
  ) returning id into nova;
  insert into public.medicao_eventos (medicao_id, ator_id, tipo, para_status, detalhe)
  values (nova, (select auth.uid()), 'criada', 'em_medicao', 'Criada a partir do PI ' || p.numero);
  return new;
end;
$$;
create trigger submissions_medicao_do_pi after update of status on public.submissions
for each row execute function private.medicao_a_partir_do_pi();

revoke all on function private.ligar_envios_ao_pi(), private.medicao_a_partir_do_pi() from public, anon, authenticated;

-- Medição criada à mão também passa a guardar o PI e o vencimento, quando existirem.
create or replace function public.criar_medicao(
  p_submission uuid, p_valor_bruto numeric, p_comissao numeric default 0,
  p_inicio date default null, p_fim date default null, p_nf text default null, p_obs text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  novo uuid;
  s public.submissions;
  p public.pedidos_insercao;
begin
  if not (select private.can_operate()) then
    raise exception 'Sem permissão para criar medição' using errcode = '42501';
  end if;
  select * into s from public.submissions where id = p_submission and status = 'aprovado';
  if not found then
    raise exception 'Só é possível medir PI com documentação aprovada';
  end if;
  if s.pedido_id is not null then
    select * into p from public.pedidos_insercao where id = s.pedido_id;
  end if;
  insert into public.medicoes (
    submission_id, pedido_id, valor_bruto, comissao_agencia, periodo_inicio, periodo_fim, numero_nf, observacoes, vencimento, criado_por
  ) values (
    p_submission, p.id, p_valor_bruto, coalesce(p_comissao, 0), p_inicio, p_fim, nullif(trim(p_nf), ''), nullif(trim(p_obs), ''),
    case when p.id is not null then private.vencimento_pi(p.data_emissao, p.prazo_dias, p.prazo_base) end,
    (select auth.uid())
  ) returning id into novo;
  insert into public.medicao_eventos (medicao_id, ator_id, tipo, para_status)
  values (novo, (select auth.uid()), 'criada', 'em_medicao');
  return novo;
end;
$$;

-- Edita só valores e dados da NF enquanto a medição está em preparo (já era assim); o vencimento também.
grant update (vencimento) on public.medicoes to authenticated;
