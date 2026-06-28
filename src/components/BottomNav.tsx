import { useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Map, Plus, Calendar, User, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function BottomNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: isGerencial } = useQuery({
    queryKey: ["bottomnav-cargo"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("cargo")
        .eq("id", user.id)
        .maybeSingle();
      return data?.cargo === "admin" || data?.cargo === "comercial";
    },
    staleTime: 5 * 60 * 1000,
  });

  const baseItems = [
    { icon: LayoutDashboard, label: "Início", to: "/dashboard" as const },
    { icon: Map, label: "Mapa", to: "/mapa" as const },
    { icon: Plus, label: "Nova", to: "/gerencial/nova" as const },
    { icon: Calendar, label: "Calendário", to: "/calendario" as const },
    { icon: User, label: "Perfil", to: "/perfil" as const },
  ];

  const gerencialItem = { icon: Briefcase, label: "Gerencial", to: "/gerencial" as const };
  const items = isGerencial ? [...baseItems, gerencialItem] : baseItems;

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(8,8,12,0.82)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "10px 0 20px",
      }}
    >
      {items.map(({ icon: Icon, label, to }) => {
        const active =
          pathname === to ||
          (to === "/dashboard" && pathname === "/") ||
          (to === "/gerencial" && (pathname === "/gerencial" || pathname.startsWith("/gerencial/"))) ||
          (to !== "/dashboard" && to !== "/gerencial" && pathname.startsWith(to));
        return (
          <button
            key={to}
            onClick={() => navigate({ to })}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer",
              padding: "4px 8px", borderRadius: 12,
              minWidth: isGerencial ? 44 : 52,
            }}
          >
            <Icon
              size={22}
              color={active ? "#FFC000" : "rgba(255,255,255,0.35)"}
              strokeWidth={active ? 2 : 1.5}
            />
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: active ? 500 : 300,
              fontSize: isGerencial ? 9 : 10,
              letterSpacing: "0.08em",
              color: active ? "#FFC000" : "rgba(255,255,255,0.35)",
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
