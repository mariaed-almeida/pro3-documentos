import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { atualizarMedicao, criarMedicao, type Medicao } from "@/lib/medicoes";
import { formatBRL, parseBRL } from "@/lib/money";
import type { Submission } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PI a medir (criação). */
  submission?: Submission | null;
  /** Medição existente (edição). */
  medicao?: Medicao | null;
  onSaved: () => void;
}

const numberToInput = (n: number) => (n ? n.toFixed(2).replace(".", ",") : "");

const MedicaoDialog = ({ open, onOpenChange, submission, medicao, onSaved }: Props) => {
  const { toast } = useToast();
  const [bruto, setBruto] = useState("");
  const [comissao, setComissao] = useState("");
  const [modoComissao, setModoComissao] = useState<"valor" | "percentual">("valor");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [nf, setNf] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [doPi, setDoPi] = useState<number | null>(null);

  // Se o PI foi emitido pelo sistema, os valores vêm dele.
  useEffect(() => {
    setDoPi(null);
    if (!open || medicao || !submission) return;
    const numero = Number(submission.numeroPi.replace(/\D/g, ""));
    if (!numero) return;
    let vivo = true;
    supabase
      .from("pedidos_insercao")
      .select("numero, valor_bruto, comissao, clientes!inner(nome)")
      .eq("numero", numero)
      .eq("status", "emitido")
      .eq("clientes.nome", submission.cliente)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo || !data) return;
        setBruto(numberToInput(Number(data.valor_bruto)));
        setComissao(numberToInput(Number(data.comissao)));
        setModoComissao("valor");
        setDoPi(data.numero);
      });
    return () => {
      vivo = false;
    };
  }, [open, medicao, submission]);

  useEffect(() => {
    if (!open) return;
    setBruto(medicao ? numberToInput(medicao.valorBruto) : "");
    setComissao(medicao ? numberToInput(medicao.comissao) : "");
    setModoComissao("valor");
    setInicio(medicao?.periodoInicio ?? "");
    setFim(medicao?.periodoFim ?? "");
    setNf(medicao?.numeroNf ?? "");
    setObs(medicao?.observacoes ?? "");
  }, [open, medicao]);

  const valorBruto = parseBRL(bruto);
  const valorComissao = modoComissao === "valor" ? parseBRL(comissao) : (valorBruto * parseBRL(comissao)) / 100;
  const liquido = valorBruto - valorComissao;
  const invalido = valorBruto <= 0 || valorComissao < 0 || valorComissao > valorBruto || (!!inicio && !!fim && fim < inicio);

  const salvar = async () => {
    setSalvando(true);
    try {
      const dados = {
        valorBruto,
        comissao: Math.round(valorComissao * 100) / 100,
        periodoInicio: inicio || undefined,
        periodoFim: fim || undefined,
        numeroNf: nf.trim() || undefined,
        observacoes: obs.trim() || undefined,
      };
      if (medicao) await atualizarMedicao(medicao.id, dados);
      else if (submission) await criarMedicao(submission.id, dados);
      toast({ title: medicao ? "Medição atualizada" : "Medição criada" });
      onSaved();
    } catch (e) {
      toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const pi = medicao ? `PI ${medicao.numeroPi} · ${medicao.nomeVeiculo}` : submission ? `PI ${submission.numeroPi} · ${submission.nomeVeiculo}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{medicao ? "Editar medição" : "Nova medição"}</DialogTitle>
          <DialogDescription>{pi}</DialogDescription>
        </DialogHeader>

        {doPi && (
          <p className="border-l-2 border-primary/40 pl-3 text-xs text-muted-foreground">
            Valores trazidos do PI {doPi} emitido pelo sistema. Ajuste se o faturado for diferente.
          </p>
        )}
        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bruto">Valor bruto (R$)</Label>
            <Input id="bruto" inputMode="decimal" placeholder="0,00" value={bruto} onChange={(e) => setBruto(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="comissao">Comissão da agência</Label>
              <div className="flex rounded-sm border text-[11px]" role="group" aria-label="Tipo de comissão">
                {(["valor", "percentual"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModoComissao(m)}
                    aria-pressed={modoComissao === m}
                    className={`px-2 py-0.5 ${modoComissao === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
                  >
                    {m === "valor" ? "R$" : "%"}
                  </button>
                ))}
              </div>
            </div>
            <Input
              id="comissao"
              inputMode="decimal"
              placeholder={modoComissao === "valor" ? "0,00" : "20"}
              value={comissao}
              onChange={(e) => setComissao(e.target.value)}
            />
          </div>

          <div className="flex items-baseline justify-between rounded-md border bg-muted/40 px-3 py-2.5 sm:col-span-2">
            <span className="text-sm text-muted-foreground">Valor líquido a pagar ao veículo</span>
            <span className="num font-serif text-xl">{formatBRL(valorBruto > 0 ? liquido : 0)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inicio">Início da veiculação</Label>
            <Input id="inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fim">Fim da veiculação</Label>
            <Input id="fim" type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nf">Número da nota fiscal</Label>
            <Input id="nf" value={nf} onChange={(e) => setNf(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        {valorComissao > valorBruto && <p className="text-xs text-destructive">A comissão não pode ser maior que o valor bruto.</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={invalido || salvando}>
            {salvando && <Loader2 className="animate-spin" />} Salvar medição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MedicaoDialog;
