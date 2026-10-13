-- Permite à edge function conferir o segredo do webhook guardado no Vault, sem copiá-lo para fora do banco.
create function public.verificar_webhook(p_secret text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'analise_webhook_secret' and decrypted_secret = p_secret
  )
$$;
revoke all on function public.verificar_webhook(text) from public, anon, authenticated;
grant execute on function public.verificar_webhook(text) to service_role;
