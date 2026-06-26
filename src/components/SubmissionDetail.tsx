import { useState, useEffect } from "react";
import { ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle, Eye, User, Mail, Phone, ExternalLink, MapPin, Download, X, Loader2, Image as ImageIcon, Send, BadgeCheck, CircleDollarSign, ChevronLeft, ChevronRight, Sparkles, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Submission, StatusDocumento } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { downloadFileFromUrl, openFileFromUrl } from "@/lib/file-download";

const statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }> = {
  pendente:    { label: "Pendente",    icon: Clock,               className: "bg-warning/10 text-warning border-warning/20" },
  em_analise:  { label: "Em Análise", icon: Eye,                 className: "bg-primary/10 text-primary border-primary/20" },
  corrigido:   { label: "Corrigido",  icon: CheckCircle2,        className: "bg-success/10 text-success border-success/20" },
  rejeitado:   { label: "Rejeitado",  icon: AlertCircle,         className: "bg-destructive/10 text-destructive border-destructive/20" },
  aprovado:    { label: "Aprovado",   icon: BadgeCheck,          className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  faturado:    { label: "Faturado",   icon: CircleDollarSign,    className: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
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
  const { toast } = useToast();
  const cfg = statusConfig[submission.status];
  const StatusIcon = cfg.icon;
  const [documents, setDocuments] = useState<DbDocument[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewDoc = previewIndex !== null ? documents[previewIndex] : null;
  const [downloading, setDownloading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [sendingReject, setSendingReject] = useState(false);

  // Pré-análise por IA
  const [analisandoIa, setAnalisandoIa] = useState(false);
  const [analiseIa, setAnaliseIa] = useState<typeof submission.analiseIa | null>(submission.analiseIa || null);
  const [erroAnaliseIa, setErroAnaliseIa] = useState<string | null>(null);

  const handleAnalisarComIa = async () => {
    setAnalisandoIa(true);
    setErroAnaliseIa(null);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-documentacao", {
        body: { submissionId: submission.id },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Falha ao analisar documentação");
      }
      setAnaliseIa(data.analise);
      toast({ title: "Análise concluída", description: "Revise as sugestões da IA abaixo." });
    } catch (err: any) {
      console.error("Erro na análise de IA:", err);
      setErroAnaliseIa(err.message || "Não foi possível concluir a análise.");
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
    } finally {
      setAnalisandoIa(false);
    }
  };

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

  // Navegação por teclado entre documentos enquanto o preview está aberto
  useEffect(() => {
    if (previewIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setPreviewIndex((i) => (i !== null && i < documents.length - 1 ? i + 1 : i));
      } else if (e.key === "ArrowLeft") {
        setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewIndex, documents.length]);

  const allStatuses: StatusDocumento[] = ["pendente", "em_analise", "corrigido", "rejeitado", "aprovado", "faturado"];

  const getFileExtension = (name: string) => name.split(".").pop()?.toLowerCase() || "";
  const isImage = (name: string) => ["jpg", "jpeg", "png", "webp", "gif"].includes(getFileExtension(name));
  const isPdf = (name: string) => getFileExtension(name) === "pdf";
  const isPreviewable = (name: string) => isImage(name) || isPdf(name);

  const handleDownloadSingle = async (doc: DbDocument) => {
    if (!doc.signed_url) return;
    setDownloadingFile(doc.id);
    try {
      await downloadFileFromUrl(doc.signed_url, doc.file_name);
    } catch (err) {
      console.error("Download error:", err);
      toast({ title: "Erro ao baixar arquivo", variant: "destructive" });
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleOpenFile = async (doc: DbDocument) => {
    if (!doc.signed_url) return;

    try {
      await openFileFromUrl(doc.signed_url);
    } catch (err) {
      console.error("Open file error:", err);
      toast({ title: "Erro ao abrir arquivo", variant: "destructive" });
    }
  };

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

  const handleStatusClick = (st: StatusDocumento) => {
    if (st === "rejeitado") {
      setShowRejectModal(true);
    } else {
      onStatusUpdate(submission.id, st);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectMessage.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }
    setSendingReject(true);
    try {
      // Update status
      onStatusUpdate(submission.id, "rejeitado");

      // Save observation
      await supabase
        .from("submissions")
        .update({ observacoes: rejectMessage.trim() })
        .eq("id", submission.id);

      // Send email notification via edge function
      await supabase.functions.invoke("send-rejection-email", {
        body: {
          to: submission.contatoEmail,
          nomeContato: submission.contatoNome,
          numeroPi: submission.numeroPi,
          nomeVeiculo: submission.nomeVeiculo,
          cliente: submission.cliente,
          campanha: submission.campanha,
          motivo: rejectMessage.trim(),
        },
      });

      toast({ title: "E-mail de correção enviado ao veículo" });
      setShowRejectModal(false);
      setRejectMessage("");
    } catch (err) {
      console.error("Error sending rejection:", err);
      toast({ title: "Status atualizado, mas houve erro ao enviar e-mail", variant: "destructive" });
      setShowRejectModal(false);
    } finally {
      setSendingReject(false);
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

        {/* Pré-análise por IA */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Pré-análise por IA</h3>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleAnalisarComIa} disabled={analisandoIa}>
              {analisandoIa ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {analisandoIa ? "Analisando..." : analiseIa ? "Analisar novamente" : "Analisar com IA"}
            </Button>
          </div>

          {!analiseIa && !analisandoIa && !erroAnaliseIa && (
            <p className="text-sm text-muted-foreground">
              Clique em "Analisar com IA" para verificar pontos objetivos da documentação (referências de contrato, validade de certidões, etc.). As sugestões são apenas apoio — a decisão final é do operador.
            </p>
          )}

          {erroAnaliseIa && (
            <p className="text-sm text-destructive">{erroAnaliseIa}</p>
          )}

          {analiseIa && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Análise gerada em {new Date(analiseIa.geradoEm).toLocaleString("pt-BR")} — revise cada ponto antes de decidir.
              </p>
              {analiseIa.achados.map((achado, i) => {
                const visual = achado.resultado === "atencao"
                  ? { Icon: ShieldAlert, className: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", iconColor: "text-amber-600 dark:text-amber-400" }
                  : achado.resultado === "ok"
                  ? { Icon: ShieldCheck, className: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800", iconColor: "text-emerald-600 dark:text-emerald-400" }
                  : { Icon: ShieldQuestion, className: "bg-muted border-muted-foreground/20", iconColor: "text-muted-foreground" };
                const V = visual.Icon;
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${visual.className}`}>
                    <V className={`h-4 w-4 mt-0.5 shrink-0 ${visual.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{achado.checagem}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{achado.detalhe}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              {documents.map((doc, index) => {
                const previewable = isPreviewable(doc.file_name);
                const docIsImage = isImage(doc.file_name);
                const isDownloading = downloadingFile === doc.id;
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
                          onClick={() => setPreviewIndex(index)}>
                          <Eye className="h-3 w-3" /> Visualizar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary gap-1"
                        onClick={() => handleDownloadSingle(doc)} disabled={isDownloading || !doc.signed_url}>
                        {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Baixar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary gap-1"
                        onClick={() => handleOpenFile(doc)}
                        disabled={!doc.signed_url}
                      >
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </Button>
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
                  onClick={() => handleStatusClick(st)} disabled={isActive}>
                  <Icon className="h-3 w-3 mr-1.5" />{c.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewIndex(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden">
          {previewDoc && previewIndex !== null && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-card gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  disabled={previewIndex === 0}
                  title="Documento anterior (seta esquerda)"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-sm font-semibold text-foreground truncate">{previewDoc.doc_label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {previewDoc.file_name} · {previewIndex + 1} de {documents.length}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setPreviewIndex((i) => (i !== null && i < documents.length - 1 ? i + 1 : i))}
                  disabled={previewIndex === documents.length - 1}
                  title="Próximo documento (seta direita)"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => handleDownloadSingle(previewDoc)}>
                    <Download className="h-3 w-3" /> Baixar
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewIndex(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center">
                {isImage(previewDoc.file_name) ? (
                  <img src={previewDoc.signed_url} alt={previewDoc.doc_label} className="max-w-full max-h-full object-contain p-4" />
                ) : isPdf(previewDoc.file_name) ? (
                  <iframe src={previewDoc.signed_url} className="w-full h-full border-0" title={previewDoc.doc_label} />
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Rejeitar Documentação — PI {submission.numeroPi}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Descreva os problemas encontrados. O veículo <strong>{submission.contatoNome}</strong> receberá um e-mail em <strong>{submission.contatoEmail}</strong> com as instruções de correção.
            </p>
            <div className="space-y-1.5">
              <Label>Motivo da rejeição / O que precisa ser corrigido</Label>
              <Textarea
                placeholder="Descreva detalhadamente os ajustes necessários..."
                value={rejectMessage}
                onChange={(e) => setRejectMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={sendingReject} className="gap-1.5">
              {sendingReject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendingReject ? "Enviando..." : "Rejeitar e Notificar"}
            </Button>
          </DialogFooter>
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
