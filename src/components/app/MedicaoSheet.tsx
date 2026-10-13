import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MedicaoDialog from "@/components/app/MedicaoDialog";
import { useMedicaoEventos } from "@/hooks/use-medicoes";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { mudarStatusMedicao, STATUS_MEDICAO, type Medicao, type StatusMedicao } from "@/lib/medicoes";
import { formatBRL } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  medicao: Medicao | null;
  onClose: () => void;
  onChanged: () => void;
}

type Acao = null | { tipo: "liberar" | "pagar" | "devolver" | "cancelar" };

const hoje = () => new Date().toISOString().slice(0, 10);

const Linha = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="num text-right">{children}</dd>
  </div>
);

const MedicaoSheet = ({ medicao, onClose, onChanged }: Props) => {
  const { toast } = useToast();
  const { canOperate, canFinance, isAdmin } = useRoles();
  const { data: eventos = [] } = useMedicaoEventos(medicao?.id ?? null);

  const [acao, setAcao] = useState<Acao>(null);
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    setAcao(null);
    setMotivo("");
    setData(hoje());
  }, [medicao?.id]);

  if (!medicao) return null;
  const m = medicao;
  const meta = STATUS_MEDICAO[m.status];

  const executar = async (para: StatusMedicao, d?: string, detalhe?: string) => {
    setSalvando(true);
    try {
      await mudarStatusMedicao(m.id, para, d, detalhe);
      toast({ title: "Medição atualizada" });
      setAcao(null);
      onChanged();
      onClose();
    } catch (e) {
      toast({ title: "Não foi possível concluir", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const evento = (e: (typeof eventos)[number]) => {
    if (e.tipo === "criada") return "Medição criada";
    if (e.paraStatus) return STATUS_MEDICAO[e.paraStatus].label;
    return e.tipo;
  };

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <p className="eyebrow">{m.cliente}</p>
            <SheetTitle className="font-serif text-2xl font-medium">
              PI <span className="num">{m.numeroPi}</span>
            </SheetTitle>
            <SheetDescription>
              {m.nomeVeiculo}
              {m.cidade && ` · ${m.cidade}`}
              <br />
              {m.campanha}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5">
            <span className={cn("inline-flex rounded-sm border px-2 py-0.5 text-xs font-medium", meta.badge)}>{meta.label}</span>
          </div>

          <dl className="mt-5 divide-y border-y">
            <Linha label="Valor bruto">{formatBRL(m.valorBruto)}</Linha>
            <Linha label="Comissão da agência">− {formatBRL(m.comissao)}</Linha>
            <Linha label="Líquido ao veículo">
              <span className="font-serif text-lg">{formatBRL(m.valorLiquido)}</span>
            </Linha>
            {(m.periodoInicio || m.periodoFim) && (
              <Linha label="Veiculação">
                {m.periodoInicio ? formatDate(m.periodoInicio) : "—"} a {m.periodoFim ? formatDate(m.periodoFim) : "—"}
              </Linha>
            )}
            {m.numeroNf && <Linha label="Nota fiscal">{m.numeroNf}</Linha>}
            {m.previsaoPagamento && <Linha label="Previsão de pagamento">{formatDate(m.previsaoPagamento)}</Linha>}
            {m.pagoEm && <Linha label="Pago em">{formatDate(m.pagoEm)}</Linha>}
          </dl>

          {m.observacoes && <p className="mt-4 border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">{m.observacoes}</p>}

          <div className="mt-6 space-y-2">
            {m.status === "em_medicao" && canOperate && (
              <>
                <Button className="w-full" onClick={() => executar("aguardando_liberacao")} disabled={salvando}>
                  Enviar para liberação do financeiro
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setEditando(true)}>
                  Editar valores
                </Button>
              </>
            )}
            {m.status === "aguardando_liberacao" && canFinance && (
              <>
                <Button className="w-full" onClick={() => setAcao({ tipo: "liberar" })}>
                  Liberar pagamento
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setAcao({ tipo: "devolver" })}>
                  Devolver para ajuste
                </Button>
              </>
            )}
            {m.status === "liberado" && canFinance && (
              <Button className="w-full" onClick={() => setAcao({ tipo: "pagar" })}>
                Registrar pagamento
              </Button>
            )}
            {isAdmin && m.status !== "pago" && m.status !== "cancelado" && (
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => setAcao({ tipo: "cancelar" })}>
                Cancelar medição
              </Button>
            )}
            {m.status === "aguardando_liberacao" && !canFinance && (
              <p className="text-xs text-muted-foreground">Aguardando o financeiro liberar o pagamento.</p>
            )}
            <Button asChild variant="link" className="h-auto w-full justify-start px-0 text-xs">
              <Link to={`/app/documentos/${m.submissionId}`}>Abrir documentos do PI</Link>
            </Button>
          </div>

          <div className="mt-8">
            <p className="eyebrow mb-3">Histórico</p>
            <ol className="relative space-y-4 border-l pl-4">
              {eventos.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[1.3rem] top-1.5 h-1.5 w-1.5 rounded-full bg-foreground" />
                  <p className="text-sm">{evento(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                    {e.atorNome && ` · ${e.atorNome}`}
                  </p>
                  {e.detalhe && <p className="mt-1 text-xs italic text-muted-foreground">{e.detalhe}</p>}
                </li>
              ))}
            </ol>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!acao} onOpenChange={(o) => !o && setAcao(null)}>
        <DialogContent className="max-w-md">
          {acao?.tipo === "liberar" && (
            <>
              <DialogHeader>
                <DialogTitle>Liberar pagamento</DialogTitle>
                <DialogDescription>
                  {formatBRL(m.valorLiquido)} ao veículo {m.nomeVeiculo}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="previsao">Previsão de pagamento</Label>
                <Input id="previsao" type="date" value={data} min={hoje()} onChange={(e) => setData(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcao(null)}>Voltar</Button>
                <Button onClick={() => executar("liberado", data)} disabled={salvando || !data}>
                  {salvando && <Loader2 className="animate-spin" />} Liberar
                </Button>
              </DialogFooter>
            </>
          )}
          {acao?.tipo === "pagar" && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pagamento</DialogTitle>
                <DialogDescription>Informe a data em que o pagamento foi efetuado.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="pago">Data do pagamento</Label>
                <Input id="pago" type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcao(null)}>Voltar</Button>
                <Button onClick={() => executar("pago", data)} disabled={salvando || !data}>
                  {salvando && <Loader2 className="animate-spin" />} Registrar
                </Button>
              </DialogFooter>
            </>
          )}
          {(acao?.tipo === "devolver" || acao?.tipo === "cancelar") && (
            <>
              <DialogHeader>
                <DialogTitle>{acao.tipo === "devolver" ? "Devolver para ajuste" : "Cancelar medição"}</DialogTitle>
                <DialogDescription>
                  {acao.tipo === "devolver"
                    ? "A medição volta ao operador com o motivo abaixo."
                    : "A medição deixa de contar nos totais. Essa ação não pode ser desfeita."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="motivo">Motivo</Label>
                <Textarea id="motivo" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcao(null)}>Voltar</Button>
                <Button
                  variant={acao.tipo === "cancelar" ? "destructive" : "default"}
                  disabled={salvando || !motivo.trim()}
                  onClick={() => executar(acao.tipo === "devolver" ? "em_medicao" : "cancelado", undefined, motivo.trim())}
                >
                  {salvando && <Loader2 className="animate-spin" />} Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MedicaoDialog
        open={editando}
        onOpenChange={setEditando}
        medicao={m}
        onSaved={() => {
          setEditando(false);
          onChanged();
          onClose();
        }}
      />
    </>
  );
};

export default MedicaoSheet;
