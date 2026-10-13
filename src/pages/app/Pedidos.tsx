import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Loader2, Plus, Search, X } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import StatusBadge from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPedidos, type StatusPi } from "@/lib/pedidos-db";
import { periodoLabel } from "@/lib/pedidos";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { cn } from "@/lib/utils";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STATUS_PI: Record<StatusPi, { label: string; badge: string }> = {
  rascunho: { label: "Rascunho", badge: "bg-muted text-muted-foreground border-border" },
  emitido: { label: "Emitido", badge: "bg-primary/[0.07] text-primary border-primary/20" },
  cancelado: { label: "Cancelado", badge: "bg-muted text-muted-foreground border-border line-through" },
};

const Pedidos = () => {
  const navigate = useNavigate();
  const { canOperate } = useRoles();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "todos";
  const veiculo = params.get("veiculo");

  const { data: pedidos = [], isLoading } = useQuery({ queryKey: ["pedidos"], queryFn: listPedidos });
  // Envios de documentos já ligados a cada PI (a ligação é feita pelo banco ao receber o envio).
  const { data: envios = {} } = useQuery({
    queryKey: ["envios-por-pedido"],
    queryFn: async () => {
      const { data, error } = await supabase.from("submissions").select("pedido_id, status").not("pedido_id", "is", null);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const s of data ?? []) {
        const atual = m[s.pedido_id!];
        // aprovado vence recebido; qualquer envio vence "sem envio"
        if (!atual || s.status === "aprovado") m[s.pedido_id!] = s.status;
      }
      return m;
    },
  });

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (!v || v === "todos") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const lista = useMemo(() => {
    const term = norm(q.trim());
    return pedidos.filter(
      (p) =>
        (status === "todos" || p.status === status) &&
        (!veiculo || p.veiculoId === veiculo) &&
        (!term || norm(`${p.numero} ${p.clienteNome} ${p.veiculoNome} ${p.campanha}`).includes(term)),
    );
  }, [pedidos, q, status, veiculo]);

  const total = lista.filter((p) => p.status !== "cancelado").reduce((a, p) => a + p.valorLiquido, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mídia"
        title="Pedidos de inserção"
        description="Emita o PI para o veículo, com valores, comissão e prazo de pagamento. O envio dos documentos se liga ao PI pelo número."
        actions={
          canOperate && (
            <Button asChild>
              <Link to="/app/pedidos/novo">
                <Plus /> Novo PI
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Buscar por nº do PI, cliente, veículo ou campanha" className="pl-9" aria-label="Buscar pedidos" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Situação">
          {(["todos", "rascunho", "emitido", "cancelado"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => setParam("status", s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                status === s ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/40",
              )}
            >
              {s === "todos" ? "Todos" : STATUS_PI[s].label}
            </button>
          ))}
          {veiculo && (
            <button onClick={() => setParam("veiculo", null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Limpar filtro de veículo
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={FilePlus2}
          title={pedidos.length === 0 ? "Nenhum PI emitido ainda" : "Nenhum PI encontrado"}
          description={pedidos.length === 0 ? "Emita o primeiro PI com o cliente, o veículo e as inserções." : "Ajuste a busca ou os filtros."}
          action={
            canOperate && pedidos.length === 0 ? (
              <Button asChild>
                <Link to="/app/pedidos/novo">Novo PI</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="eyebrow px-4 py-2.5">PI</th>
                <th className="eyebrow px-4 py-2.5">Veículo · cliente</th>
                <th className="eyebrow hidden px-4 py-2.5 lg:table-cell">Campanha</th>
                <th className="eyebrow hidden px-4 py-2.5 md:table-cell">Período</th>
                <th className="eyebrow px-4 py-2.5 text-right">Líquido</th>
                <th className="eyebrow hidden px-4 py-2.5 sm:table-cell">Situação</th>
                <th className="eyebrow hidden px-4 py-2.5 xl:table-cell">Documentos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((p) => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  onClick={() => navigate(`/app/pedidos/${p.id}`)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), navigate(`/app/pedidos/${p.id}`))}
                  className="cursor-pointer align-top transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <td className="num px-4 py-3 font-medium">{p.numero}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.veiculoNome}</p>
                    <p className="text-xs text-muted-foreground">{p.clienteNome}</p>
                  </td>
                  <td className="hidden max-w-[16rem] truncate px-4 py-3 text-muted-foreground lg:table-cell">{p.campanha}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                    <p className="text-xs">{periodoLabel(p.mes, p.ano)}</p>
                    <p className="num text-xs text-muted-foreground">emitido {formatDate(p.dataEmissao)}</p>
                  </td>
                  <td className="num px-4 py-3 text-right font-medium">{formatBRL(p.valorLiquido)}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={cn("inline-flex rounded-sm border px-2 py-0.5 text-xs font-medium", STATUS_PI[p.status].badge)}>{STATUS_PI[p.status].label}</span>
                  </td>
                  <td className="hidden px-4 py-3 xl:table-cell">
                    {envios[p.id] ? <StatusBadge status={envios[p.id]} withIcon={false} /> : <span className="text-xs text-muted-foreground">Aguardando envio</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40">
                <td className="eyebrow px-4 py-2.5" colSpan={4}>
                  {lista.length} {lista.length === 1 ? "PI" : "PIs"} · líquido sem cancelados
                </td>
                <td className="num px-4 py-2.5 text-right font-medium">{formatBRL(total)}</td>
                <td colSpan={2} className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default Pedidos;
