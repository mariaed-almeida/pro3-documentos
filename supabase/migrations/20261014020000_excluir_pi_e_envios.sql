-- Exclusão de PI e de envios recebidos (só administrador), para limpar o sistema.
-- As funções devolvem os caminhos dos arquivos no Storage; a tela remove os arquivos pela API.

-- Administrador pode apagar arquivos do bucket (a API de Storage exige a política).
create policy "admin remove arquivos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (select private.has_role('admin')));

-- Exclui um envio: arquivos, histórico e e-mails vão junto. A medição do PI continua e volta a aguardar documentos;
-- medição lançada à mão para o envio é apagada. Medição paga ou liberada exige estorno antes.
create function public.excluir_envio(p_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  caminhos text[];
  m public.medicoes;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Só o administrador pode excluir envios' using errcode = '42501';
  end if;
  if not exists (select 1 from public.submissions where id = p_id) then
    raise exception 'Envio não encontrado';
  end if;

  for m in select * from public.medicoes where submission_id = p_id loop
    if m.status in ('liberado', 'pago') then
      raise exception 'A medição deste envio está %. Estorne o pagamento antes de excluir.', m.status;
    end if;
    if m.pedido_id is null then
      delete from public.medicoes where id = m.id;
    else
      update public.medicoes
         set submission_id = null,
             status = case when status in ('em_medicao', 'aguardando_liberacao') then 'aguardando_documentos' else status end
       where id = m.id;
      insert into public.medicao_eventos (medicao_id, ator_id, tipo, de_status, para_status, detalhe)
      values (m.id, (select auth.uid()), 'status', m.status,
              case when m.status in ('em_medicao', 'aguardando_liberacao') then 'aguardando_documentos'::public.status_medicao else m.status end,
              'Envio excluído');
    end if;
  end loop;

  select coalesce(array_agg(storage_path), '{}') into caminhos from public.documents where submission_id = p_id;
  delete from public.submissions where id = p_id;
  return caminhos;
end;
$$;

-- Exclui um PI emitido ou em rascunho, com a medição dele. Envios ligados ao PI ficam (sem vínculo),
-- ou são excluídos também quando p_com_envios for verdadeiro. Medição paga exige estorno antes.
create function public.excluir_pedido(p_id uuid, p_com_envios boolean default false)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  caminhos text[] := '{}';
  e uuid;
begin
  if not (select private.has_role('admin')) then
    raise exception 'Só o administrador pode excluir PIs' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pedidos_insercao where id = p_id) then
    raise exception 'PI não encontrado';
  end if;
  if exists (select 1 from public.medicoes where pedido_id = p_id and status = 'pago') then
    raise exception 'A medição deste PI está paga. Estorne o pagamento antes de excluir.';
  end if;

  if p_com_envios then
    for e in select id from public.submissions where pedido_id = p_id loop
      caminhos := caminhos || (
        select coalesce(array_agg(storage_path), '{}') from public.documents where submission_id = e
      );
      delete from public.medicoes where submission_id = e;
      delete from public.submissions where id = e;
    end loop;
  end if;

  delete from public.medicoes where pedido_id = p_id;
  delete from public.pedidos_insercao where id = p_id;
  return caminhos;
end;
$$;

revoke all on function public.excluir_envio(uuid), public.excluir_pedido(uuid, boolean) from public, anon;
grant execute on function public.excluir_envio(uuid), public.excluir_pedido(uuid, boolean) to authenticated;
