-- Estrutura de documentos por campanha e medição de faturamento por PI.

-- ---------------------------------------------------------------------------
-- Catálogo de documentos e regras por campanha
-- ---------------------------------------------------------------------------
create table public.tipos_documento (
  codigo text primary key,
  nome text not null,
  descricao text,
  modelo_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create table public.campanha_documentos (
  campanha_id uuid not null references public.campanhas (id) on delete cascade,
  doc_type text not null references public.tipos_documento (codigo) on update cascade on delete restrict,
  obrigatorio boolean not null default true,
  -- null = vale para todos os tipos de veículo
  tipos_veiculo text[],
  regime text not null default 'todos' check (regime in ('todos', 'simples', 'nao_simples')),
  ordem int not null default 0,
  primary key (campanha_id, doc_type)
);
create index campanha_documentos_doc_type_idx on public.campanha_documentos (doc_type);

insert into public.tipos_documento (codigo, nome, descricao, modelo_url, ordem) values
  ('piAssinado', 'PI Assinado', 'Pedido de Inserção devidamente assinado', null, 10),
  ('notaFiscal', 'Nota Fiscal', 'Nota Fiscal referente ao serviço prestado', null, 20),
  ('notaFiscalGrafica', 'Nota Fiscal da Gráfica', 'NF da gráfica comprovando a tiragem do jornal', null, 30),
  ('declaracaoArtigo299', 'Declaração do Artigo 299', 'Declaração conforme Art. 299 do Código Penal', '/modelos/Modelo_Declaracao_Art_299.pdf', 40),
  ('tabelaPrecoAssinada', 'Tabela de Preço Assinada', 'Tabela de preços do veículo assinada', null, 50),
  ('declaracaoSimplesNacional', 'Declaração de Optante pelo Simples Nacional', 'Documento comprovatório de dispensa de retenção do IRRF', '/modelos/Modelo_Declaracao_Simples_Nacional.pdf', 60),
  ('comprovantesExibicao', 'Comprovantes de Exibição', 'Comprovantes de veiculação da campanha (prints, declarações, comprovantes assinados)', null, 70),
  ('fotoMidiaExterna', 'Foto do Ponto de Exibição', 'Foto do outdoor/painel no local de veiculação', null, 80),
  ('certidoes', 'Certidões negativas', 'Municipal, estadual, federal, CRF do FGTS e trabalhista', null, 90);

-- Conjunto padrão aplicado a toda campanha nova; o admin ajusta depois.
create function private.aplicar_modelo_padrao(_campanha uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.campanha_documentos (campanha_id, doc_type, obrigatorio, tipos_veiculo, regime, ordem) values
    (_campanha, 'piAssinado', true, null, 'todos', 10),
    (_campanha, 'notaFiscal', true, null, 'todos', 20),
    (_campanha, 'notaFiscalGrafica', true, array['Jornal'], 'todos', 30),
    (_campanha, 'declaracaoArtigo299', true, null, 'todos', 40),
    (_campanha, 'tabelaPrecoAssinada', true, null, 'todos', 50),
    (_campanha, 'declaracaoSimplesNacional', true, null, 'nao_simples', 60),
    (_campanha, 'comprovantesExibicao', true, array['Jornal', 'Rádio', 'Televisão', 'Portal', 'Outro'], 'todos', 70),
    (_campanha, 'fotoMidiaExterna', true, array['Mídia Externa'], 'todos', 80),
    (_campanha, 'certidoes', true, null, 'todos', 90)
  on conflict do nothing
$$;

create function private.campanha_nova()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.aplicar_modelo_padrao(new.id);
  return new;
end;
$$;
create trigger campanhas_modelo_padrao after insert on public.campanhas
for each row execute function private.campanha_nova();

-- Campanhas já cadastradas recebem o padrão; a ALESC não exige PI assinado.
select private.aplicar_modelo_padrao(id) from public.campanhas;
delete from public.campanha_documentos cd
using public.campanhas c
where cd.campanha_id = c.id and c.cliente = 'ALESC' and cd.doc_type = 'piAssinado';

revoke all on function private.aplicar_modelo_padrao(uuid), private.campanha_nova() from public, anon, authenticated;

alter table public.tipos_documento enable row level security;
alter table public.campanha_documentos enable row level security;
revoke all on public.tipos_documento, public.campanha_documentos from anon, authenticated;
grant select on public.tipos_documento, public.campanha_documentos to anon;
grant select, insert, update, delete on public.tipos_documento, public.campanha_documentos to authenticated;

create policy "anon ve tipos de documento" on public.tipos_documento for select to anon using (true);
create policy "equipe ve tipos de documento" on public.tipos_documento for select to authenticated using (true);
create policy "admin gere tipos de documento" on public.tipos_documento for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

create policy "anon ve regras de campanha ativa" on public.campanha_documentos for select to anon
  using (exists (select 1 from public.campanhas c where c.id = campanha_id and c.ativa));
create policy "equipe ve regras" on public.campanha_documentos for select to authenticated using (true);
create policy "operacao gere regras" on public.campanha_documentos for all to authenticated
  using ((select private.can_operate())) with check ((select private.can_operate()));

