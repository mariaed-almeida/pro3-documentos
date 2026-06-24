const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const BodySchema = z.object({
  to: z.string().email(),
  nomeContato: z.string().min(1),
  numeroPi: z.string().min(1),
  nomeVeiculo: z.string().min(1),
  cliente: z.string().min(1),
  campanha: z.string().min(1),
  motivo: z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, nomeContato, numeroPi, nomeVeiculo, cliente, campanha, motivo } = parsed.data;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Texto explicando como corrigir: reenviar o formulário usando o MESMO número de PI
    // e o mesmo cliente — o sistema reconhece automaticamente que é uma correção e
    // agrupa os dois envios no painel do operador.
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Correção Necessária</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; color: #333333;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #1d4ed8; color: white; padding: 24px 30px;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 600;">⚠️ Correção Necessária</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Sistema de Documentação — Pro3 Comunicação</p>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 15px; color: #333; margin: 0 0 16px;">Olá, <strong>${nomeContato}</strong>,</p>
      <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px;">
        A documentação enviada referente ao PI abaixo foi analisada e necessita de correções:
      </p>
      <div style="background: #f0f4ff; border-left: 4px solid #1d4ed8; padding: 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px; font-size: 13px; color: #666;"><strong>Cliente:</strong> ${cliente}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #666;"><strong>Campanha:</strong> ${campanha}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #666;"><strong>PI Nº:</strong> ${numeroPi}</p>
        <p style="margin: 0; font-size: 13px; color: #666;"><strong>Veículo:</strong> ${nomeVeiculo}</p>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #dc2626;">Correções solicitadas:</p>
        <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.6; white-space: pre-wrap;">${motivo}</p>
      </div>
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #0369a1;">Como corrigir:</p>
        <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.6;">
          Acesse o sistema e preencha o formulário novamente, usando o mesmo número de PI (${numeroPi})
          e o mesmo cliente (${cliente}). O sistema reconhece automaticamente que se trata de uma correção
          e organiza os envios juntos para nossa equipe.
        </p>
      </div>
      <p style="font-size: 13px; color: #888; margin-top: 30px;">
        Atenciosamente,<br><strong>Pro3 Comunicação</strong>
      </p>
    </div>
  </div>
</body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Enquanto o domínio próprio (@agenciapro3.com.br) não estiver verificado no Resend,
        // usamos o domínio de teste do Resend como remetente. Depois de verificar o domínio
        // oficial, troque a linha abaixo para algo como "Pro3 Comunicação <documentacao@agenciapro3.com.br>".
        from: "Pro3 Comunicação <onboarding@resend.dev>",
        to: [to],
        subject: `Correção necessária — PI ${numeroPi} (${cliente})`,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Erro ao enviar e-mail via Resend:", resendData);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar e-mail", details: resendData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`E-mail de correção enviado com sucesso para ${to}:`, { numeroPi, resendId: resendData.id });

    return new Response(
      JSON.stringify({
        success: true,
        message: "E-mail de correção enviado",
        emailId: resendData.id,
        to,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
