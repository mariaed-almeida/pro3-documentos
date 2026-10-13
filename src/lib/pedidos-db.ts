import { supabase } from "@/integrations/supabase/client";
import type { Agencia, BasePrazo, PiDocumento, PiItem } from "@/lib/pedidos";
import { totaisPi } from "@/lib/pedidos";
import { enderecoLinha, limparLogradouro } from "@/lib/cnpj";
import type { Json } from "@/integrations/supabase/types";

export type StatusPi = "rascunho" | "emitido" | "cancelado";

export interface PedidoResumo {
  id: string;
  numero: number;
  status: StatusPi;
  clienteId: string;
  veiculoId: string;
  campanha: string;
  mes: number;
  ano: number;
  dataEmissao: string;
  valorBruto: number;
  comissao: number;
  valorLiquido: number;
  clienteNome: string;
  veiculoNome: string;
  prazoDias: number;
  prazoBase: BasePrazo;
}

export interface PedidoEdicao {
  id: string | null;
  numero: number;
  status: StatusPi;
  clienteId: string;
  veiculoId: string;
  campanha: string;
  mes: number;
  ano: number;
  dataEmissao: string;
  projeto: string;
  plano: string;
  planilha: string;
  produto: string;
  comissaoPct: number;
  prazoDias: number;
  prazoBase: BasePrazo;
  observacoes: string;
  itens: PiItem[];
}

export async function listPedidos(): Promise<PedidoResumo[]> {
  const { data, error } = await supabase
    .from("pedidos_insercao")
    .select("id, numero, status, cliente_id, veiculo_id, campanha, mes, ano, data_emissao, prazo_dias, prazo_base, valor_bruto, comissao, valor_liquido, clientes(nome), veiculos(nome)")
    .order("numero", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    numero: p.numero,
    status: p.status,
    clienteId: p.cliente_id,
    veiculoId: p.veiculo_id,
    campanha: p.campanha,
    mes: p.mes,
    ano: p.ano,
    dataEmissao: p.data_emissao,
    valorBruto: Number(p.valor_bruto),
    comissao: Number(p.comissao),
    valorLiquido: Number(p.valor_liquido),
    clienteNome: p.clientes?.nome ?? "",
    veiculoNome: p.veiculos?.nome ?? "",
    prazoDias: p.prazo_dias,
    prazoBase: p.prazo_base as BasePrazo,
  }));
}

export async function proximoNumeroPi(): Promise<number> {
  const { data } = await supabase.from("pedidos_insercao").select("numero").order("numero", { ascending: false }).limit(1);
  return (data?.[0]?.numero ?? 0) + 1;
}

const itemDoBanco = (i: any): PiItem => ({
  ordem: i.ordem,
  colocacao: i.colocacao,
  tipoPeca: i.tipo_peca,
  peca: i.peca,
  formato: i.formato,
  material: i.material,
  insercoes: (i.insercoes ?? {}) as Record<string, number>,
  custoUnitario: Number(i.custo_unitario),
  fator: Number(i.fator),
  descontoPct: Number(i.desconto_pct),
});

export async function getPedidoEdicao(id: string): Promise<PedidoEdicao | null> {
  const { data: p, error } = await supabase.from("pedidos_insercao").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const { data: itens } = await supabase.from("pi_itens").select("*").eq("pedido_id", id).order("ordem");
  return {
    id: p.id,
    numero: p.numero,
    status: p.status as StatusPi,
    clienteId: p.cliente_id,
    veiculoId: p.veiculo_id,
    campanha: p.campanha,
    mes: p.mes,
    ano: p.ano,
    dataEmissao: p.data_emissao,
    projeto: p.projeto ?? "",
    plano: p.plano ?? "",
    planilha: p.planilha ?? "",
    produto: p.produto ?? "",
    comissaoPct: Number(p.comissao_pct),
    prazoDias: p.prazo_dias,
    prazoBase: p.prazo_base as BasePrazo,
    observacoes: p.observacoes ?? "",
    itens: (itens ?? []).map(itemDoBanco),
  };
}

/** Grava o PI e substitui os itens. Devolve o id. */
export async function salvarPedido(p: PedidoEdicao, userId: string | undefined): Promise<string> {
  const t = totaisPi(p.itens, p.comissaoPct);
  const linha = {
    numero: p.numero,
    status: p.status,
    cliente_id: p.clienteId,
    veiculo_id: p.veiculoId,
    campanha: p.campanha,
    mes: p.mes,
    ano: p.ano,
    data_emissao: p.dataEmissao,
    projeto: p.projeto.trim() || null,
    plano: p.plano.trim() || null,
    planilha: p.planilha.trim() || null,
    produto: p.produto.trim() || null,
    comissao_pct: p.comissaoPct,
    prazo_dias: p.prazoDias,
    prazo_base: p.prazoBase,
    observacoes: p.observacoes.trim() || null,
    valor_bruto: t.bruto,
    comissao: t.comissao,
    valor_liquido: t.liquido,
    emitido_em: p.status === "emitido" ? new Date().toISOString() : null,
  };
  let id = p.id;
  if (id) {
    const { emitido_em, ...sem } = linha;
    const { error } = await supabase.from("pedidos_insercao").update(p.status === "emitido" ? { ...sem, emitido_em } : sem).eq("id", id);
    if (error) throw error;
    const { error: e2 } = await supabase.from("pi_itens").delete().eq("pedido_id", id);
    if (e2) throw e2;
  } else {
    const { data, error } = await supabase.from("pedidos_insercao").insert({ ...linha, criado_por: userId }).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  if (p.itens.length) {
    const { error } = await supabase.from("pi_itens").insert(
      p.itens.map((i, idx) => ({
        pedido_id: id!,
        ordem: idx,
        colocacao: i.colocacao,
        tipo_peca: i.tipoPeca,
        peca: i.peca,
        formato: i.formato,
        material: i.material,
        insercoes: i.insercoes as unknown as Json,
        custo_unitario: i.custoUnitario,
        fator: i.fator,
        desconto_pct: i.descontoPct,
      })),
    );
    if (error) throw error;
  }
  return id!;
}

export async function mudarStatusPedido(id: string, status: StatusPi): Promise<void> {
  const { error } = await supabase
    .from("pedidos_insercao")
    .update({ status, ...(status === "emitido" ? { emitido_em: new Date().toISOString() } : {}) })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirPedido(id: string): Promise<void> {
  const { error } = await supabase.from("pedidos_insercao").delete().eq("id", id);
  if (error) throw error;
}

export async function getAgencia(): Promise<Agencia | null> {
  const { data, error } = await supabase.from("agencia").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    razaoSocial: data.razao_social,
    endereco: data.endereco,
    cidadeUf: data.cidade_uf,
    cep: data.cep,
    fone: data.fone ?? "",
    whatsapp: data.whatsapp ?? "",
    cnpj: data.cnpj,
    inscricaoEstadual: data.inscricao_estadual ?? "",
    inscricaoMunicipal: data.inscricao_municipal ?? "",
    emailFinanceiro: data.email_financeiro ?? "",
    emailMidia: data.email_midia ?? "",
    enderecoCorrespondencia: data.endereco_correspondencia ?? "",
    assinaturaNome: data.assinatura_nome ?? "",
    assinaturaCargo: data.assinatura_cargo ?? "",
    orientacoesGerais: data.orientacoes_gerais ?? [],
  };
}

const up = (v: string | null | undefined) => (v ?? "").toUpperCase();

/** Monta o documento do PI (para o PDF) a partir do que está na tela ou no banco. */
export async function montarDocumento(p: PedidoEdicao): Promise<PiDocumento> {
  const [agencia, { data: c }, { data: v }] = await Promise.all([
    getAgencia(),
    supabase.from("clientes").select("*").eq("id", p.clienteId).single(),
    supabase.from("veiculos").select("*").eq("id", p.veiculoId).single(),
  ]);
  if (!agencia) throw new Error("Cadastre os dados da agência antes de emitir PIs.");
  if (!c || !v) throw new Error("Cliente ou veículo não encontrado.");

  const endC = { logradouro: limparLogradouro(c.logradouro), numero: c.numero, complemento: c.complemento, bairro: c.bairro };
  const endV = { logradouro: limparLogradouro(v.logradouro), numero: v.numero, complemento: v.complemento, bairro: v.bairro, municipio: v.municipio, uf: v.uf, cep: v.cep };
  const ruaCliente = [endC.logradouro, endC.numero].filter(Boolean).join(", ") + (endC.bairro ? ` - ${endC.bairro}` : "");
  const municipioUf = [c.municipio, c.uf].filter(Boolean).join(" / ");

  return {
    numero: p.numero,
    status: p.status,
    agencia,
    cliente: {
      nome: up(c.nome),
      razaoSocial: up(c.razao_social ?? c.nome),
      cnpj: c.cnpj ?? "",
      endereco: up(ruaCliente),
      cepMunicipioUf: up([c.cep, municipioUf].filter(Boolean).join(" / ")),
      pracaPagamento: up([c.municipio, c.cep ? `CEP ${c.cep.replace("-", "")}` : null].filter(Boolean).join(" - ")),
      orientacoes: c.orientacoes_pi,
      contratos: c.contrato_info ?? [],
      textoObrigatorioNf: c.texto_obrigatorio_nf,
    },
    veiculo: {
      nome: up(v.nome),
      praca: up(v.praca ?? [v.municipio, v.uf].filter(Boolean).join(" - ")),
      razaoSocial: up(v.razao_social ?? v.nome),
      endereco: up(enderecoLinha({ ...endV, municipio: null, uf: null, cep: null }).replace(/ · /g, " ") + (v.municipio ? ` ${v.municipio} ${v.uf ?? ""} ${v.cep ?? ""}` : "")).trim(),
      cnpj: v.cnpj ?? "",
      contato: up(v.contato_nome),
      fone: v.contato_fone ?? v.telefone ?? "",
      representante: up(v.representante),
      email: (v.contato_email ?? v.email ?? "").toLowerCase(),
    },
    mes: p.mes,
    ano: p.ano,
    dataEmissao: p.dataEmissao,
    projeto: p.projeto,
    plano: p.plano,
    planilha: p.planilha,
    produto: p.produto,
    campanha: p.campanha,
    itens: p.itens,
    comissaoPct: p.comissaoPct,
    prazoDias: p.prazoDias,
    prazoBase: p.prazoBase,
  };
}
