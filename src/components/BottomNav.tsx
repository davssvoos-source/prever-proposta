import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Calendar, ClipboardList, KanbanSquare, User, Wrench } from "lucide-react";
import { useUserCargo } from "@/features/gerencial/data";
import { useMinhaEquipe } from "@/features/demandas/data";
import { useTheme } from "@/contexts/ThemeContext";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: cargo } = useUserCargo();
  const { data: equipe } = useMinhaEquipe();
  const { isLight } = useTheme();
  const isAdmin = cargo === "admin";
  // Demandas é o quadro interno (Etapa U1): quem tem equipe trabalha nele.
  // Técnico de campo sem equipe continua com a barra enxuta de sempre.
  const veDemandas = isAdmin || (!!equipe && equipe !== "tecnica");

  // "Chamados" (ordens de serviço) é o acesso do técnico ao trabalho de
  // manutenção; o gestor também precisa dele para acompanhar a fila.
  const items = isAdmin
    ? [
        { to: "/dashboard", label: "Início", icon: Home },
        { to: "/calendario", label: "Calendário", icon: Calendar },
        { to: "/os", label: "Chamados", icon: Wrench },
        { to: "/demandas", label: "Demandas", icon: KanbanSquare },
        { to: "/gerencial", label: "Gerencial", icon: ClipboardList },
        { to: "/perfil", label: "Perfil", icon: User },
      ]
    : [
        { to: "/dashboard", label: "Início", icon: Home },
        { to: "/calendario", label: "Calendário", icon: Calendar },
        { to: "/os", label: "Chamados", icon: Wrench },
        ...(veDemandas ? [{ to: "/demandas", label: "Demandas", icon: KanbanSquare }] : []),
        { to: "/perfil", label: "Perfil", icon: User },
      ];

  // com 6 itens a pílula precisa apertar para caber na largura do celular
  const apertado = items.length > 5;

  const inactiveColor = isLight ? "#4a5060" : "#FFFFFF";
  const activeColor = isLight ? "#b87800" : "#FFFFFF";

  return (
    <div
      aria-hidden={false}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <nav
        aria-label="Navegação principal"
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: apertado ? 2 : 8,
          padding: apertado ? "10px 8px" : "10px 14px",
          maxWidth: "calc(100vw - 16px)",
          background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
          backdropFilter: "blur(30px) saturate(180%)",
          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255, 255, 255, 0.22)",
          borderRadius: 40,
          boxShadow: isLight
            ? "0 6px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.03) inset"
            : "0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.04) inset",
          minWidth: 220,
        }}
      >
        {items.map((item) => {
          const active =
            pathname === item.to ||
            (item.to === "/dashboard" && pathname === "/") ||
            (item.to === "/gerencial" && pathname.startsWith("/gerencial")) ||
            (item.to === "/demandas" && pathname.startsWith("/demandas")) ||
            (item.to === "/os" && pathname.startsWith("/os"));
          const Icon = item.icon;
          const color = active ? activeColor : inactiveColor;
          return (
            <Link
              key={item.to}
              to={item.to as any}
              aria-current={active ? "page" : undefined}
              className="group relative flex flex-1 flex-col items-center gap-[3px] rounded-[28px] py-2 transition-all duration-200"
              style={{
                paddingInline: apertado ? 8 : 16,
                background: active
                  ? (isLight ? "rgba(184,120,0,0.10)" : "rgba(255, 255, 255, 0.12)")
                  : "transparent",
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                style={{
                  color,
                  opacity: active ? 1 : isLight ? 0.7 : 0.45,
                  filter: active && !isLight ? "drop-shadow(0 0 8px rgba(255,255,255,0.70)) drop-shadow(0 0 18px rgba(255,255,255,0.30))" : "none",
                  transition: "opacity 200ms, filter 200ms",
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color,
                  opacity: active ? 1 : isLight ? 0.85 : 0.45,
                  textShadow: active && !isLight ? "0 0 8px rgba(255,255,255,0.55)" : "none",
                  transition: "opacity 200ms",
                }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute -bottom-1 h-1 w-1 rounded-full"
                  style={{
                    background: isLight ? "#b87800" : "#FFFFFF",
                    boxShadow: isLight ? "0 0 6px rgba(184,120,0,0.6)" : "0 0 8px rgba(255,255,255,0.7)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
