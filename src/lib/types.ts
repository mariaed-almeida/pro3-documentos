export type Cliente = "ALESC" | "Prefeitura de Xanxerê" | "Prefeitura de Chapecó";

export type TipoVeiculo = "Jornal" | "Rádio" | "Televisão" | "Portal" | "Mídia Externa" | "Outro";

export type StatusDocumento = "pendente" | "em_analise" | "corrigido" | "rejeitado";

export interface DocumentoUpload {
  nome: string;
  arquivo: File | null;
  nomeArquivo?: string;
}

export interface Submission {
  id: string;
  cliente: Cliente;
  campanha: string;
  numeroPi: string;
  tipoVeiculo: TipoVeiculo;
  outroTipo?: string;
  nomeVeiculo: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  documentos: {
    piAssinado?: string;
    declaracaoSimplesNacional?: string;
    comprovantesExibicao?: string;
    declaracaoArtigo299?: string;
    certidoesNegativas?: string[];
    tabelaPrecoAssinada?: string;
  };
  status: StatusDocumento;
  dataEnvio: string;
  observacoes?: string;
}

export const CAMPANHAS: Record<Cliente, string[]> = {
  "ALESC": [
    "2026 - Demandas Bancadas Regionais - Fevereiro",
    "2026 - Institucional",
    "2026 - Sessões Especiais",
  ],
  "Prefeitura de Xanxerê": [
    "2026 - Obras e Infraestrutura",
    "2026 - Saúde Municipal",
    "2026 - Educação",
  ],
  "Prefeitura de Chapecó": [
    "2026 - Desenvolvimento Urbano",
    "2026 - Cultura e Turismo",
    "2026 - Serviços Públicos",
  ],
};
