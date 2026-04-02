import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, FolderOpen, FileText, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Eye, Folder, LayoutGrid, List, LogOut, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSubmissions, updateSubmissionStatus, getSubmissionWithDocs } from "@/lib/store";
import { Submission, StatusDocumento } from "@/lib/types";
import SubmissionDetail from "@/components/SubmissionDetail";

const statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }> = {
  pendente: { label: "Pendente", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  em_analise: { label: "Em Análise", icon: Eye, className: "bg-primary/10 text-primary border-primary/20" },
  corrigido: { label: "Corrigido", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  rejeitado: { label: "Rejeitado", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const OperadorDashboard = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "tree">("cards");
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["pendente", "em_analise", "corrigido", "rejeitado"] as StatusDocumento[]).map((st) => {
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
            </SelectContent>
          </Select>
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
            onSelectSubmission={handleSelectSubmission} onStatusUpdate={handleStatusUpdate} statusConfig={statusConfig} />
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cliente, campanhas]) => (
              <TreeClienteFolder key={cliente} cliente={cliente} campanhas={campanhas}
                onSelect={handleSelectSubmission} statusConfig={statusConfig} />
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
  onSelectCliente, onSelectCampanha, onSelectSubmission, onStatusUpdate, statusConfig,
}: {
  grouped: Record<string, Record<string, Submission[]>>;
  selectedCliente: string | null;
  selectedCampanha: string | null;
  onSelectCliente: (c: string) => void;
  onSelectCampanha: (c: string) => void;
  onSelectSubmission: (s: Submission) => void;
  onStatusUpdate: (id: string, status: StatusDocumento) => void;
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {subs.map((s) => {
        const cfg = statusConfig[s.status];
        const Icon = cfg.icon;
        return (
          <button key={s.id} onClick={() => onSelectSubmission(s)}
            className="bg-card rounded-xl border p-5 hover:shadow-lg hover:border-primary/30 transition-all text-left group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">PI {s.numeroPi}</h3>
                  <p className="text-sm text-muted-foreground">{s.nomeVeiculo}</p>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                <Icon className="h-3 w-3 mr-1" />{cfg.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.tipoVeiculo} • {s.cidade || "—"}</span>
              <span>{new Date(s.dataEnvio).toLocaleDateString("pt-BR")}</span>
            </div>
            {s.status === "pendente" && (
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1"
                  onClick={(e) => { e.stopPropagation(); onStatusUpdate(s.id, "corrigido"); }}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Corrigido
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 flex-1 text-destructive"
                  onClick={(e) => { e.stopPropagation(); onStatusUpdate(s.id, "rejeitado"); }}>
                  <AlertCircle className="h-3 w-3 mr-1" /> Pendência
                </Button>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ============ TREE VIEW ============ */

const TreeClienteFolder = ({ cliente, campanhas, onSelect, statusConfig }: {
  cliente: string; campanhas: Record<string, Submission[]>;
  onSelect: (s: Submission) => void;
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
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
            <TreeCampanhaFolder key={campanha} campanha={campanha} submissions={subs} onSelect={onSelect} statusConfig={statusConfig} />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeCampanhaFolder = ({ campanha, submissions, onSelect, statusConfig }: {
  campanha: string; submissions: Submission[];
  onSelect: (s: Submission) => void;
  statusConfig: Record<StatusDocumento, { label: string; icon: typeof Clock; className: string }>;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 pl-10 hover:bg-muted/30 transition-colors">
        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <FolderOpen className="h-4 w-4 text-warning" />
        <span className="text-sm font-medium text-foreground">{campanha}</span>
      </button>
      {open && (
        <div className="pl-14 pr-4 pb-2 space-y-1">
          {submissions.map((s) => {
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
