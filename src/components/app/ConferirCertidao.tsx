import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { linkDeConferencia, type Certidao } from "@/lib/certidoes";

/** Copia o código de validação e abre o site do órgão para colar. */
const ConferirCertidao = ({ certidao }: { certidao: Certidao }) => {
  const { toast } = useToast();
  const link = linkDeConferencia(certidao);

  const copiar = async () => {
    if (!certidao.codigo) return false;
    try {
      await navigator.clipboard.writeText(certidao.codigo);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {link ? (
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const copiado = await copiar();
            if (copiado) toast({ title: "Código copiado", description: "Cole no campo de conferência do site que abriu." });
            window.open(link, "_blank", "noopener,noreferrer");
          }}
        >
          <ExternalLink /> Conferir
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Sem link</span>
      )}
      {certidao.codigo && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Copiar código de validação"
          aria-label="Copiar código de validação"
          onClick={async () => {
            if (await copiar()) toast({ title: "Código copiado" });
          }}
        >
          <Copy />
        </Button>
      )}
    </div>
  );
};

export default ConferirCertidao;
