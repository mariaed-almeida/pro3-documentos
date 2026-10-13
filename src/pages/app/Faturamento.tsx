import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Receipt } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import MedicaoDialog from "@/components/app/MedicaoDialog";
import MedicaoSheet from "@/components/app/MedicaoSheet";
import { Button } from "@/components/ui/button";
import { useMedicoes, MEDICOES_KEY } from "@/hooks/use-medicoes";
import { useSubmissions } from "@/hooks/use-submissions";
import { useRoles } from "@/hooks/use-roles";
import { STATUS_MEDICAO, type Medicao, type StatusMedicao } from "@/lib/medicoes";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Submission } from "@/lib/types";

type Aba = "a_medir" | StatusMedicao;

const ABAS: { id: Aba; label: string }[] = [
  { id: "aguardando_documentos", label: "Aguardando documentos" },
  { id: "em_medicao", label: "Em medição" },
  { id: "aguardando_liberacao", label: "Aguardando liberação" },
  { id: "liberado", label: "Liberados" },
  { id: "pago", label: "Pagos" },
  { id: "cancelado", label: "Cancelados" },
  { id: "a_medir", label: "Sem PI" },
];

const soma = (lista: Medicao[], campo: "valorBruto" | "comissao" | "valorLiquido") =>
  lista.reduce((acc, m) => acc + m[campo], 0);

const Faturamento = () => {
  const qc = useQueryClient();
  const { data: medicoes = [], isLoading } = useMedicoes();
  const { data: submissions = [] } = useSubmissions();
  const { canOperate } = useRoles();

  const [aba, setAba] = useState<Aba>("em_medicao");
  const [medindo, setMedindo] = useState<Submission | null>(null);
  const [aberta, setAberta] = useState<Medicao | null>(null);

  const medidos = useMemo(() => new Set(medicoes.map((m) => m.submissionId)), [medicoes]);
  const aMedir = useMemo(
    () =>
      submissions
        .filter((s) => s.status === "aprovado" && !medidos.has(s.id))
        .sort((a, b) => +new Date(a.dataEnvio) - +new Date(b.dataEnvio)),
    [submissions, medidos],
  );

  const por = (st: StatusMedicao) => medicoes.filter((m) => m.status === st);
  const lista = aba === "a_medir" ? [] : por(aba);
  const refresh = () => qc.invalidateQueries({ queryKey: MEDICOES_KEY });

  const resumo = [
    { label: "Aguardando documentos", valor: formatBRL(soma(por("aguardando_documentos"), "valorLiquido")), nota: `${por("aguardando_documentos").length} PIs` },
    { label: "Em medição", valor: formatBRL(soma(por("em_medicao"), "valorLiquido")), nota: `${por("em_medicao").length} medições` },
    {
      label: "No financeiro",
      valor: formatBRL(soma(por("aguardando_liberacao"), "valorLiquido")),
      nota: `${por("aguardando_liberacao").length} aguardando liberação`,
    },
    { label: "Liberado a pagar", valor: formatBRL(soma(por("liberado"), "valorLiquido")), nota: `${por("liberado").length} medições` },
    { label: "Pago", valor: formatBRL(soma(por("pago"), "valorLiquido")), nota: `${por("pago").length} medições` },
  ];

  const dataRelevante = (m: Medicao) => {
    if (m.status === "pago") return m.pagoEm ? `Pago em ${formatDate(m.pagoEm)}` : "—";
    if (m.status === "liberado") return m.previsaoPagamento ? `Previsto ${formatDate(m.previsaoPagamento)}` : "Sem previsão";
    if (m.vencimento) return `Vence ${formatDate(m.vencimento)}`;
    if (m.status === "aguardando_liberacao") return m.enviadoEm ? `Enviado ${formatDate(m.enviadoEm)}` : "—";
    return `Criado ${formatDate(m.createdAt)}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Faturamento"
        description="Cada PI emitido abre a sua medição, com os mesmos valores e o mesmo vencimento. Os documentos aprovados a movem adiante, o financeiro libera e registra o pagamento, e qualquer etapa pode voltar com o motivo."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/gerencial">Ver visão gerencial</Link>
          </Button>
        }
      />

      <dl className="grid grid-cols-2 divide-x divide-y rounded-md border bg-card lg:grid-cols-5 lg:divide-y-0">
        {resumo.map((r) => (
          <div key={r.label} className="px-4 py-4">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="num mt-1.5 font-serif text-2xl leading-none">{r.valor}</dd>
            <p className="mt-1.5 text-xs text-muted-foreground">{r.nota}</p>
          </div>
        ))}
      </dl>

      <div className="flex gap-6 overflow-x-auto border-b" role="tablist">
        {ABAS.filter((a) => a.id !== "a_medir" || aMedir.length > 0 || aba === "a_medir").map((a) => {
          const n = a.id === "a_medir" ? aMedir.length : por(a.id).length;
          return (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 pb-3 text-sm transition-colors",
                aba === a.id
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {a.label} <span className="num ml-1 text-xs opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : aba === "a_medir" ? (
        aMedir.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhum PI aguardando medição" description="PIs aprovados aparecem aqui até receberem valores." />
        ) : (
          <ul className="divide-y overflow-hidden rounded-md border bg-card">
            {aMedir.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <Link to={`/app/documentos/${s.id}`} className="num font-medium hover:text-primary">
                      PI {s.numeroPi}
                    </Link>
                    <span className="text-muted-foreground"> · {s.nomeVeiculo}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.cliente} · {s.campanha}
                  </p>
                </div>
                <span className="num hidden text-xs text-muted-foreground sm:block">Sem PI no sistema · enviado {formatDate(s.dataEnvio)}</span>
                {canOperate && (
                  <Button size="sm" variant="outline" onClick={() => setMedindo(s)}>
                    Medir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : lista.length === 0 ? (
        <EmptyState icon={Receipt} title="Nada por aqui" description={STATUS_MEDICAO[aba].hint + "."} />
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="eyebrow px-4 py-2.5">PI · veículo</th>
                <th className="eyebrow hidden px-4 py-2.5 lg:table-cell">Cliente · campanha</th>
                <th className="eyebrow px-4 py-2.5 text-right">Bruto</th>
                <th className="eyebrow hidden px-4 py-2.5 text-right md:table-cell">Comissão</th>
                <th className="eyebrow px-4 py-2.5 text-right">Líquido</th>
                <th className="eyebrow hidden px-4 py-2.5 sm:table-cell">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((m) => (
                <tr key={m.id} onClick={() => setAberta(m)} className="cursor-pointer align-top hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <p className="num font-medium">PI {m.numeroPi}</p>
                    <p className="text-xs text-muted-foreground">{m.nomeVeiculo}</p>
                  </td>
                  <td className="hidden max-w-[16rem] px-4 py-3 lg:table-cell">
                    <p className="truncate">{m.cliente}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.campanha}</p>
                  </td>
                  <td className="num px-4 py-3 text-right">{formatBRL(m.valorBruto)}</td>
                  <td className="num hidden px-4 py-3 text-right text-muted-foreground md:table-cell">{formatBRL(m.comissao)}</td>
                  <td className="num px-4 py-3 text-right font-medium">{formatBRL(m.valorLiquido)}</td>
                  <td className="num hidden whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {dataRelevante(m)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40">
                <td className="eyebrow px-4 py-2.5" colSpan={2}>
                  Total · {lista.length}
                </td>
                <td className="num px-4 py-2.5 text-right font-medium">{formatBRL(soma(lista, "valorBruto"))}</td>
                <td className="num hidden px-4 py-2.5 text-right md:table-cell">{formatBRL(soma(lista, "comissao"))}</td>
                <td className="num px-4 py-2.5 text-right font-medium">{formatBRL(soma(lista, "valorLiquido"))}</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <MedicaoDialog
        open={!!medindo}
        onOpenChange={(o) => !o && setMedindo(null)}
        submission={medindo}
        onSaved={() => {
          setMedindo(null);
          refresh();
          setAba("em_medicao");
        }}
      />
      <MedicaoSheet medicao={aberta} onClose={() => setAberta(null)} onChanged={refresh} />
    </div>
  );
};

export default Faturamento;
