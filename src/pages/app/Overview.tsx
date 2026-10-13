import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMedicoes } from "@/hooks/use-medicoes";
import { useSubmissions } from "@/hooks/use-submissions";
import { useSession } from "@/hooks/use-session";
import { listPedidos, type PedidoResumo } from "@/lib/pedidos-db";
import { formatVencimento } from "@/lib/pedidos";
import type { Medicao } from "@/lib/medicoes";
import { formatBRL, formatBRLCompact } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- utilidades ---------- */

const ym = (d: Date) => format(d, "yyyy-MM");
const ymDeStr = (s: string | null | undefined) => (s ? s.slice(0, 7) : null);
const soma = (l: number[]) => l.reduce((a, n) => a + n, 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const card =
  "rounded-[20px] border border-black/[0.06] bg-card shadow-[0_1px_0_rgba(0,0,0,0.03),0_12px_32px_-18px_rgba(20,24,40,0.14)]";

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

/** Reais em destaque e centavos discretos. */
const Dinheiro = ({ valor, className, centavos = true }: { valor: number; className?: string; centavos?: boolean }) => {
  const [inteiro, cent] = formatBRL(valor).replace(/\s/g, " ").split(",");
  return (
    <span className={cn("num", className)}>
      {inteiro}
      {centavos && <span className="opacity-45">,{cent}</span>}
    </span>
  );
};

const Delta = ({ atual, anterior, invertido = false, escuro = false }: { atual: number; anterior: number; invertido?: boolean; escuro?: boolean }) => {
  if (!anterior && !atual) return <span className="text-xs text-muted-foreground">sem movimento</span>;
  if (!anterior) return <span className="text-xs text-muted-foreground">novo no mês</span>;
  const pct = ((atual - anterior) / anterior) * 100;
  const sobe = pct >= 0;
  const bom = invertido ? !sobe : sobe;
  const Icon = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium", Math.abs(pct) < 0.5 ? (escuro ? "bg-white/10 text-white/70" : "bg-muted text-muted-foreground") : bom ? (escuro ? "bg-emerald-400/15 text-emerald-300" : "bg-success/10 text-success") : (escuro ? "bg-red-400/15 text-red-300" : "bg-destructive/10 text-destructive"))}>
      <Icon className="h-3 w-3" aria-hidden />
      <span className="num">{Math.abs(pct) < 0.5 ? "0%" : `${Math.abs(pct).toFixed(pct > 99 ? 0 : 1).replace(".", ",")}%`}</span>
      <span className="sr-only">{sobe ? "a mais" : "a menos"} que o mês anterior</span>
    </span>
  );
};

/** Barras minúsculas dos últimos meses; o mês escolhido fica em destaque. */
const Spark = ({ valores, destaque = valores.length - 1 }: { valores: number[]; destaque?: number }) => {
  const max = Math.max(...valores, 1);
  return (
    <svg viewBox={`0 0 ${valores.length * 10} 28`} className="h-7 w-full" aria-hidden preserveAspectRatio="none">
      {valores.map((v, i) => {
        const h = Math.max(2, (v / max) * 26);
        return <rect key={i} x={i * 10 + 1} y={28 - h} width={7} height={h} rx={2} className={i === destaque ? "fill-foreground" : "fill-foreground/15"} />;
      })}
    </svg>
  );
};

/* ---------- estágios da carteira ---------- */

const ESTAGIOS = [
  { id: "pago", rotulo: "Pago", cor: "hsl(158 45% 36%)", dica: "Já saiu para o veículo" },
  { id: "liberado", rotulo: "Liberado", cor: "hsl(216 100% 38%)", dica: "Pagamento autorizado" },
  { id: "aguardando", rotulo: "No financeiro", cor: "hsl(34 85% 52%)", dica: "Aguardando liberação" },
  { id: "medicao", rotulo: "Em medição", cor: "hsl(216 12% 62%)", dica: "Valores em conferência" },
  { id: "travado", rotulo: "Travado no PI", cor: "hsl(216 40% 82%)", dica: "Emitido, aguardando documentos" },
] as const;
type Estagio = (typeof ESTAGIOS)[number]["id"];

const Overview = () => {
  const session = useSession();
  const { data: medicoes = [], isLoading: l1 } = useMedicoes();
  const { data: submissions = [], isLoading: l2 } = useSubmissions();
  const { data: pedidos = [], isLoading: l3 } = useQuery({ queryKey: ["pedidos"], queryFn: listPedidos });
  const [ref, setRef] = useState(() => startOfMonth(new Date()));
  const mesAtual = startOfMonth(new Date());
  const nome = (session?.user.user_metadata?.nome as string | undefined) ?? session?.user.email?.split("@")[0] ?? "";
  const primeiroNome = cap(nome.split(/[\s._-]/)[0] ?? "");

  const dados = useMemo(() => {
    const emitidos = pedidos.filter((p) => p.status === "emitido");
    const rascunhos = pedidos.filter((p) => p.status === "rascunho");
    const ativas = medicoes.filter((m) => m.status !== "cancelado");
    const medPorPedido = new Map<string, Medicao>();
    for (const m of ativas) if (m.pedidoId) medPorPedido.set(m.pedidoId, m);
    const periodoMed = (m: Medicao) => ymDeStr(m.periodoInicio) ?? ym(new Date(m.createdAt));
    const pedYm = (p: PedidoResumo) => `${p.ano}-${String(p.mes).padStart(2, "0")}`;

    const estagioDe = (st: Medicao["status"]): Estagio =>
      st === "pago" ? "pago" : st === "liberado" ? "liberado" : st === "aguardando_liberacao" ? "aguardando" : "medicao";

    /** Carteira de um mês de veiculação, por estágio (valor bruto). */
    const carteira = (chave: string) => {
      const por: Record<Estagio, number> = { pago: 0, liberado: 0, aguardando: 0, medicao: 0, travado: 0 };
      for (const p of emitidos.filter((x) => pedYm(x) === chave)) {
        const m = medPorPedido.get(p.id);
        por[m ? estagioDe(m.status) : "travado"] += p.valorBruto;
      }
      for (const m of ativas.filter((x) => !x.pedidoId && periodoMed(x) === chave)) por[estagioDe(m.status)] += m.valorBruto;
      const previsto = soma(rascunhos.filter((x) => pedYm(x) === chave).map((x) => x.valorBruto));
      return { por, previsto, total: soma(Object.values(por)) };
    };

    const mes = (chave: string) => {
      const doMes = emitidos.filter((p) => pedYm(p) === chave);
      return {
        bruto: soma(doMes.map((p) => p.valorBruto)),
        comissao: soma(doMes.map((p) => p.comissao)),
        liquido: soma(doMes.map((p) => p.valorLiquido)),
        pis: doMes.length,
        pago: soma(medicoes.filter((m) => m.status === "pago" && ymDeStr(m.pagoEm) === chave).map((m) => m.valorLiquido)),
      };
    };

    /** Saídas de caixa por mês: o que já foi pago, o que está agendado e o que ainda vai nascer dos PIs. */
    const fluxo = (chave: string) => {
      const pago = soma(medicoes.filter((m) => m.status === "pago" && ymDeStr(m.pagoEm) === chave).map((m) => m.valorLiquido));
      const agendado = soma(
        ativas
          .filter((m) => (m.status === "liberado" || m.status === "aguardando_liberacao") && (ymDeStr(m.previsaoPagamento) ?? ymDeStr(m.vencimento) ?? ym(new Date(m.createdAt))) === chave)
          .map((m) => m.valorLiquido),
      );
      const aVir = soma(
        emitidos
          .filter((p) => !medPorPedido.has(p.id) && ym(new Date(formatVencIso(p))) === chave)
          .map((p) => p.valorLiquido),
      );
      return { pago, agendado, aVir };
    };

    return { emitidos, rascunhos, ativas, medPorPedido, carteira, mes, fluxo };
  }, [pedidos, medicoes]);

  if (l1 || l2 || l3)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const chave = ym(ref);
  const anteriorChave = ym(subMonths(ref, 1));
  const cart = dados.carteira(chave);
  const atual = dados.mes(chave);
  const ant = dados.mes(anteriorChave);
  const ultimos6 = Array.from({ length: 6 }, (_, i) => dados.mes(ym(subMonths(ref, 5 - i))));

  const fluxoMeses = Array.from({ length: 9 }, (_, i) => addMonths(ref, i - 5));
  const dadosFluxo = fluxoMeses.map((d) => {
    const f = dados.fluxo(ym(d));
    return { mes: cap(format(d, "MMM", { locale: ptBR }).replace(".", "")), pago: f.pago, agendado: f.agendado, aVir: f.aVir, futuro: d > mesAtual };
  });
  const fluxoTemDados = dadosFluxo.some((d) => d.pago + d.agendado + d.aVir > 0);

  const hoje = new Date().toISOString().slice(0, 10);
  const vencimentos = [
    ...dados.ativas
      .filter((m) => m.status === "liberado" || m.status === "aguardando_liberacao")
      .map((m) => ({ id: m.id, titulo: m.nomeVeiculo, sub: `PI ${m.numeroPi} · ${m.status === "liberado" ? "liberado" : "no financeiro"}`, data: m.previsaoPagamento ?? m.vencimento ?? m.createdAt.slice(0, 10), valor: m.valorLiquido, to: "/app/faturamento" })),
    ...dados.emitidos
      .filter((p) => !dados.medPorPedido.has(p.id))
      .map((p) => ({ id: p.id, titulo: p.veiculoNome, sub: `PI ${p.numero} · aguardando documentos`, data: formatVencIso(p), valor: p.valorLiquido, to: `/app/pedidos/${p.id}` })),
  ]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .slice(0, 6);

  const aConferir = submissions.filter((s) => s.status === "recebido").length;
  const noFinanceiro = dados.ativas.filter((m) => m.status === "aguardando_liberacao");
  const semMedicao = submissions.filter((s) => s.status === "aprovado" && !dados.ativas.some((m) => m.submissionId === s.id)).length;
  const semEnvio = dados.emitidos.filter((p) => !submissions.some((s) => s.pedidoId === p.id)).length;
  const atencao = [
    { n: aConferir, texto: aConferir === 1 ? "documento para conferir" : "documentos para conferir", to: "/app/aprovacoes" },
    { n: noFinanceiro.length, texto: noFinanceiro.length === 1 ? "medição aguarda liberação" : "medições aguardam liberação", extra: noFinanceiro.length ? formatBRL(soma(noFinanceiro.map((m) => m.valorLiquido))) : undefined, to: "/app/faturamento" },
    { n: semMedicao, texto: semMedicao === 1 ? "PI aprovado sem medição" : "PIs aprovados sem medição", to: "/app/faturamento" },
    { n: semEnvio, texto: semEnvio === 1 ? "PI emitido sem documentos" : "PIs emitidos sem documentos", to: "/app/pedidos" },
    { n: dados.rascunhos.length, texto: dados.rascunhos.length === 1 ? "rascunho de PI" : "rascunhos de PI", to: "/app/pedidos?status=rascunho" },
  ];

  const pagoPct = cart.total ? Math.round((cart.por.pago / cart.total) * 100) : 0;
  const semNada = pedidos.length === 0 && medicoes.length === 0;
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "0 12px 32px -12px rgba(0,0,0,.18)" };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{cap(format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }))}</p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-tight sm:text-4xl">
            {saudacao()}
            {primeiroNome && `, ${primeiroNome}`}
          </h1>
        </div>
        <div className="flex items-center gap-1 self-start rounded-full border border-black/[0.06] bg-card p-1 shadow-sm sm:self-auto" role="group" aria-label="Mês de referência">
          <button onClick={() => setRef((r) => subMonths(r, 1))} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8.5rem] px-1 text-center text-sm font-medium">{cap(format(ref, "MMMM 'de' yyyy", { locale: ptBR }))}</span>
          <button onClick={() => setRef((r) => addMonths(r, 1))} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
          {ym(ref) !== ym(mesAtual) && (
            <button onClick={() => setRef(mesAtual)} className="ml-0.5 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
              Hoje
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Carteira do mês */}
        <section className="relative overflow-hidden rounded-[20px] bg-[hsl(222_26%_8%)] p-6 text-white shadow-[0_24px_48px_-24px_rgba(8,12,30,0.6)] sm:p-8 lg:col-span-8" aria-labelledby="carteira-titulo">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(216_100%_45%)] opacity-[0.16] blur-3xl" aria-hidden />
          <p id="carteira-titulo" className="relative text-sm text-white/60">
            Carteira de {format(ref, "MMMM", { locale: ptBR })} · faturamento travado em PIs emitidos
          </p>
          <div className="relative mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <Dinheiro valor={cart.total} className="text-5xl font-semibold leading-none tracking-tight sm:text-6xl" />
            {ant.bruto > 0 && <Delta atual={atual.bruto} anterior={ant.bruto} escuro />}
          </div>
          <p className="relative mt-3 text-sm text-white/60">
            {cart.previsto > 0 ? (
              <>
                Mais <span className="num text-white/90">{formatBRL(cart.previsto)}</span> em rascunhos de PI que ainda podem entrar.
              </>
            ) : (
              "Nenhum rascunho de PI previsto para o mês."
            )}
          </p>

          {/* Barra de estágios */}
          <div className="relative mt-8" role="img" aria-label={`Carteira por estágio: ${ESTAGIOS.map((e) => `${e.rotulo} ${formatBRL(cart.por[e.id])}`).join(", ")}`}>
            <div className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-white/10">
              {cart.total > 0 ? (
                ESTAGIOS.filter((e) => cart.por[e.id] > 0).map((e) => (
                  <div key={e.id} style={{ width: `${(cart.por[e.id] / cart.total) * 100}%`, background: e.cor }} className="h-full first:rounded-l-full last:rounded-r-full" title={`${e.rotulo}: ${formatBRL(cart.por[e.id])}`} />
                ))
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
              {ESTAGIOS.map((e) => (
                <div key={e.id}>
                  <dt className="flex items-center gap-1.5 text-xs text-white/55">
                    <span className="h-2 w-2 rounded-full" style={{ background: e.cor }} aria-hidden />
                    {e.rotulo}
                  </dt>
                  <dd className="num mt-1 text-lg font-medium tracking-tight">{formatBRLCompact(cart.por[e.id])}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mt-8 grid gap-x-4 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/55">Comissão da agência</p>
              <p className="num mt-1 text-xl font-semibold tracking-tight">{formatBRL(atual.comissao)}</p>
            </div>
            <div>
              <p className="text-xs text-white/55">Líquido aos veículos</p>
              <p className="num mt-1 text-xl font-semibold tracking-tight">{formatBRL(atual.liquido)}</p>
            </div>
            <div>
              <p className="text-xs text-white/55">Já pago da carteira</p>
              <p className="num mt-1 text-xl font-semibold tracking-tight">{pagoPct}%</p>
            </div>
          </div>

          {semNada && (
            <Link to="/app/pedidos/novo" className="relative mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-[hsl(222_26%_8%)]">
              Emitir o primeiro PI <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>

        {/* O que pede ação */}
        <section className={cn(card, "p-6 lg:col-span-4")} aria-labelledby="acao-titulo">
          <h2 id="acao-titulo" className="text-base font-semibold tracking-tight">Precisa de você</h2>
          <ul className="mt-3 divide-y">
            {atencao.map((a) => (
              <li key={a.texto}>
                <Link to={a.to} className="group flex items-center gap-3 py-3 transition-colors">
                  <span className={cn("num flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold", a.n > 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{a.n}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {a.texto}
                    {a.extra && <span className="num block text-xs text-muted-foreground">{a.extra}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Comparação mês a mês */}
      <section aria-label={`Comparação de ${format(ref, "MMMM", { locale: ptBR })} com o mês anterior`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              { rotulo: "Faturamento emitido", valor: atual.bruto, ant: ant.bruto, serie: ultimos6.map((m) => m.bruto), money: true },
              { rotulo: "Comissão da agência", valor: atual.comissao, ant: ant.comissao, serie: ultimos6.map((m) => m.comissao), money: true },
              { rotulo: "Pago aos veículos", valor: atual.pago, ant: ant.pago, serie: ultimos6.map((m) => m.pago), money: true },
              { rotulo: "PIs emitidos", valor: atual.pis, ant: ant.pis, serie: ultimos6.map((m) => m.pis), money: false },
            ] as const
          ).map((c) => (
            <div key={c.rotulo} className={cn(card, "p-5")}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-muted-foreground">{c.rotulo}</p>
                <Delta atual={c.valor} anterior={c.ant} />
              </div>
              <p className="num mt-3 text-[1.75rem] font-semibold leading-none tracking-tight">{c.money ? formatBRL(c.valor) : c.valor}</p>
              <p className="num mt-1.5 text-xs text-muted-foreground">
                {cap(format(subMonths(ref, 1), "MMM", { locale: ptBR }).replace(".", ""))}: {c.money ? formatBRL(c.ant) : c.ant}
              </p>
              <div className="mt-4">
                <Spark valores={[...c.serie]} />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70" aria-hidden>
                  <span>{cap(format(subMonths(ref, 5), "MMM", { locale: ptBR }).replace(".", ""))}</span>
                  <span>{cap(format(ref, "MMM", { locale: ptBR }).replace(".", ""))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Fluxo de saídas */}
        <section className={cn(card, "p-6 lg:col-span-8")} aria-labelledby="fluxo-titulo">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="fluxo-titulo" className="text-base font-semibold tracking-tight">Pagamentos aos veículos</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">O que já saiu, o que está agendado e o que ainda vai nascer dos PIs emitidos.</p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {[
                ["Pago", "hsl(158 45% 36%)"],
                ["Agendado", "hsl(216 100% 38%)"],
                ["A vir dos PIs", "hsl(216 40% 82%)"],
              ].map(([l, c]) => (
                <li key={l} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: c }} aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 h-64" role="img" aria-label="Gráfico de pagamentos por mês: pago, agendado e a vir dos PIs">
            {fluxoTemDados ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFluxo} margin={{ left: 4, right: 4, top: 8 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => formatBRLCompact(v)} tickLine={false} axisLine={false} fontSize={12} width={62} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: "hsl(var(--accent))", radius: 8 }} contentStyle={tooltipStyle} formatter={(v: number, n: string) => [formatBRL(v), n]} />
                  <Bar dataKey="pago" name="Pago" stackId="a" fill="hsl(158 45% 36%)" maxBarSize={36} />
                  <Bar dataKey="agendado" name="Agendado" stackId="a" fill="hsl(216 100% 38%)" maxBarSize={36} />
                  <Bar dataKey="aVir" name="A vir dos PIs" stackId="a" fill="hsl(216 40% 82%)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Sem pagamentos nesta janela de meses.</div>
            )}
          </div>
        </section>

        {/* Próximos vencimentos */}
        <section className={cn(card, "p-6 lg:col-span-4")} aria-labelledby="venc-titulo">
          <h2 id="venc-titulo" className="text-base font-semibold tracking-tight">Próximos vencimentos</h2>
          {vencimentos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nada a vencer. Quando houver medições ou PIs em aberto, os próximos prazos aparecem aqui.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {vencimentos.map((v) => {
                const atrasado = v.data < hoje;
                return (
                  <li key={v.id}>
                    <Link to={v.to} className="flex items-center justify-between gap-3 py-3 transition-colors hover:opacity-80">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{v.titulo}</p>
                        <p className="truncate text-xs text-muted-foreground">{v.sub}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-sm font-medium">{formatBRL(v.valor)}</p>
                        <p className={cn("num text-xs", atrasado ? "font-medium text-destructive" : "text-muted-foreground")}>{atrasado ? "venceu " : ""}{formatDate(v.data)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

/** Vencimento (AAAA-MM-DD) de um PI a partir da emissão e do prazo. */
function formatVencIso(p: PedidoResumo): string {
  const [d, m, a] = formatVencimento(p.dataEmissao, p.prazoDias, p.prazoBase).split("/");
  return `${a}-${m}-${d}`;
}

export default Overview;
