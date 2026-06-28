import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, FileText, Settings, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useUserRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function AppHeader() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const roles = useUserRoles(user?.id);
  const isAdmin = roles.includes("admin");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="brand-gradient grid h-9 w-9 place-items-center rounded-md text-primary-foreground">
            <span className="text-sm font-bold tracking-tight">PV</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold leading-tight">Grupo Prever</div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              Orçamentos
            </div>
          </div>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          <NavBtn to="/dashboard" active={pathname === "/dashboard" || pathname === "/"}>
            <FileText className="h-4 w-4" /> Propostas
          </NavBtn>
          {isAdmin && (
            <NavBtn to="/admin" active={pathname.startsWith("/admin")}>
              <Settings className="h-4 w-4" /> Catálogo
            </NavBtn>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="default" className="hidden sm:inline-flex">
            <Link to="/novo">
              <Plus className="h-4 w-4" />
              Nova proposta
            </Link>
          </Button>
          <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavBtn({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
