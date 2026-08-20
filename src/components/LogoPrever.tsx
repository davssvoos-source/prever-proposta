// Logotipo do Grupo Prever — recriação vetorial da versão nova (2026-08-20):
// escudo de topo ondulado com "GRUPO" dentro e "PREVER" atravessando mais
// largo que o escudo, tudo num dourado só.
//
// É uma RECRIAÇÃO fiel em SVG, não o arquivo original — o original chegou como
// imagem. Se o vetor oficial existir, basta trocar o conteúdo deste componente
// que todos os usos acompanham. A cor padrão é a Supernova 400 da paleta; o
// tema claro deve passar um tom mais escuro (600/700) para manter contraste.

import { SUPERNOVA } from "@/lib/paleta";

interface Props {
  /** Altura em px; a largura acompanha a proporção. */
  altura?: number;
  cor?: string;
}

export function LogoPrever({ altura = 56, cor = SUPERNOVA[400] }: Props) {
  return (
    <svg
      height={altura}
      viewBox="0 0 1000 620"
      fill="none"
      role="img"
      aria-label="Grupo Prever"
      style={{ display: "block" }}
    >
      {/* Escudo — topo em quatro ondas, laterais retas, bico embaixo */}
      <path
        d="M 300 78
           Q 325 118 350 78 Q 375 118 400 78 Q 425 118 450 78
           Q 475 118 500 78 Q 525 118 550 78 Q 575 118 600 78
           Q 625 118 650 78 Q 675 118 700 78
           L 700 340
           Q 700 470 500 590
           Q 300 470 300 340
           Z"
        stroke={cor}
        strokeWidth="22"
        strokeLinejoin="round"
      />
      <text
        x="500"
        y="215"
        textAnchor="middle"
        fill={cor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="86"
        letterSpacing="14"
      >
        GRUPO
      </text>
      <text
        x="500"
        y="420"
        textAnchor="middle"
        fill={cor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="190"
        letterSpacing="10"
        textLength="960"
        lengthAdjust="spacingAndGlyphs"
      >
        PREVER
      </text>
    </svg>
  );
}
