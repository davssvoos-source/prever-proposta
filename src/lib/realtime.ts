// O NOME DO CANAL DE TEMPO REAL.
//
// Um canal do Supabase é identificado pelo TÓPICO. Pedir `supabase.channel("x")`
// duas vezes não cria dois canais: a segunda chamada devolve o mesmo objeto
// registrado — e, se ele já passou por `subscribe()`, qualquer `.on()` depois é
// RECUSADO:
//
//   cannot add `postgres_changes` callbacks for realtime … after `subscribe()`
//
// Isso acontece o tempo todo numa tela React: o efeito remonta (troca de rota,
// StrictMode em desenvolvimento, uma dependência nova) e a limpeza chama
// `removeChannel`, que é ASSÍNCRONO. A montagem seguinte chega antes da remoção
// terminar, pega o canal velho já inscrito, e o `.on()` morre.
//
// O efeito prático é sempre o mesmo, e é silencioso: **aquela tela para de
// receber tempo real**. Ela só atualiza quando a consulta reexecuta por outro
// motivo. Ninguém abre um chamado, porque um sino que não toca parece um sino
// sem novidade, e uma grade que não se move parece uma grade sem mudança.
//
// Achado em 14/09/2026 pelo console da Início, que reclamava a cada
// carregamento. Os quatro canais do sistema tinham nome fixo.

let proximo = 0;

/**
 * Um tópico novo a cada chamada: `chamados-realtime#3`.
 *
 * Use SEMPRE isto em vez de escrever o nome à mão. O sufixo não muda o que o
 * canal escuta — o filtro está no `.on()` —, só garante que a montagem nova
 * nunca herde o canal da montagem anterior.
 */
export function nomeDeCanal(prefixo: string): string {
  proximo += 1;
  return `${prefixo}#${proximo}`;
}
