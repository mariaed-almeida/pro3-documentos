import { supabase } from "@/integrations/supabase/client";

export type RegimeDocumento = "todos" | "simples" | "nao_simples";

export interface RegraDocumento {
  docType: string;
  nome: string;
  descricao: string | null;
  modeloUrl: string | null;
  obrigatorio: boolean;
  tiposVeiculo: string[] | null;
  regime: RegimeDocumento;
  ordem: number;
}

/**
 * Regras de documentos de uma campanha (todas, sem filtro de veículo/regime).
 * Leitura permitida ao usuário anônimo para campanhas ativas.
 */
export async function getRegrasDocumentos(cliente: string, campanha: string): Promise<RegraDocumento[]> {
  const { data: camp, error: errCamp } = await supabase
    .from("campanhas")
    .select("id")
    .eq("cliente", cliente)
    .eq("nome", campanha)
    .limit(1)
    .maybeSingle();
  if (errCamp) throw errCamp;
  if (!camp) return [];

  const { data, error } = await (supabase as any)
    .from("campanha_documentos")
    .select("doc_type, obrigatorio, tipos_veiculo, regime, ordem, tipos_documento(codigo, nome, descricao, modelo_url, ordem)")
    .eq("campanha_id", (camp as { id: string }).id)
    .order("ordem", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as any[]).map((r) => {
    const cat = Array.isArray(r.tipos_documento) ? r.tipos_documento[0] : r.tipos_documento;
    return {
      docType: r.doc_type as string,
      nome: (cat?.nome as string) ?? (r.doc_type as string),
      descricao: (cat?.descricao as string | null) ?? null,
      modeloUrl: (cat?.modelo_url as string | null) ?? null,
      obrigatorio: !!r.obrigatorio,
      tiposVeiculo: (r.tipos_veiculo as string[] | null) ?? null,
      regime: ((r.regime as RegimeDocumento) ?? "todos"),
      ordem: Number(r.ordem ?? 0),
    };
  });
}

/** Aplica ao veículo escolhido: tipo de veículo e regime do Simples Nacional. */
export function filtrarRegras(regras: RegraDocumento[], tipoVeiculo: string, optanteSimples: boolean): RegraDocumento[] {
  return regras
    .filter((r) => r.tiposVeiculo === null || r.tiposVeiculo.length === 0 || r.tiposVeiculo.includes(tipoVeiculo))
    .filter((r) => r.regime === "todos" || (r.regime === "simples" ? optanteSimples : !optanteSimples))
    .sort((a, b) => a.ordem - b.ordem);
}

export async function getDocumentosDaCampanha(
  cliente: string,
  campanha: string,
  tipoVeiculo: string,
  optanteSimples: boolean,
): Promise<RegraDocumento[]> {
  return filtrarRegras(await getRegrasDocumentos(cliente, campanha), tipoVeiculo, optanteSimples);
}
