import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import StatusBadge from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useChangeStatus, useSubmissions } from "@/hooks/use-submissions";
import { useToast } from "@/hooks/use-toast";
import { daysSince, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Submission } from "@/lib/types";

type Aba = "recebido" | "em_revisao" | "aprovado";

const ABAS: { id: Aba; label: string; vazio: string }[] = [
  { id: "recebido", label: "Para conferir", vazio: "Nada aguardando conferência." },
  { id: "em_revisao", label: "Com pendência", vazio: "Nenhum veículo com pendência aberta." },
  { id: "aprovado", label: "Aprovados", vazio: "Nenhum envio aprovado ainda." },
];

const alertas = (s: Submission) => s.analiseIa?.achados.filter((a) => a.resultado === "atencao").length ?? 0;

const Aprovacoes = () => {
  const { data: submissions = [], isLoading } = useSubmissions();
  const changeStatus = useChangeStatus();
  const { toast } = useToast();
  const [aba, setAba] = useState<Aba>("recebido");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const porAba = useMemo(() => {
    const sort = (a: Submission, b: Submission) =>
      aba === "aprovado"
        ? +new Date(b.dataEnvio) - +new Date(a.dataEnvio)
        : +new Date(a.dataEnvio) - +new Date(b.dataEnvio);
    return submissions.filter((s) => s.status === aba).sort(sort);
  }, [submissions, aba]);

  const contagem = (id: Aba) => submissions.filter((s) => s.status === id).length;
  const selecionaveis = aba === "recebido" ? porAba : [];
  const todos = selecionaveis.length > 0 && selecionaveis.every((s) => selecionados.has(s.id));
  const selecionadosLista = porAba.filter((s) => selecionados.has(s.id));
  const comAlerta = selecionadosLista.filter((s) => alertas(s) > 0).length;

  const toggle = (id: string) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const aprovar = async (ids: string[]) => {
    setSalvando(true);
    try {
      for (const id of ids) await changeStatus(id, "aprovado");
      toast({ title: ids.length === 1 ? "Envio aprovado" : `${ids.length} envios aprovados` });
      setSelecionados(new Set());
    } finally {
      setSalvando(false);
      setConfirmando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fluxo de conferência"
        title="Aprovações"
        description="Confira os documentos, aprove o que está correto ou devolva ao veículo com o motivo da pendência."
        actions={
          selecionadosLista.length > 0 && (
            <Button onClick={() => setConfirmando(true)} disabled={salvando}>
              <CheckCheck /> Aprovar {selecionadosLista.length}
            </Button>
          )
        }
      />

      <div className="flex gap-6 border-b" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => {
              setAba(a.id);
              setSelecionados(new Set());
            }}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm transition-colors",
              aba === a.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label} <span className="num ml-1 text-xs opacity-60">{contagem(a.id)}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : porAba.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={ABAS.find((a) => a.id === aba)!.vazio} />
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          {selecionaveis.length > 0 && (
            <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2.5">
              <Checkbox
                checked={todos}
                onCheckedChange={(v) => setSelecionados(v ? new Set(selecionaveis.map((s) => s.id)) : new Set())}
                aria-label="Selecionar todos"
              />
              <span className="text-xs text-muted-foreground">
                {selecionadosLista.length > 0
                  ? `${selecionadosLista.length} selecionado${selecionadosLista.length > 1 ? "s" : ""}`
                  : "Selecionar todos"}
              </span>
            </div>
          )}
          <ul className="divide-y">
            {porAba.map((s) => {
              const dias = daysSince(s.dataEnvio);
              const nAlertas = alertas(s);
              return (
                <li key={s.id} className="flex items-center gap-4 px-4 py-3.5">
                  {selecionaveis.length > 0 && (
                    <Checkbox
                      checked={selecionados.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      aria-label={`Selecionar PI ${s.numeroPi}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <Link to={`/app/documentos/${s.id}`} className="num font-medium hover:text-primary">
                        PI {s.numeroPi}
                      </Link>
                      <span className="text-muted-foreground"> · {s.nomeVeiculo}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.cliente} · {s.campanha}
                    </p>
                    {aba === "em_revisao" && s.observacoes && (
                      <p className="mt-1 line-clamp-1 border-l-2 border-warning/40 pl-2 text-xs italic text-muted-foreground">
                        {s.observacoes}
                      </p>
                    )}
                  </div>
                  {nAlertas > 0 && (
                    <span
                      className="hidden items-center gap-1 text-xs text-warning sm:inline-flex"
                      title="Pontos de atenção na pré-análise"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> {nAlertas}
                    </span>
                  )}
                  <span
                    className={cn(
                      "num hidden w-24 shrink-0 text-right text-xs sm:block",
                      aba !== "aprovado" && dias >= 5 ? "font-medium text-warning" : "text-muted-foreground",
                    )}
                  >
                    {aba === "aprovado" ? formatDate(s.dataEnvio) : dias === 0 ? "hoje" : `há ${dias}d`}
                  </span>
                  {aba !== "recebido" && <StatusBadge status={s.status} className="hidden md:inline-flex" />}
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/app/documentos/${s.id}`}>Conferir</Link>
                    </Button>
                    {aba === "recebido" && nAlertas === 0 && (
                      <Button size="sm" onClick={() => aprovar([s.id])} disabled={salvando}>
                        Aprovar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Aprovar {selecionadosLista.length} {selecionadosLista.length === 1 ? "envio" : "envios"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os envios serão marcados como aprovados e seguem para o financeiro.
              {comAlerta > 0 && (
                <span className="mt-2 block font-medium text-warning">
                  {comAlerta} {comAlerta === 1 ? "tem" : "têm"} pontos de atenção na pré-análise. Confira antes de aprovar em lote.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => aprovar(selecionadosLista.map((s) => s.id))} disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" />} Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Aprovacoes;
