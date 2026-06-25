export type Cliente = "ALESC" | "Prefeitura de Xanxerê" | "Prefeitura de Chapecó";

export type TipoVeiculo = "Jornal" | "Rádio" | "Televisão" | "Portal" | "Mídia Externa" | "Outro";

export type StatusDocumento = "pendente" | "em_analise" | "corrigido" | "rejeitado" | "aprovado" | "faturado";

export interface DocumentoUpload {
  nome: string;
  arquivo: File | null;
  nomeArquivo?: string;
}

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
}

// Campaigns are now managed in the database via the "campanhas" table.
// Use getActiveCampaigns() from "@/lib/campaigns" to fetch them.

// Maps doc keys to human-readable type labels for file naming
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
};

export function formatFileName(
  numeroPi: string,
  nomeVeiculo: string,
  cidade: string,
  docTypeKey: string,
  originalExtension: string
): string {
  const tipoLabel = DOC_TYPE_LABELS[docTypeKey] || docTypeKey;
  return `PI ${numeroPi} - ${nomeVeiculo} - ${cidade} - ${tipoLabel}${originalExtension}`;
}
