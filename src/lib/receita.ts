import type { Json } from "@/integrations/supabase/types";
import type { DadosCnpj } from "@/lib/cnpj";
import { limparLogradouro } from "@/lib/cnpj";
import type { ViewReceita } from "@/components/app/DadosReceita";
import type { Socio } from "@/hooks/use-clientes";

/** Colunas de dados cadastrais da Receita, iguais em `clientes` e `veiculos`. */
export function receitaPayload(c: DadosCnpj) {
  return {
    razao_social: c.razaoSocial,
    nome_fantasia: c.nomeFantasia,
    situacao_cadastral: c.situacao,
    data_situacao: c.dataSituacao,
    data_abertura: c.dataAbertura,
    natureza_juridica: c.naturezaJuridica,
    porte: c.porte,
    cnae_principal: c.cnaePrincipal,
    cnaes_secundarios: c.cnaesSecundarios,
    capital_social: c.capitalSocial,
    optante_simples: c.optanteSimples,
    logradouro: limparLogradouro(c.endereco.logradouro),
    numero: c.endereco.numero,
    complemento: c.endereco.complemento,
    bairro: c.endereco.bairro,
    municipio: c.endereco.municipio,
    uf: c.endereco.uf,
    cep: c.endereco.cep,
    socios: c.socios as unknown as Json,
    consultado_em: new Date().toISOString(),
  };
}

export function viewDaConsulta(d: DadosCnpj): ViewReceita {
  return {
    razaoSocial: d.razaoSocial,
    nomeFantasia: d.nomeFantasia,
    situacao: d.situacao,
    dataSituacao: d.dataSituacao,
    dataAbertura: d.dataAbertura,
    naturezaJuridica: d.naturezaJuridica,
    porte: d.porte,
    cnaePrincipal: d.cnaePrincipal,
    cnaesSecundarios: d.cnaesSecundarios,
    capitalSocial: d.capitalSocial,
    optanteSimples: d.optanteSimples,
    endereco: d.endereco,
    telefone: d.telefone,
    email: d.email,
    socios: d.socios,
  };
}

/** Qualquer registro com as colunas de Receita (cliente ou veículo) vira a visão de exibição. */
export interface ComReceita {
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
}

export function viewDoRegistro(c: ComReceita): ViewReceita | null {
  if (!c.razaoSocial) return null;
  return {
    razaoSocial: c.razaoSocial,
    nomeFantasia: c.nomeFantasia,
    situacao: c.situacaoCadastral,
    dataSituacao: c.dataSituacao,
    dataAbertura: c.dataAbertura,
    naturezaJuridica: c.naturezaJuridica,
    porte: c.porte,
    cnaePrincipal: c.cnaePrincipal,
    cnaesSecundarios: c.cnaesSecundarios,
    capitalSocial: c.capitalSocial,
    optanteSimples: c.optanteSimples,
    endereco: { logradouro: c.logradouro, numero: c.numero, complemento: c.complemento, bairro: c.bairro, municipio: c.municipio, uf: c.uf, cep: c.cep },
    telefone: c.telefone,
    email: c.email,
    socios: c.socios,
  };
}
