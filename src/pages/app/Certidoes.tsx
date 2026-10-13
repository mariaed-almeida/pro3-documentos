import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import ConferirCertidao from "@/components/app/ConferirCertidao";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCertidoes } from "@/hooks/use-certidoes";
import {
  diasParaVencer, maisRecentes, ORGAO_LABEL, SITUACAO_LABEL, situacaoValidade, type Certidao, type Orgao,
} from "@/lib/certidoes";
import { mascararCnpj } from "@/lib/cnpj";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Filtro = "todas" | "vencidas" | "vencem" | "divergentes";

const rotuloValidade = (c: Certidao) => {
  const d = diasParaVencer(c.validade);
  if (d === null) return { texto: "Sem validade lida", tom: "text-muted-foreground" };
  if (d < 0) return { texto: `Vencida há ${-d} ${-d === 1 ? "dia" : "dias"}`, tom: "text-destructive" };
  if (d === 0) return { texto: "Vence hoje", tom: "text-warning" };
  if (d <= 30) return { texto: `Vence em ${d} ${d === 1 ? "dia" : "dias"}`, tom: "text-warning" };
  return { texto: `Vence em ${d} dias`, tom: "text-muted-foreground" };
};

const Certidoes = () => {
  const { data: todas = [], isLoading } = useCertidoes();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [orgao, setOrgao] = useState<string>("todos");
  const [historico, setHistorico] = useState(false);

  const base = useMemo(() => (historico ? todas : maisRecentes(todas)), [todas, historico]);

  const resumo = useMemo(() => {
    const vencidas = base.filter((c) => situacaoValidade(c.validade) === "vencida").length;
    const vencem = base.filter((c) => situacaoValidade(c.validade) === "vence_logo").length;
    const divergentes = base.filter((c) => c.cnpjConfere === false).length;
    const emDia = base.filter((c) => situacaoValidade(c.validade) === "ok" && c.cnpjConfere !== false).length;
    return { vencidas, vencem, divergentes, emDia };
  }, [base]);

  const lista = useMemo(() => {
    const q = norm(busca.trim());
    const qd = busca.replace(/\D/g, "");
    return base
      .filter((c) => {
        if (orgao !== "todos" && c.orgao !== orgao) return false;
        if (filtro === "vencidas" && situacaoValidade(c.validade) !== "vencida") return false;
        if (filtro === "vencem" && situacaoValidade(c.validade) !== "vence_logo") return false;
        if (filtro === "divergentes" && c.cnpjConfere !== false) return false;
        if (!q) return true;
        const texto = norm([c.veiculoNome, c.razaoSocial, c.nomeVeiculo, c.cliente, c.numeroPi].filter(Boolean).join(" "));
        return texto.includes(q) || (qd.length >= 3 && (c.cnpj ?? "").includes(qd));
      })
      .sort((a, b) => (diasParaVencer(a.validade) ?? 99_999) - (diasParaVencer(b.validade) ?? 99_999));
  }, [base, busca, filtro, orgao]);

  const tiles: { id: Filtro; label: string; valor: number; nota: string; tom?: string }[] = [
    { id: "vencidas", label: "Vencidas", valor: resumo.vencidas, nota: "pedir nova ao veículo", tom: resumo.vencidas ? "text-destructive" : undefined },
    { id: "vencem", label: "Vencem em 30 dias", valor: resumo.vencem, nota: "avisar o veículo", tom: resumo.vencem ? "text-warning" : undefined },
    { id: "divergentes", label: "CNPJ diferente do veículo", valor: resumo.divergentes, nota: "conferir o documento", tom: resumo.divergentes ? "text-destructive" : undefined },
    { id: "todas", label: "Em dia", valor: resumo.emDia, nota: "sem pendência" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentação"
        title="Certidões"
        description="Certidões lidas pela IA nos envios, com validade e CNPJ. O botão Conferir copia o código e abre o site do órgão emissor."
      />

      <dl className="grid grid-cols-2 divide-x divide-y rounded-md border bg-card lg:grid-cols-4 lg:divide-y-0">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setFiltro(filtro === t.id ? "todas" : t.id)}
            className={cn("px-4 py-4 text-left transition-colors hover:bg-muted/50", filtro === t.id && t.id !== "todas" && "bg-muted/60")}
          >
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className={cn("num mt-1.5 font-serif text-2xl leading-none", t.tom)}>{t.valor}</dd>
            <p className="mt-1.5 text-xs text-muted-foreground">{t.nota}</p>
          </button>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Veículo, CNPJ, PI ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={orgao} onValueChange={setOrgao}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder="Órgão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os órgãos</SelectItem>
            {(Object.keys(ORGAO_LABEL) as Orgao[]).map((o) => (
              <SelectItem key={o} value={o}>{ORGAO_LABEL[o]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Checkbox id="historico" checked={historico} onCheckedChange={(v) => setHistorico(v === true)} />
          <Label htmlFor="historico" className="text-sm font-normal text-muted-foreground">Mostrar também as anteriores</Label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={todas.length === 0 ? "Nenhuma certidão lida ainda" : "Nada com esses filtros"}
          description={todas.length === 0 ? "As certidões aparecem aqui depois que a IA analisa um envio com certidões anexadas." : "Tire um filtro ou mude a busca."}
        />
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veículo</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Envio</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((c) => {
                const v = rotuloValidade(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.veiculoNome ?? c.razaoSocial ?? c.nomeVeiculo}</p>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {c.cnpj ? mascararCnpj(c.cnpj) : "CNPJ não lido"}
                        {c.cnpjConfere === false && <span className="ml-2 text-destructive">diferente do cadastro</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{ORGAO_LABEL[c.orgao]}</TableCell>
                    <TableCell className="text-sm">{c.situacao ? (SITUACAO_LABEL[c.situacao] ?? c.situacao) : "-"}</TableCell>
                    <TableCell>
                      <p className="num text-sm">{c.validade ? formatDate(c.validade) : "-"}</p>
                      <p className={cn("mt-0.5 text-xs", v.tom)}>{v.texto}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link to={`/app/documentos/${c.submissionId}`} className="hover:underline">PI {c.numeroPi}</Link>
                      <p className="text-xs text-muted-foreground">{c.cliente}</p>
                    </TableCell>
                    <TableCell><ConferirCertidao certidao={c} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Certidoes;
