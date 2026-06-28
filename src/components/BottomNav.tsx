import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Map, User } from "lucide-react";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background">
      <ul className="mx-auto flex h-16 max-w-5xl items-stretch justify-around">
        {ITEMS.map((item) => {
          const active =
            pathname === item.to ||
            (item.to === "/dashboard" && pathname === "/");
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
                <span>{item.label}</span>
                {active && (
                  <span
                    className="absolute -bottom-px h-1 w-8 rounded-t-full"
                    style={{ backgroundColor: "#FFC000" }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
