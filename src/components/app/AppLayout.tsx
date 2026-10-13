import { Suspense, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Building2, ClipboardCheck, ExternalLink, FileStack, LayoutDashboard, Landmark, Receipt, UserCog, FilePlus2, Briefcase,
  Loader2, LogOut, Megaphone, Menu, Radio,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useSubmissions } from "@/hooks/use-submissions";
import { useMedicoes } from "@/hooks/use-medicoes";
import { ROLE_LABEL, useRoles } from "@/hooks/use-roles";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import logoPro3 from "@/assets/logo-pro3.png";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: number;
}

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const navigate = useNavigate();
  const session = useSession();
  const { data: submissions = [] } = useSubmissions();
  const pendentes = submissions.filter((s) => s.status === "recebido").length;
  const { data: medicoes = [] } = useMedicoes();
  const { roles, isAdmin, canFinance } = useRoles();
  const faturamentoPendente = medicoes.filter((m) => (canFinance ? m.status === "aguardando_liberacao" : m.status === "em_medicao")).length;

  const principal: NavItem[] = [
    { to: "/app", label: "Visão geral", icon: LayoutDashboard, end: true },
    { to: "/app/pedidos", label: "Pedidos de inserção", icon: FilePlus2 },
    { to: "/app/documentos", label: "Documentos", icon: FileStack },
    { to: "/app/aprovacoes", label: "Aprovações", icon: ClipboardCheck, badge: pendentes },
    { to: "/app/faturamento", label: "Faturamento", icon: Receipt, badge: faturamentoPendente },
    { to: "/app/gerencial", label: "Visão gerencial", icon: Landmark },
    { to: "/app/analises", label: "Análises", icon: BarChart3 },
  ];
  const cadastros: NavItem[] = [
    { to: "/app/cadastros/clientes", label: "Clientes", icon: Building2 },
    { to: "/app/cadastros/campanhas", label: "Campanhas", icon: Megaphone },
    { to: "/app/cadastros/veiculos", label: "Veículos", icon: Radio },
    { to: "/app/cadastros/agencia", label: "Agência", icon: Briefcase },
    ...(isAdmin ? [{ to: "/app/cadastros/usuarios", label: "Usuários", icon: UserCog }] : []),
  ];

  const email = session?.user.email ?? "";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/operador/login", { replace: true });
  };

  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && (
        <span className="num rounded-sm bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
          {item.badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <img src={logoPro3} alt="Pró3 Comunicação" className="h-9 w-auto" />
        <p className="eyebrow mt-3">Documentos de faturamento</p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Principal">
        <div className="space-y-0.5">{principal.map(renderItem)}</div>
        <div>
          <p className="eyebrow px-3 pb-2">Cadastros</p>
          <div className="space-y-0.5">{cadastros.map(renderItem)}</div>
        </div>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <a
          href="/veiculo"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
          Formulário do veículo
        </a>
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
            {initials(email.split("@")[0].replace(/[._-]/g, " ")) || "·"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{email || "Operador"}</p>
            <p className="text-[11px] text-sidebar-muted">{roles.length ? roles.map((r) => ROLE_LABEL[r]).join(", ") : "Sem papel atribuído"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const session = useSession();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLoading: carregandoPapeis, hasAnyRole } = useRoles();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (session === null) {
    return <Navigate to={`/operador/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!carregandoPapeis && !hasAnyRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <img src={logoPro3} alt="Pró3 Comunicação" className="mb-8 h-10 w-auto" />
        <h1 className="text-3xl">Acesso ainda não liberado</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          Sua conta existe, mas nenhum administrador atribuiu um papel a ela. Peça a liberação à equipe da Pró3.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 hover:bg-accent"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src={logoPro3} alt="Pró3" className="h-6 w-auto" />
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="mx-auto w-full max-w-[72rem] flex-1 px-4 py-8 sm:px-8 lg:py-10">
          <Suspense fallback={<Loader2 className="mx-auto mt-24 h-6 w-6 animate-spin text-muted-foreground" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
