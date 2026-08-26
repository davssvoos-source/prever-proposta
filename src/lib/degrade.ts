// Degradê por cor — a fábrica dos botões de seleção (R87, U72).
//
// Davi, 2026-08-26: "Eu quero que você mantenha o efeito degradê em cada
// botão, mas aplique a cor de acordo com a hierarquia, por exemplo, Aguardando
// Início em azul, Em andamento em amarelo, Stand By em laranja."
//
// Até aqui o chip ativo era SEMPRE o degradê dourado
// (`linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)`), escrito à mão em cada
// tela. Dourado para tudo desperdiça o canal mais forte da interface: quando
// toda escolha fica da mesma cor, a cor deixa de dizer QUAL escolha foi feita.
//
// Este arquivo gera o mesmo efeito a partir de qualquer cor do PRISMA, para
// que "Em andamento" continue amarelo e "Stand-by" fique laranja sem ninguém
// precisar escolher três tons à mão por status. Tudo aqui é PURO: o
// verificador exercita contraste de verdade, não a aparência.

/** "#F8C811" → [248, 200, 17]. Tolera 3 dígitos e falta de "#". */
export function hexParaRgb(hex: string): [number, number, number] {
  let h = (hex ?? "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbParaHex([r, g, b]: [number, number, number]): string {
  const t = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}

/** Mistura em direção ao branco. t=0 devolve a cor, t=1 devolve branco. */
export function clarear(hex: string, t: number): string {
  const [r, g, b] = hexParaRgb(hex);
  return rgbParaHex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
}

/** Mistura em direção ao preto. t=0 devolve a cor, t=1 devolve preto. */
export function escurecer(hex: string, t: number): string {
  const [r, g, b] = hexParaRgb(hex);
  return rgbParaHex([r * (1 - t), g * (1 - t), b * (1 - t)]);
}

// Os dois passos do degradê. Foram calibrados contra o dourado que já existia
// no sistema (#FCDE48 → #F8C811 → #E8B00A): partindo de #F8C811, estes valores
// chegam a ~#FAD445 e ~#DFB40F — a olho, o mesmo botão. Manter os passos
// FIXOS é o ponto: assim status, equipe e tipo têm o mesmo relevo, e só a
// matiz muda.
const PASSO_CLARO = 0.22;
const PASSO_ESCURO = 0.10;

/** O degradê de 3 paradas, no mesmo ângulo do dourado original. */
export function degradeDaCor(hex: string): string {
  return `linear-gradient(135deg, ${clarear(hex, PASSO_CLARO)}, ${hex}, ${escurecer(hex, PASSO_ESCURO)})`;
}

/** Luminância relativa da WCAG — 0 (preto) a 1 (branco). */
export function luminancia(hex: string): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexParaRgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste da WCAG entre duas cores — 1 (igual) a 21 (preto×branco). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a), lb = luminancia(b);
  const [claro, escuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** O quase-preto da marca — o mesmo que o botão dourado sempre usou. */
export const TINTA_ESCURA = "#08090E";
export const TINTA_CLARA = "#ffffff";

/**
 * A tinta que se lê em cima do degradê.
 *
 * Não é uma escolha estética: o dourado pede texto quase-preto e o azul pede
 * branco, e fixar um dos dois deixaria metade dos botões ilegíveis. A decisão
 * sai do contraste medido contra a parada MAIS ESCURA do degradê, que é o pior
 * caso — decidir pela cor base deixaria o pé do gradiente sem contraste.
 */
export function tintaSobreDegrade(hex: string): string {
  const pior = escurecer(hex, PASSO_ESCURO);
  return contraste(pior, TINTA_ESCURA) >= contraste(pior, TINTA_CLARA)
    ? TINTA_ESCURA
    : TINTA_CLARA;
}
