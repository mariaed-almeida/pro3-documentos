import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRoles, ROLE_LABEL, type AppRole } from "@/hooks/use-roles";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAPEIS: { id: AppRole; hint: string }[] = [
  { id: "operador", hint: "Confere documentos, aprova e fecha medições" },
  { id: "financeiro", hint: "Libera e registra pagamentos" },
  { id: "admin", hint: "Tudo, mais clientes, usuários e regras" },
];

interface Usuario {
  id: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
  createdAt: string;
  papeis: AppRole[];
}

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gerir-usuarios", { body });
  if (error) {
    // O corpo de erro da função vem em error.context (Response).
    let msg = error.message;
    try {
      const j = await (error as { context?: Response }).context?.json();
      if (j?.error) msg = j.error;
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const Usuarios = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const session = useSession();
  const { isAdmin, isLoading: carregandoPapeis } = useRoles();

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    enabled: isAdmin,
    queryFn: async (): Promise<Usuario[]> => {
      const [{ data: perfis, error: e1 }, { data: papeis, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, ativo, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1 || e2) throw e1 || e2;
      return (perfis ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        ativo: p.ativo,
        createdAt: p.created_at,
        papeis: (papeis ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["usuarios"] });
  const erro = (e: Error) => toast({ title: "Não foi possível concluir", description: e.message, variant: "destructive" });

  const alternarPapel = useMutation({
    mutationFn: async ({ u, papel }: { u: Usuario; papel: AppRole }) => {
      const tem = u.papeis.includes(papel);
      if (tem && papel === "admin" && u.id === session?.user.id) throw new Error("Você não pode remover o próprio acesso de administrador.");
      const { error } = tem
        ? await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", papel)
        : await supabase.from("user_roles").insert({ user_id: u.id, role: papel });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: erro,
  });

  const definirAtivo = useMutation({
    mutationFn: (v: { userId: string; ativo: boolean }) => chamar({ action: "definir_ativo", ...v }),
    onSuccess: refresh,
    onError: erro,
  });

  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", papeis: ["operador"] as AppRole[] });
  const criar = useMutation({
    mutationFn: () => chamar({ action: "criar", ...form }),
    onSuccess: () => {
      toast({ title: "Usuário criado", description: "Passe a senha provisória por um canal seguro." });
      setNovo(false);
      setForm({ nome: "", email: "", senha: "", papeis: ["operador"] });
      refresh();
    },
    onError: erro,
  });

  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const redefinir = useMutation({
    mutationFn: () => chamar({ action: "redefinir_senha", userId: senhaDe!.id, senha: novaSenha }),
    onSuccess: () => {
      toast({ title: "Senha redefinida" });
      setSenhaDe(null);
      setNovaSenha("");
    },
    onError: erro,
  });

  if (carregandoPapeis) return null;
  if (!isAdmin) {
    return <EmptyState icon={ShieldAlert} title="Acesso restrito" description="Só administradores gerenciam usuários e papéis." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Usuários"
        description="Quem acessa o painel e o que cada pessoa pode fazer. Quem não tem nenhum papel não vê dados."
        actions={
          <Button onClick={() => setNovo(true)}>
            <Plus /> Novo usuário
          </Button>
        }
      />

      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
        {PAPEIS.map((p) => (
          <div key={p.id}>
            <dt className="font-medium">{ROLE_LABEL[p.id]}</dt>
            <dd className="text-xs text-muted-foreground">{p.hint}</dd>
          </div>
        ))}
      </dl>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="eyebrow px-4 py-2.5">Pessoa</th>
                {PAPEIS.map((p) => (
                  <th key={p.id} className="eyebrow px-3 py-2.5 text-center">
                    {ROLE_LABEL[p.id]}
                  </th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map((u) => {
                const eu = u.id === session?.user.id;
                const semPapel = u.papeis.length === 0;
                return (
                  <tr key={u.id} className={cn("align-middle", !u.ativo && "opacity-55")}>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {u.nome || u.email}
                        {eu && <span className="ml-2 text-xs font-normal text-muted-foreground">você</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.email} · desde {formatDate(u.createdAt)}
                        {semPapel && u.ativo && <span className="ml-2 text-warning">sem acesso</span>}
                        {!u.ativo && <span className="ml-2">desativado</span>}
                      </p>
                    </td>
                    {PAPEIS.map((p) => (
                      <td key={p.id} className="px-3 py-3 text-center">
                        <Checkbox
                          checked={u.papeis.includes(p.id)}
                          disabled={!u.ativo || alternarPapel.isPending}
                          onCheckedChange={() => alternarPapel.mutate({ u, papel: p.id })}
                          aria-label={`${ROLE_LABEL[p.id]}: ${u.nome || u.email}`}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSenhaDe(u)} disabled={!u.ativo}>
                        Senha
                      </Button>
                      {!eu && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={u.ativo ? "text-muted-foreground hover:text-destructive" : ""}
                          onClick={() => definirAtivo.mutate({ userId: u.id, ativo: !u.ativo })}
                          disabled={definirAtivo.isPending}
                        >
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>A conta já nasce confirmada. Peça para a pessoa trocar a senha no primeiro acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-nome">Nome</Label>
              <Input id="u-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">E-mail</Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-senha">Senha provisória</Label>
              <Input id="u-senha" type="text" autoComplete="off" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Papéis</legend>
              {PAPEIS.map((p) => (
                <label key={p.id} className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={form.papeis.includes(p.id)}
                    onCheckedChange={(v) =>
                      setForm({ ...form, papeis: v ? [...form.papeis, p.id] : form.papeis.filter((x) => x !== p.id) })
                    }
                  />
                  <span>
                    {ROLE_LABEL[p.id]}
                    <span className="block text-xs text-muted-foreground">{p.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criar.mutate()}
              disabled={criar.isPending || form.nome.trim().length < 2 || !form.email.includes("@") || form.senha.length < 8 || form.papeis.length === 0}
            >
              {criar.isPending && <Loader2 className="animate-spin" />} Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!senhaDe} onOpenChange={(o) => !o && setSenhaDe(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>{senhaDe?.nome || senhaDe?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <Input id="nova-senha" type="text" autoComplete="off" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaDe(null)}>
              Cancelar
            </Button>
            <Button onClick={() => redefinir.mutate()} disabled={redefinir.isPending || novaSenha.length < 8}>
              {redefinir.isPending && <Loader2 className="animate-spin" />} Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
