import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSubmissions from "./tools/list-submissions";
import getSubmission from "./tools/get-submission";
import updateSubmissionStatus from "./tools/update-submission-status";
import listCampaigns from "./tools/list-campaigns";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pro3-documentos-mcp",
  title: "Pró3 Documentos",
  version: "0.1.0",
  instructions:
    "Tools for the Pró3 Comunicação document reception system. Use `list_submissions` to browse document submissions from media vehicles, `get_submission` to inspect a specific one (including its documents and AI analysis), `update_submission_status` to change status, and `list_campaigns` to see registered campaigns.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSubmissions, getSubmission, updateSubmissionStatus, listCampaigns],
});
