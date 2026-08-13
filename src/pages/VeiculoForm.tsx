import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckCircle2, FileText, AlertCircle, Plus, X, Download, Info, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Cliente, TipoVeiculo } from "@/lib/types";
import { addSubmission } from "@/lib/store";
import SubmissionReceipt from "@/components/SubmissionReceipt";
import { Submission } from "@/lib/types";
import { getActiveCampaigns } from "@/lib/campaigns";
import { downloadFileFromUrl } from "@/lib/file-download";

const CLIENTES: Cliente[] = ["ALESC", "Prefeitura de Xanxerê", "Prefeitura de Chapecó"];
const TIPOS_VEICULO: TipoVeiculo[] = ["Jornal", "Rádio", "Televisão", "Portal", "Mídia Externa", "Outro"];

interface OrientacaoCliente {
  cnpj: string;
  contratoInfo: string[];
  observacoesNF: string[];
  enderecoPostal: string;
}

const ORIENTACOES_CLIENTE: Record<Cliente, OrientacaoCliente> = {
  "ALESC": {
    cnpj: "83.599.191/0001-87",
    contratoInfo: ["Contrato nº 031/2023", "Edital nº 001/2022"],
    observacoesNF: [
      "A Nota Fiscal deve ser emitida somente após o término da veiculação.",
      "Utilize o modelo 62 (conforme Ajuste SINIEF nº 7/2022).",
      "O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.",
      "Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.",
      "Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.",
    ],
    enderecoPostal: "Av. Prefeito Osmar Cunha, 416, Sala 905 — Ed. Koerich Empresarial Rio Branco — Florianópolis/SC — CEP 88.015-100",
  },
  "Prefeitura de Chapecó": {
    cnpj: "83.021.808/0001-82",
    contratoInfo: ["Contrato nº 371/2025", "Concorrência nº 186/2025"],
    observacoesNF: [
      "A Nota Fiscal deve ser emitida somente após o término da veiculação.",
      "Faturar o valor líquido diretamente contra a Prefeitura de Chapecó.",
      "O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.",
      "Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.",
      "Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.",
    ],
    enderecoPostal: "Av. Nereu Ramos, 75D, Sala 707A — Centro Profissional Chapecó — Chapecó/SC — CEP 89801-023",
  },
  "Prefeitura de Xanxerê": {
    cnpj: "83.009.860/0001-13",
    contratoInfo: ["Processo Licitatório nº 0066/2025", "Concorrência nº 0001/2025", "Contrato nº 0180/2025"],
    observacoesNF: [
      "A Nota Fiscal deve ser emitida somente após o término da veiculação.",
      "Faturar o valor líquido diretamente contra a Prefeitura de Xanxerê.",
      "A NF deve conter o texto: \"Documento emitido em nome do tomador do serviço aos cuidados da Agência Pro3 Comunicação\".",
      "O campo VALOR deve conter apenas o valor líquido. Bruto e comissão de agência devem constar na descrição.",
      "Empresas sujeitas à retenção: destacar IR à alíquota de 4,8%. Empresas isentas: descrever o artigo de isenção e apresentar declaração.",
      "Inclua os dados bancários no corpo da NF ou no campo de informações adicionais.",
    ],
    enderecoPostal: "Rua Ouro Preto, 315 — Bairro Tonial — Xanxerê/SC — CEP 89820-000",
  },
};

const VeiculoForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submittedData, setSubmittedData] = useState<Submission | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const [docs, setDocs] = useState<Record<string, File[]>>({
    piAssinado: [], notaFiscal: [], notaFiscalGrafica: [], fotoMidiaExterna: [],
    declaracaoSimplesNacional: [], comprovantesExibicao: [], declaracaoArtigo299: [],
    certidao1: [], certidao2: [], certidao3: [], certidao4: [], certidao5: [],
    certidoesAgrupadas: [],
    tabelaPrecoAssinada: [],
  });

  const handleAddFile = (key: string, file: File) => {
    setDocs((prev) => ({ ...prev, [key]: [...(prev[key] || []), file] }));
  };
  const handleRemoveFile = (key: string, index: number) => {
    setDocs((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const [campanhasDisponiveis, setCampanhasDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    if (cliente) getActiveCampaigns(cliente).then(setCampanhasDisponiveis);
    else setCampanhasDisponiveis([]);
  }, [cliente]);

  const validateStep1 = () => {
    if (!cliente || !campanha || !numeroPi || !tipoVeiculo || !nomeVeiculo || !cidade) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos antes de continuar.", variant: "destructive" });
      return false;
    }
    if (tipoVeiculo === "Outro" && !outroTipo) {
      toast({ title: "Campo obrigatório", description: "Informe o tipo do veículo.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!contatoNome || !contatoEmail || !contatoTelefone) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os dados de contato.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const goToStep = (target: number) => {
    if (target < step) { setStep(target); return; }
    if (target === step) return;
    if (target === 2 && step === 1 && validateStep1()) { setStep(2); setMaxStep((m) => Math.max(m, 2)); return; }
    if (target === 3 && step === 2 && validateStep2()) { setStep(3); setMaxStep((m) => Math.max(m, 3)); return; }
    // Skipping ahead multiple steps: only allow if already visited
    if (target <= maxStep) setStep(target);
  };

  const isJornal = tipoVeiculo === "Jornal";
  const isMidiaExterna = tipoVeiculo === "Mídia Externa";

  const docFields = [
    ...(cliente !== "ALESC" ? [{ key: "piAssinado", label: "PI Assinado", required: true, desc: "Pedido de Inserção devidamente assinado" }] : []),
    { key: "notaFiscal", label: "Nota Fiscal", required: true, desc: "Nota Fiscal referente ao serviço prestado" },
    { key: "declaracaoArtigo299", label: "Declaração do Artigo 299", required: true, desc: "Declaração conforme Art. 299 do Código Penal" },
    { key: "tabelaPrecoAssinada", label: "Tabela de Preço Assinada", required: true, desc: "Tabela de preços do veículo assinada" },
    ...(!simplesNacional ? [{ key: "declaracaoSimplesNacional", label: "Declaração de Optante pelo Simples Nacional", required: true, desc: "Documento comprovatório de dispensa de retenção do IRRF" }] : []),
    ...(!isMidiaExterna ? [{ key: "comprovantesExibicao", label: "Comprovantes de Exibição", required: true, desc: "Comprovantes de veiculação da campanha (prints, declarações, comprovantes assinados)" }] : []),
    ...(isJornal ? [{ key: "notaFiscalGrafica", label: "Nota Fiscal da Gráfica", required: true, desc: "NF da gráfica comprovando a tiragem do jornal" }] : []),
    ...(isMidiaExterna ? [{ key: "fotoMidiaExterna", label: "Foto do Ponto de Exibição", required: true, desc: "Foto do outdoor/painel no local de veiculação" }] : []),
  ];

  const certidaoLabels = [
    "Certidão Negativa de Débitos Municipais",
    "Certidão Negativa de Débitos Estaduais",
    "Certidão Negativa de Débitos Relativos aos Tributos Federais",
    "Certificado de Regularidade do FGTS - CRF",
    "Certidão Negativa de Débitos Trabalhistas",
  ];

  const certidaoAviso = cliente === "ALESC"
    ? "As certidões devem ter pelo menos 15 dias de validade na data do envio da documentação."
    : "As certidões devem estar válidas no dia da emissão da Nota Fiscal.";

  const handleSubmit = async () => {
    const camposObrigatorios = docFields.filter((f) => f.required);
    const faltando = camposObrigatorios.filter((f) => (docs[f.key] || []).length === 0);

    const certidoesFaltando: string[] = [];
    if (cndsAgrupadas) {
      if ((docs.certidoesAgrupadas || []).length === 0) certidoesFaltando.push("Certidões Negativas (arquivo agrupado)");
    } else {
      [1, 2, 3, 4, 5].forEach((i) => {
        if ((docs[`certidao${i}`] || []).length === 0) certidoesFaltando.push(certidaoLabels[i - 1]);
      });
    }

    if (faltando.length > 0 || certidoesFaltando.length > 0) {
      const nomes = [...faltando.map((f) => f.label), ...certidoesFaltando];
      toast({
        title: "Documentos obrigatórios faltando",
        description: `Anexe os seguintes documentos antes de enviar:\n• ${nomes.join("\n• ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const files: Record<string, File> = {};
    Object.entries(docs).forEach(([key, fileList]) => {
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
      if (result) { setSubmittedData(result); setShowReceipt(true); }
      else toast({ title: "Erro", description: "Falha ao enviar documentação. Tente novamente.", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar documentação", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateDownload = async (url: string, fileName: string) => {
    try { await downloadFileFromUrl(url, fileName); }
    catch { toast({ title: "Erro ao baixar modelo", description: "Tente novamente em instantes.", variant: "destructive" }); }
  };

  if (showReceipt && submittedData) return <SubmissionReceipt submission={submittedData} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Envio de Documentação</h1>
            <p className="text-sm text-muted-foreground">Veículo de Comunicação</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(s)}
                disabled={s > maxStep}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                  ${s <= maxStep && s !== step ? "cursor-pointer hover:opacity-80" : ""}
                  ${s > maxStep ? "cursor-not-allowed opacity-50" : ""}
                `}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </button>
              <span className={`text-sm ${step >= s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s === 1 ? "Informações" : s === 2 ? "Contato" : "Documentos"}
              </span>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informações do PI</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={cliente} onValueChange={(v) => { setCliente(v as Cliente); setCampanha(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>{CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campanha *</Label>
                <Select value={campanha} onValueChange={setCampanha} disabled={!cliente}>
                  <SelectTrigger><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
                  <SelectContent>{campanhasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número do PI *</Label>
                <Input value={numeroPi} onChange={(e) => setNumeroPi(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome do Veículo *</Label>
                <Input value={nomeVeiculo} onChange={(e) => setNomeVeiculo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo do Veículo *</Label>
                <Select value={tipoVeiculo} onValueChange={(v) => setTipoVeiculo(v as TipoVeiculo)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>{TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {tipoVeiculo === "Outro" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Especifique o tipo *</Label>
                  <Input value={outroTipo} onChange={(e) => setOutroTipo(e.target.value)} />
                </div>
              )}
            </div>

            {cliente && (() => {
              const info = ORIENTACOES_CLIENTE[cliente as Cliente];
              if (!info) return null;
              return (
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Orientações para emissão da Nota Fiscal — {cliente}</h3>
                  </div>
                  <div className="text-sm text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-medium">Dados do tomador de serviço</p>
                    <p>CNPJ: {info.cnpj}</p>
                    {info.contratoInfo.map((linha, i) => (
                      <p key={i}>{i === 0 ? "Referências obrigatórias na NF: " : "· "}{linha}</p>
                    ))}
                  </div>
                  <div className="text-sm text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-medium">Regras de emissão</p>
                    <ul className="space-y-1">
                      {info.observacoesNF.map((obs, i) => (
                        <li key={i}>› {obs}</li>
                      ))}
                    </ul>
                  </div>
                  {tipoVeiculo === "Jornal" && (
                    <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Envio físico obrigatório — Jornal</p>
                      </div>
                      <p className="text-sm text-blue-900 dark:text-blue-200">Além do envio digital, encaminhe 2 exemplares originais pelo correio para:</p>
                      <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">{info.enderecoPostal}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end pt-4">
              <Button onClick={() => goToStep(2)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Dados de Contato</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do responsável *</Label>
                <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" placeholder="nome@exemplo.com" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp *</Label>
                <Input value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => goToStep(1)}>Voltar</Button>
              <Button onClick={() => goToStep(3)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Documentação</h2>
            <div className="space-y-4">
              <section className="rounded-xl border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Modelos
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">Baixe primeiro os modelos de apoio para preenchimento, se necessário.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="button" variant="outline" size="sm"
                    className="text-xs gap-1.5 w-full sm:w-auto bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => handleTemplateDownload("/modelos/Modelo_Declaracao_Art_299.pdf", "Modelo_Declaracao_Art_299.pdf")}>
                    <Download className="h-3 w-3" /> Modelo - Declaração Art. 299
                  </Button>
                  <Button type="button" variant="outline" size="sm"
                    className="text-xs gap-1.5 w-full sm:w-auto bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => handleTemplateDownload("/modelos/Modelo_Declaracao_Simples_Nacional.pdf", "Modelo_Declaracao_Simples_Nacional.pdf")}>
                    <Download className="h-3 w-3" /> Modelo - Declaração Simples Nacional
                  </Button>
                </div>
              </section>

              <section className="rounded-xl border p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Documentos a Enviar</h3>
                  <p className="text-sm text-muted-foreground mt-1">Anexe os documentos necessários. Campos com * são obrigatórios. Você pode clicar em "Anexar" ou <strong>arrastar o arquivo</strong> diretamente para o campo.</p>
                </div>

                <div
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    !simplesNacional
                      ? "border-destructive bg-destructive/5"
                      : "border-muted bg-muted/20 hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setSimplesNacional((prev) => !prev)}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    !simplesNacional ? "border-destructive bg-destructive" : "border-muted-foreground/50 bg-background"
                  }`}>
                    {!simplesNacional && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Nossa empresa <strong>não</strong> é optante pelo Simples Nacional</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Marque esta opção apenas se sua empresa <strong>não</strong> for optante pelo Simples Nacional.
                      Caso contrário, deixe desmarcado — a <strong>Declaração de Optante pelo Simples Nacional</strong> já será exigida automaticamente.
                    </p>
                  </div>
                </div>

                {docFields.map(({ key, label, required, desc }) => (
                  <MultiFileUploadField key={key} label={label} description={desc} required={required}
                    files={docs[key] || []} onAdd={(f) => handleAddFile(key, f)} onRemove={(i) => handleRemoveFile(key, i)} />
                ))}

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-warning" /> Certidões Negativas
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">{certidaoAviso}</p>

                  <div
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors mb-4 ${
                      cndsAgrupadas ? "border-primary bg-primary/5" : "border-muted bg-muted/20 hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setCndsAgrupadas((prev) => !prev)}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      cndsAgrupadas ? "border-primary bg-primary" : "border-muted-foreground/50 bg-background"
                    }`}>
                      {cndsAgrupadas && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Tenho todas as certidões em um único arquivo agrupado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ao marcar esta opção, você enviará um único PDF contendo todas as 5 certidões negativas juntas, em vez de enviá-las separadamente.
                      </p>
                    </div>
                  </div>

                  {cndsAgrupadas ? (
                    <MultiFileUploadField
                      label="Certidões Negativas (arquivo agrupado)"
                      description="Um único arquivo contendo todas as 5 certidões: Municipal, Estadual, Federal, FGTS e Trabalhista"
                      required={true}
                      files={docs.certidoesAgrupadas || []}
                      onAdd={(f) => handleAddFile("certidoesAgrupadas", f)}
                      onRemove={(i) => handleRemoveFile("certidoesAgrupadas", i)}
                    />
                  ) : (
                    <div className="space-y-3">
                      {certidaoLabels.map((label, i) => (
                        <MultiFileUploadField key={`certidao${i + 1}`} label={label} required={true}
                          files={docs[`certidao${i + 1}`] || []}
                          onAdd={(f) => handleAddFile(`certidao${i + 1}`, f)}
                          onRemove={(idx) => handleRemoveFile(`certidao${i + 1}`, idx)} />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => goToStep(2)}>Voltar</Button>
              <Button onClick={handleSubmit} className="gap-2" disabled={isSubmitting}>
                <Upload className="h-4 w-4" /> {isSubmitting ? "Enviando..." : "Enviar Documentação"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MultiFileUploadField = ({
  label, description, required, files, onAdd, onRemove,
}: {
  label: string; description?: string; required?: boolean;
  files: File[]; onAdd: (file: File) => void; onRemove: (index: number) => void;
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
    droppedFiles.forEach((file) => {
      const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      if (allowed.includes(ext)) onAdd(file);
    });
  }, [onAdd]);

  return (
    <div
      className={`p-3 rounded-lg border-2 border-dashed transition-colors space-y-2 ${
        isDragging ? "border-primary bg-primary/5" : "border-muted bg-muted/30 hover:bg-muted/50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {label} {required && <span className="text-destructive">*</span>}
          </p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {isDragging && <p className="text-xs text-primary font-medium mt-1">Solte o arquivo aqui...</p>}
        </div>
        <label className="cursor-pointer shrink-0">
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }} />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-accent px-3 py-1.5 rounded-md hover:bg-accent/80 transition-colors">
            <Plus className="h-3 w-3" /> {files.length > 0 ? "Adicionar mais" : "Anexar"}
          </span>
        </label>
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-2 pl-2 py-1 rounded bg-background/50">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
              <Button variant="ghost" size="sm" className="text-destructive h-6 w-6 p-0" onClick={() => onRemove(index)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VeiculoForm;
