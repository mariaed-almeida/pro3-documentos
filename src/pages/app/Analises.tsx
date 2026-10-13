import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Panel from "@/components/app/Panel";
import EmptyState from "@/components/app/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubmissions } from "@/hooks/use-submissions";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { daysSince } from "@/lib/format";
import type { Submission } from "@/lib/types";
import { BarChart3 } from "lucide-react";

const PERIODOS = [
  { id: "3", label: "Últimos 3 meses", meses: 3 },
  { id: "6", label: "Últimos 6 meses", meses: 6 },
  { id: "12", label: "Últimos 12 meses", meses: 12 },
  { id: "todos", label: "Todo o período", meses: 0 },
];

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  boxShadow: "none",
};

const Analises = () => {
  const { data: all = [], isLoading } = useSubmissions();
  const [periodo, setPeriodo] = useState("6");
  const [cliente, setCliente] = useState("todos");

  const clientes = useMemo(() => [...new Set(all.map((s) => s.cliente))].sort(), [all]);

  const subs = useMemo(() => {
    const meses = PERIODOS.find((p) => p.id === periodo)!.meses;
    const desde = meses ? startOfMonth(subMonths(new Date(), meses - 1)) : null;
    return all.filter(
      (s) => (!desde || new Date(s.dataEnvio) >= desde) && (cliente === "todos" || s.cliente === cliente),
    );
  }, [all, periodo, cliente]);

  const total = subs.length;
  const n = (st: string) => subs.filter((s) => s.status === st).length;
  const decididos = n("aprovado") + n("em_revisao");

  const idadeMediaFila = useMemo(() => {
    const fila = subs.filter((s) => s.status === "recebido");
    if (!fila.length) return null;
    return fila.reduce((acc, s) => acc + daysSince(s.dataEnvio), 0) / fila.length;
  }, [subs]);

  const porMes = useMemo(() => {
    const meses = PERIODOS.find((p) => p.id === periodo)!.meses || 12;
    return Array.from({ length: meses }, (_, i) => {
      const inicio = startOfMonth(subMonths(new Date(), meses - 1 - i));
      const chave = format(inicio, "yyyy-MM");
      const doMes = subs.filter((s) => format(new Date(s.dataEnvio), "yyyy-MM") === chave);
      return {
        mes: format(inicio, "MMM", { locale: ptBR }).replace(".", ""),
        recebido: doMes.filter((s) => s.status === "recebido").length,
        em_revisao: doMes.filter((s) => s.status === "em_revisao").length,
        aprovado: doMes.filter((s) => s.status === "aprovado").length,
        cancelado: doMes.filter((s) => s.status === "cancelado").length,
      };
    });
  }, [subs, periodo]);

  const porVeiculo = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; revisao: number }>();
    for (const s of subs) {
      const cur = map.get(s.nomeVeiculo) ?? { nome: s.nomeVeiculo, total: 0, revisao: 0 };
      cur.total += 1;
      if (s.status === "em_revisao" || s.observacoes) cur.revisao += 1;
      map.set(s.nomeVeiculo, cur);
    }
    return [...map.values()]
      .filter((v) => v.total >= 1)
      .sort((a, b) => b.revisao - a.revisao || b.total - a.total)
      .slice(0, 6);
  }, [subs]);

  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs) map.set(s.tipoVeiculo, (map.get(s.tipoVeiculo) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [subs]);

  const achadosIa = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subs)
      for (const a of s.analiseIa?.achados ?? [])
        if (a.resultado === "atencao") map.set(a.checagem, (map.get(a.checagem) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [subs]);

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const kpis = [
    { label: "Envios no período", value: String(total), note: `${new Set(subs.map((s: Submission) => s.nomeVeiculo)).size} veículos` },
    { label: "Taxa de aprovação", value: pct(n("aprovado"), decididos), note: `${n("aprovado")} de ${decididos} conferidos` },
    { label: "Devolvidos ao veículo", value: pct(n("em_revisao"), decididos), note: `${n("em_revisao")} com pendência` },
    {
      label: "Espera média na fila",
      value: idadeMediaFila === null ? "—" : `${idadeMediaFila.toFixed(1).replace(".", ",")} d`,
      note: `${n("recebido")} aguardando`,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Indicadores"
        title="Análises"
        description="Volume, qualidade da documentação e gargalos do fluxo de conferência."
        actions={
          <>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger className="w-52" aria-label="Cliente">
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
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-44" aria-label="Período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {total === 0 ? (
        <EmptyState icon={BarChart3} title="Sem dados no período" description="Amplie o período ou escolha outro cliente." />
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-y rounded-md border bg-card lg:grid-cols-4 lg:divide-y-0">
            {kpis.map((k) => (
              <div key={k.label} className="px-5 py-5">
                <dt className="text-xs text-muted-foreground">{k.label}</dt>
                <dd className="num mt-2 font-serif text-4xl leading-none">{k.value}</dd>
                <p className="mt-2 text-xs text-muted-foreground">{k.note}</p>
              </div>
            ))}
          </dl>

          <Panel title="Envios por mês" description="Situação atual de cada envio, agrupado pelo mês em que chegou.">
            <div className="mb-4 flex flex-wrap gap-4">
              {STATUS_ORDER.map((st) => (
                <span key={st} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: STATUS[st].chart }} />
                  {STATUS[st].label}
                </span>
              ))}
            </div>
            <div className="h-64" role="img" aria-label="Gráfico de envios por mês e status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes} margin={{ left: -20, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: "hsl(var(--accent))" }} contentStyle={tooltipStyle} />
                  {STATUS_ORDER.map((st, i) => (
                    <Bar
                      key={st}
                      dataKey={st}
                      name={STATUS[st].label}
                      stackId="a"
                      fill={STATUS[st].chart}
                      radius={i === STATUS_ORDER.length - 1 ? [2, 2, 0, 0] : 0}
                      maxBarSize={44}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Veículos com mais pendências" description="Quem mais precisou corrigir documentação.">
              <ul className="divide-y">
                {porVeiculo.map((v) => (
                  <li key={v.nome} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                    <Link to={`/app/cadastros/veiculos?q=${encodeURIComponent(v.nome)}`} className="truncate hover:text-primary">
                      {v.nome}
                    </Link>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {v.revisao} de {v.total} · {pct(v.revisao, v.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Por tipo de veículo">
              <ul className="space-y-3.5">
                {porTipo.map(([tipo, qtd]) => (
                  <li key={tipo}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{tipo}</span>
                      <span className="num text-xs text-muted-foreground">
                        {qtd} · {pct(qtd, total)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${(qtd / porTipo[0][1]) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel
            title="O que a pré-análise mais aponta"
            description="Checagens com ponto de atenção nos envios do período."
          >
            {achadosIa.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ponto de atenção registrado.</p>
            ) : (
              <ul className="divide-y">
                {achadosIa.map(([checagem, qtd]) => (
                  <li key={checagem} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                    <span>{checagem}</span>
                    <span className="num text-xs text-muted-foreground">{qtd}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default Analises;
