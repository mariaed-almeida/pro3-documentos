-- Certidões lidas pela IA nos envios: validade, CNPJ e código de validação, para conferir sem abrir envio por envio.
create table public.certidoes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  orgao text not null default 'outra',
  nome text,
  cnpj text,
  razao_social text,
  situacao text,
  emitida_em date,
  validade date,
  codigo text,
  url_validacao text,
  cnpj_confere boolean,
  arquivo text,
  created_at timestamptz not null default now()
);
create index certidoes_submission_idx on public.certidoes (submission_id);
create index certidoes_veiculo_idx on public.certidoes (veiculo_id);
create index certidoes_validade_idx on public.certidoes (validade);
alter table public.certidoes enable row level security;
create policy "equipe le certidoes" on public.certidoes for select to authenticated using ((select private.is_staff()));
grant select on public.certidoes to authenticated;
