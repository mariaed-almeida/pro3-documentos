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
  name: "update_submission_status",
  title: "Update submission status",
  description: "Change the status of a document submission.",
  inputSchema: {
    id: z.string().uuid().describe("Submission id."),
    status: z
      .enum(["pendente", "em_analise", "corrigido", "rejeitado", "aprovado", "faturado"])
      .describe("New status."),
    observacoes: z.string().optional().describe("Optional notes to attach."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async ({ id, status, observacoes }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const update: Record<string, unknown> = { status };
    if (observacoes !== undefined) update.observacoes = observacoes;
    const { data, error } = await client(ctx)
      .from("submissions")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Status updated to ${status}` }],
      structuredContent: { submission: data },
    };
  },
});
