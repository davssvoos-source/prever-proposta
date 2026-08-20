// Alternador de tema — adaptação do componente que o Davi mandou (Uiverse, por
// Pradeepsaranbishnoi): o sol que vira lua crescente + a pílula Light/Dark com
// o botão deslizante. O mockup de celular em volta ficou de fora; o que entra
// no app é o mecanismo.
//
// Duas trocas em relação ao original:
// · o degradê rosa-laranja do sol virou o degradê da marca (Supernova) — e a
//   lua usa o azul-violeta do original, que funciona nos dois temas;
// · vira <button role="switch"> de verdade, com foco visível e Enter/Espaço,
//   em vez de checkbox escondido.

import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { SUPERNOVA } from "@/lib/paleta";

const CURVA_LUA = "transform .6s cubic-bezier(0.645, 0.045, 0.355, 1)";
const CURVA_PILULA = "transform .3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

export function ThemeToggle() {
  const { isLight, toggleTheme } = useTheme();

  const trilho: CSSProperties = {
    position: "relative",
    width: 128,
    height: 36,
    borderRadius: 999,
    background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
    border: "none",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };

  const nome = (ativo: boolean): CSSProperties => ({
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: "0.02em",
    color: isLight ? "#0a0b0e" : "#ffffff",
    opacity: ativo ? 1 : 0.45,
    transition: "opacity .3s",
    userSelect: "none",
    pointerEvents: "none",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* o sol que vira lua: o crescente cresce por cima do disco */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: isLight
            ? `linear-gradient(40deg, ${SUPERNOVA[300]}, ${SUPERNOVA[500]} 70%)`
            : "linear-gradient(40deg, #8983F7, #A3DAFB 70%)",
          overflow: "hidden",
          flexShrink: 0,
          transition: "background .4s",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -2,
            top: -2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            // o "recorte" da lua é um disco na cor do fundo ao lado
            background: isLight ? "#ffffff" : "#101014",
            transform: isLight ? "scale(0)" : "scale(1)",
            transformOrigin: "top right",
            transition: CURVA_LUA,
          }}
        />
      </div>

      <button
        role="switch"
        aria-checked={!isLight}
        aria-label={isLight ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
        onClick={toggleTheme}
        style={trilho}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: "calc(50% - 3px)",
            height: "calc(100% - 6px)",
            borderRadius: 999,
            background: isLight ? "#ffffff" : "#34323D",
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
            transform: isLight ? "translateX(0)" : "translateX(100%)",
            transition: CURVA_PILULA,
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "0 6px",
          }}
        >
          <span style={nome(isLight)}>Light</span>
          <span style={nome(!isLight)}>Dark</span>
        </span>
      </button>
    </div>
  );
}
