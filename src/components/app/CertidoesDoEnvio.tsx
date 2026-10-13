import Panel from "@/components/app/Panel";
import ConferirCertidao from "@/components/app/ConferirCertidao";
import { useCertidoes } from "@/hooks/use-certidoes";
import { diasParaVencer, ORGAO_LABEL, SITUACAO_LABEL, type Certidao } from "@/lib/certidoes";
import { mascararCnpj } from "@/lib/cnpj";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const validadeDe = (c: Certidao) => {
  const d = diasParaVencer(c.validade);
  if (d === null) return { texto: "Sem validade lida", tom: "text-muted-foreground" };
  if (d < 0) return { texto: `Vencida em ${formatDate(c.validade!)}`, tom: "text-destructive" };
  if (d <= 30) return { texto: `Vence em ${formatDate(c.validade!)} (${d} ${d === 1 ? "dia" : "dias"})`, tom: "text-warning" };
  return { texto: `Válida até ${formatDate(c.validade!)}`, tom: "text-muted-foreground" };
};

/** Certidões que a IA leu neste envio, com atalho para conferir no site do órgão. */
const CertidoesDoEnvio = ({ submissionId }: { submissionId: string }) => {
  const { data = [] } = useCertidoes();
  const lista = data.filter((c) => c.submissionId === submissionId);
  if (lista.length === 0) return null;

  return (
    <Panel title="Certidões lidas" description="Conferir copia o código de validação e abre o site do órgão emissor." bodyClassName="p-0">
      <ul className="divide-y">
        {lista.map((c) => {
          const v = validadeDe(c);
          return (
            <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {ORGAO_LABEL[c.orgao]}
                  {c.situacao && <span className="font-normal text-muted-foreground"> · {SITUACAO_LABEL[c.situacao] ?? c.situacao}</span>}
                </p>
                <p className="num mt-0.5 text-xs text-muted-foreground">
                  {c.cnpj ? mascararCnpj(c.cnpj) : "CNPJ não lido"}
                  {c.cnpjConfere === false && <span className="ml-2 text-destructive">diferente do cadastro</span>}
                </p>
                <p className={cn("mt-0.5 text-xs", v.tom)}>{v.texto}</p>
              </div>
              <ConferirCertidao certidao={c} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

export default CertidoesDoEnvio;
