import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSubmissions, getSubmissionWithDocs, updateSubmissionStatus } from "@/lib/store";
import type { StatusDocumento, Submission } from "@/lib/types";

export const SUBMISSIONS_KEY = ["submissions"] as const;

export function useSubmissions() {
  return useQuery({ queryKey: SUBMISSIONS_KEY, queryFn: getSubmissions, staleTime: 30_000 });
}

export function useSubmission(id: string | undefined) {
  return useQuery({
    queryKey: [...SUBMISSIONS_KEY, id],
    queryFn: () => getSubmissionWithDocs(id!),
    enabled: !!id,
  });
}

export function useChangeStatus() {
  const qc = useQueryClient();
  return async (id: string, status: StatusDocumento) => {
    await updateSubmissionStatus(id, status);
    await qc.invalidateQueries({ queryKey: SUBMISSIONS_KEY });
  };
}

/** Agrupa envios pelo mesmo PI + cliente: o mais recente é a versão vigente. */
export interface PiGroup {
  key: string;
  numeroPi: string;
  cliente: string;
  latest: Submission;
  history: Submission[];
}

export function groupByPi(subs: Submission[]): PiGroup[] {
  const map = new Map<string, Submission[]>();
  for (const s of subs) {
    const key = `${s.cliente}::${s.numeroPi.trim().toLowerCase()}`;
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return [...map.entries()].map(([key, items]) => {
    const sorted = items.sort((a, b) => +new Date(b.dataEnvio) - +new Date(a.dataEnvio));
    return { key, numeroPi: sorted[0].numeroPi, cliente: sorted[0].cliente, latest: sorted[0], history: sorted.slice(1) };
  });
}
