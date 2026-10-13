import { useQuery } from "@tanstack/react-query";
import { listEventos, listMedicoes } from "@/lib/medicoes";

export const MEDICOES_KEY = ["medicoes"] as const;

export function useMedicoes() {
  return useQuery({ queryKey: MEDICOES_KEY, queryFn: listMedicoes, staleTime: 30_000 });
}

export function useMedicaoEventos(id: string | null) {
  return useQuery({ queryKey: [...MEDICOES_KEY, "eventos", id], queryFn: () => listEventos(id!), enabled: !!id });
}
