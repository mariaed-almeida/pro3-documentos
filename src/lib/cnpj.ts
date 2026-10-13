import { supabase } from "@/integrations/supabase/client";
import type { Socio } from "@/hooks/use-clientes";

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  nomeSugerido: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  dataAbertura: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
  cnaePrincipal: string | null;
  cnaesSecundarios: string[];
  capitalSocial: number | null;
  optanteSimples: boolean | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
  };
  telefone: string | null;
  email: string | null;
  socios: Socio[];
  fonte: string;
}

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Máscara progressiva 00.000.000/0000-00 para digitação. */
export function mascararCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function cnpjValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base: string, pesos: number[]) => {
    const r = base.split("").reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(d.slice(0, 12), p1) === Number(d[12]) && dv(d.slice(0, 13), [6, ...p1]) === Number(d[13]);
}

/** 8411600 -> 84.11-6/00; códigos já formatados passam direto. */
export function formatarCnae(v: string | null): string | null {
  if (!v) return null;
  return v.replace(/^(\d{2})(\d{2})(\d)(\d{2})(?=\s|$)/, "$1.$2-$3/$4").replace(/^(\d{2})\.(\d{2})-(\d)-(\d{2})/, "$1.$2-$3/$4");
}

/** Corrige repetição do tipo de logradouro que alguns cadastros trazem ("Rua Rua X"). */
export function limparLogradouro(v: string | null): string | null {
  return v ? v.replace(/^(\S+)\s+\1\b/i, "$1") : v;
}

export function enderecoLinha(e: { logradouro?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null; municipio?: string | null; uf?: string | null; cep?: string | null }): string {
  const rua = [limparLogradouro(e.logradouro ?? null), e.numero].filter(Boolean).join(", ");
  const cidade = [e.municipio, e.uf].filter(Boolean).join("/");
  return [rua, e.complemento, e.bairro, cidade, e.cep ? `CEP ${e.cep}` : null].filter(Boolean).join(" · ");
}

export async function consultarCnpj(cnpj: string): Promise<DadosCnpj> {
  const { data, error } = await supabase.functions.invoke("consultar-cnpj", { body: { cnpj } });
  if (error) {
    let msg = "Não foi possível consultar o CNPJ agora.";
    try {
      const j = await (error as { context?: Response }).context?.json();
      if (j?.error) msg = j.error;
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as DadosCnpj;
}
