-- Cadastro de veículos de mídia, dados da agência e Pedidos de Inserção (PI).

alter table public.clientes add column orientacoes_pi text;

-- ---------------------------------------------------------------------------
-- Veículos de mídia: dados da Receita + dados comerciais e bancários para o faturamento
-- ---------------------------------------------------------------------------
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_veiculo text not null default 'Outro',
  cnpj text,
  -- Receita Federal
  razao_social text,
  nome_fantasia text,
  situacao_cadastral text,
  data_situacao date,
  data_abertura date,
  natureza_juridica text,
  porte text,
  cnae_principal text,
  cnaes_secundarios text[] not null default '{}',
  capital_social numeric(16, 2),
  optante_simples boolean,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio text,
  uf text,
  cep text,
  telefone text,
  email text,
  socios jsonb not null default '[]'::jsonb,
  consultado_em timestamptz,
  -- Comercial
  praca text,
  contato_nome text,
  contato_fone text,
  contato_email text,
  representante text,
  -- Pagamento
  banco text,
  agencia_bancaria text,
  conta text,
  tipo_conta text,
  pix_chave text,
  retem_ir boolean,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index veiculos_cnpj_digitos_idx
  on public.veiculos ((regexp_replace(cnpj, '\D', '', 'g')))
  where cnpj is not null and cnpj <> '';
create index veiculos_nome_idx on public.veiculos (lower(nome));

create trigger veiculos_touch before update on public.veiculos
for each row execute function private.touch_medicao();

-- ---------------------------------------------------------------------------
-- Agência: dados que saem no cabeçalho e no rodapé do PI (linha única)
-- ---------------------------------------------------------------------------
create table public.agencia (
  id boolean primary key default true check (id),
  razao_social text not null,
  endereco text not null,
  cidade_uf text not null,
  cep text not null,
  fone text,
  whatsapp text,
  cnpj text not null,
  inscricao_estadual text,
  inscricao_municipal text,
  email_financeiro text,
  email_midia text,
  endereco_correspondencia text,
  assinatura_nome text,
  assinatura_cargo text,
  orientacoes_gerais text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger agencia_touch before update on public.agencia
for each row execute function private.touch_medicao();

insert into public.agencia (
  razao_social, endereco, cidade_uf, cep, fone, whatsapp, cnpj, inscricao_estadual, inscricao_municipal,
  email_financeiro, email_midia, endereco_correspondencia, assinatura_nome, assinatura_cargo, orientacoes_gerais
) values (
  'PRO3 COMUNICAÇÃO LTDA.', 'OURO PRETO, 315 -', 'XANXERÊ - SC', '89820-000',
  '(49) 3431-0048', '(49) 3433-0312', '07.062.089/0001-60', 'ISENTA', '51012',
  'financeiro@agenciapro3.com.br', 'midia@agenciapro3.com.br',
  'Pró3 Comunicação Ltda Avenida Prefeito Osmar Cunha, 416 Sala 905 Edifício Koerich Rio Branco - Centro - Florianópolis - CEP 88.015-100',
  'Ivânia Marcia Dazzi', 'Mídia',
  array[
    $$Emitir a nota em modelo 62, seguindo o Ajuste SINIEF nº 7, de 7 de abril de 2022.$$,
    $$Portais/Sites obrigatoriamente a nota deve ser emitida como nota fiscal de serviço eletrônica CNAE 7319099-03 referente ao subitem 17.25 da LC 116/2003.$$,
    $$Jornais para notas fiscais eletrônicas deve ser utilizado o CNAE 7311400 referente ao subitem 17.06 da LC 116/2003.$$,
    $$Para Nota Fiscal não eletrônica/digital, scannear a nota fiscal e nos enviar no email junto com o restante dos comprovantes. As notas fiscais não eletrônica/digital enviar as originais para o endereço abaixo:
{endereco} para conferência e arquivamento.$$,
    $$Empresas que sofrem retenção devem destacar o IR na nota fiscal (alíquota 4.8%). Empresas, fundações, associações e instituições que são isentas de IR devem descrever na nota fiscal o artigo da isenção ou de imunidade e apresentar declaração assinada e carimbada. (Anexos II, III e IV Instrução Normativa RFB nº 1234/2012). Se a empresa for optante do simples enviar a declaração do Simples Nacional assinada e carimbada.$$,
    $$Enviar no e-mail:
CND Federal, Estadual, Municipal, FGTS e Trabalhista (arquivo único em pdf);
Prazo de validade das CNDs, no mínimo de 15 dias após o envio do faturamento para a agência;$$,
    $$Comprovantes de Veiculação
Portais/Sites: Declaração do art. 299 e print com data do primeiro, meio e último dia de veiculação com assinatura de todos os formatos e peças veiculadas;
Rádios e TVs:
Declaração do art. 299 e o comprovante precisa ser assinado, com a identificação do responsável. Caso tenha mais alguma informação (carta de bonificação, justificativa de remanejamento de programação, etc) com assinatura.
Jornal:
Declaração do art. 299, comprovante em pdf e dois exemplares originais de cada publicação devem ser enviados para {endereco} para conferência e arquivamento.
Anexar ao processo a nota fiscal da gráfica que comprove a quantidade de jornais impressos na data da publicação.$$,
    $$Tabela de preços com validade, CNPJ, razão social e assinatura do responsável legal.$$
  ]
);

-- ---------------------------------------------------------------------------
-- Pedidos de Inserção
-- ---------------------------------------------------------------------------
create table public.pedidos_insercao (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  status text not null default 'rascunho' check (status in ('rascunho', 'emitido', 'cancelado')),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  veiculo_id uuid not null references public.veiculos (id) on delete restrict,
  campanha text not null,
  mes smallint not null check (mes between 1 and 12),
  ano smallint not null check (ano between 2020 and 2100),
  data_emissao date not null default current_date,
  projeto text,
  plano text,
  planilha text,
  produto text,
  comissao_pct numeric(5, 2) not null default 20 check (comissao_pct between 0 and 100),
  prazo_dias integer not null default 30 check (prazo_dias between 0 and 365),
  prazo_base text not null default 'DFM' check (prazo_base in ('DFM', 'DD')),
  observacoes text,
  valor_bruto numeric(14, 2) not null default 0,
  comissao numeric(14, 2) not null default 0,
  valor_liquido numeric(14, 2) not null default 0,
  emitido_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pedidos_insercao_cliente_idx on public.pedidos_insercao (cliente_id);
create index pedidos_insercao_veiculo_idx on public.pedidos_insercao (veiculo_id);
create index pedidos_insercao_criado_por_idx on public.pedidos_insercao (criado_por);
create index pedidos_insercao_periodo_idx on public.pedidos_insercao (ano desc, mes desc);
create trigger pedidos_insercao_touch before update on public.pedidos_insercao
for each row execute function private.touch_medicao();

create table public.pi_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_insercao (id) on delete cascade,
  ordem integer not null default 0,
  colocacao text not null default '',
  tipo_peca text not null default 'O',
  peca text not null default '',
  formato text not null default '',
  material text not null default '',
  insercoes jsonb not null default '{}'::jsonb,
  custo_unitario numeric(14, 2) not null default 0,
  fator numeric(10, 2) not null default 1,
  desconto_pct numeric(5, 2) not null default 0 check (desconto_pct between 0 and 100)
);
create index pi_itens_pedido_idx on public.pi_itens (pedido_id, ordem);

-- Liga o envio do veículo ao PI emitido com o mesmo cliente e número.
alter table public.submissions add column pedido_id uuid references public.pedidos_insercao (id) on delete set null;
create index submissions_pedido_idx on public.submissions (pedido_id);

create function private.link_pedido()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select p.id into new.pedido_id
  from public.pedidos_insercao p
  join public.clientes c on c.id = p.cliente_id
  where c.nome = new.cliente
    and p.numero::text = regexp_replace(new.numero_pi, '\D', '', 'g')
    and p.status = 'emitido'
  order by p.created_at desc
  limit 1;
  return new;
end;
$$;
create trigger submissions_link_pedido before insert on public.submissions
for each row execute function private.link_pedido();
revoke all on function private.link_pedido() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.veiculos enable row level security;
alter table public.agencia enable row level security;
alter table public.pedidos_insercao enable row level security;
alter table public.pi_itens enable row level security;

revoke all on public.veiculos, public.agencia, public.pedidos_insercao, public.pi_itens from anon, authenticated;
grant select, insert, update, delete on public.veiculos, public.pedidos_insercao, public.pi_itens to authenticated;
grant select, update on public.agencia to authenticated;

create policy "equipe ve veiculos" on public.veiculos for select to authenticated using ((select private.is_staff()));
create policy "operacao cadastra veiculos" on public.veiculos for insert to authenticated with check ((select private.can_operate()));
create policy "operacao altera veiculos" on public.veiculos for update to authenticated
  using ((select private.can_operate())) with check ((select private.can_operate()));
create policy "admin remove veiculos" on public.veiculos for delete to authenticated using ((select private.has_role('admin')));

create policy "equipe ve agencia" on public.agencia for select to authenticated using ((select private.is_staff()));
create policy "admin altera agencia" on public.agencia for update to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

create policy "equipe ve pedidos" on public.pedidos_insercao for select to authenticated using ((select private.is_staff()));
create policy "operacao cria pedidos" on public.pedidos_insercao for insert to authenticated with check ((select private.can_operate()));
create policy "operacao altera pedidos" on public.pedidos_insercao for update to authenticated
  using ((select private.can_operate())) with check ((select private.can_operate()));
create policy "operacao remove pedidos em rascunho" on public.pedidos_insercao for delete to authenticated
  using (status = 'rascunho' and (select private.can_operate()));

create policy "equipe ve itens do pi" on public.pi_itens for select to authenticated using ((select private.is_staff()));
create policy "operacao gere itens do pi" on public.pi_itens for all to authenticated
  using ((select private.can_operate())) with check ((select private.can_operate()));
