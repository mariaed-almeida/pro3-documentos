import { supabase } from "@/integrations/supabase/client";

export interface Campaign {
  id: string;
  cliente: string;
  nome: string;
  ativa: boolean;
  created_at: string;
}

export async function getCampaigns(cliente?: string): Promise<Campaign[]> {
  let query = supabase.from("campanhas").select("*").order("nome");
  if (cliente) query = query.eq("cliente", cliente);
  const { data, error } = await query;
  if (error) { console.error("Error fetching campaigns:", error); return []; }
  return (data || []) as Campaign[];
}

export async function getActiveCampaigns(cliente: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("nome")
    .eq("cliente", cliente)
    .eq("ativa", true)
    .order("nome");
  if (error) { console.error("Error fetching campaigns:", error); return []; }
  return (data || []).map((c: any) => c.nome);
}

export async function addCampaign(cliente: string, nome: string): Promise<boolean> {
  const { error } = await supabase.from("campanhas").insert({ cliente, nome });
  if (error) { console.error("Error adding campaign:", error); return false; }
  return true;
}

export async function toggleCampaign(id: string, ativa: boolean): Promise<boolean> {
  const { error } = await supabase.from("campanhas").update({ ativa }).eq("id", id);
  if (error) { console.error("Error toggling campaign:", error); return false; }
  return true;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const { error } = await supabase.from("campanhas").delete().eq("id", id);
  if (error) { console.error("Error deleting campaign:", error); return false; }
  return true;
}
