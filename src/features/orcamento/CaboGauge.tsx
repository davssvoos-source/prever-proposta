// Gauge semicircular de cabeamento (0–100 m) — padrão visual do app.
// Usado no CFTV (metros por câmera) e no Alarme (metros por zona).
// Arraste a bola amarela na trilha ou toque no número central para digitar
// qualquer valor (inclusive acima de 100 m).

import { useRef, useState } from "react";

const L = { text: "#0a0b0e", textSub: "#4a5060", gold: "#b87800" };

export function CaboGauge({
  value,
  onChange,
  isLight,
}: {
  value: number;
  onChange: (n: number) => void;
  isLight: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [editando, setEditando] = useState(false);

  const VB_W = 260, VB_H = 152, CX = 130, CY = 134, R = 106;
  const clamped = Math.max(0, Math.min(100, value));
  const frac = clamped / 100;
  const arcLen = Math.PI * R;
  const ang = Math.PI * (1 - frac); // rad: π (esq, 0m) → 0 (dir, 100m)
  const knobX = CX + R * Math.cos(ang);
  const knobY = CY - R * Math.sin(ang);

  function valueFromPointer(e: { clientX: number; clientY: number }): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    const y = ((e.clientY - rect.top) / rect.height) * VB_H;
    const dx = x - CX;
    const dy = CY - y;
    let a = dy < 0 ? (dx >= 0 ? 0 : Math.PI) : Math.atan2(dy, dx);
    a = Math.max(0, Math.min(Math.PI, a));
    return Math.round(((Math.PI - a) / Math.PI) * 100);
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 320, margin: "0 auto" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: "100%", display: "block", touchAction: "none", overflow: "visible" }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          const v = valueFromPointer(e);
          if (v !== null) onChange(v);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          const v = valueFromPointer(e);
          if (v !== null) onChange(v);
        }}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
      >
        <defs>
          <linearGradient id="caboGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="55%" stopColor="#FFC000" />
            <stop offset="100%" stopColor="#FF9F00" />
          </linearGradient>
        </defs>
        {/* Trilha */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={isLight ? "rgba(0,0,0,0.12)" : "#FFFFFF"}
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Progresso */}
        {frac > 0 && (
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="url(#caboGaugeGrad)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${frac * arcLen} ${arcLen}`}
          />
        )}
        {/* Bola amarela */}
        <circle
          cx={knobX}
          cy={knobY}
          r={14}
          fill="#FFC000"
          stroke={isLight ? "#ffffff" : "rgba(0,0,0,0.35)"}
          strokeWidth={3}
          style={{ filter: "drop-shadow(0 0 8px rgba(255,192,0,0.7))", cursor: "grab" }}
        />
      </svg>
      {/* Número central (editável ao toque) */}
      <div
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        }}
      >
        {editando ? (
          <input
            autoFocus
            type="number"
            min={0}
            value={value}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
            onBlur={() => setEditando(false)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditando(false); }}
            style={{
              width: 120, textAlign: "center", fontSize: 40, fontWeight: 800,
              fontFamily: "'Montserrat', sans-serif",
              background: "transparent", border: "none", outline: "none",
              color: isLight ? L.text : "#fff",
              borderBottom: `2px solid ${isLight ? L.gold : "#FFC000"}`,
            }}
          />
        ) : (
          <div
            onClick={() => setEditando(true)}
            style={{
              fontSize: 44, fontWeight: 800, lineHeight: 1, cursor: "pointer",
              color: isLight ? L.text : "#fff", fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {value}
            <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 4, color: isLight ? L.textSub : "rgba(255,255,255,0.6)" }}>m</span>
          </div>
        )}
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: isLight ? L.textSub : "rgba(255,255,255,0.45)" }}>
          Cabeamento
        </div>
      </div>
      {/* Extremos */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>
        <span>0 m</span>
        <span>100 m</span>
      </div>
    </div>
  );
}
