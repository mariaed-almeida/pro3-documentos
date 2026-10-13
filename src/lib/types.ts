export type Cliente = "ALESC" | "Prefeitura de Xanxerê" | "Prefeitura de Chapecó";

export type TipoVeiculo = "Jornal" | "Rádio" | "Televisão" | "Portal" | "Mídia Externa" | "Outro";

// 4 status que refletem o fluxo real de trabalho da Pro3:
// recebido    → PI chegou, aguardando análise do operador
// em_revisao  → operador identificou pendência, veículo precisa corrigir e reenviar
// aprovado    → documentação correta, pronta para o setor financeiro
// cancelado   → PI cancelado por qualquer motivo (casos extremos)
export type StatusDocumento = "recebido" | "em_revisao" | "aprovado" | "cancelado";

export interface AchadoAnaliseIa {
  checagem: string;
  resultado: "atencao" | "ok" | "nao_verificavel";
  detalhe: string;
}

export interface AnaliseIa {
  geradoEm: string;
  achados: AchadoAnaliseIa[];
}

export interface Submission {
  id: string;
  cliente: Cliente;
  campanha: string;
  numeroPi: string;
  tipoVeiculo: TipoVeiculo;
  outroTipo?: string;
  nomeVeiculo: string;
  cidade: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  documentos: {
    piAssinado?: string;
    notaFiscal?: string;
    notaFiscalGrafica?: string;
    fotoMidiaExterna?: string;
    declaracaoSimplesNacional?: string;
    comprovantesExibicao?: string;
    declaracaoArtigo299?: string;
    certidoesNegativas?: string[];
    tabelaPrecoAssinada?: string;
  };
  status: StatusDocumento;
  dataEnvio: string;
  observacoes?: string;
  analiseIa?: AnaliseIa;
  /** PI emitido pelo sistema com o mesmo cliente e número. */
  pedidoId?: string;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  piAssinado: "PI Assinado",
  notaFiscal: "Nota Fiscal",
  notaFiscalGrafica: "Nota Fiscal Grafica",
  fotoMidiaExterna: "Foto Midia Externa",
  declaracaoSimplesNacional: "Declaracao Simples Nacional",
  comprovantesExibicao: "Comprovantes de Exibicao",
  declaracaoArtigo299: "Declaracao Artigo 299",
  tabelaPrecoAssinada: "Tabela de Preco",
  certidao1: "CND Debitos Municipais",
  certidao2: "CND Debitos Estaduais",
  certidao3: "CND Tributos Federais",
  certidao4: "CRF FGTS",
  certidao5: "CND Debitos Trabalhistas",
  certidoesAgrupadas: "Certidoes Negativas",
};

export function formatFileName(
  numeroPi: string,
  nomeVeiculo: string,
  cidade: string,
  docType: string,
  extension: string
): string {
  const label = DOC_TYPE_LABELS[docType] || docType;
  const sanitize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").trim();
  return `PI ${sanitize(numeroPi)} - ${sanitize(nomeVeiculo)} - ${sanitize(cidade)} - ${sanitize(label)}${extension}`;
}
