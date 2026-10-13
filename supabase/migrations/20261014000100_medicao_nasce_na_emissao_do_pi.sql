-- A medição nasce quando o PI é emitido (estágio "aguardando_documentos") e acompanha o PI:
-- documentos aprovados a movem para "em_medicao"; mudanças no PI sincronizam os valores;
-- PI cancelado cancela a medição. Uma medição por PI.

alter table public.medicoes alter column submission_id drop not null;
create unique index medicoes_pedido_unico_idx on public.medicoes (pedido_id) where pedido_id is not null;

create function private.medicao_do_pi_emitido()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  m public.medicoes;
  sid uuid;
  sstatus text;
  nova uuid;
  ini date;
  fim date;
  venc date;
  r record;
begin
  if new.status = 'cancelado' then
    if tg_op = 'UPDATE' and old.status is distinct from 'cancelado' then
      for r in select id, status from public.medicoes where pedido_id = new.id and status not in ('pago', 'cancelado') loop
        update public.medicoes set status = 'cancelado' where id = r.id;
        insert into public.medicao_eventos (medicao_id, ator_id, tipo, de_status, para_status, detalhe)
        values (r.id, (select auth.uid()), 'status', r.status, 'cancelado', 'PI ' || new.numero || ' cancelado');
      end loop;
    end if;
    return new;
  end if;

  if new.status <> 'emitido' then
    return new;
  end if;

  ini := make_date(new.ano, new.mes, 1);
  fim := (ini + interval '1 month - 1 day')::date;
  venc := private.vencimento_pi(new.data_emissao, new.prazo_dias, new.prazo_base);

  select id, status into sid, sstatus from public.submissions where pedido_id = new.id order by created_at desc limit 1;

  select * into m from public.medicoes where pedido_id = new.id;
  if not found and sid is not null then
    -- medição criada à mão para o mesmo envio: passa a pertencer ao PI
    select * into m from public.medicoes where submission_id = sid and pedido_id is null;
    if found then
      update public.medicoes set pedido_id = new.id where id = m.id;
    end if;
  end if;

  if m.id is null then
    insert into public.medicoes (submission_id, pedido_id, valor_bruto, comissao_agencia, periodo_inicio, periodo_fim, vencimento, status, criado_por)
    values (
      sid, new.id, new.valor_bruto, new.comissao, ini, fim, venc,
      (case when sstatus = 'aprovado' then 'em_medicao' else 'aguardando_documentos' end)::public.status_medicao,
      (select auth.uid())
    ) returning id into nova;
    insert into public.medicao_eventos (medicao_id, ator_id, tipo, para_status, detalhe)
    values (nova, (select auth.uid()), 'criada',
            (case when sstatus = 'aprovado' then 'em_medicao' else 'aguardando_documentos' end)::public.status_medicao,
            'Criada na emissão do PI ' || new.numero);
  elsif m.status in ('aguardando_documentos', 'em_medicao') then
    update public.medicoes
    set valor_bruto = new.valor_bruto, comissao_agencia = new.comissao,
        periodo_inicio = ini, periodo_fim = fim, vencimento = venc
    where id = m.id;
  end if;
  return new;
end;
$$;
revoke all on function private.medicao_do_pi_emitido() from public, anon, authenticated;

create trigger pedidos_medicao_do_pi after insert or update on public.pedidos_insercao
for each row execute function private.medicao_do_pi_emitido();

-- Envio que chega para um PI com medição já aberta fica ligado a ela.
create function private.ligar_envio_a_medicao()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.pedido_id is not null then
    update public.medicoes set submission_id = new.id
    where pedido_id = new.pedido_id and submission_id is null;
  end if;
  return new;
end;
$$;
revoke all on function private.ligar_envio_a_medicao() from public, anon, authenticated;
create trigger submissions_liga_medicao after insert on public.submissions
for each row execute function private.ligar_envio_a_medicao();

-- Documentos aprovados movem a medição do PI para "em medição".
create or replace function private.medicao_a_partir_do_pi()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  if new.status <> 'aprovado' or old.status = 'aprovado' or new.pedido_id is null then
    return new;
  end if;
  for r in select id from public.medicoes where pedido_id = new.pedido_id and status = 'aguardando_documentos' loop
    update public.medicoes set status = 'em_medicao', submission_id = coalesce(submission_id, new.id) where id = r.id;
    insert into public.medicao_eventos (medicao_id, ator_id, tipo, de_status, para_status, detalhe)
    values (r.id, (select auth.uid()), 'status', 'aguardando_documentos', 'em_medicao', 'Documentos aprovados');
  end loop;
  return new;
end;
$$;

-- Nova transição: documentos conferidos por fora do sistema.
create or replace function public.mudar_status_medicao(
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

  if m.status = 'aguardando_documentos' and p_para = 'em_medicao' then
    if not (select private.can_operate()) then raise exception 'Sem permissão' using errcode = '42501'; end if;
    update public.medicoes set status = p_para where id = p_id;
    ok := true;
  elsif m.status = 'em_medicao' and p_para = 'aguardando_liberacao' then
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

-- PIs já emitidos ganham a medição.
insert into public.medicoes (submission_id, pedido_id, valor_bruto, comissao_agencia, periodo_inicio, periodo_fim, vencimento, status)
select
  (select s.id from public.submissions s where s.pedido_id = p.id order by s.created_at desc limit 1),
  p.id, p.valor_bruto, p.comissao,
  make_date(p.ano, p.mes, 1),
  (make_date(p.ano, p.mes, 1) + interval '1 month - 1 day')::date,
  private.vencimento_pi(p.data_emissao, p.prazo_dias, p.prazo_base),
  (case when exists (select 1 from public.submissions s where s.pedido_id = p.id and s.status = 'aprovado')
        then 'em_medicao' else 'aguardando_documentos' end)::public.status_medicao
from public.pedidos_insercao p
where p.status = 'emitido'
  and not exists (select 1 from public.medicoes m where m.pedido_id = p.id)
on conflict do nothing;
