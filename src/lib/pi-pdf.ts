import type { jsPDF as JsPdf } from "jspdf";
import logoPro3 from "@/assets/logo-pro3.png";
import {
  formatVencimento,
  orientacoesDoPi,
  periodoLabel,
  prazoLabel,
  totaisPi,
  totalInsercoes,
  totalItem,
  type PiDocumento,
  type PiItem,
} from "@/lib/pedidos";

/**
 * Todas as coordenadas abaixo estão em "pixels de referência": a página A4 paisagem (842 x 595 pt)
 * renderizada a 1,65 px/pt, que é como o PI original foi medido. K converte para pt.
 */
const K = 1 / 1.65;
const FRAME = { x1: 16, y1: 16, x2: 1372, y2: 965 };
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const LINHAS_MINIMAS = 14;

type Logo = { dataUrl: string; w: number; h: number } | null;

async function carregarLogo(): Promise<Logo> {
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
    const escala = Math.min(1, 700 / img.naturalWidth);
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
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, " ").trim() || "sem nome";

const moeda = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${String(n).replace(".", ",")}%`;

function dataBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

const diasNoMes = (mes: number, ano: number) => new Date(ano, mes, 0).getDate();

export async function gerarPiPdf(piDoc: PiDocumento): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const logo = await carregarLogo();
  const doc: JsPdf = new jsPDF({ unit: "pt", orientation: "landscape", format: "a4" });

  // ---------- primitivas (coordenadas de referência) ----------
  const linha = (x1: number, y1: number, x2: number, y2: number, w = 0.6) => {
    doc.setDrawColor(0, 0, 0).setLineWidth(w);
    doc.line(x1 * K, y1 * K, x2 * K, y2 * K);
  };
  const texto = (
    s: string,
    x: number,
    y: number,
    opt: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; color?: [number, number, number] } = {},
  ) => {
    doc.setFont("helvetica", opt.bold === false ? "normal" : "bold").setFontSize(opt.size ?? 7.5);
    doc.setTextColor(...(opt.color ?? [0, 0, 0]));
    doc.text(s, x * K, y * K, { align: opt.align ?? "left", baseline: "middle" });
  };
  /** Texto que cabe em maxW (px): reduz a fonte até 6 pt e, se ainda não couber, quebra linha. */
  const ajustado = (s: string, x: number, y: number, maxW: number, base = 7.5, min = 6) => {
    if (!s) return;
    doc.setFont("helvetica", "bold");
    let size = base;
    const limite = maxW * K;
    doc.setFontSize(size);
    while (size > min && doc.getTextWidth(s) > limite) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    if (doc.getTextWidth(s) <= limite) {
      texto(s, x, y, { size });
      return;
    }
    // no máximo duas linhas, para não invadir a linha vizinha; se preciso, reduz até 5 pt e corta com reticências
    let tam = min;
    let linhas: string[] = doc.setFontSize(tam).splitTextToSize(s, limite);
    while (linhas.length > 2 && tam > 5) {
      tam -= 0.25;
      linhas = doc.setFontSize(tam).splitTextToSize(s, limite);
    }
    if (linhas.length > 2) {
      let ultima = linhas.slice(1).join(" ");
      while (ultima.length > 1 && doc.getTextWidth(ultima + "...") > limite) ultima = ultima.slice(0, -1);
      linhas = [linhas[0], ultima.trimEnd() + "..."];
    }
    const lh = (tam + 1) / K;
    linhas.forEach((l, i) => texto(l, x, y + (i - (linhas.length - 1) / 2) * lh, { size: tam }));
  };
  const larguraPx = (s: string, size: number) => {
    doc.setFont("helvetica", "bold").setFontSize(size);
    return doc.getTextWidth(s) / K;
  };

  const moldura = () => {
    doc.setDrawColor(0, 0, 0).setLineWidth(0.8);
    doc.rect(FRAME.x1 * K, FRAME.y1 * K, (FRAME.x2 - FRAME.x1) * K, (FRAME.y2 - FRAME.y1) * K);
  };

  // ---------- faixa superior ----------
  const ag = piDoc.agencia;
  const faixaSuperior = () => {
    linha(FRAME.x1, 153, FRAME.x2, 153);
    linha(314, FRAME.y1, 314, 153);
    linha(660, FRAME.y1, 660, 153);
    linha(1105, FRAME.y1, 1105, 153);

    if (logo) {
      const maxW = 250;
      const maxH = 124;
      const esc = Math.min(maxW / logo.w, maxH / logo.h);
      const w = logo.w * esc;
      const h = logo.h * esc;
      const cx = 166;
      doc.addImage(logo.dataUrl, "PNG", (cx - w / 2) * K, (84.5 - h / 2) * K, w * K, h * K);
    } else {
      texto("PRÓ3", 165, 85, { size: 30, align: "center" });
    }

    const linhasAg = [
      ag.razaoSocial,
      ag.endereco,
      `${ag.cep} ${ag.cidadeUf}`,
      `FONE ${ag.fone} WHATSAPP ${ag.whatsapp}`,
      `CNPJ: ${ag.cnpj}`,
      `Inscrição Estadual: ${ag.inscricaoEstadual}`,
      `Inscrição Municipal: ${ag.inscricaoMunicipal}`,
      `E-mail: ${ag.emailFinanceiro}`,
    ];
    linhasAg.forEach((l, i) => ajustado(l, 330, 25.5 + i * 16.5, 320, 7.25, 6));

    // título: largura alvo ~ 418 px, limitada à célula
    let tam = 24;
    while (tam > 14 && larguraPx("PEDIDO DE INSERÇÃO", tam) > 425) tam -= 0.5;
    texto("PEDIDO DE INSERÇÃO", 878, 87, { size: tam, align: "center" });

    texto("PI", 1236, 54, { size: 23, align: "center" });
    let tamNum = 23;
    const num = String(piDoc.numero);
    while (tamNum > 10 && larguraPx(num, tamNum) > 250) tamNum -= 0.5;
    texto(num, 1236, 112, { size: tamNum, align: "center" });
  };

  // ---------- bloco de identificação ----------
  const cli = piDoc.cliente;
  const vei = piDoc.veiculo;
  const identificacao = () => {
    linha(FRAME.x1, 300, FRAME.x2, 300);
    linha(490, 153, 490, 300);
    linha(1105, 153, 1105, 300);

    const ys = [166, 185.5, 205.5, 225.5, 245.5, 265.5, 285];
    const rot = (s: string, x: number, y: number) => texto(s, x, y, { size: 7.5 });

    // cliente
    const esq: [string, string][] = [
      ["CLIENTE", cli.nome],
      ["RAZÃO SOCIAL", cli.razaoSocial],
      ["CNPJ", `${cli.cnpj}  I.E.      I.M.`],
      ["ENDEREÇO", cli.endereco],
      ["CEP/MUNIC/UF", cli.cepMunicipioUf],
      ["PRAÇA PAGTO", cli.pracaPagamento],
    ];
    esq.forEach(([r, v], i) => {
      rot(r, 25, ys[i]);
      ajustado(v, 124, ys[i], 358);
    });

    // veículo
    const cen: [string, string][] = [
      ["VEÍCULO", vei.nome],
      ["PRAÇA", vei.praca],
      ["RAZÃO SOCIAL", vei.razaoSocial],
      ["ENDEREÇO", vei.endereco],
    ];
    cen.forEach(([r, v], i) => {
      rot(r, 495, ys[i]);
      ajustado(v, 619, ys[i], 480);
    });
    rot("CNPJ", 495, ys[4]);
    ajustado(vei.cnpj, 619, ys[4], 184);
    rot("CONTATO", 809, ys[4]);
    ajustado(vei.contato, 809 + larguraPx("CONTATO", 7.5) + 6, ys[4], 1098 - (809 + larguraPx("CONTATO", 7.5) + 6));
    rot("FONE / WHATSAPP", 495, ys[5]);
    ajustado(vei.fone, 619, ys[5], 184);
    rot("REPRES", 809, ys[5]);
    ajustado(vei.representante, 809 + larguraPx("REPRES", 7.5) + 6, ys[5], 1098 - (809 + larguraPx("REPRES", 7.5) + 6));
    rot("E-MAIL", 495, ys[6]);
    ajustado(vei.email, 619, ys[6], 480);

    // direita
    const dir: [string, string][] = [
      ["PERÍODO", periodoLabel(piDoc.mes, piDoc.ano)],
      ["DATA EMISSÃO", dataBr(piDoc.dataEmissao)],
      ["PROJETO", piDoc.projeto],
      ["PLANO", piDoc.plano],
      ["PLANILHA", piDoc.planilha],
    ];
    dir.forEach(([r, v], i) => {
      rot(r, 1114, ys[i + 1]);
      ajustado(v, 1246, ys[i + 1], 120);
    });
  };

  // ---------- tabela ----------
  const nd = diasNoMes(piDoc.mes, piDoc.ano);
  const X = {
    col: FRAME.x1,
    peca: 231,
    dias: 247,
    tot: 893,
    unit: 957,
    desc: 1097,
    custo: 1237,
    fim: FRAME.x2,
  };
  const diaW = (X.tot - X.dias) / nd;
  const diaX = (d: number) => X.dias + (d - 1) * diaW;
  const domingo = (d: number) => new Date(piDoc.ano, piDoc.mes - 1, d).getDay() === 0;
  const CINZA: [number, number, number] = [221, 221, 221];
  const VERMELHO: [number, number, number] = [230, 0, 0];

  const cabecalhoTabela = (topo: number, fundo: number) => {
    const hdr = 74;
    const r1 = topo + 39;
    // fundo cinza dos domingos (cabeçalho + linhas)
    doc.setFillColor(...CINZA);
    for (let d = 1; d <= nd; d++) {
      if (domingo(d)) doc.rect(diaX(d) * K, topo * K, diaW * K, (fundo - topo) * K, "F");
    }
    linha(FRAME.x1, topo, FRAME.x2, topo);
    linha(X.peca, r1, FRAME.x2, r1);
    linha(FRAME.x1, topo + hdr, FRAME.x2, topo + hdr);

    texto("COLOCAÇÃO", (X.col + X.peca) / 2, topo + 21, { size: 7.5, align: "center" });
    texto(periodoLabel(piDoc.mes, piDoc.ano), (X.col + X.peca) / 2, topo + 34, { size: 7.5, align: "center" });
    ["P", "E", "Ç", "A"].forEach((l, i) =>
      texto(l, (X.peca + X.dias) / 2, topo + 14 + i * 13.5 + 0.5, { size: 6.5, align: "center" }),
    );
    for (let d = 1; d <= nd; d++) {
      const cx = diaX(d) + diaW / 2;
      const cor = domingo(d) ? VERMELHO : undefined;
      texto(String(d).padStart(2, "0"), cx, topo + 14, { size: 7, align: "center", color: cor, bold: false });
      texto(DIAS_SEMANA[new Date(piDoc.ano, piDoc.mes - 1, d).getDay()], cx, topo + 53, {
        size: 7,
        align: "center",
        color: cor,
        bold: false,
      });
    }
    const duas = (a: string, b: string, cx: number) => {
      texto(a, cx, topo + 14, { size: 7, align: "center", bold: false });
      texto(b, cx, topo + 27, { size: 7, align: "center", bold: false });
    };
    duas("TOT", "INS", (X.tot + X.unit) / 2);
    duas("CUSTO", "UNITARIO", (X.unit + X.desc) / 2);
    duas("%", "DESCONTO", (X.desc + X.custo) / 2);
    duas("CUSTO", "(TOTAL R$)", (X.custo + X.fim) / 2);
    return topo + hdr;
  };

  const grade = (topo: number, dadosTopo: number, fundo: number, rowH: number, nLinhas: number) => {
    // horizontais das linhas de dados
    for (let i = 0; i <= nLinhas; i++) linha(FRAME.x1, dadosTopo + i * rowH, FRAME.x2, dadosTopo + i * rowH, 0.4);
    // verticais
    linha(X.peca, topo, X.peca, fundo);
    linha(X.dias, topo, X.dias, fundo);
    for (let d = 2; d <= nd; d++) linha(diaX(d), topo, diaX(d), fundo, 0.4);
    [X.tot, X.unit, X.desc, X.custo].forEach((x) => linha(x, topo, x, fundo));
    linha(FRAME.x1, fundo, FRAME.x2, fundo);
  };

  const linhaDados = (it: PiItem, y: number, rowH: number) => {
    const cy = y + rowH / 2;
    const tam = rowH < 17 ? 6.5 : 7.5;
    ajustado(it.colocacao, 25, cy, X.peca - 30, tam, 5.5);
    texto(it.tipoPeca, (X.peca + X.dias) / 2, cy, { size: tam, align: "center" });
    for (let d = 1; d <= nd; d++) {
      const q = Number(it.insercoes[String(d)]) || 0;
      if (q > 0) texto(String(q), diaX(d) + diaW / 2, cy, { size: tam, align: "center" });
    }
    texto(String(totalInsercoes(it)), X.unit - 4, cy, { size: tam, align: "right" });
    texto(moeda(it.custoUnitario), X.desc - 7, cy, { size: tam, align: "right" });
    texto(pct(it.descontoPct || 0), X.custo - 8, cy, { size: tam, align: "right" });
    texto(moeda(totalItem(it)), X.fim - 4, cy, { size: tam, align: "right" });
  };

  const totais = (fundo: number) => {
    const t = totaisPi(piDoc.itens, piDoc.comissaoPct);
    texto(String(t.insercoes), X.unit - 4, fundo + 8, { size: 7.5, align: "right" });
    const par = (r: string, v: number, dy: number) => {
      texto(r, 1064, fundo + dy, { size: 7.5 });
      texto(moeda(v), X.fim - 4, fundo + dy, { size: 7.5, align: "right" });
    };
    par("TOTAL BRUTO R$", t.bruto, 8);
    par("COMISSÃO R$", t.comissao, 28);
    par("LIQUIDO R$", t.liquido, 47);
    texto("PRAZO DE PAGAMENTO", 33, fundo + 53, { size: 7.5 });
    texto(
      `${prazoLabel(piDoc.prazoDias, piDoc.prazoBase)} VENCIMENTO: ${formatVencimento(piDoc.dataEmissao, piDoc.prazoDias, piDoc.prazoBase)}`,
      214,
      fundo + 53,
      { size: 7, bold: false },
    );
    linha(FRAME.x1, fundo + 67, FRAME.x2, fundo + 67);
    return fundo + 67;
  };

  // ---------- paginação da tabela ----------
  const itens = piDoc.itens;
  const n = itens.length;
  const P1_DADOS = 432;
  const P1_FUNDO = 733;
  const CONT_TOPO = 300;
  const CONT_DADOS = CONT_TOPO + 74;
  const CONT_FUNDO_MAX = 840;
  const ROW_PADRAO = (P1_FUNDO - P1_DADOS) / LINHAS_MINIMAS;
  const ROW_MIN = 15;
  const ROW_MULTI = 18;

  type PaginaTabela = { itens: PiItem[]; primeira: boolean; ultima: boolean; rowH: number; linhas: number };
  const paginas: PaginaTabela[] = [];
  if (n <= LINHAS_MINIMAS) {
    paginas.push({ itens, primeira: true, ultima: true, rowH: ROW_PADRAO, linhas: LINHAS_MINIMAS });
  } else if ((P1_FUNDO - P1_DADOS) / n >= ROW_MIN) {
    const rowH = (P1_FUNDO - P1_DADOS) / n;
    paginas.push({ itens, primeira: true, ultima: true, rowH, linhas: n });
  } else {
    const cap1 = Math.floor((P1_FUNDO - P1_DADOS) / ROW_MULTI);
    const capC = Math.floor((CONT_FUNDO_MAX - CONT_DADOS) / ROW_MULTI);
    paginas.push({ itens: itens.slice(0, cap1), primeira: true, ultima: false, rowH: ROW_MULTI, linhas: cap1 });
    let resto = itens.slice(cap1);
    while (resto.length > 0) {
      const parte = resto.slice(0, capC);
      resto = resto.slice(capC);
      paginas.push({ itens: parte, primeira: false, ultima: resto.length === 0, rowH: ROW_MULTI, linhas: parte.length });
    }
  }

  // ---------- desenho das páginas da tabela ----------
  paginas.forEach((pg, idx) => {
    if (idx > 0) doc.addPage();
    moldura();
    faixaSuperior();
    identificacao();

    let topoTabela: number;
    let dadosTopo: number;
    if (pg.primeira) {
      // produto / campanha
      linha(686, 300, 686, 332);
      linha(FRAME.x1, 332, FRAME.x2, 332);
      texto("PRODUTO:", 33, 314, { size: 7.5 });
      ajustado(piDoc.produto, 33 + larguraPx("PRODUTO:", 7.5) + 8, 314, 686 - 33 - larguraPx("PRODUTO:", 7.5) - 16);
      texto("CAMPANHA:", 703, 314, { size: 7.5 });
      ajustado(piDoc.campanha, 818, 314, FRAME.x2 - 818 - 8);
      // peça / formato / material
      linha(FRAME.x1, 358, FRAME.x2, 358);
      const p0 = itens[0];
      texto("PEÇA", 33, 345, { size: 7.5 });
      ajustado(p0?.peca ?? "", 82, 345, 540 - 82 - 8);
      texto("FORMATO", 545, 345, { size: 7.5 });
      ajustado(p0?.formato ?? "", 693, 345, 1034 - 693 - 8);
      texto("MATERIAL", 1039, 345, { size: 7.5 });
      const xm = 1039 + larguraPx("MATERIAL", 7.5) + 8;
      ajustado(p0?.material ?? "", xm, 345, FRAME.x2 - xm - 6);
      topoTabela = 358;
      dadosTopo = P1_DADOS;
    } else {
      topoTabela = CONT_TOPO;
      dadosTopo = CONT_DADOS;
    }

    const fundo = dadosTopo + pg.linhas * pg.rowH;
    cabecalhoTabela(topoTabela, fundo);
    grade(topoTabela, dadosTopo, fundo, pg.rowH, pg.linhas);
    pg.itens.forEach((it, i) => linhaDados(it, dadosTopo + i * pg.rowH, pg.rowH));

    if (pg.ultima) {
      const fim = totais(fundo);
      texto("<<VEJA PÁGINA SEGUINTE>>", 83, fim + 14, { size: 7.5 });
    } else {
      texto("<<CONTINUA NA PÁGINA SEGUINTE>>", 83, fundo + 14, { size: 7.5 });
    }
  });

  // ---------- orientações ----------
  const rodapeOrient = () => {
    linha(FRAME.x1, 914, FRAME.x2, 914);
    linha(914, 914, 914, FRAME.y2);
    linha(1144, 914, 1144, FRAME.y2);
    texto(`Enviar o faturamento para o email: ${ag.emailMidia}`, 25, 928, { size: 7.5 });
    texto("Data", (914 + 1144) / 2, 921, { size: 7, align: "center", bold: false });
    texto("Mídia", (1144 + FRAME.x2) / 2, 921, { size: 7, align: "center", bold: false });
    const nomeW = Math.min(larguraPx(ag.assinaturaNome, 7), 220);
    ajustado(ag.assinaturaNome, (1144 + FRAME.x2) / 2 - nomeW / 2, 943, 222, 7, 5.5);
  };

  const larguraTexto = (FRAME.x2 - 25 - 8) * K;
  const topoTexto = 322;
  const baseTexto = 905;
  const textoBruto = orientacoesDoPi(piDoc);
  const quebrar = (tam: number): string[] => {
    doc.setFont("helvetica", "bold").setFontSize(tam);
    return textoBruto.split("\n").flatMap((l) => (l.trim() === "" ? [""] : (doc.splitTextToSize(l, larguraTexto) as string[])));
  };
  const alturaLinha = (tam: number) => (tam * 1.14) / K;
  let tamOr = 8;
  let linhasOr = quebrar(tamOr);
  while (tamOr > 6.5 && linhasOr.length * alturaLinha(tamOr) > baseTexto - topoTexto) {
    tamOr -= 0.25;
    linhasOr = quebrar(tamOr);
  }
  const lh = alturaLinha(tamOr);
  const capacidade = Math.max(1, Math.floor((baseTexto - topoTexto) / lh));
  for (let ini = 0; ini < Math.max(linhasOr.length, 1); ini += capacidade) {
    doc.addPage();
    moldura();
    faixaSuperior();
    identificacao();
    linhasOr.slice(ini, ini + capacidade).forEach((l, i) => {
      if (l) texto(l, 25, topoTexto + lh / 2 + i * lh, { size: tamOr });
    });
    rodapeOrient();
  }

  doc.setProperties({ title: `PI ${piDoc.numero} - ${vei.nome}`, author: ag.razaoSocial });
  return doc.output("blob");
}

export async function baixarPiPdf(piDoc: PiDocumento): Promise<void> {
  const blob = await gerarPiPdf(piDoc);
  const nome = `PI ${nomeSeguro(String(piDoc.numero))} - ${nomeSeguro(piDoc.veiculo.nome)}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
