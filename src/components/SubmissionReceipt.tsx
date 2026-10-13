import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Submission } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  baixarProtocoloPdf,
  dadosDoComprovante,
  gerarProtocolo,
  listarDocumentosRecebidos,
} from "@/lib/protocolo-pdf";
import logoPro3 from "@/assets/logo-pro3.png";

interface Props {
  submission: Submission;
}

const SubmissionReceipt = ({ submission }: Props) => {
  const { toast } = useToast();
  const [gerando, setGerando] = useState(false);
  const protocolo = gerarProtocolo(submission);
  const dados = dadosDoComprovante(submission);
  const documentos = listarDocumentosRecebidos(submission);

  const salvarPdf = async () => {
    setGerando(true);
    try {
      await baixarProtocoloPdf(submission);
    } catch {
      toast({ title: "Não foi possível gerar o PDF", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-[42rem] items-center px-5 py-4">
          <img src={logoPro3} alt="Pró3 Comunicação" className="h-9 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-[42rem] px-5 pb-20 pt-10">
        <p className="eyebrow mb-2">Documentos recebidos</p>
        <h1 className="text-3xl">Comprovante de envio</h1>

        <div className="mt-8 border-y py-5">
          <p className="eyebrow">Número de protocolo</p>
          <p className="num mt-1 break-all font-serif text-3xl tracking-tight sm:text-4xl" aria-label={`Protocolo ${protocolo}`}>
            {protocolo}
          </p>
        </div>

        <dl className="divide-y border-b">
          {dados.map(({ rotulo, valor }) => (
            <div key={rotulo} className="grid gap-0.5 py-3 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="break-words">{valor}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-10" aria-labelledby="docs-recebidos">
          <h2 id="docs-recebidos" className="text-xl">Documentos recebidos</h2>
          {documentos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum documento registrado.</p>
          ) : (
            <ol className="mt-3 divide-y border-y">
              {documentos.map(({ rotulo, arquivo }, i) => (
                <li key={`${rotulo}-${i}`} className="grid grid-cols-[1.75rem_1fr] gap-x-2 py-3 text-sm sm:grid-cols-[1.75rem_15rem_1fr]">
                  <span className="num text-xs leading-5 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium">{rotulo}</span>
                  <span className="col-start-2 [overflow-wrap:anywhere] text-muted-foreground sm:col-start-3">{arquivo}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="mt-8 border-l-2 pl-3 text-sm text-muted-foreground">
          Guarde este comprovante. A Pró3 confere a documentação e avisa por e-mail se algo precisar de correção.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button onClick={salvarPdf} disabled={gerando}>
            {gerando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {gerando ? "Gerando PDF" : "Salvar como PDF"}
          </Button>
          <Link
            to="/"
            className="rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Voltar ao início
          </Link>
          <button
            type="button"
            onClick={() => window.location.assign("/veiculo")}
            className="rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Enviar outro documento
          </button>
        </div>
      </main>
    </div>
  );
};

export default SubmissionReceipt;
