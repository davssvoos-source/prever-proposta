import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCircle2, CalendarCheck, Settings, Info, Trash2 } from "lucide-react";
import { useNotificacoes, tempoRelativo, type Notificacao } from "@/hooks/useNotificacoes";


function NotifIcon({ tipo }: { tipo: string }) {
  const s = { size: 18, strokeWidth: 1.8 };
  switch (tipo) {
    case 'visita_aprovada':
    case 'aprovacao':
      return <CheckCircle2 {...s} color="#10B981" />;
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
            width: 352,
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
                <NotifItem
                  key={n.id}
                  n={n}
                  onClick={() => handleClick(n)}
                  onDelete={() => deletar(n.id)}
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
}: {
  n: Notificacao;
  onClick: () => void;
  onDelete: () => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  const EXECUTE = Math.round((typeof window !== "undefined" ? window.innerWidth : 360) * 0.6);

  const onStart = (clientX: number) => {
    dragging.current = true;
    moved.current = false;
    startX.current = clientX - currentX.current;
  };
  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    const next = Math.min(0, Math.max(-EXECUTE, clientX - startX.current));
    if (Math.abs(next - currentX.current) > 3) moved.current = true;
    currentX.current = next;
    setOffset(next);
  };
  const onEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (currentX.current <= -EXECUTE * 0.6) {
      setOffset(-EXECUTE);
      setTimeout(onDelete, 200);
    } else {
      currentX.current = 0;
      setOffset(0);
    }
  };

  const handleClick = () => {
    if (moved.current) return;
    onClick();
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: "#EF4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 24,
        }}
      >
        <Trash2 size={20} color="white" />
      </div>
      <button
        onClick={handleClick}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 16px",
          background: n.lida ? "rgba(12,12,18,0.92)" : "rgba(35,30,15,0.96)",
          border: "none",
          cursor: "pointer",
          display: "block",
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? "none" : "transform 0.2s ease",
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
    </div>
  );
}

