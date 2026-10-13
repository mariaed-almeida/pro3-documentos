import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import DadosReceita, { type ViewReceita } from "@/components/app/DadosReceita";
import { consultarCnpj, cnpjValido, enderecoLinha, limparLogradouro, mascararCnpj, soDigitos, type DadosCnpj } from "@/lib/cnpj";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSubmissions } from "@/hooks/use-submissions";
import { CLIENTES_KEY, useClientes, type ClienteDb } from "@/hooks/use-clientes";
import { useMedicoes } from "@/hooks/use-medicoes";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { getCampaigns } from "@/lib/campaigns";
import { formatBRL } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

const linhas = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);
const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface FormState {
  nome: string;
  cnpj: string;
  enderecoPostal: string;
  textoObrigatorioNf: string;
  contratos: string;
  regrasNf: string;
  telefone: string;
  email: string;
  ativo: boolean;
}

const vazio: FormState = { nome: "", cnpj: "", enderecoPostal: "", textoObrigatorioNf: "", contratos: "", regrasNf: "", telefone: "", email: "", ativo: true };

const deCliente = (c: ClienteDb): FormState => ({
  nome: c.nome,
  cnpj: c.cnpj ?? "",
  enderecoPostal: c.enderecoPostal ?? "",
  textoObrigatorioNf: c.textoObrigatorioNf ?? "",
  contratos: c.contratoInfo.join("\n"),
  regrasNf: c.observacoesNf.join("\n"),
  telefone: c.telefone ?? "",
  email: c.email ?? "",
  ativo: c.ativo,
});

const viewDoCliente = (c: ClienteDb): ViewReceita | null =>
  c.razaoSocial
    ? {
        razaoSocial: c.razaoSocial,
        nomeFantasia: c.nomeFantasia,
        situacao: c.situacaoCadastral,
        dataSituacao: c.dataSituacao,
        dataAbertura: c.dataAbertura,
        naturezaJuridica: c.naturezaJuridica,
        porte: c.porte,
        cnaePrincipal: c.cnaePrincipal,
        cnaesSecundarios: c.cnaesSecundarios,
        capitalSocial: c.capitalSocial,
        optanteSimples: c.optanteSimples,
        endereco: { logradouro: c.logradouro, numero: c.numero, complemento: c.complemento, bairro: c.bairro, municipio: c.municipio, uf: c.uf, cep: c.cep },
        telefone: c.telefone,
        email: c.email,
        socios: c.socios,
      }
    : null;

const viewDaConsulta = (d: DadosCnpj): ViewReceita => ({
  razaoSocial: d.razaoSocial,
  nomeFantasia: d.nomeFantasia,
  situacao: d.situacao,
  dataSituacao: d.dataSituacao,
  dataAbertura: d.dataAbertura,
  naturezaJuridica: d.naturezaJuridica,
  porte: d.porte,
  cnaePrincipal: d.cnaePrincipal,
  cnaesSecundarios: d.cnaesSecundarios,
  capitalSocial: d.capitalSocial,
  optanteSimples: d.optanteSimples,
  endereco: d.endereco,
  telefone: d.telefone,
  email: d.email,
  socios: d.socios,
});

const Clientes = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useRoles();
  const { data: clientes = [], isLoading } = useClientes();
  const { data: submissions = [] } = useSubmissions();
  const { data: medicoes = [] } = useMedicoes();
  const { data: campanhas = [] } = useQuery({ queryKey: ["campanhas"], queryFn: () => getCampaigns() });

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [resumoDe, setResumoDe] = useState<string | null>(null);
  const [editando, setEditando] = useState<ClienteDb | "novo" | null>(null);
  const [form, setForm] = useState<FormState>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [consulta, setConsulta] = useState<DadosCnpj | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erroCnpj, setErroCnpj] = useState<string | null>(null);

  useEffect(() => {
    setConsulta(null);
    setErroCnpj(null);
    if (editando === "novo") setForm(vazio);
    else if (editando) setForm(deCliente(editando));
  }, [editando]);

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
        // Só sugere o que o usuário ainda não preencheu.
        nome: f.nome.trim() ? f.nome : (d.nomeSugerido ?? d.razaoSocial ?? ""),
        enderecoPostal: f.enderecoPostal.trim() ? f.enderecoPostal : enderecoLinha({ ...d.endereco, logradouro: limparLogradouro(d.endereco.logradouro) }),
        telefone: f.telefone.trim() ? f.telefone : (d.telefone ?? ""),
        email: f.email.trim() ? f.email : (d.email ?? ""),
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
    // Ao completar os 14 dígitos, consulta sozinho.
    if (soDigitos(masc).length === 14 && soDigitos(masc) !== soDigitos(consulta?.cnpj ?? "")) void buscarCnpj(masc);
  };

  const numeros = useMemo(
    () =>
      new Map(
        clientes.map((c) => {
          const envios = submissions.filter((s) => s.cliente === c.nome);
          const meds = medicoes.filter((m) => m.cliente === c.nome && m.status !== "cancelado");
          return [
            c.nome,
            {
              envios: envios.length,
              abertos: envios.filter((s) => s.status === "recebido" || s.status === "em_revisao").length,
              campanhasAtivas: campanhas.filter((x) => x.cliente === c.nome && x.ativa).length,
              medido: meds.reduce((a, m) => a + m.valorLiquido, 0),
              aPagar: meds.filter((m) => m.status === "aguardando_liberacao" || m.status === "liberado").reduce((a, m) => a + m.valorLiquido, 0),
            },
          ] as const;
        }),
      ),
    [clientes, submissions, campanhas, medicoes],
  );

  const lista = clientes.filter(
    (c) =>
      (filtro === "todos" || (filtro === "ativos" ? c.ativo : !c.ativo)) &&
      (!busca || norm(`${c.nome} ${c.cnpj ?? ""}`).includes(norm(busca))),
  );

  const resumo = clientes.find((c) => c.nome === resumoDe) ?? null;
  const r = resumo ? numeros.get(resumo.nome) : undefined;
  const campanhasDoCliente = resumo ? campanhas.filter((x) => x.cliente === resumo.nome) : [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    setSalvando(true);
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      endereco_postal: form.enderecoPostal.trim() || null,
      texto_obrigatorio_nf: form.textoObrigatorioNf.trim() || null,
      contrato_info: linhas(form.contratos),
      observacoes_nf: linhas(form.regrasNf),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      ativo: form.ativo,
      ...(consulta
        ? {
            razao_social: consulta.razaoSocial,
            nome_fantasia: consulta.nomeFantasia,
            situacao_cadastral: consulta.situacao,
            data_situacao: consulta.dataSituacao,
            data_abertura: consulta.dataAbertura,
            natureza_juridica: consulta.naturezaJuridica,
            porte: consulta.porte,
            cnae_principal: consulta.cnaePrincipal,
            cnaes_secundarios: consulta.cnaesSecundarios,
            capital_social: consulta.capitalSocial,
            optante_simples: consulta.optanteSimples,
            logradouro: limparLogradouro(consulta.endereco.logradouro),
            numero: consulta.endereco.numero,
            complemento: consulta.endereco.complemento,
            bairro: consulta.endereco.bairro,
            municipio: consulta.endereco.municipio,
            uf: consulta.endereco.uf,
            cep: consulta.endereco.cep,
            socios: consulta.socios as unknown as Json,
            consultado_em: new Date().toISOString(),
          }
        : {}),
    };
    const { error } =
      editando === "novo"
        ? await supabase.from("clientes").insert(payload)
        : await supabase.from("clientes").update(payload).eq("id", (editando as ClienteDb).id);
    setSalvando(false);
    if (error) {
      toast({
        title: "Não foi possível salvar",
        description: error.code === "23505" ? (error.message.includes("cnpj") ? "Já existe um cliente com esse CNPJ." : "Já existe um cliente com esse nome.") : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: editando === "novo" ? "Cliente cadastrado" : "Cliente atualizado" });
    if (editando !== "novo") setResumoDe(payload.nome);
    setEditando(null);
    qc.invalidateQueries({ queryKey: CLIENTES_KEY });
    qc.invalidateQueries({ queryKey: ["campanhas"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Clientes"
        description="Órgãos contratantes. Abra um cliente para ver o resumo, as campanhas e as regras de nota fiscal."
        actions={
          isAdmin && (
            <Button onClick={() => setEditando("novo")}>
              <Plus /> Novo cliente
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CNPJ" className="pl-9" aria-label="Buscar clientes" />
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
        <EmptyState icon={Building2} title="Nenhum cliente encontrado" description={clientes.length === 0 ? "Cadastre o primeiro cliente para abrir campanhas." : "Ajuste a busca ou o filtro."} />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="eyebrow px-4 py-2.5">Cliente</th>
                <th className="eyebrow hidden px-4 py-2.5 md:table-cell">CNPJ</th>
                <th className="eyebrow hidden px-4 py-2.5 text-right sm:table-cell">Campanhas</th>
                <th className="eyebrow px-4 py-2.5 text-right">Envios</th>
                <th className="eyebrow hidden px-4 py-2.5 text-right lg:table-cell">Em aberto</th>
                <th className="eyebrow px-4 py-2.5">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((c) => {
                const n = numeros.get(c.nome)!;
                return (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    onClick={() => setResumoDe(c.nome)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setResumoDe(c.nome))}
                    className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                  >
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="num hidden px-4 py-3 text-muted-foreground md:table-cell">{c.cnpj || "—"}</td>
                    <td className="num hidden px-4 py-3 text-right sm:table-cell">{n.campanhasAtivas}</td>
                    <td className="num px-4 py-3 text-right">{n.envios}</td>
                    <td className="num hidden px-4 py-3 text-right lg:table-cell">{n.abertos}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", c.ativo ? "text-success" : "text-muted-foreground")}>{c.ativo ? "Ativo" : "Inativo"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="num border-t px-4 py-2.5 text-xs text-muted-foreground">
            {lista.length} {lista.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
      )}

      {/* Resumo do cliente */}
      <Sheet open={!!resumo} onOpenChange={(o) => !o && setResumoDe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {resumo && r && (
            <>
              <SheetHeader className="text-left">
                <p className="eyebrow">Cliente</p>
                <SheetTitle className="font-serif text-2xl font-medium">{resumo.nome}</SheetTitle>
                <SheetDescription className="num">
                  {resumo.cnpj ? `CNPJ ${resumo.cnpj}` : "CNPJ não informado"} · {resumo.ativo ? "ativo" : "inativo"}
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-6 grid grid-cols-2 divide-x divide-y rounded-md border sm:grid-cols-4 sm:divide-y-0">
                {(
                  [
                    ["Envios", String(r.envios)],
                    ["Em aberto", String(r.abertos)],
                    ["Valor medido", formatBRL(r.medido)],
                    ["A pagar", formatBRL(r.aPagar)],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="px-3 py-3">
                    <dd className="num font-serif text-lg leading-tight">{v}</dd>
                    <dt className="mt-0.5 text-[11px] text-muted-foreground">{l}</dt>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link to={`/app/documentos?cliente=${encodeURIComponent(resumo.nome)}`} className="font-medium text-primary hover:underline">
                  Ver documentos
                </Link>
                <Link to="/app/cadastros/campanhas" className="font-medium text-primary hover:underline">
                  Gerenciar campanhas
                </Link>
              </div>

              <section className="mt-8">
                <p className="eyebrow mb-2">Campanhas</p>
                {campanhasDoCliente.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>
                ) : (
                  <ul className="divide-y border-y text-sm">
                    {campanhasDoCliente.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                        <span className={cn(!x.ativa && "text-muted-foreground")}>{x.nome}</span>
                        <span className="text-xs text-muted-foreground">{x.ativa ? "Ativa" : "Inativa"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {viewDoCliente(resumo) && (
                <section className="mt-8">
                  <p className="eyebrow mb-2">Dados da Receita Federal</p>
                  <DadosReceita d={viewDoCliente(resumo)!} consultadoEm={resumo.consultadoEm} />
                </section>
              )}

              <section className="mt-8 space-y-5">
                <div>
                  <p className="eyebrow mb-2">Contrato e licitação</p>
                  {resumo.contratoInfo.length ? (
                    <ul className="space-y-1 text-sm">{resumo.contratoInfo.map((x) => <li key={x}>{x}</li>)}</ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não informado.</p>
                  )}
                </div>
                <div>
                  <p className="eyebrow mb-2">Endereço postal</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{resumo.enderecoPostal || "Não informado."}</p>
                </div>
                {resumo.textoObrigatorioNf && (
                  <div>
                    <p className="eyebrow mb-2">Texto obrigatório na nota</p>
                    <p className="border-l-2 pl-3 text-sm italic leading-relaxed text-muted-foreground">{resumo.textoObrigatorioNf}</p>
                  </div>
                )}
                <div>
                  <p className="eyebrow mb-2">Regras da nota fiscal</p>
                  {resumo.observacoesNf.length ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-border">
                      {resumo.observacoesNf.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
                  )}
                </div>
              </section>

              {isAdmin && (
                <div className="mt-8 border-t pt-5">
                  <Button variant="outline" onClick={() => { setResumoDe(null); setEditando(resumo); }}>
                    Editar cadastro
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Cadastro e edição */}
      <Sheet open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-2xl font-medium">{editando === "novo" ? "Novo cliente" : "Editar cliente"}</SheetTitle>
            <SheetDescription>As regras aparecem para o veículo no formulário de envio.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="c-cnpj">CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  id="c-cnpj"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.cnpj}
                  onChange={(e) => mudarCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  aria-describedby="c-cnpj-ajuda"
                  autoFocus={editando === "novo"}
                />
                <Button type="button" variant="outline" onClick={() => buscarCnpj(form.cnpj)} disabled={consultando || soDigitos(form.cnpj).length !== 14}>
                  {consultando && <Loader2 className="animate-spin" />}
                  {consulta || (editando && editando !== "novo" && editando.razaoSocial) ? "Atualizar" : "Buscar"}
                </Button>
              </div>
              <p id="c-cnpj-ajuda" className={cn("text-xs", erroCnpj ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
                {erroCnpj ?? (consultando ? "Consultando a Receita Federal…" : consulta ? "Dados preenchidos pela Receita Federal (fonte: " + consulta.fonte + ")." : "Digite o CNPJ para trazer os dados da Receita Federal.")}
              </p>
            </div>

            {(consulta || (editando && editando !== "novo" && viewDoCliente(editando))) && (
              <section aria-label="Dados da Receita Federal">
                <p className="eyebrow mb-2">Dados da Receita Federal</p>
                <DadosReceita
                  d={consulta ? viewDaConsulta(consulta) : viewDoCliente(editando as ClienteDb)!}
                  fonte={consulta?.fonte}
                  consultadoEm={consulta ? new Date().toISOString() : (editando as ClienteDb).consultadoEm}
                />
              </section>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="c-nome">Nome de exibição</Label>
              <Input id="c-nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Prefeitura de Exemplo" />
              <p className="text-xs text-muted-foreground">
                É o nome que o veículo vê no formulário.
                {editando !== "novo" && " Ao renomear, as campanhas vinculadas acompanham; envios antigos mantêm o nome da época."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-tel">Telefone</Label>
                <Input id="c-tel" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">E-mail</Label>
                <Input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-contratos">Contrato e licitação</Label>
              <Textarea id="c-contratos" rows={3} value={form.contratos} onChange={(e) => set("contratos", e.target.value)} placeholder={"Contrato nº 000/2026\nConcorrência nº 000/2026"} />
              <p className="text-xs text-muted-foreground">Um item por linha. A pré-análise confere se constam na nota.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-end">Endereço para correspondência</Label>
              <Textarea id="c-end" rows={2} value={form.enderecoPostal} onChange={(e) => set("enderecoPostal", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-texto">Texto obrigatório na nota fiscal</Label>
              <Textarea id="c-texto" rows={2} value={form.textoObrigatorioNf} onChange={(e) => set("textoObrigatorioNf", e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe vazio se o cliente não exige.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-regras">Regras da nota fiscal</Label>
              <Textarea id="c-regras" rows={6} value={form.regrasNf} onChange={(e) => set("regrasNf", e.target.value)} />
              <p className="text-xs text-muted-foreground">Uma regra por linha.</p>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5 text-sm">
              <span>
                Cliente ativo
                <span className="block text-xs text-muted-foreground">Inativo some do formulário de envio.</span>
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
    </div>
  );
};

export default Clientes;
