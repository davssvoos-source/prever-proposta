// Notificações na sidebar (desktop) — o sino saiu do header (que não existe
// mais no desktop) e mora no menu, como o Davi pediu. Etapa U20.
//
// O painel abre em portal ao LADO da sidebar, não dentro dela: dentro, os
// 232px do rail cortariam a lista. Mesma lição do popover de filtro (P1):
// o <main> é contexto de empilhamento, e só o portal escapa dele.
//
// Realtime de graça: useNotificacoes já assina postgres_changes.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { useNotificacoes, tempoRelativo, type Notificacao } from "@/hooks/useNotificacoes";
import { LARGURA_RAIL } from "@/components/SideNav";

export function NotificacoesSidebar() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botaoRef.current?.focus();
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 60);
    document.addEventListener("keydown", tecla);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  // o amarelo é o principal do sistema — a contagem de não lidas é dele
  const ambar = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  function abrirNotificacao(n: Notificacao) {
    if (!n.lida) marcarLida(n.id);
    setAberto(false);
    if (n.chamado_id) navigate({ to: "/chamados/$id", params: { id: n.chamado_id } });
    else if (n.visita_id) navigate({ to: "/visita/$id", params: { id: n.visita_id } });
  }

  return (
    <>
      <button
        ref={botaoRef}
        className="hover-suave"
        onClick={() => setAberto((a) => !a)}
        aria-label={`Notificações${naoLidas ? ` — ${naoLidas} não lida(s)` : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          minHeight: 44,
          padding: "0 14px",
          borderRadius: 12,
          border: "none",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          background: aberto
            ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)")
            : "transparent",
          color: textSecondary,
          fontFamily: FONT,
          fontWeight: 400,
          fontSize: 13.5,
        }}
      >
        <Bell size={17} style={{ flexShrink: 0 }} />
        Notificações
        {naoLidas > 0 && (
          <span style={{
            marginLeft: "auto",
            minWidth: 20, height: 20, padding: "0 6px",
            borderRadius: 10, background: ambar, color: "#08090E",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
            fontVariantNumeric: "tabular-nums",
          }}>
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && createPortal(
        <div
          ref={painelRef}
          role="dialog"
          aria-label="Notificações recentes"
          className="rolagem-fina"
          style={{
            position: "fixed",
            left: LARGURA_RAIL + 10,
            bottom: 16,
            zIndex: 200,
            width: 340,
            maxHeight: "min(560px, calc(100vh - 32px))",
            overflowY: "auto",
            overscrollBehavior: "contain",
            borderRadius: 16,
            padding: 10,
            background: isLight ? "rgba(255,255,255,0.92)" : "rgba(18,18,25,0.92)",
            backdropFilter: "var(--vidro-blur)" as any,
            WebkitBackdropFilter: "var(--vidro-blur)" as any,
            border: isLight ? "1px solid rgba(255,255,255,0.72)" : "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 16px 44px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", padding: "4px 6px 10px" }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
              letterSpacing: "0.10em", textTransform: "uppercase",
              color: ambar,
            }}>
              Notificações
            </span>
            {naoLidas > 0 && (
              <button
                onClick={() => marcarTodasLidas()}
                style={{
                  marginLeft: "auto", border: "none", background: "transparent",
                  fontFamily: FONT, fontWeight: 600, fontSize: 11, color: textSecondary,
                  cursor: "pointer", minHeight: 32,
                }}
              >
                Marcar todas lidas
              </button>
            )}
          </div>

          {notificacoes.length === 0 ? (
            <div style={{
              padding: "22px 0", textAlign: "center",
              fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary,
            }}>
              Nada por enquanto.
            </div>
          ) : (
            notificacoes.map((n) => (
              <button
                key={n.id}
                className="hover-suave"
                onClick={() => abrirNotificacao(n)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "8px 9px", borderRadius: 10,
                  border: "none", background: "transparent",
                  cursor: "pointer", textAlign: "left", minHeight: 44,
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: 4, flexShrink: 0,
                  background: n.lida
                    ? (isLight ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.20)")
                    : ambar,
                }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block", fontFamily: FONT, fontWeight: n.lida ? 500 : 600,
                    fontSize: 12, color: textPrimary,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {n.titulo}
                  </span>
                  {n.corpo && (
                    <span style={{
                      display: "block", fontFamily: FONT, fontWeight: 400, fontSize: 10.5,
                      color: textSecondary,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {n.corpo}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 9.5, color: textSecondary, flexShrink: 0 }}>
                  {tempoRelativo(n.created_at)}
                </span>
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
