import { differenceInCalendarDays, format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(value: string | Date): string {
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateLong(value: string | Date): string {
  return format(new Date(value), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatDateTime(value: string | Date): string {
  return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function timeAgo(value: string | Date): string {
  return formatDistanceToNowStrict(new Date(value), { locale: ptBR, addSuffix: true });
}

export function daysSince(value: string | Date): number {
  return differenceInCalendarDays(new Date(), new Date(value));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
