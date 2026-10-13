import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientes } from "@/hooks/use-clientes";
import { useVeiculos } from "@/hooks/use-veiculos";
import { useToast } from "@/hooks/use-toast";
import { getPedidoEdicao, montarDocumento } from "@/lib/pedidos-db";
import { formatVencimento, periodoLabel, prazoLabel, totaisPi, totalInsercoes, totalItem } from "@/lib/pedidos";
import { baixarPiPdf } from "@/lib/pi-pdf";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";

/** Espelho somente leitura do PI para o financeiro: o que foi contratado, sem digitar de novo. */
const EspelhoPi = ({ pedidoId, valorMedido }: { pedidoId: string; valorMedido?: { bruto: number; comissao: number } }) => {
  const { toast } = useToast();
  const { data: clientes = [] } = useClientes();
  const { data: veiculos = [] } = useVeiculos();
  const { data: pi, isLoading } = useQuery({ queryKey: ["pedido", pedidoId], queryFn: () => getPedidoEdicao(pedidoId) });
  const [baixando, setBaixando] = useState(false);

  if (isLoading) return <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-muted-foreground" />;
  if (!pi) return <p className="text-sm text-muted-foreground">PI não encontrado.</p>;

  const t = totaisPi(pi.itens, pi.comissaoPct);
  const cliente = clientes.find((c) => c.id === pi.clienteId)?.nome;
  const veiculo = veiculos.find((v) => v.id === pi.veiculoId)?.nome;
  const divergente = !!valorMedido && (Math.abs(valorMedido.bruto - t.bruto) > 0.009 || Math.abs(valorMedido.comissao - t.comissao) > 0.009);

  const baixar = async () => {
    setBaixando(true);
    try {
      await baixarPiPdf(await montarDocumento(pi));
    } catch (e) {
      toast({ title: "Não foi possível gerar o PDF", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="space-y-4">
      <dl className="divide-y border-y text-sm">
        {(
          [
            ["PI", `${pi.numero}${pi.status === "cancelado" ? " (cancelado)" : ""}`],
            ["Emissão", formatDate(pi.dataEmissao)],
            ["Veiculação", periodoLabel(pi.mes, pi.ano)],
            ["Cliente", cliente],
            ["Veículo", veiculo],
            ["Campanha", pi.campanha],
            ["Projeto · plano · planilha", [pi.projeto, pi.plano, pi.planilha].filter(Boolean).join(" · ") || null],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="grid grid-cols-[8.5rem_1fr] gap-x-3 py-2">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className="num min-w-0 break-words">{v || "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="eyebrow px-3 py-2">Peça</th>
              <th className="eyebrow px-3 py-2 text-right">Ins.</th>
              <th className="eyebrow px-3 py-2 text-right">Unit.</th>
              <th className="eyebrow px-3 py-2 text-right">Desc.</th>
              <th className="eyebrow px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pi.itens.map((it, i) => (
              <tr key={i} className="align-top">
                <td className="px-3 py-2">
                  <p>{it.peca || "—"}</p>
                  <p className="text-muted-foreground">
                    {[it.formato, it.material].filter(Boolean).join(" · ")}
                    {Object.keys(it.insercoes).length > 0 && ` · dias ${Object.keys(it.insercoes).sort((a, b) => Number(a) - Number(b)).join(", ")}`}
                  </p>
                </td>
                <td className="num px-3 py-2 text-right">{totalInsercoes(it)}</td>
                <td className="num px-3 py-2 text-right">{formatBRL(it.custoUnitario * (it.fator || 1))}</td>
                <td className="num px-3 py-2 text-right">{it.descontoPct ? `${it.descontoPct}%` : "—"}</td>
                <td className="num px-3 py-2 text-right">{formatBRL(totalItem(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="divide-y border-y text-sm">
        <div className="flex justify-between py-2"><dt className="text-muted-foreground">Total bruto</dt><dd className="num">{formatBRL(t.bruto)}</dd></div>
        <div className="flex justify-between py-2"><dt className="text-muted-foreground">Comissão ({pi.comissaoPct}%)</dt><dd className="num">− {formatBRL(t.comissao)}</dd></div>
        <div className="flex items-baseline justify-between py-2"><dt className="font-medium">Líquido ao veículo</dt><dd className="num font-serif text-lg">{formatBRL(t.liquido)}</dd></div>
        <div className="flex justify-between py-2">
          <dt className="text-muted-foreground">Prazo</dt>
          <dd className="num">{prazoLabel(pi.prazoDias, pi.prazoBase)} · vence {formatVencimento(pi.dataEmissao, pi.prazoDias, pi.prazoBase)}</dd>
        </div>
      </dl>

      {divergente && (
        <p className="border-l-2 border-warning/60 pl-3 text-xs text-warning">
          Os valores desta medição são diferentes dos do PI ({formatBRL(t.bruto)} bruto, {formatBRL(t.comissao)} de comissão).
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={baixar} disabled={baixando}>
          {baixando ? <Loader2 className="animate-spin" /> : <Download />} PDF do PI
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to={`/app/pedidos/${pedidoId}`}>Abrir PI</Link>
        </Button>
      </div>
    </div>
  );
};

export default EspelhoPi;
