-- Lê segredos do Vault para as edge functions (só com a chave de serviço e só nomes liberados).
create function public.obter_segredo(p_nome text)
returns text language sql stable security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_nome and p_nome in ('anthropic_api_key')
$$;
revoke all on function public.obter_segredo(text) from public, anon, authenticated;
grant execute on function public.obter_segredo(text) to service_role;
