// ─── Padrão de design do app (referência: montagem do bloco CFTV) ────────────
//
// Regras (v3 — vidro, 2026-08-20):
// - Cards/itens de lista: VIDRO sobre o fundo Yellow Glow — superfície
//   translúcida com desfoque (a regra antiga proibia blur; o Davi a inverteu
//   junto com o fundo novo, referências Versa UI). No celular o desfoque sai
//   (--vidro-blur: none) e fica a superfície semiopaca: blur é caro na GPU.
// - Botões de ação: amarelo degradê + glow externo, texto preto, Montserrat SemiBold.
// - Títulos: Montserrat SemiBold (600).
// - Sem backdrop-filter/blur em cards de conteúdo.

import type React from "react";

export const FONT = "var(--fonte)";

/** Degradê de preto bem escuro — fundo padrão de cards no tema escuro. */
export const CARD_BG_DARK = "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)";
/** Fundo padrão de cards no tema claro. */
export const CARD_BG_LIGHT = "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)";

export const CARD_BORDER_DARK = "1px solid rgba(252,222,72,0.16)";
export const CARD_BORDER_LIGHT = "1px solid rgba(0,0,0,0.07)";

export const CARD_SHADOW_DARK = "0 8px 24px rgba(0,0,0,0.45)";
export const CARD_SHADOW_LIGHT = "0 1px 6px rgba(0,0,0,0.07)";

/** Amarelo degradê padrão dos botões. */
export const GOLD_GRAD = "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)";
/** Glow externo dos botões dourados. */
export const GOLD_GLOW = "0 6px 20px rgba(248,200,17,0.35)";

/** Vidro — reservado aos PAINÉIS (gráficos, sidebar, popovers). v4. */
export const VIDRO_BG_DARK = "rgba(255,255,255,0.05)";
export const VIDRO_BG_LIGHT = "rgba(255,255,255,0.55)";
export const VIDRO_BORDER_DARK = "1px solid rgba(255,255,255,0.09)";
export const VIDRO_BORDER_LIGHT = "1px solid rgba(255,255,255,0.72)";

/**
 * Card padrão v4 — NEO-MINIMALISTA: superfície sólida, canto bem redondo e
 * uma sombra leve em relação ao fundo. O vidro saiu do conteúdo e ficou nos
 * painéis (vidro() abaixo): sobre um degradê quase liso, vidro em tudo vira
 * ruído; em pontos escolhidos vira hierarquia de material.
 */
export const card = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? "#ffffff" : "#141416",
  border: isLight ? "1px solid rgba(0,0,0,0.05)" : "1px solid rgba(255,255,255,0.06)",
  borderRadius: 18,
  boxShadow: isLight
    ? "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.07)"
    : "0 1px 2px rgba(0,0,0,0.50), 0 10px 30px rgba(0,0,0,0.30)",
});

/** Painel de vidro — gráficos, sidebar, popovers. */
export const vidro = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? VIDRO_BG_LIGHT : VIDRO_BG_DARK,
  border: isLight ? VIDRO_BORDER_LIGHT : VIDRO_BORDER_DARK,
  borderRadius: 18,
  boxShadow: isLight ? "0 8px 28px rgba(0,0,0,0.06)" : "0 8px 28px rgba(0,0,0,0.30)",
  backdropFilter: "var(--vidro-blur)" as any,
  WebkitBackdropFilter: "var(--vidro-blur)" as any,
});

/** Botão dourado padrão (igual nos dois temas). */
export const goldButton = (): React.CSSProperties => ({
  background: GOLD_GRAD,
  boxShadow: GOLD_GLOW,
  color: "#08090E", // = SOBRE_PRIMARIA (paleta.ts) — texto sobre o degradê dourado
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
