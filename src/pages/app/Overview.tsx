import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileStack, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageHeader from "@/components/app/PageHeader";
import Panel from "@/components/app/Panel";
import StatusBadge from "@/components/app/StatusBadge";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { useSubmissions } from "@/hooks/use-submissions";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { daysSince, formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const Overview = () => {
  const { data: submissions = [], isLoading } = useSubmissions();

  const counts = useMemo(
    () => Object.fromEntries(STATUS_ORDER.map((st) => [st, submissions.filter((s) => s.status === st).length])),
    [submissions],
  );

  const fila = useMemo(
    () =>
      submissions
        .filter((s) => s.status === "recebido")
        .sort((a, b) => +new Date(a.dataEnvio) - +new Date(b.dataEnvio))
        .slice(0, 6),
    [submissions],
  );

  const recentes = useMemo(() => submissions.slice(0, 6), [submissions]);

  const porCliente = useMemo(() => {
    const map = new Map<string, { total: number; pendentes: number }>();
    for (const s of submissions) {
      const cur = map.get(s.cliente) ?? { total: 0, pendentes: 0 };
      cur.total += 1;
      if (s.status === "recebido" || s.status === "em_revisao") cur.pendentes += 1;
      map.set(s.cliente, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [submissions]);

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={hoje}
        title="Visão geral"
        description={
          counts.recebido
            ? `${counts.recebido} ${counts.recebido === 1 ? "envio aguarda" : "envios aguardam"} conferência.`
            : "Nenhum envio aguardando conferência."
        }
        actions={
          <Button asChild>
            <Link to="/app/aprovacoes">
              Abrir fila de aprovação <ArrowRight />
            </Link>
          </Button>
        }
      />

      {/* Faixa de números: separada por filetes, sem caixas */}
      <dl className="grid grid-cols-2 divide-x divide-y rounded-md border bg-card sm:grid-cols-4 sm:divide-y-0">
        {STATUS_ORDER.map((st) => (
          <Link
            key={st}
            to={`/app/documentos?status=${st}`}
            className="group px-5 py-5 transition-colors hover:bg-accent/50"
          >
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[st].dot)} />
              {STATUS[st].label}
            </dt>
            <dd className="num mt-2 font-serif text-4xl leading-none">{counts[st]}</dd>
            <p className="mt-2 text-xs text-muted-foreground">{STATUS[st].hint}</p>
          </Link>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Mais antigos na fila"
          description="Recebidos há mais tempo, ainda sem conferência."
          bodyClassName="p-0"
          actions={
            <Link to="/app/aprovacoes" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          {fila.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FileStack} title="Fila vazia" description="Todos os envios recebidos já foram conferidos." />
            </div>
          ) : (
            <ul className="divide-y">
              {fila.map((s) => {
                const dias = daysSince(s.dataEnvio);
                return (
                  <li key={s.id}>
                    <Link
                      to={`/app/documentos/${s.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          PI {s.numeroPi} <span className="font-normal text-muted-foreground">· {s.nomeVeiculo}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.cliente} · {s.campanha}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "num shrink-0 text-xs",
                          dias >= 5 ? "font-medium text-warning" : "text-muted-foreground",
                        )}
                      >
                        {dias === 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="Por cliente" description="Envios totais e pendentes de resolução.">
          {porCliente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-4">
              {porCliente.map(([cliente, v]) => (
                <li key={cliente}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{cliente}</span>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {v.pendentes} pendentes · {v.total}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(v.total / Math.max(...porCliente.map(([, x]) => x.total))) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Atividade recente"
        bodyClassName="p-0"
        actions={
          <Link to="/app/documentos" className="text-xs font-medium text-primary hover:underline">
            Todos os documentos
          </Link>
        }
      >
        {recentes.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FileStack} title="Nenhum envio ainda" description="Os envios dos veículos aparecem aqui." />
          </div>
        ) : (
          <ul className="divide-y">
            {recentes.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/app/documentos/${s.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{s.nomeVeiculo}</span>
                      <span className="text-muted-foreground"> enviou o PI {s.numeroPi}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.cliente} · {formatDate(s.dataEnvio)} · {timeAgo(s.dataEnvio)}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default Overview;
