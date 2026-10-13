// Edge Function: enviar-email
//
// E-mails do sistema para o veículo de mídia:
//  - protocolo: comprovante de recebimento (disparado pelo banco quando o envio fica completo,
//    ou por um usuário da equipe para reenviar);
//  - devolucao: pendências apontadas pela equipe, com o que o veículo precisa corrigir.
//
// Autenticação: protocolo aceita o segredo do webhook do banco (Vault) ou JWT da equipe;
// devolução exige JWT de operador ou administrador.
// Provedor: Resend. Chave e remetente vêm dos secrets RESEND_API_KEY e EMAIL_FROM ou, na falta
// deles, do Vault ("resend_api_key" e "email_from"). Sem chave, o envio é registrado como
// "nao_configurado" e a função responde 503 com um código que a tela entende.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("protocolo"), submissionId: z.string().uuid() }),
  z.object({ tipo: z.literal("devolucao"), submissionId: z.string().uuid(), motivo: z.string().trim().min(1).max(4000) }),
]);

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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

const moldura = (titulo: string, corpo: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(titulo)}</title></head>
<body style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #f6f4ef; margin: 0; padding: 24px; color: #1b1f2a;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e3ded3; border-radius: 12px; overflow: hidden;">
    <div style="padding: 28px 30px 20px; border-bottom: 1px solid #e3ded3;">
      <p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7080;">Pró3 Documentos</p>
      <h1 style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em;">${esc(titulo)}</h1>
    </div>
    <div style="padding: 28px 30px;">${corpo}</div>
  </div>
  <p style="max-width: 600px; margin: 14px auto 0; font-size: 11px; color: #8a8f9c; text-align: center;">Pró3 Comunicação · Este é um e-mail automático do sistema de documentos de faturamento.</p>
</body>
</html>`;

const linha = (k: string, v: string) =>
  `<tr><td style="padding: 5px 0; width: 120px; color: #6b7080; vertical-align: top;">${esc(k)}</td><td style="padding: 5px 0;">${esc(v)}</td></tr>`;

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

    const { data: agencia } = await supabase.from("agencia").select("email_financeiro, razao_social").maybeSingle();

    let assunto: string;
    let html: string;

    if (b.tipo === "protocolo") {
      const protocolo = protocoloDe(s.id, s.data_envio);
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
      assunto = `Protocolo ${protocolo} — PI ${s.numero_pi} (${s.cliente})`;
      html = moldura(
        "Recebemos a sua documentação",
        `<p style="font-size: 14px; line-height: 1.6; margin: 0 0 18px;">Olá, <strong>${esc(s.contato_nome)}</strong>. Os documentos do PI <strong>${esc(s.numero_pi)}</strong> chegaram à Pró3.</p>
         <p style="margin: 0 0 4px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7080;">Número de protocolo</p>
         <p style="margin: 0 0 22px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">${esc(protocolo)}</p>
         <table style="width: 100%; font-size: 13px; color: #3a3f4d; border-collapse: collapse; margin-bottom: 20px;">
           ${linha("Cliente", s.cliente)}${linha("Campanha", s.campanha)}${linha("PI nº", s.numero_pi)}${linha("Veículo", `${s.nome_veiculo}${s.cidade ? ` · ${s.cidade}` : ""}`)}${linha("Recebido em", quando)}
         </table>
         <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600;">Documentos recebidos</p>
         <ul style="margin: 0 0 22px; padding-left: 18px; font-size: 13px; color: #3a3f4d; line-height: 1.7;">${itens.map((i: string) => `<li>${esc(i)}</li>`).join("")}</ul>
         <p style="font-size: 13px; color: #4a4f5e; line-height: 1.6; margin: 0;">Guarde este e-mail como comprovante. A equipe da Pró3 confere a documentação e avisa por aqui se algo precisar de correção.</p>`,
      );
    } else {
      const pontos = b.motivo.split("\n").map((l) => l.trim()).filter(Boolean);
      const lista = pontos.every((p) => /^[•\-*]\s*/.test(p))
        ? `<ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #3a3f4d; line-height: 1.7;">${pontos.map((p) => `<li>${esc(p.replace(/^[•\-*]\s*/, ""))}</li>`).join("")}</ul>`
        : `<p style="margin: 0; font-size: 14px; color: #3a3f4d; line-height: 1.6; white-space: pre-wrap;">${esc(b.motivo)}</p>`;
      assunto = `Correção necessária — PI ${s.numero_pi} (${s.cliente})`;
      html = moldura(
        "Correção necessária no seu envio",
        `<p style="font-size: 14px; line-height: 1.6; margin: 0 0 18px;">Olá, <strong>${esc(s.contato_nome)}</strong>. Conferimos a documentação do PI <strong>${esc(s.numero_pi)}</strong> e precisamos que você corrija alguns pontos.</p>
         <table style="width: 100%; font-size: 13px; color: #3a3f4d; border-collapse: collapse; margin-bottom: 20px;">
           ${linha("Cliente", s.cliente)}${linha("Campanha", s.campanha)}${linha("Veículo", s.nome_veiculo)}
         </table>
         <div style="border-left: 3px solid #b8731a; background: #fbf5ea; padding: 14px 16px; margin: 0 0 20px;">
           <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #8a560f;">O que corrigir</p>
           ${lista}
         </div>
         <p style="font-size: 14px; color: #4a4f5e; line-height: 1.6; margin: 0;">Para reenviar, abra o formulário e use o <strong>mesmo número de PI (${esc(s.numero_pi)})</strong> e o mesmo cliente (${esc(s.cliente)}). O sistema junta os arquivos ao envio anterior.</p>`,
      );
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

    // Modo de teste: enquanto o domínio de envio não está verificado, tudo vai para um endereço de teste.
    const redirecionar = ((await supabase.rpc("obter_segredo", { p_nome: "email_redirecionar" })).data as string | null) ?? undefined;

    if (!chave) {
      await registrar("nao_configurado", "Chave do serviço de e-mail não configurada");
      return json({ success: false, code: "email_nao_configurado", error: "O serviço de e-mail ainda não está configurado." }, 503);
    }

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente ?? "Pró3 Documentos <onboarding@resend.dev>",
        to: [redirecionar ?? s.contato_email],
        subject: redirecionar ? `[TESTE para ${s.contato_email}] ${assunto}` : assunto,
        html: redirecionar
          ? html.replace(
              /(<div style="padding: 28px 30px;">)/,
              `<div style="padding: 12px 30px; background: #fff7e6; border-bottom: 1px solid #f0d9a8; font-size: 12px; color: #7a5200;">Modo de teste: este e-mail iria para <strong>${esc(s.contato_email)}</strong> e foi desviado para você.</div>$1`,
            )
          : html,
        ...(agencia?.email_financeiro ? { reply_to: agencia.email_financeiro } : {}),
      }),
    });
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      const detalhe = String(dados?.message ?? dados?.error ?? `HTTP ${resposta.status}`);
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

    await registrar("enviado", redirecionar ? `Modo de teste: entregue a ${redirecionar}` : undefined, dados?.id);
    return json({ success: true, emailId: dados?.id });
  } catch (err) {
    console.error("enviar-email:", err);
    return json({ error: "Erro interno ao enviar o e-mail" }, 500);
  }
});
