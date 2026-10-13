const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

export function formatBRL(value: number | null | undefined): string {
  return brl.format(value ?? 0);
}

export function formatBRLCompact(value: number | null | undefined): string {
  return brlCompact.format(value ?? 0);
}

/** Converte "1.234,56" ou "1234.56" em número; vazio vira 0. */
export function parseBRL(input: string): number {
  const clean = input.trim().replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
