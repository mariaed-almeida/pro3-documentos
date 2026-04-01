import { ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle, Eye, User, Mail, Phone, Download, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Submission, StatusDocumento } from "@/lib/types";

const statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }> = {
  pendente: { label: "Pendente", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  em_analise: { label: "Em Análise", icon: Eye, className: "bg-primary/10 text-primary border-primary/20" },
  corrigido: { label: "Corrigido", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  rejeitado: { label: "Rejeitado", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface Props {
  submission: Submission;
  onBack: () => void;
  onStatusUpdate: (id: string, status: StatusDocumento) => void;
}

const SubmissionDetail = ({ submission, onBack, onStatusUpdate }: Props) => {
  const cfg = statusConfig[submission.status];
  const StatusIcon = cfg.icon;

  const docLabels: Record<string, string> = {
    piAssinado: "PI Assinado",
    declaracaoSimplesNacional: "Declaração Simples Nacional",
    comprovantesExibicao: "Comprovantes de Exibição",
    declaracaoArtigo299: "Declaração do Artigo 299",
    tabelaPrecoAssinada: "Tabela de Preço Assinada",
  };

  const allStatuses: StatusDocumento[] = ["pendente", "em_analise", "corrigido", "rejeitado"];

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
          <span>{submission.cliente}</span>
          <span>/</span>
          <span>{submission.campanha}</span>
          <span>/</span>
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
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{submission.contatoNome}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{submission.contatoEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{submission.contatoTelefone}</span>
            </div>
            {submission.cidade && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{submission.cidade}</span>
              </div>
            )}
            {submission.observacoes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Observações:</p>
                <p className="text-sm text-foreground">{submission.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents with view capability */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Documentos Anexados</h3>
          <div className="space-y-2">
            {Object.entries(submission.documentos).map(([key, val]) => {
              if (!val || (Array.isArray(val) && val.length === 0)) return null;
              const label = docLabels[key] || key;
              if (Array.isArray(val)) {
                return val.map((v, i) => (
                  <DocRow key={`${key}-${i}`} label={`Certidão ${i + 1}`} value={v} />
                ));
              }
              return <DocRow key={key} label={label} value={val as string} />;
            })}
          </div>
          {Object.values(submission.documentos).every(v => !v || (Array.isArray(v) && v.length === 0)) && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento anexado.</p>
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
                <Button
                  key={st}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onStatusUpdate(submission.id, st)}
                  disabled={isActive}
                >
                  <Icon className="h-3 w-3 mr-1.5" />
                  {c.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground text-right max-w-[60%]">{value}</span>
  </div>
);

const DocRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
    <FileText className="h-4 w-4 text-primary shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground truncate">{value}</p>
    </div>
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary gap-1" onClick={() => {
      // In production with real file storage, this would open/download the file
      alert(`Visualizando: ${value}\n\n(Em produção, o arquivo seria aberto/baixado via Lovable Cloud Storage)`);
    }}>
      <Eye className="h-3 w-3" /> Ver
    </Button>
  </div>
);

export default SubmissionDetail;
