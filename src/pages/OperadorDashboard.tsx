import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, FolderOpen, FileText, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Eye, Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSubmissions, updateSubmissionStatus } from "@/lib/store";
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
  const [filterCliente, setFilterCliente] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const submissions = useMemo(() => getSubmissions(), [refreshKey]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const matchSearch =
        s.numeroPi.toLowerCase().includes(search.toLowerCase()) ||
        s.nomeVeiculo.toLowerCase().includes(search.toLowerCase()) ||
        s.campanha.toLowerCase().includes(search.toLowerCase());
      const matchCliente = filterCliente === "todos" || s.cliente === filterCliente;
      const matchStatus = filterStatus === "todos" || s.status === filterStatus;
      return matchSearch && matchCliente && matchStatus;
    });
  }, [submissions, search, filterCliente, filterStatus]);

  // Group by Cliente > Campanha > PI
  const grouped = useMemo(() => {
    const map: Record<string, Record<string, Submission[]>> = {};
    filtered.forEach((s) => {
      if (!map[s.cliente]) map[s.cliente] = {};
      if (!map[s.cliente][s.campanha]) map[s.cliente][s.campanha] = [];
      map[s.cliente][s.campanha].push(s);
    });
    return map;
  }, [filtered]);

  const handleStatusUpdate = (id: string, status: StatusDocumento) => {
    updateSubmissionStatus(id, status);
    setRefreshKey((k) => k + 1);
    if (selectedSubmission?.id === id) {
      setSelectedSubmission({ ...selectedSubmission, status });
    }
  };

  if (selectedSubmission) {
    return (
      <SubmissionDetail
        submission={selectedSubmission}
        onBack={() => { setSelectedSubmission(null); setRefreshKey((k) => k + 1); }}
        onStatusUpdate={handleStatusUpdate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Painel do Operador</h1>
            <p className="text-sm text-muted-foreground">Gestão de documentação recebida</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {submissions.length} envio{submissions.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por PI, veículo ou campanha..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCliente} onValueChange={setFilterCliente}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              <SelectItem value="ALESC">ALESC</SelectItem>
              <SelectItem value="Prefeitura de Xanxerê">Pref. Xanxerê</SelectItem>
              <SelectItem value="Prefeitura de Chapecó">Pref. Chapecó</SelectItem>
            </SelectContent>
          </Select>
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

        {/* Tree View */}
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma documentação encontrada</h3>
            <p className="text-sm text-muted-foreground">
              {submissions.length === 0 ? "Ainda não há envios registrados." : "Nenhum resultado para os filtros aplicados."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cliente, campanhas]) => (
              <ClienteFolder
                key={cliente}
                cliente={cliente}
                campanhas={campanhas}
                onSelect={setSelectedSubmission}
                statusConfig={statusConfig}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ClienteFolder = ({
  cliente, campanhas, onSelect, statusConfig,
}: {
  cliente: string;
  campanhas: Record<string, Submission[]>;
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
        <span className="text-xs text-muted-foreground ml-auto">
          {Object.values(campanhas).flat().length} PI(s)
        </span>
      </button>
      {open && (
        <div className="border-t">
          {Object.entries(campanhas).map(([campanha, subs]) => (
            <CampanhaFolder key={campanha} campanha={campanha} submissions={subs} onSelect={onSelect} statusConfig={statusConfig} />
          ))}
        </div>
      )}
    </div>
  );
};

const CampanhaFolder = ({
  campanha, submissions, onSelect, statusConfig,
}: {
  campanha: string;
  submissions: Submission[];
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
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">PI {s.numeroPi} — {s.nomeVeiculo}</p>
                  <p className="text-xs text-muted-foreground">{s.tipoVeiculo} • {new Date(s.dataEnvio).toLocaleDateString("pt-BR")}</p>
                </div>
                <Badge variant="outline" className={`text-xs shrink-0 ${cfg.className}`}>
                  <Icon className="h-3 w-3 mr-1" />
                  {cfg.label}
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
