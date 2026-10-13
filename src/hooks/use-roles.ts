import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export type AppRole = "operador" | "financeiro" | "admin";

export const ROLE_LABEL: Record<AppRole, string> = {
  operador: "Operador",
  financeiro: "Financeiro",
  admin: "Administrador",
};

export function useRoles() {
  const session = useSession();
  const userId = session?.user.id;

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const isAdmin = roles.includes("admin");
  return {
    roles,
    isLoading: isLoading || session === undefined,
    isAdmin,
    /** Aprova documentos, mede e cadastra campanhas. */
    canOperate: isAdmin || roles.includes("operador"),
    /** Libera e registra pagamentos. */
    canFinance: isAdmin || roles.includes("financeiro"),
    hasAnyRole: roles.length > 0,
  };
}
