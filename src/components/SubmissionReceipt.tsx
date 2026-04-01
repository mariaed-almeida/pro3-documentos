import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileText, ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Submission } from "@/lib/types";

interface Props {
  submission: Submission;
}

const SubmissionReceipt = ({ submission }: Props) => {
  const navigate = useNavigate();
  const date = new Date(submission.dataEnvio);

  const docLabels: Record<string, string> = {
    piAssinado: "PI Assinado",
    declaracaoSimplesNacional: "Declaração Simples Nacional",
    comprovantesExibicao: "Comprovantes de Exibição",
    declaracaoArtigo299: "Declaração do Artigo 299",
    tabelaPrecoAssinada: "Tabela de Preço Assinada",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-card rounded-lg border max-w-lg w-full p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Documentação Enviada!</h1>
          <p className="text-muted-foreground mt-1">Comprovante de envio</p>
        </div>

        <div className="border rounded-lg p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protocolo</span>
            <span className="font-mono font-semibold text-foreground">{submission.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data/Hora</span>
            <span className="text-foreground">{date.toLocaleString("pt-BR")}</span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="text-foreground font-medium">{submission.cliente}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campanha</span>
            <span className="text-foreground text-right max-w-[200px]">{submission.campanha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PI Nº</span>
            <span className="text-foreground font-medium">{submission.numeroPi}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Veículo</span>
            <span className="text-foreground">{submission.nomeVeiculo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <span className="text-foreground">{submission.tipoVeiculo === "Outro" ? submission.outroTipo : submission.tipoVeiculo}</span>
          </div>

          <div className="border-t pt-3">
            <p className="text-muted-foreground mb-2">Documentos enviados:</p>
            <div className="space-y-1">
              {Object.entries(submission.documentos).map(([key, val]) => {
                if (!val || (Array.isArray(val) && val.length === 0)) return null;
                const label = docLabels[key] || key;
                if (Array.isArray(val)) {
                  return val.map((v, i) => (
                    <div key={`${key}-${i}`} className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-success" />
                      <span className="text-foreground text-xs">Certidão {i + 1}: {v}</span>
                    </div>
                  ));
                }
                return (
                  <div key={key} className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-success" />
                    <span className="text-foreground text-xs">{label}: {val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button className="flex-1" onClick={() => navigate("/")}>
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionReceipt;
