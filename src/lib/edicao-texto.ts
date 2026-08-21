// Edições básicas de texto — negrito, itálico, checklist, lista — para o
// campo de Descrição do painel de propriedades (2026-08-22, Davi: "adicione
// ferramentas... adicionar checklist, colocar em negrito, edições básicas").
//
// POR QUE MARKDOWN, E NÃO UM EDITOR RICO DE VERDADE: a descrição é guardada
// como TEXTO PLANO no banco (`descricao_problema`), lida em texto plano em
// meia dúzia de telas (DetalheCampo, DetalheInterno, a prévia da importação
// do Notion...). Trocar para HTML/JSON estruturado quebraria todas elas de
// uma vez, por um pedido que a própria palavra usada — "básicas" — não pede.
// `**negrito**` e `- [ ] item` são sintaxe que qualquer pessoa já viu (GitHub,
// WhatsApp, Notion) e continuam sendo texto puro em qualquer lugar que leia.
//
// PURO DE PROPÓSITO: sem DOM, sem textarea — só string entra, string (e a
// nova posição do cursor) sai. É o que permite testar cada regra com
// asserção, e é o componente (em PainelChamado.tsx) que fala com o `<textarea>`.

export interface ResultadoEdicao {
  valor: string;
  /** onde o cursor/seleção deve ficar depois — sem isto, cada clique no
   *  botão jogaria o cursor para o fim do texto, e escrever vira procurar
   *  onde você estava. */
  selecaoInicio: number;
  selecaoFim: number;
}

/**
 * Envolve a seleção com um marcador (negrito `**`, itálico `*`).
 *
 * Sem seleção, insere o marcador com um texto de exemplo JÁ selecionado —
 * o padrão do GitHub e de todo editor markdown: escrever por cima do
 * exemplo é mais rápido que apagar e digitar os marcadores de novo.
 */
export function envolverSelecao(
  valor: string, selecaoInicio: number, selecaoFim: number,
  marcador: string, exemplo: string,
): ResultadoEdicao {
  const antes = valor.slice(0, selecaoInicio);
  const meio = valor.slice(selecaoInicio, selecaoFim);
  const depois = valor.slice(selecaoFim);

  if (meio.length === 0) {
    const novo = `${antes}${marcador}${exemplo}${marcador}${depois}`;
    const ini = antes.length + marcador.length;
    return { valor: novo, selecaoInicio: ini, selecaoFim: ini + exemplo.length };
  }
  const novo = `${antes}${marcador}${meio}${marcador}${depois}`;
  return {
    valor: novo,
    selecaoInicio: antes.length + marcador.length,
    selecaoFim: antes.length + marcador.length + meio.length,
  };
}

/**
 * Prefixa cada linha tocada pela seleção (`- [ ] ` para checklist, `- ` para
 * lista). Sem seleção, vale a linha onde o cursor está.
 *
 * IDEMPOTENTE por linha: clicar duas vezes na mesma linha não duplica o
 * prefixo — clicar "checklist" numa linha que já é item de lista não devia
 * produzir `- - [ ] texto`.
 */
export function prefixarLinhas(
  valor: string, selecaoInicio: number, selecaoFim: number, prefixo: string,
): ResultadoEdicao {
  // acha o início da PRIMEIRA linha tocada e o fim da ÚLTIMA
  let inicioBloco = valor.lastIndexOf("\n", selecaoInicio - 1) + 1;
  let fimBloco = valor.indexOf("\n", selecaoFim);
  if (fimBloco === -1) fimBloco = valor.length;

  const bloco = valor.slice(inicioBloco, fimBloco);
  const linhas = bloco.split("\n");
  let somaAcrescida = 0;
  let acrescidaAntesDoInicio = 0;

  const novasLinhas = linhas.map((linha, i) => {
    if (linha.startsWith(prefixo)) return linha;
    somaAcrescida += prefixo.length;
    // linhas inteiramente ANTES do ponto onde a seleção começava (dentro do
    // bloco) empurram o início da seleção adiante também
    const offsetDaLinha = linhas.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
    // `<=`, não `<`: cursor exatamente no início da linha (nada digitado
    // ainda) deve terminar DEPOIS do prefixo novo, pronto para escrever —
    // não preso antes do "- ", que seria o lugar errado para continuar.
    if (inicioBloco + offsetDaLinha <= selecaoInicio) acrescidaAntesDoInicio += prefixo.length;
    return prefixo + linha;
  });

  const novoBloco = novasLinhas.join("\n");
  const novo = valor.slice(0, inicioBloco) + novoBloco + valor.slice(fimBloco);

  return {
    valor: novo,
    selecaoInicio: selecaoInicio + acrescidaAntesDoInicio,
    selecaoFim: selecaoFim + somaAcrescida,
  };
}
