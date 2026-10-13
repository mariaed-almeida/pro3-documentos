import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Radio, Search } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import DadosReceita from "@/components/app/DadosReceita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubmissions } from "@/hooks/use-submissions";
import { useVeiculos, VEICULOS_KEY, type VeiculoDb } from "@/hooks/use-veiculos";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { consultarCnpj, cnpjValido, enderecoLinha, limparLogradouro, mascararCnpj, soDigitos, type DadosCnpj } from "@/lib/cnpj";
import { receitaPayload, viewDaConsulta, viewDoRegistro } from "@/lib/receita";
import { TIPOS_VEICULO } from "@/lib/clientes";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface FormState {
  nome: string;
  tipoVeiculo: string;
  cnpj: string;
  praca: string;
  contatoNome: string;
  contatoFone: string;
  contatoEmail: string;
  representante: string;
  banco: string;
  agenciaBancaria: string;
  conta: string;
  tipoConta: string;
  pixChave: string;
  retemIr: "sim" | "nao" | "";
  observacoes: string;
  ativo: boolean;
}

const vazio: FormState = {
  nome: "", tipoVeiculo: "Jornal", cnpj: "", praca: "", contatoNome: "", contatoFone: "", contatoEmail: "", representante: "",
  banco: "", agenciaBancaria: "", conta: "", tipoConta: "", pixChave: "", retemIr: "", observacoes: "", ativo: true,
};

const deVeiculo = (v: VeiculoDb): FormState => ({
  nome: v.nome,
  tipoVeiculo: v.tipoVeiculo,
  cnpj: v.cnpj ?? "",
  praca: v.praca ?? "",
  contatoNome: v.contatoNome ?? "",
  contatoFone: v.contatoFone ?? "",
  contatoEmail: v.contatoEmail ?? "",
  representante: v.representante ?? "",
  banco: v.banco ?? "",
  agenciaBancaria: v.agenciaBancaria ?? "",
  conta: v.conta ?? "",
  tipoConta: v.tipoConta ?? "",
  pixChave: v.pixChave ?? "",
  retemIr: v.retemIr === null ? "" : v.retemIr ? "sim" : "nao",
  observacoes: v.observacoes ?? "",
  ativo: v.ativo,
});

const Veiculos = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, canOperate } = useRoles();
  const { data: veiculos = [], isLoading } = useVeiculos();
  const { data: submissions = [] } = useSubmissions();
  const { data: pedidosPorVeiculo = {} } = useQuery({
    queryKey: ["pedidos-por-veiculo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos_insercao").select("veiculo_id");
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const p of data ?? []) m[p.veiculo_id] = (m[p.veiculo_id] ?? 0) + 1;
      return m;
    },
  });

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [resumoId, setResumoId] = useState<string | null>(null);
  const [editando, setEditando] = useState<VeiculoDb | "novo" | null>(null);
  const [form, setForm] = useState<FormState>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [consulta, setConsulta] = useState<DadosCnpj | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erroCnpj, setErroCnpj] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<VeiculoDb | null>(null);

  useEffect(() => {
    setConsulta(null);
    setErroCnpj(null);
  }, [editando]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const abrirNovo = (preenchido?: Partial<FormState>) => {
    setForm({ ...vazio, ...preenchido });
    setEditando("novo");
  };
  const abrirEdicao = (v: VeiculoDb) => {
    setForm(deVeiculo(v));
    setEditando(v);
  };

  const enviosDe = (nome: string) => submissions.filter((s) => norm(s.nomeVeiculo) === norm(nome));

  // Veículos que já enviaram documentos mas ainda não têm cadastro.
  const sugeridos = useMemo(() => {
    const conhecidos = new Set(veiculos.map((v) => norm(v.nome)));
    const mapa = new Map<string, (typeof submissions)[number]>();
    for (const s of submissions) if (!conhecidos.has(norm(s.nomeVeiculo)) && !mapa.has(norm(s.nomeVeiculo))) mapa.set(norm(s.nomeVeiculo), s);
    return [...mapa.values()];
  }, [veiculos, submissions]);

  const lista = veiculos.filter(
    (v) =>
      (filtro === "todos" || (filtro === "ativos" ? v.ativo : !v.ativo)) &&
      (!busca || norm(`${v.nome} ${v.razaoSocial ?? ""} ${v.cnpj ?? ""} ${v.municipio ?? ""} ${v.praca ?? ""}`).includes(norm(busca))),
  );
  const resumo = veiculos.find((v) => v.id === resumoId) ?? null;

  const buscarCnpj = async (valor: string) => {
    if (!cnpjValido(valor)) {
      setErroCnpj("CNPJ inválido. Confira os dígitos.");
      return;
    }
    setConsultando(true);
    setErroCnpj(null);
    try {
      const d = await consultarCnpj(soDigitos(valor));
      setConsulta(d);
      setForm((f) => ({
        ...f,
        cnpj: d.cnpj,
        nome: f.nome.trim() ? f.nome : (d.nomeFantasia ?? d.nomeSugerido ?? ""),
        praca: f.praca.trim() ? f.praca : [d.endereco.municipio, d.endereco.uf].filter(Boolean).join(" - "),
        contatoFone: f.contatoFone.trim() ? f.contatoFone : (d.telefone ?? ""),
        contatoEmail: f.contatoEmail.trim() ? f.contatoEmail : (d.email ?? ""),
        tipoVeiculo: f.tipoVeiculo,
      }));
    } catch (e) {
      setErroCnpj((e as Error).message);
    } finally {
      setConsultando(false);
    }
  };

  const mudarCnpj = (v: string) => {
    const masc = mascararCnpj(v);
    setForm((f) => ({ ...f, cnpj: masc }));
    setErroCnpj(null);
    if (soDigitos(masc).length === 14 && soDigitos(masc) !== soDigitos(consulta?.cnpj ?? "")) void buscarCnpj(masc);
  };

  const salvar = async () => {
    setSalvando(true);
    const payload = {
      nome: form.nome.trim(),
      tipo_veiculo: form.tipoVeiculo,
      cnpj: form.cnpj.trim() || null,
      praca: form.praca.trim() || null,
      contato_nome: form.contatoNome.trim() || null,
      contato_fone: form.contatoFone.trim() || null,
      contato_email: form.contatoEmail.trim() || null,
      representante: form.representante.trim() || null,
      banco: form.banco.trim() || null,
      agencia_bancaria: form.agenciaBancaria.trim() || null,
      conta: form.conta.trim() || null,
      tipo_conta: form.tipoConta || null,
      pix_chave: form.pixChave.trim() || null,
      retem_ir: form.retemIr === "" ? null : form.retemIr === "sim",
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo,
      ...(consulta ? { ...receitaPayload(consulta), telefone: consulta.telefone, email: consulta.email } : {}),
    };
    const { error } =
      editando === "novo"
        ? await supabase.from("veiculos").insert(payload)
        : await supabase.from("veiculos").update(payload).eq("id", (editando as VeiculoDb).id);
    setSalvando(false);
    if (error) {
      toast({
        title: "Não foi possível salvar",
        description: error.code === "23505" ? "Já existe um veículo com esse CNPJ." : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: editando === "novo" ? "Veículo cadastrado" : "Veículo atualizado" });
    const id = editando !== "novo" ? (editando as VeiculoDb).id : null;
    setEditando(null);
    await qc.invalidateQueries({ queryKey: VEICULOS_KEY });
    if (id) setResumoId(id);
  };

  const excluir = async () => {
    if (!excluindo) return;
    const { error } = await supabase.from("veiculos").delete().eq("id", excluindo.id);
    if (error) {
      toast({
        title: "Não foi possível excluir",
        description: error.code === "23503" ? "Este veículo tem Pedidos de Inserção. Desative em vez de excluir." : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Veículo excluído" });
    setExcluindo(null);
    setResumoId(null);
    qc.invalidateQueries({ queryKey: VEICULOS_KEY });
  };

  const totalPis = excluindo ? (pedidosPorVeiculo[excluindo.id] ?? 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Veículos de mídia"
        description="Fornecedores de mídia com dados da Receita Federal, contato e dados de pagamento, prontos para o faturamento."
        actions={
          canOperate && (
            <Button onClick={() => abrirNovo()}>
              <Plus /> Novo veículo
            </Button>
          )
        }
      />

      {canOperate && sugeridos.length > 0 && (
        <section aria-label="Veículos sem cadastro">
          <p className="eyebrow mb-2">Enviaram documentos e ainda não estão cadastrados</p>
          <ul className="divide-y rounded-md border bg-card text-sm">
            {sugeridos.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0 truncate">
                  {s.nomeVeiculo}
                  <span className="text-muted-foreground"> · {s.tipoVeiculo}{s.cidade && ` · ${s.cidade}`}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    abrirNovo({
                      nome: s.nomeVeiculo,
                      tipoVeiculo: s.tipoVeiculo === "Outro" && s.outroTipo ? "Outro" : s.tipoVeiculo,
                      praca: s.cidade,
                      contatoNome: s.contatoNome,
                      contatoFone: s.contatoTelefone,
                      contatoEmail: s.contatoEmail,
                    })
                  }
                >
                  Cadastrar
                </Button>
              </li>
            ))}
          </ul>
          {sugeridos.length > 5 && <p className="mt-1.5 text-xs text-muted-foreground">e mais {sugeridos.length - 5}.</p>}
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, razão social, CNPJ ou cidade" className="pl-9" aria-label="Buscar veículos" />
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Situação">
          {(["ativos", "inativos", "todos"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filtro === f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                filtro === f ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/40",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={veiculos.length === 0 ? "Nenhum veículo cadastrado" : "Nenhum veículo encontrado"}
          description={veiculos.length === 0 ? "Cadastre pelo CNPJ: os dados da Receita Federal vêm preenchidos." : "Ajuste a busca ou o filtro."}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="eyebrow px-4 py-2.5">Veículo</th>
                <th className="eyebrow hidden px-4 py-2.5 md:table-cell">CNPJ</th>
                <th className="eyebrow hidden px-4 py-2.5 lg:table-cell">Praça</th>
                <th className="eyebrow hidden px-4 py-2.5 text-right sm:table-cell">PIs</th>
                <th className="eyebrow px-4 py-2.5 text-right">Envios</th>
                <th className="eyebrow px-4 py-2.5">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((v) => (
                <tr
                  key={v.id}
                  tabIndex={0}
                  onClick={() => setResumoId(v.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setResumoId(v.id))}
                  className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{v.nome}</p>
                    <p className="text-xs text-muted-foreground">{v.tipoVeiculo}{v.razaoSocial && ` · ${v.razaoSocial}`}</p>
                  </td>
                  <td className="num hidden px-4 py-3 text-muted-foreground md:table-cell">{v.cnpj || "—"}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{v.praca || "—"}</td>
                  <td className="num hidden px-4 py-3 text-right sm:table-cell">{pedidosPorVeiculo[v.id] ?? 0}</td>
                  <td className="num px-4 py-3 text-right">{enviosDe(v.nome).length}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs", v.ativo ? "text-success" : "text-muted-foreground")}>{v.ativo ? "Ativo" : "Inativo"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="num border-t px-4 py-2.5 text-xs text-muted-foreground">
            {lista.length} {lista.length === 1 ? "veículo" : "veículos"}
          </p>
        </div>
      )}

      {/* Resumo */}
      <Sheet open={!!resumo} onOpenChange={(o) => !o && setResumoId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {resumo && (
            <>
              <SheetHeader className="text-left">
                <p className="eyebrow">{resumo.tipoVeiculo}</p>
                <SheetTitle className="font-serif text-2xl font-medium">{resumo.nome}</SheetTitle>
                <SheetDescription className="num">
                  {resumo.cnpj ? `CNPJ ${resumo.cnpj}` : "CNPJ não informado"} · {resumo.ativo ? "ativo" : "inativo"}
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-6 grid grid-cols-3 divide-x rounded-md border">
                {(
                  [
                    ["Pedidos de inserção", String(pedidosPorVeiculo[resumo.id] ?? 0)],
                    ["Envios de documentos", String(enviosDe(resumo.nome).length)],
                    ["Retém IR", resumo.retemIr === null ? "—" : resumo.retemIr ? "Sim" : "Não"],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="px-3 py-3">
                    <dd className="num font-serif text-lg leading-tight">{v}</dd>
                    <dt className="mt-0.5 text-[11px] text-muted-foreground">{l}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link to={`/app/documentos?q=${encodeURIComponent(resumo.nome)}`} className="font-medium text-primary hover:underline">
                  Ver documentos
                </Link>
                <Link to={`/app/pedidos?veiculo=${resumo.id}`} className="font-medium text-primary hover:underline">
                  Ver pedidos de inserção
                </Link>
              </div>

              <section className="mt-8 space-y-6">
                <div>
                  <p className="eyebrow mb-2">Contato comercial</p>
                  <dl className="divide-y border-y text-sm">
                    {(
                      [
                        ["Responsável", resumo.contatoNome],
                        ["Telefone / WhatsApp", resumo.contatoFone],
                        ["E-mail", resumo.contatoEmail],
                        ["Representante", resumo.representante],
                        ["Praça", resumo.praca],
                      ] as const
                    ).map(([l, v]) => (
                      <div key={l} className="grid grid-cols-[9.5rem_1fr] gap-x-4 py-2">
                        <dt className="text-muted-foreground">{l}</dt>
                        <dd className="min-w-0 break-words">{v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <p className="eyebrow mb-2">Dados para pagamento</p>
                  <dl className="divide-y border-y text-sm">
                    {(
                      [
                        ["Banco", resumo.banco],
                        ["Agência", resumo.agenciaBancaria],
                        ["Conta", resumo.conta ? `${resumo.conta}${resumo.tipoConta ? ` (${resumo.tipoConta})` : ""}` : null],
                        ["Chave PIX", resumo.pixChave],
                      ] as const
                    ).map(([l, v]) => (
                      <div key={l} className="grid grid-cols-[9.5rem_1fr] gap-x-4 py-2">
                        <dt className="text-muted-foreground">{l}</dt>
                        <dd className="num min-w-0 break-words">{v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {viewDoRegistro(resumo) && (
                  <div>
                    <p className="eyebrow mb-2">Dados da Receita Federal</p>
                    <DadosReceita d={viewDoRegistro(resumo)!} consultadoEm={resumo.consultadoEm} />
                  </div>
                )}

                {resumo.observacoes && (
                  <div>
                    <p className="eyebrow mb-2">Observações</p>
                    <p className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">{resumo.observacoes}</p>
                  </div>
                )}
              </section>

              <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
                {canOperate ? (
                  <Button variant="outline" onClick={() => { setResumoId(null); abrirEdicao(resumo); }}>
                    Editar cadastro
                  </Button>
                ) : (
                  <span />
                )}
                {isAdmin && (
                  <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setExcluindo(resumo)}>
                    Excluir veículo
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Cadastro e edição */}
      <Sheet open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-2xl font-medium">{editando === "novo" ? "Novo veículo" : "Editar veículo"}</SheetTitle>
            <SheetDescription>Digite o CNPJ para trazer os dados da Receita Federal.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="v-cnpj">CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  id="v-cnpj"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.cnpj}
                  onChange={(e) => mudarCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  aria-describedby="v-cnpj-ajuda"
                  autoFocus={editando === "novo"}
                />
                <Button type="button" variant="outline" onClick={() => buscarCnpj(form.cnpj)} disabled={consultando || soDigitos(form.cnpj).length !== 14}>
                  {consultando && <Loader2 className="animate-spin" />}
                  {consulta || (editando && editando !== "novo" && editando.razaoSocial) ? "Atualizar" : "Buscar"}
                </Button>
              </div>
              <p id="v-cnpj-ajuda" className={cn("text-xs", erroCnpj ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
                {erroCnpj ?? (consultando ? "Consultando a Receita Federal…" : consulta ? "Dados preenchidos pela Receita Federal (fonte: " + consulta.fonte + ")." : "O cadastro sai completo a partir do CNPJ.")}
              </p>
            </div>

            {(consulta || (editando && editando !== "novo" && viewDoRegistro(editando))) && (
              <section aria-label="Dados da Receita Federal">
                <p className="eyebrow mb-2">Dados da Receita Federal</p>
                <DadosReceita
                  d={consulta ? viewDaConsulta(consulta) : viewDoRegistro(editando as VeiculoDb)!}
                  fonte={consulta?.fonte}
                  consultadoEm={consulta ? new Date().toISOString() : (editando as VeiculoDb).consultadoEm}
                />
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
              <div className="space-y-1.5">
                <Label htmlFor="v-nome">Nome do veículo</Label>
                <Input id="v-nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Jornal Exemplo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-tipo">Tipo</Label>
                <Select value={form.tipoVeiculo} onValueChange={(v) => set("tipoVeiculo", v)}>
                  <SelectTrigger id="v-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-praca">Praça</Label>
              <Input id="v-praca" value={form.praca} onChange={(e) => set("praca", e.target.value)} placeholder="Cidade - UF onde circula ou transmite" />
            </div>

            <fieldset className="space-y-4 border-t pt-4">
              <legend className="eyebrow -mt-[1.15rem] bg-background px-2">Contato comercial</legend>
              <div className="space-y-1.5">
                <Label htmlFor="v-contato">Responsável</Label>
                <Input id="v-contato" value={form.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="v-fone">Telefone / WhatsApp</Label>
                  <Input id="v-fone" value={form.contatoFone} onChange={(e) => set("contatoFone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-email">E-mail</Label>
                  <Input id="v-email" type="email" value={form.contatoEmail} onChange={(e) => set("contatoEmail", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-repr">Representante comercial</Label>
                <Input id="v-repr" value={form.representante} onChange={(e) => set("representante", e.target.value)} />
              </div>
            </fieldset>

            <fieldset className="space-y-4 border-t pt-4">
              <legend className="eyebrow -mt-[1.15rem] bg-background px-2">Dados para pagamento</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="v-banco">Banco</Label>
                  <Input id="v-banco" value={form.banco} onChange={(e) => set("banco", e.target.value)} placeholder="001 - Banco do Brasil" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-ag">Agência</Label>
                  <Input id="v-ag" value={form.agenciaBancaria} onChange={(e) => set("agenciaBancaria", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-conta">Conta</Label>
                  <Input id="v-conta" value={form.conta} onChange={(e) => set("conta", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-tconta">Tipo de conta</Label>
                  <Select value={form.tipoConta || "nenhum"} onValueChange={(v) => set("tipoConta", v === "nenhum" ? "" : v)}>
                    <SelectTrigger id="v-tconta"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não informado</SelectItem>
                      <SelectItem value="Corrente">Corrente</SelectItem>
                      <SelectItem value="Poupança">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-pix">Chave PIX</Label>
                <Input id="v-pix" value={form.pixChave} onChange={(e) => set("pixChave", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-ir">Sofre retenção de IR?</Label>
                <Select value={form.retemIr || "nao_informado"} onValueChange={(v) => set("retemIr", v === "nao_informado" ? "" : (v as "sim" | "nao"))}>
                  <SelectTrigger id="v-ir"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informado</SelectItem>
                    <SelectItem value="sim">Sim, destacar IR na nota</SelectItem>
                    <SelectItem value="nao">Não, isento ou optante do Simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="v-obs">Observações</Label>
              <Textarea id="v-obs" rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5 text-sm">
              <span>
                Veículo ativo
                <span className="block text-xs text-muted-foreground">Inativo deixa de aparecer ao emitir novos PIs.</span>
              </span>
              <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
            </label>
          </div>

          <SheetFooter className="gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || form.nome.trim().length < 2}>
              {salvando && <Loader2 className="animate-spin" />} Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluindo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              {totalPis > 0
                ? `Este veículo tem ${totalPis} ${totalPis === 1 ? "Pedido de Inserção" : "Pedidos de Inserção"} e não pode ser excluído. Desative o cadastro para ele sair das listas.`
                : "O cadastro é removido de vez. Os envios de documentos já recebidos continuam salvos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            {totalPis > 0 ? (
              <AlertDialogAction
                onClick={async () => {
                  await supabase.from("veiculos").update({ ativo: false }).eq("id", excluindo!.id);
                  setExcluindo(null);
                  qc.invalidateQueries({ queryKey: VEICULOS_KEY });
                }}
              >
                Desativar
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Veiculos;
