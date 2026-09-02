// Calendário de feriados, pontos facultativos e dias úteis — R115 (U85).
//
// Módulo PURO. Não toca no banco, não importa React, não sabe o que é uma
// tela. É a fundação de duas entregas diferentes e independentes:
//   · o SOBREAVISO (R116/U86), que precisa saber se o plantonista cobre 14h ou
//     24h num dia;
//   · o CRONOGRAMA de implantação por DIA ÚTIL (Fase 4), que ainda não existe.
// Por isso ele nasce sozinho, sem migration e sem consumidor obrigatório: a
// Fase 4 depende DELE, não do sobreaviso.
//
// ── O ÚNICO IMPORT, E POR QUE ELE EXISTE ───────────────────────────────────
// `dataIso` já existe em `src/lib/periodos.ts:77` e faz exatamente o que este
// módulo precisa (AAAA-MM-DD no fuso LOCAL — `toISOString()` jogaria para o dia
// anterior). Reescrevê-la aqui seria a mesma regra escrita duas vezes, que é a
// coisa que `src/features/programacao/modelo.ts:105` argumenta contra em prosa.
// Regra 8 da casa: prefira apagar a acrescentar. `periodos.ts` não importa
// nada, então este módulo continua sendo uma folha da árvore.
//
// ── MEIO-DIA COMO ÂNCORA, E NÃO MEIA-NOITE ─────────────────────────────────
// Todo `new Date(...)` daqui é construído às 12:00. O Brasil aboliu o horário
// de verão em 2019, mas o módulo responde desde 1583 e em São Paulo o relógio
// pulava de 23:59:59 para 01:00:00 — a MEIA-NOITE NÃO EXISTIA em várias datas
// de outubro. Uma data construída à meia-noite nesses dias escorrega uma hora
// e, dependendo do motor, um DIA. Ao meio-dia, nenhum deslocamento de ±1h
// atravessa a fronteira do dia, e `getDate()` é sempre o dia pedido.
//
// ── FERIADO × PONTO FACULTATIVO NÃO SÃO A MESMA COISA ──────────────────────
// Carnaval e Corpus Christi são ponto FACULTATIVO no âmbito federal, não
// feriado. E no mesmo 04/06/2026, Corpus Christi é feriado MUNICIPAL em São
// Paulo capital — que é onde a Prever opera (a sede fica em Interlagos). Um
// booleano `ehFeriado` teria de escolher um dos dois lados e errar o outro, e o
// lado que ele erraria é justamente o dia em que Interlagos fecha.
//
// Por isso um dia carrega DOIS eixos independentes:
//   · `tipo`       — feriado | facultativo | expediente_parcial
//   · `jurisdicao` — nacional | estadual | municipal
// e `diaEspecial()` devolve uma LISTA, porque 04/06/2026 é as duas coisas ao
// mesmo tempo, com normas diferentes.
//
// A PROJEÇÃO para "isto é dia útil?" é POLÍTICA, não factual, e mora num lugar
// só (`ehDiaUtil`): FERIADO não conta como dia útil; FACULTATIVO conta;
// EXPEDIENTE PARCIAL conta. Porque a Prever é empresa PRIVADA — ponto
// facultativo obriga repartição pública, não obriga ninguém aqui. Se um dia a
// resposta tiver de ser diferente para o sobreaviso e para o cronograma, é
// ESTA função que se desdobra em duas, e nenhuma outra linha do sistema muda.
//
// ── O QUE SE PERDE POR NÃO COLAPSAR NUM BOOLEANO ───────────────────────────
// Nada. O custo é o inverso: três campos em vez de um. O que se GANHA é que o
// dia 04/06 aparece na grade com o nome certo e com a norma que o sustenta,
// e que a decisão "facultativo conta como útil" é uma linha auditável em vez
// de um dado que já nasceu achatado e irrecuperável.

import { dataIso } from "./periodos";

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDiaEspecial = "feriado" | "facultativo" | "expediente_parcial";
export type Jurisdicao = "nacional" | "estadual" | "municipal";

// NÃO EXISTE UM CAMPO DE HORA AQUI, E A AUSÊNCIA É DECISÃO.
// Havia um `ate?: "12:00" | "13:00" | "14:00"`, e ele carregava um NÚMERO sem
// carregar a DIREÇÃO — que é a única coisa que distingue os dois casos vivos:
//   · 24/12 e 31/12 — ponto facultativo A PARTIR das 14:00, expediente ATÉ as 14:00;
//   · Quarta-feira de Cinzas — ponto facultativo ATÉ as 14:00, expediente A PARTIR das 14:00.
// Com um campo só, um dos dois sai invertido, e saía: a Cinzas era rotulada
// "expediente até 14:00", o oposto do que a Portaria diz, na mesma linha em que
// o `norma` do próprio objeto dizia o contrário. A hora já vive em `norma`, com
// a direção escrita, nos três casos — e nenhum consumidor CALCULAVA com o campo
// (`ehDiaUtil` é `true` nos três de qualquer jeito). Regra 8: o campo saiu, e a
// contradição ficou irrepresentável. Se a Fase 4 vier a precisar da hora como
// DADO, o campo tem de nascer carregando a direção (`{ de }` × `{ ate }`),
// nunca só o número, e só depois de existir o consumidor.

export interface DiaEspecial {
  /** AAAA-MM-DD. */
  data: string;
  nome: string;
  tipo: TipoDiaEspecial;
  jurisdicao: Jurisdicao;
  /**
   * A lei, o decreto ou a portaria. Não é enfeite: é o que permite conferir
   * (e contestar) uma data sem abrir o código. Onde a fonte é ambígua, a
   * ambiguidade está escrita AQUI e não num comentário que ninguém lê.
   */
  norma: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ATÉ QUE ANO ELE RESPONDE — e o que acontece quando a resposta ficar errada
// ═══════════════════════════════════════════════════════════════════════════
//
// A escolha é ALGORITMO + TABELA DE EXCEÇÕES DATADA, e não uma das duas
// sozinha:
//
//   · Tabela chumbada MORRE. No dia 1º de janeiro do primeiro ano não
//     cadastrado, todo dia vira dia útil e o sobreaviso passa a pedir 14h onde
//     devia pedir 24h. Falha silenciosa, e em massa.
//   · Algoritmo puro MENTE. Em 2020 a Prefeitura de São Paulo ANTECIPOU dois
//     feriados por causa da pandemia (Lei mun. 17.341/2020): Corpus Christi
//     saiu de 11/06 para 20/05 e a Consciência Negra saiu de 20/11 para 21/05.
//     Nenhum algoritmo derivado da Páscoa sabe disso, e nunca vai saber.
//
// O par resolve os dois: o algoritmo responde para sempre, e a tabela corrige
// o ano em que a lei desmentiu o algoritmo.
//
// NO ANO EM QUE A RESPOSTA FICAR ERRADA — e ela vai ficar, porque a lei muda —
// o módulo NÃO AVISA. Não há como avisar: uma lei nova não emite sinal para
// dentro de um arquivo .ts. O que se pode fazer, e o que se fez, é tornar a
// divergência BARATA de consertar (abrir o decreto anual da Prefeitura, colar
// as datas na tabela de exceções e subir uma constante) e VISÍVEL de fora
// (`conferido(ano)` devolve false, e a barra do mês escreve
// "calendário conferido até 2026"). Ausência de conferência é declarada; ela
// não se disfarça de certeza.
//
// O PISO NÃO É O ANO DA LEI. `conferido()` afirma um ATO HUMANO — alguém abriu
// o decreto daquele ano e comparou as datas —, e não a existência de uma norma.
// O piso era 2007 (o ano da Lei municipal 14.485) e isso é a resposta certa
// para a pergunta errada: a faixa 2007..2026 avalizava vinte anos dos quais
// TREZE ninguém olhou, 2021 entre eles — e 2021 teve antecipação municipal de
// feriados em São Paulo, exatamente a classe de ato que a tabela de EXCEÇÕES
// existe para registrar e que não está lá. O resultado seria a barra da tela
// sumir e o PDF imprimir "conferido" sobre um mês com a cobertura errada.
//
// O piso é o primeiro ano cujas datas estão presas, ANO A ANO, contra o decreto
// publicado, em asserção nomeada do verificador (os móveis de 2025 e 2026 e a
// lista inteira dos treze feriados de 2026). Ele SOBE quando alguém conferir
// mais um ano, e nunca antes. Baixá-lo sem acrescentar a asserção é fazer o
// módulo mentir sobre a única coisa que ele promete saber sobre si mesmo.
export const ANO_CONFERIDO_DESDE = 2025;
export const ANO_CONFERIDO_ATE = 2026;

/** Fora desta faixa o computus gregoriano não é a regra em vigor / é extrapolação. */
export const ANO_MIN = 1583;
export const ANO_MAX = 2400;

/**
 * O ano está dentro da faixa que alguém conferiu contra o decreto?
 *
 * Fora dela as datas continuam sendo respondidas — o algoritmo não para —, mas
 * a resposta é DERIVADA, não conferida. Quem mostra calendário para gente tem
 * de dizer isso.
 */
export function conferido(ano: number): boolean {
  return ano >= ANO_CONFERIDO_DESDE && ano <= ANO_CONFERIDO_ATE;
}

// ═══════════════════════════════════════════════════════════════════════════
// O COMPUTUS — a data da Páscoa
// ═══════════════════════════════════════════════════════════════════════════
//
// Algoritmo de Meeus/Jones/Butcher para o calendário gregoriano. Ele é famoso
// por ser fácil de errar em ano de borda, e é por isso que a asserção dele no
// verificador NÃO compara o resultado com ele mesmo (regra 9): compara com uma
// FIXTURE EXTERNA escrita à mão (regra 4) que inclui os quatro extremos reais
// do intervalo — 1818-03-22 e 2285-03-22 (o mais cedo possível, 22 de março) e
// 1943-04-25 e 2038-04-25 (o mais tarde possível, 25 de abril) —, além de duas
// propriedades independentes varridas sobre 1583..2400: toda Páscoa cai em
// DOMINGO, e toda Páscoa cai entre 22/03 e 25/04.
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const soma = h + l - 7 * m + 114;
  const mes = Math.floor(soma / 31);      // 3 = março, 4 = abril
  const dia = (soma % 31) + 1;
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

function dois(n: number): string {
  return String(n).padStart(2, "0");
}

/** AAAA-MM-DD → Date local ao MEIO-DIA (ver a nota de DST no cabeçalho). */
function aoMeioDia(iso: string): Date {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

/** Desloca uma data ISO em N dias (N pode ser negativo) e devolve ISO. */
export function somarDias(iso: string, n: number): string {
  const d = aoMeioDia(iso);
  d.setDate(d.getDate() + n);
  return dataIso(d);
}

// ═══════════════════════════════════════════════════════════════════════════
// AS EXCEÇÕES DATADAS — o que a lei fez e o algoritmo não sabe
// ═══════════════════════════════════════════════════════════════════════════
//
// Uma entrada por ANO. `remove` tira uma data que o algoritmo produziria;
// `acrescenta` põe uma que ele não produziria. Ano sem entrada não recebe
// nenhuma correção — omissão HONESTA, e não silenciosa: `conferido()` é quem
// diz se aquele ano foi olhado por um humano.
//
// O QUE **NÃO** ESTÁ AQUI, DE PROPÓSITO: as "pontes" (ponto facultativo em
// segunda ou sexta colada a um feriado) que a Prefeitura e o Governo decretam
// ano a ano. Duas razões, nesta ordem:
//   1. Elas não mudam UMA resposta deste módulo. Ponte é ponto FACULTATIVO, e
//      facultativo conta como dia útil para uma empresa privada — `ehDiaUtil`,
//      `ehFeriado` e a cobertura do sobreaviso devolvem exatamente o mesmo
//      número com ou sem elas. O que se ganharia é um nome num tooltip.
//   2. Cada uma exige citar um decreto anual específico. Escrever a citação sem
//      ter o decreto na mão é inventar fonte — que é a classe de defeito que a
//      U84 passou uma entrega inteira arrancando do catálogo do banco. Um
//      tooltip a menos é barato; uma norma inventada dentro do `norma` de um
//      módulo que existe para ser auditável é caro.
// Quando alguém tiver o decreto aberto, o mecanismo está pronto: acrescente a
// linha com `tipo: "facultativo"` e a norma verdadeira.
interface ExcecaoDoAno {
  /** Datas AAAA-MM-DD que NÃO acontecem naquele ano, apesar do algoritmo. */
  remove?: string[];
  acrescenta?: DiaEspecial[];
}

const EXCECOES: Record<number, ExcecaoDoAno> = {
  // Lei municipal 17.341, de 18/05/2020 (São Paulo capital): antecipou os
  // feriados de Corpus Christi (11/06) e do Dia da Consciência Negra (20/11)
  // para 20 e 21 de maio de 2020. Em 2020 a Consciência Negra ainda era
  // feriado só MUNICIPAL — a lei federal que a tornou nacional é de 2023.
  2020: {
    remove: ["2020-06-11", "2020-11-20"],
    acrescenta: [
      {
        data: "2020-05-20",
        nome: "Corpus Christi (antecipado)",
        tipo: "feriado",
        jurisdicao: "municipal",
        norma: "Lei municipal 17.341/2020, art. 1º (São Paulo capital) — antecipação do feriado de 11/06/2020",
      },
      {
        data: "2020-05-21",
        nome: "Dia da Consciência Negra (antecipado)",
        tipo: "feriado",
        jurisdicao: "municipal",
        norma: "Lei municipal 17.341/2020, art. 1º (São Paulo capital) — antecipação do feriado de 20/11/2020",
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// A MONTAGEM DO ANO
// ═══════════════════════════════════════════════════════════════════════════
//
// AS FONTES, uma por linha, para conferir sem sair do arquivo:
//
//  NACIONAIS FIXOS
//   01/01 Confraternização Universal ...... Lei 662/1949 (red. Lei 10.607/2002)
//   21/04 Tiradentes ...................... Lei 662/1949 (red. Lei 10.607/2002)
//   01/05 Dia do Trabalho ................. Lei 662/1949 (red. Lei 10.607/2002)
//   07/09 Independência ................... Lei 662/1949 (red. Lei 10.607/2002)
//   12/10 Nossa Senhora Aparecida ......... Lei 6.802/1980
//   02/11 Finados ......................... Lei 662/1949 (red. Lei 10.607/2002)
//   15/11 Proclamação da República ........ Lei 662/1949 (red. Lei 10.607/2002)
//   25/12 Natal ........................... Lei 662/1949 (red. Lei 10.607/2002)
//
//  O QUE MUDOU E QUASE NINGUÉM ATUALIZOU: 20/11, Dia da Consciência Negra.
//   · até 2023 — feriado MUNICIPAL em São Paulo capital (Lei mun. 14.485/2007)
//   · de 2024 em diante — feriado NACIONAL (Lei 14.759/2023)
//  As duas linhas existem, cada uma com a sua vigência. Colapsá-las numa só
//  produziria "feriado nacional em 2019", que é falso, ou "feriado nenhum em
//  Interlagos em 2015", que também é.
//
//  MÓVEIS, DERIVADOS DA PÁSCOA (deslocamento em dias)
//   −48 Carnaval (segunda) ......... facultativo federal
//   −47 Carnaval (terça) ........... facultativo federal
//   −46 Quarta-feira de Cinzas ..... expediente A PARTIR das 14:00 (federal)
//                                    — o ponto facultativo é que vai ATÉ as 14h
//    −2 Sexta-feira Santa .......... feriado — ver a nota abaixo
//   +60 Corpus Christi ............. feriado MUNICIPAL em SP capital
//                                    e facultativo federal, no MESMO dia
//
//  ESTADUAL (SP)
//   09/07 Revolução Constitucionalista de 1932 ... Lei estadual 9.497/1997
//
//  MUNICIPAL (SP CAPITAL)
//   25/01 Aniversário da cidade de São Paulo ..... Lei mun. 14.485/2007, Anexo I
//
// A NOTA DA SEXTA-FEIRA SANTA, e ela mora dentro do campo `norma` de propósito:
// a Lei 9.093/1995, art. 2º, trata os feriados religiosos como matéria
// MUNICIPAL (até quatro por ano, incluída a Sexta-feira Santa), enquanto a
// Portaria anual do Ministério da Gestão e o Anexo I paulistano a listam junto
// dos nacionais. A leitura prática, e a que vale aqui, é que a empresa FECHA.
// Se a nota vivesse só num comentário, alguém "corrigiria" a jurisdição um dia
// e, dependendo de como a corrigisse, a Prever passaria a marcar plantão de 14h
// num dia em que ninguém trabalha.

interface Fixo {
  mes: number;
  dia: number;
  nome: string;
  tipo: TipoDiaEspecial;
  jurisdicao: Jurisdicao;
  norma: string;
  /** Primeiro ano em que a norma vale (inclusive). */
  desde?: number;
  /** Último ano em que a norma vale (inclusive). */
  ateAno?: number;
}

const FIXOS: Fixo[] = [
  { mes: 1, dia: 1, nome: "Confraternização Universal", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  { mes: 1, dia: 25, nome: "Aniversário da cidade de São Paulo", tipo: "feriado", jurisdicao: "municipal",
    norma: "Lei municipal 14.485/2007, Anexo I (São Paulo capital)" },
  { mes: 4, dia: 21, nome: "Tiradentes", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  { mes: 7, dia: 9, nome: "Revolução Constitucionalista de 1932", tipo: "feriado", jurisdicao: "estadual",
    norma: "Lei estadual paulista 9.497/1997, art. 1º" },
  { mes: 9, dia: 7, nome: "Independência do Brasil", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 6.802/1980, art. 1º" },
  { mes: 10, dia: 28, nome: "Dia do Servidor Público", tipo: "facultativo", jurisdicao: "nacional",
    norma: "Lei 8.112/1990, art. 236 — ponto facultativo do servidor federal; não alcança empresa privada" },
  { mes: 11, dia: 2, nome: "Finados", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  { mes: 11, dia: 15, nome: "Proclamação da República", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  // AS DUAS LINHAS DO 20/11 — mesma data, normas e jurisdições diferentes, e
  // vigências que não se sobrepõem. Ver a nota acima.
  { mes: 11, dia: 20, nome: "Dia da Consciência Negra", tipo: "feriado", jurisdicao: "municipal",
    norma: "Lei municipal 14.485/2007, Anexo I (São Paulo capital) — antes de a Lei 14.759/2023 torná-lo nacional",
    ateAno: 2023 },
  { mes: 11, dia: 20, nome: "Dia Nacional de Zumbi e da Consciência Negra", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 14.759/2023, art. 1º — feriado NACIONAL a partir de 2024", desde: 2024 },
  { mes: 12, dia: 24, nome: "Véspera de Natal", tipo: "expediente_parcial", jurisdicao: "nacional",
    norma: "Portaria anual do Ministério da Gestão (calendário federal) — ponto facultativo A PARTIR das 14:00; o expediente vai ATÉ as 14:00" },
  { mes: 12, dia: 25, nome: "Natal", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 662/1949, art. 1º (redação da Lei 10.607/2002)" },
  { mes: 12, dia: 31, nome: "Véspera de Ano-Novo", tipo: "expediente_parcial", jurisdicao: "nacional",
    norma: "Portaria anual do Ministério da Gestão (calendário federal) — ponto facultativo A PARTIR das 14:00; o expediente vai ATÉ as 14:00" },
];

interface Movel {
  desloca: number;
  nome: string;
  tipo: TipoDiaEspecial;
  jurisdicao: Jurisdicao;
  norma: string;
}

const MOVEIS: Movel[] = [
  { desloca: -48, nome: "Carnaval (segunda)", tipo: "facultativo", jurisdicao: "nacional",
    norma: "Portaria anual do Ministério da Gestão — PONTO FACULTATIVO federal, não é feriado" },
  { desloca: -47, nome: "Carnaval (terça)", tipo: "facultativo", jurisdicao: "nacional",
    norma: "Portaria anual do Ministério da Gestão — PONTO FACULTATIVO federal, não é feriado" },
  { desloca: -46, nome: "Quarta-feira de Cinzas", tipo: "expediente_parcial", jurisdicao: "nacional",
    norma: "Portaria anual do Ministério da Gestão — ponto facultativo ATÉ as 14:00; o expediente COMEÇA às 14:00 (o inverso de 24/12 e 31/12)" },
  { desloca: -2, nome: "Sexta-feira Santa", tipo: "feriado", jurisdicao: "nacional",
    norma: "Lei 9.093/1995, art. 2º (trata o feriado religioso como MUNICIPAL, até quatro por ano) × Portaria anual do Ministério da Gestão e Lei municipal 14.485/2007, Anexo I, que a listam com os nacionais. A leitura prática é a que vale: a empresa FECHA." },
  { desloca: 60, nome: "Corpus Christi", tipo: "feriado", jurisdicao: "municipal",
    norma: "Lei municipal 14.485/2007, Anexo I (São Paulo capital) — FERIADO municipal" },
  { desloca: 60, nome: "Corpus Christi", tipo: "facultativo", jurisdicao: "nacional",
    norma: "Portaria anual do Ministério da Gestão — no âmbito FEDERAL é ponto facultativo, e não feriado; em São Paulo capital a norma municipal o torna feriado no MESMO dia" },
];

// A grade do mês pergunta o mesmo ano 31 vezes, e o PDF pergunta de novo.
// Montar o ano é barato, mas não é de graça. O que torna a memorização segura
// NÃO é o resultado ser "imutável por construção" — ele não é: é um array, e
// `diasEspeciais` é exportada. É a CÓPIA NA SAÍDA. Sem ela, um `.sort()` ou um
// `.push()` de quem chegar depois envenena o calendário do processo inteiro, e
// o próximo mês desenhado sai com um feriado a mais.
const CACHE = new Map<number, DiaEspecial[]>();

/**
 * TODOS os dias especiais de um ano — feriados, pontos facultativos e
 * expedientes parciais —, ordenados por data e, dentro do dia, por nome.
 *
 * Pode haver MAIS DE UM na mesma data: 04/06/2026 é feriado municipal e ponto
 * facultativo federal ao mesmo tempo. Achatar isso é o defeito que este módulo
 * existe para não ter.
 */
export function diasEspeciais(ano: number): DiaEspecial[] {
  const emCache = CACHE.get(ano);
  if (emCache) return [...emCache];

  const out: DiaEspecial[] = [];

  for (const f of FIXOS) {
    if (f.desde !== undefined && ano < f.desde) continue;
    if (f.ateAno !== undefined && ano > f.ateAno) continue;
    out.push({
      data: `${ano}-${dois(f.mes)}-${dois(f.dia)}`,
      nome: f.nome, tipo: f.tipo, jurisdicao: f.jurisdicao, norma: f.norma,
    });
  }

  const pas = pascoa(ano);
  for (const m of MOVEIS) {
    out.push({
      data: somarDias(pas, m.desloca),
      nome: m.nome, tipo: m.tipo, jurisdicao: m.jurisdicao, norma: m.norma,
    });
  }

  const exc = EXCECOES[ano];
  if (exc) {
    const removidas = new Set(exc.remove ?? []);
    // Remove só o que a LEI moveu — e ela move o feriado, não o ponto
    // facultativo federal que caía junto. O 11/06/2020 continua sendo
    // facultativo no âmbito federal; o que sumiu foi o feriado municipal.
    const sobrou = out.filter((d) => !(removidas.has(d.data) && d.tipo === "feriado"));
    out.length = 0;
    out.push(...sobrou, ...(exc.acrescenta ?? []));
  }

  out.sort((a, b) => (a.data === b.data ? a.nome.localeCompare(b.nome, "pt-BR") : a.data < b.data ? -1 : 1));
  CACHE.set(ano, out);
  return [...out];
}

/** Só os que são FERIADO — o recorte que fecha a empresa. */
export function feriadosDoAno(ano: number): DiaEspecial[] {
  return diasEspeciais(ano).filter((d) => d.tipo === "feriado");
}

/**
 * O que acontece nesta data. Lista, porque um dia pode ser duas coisas com
 * jurisdições diferentes. Vazia = dia comum.
 */
export function diaEspecial(iso: string): DiaEspecial[] {
  const ano = Number(iso.slice(0, 4));
  if (!Number.isFinite(ano)) return [];
  return diasEspeciais(ano).filter((d) => d.data === iso);
}

/** Feriado é o que fecha a empresa. Facultativo NÃO é feriado. */
export function ehFeriado(iso: string): boolean {
  return diaEspecial(iso).some((d) => d.tipo === "feriado");
}

export function ehFimDeSemana(iso: string): boolean {
  const dow = aoMeioDia(iso).getDay();
  return dow === 0 || dow === 6;
}

/**
 * A PROJEÇÃO POLÍTICA, e ela mora só aqui.
 *
 * Feriado NÃO é dia útil. Ponto facultativo É — a Prever é privada, e
 * facultativo obriga repartição pública. Expediente parcial também é: houve
 * expediente, ainda que curto.
 */
export function ehDiaUtil(iso: string): boolean {
  return !ehFimDeSemana(iso) && !ehFeriado(iso);
}

/**
 * O nome do dia, para o `title` da célula da grade. Cor nenhuma transporta
 * "Corpus Christi"; um sábado e um Corpus Christi valem as mesmas 24h e por
 * isso recebem a MESMA lavagem — o que os distingue é este texto.
 */
export function rotuloDoDia(iso: string): string | null {
  const nos = diaEspecial(iso);
  if (nos.length === 0) return null;
  const vistos: string[] = [];
  for (const d of nos) {
    // "expediente parcial" e não "expediente até as 14:00": a hora sem a
    // DIREÇÃO inverte a Quarta-feira de Cinzas, e a direção mora no `norma`.
    const rot = d.tipo === "feriado"
      ? `${d.nome} (feriado ${d.jurisdicao})`
      : d.tipo === "expediente_parcial"
        ? `${d.nome} (expediente parcial)`
        : `${d.nome} (ponto facultativo ${d.jurisdicao})`;
    if (!vistos.includes(rot)) vistos.push(rot);
  }
  return vistos.join(" · ");
}
