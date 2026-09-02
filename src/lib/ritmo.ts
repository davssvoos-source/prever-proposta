// O FREIO DOS SERVIÇOS EXTERNOS — a parte PURA, e é por isso que ela existe.
//
// A aritmética do freio morava dentro de `geocodificar.functions.ts`, junto do
// `setTimeout` que dorme. Uma função que dorme não é testável por `eq` (o
// verificador é síncrono), e o resultado era o pior tipo de proteção: uma que
// NÃO TEM UMA ÚNICA ASSERÇÃO. Trocar `INTERVALO_MIN_MS` por `0`, ou apagar a
// chamada inteira, passava verde — presença da constante não prova o valor, e
// presença da função não prova a chamada (regra 2).
//
// Aqui mora só a CONTA. O `setTimeout` fica do lado de fora, em cada função de
// servidor, onde ele pode dormir sem levar o verificador junto.
//
// ── E ELE É HONESTO SOBRE O QUE NÃO GARANTE ───────────────────────────────
// O estado (`ultimaChamada`) é de MÓDULO, logo é por ISOLATE. O alvo de deploy
// é Cloudflare (`vite.config.ts` — nitro com cloudflare como target padrão), e
// em Workers o isolate não é a exceção do escalonamento: é a unidade normal,
// criada e reciclada livremente. Dois isolates são dois freios independentes.
//
// O que este freio garante de verdade é o que importa hoje: um clique repetido
// depressa, ou um laço que alguém escreva amanhã (o re-geocode em lote é a
// próxima entrega), não vira RAJADA dentro do mesmo isolate. A defesa contra
// rajada distribuída seria uma reivindicação atômica no Postgres, e ela tem
// dono próprio — está declarada em docs/PENDENCIAS_TECNICAS.md.

/**
 * Quanto esperar, em ms, antes da próxima chamada — PURA.
 *
 * `ultima` é o instante que a chamada anterior RESERVOU (não o instante em que
 * ela terminou): quem chama grava `ultima = agora + espera` ANTES de dormir, e
 * é isso que faz três chamadas simultâneas saírem em 0, intervalo e 2×intervalo
 * em vez de as três juntas. Reservar depois de dormir seria uma corrida.
 *
 * Nunca devolve negativo: uma chamada que veio muito depois da anterior não
 * "acumula crédito" para disparar duas de uma vez.
 */
export function esperaMs(ultima: number, agora: number, intervalo: number): number {
  const espera = ultima + intervalo - agora;
  return espera > 0 ? espera : 0;
}
