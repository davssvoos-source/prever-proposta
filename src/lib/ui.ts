// ─── Padrão de design do app (referência: montagem do bloco CFTV) ────────────
//
// Regras:
// - Cards/itens de lista: fundo degradê de preto bem escuro (nunca glassy/translúcido).
//   No tema claro: degradê branco suave com borda e sombra leves.
// - Botões de ação: amarelo degradê + glow externo, texto preto, Montserrat SemiBold.
// - Títulos: Montserrat SemiBold (600).
// - Sem backdrop-filter/blur em cards de conteúdo.

import type React from "react";

export const FONT = "'Montserrat', sans-serif";

/** Degradê de preto bem escuro — fundo padrão de cards no tema escuro. */
export const CARD_BG_DARK = "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)";
/** Fundo padrão de cards no tema claro. */
export const CARD_BG_LIGHT = "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)";

export const CARD_BORDER_DARK = "1px solid rgba(255,215,0,0.16)";
export const CARD_BORDER_LIGHT = "1px solid rgba(0,0,0,0.07)";

export const CARD_SHADOW_DARK = "0 8px 24px rgba(0,0,0,0.45)";
export const CARD_SHADOW_LIGHT = "0 1px 6px rgba(0,0,0,0.07)";

/** Amarelo degradê padrão dos botões. */
export const GOLD_GRAD = "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)";
/** Glow externo dos botões dourados. */
export const GOLD_GLOW = "0 6px 20px rgba(255,192,0,0.35)";

/** Card padrão (tema claro/escuro). */
export const card = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? CARD_BG_LIGHT : CARD_BG_DARK,
  border: isLight ? CARD_BORDER_LIGHT : CARD_BORDER_DARK,
  borderRadius: 16,
  boxShadow: isLight ? CARD_SHADOW_LIGHT : CARD_SHADOW_DARK,
});

/** Botão dourado padrão (igual nos dois temas). */
export const goldButton = (): React.CSSProperties => ({
  background: GOLD_GRAD,
  boxShadow: GOLD_GLOW,
  color: "#0A0A0A",
  border: "none",
  fontFamily: FONT,
  fontWeight: 600,
  cursor: "pointer",
});

/** Título padrão — Montserrat SemiBold. */
export const title = (isLight: boolean): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 600,
  color: isLight ? "#0a0b0e" : "#ffffff",
});
