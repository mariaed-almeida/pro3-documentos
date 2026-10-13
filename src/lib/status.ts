import { CheckCircle2, Clock, AlertCircle, Ban, type LucideIcon } from "lucide-react";
import type { StatusDocumento } from "./types";

export interface StatusMeta {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Classes do selo: fundo suave, texto escuro e borda do mesmo matiz. */
  badge: string;
  /** Cor sólida usada em barras e marcadores. */
  dot: string;
  /** Variável CSS de gráfico equivalente. */
  chart: string;
}

export const STATUS_ORDER: StatusDocumento[] = ["recebido", "em_revisao", "aprovado", "cancelado"];

export const STATUS: Record<StatusDocumento, StatusMeta> = {
  recebido: {
    label: "Recebido",
    hint: "Aguardando conferência",
    icon: Clock,
    badge: "bg-primary/[0.07] text-primary border-primary/20",
    dot: "bg-primary",
    chart: "hsl(var(--chart-1))",
  },
  em_revisao: {
    label: "Em revisão",
    hint: "Pendência apontada ao veículo",
    icon: AlertCircle,
    badge: "bg-warning/10 text-warning border-warning/25",
    dot: "bg-warning",
    chart: "hsl(var(--chart-2))",
  },
  aprovado: {
    label: "Aprovado",
    hint: "Liberado para o financeiro",
    icon: CheckCircle2,
    badge: "bg-success/10 text-success border-success/25",
    dot: "bg-success",
    chart: "hsl(var(--chart-3))",
  },
  cancelado: {
    label: "Cancelado",
    hint: "PI cancelado",
    icon: Ban,
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    chart: "hsl(var(--chart-5))",
  },
};

export function statusOf(value: string): StatusMeta {
  return STATUS[value as StatusDocumento] ?? STATUS.recebido;
}
