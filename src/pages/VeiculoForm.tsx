import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, CheckCircle2, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Cliente, TipoVeiculo, CAMPANHAS, Submission } from "@/lib/types";
import { addSubmission, storeFileReference } from "@/lib/store";
import SubmissionReceipt from "@/components/SubmissionReceipt";

const CLIENTES: Cliente[] = ["ALESC", "Prefeitura de Xanxerê", "Prefeitura de Chapecó"];
const TIPOS_VEICULO: TipoVeiculo[] = ["Jornal", "Rádio", "Televisão", "Portal", "Mídia Externa", "Outro"];

interface DocFile {
  file: File | null;
  name: string;
}

const VeiculoForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submittedData, setSubmittedData] = useState<Submission | null>(null);

  // Form state
  const [cliente, setCliente] = useState<Cliente | "">("");
  const [campanha, setCampanha] = useState("");
  const [numeroPi, setNumeroPi] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo | "">("");
  const [outroTipo, setOutroTipo] = useState("");
  const [nomeVeiculo, setNomeVeiculo] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Document files
  const [docs, setDocs] = useState<Record<string, DocFile>>({
    piAssinado: { file: null, name: "" },
    declaracaoSimplesNacional: { file: null, name: "" },
    comprovantesExibicao: { file: null, name: "" },
    declaracaoArtigo299: { file: null, name: "" },
    certidao1: { file: null, name: "" },
    certidao2: { file: null, name: "" },
    certidao3: { file: null, name: "" },
    certidao4: { file: null, name: "" },
    certidao5: { file: null, name: "" },
    tabelaPrecoAssinada: { file: null, name: "" },
  });

  const handleFileChange = (key: string, file: File | null) => {
    setDocs((prev) => ({
      ...prev,
      [key]: { file, name: file?.name || "" },
    }));
  };

  const campanhasDisponiveis = cliente ? CAMPANHAS[cliente] : [];

  const validateStep1 = () => {
    if (!cliente || !campanha || !numeroPi || !tipoVeiculo || !nomeVeiculo) {
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

  const handleSubmit = () => {
    // Check required documents
    if (!docs.piAssinado.file) {
      toast({ title: "Documento obrigatório", description: "O PI Assinado é obrigatório.", variant: "destructive" });
      return;
    }

    const id = crypto.randomUUID();
    const submission: Submission = {
      id,
      cliente: cliente as Cliente,
      campanha,
      numeroPi,
      tipoVeiculo: tipoVeiculo as TipoVeiculo,
      outroTipo: tipoVeiculo === "Outro" ? outroTipo : undefined,
      nomeVeiculo,
      contatoNome,
      contatoEmail,
      contatoTelefone,
      documentos: {
        piAssinado: docs.piAssinado.name,
        declaracaoSimplesNacional: docs.declaracaoSimplesNacional.name || undefined,
        comprovantesExibicao: docs.comprovantesExibicao.name || undefined,
        declaracaoArtigo299: docs.declaracaoArtigo299.name || undefined,
        certidoesNegativas: [
          docs.certidao1.name, docs.certidao2.name, docs.certidao3.name,
          docs.certidao4.name, docs.certidao5.name,
        ].filter(Boolean),
        tabelaPrecoAssinada: docs.tabelaPrecoAssinada.name || undefined,
      },
      status: "pendente",
      dataEnvio: new Date().toISOString(),
      observacoes: observacoes || undefined,
    };

    addSubmission(submission);

    // Store file references
    Object.entries(docs).forEach(([key, val]) => {
      if (val.file) storeFileReference(id, key, val.name);
    });

    setSubmittedData(submission);
    setShowReceipt(true);
  };

  if (showReceipt && submittedData) {
    return <SubmissionReceipt submission={submittedData} />;
  }

  const docFields = [
    { key: "piAssinado", label: "PI Assinado", required: true, desc: "Pedido de Inserção devidamente assinado" },
    { key: "declaracaoSimplesNacional", label: "Declaração Simples Nacional", required: false, desc: "Documento comprovatório de dispensa de retenção do IRRF" },
    { key: "comprovantesExibicao", label: "Comprovantes de Exibição", required: false, desc: "Comprovantes de veiculação da campanha" },
    { key: "declaracaoArtigo299", label: "Declaração do Artigo 299", required: false, desc: "Declaração conforme Art. 299 do Código Penal" },
    { key: "tabelaPrecoAssinada", label: "Tabela de Preço Assinada", required: false, desc: "Tabela de preços do veículo assinada" },
  ];

  const certidaoLabels = [
    "Certidão Negativa Federal (RFB/PGFN)",
    "Certidão Negativa Estadual",
    "Certidão Negativa Municipal",
    "Certidão Negativa FGTS",
    "Certidão Negativa Trabalhista (CNDT)",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Progress */}
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

        {/* Step 1: Basic Info */}
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

        {/* Step 2: Contact */}
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

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="bg-card rounded-lg border p-6 animate-fade-in space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Documentação</h2>
            <p className="text-sm text-muted-foreground">Anexe os documentos necessários. Campos com * são obrigatórios.</p>

            <div className="space-y-4">
              {docFields.map(({ key, label, required, desc }) => (
                <FileUploadField
                  key={key}
                  label={label}
                  description={desc}
                  required={required}
                  file={docs[key]?.file}
                  onChange={(f) => handleFileChange(key, f)}
                />
              ))}

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Certidões Negativas (5 obrigatórias)
                </h3>
                <div className="space-y-3">
                  {certidaoLabels.map((label, i) => (
                    <FileUploadField
                      key={`certidao${i + 1}`}
                      label={label}
                      required={false}
                      file={docs[`certidao${i + 1}`]?.file}
                      onChange={(f) => handleFileChange(`certidao${i + 1}`, f)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={handleSubmit} className="gap-2">
                <Upload className="h-4 w-4" /> Enviar Documentação
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FileUploadField = ({
  label, description, required, file, onChange,
}: {
  label: string;
  description?: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-dashed bg-muted/30 hover:bg-muted/50 transition-colors">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <div className="flex items-center gap-2">
      {file ? (
        <>
          <FileText className="h-4 w-4 text-success shrink-0" />
          <span className="text-xs text-foreground truncate max-w-[150px]">{file.name}</span>
          <Button variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={() => onChange(null)}>
            ✕
          </Button>
        </>
      ) : (
        <label className="cursor-pointer">
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => onChange(e.target.files?.[0] || null)} />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-accent px-3 py-1.5 rounded-md hover:bg-accent/80 transition-colors">
            <Upload className="h-3 w-3" /> Anexar
          </span>
        </label>
      )}
    </div>
  </div>
);

export default VeiculoForm;
