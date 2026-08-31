// Equipes de campo (R56/U47 → R96/R97/U76, R98/U77) — a lógica pura, testável
// sem banco e sem React.
//
// A EQUIPE DE UM CHAMADO É DERIVADA DO RESPONSÁVEL, não guardada numa coluna:
// não existe `chamados.dupla_id`, de propósito (ver o cabeçalho da U47). O que
// a U76 acrescentou foi a DATA nessa derivação — a composição não é um estado
// atual sem eixo de tempo, é uma SÉRIE POR SEMANA. "Quem estava com quem" e
// "quem está com quem hoje" são perguntas diferentes, e por isso TODA função
// deste arquivo que fala de composição exige a semana.
//
// A U77 tirou daqui o caminho antigo. Não existe mais `membrosDaDupla(d)`, nem
// `duplaDaPessoa(pessoa, duplas)`, nem `serieAtividadesPorDupla(...)`: eram as
// versões sem data, que resolviam qualquer semana pela composição de hoje.
// Enquanto existiam, dava para perguntar sem dizer QUANDO — e essa era a
// pergunta que reescrevia o passado em silêncio.
//
// No banco a tabela continua `duplas` e a escala é `duplas_escala`: a palavra
// "equipe" está ocupada por DEPARTAMENTO desde a U71 (chamados.equipe,
// profiles.equipe, src/lib/equipes.ts). "Equipe de campo" é rótulo de TELA.

export interface Dupla {
  id: string;
  nome: string;
  /** A viatura da turma — placa, modelo ou apelido (R97). */
  veiculo: string | null;
  ativa: boolean;
}

/**
 * Valida o CADASTRO da equipe. Encolheu na U77 de propósito: composição saiu
 * daqui e virou escala (ver `erroDaEscala`). O que sobra é o que pertence à
 * TURMA e não à semana — e o veículo é opcional, porque equipe sem carro
 * continua sendo equipe.
 */
export function erroDaDupla(entrada: { nome: string }): string | null {
  if (!entrada.nome.trim()) return "Dê um nome à equipe.";
  return null;
}

// ── Série do gráfico: atividades por equipe ao longo das semanas ────────────

export interface SemanaDoGrafico {
  /** chave estável da semana — "2026-S34" (referenciaSemanal de periodos.ts) */
  chave: string;
  /** rótulo curto do eixo X — "18/08" (a segunda-feira da semana) */
  rotulo: string;
}

/**
 * Uma linha do gráfico de linhas: a semana, mais uma contagem por equipe
 * (chaveadas pelo id, que é o `dataKey` de cada <Line>).
 */
export type PontoDoGrafico = { semana: string } & Record<string, number | string>;

interface ChamadoParaGrafico {
  responsavel_id: string | null;
  /** quando a atividade foi PROGRAMADA para acontecer em campo */
  data_hora_agendada: string | null;
}

// ── A ESCALA: composição por semana, com herança ────────────────────────────
//
// Toda função daqui para baixo EXIGE a semana. Não é verbosidade: é o que
// impede a pergunta errada de ser feita. Até a U76 existia
// `duplaDaPessoa(pessoa, duplas)` — sem data — e ela resolvia um chamado de
// março pela composição de agosto; mover alguém de equipe reescrevia em
// silêncio as 12 semanas do gráfico do painel. A U77 removeu essa porta.
//
// A escala guarda o passado, e o passado para de mudar.

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
 * Nome de exibição a partir da composição DAQUELA semana.
 *
 * `nome` é o que o gestor escreveu; vazio, monta a partir de quem estava nela.
 * A composição vem por parâmetro em vez de ser lida aqui porque a legenda do
 * gráfico e o chip da programação mostram semanas diferentes na mesma tela —
 * quem chama já sabe de qual semana está falando.
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
 * Quem pode ser oferecido para esta equipe NESTA semana: quem não está gravado
 * em OUTRA equipe na mesma semana.
 *
 * Olha só as linhas GRAVADAS (`porSemana`), e não a herdada — pelo mesmo motivo
 * de `erroDaEscala`: enquanto a semana não foi lançada, ninguém está preso a
 * nada, e filtrar pela herança esconderia justamente as pessoas que o gestor
 * abriu a tela para remanejar.
 *
 * Oferecer um nome que a chave primária vai recusar é convidar ao erro — este
 * é o par de tela da mesma regra que `erroDaEscala` devolve em texto.
 */
export function disponiveisNaSemana<T extends { id: string }>(
  pessoas: T[],
  duplaId: string,
  semana: string,
  escala: Escala,
): T[] {
  const daSemana = escala.porSemana.get(semana) ?? [];
  const presos = new Set(
    daSemana.filter((l) => l.dupla_id !== duplaId).map((l) => l.pessoa_id),
  );
  return pessoas.filter((p) => !presos.has(p.id));
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
 * A série do gráfico, resolvida pela ESCALA.
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
 * semana sem escala nenhuma. Não recebe `duplas`: quem decide é a escala, e
 * uma equipe desfeita continua explicando as semanas em que saiu.
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
