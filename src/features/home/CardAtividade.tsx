// O card de atividade — o mesmo nas duas visões, para que trocar de lista para
// quadro não mude o que se lê, só como se arruma.
//
// Piso de tipografia: 11px. O app trava o zoom (`maximum-scale=1` em
// __root.tsx), então texto pequeno demais não tem conserto do lado do usuário —
// e quem lê isto está no sol, com luva, brilho reduzido pelo calor.

import type { CSSProperties } from "react";
import { Building2, CalendarClock, AlertTriangle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import {
  BOLA_LABEL, ALERTA_LABEL, type Atividade, type Cores,
} from "@/features/atividades/modelo";

export const PISO_TIPO = 11;

export function chipStyle(c: Cores, isLight: boolean): CSSProperties {
  return {
    padding: "3px 9px",
    borderRadius: 999,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: PISO_TIPO,
    letterSpacing: "0.04em",
    color: isLight ? c.light : c.dark,
    background: c.bg,
    border: `1px solid ${c.border}`,
    whiteSpace: "nowrap",
  };
}

interface Props {
  a: Atividade;
  onClick: () => void;
  /** No quadro a coluna já diz o status; repetir o chip é ruído. */
  mostrarStatus?: boolean;
  responsavelNome?: string | null;
}

export function CardAtividade({ a, onClick, mostrarStatus = true, responsavelNome }: Props) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.58)";
  const vermelho = isLight ? "#B1242E" : "#F17881";
  const ambar = isLight ? "#A63E17" : "#E2791D";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderLeft: `3px solid ${isLight ? a.statusCor.light : a.statusCor.dark}`,
    borderRadius: 14,
    padding: "12px 13px",
    boxShadow: isLight ? "0 1px 4px rgba(0,0,0,0.05)" : "none",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    display: "block",
    // alvo confortável mesmo com luva
    minHeight: 76,
  };

  return (
    <button onClick={onClick} style={CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 14, lineHeight: 1.35,
            color: textPrimary, textWrap: "pretty" as any,
          }}>
            {a.titulo}
          </div>
          <div style={{
            fontFamily: FONT, fontWeight: 300, fontSize: PISO_TIPO + 0.5,
            color: textSecondary, marginTop: 3,
          }}>
            {a.numero ? `${a.numero} · ` : ""}
            {a.tipoLabel ?? (a.fonte === "visita" ? "Visita técnica" : "Chamado")}
            {responsavelNome ? ` · ${responsavelNome}` : ""}
          </div>
        </div>
        {mostrarStatus && (
          <span style={{ ...chipStyle(a.statusCor, isLight), flexShrink: 0 }}>
            {a.statusLabel}
          </span>
        )}
      </div>

      {/* O que a coluna apagou: por que este item está aqui, e com quem está a bola */}
      {(a.rotuloNativo || a.bolaCom) && (
        <div style={{
          fontFamily: FONT, fontWeight: 500, fontSize: PISO_TIPO,
          color: textSecondary, marginTop: 7, lineHeight: 1.4,
        }}>
          {a.rotuloNativo}
          {a.rotuloNativo && a.bolaCom ? " · " : ""}
          {a.bolaCom && <span style={{ color: ambar }}>{BOLA_LABEL[a.bolaCom]}</span>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
        {a.cliente && (
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT, fontSize: PISO_TIPO, color: textSecondary,
            minWidth: 0, maxWidth: "100%",
          }}>
            <Building2 size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.cliente}
            </span>
          </span>
        )}

        {a.prioridadeLabel && a.prioridadeCor && (
          <span style={chipStyle(a.prioridadeCor, isLight)}>{a.prioridadeLabel}</span>
        )}

        {a.compra && (
          <span style={{
            ...chipStyle({ dark: "#A78BFA", light: "#6d28d9", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" }, isLight),
          }}>
            {a.compra.situacaoLabel}
          </span>
        )}

        {a.alerta && (
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT, fontWeight: 600, fontSize: PISO_TIPO,
            color: a.alerta === "reagendar" ? vermelho : ambar,
          }}>
            <AlertTriangle size={12} /> {ALERTA_LABEL[a.alerta]}
          </span>
        )}

        {a.prazoTexto && (
          <span style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT, fontWeight: 500, fontSize: PISO_TIPO,
            color: a.prazoEstourado ? vermelho : textSecondary,
          }}>
            <CalendarClock size={12} /> {a.prazoTexto}
          </span>
        )}
      </div>
    </button>
  );
}
