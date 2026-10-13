import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Socio {
  nome: string;
  qualificacao: string | null;
}

export interface ClienteDb {
  id: string;
  nome: string;
  cnpj: string | null;
  contratoInfo: string[];
  observacoesNf: string[];
  enderecoPostal: string | null;
  textoObrigatorioNf: string | null;
  ativo: boolean;
  // Receita Federal
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  dataSituacao: string | null;
  dataAbertura: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
  cnaePrincipal: string | null;
  cnaesSecundarios: string[];
  capitalSocial: number | null;
  optanteSimples: boolean | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  socios: Socio[];
  consultadoEm: string | null;
}

export const CLIENTES_KEY = ["clientes"] as const;

export async function listClientes(): Promise<ClienteDb[]> {
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj,
    contratoInfo: c.contrato_info,
    observacoesNf: c.observacoes_nf,
    enderecoPostal: c.endereco_postal,
    textoObrigatorioNf: c.texto_obrigatorio_nf,
    ativo: c.ativo,
    razaoSocial: c.razao_social,
    nomeFantasia: c.nome_fantasia,
    situacaoCadastral: c.situacao_cadastral,
    dataSituacao: c.data_situacao,
    dataAbertura: c.data_abertura,
    naturezaJuridica: c.natureza_juridica,
    porte: c.porte,
    cnaePrincipal: c.cnae_principal,
    cnaesSecundarios: c.cnaes_secundarios ?? [],
    capitalSocial: c.capital_social === null ? null : Number(c.capital_social),
    optanteSimples: c.optante_simples,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento,
    bairro: c.bairro,
    municipio: c.municipio,
    uf: c.uf,
    cep: c.cep,
    telefone: c.telefone,
    email: c.email,
    socios: Array.isArray(c.socios) ? (c.socios as unknown as Socio[]) : [],
    consultadoEm: c.consultado_em,
  }));
}

export function useClientes() {
  return useQuery({ queryKey: CLIENTES_KEY, queryFn: listClientes, staleTime: 60_000 });
}
