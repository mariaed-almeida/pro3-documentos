import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StatusMedicao = Database["public"]["Enums"]["status_medicao"];

export interface Medicao {
  id: string;
  submissionId: string;
  valorBruto: number;
  comissao: number;
  valorLiquido: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  numeroNf: string | null;
  observacoes: string | null;
  status: StatusMedicao;
  enviadoEm: string | null;
  liberadoEm: string | null;
  previsaoPagamento: string | null;
  pagoEm: string | null;
  createdAt: string;
  cliente: string;
  campanha: string;
  numeroPi: string;
  nomeVeiculo: string;
  cidade: string;
}

export const STATUS_MEDICAO_ORDER: StatusMedicao[] = ["em_medicao", "aguardando_liberacao", "liberado", "pago", "cancelado"];

export const STATUS_MEDICAO: Record<StatusMedicao, { label: string; hint: string; badge: string; chart: string }> = {
  em_medicao: {
    label: "Em medição",
    hint: "Valores em conferência",
    badge: "bg-muted text-foreground border-border",
    chart: "hsl(var(--chart-5))",
  },
  aguardando_liberacao: {
    label: "Aguardando liberação",
    hint: "Com o financeiro",
    badge: "bg-warning/10 text-warning border-warning/25",
    chart: "hsl(var(--chart-2))",
  },
  liberado: {
    label: "Liberado",
    hint: "Pagamento autorizado",
    badge: "bg-primary/[0.07] text-primary border-primary/20",
    chart: "hsl(var(--chart-1))",
  },
  pago: {
    label: "Pago",
    hint: "Pagamento registrado",
    badge: "bg-success/10 text-success border-success/25",
    chart: "hsl(var(--chart-3))",
  },
  cancelado: {
    label: "Cancelado",
    hint: "Medição cancelada",
    badge: "bg-muted text-muted-foreground border-border",
    chart: "hsl(var(--chart-4))",
  },
};

export interface MedicaoEvento {
  id: string;
  tipo: string;
  deStatus: StatusMedicao | null;
  paraStatus: StatusMedicao | null;
  detalhe: string | null;
  createdAt: string;
  atorNome: string | null;
}

const SELECT =
  "id, submission_id, valor_bruto, comissao_agencia, valor_liquido, periodo_inicio, periodo_fim, numero_nf, observacoes, status, enviado_em, liberado_em, previsao_pagamento, pago_em, created_at, submissions(cliente, campanha, numero_pi, nome_veiculo, cidade)";

export async function listMedicoes(): Promise<Medicao[]> {
  const { data, error } = await supabase.from("medicoes").select(SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    id: m.id,
    submissionId: m.submission_id,
    valorBruto: Number(m.valor_bruto),
    comissao: Number(m.comissao_agencia),
    valorLiquido: Number(m.valor_liquido),
    periodoInicio: m.periodo_inicio,
    periodoFim: m.periodo_fim,
    numeroNf: m.numero_nf,
    observacoes: m.observacoes,
    status: m.status,
    enviadoEm: m.enviado_em,
    liberadoEm: m.liberado_em,
    previsaoPagamento: m.previsao_pagamento,
    pagoEm: m.pago_em,
    createdAt: m.created_at,
    cliente: m.submissions?.cliente ?? "",
    campanha: m.submissions?.campanha ?? "",
    numeroPi: m.submissions?.numero_pi ?? "",
    nomeVeiculo: m.submissions?.nome_veiculo ?? "",
    cidade: m.submissions?.cidade ?? "",
  }));
}

export async function listEventos(medicaoId: string): Promise<MedicaoEvento[]> {
  const { data, error } = await supabase
    .from("medicao_eventos")
    .select("id, tipo, de_status, para_status, detalhe, created_at, ator_id")
    .eq("medicao_id", medicaoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((e) => e.ator_id).filter(Boolean))] as string[];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await supabase.from("profiles").select("id, nome, email").in("id", ids);
    for (const p of perfis ?? []) nomes.set(p.id, p.nome || p.email || "");
  }
  return (data ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    deStatus: e.de_status,
    paraStatus: e.para_status,
    detalhe: e.detalhe,
    createdAt: e.created_at,
    atorNome: e.ator_id ? (nomes.get(e.ator_id) ?? null) : null,
  }));
}

export interface DadosMedicao {
  valorBruto: number;
  comissao: number;
  periodoInicio?: string;
  periodoFim?: string;
  numeroNf?: string;
  observacoes?: string;
}

export async function criarMedicao(submissionId: string, m: DadosMedicao): Promise<string> {
  const { data, error } = await supabase.rpc("criar_medicao", {
    p_submission: submissionId,
    p_valor_bruto: m.valorBruto,
    p_comissao: m.comissao,
    p_inicio: m.periodoInicio || undefined,
    p_fim: m.periodoFim || undefined,
    p_nf: m.numeroNf || undefined,
    p_obs: m.observacoes || undefined,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function atualizarMedicao(id: string, m: DadosMedicao): Promise<void> {
  const { error } = await supabase
    .from("medicoes")
    .update({
      valor_bruto: m.valorBruto,
      comissao_agencia: m.comissao,
      periodo_inicio: m.periodoInicio || null,
      periodo_fim: m.periodoFim || null,
      numero_nf: m.numeroNf || null,
      observacoes: m.observacoes || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function mudarStatusMedicao(id: string, para: StatusMedicao, data?: string, detalhe?: string): Promise<void> {
  const { error } = await supabase.rpc("mudar_status_medicao", {
    p_id: id,
    p_para: para,
    p_data: data || undefined,
    p_detalhe: detalhe || undefined,
  });
  if (error) throw new Error(error.message);
}
