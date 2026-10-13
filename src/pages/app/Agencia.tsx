import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Panel from "@/components/app/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import { getAgencia } from "@/lib/pedidos-db";
import type { Agencia as AgenciaT } from "@/lib/pedidos";
import { supabase } from "@/integrations/supabase/client";

const CAMPOS: { k: keyof Omit<AgenciaT, "orientacoesGerais">; rotulo: string; largo?: boolean; ajuda?: string }[] = [
  { k: "razaoSocial", rotulo: "Razão social", largo: true },
  { k: "cnpj", rotulo: "CNPJ" },
  { k: "inscricaoEstadual", rotulo: "Inscrição estadual" },
  { k: "inscricaoMunicipal", rotulo: "Inscrição municipal" },
  { k: "endereco", rotulo: "Endereço", largo: true },
  { k: "cidadeUf", rotulo: "Cidade - UF" },
  { k: "cep", rotulo: "CEP" },
  { k: "fone", rotulo: "Telefone" },
  { k: "whatsapp", rotulo: "WhatsApp" },
  { k: "emailFinanceiro", rotulo: "E-mail do financeiro" },
  { k: "emailMidia", rotulo: "E-mail da mídia", ajuda: "Para onde o veículo envia o faturamento." },
  { k: "enderecoCorrespondencia", rotulo: "Endereço para envio de originais", largo: true },
  { k: "assinaturaNome", rotulo: "Assinatura no PI: nome" },
  { k: "assinaturaCargo", rotulo: "Assinatura no PI: setor" },
];

const Agencia = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useRoles();
  const { data, isLoading } = useQuery({ queryKey: ["agencia"], queryFn: getAgencia });
  const [form, setForm] = useState<AgenciaT | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const set = <K extends keyof AgenciaT>(k: K, v: AgenciaT[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from("agencia")
      .update({
        razao_social: form.razaoSocial,
        endereco: form.endereco,
        cidade_uf: form.cidadeUf,
        cep: form.cep,
        fone: form.fone || null,
        whatsapp: form.whatsapp || null,
        cnpj: form.cnpj,
        inscricao_estadual: form.inscricaoEstadual || null,
        inscricao_municipal: form.inscricaoMunicipal || null,
        email_financeiro: form.emailFinanceiro || null,
        email_midia: form.emailMidia || null,
        endereco_correspondencia: form.enderecoCorrespondencia || null,
        assinatura_nome: form.assinaturaNome || null,
        assinatura_cargo: form.assinaturaCargo || null,
        orientacoes_gerais: form.orientacoesGerais.map((o) => o.trim()).filter(Boolean),
      })
      .eq("id", true);
    setSalvando(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dados da agência salvos" });
    qc.invalidateQueries({ queryKey: ["agencia"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Agência"
        description="Dados que saem no cabeçalho e no rodapé do Pedido de Inserção, e as orientações fixas impressas na segunda página."
        actions={
          isAdmin && (
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" />} Salvar
            </Button>
          )
        }
      />

      <fieldset disabled={!isAdmin} className="space-y-6">
        <Panel title="Dados da agência">
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <div key={c.k} className={c.largo ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                <Label htmlFor={`ag-${c.k}`}>{c.rotulo}</Label>
                <Input id={`ag-${c.k}`} value={form[c.k]} onChange={(e) => set(c.k, e.target.value)} />
                {c.ajuda && <p className="text-xs text-muted-foreground">{c.ajuda}</p>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Demais orientações do PI"
          description="Itens fixos impressos depois das regras de cada cliente. A numeração é automática. Use {endereco} onde deve entrar o endereço para envio de originais."
          actions={
            isAdmin && (
              <Button type="button" variant="outline" size="sm" onClick={() => set("orientacoesGerais", [...form.orientacoesGerais, ""])}>
                <Plus /> Item
              </Button>
            )
          }
        >
          <ol className="space-y-4">
            {form.orientacoesGerais.map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="num mt-2 w-6 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                <Textarea
                  aria-label={`Orientação ${i + 1}`}
                  rows={Math.min(8, Math.max(2, Math.ceil(o.length / 110) + o.split("\n").length - 1))}
                  value={o}
                  onChange={(e) => set("orientacoesGerais", form.orientacoesGerais.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover orientação ${i + 1}`}
                    onClick={() => set("orientacoesGerais", form.orientacoesGerais.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      </fieldset>
      {!isAdmin && <p className="text-xs text-muted-foreground">Só administradores editam os dados da agência.</p>}
    </div>
  );
};

export default Agencia;
