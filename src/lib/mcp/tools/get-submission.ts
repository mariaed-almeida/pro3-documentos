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
  name: "get_submission",
  title: "Get submission",
  description: "Fetch full details of a submission (including documents and AI analysis).",
  inputSchema: {
    id: z.string().uuid().describe("Submission id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = client(ctx);
    const { data: sub, error } = await sb.from("submissions").select("*").eq("id", id).single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const { data: docs } = await sb.from("documents").select("*").eq("submission_id", id);
    const result = { ...sub, documents: docs ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
