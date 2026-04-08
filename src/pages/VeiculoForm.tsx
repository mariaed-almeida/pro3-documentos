import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckCircle2, FileText, AlertCircle, Plus, X, Download } from "lucide-react";
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

const CLIENTES: Cliente[] = ["ALESC", "Prefeitura de Xanxerê", "Prefeitura de Chapecó"];
const TIPOS_VEICULO: TipoVeiculo[] = ["Jornal", "Rádio", "Televisão", "Portal", "Mídia Externa", "Outro"];

const VeiculoForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
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

  // Multi-file support: each doc key maps to an array of files
  const [docs, setDocs] = useState<Record<string, File[]>>({
    piAssinado: [],
    notaFiscal: [],
    declaracaoSimplesNacional: [],
    comprovantesExibicao: [],
    declaracaoArtigo299: [],
    certidao1: [],
    certidao2: [],
    certidao3: [],
    certidao4: [],
    certidao5: [],
    tabelaPrecoAssinada: [],
  });

  const handleAddFile = (key: string, file: File) => {
    setDocs((prev) => ({ ...prev, [key]: [...(prev[key] || []), file] }));
  };

  const handleRemoveFile = (key: string, index: number) => {
    setDocs((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const [campanhasDisponiveis, setCampanhasDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    if (cliente) {
      getActiveCampaigns(cliente).then(setCampanhasDisponiveis);
    } else {
      setCampanhasDisponiveis([]);
    }
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

  const handleSubmit = async () => {
    if (cliente !== "ALESC" && docs.piAssinado.length === 0) {
      toast({ title: "Documento obrigatório", description: "O PI Assinado é obrigatório.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    // Flatten multi-file docs into indexed keys for the store
    const files: Record<string, File> = {};
    Object.entries(docs).forEach(([key, fileList]) => {
      fileList.forEach((file, index) => {
        if (fileList.length === 1) {
          files[key] = file;
        } else {
          files[`${key}__${index + 1}`] = file;
        }
      });
    });

    try {
      const result = await addSubmission(
        {
          cliente: cliente as Cliente,
          campanha,
          numeroPi,
          tipoVeiculo: tipoVeiculo as TipoVeiculo,
          outroTipo: tipoVeiculo === "Outro" ? outroTipo : undefined,
          nomeVeiculo,
          cidade,
          contatoNome,
          contatoEmail,
          contatoTelefone,
          observacoes: observacoes || undefined,
        },
        files
      );

      if (result) {
        setSubmittedData(result);
        setShowReceipt(true);
      } else {
        toast({ title: "Erro", description: "Falha ao enviar documentação. Tente novamente.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao enviar documentação.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showReceipt && submittedData) {
    return <SubmissionReceipt submission={submittedData} />;
  }

  const docFields = [
    ...(cliente !== "ALESC" ? [{ key: "piAssinado", label: "PI Assinado", required: true, desc: "Pedido de Inserção devidamente assinado" }] : []),
    { key: "notaFiscal", label: "Nota Fiscal", required: false, desc: "Nota Fiscal referente ao serviço prestado" },
    { key: "declaracaoSimplesNacional", label: "Declaração como Optante pelo Simples Nacional", required: false, desc: "Documento comprovatório de dispensa de retenção do IRRF (Caso não seja Optante, não inclua nenhum documento)" },
    { key: "comprovantesExibicao", label: "Comprovantes de Exibição", required: false, desc: "Comprovantes de veiculação da campanha" },
    { key: "declaracaoArtigo299", label: "Declaração do Artigo 299", required: false, desc: "Declaração conforme Art. 299 do Código Penal" },
    { key: "tabelaPrecoAssinada", label: "Tabela de Preço Assinada", required: false, desc: "Tabela de preços do veículo assinada" },
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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Envio de Documentação</h1>
            <p className="text-sm text-muted-foreground">Veículo de Comunicação</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={`text-sm hidden sm:inline ${step >= s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s === 1 ? "Informações" : s === 2 ? "Contato" : "Documentos"}
              </span>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-5">
            <h2 className="text-lg font-semibold text-foreground">Informações do PI</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={cliente} onValueChange={(v) => { setCliente(v as Cliente); setCampanha(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campanha *</Label>
                <Select value={campanha} onValueChange={setCampanha} disabled={!cliente}>
                  <SelectTrigger><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
                  <SelectContent>
                    {campanhasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número do PI *</Label>
                <Input placeholder="Ex: 5001" value={numeroPi} onChange={(e) => setNumeroPi(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome do Veículo *</Label>
                <Input placeholder="Ex: Portal Sou Catarina" value={nomeVeiculo} onChange={(e) => setNomeVeiculo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input placeholder="Ex: Xaxim" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo do Veículo *</Label>
                <Select value={tipoVeiculo} onValueChange={(v) => setTipoVeiculo(v as TipoVeiculo)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {tipoVeiculo === "Outro" && (
                <div className="space-y-2">
                  <Label>Especifique o tipo *</Label>
                  <Input placeholder="Descreva o tipo" value={outroTipo} onChange={(e) => setOutroTipo(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => validateStep1() && setStep(2)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-5">
            <h2 className="text-lg font-semibold text-foreground">Dados de Contato</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome do responsável *</Label>
                <Input placeholder="Nome completo" value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" placeholder="email@exemplo.com" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp *</Label>
                <Input placeholder="(49) 99999-9999" value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea placeholder="Informações adicionais..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => validateStep2() && setStep(3)}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Documentação</h2>
            <p className="text-sm text-muted-foreground">Anexe os documentos necessários. Campos com * são obrigatórios. Você pode adicionar mais de um arquivo por item.</p>
            <div className="space-y-4">
              {docFields.map(({ key, label, required, desc }) => (
                <MultiFileUploadField
                  key={key}
                  label={label}
                  description={desc}
                  required={required}
                  files={docs[key] || []}
                  onAdd={(f) => handleAddFile(key, f)}
                  onRemove={(i) => handleRemoveFile(key, i)}
                />
              ))}

              {/* Modelos de documentos para download */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Modelos de Declarações
                </h3>
                <p className="text-xs text-muted-foreground mb-3">Baixe os modelos para preenchimento, caso necessário.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a href="/modelos/Modelo_Declaracao_Art_299.pdf" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 w-full sm:w-auto">
                      <Download className="h-3 w-3" /> Modelo - Declaração Art. 299
                    </Button>
                  </a>
                  <a href="/modelos/Modelo_Declaracao_Simples_Nacional.pdf" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 w-full sm:w-auto">
                      <Download className="h-3 w-3" /> Modelo - Declaração Simples Nacional
                    </Button>
                  </a>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Certidões Negativas
                </h3>
                <p className="text-xs text-muted-foreground mb-3">{certidaoAviso}</p>
                <div className="space-y-3">
                  {certidaoLabels.map((label, i) => (
                    <MultiFileUploadField
                      key={`certidao${i + 1}`}
                      label={label}
                      required={false}
                      files={docs[`certidao${i + 1}`] || []}
                      onAdd={(f) => handleAddFile(`certidao${i + 1}`, f)}
                      onRemove={(idx) => handleRemoveFile(`certidao${i + 1}`, idx)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
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
  label: string;
  description?: string;
  required?: boolean;
  files: File[];
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
}) => (
  <div className="p-3 rounded-lg border border-dashed bg-muted/30 hover:bg-muted/50 transition-colors space-y-2">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <label className="cursor-pointer shrink-0">
        <input
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAdd(f);
            e.target.value = "";
          }}
        />
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

export default VeiculoForm;
