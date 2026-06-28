import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="header-glass">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div
            className="grid h-9 w-9 place-items-center rounded-full font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #FFC000 0%, #B88A00 100%)",
              color: "#08090E",
              boxShadow: "0 4px 14px rgba(255,192,0,0.35)",
            }}
          >
            PV
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-foreground">
              Grupo Prever
            </div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              Segurança Eletrônica
            </div>
          </div>
        </Link>
        <div className="ml-auto">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Notificações"
            className="rounded-full hover:bg-[rgba(255,192,0,0.08)]"
          >
            <Bell className="h-5 w-5" style={{ color: "#FFC000" }} />
          </Button>
        </div>
      </div>
    </header>
  );
}
