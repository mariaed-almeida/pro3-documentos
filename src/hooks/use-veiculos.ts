import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Socio } from "@/hooks/use-clientes";
import type { ComReceita } from "@/lib/receita";

export interface VeiculoDb extends ComReceita {
  id: string;
  nome: string;
  tipoVeiculo: string;
  cnpj: string | null;
  consultadoEm: string | null;
  praca: string | null;
  contatoNome: string | null;
  contatoFone: string | null;
  contatoEmail: string | null;
  representante: string | null;
  banco: string | null;
  agenciaBancaria: string | null;
  conta: string | null;
  tipoConta: string | null;
  pixChave: string | null;
  retemIr: boolean | null;
  observacoes: string | null;
  ativo: boolean;
}

export const VEICULOS_KEY = ["veiculos"] as const;

export async function listVeiculos(): Promise<VeiculoDb[]> {
  const { data, error } = await supabase.from("veiculos").select("*").order("nome");
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    tipoVeiculo: v.tipo_veiculo,
    cnpj: v.cnpj,
    razaoSocial: v.razao_social,
    nomeFantasia: v.nome_fantasia,
    situacaoCadastral: v.situacao_cadastral,
    dataSituacao: v.data_situacao,
    dataAbertura: v.data_abertura,
    naturezaJuridica: v.natureza_juridica,
    porte: v.porte,
    cnaePrincipal: v.cnae_principal,
    cnaesSecundarios: v.cnaes_secundarios ?? [],
    capitalSocial: v.capital_social === null ? null : Number(v.capital_social),
    optanteSimples: v.optante_simples,
    logradouro: v.logradouro,
    numero: v.numero,
    complemento: v.complemento,
    bairro: v.bairro,
    municipio: v.municipio,
    uf: v.uf,
    cep: v.cep,
    telefone: v.telefone,
    email: v.email,
    socios: Array.isArray(v.socios) ? (v.socios as unknown as Socio[]) : [],
    consultadoEm: v.consultado_em,
    praca: v.praca,
    contatoNome: v.contato_nome,
    contatoFone: v.contato_fone,
    contatoEmail: v.contato_email,
    representante: v.representante,
    banco: v.banco,
    agenciaBancaria: v.agencia_bancaria,
    conta: v.conta,
    tipoConta: v.tipo_conta,
    pixChave: v.pix_chave,
    retemIr: v.retem_ir,
    observacoes: v.observacoes,
    ativo: v.ativo,
  }));
}

export function useVeiculos() {
  return useQuery({ queryKey: VEICULOS_KEY, queryFn: listVeiculos, staleTime: 60_000 });
}
