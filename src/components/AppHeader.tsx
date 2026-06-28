import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div
            className="grid h-9 w-9 place-items-center rounded-md font-bold tracking-tight"
            style={{ backgroundColor: "#FFC000", color: "#1F3864" }}
          >
            PV
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Grupo Prever</div>
            <div className="text-[11px] leading-tight text-muted-foreground">
              Segurança Eletrônica
            </div>
          </div>
        </Link>
        <div className="ml-auto">
          <Button size="icon" variant="ghost" aria-label="Notificações">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
