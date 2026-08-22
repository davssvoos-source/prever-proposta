// Duplas de campo (R56/U47) — a lógica pura, testável sem banco e sem React.
//
// A DUPLA DE UM CHAMADO É DERIVADA DO RESPONSÁVEL, não guardada numa coluna:
// se o responsável está numa dupla ativa, o chamado é daquela dupla. Ver o
// cabeçalho de supabase/migrations/20260822050000_u47_duplas_de_campo.sql para
// o porquê (retroatividade, uma fonte de verdade só, e é como a operação já
// funciona — a programação atribui o técnico, a dupla vem junto).

export interface Dupla {
  id: string;
  nome: string;
  membro_a: string;
  membro_b: string | null;
  ativa: boolean;
}

/** Os ids das pessoas da dupla — uma ou duas, nunca com null no meio. */
export function membrosDaDupla(d: Dupla): string[] {
  return d.membro_b ? [d.membro_a, d.membro_b] : [d.membro_a];
}

/**
 * A dupla ATIVA de uma pessoa. Só considera duplas ativas: uma dupla desfeita
 * não pode continuar puxando o trabalho de quem já saiu dela.
 *
 * O banco garante que a resposta é única (índices parciais + trigger na U47),
 * então o primeiro achado é O achado.
 */
export function duplaDaPessoa(pessoaId: string | null, duplas: Dupla[]): Dupla | null {
  if (!pessoaId) return null;
  return duplas.find((d) => d.ativa && membrosDaDupla(d).includes(pessoaId)) ?? null;
}

/**
 * O PAR de uma pessoa na dupla ativa dela — o apoio automático (R75).
 *
 * Gêmeo TS de `public.parceiro_da_dupla()` (U64). Quem grava o apoio é o
 * gatilho no banco, para valer em qualquer caminho de escrita (app, import,
 * SQL na mão); esta versão existe para a tela poder ANTECIPAR o que vai
 * acontecer — mostrar "apoio: Luan" antes de salvar — e para a regra poder
 * ser travada por asserção sem subir banco.
 *
 * Devolve null quando não há dupla, ou quando a dupla é de uma pessoa só.
 * Null é resposta legítima: inventar um apoio é pior que deixar em branco.
 */
export function parceiroDaDupla(pessoaId: string | null, duplas: Dupla[]): string | null {
  const d = duplaDaPessoa(pessoaId, duplas);
  if (!d) return null;
  return membrosDaDupla(d).find((m) => m !== pessoaId) ?? null;
}

/**
 * Nome de exibição. `nome` é o que o gestor escreveu no cadastro; quando ele
 * está vazio, monta a partir de quem está nela — uma dupla sem rótulo ainda
 * precisa ser reconhecível na legenda do gráfico e no filtro.
 */
export function rotuloDaDupla(d: Dupla, nomeDe: (id: string) => string): string {
  const proprio = d.nome.trim();
  if (proprio) return proprio;
  return membrosDaDupla(d).map(nomeDe).join(" & ");
}

/**
 * Valida o formulário de cadastro. Devolve a mensagem do primeiro problema, ou
 * null quando está tudo certo — as três regras que o banco também garante,
 * checadas aqui para a pessoa saber ANTES de gravar e receber um erro cru.
 */
export function erroDaDupla(
  entrada: { nome: string; membroA: string | null; membroB: string | null },
  duplas: Dupla[],
  nomeDe: (id: string) => string,
  idEmEdicao?: string,
): string | null {
  if (!entrada.nome.trim()) return "Dê um nome à dupla.";
  if (!entrada.membroA) return "Escolha ao menos um técnico.";
  if (entrada.membroB && entrada.membroA === entrada.membroB) {
    return "A dupla precisa de duas pessoas diferentes.";
  }
  const escolhidos = [entrada.membroA, entrada.membroB].filter(Boolean) as string[];
  for (const id of escolhidos) {
    const outra = duplas.find(
      (d) => d.ativa && d.id !== idEmEdicao && membrosDaDupla(d).includes(id),
    );
    if (outra) {
      return `${nomeDe(id)} já está na dupla "${rotuloDaDupla(outra, nomeDe)}".`;
    }
  }
  return null;
}

// ── Série do gráfico: atividades por dupla ao longo das semanas ─────────────

export interface SemanaDoGrafico {
  /** chave estável da semana — "2026-S34" (referenciaSemanal de periodos.ts) */
  chave: string;
  /** rótulo curto do eixo X — "18/08" (a segunda-feira da semana) */
  rotulo: string;
}

/**
 * Uma linha do gráfico de linhas: a semana, mais uma contagem por dupla
 * (chaveadas pelo id da dupla, que é o `dataKey` de cada <Line>).
 */
export type PontoDoGrafico = { semana: string } & Record<string, number | string>;

interface ChamadoParaGrafico {
  responsavel_id: string | null;
  /** quando a atividade foi PROGRAMADA para acontecer em campo */
  data_hora_agendada: string | null;
}

/**
 * Monta a série do gráfico "atividades por dupla ao longo do tempo".
 *
 * BUCKET POR `data_hora_agendada`, não por `created_at` nem `concluida_em`: o
 * gráfico responde "quanto cada dupla teve para fazer em cada semana", e é a
 * data programada que diz em que semana o trabalho caiu para elas. `created_at`
 * mediria quando a demanda ENTROU (que é outro indicador, o "fluxo do mês", já
 * no painel) e `concluida_em` deixaria de fora tudo que ainda está por fazer.
 *
 * Chamado sem responsável, ou com responsável fora de qualquer dupla ativa,
 * não entra em linha nenhuma — não há dupla a quem atribuir, e inventar uma
 * cesta "sem dupla" faria o gráfico de composição das duplas falar de outra
 * coisa. A tela informa esse resto por fora, em texto.
 */
export function serieAtividadesPorDupla(
  chamados: ChamadoParaGrafico[],
  duplas: Dupla[],
  semanas: SemanaDoGrafico[],
  chaveDaSemana: (d: Date) => string,
): PontoDoGrafico[] {
  const ativas = duplas.filter((d) => d.ativa);
  const contagem = new Map<string, Map<string, number>>();
  for (const s of semanas) contagem.set(s.chave, new Map());

  for (const c of chamados) {
    if (!c.data_hora_agendada) continue;
    const dupla = duplaDaPessoa(c.responsavel_id, ativas);
    if (!dupla) continue;
    const chave = chaveDaSemana(new Date(c.data_hora_agendada));
    const daSemana = contagem.get(chave);
    if (!daSemana) continue; // fora da janela mostrada
    daSemana.set(dupla.id, (daSemana.get(dupla.id) ?? 0) + 1);
  }

  return semanas.map((s) => {
    const ponto: PontoDoGrafico = { semana: s.rotulo };
    for (const d of ativas) ponto[d.id] = contagem.get(s.chave)?.get(d.id) ?? 0;
    return ponto;
  });
}

/**
 * Quantos chamados o gráfico NÃO conseguiu atribuir a uma dupla (sem
 * responsável, ou responsável fora de dupla ativa) dentro da janela mostrada.
 * A tela informa esse número — um gráfico que some com parte do trabalho sem
 * dizer nada é um gráfico que mente por omissão.
 */
export function foraDeDupla(
  chamados: ChamadoParaGrafico[],
  duplas: Dupla[],
  semanas: SemanaDoGrafico[],
  chaveDaSemana: (d: Date) => string,
): number {
  const ativas = duplas.filter((d) => d.ativa);
  const janela = new Set(semanas.map((s) => s.chave));
  return chamados.filter((c) => {
    if (!c.data_hora_agendada) return false;
    if (!janela.has(chaveDaSemana(new Date(c.data_hora_agendada)))) return false;
    return !duplaDaPessoa(c.responsavel_id, ativas);
  }).length;
}
