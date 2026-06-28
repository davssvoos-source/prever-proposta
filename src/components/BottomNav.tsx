import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Home, Map, User } from "lucide-react";
import { useIsGerente } from "@/features/gerencial/data";

const BASE_ITEMS = [
  { to: "/dashboard" as const, label: "Home", icon: Home },
  { to: "/mapa" as const, label: "Mapa", icon: Map },
];
const PROFILE_ITEM = { to: "/perfil" as const, label: "Perfil", icon: User };
const GERENCIAL_ITEM = { to: "/gerencial" as const, label: "Gerencial", icon: ClipboardList };

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: isGerente } = useIsGerente();

  const items = isGerente
    ? [...BASE_ITEMS, GERENCIAL_ITEM, PROFILE_ITEM]
    : [...BASE_ITEMS, PROFILE_ITEM];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "rgba(6, 6, 6, 0.80)",
        backdropFilter: "blur(30px) saturate(180%)",
        border: "1px solid rgba(255, 192, 0, 0.20)",
        borderRadius: 40,
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(255,192,0,0.06), 0 0 0 1px rgba(255,255,255,0.04) inset",
        minWidth: 220,
      }}
    >
      {items.map((item) => {
        const active =
          pathname === item.to ||
          (item.to === "/dashboard" && pathname === "/") ||
          (item.to === "/gerencial" && pathname.startsWith("/gerencial"));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className="group relative flex flex-1 flex-col items-center gap-[3px] rounded-[28px] px-4 py-2 transition-all duration-200"
            style={{ background: active ? "rgba(255, 192, 0, 0.12)" : "transparent" }}
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
                style={{ background: "#FFC000", boxShadow: "0 0 6px rgba(255,192,0,0.6)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
