// Fundo do sistema — degradê com glow, um por tema (2026-08-20).
//
// Substitui os três fundos anteriores das telas autenticadas (canvas animado
// na Início, datacenter estático nas demais, claro próprio): agora é um só,
// estático, com o brilho da marca.
//
//   escuro → degradê de preto, com um glow dourado alto à esquerda e um verde
//            discreto no canto oposto;
//   claro  → degradê de branco, mesmos glows um pouco mais presentes, porque
//            sobre branco o brilho some mais rápido.
//
// Estático de propósito: os fundos animados custavam bateria no celular do
// técnico, e o glow fixo dá a profundidade que o canvas dava sem custo.

import { useTheme } from "@/contexts/ThemeContext";

const ESCURO = [
  "radial-gradient(1100px 560px at 15% -10%, rgba(248,200,17,0.09), transparent 55%)",
  "radial-gradient(900px 640px at 88% 112%, rgba(45,210,165,0.06), transparent 60%)",
  "linear-gradient(180deg, #141414 0%, #0a0a0a 45%, #000000 100%)",
].join(", ");

const CLARO = [
  "radial-gradient(1100px 560px at 15% -10%, rgba(248,200,17,0.16), transparent 55%)",
  "radial-gradient(900px 640px at 88% 112%, rgba(45,210,165,0.09), transparent 60%)",
  "linear-gradient(180deg, #ffffff 0%, #f8f8f6 55%, #eeeeeb 100%)",
].join(", ");

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
