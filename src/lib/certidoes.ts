import { supabase } from "@/integrations/supabase/client";

export type Orgao = "federal" | "fgts" | "trabalhista" | "estadual" | "municipal" | "outra";

export const ORGAO_LABEL: Record<Orgao, string> = {
  federal: "Federal (Receita/PGFN)",
  fgts: "FGTS (Caixa)",
  trabalhista: "Trabalhista (TST)",
  estadual: "Estadual",
  municipal: "Municipal",
  outra: "Outra",
};

/** Consulta pública do órgão, usada quando a certidão não traz o endereço de conferência impresso. */
const PORTAL: Partial<Record<Orgao, string>> = {
  fgts: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  trabalhista: "https://cndt-certidao.tst.jus.br/inicio.faces",
};

export interface Certidao {
  id: string;
  submissionId: string;
  veiculoId: string | null;
  orgao: Orgao;
  nome: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  situacao: string | null;
  emitidaEm: string | null;
  validade: string | null;
  codigo: string | null;
  urlValidacao: string | null;
  cnpjConfere: boolean | null;
  arquivo: string | null;
  criadoEm: string;
  numeroPi: string;
  cliente: string;
  nomeVeiculo: string;
  veiculoNome: string | null;
}

export type Validade = "vencida" | "vence_logo" | "ok" | "sem_data";

export const DIAS_AVISO = 30;

export function diasParaVencer(validade: string | null, hoje = new Date()): number | null {
  if (!validade) return null;
  const fim = new Date(`${validade}T23:59:59`);
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000);
}

export function situacaoValidade(validade: string | null): Validade {
  const d = diasParaVencer(validade);
  if (d === null) return "sem_data";
  if (d < 0) return "vencida";
  return d <= DIAS_AVISO ? "vence_logo" : "ok";
}

export const SITUACAO_LABEL: Record<string, string> = {
  negativa: "Negativa",
  positiva_com_efeito_de_negativa: "Positiva com efeito de negativa",
  positiva: "Positiva",
};

/** Só aceita endereços http(s); o texto vem da leitura do documento e não é confiável. */
export function linkDeConferencia(c: Pick<Certidao, "orgao" | "urlValidacao">): string | null {
  const candidato = c.urlValidacao ?? PORTAL[c.orgao] ?? null;
  if (!candidato || !/^https?:\/\/\S+$/i.test(candidato)) return null;
  return candidato;
}

export async function listCertidoes(): Promise<Certidao[]> {
  const { data, error } = await supabase
    .from("certidoes")
    .select("*, submissions(numero_pi, cliente, nome_veiculo), veiculos(nome)")
    .order("validade", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    submissionId: r.submission_id,
    veiculoId: r.veiculo_id,
    orgao: (r.orgao ?? "outra") as Orgao,
    nome: r.nome,
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    situacao: r.situacao,
    emitidaEm: r.emitida_em,
    validade: r.validade,
    codigo: r.codigo,
    urlValidacao: r.url_validacao,
    cnpjConfere: r.cnpj_confere,
    arquivo: r.arquivo,
    criadoEm: r.created_at,
    numeroPi: r.submissions?.numero_pi ?? "",
    cliente: r.submissions?.cliente ?? "",
    nomeVeiculo: r.submissions?.nome_veiculo ?? "",
    veiculoNome: r.veiculos?.nome ?? null,
  }));
}

/** Mantém só a certidão mais recente de cada CNPJ e órgão. */
export function maisRecentes(lista: Certidao[]): Certidao[] {
  const mapa = new Map<string, Certidao>();
  const quando = (x: Certidao) => x.emitidaEm ?? x.criadoEm;
  for (const c of lista) {
    const chave = `${c.cnpj ?? c.razaoSocial ?? c.nomeVeiculo}|${c.orgao}`;
    const atual = mapa.get(chave);
    if (!atual || quando(c) > quando(atual)) mapa.set(chave, c);
  }
  return [...mapa.values()];
}
