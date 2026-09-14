// LER A TABELA INTEIRA, SEM TETO SILENCIOSO.
//
// Duas consultas da Início nasceram com `.limit(2000)` e `.limit(4000)` e um
// comentário honesto ao lado: "a tabela é pequena". Ela é — hoje. O problema
// não é o número: é que, no dia em que a empresa passar dele, as linhas
// excedentes **somem sem aviso nenhum**. Nenhum erro, nenhum log, nenhuma
// faixa: o card simplesmente deixa de mostrar o apoio ou o local, e quem olha
// lê "não tem" onde a verdade é "não coube".
//
// Este helper tira o teto: pede em páginas até a última vir curta. E ele é
// PURO no que importa — recebe a função que busca uma página, então o
// verificador o exercita sem banco nenhum, inclusive nos casos que só
// aconteceriam com dezenas de milhares de linhas.

export interface PaginaLida<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Lê tudo, em páginas.
 *
 * `buscarPagina(de, ate)` recebe índices INCLUSIVOS, como o `.range()` do
 * PostgREST. A leitura para quando uma página volta com menos linhas do que o
 * tamanho pedido — que é o sinal de que acabou.
 *
 * **Erro não vira lista vazia.** Ele é levantado, para quem chamou decidir o
 * que a tela mostra. Devolver `[]` num erro é a mentira que já custou caro
 * nesta casa: a tela diz "não tem" quando o certo era dizer "não consegui
 * perguntar".
 *
 * `maximoDePaginas` é rede contra laço infinito — uma página que sempre volta
 * cheia (um `range` ignorado, por exemplo) pararia aqui em vez de rodar para
 * sempre.
 */
export async function lerPaginado<T>(
  buscarPagina: (de: number, ate: number) => Promise<PaginaLida<T>>,
  tamanhoDaPagina = 1000,
  maximoDePaginas = 50,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let pagina = 0; pagina < maximoDePaginas; pagina++) {
    const de = pagina * tamanhoDaPagina;
    const { data, error } = await buscarPagina(de, de + tamanhoDaPagina - 1);
    if (error) throw error;
    const linhas = data ?? [];
    tudo.push(...linhas);
    if (linhas.length < tamanhoDaPagina) return tudo;
  }
  return tudo;
}
