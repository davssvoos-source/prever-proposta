import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Bell, CheckCircle2, CalendarCheck, Settings, Info, Trash2, Clock, XCircle } from "lucide-react";
import { useNotificacoes, tempoRelativo, type Notificacao } from "@/hooks/useNotificacoes";
import { useTheme } from "@/contexts/ThemeContext";


function NotifIcon({ tipo }: { tipo: string }) {
  const s = { size: 18, strokeWidth: 1.8 };
  switch (tipo) {
    case 'visita_aprovada':
    case 'aprovacao':
      return <CheckCircle2 {...s} color="#10B981" />;
    case 'visita_reprovada':
      return <XCircle {...s} color="#EF4444" />;
    case 'lembrete_visita':
      return <Clock {...s} color="#FFC000" />;
    case 'visita':
    case 'visita_atribuida':
      return <CalendarCheck {...s} color="#FFC000" />;
    case 'sistema':
      return <Settings {...s} color="#60A5FA" />;
    case 'info':
    default:
      return <Info {...s} color="rgba(255,255,255,0.5)" />;
  }
}


export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas, deletar } = useNotificacoes();
  const { isLight } = useTheme();

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
          background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)",
          border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: isLight ? "#0a0b0e" : "rgba(255,255,255,0.85)",
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
            width: 352,
            zIndex: 100,
            background: isLight ? "rgba(248,249,251,0.97)" : "rgba(12,12,18,0.92)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            boxShadow: isLight
              ? "0 8px 40px rgba(0,0,0,0.12)"
              : "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px 12px",
              borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.07)",
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
                color: isLight ? "#0a0b0e" : "#fff",
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
                  color: isLight ? "#b87800" : "rgba(255,192,0,0.85)",
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
                <NotifItem
                  key={n.id}
                  n={n}
                  onClick={() => handleClick(n)}
                  onDelete={() => deletar(n.id)}
                  isLight={isLight}
                />
              ))

            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({
  n,
  onClick,
  onDelete,
  isLight,
}: {
  n: Notificacao;
  onClick: () => void;
  onDelete: () => void;
  isLight: boolean;
}) {
  const THRESHOLD_NOT = 110;
  const EXIT_PX = 320;
  const [swipeX, setSwipeX] = useState(0);
  const [deletando, setDeletando] = useState(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    movedRef.current = false;
    startXRef.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = startXRef.current - e.touches[0].clientX;
    if (Math.abs(d) > 4) movedRef.current = true;
    if (d > 0) setSwipeX(Math.min(d, EXIT_PX));
    else setSwipeX(0);
  };
  const onTouchEnd = () => {
    if (swipeX >= THRESHOLD_NOT) {
      setSwipeX(EXIT_PX);
      setDeletando(true);
      setTimeout(() => onDelete(), 280);
    } else {
      setSwipeX(0);
    }
  };

  const handleClick = () => {
    if (movedRef.current) return;
    onClick();
  };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        maxHeight: deletando ? 0 : 200,
        opacity: deletando ? 0 : 1,
        marginBottom: 0,
        transition: deletando
          ? "max-height 0.3s ease, opacity 0.25s ease"
          : "none",
        borderBottom: deletando ? "none" : (isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.05)"),
      }}
    >
      {/* Fundo vermelho de delete */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(239, 68, 68, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 20,
          opacity: Math.min(swipeX / THRESHOLD_NOT, 1),
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <Trash2 size={18} color="#EF4444" />
          <span style={{ color: "#EF4444", fontSize: 10, fontWeight: 700 }}>REMOVER</span>
        </div>
      </div>
      <button
        onClick={handleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 16px",
          background: isLight ? (n.lida ? "#ffffff" : "#fff8e6") : (n.lida ? "rgba(12,12,18,0.98)" : "rgba(35,30,15,0.98)"),
          border: "none",
          cursor: "pointer",
          display: "block",
          transform: `translateX(-${swipeX}px)`,
          transition: swipeX > 0
            ? "none"
            : "transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          willChange: "transform",
          position: "relative",
          zIndex: 1,
          touchAction: "pan-y",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ minWidth: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <NotifIcon tipo={n.tipo} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: n.lida ? 400 : 600,
                fontSize: 13,
                color: isLight
                  ? (n.lida ? "#4a5060" : "#0a0b0e")
                  : (n.lida ? "rgba(255,255,255,0.65)" : "#fff"),
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
                  color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)",
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
                color: isLight ? "#b87800" : "rgba(255,192,0,0.55)",
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
                background: isLight ? "#b87800" : "#FFC000",
                marginTop: 6,
                flexShrink: 0,
                boxShadow: "0 0 6px rgba(255,192,0,0.7)",
              }}
            />
          )}
        </div>
      </button>
    </div>
  );
}

