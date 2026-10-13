-- Enquanto o domínio de envio não está verificado, os e-mails podem ser redirecionados a um endereço de teste.
-- Ativar: segredo "email_redirecionar" no Vault. Desativar: apagar o segredo.
create or replace function public.obter_segredo(p_nome text)
returns text language sql stable security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_nome and p_nome in ('anthropic_api_key', 'resend_api_key', 'email_from', 'email_redirecionar')
$$;
