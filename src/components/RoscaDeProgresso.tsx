// A ROSCA DO PROGRESSO — 0% a 100% (R235, U120).
//
// Davi, 08/09/2026: "No canto superior direito da tela, adicione um campo
// contendo um gráfico de rosca que vai de 0% a 100%, este gráfico será o
// progresso da atividade."
//
// O desenho é o da rosca da Meta do mês (Graficos.tsx): dois círculos SVG, o
// de baixo é o trilho, o de cima é o arco (`strokeDasharray` sobre a
// circunferência, girado -90° para começar no topo), com o número no centro.
// A diferença é a cor e a ausência de glow: aqui o arco é VERDE quando fecha
// em 100% e dourado enquanto anda — cor com função (R174: brilho é exceção),
// não decoração.
//
// Não calcula nada: o número vem de `progressoDaAtividade`
// (features/chamados/progresso.ts), que é puro e assertado.

import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import type { ProgressoDaAtividade } from "@/features/chamados/progresso";

export function RoscaDeProgresso({ p, tamanho = 96, estilo }: {
  p: ProgressoDaAtividade;
  tamanho?: number;
  estilo?: CSSProperties;
}) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";

  // a geometria sai do tamanho: o traço é 1/9 do diâmetro, e o raio desconta
  // metade dele para o arco não vazar da caixa
  const traco = Math.max(7, Math.round(tamanho / 9));
  const meio = tamanho / 2;
  const r = meio - traco / 2 - 1;
  const circ = 2 * Math.PI * r;
  const fechou = p.pct >= 100;
  const cor = fechou
    ? (isLight ? PRISMA.verde.light : PRISMA.verde.dark)
    : (isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark);

  return (
    <div
      title={p.frase}
      role="img"
      aria-label={`Progresso da atividade: ${p.pct}%. ${p.frase}.`}
      style={{ display: "flex", alignItems: "center", gap: 10, ...estilo }}
    >
      <div style={{ position: "relative", lineHeight: 0, flexShrink: 0 }}>
        <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
          <circle
            cx={meio} cy={meio} r={r} fill="none" strokeWidth={traco}
            stroke={isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"}
          />
          {p.pct > 0 && (
            <circle
              cx={meio} cy={meio} r={r} fill="none" strokeWidth={traco}
              stroke={cor}
              strokeLinecap="round"
              strokeDasharray={`${(p.pct / 100) * circ} ${circ}`}
              transform={`rotate(-90 ${meio} ${meio})`}
              style={{ transition: "stroke-dasharray .45s ease, stroke .2s ease" }}
            />
          )}
          <text
            x={meio} y={meio} textAnchor="middle" dominantBaseline="central"
            fontFamily={FONT} fontWeight="400" fontSize={Math.round(tamanho / 3.4)}
            fill={textPrimary}
            style={{ letterSpacing: "-0.02em" } as any}
          >
            {p.pct}%
          </text>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: textSecondary,
        }}>
          Progresso
        </span>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, lineHeight: 1.4 }}>
          {p.fonte === "checklist"
            ? `${p.marcados}/${p.total} itens`
            : p.pct === 100 ? "concluída" : "sem checklist"}
        </span>
      </div>
    </div>
  );
}
