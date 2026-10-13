-- Dados cadastrais vindos da Receita Federal, preenchidos pela consulta de CNPJ.
alter table public.clientes
  add column razao_social text,
  add column nome_fantasia text,
  add column situacao_cadastral text,
  add column data_situacao date,
  add column data_abertura date,
  add column natureza_juridica text,
  add column porte text,
  add column cnae_principal text,
  add column cnaes_secundarios text[] not null default '{}',
  add column capital_social numeric(16, 2),
  add column optante_simples boolean,
  add column logradouro text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column municipio text,
  add column uf text,
  add column cep text,
  add column telefone text,
  add column email text,
  add column socios jsonb not null default '[]'::jsonb,
  add column consultado_em timestamptz;

-- Um CNPJ não pode ser cadastrado duas vezes, qualquer que seja a formatação.
create unique index clientes_cnpj_digitos_idx
  on public.clientes ((regexp_replace(cnpj, '\D', '', 'g')))
  where cnpj is not null and cnpj <> '';
