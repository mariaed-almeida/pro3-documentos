import { addDays, endOfMonth, format } from "date-fns";

/** Dados da agência impressos no cabeçalho e no rodapé do PI. */
export interface Agencia {
  razaoSocial: string;
  endereco: string;
  cidadeUf: string;
  cep: string;
  fone: string;
  whatsapp: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  emailFinanceiro: string;
  emailMidia: string;
  enderecoCorrespondencia: string;
  assinaturaNome: string;
  assinaturaCargo: string;
  /** Itens fixos de "Demais orientações", sem numeração (a numeração é gerada). */
  orientacoesGerais: string[];
}

export type BasePrazo = "DFM" | "DD";

export interface PiItem {
  ordem: number;
  /** Texto da coluna "Colocação" (normalmente o nome do cliente). */
  colocacao: string;
  /** Letra da coluna P: J jornal, R rádio, T televisão, P portal, E mídia externa, O outro. */
  tipoPeca: string;
  peca: string;
  formato: string;
  material: string;
  /** Dia do mês -> quantidade de inserções naquele dia. */
  insercoes: Record<string, number>;
  custoUnitario: number;
  /** Multiplicador do custo unitário (colunas x cm no jornal, segundos em rádio/TV, 1 nos demais). */
  fator: number;
  descontoPct: number;
}

export interface PiDocumento {
  numero: number;
  status: "rascunho" | "emitido" | "cancelado";
  agencia: Agencia;
  cliente: {
    nome: string;
    razaoSocial: string;
    cnpj: string;
    endereco: string;
    cepMunicipioUf: string;
    pracaPagamento: string;
    /** Texto completo das orientações do cliente; vazio = usar o padrão gerado. */
    orientacoes: string | null;
    contratos: string[];
    textoObrigatorioNf: string | null;
  };
  veiculo: {
    nome: string;
    praca: string;
    razaoSocial: string;
    endereco: string;
    cnpj: string;
    contato: string;
    fone: string;
    representante: string;
    email: string;
  };
  /** Mês de veiculação (1-12) e ano. */
  mes: number;
  ano: number;
  dataEmissao: string; // YYYY-MM-DD
  projeto: string;
  plano: string;
  planilha: string;
  produto: string;
  campanha: string;
  itens: PiItem[];
  comissaoPct: number;
  prazoDias: number;
  prazoBase: BasePrazo;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const totalInsercoes = (item: Pick<PiItem, "insercoes">) =>
  Object.values(item.insercoes).reduce((a, n) => a + (Number(n) || 0), 0);

/** custo unitário x fator x inserções x (1 - desconto). */
export const totalItem = (item: PiItem) =>
  r2(item.custoUnitario * (item.fator || 1) * totalInsercoes(item) * (1 - (item.descontoPct || 0) / 100));

export function totaisPi(itens: PiItem[], comissaoPct: number) {
  const bruto = r2(itens.reduce((a, i) => a + totalItem(i), 0));
  const comissao = r2(bruto * (comissaoPct / 100));
  return { bruto, comissao, liquido: r2(bruto - comissao), insercoes: itens.reduce((a, i) => a + totalInsercoes(i), 0) };
}

/** DFM = dias fora do mês (conta a partir do fim do mês da emissão); DD = dias corridos da emissão. */
export function vencimentoPi(dataEmissao: string, dias: number, base: BasePrazo): Date {
  const [y, m, d] = dataEmissao.split("-").map(Number);
  const emissao = new Date(y, m - 1, d);
  return addDays(base === "DFM" ? endOfMonth(emissao) : emissao, dias);
}

export const prazoLabel = (dias: number, base: BasePrazo) => `${dias}${base}`;
export const formatVencimento = (dataEmissao: string, dias: number, base: BasePrazo) =>
  format(vencimentoPi(dataEmissao, dias, base), "dd/MM/yyyy");

export const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
export const periodoLabel = (mes: number, ano: number) => `${MESES[mes - 1]}/${ano}`;

export const TIPOS_PECA: { letra: string; nome: string; tipoVeiculo: string }[] = [
  { letra: "J", nome: "Jornal", tipoVeiculo: "Jornal" },
  { letra: "R", nome: "Rádio", tipoVeiculo: "Rádio" },
  { letra: "T", nome: "Televisão", tipoVeiculo: "Televisão" },
  { letra: "P", nome: "Portal", tipoVeiculo: "Portal" },
  { letra: "E", nome: "Mídia externa", tipoVeiculo: "Mídia Externa" },
  { letra: "O", nome: "Outro", tipoVeiculo: "Outro" },
];

/** "3colx17cm" -> 51 (colunas x centímetros); devolve null se não reconhecer. */
export function fatorDoFormato(formato: string): number | null {
  const m = formato.toLowerCase().replace(/\s+/g, "").match(/^(\d+(?:[.,]\d+)?)col?x(\d+(?:[.,]\d+)?)cm$/);
  if (!m) return null;
  return r2(Number(m[1].replace(",", ".")) * Number(m[2].replace(",", ".")));
}

/**
 * Orientações impressas na 2ª página: bloco do cliente (contratos, regras de nota) seguido das
 * orientações gerais da agência. A numeração é sequencial.
 */
export function orientacoesPadrao(doc: Pick<PiDocumento, "cliente" | "agencia" | "campanha">): string {
  const linhas: string[] = [];
  const blocos: string[] = [];
  const n = () => blocos.length + 1;
  const add = (t: string) => blocos.push(`${n()} - ${t}`);

  linhas.push("ATENÇÃO:");
  linhas.push("A partir de 01 de novembro de 2025, veículos de comunicação obrigatoriamente devem emitir a nota em modelo 62 seguindo o Ajuste SINIEF nº 7, de 7 de abril de 2022.");
  linhas.push("");
  linhas.push("A NOTA FISCAL DEVERÁ SER FATURADA SOMENTE APÓS O TÉRMINO DA VEICULAÇÃO");
  linhas.push("Dados obrigatórios no corpo da nota fiscal");

  add("Número do Pedido de Inserção (PI)");
  for (const c of doc.cliente.contratos) add(c.toUpperCase().replace("Nº", "No"));
  add("Nome da Campanha");
  add("Período de Veiculação (datas específicas)");
  add("Formato do anúncio e tamanho do anúncio\nRádio e TV: tempo do material\nSites: Posição no site, dimensão como citado na tabela de preços");
  add("Dados Bancários");
  if (doc.cliente.textoObrigatorioNf) add(`A nota deve conter o texto: "${doc.cliente.textoObrigatorioNf}"`);
  add('VALORES BRUTO E DA COMISSÃO DE AGÊNCIA (DEVEM CONSTAR SOMENTE NA DESCRIÇÃO DA NOTA FISCAL).\nNO CAMPO "VALOR" DA NOTA FISCAL, DEVE CONSTAR SOMENTE O VALOR LÍQUIDO.');
  linhas.push(...blocos);
  linhas.push("");
  linhas.push("DEMAIS ORIENTAÇÕES:");
  let k = blocos.length + 1;
  for (const item of doc.agencia.orientacoesGerais) {
    linhas.push(`${k} - ${item.split("{endereco}").join(doc.agencia.enderecoCorrespondencia)}`);
    k += 1;
  }
  return linhas.join("\n");
}

export const orientacoesDoPi = (doc: PiDocumento) => doc.cliente.orientacoes?.trim() || orientacoesPadrao(doc);
