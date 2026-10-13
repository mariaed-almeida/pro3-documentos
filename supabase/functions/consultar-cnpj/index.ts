// Edge Function: consultar-cnpj
//
// Busca os dados cadastrais de um CNPJ na Receita Federal por meio de serviços públicos
// e devolve tudo num formato único. Tenta BrasilAPI, depois CNPJá (open) e por fim ReceitaWS,
// porque cada um fica fora do ar de tempos em tempos. Só a equipe com papel de administrador
// ou operador pode chamar (evita servir de proxy aberto).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  return calc(d.slice(0, 12), p1) === Number(d[12]) && calc(d.slice(0, 13), p2) === Number(d[13]);
}

const mascara = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const cepMask = (c?: string | null) => (c ? c.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : null);
const fmtTel = (v: string | null) => {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return v;
};
const limpo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const dataIso = (v: unknown) => {
  const s = limpo(v);
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const titulo = (s: string | null) =>
  s ? s.toLowerCase().replace(/(^|\s|\/|-)([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase()) : null;

interface Dados {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  dataAbertura: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
  cnaePrincipal: string | null;
  cnaesSecundarios: string[];
  capitalSocial: number | null;
  optanteSimples: boolean | null;
  endereco: { logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; municipio: string | null; uf: string | null; cep: string | null };
  telefone: string | null;
  email: string | null;
  socios: { nome: string; qualificacao: string | null }[];
  fonte: string;
}

async function pegar(url: string, ms = 9000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (r.status === 404 || r.status === 400) throw Object.assign(new Error("nao_encontrado"), { definitivo: true });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function brasilApi(d: string): Promise<Dados> {
  const j = await pegar(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
  const tel = fmtTel(limpo(j.ddd_telefone_1));
  return {
    cnpj: mascara(d),
    razaoSocial: limpo(j.razao_social),
    nomeFantasia: limpo(j.nome_fantasia),
    situacao: limpo(j.descricao_situacao_cadastral),
    dataSituacao: dataIso(j.data_situacao_cadastral),
    dataAbertura: dataIso(j.data_inicio_atividade),
    naturezaJuridica: limpo(j.natureza_juridica),
    porte: limpo(j.porte) ?? limpo(j.descricao_porte),
    cnaePrincipal: j.cnae_fiscal ? `${j.cnae_fiscal} - ${j.cnae_fiscal_descricao ?? ""}`.trim() : null,
    cnaesSecundarios: (j.cnaes_secundarios ?? []).filter((c: any) => c.codigo).map((c: any) => `${c.codigo} - ${c.descricao ?? ""}`.trim()),
    capitalSocial: typeof j.capital_social === "number" ? j.capital_social : null,
    optanteSimples: typeof j.opcao_pelo_simples === "boolean" ? j.opcao_pelo_simples : null,
    endereco: {
      logradouro: [limpo(j.descricao_tipo_de_logradouro), limpo(j.logradouro)].filter(Boolean).join(" ") || null,
      numero: limpo(j.numero),
      complemento: limpo(j.complemento),
      bairro: limpo(j.bairro),
      municipio: limpo(j.municipio),
      uf: limpo(j.uf),
      cep: cepMask(j.cep),
    },
    telefone: tel,
    email: limpo(j.email),
    socios: (j.qsa ?? []).map((s: any) => ({ nome: s.nome_socio, qualificacao: limpo(s.qualificacao_socio) })).filter((s: any) => s.nome),
    fonte: "BrasilAPI",
  };
}

async function cnpja(d: string): Promise<Dados> {
  const j = await pegar(`https://open.cnpja.com/office/${d}`);
  const a = j.address ?? {};
  const tel = j.phones?.[0] ? fmtTel(`${j.phones[0].area}${j.phones[0].number}`) : null;
  return {
    cnpj: mascara(d),
    razaoSocial: limpo(j.company?.name),
    nomeFantasia: limpo(j.alias),
    situacao: limpo(j.status?.text)?.toUpperCase() ?? null,
    dataSituacao: dataIso(j.statusDate),
    dataAbertura: dataIso(j.founded),
    naturezaJuridica: limpo(j.company?.nature?.text),
    porte: limpo(j.company?.size?.text),
    cnaePrincipal: j.mainActivity ? `${j.mainActivity.id} - ${j.mainActivity.text}` : null,
    cnaesSecundarios: (j.sideActivities ?? []).map((c: any) => `${c.id} - ${c.text}`),
    capitalSocial: typeof j.company?.equity === "number" ? j.company.equity : null,
    optanteSimples: typeof j.company?.simples?.optant === "boolean" ? j.company.simples.optant : null,
    endereco: {
      logradouro: limpo(a.street),
      numero: limpo(a.number),
      complemento: limpo(a.details),
      bairro: limpo(a.district),
      municipio: limpo(a.city),
      uf: limpo(a.state),
      cep: cepMask(a.zip),
    },
    telefone: tel,
    email: limpo(j.emails?.[0]?.address),
    socios: (j.company?.members ?? []).map((m: any) => ({ nome: m.person?.name, qualificacao: limpo(m.role?.text) })).filter((s: any) => s.nome),
    fonte: "CNPJá",
  };
}

async function receitaWs(d: string): Promise<Dados> {
  const j = await pegar(`https://receitaws.com.br/v1/cnpj/${d}`);
  if (j.status === "ERROR") throw Object.assign(new Error(j.message ?? "erro"), { definitivo: /inv[aá]lido|n[aã]o encontrado/i.test(j.message ?? "") });
  const cap = j.capital_social ? Number(j.capital_social) : null;
  const ativ = (l: any[]) => (l ?? []).filter((c) => c.code && c.code !== "00.00-0-00").map((c) => `${c.code} - ${c.text}`);
  return {
    cnpj: mascara(d),
    razaoSocial: limpo(j.nome),
    nomeFantasia: limpo(j.fantasia),
    situacao: limpo(j.situacao),
    dataSituacao: dataIso(j.data_situacao),
    dataAbertura: dataIso(j.abertura),
    naturezaJuridica: limpo(j.natureza_juridica),
    porte: limpo(j.porte),
    cnaePrincipal: ativ(j.atividade_principal)[0] ?? null,
    cnaesSecundarios: ativ(j.atividades_secundarias),
    capitalSocial: cap !== null && Number.isFinite(cap) ? cap : null,
    optanteSimples: typeof j.simples?.optante === "boolean" ? j.simples.optante : null,
    endereco: {
      logradouro: limpo(j.logradouro),
      numero: limpo(j.numero),
      complemento: limpo(j.complemento),
      bairro: limpo(j.bairro),
      municipio: limpo(j.municipio),
      uf: limpo(j.uf),
      cep: cepMask(j.cep),
    },
    telefone: limpo(j.telefone),
    email: limpo(j.email)?.toLowerCase() ?? null,
    socios: (j.qsa ?? []).map((s: any) => ({ nome: s.nome, qualificacao: limpo(s.qual) })).filter((s: any) => s.nome),
    fonte: "ReceitaWS",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado" }, 401);
  const { data: quem, error: quemError } = await admin.auth.getUser(token);
  if (quemError || !quem.user) return json({ error: "Não autorizado" }, 401);
  const { data: papeis } = await admin.from("user_roles").select("role").eq("user_id", quem.user.id).in("role", ["operador", "admin"]);
  if (!papeis || papeis.length === 0) return json({ error: "Sem permissão" }, 403);

  let cnpj = "";
  try {
    cnpj = String((await req.json()).cnpj ?? "").replace(/\D/g, "");
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }
  if (!cnpjValido(cnpj)) return json({ error: "CNPJ inválido. Confira os dígitos." }, 400);

  const tentativas = [brasilApi, cnpja, receitaWs];
  for (const buscar of tentativas) {
    try {
      const dados = await buscar(cnpj);
      if (!dados.razaoSocial) continue;
      return json({ ...dados, nomeSugerido: titulo(dados.razaoSocial) });
    } catch (e) {
      if ((e as { definitivo?: boolean }).definitivo) return json({ error: "CNPJ não encontrado na Receita Federal." }, 404);
      console.error(`consultar-cnpj ${buscar.name}:`, (e as Error).message);
    }
  }
  return json({ error: "Os serviços da Receita estão indisponíveis agora. Tente de novo em instantes ou preencha à mão." }, 503);
});
