-- anon não pode executar private.is_staff(); separa as políticas por papel.
drop policy "clientes ativos sao publicos" on public.clientes;
drop policy "campanhas ativas sao publicas" on public.campanhas;

create policy "anon ve clientes ativos" on public.clientes for select to anon using (ativo);
create policy "equipe ve clientes" on public.clientes for select to authenticated
  using (ativo or (select private.is_staff()));

create policy "anon ve campanhas ativas" on public.campanhas for select to anon using (ativa);
create policy "equipe ve campanhas" on public.campanhas for select to authenticated
  using (ativa or (select private.is_staff()));
