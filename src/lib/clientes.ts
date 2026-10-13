import type { Cliente, TipoVeiculo } from "./types";

export const CLIENTES: Cliente[] = ["ALESC", "Prefeitura de Xanxerê", "Prefeitura de Chapecó"];
export const TIPOS_VEICULO: TipoVeiculo[] = ["Jornal", "Rádio", "Televisão", "Portal", "Mídia Externa", "Outro"];

export interface OrientacaoCliente {
  cnpj: string;
  contratoInfo: string[];
  observacoesNF: string[];
  enderecoPostal: string;
}

export const ORIENTACOES_CLIENTE: Record<Cliente, OrientacaoCliente> = {
  "ALESC": {
    cnpj: "83.599.191/0001-87",
    contratoInfo: ["Contrato nº 031/2023", "Edital nº 001/2022"],
    observacoesNF: [
      "A Nota Fiscal deve ser emitida somente após o término da veiculação.",
      "Utilize o modelo 62 (conforme Ajuste SINIEF nº 7/2022).",
      "O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.",
      "Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.",
      "Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.",
    ],
    enderecoPostal: "Av. Prefeito Osmar Cunha, 416, Sala 905 — Ed. Koerich Empresarial Rio Branco — Florianópolis/SC — CEP 88.015-100",
  },
  "Prefeitura de Chapecó": {
    cnpj: "83.021.808/0001-82",
    contratoInfo: ["Contrato nº 371/2025", "Concorrência nº 186/2025"],
    observacoesNF: [
      "A Nota Fiscal deve ser emitida somente após o término da veiculação.",
      "Faturar o valor líquido diretamente contra a Prefeitura de Chapecó.",
      "O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.",
      "Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.",
      "Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.",
    ],
    enderecoPostal: "Av. Nereu Ramos, 75D, Sala 707A — Centro Profissional Chapecó — Chapecó/SC — CEP 89801-023",
  },
  "Prefeitura de Xanxerê": {
    cnpj: "83.009.860/0001-13",
    contratoInfo: ["Processo Licitatório nº 0066/2025", "Concorrência nº 0001/2025", "Contrato nº 0180/2025"],
    observacoesNF: [
      "A Nota Fiscal deve ser emitida somente após o término da veiculação.",
      "Faturar o valor líquido diretamente contra a Prefeitura de Xanxerê.",
      "A NF deve conter o texto: \"Documento emitido em nome do tomador do serviço aos cuidados da Agência Pro3 Comunicação\".",
      "O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.",
      "Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.",
      "Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.",
    ],
    enderecoPostal: "Rua Ouro Preto, 315 — Bairro Tonial — Xanxerê/SC — CEP 89820-000",
  },
};
