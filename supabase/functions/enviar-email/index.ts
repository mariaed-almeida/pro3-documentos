// Edge Function: enviar-email
//
// E-mails do sistema para o veículo de mídia:
//  - protocolo: comprovante de recebimento (disparado pelo banco quando o envio fica completo,
//    ou por um usuário da equipe para reenviar);
//  - devolucao: pendências apontadas pela equipe, com o que o veículo precisa corrigir.
// Os textos ficam em templates.ts.
//
// Autenticação: protocolo aceita o segredo do webhook do banco (Vault) ou JWT da equipe;
// devolução exige JWT de operador ou administrador.
// Provedor: Resend. Chave e remetente vêm dos secrets RESEND_API_KEY e EMAIL_FROM ou, na falta
// deles, do Vault ("resend_api_key" e "email_from"). Sem chave, o envio é registrado como
// "nao_configurado" e a função responde 503 com um código que a tela entende.
// Modo de teste: se existir o segredo "email_redirecionar" no Vault, todos os e-mails vão para esse
// endereço (com aviso no topo) em vez de ir ao veículo. Apague o segredo para enviar de verdade.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { esc, montarDevolucao, montarProtocolo, normalizar } from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LOGO_URL = Deno.env.get("EMAIL_LOGO_URL") ?? "https://pro3-documentos.vercel.app/email/logo-pro3.png";

const Body = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("protocolo"), submissionId: z.string().uuid() }),
  z.object({ tipo: z.literal("devolucao"), submissionId: z.string().uuid(), motivo: z.string().trim().min(1).max(4000) }),
]);

const ROTULOS: Record<string, string> = {
  piAssinado: "PI assinado",
  notaFiscal: "Nota Fiscal",
  notaFiscalGrafica: "Nota Fiscal da gráfica",
  fotoMidiaExterna: "Foto do ponto de exibição",
  declaracaoSimplesNacional: "Declaração de optante pelo Simples Nacional",
  comprovantesExibicao: "Comprovantes de exibição",
  declaracaoArtigo299: "Declaração do Artigo 299",
  tabelaPrecoAssinada: "Tabela de preço assinada",
};
const rotulo = (tipo: string, label: string) => (/^certid/.test(tipo) ? "Certidões negativas" : (ROTULOS[tipo] ?? label.replace(/\s*\(\d+\)$/, "")));

function protocoloDe(id: string, dataEnvio: string): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(dataEnvio))
    .replace(/-/g, "");
  return `${dia}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // --- Autenticação ---------------------------------------------------------
  let viaWebhook = false;
  const segredo = req.headers.get("x-webhook-secret");
  if (segredo) {
    const { data: valido } = await supabase.rpc("verificar_webhook", { p_secret: segredo });
    viaWebhook = valido === true;
  }
  if (!viaWebhook) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autorizado" }, 401);
    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !u.user) return json({ error: "Não autorizado" }, 401);
    const { data: papeis } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .in("role", ["operador", "admin"]);
    if (!papeis || papeis.length === 0) return json({ error: "Sem permissão" }, 403);
  }

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, 400);
    const b = parsed.data;
    if (viaWebhook && b.tipo !== "protocolo") return json({ error: "Sem permissão" }, 403);

    const { data: s } = await supabase
      .from("submissions")
      .select("id, numero_pi, cliente, campanha, nome_veiculo, cidade, contato_nome, contato_email, data_envio")
      .eq("id", b.submissionId)
      .single();
    if (!s) return json({ error: "Envio não encontrado" }, 404);

    const { data: agencia } = await supabase
      .from("agencia")
      .select("razao_social, cnpj, endereco, cidade_uf, cep, fone, whatsapp, email_midia, email_financeiro, assinatura_nome, assinatura_cargo")
      .maybeSingle();

    const dados = {
      contatoNome: s.contato_nome,
      numeroPi: s.numero_pi,
      cliente: s.cliente,
      campanha: s.campanha,
      veiculo: s.nome_veiculo,
      cidade: s.cidade,
    };

    let assunto: string;
    let html: string;
    let text: string;

    if (b.tipo === "protocolo") {
      const { data: docs } = await supabase
        .from("documents")
        .select("doc_type, doc_label, created_at")
        .eq("submission_id", s.id)
        .order("created_at");
      const vistos = new Set<string>();
      const itens = (docs ?? [])
        .map((d: any) => rotulo(d.doc_type, d.doc_label))
        .filter((r: string) => (vistos.has(r) ? false : (vistos.add(r), true)));
      const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(s.data_envio));
      ({ assunto, html, text } = montarProtocolo(dados, protocoloDe(s.id, s.data_envio), quando.replace(",", " as"), itens, agencia, LOGO_URL));
    } else {
      ({ assunto, html, text } = montarDevolucao(dados, b.motivo, agencia, LOGO_URL));
    }

    const registrar = (status: "enviado" | "falhou" | "nao_configurado", erro?: string, providerId?: string) =>
      supabase.from("emails_enviados").insert({
        submission_id: s.id,
        tipo: b.tipo,
        para: s.contato_email,
        assunto,
        status,
        erro: erro ?? null,
        provider_id: providerId ?? null,
      });

    // --- Provedor ------------------------------------------------------------
    let chave = Deno.env.get("RESEND_API_KEY");
    let remetente = Deno.env.get("EMAIL_FROM");
    if (!chave) chave = ((await supabase.rpc("obter_segredo", { p_nome: "resend_api_key" })).data as string | null) ?? undefined;
    if (!remetente) remetente = ((await supabase.rpc("obter_segredo", { p_nome: "email_from" })).data as string | null) ?? undefined;
    const redirecionar = ((await supabase.rpc("obter_segredo", { p_nome: "email_redirecionar" })).data as string | null) ?? undefined;

    if (!chave) {
      await registrar("nao_configurado", "Chave do serviço de e-mail não configurada");
      return json({ success: false, code: "email_nao_configurado", error: "O serviço de e-mail ainda não está configurado." }, 503);
    }

    if (redirecionar) {
      const aviso = `Modo de teste: este e-mail iria para ${s.contato_email} e foi desviado para você.`;
      html = html.replace(
        /(<body[^>]*>)/,
        `$1<div style="padding: 10px 16px; background: #fff7e6; border-bottom: 1px solid #f0d9a8; font: 12px Arial, sans-serif; color: #7a5200; text-align: center;">${esc(normalizar(aviso))}</div>`,
      );
      text = `[${aviso}]\n\n${text}`;
    }

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente ?? "Pró3 Comunicação <onboarding@resend.dev>",
        to: [redirecionar ?? s.contato_email],
        subject: redirecionar ? `[TESTE para ${s.contato_email}] ${assunto}` : assunto,
        html,
        text,
        ...(agencia?.email_midia || agencia?.email_financeiro ? { reply_to: agencia?.email_midia ?? agencia?.email_financeiro } : {}),
      }),
    });
    const resultado = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      const detalhe = String(resultado?.message ?? resultado?.error ?? `HTTP ${resposta.status}`);
      console.error("Resend:", resposta.status, detalhe);
      await registrar("falhou", detalhe);
      const dominio = /domain|verify|testing emails|own email/i.test(detalhe);
      return json(
        {
          success: false,
          code: dominio ? "email_dominio" : "email_falhou",
          error: dominio
            ? "O serviço de e-mail só envia para endereços liberados. Verifique o domínio da Pró3 no provedor."
            : "O provedor recusou o envio do e-mail.",
        },
        502,
      );
    }

    await registrar("enviado", redirecionar ? `Modo de teste: entregue a ${redirecionar}` : undefined, resultado?.id);
    return json({ success: true, emailId: resultado?.id });
  } catch (err) {
    console.error("enviar-email:", err);
    return json({ error: "Erro interno ao enviar o e-mail" }, 500);
  }
});
