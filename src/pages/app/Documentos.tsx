import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileStack, Loader2, Search, Sparkles, X } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import StatusBadge from "@/components/app/StatusBadge";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupByPi, useSubmissions } from "@/hooks/use-submissions";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Submission } from "@/lib/types";

const PAGE_SIZE = 15;
type Ordem = "recente" | "antigo" | "veiculo" | "pi";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const alertasIa = (s: Submission) => s.analiseIa?.achados.filter((a) => a.resultado === "atencao").length ?? 0;

const Documentos = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: submissions = [], isLoading } = useSubmissions();

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "todos";
  const cliente = params.get("cliente") ?? "todos";
  const ordem = (params.get("ordem") as Ordem) ?? "recente";
  const page = Math.max(1, Number(params.get("p") ?? 1));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || value === "todos") next.delete(key);
    else next.set(key, value);
    if (key !== "p") next.delete("p");
    setParams(next, { replace: true });
  };

  const clientes = useMemo(() => [...new Set(submissions.map((s) => s.cliente))].sort(), [submissions]);

  const groups = useMemo(() => {
    const term = norm(q.trim());
    const rows = groupByPi(submissions).filter(({ latest: s }) => {
      if (status !== "todos" && s.status !== status) return false;
      if (cliente !== "todos" && s.cliente !== cliente) return false;
      if (!term) return true;
      return norm(`${s.numeroPi} ${s.nomeVeiculo} ${s.campanha} ${s.cidade} ${s.cliente}`).includes(term);
    });
    const byDate = (a: Submission, b: Submission) => +new Date(b.dataEnvio) - +new Date(a.dataEnvio);
    rows.sort((a, b) => {
      if (ordem === "antigo") return -byDate(a.latest, b.latest);
      if (ordem === "veiculo") return a.latest.nomeVeiculo.localeCompare(b.latest.nomeVeiculo, "pt-BR");
      if (ordem === "pi") return a.numeroPi.localeCompare(b.numeroPi, "pt-BR", { numeric: true });
      return byDate(a.latest, b.latest);
    });
    return rows;
  }, [submissions, q, status, cliente, ordem]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = groups.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtering = !!q || status !== "todos" || cliente !== "todos";

  const countOf = (st: string) =>
    submissions.filter((s) => (cliente === "todos" || s.cliente === cliente) && s.status === st).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Acervo"
        title="Documentos"
        description="Todos os envios dos veículos. Reenvios do mesmo PI aparecem agrupados na versão mais recente."
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Buscar por PI, veículo, cidade ou campanha"
              className="pl-9"
              aria-label="Buscar documentos"
            />
          </div>
          <Select value={cliente} onValueChange={(v) => setParam("cliente", v)}>
            <SelectTrigger className="sm:w-56" aria-label="Cliente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ordem} onValueChange={(v) => setParam("ordem", v === "recente" ? null : v)}>
            <SelectTrigger className="sm:w-48" aria-label="Ordenar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recente">Mais recentes</SelectItem>
              <SelectItem value="antigo">Mais antigos</SelectItem>
              <SelectItem value="veiculo">Veículo (A–Z)</SelectItem>
              <SelectItem value="pi">Número do PI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filtrar por status">
          {(["todos", ...STATUS_ORDER] as const).map((st) => {
            const active = status === st;
            const n = st === "todos" ? submissions.filter((s) => cliente === "todos" || s.cliente === cliente).length : countOf(st);
            return (
              <button
                key={st}
                role="tab"
                aria-selected={active}
                onClick={() => setParam("status", st)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {st === "todos" ? "Todos" : STATUS[st].label} <span className="num ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
          {filtering && (
            <button
              onClick={() => setParams({}, { replace: true })}
              className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={submissions.length === 0 ? "Nenhum envio ainda" : "Nada encontrado"}
          description={
            submissions.length === 0
              ? "Quando os veículos enviarem documentos, eles aparecem aqui."
              : "Ajuste a busca ou os filtros para ver outros resultados."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                {["PI", "Veículo", "Cliente · campanha", "Enviado", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "eyebrow px-4 py-2.5 font-semibold",
                      i === 2 && "hidden lg:table-cell",
                      i === 3 && "hidden sm:table-cell",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map(({ key, latest: s, history }) => {
                const alertas = alertasIa(s);
                return (
                  <tr
                    key={key}
                    onClick={() => navigate(`/app/documentos/${s.id}`)}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        to={`/app/documentos/${s.id}`}
                        className="num font-medium hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.numeroPi}
                      </Link>
                      {history.length > 0 && (
                        <span className="ml-2 text-[11px] text-muted-foreground">{history.length + 1} envios</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium">{s.nomeVeiculo}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.tipoVeiculo === "Outro" && s.outroTipo ? s.outroTipo : s.tipoVeiculo}
                        {s.cidade && ` · ${s.cidade}`}
                      </p>
                    </td>
                    <td className="hidden max-w-[16rem] px-4 py-3 align-top lg:table-cell">
                      <p className="truncate">{s.cliente}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.campanha}</p>
                    </td>
                    <td className="num hidden whitespace-nowrap px-4 py-3 align-top text-muted-foreground sm:table-cell">
                      {formatDate(s.dataEnvio)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={s.status} />
                        {alertas > 0 && (
                          <span
                            title={`${alertas} ponto(s) de atenção na pré-análise`}
                            className="inline-flex items-center gap-1 text-[11px] text-warning"
                          >
                            <Sparkles className="h-3 w-3" />
                            {alertas}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span className="num">
              {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, groups.length)} de {groups.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={current <= 1}
                onClick={() => setParam("p", String(current - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <span className="num px-2">
                {current} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={current >= totalPages}
                onClick={() => setParam("p", String(current + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documentos;
