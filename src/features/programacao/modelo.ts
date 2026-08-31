// Programação da equipe de campo (R99/R100/R101 — U78) — a lógica pura, testável
// sem banco e sem React.
//
// A ATIVIDADE EM CAMPO É UM BLOCO DE AGENDA, NÃO O CHAMADO. A relação é 1:N por
// definição, e o caso que prova isso é o RETORNO: foi terça, faltou peça, volta
// quinta — dois blocos de tempo, um chamado só. Se a atividade FOSSE o chamado,
// "retorno" teria de virar valor novo em `chamados.status`, e aí encostaria em
// STATUS_ORDEM, statusDaNatureza, chamadoEmAberto, as cores, o kanban da Início,
// indicadores.ts e situacaoPrazo — sete lugares para representar uma segunda ida.
// Aqui "retorno" é DERIVADO da ordem dos blocos (ver `ordinalDoBloco`): zero
// coluna, zero estado a manter sincronizado, zero palavra nova no vocabulário.
//
// E há o caso que o chamado NÃO SABE representar de jeito nenhum: a OS que veio
// de fora do sistema. `chamados.cliente_id` é NOT NULL REFERENCES clientes(id)
// desde a etapa 3, então serviço para quem não está na base de clientes não cabe
// num chamado — mas ocupa a equipe igual, e a grade tem de mostrar isso ou ela
// mente sobre a semana. O bloco sem chamado é a única forma honesta.
//
// ── ESTE ARQUIVO É O GÊMEO DE UM ARQUIVO SQL, E ISSO É UM CONTRATO ─────────
// Cada função daqui que tem um par em `supabase/migrations/…_u78_…sql` está
// marcada com o nome do par. Elas têm de dizer a MESMA coisa, com as MESMAS
// palavras onde a saída é texto: o formulário mostra o que este arquivo escreve
// e o servidor é a última linha de defesa. Uma regra com duas redações é uma
// regra que o usuário aprende a não ler — e uma regra com dois COMPORTAMENTOS é
// um formulário que aceita o que a porta recusa (ou pior, o contrário).
//
// ── O QUE ESTE MÓDULO SE RECUSA A FAZER ────────────────────────────────────
// · Não conhece nomes. `erroDoAgendamento` recebe `rotuloDe` e `divergenciaDe`
//   devolve um código, não uma frase com nome de gente — é o mesmo contrato de
//   `erroDaEscala` (duplas/modelo.ts).
// · Não constrói `Date` a partir de string ISO com fuso, EXCETO em
//   `parDoInstante`, que é a ponte declarada (ver o comentário dela).
//   `new Date('2026-09-01')` é interpretado como UTC e, no Brasil, devolve
//   31/08 — o bug de um dia que só aparece de madrugada. Toda conversão de
//   'AAAA-MM-DD' passa por `dataDoDia`, que monta a data pelos componentes.
// · Não emite percentual quando o denominador é indefinido. `null` é a resposta
//   para "esta equipe não tem escala nesta semana", e `0` é a resposta para "tem
//   escala e nenhum bloco". São dois estados diferentes e a tela precisa dos dois
//   (o segundo é o selo "disponível"; o primeiro é uma pergunta ao gestor).
// · Não guarda estado de tela: colapso, aba aberta e teto de render são da tela.
//
// ── "NÃO SEI" NÃO É "NÃO TEM", E ESTE ARQUIVO PAGA POR ISSO EM TRÊS LUGARES ─
// `agenda_campo` é lida com `USING (true)` (a policy da U78) e `public.chamados`
// NÃO é. Logo, o join em memória — bloco -> chamado — falha por DUAS razões
// diferentes que chegam aqui como o mesmo `null`:
//   · o bloco não tem chamado (é OS de fora), e
//   · o bloco tem chamado que ESTE usuário não pode ler.
// Tratar as duas como "ausência" faz o atendimento alheio se apresentar como
// "Serviço fora do sistema" (categoria de gestão!) e faz o contador de
// divergência do cabeçalho MUDAR COM QUEM OLHA. Por isso existe
// `chamadoOculto()`, e por isso `divergenciaDeEquipe` devolve `null` — não uma
// divergência — quando não dá para saber.
//
// ── O VOCABULÁRIO, QUE JÁ TEM DUAS COLISÕES E NÃO PODE TER A TERCEIRA ──────
// · "equipe" sem adjetivo é DEPARTAMENTO (chamados.equipe, profiles.equipe,
//   src/lib/equipes.ts, desde a U71). A turma de campo é "equipe de campo", e no
//   banco a tabela é `public.duplas` com a escala em `public.duplas_escala`.
// · "modalidade" é cliente_contratos.modalidade. A "modalidade" da atividade do
//   Gestor OS é o nosso `chamados.tipo` — não existe coluna nova.
// · "bloco" no BANCO é bloco de ORÇAMENTO (public.blocos, blocos_itens,
//   projeto_blocos, visita_blocos, regras_blocos, src/lib/blocos.ts). Por isso a
//   tabela nova se chama `public.agenda_campo` e "bloco" é palavra de conversa e
//   de TypeScript, nunca nome de tabela.

import {
  composicaoDaDupla,
  duplaDaPessoaNaSemana,
  origemDaEscala,
  type Escala,
} from "@/features/duplas/modelo";
import { chamadoEmAberto } from "@/lib/chamado-status";
import { inicioSemana } from "@/lib/periodos";

// ── A JORNADA (R100), em números que a tela não recalcula ───────────────────
//
// A PRIMEIRA HORA NÃO É FOLGA: é carregar o carro, pegar peça, ver a ordem do
// dia. Ela pertence à JORNADA e não pertence ao CAMPO — e é exatamente por isso
// que são duas constantes, e que a base da ocupação é 480 e não 540. Somar a
// reserva à base faria toda equipe do sistema parecer 11% mais ociosa do que é,
// para sempre, e ninguém desconfiaria porque o número teria cara de medição.
//
// A ASSERÇÃO DESTES NÚMEROS É SOBRE OS LITERAIS, e isso é correção de um erro
// anterior: afirmar `CAMPO_MIN === JORNADA_MIN - RESERVA_MIN` é escrever a
// própria definição da linha de baixo (`x === x`), e uma asserção assim
// sobrevive a qualquer mutação dos três números ao mesmo tempo. Quem tem dentes
// é comparar com 540/60/480 escritos à mão, e comparar com os literais que a
// RPC usa (a migration checa `< 540` e `> 480` no corpo de
// `agenda_campo_marcar`).
export const JORNADA_INICIO_MIN = 8 * 60; // 480 — 08:00, a jornada começa
export const RESERVA_MIN = 60; // a primeira hora, reservada
export const CAMPO_ABRE_MIN = JORNADA_INICIO_MIN + RESERVA_MIN; // 540 — 09:00
export const JORNADA_MIN = 9 * 60; // 540 — porta a porta
export const CAMPO_MIN = JORNADA_MIN - RESERVA_MIN; // 480 — 8h de campo
/**
 * 17:00 — O EIXO DO DESENHO, E NÃO UM TETO. Nada neste arquivo e nada na
 * migration recusa um bloco que termine depois disto: o que existe é o teto de
 * 8h somadas e o corte na MEIA-NOITE (§2.1 da U78 diz isso com todas as
 * letras). A constante existe para a grade saber onde desenhar a última linha
 * do eixo do dia, e a asserção que a acompanha pina justamente o fato de ela
 * NÃO ser regra — um bloco das 16:00 com 8h é aceito.
 * GATILHO DE REVISÃO: se a Fase 2 não a consumir na tela, ela sai; constante
 * que só a asserção lê é decoração com cara de regra.
 */
export const CAMPO_FECHA_MIN = CAMPO_ABRE_MIN + CAMPO_MIN; // 1020 — 17:00
export const DIAS_DE_CAMPO = 5; // segunda a sexta
export const BASE_SEMANAL_MIN = CAMPO_MIN * DIAS_DE_CAMPO; // 2400
export const MINUTOS_DO_DIA = 24 * 60; // 1440

// ── As entradas: o MÍNIMO que o cálculo precisa, não a linha do banco ───────

/**
 * Um bloco de agenda. Espelha `public.agenda_campo`, e por isso usa snake_case
 * (mesmo contrato de `LinhaDeEscala`): quem lê do Supabase entrega a linha e
 * pronto, sem camada de tradução para divergir.
 *
 * O TEMPO É `(dia, inicio_min)` E NÃO UM INSTANTE, e isso é o coração do
 * desenho. `dia` é a data LOCAL como fato gravado, não como conversão: a U76
 * pagou caro pela armadilha inversa (domingo 22h em Brasília é 01h de SEGUNDA
 * em UTC, e cairia na semana seguinte). Com dia + minuto local, a grade, o
 * conflito, a jornada e a ocupação são aritmética de inteiros — nenhuma delas
 * pode errar de fuso, porque nenhuma delas conhece fuso. A ÚNICA que conhece é
 * `parDoInstante`, que é a ponte para a coluna espelhada e está isolada
 * justamente para poder ser conferida sozinha.
 */
export interface BlocoDeAgenda {
  id: string;
  /** null = OS que veio de fora do sistema (ver `titulo_externo`) */
  chamado_id: string | null;
  dupla_id: string;
  /** 'AAAA-MM-DD' em horário local — nunca um instante */
  dia: string;
  /** minutos desde 00:00 local do início do SERVIÇO (540 = 09:00) */
  inicio_min: number;
  servico_min: number;
  /** o tempo de estrada, que vem ANTES do serviço */
  deslocamento_min: number;
  cumprido_em: string | null;
  cancelado_em: string | null;
  os_externa: string | null;
  titulo_externo: string | null;
}

/**
 * O que o formulário tem antes de existir uma linha. `id` null = bloco novo.
 *
 * `chamado_id` e `titulo_externo` ESTÃO AQUI DE PROPÓSITO, e a ausência deles
 * era um defeito com nome: as duas isenções da jornada (R100) são FATOS DA
 * LINHA no banco — `v_urgente := (v_chamado IS NULL)` mais corretiva+urgente —
 * e enquanto o candidato não carregava o `chamado_id`, a isenção do lado do
 * formulário dependia de um booleano que quem chamasse decidia. Resultado
 * medido: uma OS de fora marcada para as 10h era recusada pelo formulário e
 * aceita pela RPC. Regra que o servidor deriva do dado e a tela deriva de um
 * parâmetro é uma regra com duas respostas.
 */
export interface BlocoCandidato {
  id: string | null;
  /** null = OS que veio de fora do sistema — e ISENTA da jornada (R100) */
  chamado_id: string | null;
  dupla_id: string;
  dia: string;
  inicio_min: number;
  servico_min: number;
  deslocamento_min: number;
  /** obrigatório quando não há chamado; gêmeo do CHECK agenda_campo_identificavel */
  titulo_externo: string | null;
}

/**
 * O mínimo que o cartão da grade precisa saber do chamado.
 *
 * `natureza` está aqui porque a faixa "agendado sem horário" (a barra de
 * progresso da migração) é a MESMA consulta do §9.7 da U78, e aquela consulta
 * filtra `natureza='campo' AND status NOT IN ('concluido','cancelado')`. Sem a
 * coluna, o gêmeo era INEXPRIMÍVEL — e a faixa nascia com o passado inteiro
 * dentro, com piso, ou seja: uma barra de progresso que nunca chega ao fim.
 */
export interface ChamadoParaGrade {
  id: string;
  numero: string | null;
  titulo: string | null;
  tipo: string | null;
  prioridade: string | null;
  status: string | null;
  natureza: string | null;
  responsavel_id: string | null;
  data_hora_agendada: string | null;
}

// ── Tempo: as conversões, num lugar só ──────────────────────────────────────

/**
 * 'AAAA-MM-DD' → Date LOCAL. Existe porque `new Date('2026-09-01')` é
 * interpretado como MEIA-NOITE UTC e, no Brasil, devolve 31/08 — o erro de um
 * dia que só aparece na leitura, nunca na escrita, e que portanto ninguém
 * associa à causa. Data inválida devolve `null` em vez de `Invalid Date`, para
 * quem chama ter de decidir o que fazer.
 */
export function dataDoDia(dia: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "09:00". Minuto do dia → relógio de parede.
 *
 * 1440 sai como "24:00", e isso é DELIBERADO: a janela do bloco é meia-aberta,
 * então 1440 é o FIM exato do dia (o único valor acima de 23:59 que este
 * relógio pode receber, porque `erroDoAgendamento` recusa qualquer fim maior).
 * "das 22:00 às 24:00" é a leitura certa de um bloco que encosta na meia-noite;
 * escrever "00:00" ali diria que o atendimento termina antes de começar.
 */
export function horaTexto(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * "1h30", "45min", "8h". Não reusa `horasTexto` de indicadores.ts de propósito:
 * aquela recebe HORAS e vira dias acima de 24 ("3d 4h"), o que não quer dizer
 * nada dentro de uma jornada.
 *
 * GÊMEO DE `public.duracao_texto(int)` (U78 §6.0), incluindo o travessão para
 * NULL. A função no banco existe para a frase da RPC e a frase do formulário
 * serem a MESMA frase; se as duas divergirem, o usuário vê "300 min" de um lado
 * e "5h" do outro para a mesma recusa.
 */
export function duracaoTexto(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  // negativo cai aqui e sai negativo, como no gêmeo SQL: a duração inválida é
  // recusada ANTES, e maquiar o número aqui esconderia o erro de quem chamou.
  if (m < 60) return `${m}min`;
  if (m % 60 === 0) return `${m / 60}h`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** O `—` de `horasTexto`: percentual indefinido não vira zero na tela. */
export function pctTexto(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

// ── A PONTE: o instante gravado → o par (dia, minuto local) ─────────────────

/** O fuso da operação. Aparece UMA vez aqui e UMA vez na U78 (§5, o espelho). */
export const FUSO_DA_OPERACAO = "America/Sao_Paulo";

const RELOGIO_DA_OPERACAO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DA_OPERACAO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * `chamados.data_hora_agendada` (um INSTANTE) → o par `(dia, inicio_min)` em
 * horário de Brasília. É a ÚNICA função deste arquivo que conhece fuso, e ela
 * existe porque sem ela a promessa do §2.1 da U78 ("nenhuma delas pode errar de
 * fuso, porque nenhuma delas conhece fuso") era verdade sobre o núcleo e
 * silêncio sobre a ponte — e a ponte é justamente o assunto.
 *
 * SEM ELA O GÊMEO DO ESPELHO NÃO PODIA SER COMPARADO COM A COLUNA. O gatilho
 * grava `(dia + inicio_min) AT TIME ZONE 'America/Sao_Paulo'`; esta função é o
 * caminho de volta, e é o que permite a asserção
 * `espelhoIgual(espelhoDoChamado(...), parDoInstante(c.data_hora_agendada))`
 * dizer, sem banco, que os dois lados concordam.
 *
 * `Intl` com `timeZone` explícito, e não `getHours()`: `getHours()` responde no
 * fuso do NAVEGADOR, e o técnico que abrir a grade de outro fuso (ou com o
 * relógio do sistema errado) veria o bloco andar de dia. O caso que prova o
 * ponto: 22:00 de uma terça em Brasília é 01:00 de QUARTA em UTC — ler pelo UTC
 * moveria o bloco de dia e, com ele, a semana ISO do apoio da U76.
 */
export function parDoInstante(
  iso: string | null | undefined,
): { dia: string; inicio_min: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const parte of RELOGIO_DA_OPERACAO.formatToParts(d)) p[parte.type] = parte.value;
  if (!p.year || !p.month || !p.day || !p.hour || !p.minute) return null;
  // `hour12: false` pode devolver "24" para a meia-noite em algumas versões de
  // ICU — o `% 24` é a defesa, e ela nunca muda o dia porque a meia-noite já
  // está no dia certo.
  const inicio_min = (Number(p.hour) % 24) * 60 + Number(p.minute);
  if (!Number.isFinite(inicio_min)) return null;
  return { dia: `${p.year}-${p.month}-${p.day}`, inicio_min };
}

// ── O bloco: janela, peso e os dois estados que não são o mesmo ─────────────

/**
 * A janela que o bloco OCUPA na equipe: `[início − deslocamento, início + serviço)`.
 *
 * O DESLOCAMENTO VEM ANTES DO SERVIÇO — você dirige e depois trabalha. Essa
 * escolha é o que faz a regra "a primeira atividade não começa antes de 09h +
 * deslocamento" cair como CONSEQUÊNCIA de `de >= CAMPO_ABRE_MIN`, em vez de
 * virar uma segunda regra que alguém esquece de aplicar num caminho.
 *
 * Meia-aberta: um bloco que termina às 11:00 e outro que começa às 11:00 não se
 * sobrepõem. É o gêmeo exato do `int4range(a, b)` da constraint de exclusão no
 * banco — um lugar só define a janela, e a asserção sem banco vale para o banco.
 */
export function janelaDoBloco(
  b: Pick<BlocoDeAgenda, "inicio_min" | "servico_min" | "deslocamento_min">,
): { de: number; ate: number } {
  return { de: b.inicio_min - b.deslocamento_min, ate: b.inicio_min + b.servico_min };
}

/**
 * Quanto o bloco consome da jornada. Estrada OCUPA a equipe: se o deslocamento
 * não contasse, um dia de quatro visitas espalhadas pela cidade apareceria como
 * meio dia livre, e a grade convidaria a marcar a quinta.
 */
export function minutosDoBloco(
  b: Pick<BlocoDeAgenda, "servico_min" | "deslocamento_min">,
): number {
  return b.servico_min + b.deslocamento_min;
}

/**
 * O bloco CONTA (grade, conflito, jornada, ocupação). Cancelar libera a agenda;
 * cumprir não — o dia mais produtivo da semana não pode aparecer como o mais
 * vazio, que é o defeito que a tela de hoje tem ao tirar concluído da lista.
 */
export function blocoVale(b: Pick<BlocoDeAgenda, "cancelado_em">): boolean {
  return b.cancelado_em === null;
}

/**
 * O bloco AINDA VAI ACONTECER. É a definição que o ESPELHO usa, e a única razão
 * de `cumprido_em` existir: com N blocos por chamado, `chamados.finalizada_em`
 * (que é um) não sabe dizer QUAL bloco aconteceu — e sem saber isso o espelho
 * fica pinado na terça para sempre, e o retorno da quinta some da tela em que o
 * técnico realmente vive (atividadesDeHoje compara só ano/mês/dia).
 */
export function blocoPendente(
  b: Pick<BlocoDeAgenda, "cancelado_em" | "cumprido_em">,
): boolean {
  return b.cancelado_em === null && b.cumprido_em === null;
}

/**
 * Ordem TOTAL dos blocos: dia, hora, id. O `id` no fim não é enfeite — sem ele
 * `ordinalDoBloco` seria NÃO-DETERMINÍSTICO quando dois blocos do mesmo chamado
 * começam no mesmo minuto, e "esta é a 2ª ida" trocaria de cartão a cada render.
 *
 * (A justificativa antiga citava o ESPELHO, e ela era falsa: o espelho devolve
 * `{dia, inicio_min}`, que é exatamente o que empata — trocar a ordem dos dois
 * empatados devolve o mesmo par. Onde o desempate é OBSERVÁVEL é no ordinal, e
 * é lá que a asserção vive agora.)
 *
 * Comparar uuid como TEXTO bate byte a byte com a ordem do Postgres: os hífens
 * estão em posição fixa em todo uuid (nunca são o ponto de diferença) e, entre
 * dígitos hexadecimais minúsculos, a ordem ASCII coincide com a ordem dos
 * nibbles. É o mesmo raciocínio que fez a U76 escolher COLLATE "C".
 */
export function comparaBlocos(a: BlocoDeAgenda, b: BlocoDeAgenda): number {
  if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
  if (a.inicio_min !== b.inicio_min) return a.inicio_min - b.inicio_min;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── O CONFLITO ──────────────────────────────────────────────────────────────

/** Duas janelas se cruzam. Cinco palavras que são o gêmeo do `&&` do Postgres. */
export function seSobrepoem(
  a: { de: number; ate: number },
  b: { de: number; ate: number },
): boolean {
  return a.de < b.ate && b.de < a.ate;
}

/**
 * O FILTRO ÚNICO "esta equipe, neste dia, o que conta". Existe como função
 * NOMEADA porque três lugares precisam exatamente dele — o conflito, a soma da
 * jornada e a célula da grade — e três cópias do mesmo `filter` divergem: é a
 * mesma doutrina de "quem conta é quem filtra" aplicada dentro de um arquivo
 * só. Antes desta função, `primeiroInicioPossivel` recebia "os blocos do dia"
 * sem dizer de QUEM, e somava a jornada de todas as equipes juntas se quem
 * chamasse passasse a lista inteira.
 */
export function blocosDaEquipeNoDia(
  duplaId: string,
  dia: string,
  blocos: BlocoDeAgenda[],
): BlocoDeAgenda[] {
  return blocos
    .filter((b) => b.dupla_id === duplaId && b.dia === dia && blocoVale(b))
    .sort(comparaBlocos);
}

/**
 * Os blocos da equipe naquele dia que colidem com o candidato — A LISTA, não um
 * booleano, e ordenada.
 *
 * Devolver a lista é o que permite ao formulário NOMEAR o conflito. Um booleano
 * obrigaria a tela a procurar de novo quem é, e aí a tela estaria calculando —
 * que é exatamente o defeito de `VisitaForm.tsx:177-183`, onde a heurística de
 * ±60 minutos (uma duração fixa implícita, escrita como `60 * 60 * 1000` solto
 * dentro do .tsx, sem uma única asserção) produz o texto "Possível conflito de
 * horário", que não diz com o quê.
 *
 * Ignora o próprio `id`: mover um bloco não colide consigo mesmo, e esse é o bug
 * clássico deste tipo de tela.
 */
export function conflitosDoBloco(
  cand: BlocoCandidato,
  blocosDoDia: BlocoDeAgenda[],
): BlocoDeAgenda[] {
  const j = janelaDoBloco(cand);
  return blocosDaEquipeNoDia(cand.dupla_id, cand.dia, blocosDoDia).filter(
    (b) => b.id !== cand.id && seSobrepoem(j, janelaDoBloco(b)),
  );
}

/**
 * O conflito que a constraint do banco NÃO consegue pegar: a PESSOA marcada em
 * duas equipes ao mesmo tempo.
 *
 * A exclusão no banco é por `dupla_id`, e tem de ser — não se declara EXCLUDE
 * sobre uma derivação que mora em outra tabela, e a escala é mutável (remanejar
 * a semana passada faria o banco passar a considerar inválido um dado já
 * gravado). Então o eixo PESSOA vive aqui, como aviso de formulário: se o
 * responsável está na Equipe A naquela semana e alguém marcou um bloco dele na
 * Equipe B no mesmo horário, ninguém no banco reclama e a grade mostra duas
 * linhas ocupadas por um homem só.
 */
export function conflitosDaPessoa(
  pessoaId: string | null,
  cand: BlocoCandidato,
  blocosDoDia: BlocoDeAgenda[],
  semana: string,
  escala: Escala,
): BlocoDeAgenda[] {
  if (!pessoaId) return [];
  const j = janelaDoBloco(cand);
  const daPessoa = duplaDaPessoaNaSemana(pessoaId, semana, escala);
  if (!daPessoa) return [];
  return blocosDaEquipeNoDia(daPessoa, cand.dia, blocosDoDia)
    .filter((b) => b.id !== cand.id && b.dupla_id !== cand.dupla_id && seSobrepoem(j, janelaDoBloco(b)));
}

// ── A JORNADA DO DIA ────────────────────────────────────────────────────────

export interface JornadaDoDia {
  servicoMin: number;
  deslocamentoMin: number;
  ocupadoMin: number;
  excedenteMin: number;
  /** o minuto em que a equipe sai de casa, ou null se o dia está vazio */
  primeiraSaidaMin: number | null;
  ultimoFimMin: number | null;
}

/**
 * Soma `minutosDoBloco`, e NÃO `max(fim) − min(início)`. O buraco entre um
 * serviço das 09h e outro das 16h é ocioso de verdade; contá-lo faria um dia de
 * dois atendimentos parecer cheio e a grade recusaria o terceiro.
 */
export function jornadaDoDia(blocosDoDia: BlocoDeAgenda[]): JornadaDoDia {
  const vale = blocosDoDia.filter(blocoVale);
  const servicoMin = vale.reduce((s, b) => s + b.servico_min, 0);
  const deslocamentoMin = vale.reduce((s, b) => s + b.deslocamento_min, 0);
  const ocupadoMin = servicoMin + deslocamentoMin;
  const janelas = vale.map(janelaDoBloco);
  return {
    servicoMin,
    deslocamentoMin,
    ocupadoMin,
    excedenteMin: Math.max(0, ocupadoMin - CAMPO_MIN),
    primeiraSaidaMin: janelas.length ? Math.min(...janelas.map((j) => j.de)) : null,
    ultimoFimMin: janelas.length ? Math.max(...janelas.map((j) => j.ate)) : null,
  };
}

/**
 * O valor com que o formulário abre preenchido: a equipe sai às 09h, ou logo
 * depois do último compromisso, sempre descontando a estrada.
 *
 * DEVOLVE `null` QUANDO O DIA NÃO COMPORTA MAIS NADA, e isso é conserto de um
 * defeito medido: num dia com 8h já marcadas a função devolvia 17:00 e
 * `erroDoAgendamento` recusava 17:00 no instante seguinte — o formulário abria
 * com um valor que ele mesmo rejeitava, e o usuário tinha de descobrir sozinho
 * que o problema não era a hora. `null` é a tela dizendo "este dia está cheio"
 * antes de a pessoa digitar.
 *
 * A conta do `null` é EXATAMENTE a complementar da recusa da jornada: se sobra
 * pelo menos 1 minuto de serviço dentro das 8h, a função devolve um início; se
 * ela devolve um início, existe uma duração que `erroDoAgendamento` aceita.
 */
export function primeiroInicioPossivel(
  duplaId: string,
  dia: string,
  blocos: BlocoDeAgenda[],
  deslocamentoMin: number,
): number | null {
  const d = Math.max(0, deslocamentoMin);
  const j = jornadaDoDia(blocosDaEquipeNoDia(duplaId, dia, blocos));
  const base = j.ultimoFimMin === null ? CAMPO_ABRE_MIN : Math.max(CAMPO_ABRE_MIN, j.ultimoFimMin);
  const inicio = base + d;
  if (inicio >= MINUTOS_DO_DIA) return null; // física: não cabe mais no dia
  if (j.ocupadoMin + d >= CAMPO_MIN) return null; // política: não sobra 1 min de serviço
  return inicio;
}

/**
 * "Emergencial" NÃO é tipo novo (Davi, 2026-08-31): é corretiva com prioridade
 * urgente. Isto aqui é a decisão virando código carregado em vez de decorativo
 * — sem esta função, "emergencial" viraria um valor novo em `chamados.tipo` e a
 * decisão do Davi seria só uma frase no chip.
 */
export function ehEmergencial(
  c: Pick<ChamadoParaGrade, "tipo" | "prioridade"> | null | undefined,
): boolean {
  return !!c && c.tipo === "corretiva" && c.prioridade === "urgente";
}

/**
 * AS DUAS ISENÇÕES DA JORNADA (R100), e as duas são FATOS DA LINHA — nunca um
 * booleano que alguém marca. Gêmeo do passo 4 de `agenda_campo_marcar`:
 *
 *     v_urgente := (v_chamado IS NULL);
 *     IF v_chamado IS NOT NULL THEN
 *       SELECT (c.tipo = 'corretiva' AND c.prioridade = 'urgente') INTO v_urgente …
 *
 *   · bloco SEM chamado — serviço fora do sistema só gestor marca, e ele é, por
 *     definição, a categoria "isto não estava no plano";
 *   · corretiva + urgente — o urgente é o único que estoura a jornada porque é
 *     para isso que ele existe.
 *
 * SÃO DUAS, e a R100 (docs/PRODUTO.md) ainda diz "a única exceção". A
 * discordância está anotada dentro do §6.1 da U78 e no diário: quem manda é a
 * R100, e o texto numerado precisa ganhar a segunda por escrito — ou o SQL
 * perdê-la. Enquanto isso, os dois lados do código dizem a mesma coisa, que é o
 * que impede o formulário e a porta de discordarem.
 *
 * Chamado que não veio (invisível para este usuário, ou apagado entre a tela e
 * o clique) NÃO isenta: a RPC faz `COALESCE(v_urgente, false)` pelo mesmo
 * motivo. Errar para o lado de aplicar a jornada é errar para o lado seguro.
 */
export function isentoDaJornada(
  chamadoId: string | null,
  chamado: Pick<ChamadoParaGrade, "tipo" | "prioridade"> | null | undefined,
): boolean {
  if (chamadoId === null) return true;
  return ehEmergencial(chamado);
}

// ── O ERRO, em português, nomeando o obstáculo ──────────────────────────────

/**
 * TUDO OBRIGATÓRIO, e isso é conserto de um defeito de forma. `semana` e
 * `escala` eram opcionais, e sem eles o eixo PESSOA — a única regra desta tela
 * que o BANCO não pega — devolvia `null` calado onde havia conflito. Esquecer
 * dois parâmetros na tela apagaria a regra inteira, e nem o `tsc` nem o
 * verificador notariam. Opção que desliga uma regra em silêncio não é opção.
 */
export interface ContextoDoAgendamento {
  /** todos os blocos daquele dia (de todas as equipes) */
  blocosDoDia: BlocoDeAgenda[];
  /**
   * O chamado de `cand.chamado_id` — ou `null` quando não há chamado, e também
   * quando este usuário não pode lê-lo. Os dois casos caem no lado seguro
   * (jornada aplicada, eixo pessoa não avaliado).
   */
  chamado: ChamadoParaGrade | null;
  semana: string;
  escala: Escala;
  /** o modelo puro não conhece nomes — ele os pede */
  rotuloDe: (b: BlocoDeAgenda) => string;
}

/**
 * A mensagem do PRIMEIRO problema, já em português e com o obstáculo nomeado,
 * ou `null`. Molde de `erroDaEscala` (duplas/modelo.ts): a mensagem é o produto,
 * não um código, e o texto vai para uma área de erro DENTRO do formulário — não
 * para um toast solto, que é o que a programação de hoje faz.
 *
 * A ORDEM É A REGRA, e ela é A MESMA de `agenda_campo_marcar` (U78 §6.1),
 * passo a passo — antes a RPC checava a jornada ANTES do conflito, e um bloco
 * que violasse as duas recebia do formulário a frase específica e do servidor a
 * agregada: a mesma regra falando duas línguas.
 *   1. forma       — equipe/dia/hora, duração, deslocamento
 *   2. física      — o dia tem 1440 minutos e a estrada vem antes
 *   3. identidade  — bloco sem chamado precisa de título
 *   4. conflito    — específico e acionável: "a equipe já está em X às Y"
 *   5. pessoa      — só aqui (não existe no banco: a EXCLUDE é por equipe)
 *   6. saída       — política: a equipe só sai às 09h
 *   7. jornada     — política: 8h de campo é o teto
 * Os itens 6 e 7 são pulados pelas isenções (`isentoDaJornada`). Os itens 1 a 5
 * nunca são: eles não são política, e nenhuma urgência põe a mesma equipe em
 * dois prédios.
 *
 * AS FRASES SÃO AS DA RPC, palavra por palavra. Mudar uma aqui sem mudar a
 * outra faz o usuário ver dois textos para a mesma recusa dependendo de a
 * validação ter passado no cliente ou no servidor.
 */
export function erroDoAgendamento(
  cand: BlocoCandidato,
  ctx: ContextoDoAgendamento,
): string | null {
  // ── 1. forma ────────────────────────────────────────────────────────────
  if (!cand.dupla_id || !cand.dia || !Number.isFinite(cand.inicio_min)) {
    return "Diga a equipe, o dia e a hora do atendimento.";
  }
  // Só do lado de cá: no banco o tipo `date` já garante o formato.
  if (!dataDoDia(cand.dia)) {
    return `Data fora do formato AAAA-MM-DD: ${cand.dia}.`;
  }
  if (!Number.isFinite(cand.servico_min) || cand.servico_min <= 0) {
    return "Diga quanto tempo o atendimento deve durar.";
  }
  if (!Number.isFinite(cand.deslocamento_min) || cand.deslocamento_min < 0) {
    return "O tempo de deslocamento não pode ser negativo.";
  }

  // ── 2. física ───────────────────────────────────────────────────────────
  if (cand.inicio_min < 0 || cand.inicio_min > MINUTOS_DO_DIA - 1) {
    return "A hora do atendimento tem de estar dentro do dia.";
  }
  const j = janelaDoBloco(cand);
  if (j.de < 0) {
    return `Começando ${horaTexto(cand.inicio_min)} com ${duracaoTexto(cand.deslocamento_min)} de deslocamento, a equipe teria de sair no dia anterior.`;
  }
  if (j.ate > MINUTOS_DO_DIA) {
    return `Começando ${horaTexto(cand.inicio_min)} e durando ${duracaoTexto(cand.servico_min)}, o atendimento passaria da meia-noite.`;
  }

  // ── 3. identidade ───────────────────────────────────────────────────────
  if (!cand.chamado_id && !(cand.titulo_externo ?? "").trim()) {
    return "Um bloco sem chamado precisa de um título — diga o que é este serviço.";
  }

  // O chamado que o contexto trouxe só vale se for o do candidato. Um contexto
  // desencontrado (a tela trocou de cartão e esqueceu de trocar o chamado) tem
  // de cair no lado seguro, e não isentar a jornada por engano.
  const doCandidato =
    ctx.chamado && ctx.chamado.id === cand.chamado_id ? ctx.chamado : null;

  // ── 4. conflito de EQUIPE ───────────────────────────────────────────────
  const colide = conflitosDoBloco(cand, ctx.blocosDoDia);
  if (colide.length > 0) {
    const o = colide[0];
    const jo = janelaDoBloco(o);
    return `Esta equipe já está em "${ctx.rotuloDe(o)}" das ${horaTexto(jo.de)} às ${horaTexto(jo.ate)} nesse dia.`;
  }

  // ── 5. conflito de PESSOA (não existe no banco) ─────────────────────────
  const pessoa = conflitosDaPessoa(
    doCandidato?.responsavel_id ?? null,
    cand,
    ctx.blocosDoDia,
    ctx.semana,
    ctx.escala,
  );
  if (pessoa.length > 0) {
    const o = pessoa[0];
    const jo = janelaDoBloco(o);
    return `O responsável já está em "${ctx.rotuloDe(o)}" com a equipe dele das ${horaTexto(jo.de)} às ${horaTexto(jo.ate)} nesse dia.`;
  }

  if (isentoDaJornada(cand.chamado_id, doCandidato)) return null;

  // ── 6. a saída ──────────────────────────────────────────────────────────
  if (j.de < CAMPO_ABRE_MIN) {
    return `A equipe só sai às ${horaTexto(CAMPO_ABRE_MIN)} — com ${duracaoTexto(cand.deslocamento_min)} de deslocamento o atendimento não pode começar antes das ${horaTexto(CAMPO_ABRE_MIN + cand.deslocamento_min)}.`;
  }

  // ── 7. a jornada ────────────────────────────────────────────────────────
  const doDia = blocosDaEquipeNoDia(cand.dupla_id, cand.dia, ctx.blocosDoDia).filter(
    (b) => b.id !== cand.id,
  );
  const ja = jornadaDoDia(doDia).ocupadoMin;
  const total = ja + minutosDoBloco(cand);
  if (total > CAMPO_MIN) {
    return `A equipe já tem ${duracaoTexto(ja)} marcados nesse dia; com este atendimento (${duracaoTexto(cand.servico_min)} + ${duracaoTexto(cand.deslocamento_min)} de deslocamento) passaria das ${duracaoTexto(CAMPO_MIN)} de campo.`;
  }

  return null;
}

/**
 * O gêmeo da recusa de `agenda_campo_cancelar` (U78 §6.2): bloco CUMPRIDO é
 * registro, não agenda. Desmarcá-lo tiraria da ocupação de uma semana PASSADA a
 * visita que aconteceu — o chip do histórico mudaria para trás e o dia mais
 * produtivo viraria o mais vazio.
 *
 * Existe para a tela não oferecer um botão que o servidor vai recusar, e a
 * frase é a mesma para o usuário não ver dois textos.
 */
export function erroDoCancelamento(
  b: Pick<BlocoDeAgenda, "cumprido_em">,
): string | null {
  if (b.cumprido_em !== null) {
    return 'Este atendimento já está marcado como feito — desmarcá-lo apagaria o registro de que ele aconteceu. Se ele NÃO aconteceu, tire o "feito" do bloco primeiro e desmarque depois.';
  }
  return null;
}

// ── O CONTRATO DAS PORTAS: como um erro do banco vira reação na tela ────────

/**
 * As três classes de erro que as RPCs do §6 devolvem. O cliente reage pelo
 * CÓDIGO e mostra a MENSAGEM: a mensagem já vem pronta em português (é o
 * argumento inteiro do §6.0 da U78), então a tela nunca deve reescrevê-la.
 *   · 42501 — permissão: "peça a quem responde"; o gesto não vai acontecer.
 *   · 55000 — regra ou forma: dá para corrigir no próprio formulário.
 *   · 23P01 — exclusion_violation: outra pessoa marcou no meio; recarregar a
 *     grade é o certo, porque o estado que a tela mostra já está velho.
 */
export const CLASSE_DO_ERRO: Record<string, "permissao" | "regra" | "conflito"> = {
  "42501": "permissao",
  "55000": "regra",
  "23P01": "conflito",
};

export function classeDoErro(codigo: string | null | undefined): "permissao" | "regra" | "conflito" | "desconhecido" {
  return CLASSE_DO_ERRO[codigo ?? ""] ?? "desconhecido";
}

// ── A OCUPAÇÃO ──────────────────────────────────────────────────────────────

export interface OcupacaoDaSemana {
  minutos: number;
  base: number;
  /** null = a equipe não tem escala nesta semana (denominador indefinido) */
  pct: number | null;
  /** tem escala e nenhum bloco: o selo "disponível" */
  disponivel: boolean;
  comEscala: boolean;
  /** os ids que produziram o número — quem conta é quem filtra */
  blocos: string[];
}

/**
 * A BASE ÚNICA da semana de uma equipe. É o `chamadosDoKpi` desta entrega: o
 * chip de ocupação e a lista que o clique nele abre saem DAQUI, e não de dois
 * filtros parecidos que divergem em três meses.
 */
export function blocosDaEquipeNaSemana(
  duplaId: string,
  semana: string,
  blocos: BlocoDeAgenda[],
  chaveDaSemana: (d: Date) => string,
): BlocoDeAgenda[] {
  return blocos
    .filter((b) => {
      if (b.dupla_id !== duplaId || !blocoVale(b)) return false;
      const d = dataDoDia(b.dia);
      return d !== null && chaveDaSemana(d) === semana;
    })
    .sort(comparaBlocos);
}

/**
 * Ocupação da equipe na semana, sobre a base de 8h × 5 dias.
 *
 * OS DOIS ZEROS SÃO DIFERENTES, e separá-los é a única forma de a regra
 * "ocupação de equipe vazia é 0 e não divide por zero" fechar:
 *   · sem escala na semana → `pct: null`, `base: 0`. É `semanaVigente`
 *     devolvendo null: "não sei" ≠ "ninguém". E `minutos` continua contado,
 *     porque bloco que existe não pode sumir do total (a doutrina do balde nulo
 *     de `abertosPorCliente`, indicadores.ts).
 *   · com escala e sem bloco → `pct: 0`, `disponivel: true`. É o selo.
 *
 * A fórmula é a do único percentual do sistema (`pctNoPrazo`, indicadores.ts):
 * `Math.round(n / den * 100)`, `null` quando o denominador é zero. Nunca
 * `|| 0`, nunca `Math.max(1, den)`.
 *
 * A BASE É POR EQUIPE, e não por pessoa: a equipe sai JUNTA, no mesmo carro (é
 * a razão de existir de `duplas.veiculo`), então três pessoas não fazem três
 * serviços simultâneos. O chip mede o tempo do CARRO. Equipe de três aparecer
 * com a mesma capacidade de uma de dois é a leitura correta, e vai gerar a
 * pergunta — o `title` do chip tem de responder antes que alguém pergunte.
 *
 * Pode passar de 100%, e NÃO É CAPADO: 112% quer dizer que trabalharam no
 * sábado, e capar é o gráfico escondendo trabalho. (A asserção que dizia isso
 * usava uma fixture de 35% — nomeava a regra sem exercitá-la, e `Math.min(100,
 * …)` sobrevivia a ela. Agora a fixture passa de 100 de verdade.)
 */
export function ocupacaoDaSemana(
  duplaId: string,
  semana: string,
  blocos: BlocoDeAgenda[],
  escala: Escala,
  chaveDaSemana: (d: Date) => string,
): OcupacaoDaSemana {
  const meus = blocosDaEquipeNaSemana(duplaId, semana, blocos, chaveDaSemana);
  const minutos = meus.reduce((s, b) => s + minutosDoBloco(b), 0);
  const comEscala = composicaoDaDupla(duplaId, semana, escala).length > 0;
  const base = comEscala ? BASE_SEMANAL_MIN : 0;
  return {
    minutos,
    base,
    pct: base > 0 ? Math.round((minutos / base) * 100) : null,
    disponivel: comEscala && meus.length === 0,
    comEscala,
    blocos: meus.map((b) => b.id),
  };
}

/** Ocupação de UM dia, sobre 8h. O denominador é constante e nunca é zero. */
export function ocupacaoDoDia(blocosDoDia: BlocoDeAgenda[]): {
  minutos: number;
  pct: number;
} {
  const minutos = jornadaDoDia(blocosDoDia).ocupadoMin;
  return { minutos, pct: Math.round((minutos / CAMPO_MIN) * 100) };
}

// ── O RETORNO, DERIVADO ─────────────────────────────────────────────────────

/**
 * Que ida é esta: 1 é a visita, 2 em diante é RETORNO. Derivado da ordem dos
 * blocos ativos do chamado, sem coluna e sem valor novo em `chamados.status` —
 * é o argumento inteiro do satélite virado função de quatro linhas.
 *
 * Bloco sem chamado é sempre o primeiro de si mesmo: "retorno de OS de fora"
 * não é uma pergunta que este sistema saiba responder, e fingir que sabe seria
 * pior que dizer 1.
 */
export function ordinalDoBloco(bloco: BlocoDeAgenda, blocosDoChamado: BlocoDeAgenda[]): number {
  if (!bloco.chamado_id) return 1;
  const irmaos = blocosDoChamado
    .filter((b) => b.chamado_id === bloco.chamado_id && blocoVale(b))
    .sort(comparaBlocos);
  const i = irmaos.findIndex((b) => b.id === bloco.id);
  return i < 0 ? 1 : i + 1;
}

export function blocoEhRetorno(bloco: BlocoDeAgenda, blocosDoChamado: BlocoDeAgenda[]): boolean {
  return ordinalDoBloco(bloco, blocosDoChamado) > 1;
}

// ── O GÊMEO PURO DO ESPELHO ─────────────────────────────────────────────────

/**
 * QUAL bloco vira `chamados.data_hora_agendada`. Esta é a função que permite
 * travar o gatilho do banco por asserção sem subir banco, e por isso ela tem de
 * ser lida ao lado do corpo de `public.agenda_campo_espelhar(uuid)` na U78: as
 * duas dizem a MESMA coisa, e se um dia divergirem o espelho apodrece em
 * silêncio, que é o pior fim possível para uma coluna lida em doze arquivos.
 *
 * RECEBE O `chamadoId` E FILTRA POR ELE. A versão anterior recebia só uma lista
 * e confiava em quem chamasse tê-la filtrado — e a função que existe PARA SER O
 * GÊMEO do gatilho era a única do arquivo que não filtrava, enquanto
 * `ordinalDoBloco` filtrava e o SQL filtrava (`WHERE a.chamado_id = _chamado`).
 * Medido: com a lista da grade inteira, o espelho de um chamado saía do bloco
 * de OUTRO chamado, mais cedo no mesmo dia.
 *
 * A REGRA, EM DOIS ESTÁGIOS:
 *   1. o bloco PENDENTE mais antigo (não cancelado, não cumprido);
 *   2. se todos já foram cumpridos, o ÚLTIMO deles.
 * O estágio 2 não é enfeite: zerar aí faria o chamado que ainda está aberto
 * (esperando peça, digamos) perder a data no PDF (relatorio.ts imprime
 * "Agendamento") e sair do calendário, por ter sido atendido. E é o estágio 1
 * que faz o RETORNO aparecer na quinta-feira em que ele acontece — sem ele o
 * espelho fica pinado na terça e `atividadesDeHoje` (que compara só ano/mês/dia)
 * aponta para o dia errado justamente na tela em que o técnico vive.
 *
 * Devolve o PAR `(dia, minuto local)` e NÃO um instante, de propósito:
 * `new Date(iso)` resolve no fuso do NAVEGADOR e o gatilho resolve em
 * `America/Sao_Paulo`. O caminho de volta é `parDoInstante`, e é comparando os
 * dois pares que a asserção prova a igualdade sem banco.
 *
 * Cancelado nunca conta: `null` aqui é o espelho voltando a NULL, e é por isso
 * que a U78 precisou de uma guarda nova dentro de `chamado_apoio_da_dupla()`.
 */
export function espelhoDoChamado(
  chamadoId: string,
  blocos: BlocoDeAgenda[],
): { dia: string; inicio_min: number } | null {
  const vale = blocos
    .filter((b) => b.chamado_id === chamadoId && blocoVale(b))
    .sort(comparaBlocos);
  if (vale.length === 0) return null;
  const pendentes = vale.filter(blocoPendente);
  const escolhido = pendentes.length > 0 ? pendentes[0] : vale[vale.length - 1];
  return { dia: escolhido.dia, inicio_min: escolhido.inicio_min };
}

/**
 * O que o espelho já vale HOJE para um chamado, lido da coluna. Serve para a
 * tela comparar sem refazer a conta, e para a asserção provar que o par
 * calculado e o gravado são o mesmo instante.
 */
export function espelhoIgual(
  espelho: { dia: string; inicio_min: number } | null,
  outro: { dia: string; inicio_min: number } | null,
): boolean {
  if (espelho === null || outro === null) return espelho === outro;
  return espelho.dia === outro.dia && espelho.inicio_min === outro.inicio_min;
}

/**
 * O espelho gravado bate com os blocos? É a versão de UMA LINHA da consulta
 * "quem não casou" do §9.8 da U78 — a que tem de vir vazia e que, daqui a um
 * mês, divergir é NOTÍCIA (quer dizer que alguém escreveu
 * `chamados.data_hora_agendada` de um chamado de campo por fora do satélite; as
 * três telas antigas ainda sabem fazer isso — ver PENDENCIAS_TECNICAS).
 */
export function espelhoConfere(
  chamado: Pick<ChamadoParaGrade, "id" | "data_hora_agendada">,
  blocos: BlocoDeAgenda[],
): boolean {
  return espelhoIgual(
    espelhoDoChamado(chamado.id, blocos),
    parDoInstante(chamado.data_hora_agendada),
  );
}

// ── O PATCH MÍNIMO: o `IS DISTINCT FROM` do lado do TypeScript ──────────────

/** Os campos que a tela edita num bloco. */
export interface BlocoEditavel {
  chamado_id: string | null;
  dupla_id: string;
  dia: string;
  inicio_min: number;
  servico_min: number;
  deslocamento_min: number;
  os_externa: string | null;
  titulo_externo: string | null;
}

/**
 * Só o que MUDOU. É o `IS DISTINCT FROM` antes da ida ao banco: sem ele, salvar
 * um formulário sem mexer em nada custa um round-trip, um `updated_at` novo e um
 * evento de realtime (debounce de 1200 ms) em toda aba aberta do sistema.
 *
 * `undefined` NO DESEJADO É "NÃO SEI", NUNCA "MUDOU PARA NADA", e essa linha é
 * conserto de um defeito medido. Um `select('col_a,col_b')` do Supabase entrega
 * `undefined` para toda coluna que ninguém pediu; com o `!==` cru,
 * `{chamado_id: undefined}` entrava no patch, `JSON.stringify` do patch
 * continuava `{}` (asserção nenhuma pegaria) e `mexeNoEspelho` devolvia `true`
 * — uma ida ao banco, e uma escrita de `chamado_id` para `undefined`, por causa
 * de um SELECT parcial. `null` continua sendo um VALOR (bloco sem chamado é
 * `chamado_id: null`), e continua entrando.
 *
 * O `WHERE ... IS DISTINCT FROM` do espelho continua existindo no banco e
 * continua sendo obrigatório — este é a primeira barreira, não a única.
 */
export function patchDoBloco(
  atual: BlocoEditavel,
  desejado: BlocoEditavel,
): Partial<BlocoEditavel> {
  const patch: Partial<BlocoEditavel> = {};
  for (const k of Object.keys(desejado) as (keyof BlocoEditavel)[]) {
    if (desejado[k] === undefined) continue;
    if (atual[k] !== desejado[k]) (patch as Record<string, unknown>)[k] = desejado[k];
  }
  return patch;
}

/**
 * O que a PORTA DO BANCO não sabe fazer com este patch, em português.
 *
 * `agenda_campo_marcar` virou PATCH e não REPLACE: `NULL` num parâmetro quer
 * dizer "não mexi", nunca "apague". Isso conserta a perda de dado (arrastar um
 * cartão de OS de fora sem repassar o título apagava o ÚNICO registro daquele
 * serviço) e cria, declaradamente, duas coisas que a porta deixou de saber
 * fazer. A tela precisa saber ANTES de mandar, senão o usuário clica, nada
 * acontece e ninguém explica.
 */
export function patchImpossivel(patch: Partial<BlocoEditavel>): string | null {
  if ("chamado_id" in patch && patch.chamado_id === null) {
    return 'Para tirar o atendimento da agenda, use "tirar da agenda" — mover o bloco não o desliga do chamado.';
  }
  if ("os_externa" in patch && patch.os_externa === null) {
    return "Para limpar o número da OS de fora, escreva o número novo — a agenda não apaga por omissão.";
  }
  if ("titulo_externo" in patch && patch.titulo_externo === null) {
    return "Um bloco sem chamado precisa de um título — diga o que é este serviço.";
  }
  return null;
}

/**
 * Este patch pode mexer no espelho? É a INTERSEÇÃO entre a lista `AFTER UPDATE
 * OF` do gatilho `trg_agenda_campo_espelho_upd` e o que ESTE formulário edita.
 *
 * A lista do gatilho tem cinco colunas; esta tem três, e a diferença NÃO é
 * esquecimento: `cumprido_em` e `cancelado_em` também acordam o espelho, mas
 * elas não passam pelo formulário de edição — quem as escreve são
 * `agenda_campo_cumprir` e `agenda_campo_cancelar`, cada uma com o seu próprio
 * ato nomeado. Pôr as duas em `BlocoEditavel` seria dar ao formulário um
 * caminho para carimbar "feito" por engano.
 *
 * A lista do gatilho é curta DE PROPÓSITO: mexer em `servico_min`,
 * `deslocamento_min`, `dupla_id`, `os_externa` ou `titulo_externo` não pode
 * escrever em `public.chamados` — nem para gravar o mesmo valor. `AFTER UPDATE
 * OF` dispara pela PRESENÇA da coluna no SET, mesmo com valor igual (a própria
 * U76 registra isso), então a lista curta é a PRIMEIRA defesa, antes do
 * `IS DISTINCT FROM`.
 */
export const COLUNAS_DO_ESPELHO: (keyof BlocoEditavel)[] = ["chamado_id", "dia", "inicio_min"];

export function mexeNoEspelho(patch: Partial<BlocoEditavel>): boolean {
  return COLUNAS_DO_ESPELHO.some((k) => patch[k] !== undefined);
}

// ── OS BALDES, exaustivos ───────────────────────────────────────────────────

export type ClasseDoChamado = "com_bloco" | "sem_horario" | "sem_data" | "fora_da_programacao";

/**
 * QUEM A GRADE PROGRAMA. Gêmeo do WHERE do §9.7 da U78:
 * `natureza='campo' AND status NOT IN ('concluido','cancelado')`.
 *
 * `chamadoEmAberto` é a fonte única desse "não encerrado" (chamado-status.ts) —
 * reescrever a lista aqui seria criar a segunda verdade sobre o que é um
 * chamado vivo.
 */
export function naProgramacao(
  c: Pick<ChamadoParaGrade, "natureza" | "status">,
): boolean {
  return c.natureza === "campo" && chamadoEmAberto(c.status);
}

/**
 * Função TOTAL sobre baldes disjuntos e exaustivos, no idioma de
 * `colunaDaAtividade` ("nunca descarta um item em silêncio").
 *
 * Hoje a programação tem DOIS baldes (tem data / não tem data) e não sobra lugar
 * para o terceiro: um chamado com data e sem bloco cairia na agenda do dia como
 * um cartão normal, sem nada indicando que ninguém marcou hora.
 *
 * O QUARTO BALDE — `fora_da_programacao` — é conserto de um defeito medido: sem
 * ele, um chamado CONCLUÍDO com data e sem bloco respondia `sem_horario`, ou
 * seja, a tela ofereceria "dar horário" a trabalho que já acabou, e a barra de
 * progresso da migração nasceria com o passado inteiro dentro e com PISO (o
 * passado não anda). Ele vem PRIMEIRO porque escopo vence estado: encerrado é
 * encerrado mesmo com bloco ativo, e comercial nunca foi desta tela (a agenda
 * comercial é da visita técnica, U41).
 *
 * E "sem horário" NÃO pode ser `hora == null`: `data_hora_agendada` nunca é nula
 * quando tem data, e a base de produção tem 12:00 SENTINELA (a programação de
 * hoje escreve `T12:00:00` literal) misturado com 12:00 DE VERDADE
 * (novo-campo, PainelChamado), indistinguíveis por valor. O único predicado
 * honesto é "tem data e não tem bloco".
 */
export function classificarChamado(
  c: Pick<ChamadoParaGrade, "data_hora_agendada" | "natureza" | "status">,
  temBlocoAtivo: boolean,
): ClasseDoChamado {
  if (!naProgramacao(c)) return "fora_da_programacao";
  if (temBlocoAtivo) return "com_bloco";
  return c.data_hora_agendada ? "sem_horario" : "sem_data";
}

/**
 * A faixa "agendado sem horário": chamado de campo AINDA ABERTO, com data e
 * nenhum bloco. A contagem dela É a barra de progresso da migração — a U78 não
 * semeia bloco nenhum, de propósito, e esta lista é o que sobra para alguém dar
 * horário com um clique. É o gêmeo exato da linha 701 da conferência da U78.
 */
export function semHorario(
  chamados: ChamadoParaGrade[],
  blocos: BlocoDeAgenda[],
): ChamadoParaGrade[] {
  const comBloco = new Set(
    blocos.filter((b) => blocoVale(b) && b.chamado_id).map((b) => b.chamado_id as string),
  );
  return chamados.filter((c) => classificarChamado(c, comBloco.has(c.id)) === "sem_horario");
}

// ── A DIVERGÊNCIA: mostra, não conserta ─────────────────────────────────────

export type Divergencia = "sem_responsavel" | "sem_escala" | "fora_da_equipe" | null;

/**
 * O bloco tem chamado e o chamado não veio: ou não existe (nunca acontece, é
 * FK) ou ESTE usuário não pode lê-lo. `agenda_campo` é `USING (true)` e
 * `public.chamados` não é — o join em memória falha por permissão, não por
 * ausência.
 */
export function chamadoOculto(
  bloco: Pick<BlocoDeAgenda, "chamado_id">,
  chamado: { id: string } | null | undefined,
): boolean {
  return bloco.chamado_id !== null && !chamado;
}

/**
 * O bloco diz Equipe B, o chamado diz Breno, e a escala da semana diz que o
 * Breno está na Equipe A. Isto ACONTECE e não tem conserto automático: a RPC
 * impede o nascimento da divergência, mas MUDAR A ESCALA DEPOIS a recria sem
 * tocar em bloco nenhum — e a U76 proíbe consertar sozinho (escrita de cadastro
 * não reescreve registro, e reescrever traria dezenas de sinos por uma edição de
 * escala).
 *
 * RECEBE O CHAMADO, E NÃO O `responsavelId`, porque só assim ela consegue
 * separar "o responsável não está nesta equipe" de "eu não sei quem é o
 * responsável". Sem essa separação, medido: o contador do cabeçalho dava
 * `[1,0,0,1]` para o gestor e `[3,1,0,1]` para quem não enxerga os chamados —
 * o mesmo número, na mesma tela, mudando com quem olha, e a mais alta das duas
 * leituras era a ERRADA (`chamado?.responsavel_id ?? null` virava
 * "sem_responsavel", que é uma acusação).
 *
 * "Não sei" devolve `null`. Quem quiser mostrar o quanto não sabe conta os
 * `oculto` da linha — e a grade conta (ver `LinhaDaGrade.ocultos`).
 *
 * Então sobra mostrar. E divergência que só se mostra é divergência que se
 * aprende a ignorar — foi assim com "Possível conflito de horário" no
 * VisitaForm. Por isso a contagem vai para o CABEÇALHO da semana (um número no
 * topo é constrangedor) e não para dentro do card (um ícone entre trinta é
 * decoração).
 */
export function divergenciaDeEquipe(
  bloco: Pick<BlocoDeAgenda, "dupla_id" | "chamado_id">,
  chamado: Pick<ChamadoParaGrade, "id" | "responsavel_id"> | null,
  semana: string,
  escala: Escala,
): Divergencia {
  if (!bloco.chamado_id) return null; // OS de fora: não há responsável a comparar
  // "não sei" nunca é "está errado". Aqui `!chamado` É `chamadoOculto(bloco,
  // chamado)`, porque o caso "bloco sem chamado" já saiu na linha acima.
  if (!chamado) return null;
  if (!chamado.responsavel_id) return "sem_responsavel";
  const daPessoa = duplaDaPessoaNaSemana(chamado.responsavel_id, semana, escala);
  if (!daPessoa) return "sem_escala";
  return daPessoa === bloco.dupla_id ? null : "fora_da_equipe";
}

// ── A GRADE ─────────────────────────────────────────────────────────────────

export interface ItemDaGrade {
  bloco: BlocoDeAgenda;
  chamado: ChamadoParaGrade | null;
  /** "CH-123 · Troca de câmera", o título da OS de fora, ou "Outro atendimento" */
  rotulo: string;
  de: number;
  ate: number;
  ordinal: number;
  retorno: boolean;
  emergencial: boolean;
  /** o bloco tem chamado que este usuário não pode ler */
  oculto: boolean;
  divergencia: Divergencia;
}

export interface CelulaDaGrade {
  duplaId: string;
  dia: string;
  semana: string;
  itens: ItemDaGrade[];
  jornada: JornadaDoDia;
  ocupacao: { minutos: number; pct: number };
  comEscala: boolean;
  /** tem escala na semana e nada marcado neste dia */
  disponivel: boolean;
}

export interface LinhaDaGrade {
  duplaId: string;
  semana: string;
  celulas: CelulaDaGrade[];
  ocupacao: OcupacaoDaSemana;
  herdada: boolean;
  semanaOrigem: string | null;
  divergencias: number;
  /** quantos blocos NÃO deu para avaliar (chamado invisível) — o "não sei" */
  ocultos: number;
}

/**
 * O rótulo de um bloco. Sai do chamado quando há chamado; do `titulo_externo`
 * quando não há. É o texto que `erroDoAgendamento` recebe por `rotuloDe`, e é a
 * única string de exibição que este módulo monta — porque ela é derivada de qual
 * das duas origens o bloco tem, e isso é regra, não formatação.
 *
 * O TERCEIRO CASO É O QUE FALTAVA: bloco COM chamado e sem chamado carregado.
 * Ele caía no ramo de baixo e se apresentava como "Serviço fora do sistema" —
 * uma CATEGORIA DE GESTÃO (só gestor marca serviço de fora) posta em cima do
 * atendimento alheio que o técnico não pode ler. "Outro atendimento" são as
 * mesmas palavras que `agenda_campo_frase_do_conflito` usa no servidor quando
 * `pode_editar_chamado` diz não; os dois lados escondem a mesma coisa com o
 * mesmo nome, e o HORÁRIO continua aparecendo, que é o que permite remarcar sem
 * descobrir o parque de chamados dos outros.
 */
export function rotuloDoBloco(bloco: BlocoDeAgenda, chamado: ChamadoParaGrade | null): string {
  if (chamado) {
    const n = (chamado.numero ?? "").trim();
    const t = (chamado.titulo ?? "").trim();
    if (n && t) return `${n} · ${t}`;
    return n || t || "Chamado sem título";
  }
  if (chamadoOculto(bloco, chamado)) return "Outro atendimento";
  const t = (bloco.titulo_externo ?? "").trim();
  const os = (bloco.os_externa ?? "").trim();
  if (t && os) return `${os} · ${t}`;
  return t || os || "Serviço fora do sistema";
}

/**
 * O ÁTOMO. Uma equipe, um dia. Tudo o mais neste arquivo é composição disto —
 * inclusive a grade da semana e a lista do celular, que é a razão de o átomo
 * existir: as duas telas não podem calcular coisas parecidas.
 *
 * `itens` já vem ordenado e JÁ VEM COM O CHAMADO JUNTO, para a tela não fazer
 * lookup nenhum.
 */
export function celulaDaGrade(
  duplaId: string,
  dia: string,
  semana: string,
  blocos: BlocoDeAgenda[],
  chamados: ChamadoParaGrade[],
  escala: Escala,
): CelulaDaGrade {
  const porId = new Map(chamados.map((c) => [c.id, c]));
  const doDia = blocosDaEquipeNoDia(duplaId, dia, blocos);

  const itens: ItemDaGrade[] = doDia.map((b) => {
    const chamado = b.chamado_id ? porId.get(b.chamado_id) ?? null : null;
    const j = janelaDoBloco(b);
    const ordinal = ordinalDoBloco(b, blocos);
    return {
      bloco: b,
      chamado,
      rotulo: rotuloDoBloco(b, chamado),
      de: j.de,
      ate: j.ate,
      ordinal,
      retorno: ordinal > 1,
      emergencial: ehEmergencial(chamado),
      oculto: chamadoOculto(b, chamado),
      divergencia: divergenciaDeEquipe(b, chamado, semana, escala),
    };
  });
  itens.sort((a, b) => a.de - b.de || comparaBlocos(a.bloco, b.bloco));

  const comEscala = composicaoDaDupla(duplaId, semana, escala).length > 0;
  return {
    duplaId,
    dia,
    semana,
    itens,
    jornada: jornadaDoDia(doDia),
    ocupacao: ocupacaoDoDia(doDia),
    comEscala,
    disponivel: comEscala && itens.length === 0,
  };
}

/**
 * As colunas da grade: segunda a sexta SEMPRE; sábado e domingo só quando há
 * algo ATIVO marcado neles (bloco cancelado não abre coluna — desmarcar libera
 * a agenda, e uma coluna de sábado vazia por causa de um cancelamento seria a
 * grade lembrando de um trabalho que não vai acontecer).
 *
 * NORMALIZA PARA A SEGUNDA. A versão anterior recebia um `Date` chamado
 * `segunda` e acreditava: `diasDaGrade(quarta, …)` devolvia
 * `[qua, qui, sex, sáb, dom]` como "os cinco dias úteis" e depois testava
 * segunda e terça DA SEMANA SEGUINTE como se fossem o fim de semana. Um
 * pressuposto sem guarda vira defeito na primeira chamada distraída, e a tela
 * vai chamar isto com "hoje" mais cedo ou mais tarde. `inicioSemana` é a mesma
 * função ISO que o resto do sistema usa (lib/periodos.ts) — não uma segunda
 * cópia da regra.
 *
 * `chaveDoDia` continua injetada (a tela passa `dataIso`) porque é ela que
 * torna a asserção capaz de provar que a grade usa a MESMA chave que o resto do
 * sistema, sem este módulo reimplementá-la.
 */
export function diasDaGrade(
  dataDaSemana: Date,
  blocos: BlocoDeAgenda[],
  chaveDoDia: (d: Date) => string,
): string[] {
  const segunda = inicioSemana(dataDaSemana);
  const dias: string[] = [];
  for (let i = 0; i < DIAS_DE_CAMPO; i++) {
    const d = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
    dias.push(chaveDoDia(d));
  }
  for (let i = DIAS_DE_CAMPO; i < 7; i++) {
    const d = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
    const iso = chaveDoDia(d);
    if (blocos.some((b) => b.dia === iso && blocoVale(b))) dias.push(iso);
  }
  return dias;
}

/**
 * As linhas da grade. Uma por equipe COM ESCALA na semana, na ordem em que
 * `duplas` chega (que vem ordenada por nome, para a linha não trocar de lugar a
 * cada render) — MAIS uma linha para toda equipe que tem bloco na semana e não
 * tem escala, MAIS uma para toda equipe que tem bloco e nem está na lista
 * `duplas` (apagada do cadastro, ou filtrada por `ativa`).
 *
 * A segunda metade é a doutrina do balde nulo de `abertosPorCliente`: o que
 * existe não pode sumir do total. E ela conserta um defeito VIVO — hoje
 * `porGrupo` engole o chamado cujo responsável não está na escala e não tem
 * `cargo='tecnico'`, e a tela mostra "3 atendimentos no dia" com "Nada
 * programado neste dia" logo abaixo.
 *
 * `semana` e `dias` são parâmetros SEPARADOS de propósito: a ocupação e a escala
 * são sempre da SEMANA (o chip do celular diz "68% da semana", não "68% de
 * hoje"), e só as colunas mudam. É isso que torna a tela do celular literalmente
 * uma coluna da grade do desktop, verificável por igualdade. O preço dessa
 * separação é que `semana` e `dias` PODEM discordar, e quem cobra isso é
 * `blocosForaDaGrade` — pelos DOIS lados.
 */
export function linhasDaGrade(
  duplas: { id: string }[],
  semana: string,
  dias: string[],
  blocos: BlocoDeAgenda[],
  chamados: ChamadoParaGrade[],
  escala: Escala,
  chaveDaSemana: (d: Date) => string,
): LinhaDaGrade[] {
  const daSemana = blocos.filter((b) => {
    if (!blocoVale(b)) return false;
    const d = dataDoDia(b.dia);
    return d !== null && chaveDaSemana(d) === semana;
  });

  const ordem = duplas.map((d) => d.id);
  const comEscala = ordem.filter((id) => composicaoDaDupla(id, semana, escala).length > 0);
  const escaladas = new Set(comEscala);
  const orfas = ordem.filter((id) => !escaladas.has(id) && daSemana.some((b) => b.dupla_id === id));
  const desconhecidas = [
    ...new Set(daSemana.map((b) => b.dupla_id).filter((id) => !ordem.includes(id))),
  ];

  const origem = origemDaEscala(semana, escala);
  return [...comEscala, ...orfas, ...desconhecidas].map((duplaId) => {
    const celulas = dias.map((dia) =>
      celulaDaGrade(duplaId, dia, semana, blocos, chamados, escala),
    );
    return {
      duplaId,
      semana,
      celulas,
      ocupacao: ocupacaoDaSemana(duplaId, semana, blocos, escala, chaveDaSemana),
      herdada: origem.herdada,
      semanaOrigem: origem.semanaOrigem,
      divergencias: celulas.reduce(
        (s, c) => s + c.itens.filter((i) => i.divergencia !== null).length,
        0,
      ),
      ocultos: celulas.reduce((s, c) => s + c.itens.filter((i) => i.oculto).length, 0),
    };
  });
}

/**
 * O GUARDA DOS DOIS LADOS. Tem de ser SEMPRE `{naoMostrados: 0, foraDaSemana: 0}`:
 * é "quem conta é quem filtra" aplicado à grade, e o par da asserção que impede
 * a tela de mostrar um número no cabeçalho que a lista abaixo não contém.
 *
 *   · `naoMostrados` — bloco ATIVO da semana que não aparece em célula nenhuma.
 *     O chip conta e a grade esconde.
 *   · `foraDaSemana` — bloco DESENHADO numa célula que não pertence à semana do
 *     chip. A grade mostra e o chip não conta.
 *
 * O segundo lado faltava, e a falta reconstruía exatamente o defeito que este
 * arquivo dizia ter consertado. Medido: com `semana` de uma semana e `dias` de
 * outra, a linha saía com `ocupacao.pct = 0`, `disponivel = true` e DOIS
 * cartões desenhados embaixo — "0%, disponível" com trabalho à vista — e o
 * guarda de uma mão só devolvia zero, aprovando.
 */
export function blocosForaDaGrade(
  linhas: LinhaDaGrade[],
  semana: string,
  blocos: BlocoDeAgenda[],
  chaveDaSemana: (d: Date) => string,
): { naoMostrados: number; foraDaSemana: number } {
  const mostrados = new Set<string>();
  for (const l of linhas) for (const c of l.celulas) for (const i of c.itens) mostrados.add(i.bloco.id);
  const daSemana = blocos.filter((b) => {
    if (!blocoVale(b)) return false;
    const d = dataDoDia(b.dia);
    return d !== null && chaveDaSemana(d) === semana;
  });
  const idsDaSemana = new Set(daSemana.map((b) => b.id));
  return {
    naoMostrados: daSemana.filter((b) => !mostrados.has(b.id)).length,
    foraDaSemana: [...mostrados].filter((id) => !idsDaSemana.has(id)).length,
  };
}
