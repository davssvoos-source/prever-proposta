// ─── Padrão de design do app (referência: montagem do bloco CFTV) ────────────
//
// Regras (v3 — vidro, 2026-08-20):
// - Cards/itens de lista: VIDRO sobre o fundo Yellow Glow — superfície
//   translúcida com desfoque (a regra antiga proibia blur; o Davi a inverteu
//   junto com o fundo novo, referências Versa UI). No celular o desfoque sai
//   (--vidro-blur: none) e fica a superfície semiopaca: blur é caro na GPU.
// - Botões de ação: amarelo degradê + glow externo, texto preto, Montserrat SemiBold.
// - Títulos: Montserrat SemiBold (600).
// - Sem backdrop-filter/blur em cards de conteúdo.

import type React from "react";
import { degradeDaCor, tintaSobreDegrade, hexParaRgb } from "@/lib/degrade";

export const FONT = "var(--fonte)";

/** Branco — a tinta da etiqueta sólida no tema claro (R177). */
const TINTA_CLARA = "#ffffff";

/** Degradê de preto bem escuro — fundo padrão de cards no tema escuro. */
export const CARD_BG_DARK = "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)";
/** Fundo padrão de cards no tema claro. */
export const CARD_BG_LIGHT = "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)";

export const CARD_BORDER_DARK = "1px solid rgba(252,222,72,0.16)";
export const CARD_BORDER_LIGHT = "1px solid rgba(0,0,0,0.07)";

export const CARD_SHADOW_DARK = "0 8px 24px rgba(0,0,0,0.45)";
export const CARD_SHADOW_LIGHT = "0 1px 6px rgba(0,0,0,0.07)";

/** Amarelo degradê padrão dos botões. */
export const GOLD_GRAD = "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)";
/** Glow externo dos botões dourados. */
export const GOLD_GLOW = "0 6px 20px rgba(248,200,17,0.35)";

/** Vidro — reservado aos PAINÉIS (gráficos, sidebar, popovers). v4. */
export const VIDRO_BG_DARK = "rgba(255,255,255,0.05)";
export const VIDRO_BG_LIGHT = "rgba(255,255,255,0.55)";
export const VIDRO_BORDER_DARK = "1px solid rgba(255,255,255,0.09)";
export const VIDRO_BORDER_LIGHT = "1px solid rgba(255,255,255,0.72)";

/**
 * Card padrão v4 — NEO-MINIMALISTA: superfície sólida, canto bem redondo e
 * uma sombra leve em relação ao fundo. O vidro saiu do conteúdo e ficou nos
 * painéis (vidro() abaixo): sobre um degradê quase liso, vidro em tudo vira
 * ruído; em pontos escolhidos vira hierarquia de material.
 */
export const card = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? "#ffffff" : "#141416",
  border: isLight ? "1px solid rgba(0,0,0,0.05)" : "1px solid rgba(255,255,255,0.06)",
  borderRadius: 18,
  boxShadow: isLight
    ? "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.07)"
    : "0 1px 2px rgba(0,0,0,0.50), 0 10px 30px rgba(0,0,0,0.30)",
});

/**
 * ETIQUETA — o chip de categoria, PREENCHIDO (R177, 2026-09-04).
 *
 * Davi: "as etiquetas que são coloridas podem ter fundo da etiqueta de cor
 * sólida e o texto branco, assim deixa o contraste mais limpo" — dentro do
 * pedido maior de que o sistema é ferramenta de trabalho e não deve cansar a
 * vista de quem passa o dia nele (R174).
 *
 * Até aqui a etiqueta era véu: fundo na cor a 14% de alfa (`.bg`) e texto na
 * cor. Empilhava três coisas fracas — fundo lavado, texto colorido e às vezes
 * borda —, e numa lista de trinta linhas o resultado é ruído de baixa
 * legibilidade. Preenchida, é UMA forma, com contraste alto e sem borda (o
 * preenchimento já separa do card).
 *
 * O TOM É O MESMO NOS DOIS TEMAS, e é o tom FUNDO da cor (`.light`), com
 * texto branco. Três candidatos foram medidos antes de escolher:
 *
 *   | preenchimento | branco (pior cor) | soma de luminância |
 *   |---|---|---|
 *   | tom vivo (`.dark`) | 1,58:1 (amarelo) — reprova | 4,174 |
 *   | tom vivo misturado 45% com o card | 4,33:1 | 1,375 |
 *   | **tom fundo (`.light`)** | **4,99:1** | **1,232** |
 *
 * O tom vivo obrigaria tinta quase-preta (branco sobre `#F8C811` é 1,58:1) e
 * — o que decidiu — TRIPLICA a luz que a tela emite, que é justamente o que
 * esta entrega foi feita para reduzir. O tom fundo passa de 4,99:1 com branco
 * nas dez cores do PRISMA, é a opção mais calma das três, e deixa a etiqueta
 * IDÊNTICA nos dois temas — um número a menos para raciocinar.
 *
 * A objeção óbvia ao tom fundo era o contraste contra o card escuro (1,55:1),
 * mas a razão engana no escuro: a fórmula comprime perto do preto, e o
 * preenchimento é de 7 a 29 vezes mais luminoso que o card `#141416` — lê
 * como forma sem dificuldade. E o que carrega a informação é o texto branco,
 * que está em 4,99:1.
 *
 * Devolve só `background` e `color`: forma, tamanho e peso continuam de quem
 * chama, porque a etiqueta de 9px maiúscula da página e a de 11px do card são
 * densidades diferentes de propósito.
 */
export const etiqueta = (
  cor: { dark: string; light: string },
): { background: string; color: string } => ({
  background: cor.light,
  color: TINTA_CLARA,
});

/** Painel de vidro — gráficos, sidebar, popovers. */
export const vidro = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? VIDRO_BG_LIGHT : VIDRO_BG_DARK,
  border: isLight ? VIDRO_BORDER_LIGHT : VIDRO_BORDER_DARK,
  borderRadius: 18,
  boxShadow: isLight ? "0 8px 28px rgba(0,0,0,0.06)" : "0 8px 28px rgba(0,0,0,0.30)",
  backdropFilter: "var(--vidro-blur)" as any,
  WebkitBackdropFilter: "var(--vidro-blur)" as any,
});

/** Botão dourado padrão (igual nos dois temas). */
export const goldButton = (): React.CSSProperties => ({
  background: GOLD_GRAD,
  boxShadow: GOLD_GLOW,
  color: "#08090E", // = SOBRE_PRIMARIA (paleta.ts) — texto sobre o degradê dourado
  border: "none",
  fontFamily: FONT,
  fontWeight: 600,
  cursor: "pointer",
});

/**
 * Botão de SELEÇÃO, colorido pela coisa que ele representa (R87, U72).
 *
 * Davi, 2026-08-26: "mantenha o efeito degradê em cada botão, mas aplique a
 * cor de acordo com a hierarquia, por exemplo, Aguardando Início em azul, Em
 * andamento em amarelo, Stand By em laranja."
 *
 * Isto MUDA a §6.4 e a §11.5 do DESIGN_SYSTEM, que reservavam o degradê em
 * botão para o dourado da marca. O motivo da mudança está no próprio pedido:
 * quando toda opção escolhida fica dourada, a cor deixa de dizer QUAL opção
 * foi escolhida — ela vira só "está selecionado", coisa que a forma do botão
 * já dizia. Trocar o dourado pela cor da hierarquia devolve informação a um
 * canal que estava sendo gasto à toa. As cores não são novas: saem de
 * `chamado-status.ts`, `TIPO_CORES`, `PRIORIDADE_CORES` e `EQUIPE_CORES`, que
 * já eram a paleta oficial de cada escala.
 *
 * A fileira INTEIRA fica colorida, não só a escolhida: com só a ativa pintada,
 * nunca se veria azul, amarelo e laranja ao mesmo tempo, que é justamente a
 * leitura de hierarquia que o pedido descreve. A escolhida ganha o degradê e o
 * relevo; as outras ficam no véu da própria cor.
 *
 * O degradê é IGUAL nos dois temas, como o dourado sempre foi (§2.1) — é por
 * isso que ele parte de `cor.dark`, o tom saturado, e não do par de tema. Quem
 * escolhe a tinta por cima é o contraste medido, não o gosto (ver
 * `tintaSobreDegrade`).
 */
export const botaoSelecao = (
  ativo: boolean,
  isLight: boolean,
  cor?: { dark: string; light: string; bg: string; border: string } | null,
): React.CSSProperties => {
  if (ativo && cor) {
    const [r, g, b] = hexParaRgb(cor.dark);
    return {
      background: degradeDaCor(cor.dark),
      color: tintaSobreDegrade(cor.dark),
      border: "none",
      boxShadow: `0 6px 20px rgba(${r},${g},${b},0.35)`,
      fontFamily: FONT, fontWeight: 600, cursor: "pointer",
    };
  }
  if (ativo) {
    // sem cor própria (sprint, por exemplo) o dourado da marca segue valendo
    return {
      background: GOLD_GRAD, color: "#08090E", border: "none", boxShadow: GOLD_GLOW,
      fontFamily: FONT, fontWeight: 600, cursor: "pointer",
    };
  }
  return {
    background: cor ? cor.bg : (isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)"),
    color: cor ? (isLight ? cor.light : cor.dark) : (isLight ? "#1e2229" : "#ffffff"),
    border: `1px solid ${cor ? cor.border : (isLight ? "rgba(0,0,0,0.12)" : "rgba(252,222,72,0.16)")}`,
    fontFamily: FONT, fontWeight: 600, cursor: "pointer",
  };
};

/** Título padrão — Montserrat SemiBold. */
export const title = (isLight: boolean): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 600,
  color: isLight ? "#1e2229" : "#ffffff",
});
