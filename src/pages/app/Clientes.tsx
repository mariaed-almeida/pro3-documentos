import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/app/PageHeader";
import Panel from "@/components/app/Panel";
import { useSubmissions } from "@/hooks/use-submissions";
import { getCampaigns } from "@/lib/campaigns";
import { CLIENTES, ORIENTACOES_CLIENTE } from "@/lib/clientes";

const Clientes = () => {
  const { data: submissions = [] } = useSubmissions();
  const { data: campanhas = [] } = useQuery({ queryKey: ["campanhas"], queryFn: () => getCampaigns() });

  const resumo = useMemo(
    () =>
      Object.fromEntries(
        CLIENTES.map((c) => {
          const envios = submissions.filter((s) => s.cliente === c);
          return [
            c,
            {
              envios: envios.length,
              pendentes: envios.filter((s) => s.status === "recebido" || s.status === "em_revisao").length,
              campanhas: campanhas.filter((x) => x.cliente === c && x.ativa).length,
            },
          ];
        }),
      ),
    [submissions, campanhas],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cadastros"
        title="Clientes"
        description="Contratos, endereço de correspondência e regras de faturamento exigidas de cada cliente."
      />

      <div className="space-y-6">
        {CLIENTES.map((nome) => {
          const o = ORIENTACOES_CLIENTE[nome];
          const r = resumo[nome];
          return (
            <Panel
              key={nome}
              title={nome}
              description={`CNPJ ${o.cnpj}`}
              actions={
                <Link
                  to={`/app/documentos?cliente=${encodeURIComponent(nome)}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver documentos
                </Link>
              }
            >
              <dl className="mb-6 grid grid-cols-3 divide-x rounded-md border bg-background/60 text-center">
                {(
                  [
                    ["Envios", r.envios],
                    ["Em aberto", r.pendentes],
                    ["Campanhas ativas", r.campanhas],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="px-3 py-3">
                    <dd className="num font-serif text-2xl">{v}</dd>
                    <dt className="text-[11px] text-muted-foreground">{l}</dt>
                  </div>
                ))}
              </dl>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="eyebrow mb-2">Contrato e licitação</p>
                  <ul className="space-y-1 text-sm">
                    {o.contratoInfo.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="eyebrow mb-2 mt-5">Endereço postal</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{o.enderecoPostal}</p>
                </div>
                <div>
                  <p className="eyebrow mb-2">Regras da nota fiscal</p>
                  <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-border">
                    {o.observacoesNF.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Os dados de cliente ainda vivem no código. A migração para tabela própria, com edição por administradores, entra junto com o novo banco.
      </p>
    </div>
  );
};

export default Clientes;
