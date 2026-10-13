import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoPro3 from "@/assets/logo-pro3.png";

const OperadorLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // `next` só vale se for caminho relativo do mesmo site.
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const redirectTo = nextPath ?? "/app";

  useEffect(() => {
    const go = (hasSession: boolean) => {
      if (hasSession) navigate(redirectTo, { replace: true });
      setCheckingSession(false);
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => go(!!session));
    supabase.auth.getSession().then(({ data: { session } }) => go(!!session));
    return () => data.subscription.unsubscribe();
  }, [navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast({ title: "E-mail ou senha incorretos", variant: "destructive" });
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_30rem]">
      <aside className="relative hidden flex-col justify-between border-r bg-sidebar p-12 lg:flex">
        <img src={logoPro3} alt="Pró3 Comunicação" className="h-12 w-auto self-start" />
        <blockquote className="max-w-lg">
          <p className="font-serif text-4xl leading-[1.15] tracking-tight">
            Cada PI conferido a tempo é um pagamento que não atrasa.
          </p>
          <footer className="mt-6 text-sm text-muted-foreground">
            Conferência de documentos de faturamento · ALESC, Xanxerê e Chapecó
          </footer>
        </blockquote>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Pró3 Comunicação Ltda.</p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-14">
        <img src={logoPro3} alt="Pró3 Comunicação" className="mb-10 h-10 w-auto self-start lg:hidden" />
        <div className="w-full max-w-sm">
          <p className="eyebrow mb-2">Espaço de operações</p>
          <h1 className="text-3xl">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesso restrito à equipe da Pró3.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="nome@pro3.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "Entrando" : "Entrar"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-muted-foreground">
            É um veículo de mídia?{" "}
            <Link to="/veiculo" className="font-medium text-foreground underline-offset-4 hover:underline">
              Enviar documentos
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default OperadorLogin;
