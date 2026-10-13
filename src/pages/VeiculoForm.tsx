import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Cliente, TipoVeiculo, Submission } from "@/lib/types";
import { addSubmission } from "@/lib/store";
import SubmissionReceipt from "@/components/SubmissionReceipt";
import { getActiveCampaigns } from "@/lib/campaigns";
import { downloadFileFromUrl } from "@/lib/file-download";
import { getRegrasDocumentos, filtrarRegras } from "@/lib/documentos";
import { cn } from "@/lib/utils";
import logoPro3 from "@/assets/logo-pro3.png";

import { CLIENTES, TIPOS_VEICULO, ORIENTACOES_CLIENTE } from "@/lib/clientes";
import { useClientes } from "@/hooks/use-clientes";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
const ACCEPT = ALLOWED_EXT.join(",");
const MAX_BYTES = 10 * 1024 * 1024;

const STEPS = ["Informações", "Contato", "Documentos"];

const certidaoLabels = [
  "Certidão Negativa de Débitos Municipais",
  "Certidão Negativa de Débitos Estaduais",
  "Certidão Negativa de Débitos Relativos aos Tributos Federais",
  "Certificado de Regularidade do FGTS - CRF",
  "Certidão Negativa de Débitos Trabalhistas",
];

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Valida extensão e tamanho; devolve mensagem de aviso ou null. */
const checkFile = (file: File): string | null => {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ALLOWED_EXT.includes(ext)) return `“${file.name}” não foi anexado: use PDF, JPG, PNG, DOC ou DOCX.`;
  if (file.size > MAX_BYTES) return `“${file.name}” tem ${formatSize(file.size)} e passa do limite de 10 MB.`;
  return null;
};

const VeiculoForm = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [submittedData, setSubmittedData] = useState<Submission | null>(() => {
    // Depois de um recarregamento forçado (ex.: sistema atualizado), recupera o comprovante recém-gerado.
    try {
      if (new URLSearchParams(window.location.search).get("comprovante")) {
        const salvo = sessionStorage.getItem("pro3:ultimo-comprovante");
        return salvo ? (JSON.parse(salvo) as Submission) : null;
      }
    } catch {
      /* sem armazenamento disponível */
    }
    return null;
  });

  // Carrega o gerador de PDF já no início: se o sistema for atualizado com a página aberta,
  // o arquivo antigo deixa de existir no servidor e o carregamento tardio falharia.
  useEffect(() => {
    void import("jspdf").catch(() => undefined);
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState<string[]>([]);

  const { data: clientesDb = [] } = useClientes();
  const listaClientes = clientesDb.length ? clientesDb.filter((c) => c.ativo).map((c) => c.nome) : CLIENTES;
  const [cliente, setCliente] = useState<Cliente | "">("");
  const [campanha, setCampanha] = useState("");
  const [numeroPi, setNumeroPi] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo | "">("");
  const [outroTipo, setOutroTipo] = useState("");
  const [nomeVeiculo, setNomeVeiculo] = useState("");
  const [cidade, setCidade] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [simplesNacional, setSimplesNacional] = useState(true);
  const [cndsAgrupadas, setCndsAgrupadas] = useState(false);

  const [docs, setDocs] = useState<Record<string, File[]>>({});
  const [avisos, setAvisos] = useState<Record<string, string>>({});

  const handleAddFiles = useCallback((key: string, files: File[]) => {
    const ok: File[] = [];
    let aviso = "";
    files.forEach((f) => {
      const problema = checkFile(f);
      if (problema) aviso = aviso ? `${aviso} ${problema}` : problema;
      else ok.push(f);
    });
    setAvisos((prev) => {
      const next = { ...prev };
      if (aviso) next[key] = aviso;
      else delete next[key];
      return next;
    });
    if (ok.length) setDocs((prev) => ({ ...prev, [key]: [...(prev[key] || []), ...ok] }));
  }, []);

  const handleRemoveFile = (key: string, index: number) => {
    setDocs((prev) => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== index) }));
    setAvisos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // PI já emitido pela agência: preenche campanha, veículo, tipo e cidade a partir do número.
  const [piEncontrado, setPiEncontrado] = useState<{ campanha: string; nome_veiculo: string; tipo_veiculo: string; praca: string | null } | null>(null);
  useEffect(() => {
    setPiEncontrado(null);
    const numero = numeroPi.trim();
    if (!cliente || numero.length < 2) return;
    let vivo = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("consultar_pi", { p_cliente: cliente, p_numero: numero });
      if (vivo && data && typeof data === "object" && !Array.isArray(data)) {
        setPiEncontrado(data as { campanha: string; nome_veiculo: string; tipo_veiculo: string; praca: string | null });
      }
    }, 450);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [cliente, numeroPi]);

  const [campanhasDisponiveis, setCampanhasDisponiveis] = useState<string[]>([]);
  useEffect(() => {
    if (cliente) getActiveCampaigns(cliente).then(setCampanhasDisponiveis);
    else setCampanhasDisponiveis([]);
  }, [cliente]);

  useEffect(() => {
    if (!piEncontrado) return;
    // Só completa o que o veículo ainda não preencheu; tudo continua editável.
    if (!campanha && campanhasDisponiveis.includes(piEncontrado.campanha)) setCampanha(piEncontrado.campanha);
    if (!nomeVeiculo) setNomeVeiculo(piEncontrado.nome_veiculo);
    if (!tipoVeiculo && (TIPOS_VEICULO as string[]).includes(piEncontrado.tipo_veiculo)) setTipoVeiculo(piEncontrado.tipo_veiculo as TipoVeiculo);
    if (!cidade && piEncontrado.praca) setCidade(piEncontrado.praca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piEncontrado, campanhasDisponiveis]);

  // Regras da campanha, vindas do banco.
  const regrasQuery = useQuery({
    queryKey: ["regras-documentos", cliente, campanha],
    queryFn: () => getRegrasDocumentos(cliente, campanha),
    enabled: !!cliente && !!campanha,
    staleTime: 60_000,
  });

  const documentos = useMemo(
    () => (regrasQuery.data ? filtrarRegras(regrasQuery.data, tipoVeiculo, simplesNacional) : []),
    [regrasQuery.data, tipoVeiculo, simplesNacional],
  );

  // Foco no título ao trocar de passo (teclado e leitor de tela).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const validateStep1 = () => {
    if (!cliente || !campanha || !numeroPi || !tipoVeiculo || !nomeVeiculo || !cidade) {
      setErro(["Preencha todos os campos antes de continuar."]);
      return false;
    }
    if (tipoVeiculo === "Outro" && !outroTipo) {
      setErro(["Informe o tipo do veículo."]);
      return false;
    }
    setErro([]);
    return true;
  };

  const validateStep2 = () => {
    if (!contatoNome || !contatoEmail || !contatoTelefone) {
      setErro(["Preencha todos os dados de contato."]);
      return false;
    }
    setErro([]);
    return true;
  };

  const goToStep = (target: number) => {
    if (target === step) return;
    if (target < step) { setErro([]); setStep(target); return; }
    if (target === 2 && step === 1 && validateStep1()) { setStep(2); setMaxStep((m) => Math.max(m, 2)); return; }
    if (target === 3 && step === 2 && validateStep2()) { setStep(3); setMaxStep((m) => Math.max(m, 3)); return; }
    if (target <= maxStep) { setErro([]); setStep(target); }
  };

  const certidoesRegra = documentos.find((d) => d.docType === "certidoes");
  const docsComuns = documentos.filter((d) => d.docType !== "certidoes");

  const certidaoAviso = cliente === "ALESC"
    ? "As certidões devem ter pelo menos 15 dias de validade na data do envio da documentação."
    : "As certidões devem estar válidas no dia da emissão da Nota Fiscal.";

  const chavesCertidao = cndsAgrupadas ? ["certidoesAgrupadas"] : [1, 2, 3, 4, 5].map((i) => `certidao${i}`);

  const handleSubmit = async () => {
    const faltando: string[] = [];
    docsComuns.forEach((d) => {
      if (d.obrigatorio && (docs[d.docType] || []).length === 0) faltando.push(d.nome);
    });
    if (certidoesRegra?.obrigatorio) {
      if (cndsAgrupadas) {
        if ((docs.certidoesAgrupadas || []).length === 0) faltando.push("Certidões negativas (arquivo agrupado)");
      } else {
        [1, 2, 3, 4, 5].forEach((i) => {
          if ((docs[`certidao${i}`] || []).length === 0) faltando.push(certidaoLabels[i - 1]);
        });
      }
    }

    if (faltando.length > 0) {
      setErro(["Anexe os documentos obrigatórios que faltam:", ...faltando]);
      return;
    }
    setErro([]);

    // Só segue o que está visível para esta campanha, veículo e regime.
    const chavesVisiveis = [...docsComuns.map((d) => d.docType), ...(certidoesRegra ? chavesCertidao : [])];

    setIsSubmitting(true);
    const files: Record<string, File> = {};
    chavesVisiveis.forEach((key) => {
      const fileList = docs[key] || [];
      fileList.forEach((file, index) => {
        files[fileList.length === 1 ? key : `${key}__${index + 1}`] = file;
      });
    });

    try {
      const result = await addSubmission(
        { cliente: cliente as Cliente, campanha, numeroPi, tipoVeiculo: tipoVeiculo as TipoVeiculo,
          outroTipo: tipoVeiculo === "Outro" ? outroTipo : undefined, nomeVeiculo, cidade,
          contatoNome, contatoEmail, contatoTelefone, observacoes: observacoes || undefined },
        files
      );
      if (result) {
        setSubmittedData(result);
        try {
          sessionStorage.setItem("pro3:ultimo-comprovante", JSON.stringify(result));
        } catch {
          /* sem armazenamento disponível */
        }
      }
      else toast({ title: "Erro", description: "Falha ao enviar documentação. Tente novamente.", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar documentação", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateDownload = async (url: string) => {
    const fileName = decodeURIComponent(url.split("/").pop() || "modelo.pdf");
    try { await downloadFileFromUrl(url, fileName); }
    catch { toast({ title: "Erro ao baixar modelo", description: "Tente novamente em instantes.", variant: "destructive" }); }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) goToStep(step + 1);
    else if (!isSubmitting) handleSubmit();
  };

  if (submittedData) return <SubmissionReceipt submission={submittedData} />;

  const clienteDb = clientesDb.find((c) => c.nome === cliente);
  const orientacao = !cliente
    ? undefined
    : clienteDb
      ? {
          cnpj: clienteDb.cnpj ?? "—",
          contratoInfo: clienteDb.contratoInfo,
          observacoesNF: clienteDb.observacoesNf,
          enderecoPostal: clienteDb.enderecoPostal ?? "",
        }
      : ORIENTACOES_CLIENTE[cliente as Cliente];
  const semRegras = !!regrasQuery.data && documentos.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-[42rem] items-center justify-between px-5 py-4">
          <img src={logoPro3} alt="Pró3 Comunicação" className="h-9 w-auto" />
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[42rem] px-5 pb-20 pt-10">
        <p className="eyebrow mb-2">Veículos de mídia</p>
        <h1 className="text-3xl">Envio de documentos do PI</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe os dados do Pedido de Inserção e anexe a documentação de faturamento.
        </p>

        <nav aria-label="Passos" className="mt-8 border-b">
          <ol className="flex gap-6 sm:gap-8">
            {STEPS.map((label, i) => {
              const s = i + 1;
              const atual = s === step;
              const liberado = s <= maxStep;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => goToStep(s)}
                    disabled={!liberado}
                    aria-current={atual ? "step" : undefined}
                    className={cn(
                      "-mb-px flex items-baseline gap-2 border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      atual ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
                      liberado && !atual && "hover:text-foreground",
                      !liberado && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className={cn("num text-xs", atual ? "font-semibold text-primary" : "")}>{s}</span>
                    <span className={atual ? "font-medium" : ""}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <form onSubmit={onSubmit} noValidate className="mt-8">
          {step === 1 && (
            <section aria-labelledby="titulo-passo" className="space-y-5">
              <div>
                <h2 id="titulo-passo" ref={headingRef} tabIndex={-1} className="text-xl outline-none">Informações do PI</h2>
                <p className="mt-1 text-sm text-muted-foreground">Todos os campos são obrigatórios.</p>
              </div>
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={cliente} onValueChange={(v) => { setCliente(v as Cliente); setCampanha(""); }}>
                    <SelectTrigger id="cliente"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>{listaClientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pi">Número do PI</Label>
                  <Input id="pi" value={numeroPi} onChange={(e) => setNumeroPi(e.target.value)} aria-describedby="pi-ajuda" />
                  <p id="pi-ajuda" className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
                    {piEncontrado ? "PI encontrado: os dados abaixo foram preenchidos. Confira e corrija se precisar." : ""}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campanha">Campanha</Label>
                  <Select value={campanha} onValueChange={setCampanha} disabled={!cliente}>
                    <SelectTrigger id="campanha"><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
                    <SelectContent>{campanhasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="veiculo">Nome do veículo</Label>
                  <Input id="veiculo" value={nomeVeiculo} onChange={(e) => setNomeVeiculo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tipo">Tipo do veículo</Label>
                  <Select value={tipoVeiculo} onValueChange={(v) => setTipoVeiculo(v as TipoVeiculo)}>
                    <SelectTrigger id="tipo"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>{TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {tipoVeiculo === "Outro" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="outro">Especifique o tipo</Label>
                    <Input id="outro" value={outroTipo} onChange={(e) => setOutroTipo(e.target.value)} />
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="titulo-passo" className="space-y-5">
              <div>
                <h2 id="titulo-passo" ref={headingRef} tabIndex={-1} className="text-xl outline-none">Contato</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Usaremos estes dados para avisar se algum documento precisar de correção.
                </p>
              </div>
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contato-nome">Nome do responsável</Label>
                  <Input id="contato-nome" autoComplete="name" value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contato-email">E-mail</Label>
                  <Input id="contato-email" type="email" autoComplete="email" placeholder="nome@exemplo.com" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contato-tel">Telefone / WhatsApp</Label>
                  <Input id="contato-tel" type="tel" autoComplete="tel" value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="obs">Observações <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="titulo-passo" className="space-y-10">
              <div>
                <h2 id="titulo-passo" ref={headingRef} tabIndex={-1} className="text-xl outline-none">Documentos</h2>
                <p className="num mt-1 text-sm text-muted-foreground">
                  {cliente} · {campanha} · PI {numeroPi} · {tipoVeiculo === "Outro" ? outroTipo : tipoVeiculo}
                </p>
              </div>

              <fieldset>
                <legend className="text-sm font-medium">A empresa é optante pelo Simples Nacional?</legend>
                <div className="mt-2 flex gap-6">
                  {[{ v: true, t: "Sim" }, { v: false, t: "Não" }].map(({ v, t }) => (
                    <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="simples"
                        checked={simplesNacional === v}
                        onChange={() => setSimplesNacional(v)}
                        className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      {t}
                    </label>
                  ))}
                </div>
                {!simplesNacional && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Neste caso, será pedida a declaração de dispensa de retenção do IRRF.
                  </p>
                )}
              </fieldset>

              {orientacao && (
                <details open className="group">
                  <summary className="cursor-pointer list-none rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span className="eyebrow block">Antes de emitir a nota fiscal</span>
                    <span className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="font-serif text-lg">Regras da nota fiscal para {cliente}</span>
                      <span className="text-xs text-muted-foreground underline underline-offset-4 group-open:hidden">Mostrar</span>
                      <span className="hidden text-xs text-muted-foreground underline underline-offset-4 group-open:inline">Recolher</span>
                    </span>
                  </summary>
                  <div className="mt-4 space-y-5 border-l-2 pl-4 text-sm">
                    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[9rem_1fr]">
                      <dt className="text-muted-foreground">CNPJ do tomador</dt>
                      <dd className="num">{orientacao.cnpj}</dd>
                      <dt className="text-muted-foreground">Referências na NF</dt>
                      <dd>
                        {orientacao.contratoInfo.map((linha) => <span key={linha} className="block">{linha}</span>)}
                      </dd>
                      <dt className="text-muted-foreground">Endereço postal</dt>
                      <dd>
                        {orientacao.enderecoPostal}
                        {tipoVeiculo === "Jornal" && (
                          <span className="mt-1 block text-muted-foreground">
                            Jornais: além do envio digital, encaminhe 2 exemplares originais pelo correio para este endereço.
                          </span>
                        )}
                      </dd>
                    </dl>
                    <ul className="list-disc space-y-1.5 pl-4 marker:text-muted-foreground">
                      {orientacao.observacoesNF.map((obs, i) => <li key={i}>{obs}</li>)}
                    </ul>
                  </div>
                </details>
              )}

              <div>
                <div className="flex flex-col gap-0.5 border-b pb-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <h3 className="text-lg">Documentos a enviar</h3>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOC ou DOCX · até 10 MB</p>
                </div>

                {regrasQuery.isLoading && (
                  <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando a lista de documentos
                  </p>
                )}
                {regrasQuery.isError && (
                  <p className="py-6 text-sm text-destructive" role="alert">
                    Não foi possível carregar a lista de documentos. Atualize a página e tente novamente.
                  </p>
                )}
                {semRegras && (
                  <p className="py-6 text-sm text-muted-foreground" role="status">
                    Esta campanha ainda não tem documentos configurados. Entre em contato com a Pró3 para concluir o envio.
                  </p>
                )}

                {docsComuns.length > 0 && (
                  <ul>
                    {docsComuns.map((d) => (
                      <DocRow
                        key={d.docType}
                        label={d.nome}
                        description={d.descricao}
                        obrigatorio={d.obrigatorio}
                        files={docs[d.docType] || []}
                        aviso={avisos[d.docType]}
                        onAdd={(f) => handleAddFiles(d.docType, f)}
                        onRemove={(i) => handleRemoveFile(d.docType, i)}
                        modelo={d.modeloUrl ? () => handleTemplateDownload(d.modeloUrl!) : undefined}
                      />
                    ))}
                  </ul>
                )}

                {certidoesRegra && (
                  <div className="mt-8">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-lg">{certidoesRegra.nome}</h3>
                      <span className="text-xs text-muted-foreground">{certidoesRegra.obrigatorio ? "obrigatório" : "opcional"}</span>
                    </div>
                    <p className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">{certidaoAviso}</p>

                    <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={cndsAgrupadas}
                        onChange={(e) => setCndsAgrupadas(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      <span>
                        Tenho todas as certidões em um único arquivo
                        <span className="block text-xs text-muted-foreground">
                          Um só PDF com as cinco certidões, em vez de um arquivo para cada.
                        </span>
                      </span>
                    </label>

                    <ul className="mt-2 border-t">
                      {cndsAgrupadas ? (
                        <DocRow
                          label="Certidões negativas (arquivo agrupado)"
                          description="Municipal, estadual, federal, FGTS e trabalhista no mesmo arquivo"
                          obrigatorio={certidoesRegra.obrigatorio}
                          files={docs.certidoesAgrupadas || []}
                          aviso={avisos.certidoesAgrupadas}
                          onAdd={(f) => handleAddFiles("certidoesAgrupadas", f)}
                          onRemove={(i) => handleRemoveFile("certidoesAgrupadas", i)}
                        />
                      ) : (
                        certidaoLabels.map((label, i) => (
                          <DocRow
                            key={`certidao${i + 1}`}
                            label={label}
                            obrigatorio={certidoesRegra.obrigatorio}
                            files={docs[`certidao${i + 1}`] || []}
                            aviso={avisos[`certidao${i + 1}`]}
                            onAdd={(f) => handleAddFiles(`certidao${i + 1}`, f)}
                            onRemove={(idx) => handleRemoveFile(`certidao${i + 1}`, idx)}
                          />
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <div aria-live="polite" className="mt-6">
            {erro.length > 0 && (
              <div role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">
                <p>{erro[0]}</p>
                {erro.length > 1 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {erro.slice(1).map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={() => goToStep(step - 1)} disabled={isSubmitting}>Voltar</Button>
            ) : <span />}
            {step < 3 ? (
              <Button type="submit">Continuar</Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || regrasQuery.isLoading || documentos.length === 0}>
                {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
                {isSubmitting ? "Enviando" : "Enviar documentos"}
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

interface DocRowProps {
  label: string;
  description?: string | null;
  obrigatorio: boolean;
  files: File[];
  aviso?: string;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  modelo?: () => void;
}

/** Uma linha do "razão" de documentos: nome, situação, ação e arquivos anexados. */
const DocRow = ({ label, description, obrigatorio, files, aviso, onAdd, onRemove, modelo }: DocRowProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useRef(`arq-${Math.random().toString(36).slice(2, 9)}`).current;

  return (
    <li
      className={cn("border-b py-4 transition-colors", isDragging && "bg-accent/50")}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files);
        if (dropped.length) onAdd(dropped);
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{label}</p>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span>{obrigatorio ? "obrigatório" : "opcional"}</span>
            {modelo && (
              <button
                type="button"
                onClick={modelo}
                className="rounded-sm text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Baixar modelo
              </button>
            )}
            {isDragging && <span className="text-primary">Solte o arquivo aqui</span>}
          </p>
        </div>
        <div className="shrink-0">
          <input
            id={inputId}
            type="file"
            multiple
            accept={ACCEPT}
            className="peer sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) onAdd(picked);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {files.length > 0 ? "Adicionar outro" : "Anexar"}
          </label>
        </div>
      </div>

      {aviso && <p className="mt-2 text-xs text-destructive" role="alert">{aviso}</p>}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-2 pl-3">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {file.name} <span className="num text-xs text-muted-foreground">· {formatSize(file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remover ${file.name}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden /> Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export default VeiculoForm;
