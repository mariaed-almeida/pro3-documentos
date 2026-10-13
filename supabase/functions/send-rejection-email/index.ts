// Edge Function: send-rejection-email
//
// Avisa o veículo, por e-mail, que o envio voltou com pendência. Só usuários da equipe
// (com papel em user_roles) podem chamar. Os dados do envio vêm do banco, não do cliente,
// e o destinatário é sempre o contato registrado no envio.
//
// Segredos: RESEND_API_KEY. Opcional: EMAIL_FROM.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  submissionId: z.string().uuid(),
  motivo: z.string().trim().min(1).max(4000),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado" }, 401);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Não autorizado" }, 401);
  const { data: papeis } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", ["operador", "admin"]);
  if (!papeis || papeis.length === 0) return json({ error: "Sem permissão" }, 403);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { submissionId, motivo } = parsed.data;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY não configurada" }, 500);

    const { data: s } = await supabase
      .from("submissions")
      .select("contato_email, contato_nome, numero_pi, nome_veiculo, cliente, campanha")
      .eq("id", submissionId)
      .single();
    if (!s) return json({ error: "Envio não encontrado" }, 404);

    const to = s.contato_email;
    const numeroPi = esc(s.numero_pi);
    const cliente = esc(s.cliente);

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Correção necessária</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f6f4ef; margin: 0; padding: 24px; color: #1b1f2a;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e3ded3; border-radius: 6px; overflow: hidden;">
    <div style="padding: 28px 30px 20px; border-bottom: 1px solid #e3ded3;">
      <p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b7080;">Pró3 Documentos</p>
      <h1 style="margin: 0; font-family: Georgia, serif; font-weight: normal; font-size: 24px;">Correção necessária no seu envio</h1>
    </div>
    <div style="padding: 28px 30px;">
      <p style="font-size: 15px; margin: 0 0 16px;">Olá, <strong>${esc(s.contato_nome)}</strong>.</p>
      <p style="font-size: 14px; color: #4a4f5e; line-height: 1.6; margin: 0 0 20px;">
        Conferimos a documentação do PI abaixo e precisamos que você corrija alguns pontos.
      </p>
      <table style="width: 100%; font-size: 13px; color: #4a4f5e; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 0; width: 90px; color: #6b7080;">Cliente</td><td>${cliente}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7080;">Campanha</td><td>${esc(s.campanha)}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7080;">PI nº</td><td>${numeroPi}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7080;">Veículo</td><td>${esc(s.nome_veiculo)}</td></tr>
      </table>
      <div style="border-left: 3px solid #b8731a; background: #fbf5ea; padding: 14px 16px; margin: 0 0 20px;">
        <p style="margin: 0 0 6px; font-size: 13px; font-weight: bold; color: #8a560f;">O que corrigir</p>
        <p style="margin: 0; font-size: 14px; color: #3a3f4d; line-height: 1.6; white-space: pre-wrap;">${esc(motivo)}</p>
      </div>
      <p style="font-size: 14px; color: #4a4f5e; line-height: 1.6; margin: 0;">
        Para reenviar, abra o formulário e use o <strong>mesmo número de PI (${numeroPi})</strong> e o mesmo cliente
        (${cliente}). O sistema reconhece o reenvio e junta os arquivos ao envio anterior.
      </p>
      <p style="font-size: 13px; color: #6b7080; margin: 28px 0 0;">Pró3 Comunicação</p>
    </div>
  </div>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Troque pelo domínio próprio depois de verificá-lo no Resend, via EMAIL_FROM.
        from: Deno.env.get("EMAIL_FROM") ?? "Pro3 Comunicação <onboarding@resend.dev>",
        to: [to],
        subject: `Correção necessária — PI ${s.numero_pi} (${s.cliente})`,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error("Erro ao enviar e-mail via Resend:", resendData);
      return json({ error: "Falha ao enviar e-mail" }, 502);
    }

    return json({ success: true, emailId: resendData.id });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
