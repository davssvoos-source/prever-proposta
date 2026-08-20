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

// ── PRISMA — a paleta do degradê (imagem de referência do Davi) ─────────────
// Cores tiradas do degradê fosco laranja→vermelho→rosa→amarelo→azul. Ela é a
// linguagem de cor da Início inteira: status, tipo, prioridade, gráficos e o
// fundo dos cards. Cada entrada tem par por tema — o tom que canta sobre preto
// apaga sobre branco — mais o véu (`bg`) para fundos e a borda.
//
// O AMARELO É O PRINCIPAL. É a cor da marca e continua sendo a de ação; no
// espectro ele ocupa o centro, que é para onde a semana corrente cai.

export interface CorPrisma {
  dark: string;
  light: string;
  bg: string;
  border: string;
}

const cor = (dark: string, light: string, rgb: string, a = 0.14, b = 0.30): CorPrisma => ({
  dark, light,
  bg: `rgba(${rgb},${a})`,
  border: `rgba(${rgb},${b})`,
});

export const PRISMA = {
  /** o amarelo da imagem — o mais próximo do dourado da marca. PRINCIPAL. */
  amarelo:    cor("#F5BE45", "#B5840F", "245,190,69"),
  pessego:    cor("#F5A96B", "#C07A3E", "245,169,107"),
  laranja:    cor("#F0763A", "#C25217", "240,118,58"),
  vermelho:   cor("#E0483F", "#B22F28", "224,72,63"),
  rosa:       cor("#F090A2", "#C25370", "240,144,162"),
  azulClaro:  cor("#7CC2E4", "#3C88AE", "124,194,228"),
  azul:       cor("#3B93C4", "#1D6690", "59,147,196"),
  // o `dark` é mais claro que o azul da imagem de propósito: ele é TEXTO de
  // chip sobre preto, e #1E5F8D some. O véu (`bg`) continua no azul profundo
  // da imagem — é ele que pinta o fundo do card de prazo adiante.
  azulEscuro: cor("#6FA6CE", "#123F63", "30,95,141"),
  neutro:     cor("#9AA6B2", "#657585", "154,166,178", 0.10, 0.22),
} as const;

/**
 * A RAMPA (v5.1 — 2026-08-20). Nove passos, do quente ao frio.
 *
 * Ajustada a pedido do Davi: a MAIOR PARTE é amarelo (seis dos nove passos) e
 * o azul foi bem mais fundo. Os dois tons que ele escolheu entram exatos no
 * tema escuro — `#C9A227` no passo 2 e `#9C7A1E` no passo 5.
 *
 * Nota sobre os valores que ele mandou: o hex e o oklch "aprox." discordavam.
 * `oklch(0.72 0.17 84)` está FORA do sRGB — o navegador cortaria para `#D69900`,
 * mais laranja e mais saturado do que `#C9A227`. Segui o HEX, que é a cor que
 * ele de fato vê. Os oklch reais são L .728 C .138 H 90 e L .597 C .112 H 87.
 *
 * O tema claro repete os MATIZES com a luminosidade rebaixada: sobre branco,
 * os tons originais não passam de 4.5:1, e o número da barra é texto de 13px
 * pintado com a cor da barra.
 *
 * A rampa sobe até o pico no passo 3 e mergulha: o meio do gráfico de demanda
 * é a semana corrente, e é onde ela acende.
 *
 * NOVE, e não oito, por um motivo prático: cada barra vai da sua cor à da
 * seguinte, então a última barra precisa de um passo além do fim. Com oito, o
 * laço de `espectro()` levava a última barra de marinho de volta ao bronze.
 */
export const ESPECTRO = {
  dark:  ["#A37729", "#B98C1E", "#C9A227", "#E1BD46", "#CDA839", "#9C7A1E", "#25537C", "#17325A", "#102145"],
  light: ["#6B4800", "#7C5A00", "#896C05", "#8C7109", "#896C0B", "#755900", "#11446D", "#0E2951", "#091738"],
} as const;

/**
 * A mesma rampa, mas legível como TEXTO. Os azuis do fim são escuros de
 * propósito — como preenchimento de barra funcionam, como número de 13px sobre
 * preto somem (contraste 1.4:1). Aqui os três últimos passos sobem de
 * luminosidade mantendo o matiz; os amarelos são idênticos.
 * No tema claro os azuis escuros já contrastam de sobra: a rampa é a mesma.
 */
export const ESPECTRO_TEXTO = {
  dark:  ["#A37729", "#B98C1E", "#C9A227", "#E1BD46", "#CDA839", "#9C7A1E", "#619ED6", "#6087C2", "#5B78B3"],
  light: ESPECTRO.light,
} as const;

/**
 * A cor de ponte da emenda quente→fria. Interpolar ocre até marinho em sRGB
 * passa OBRIGATORIAMENTE pelo cinza — o ponto médio dava `#61674D`, croma
 * 0.04, um oliva lavado. Este petróleo é o desvio: as duas metades da emenda
 * ficam acima de 0.07 de croma. Quem escolhe a cor da transição sou eu, não a
 * interpolação.
 */
export const PONTE: ParTema = { dark: "#05585F", light: "#00474E" };

/** O índice da emenda: a barra que vai do último amarelo ao primeiro azul. */
export const EMENDA = 5;

/** Cor n da rampa (preenchimento), com laço. */
export function espectro(i: number, isLight: boolean): string {
  const c = isLight ? ESPECTRO.light : ESPECTRO.dark;
  return c[((i % c.length) + c.length) % c.length];
}

/** Cor n da rampa para TEXTO — garantidamente legível sobre a superfície. */
export function espectroTexto(i: number, isLight: boolean): string {
  const c = isLight ? ESPECTRO_TEXTO.light : ESPECTRO_TEXTO.dark;
  return c[((i % c.length) + c.length) % c.length];
}

/** A rampa inteira como CSS, atravessando a ponte. */
export function degradePrisma(isLight: boolean, angulo = "90deg"): string {
  const c = isLight ? ESPECTRO.light : ESPECTRO.dark;
  const ponte = isLight ? PONTE.light : PONTE.dark;
  const paradas = [...c.slice(0, EMENDA + 1), ponte, ...c.slice(EMENDA + 1)];
  return `linear-gradient(${angulo}, ${paradas.join(", ")})`;
}


