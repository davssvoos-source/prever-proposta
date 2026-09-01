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
// ── AS QUATRO PORTAS ESTÃO FECHADAS ATÉ A TELA EXISTIR ─────────────────────
// `agenda_campo_marcar`, `agenda_campo_cancelar`, `agenda_campo_cumprir` e
// `desagendar_chamado` são concedidas SÓ a `service_role` na U78 — a migration
// diz por quê ("aditiva quer dizer inerte"): porta sem consumidor concedida a
// todo mundo é só superfície de ataque, e `desagendar_chamado` apaga
// `data_hora_agendada` de um chamado de campo com UMA requisição. Enquanto a
// migration da TELA não rodar os quatro GRANT que a U78 deixou prontos no
// rodapé, todo `supabase.rpc(...)` para elas volta 42501.
// Este arquivo continua valendo — ele é o que o formulário vai usar quando a
// porta abrir —, mas a CAMADA DE DADOS não pode subir antes daquela migration.
// `PORTAS_DA_AGENDA` existe para essa lista ter um lugar só, e a asserção que a
// acompanha lê os GRANT do arquivo SQL.
//
// ── O QUE O FORMULÁRIO SABE ANTES DE CLICAR, E O QUE ELE NÃO PODE SABER ────
// As portas recusam por PAPEL e por VÍNCULO (`is_gestor`, `pode_editar_chamado`,
// a escala da semana). Nada disso é derivável daqui: são funções do banco. Então
// a tela INJETA o resultado delas em `AutorizacaoDaAgenda`, do mesmo jeito que
// injeta `rotuloDe` — o modelo puro antecipa a recusa, com a frase da RPC,
// palavra por palavra, e nunca a substitui: quem autoriza é o servidor.
// Mentir aqui não compra nada, porque o gesto morre do outro lado assim mesmo;
// o que se perde é o usuário entender POR QUE ele morreu.
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
 *
 * `cumprido_em` NÃO ENTROU AQUI, e a ausência é decisão. "Este atendimento já
 * aconteceu" é fato da LINHA VIVA, nunca do que o formulário deseja: pôr o campo
 * no candidato daria à tela um jeito de afirmar que o bloco não foi feito para
 * poder movê-lo — e a RPC lê a linha, não o gesto. Quem carrega esse fato é
 * `ContextoDoAgendamento.blocoAtual`, o gêmeo do `SELECT … FOR UPDATE` do passo
 * 1a de `agenda_campo_marcar`.
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
 * A SEMANA DE UM DIA, e não a semana que alguém disse. Existe porque a escala é
 * semanal e o gesto é diário: `dupla_da_pessoa(auth.uid(), v_dia)` na RPC olha a
 * semana DO DIA DE DESTINO, e um contexto que carregasse "a semana da grade"
 * consultaria a escala errada no gesto que empurra um bloco para a semana
 * seguinte — justamente o gesto em que a resposta muda.
 *
 * `chaveDaSemana` continua injetada (a tela passa `referenciaSemanal`) porque é
 * ela que faz a asserção provar que esta grade usa a MESMA chave ISO do resto do
 * sistema, sem este módulo reimplementá-la. Dia impossível devolve `null`, e
 * quem chama decide — aqui isso quer dizer "erro de forma, não de permissão".
 */
export function semanaDoDia(dia: string, chaveDaSemana: (d: Date) => string): string | null {
  const d = dataDoDia(dia);
  return d === null ? null : chaveDaSemana(d);
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
 * O cartão PODE SER ARRASTADO. Bloco com "feito" não se move: a RPC recusa
 * mudar dia, hora, equipe ou chamado de um bloco cumprido (§6.1, passo 2), e uma
 * grade que deixa arrastar o que o servidor vai devolver é uma grade que ensina
 * o usuário a desconfiar do arrasto.
 *
 * É um PREDICADO e não o erro: o erro nomeia o que mudou e é `erroDeMover`. Este
 * aqui é a afordância — cursor, `draggable`, o cadeado no canto do card — e por
 * isso ele viaja dentro de `ItemDaGrade`, resolvido, junto com `retorno` e
 * `emergencial`.
 */
export function blocoSeMove(b: Pick<BlocoDeAgenda, "cumprido_em">): boolean {
  return b.cumprido_em === null;
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

// ── QUEM ESTÁ OLHANDO: o gate das portas, do lado de cá ─────────────────────

/**
 * O que o modelo puro precisa saber sobre QUEM faz o gesto. Ele não descobre
 * nada disso sozinho: `is_gestor` e `pode_editar_chamado` são funções do banco,
 * e a tela injeta o resultado delas — o mesmo contrato de `rotuloDe`.
 *
 * `usuarioId` NULO É "NÃO HÁ SESSÃO", E O GATE INTEIRO PASSA. É o espelho exato
 * do `IF auth.uid() IS NOT NULL THEN` do §6.1: na migration e no SQL Editor não
 * há JWT, e ali gate nenhum faz sentido. Numa tela isso não acontece — sem
 * sessão a chamada morre antes, no GRANT —, e é por isso que a direção escolhida
 * aqui não é perigosa: mentir para si mesmo não abre porta nenhuma do outro
 * lado, só faz o usuário descobrir a recusa depois de clicar.
 *
 * `podeEditarChamado` É O `pode_editar_chamado(uuid)` DEPOIS DA S2, e a S2 muda
 * o que este gate significa: até ela, qualquer autenticado se gravava como apoio
 * de qualquer chamado (`POST /chamado_apoios`) e o predicado era auto-emissível
 * — um formulário de auto-atendimento com cara de autorização. Agora o apoio só
 * conta quando é `origem='dupla'` (escrita do gatilho da escala, que ninguém
 * forja) ou quando quem gravou não é a própria pessoa. `is_gestor` está dentro
 * dele, então gestor passa em todos os ramos que o consultam.
 */
export interface AutorizacaoDaAgenda {
  /** `auth.uid()`. `null` = não há sessão (SQL Editor, migration, teste) */
  usuarioId: string | null;
  /** `public.is_gestor(auth.uid())` */
  ehGestor: boolean;
  /** `public.pode_editar_chamado(uuid)` */
  podeEditarChamado: (chamadoId: string) => boolean;
}

/**
 * O MÍNIMO que o gêmeo local de `pode_editar_chamado` precisa ler do chamado.
 * São as DUAS colunas da segunda perna do predicado da S2, e as duas já vêm na
 * consulta de chamados (`CAMPOS`, features/chamados/data.ts) — nenhuma consulta
 * nova nasce por causa disto.
 */
export interface ChamadoParaAutorizacao {
  id: string;
  responsavel_id: string | null;
  aberto_por: string | null;
}

/**
 * O APOIO CONTA COMO VÍNCULO? É a TERCEIRA PERNA de `pode_editar_chamado`
 * depois da S2, e ela mora aqui — no modelo puro — por um motivo que um teste de
 * mutação provou: enquanto ela era um `.filter()` dentro da consulta, quebrá-la
 * (trocar a condição inteira por `true`) deixava o verificador VERDE. Regra de
 * autorização escondida numa cláusula de consulta é regra que ninguém pode
 * exercitar sem banco.
 *
 * Gêmeo literal de `s2:131-142`:
 *   `a.origem = 'dupla' OR a.criado_por IS DISTINCT FROM a.profile_id`
 *
 *   · `origem='dupla'` é escrita do gatilho da escala — ninguém a forja, porque
 *     ela é derivada de `duplas_escala`;
 *   · `criado_por IS DISTINCT FROM profile_id` quer dizer "ALGUÉM PÔS esta
 *     pessoa". Pôr-se a si mesmo como apoio não pode virar direito de edição —
 *     era um formulário de auto-atendimento com cara de autorização, e é o
 *     defeito exato que a S2 fechou.
 *   · `criado_por` NULO são as linhas anteriores à S2, e elas CONTINUAM
 *     concedendo: `null !== <id>` é verdadeiro, que é o `IS DISTINCT FROM`
 *     fazendo o que a S2 escreveu.
 */
export function apoioValeComoVinculo(
  a: { origem: string | null; criado_por: string | null; profile_id: string },
): boolean {
  return a.origem === "dupla" || a.criado_por !== a.profile_id;
}

/**
 * O CONSTRUTOR do `AutorizacaoDaAgenda`, e ele é AFORDÂNCIA — nunca
 * autorização. Quem autoriza é o servidor: as portas do §6 chamam
 * `pode_editar_chamado` de dentro, em SECURITY DEFINER, e a resposta delas é a
 * que vale. Isto aqui existe para o cartão que o usuário NÃO pode mexer não
 * parecer arrastável, e para a frase da recusa chegar antes do clique.
 *
 * É UM GÊMEO LOCAL, E DIGO ISSO EM VOZ ALTA. O predicado é o corpo de
 * `public.pode_editar_chamado(uuid)` depois da S2 (:131-142), com as três
 * pernas na mesma ordem:
 *   1. `is_gestor(auth.uid())` — injetada, porque é função do banco;
 *   2. `c.responsavel_id = auth.uid() OR c.aberto_por = auth.uid()`;
 *   3. apoio VÁLIDO: `origem='dupla'` (escrita do gatilho da escala, que
 *      ninguém forja) OU `criado_por IS DISTINCT FROM profile_id` (alguém
 *      PÔS a pessoa; pôr-se a si mesmo não vira direito de edição). O
 *      `criado_por IS NULL` das linhas anteriores à S2 continua concedendo, e
 *      isso é `IS DISTINCT FROM` fazendo o que a S2 escreveu.
 *
 * A ALTERNATIVA RECUSADA: `supabase.rpc('pode_editar_chamado')` por cartão. Uma
 * semana de 40 blocos são 40 requisições por render, e `erroDoCancelamento` e
 * `erroDaBaixa` consultam o predicado para CADA cartão (guardam os botões
 * "Feito" e "Desmarcar"). Um N+1 de HTTP para desenhar afordância é o tipo de
 * coisa que ninguém mede até a grade travar no celular.
 *
 * CHAMADO FORA DA LISTA CARREGADA DEVOLVE `false`, e é a direção segura: o
 * cartão fica somente-leitura, o usuário clica, e a porta responde. Errar para
 * o lado de mostrar um cadeado a mais é infinitamente melhor do que errar para
 * o lado de prometer um gesto que morre do outro lado.
 */
export function montarAutorizacao(
  usuarioId: string | null,
  ehGestor: boolean,
  chamados: ChamadoParaAutorizacao[],
  apoiosValidos: Iterable<string>,
): AutorizacaoDaAgenda {
  const apoio = new Set(apoiosValidos);
  const meus = new Set<string>();
  if (usuarioId) {
    for (const c of chamados) {
      if (c.responsavel_id === usuarioId || c.aberto_por === usuarioId) meus.add(c.id);
    }
  }
  return {
    usuarioId,
    ehGestor,
    podeEditarChamado: (chamadoId: string) =>
      ehGestor || meus.has(chamadoId) || apoio.has(chamadoId),
  };
}

/**
 * O VÍNCULO COM O BLOCO, que as três portas simples cobram igual: com chamado,
 * quem responde por ele; sem chamado, quem responde pela operação. O verbo muda
 * porque a frase da RPC muda — "mexe em", "desmarca", "dá baixa em" —, e são as
 * palavras dela, não uma paráfrase.
 *
 * Uma função só para as três porque a regra é uma só: três cópias divergem, e a
 * primeira a divergir foi `agenda_campo_cumprir`, que ficou sem o braço de
 * gestor até a revisão da U78 achar a assimetria.
 *
 * `agenda_campo_marcar` NÃO usa esta função: lá o gestor passa por cima de tudo
 * (`IF NOT v_gestor`), a recusa de serviço de fora olha os DOIS lados do gesto e
 * ainda há a escala. Ver `erroDeAutorizacao`.
 */
function erroDoVinculo(
  chamadoId: string | null,
  autz: AutorizacaoDaAgenda,
  verbo: "mexe em" | "desmarca" | "dá baixa em",
): string | null {
  if (!autz.usuarioId) return null;
  if (chamadoId === null) {
    return autz.ehGestor
      ? null
      : `Só quem responde pela operação ${verbo} serviço fora do sistema.`;
  }
  return autz.podeEditarChamado(chamadoId)
    ? null
    : "Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.";
}

// ── O ERRO, em português, nomeando o obstáculo ──────────────────────────────

/**
 * TUDO OBRIGATÓRIO, e isso é conserto de um defeito de forma. `semana` e
 * `escala` eram opcionais, e sem eles o eixo PESSOA — a única regra desta tela
 * que o BANCO não pega — devolvia `null` calado onde havia conflito. Esquecer
 * dois parâmetros na tela apagaria a regra inteira, e nem o `tsc` nem o
 * verificador notariam. Opção que desliga uma regra em silêncio não é opção.
 *
 * `semana` SAIU E VIROU `chaveDaSemana`. Ela era um valor recebido, e um valor
 * recebido pode discordar do gesto: a escala que manda é a da semana do DIA DE
 * DESTINO (é o que `dupla_da_pessoa(auth.uid(), v_dia)` consulta na RPC), e
 * empurrar um bloco para a semana seguinte com "a semana da grade" no contexto
 * consultaria a escala errada exatamente no gesto em que a resposta muda. Agora
 * a semana é DERIVADA de `cand.dia`, e o contexto não tem como discordar dele.
 */
export interface ContextoDoAgendamento {
  /** todos os blocos daquele dia (de todas as equipes) */
  blocosDoDia: BlocoDeAgenda[];
  /**
   * A LINHA VIVA que este gesto vai reescrever (`cand.id` não nulo), ou `null`
   * quando é bloco novo. É o gêmeo do `SELECT … FOR UPDATE` do passo 1a de
   * `agenda_campo_marcar`, e ele existe porque a porta autoriza e recusa sobre o
   * ESTADO, não sobre os argumentos: quem manda no bloco que SAI, e o "feito"
   * que impede mover. Um `cand.id` sem `blocoAtual` é contexto desencontrado, e
   * cai na mesma frase que a RPC dá quando o `SELECT` não acha a linha.
   */
  blocoAtual: BlocoDeAgenda | null;
  /**
   * O chamado de `cand.chamado_id` — ou `null` quando não há chamado, e também
   * quando este usuário não pode lê-lo. Os dois casos caem no lado seguro
   * (jornada aplicada, eixo pessoa não avaliado).
   */
  chamado: ChamadoParaGrade | null;
  escala: Escala;
  /** a chave ISO da semana (a tela passa `referenciaSemanal`) */
  chaveDaSemana: (d: Date) => string;
  /** o modelo puro não conhece nomes — ele os pede */
  rotuloDe: (b: BlocoDeAgenda) => string;
  /** quem está fazendo o gesto, e o que o banco responde sobre ele */
  autz: AutorizacaoDaAgenda;
}

/** A linha viva DESTE gesto — contexto desencontrado não vale como linha. */
function atualDoGesto(cand: BlocoCandidato, ctx: ContextoDoAgendamento): BlocoDeAgenda | null {
  return ctx.blocoAtual && ctx.blocoAtual.id === cand.id ? ctx.blocoAtual : null;
}

/**
 * O GATE DE `agenda_campo_marcar` (§6.1, passo 1c), inteiro e na ordem dele:
 *
 *     is_gestor  OU  (pode editar o que SAI  E  pode editar o que ENTRA
 *                     E  dupla_da_pessoa(auth.uid(), dia) = a equipe de destino)
 *
 * Cada camada fecha um caminho que as outras deixam abertas, e a de ESCALA é a
 * que faltava por inteiro: sem ela a função nunca olhava para a equipe, e quem
 * respondesse por um chamado qualquer ocupava a terça-feira de QUALQUER time.
 *
 * A CONSEQUÊNCIA PARA A TELA, dita aqui porque ela é de desenho e não de
 * validação: para quem não é gestor, a grade é SOMENTE LEITURA fora da linha da
 * própria equipe. O cartão que ele não pode mover não deve nem parecer
 * arrastável — o erro é a última defesa, não a primeira.
 *
 * A ESCALA SÓ É CONFERIDA COM DIA E EQUIPE PRESENTES, e o motivo é o mesmo que
 * a RPC escreve: com o dia em branco a comparação diria "você não está na escala
 * desta equipe", uma recusa de AUTORIZAÇÃO para um erro de FORMA — mandando o
 * gestor procurar permissão onde falta um campo. Quem dá a frase certa é o passo
 * de forma, logo adiante, e nada é gravado entre um e outro.
 */
export function erroDeAutorizacao(
  cand: BlocoCandidato,
  ctx: ContextoDoAgendamento,
): string | null {
  const autz = ctx.autz;
  if (!autz.usuarioId || autz.ehGestor) return null;
  const atual = atualDoGesto(cand, ctx);

  // (i) serviço fora do sistema, dos DOIS lados: o que está lá e o que vai
  //     ficar. Um PATCH que mantém `chamado_id` nulo é mexer num bloco de
  //     gestão tanto quanto criar um — e olhando só o destino, ele escapava.
  if (cand.chamado_id === null || (cand.id !== null && atual !== null && atual.chamado_id === null)) {
    return "Só quem responde pela operação mexe em serviço fora do sistema.";
  }
  // (ii) o chamado que SAI. Sem esta camada, quem abre um chamado bobo arrasta
  //      para ele o bloco de um chamado que não pode nem ler, e o espelho
  //      escreve NULL na data do chamado roubado, sem sino nenhum.
  if (atual !== null && atual.chamado_id !== null && !autz.podeEditarChamado(atual.chamado_id)) {
    return "Este horário é de um atendimento pelo qual você não responde. Peça a quem responde por ele, ou à gestão.";
  }
  // (iii) o chamado que ENTRA
  if (!autz.podeEditarChamado(cand.chamado_id)) {
    return "Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.";
  }
  // (iv) a ESCALA da equipe de DESTINO, na semana do dia de destino. Sem escala
  //      recusa junto com "outra equipe", e é o certo: quem não está escalado
  //      não ocupa agenda de campo nenhuma.
  const semana = cand.dia ? semanaDoDia(cand.dia, ctx.chaveDaSemana) : null;
  if (semana !== null && cand.dupla_id) {
    if (duplaDaPessoaNaSemana(autz.usuarioId, semana, ctx.escala) !== cand.dupla_id) {
      return "Você não está na escala desta equipe nesta semana — quem programa a agenda de outra equipe é a gestão.";
    }
  }
  return null;
}

/**
 * O QUE JÁ ACONTECEU NÃO SE MOVE (§6.1, passo 2). `cumprido_em` preenchido é a
 * afirmação "a equipe esteve no prédio nesse dia, nesse horário"; mover o bloco
 * reescreve a ocupação de uma semana PASSADA (o chip do histórico muda para
 * trás) e, pelo estágio 2 do espelho, manda `data_hora_agendada` para um dia em
 * que ninguém esteve.
 *
 * A RECUSA É ESTREITA DE PROPÓSITO: dia, hora, equipe e chamado são a afirmação
 * sobre QUANDO e COM QUEM. DURAÇÃO e DESLOCAMENTO continuam editáveis — eles são
 * MEDIÇÃO do que houve ("levou três horas, não uma"), e proibir a correção
 * obrigaria a apagar o bloco para consertar um número.
 */
export function erroDeMover(
  atual: Pick<BlocoDeAgenda, "cumprido_em" | "dia" | "inicio_min" | "dupla_id" | "chamado_id">,
  desejado: Pick<BlocoCandidato, "dia" | "inicio_min" | "dupla_id" | "chamado_id">,
): string | null {
  if (blocoSeMove(atual)) return null;
  const mudouOQuando =
    atual.dia !== desejado.dia ||
    atual.inicio_min !== desejado.inicio_min ||
    atual.dupla_id !== desejado.dupla_id ||
    atual.chamado_id !== desejado.chamado_id;
  if (!mudouOQuando) return null;
  return 'Este atendimento já está marcado como feito — mudar o dia, a hora, a equipe ou o chamado dele reescreveria o registro de que ele aconteceu. Se ele NÃO aconteceu assim, tire o "feito" do bloco primeiro. A duração e o deslocamento você pode corrigir sem tirar.';
}

/**
 * COMO SE CHAMA O ATENDIMENTO QUE ESTE USUÁRIO NÃO PODE LER. É a mesma palavra
 * do servidor (`agenda_campo_frase_do_conflito` devolve `'outro atendimento'`
 * quando `pode_editar_chamado` diz não), em duas caixas, porque ela aparece em
 * dois lugares gramaticalmente diferentes: sozinha no cartão da grade e no meio
 * de uma frase, entre aspas, dentro da recusa.
 *
 * As duas formas existem para o gêmeo ser gêmeo LITERAL: a RPC escreve
 * `Esta equipe já está em "outro atendimento" das …` com minúscula, e o
 * formulário escrevendo `"Outro atendimento"` seria a mesma recusa com dois
 * textos — o defeito de sempre, agora numa letra só.
 */
export const ROTULO_DO_OCULTO = "Outro atendimento";
export const ROTULO_DO_OCULTO_NA_FRASE = "outro atendimento";

/** O rótulo como ele entra no MEIO de uma frase. Só o oculto muda de caixa. */
function rotuloNaFrase(rotulo: string): string {
  return rotulo === ROTULO_DO_OCULTO ? ROTULO_DO_OCULTO_NA_FRASE : rotulo;
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
 *   1. a linha     — o bloco que o gesto diz reescrever ainda está lá? (passo 1a)
 *   2. quem manda  — o gate das três camadas (`erroDeAutorizacao`, passo 1c)
 *   3. o feito     — o que já aconteceu não se move (`erroDeMover`, passo 2)
 *   4. forma       — equipe/dia/hora, duração, deslocamento
 *   5. física      — o dia tem 1440 minutos e a estrada vem antes
 *   6. identidade  — bloco sem chamado precisa de título
 *   7. conflito    — específico e acionável: "a equipe já está em X às Y"
 *   8. pessoa      — só aqui (não existe no banco: a EXCLUDE é por equipe)
 *   9. saída       — política: a equipe só sai às 09h
 *  10. jornada     — política: 8h de campo é o teto
 * Os itens 9 e 10 são pulados pelas isenções (`isentoDaJornada`). Os itens 1 a 8
 * nunca são: eles não são política, e nenhuma urgência põe a mesma equipe em
 * dois prédios.
 *
 * OS TRÊS PRIMEIROS SÃO NOVOS, e eles vêm antes da forma porque vêm antes na
 * RPC. A ordem não é gosto: um gesto que viola a autorização E a forma tem de
 * receber a MESMA frase dos dois lados, senão a validação do cliente vira uma
 * segunda regra — que é o defeito que este arquivo inteiro existe para não ter.
 *
 * AS FRASES SÃO AS DA RPC, palavra por palavra. Mudar uma aqui sem mudar a
 * outra faz o usuário ver dois textos para a mesma recusa dependendo de a
 * validação ter passado no cliente ou no servidor.
 */
export function erroDoAgendamento(
  cand: BlocoCandidato,
  ctx: ContextoDoAgendamento,
): string | null {
  const atual = atualDoGesto(cand, ctx);

  // ── 1. a linha que o gesto vai reescrever ───────────────────────────────
  // Gêmeo do `IF NOT FOUND` do passo 1a. Contexto desencontrado (a tela trocou
  // de cartão e não trocou o bloco) cai aqui de propósito: o gate e a recusa do
  // "feito" leem esta linha, e decidir sobre a linha errada é pior do que pedir
  // para recarregar.
  if (cand.id !== null && atual === null) {
    return "Este bloco não existe mais — recarregue a grade e refaça o gesto.";
  }

  // ── 2. quem manda neste bloco hoje ──────────────────────────────────────
  const naoPode = erroDeAutorizacao(cand, ctx);
  if (naoPode) return naoPode;

  // ── 3. o que já aconteceu não se move ───────────────────────────────────
  if (atual) {
    const imovel = erroDeMover(atual, cand);
    if (imovel) return imovel;
  }

  // ── 4. forma ────────────────────────────────────────────────────────────
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

  // ── 5. física ───────────────────────────────────────────────────────────
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

  // ── 6. identidade ───────────────────────────────────────────────────────
  if (!cand.chamado_id && !(cand.titulo_externo ?? "").trim()) {
    return "Um bloco sem chamado precisa de um título — diga o que é este serviço.";
  }

  // O chamado que o contexto trouxe só vale se for o do candidato. Um contexto
  // desencontrado (a tela trocou de cartão e esqueceu de trocar o chamado) tem
  // de cair no lado seguro, e não isentar a jornada por engano.
  const doCandidato =
    ctx.chamado && ctx.chamado.id === cand.chamado_id ? ctx.chamado : null;

  // ── 7. conflito de EQUIPE ───────────────────────────────────────────────
  // O conflitante é o PRIMEIRO da lista, e a lista tem ordem TOTAL (dia, hora,
  // id) — a mesma do `ORDER BY a.inicio_min, a.id` que a RPC ganhou antes do
  // `LIMIT 1`. Sem a mesma ordem dos dois lados, a MESMA recusa sai com nomes
  // diferentes conforme quem respondeu, e mensagem que muda sozinha ensina o
  // usuário a não lê-la.
  const colide = conflitosDoBloco(cand, ctx.blocosDoDia);
  if (colide.length > 0) {
    const o = colide[0];
    const jo = janelaDoBloco(o);
    return `Esta equipe já está em "${rotuloNaFrase(ctx.rotuloDe(o))}" das ${horaTexto(jo.de)} às ${horaTexto(jo.ate)} nesse dia.`;
  }

  // ── 8. conflito de PESSOA (não existe no banco) ─────────────────────────
  // A semana é a do DIA DO CANDIDATO, e o `null` volta a ser erro de FORMA em
  // vez de desligar o eixo em silêncio: o passo 4 já recusou data fora de
  // formato, mas se um dia ele mudar, a única regra que o banco não pega não
  // pode sumir sem uma palavra (foi assim que ela sumiu quando `semana` e
  // `escala` eram opcionais).
  const semana = semanaDoDia(cand.dia, ctx.chaveDaSemana);
  if (semana === null) return `Data fora do formato AAAA-MM-DD: ${cand.dia}.`;
  const pessoa = conflitosDaPessoa(
    doCandidato?.responsavel_id ?? null,
    cand,
    ctx.blocosDoDia,
    semana,
    ctx.escala,
  );
  if (pessoa.length > 0) {
    const o = pessoa[0];
    const jo = janelaDoBloco(o);
    return `O responsável já está em "${rotuloNaFrase(ctx.rotuloDe(o))}" com a equipe dele das ${horaTexto(jo.de)} às ${horaTexto(jo.ate)} nesse dia.`;
  }

  if (isentoDaJornada(cand.chamado_id, doCandidato)) return null;

  // ── 9. a saída ──────────────────────────────────────────────────────────
  if (j.de < CAMPO_ABRE_MIN) {
    return `A equipe só sai às ${horaTexto(CAMPO_ABRE_MIN)} — com ${duracaoTexto(cand.deslocamento_min)} de deslocamento o atendimento não pode começar antes das ${horaTexto(CAMPO_ABRE_MIN + cand.deslocamento_min)}.`;
  }

  // ── 10. a jornada ───────────────────────────────────────────────────────
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
  b: Pick<BlocoDeAgenda, "chamado_id" | "cumprido_em">,
  autz: AutorizacaoDaAgenda,
): string | null {
  // A ORDEM É A DA RPC: o vínculo primeiro, o registro depois. Trocar diria a
  // quem nem pode desmarcar que o problema é o "feito".
  const naoPode = erroDoVinculo(b.chamado_id, autz, "desmarca");
  if (naoPode) return naoPode;
  if (b.cumprido_em !== null) {
    return 'Este atendimento já está marcado como feito — desmarcá-lo apagaria o registro de que ele aconteceu. Se ele NÃO aconteceu, tire o "feito" do bloco primeiro e desmarque depois.';
  }
  return null;
}

/**
 * "NÃO DIZER NADA" E "DIZER NADA" SÃO A MESMA COISA, e as duas querem dizer
 * MARQUE. Gêmeo do `_feito := COALESCE(_feito, true)` de `agenda_campo_cumprir`:
 * o parâmetro tem `DEFAULT true`, mas um cliente que mandasse `{"_feito": null}`
 * caía no `ELSE` do CASE e APAGAVA o "feito" em silêncio — a direção destrutiva
 * escolhida por omissão, que é a pior de todas porque ninguém a pediu.
 */
export function baixaPedida(feito: boolean | null | undefined): boolean {
  return feito ?? true;
}

/**
 * O gêmeo de `agenda_campo_cumprir` (U78 §6.3). Duas recusas:
 *   · o vínculo — e bloco sem chamado é ato de gestão aqui também. Esta era a
 *     única das quatro portas sem o braço de gestor, e o estrago pequeno (dar
 *     baixa em serviço de fora não espelha nem entra na ocupação) é justamente o
 *     que faria a inconsistência sobreviver: ninguém a veria;
 *   · BLOCO DESMARCADO NÃO RECEBE "FEITO". É o par da recusa do §6.2 pelo outro
 *     lado: lá, cancelar um bloco cumprido é recusado porque `cancelado_em` e
 *     `cumprido_em` preenchidos juntos são um estado que nada na grade sabe ler.
 *     Sem esta linha o mesmo estado nascia invertendo a ordem dos cliques.
 * Tirar o "feito" de um bloco cancelado continua passando: aí o estado some.
 */
export function erroDaBaixa(
  b: Pick<BlocoDeAgenda, "chamado_id" | "cancelado_em">,
  feito: boolean | null | undefined,
  autz: AutorizacaoDaAgenda,
): string | null {
  const naoPode = erroDoVinculo(b.chamado_id, autz, "dá baixa em");
  if (naoPode) return naoPode;
  if (baixaPedida(feito) && b.cancelado_em !== null) {
    return "Este bloco está desmarcado — não dá para dar baixa em atendimento que foi cancelado. Remarque-o primeiro, se ele aconteceu.";
  }
  return null;
}

/**
 * O gêmeo de `desagendar_chamado` (U78 §6.4) — o ato deliberado, que é diferente
 * de desmarcar um bloco. Duas recusas, na ordem da RPC: o vínculo e a NATUREZA.
 *
 * A agenda de campo não manda em chamado comercial: aquela agenda é da visita
 * técnica (U41), que tem gatilho próprio. A função no banco é SECURITY DEFINER e
 * passa por cima de `chamados_update`, então a divisão que o §3 faz por
 * estrutura precisa ser dita aqui por escrito — nos dois lados.
 *
 * O QUE ESTA FUNÇÃO NÃO PROMETE: que a data vai sumir. Ver
 * `espelhoAposDesagendar` — com bloco cumprido sobrando, `data_hora_agendada`
 * fica no último atendimento que ACONTECEU, de propósito. O texto do botão e o
 * da confirmação não podem dizer "o horário some".
 */
export function erroDoDesagendamento(
  c: Pick<ChamadoParaGrade, "id" | "natureza">,
  autz: AutorizacaoDaAgenda,
): string | null {
  if (autz.usuarioId && !autz.podeEditarChamado(c.id)) {
    return "Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.";
  }
  if (c.natureza !== "campo") {
    return `A agenda de campo não manda em chamado comercial (este é "${c.natureza ?? "sem natureza"}") — quem desmarca a visita é a própria visita técnica.`;
  }
  return null;
}

// ── O CONTRATO DAS PORTAS: como um erro do banco vira reação na tela ────────

/**
 * AS QUATRO PORTAS DE ESCRITA DA AGENDA, pelo nome com que a camada de dados vai
 * chamá-las. A lista existe para ter UM lugar, e para a asserção poder ler os
 * `GRANT` do arquivo da U78 e provar o que este arquivo afirma no cabeçalho:
 * hoje elas são concedidas SÓ a `service_role`.
 *
 * ENQUANTO ISSO FOR VERDADE, `supabase.rpc(<qualquer uma>)` volta 42501 para
 * todo usuário logado. Não é bug e não é falta de permissão do usuário: é a U78
 * sendo inerte de propósito até a migration da TELA rodar os quatro GRANT que
 * ela deixou prontos no rodapé. A camada de dados não pode subir antes disso.
 */
export const PORTAS_DA_AGENDA = [
  "agenda_campo_marcar",
  "agenda_campo_cancelar",
  "agenda_campo_cumprir",
  "desagendar_chamado",
] as const;

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
 * ONDE A DATA DO CHAMADO VAI PARAR DEPOIS DE "TIRAR DA AGENDA". E ela NEM SEMPRE
 * FICA NULA: `desagendar_chamado` cancela só o que ainda VAI acontecer (bloco
 * cumprido é registro, não agenda), então, sobrando bloco cumprido, o estágio 2
 * do espelho põe `data_hora_agendada` no ÚLTIMO atendimento que ACONTECEU. Isso
 * é desenho, não resto: o chamado continua aberto (esperando peça, digamos) e
 * some do calendário e do PDF se a data zerar por ter sido atendido.
 *
 * A tela precisa disto porque o TEXTO muda: com bloco cumprido, "o horário some"
 * é mentira — o certo é "aberto, e a última visita foi dia tal".
 *
 * Reusa `espelhoDoChamado` em vez de reescrever os dois estágios: a regra tem um
 * dono. O carimbo de cancelamento aqui é um valor QUALQUER não nulo, porque a
 * única coisa que o espelho pergunta a ele é `=== null`.
 */
export function espelhoAposDesagendar(
  chamadoId: string,
  blocos: BlocoDeAgenda[],
): { dia: string; inicio_min: number } | null {
  const depois = blocos.map((b) =>
    b.chamado_id === chamadoId && blocoPendente(b)
      ? { ...b, cancelado_em: "(desagendado)" }
      : b,
  );
  return espelhoDoChamado(chamadoId, depois);
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
 * "quem não casou" do §9.0 da U78 — a que tem de vir vazia e que, daqui a um
 * mês, divergir é NOTÍCIA (quer dizer que alguém escreveu
 * `chamados.data_hora_agendada` de um chamado de campo por fora do satélite; as
 * três telas antigas ainda sabem fazer isso — ver PENDENCIAS_TECNICAS).
 *
 * OS DOIS FILTROS DA CONSULTA ESTAVAM FALTANDO AQUI, e sem eles a função acusava
 * 100% DA BASE NO DIA 1. Medido: `espelhoConfere({campo, aberto, com data}, [])`
 * devolvia `false`, e `false` também para o chamado concluído e para o
 * comercial. A consulta do §9.0 tem três condições que esta função não tinha:
 *   · `natureza='campo' AND status NOT IN ('concluido','cancelado')` — quem não
 *     é assunto desta tela não é divergência desta tela (é `naProgramacao`);
 *   · `e.quando IS NOT NULL` — chamado com data LEGADA e nenhum bloco não é
 *     divergência, é a faixa "agendado sem horário", que é a barra de progresso
 *     da migração e no dia 1 está certa e cheia.
 * Divergência que aparece para a base inteira é divergência que se aprende a
 * ignorar, e aí a que importa passa junto.
 *
 * "Confere" quer dizer "NÃO É NOTÍCIA": o `true` do chamado fora de escopo é a
 * ausência dele na lista, não uma afirmação sobre a data dele.
 */
export function espelhoConfere(
  chamado: Pick<ChamadoParaGrade, "id" | "natureza" | "status" | "data_hora_agendada">,
  blocos: BlocoDeAgenda[],
): boolean {
  if (!naProgramacao(chamado)) return true;
  const calculado = espelhoDoChamado(chamado.id, blocos);
  if (calculado === null) return true;
  return espelhoIgual(calculado, parDoInstante(chamado.data_hora_agendada));
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
 *
 * E É ELE QUEM RESOLVE O `_deslocamento_min`, que mudou de semântica na porta.
 * O parâmetro era `DEFAULT 0` e virou `DEFAULT NULL`: num PATCH, um default que
 * não é NULL é um apagador disfarçado — o PostgREST preenche o default de todo
 * parâmetro que não vem no corpo, então arrastar o cartão zerava os 45 minutos
 * de estrada digitados, encolhendo a janela do EXCLUDE e inventando 45 minutos
 * de capacidade no dia. Agora omitir quer dizer "não mexi", e o ZERO de "não tem
 * deslocamento" se escreve mandando `0` de propósito. Este patch faz exatamente
 * isso: 45 → 0 é uma mudança, entra; não mexer não entra.
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

/**
 * QUAIS CHAMADOS ESTE GESTO MEXEU — e são DOIS quando o bloco troca de chamado.
 *
 * A porta ajusta o status dos dois lados: `aberto → agendado` no destino e
 * `agendado → aberto` na origem que ficou sem bloco pendente. O espelho também:
 * o gatilho recalcula a data do chamado que ganhou e a do que perdeu. Uma tela
 * que refaz a busca só do destino deixa o cartão de origem com o chip e a data
 * velhos na tela até alguém recarregar — e o que ela mostra ali é exatamente a
 * segunda verdade que esta entrega existe para matar.
 *
 * Devolve os ids sem repetição e sem nulo (bloco sem chamado não tem chamado a
 * recarregar). Serve para invalidar cache/refetch, não para autorizar nada.
 */
export function chamadosTocadosPeloGesto(
  atual: Pick<BlocoDeAgenda, "chamado_id"> | null,
  desejado: Pick<BlocoCandidato, "chamado_id">,
): string[] {
  const ids = [atual?.chamado_id ?? null, desejado.chamado_id];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id !== ""))];
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
 *
 * `temBlocoAtivo` É `blocoVale` (não cancelado), E ISSO INCLUI O CUMPRIDO — de
 * propósito, e é o gêmeo literal do `a.cancelado_em IS NULL` da linha 701. Estes
 * baldes medem a MIGRAÇÃO ("alguém já deu horário a este chamado?"), e a visita
 * que aconteceu deu: contar só o pendente faria a barra de progresso ANDAR PARA
 * TRÁS quando uma equipe termina um atendimento sem retorno marcado. Quem conta
 * pendente é `statusAposOsBlocos`, que responde outra pergunta.
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

/**
 * O CHAMADO TEM COMPROMISSO MARCADO QUE AINDA VAI ACONTECER. É bloco PENDENTE:
 * nem cancelado, nem cumprido.
 *
 * NÃO É O MESMO PREDICADO DE `classificarChamado`, e a diferença tem nome. Lá o
 * que interessa é "alguém já deu horário a este chamado no sistema novo" — e a
 * visita que já aconteceu deu —, então o filtro é `blocoVale`, o mesmo
 * `cancelado_em IS NULL` da linha 701 da conferência. Aqui o que interessa é
 * "há algo marcado à frente", que é o que a palavra `agendado` promete no chip.
 * Contar cumprido como agenda é o defeito que a U78 corrigiu nas duas portas: o
 * chamado que teve a visita de terça e teve o retorno da quinta desmarcado
 * ficava `agendado` para sempre, sem nada pendente.
 */
export function temCompromisso(chamadoId: string, blocos: BlocoDeAgenda[]): boolean {
  return blocos.some((b) => b.chamado_id === chamadoId && blocoPendente(b));
}

/**
 * O STATUS QUE AS PORTAS DEIXAM. Gêmeo do passo 8 de `agenda_campo_marcar`
 * (`aberto → agendado` no destino, `agendado → aberto` na origem que ficou sem
 * bloco pendente), da metade de baixo de `agenda_campo_cancelar` e do
 * `desagendar_chamado`.
 *
 * As três transições são ESTREITAS de propósito: só `aberto` vira `agendado` e
 * só `agendado` volta a `aberto`. Chamado em execução, concluído ou cancelado
 * não é remexido por marcação de agenda — o estado dele foi afirmado por alguém,
 * e agenda não desafirma trabalho.
 *
 * `natureza` diferente de campo devolve o status como está: as três portas
 * carregam `AND natureza = 'campo'` no UPDATE, e a agenda comercial é da visita
 * técnica (U41). A tela usa isto para antecipar o chip sem esperar o refetch —
 * e para a asserção provar que os dois lados contam PENDENTE, não ativo.
 */
export function statusAposOsBlocos(
  c: Pick<ChamadoParaGrade, "id" | "status" | "natureza">,
  blocos: BlocoDeAgenda[],
): string | null {
  if (c.natureza !== "campo") return c.status;
  const pendente = temCompromisso(c.id, blocos);
  if (pendente && c.status === "aberto") return "agendado";
  if (!pendente && c.status === "agendado") return "aberto";
  return c.status;
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
  /**
   * o cartão pode ser ARRASTADO. Falso no bloco cumprido — a porta recusa mudar
   * dia, hora, equipe ou chamado dele, e oferecer o arrasto é prometer o que o
   * servidor vai negar. Duração e deslocamento continuam editáveis pelo
   * formulário: são medição, não afirmação sobre quando.
   */
  seMove: boolean;
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
 * atendimento alheio que o técnico não pode ler. `ROTULO_DO_OCULTO` são as
 * mesmas palavras que `agenda_campo_frase_do_conflito` usa no servidor quando
 * `pode_editar_chamado` diz não — em caixa alta aqui porque no cartão ela vem
 * sozinha, e em caixa baixa dentro da frase de recusa, que é como a RPC a
 * escreve (ver `rotuloNaFrase`). Os dois lados escondem a mesma coisa com o
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
  if (chamadoOculto(bloco, chamado)) return ROTULO_DO_OCULTO;
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
      seMove: blocoSeMove(b),
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
