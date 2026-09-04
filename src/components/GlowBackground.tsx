// Fundo do sistema — v4 minimalista (2026-08-20): degradê puro, sem camadas.
// Escuro: degradê de preto. Claro: degradê de tons de branco. O Yellow Glow
// (manchas, grade, granulado) saiu — no minimalismo apple-like o fundo é
// silêncio, e a profundidade vem da sombra dos cards e do vidro dos painéis.

import { useTheme } from "@/contexts/ThemeContext";

const ESCURO = "linear-gradient(180deg, #131315 0%, #0a0a0b 45%, #030303 100%)";
// v10 (2026-09-04, R154 — Davi: "o fundo deveria ser um branco mais escuro e
// os cards um branco mais claro"): a página desce para o cinza-claro e o card
// (#ffffff, ui.ts) fica sendo o branco mais claro da tela — 1.19:1 entre os
// dois, contra 1.09:1 quando a página começava em #ffffff e o card sumia nela.
const CLARO = "linear-gradient(180deg, #eef0f3 0%, #e9ebef 55%, #e2e5ea 100%)";

export function GlowBackground() {
  const { isLight } = useTheme();
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: isLight ? CLARO : ESCURO,
        transition: "background .4s ease",
      }}
    />
  );
}
