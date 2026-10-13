import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteDb {
  id: string;
  nome: string;
  cnpj: string | null;
  contratoInfo: string[];
  observacoesNf: string[];
  enderecoPostal: string | null;
  textoObrigatorioNf: string | null;
  ativo: boolean;
}

export const CLIENTES_KEY = ["clientes"] as const;

export async function listClientes(): Promise<ClienteDb[]> {
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj,
    contratoInfo: c.contrato_info,
    observacoesNf: c.observacoes_nf,
    enderecoPostal: c.endereco_postal,
    textoObrigatorioNf: c.texto_obrigatorio_nf,
    ativo: c.ativo,
  }));
}

export function useClientes() {
  return useQuery({ queryKey: CLIENTES_KEY, queryFn: listClientes, staleTime: 60_000 });
}
