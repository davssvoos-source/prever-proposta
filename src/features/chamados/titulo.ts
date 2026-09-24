// O TÍTULO EDITÁVEL NO LUGAR (R324) — a lógica PURA. A tela só desenha.
//
// Davi, 24/09/2026: "Na tela de configuração da atividade, ao clicar no titulo
// deve ser possível alterá-lo. Quando o usuário clica no titulo já fica o
// cursor de texto para ele escrever, bem prático!"

/** O maior título que o campo aceita — o card da Início corta bem antes disso. */
export const TITULO_MAXIMO = 200;

/**
 * O que gravar quando a pessoa sai do título: o texto limpo (espaços das pontas
 * fora, quebras de linha viram espaço, teto de 200), ou `null` quando não há o
 * que gravar — ficou igual ao que já estava, ou ficou vazio. Título vazio não se
 * grava: a atividade sem título some do card e da busca; a tela volta ao anterior.
 */
export function tituloParaSalvar(digitado: string, atual: string | null | undefined): string | null {
  const limpo = digitado.replace(/\s*\n+\s*/g, " ").trim().slice(0, TITULO_MAXIMO);
  if (!limpo) return null;
  if (limpo === (atual ?? "").trim()) return null;
  return limpo;
}
