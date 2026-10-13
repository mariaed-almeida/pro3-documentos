import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSubmissions } from "@/hooks/use-submissions";
import { addCampaign, deleteCampaign, getCampaigns, toggleCampaign, type Campaign } from "@/lib/campaigns";
import { useClientes } from "@/hooks/use-clientes";
import { useRoles } from "@/hooks/use-roles";
import RegrasDocumentosSheet from "@/components/app/RegrasDocumentosSheet";
import { cn } from "@/lib/utils";

const KEY = ["campanhas"];

const Campanhas = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: campanhas = [], isLoading } = useQuery({ queryKey: KEY, queryFn: () => getCampaigns() });
  const { data: submissions = [] } = useSubmissions();
  const { data: clientesDb = [] } = useClientes();
  const { canOperate } = useRoles();
  const clientesAtivos = clientesDb.filter((c) => c.ativo).map((c) => c.nome);
  const [regrasDe, setRegrasDe] = useState<Campaign | null>(null);

  const [filtro, setFiltro] = useState("todos");
  const [cliente, setCliente] = useState("");
  const [nome, setNome] = useState("");
  const [excluir, setExcluir] = useState<Campaign | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const criar = useMutation({
    mutationFn: () => addCampaign(cliente, nome.trim()),
    onSuccess: (ok) => {
      if (!ok) return toast({ title: "Não foi possível criar a campanha", variant: "destructive" });
      toast({ title: "Campanha criada" });
      setNome("");
      refresh();
    },
  });
  const alternar = useMutation({ mutationFn: (c: Campaign) => toggleCampaign(c.id, !c.ativa), onSuccess: refresh });
  const remover = useMutation({
    mutationFn: (c: Campaign) => deleteCampaign(c.id),
    onSuccess: () => {
      setExcluir(null);
      refresh();
    },
  });

  const usos = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) {
      const k = `${s.cliente}::${s.campanha}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [submissions]);

  const lista = campanhas.filter((c) => filtro === "todos" || c.cliente === filtro);
  const podeCriar = !!cliente && nome.trim().length > 2;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cadastros"
        title="Campanhas"
        description="Campanhas ativas aparecem para os veículos no formulário de envio. Desative para encerrar o recebimento."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (podeCriar) criar.mutate();
        }}
        className="grid gap-3 rounded-md border bg-card p-5 sm:grid-cols-[14rem_1fr_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="nova-cliente">Cliente</Label>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger id="nova-cliente">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {clientesAtivos.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nova-nome">Nome da campanha</Label>
          <Input id="nova-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="2026 - Nome da campanha" />
        </div>
        <Button type="submit" disabled={!podeCriar || criar.isPending}>
          {criar.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-60" aria-label="Filtrar por cliente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientesAtivos.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="num text-xs text-muted-foreground">{lista.length} campanhas</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha" description="Cadastre a primeira acima." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-md border bg-card">
          {lista.map((c) => {
            const n = usos.get(`${c.cliente}::${c.nome}`) ?? 0;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <div className={cn("min-w-0 flex-1", !c.ativa && "opacity-60")}>
                  <p className="truncate text-sm font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.cliente} · <span className="num">{n}</span> {n === 1 ? "envio" : "envios"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setRegrasDe(c)}>
                  Documentos exigidos
                </Button>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {c.ativa ? "Ativa" : "Inativa"}
                  <Switch checked={c.ativa} onCheckedChange={() => alternar.mutate(c)} aria-label={`Ativar ${c.nome}`} />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setExcluir(c)}
                  aria-label={`Excluir ${c.nome}`}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              “{excluir?.nome}” deixa de existir no cadastro. Os envios já recebidos continuam salvos. Se só quer parar de receber, desative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && remover.mutate(excluir)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RegrasDocumentosSheet campanha={regrasDe} outras={campanhas.filter((x) => x.id !== regrasDe?.id)} onClose={() => setRegrasDe(null)} />
    </div>
  );
};

export default Campanhas;
