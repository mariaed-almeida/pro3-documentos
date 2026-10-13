import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Loader2, Wallet } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Panel from "@/components/app/Panel";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMedicoes } from "@/hooks/use-medicoes";
import { useSubmissions } from "@/hooks/use-submissions";
import { STATUS_MEDICAO, STATUS_MEDICAO_ORDER, type Medicao } from "@/lib/medicoes";
import { formatBRL, formatBRLCompact } from "@/lib/money";
import { daysSince, formatDate } from "@/lib/format";

const PERIODOS = [
  { id: "3", label: "Últimos 3 meses", meses: 3 },
  { id: "6", label: "Últimos 6 meses", meses: 6 },
  { id: "12", label: "Últimos 12 meses", meses: 12 },
  { id: "todos", label: "Todo o período", meses: 0 },
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  boxShadow: "none",
};

const soma = (l: Medicao[], k: "valorBruto" | "comissao" | "valorLiquido") => l.reduce((a, m) => a + m[k], 0);

function exportarCsv(lista: Medicao[]) {
  const cab = ["PI", "Veículo", "Cidade", "Cliente", "Campanha", "Bruto", "Comissão", "Líquido", "Situação", "NF", "Previsão", "Pago em"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const linhas = lista.map((m) =>
    [
      m.numeroPi, m.nomeVeiculo, m.cidade, m.cliente, m.campanha,
      m.valorBruto.toFixed(2).replace(".", ","), m.comissao.toFixed(2).replace(".", ","), m.valorLiquido.toFixed(2).replace(".", ","),
      STATUS_MEDICAO[m.status].label, m.numeroNf ?? "", m.previsaoPagamento ?? "", m.pagoEm ?? "",
    ].map(esc).join(";"),
  );
  const blob = new Blob(["﻿" + [cab.map(esc).join(";"), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `medicoes-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const Gerencial = () => {
  const { data: todas = [], isLoading } = useMedicoes();
  const { data: submissions = [] } = useSubmissions();
  const [periodo, setPeriodo] = useState("6");
  const [cliente, setCliente] = useState("todos");

  const clientes = useMemo(() => [...new Set(todas.map((m) => m.cliente))].sort(), [todas]);

  const lista = useMemo(() => {
    const meses = PERIODOS.find((p) => p.id === periodo)!.meses;
    const desde = meses ? startOfMonth(subMonths(new Date(), meses - 1)) : null;
    return todas.filter((m) => (!desde || new Date(m.createdAt) >= desde) && (cliente === "todos" || m.cliente === cliente));
  }, [todas, periodo, cliente]);

  const ativas = lista.filter((m) => m.status !== "cancelado");
  const pagas = lista.filter((m) => m.status === "pago");
  const aPagar = lista.filter((m) => m.status === "aguardando_liberacao" || m.status === "liberado");

  const porMes = useMemo(() => {
    const meses = PERIODOS.find((p) => p.id === periodo)!.meses || 12;
    return Array.from({ length: meses }, (_, i) => {
      const inicio = startOfMonth(subMonths(new Date(), meses - 1 - i));
      const chave = format(inicio, "yyyy-MM");
      const doMes = ativas.filter((m) => format(new Date(m.createdAt), "yyyy-MM") === chave);
      const linha: Record<string, number | string> = { mes: format(inicio, "MMM", { locale: ptBR }).replace(".", "") };
      for (const st of STATUS_MEDICAO_ORDER.filter((s) => s !== "cancelado"))
        linha[st] = doMes.filter((m) => m.status === st).reduce((a, m) => a + m.valorLiquido, 0);
      return linha;
    });
  }, [ativas, periodo]);

  const porClienteTabela = useMemo(() => {
    const map = new Map<string, Medicao[]>();
    for (const m of ativas) map.set(m.cliente, [...(map.get(m.cliente) ?? []), m]);
    return [...map.entries()]
      .map(([nome, itens]) => ({
        nome,
        pis: itens.length,
        bruto: soma(itens, "valorBruto"),
        comissao: soma(itens, "comissao"),
        liquido: soma(itens, "valorLiquido"),
        pago: soma(itens.filter((m) => m.status === "pago"), "valorLiquido"),
        aPagar: soma(itens.filter((m) => m.status === "aguardando_liberacao" || m.status === "liberado"), "valorLiquido"),
      }))
      .sort((a, b) => b.liquido - a.liquido);
  }, [ativas]);

  const topVeiculos = useMemo(() => {
    const map = new Map<string, { nome: string; liquido: number; pis: number }>();
    for (const m of ativas) {
      const cur = map.get(m.nomeVeiculo) ?? { nome: m.nomeVeiculo, liquido: 0, pis: 0 };
      cur.liquido += m.valorLiquido;
      cur.pis += 1;
      map.set(m.nomeVeiculo, cur);
    }
    return [...map.values()].sort((a, b) => b.liquido - a.liquido).slice(0, 6);
  }, [ativas]);

  const hoje = new Date().toISOString().slice(0, 10);
  const vencidas = todas.filter((m) => m.status === "liberado" && m.previsaoPagamento && m.previsaoPagamento < hoje);
  const proximos = todas
    .filter((m) => m.status === "liberado" && m.previsaoPagamento && m.previsaoPagamento >= hoje && m.previsaoPagamento <= addDays(new Date(), 30).toISOString().slice(0, 10))
    .sort((a, b) => (a.previsaoPagamento! < b.previsaoPagamento! ? -1 : 1));
  const paradasNoFinanceiro = todas.filter((m) => m.status === "aguardando_liberacao" && m.enviadoEm && daysSince(m.enviadoEm) >= 5);
  const aMedir = submissions.filter((s) => s.status === "aprovado" && !todas.some((m) => m.submissionId === s.id)).length;

  if (isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const kpis = [
    { label: "Valor medido", valor: formatBRL(soma(ativas, "valorLiquido")), nota: `${ativas.length} medições · bruto ${formatBRLCompact(soma(ativas, "valorBruto"))}` },
    { label: "Comissão da agência", valor: formatBRL(soma(ativas, "comissao")), nota: soma(ativas, "valorBruto") ? `${((soma(ativas, "comissao") / soma(ativas, "valorBruto")) * 100).toFixed(1).replace(".", ",")}% do bruto` : "—" },
    { label: "Já pago", valor: formatBRL(soma(pagas, "valorLiquido")), nota: `${pagas.length} medições` },
    { label: "A pagar", valor: formatBRL(soma(aPagar, "valorLiquido")), nota: `${aPagar.length} medições em aberto` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Gestão"
        title="Visão gerencial"
        description="Valores medidos, comissão, pagamentos e pontos de atenção do financeiro."
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
            <Button variant="outline" onClick={() => exportarCsv(lista)} disabled={lista.length === 0}>
              <Download /> Exportar CSV
            </Button>
          </>
        }
      />

      {(vencidas.length > 0 || paradasNoFinanceiro.length > 0 || aMedir > 0) && (
        <section aria-label="Pontos de atenção">
          <p className="eyebrow mb-3">Pontos de atenção</p>
          <ul className="divide-y rounded-md border bg-card text-sm">
            {vencidas.length > 0 && (
              <li className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <strong className="num font-medium">{vencidas.length}</strong> {vencidas.length === 1 ? "pagamento liberado está" : "pagamentos liberados estão"} com a previsão vencida
                  <span className="num text-muted-foreground"> · {formatBRL(soma(vencidas, "valorLiquido"))}</span>
                </span>
                <Link to="/app/faturamento" className="shrink-0 text-xs font-medium text-primary hover:underline">Abrir</Link>
              </li>
            )}
            {paradasNoFinanceiro.length > 0 && (
              <li className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <strong className="num font-medium">{paradasNoFinanceiro.length}</strong> {paradasNoFinanceiro.length === 1 ? "medição aguarda" : "medições aguardam"} liberação há 5 dias ou mais
                </span>
                <Link to="/app/faturamento" className="shrink-0 text-xs font-medium text-primary hover:underline">Abrir</Link>
              </li>
            )}
            {aMedir > 0 && (
              <li className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <strong className="num font-medium">{aMedir}</strong> {aMedir === 1 ? "PI aprovado ainda não foi medido" : "PIs aprovados ainda não foram medidos"}
                </span>
                <Link to="/app/faturamento" className="shrink-0 text-xs font-medium text-primary hover:underline">Medir</Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {lista.length === 0 ? (
        <EmptyState icon={Wallet} title="Sem medições no período" description="Aprove PIs e crie medições em Faturamento para ver os números aqui." />
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-y rounded-md border bg-card lg:grid-cols-4 lg:divide-y-0">
            {kpis.map((k) => (
              <div key={k.label} className="px-5 py-5">
                <dt className="text-xs text-muted-foreground">{k.label}</dt>
                <dd className="num mt-2 font-serif text-3xl leading-none">{k.valor}</dd>
                <p className="mt-2 text-xs text-muted-foreground">{k.nota}</p>
              </div>
            ))}
          </dl>

          <Panel title="Valor líquido por mês" description="Medições agrupadas pelo mês de criação, coloridas pela situação atual.">
            <div className="mb-4 flex flex-wrap gap-4">
              {STATUS_MEDICAO_ORDER.filter((s) => s !== "cancelado").map((st) => (
                <span key={st} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_MEDICAO[st].chart }} />
                  {STATUS_MEDICAO[st].label}
                </span>
              ))}
            </div>
            <div className="h-64" role="img" aria-label="Gráfico de valor líquido por mês e situação">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes} margin={{ left: 8, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => formatBRLCompact(v)} tickLine={false} axisLine={false} fontSize={12} width={64} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: "hsl(var(--accent))" }} contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                  {STATUS_MEDICAO_ORDER.filter((s) => s !== "cancelado").map((st, i, arr) => (
                    <Bar key={st} dataKey={st} name={STATUS_MEDICAO[st].label} stackId="a" fill={STATUS_MEDICAO[st].chart} radius={i === arr.length - 1 ? [2, 2, 0, 0] : 0} maxBarSize={44} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Por cliente" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="eyebrow px-4 py-2.5">Cliente</th>
                    <th className="eyebrow px-4 py-2.5 text-right">PIs</th>
                    <th className="eyebrow px-4 py-2.5 text-right">Bruto</th>
                    <th className="eyebrow px-4 py-2.5 text-right">Comissão</th>
                    <th className="eyebrow px-4 py-2.5 text-right">Líquido</th>
                    <th className="eyebrow px-4 py-2.5 text-right">Pago</th>
                    <th className="eyebrow px-4 py-2.5 text-right">A pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {porClienteTabela.map((c) => (
                    <tr key={c.nome}>
                      <td className="px-4 py-3">{c.nome}</td>
                      <td className="num px-4 py-3 text-right">{c.pis}</td>
                      <td className="num px-4 py-3 text-right">{formatBRL(c.bruto)}</td>
                      <td className="num px-4 py-3 text-right text-muted-foreground">{formatBRL(c.comissao)}</td>
                      <td className="num px-4 py-3 text-right font-medium">{formatBRL(c.liquido)}</td>
                      <td className="num px-4 py-3 text-right">{formatBRL(c.pago)}</td>
                      <td className="num px-4 py-3 text-right">{formatBRL(c.aPagar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Pagamentos previstos" description="Liberados com previsão nos próximos 30 dias e os vencidos.">
              {vencidas.length + proximos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pagamento previsto.</p>
              ) : (
                <ul className="divide-y">
                  {[...vencidas, ...proximos].map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate">{m.nomeVeiculo}</p>
                        <p className={`num text-xs ${m.previsaoPagamento! < hoje ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {m.previsaoPagamento! < hoje ? "Vencido em " : "Previsto "}
                          {formatDate(m.previsaoPagamento!)}
                        </p>
                      </div>
                      <span className="num shrink-0">{formatBRL(m.valorLiquido)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Veículos com maior valor" description="Valor líquido medido no período.">
              <ul className="divide-y">
                {topVeiculos.map((v) => (
                  <li key={v.nome} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                    <span className="truncate">{v.nome}</span>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {v.pis} {v.pis === 1 ? "PI" : "PIs"} · <span className="text-foreground">{formatBRL(v.liquido)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default Gerencial;
