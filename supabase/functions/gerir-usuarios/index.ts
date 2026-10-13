// Edge Function: gerir-usuarios
//
// Administração de contas da equipe. Só administradores podem chamar.
// Ações: criar (conta + papéis), definir_ativo (desativa/reativa) e redefinir_senha.
// Papéis são concedidos e removidos direto na tabela user_roles, pelo painel (RLS de admin).

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Papel = z.enum(["operador", "financeiro", "admin"]);
const Senha = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72);

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("criar"),
    email: z.string().email(),
    nome: z.string().trim().min(2).max(120),
    senha: Senha,
    papeis: z.array(Papel).min(1),
  }),
  z.object({ action: z.literal("definir_ativo"), userId: z.string().uuid(), ativo: z.boolean() }),
  z.object({ action: z.literal("redefinir_senha"), userId: z.string().uuid(), senha: Senha }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autorizado" }, 401);
  const { data: quem, error: quemError } = await admin.auth.getUser(token);
  if (quemError || !quem.user) return json({ error: "Não autorizado" }, 401);
  const { data: papeisAtor } = await admin.from("user_roles").select("role").eq("user_id", quem.user.id).eq("role", "admin");
  if (!papeisAtor || papeisAtor.length === 0) return json({ error: "Só administradores gerenciam usuários" }, 403);

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Dados inválidos";
      return json({ error: msg }, 400);
    }
    const b = parsed.data;

    if (b.action === "criar") {
      const { data, error } = await admin.auth.admin.createUser({
        email: b.email,
        password: b.senha,
        email_confirm: true,
        user_metadata: { nome: b.nome },
      });
      if (error || !data.user) {
        const duplicado = /already|registered|exists/i.test(error?.message ?? "");
        return json({ error: duplicado ? "Já existe uma conta com esse e-mail" : "Não foi possível criar a conta" }, duplicado ? 409 : 400);
      }
      await admin.from("profiles").update({ nome: b.nome }).eq("id", data.user.id);
      const { error: roleError } = await admin
        .from("user_roles")
        .insert(b.papeis.map((role) => ({ user_id: data.user.id, role })));
      if (roleError) return json({ error: "Conta criada, mas os papéis não foram salvos" }, 500);
      return json({ success: true, userId: data.user.id });
    }

    if (b.action === "definir_ativo") {
      if (b.userId === quem.user.id) return json({ error: "Você não pode desativar a própria conta" }, 400);
      await admin.from("profiles").update({ ativo: b.ativo }).eq("id", b.userId);
      if (!b.ativo) await admin.from("user_roles").delete().eq("user_id", b.userId);
      const { error } = await admin.auth.admin.updateUserById(b.userId, { ban_duration: b.ativo ? "none" : "876000h" });
      if (error) return json({ error: "Não foi possível atualizar a conta" }, 400);
      return json({ success: true });
    }

    const { error } = await admin.auth.admin.updateUserById(b.userId, { password: b.senha });
    if (error) return json({ error: "Não foi possível redefinir a senha" }, 400);
    return json({ success: true });
  } catch (err) {
    console.error("gerir-usuarios:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
