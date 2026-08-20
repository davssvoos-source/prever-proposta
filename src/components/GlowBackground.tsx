// Fundo do sistema — v4 minimalista (2026-08-20): degradê puro, sem camadas.
// Escuro: degradê de preto. Claro: degradê de tons de branco. O Yellow Glow
// (manchas, grade, granulado) saiu — no minimalismo apple-like o fundo é
// silêncio, e a profundidade vem da sombra dos cards e do vidro dos painéis.

import { useTheme } from "@/contexts/ThemeContext";

const ESCURO = "linear-gradient(180deg, #131315 0%, #0a0a0b 45%, #030303 100%)";
const CLARO = "linear-gradient(180deg, #ffffff 0%, #f6f6f7 55%, #ebebee 100%)";

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
