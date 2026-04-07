import { useState, useEffect } from "react";
import { ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle, Eye, User, Mail, Phone, ExternalLink, MapPin, Download, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Submission, StatusDocumento } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }> = {
  pendente: { label: "Pendente", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  em_analise: { label: "Em Análise", icon: Eye, className: "bg-primary/10 text-primary border-primary/20" },
  corrigido: { label: "Corrigido", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  rejeitado: { label: "Rejeitado", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface DbDocument {
  id: string;
  doc_type: string;
  doc_label: string;
  file_name: string;
  storage_path: string;
  signed_url?: string;
}

interface Props {
  submission: Submission;
  onBack: () => void;
  onStatusUpdate: (id: string, status: StatusDocumento) => void;
}

const SubmissionDetail = ({ submission, onBack, onStatusUpdate }: Props) => {
  const cfg = statusConfig[submission.status];
  const StatusIcon = cfg.icon;
  const [documents, setDocuments] = useState<DbDocument[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DbDocument | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("submission_id", submission.id);
      if (data) {
        const docsWithUrls = await Promise.all(
          data.map(async (doc) => {
            const { data: urlData } = await supabase.storage
              .from("documentos")
              .createSignedUrl(doc.storage_path, 3600);
            return { ...doc, signed_url: urlData?.signedUrl || "" };
          })
        );
        setDocuments(docsWithUrls);
      }
    };
    load();
  }, [submission.id]);

  const allStatuses: StatusDocumento[] = ["pendente", "em_analise", "corrigido", "rejeitado"];

  const getFileExtension = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext;
  };

  const isImage = (name: string) => ["jpg", "jpeg", "png", "webp", "gif"].includes(getFileExtension(name));
  const isPdf = (name: string) => getFileExtension(name) === "pdf";
  const isPreviewable = (name: string) => isImage(name) || isPdf(name);

  const handleDownloadAll = async () => {
    if (documents.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folderName = `PI ${submission.numeroPi} - ${submission.nomeVeiculo}`;
      const folder = zip.folder(folderName)!;

      await Promise.all(
        documents.map(async (doc) => {
          if (!doc.signed_url) return;
          try {
            const response = await fetch(doc.signed_url);
            const blob = await response.blob();
            folder.file(doc.file_name, blob);
          } catch (err) {
            console.error(`Failed to fetch ${doc.file_name}:`, err);
          }
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error("Error creating zip:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">PI {submission.numeroPi}</h1>
            <p className="text-sm text-muted-foreground">{submission.nomeVeiculo}</p>
          </div>
          <Badge variant="outline" className={`${cfg.className}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{submission.cliente}</span><span>/</span>
          <span>{submission.campanha}</span><span>/</span>
          <span className="text-foreground font-medium">PI {submission.numeroPi}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-lg border p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Informações do PI</h3>
            <InfoRow label="Cliente" value={submission.cliente} />
            <InfoRow label="Campanha" value={submission.campanha} />
            <InfoRow label="Nº do PI" value={submission.numeroPi} />
            <InfoRow label="Veículo" value={submission.nomeVeiculo} />
            <InfoRow label="Cidade" value={submission.cidade || "—"} />
            <InfoRow label="Tipo" value={submission.tipoVeiculo === "Outro" ? submission.outroTipo || "Outro" : submission.tipoVeiculo} />
            <InfoRow label="Enviado em" value={new Date(submission.dataEnvio).toLocaleString("pt-BR")} />
          </div>

          <div className="bg-card rounded-lg border p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Contato do Veículo</h3>
            <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" /><span className="text-foreground">{submission.contatoNome}</span></div>
            <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-foreground">{submission.contatoEmail}</span></div>
            <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-foreground">{submission.contatoTelefone}</span></div>
            {submission.cidade && (
              <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-foreground">{submission.cidade}</span></div>
            )}
            {submission.observacoes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Observações:</p>
                <p className="text-sm text-foreground">{submission.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Documentos Anexados ({documents.length})</h3>
            {documents.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleDownloadAll} disabled={downloading}>
                {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                {downloading ? "Gerando ZIP..." : "Baixar Todos (.zip)"}
              </Button>
            )}
          </div>
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => {
                const previewable = isPreviewable(doc.file_name);
                const docIsImage = isImage(doc.file_name);
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    {docIsImage ? (
                      <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{doc.doc_label}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {previewable && doc.signed_url && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary gap-1"
                          onClick={() => setPreviewDoc(doc)}>
                          <Eye className="h-3 w-3" /> Visualizar
                        </Button>
                      )}
                      <a href={doc.signed_url || "#"} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary gap-1" disabled={!doc.signed_url}>
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento encontrado.</p>
          )}
        </div>

        {/* Status Actions */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Alterar Status</h3>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((st) => {
              const c = statusConfig[st];
              const Icon = c.icon;
              const isActive = submission.status === st;
              return (
                <Button key={st} variant={isActive ? "default" : "outline"} size="sm"
                  onClick={() => onStatusUpdate(submission.id, st)} disabled={isActive}>
                  <Icon className="h-3 w-3 mr-1.5" />{c.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden">
          {previewDoc && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{previewDoc.doc_label}</p>
                  <p className="text-xs text-muted-foreground truncate">{previewDoc.file_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <a href={previewDoc.signed_url || "#"} target="_blank" rel="noopener noreferrer" download>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <Download className="h-3 w-3" /> Baixar
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewDoc(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center">
                {isImage(previewDoc.file_name) ? (
                  <img
                    src={previewDoc.signed_url}
                    alt={previewDoc.doc_label}
                    className="max-w-full max-h-full object-contain p-4"
                  />
                ) : isPdf(previewDoc.file_name) ? (
                  <iframe
                    src={previewDoc.signed_url}
                    className="w-full h-full border-0"
                    title={previewDoc.doc_label}
                  />
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground text-right max-w-[60%]">{value}</span>
  </div>
);

export default SubmissionDetail;
