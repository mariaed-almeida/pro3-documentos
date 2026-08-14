import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, FolderOpen, FileText, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Eye, Folder, LayoutGrid, List, LogOut, Loader2, Settings,
  BadgeCheck, CircleDollarSign, ArrowUpDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSubmissions, updateSubmissionStatus, getSubmissionWithDocs } from "@/lib/store";
import { Submission, StatusDocumento } from "@/lib/types";
import SubmissionDetail from "@/components/SubmissionDetail";
import CampanhasManager from "@/pages/CampanhasManager";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string; description: string }> = {
  recebido:    { label: "Recebido",    icon: Clock,          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",    description: "Aguardando análise" },
  em_revisao:  { label: "Em revisão", icon: AlertCircle,    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800", description: "Pendência identificada" },
  aprovado:    { label: "Aprovado",   icon: CheckCircle2,   className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800", description: "Pronto para o financeiro" },
  cancelado:   { label: "Cancelado",  icon: X,              className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",          description: "PI cancelado" },
};

type OrdemOpcao = "recente" | "antigo" | "alfabetico";

const OperadorDashboard = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [ordem, setOrdem] = useState<OrdemOpcao>("recente");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "tree">("cards");
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampanhas, setShowCampanhas] = useState(false);

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/operador/login", { replace: true });
      }
      setAuthChecked(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/operador/login", { replace: true });
      }
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadSubmissions = async () => {
    setLoading(true);
    const data = await getSubmissions();
    setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => { loadSubmissions(); }, []);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const matchSearch =
        s.numeroPi.toLowerCase().includes(search.toLowerCase()) ||
        s.nomeVeiculo.toLowerCase().includes(search.toLowerCase()) ||
        s.campanha.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "todos" || s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [submissions, search, filterStatus]);

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, Submission[]>> = {};
    filtered.forEach((s) => {
      if (!map[s.cliente]) map[s.cliente] = {};
      if (!map[s.cliente][s.campanha]) map[s.cliente][s.campanha] = [];
      map[s.cliente][s.campanha].push(s);
    });
    return map;
  }, [filtered]);

  const handleStatusUpdate = async (id: string, status: StatusDocumento) => {
    await updateSubmissionStatus(id, status);
    await loadSubmissions();
    if (selectedSubmission?.id === id) {
      setSelectedSubmission({ ...selectedSubmission, status });
    }
  };

  const handleSelectSubmission = async (s: Submission) => {
    const full = await getSubmissionWithDocs(s.id);
    if (full) setSelectedSubmission(full);
    else setSelectedSubmission(s);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (showCampanhas) {
    return <CampanhasManager onBack={() => setShowCampanhas(false)} />;
  }

  if (selectedSubmission) {
    return (
      <SubmissionDetail
        submission={selectedSubmission}
        onBack={() => { setSelectedSubmission(null); loadSubmissions(); }}
        onStatusUpdate={handleStatusUpdate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (selectedCampanha) setSelectedCampanha(null);
            else if (selectedCliente) setSelectedCliente(null);
            else navigate("/");
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Painel do Operador</h1>
            <p className="text-sm text-muted-foreground">Gestão de documentação recebida</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "cards" ? "default" : "outline"} size="icon" className="h-8 w-8"
              onClick={() => { setViewMode("cards"); setSelectedCliente(null); setSelectedCampanha(null); }}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "tree" ? "default" : "outline"} size="icon" className="h-8 w-8"
              onClick={() => setViewMode("tree")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="outline" className="text-sm">
            {submissions.length} envio{submissions.length !== 1 ? "s" : ""}
          </Badge>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCampanhas(true)}>
            <Settings className="h-3.5 w-3.5" /> Campanhas
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["recebido", "em_revisao", "aprovado", "cancelado"] as StatusDocumento[]).map((st) => {
            const cfg = statusConfig[st];
            const count = submissions.filter((s) => s.status === st).length;
            const Icon = cfg.icon;
            return (
              <div key={st} className="bg-card rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filtros: busca, status e ordenação */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por PI, veículo ou campanha..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="corrigido">Corrigido</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="faturado">Faturado</SelectItem>
            </SelectContent>
          </Select>
          {/* Filtro de ordenação — só aparece quando estamos dentro de uma campanha (lista de PIs) */}
          {selectedCampanha && (
            <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemOpcao)}>
              <SelectTrigger className="w-full sm:w-[220px] gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recente">Mais recentes primeiro</SelectItem>
                <SelectItem value="antigo">Mais antigos primeiro</SelectItem>
                <SelectItem value="alfabetico">Ordem alfabética (veículo)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {viewMode === "cards" && (selectedCliente || selectedCampanha) && (
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => { setSelectedCliente(null); setSelectedCampanha(null); }} className="text-primary hover:underline">Clientes</button>
            {selectedCliente && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button onClick={() => setSelectedCampanha(null)} className={selectedCampanha ? "text-primary hover:underline" : "text-foreground font-medium"}>{selectedCliente}</button>
              </>
            )}
            {selectedCampanha && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground font-medium">{selectedCampanha}</span>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <Loader2 className="h-8 w-8 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando documentação...</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma documentação encontrada</h3>
            <p className="text-sm text-muted-foreground">
              {submissions.length === 0 ? "Ainda não há envios registrados." : "Nenhum resultado para os filtros aplicados."}
            </p>
          </div>
        ) : viewMode === "cards" ? (
          <CardView grouped={grouped} selectedCliente={selectedCliente} selectedCampanha={selectedCampanha}
            onSelectCliente={setSelectedCliente} onSelectCampanha={setSelectedCampanha}
            onSelectSubmission={handleSelectSubmission} onStatusUpdate={handleStatusUpdate} statusConfig={statusConfig} ordem={ordem} />
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cliente, campanhas]) => (
              <TreeClienteFolder key={cliente} cliente={cliente} campanhas={campanhas}
                onSelect={handleSelectSubmission} statusConfig={statusConfig} ordem={ordem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============ CARD VIEW ============ */

const CardView = ({
  grouped, selectedCliente, selectedCampanha,
  onSelectCliente, onSelectCampanha, onSelectSubmission, onStatusUpdate, statusConfig, ordem,
}: {
  grouped: Record<string, Record<string, Submission[]>>;
  selectedCliente: string | null;
  selectedCampanha: string | null;
  onSelectCliente: (c: string) => void;
  onSelectCampanha: (c: string) => void;
  onSelectSubmission: (s: Submission) => void;
  onStatusUpdate: (id: string, status: StatusDocumento) => void;
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
  ordem: OrdemOpcao;
}) => {
  if (!selectedCliente) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(grouped).map(([cliente, campanhas]) => {
          const total = Object.values(campanhas).flat().length;
          const pendentes = Object.values(campanhas).flat().filter(s => s.status === "pendente").length;
          return (
            <button key={cliente} onClick={() => onSelectCliente(cliente)}
              className="bg-card rounded-xl border p-6 hover:shadow-lg hover:border-primary/30 transition-all text-left group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Folder className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-lg">{cliente}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{Object.keys(campanhas).length} campanha(s) • {total} PI(s)</p>
                  {pendentes > 0 && (
                    <Badge variant="outline" className="mt-2 bg-warning/10 text-warning border-warning/20 text-xs">
                      {pendentes} pendente{pendentes !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (!selectedCampanha) {
    const campanhas = grouped[selectedCliente] || {};
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(campanhas).map(([campanha, subs]) => {
          const pendentes = subs.filter(s => s.status === "pendente").length;
          const corrigidos = subs.filter(s => s.status === "corrigido").length;
          return (
            <button key={campanha} onClick={() => onSelectCampanha(campanha)}
              className="bg-card rounded-xl border p-6 hover:shadow-lg hover:border-primary/30 transition-all text-left group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 group-hover:bg-warning/20 transition-colors">
                  <FolderOpen className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{campanha}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{subs.length} PI(s)</p>
                  <div className="flex gap-2 mt-2">
                    {corrigidos > 0 && <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />{corrigidos}</Badge>}
                    {pendentes > 0 && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs"><Clock className="h-3 w-3 mr-1" />{pendentes}</Badge>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const subs = grouped[selectedCliente]?.[selectedCampanha] || [];

  // Agrupamos por número do PI: se o mesmo veículo reenviar o mesmo número de PI
  // (ex: depois de uma correção), tratamos como o mesmo processo, não como dois PIs soltos.
  const subsByNumeroPi = sortAndGroupSubmissions(subs, ordem);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {subsByNumeroPi.map((group) => (
        <PiGroupCard key={group.numeroPi} group={group} statusConfig={statusConfig}
          onSelectSubmission={onSelectSubmission} onStatusUpdate={onStatusUpdate} />
      ))}
    </div>
  );
};

// Agrupa por número do PI e aplica a ordenação escolhida pelo operador.
function sortAndGroupSubmissions(subs: Submission[], ordem: OrdemOpcao) {
  const map: Record<string, Submission[]> = {};
  subs.forEach((s) => {
    if (!map[s.numeroPi]) map[s.numeroPi] = [];
    map[s.numeroPi].push(s);
  });

  const groups = Object.entries(map).map(([numeroPi, items]) => ({
    numeroPi,
    // Dentro de cada grupo, o envio mais recente sempre fica em primeiro (como "versão atual")
    items: items.sort((a, b) => new Date(b.dataEnvio).getTime() - new Date(a.dataEnvio).getTime()),
  }));

  // Ordena os grupos entre si conforme a opção escolhida
  return groups.sort((a, b) => {
    const latestA = a.items[0];
    const latestB = b.items[0];
    if (ordem === "recente") {
      return new Date(latestB.dataEnvio).getTime() - new Date(latestA.dataEnvio).getTime();
    }
    if (ordem === "antigo") {
      return new Date(latestA.dataEnvio).getTime() - new Date(latestB.dataEnvio).getTime();
    }
    // alfabetico — por nome do veículo
    return latestA.nomeVeiculo.localeCompare(latestB.nomeVeiculo, "pt-BR");
  });
}

const PiGroupCard = ({ group, statusConfig, onSelectSubmission, onStatusUpdate }: {
  group: { numeroPi: string; items: Submission[] };
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
  onSelectSubmission: (s: Submission) => void;
  onStatusUpdate: (id: string, status: StatusDocumento) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.items.length > 1;
  const latest = group.items[0];
  const older = group.items.slice(1);
  const cfg = statusConfig[latest.status];
  const Icon = cfg.icon;

  return (
    <div className="bg-card rounded-xl border hover:shadow-lg hover:border-primary/30 transition-all overflow-hidden">
      <button onClick={() => onSelectSubmission(latest)} className="w-full text-left p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                PI {latest.numeroPi}
                {hasMultiple && (
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                    {group.items.length}º envios
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{latest.nomeVeiculo}</p>
            </div>
          </div>
          <Badge variant="outline" className={`text-xs ${cfg.className}`}>
            <Icon className="h-3 w-3 mr-1" />{cfg.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{latest.tipoVeiculo} • {latest.cidade || "—"}</span>
          <span>{new Date(latest.dataEnvio).toLocaleDateString("pt-BR")}</span>
        </div>
        {latest.status === "pendente" && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1"
              onClick={(e) => { e.stopPropagation(); onStatusUpdate(latest.id, "corrigido"); }}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Corrigido
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7 flex-1 text-destructive"
              onClick={(e) => { e.stopPropagation(); onStatusUpdate(latest.id, "rejeitado"); }}>
              <AlertCircle className="h-3 w-3 mr-1" /> Pendência
            </Button>
          </div>
        )}
      </button>

      {hasMultiple && (
        <div className="border-t bg-muted/20">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
            Ver {older.length} envio{older.length !== 1 ? "s" : ""} anterior{older.length !== 1 ? "es" : ""} deste PI
          </button>
          {expanded && (
            <div className="px-5 pb-3 space-y-1.5">
              {older.map((item) => {
                const oldCfg = statusConfig[item.status];
                const OldIcon = oldCfg.icon;
                return (
                  <button
                    key={item.id}
                    onClick={(e) => { e.stopPropagation(); onSelectSubmission(item); }}
                    className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card border text-left hover:border-primary/30 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground">
                      Envio de {new Date(item.dataEnvio).toLocaleDateString("pt-BR")}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${oldCfg.className}`}>
                      <OldIcon className="h-2.5 w-2.5 mr-1" />{oldCfg.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ============ TREE VIEW ============ */

const TreeClienteFolder = ({ cliente, campanhas, onSelect, statusConfig, ordem }: {
  cliente: string; campanhas: Record<string, Submission[]>;
  onSelect: (s: Submission) => void;
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
  ordem: OrdemOpcao;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <Folder className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">{cliente}</span>
        <span className="text-xs text-muted-foreground ml-auto">{Object.values(campanhas).flat().length} PI(s)</span>
      </button>
      {open && (
        <div className="border-t">
          {Object.entries(campanhas).map(([campanha, subs]) => (
            <TreeCampanhaFolder key={campanha} campanha={campanha} submissions={subs} onSelect={onSelect} statusConfig={statusConfig} ordem={ordem} />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeCampanhaFolder = ({ campanha, submissions, onSelect, statusConfig, ordem }: {
  campanha: string; submissions: Submission[];
  onSelect: (s: Submission) => void;
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
  ordem: OrdemOpcao;
}) => {
  const [open, setOpen] = useState(true);

  const sorted = [...submissions].sort((a, b) => {
    if (ordem === "recente") return new Date(b.dataEnvio).getTime() - new Date(a.dataEnvio).getTime();
    if (ordem === "antigo") return new Date(a.dataEnvio).getTime() - new Date(b.dataEnvio).getTime();
    return a.nomeVeiculo.localeCompare(b.nomeVeiculo, "pt-BR");
  });

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 pl-10 hover:bg-muted/30 transition-colors">
        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <FolderOpen className="h-4 w-4 text-warning" />
        <span className="text-sm font-medium text-foreground">{campanha}</span>
      </button>
      {open && (
        <div className="pl-14 pr-4 pb-2 space-y-1">
          {sorted.map((s) => {
            const cfg = statusConfig[s.status];
            const Icon = cfg.icon;
            return (
              <button key={s.id} onClick={() => onSelect(s)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">PI {s.numeroPi} — {s.nomeVeiculo}</p>
                  <p className="text-xs text-muted-foreground">{s.tipoVeiculo} • {new Date(s.dataEnvio).toLocaleDateString("pt-BR")}</p>
                </div>
                <Badge variant="outline" className={`text-xs shrink-0 ${cfg.className}`}>
                  <Icon className="h-3 w-3 mr-1" />{cfg.label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OperadorDashboard;
