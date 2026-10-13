// Modelos dos e-mails do sistema. Texto corrido, sem enfeite: parece uma mensagem da equipe, não um painel.
// A pontuação é normalizada para ASCII (hífen simples, aspas retas); as letras acentuadas ficam como estão.

export interface Agencia {
  razao_social: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade_uf: string | null;
  cep: string | null;
  fone: string | null;
  whatsapp: string | null;
  email_midia: string | null;
  email_financeiro: string | null;
  assinatura_nome: string | null;
  assinatura_cargo: string | null;
}

export interface DadosEnvio {
  contatoNome: string;
  numeroPi: string;
  cliente: string;
  campanha: string;
  veiculo: string;
  cidade: string | null;
}

export interface Montado {
  assunto: string;
  html: string;
  text: string;
}

const AZUL = "#00449e";
const TEXTO = "#222222";
const MUDO = "#666666";
const FIO = "#d9d9d9";

export const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Troca pontuação tipográfica por equivalentes simples e tira caracteres de controle. */
export function normalizar(v: string): string {
  return v
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[•·●▪]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const primeiroNome = (nome: string) => normalizar(nome).split(" ")[0] || "";

function rodape(a: Agencia | null, logoUrl: string): string {
  const linhas = [
    a?.razao_social,
    [a?.endereco, a?.cidade_uf, a?.cep].filter(Boolean).join(", "),
    [a?.fone ? `Fone ${a.fone}` : null, a?.whatsapp ? `WhatsApp ${a.whatsapp}` : null, a?.email_midia ?? a?.email_financeiro].filter(Boolean).join(" - "),
    a?.cnpj ? `CNPJ ${a.cnpj}` : null,
  ]
    .filter(Boolean)
    .map((l) => esc(normalizar(String(l))));
  return `
    <tr><td style="padding: 28px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid ${FIO};">
        <tr><td style="padding: 18px 0 0; font-size: 12px; line-height: 1.6; color: ${MUDO};">
          <img src="${logoUrl}" width="84" alt="Pró3 Comunicação" style="display: block; border: 0; margin: 0 0 10px; height: auto;">
          ${linhas.join("<br>")}
        </td></tr>
      </table>
    </td></tr>`;
}

function moldura(titulo: string, corpo: string, a: Agencia | null, logoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>${esc(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background: #ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
  <tr><td align="center" style="padding: 28px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 560px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: ${TEXTO};">
      <tr><td style="padding: 0 0 18px; border-bottom: 3px solid ${AZUL};">
        <img src="${logoUrl}" width="120" alt="Pró3 Comunicação" style="display: block; border: 0; height: auto;">
      </td></tr>
      <tr><td style="padding: 26px 0 0;">${corpo}</td></tr>
      ${rodape(a, logoUrl)}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const p = (t: string, extra = "") => `<p style="margin: 0 0 16px;${extra}">${t}</p>`;

const resumoPi = (d: DadosEnvio) => {
  const linha = (k: string, v: string) =>
    `<tr><td style="padding: 3px 14px 3px 0; color: ${MUDO}; white-space: nowrap; vertical-align: top;">${esc(k)}</td><td style="padding: 3px 0;">${esc(normalizar(v))}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 20px; font-size: 14px;">
    ${linha("PI", d.numeroPi)}${linha("Cliente", d.cliente)}${linha("Campanha", d.campanha)}${linha("Veículo", `${d.veiculo}${d.cidade ? ` (${d.cidade})` : ""}`)}
  </table>`;
};

const assinatura = (a: Agencia | null) =>
  p(
    `Atenciosamente,<br>${esc(normalizar(a?.assinatura_nome ?? "Equipe de Mídia"))}${a?.assinatura_cargo ? `<br>${esc(normalizar(a.assinatura_cargo))}` : ""}<br>${esc(normalizar(a?.razao_social ?? "Pró3 Comunicação"))}`,
    " color: #444444;",
  );

export function montarProtocolo(d: DadosEnvio, protocolo: string, recebidoEm: string, documentos: string[], a: Agencia | null, logoUrl: string): Montado {
  const nome = primeiroNome(d.contatoNome);
  const lista = documentos
    .map((x) => `<li style="margin: 0 0 3px;">${esc(normalizar(x))}</li>`)
    .join("");
  const corpo = [
    p(`Olá${nome ? `, ${esc(nome)}` : ""}.`),
    p(`Recebemos os documentos do PI ${esc(d.numeroPi)} em ${esc(recebidoEm)}. Este e-mail é o seu comprovante de envio.`),
    `<p style="margin: 0 0 4px; font-size: 13px; color: ${MUDO};">Número de protocolo</p>
     <p style="margin: 0 0 20px; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">${esc(protocolo)}</p>`,
    resumoPi(d),
    p("Documentos recebidos:", " margin-bottom: 6px;"),
    `<ul style="margin: 0 0 20px; padding: 0 0 0 20px;">${lista}</ul>`,
    p("Nossa equipe vai conferir a documentação. Se faltar ou precisar corrigir alguma coisa, avisamos por e-mail, com a lista do que ajustar."),
    p("Guarde este e-mail. Se precisar falar com a gente, é só responder esta mensagem."),
    assinatura(a),
  ].join("\n");

  const text = [
    `Olá${nome ? `, ${nome}` : ""}.`,
    "",
    `Recebemos os documentos do PI ${d.numeroPi} em ${recebidoEm}. Este e-mail é o seu comprovante de envio.`,
    "",
    `Número de protocolo: ${protocolo}`,
    `PI: ${d.numeroPi}`,
    `Cliente: ${d.cliente}`,
    `Campanha: ${d.campanha}`,
    `Veículo: ${d.veiculo}${d.cidade ? ` (${d.cidade})` : ""}`,
    "",
    "Documentos recebidos:",
    ...documentos.map((x) => `- ${normalizar(x)}`),
    "",
    "Nossa equipe vai conferir a documentação. Se faltar ou precisar corrigir alguma coisa, avisamos por e-mail.",
    "Se precisar falar com a gente, é só responder esta mensagem.",
    "",
    "Atenciosamente,",
    normalizar(a?.assinatura_nome ?? "Equipe de Mídia"),
    normalizar(a?.razao_social ?? "Pró3 Comunicação"),
  ].join("\n");

  return {
    assunto: normalizar(`Protocolo ${protocolo} - PI ${d.numeroPi} (${d.cliente})`),
    html: moldura("Comprovante de envio", corpo, a, logoUrl),
    text,
  };
}

export function montarDevolucao(d: DadosEnvio, motivo: string, a: Agencia | null, logoUrl: string): Montado {
  const nome = primeiroNome(d.contatoNome);
  const pontos = normalizar(motivo)
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const lista =
    pontos.length > 1
      ? `<ol style="margin: 0 0 20px; padding: 0 0 0 22px;">${pontos.map((x) => `<li style="margin: 0 0 8px;">${esc(x)}</li>`).join("")}</ol>`
      : p(esc(pontos[0] ?? ""), " margin-bottom: 20px;");

  const corpo = [
    p(`Olá${nome ? `, ${esc(nome)}` : ""}.`),
    p(`Conferimos os documentos do PI ${esc(d.numeroPi)} e precisamos de ${pontos.length > 1 ? "alguns ajustes" : "um ajuste"} antes de seguir com o faturamento:`),
    lista,
    resumoPi(d),
    p(`Para reenviar, abra o formulário de envio, escolha o cliente ${esc(normalizar(d.cliente))} e informe o mesmo número de PI (${esc(d.numeroPi)}). Os arquivos novos são juntados ao envio anterior.`),
    p("Qualquer dúvida, é só responder esta mensagem."),
    assinatura(a),
  ].join("\n");

  const text = [
    `Olá${nome ? `, ${nome}` : ""}.`,
    "",
    `Conferimos os documentos do PI ${d.numeroPi} e precisamos de ${pontos.length > 1 ? "alguns ajustes" : "um ajuste"} antes de seguir com o faturamento:`,
    "",
    ...pontos.map((x, i) => `${i + 1}. ${x}`),
    "",
    `Cliente: ${d.cliente}`,
    `Campanha: ${d.campanha}`,
    `Veículo: ${d.veiculo}`,
    "",
    `Para reenviar, abra o formulário de envio, escolha o cliente ${d.cliente} e informe o mesmo número de PI (${d.numeroPi}). Os arquivos novos são juntados ao envio anterior.`,
    "Qualquer dúvida, é só responder esta mensagem.",
    "",
    "Atenciosamente,",
    normalizar(a?.assinatura_nome ?? "Equipe de Mídia"),
    normalizar(a?.razao_social ?? "Pró3 Comunicação"),
  ].join("\n");

  return {
    assunto: normalizar(`Ajustes necessários no PI ${d.numeroPi} (${d.cliente})`),
    html: moldura("Ajustes necessários", corpo, a, logoUrl),
    text,
  };
}
