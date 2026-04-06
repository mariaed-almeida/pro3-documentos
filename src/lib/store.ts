import { supabase } from "@/integrations/supabase/client";
import { Submission, StatusDocumento, formatFileName, DOC_TYPE_LABELS } from "./types";

// ===== SUBMISSIONS =====

export async function getSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("data_envio", { ascending: false });

  if (error) {
    console.error("Error fetching submissions:", error);
    return [];
  }

  return (data || []).map((sub) => mapDbToSubmission(sub));
}

export async function getSubmissionWithDocs(id: string): Promise<Submission | null> {
  const { data: sub, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !sub) return null;

  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .eq("submission_id", id);

  return mapDbToSubmission(sub, docs || []);
}

export async function addSubmission(
  submission: Omit<Submission, "id" | "dataEnvio" | "status" | "documentos">,
  files: Record<string, File>
): Promise<Submission | null> {
  // Insert submission
  const { data: sub, error } = await supabase
    .from("submissions")
    .insert({
      cliente: submission.cliente,
      campanha: submission.campanha,
      numero_pi: submission.numeroPi,
      tipo_veiculo: submission.tipoVeiculo,
      outro_tipo: submission.outroTipo || null,
      nome_veiculo: submission.nomeVeiculo,
      cidade: submission.cidade,
      contato_nome: submission.contatoNome,
      contato_email: submission.contatoEmail,
      contato_telefone: submission.contatoTelefone,
      observacoes: submission.observacoes || null,
      status: "pendente",
    })
    .select()
    .single();

  if (error || !sub) {
    console.error("Error creating submission:", error);
    return null;
  }

  // Upload files and create document records
  const docRecords: Array<{ doc_type: string; doc_label: string; file_name: string; storage_path: string }> = [];

  for (const [rawKey, file] of Object.entries(files)) {
    if (!file) continue;

    // Handle multi-file keys like "notaFiscal__2" → base key "notaFiscal", index 2
    const [baseKey, indexStr] = rawKey.split("__");
    const fileIndex = indexStr ? parseInt(indexStr) : null;

    const ext = file.name.substring(file.name.lastIndexOf("."));
    const baseLabel = DOC_TYPE_LABELS[baseKey] || baseKey;
    const labelWithIndex = fileIndex ? `${baseLabel} (${fileIndex})` : baseLabel;

    const standardizedName = formatFileName(
      submission.numeroPi,
      submission.nomeVeiculo,
      submission.cidade,
      baseKey,
      ext
    ).replace(ext, fileIndex ? ` (${fileIndex})${ext}` : ext);

    const storagePath = `${sub.cliente}/${sub.campanha}/${sub.numero_pi}/${standardizedName}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      console.error(`Error uploading ${rawKey}:`, uploadError);
      continue;
    }

    docRecords.push({
      doc_type: baseKey,
      doc_label: labelWithIndex,
      file_name: standardizedName,
      storage_path: storagePath,
    });
  }

  if (docRecords.length > 0) {
    await supabase.from("documents").insert(
      docRecords.map((d) => ({ ...d, submission_id: sub.id }))
    );
  }

  return getSubmissionWithDocs(sub.id);
}

export async function updateSubmissionStatus(id: string, status: StatusDocumento): Promise<void> {
  const { error } = await supabase
    .from("submissions")
    .update({ status })
    .eq("id", id);

  if (error) console.error("Error updating status:", error);
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(storagePath, 3600); // 1 hour
  if (error || !data?.signedUrl) {
    console.error("Error creating signed URL:", error);
    return "";
  }
  return data.signedUrl;
}

// ===== MAPPERS =====

interface DbSubmission {
  id: string;
  cliente: string;
  campanha: string;
  numero_pi: string;
  tipo_veiculo: string;
  outro_tipo: string | null;
  nome_veiculo: string;
  cidade: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  status: string;
  observacoes: string | null;
  data_envio: string;
}

interface DbDocument {
  id: string;
  submission_id: string;
  doc_type: string;
  doc_label: string;
  file_name: string;
  storage_path: string;
}

function mapDbToSubmission(sub: DbSubmission, docs: DbDocument[] = []): Submission {
  const documentos: Submission["documentos"] = {};
  const certidoes: string[] = [];

  for (const doc of docs) {
    if (doc.doc_type.startsWith("certidao")) {
      certidoes.push(doc.file_name);
    } else if (doc.doc_type === "piAssinado") {
      documentos.piAssinado = doc.file_name;
    } else if (doc.doc_type === "notaFiscal") {
      (documentos as any).notaFiscal = doc.file_name;
    } else if (doc.doc_type === "declaracaoSimplesNacional") {
      documentos.declaracaoSimplesNacional = doc.file_name;
    } else if (doc.doc_type === "comprovantesExibicao") {
      documentos.comprovantesExibicao = doc.file_name;
    } else if (doc.doc_type === "declaracaoArtigo299") {
      documentos.declaracaoArtigo299 = doc.file_name;
    } else if (doc.doc_type === "tabelaPrecoAssinada") {
      documentos.tabelaPrecoAssinada = doc.file_name;
    }
  }

  if (certidoes.length > 0) documentos.certidoesNegativas = certidoes;

  return {
    id: sub.id,
    cliente: sub.cliente as any,
    campanha: sub.campanha,
    numeroPi: sub.numero_pi,
    tipoVeiculo: sub.tipo_veiculo as any,
    outroTipo: sub.outro_tipo || undefined,
    nomeVeiculo: sub.nome_veiculo,
    cidade: sub.cidade,
    contatoNome: sub.contato_nome,
    contatoEmail: sub.contato_email,
    contatoTelefone: sub.contato_telefone,
    documentos,
    status: sub.status as StatusDocumento,
    dataEnvio: sub.data_envio,
    observacoes: sub.observacoes || undefined,
  };
}
