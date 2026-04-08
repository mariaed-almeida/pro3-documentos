import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Campaign, getCampaigns, addCampaign, toggleCampaign, deleteCampaign } from "@/lib/campaigns";
import { Cliente } from "@/lib/types";

const CLIENTES: Cliente[] = ["ALESC", "Prefeitura de Xanxerê", "Prefeitura de Chapecó"];

interface Props {
  onBack: () => void;
}

const CampanhasManager = ({ onBack }: Props) => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [newCliente, setNewCliente] = useState<string>("");
  const [newNome, setNewNome] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getCampaigns(filterCliente === "todos" ? undefined : filterCliente);
    setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterCliente]);

  const handleAdd = async () => {
    if (!newCliente || !newNome.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setAdding(true);
    const ok = await addCampaign(newCliente, newNome.trim());
    if (ok) {
      toast({ title: "Campanha adicionada" });
      setNewNome("");
      await load();
    } else {
      toast({ title: "Erro ao adicionar", variant: "destructive" });
    }
    setAdding(false);
  };

  const handleToggle = async (c: Campaign) => {
    await toggleCampaign(c.id, !c.ativa);
    await load();
  };

  const handleDelete = async (c: Campaign) => {
    if (!confirm(`Excluir campanha "${c.nome}"?`)) return;
    await deleteCampaign(c.id);
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Gerenciar Campanhas</h1>
            <p className="text-sm text-muted-foreground">Adicione, ative ou desative campanhas</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Add new */}
        <div className="bg-card rounded-lg border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Nova Campanha</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select value={newCliente} onValueChange={setNewCliente}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Nome da Campanha</Label>
              <div className="flex gap-2">
                <Input placeholder="Ex: 2026 - Nova Campanha" value={newNome} onChange={(e) => setNewNome(e.target.value)} />
                <Button onClick={handleAdd} disabled={adding} className="shrink-0 gap-1.5">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-3 items-center">
          <Select value={filterCliente} onValueChange={setFilterCliente}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {CLIENTES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{campaigns.length} campanha(s)</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-card rounded-lg border p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.cliente}</p>
                </div>
                <Badge variant="outline" className={c.ativa ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                  {c.ativa ? "Ativa" : "Inativa"}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggle(c)} title={c.ativa ? "Desativar" : "Ativar"}>
                  {c.ativa ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampanhasManager;
