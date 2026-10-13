import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Eye, FileX2, Loader2, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Panel from "@/components/app/Panel";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClientes } from "@/hooks/use-clientes";
import { useVeiculos } from "@/hooks/use-veiculos";
import { useSession } from "@/hooks/use-session";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { getCampaigns } from "@/lib/campaigns";
import {
  excluirPedido, getPedidoEdicao, montarDocumento, mudarStatusPedido, proximoNumeroPi, salvarPedido,
  type PedidoEdicao, type StatusPi,
} from "@/lib/pedidos-db";
import {
  fatorDoFormato, formatVencimento, MESES, periodoLabel, prazoLabel, TIPOS_PECA, totaisPi, totalInsercoes, totalItem,
  type BasePrazo, type PiItem,
} from "@/lib/pedidos";
import { baixarPiPdf, gerarPiPdf } from "@/lib/pi-pdf";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_MEDICAO, type StatusMedicao } from "@/lib/medicoes";
import { statusOf } from "@/lib/status";
import { formatBRL, parseBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

const DIA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const hoje = () => new Date().toISOString().slice(0, 10);

const itemVazio = (colocacao: string): PiItem => ({
  ordem: 0, colocacao, tipoPeca: "J", peca: "", formato: "", material: "", insercoes: {}, custoUnitario: 0, fator: 1, descontoPct: 0,
});

const num = (v: string) => parseBRL(v);
const txt = (n: number) => (n ? String(n).replace(".", ",") : "");

const PedidoEditor = () => {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const session = useSession();
  const { canOperate } = useRoles();
  const { data: clientes = [] } = useClientes();
  const { data: veiculos = [] } = useVeiculos();
  const { data: campanhas = [] } = useQuery({ queryKey: ["campanhas"], queryFn: () => getCampaigns() });

  const [pedido, setPedido] = useState<PedidoEdicao | null>(null);
  const [carregando, setCarregando] = useState(!novo);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<"emitir" | "cancelar" | "excluir" | null>(null);
  const [tocado, setTocado] = useState(false);

  // O que já aconteceu com este PI depois de emitido: envio de documentos e medição.
  const { data: andamento } = useQuery({
    queryKey: ["pedido-andamento", id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: envios }, { data: meds }] = await Promise.all([
        supabase.from("submissions").select("id, status, data_envio").eq("pedido_id", id!).order("data_envio", { ascending: false }),
        supabase.from("medicoes").select("id, status, valor_liquido").eq("pedido_id", id!),
      ]);
      return { envios: envios ?? [], medicao: meds?.[0] ?? null };
    },
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (novo) {
        const agora = new Date();
        const numero = await proximoNumeroPi();
        if (vivo)
          setPedido({
            id: null, numero, status: "rascunho", clienteId: "", veiculoId: "", campanha: "", mes: agora.getMonth() + 1,
            ano: agora.getFullYear(), dataEmissao: hoje(), projeto: "", plano: "", planilha: "", produto: "",
            comissaoPct: 20, prazoDias: 30, prazoBase: "DFM", observacoes: "", itens: [itemVazio("")],
          });
      } else {
        const p = await getPedidoEdicao(id!);
        if (!vivo) return;
        if (!p) setNaoEncontrado(true);
        else setPedido(p);
        setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, novo]);

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const set = <K extends keyof PedidoEdicao>(k: K, v: PedidoEdicao[K]) => {
    setTocado(true);
    setPedido((p) => (p ? { ...p, [k]: v } : p));
  };
  const setItem = (idx: number, patch: Partial<PiItem>) => {
    setTocado(true);
    setPedido((p) => (p ? { ...p, itens: p.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : p));
  };

  const cliente = clientes.find((c) => c.id === pedido?.clienteId);
  const campanhasDoCliente = useMemo(
    () => campanhas.filter((c) => c.cliente === cliente?.nome && (c.ativa || c.nome === pedido?.campanha)),
    [campanhas, cliente, pedido?.campanha],
  );
  const totais = useMemo(() => (pedido ? totaisPi(pedido.itens, pedido.comissaoPct) : null), [pedido]);

  if (carregando || !pedido || !totais)
    return naoEncontrado ? (
      <EmptyState
        icon={FileX2}
        title="PI não encontrado"
        description="O link pode estar errado ou o PI foi excluído."
        action={<Button asChild variant="outline"><Link to="/app/pedidos">Voltar aos pedidos</Link></Button>}
      />
    ) : (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const somenteLeitura = !canOperate || pedido.status === "cancelado";
  const diasNoMes = new Date(pedido.ano, pedido.mes, 0).getDate();
  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  const problemas = (paraEmitir: boolean): string[] => {
    const l: string[] = [];
    if (!pedido.clienteId) l.push("Escolha o cliente.");
    if (!pedido.campanha.trim()) l.push("Escolha a campanha.");
    if (!pedido.veiculoId) l.push("Escolha o veículo.");
    if (!Number.isInteger(pedido.numero) || pedido.numero < 1) l.push("Informe o número do PI.");
    if (paraEmitir) {
      if (pedido.itens.length === 0) l.push("Inclua ao menos uma peça.");
      pedido.itens.forEach((it, i) => {
        if (totalInsercoes(it) === 0) l.push(`Peça ${i + 1}: marque os dias de inserção.`);
        if (it.custoUnitario <= 0) l.push(`Peça ${i + 1}: informe o custo unitário.`);
        if (!it.peca.trim()) l.push(`Peça ${i + 1}: descreva a peça.`);
      });
    }
    return l;
  };

  const gravar = async (status: StatusPi, mensagem: string) => {
    const erros = problemas(status === "emitido");
    if (erros.length) {
      setTocado(true);
      toast({ title: "Falta preencher", description: erros.slice(0, 4).join(" "), variant: "destructive" });
      return null;
    }
    setSalvando(true);
    try {
      const novoId = await salvarPedido({ ...pedido, status }, session?.user.id);
      toast({ title: mensagem });
      setTocado(false);
      await qc.invalidateQueries({ queryKey: ["pedidos"] });
      if (novo) navigate(`/app/pedidos/${novoId}`, { replace: true });
      else setPedido((p) => (p ? { ...p, status } : p));
      return novoId;
    } catch (e) {
      const msg = (e as { code?: string; message: string }).code === "23505" ? "Já existe um PI com esse número." : (e as Error).message;
      toast({ title: "Não foi possível salvar", description: msg, variant: "destructive" });
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const paraPdf = async () => {
    const erros = problemas(false);
    if (erros.length) {
      toast({ title: "Falta preencher", description: erros.join(" "), variant: "destructive" });
      return null;
    }
    return montarDocumento(pedido);
  };

  const visualizar = async () => {
    setGerando(true);
    try {
      const doc = await paraPdf();
      if (!doc) return;
      const blob = await gerarPiPdf(doc);
      setPrevia(URL.createObjectURL(blob));
    } catch (e) {
      toast({ title: "Não foi possível gerar o PDF", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const baixar = async () => {
    setGerando(true);
    try {
      const doc = await paraPdf();
      if (doc) await baixarPiPdf(doc);
    } catch (e) {
      toast({ title: "Não foi possível gerar o PDF", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  const executarConfirmacao = async () => {
    const acao = confirmar;
    setConfirmar(null);
    if (acao === "emitir") await gravar("emitido", "PI emitido");
    if (acao === "cancelar" && pedido.id) {
      await mudarStatusPedido(pedido.id, "cancelado");
      setPedido({ ...pedido, status: "cancelado" });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "PI cancelado" });
    }
    if (acao === "excluir" && pedido.id) {
      try {
        await excluirPedido(pedido.id);
        qc.invalidateQueries({ queryKey: ["pedidos"] });
        toast({ title: "Rascunho excluído" });
        navigate("/app/pedidos", { replace: true });
      } catch (e) {
        toast({ title: "Não foi possível excluir", description: (e as Error).message, variant: "destructive" });
      }
    }
  };

  const errosVisiveis = tocado ? problemas(false) : [];

  return (
    <div className="space-y-6">
      <nav aria-label="Caminho" className="text-xs text-muted-foreground">
        <Link to="/app/pedidos" className="hover:text-foreground">Pedidos de inserção</Link> <span className="mx-1">/</span>
        <span className="text-foreground">{novo ? "Novo PI" : `PI ${pedido.numero}`}</span>
      </nav>

      <PageHeader
        eyebrow={pedido.status === "emitido" ? "PI emitido" : pedido.status === "cancelado" ? "PI cancelado" : "Rascunho"}
        title={novo ? "Novo pedido de inserção" : `PI ${pedido.numero}`}
        description={
          pedido.status === "emitido"
            ? "Já emitido. Se alterar valores ou datas, baixe o PDF de novo e reenvie ao veículo."
            : "Preencha os dados e as inserções. Salve como rascunho e emita quando estiver conferido."
        }
        actions={
          <>
            <Button variant="outline" onClick={visualizar} disabled={gerando}>
              {gerando ? <Loader2 className="animate-spin" /> : <Eye />} Visualizar
            </Button>
            <Button variant="outline" onClick={baixar} disabled={gerando}>
              <Download /> Baixar PDF
            </Button>
          </>
        }
      />

      {errosVisiveis.length > 0 && (
        <p className="border-l-2 border-warning/60 pl-3 text-sm text-warning" role="status">
          {errosVisiveis.join(" ")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <fieldset disabled={somenteLeitura} className="min-w-0 space-y-6">
          <Panel title="Identificação">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pi-numero">Nº do PI</Label>
                <Input id="pi-numero" inputMode="numeric" value={pedido.numero || ""} disabled={!novo && pedido.status !== "rascunho"} onChange={(e) => set("numero", Number(e.target.value.replace(/\D/g, "")) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-emissao">Data de emissão</Label>
                <Input id="pi-emissao" type="date" value={pedido.dataEmissao} onChange={(e) => set("dataEmissao", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-mes">Veiculação</Label>
                <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                  <Select value={String(pedido.mes)} onValueChange={(v) => set("mes", Number(v))}>
                    <SelectTrigger id="pi-mes"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m.charAt(0) + m.slice(1).toLowerCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(pedido.ano)} onValueChange={(v) => set("ano", Number(v))}>
                    <SelectTrigger aria-label="Ano"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pi-cliente">Cliente</Label>
                <Select value={pedido.clienteId} onValueChange={(v) => { set("clienteId", v); set("campanha", ""); }}>
                  <SelectTrigger id="pi-cliente"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clientes.filter((c) => c.ativo || c.id === pedido.clienteId).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pi-campanha">Campanha</Label>
                <Select value={pedido.campanha} onValueChange={(v) => set("campanha", v)} disabled={!pedido.clienteId}>
                  <SelectTrigger id="pi-campanha"><SelectValue placeholder={pedido.clienteId ? "Selecione" : "Escolha o cliente primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {campanhasDoCliente.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="pi-veiculo">Veículo</Label>
                <Select value={pedido.veiculoId} onValueChange={(v) => {
                  set("veiculoId", v);
                  const tipo = TIPOS_PECA.find((t) => t.tipoVeiculo === veiculos.find((x) => x.id === v)?.tipoVeiculo);
                  if (tipo && pedido.itens.length === 1 && !pedido.itens[0].peca) setItem(0, { tipoPeca: tipo.letra });
                }}>
                  <SelectTrigger id="pi-veiculo"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {veiculos.filter((v) => v.ativo || v.id === pedido.veiculoId).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.nome}{v.praca ? ` · ${v.praca}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Não está na lista? <Link to="/app/cadastros/veiculos" className="font-medium text-primary hover:underline">Cadastre o veículo pelo CNPJ</Link>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pi-projeto">Projeto</Label>
                <Input id="pi-projeto" value={pedido.projeto} onChange={(e) => set("projeto", e.target.value)} placeholder="ALE-0011/26" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-plano">Plano</Label>
                <Input id="pi-plano" value={pedido.plano} onChange={(e) => set("plano", e.target.value)} placeholder="ALE-0009/26" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-planilha">Planilha</Label>
                <Input id="pi-planilha" value={pedido.planilha} onChange={(e) => set("planilha", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="pi-produto">Produto</Label>
                <Input id="pi-produto" value={pedido.produto} onChange={(e) => set("produto", e.target.value)} />
              </div>
            </div>
          </Panel>

          <Panel
            title="Peças e inserções"
            description="Marque os dias de veiculação. Clique de novo no dia para aumentar a quantidade (rádio e TV)."
            actions={
              <Button type="button" variant="outline" size="sm" onClick={() => set("itens", [...pedido.itens, itemVazio(cliente?.nome ?? "")])}>
                <Plus /> Peça
              </Button>
            }
          >
            <div className="space-y-6">
              {pedido.itens.map((it, idx) => {
                const total = totalItem(it);
                return (
                  <div key={idx} className="rounded-md border">
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
                      <p className="eyebrow">Peça {idx + 1}</p>
                      <div className="flex items-center">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Duplicar peça ${idx + 1}`}
                          onClick={() => set("itens", [...pedido.itens.slice(0, idx + 1), { ...it, insercoes: { ...it.insercoes } }, ...pedido.itens.slice(idx + 1)])}>
                          <Copy />
                        </Button>
                        {pedido.itens.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remover peça ${idx + 1}`}
                            onClick={() => set("itens", pedido.itens.filter((_, i) => i !== idx))}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 sm:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`it-tipo-${idx}`}>Mídia</Label>
                        <Select value={it.tipoPeca} onValueChange={(v) => setItem(idx, { tipoPeca: v })}>
                          <SelectTrigger id={`it-tipo-${idx}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{TIPOS_PECA.map((t) => <SelectItem key={t.letra} value={t.letra}>{t.letra} · {t.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-3">
                        <Label htmlFor={`it-peca-${idx}`}>Peça</Label>
                        <Input id={`it-peca-${idx}`} value={it.peca} onChange={(e) => setItem(idx, { peca: e.target.value })} placeholder="Região Sul (Nossas Raízes 04 de 05)" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`it-formato-${idx}`}>Formato</Label>
                        <Input
                          id={`it-formato-${idx}`}
                          value={it.formato}
                          placeholder="3colx17cm, 30s…"
                          onChange={(e) => {
                            const f = fatorDoFormato(e.target.value);
                            setItem(idx, { formato: e.target.value, ...(f ? { fator: f } : {}) });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`it-mat-${idx}`}>Material</Label>
                        <Input id={`it-mat-${idx}`} value={it.material} onChange={(e) => setItem(idx, { material: e.target.value })} />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`it-col-${idx}`}>Colocação</Label>
                        <Input id={`it-col-${idx}`} value={it.colocacao} onChange={(e) => setItem(idx, { colocacao: e.target.value })} placeholder={cliente?.nome} />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`it-custo-${idx}`}>Custo unitário (R$)</Label>
                        <Input id={`it-custo-${idx}`} inputMode="decimal" value={txt(it.custoUnitario)} onChange={(e) => setItem(idx, { custoUnitario: num(e.target.value) })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`it-fator-${idx}`}>Fator</Label>
                        <Input id={`it-fator-${idx}`} inputMode="decimal" value={txt(it.fator)} onChange={(e) => setItem(idx, { fator: num(e.target.value) || 1 })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`it-desc-${idx}`}>Desconto (%)</Label>
                        <Input id={`it-desc-${idx}`} inputMode="decimal" value={txt(it.descontoPct)} onChange={(e) => setItem(idx, { descontoPct: Math.min(100, num(e.target.value)) })} />
                      </div>
                      <div className="flex items-end justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 sm:col-span-1">
                        <span className="text-xs text-muted-foreground">Custo total</span>
                        <span className="num font-serif text-lg">{formatBRL(total)}</span>
                      </div>
                    </div>

                    <div className="border-t p-4">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Inserções em {periodoLabel(pedido.mes, pedido.ano).toLowerCase()} · <span className="num text-foreground">{totalInsercoes(it)}</span>
                      </p>
                      <div className="flex flex-wrap gap-1" role="group" aria-label={`Dias de inserção da peça ${idx + 1}`}>
                        {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((d) => {
                          const dow = new Date(pedido.ano, pedido.mes - 1, d).getDay();
                          const q = it.insercoes[String(d)] ?? 0;
                          return (
                            <button
                              key={d}
                              type="button"
                              aria-label={`Dia ${d}, ${q} inserções`}
                              aria-pressed={q > 0}
                              onClick={() => {
                                const prox = q >= (it.tipoPeca === "R" || it.tipoPeca === "T" ? 9 : 1) ? 0 : q + 1;
                                const ins = { ...it.insercoes };
                                if (prox === 0) delete ins[String(d)];
                                else ins[String(d)] = prox;
                                setItem(idx, { insercoes: ins });
                              }}
                              className={cn(
                                "flex h-11 w-9 flex-col items-center justify-center rounded-sm border text-[11px] leading-tight transition-colors",
                                q > 0 ? "border-foreground bg-foreground text-background" : dow === 0 ? "border-border bg-muted text-destructive" : "bg-card hover:border-foreground/50",
                              )}
                            >
                              <span className="num font-medium">{String(d).padStart(2, "0")}</span>
                              <span className={cn("text-[9px]", q > 0 ? "opacity-70" : dow === 0 ? "text-destructive" : "text-muted-foreground")}>
                                {q > 1 ? `×${q}` : DIA_SEMANA[dow]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Condições de pagamento">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pi-comissao">Comissão da agência (%)</Label>
                <Input id="pi-comissao" inputMode="decimal" value={txt(pedido.comissaoPct)} onChange={(e) => set("comissaoPct", Math.min(100, num(e.target.value)))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-prazo">Prazo (dias)</Label>
                <Input id="pi-prazo" inputMode="numeric" value={pedido.prazoDias} onChange={(e) => set("prazoDias", Math.min(365, Number(e.target.value.replace(/\D/g, "")) || 0))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-base">Contagem</Label>
                <Select value={pedido.prazoBase} onValueChange={(v) => set("prazoBase", v as BasePrazo)}>
                  <SelectTrigger id="pi-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DFM">DFM · dias fora do mês</SelectItem>
                    <SelectItem value="DD">DD · dias da data de emissão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="pi-obs">Observações internas</Label>
                <Textarea id="pi-obs" rows={2} value={pedido.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
                <p className="text-xs text-muted-foreground">Não saem no PDF.</p>
              </div>
            </div>
          </Panel>
        </fieldset>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <Panel title="Resumo">
            <dl className="divide-y text-sm">
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Inserções</dt><dd className="num">{totais.insercoes}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Total bruto</dt><dd className="num">{formatBRL(totais.bruto)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Comissão ({txt(pedido.comissaoPct) || 0}%)</dt><dd className="num">− {formatBRL(totais.comissao)}</dd></div>
              <div className="flex items-baseline justify-between py-2"><dt className="font-medium">Líquido ao veículo</dt><dd className="num font-serif text-xl">{formatBRL(totais.liquido)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Prazo</dt><dd className="num">{prazoLabel(pedido.prazoDias, pedido.prazoBase)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted-foreground">Vencimento</dt><dd className="num">{formatVencimento(pedido.dataEmissao, pedido.prazoDias, pedido.prazoBase)}</dd></div>
            </dl>
          </Panel>

          {!novo && pedido.status === "emitido" && (
            <Panel title="Andamento">
              <dl className="divide-y text-sm">
                <div className="flex items-start justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">Documentos</dt>
                  <dd className="text-right">
                    {andamento?.envios.length ? (
                      <Link to={`/app/documentos/${andamento.envios[0].id}`} className="hover:text-primary">
                        {statusOf(andamento.envios[0].status).label}
                        {andamento.envios.length > 1 && ` · ${andamento.envios.length} envios`}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Aguardando o veículo</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">Medição</dt>
                  <dd className="text-right">
                    {andamento?.medicao ? (
                      <Link to="/app/faturamento" className="hover:text-primary">
                        {STATUS_MEDICAO[andamento.medicao.status as StatusMedicao].label}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Nasce quando os documentos forem aprovados</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
          )}

          {canOperate && pedido.status !== "cancelado" && (
            <div className="space-y-2">
              {pedido.status === "rascunho" && (
                <>
                  <Button className="w-full" onClick={() => setConfirmar("emitir")} disabled={salvando}>Emitir PI</Button>
                  <Button variant="outline" className="w-full" onClick={() => gravar("rascunho", "Rascunho salvo")} disabled={salvando}>
                    {salvando && <Loader2 className="animate-spin" />} Salvar rascunho
                  </Button>
                </>
              )}
              {pedido.status === "emitido" && (
                <Button className="w-full" onClick={() => gravar("emitido", "Alterações salvas")} disabled={salvando}>
                  {salvando && <Loader2 className="animate-spin" />} Salvar alterações
                </Button>
              )}
              {!novo && pedido.status === "emitido" && (
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => setConfirmar("cancelar")}>Cancelar PI</Button>
              )}
              {!novo && pedido.status === "rascunho" && (
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => setConfirmar("excluir")}>Excluir rascunho</Button>
              )}
            </div>
          )}
          {canOperate && pedido.status === "cancelado" && pedido.id && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">PI cancelado. Reativar devolve o PI ao processo e reabre a medição que foi cancelada junto com ele.</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    await mudarStatusPedido(pedido.id!, "emitido");
                    setPedido({ ...pedido, status: "emitido" });
                    qc.invalidateQueries({ queryKey: ["pedidos"] });
                    qc.invalidateQueries({ queryKey: ["medicoes"] });
                    toast({ title: "PI reativado" });
                  } catch (e) {
                    toast({ title: "Não foi possível reativar", description: (e as Error).message, variant: "destructive" });
                  }
                }}
              >
                Reativar PI
              </Button>
            </div>
          )}
          {!canOperate && <p className="text-xs text-muted-foreground">Só operadores e administradores editam PIs.</p>}
        </aside>
      </div>

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === "emitir" ? `Emitir o PI ${pedido.numero}?` : confirmar === "cancelar" ? `Cancelar o PI ${pedido.numero}?` : "Excluir este rascunho?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === "emitir" &&
                `Vai ao veículo ${veiculos.find((v) => v.id === pedido.veiculoId)?.nome ?? ""} com líquido de ${formatBRL(totais.liquido)} e vencimento em ${formatVencimento(pedido.dataEmissao, pedido.prazoDias, pedido.prazoBase)}. Depois de emitido, os documentos enviados com este número são ligados a ele.`}
              {confirmar === "cancelar" && "O PI deixa de contar nos totais. O histórico fica guardado."}
              {confirmar === "excluir" && "O rascunho é removido de vez."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={executarConfirmacao}>{confirmar === "emitir" ? "Emitir" : confirmar === "cancelar" ? "Cancelar PI" : "Excluir"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previa} onOpenChange={(o) => { if (!o) setPrevia(null); }}>
        <DialogContent className="h-[90vh] w-[96vw] max-w-6xl gap-0 p-0">
          <DialogHeader className="border-b px-5 py-3 text-left">
            <DialogTitle className="text-base">PI {pedido.numero}</DialogTitle>
            <DialogDescription className="sr-only">Prévia do PDF do pedido de inserção</DialogDescription>
          </DialogHeader>
          {previa && <iframe src={previa} title={`Prévia do PI ${pedido.numero}`} className="h-full w-full flex-1 border-0" />}
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" onClick={() => setPrevia(null)}>Fechar</Button>
            <Button onClick={baixar}><Download /> Baixar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidoEditor;
