import type { Submission } from "@/lib/types";
import { DOC_TYPE_LABELS } from "@/lib/types";
import logoPro3 from "@/assets/logo-pro3.png";

/** Rótulos com acentuação correta; o catálogo em types.ts ainda está sem acentos. */
const ROTULOS: Record<string, string> = {
  piAssinado: "PI assinado",
  notaFiscal: "Nota Fiscal",
  notaFiscalGrafica: "Nota Fiscal da gráfica",
  fotoMidiaExterna: "Foto do ponto de exibição",
  declaracaoSimplesNacional: "Declaração de optante pelo Simples Nacional",
  comprovantesExibicao: "Comprovantes de exibição",
  declaracaoArtigo299: "Declaração do Artigo 299",
  tabelaPrecoAssinada: "Tabela de preço assinada",
};

export interface DocumentoRecebido {
  rotulo: string;
  arquivo: string;
}

export function rotuloDocumento(key: string): string {
  return ROTULOS[key] ?? DOC_TYPE_LABELS[key] ?? key;
}

/** Protocolo no formato AAAAMMDD-XXXXXXXX (data do envio + 8 primeiros caracteres do id). */
export function gerarProtocolo(submission: Pick<Submission, "id" | "dataEnvio">): string {
  const d = new Date(submission.dataEnvio);
  const pad = (n: number) => String(n).padStart(2, "0");
  const data = Number.isNaN(d.getTime()) ? "00000000" : `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${data}-${submission.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function listarDocumentosRecebidos(submission: Submission): DocumentoRecebido[] {
  const itens: DocumentoRecebido[] = [];
  const { certidoesNegativas, ...demais } = submission.documentos;
  Object.entries(demais).forEach(([key, val]) => {
    if (typeof val === "string" && val) itens.push({ rotulo: rotuloDocumento(key), arquivo: val });
  });
  (certidoesNegativas ?? []).forEach((arquivo, i, arr) => {
    itens.push({ rotulo: arr.length > 1 ? `Certidão negativa ${i + 1}` : "Certidões negativas", arquivo });
  });
  return itens;
}

export function dadosDoComprovante(submission: Submission): { rotulo: string; valor: string }[] {
  const tipo = submission.tipoVeiculo === "Outro" ? submission.outroTipo || "Outro" : submission.tipoVeiculo;
  return [
    { rotulo: "Cliente", valor: submission.cliente },
    { rotulo: "Campanha", valor: submission.campanha },
    { rotulo: "Número do PI", valor: submission.numeroPi },
    { rotulo: "Veículo", valor: `${submission.nomeVeiculo} (${tipo})` },
    { rotulo: "Cidade", valor: submission.cidade },
    { rotulo: "Contato", valor: `${submission.contatoNome} · ${submission.contatoEmail} · ${submission.contatoTelefone}` },
    { rotulo: "Data e hora do envio", valor: new Date(submission.dataEnvio).toLocaleString("pt-BR") },
  ];
}

async function carregarLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(logoPro3)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    // Reduz o logo para manter o PDF leve.
    const escala = Math.min(1, 500 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

const nomeSeguro = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, " ").trim() || "sem numero";

/** Monta o comprovante em A4 e baixa o arquivo. */
export async function baixarProtocoloPdf(submission: Submission): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const logo = await carregarLogo();
  const protocolo = gerarProtocolo(submission);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 20;
  const W = 210;
  const H = 297;
  const larguraUtil = W - M * 2;
  const rodapeY = H - 14;
  const limiteY = H - 24;
  const cinzaTexto: [number, number, number] = [110, 110, 110];
  const cinzaFio: [number, number, number] = [205, 205, 205];

  const fio = (y: number, cor = cinzaFio) => {
    doc.setDrawColor(...cor);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
  };

  // Cabeçalho
  let y = M;
  if (logo) {
    const h = 12;
    const w = (logo.w / logo.h) * h;
    doc.addImage(logo.dataUrl, "PNG", M, y, w, h);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(0, 0, 0);
    doc.text("Pró3 Comunicação", M, y + 8);
  }
  y += 20;
  fio(y, [0, 0, 0]);

  // Título e protocolo
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...cinzaTexto);
  doc.text("PRÓ3 COMUNICAÇÃO · DOCUMENTOS DE FATURAMENTO", M, y);
  y += 9;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(0, 0, 0);
  doc.text("Comprovante de envio", M, y);

  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...cinzaTexto);
  doc.text("NÚMERO DE PROTOCOLO", M, y);
  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(0, 0, 0);
  doc.text(protocolo, M, y);

  // Dados do envio
  y += 12;
  const colValor = M + 42;
  const larguraValor = W - M - colValor;
  fio(y);
  doc.setFontSize(10);
  dadosDoComprovante(submission).forEach(({ rotulo, valor }) => {
    const linhas: string[] = doc.setFont("helvetica", "normal").splitTextToSize(valor, larguraValor);
    const alturaLinha = 5;
    y += 6.5;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...cinzaTexto);
    doc.text(rotulo, M, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
    doc.text(linhas, colValor, y);
    y += (linhas.length - 1) * alturaLinha + 3.5;
    fio(y);
  });

  // Documentos recebidos
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0, 0, 0);
  doc.text("Documentos recebidos", M, y);
  y += 4;
  fio(y, [0, 0, 0]);

  const docsRecebidos = listarDocumentosRecebidos(submission);
  const novaPagina = () => {
    doc.addPage();
    y = M;
  };
  doc.setFontSize(10);
  if (docsRecebidos.length === 0) {
    y += 7;
    doc.setFont("helvetica", "normal").setTextColor(...cinzaTexto);
    doc.text("Nenhum documento registrado.", M, y);
  }
  docsRecebidos.forEach(({ rotulo, arquivo }, i) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    const linhas: string[] = doc.splitTextToSize(arquivo, larguraUtil - 8);
    const altura = 6 + 4.5 + linhas.length * 4.2 + 3;
    if (y + altura > limiteY) novaPagina();
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...cinzaTexto);
    doc.text(String(i + 1).padStart(2, "0"), M, y);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0, 0, 0);
    doc.text(rotulo, M + 8, y);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...cinzaTexto);
    doc.text(linhas, M + 8, y + 4.5);
    y += 4.5 + (linhas.length - 1) * 4.2 + 3.5;
    fio(y);
  });

  // Nota final
  const nota = "Guarde este comprovante. A Pró3 confere a documentação e avisa por e-mail se algo precisar de correção.";
  doc.setFont("helvetica", "normal").setFontSize(10);
  const notaLinhas: string[] = doc.splitTextToSize(nota, larguraUtil - 6);
  if (y + 12 + notaLinhas.length * 5 > limiteY) novaPagina();
  y += 12;
  doc.setDrawColor(0, 0, 0).setLineWidth(0.5);
  doc.line(M, y - 3.5, M, y - 3.5 + notaLinhas.length * 5 + 1);
  doc.setTextColor(40, 40, 40);
  doc.text(notaLinhas, M + 4, y);

  // Rodapé em todas as páginas
  const emissao = new Date().toLocaleString("pt-BR");
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fio(rodapeY - 4);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...cinzaTexto);
    doc.text(`Emitido em ${emissao} · Protocolo ${protocolo}`, M, rodapeY);
    doc.text(`Pró3 Comunicação · ${p}/${total}`, W - M, rodapeY, { align: "right" });
  }

  doc.setProperties({ title: `Comprovante de envio ${protocolo}`, author: "Pró3 Comunicação" });
  doc.save(`Protocolo ${nomeSeguro(submission.numeroPi)} - ${protocolo}.pdf`);
  return protocolo;
}
