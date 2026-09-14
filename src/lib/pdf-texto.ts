// O TEXTO QUE ENTRA NUM PDF — P52.
//
// `jsPDF` com a fonte padrão (helvetica) codifica em **WinAnsi**: um byte por
// caractere, e tudo o que não couber é **descartado calado**. Medido nos bytes
// de um PDF gerado com o mesmo par de bibliotecas que o app importa:
//
//   "-" U+002D  -> "([-]) Tj"   OK        "–" U+2013 -> "([]) Tj"   SUMIU
//   "·" U+00B7  -> "([·]) Tj"   OK        "—" U+2014 -> "([]) Tj"   SUMIU
//   "ç ã ê á"                   OK        "•" U+2022 -> "([]) Tj"   SUMIU
//                                         "…" U+2026 -> "([]) Tj"   SUMIU
//
// Os ACENTOS passam — é por isso que ninguém nunca notou. O que some é
// pontuação de composição: a meia-risca, o travessão, o bullet, as reticências,
// as aspas curvas que qualquer editor de texto produz sozinho.
//
// DUAS METADES, E A SEGUNDA É A QUE MACHUCA. A primeira são os literais do
// próprio código ("Registro fotográfico — antes" saía "Registro fotográfico
// antes"), e essa é a que a P52 descreve. A segunda é o TEXTO DIGITADO: um
// técnico que escreve "Troquei a fonte — estava queimada" no diagnóstico perde
// o travessão no relatório que vai ao cliente, e ninguém no caminho tem como
// saber. Trocar só os literais deixaria essa metade viva.
//
// A SAÍDA BARATA É ESTA, e não embutir uma fonte UTF-8 (`addFileToVFS` +
// `addFont`): aquilo muda o tamanho de TODOS os PDFs do sistema e é decisão do
// Davi, não reflexo meu. Aqui se troca o caractere pelo equivalente que o
// WinAnsi tem — e o que não tiver equivalente vira `?`, que é FEIO DE
// PROPÓSITO: o defeito inteiro era o silêncio, e um `?` na página é alguém
// descobrindo em vez de nunca saber.

/** O traço que substitui o campo vazio. Era `—`, que sumia — a célula saía em branco. */
export const VAZIO_PDF = "-";

/** A marca de item de lista. Era `•`, que sumia — a lista de peças perdia TODAS as marcas. */
export const MARCA_PDF = "\u00b7";

/**
 * O que trocar por quê. Só entram caracteres que aparecem de verdade em texto
 * português escrito em teclado ou colado de editor — inventar a tabela inteira
 * do Unicode seria manutenção sem leitor.
 */
const TROCAS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["\u2014", "-"],    // — travessão
  ["\u2013", "-"],    // – meia-risca
  ["\u2212", "-"],    // − sinal de menos
  ["\u2022", "\u00b7"], // • bullet  -> · (WinAnsi)
  ["\u25cf", "\u00b7"], // ● bolinha cheia
  ["\u2026", "..."],  // … reticências
  ["\u201c", "\""],   // “ ”
  ["\u201d", "\""],
  ["\u2018", "'"],    // ‘ ’
  ["\u2019", "'"],
  ["\u2192", "->"],   // →
  ["\u2190", "<-"],   // ←
  ["\u2248", "~"],    // ≈
  ["\u2264", "<="],   // ≤
  ["\u2265", ">="],   // ≥
  ["\u00a0", " "],    // espaço que não quebra — passa no WinAnsi, mas vira espaço
  ["\u2009", " "],    // espaço fino
  ["\u200b", ""],     // espaço de largura zero (vem colado de página web)
]);

/**
 * O texto que o jsPDF consegue imprimir INTEIRO, com a fonte padrão.
 *
 * Aplicar isto na porta de entrada do PDF cobre as duas metades de uma vez: os
 * literais do código e o que a pessoa digitou. O que não tem equivalente vira
 * `?` — visível de propósito.
 */
export function textoDePdf(texto: string | null | undefined): string {
  let s = texto ?? "";
  for (const [de, para] of TROCAS) s = s.split(de).join(para);
  // o que sobrou acima de U+00FF não tem byte em WinAnsi: `?` em vez de sumir
  return [...s].map((c) => (c.codePointAt(0)! > 0xff ? "?" : c)).join("");
}

/** O texto, ou o traço quando não há texto — a dupla que todo campo do PDF faz. */
export function campoDePdf(texto: string | null | undefined): string {
  const s = textoDePdf(texto).trim();
  return s || VAZIO_PDF;
}
