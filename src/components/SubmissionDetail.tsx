import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileText,
  Image as ImageIcon, Loader2, Mail, MapPin, Phone, Send, ShieldAlert, ShieldCheck, ShieldQuestion,
  Sparkles, User, X, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/app/StatusBadge";
import Panel from "@/components/app/Panel";
import { Submission, StatusDocumento } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { downloadFileFromUrl, openFileFromUrl } from "@/lib/file-download";

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

  onStatusUpdate: (id: string, status: StatusDocumento) => void | Promise<void>;
}

const SubmissionDetail = ({ submission, onStatusUpdate }: Props) => {
  const { toast } = useToast();
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
    let gerada: typeof submission.analiseIa | null = null;
    setAnalisandoIa(true);
    setErroAnaliseIa(null);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-documentacao", {
        body: { submissionId: submission.id },
      });
      if (error || !data?.success) {
        // O corpo da resposta de erro da função traz o motivo real.
        let motivo: string | undefined = data?.error;
        const ctx = (error as { context?: Response } | null)?.context;
        if (!motivo && ctx) {
          try {
            motivo = (await ctx.json())?.error;
          } catch {
            /* sem corpo legível */
          }
          if (ctx.status === 401) motivo = "Sua sessão expirou. Saia e entre de novo no sistema.";
        }
        throw new Error(motivo || error?.message || "Falha ao analisar documentação");
      }
      setAnaliseIa(data.analise);
      gerada = data.analise;
      toast({ title: "Análise concluída", description: "Revise as sugestões da IA abaixo." });
    } catch (err: any) {
      console.error("Erro na análise de IA:", err);
      setErroAnaliseIa(err.message || "Não foi possível concluir a análise.");
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
    } finally {
      setAnalisandoIa(false);
    }
    return gerada;
  };

  // Pontos a corrigir apontados pela pré-análise, já redigidos para o veículo.
  const pendenciasDe = (a: typeof submission.analiseIa | null | undefined): string[] => {
    if (!a) return [];
    if (a.pendencias?.length) return a.pendencias;
    return a.achados.filter((x) => x.resultado === "atencao").map((x) => x.detalhe);
  };
  const textoDasPendencias = (itens: string[]) => itens.map((t) => "• " + t).join("\n");
  const [preenchidoPelaIa, setPreenchidoPelaIa] = useState(false);

  const abrirDevolucao = () => {
    const itens = pendenciasDe(analiseIa);
    if (itens.length && !rejectMessage.trim()) {
      setRejectMessage(textoDasPendencias(itens));
      setPreenchidoPelaIa(true);
    }
    setShowRejectModal(true);
  };

  const gerarPendenciasComIa = async () => {
    const a = await handleAnalisarComIa();
    const itens = pendenciasDe(a);
    if (itens.length) {
      setRejectMessage(textoDasPendencias(itens));
      setPreenchidoPelaIa(true);
    } else if (a) {
      toast({ title: "A pré-análise não apontou pendências", description: "Descreva o que precisa ser corrigido." });
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
    if (st === "em_revisao") {
      abrirDevolucao();
    } else {
      onStatusUpdate(submission.id, st);
    }
  };

  const qc = useQueryClient();
  const { data: emails = [] } = useQuery({
    queryKey: ["emails-enviados", submission.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("emails_enviados")
        .select("id, tipo, para, status, erro, created_at")
        .eq("submission_id", submission.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  /** Envia o e-mail ao veículo e devolve uma mensagem pronta quando não der certo. */
  const enviarEmail = async (corpo: { tipo: "protocolo" } | { tipo: "devolucao"; motivo: string }): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke("enviar-email", { body: { submissionId: submission.id, ...corpo } });
    qc.invalidateQueries({ queryKey: ["emails-enviados", submission.id] });
    if (!error && data?.success) return null;
    let corpoErro = data;
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx) {
      try {
        corpoErro = await ctx.json();
      } catch {
        /* sem corpo legível */
      }
    }
    if (corpoErro?.code === "email_nao_configurado") return "O serviço de e-mail ainda não está configurado.";
    return corpoErro?.error ?? "Não foi possível enviar o e-mail.";
  };

  const [reenviando, setReenviando] = useState(false);
  const reenviarProtocolo = async () => {
    setReenviando(true);
    const falha = await enviarEmail({ tipo: "protocolo" });
    setReenviando(false);
    toast(falha ? { title: "E-mail não enviado", description: falha, variant: "destructive" } : { title: "Protocolo reenviado ao veículo" });
  };

  const handleRejectConfirm = async () => {
    if (!rejectMessage.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }
    setSendingReject(true);
    try {
      // A observação vai antes do status para entrar no histórico do envio.
      await supabase
        .from("submissions")
        .update({ observacoes: rejectMessage.trim() })
        .eq("id", submission.id);
      await onStatusUpdate(submission.id, "em_revisao");

      const falha = await enviarEmail({ tipo: "devolucao", motivo: rejectMessage.trim() });
      if (falha) {
        toast({
          title: "Devolvido, mas o e-mail não foi enviado",
          description: falha + " O status e as pendências ficaram registrados; avise o veículo por outro meio.",
          variant: "destructive",
        });
      } else {
        toast({ title: "E-mail de correção enviado ao veículo" });
      }
      setShowRejectModal(false);
      setRejectMessage("");
      setPreenchidoPelaIa(false);
    } catch (err) {
      console.error("Erro ao devolver o envio:", err);
      toast({ title: "Não foi possível devolver o envio", description: (err as Error).message, variant: "destructive" });
      setShowRejectModal(false);
    } finally {
      setSendingReject(false);
    }
  };

  const { canOperate } = useRoles();
  const decidido = submission.status === "aprovado" || submission.status === "cancelado";

  const achadoVisual = (r: string) =>
    r === "atencao"
      ? { Icon: ShieldAlert, tone: "border-warning/30 bg-warning/[0.07]", icon: "text-warning" }
      : r === "ok"
        ? { Icon: ShieldCheck, tone: "border-success/25 bg-success/[0.06]", icon: "text-success" }
        : { Icon: ShieldQuestion, tone: "border-border bg-muted/50", icon: "text-muted-foreground" };

  return (
    <div className="space-y-8">
      <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/app/documentos" className="hover:text-foreground">Documentos</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to={`/app/documentos?cliente=${encodeURIComponent(submission.cliente)}`} className="hover:text-foreground">
          {submission.cliente}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">PI {submission.numeroPi}</span>
      </nav>

      <header className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">{submission.campanha}</p>
          <h1 className="text-3xl leading-tight sm:text-[2rem]">
            PI <span className="num">{submission.numeroPi}</span>
            <span className="text-muted-foreground"> — {submission.nomeVeiculo}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Enviado em {formatDateTime(submission.dataEnvio)}</p>
        </div>
        <StatusBadge status={submission.status} className="self-start px-2.5 py-1 text-sm sm:self-end" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel
            title={`Documentos anexados`}
            description={`${documents.length} ${documents.length === 1 ? "arquivo" : "arquivos"}`}
            bodyClassName="p-0"
            actions={
              documents.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDownloadAll} disabled={downloading}>
                  {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                  {downloading ? "Gerando ZIP" : "Baixar tudo"}
                </Button>
              )
            }
          >
            {documents.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</p>
            ) : (
              <ul className="divide-y">
                {documents.map((doc, index) => {
                  const previewable = isPreviewable(doc.file_name);
                  const isDownloading = downloadingFile === doc.id;
                  const Icon = isImage(doc.file_name) ? ImageIcon : FileText;
                  return (
                    <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{doc.doc_label}</p>
                        <p className="truncate text-xs text-muted-foreground">{doc.file_name}</p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {previewable && doc.signed_url && (
                          <Button variant="ghost" size="sm" onClick={() => setPreviewIndex(index)}>
                            <Eye /> <span className="hidden sm:inline">Visualizar</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleDownloadSingle(doc)}
                          disabled={isDownloading || !doc.signed_url}
                          aria-label={`Baixar ${doc.doc_label}`}
                        >
                          {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleOpenFile(doc)}
                          disabled={!doc.signed_url}
                          aria-label={`Abrir ${doc.doc_label} em nova aba`}
                        >
                          <ExternalLink />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Pré-análise automática"
            description="Apoio à conferência. A decisão final é sempre do operador."
            actions={
              <Button variant="outline" size="sm" onClick={handleAnalisarComIa} disabled={analisandoIa}>
                {analisandoIa ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {analisandoIa ? "Analisando" : analiseIa ? "Refazer" : "Analisar"}
              </Button>
            }
          >
            {erroAnaliseIa && <p className="text-sm text-destructive">{erroAnaliseIa}</p>}
            {!analiseIa && !analisandoIa && !erroAnaliseIa && (
              <p className="text-sm text-muted-foreground">
                Ainda não analisado. A verificação confere referências de contrato, validade de certidões e outros pontos objetivos.
              </p>
            )}
            {analiseIa && (
              <div className="space-y-2">
                <p className="mb-3 text-xs text-muted-foreground">Gerada em {formatDateTime(analiseIa.geradoEm)}</p>
                {canOperate && submission.status !== "em_revisao" && pendenciasDe(analiseIa).length > 0 && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/[0.07] px-3 py-2.5">
                    <p className="text-sm">
                      <span className="num font-medium">{pendenciasDe(analiseIa).length}</span>{" "}
                      {pendenciasDe(analiseIa).length === 1 ? "pendência pronta" : "pendências prontas"} para devolver ao veículo.
                    </p>
                    <Button size="sm" variant="outline" onClick={abrirDevolucao}>Devolver com estes pontos</Button>
                  </div>
                )}
                {analiseIa.achados.map((achado, i) => {
                  const v = achadoVisual(achado.resultado);
                  return (
                    <div key={i} className={cn("flex items-start gap-3 rounded-md border p-3", v.tone)}>
                      <v.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", v.icon)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{achado.checagem}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{achado.detalhe}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <Panel title="Decisão">
            {submission.status === "em_revisao" && submission.observacoes && (
              <div className="mb-4 border-l-2 border-warning/50 pl-3">
                <p className="eyebrow mb-1">Pendência informada</p>
                <p className="text-sm leading-relaxed">{submission.observacoes}</p>
              </div>
            )}
            <fieldset disabled={!canOperate} className="space-y-2 disabled:opacity-60">
              <Button className="w-full" onClick={() => handleStatusClick("aprovado")} disabled={submission.status === "aprovado"}>
                <CheckCircle2 /> {submission.status === "aprovado" ? "Aprovado" : "Aprovar documentação"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleStatusClick("em_revisao")}
                disabled={submission.status === "em_revisao"}
              >
                <AlertCircle /> Devolver com pendência
              </Button>
              {submission.status !== "recebido" && (
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => handleStatusClick("recebido")}>
                  Voltar para “Recebido”
                </Button>
              )}
              {!decidido && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() => handleStatusClick("cancelado")}
                >
                  <Ban /> Cancelar PI
                </Button>
              )}
            </fieldset>
            {!canOperate && <p className="mt-3 text-xs text-muted-foreground">Só operadores e administradores decidem sobre a documentação.</p>}
          </Panel>

          {submission.pedidoId && (
            <Panel title="Pedido de inserção">
              <p className="text-sm">
                Ligado ao PI do sistema.{" "}
                <Link to={`/app/pedidos/${submission.pedidoId}`} className="font-medium text-primary hover:underline">
                  Abrir PI
                </Link>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Ao aprovar, a medição é criada com os valores do PI.</p>
            </Panel>
          )}

          <Panel
            title="E-mails ao veículo"
            actions={
              canOperate && (
                <Button variant="outline" size="sm" onClick={reenviarProtocolo} disabled={reenviando}>
                  {reenviando && <Loader2 className="animate-spin" />} Reenviar protocolo
                </Button>
              )
            }
          >
            {emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum e-mail enviado ainda.</p>
            ) : (
              <ul className="divide-y text-sm">
                {emails.map((e) => (
                  <li key={e.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span>{e.tipo === "protocolo" ? "Protocolo" : "Devolução"}</span>
                      <span className={cn("text-xs", e.status === "enviado" ? "text-success" : "text-destructive")}>
                        {e.status === "enviado" ? "enviado" : e.status === "nao_configurado" ? "sem serviço de e-mail" : "falhou"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.para} · {formatDateTime(e.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Veículo e contato">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="eyebrow">Veículo</dt>
                <dd className="mt-0.5">
                  {submission.nomeVeiculo}
                  <span className="text-muted-foreground">
                    {" "}
                    · {submission.tipoVeiculo === "Outro" ? submission.outroTipo || "Outro" : submission.tipoVeiculo}
                  </span>
                </dd>
              </div>
              <div className="space-y-1.5 border-t pt-3">
                <dd className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" />{submission.contatoNome}</dd>
                <dd className="flex items-center gap-2 break-all">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${submission.contatoEmail}`} className="hover:text-primary">{submission.contatoEmail}</a>
                </dd>
                <dd className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{submission.contatoTelefone}</dd>
                {submission.cidade && (
                  <dd className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{submission.cidade}</dd>
                )}
              </div>
              {submission.observacoes && submission.status !== "em_revisao" && (
                <div className="border-t pt-3">
                  <dt className="eyebrow">Observações</dt>
                  <dd className="mt-0.5 leading-relaxed">{submission.observacoes}</dd>
                </div>
              )}
            </dl>
          </Panel>
        </aside>
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewIndex(null); }}>
        <DialogContent className="h-[88vh] w-[95vw] max-w-5xl gap-0 overflow-hidden p-0 [&>button]:hidden">
          {previewDoc && previewIndex !== null && (
            <div className="flex h-full flex-col">
              <DialogHeader className="sr-only">
                <DialogTitle>{previewDoc.doc_label}</DialogTitle>
                <DialogDescription>{previewDoc.file_name}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 border-b bg-card px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  disabled={previewIndex === 0}
                  aria-label="Documento anterior"
                >
                  <ChevronLeft />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="truncate text-sm font-medium">{previewDoc.doc_label}</p>
                  <p className="num truncate text-xs text-muted-foreground">
                    {previewDoc.file_name} · {previewIndex + 1}/{documents.length}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setPreviewIndex((i) => (i !== null && i < documents.length - 1 ? i + 1 : i))}
                  disabled={previewIndex === documents.length - 1}
                  aria-label="Próximo documento"
                >
                  <ChevronRight />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadSingle(previewDoc)}>
                  <Download /> Baixar
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewIndex(null)} aria-label="Fechar">
                  <X />
                </Button>
              </div>
              <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/60">
                {isImage(previewDoc.file_name) ? (
                  <img src={previewDoc.signed_url} alt={previewDoc.doc_label} className="max-h-full max-w-full object-contain p-4" />
                ) : isPdf(previewDoc.file_name) ? (
                  <iframe src={previewDoc.signed_url} className="h-full w-full border-0" title={previewDoc.doc_label} />
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Devolver PI {submission.numeroPi} ao veículo</DialogTitle>
            <DialogDescription>
              {submission.contatoNome} recebe um e-mail em {submission.contatoEmail} com o motivo e as instruções para reenviar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="motivo">O que precisa ser corrigido</Label>
              {analiseIa ? (
                pendenciasDe(analiseIa).length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => { setRejectMessage(textoDasPendencias(pendenciasDe(analiseIa))); setPreenchidoPelaIa(true); }}
                  >
                    Refazer a partir da pré-análise
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  onClick={gerarPendenciasComIa}
                  disabled={analisandoIa}
                >
                  {analisandoIa ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {analisandoIa ? "Analisando…" : "Gerar pendências com IA"}
                </button>
              )}
            </div>
            <Textarea
              id="motivo"
              placeholder="Ex.: a nota fiscal está sem o número do contrato; anexar CND federal vigente."
              value={rejectMessage}
              onChange={(e) => setRejectMessage(e.target.value)}
              rows={7}
            />
            <p className="text-xs text-muted-foreground">
              {preenchidoPelaIa
                ? "Preenchido pela pré-análise. Revise, apague o que não procede e acrescente o que faltar antes de enviar."
                : "Uma pendência por linha, em frases que o veículo consiga cumprir."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Voltar</Button>
            <Button onClick={handleRejectConfirm} disabled={sendingReject}>
              {sendingReject ? <Loader2 className="animate-spin" /> : <Send />}
              {sendingReject ? "Enviando" : "Devolver e notificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubmissionDetail;
