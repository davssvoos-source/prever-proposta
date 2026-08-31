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
  /** U76 — a viatura da equipe. Opcional aqui até `data.ts` passar a lê-la. */
  veiculo?: string | null;
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

// ── U76/R96/R97: a composição ganha EIXO DE TEMPO ───────────────────────────
//
// Tudo acima responde "quem está com quem HOJE", lendo membro_a/membro_b. O que
// vem abaixo responde "quem estava com quem NAQUELA SEMANA", lendo a escala.
// São perguntas diferentes, e por isso são funções diferentes: cada uma daqui
// para baixo EXIGE a semana, justamente para não poder ser confundida com a de
// cima. O bloco antigo é o caminho legado — some no Passo 2, junto com as
// colunas membro_a/membro_b e com a ponte que a U76 deixou no banco.
//
// A razão da migration, em uma frase: até aqui, mover o Luan de equipe
// reescrevia em silêncio as 12 semanas do gráfico do painel, porque a equipe de
// cada atividade era resolvida pela composição de hoje. A escala guarda o
// passado, e o passado para de mudar.
//
// No banco a tabela continua `duplas` e a escala é `duplas_escala`: a palavra
// "equipe" está ocupada por DEPARTAMENTO desde a U71 (chamados.equipe,
// profiles.equipe, src/lib/equipes.ts). "Equipe de campo" é rótulo de TELA.

/**
 * Semana sintética anterior a qualquer data real. A U76 grava nela a composição
 * do dia da migração para que TODO o passado herde o que o gráfico já
 * desenhava — congelar o que a tela dizia, em vez de esvaziar 11 semanas.
 * `rotuloReferencia()` de periodos.ts renderizaria "semana 1 de 1"; a tela usa
 * `rotuloDaOrigem()` aqui de baixo, que a traduz por "desde sempre".
 */
export const MARCO_ZERO = "0001-S01";

/** Uma pessoa, numa equipe, numa semana. Espelha `public.duplas_escala`. */
export interface LinhaDeEscala {
  /** 'AAAA-SNN' com ANO ISO — o mesmo `referenciaSemanal()` de periodos.ts */
  semana: string;
  dupla_id: string;
  pessoa_id: string;
  /** só exibição (quem aparece primeiro no chip); nenhuma regra depende dela */
  ordem: number;
}

/**
 * A escala pronta para consulta. `semanasAbertas` vem de
 * `public.duplas_escala_semanas` e é o ÂNCORA DA HERANÇA — não as linhas.
 *
 * A diferença importa: uma semana ABERTA em que uma equipe ficou sem ninguém é
 * "esta equipe não sai nesta semana", uma decisão; uma semana FECHADA é "ainda
 * não decidimos", e aí a resposta é herdada. Sem as duas listas, ausência de
 * linha significaria as duas coisas ao mesmo tempo.
 */
export interface Escala {
  /** as semanas DECIDIDAS, em ordem crescente */
  semanasAbertas: string[];
  /** as linhas, indexadas pela semana em que foram GRAVADAS */
  porSemana: Map<string, LinhaDeEscala[]>;
}

/**
 * Compara duas chaves de semana. É comparação de TEXTO puro, e isso é uma
 * propriedade do formato, não um atalho: 'AAAA-SNN' tem largura fixa, zero à
 * esquerda e ANO ISO na frente, então a ordem alfabética É a cronológica —
 * inclusive na virada ('2025-S52' < '2026-S01'). O `padStart(2, "0")` de
 * `referenciaSemanal()` não é cosmético: sem ele 'S9' > 'S10' e a herança
 * escolheria a semana errada. O gêmeo no banco usa COLLATE "C" pelo mesmo
 * motivo.
 */
export function comparaSemana(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Monta o índice de consulta. As semanas são ordenadas aqui, uma vez só. */
export function montarEscala(semanasAbertas: string[], linhas: LinhaDeEscala[]): Escala {
  const porSemana = new Map<string, LinhaDeEscala[]>();
  for (const l of linhas) {
    const lista = porSemana.get(l.semana);
    if (lista) lista.push(l);
    else porSemana.set(l.semana, [l]);
  }
  for (const lista of porSemana.values()) {
    lista.sort((x, y) => x.ordem - y.ordem || (x.pessoa_id < y.pessoa_id ? -1 : 1));
  }
  return { semanasAbertas: [...semanasAbertas].sort(comparaSemana), porSemana };
}

/**
 * A HERANÇA, em uma função: a semana cuja escala vale em `semana` é ela mesma,
 * ou a ABERTA mais recente ANTES dela.
 *
 * `<=`, e nunca "a mais próxima". Se a herança aceitasse uma escala FUTURA para
 * tapar um buraco no passado, lançar a escala de amanhã reescreveria o gráfico
 * de ontem — e teríamos reconstruído, com outro nome, exatamente o defeito que
 * a U76 existe para consertar.
 *
 * `null` é a resposta honesta para "antes da primeira semana aberta": não
 * sabíamos quem saía com quem. Quem consome NÃO pode ler `null` como "ninguém":
 * o gatilho de apoio no banco volta cedo em vez de apagar registro, e a tela
 * diz "sem escala" em vez de "fora de equipe".
 */
export function semanaVigente(semana: string, escala: Escala): string | null {
  const abertas = escala.semanasAbertas;
  for (let i = abertas.length - 1; i >= 0; i--) {
    if (comparaSemana(abertas[i], semana) <= 0) return abertas[i];
  }
  return null;
}

/**
 * O retrato de uma semana: todas as linhas da semana vigente para ela.
 *
 * Não filtra `ativa`, e isso é decisão, não esquecimento. Filtrar aqui faria
 * desfazer uma equipe apagar a linha dela do gráfico das semanas PASSADAS — que
 * é a contradição que o cabeçalho de `data.ts` sempre carregou ("a dupla
 * desfeita ainda explica o histórico" era promessa sem lastro). A escala guarda
 * o passado; quem tira a equipe do FUTURO é a ausência dela nas semanas
 * seguintes.
 */
export function escalaDaSemana(semana: string, escala: Escala): LinhaDeEscala[] {
  const vigente = semanaVigente(semana, escala);
  if (!vigente) return [];
  return escala.porSemana.get(vigente) ?? [];
}

/** De qual semana veio o retrato, e se ele foi HERDADO (ninguém confirmou). */
export function origemDaEscala(
  semana: string,
  escala: Escala,
): { semanaOrigem: string | null; herdada: boolean } {
  const vigente = semanaVigente(semana, escala);
  return { semanaOrigem: vigente, herdada: vigente !== null && vigente !== semana };
}

/** Quem estava na equipe naquela semana, na ordem de exibição. */
export function composicaoDaDupla(duplaId: string, semana: string, escala: Escala): string[] {
  return escalaDaSemana(semana, escala)
    .filter((l) => l.dupla_id === duplaId)
    .map((l) => l.pessoa_id);
}

/**
 * A equipe de uma pessoa NAQUELA SEMANA. Devolve o id da equipe, ou null.
 *
 * Sem `find()` de sorte: a chave primária `(semana, pessoa_id)` de
 * `public.duplas_escala` garante no máximo uma resposta, e a herança é da
 * semana INTEIRA — se cada equipe herdasse por conta própria, a mesma pessoa
 * poderia aparecer em duas equipes na mesma semana resolvida e índice nenhum
 * veria.
 */
export function duplaDaPessoaNaSemana(
  pessoaId: string | null,
  semana: string,
  escala: Escala,
): string | null {
  if (!pessoaId) return null;
  return escalaDaSemana(semana, escala).find((l) => l.pessoa_id === pessoaId)?.dupla_id ?? null;
}

/**
 * Os OUTROS da equipe da pessoa naquela semana — o apoio automático (R75), no
 * plural porque a equipe de campo pode ter três.
 *
 * Gêmeo TS de `public.parceiros_da_dupla(uuid, date)`. Quem GRAVA o apoio é o
 * gatilho no banco, para valer em qualquer caminho de escrita; esta versão
 * existe para a tela ANTECIPAR o que vai acontecer ("apoio: Luan e Denner")
 * antes de salvar, e para a regra ser travada por asserção sem subir banco.
 */
export function parceirosNaSemana(
  pessoaId: string | null,
  semana: string,
  escala: Escala,
): string[] {
  const dupla = duplaDaPessoaNaSemana(pessoaId, semana, escala);
  if (!dupla) return [];
  return escalaDaSemana(semana, escala)
    .filter((l) => l.dupla_id === dupla && l.pessoa_id !== pessoaId)
    .map((l) => l.pessoa_id);
}

/**
 * O par, quando existe EXATAMENTE um. Null quando não há equipe, quando ela é
 * de uma pessoa só, e também quando tem três ou mais: escolher um dos dois por
 * sorte seria inventar, e inventar um apoio é pior que deixar em branco. Quem
 * precisa da resposta inteira usa `parceirosNaSemana`.
 */
export function parceiroNaSemana(
  pessoaId: string | null,
  semana: string,
  escala: Escala,
): string | null {
  const outros = parceirosNaSemana(pessoaId, semana, escala);
  return outros.length === 1 ? outros[0] : null;
}

/**
 * Nome de exibição a partir da composição DAQUELA semana. Irmã de
 * `rotuloDaDupla` acima, que ainda lê membro_a/membro_b: uma equipe sem rótulo
 * precisa ser reconhecível na legenda do gráfico, e a composição que aparece
 * ali tem de ser a da semana mostrada, não a de hoje.
 */
export function rotuloDaComposicao(
  d: Dupla,
  composicao: string[],
  nomeDe: (id: string) => string,
): string {
  const proprio = d.nome.trim();
  if (proprio) return proprio;
  if (composicao.length === 0) return "Equipe sem composição";
  return composicao.map(nomeDe).join(" & ");
}

/** "escala herdada de 2026-S30" / "escala desta semana" / "desde sempre". */
export function rotuloDaOrigem(semanaOrigem: string | null, semanaPedida: string): string {
  if (!semanaOrigem) return "sem escala lançada";
  if (semanaOrigem === semanaPedida) return "escala desta semana";
  if (semanaOrigem === MARCO_ZERO) return "escala de sempre (composição do cadastro antigo)";
  return `escala herdada de ${semanaOrigem}`;
}

const FORMATO_SEMANA = /^\d{4}-S(0[1-9]|[1-4]\d|5[0-3])$/;

/** O mesmo CHECK que o banco aplica — errar o formato quebra a herança calada. */
export function semanaValida(semana: string): boolean {
  return FORMATO_SEMANA.test(semana);
}

/**
 * Valida o LANÇAMENTO da escala de uma equipe numa semana. Devolve a mensagem
 * do primeiro problema, ou null.
 *
 * A terceira regra é a que substitui os índices parciais da U47: a pessoa está
 * em UMA equipe por semana. Aqui ela é checada para a pessoa saber ANTES de
 * gravar, e é a mesma que a chave primária `(semana, pessoa_id)` garante no
 * banco — não a versão "para sempre" que a composição fixa exigia.
 */
export function erroDaEscala(
  entrada: { duplaId: string; semana: string; membros: string[] },
  escala: Escala,
  nomeDe: (id: string) => string,
  rotuloDe: (duplaId: string) => string,
): string | null {
  if (!semanaValida(entrada.semana)) {
    return `Semana fora do formato AAAA-SNN: ${entrada.semana}.`;
  }
  if (new Set(entrada.membros).size !== entrada.membros.length) {
    return "A mesma pessoa aparece duas vezes na equipe.";
  }
  // Só as linhas GRAVADAS naquela semana bloqueiam: a escala herdada é o que a
  // tela mostra antes de o gestor abrir a semana, e o próprio ato de gravar
  // materializa a herança. Bloquear por herança recusaria o primeiro remanejo.
  const daSemana = escala.porSemana.get(entrada.semana) ?? [];
  for (const id of entrada.membros) {
    const outra = daSemana.find((l) => l.pessoa_id === id && l.dupla_id !== entrada.duplaId);
    if (outra) {
      return `${nomeDe(id)} já está na equipe "${rotuloDe(outra.dupla_id)}" na semana ${entrada.semana}.`;
    }
  }
  return null;
}

/**
 * Quais equipes ganham uma <Line>: as que tiveram escala em ALGUMA semana da
 * janela — não as que estão `ativa` hoje.
 *
 * É a correção da cicatriz que `data.ts` documentava ao contrário: até a U76,
 * desativar uma equipe apagava a linha dela das 12 semanas, embora o comentário
 * prometesse que "a dupla desfeita ainda explica o histórico". Agora a escala
 * LEMBRA, e o gráfico pode contar a verdade.
 *
 * A ordem vem da lista `duplas` (que chega ordenada por nome), para a cor de
 * cada linha não trocar de dona a cada render.
 */
export function duplasNaJanela(
  duplas: Dupla[],
  semanas: SemanaDoGrafico[],
  escala: Escala,
): Dupla[] {
  const comEscala = new Set<string>();
  for (const s of semanas) {
    for (const l of escalaDaSemana(s.chave, escala)) comEscala.add(l.dupla_id);
  }
  return duplas.filter((d) => comEscala.has(d.id));
}

/**
 * A série do gráfico, resolvida pela ESCALA — sucessora de
 * `serieAtividadesPorDupla`, que o painel passa a chamar no Passo 2.
 *
 * O bucket continua sendo `data_hora_agendada`, pelo mesmo motivo de sempre. O
 * que muda é que a equipe de cada atividade sai da escala DA SEMANA DELA, e não
 * da composição de hoje: mexer na escala de agora não altera um único ponto das
 * semanas que já têm escala própria anterior.
 *
 * Atividade sem responsável, ou cujo responsável não estava escalado naquela
 * semana, não entra em linha nenhuma — inventar uma cesta "sem equipe" faria o
 * gráfico de composição falar de outra coisa. `foraDeEscala` conta esse resto,
 * e a tela mostra o número.
 */
export function serieAtividadesPorEscala(
  chamados: ChamadoParaGrafico[],
  duplas: Dupla[],
  semanas: SemanaDoGrafico[],
  escala: Escala,
  chaveDaSemana: (d: Date) => string,
): PontoDoGrafico[] {
  const linhas = duplasNaJanela(duplas, semanas, escala);
  const contagem = new Map<string, Map<string, number>>();
  for (const s of semanas) contagem.set(s.chave, new Map());

  for (const c of chamados) {
    if (!c.data_hora_agendada) continue;
    const chave = chaveDaSemana(new Date(c.data_hora_agendada));
    const daSemana = contagem.get(chave);
    if (!daSemana) continue; // fora da janela mostrada
    const dupla = duplaDaPessoaNaSemana(c.responsavel_id, chave, escala);
    if (!dupla) continue;
    daSemana.set(dupla, (daSemana.get(dupla) ?? 0) + 1);
  }

  return semanas.map((s) => {
    const ponto: PontoDoGrafico = { semana: s.rotulo };
    for (const d of linhas) ponto[d.id] = contagem.get(s.chave)?.get(d.id) ?? 0;
    return ponto;
  });
}

/**
 * Quantas atividades o gráfico NÃO conseguiu atribuir a uma equipe dentro da
 * janela — sem responsável, responsável fora da escala daquela semana, ou
 * semana sem escala nenhuma. Sucessora de `foraDeDupla`; perdeu o parâmetro
 * `duplas` porque quem decide passou a ser a escala.
 */
export function foraDeEscala(
  chamados: ChamadoParaGrafico[],
  semanas: SemanaDoGrafico[],
  escala: Escala,
  chaveDaSemana: (d: Date) => string,
): number {
  const janela = new Set(semanas.map((s) => s.chave));
  return chamados.filter((c) => {
    if (!c.data_hora_agendada) return false;
    const chave = chaveDaSemana(new Date(c.data_hora_agendada));
    if (!janela.has(chave)) return false;
    return !duplaDaPessoaNaSemana(c.responsavel_id, chave, escala);
  }).length;
}
