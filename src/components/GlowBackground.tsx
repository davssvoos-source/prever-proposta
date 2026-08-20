// Fundo do sistema — "Yellow Glow", importado do claude.design (projeto
// 5e4850a6, arquivo "Yellow Glow Background - Export.dc.html") e traduzido de
// DC para React puro. Etapa U19.
//
// As quatro camadas do arquivo, na ordem:
//   1. palco     — quase-preto quente (oklch, matiz 98 = o amarelo da marca);
//   2. deriva    — duas manchas de luz amarela borradas (blur 80px) que se
//                  movem devagar (34s) — é o glow que os cards de vidro
//                  desfocam por cima;
//   3. grade     — linhas de 40px mascaradas num oval central, o "chão" da
//                  composição;
//   4. granulado — ruído SVG em mix-blend overlay, contra banding.
//
// O tema claro é derivação minha (o arquivo é escuro): mesmo desenho, palco
// branco-quente e manchas mais suaves — sobre claro, o glow satura rápido.

import { useTheme } from "@/contexts/ThemeContext";

const GRANULADO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GlowBackground() {
  const { isLight } = useTheme();

  const palco = isLight ? "oklch(0.97 0.008 98)" : "oklch(0.075 0.013 98)";
  const base = isLight ? "oklch(0.965 0.006 98)" : "oklch(0.065 0.01 98)";
  const deriva = isLight
    ? "radial-gradient(46% 44% at 84% 30%, oklch(0.87 0.12 84) 0%, transparent 62%), radial-gradient(62% 54% at 56% 94%, oklch(0.90 0.09 94) 0%, transparent 66%)"
    : "radial-gradient(46% 44% at 84% 30%, oklch(0.72 0.17 84) 0%, transparent 62%), radial-gradient(62% 54% at 56% 94%, oklch(0.62 0.16 94) 0%, transparent 66%)";
  const linhaGrade = isLight ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.34)";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: base,
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: palco }} />
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          background: deriva,
          filter: "blur(80px)",
          animation: "deriva-glow 34s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            `linear-gradient(90deg, ${linhaGrade} 1px, transparent 1px), ` +
            `linear-gradient(180deg, ${linhaGrade} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(70% 80% at 50% 55%, #000 0%, transparent 92%)",
          WebkitMaskImage: "radial-gradient(70% 80% at 50% 55%, #000 0%, transparent 92%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRANULADO,
          mixBlendMode: "overlay",
          opacity: isLight ? 0.22 : 0.4,
        }}
      />
    </div>
  );
}
