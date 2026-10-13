import { useQuery } from "@tanstack/react-query";
import { listCertidoes } from "@/lib/certidoes";

export const CERTIDOES_KEY = ["certidoes"] as const;

export function useCertidoes() {
  return useQuery({ queryKey: CERTIDOES_KEY, queryFn: listCertidoes, staleTime: 30_000 });
}
