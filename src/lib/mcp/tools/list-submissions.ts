import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_submissions",
  title: "List submissions",
  description:
    "List document submissions from media vehicles. Optionally filter by status or client.",
  inputSchema: {
    status: z
      .enum(["pendente", "em_analise", "corrigido", "rejeitado", "aprovado", "faturado"])
      .optional()
      .describe("Filter by submission status."),
    cliente: z.string().optional().describe("Filter by client name."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, cliente, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = client(ctx)
      .from("submissions")
      .select("id, cliente, campanha, numero_pi, nome_veiculo, cidade, status, data_envio")
      .order("data_envio", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (cliente) q = q.eq("cliente", cliente);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { submissions: data },
    };
  },
});
