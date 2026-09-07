// O REGISTRO do trabalho numa atividade: problema e diagnóstico (R184, U104).
//
// Davi (2026-09-04): "A área principal terá dois campos principais, um espaço
// para PROBLEMA e outro para DIAGNÓSTICO. Crie uma barra de progresso com dois
// círculos, o 1 e o 2. Ao preencher o PROBLEMA o 1 fica amarelo, e ao preencher
// o diagnóstico, a barra e o 2 ficam amarelos."
//
// Este módulo é a decisão PURA por trás da barra: o que conta como
// "preenchido" e qual frase descreve o estado. A tela (PainelChamado) só
// pinta. Está aqui, e não no componente, porque é regra de produto testável —
// e porque a mesma pergunta ("este chamado tem diagnóstico?") vai ser feita
// por outras telas (a lista, a página do técnico).

export interface EtapasDoRegistro {
  /** o círculo 1 — o PROBLEMA está escrito */
  problema: boolean;
  /** a barra e o círculo 2 — o DIAGNÓSTICO está escrito */
  diagnostico: boolean;
}

/**
 * Um texto conta como preenchido quando tem QUALQUER coisa além de espaço.
 * De propósito não se exige tamanho mínimo nem se desconta marcação
 * Markdown: um checklist só de caixas ("- [ ] Green Village") É conteúdo —
 * é a lista de trabalho que a R143 põe na descrição ao escolher um grupo.
 */
export function textoPreenchido(texto: string | null | undefined): boolean {
  return /\S/.test(texto ?? "");
}

/**
 * As duas etapas são INDEPENDENTES: o 1 olha só o problema, a barra e o 2
 * olham só o diagnóstico. Um diagnóstico sem problema escrito acende o 2 e
 * a barra, e deixa o 1 apagado — o desenho denuncia o registro incompleto
 * em vez de esconder o que já foi feito.
 */
export function etapasDoRegistro(
  problema: string | null | undefined,
  diagnostico: string | null | undefined,
): EtapasDoRegistro {
  return { problema: textoPreenchido(problema), diagnostico: textoPreenchido(diagnostico) };
}

/** A frase para quem não vê a cor (aria-label e tooltip da barra). */
export function fraseDoProgresso(e: EtapasDoRegistro): string {
  if (e.problema && e.diagnostico) return "Problema e diagnóstico registrados";
  if (e.problema) return "Problema registrado — falta o diagnóstico";
  if (e.diagnostico) return "Diagnóstico registrado sem o problema escrito";
  return "Nada registrado ainda";
}
