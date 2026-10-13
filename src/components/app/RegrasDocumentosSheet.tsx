import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign } from "@/lib/campaigns";
import { TIPOS_VEICULO } from "@/lib/clientes";
import { cn } from "@/lib/utils";

interface Regra {
  doc_type: string;
  obrigatorio: boolean;
  tipos_veiculo: string[] | null;
  regime: string;
  ordem: number;
}

interface Tipo {
  codigo: string;
  nome: string;
  descricao: string | null;
  ordem: number;
}

const REGIMES = [
  { id: "todos", label: "Todos os veículos" },
  { id: "nao_simples", label: "Só quem não é do Simples" },
  { id: "simples", label: "Só optantes do Simples" },
];

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toLowerCase());

interface Props {
  campanha: Campaign | null;
  outras: Campaign[];
  onClose: () => void;
}

const RegrasDocumentosSheet = ({ campanha, outras, onClose }: Props) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { canOperate, isAdmin } = useRoles();
  const [adicionar, setAdicionar] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [copiarDe, setCopiarDe] = useState("");

  const id = campanha?.id;
  const regrasKey = ["regras", id];

  const { data: catalogo = [] } = useQuery({
    queryKey: ["tipos_documento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_documento").select("codigo, nome, descricao, ordem").order("ordem");
      if (error) throw error;
      return data as Tipo[];
    },
  });

  const { data: regras = [], isLoading } = useQuery({
    queryKey: regrasKey,
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanha_documentos")
        .select("doc_type, obrigatorio, tipos_veiculo, regime, ordem")
        .eq("campanha_id", id!)
        .order("ordem");
      if (error) throw error;
      return data as Regra[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: regrasKey });
  const falha = (e: { message: string }) => toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" });

  const salvar = useMutation({
    mutationFn: async (r: Regra) => {
      const { error } = await supabase.from("campanha_documentos").upsert({ campanha_id: id!, ...r });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: falha,
  });

  const remover = useMutation({
    mutationFn: async (docType: string) => {
      const { error } = await supabase.from("campanha_documentos").delete().eq("campanha_id", id!).eq("doc_type", docType);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: falha,
  });

  const criarTipo = useMutation({
    mutationFn: async () => {
      const codigo = slug(novoNome);
      const { error } = await supabase.from("tipos_documento").insert({ codigo, nome: novoNome.trim(), ordem: 100 + catalogo.length });
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("campanha_documentos")
        .insert({ campanha_id: id!, doc_type: codigo, obrigatorio: true, ordem: 100 + regras.length });
      if (e2) throw e2;
    },
    onSuccess: () => {
      setNovoNome("");
      qc.invalidateQueries({ queryKey: ["tipos_documento"] });
      refresh();
    },
    onError: falha,
  });

  const copiar = useMutation({
    mutationFn: async (origem: string) => {
      const { data, error } = await supabase
        .from("campanha_documentos")
        .select("doc_type, obrigatorio, tipos_veiculo, regime, ordem")
        .eq("campanha_id", origem);
      if (error) throw error;
      const novos = (data ?? []).map((r) => ({ ...r, campanha_id: id! }));
      const { error: e2 } = await supabase.from("campanha_documentos").upsert(novos);
      if (e2) throw e2;
    },
    onSuccess: () => {
      setCopiarDe("");
      toast({ title: "Regras copiadas" });
      refresh();
    },
    onError: falha,
  });

  const nomeDe = (codigo: string) => catalogo.find((t) => t.codigo === codigo);
  const disponiveis = catalogo.filter((t) => !regras.some((r) => r.doc_type === t.codigo));
  const editavel = canOperate;

  const alternarTipo = (r: Regra, tipo: string) => {
    const atuais = r.tipos_veiculo ?? [];
    const novos = atuais.includes(tipo) ? atuais.filter((t) => t !== tipo) : [...atuais, tipo];
    salvar.mutate({ ...r, tipos_veiculo: novos.length === 0 || novos.length === TIPOS_VEICULO.length ? null : novos });
  };

  return (
    <Sheet open={!!campanha} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <p className="eyebrow">{campanha?.cliente}</p>
          <SheetTitle className="font-serif text-2xl font-medium">Documentos exigidos</SheetTitle>
          <SheetDescription>
            {campanha?.nome}. O veículo vê só os documentos que valem para o tipo dele e para o regime tributário.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="mt-6 divide-y border-y">
            {regras.length === 0 && <li className="py-6 text-sm text-muted-foreground">Nenhum documento exigido nesta campanha.</li>}
            {regras.map((r) => {
              const tipo = nomeDe(r.doc_type);
              const todos = !r.tipos_veiculo || r.tipos_veiculo.length === 0;
              return (
                <li key={r.doc_type} className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{tipo?.nome ?? r.doc_type}</p>
                      {tipo?.descricao && <p className="text-xs text-muted-foreground">{tipo.descricao}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {r.obrigatorio ? "Obrigatório" : "Opcional"}
                        <Switch
                          checked={r.obrigatorio}
                          disabled={!editavel}
                          onCheckedChange={(v) => salvar.mutate({ ...r, obrigatorio: v })}
                          aria-label={`Obrigatório: ${tipo?.nome ?? r.doc_type}`}
                        />
                      </label>
                      {editavel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remover.mutate(r.doc_type)}
                          aria-label={`Remover ${tipo?.nome ?? r.doc_type}`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">Vale para:</span>
                    <button
                      type="button"
                      disabled={!editavel}
                      onClick={() => salvar.mutate({ ...r, tipos_veiculo: null })}
                      aria-pressed={todos}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                        todos ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40",
                      )}
                    >
                      Todos os tipos
                    </button>
                    {TIPOS_VEICULO.map((t) => {
                      const ativo = !todos && r.tipos_veiculo!.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!editavel}
                          onClick={() => alternarTipo(todos ? { ...r, tipos_veiculo: [] } : r, t)}
                          aria-pressed={ativo}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                            ativo ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40",
                          )}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>

                  <Select value={r.regime} disabled={!editavel} onValueChange={(v) => salvar.mutate({ ...r, regime: v })}>
                    <SelectTrigger className="h-8 w-60 text-xs" aria-label="Regime tributário">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIMES.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        )}

        {editavel && (
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Adicionar documento</Label>
              <div className="flex gap-2">
                <Select value={adicionar} onValueChange={setAdicionar}>
                  <SelectTrigger aria-label="Documento do catálogo">
                    <SelectValue placeholder={disponiveis.length ? "Escolha do catálogo" : "Todos já adicionados"} />
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((t) => (
                      <SelectItem key={t.codigo} value={t.codigo}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!adicionar || salvar.isPending}
                  onClick={() => {
                    salvar.mutate({ doc_type: adicionar, obrigatorio: true, tipos_veiculo: null, regime: "todos", ordem: 100 + regras.length });
                    setAdicionar("");
                  }}
                >
                  <Plus /> Adicionar
                </Button>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="novo-tipo">Novo tipo de documento</Label>
                <div className="flex gap-2">
                  <Input id="novo-tipo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Contrato social" />
                  <Button variant="outline" disabled={novoNome.trim().length < 3 || criarTipo.isPending} onClick={() => criarTipo.mutate()}>
                    Criar e adicionar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Entra no catálogo e pode ser usado nas outras campanhas.</p>
              </div>
            )}

            {outras.length > 0 && (
              <div className="space-y-1.5">
                <Label>Copiar de outra campanha</Label>
                <div className="flex gap-2">
                  <Select value={copiarDe} onValueChange={setCopiarDe}>
                    <SelectTrigger aria-label="Campanha de origem">
                      <SelectValue placeholder="Escolha a campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {outras.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.cliente} · {o.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" disabled={!copiarDe || copiar.isPending} onClick={() => copiar.mutate(copiarDe)}>
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Acrescenta as regras da outra campanha. Não remove as atuais.</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RegrasDocumentosSheet;
