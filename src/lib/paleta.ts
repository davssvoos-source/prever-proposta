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

// ── PRISMA — a paleta do degradê (v6 — 2026-08-20) ─────────────────────────
// O degradê da casa tem composição fixa, definida pelo Davi:
//
//     20% AZUL  ·  40% AMARELO  ·  20% LARANJA  ·  20% VERMELHO
//
// Nessa ordem, do frio ao quente. O amarelo é 40% porque é o principal, e a
// ponta vermelha termina exatamente no vermelho que os botões do sistema já
// usam (#F17881 no escuro, #B1242E no claro) — o degradê PERCORRE a paleta em
// vez de correr por fora dela.
//
// Cada entrada tem par por tema — o tom que canta sobre preto apaga sobre
// branco — mais o véu (`bg`) para fundos e a borda.

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
  /** o amarelo do degradê — 40% dele, e o principal do sistema */
  amarelo:    cor("#E7B925", "#8F6B00", "231,185,37"),
  pessego:    cor("#EE9E09", "#9D5C00", "238,158,9"),
  laranja:    cor("#FA842D", "#AD4700", "250,132,45"),
  /** a ponta quente do degradê É o vermelho dos botões */
  vermelho:   cor("#F17881", "#B1242E", "241,120,129"),
  rosa:       cor("#F1A0B4", "#A83A63", "241,160,180"),
  azulClaro:  cor("#5CB7E5", "#005F87", "92,183,229"),
  /** a ponta fria do degradê */
  azul:       cor("#4885DF", "#084491", "72,133,223"),
  // o `dark` é mais claro que o azul de véu de propósito: ele é TEXTO de chip
  // sobre preto. O véu continua no azul profundo, que é o que pinta o card.
  azulEscuro: cor("#7FA8E8", "#0A3573", "20,70,145"),
  neutro:     cor("#9AA6B2", "#657585", "154,166,178", 0.10, 0.22),
} as const;

/**
 * A RAMPA — o degradê amostrado em 9 passos, que é o que os gráficos usam.
 *
 * Nove e não oito porque cada barra vai da sua cor à da seguinte: a última
 * barra precisa de um passo além do fim. Com oito, o laço de `espectro()`
 * levava a última barra da ponta vermelha de volta ao azul.
 *
 * Derivada de ESPECTRO_STOPS por interpolação em oklch (o script de
 * derivação está no diário; os valores abaixo são o resultado congelado).
 * Três coisas foram conferidas em todas as amostras e estão travadas por
 * asserção:
 *   · nenhuma amostra cai no VERDE — azul→amarelo cruza o verde em matiz, e
 *     a costura precisou ficar estreita (18–23%) e quase acromática;
 *   · nenhuma EMENDA entre barras vizinhas passa pelo cinza;
 *   · todas passam de 4.5:1 sobre a superfície do tema — a rampa serve de
 *     texto sem precisar de uma segunda rampa clareada.
 */
export const ESPECTRO = {
  dark:  ["#4885DF", "#5CB7E5", "#E2DA97", "#EBCE58", "#E7B925", "#EE9E09", "#FA842D", "#F1775C", "#F17881"],
  light: ["#084491", "#005F87", "#766F34", "#887100", "#8F6B00", "#9D5C00", "#AD4700", "#AE371E", "#B1242E"],
} as const;

/**
 * O degradê como paradas CSS, com as porcentagens da composição. É a fonte:
 * a rampa de 9 acima nasce daqui. A costura azul→amarelo (18–23%) é estreita e
 * quase sem croma de propósito — com croma baixo o matiz não aparece, e é isso
 * que impede o verde de surgir no meio do degradê.
 *
 * No escuro a costura é CLARA: cinza é baixo croma em luminosidade média, mas
 * em luminosidade alta o mesmo baixo croma lê como brilho. É de onde vem a
 * "sensação de brilho" que faltava na versão anterior.
 */
export const ESPECTRO_STOPS = {
  dark: ["#4885DF 0%", "#46A7E9 10%", "#9AD2DF 18%", "#D0E5E3 20.5%", "#E0DCA7 23%",
         "#E9D574 29%", "#ECCA45 42%", "#E6B519 52%", "#E9A40A 60%", "#F98D23 70%",
         "#FB7A39 80%", "#ED7665 90%", "#F17881 100%"],
  light: ["#084491 0%", "#00588E 10%", "#276B79 18%", "#576E6C 20.5%", "#726E3C 23%",
          "#80701F 29%", "#8D7200 42%", "#8F6A00 52%", "#986000 60%", "#AA4F00 70%",
          "#B04000 80%", "#AD3527 90%", "#B1242E 100%"],
} as const;

/** Cor n da rampa, com laço. Serve de preenchimento E de texto. */
export function espectro(i: number, isLight: boolean): string {
  const c = isLight ? ESPECTRO.light : ESPECTRO.dark;
  return c[((i % c.length) + c.length) % c.length];
}

/** O degradê inteiro como CSS, com a composição 20/40/20/20 preservada. */
export function degradePrisma(isLight: boolean, angulo = "90deg"): string {
  return `linear-gradient(${angulo}, ${(isLight ? ESPECTRO_STOPS.light : ESPECTRO_STOPS.dark).join(", ")})`;
}

// ── Avatares sem foto ───────────────────────────────────────────────────────
// Quatro degradês, um por família do prisma. A escolha é por HASH do id da
// pessoa, não por sorteio: sorteio de verdade trocaria a cor a cada render, e
// a cor do avatar é como se reconhece alguém de relance numa lista.

export interface DegradeAvatar {
  grad: string;
  glow: string;
  /** cor do texto das iniciais sobre este degradê */
  sobre: string;
}

const AVATARES: DegradeAvatar[] = [
  { grad: "linear-gradient(140deg, #5CB7E5, #4885DF)", glow: "rgba(72,133,223,0.42)",  sobre: "#08111F" },
  { grad: "linear-gradient(140deg, #EBCE58, #E9A40A)", glow: "rgba(233,164,10,0.42)",  sobre: "#1A1300" },
  { grad: "linear-gradient(140deg, #FB7A39, #F98D23)", glow: "rgba(250,132,45,0.42)",  sobre: "#1F0D00" },
  { grad: "linear-gradient(140deg, #F17881, #ED7665)", glow: "rgba(241,120,129,0.42)", sobre: "#1F0708" },
];

/** O degradê de quem não tem foto — estável para a mesma pessoa. */
export function degradeAvatar(chave: string): DegradeAvatar {
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) | 0;
  return AVATARES[Math.abs(h) % AVATARES.length];
}
