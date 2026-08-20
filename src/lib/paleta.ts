// Paleta oficial do Grupo Prever — v2 (2026-08-20).
// Fonte: tokens W3C Design Tokens fornecidos pelo Davi. Quatro escalas com o
// papel de cada uma no nome, do jeito que vieram batizadas:
//
//   Supernova        → primária (o dourado da marca)
//   Shamrock         → sucesso
//   Christine        → aviso
//   Flush Mahogany   → erro
//
// REGRA DE USO POR TEMA (a mesma para as quatro escalas):
//   tema escuro  → tom 300–400 (claro o bastante para fundo preto)
//   tema claro   → tom 600–700 (escuro o bastante para fundo branco; 400 em
//                  fundo claro é o anti-padrão nº 3 do DESIGN_SYSTEM)
//
// Azuis e violetas (agendado, em andamento, pedido de compra) NÃO estão nas
// escalas fornecidas — são matizes informativos fora da identidade e seguem
// como estavam, registrados no DESIGN_SYSTEM §2.

export type Tom = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export type Escala = Record<Tom, string>;

export const SUPERNOVA: Escala = {
  50: "#FEFCE8", 100: "#FEF9C3", 200: "#FDEE8B", 300: "#FCDE48",
  400: "#F8C811", 500: "#E8B00A", 600: "#C88806", 700: "#A06108",
  800: "#844C0F", 900: "#703E13", 950: "#422006",
};

export const SHAMROCK: Escala = {
  50: "#ECFDF7", 100: "#D1FAE9", 200: "#A7F3D7", 300: "#6EE7C2",
  400: "#2DD2A5", 500: "#10B991", 600: "#059676", 700: "#047862",
  800: "#065F4E", 900: "#064E42", 950: "#022C26",
};

export const CHRISTINE: Escala = {
  50: "#FDF7ED", 100: "#FAE9CB", 200: "#F4D193", 300: "#EEB45B",
  400: "#EA9A35", 500: "#E2791D", 600: "#C85917", 700: "#A63E17",
  800: "#873119", 900: "#702917", 950: "#401208",
};

export const MAHOGANY: Escala = {
  50: "#FDF3F4", 100: "#FDE3E5", 200: "#FBCDD0", 300: "#F7AAB0",
  400: "#F17881", 500: "#E64D58", 600: "#D22D39", 700: "#B1242E",
  800: "#92222A", 900: "#7A2228", 950: "#420D11",
};

/** Par de cor por tema: `dark` para fundo escuro, `light` para fundo claro. */
export interface ParTema {
  dark: string;
  light: string;
}

export const PRIMARIA: ParTema = { dark: SUPERNOVA[400], light: SUPERNOVA[700] };
export const SUCESSO: ParTema = { dark: SHAMROCK[400], light: SHAMROCK[700] };
export const AVISO: ParTema = { dark: CHRISTINE[500], light: CHRISTINE[700] };
export const ERRO: ParTema = { dark: MAHOGANY[400], light: MAHOGANY[700] };

/** O degradê da marca — botões de ação, pílula ativa do menu, destaques. */
export const GRAD_PRIMARIA = `linear-gradient(135deg, ${SUPERNOVA[300]}, ${SUPERNOVA[400]}, ${SUPERNOVA[500]})`;

/** Texto sobre o degradê primário: sempre o quase-preto da marca. */
export const SOBRE_PRIMARIA = "#08090E";

// ── Dataviz ─────────────────────────────────────────────────────────────────
// As três cartelas que o Davi escolheu para gráficos e indicadores
// (2026-08-20). São para DADOS, não para ação nem status — ação é Supernova,
// status são as quatro escalas acima. A regra de tema é a mesma do resto:
// tom claro da cartela no escuro, tom fundo no claro.
//
// Reserva ainda sem uso: #F4D35E, #124D1C, #0B1849, #E8E2DB, #EBEDE3.

export const DATAVIZ = {
  /** série neutra/fria — o "sem pressão" dos gráficos */
  frio:   { dark: "#547792", light: "#1A3263" },
  /** atenção — prazo chegando, meta em curso */
  ambar:  { dark: "#FAB95B", light: "#E4B028" },
  /** alarme — atrasado, urgente */
  alerta: { dark: "#E63946", light: "#8B1E2D" },
  /** apoio azul — contagens calmas (concluídos etc.) */
  azul:   { dark: "#457B9D", light: "#457B9D" },
  /** vinho — segundo alarme, quando o vermelho já está em uso ao lado */
  vinho:  { dark: "#8B1E2D", light: "#8B1E2D" },
} as const;

// ── Espectro de gráfico ─────────────────────────────────────────────────────
// Derivado das cores que o Davi escolheu (#411139 #d8ad1a #01847f #AA1C41
// #760031 #403D88 #7F2020). As MATIZES dele foram mantidas; a luminosidade e o
// croma foram normalizados, porque as originais iam de L*0.28 a L*0.77 — quase
// três vezes de diferença, o que faz barra sumir e barra gritar no mesmo
// gráfico. Todas as oito têm agora a mesma L e o mesmo croma em oklch, com as
// matizes espaçadas do frio ao quente.
//
// A ordem é a do espectro: teal → azul → índigo → violeta → magenta → rosa →
// vermelho → ouro. Como a rampa é perceptualmente contínua, barras vizinhas
// se emendam e a série inteira lê como um degradê só.
export const ESPECTRO = {
  dark: ["#00C6C7", "#20B9F6", "#84A6FF", "#B994F8", "#DB88D9", "#EF82B4", "#F98281", "#DC9E24"],
  light: ["#008284", "#0074B1", "#4360C1", "#784FB3", "#964295", "#A73A72", "#B1393E", "#985900"],
} as const;

/** Cor n do espectro, com laço — para séries de tamanho qualquer. */
export function espectro(i: number, isLight: boolean): string {
  const c = isLight ? ESPECTRO.light : ESPECTRO.dark;
  return c[((i % c.length) + c.length) % c.length];
}
