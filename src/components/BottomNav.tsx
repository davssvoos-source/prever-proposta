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
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "rgba(10, 12, 20, 0.85)",
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
        border: "1px solid rgba(255, 192, 0, 0.18)",
        borderRadius: 40,
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
        minWidth: 220,
      }}
    >
      {ITEMS.map((item) => {
        const active =
          pathname === item.to ||
          (item.to === "/dashboard" && pathname === "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className="group relative flex flex-1 flex-col items-center gap-[3px] rounded-[28px] px-4 py-2 transition-all duration-200"
            style={{
              background: active ? "rgba(255, 192, 0, 0.12)" : "transparent",
            }}
          >
            <Icon
              className="h-[22px] w-[22px] transition-colors"
              strokeWidth={active ? 2.4 : 1.8}
              style={{ color: active ? "#FFC000" : "#4A4F66" }}
            />
            <span
              className="text-[10px] font-medium transition-colors"
              style={{ color: active ? "#FFC000" : "#4A4F66" }}
            >
              {item.label}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute -bottom-1 h-1 w-1 rounded-full"
                style={{
                  background: "#FFC000",
                  boxShadow: "0 0 6px rgba(255,192,0,0.6)",
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
