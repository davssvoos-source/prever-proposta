import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useNotificacoes, tempoRelativo, type Notificacao } from "@/hooks/useNotificacoes";

const ICONS: Record<string, string> = {
  visita_atribuida: "🔔",
  visita_aprovada: "✅",
  visita: "🗓️",
  aprovacao: "✅",
  sistema: "⚙️",
  info: "ℹ️",
};

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (n: Notificacao) => {
    if (!n.lida) marcarLida(n.id);
    setOpen(false);
    if (n.visita_id) {
      navigate({ to: "/visita/$id", params: { id: n.visita_id } });
    }
  };

  const badgeLabel = naoLidas > 9 ? "9+" : String(naoLidas);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Notificações"
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        <Bell size={18} />
        {naoLidas > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              background: "linear-gradient(135deg,#FFD700,#FFC000)",
              color: "#08090E",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px rgba(255,192,0,0.55)",
              animation: "pulseBadge 1.8s ease-in-out infinite",
              border: "1.5px solid #08090E",
            }}
          >
            {badgeLabel}
          </span>
        )}
        <style>{`
          @keyframes pulseBadge {
            0%,100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,192,0,0.55); }
            50%     { transform: scale(1.12); box-shadow: 0 0 16px rgba(255,192,0,0.85); }
          }
        `}</style>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 0,
            width: 320,
            zIndex: 100,
            background: "rgba(12,12,18,0.92)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: "#fff",
              }}
            >
              Notificações
            </span>
            {naoLidas > 0 && (
              <button
                onClick={() => marcarTodasLidas()}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 400,
                  fontSize: 11,
                  color: "rgba(255,192,0,0.85)",
                  letterSpacing: "0.04em",
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notificacoes.length === 0 ? (
              <div
                style={{
                  padding: "36px 16px",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.35)",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 12,
                }}
              >
                <Bell size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div>Sem notificações</div>
              </div>
            ) : (
              notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: n.lida ? "transparent" : "rgba(255,192,0,0.06)",
                    border: "none",
                    cursor: "pointer",
                    display: "block",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, minWidth: 22 }}>
                      {ICONS[n.tipo] ?? "ℹ️"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: n.lida ? 400 : 600,
                          fontSize: 13,
                          color: n.lida ? "rgba(255,255,255,0.65)" : "#fff",
                          lineHeight: 1.4,
                        }}
                      >
                        {n.titulo}
                      </div>
                      {n.corpo && (
                        <div
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 300,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.45)",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {n.corpo}
                        </div>
                      )}
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 300,
                          fontSize: 10,
                          color: "rgba(255,192,0,0.55)",
                          marginTop: 5,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {tempoRelativo(n.created_at)}
                      </div>
                    </div>
                    {!n.lida && (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#FFC000",
                          marginTop: 6,
                          flexShrink: 0,
                          boxShadow: "0 0 6px rgba(255,192,0,0.7)",
                        }}
                      />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
