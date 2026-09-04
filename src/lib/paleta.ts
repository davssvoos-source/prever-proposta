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
  // É o amarelo do botão (SUPERNOVA 400 / GRAD_PRIMARIA) e o coração do
  // degradê, em 42%. `light` continua fundo porque ele é TEXTO sobre branco:
  // #F8C811 sobre branco dá 1.58:1.
  amarelo:    cor("#F8C811", "#A06108", "248,200,17"),
  pessego:    cor("#EE9E09", "#9D5C00", "238,158,9"),
  laranja:    cor("#FA842D", "#AD4700", "250,132,45"),
  /** a ponta quente do degradê É o vermelho dos botões */
  vermelho:   cor("#F17881", "#B1242E", "241,120,129"),
  rosa:       cor("#F1A0B4", "#A83A63", "241,160,180"),
  azulClaro:  cor("#5CB7E5", "#005F87", "92,183,229"),
  /** a ponta fria do degradê */
  /** a ponta fria do degradê — igual a ESPECTRO[0], por asserção */
  azul:       cor("#4F94E9", "#236FC7", "79,148,233"),
  // o `dark` é mais claro que o azul de véu de propósito: ele é TEXTO de chip
  // sobre preto. O véu continua no azul profundo, que é o que pinta o card.
  azulEscuro: cor("#7FA8E8", "#0A3573", "20,70,145"),
  /**
   * O verde de "concluído/ativo" — não é uma amostra da rampa (o degradê
   * principal é azul→amarelo→laranja→vermelho, sem parada verde de
   * propósito: a costura entre azul e amarelo já é o trecho mais delicado
   * dele, e ESPECTRO trava por asserção que nenhuma amostra cai no verde).
   * Este É, ainda assim, o tom oficial da casa para "terminado com sucesso":
   * o mesmo #2DD2A5/#047862 que cobrança, compra, contratos, inventário e o
   * checklist de campo já usavam, cada um declarando o par à mão. Formalizado
   * aqui para não seguir reescrito igual dezessete vezes.
   */
  verde:      cor("#2DD2A5", "#047862", "45,210,165"),
  // R79: o `light` escureceu de #657585 para #5a6172. O neutro quase nunca
  // aparece sobre branco puro — ele é TEXTO DE CHIP sobre o próprio véu
  // (`bg`, 10%), e ali #657585 dava 4.37:1, abaixo do mínimo de texto. Com
  // #5a6172 sobe para 5.7:1, e o valor é o mesmo do `--muted-foreground` do
  // tema claro, então chip e texto neutro do sistema falam o mesmo cinza.
  // Conserta de uma vez os cinco que usam este par: cliente inativo,
  // proposta em rascunho, chamado cancelado, tipo operacional e prioridade
  // baixa. Como preenchimento de barra ("sem técnico"/"sem cliente") o tom
  // mais escuro também passa, com folga.
  neutro:     cor("#9AA6B2", "#5a6172", "154,166,178", 0.10, 0.22),
} as const;

/**
 * Mistura `hex` com `alvo` (branco ou preto) por um peso 0–1. Existe só para
 * o degradê da borda dos cards de atividade (R136) — clarear ou escurecer UMA
 * cor, sem precisar de uma rampa tonal inteira para cada uma (o azul da
 * PRISMA não tem uma — ver a nota "fora da identidade", acima).
 */
export function misturar(hex: string, alvo: string, peso: number): string {
  const canais = (h: string): [number, number, number] => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = canais(hex);
  const [r2, g2, b2] = canais(alvo);
  const m = (a: number, b: number) => Math.round(a + (b - a) * peso).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/**
 * Borda em degradê claro→escuro da MESMA cor estratégica (R136, Davi: "as
 * bordas deverão ser da cor mais clara para a mais escura em degradê"). Três
 * paradas — clara, a cor pura, escura —, no mesmo ângulo do degradê da marca
 * (135deg, `GRAD_PRIMARIA`).
 */
export function degradeDeBorda(hex: string): string {
  return `linear-gradient(135deg, ${misturar(hex, '#ffffff', 0.5)}, ${hex}, ${misturar(hex, '#000000', 0.32)})`;
}

/**
 * Esmaece um `rgba(r,g,b,a)` multiplicando o alfa por `fator` (0–1) — mesma
 * cor, mais fraca. Existe para o glow do contorno dos cards de atividade
 * (R136, revisto por pedido do Davi, 2026-09-04: "diminua mais o glow […]
 * pode diminuir bastante"): o `.bg` do PRISMA (14%) já pintava um véu grande
 * demais para "levíssimo" — em vez de inventar um alfa novo solto na tela,
 * esta função deriva um mais fraco do mesmo token, then a decisão de força é
 * um número só (`FATOR_GLOW`, em CardAtividade.tsx), não um hex novo por cor.
 */
export function esmaecer(rgba: string, fator: number): string {
  const m = rgba.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (!m) return rgba;
  const alfa = (parseFloat(m[4]) * fator).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return `rgba(${m[1]},${m[2]},${m[3]},${alfa})`;
}

/**
 * A RAMPA — o degradê amostrado em 9 passos, que é o que os gráficos usam.
 *
 * v7 (2026-08-20): a faixa de 40% é ANCORADA nos amarelos do botão da marca —
 * `#FCDE48`, `#F8C811`, `#E8B00A` (SUPERNOVA 300/400/500), os mesmos do
 * GRAD_PRIMARIA. Era a última divergência de cor do sistema: o degradê tinha
 * um amarelo e o botão tinha outro. Agora é um só.
 *
 * O tema claro subiu MUITO (L .40–.56 → .54–.72): estava escuro a ponto de o
 * degradê virar barro sobre branco. Ele usa os mesmos matizes com a
 * luminosidade rebaixada — o padrão da paleta.
 *
 * Nove e não oito porque cada barra vai da sua cor à da seguinte: a última
 * precisa de um passo além do fim.
 *
 * Três invariantes travados por asserção, um por tema:
 *   · nenhuma amostra cai no VERDE — azul→amarelo cruza o verde em matiz, e a
 *     costura precisou ficar estreita (18–23%) e quase acromática;
 *   · nenhuma EMENDA entre barras vizinhas passa pelo cinza;
 *   · a rampa de TEXTO passa de 4.5:1 sobre a superfície do tema.
 */
export const ESPECTRO = {
  dark:  ["#4F94E9", "#6CC2ED", "#F6E057", "#FAD029", "#EBB509", "#F49E00", "#FF872E", "#F87A5E", "#F17881"],
  // miolo amarelo rebaixado a ≥3:1 sobre branco (mínimo WCAG de não-texto):
  // no primeiro corte da v7 ele estava em 2.45:1 e as barras sumiam no card.
  light: ["#236FC7", "#2E97C5", "#A99300", "#B78E00", "#BF8A00", "#CC7900", "#D96200", "#D65539", "#CF515E"],
} as const;

/**
 * A rampa que serve de TEXTO. O rótulo da barra é 13px pintado com a cor da
 * barra, e no tema claro a rampa v7 ficou clara demais para isso (2.5:1 no
 * miolo amarelo). Aqui os mesmos matizes descem até passar de 4.5:1 sobre
 * branco.
 *
 * No escuro a rampa já é clara e passa de sobra: as duas são a mesma. É o
 * espelho exato do problema da v5.1, onde quem precisava de socorro era o
 * escuro — a assimetria é do fundo, não da paleta.
 */
export const ESPECTRO_TEXTO = {
  dark: ESPECTRO.dark,
  light: ["#236FC7", "#0078B6", "#867000", "#906B00", "#986600", "#A75A00", "#B54C00", "#BB4329", "#BB3E4D"],
} as const;

/**
 * O degradê como paradas CSS, com as porcentagens da composição
 * (20% azul · 40% amarelo · 20% laranja · 20% vermelho). É a fonte: a rampa de
 * 9 acima nasce daqui.
 *
 * Os três amarelos da marca estão aqui LITERAIS, em 29/42/52% — não são
 * aproximações reconstruídas em oklch. O coração do degradê é `#F8C811`, em
 * 42%, que é o centro exato da faixa amarela.
 *
 * A costura azul→amarelo (18–23%) é estreita e quase sem croma de propósito:
 * com croma baixo o matiz não aparece, e é isso que impede o verde de surgir.
 * No escuro ela é CLARA — cinza é baixo croma em luminosidade média, mas em
 * luminosidade alta o mesmo baixo croma lê como brilho.
 */
export const ESPECTRO_STOPS = {
  dark: ["#4F94E9 0%", "#57B5F1 10%", "#A7D9E5 18%", "#D7EBE9 20.5%", "#F4E15E 23%",
         "#FCDE48 29%", "#F8C811 42%", "#E8B00A 52%", "#F0A300 60%", "#FE8F20 70%",
         "#FF7E3B 80%", "#F47967 90%", "#F17881 100%"],
  light: ["#236FC7 0%", "#138CCB 10%", "#69AAB9 18%", "#98B3B0 20.5%", "#A79400 23%",
          "#AE9100 29%", "#BB8C00 42%", "#C08900 52%", "#C87D00 60%", "#D76A00 70%",
          "#DB5A00 80%", "#D45443 90%", "#CF515E 100%"],
} as const;

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

/** O degradê inteiro como CSS, com a composição 20/40/20/20 preservada. */
export function degradePrisma(isLight: boolean, angulo = "90deg"): string {
  return `linear-gradient(${angulo}, ${(isLight ? ESPECTRO_STOPS.light : ESPECTRO_STOPS.dark).join(", ")})`;
}

/**
 * A costura da rampa como COR: a parada quase acromática de 20.5%. As 9
 * amostras de ESPECTRO pulam essa parada — e interpolar as duas amostras
 * vizinhas da emenda (azul claro ↔ amarelo claro) em sRGB passa pelo VERDE.
 * Quem desenha um gradiente entre amostras vizinhas precisa passar por aqui.
 */
export const COSTURA: ParTema = { dark: "#D7EBE9", light: "#98B3B0" };

/** Par de amostras que ladeia a costura (nos dois sentidos). */
const PAR_EMENDA: Record<"dark" | "light", [string, string]> = {
  dark: [ESPECTRO.dark[1], ESPECTRO.dark[2]],
  light: [ESPECTRO.light[1], ESPECTRO.light[2]],
};

/**
 * O gradiente de uma barra que vai da cor A à cor B. Se o par cruza a emenda
 * da rampa, a costura entra como parada do meio — senão o miolo da barra fica
 * verde (achado da auditoria v7, travado por asserção).
 */
export function gradienteBarra(a: string, b: string, isLight: boolean): string {
  const tema = isLight ? "light" : "dark";
  const [x, y] = PAR_EMENDA[tema];
  const cruza = (a === x && b === y) || (a === y && b === x);
  return cruza
    ? `linear-gradient(90deg, ${a}, ${COSTURA[tema]} 50%, ${b})`
    : `linear-gradient(90deg, ${a}, ${b})`;
}

/** Quantas peças a rampa pinta: 9 amostras servem 8 peças (i → i+1). */
export const PECAS_ESPECTRO = 8;

/**
 * As paradas do degradê de UMA peça da rampa, para SVG (`<stop>`).
 *
 * É a irmã de `gradienteBarra` para quem pinta em SVG em vez de CSS: barra,
 * fatia de rosca e linha do recharts recebem `fill`/`stroke: url(#id)`, e um
 * `linear-gradient()` de CSS não vale ali. Sem esta função, um gráfico em
 * SVG teria de reconstruir a rampa à mão — e a primeira coisa que se esquece
 * de reconstruir é a COSTURA.
 *
 * Mesma regra da emenda: o par que cruza a costura ganha a parada quase
 * acromática no meio, senão o miolo da peça fica VERDE (achado da auditoria
 * v7, o mesmo que `gradienteBarra` conserta).
 *
 * `i` é o passo da rampa: a peça i vai de ESPECTRO[i] a ESPECTRO[i+1] — é
 * por isso que ESPECTRO tem NOVE amostras para oito peças. O pé direito de
 * uma emenda no pé esquerdo da próxima, e a série inteira lê como um
 * degradê contínuo.
 */
export function paradasBarra(i: number, isLight: boolean): { cor: string; pos: string }[] {
  const tema = isLight ? "light" : "dark";
  const rampa = ESPECTRO[tema];
  const idx = ((i % PECAS_ESPECTRO) + PECAS_ESPECTRO) % PECAS_ESPECTRO;
  const a = rampa[idx];
  const b = rampa[idx + 1];
  // a emenda da rampa é exatamente entre as amostras 1 e 2 (ver PAR_EMENDA)
  return idx === 1
    ? [{ cor: a, pos: "0%" }, { cor: COSTURA[tema], pos: "50%" }, { cor: b, pos: "100%" }]
    : [{ cor: a, pos: "0%" }, { cor: b, pos: "100%" }];
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

// Os quatro pares saem da rampa v7 — e o amarelo é o DA MARCA (SUPERNOVA
// 300→400), o mesmo do botão: a regra "um amarelo só" valendo aqui também.
const AVATARES: DegradeAvatar[] = [
  { grad: "linear-gradient(140deg, #6CC2ED, #4F94E9)", glow: "rgba(79,148,233,0.42)",  sobre: "#08111F" },
  { grad: "linear-gradient(140deg, #FCDE48, #F8C811)", glow: "rgba(248,200,17,0.42)",  sobre: "#1A1300" },
  { grad: "linear-gradient(140deg, #FF872E, #F49E00)", glow: "rgba(244,158,0,0.42)",   sobre: "#1F0D00" },
  { grad: "linear-gradient(140deg, #F87A5E, #F17881)", glow: "rgba(241,120,129,0.42)", sobre: "#1F0708" },
];

/** O degradê de quem não tem foto — estável para a mesma pessoa. */
export function degradeAvatar(chave: string): DegradeAvatar {
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) | 0;
  return AVATARES[Math.abs(h) % AVATARES.length];
}
