// ═══════════════════════════════════════════════════════════════════════════
// O CRONOGRAMA DA IMPLANTAÇÃO — lógica pura (R120, U89, Fase 4)
//
// A obra tem um PERÍODO (início ↔ fim, em `chamados.implantacao_inicio/fim`) e
// quatro FASES dentro dele (`implantacao_cronograma`). Este módulo é quem sabe
// dividir um no outro, e é o único lugar do repositório que sabe — a tela não
// calcula nada (docs/manual/operacao-campo.md:89-90).
//
// ── POR QUE `fase` E NÃO `etapa` ──────────────────────────────────────────
// `etapa` já significa MOMENTO DA FOTO neste sistema (`chamado_fotos.etapa`
// ∈ antes/depois/outra). Usar a palavra aqui seria a sexta colisão de
// vocabulário do projeto. O §0b da U89 conta a história inteira.
//
// ── O QUE O BANCO GARANTE, E O QUE ESTE MÓDULO GARANTE ────────────────────
// O banco garante FORMA: as quatro fases são valores de um CHECK, `fim >=
// inicio` é CHECK, e uma fase por obra é índice único. Ele NÃO garante que as
// fases cubram o período sem buraco nem sobreposição — isso é sequência, e
// CHECK de linha não enxerga sequência. `conferirCronograma()` abaixo é quem
// enxerga, e a tela mostra o que ele achar.
//
// ── DIA ÚTIL ──────────────────────────────────────────────────────────────
// A divisão é feita em DIAS ÚTEIS, não em dias corridos: uma obra que começa
// numa sexta e acaba na segunda seguinte tem 2 dias de trabalho, não 4. Quem
// responde isso é `src/lib/feriados.ts`, o mesmo módulo que o sobreaviso usa —
// e ele distingue feriado (não é dia útil) de ponto facultativo (É dia útil,
// porque a Prever é empresa privada).
// ═══════════════════════════════════════════════════════════════════════════

import {
  ehDiaUtil,
  somarDias,
  conferido,
  ANO_CONFERIDO_DESDE,
  ANO_CONFERIDO_ATE,
} from "@/lib/feriados";

// ═══════════════════════════════════════════════════════════════════════════
// AS QUATRO FASES
// ═══════════════════════════════════════════════════════════════════════════

export const FASES = [
  "infraestrutura",
  "instalacao",
  "configuracao",
  "acabamento",
] as const;

export type Fase = (typeof FASES)[number];

export const FASE_LABEL: Record<Fase, string> = {
  infraestrutura: "Infraestrutura",
  instalacao: "Instalação",
  configuracao: "Configuração",
  acabamento: "Acabamento",
};

/**
 * A ordem de execução — e ela é a ordem do array, não um campo no banco.
 *
 * Guardar `ordem` numa coluna criaria uma segunda verdade: duas linhas
 * poderiam dizer `ordem = 2`, ou a ordem gravada poderia contradizer o nome da
 * fase. A ordem de uma obra de segurança eletrônica não é opinião do usuário —
 * não se configura o que ainda não se instalou. Então ela é CONSTANTE, e o
 * índice no array é a resposta.
 */
export function ordemDaFase(fase: Fase): number {
  return FASES.indexOf(fase);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAS ÚTEIS
// ═══════════════════════════════════════════════════════════════════════════

/** Teto de segurança para as varreduras de dia a dia. ~27 anos. */
const DIAS_MAXIMOS = 10000;

/**
 * Os dias ÚTEIS de um período, em ordem, inclusive nas duas pontas.
 *
 * Devolve `[]` quando o fim é anterior ao início — e isso é uma resposta, não
 * um erro: quem chamou recebe uma lista vazia e decide. Lançar aqui obrigaria
 * toda a tela a envolver a chamada em try/catch para exibir um campo de data.
 */
export function diasUteis(inicio: string, fim: string): string[] {
  if (!inicio || !fim || fim < inicio) return [];
  const dias: string[] = [];
  let cursor = inicio;
  let guarda = 0;
  while (cursor <= fim && guarda < DIAS_MAXIMOS) {
    if (ehDiaUtil(cursor)) dias.push(cursor);
    cursor = somarDias(cursor, 1);
    guarda += 1;
  }
  return dias;
}

/** Quantos dias úteis o período tem. */
export function contarDiasUteis(inicio: string, fim: string): number {
  return diasUteis(inicio, fim).length;
}

/** Quantos dias corridos o período tem, inclusive nas duas pontas. */
export function contarDiasCorridos(inicio: string, fim: string): number {
  if (!inicio || !fim || fim < inicio) return 0;
  let cursor = inicio;
  let n = 0;
  while (cursor <= fim && n < DIAS_MAXIMOS) {
    n += 1;
    cursor = somarDias(cursor, 1);
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// A DIVISÃO — de um período para quatro fases
// ═══════════════════════════════════════════════════════════════════════════

export interface FaseDoCronograma {
  fase: Fase;
  inicio: string;
  fim: string;
  /** Dias úteis PRÓPRIOS desta fase. Zero quando ela divide o dia com outra. */
  diasUteis: number;
}

/**
 * Divide o período em quatro fases contíguas, por DIA ÚTIL.
 *
 * ── A REGRA DE DIVISÃO, E POR QUE ELA É IGUAL PARA AS QUATRO ──────────────
 * Cada fase recebe `piso(n/4)` dias úteis, e o resto vai para as PRIMEIRAS —
 * infraestrutura antes de acabamento. Não há peso por fase, e isso é uma
 * escolha declarada: pesos ("infraestrutura leva 40%") seriam um palpite meu
 * sobre a operação da Prever, e um palpite embutido no código é pior que uma
 * divisão óbvia que o usuário corrige. A divisão é o PONTO DE PARTIDA; as
 * quatro linhas nascem editáveis.
 *
 * ── O CASO DE MENOS DE QUATRO DIAS ÚTEIS ──────────────────────────────────
 * Uma instalação pequena cabe em dois dias. Aí não há como dar um dia próprio
 * a cada fase, e a saída honesta é deixá-las COMPARTILHAR o último dia
 * atribuído: `diasUteis` da fase vem 0, o início e o fim são o mesmo dia, e o
 * PDF mostra as quatro empilhadas — que é o que de fato acontece na obra.
 *
 * Devolve `[]` quando o período não tem NENHUM dia útil (um fim de semana
 * inteiro, por exemplo). Não é erro: é a informação de que não há obra a
 * planejar ali, e a tela diz isso em vez de desenhar um cronograma vazio.
 */
export function dividirEmFases(inicio: string, fim: string): FaseDoCronograma[] {
  const dias = diasUteis(inicio, fim);
  const n = dias.length;
  if (n === 0) return [];

  const base = Math.floor(n / 4);
  const resto = n % 4;

  const saida: FaseDoCronograma[] = [];
  let cursor = 0;
  for (let i = 0; i < FASES.length; i += 1) {
    const tamanho = base + (i < resto ? 1 : 0);
    if (tamanho > 0) {
      saida.push({
        fase: FASES[i],
        inicio: dias[cursor],
        fim: dias[cursor + tamanho - 1],
        diasUteis: tamanho,
      });
      cursor += tamanho;
    } else {
      // Sem dia próprio: divide o ÚLTIMO dia já atribuído. `cursor` aponta
      // para o primeiro dia não usado, então o último usado é cursor - 1 — e
      // quando nem isso existe (n < 4 e esta é a primeira fase sem dia), cai
      // no dia 0. O clamp é o que impede índice negativo.
      const idx = Math.min(Math.max(cursor - 1, 0), n - 1);
      saida.push({
        fase: FASES[i],
        inicio: dias[idx],
        fim: dias[idx],
        diasUteis: 0,
      });
    }
  }
  return saida;
}

// ═══════════════════════════════════════════════════════════════════════════
// A CONFERÊNCIA — o que o CHECK do banco não enxerga
// ═══════════════════════════════════════════════════════════════════════════

export type ProblemaCronograma =
  | { tipo: "fora_do_periodo"; fase: Fase }
  | { tipo: "invertida"; fase: Fase }
  | { tipo: "sobreposicao"; fase: Fase; anterior: Fase }
  | { tipo: "buraco"; fase: Fase; anterior: Fase; diasUteis: number }
  | { tipo: "fora_de_ordem"; fase: Fase; anterior: Fase }
  | { tipo: "faltando"; fase: Fase }
  | { tipo: "sem_dia_util" };

export interface LinhaCronograma {
  fase: Fase;
  inicio: string;
  fim: string;
}

/**
 * Confere um cronograma contra o período da obra.
 *
 * ── O QUE ESTA FUNÇÃO NÃO FAZ: RECUSAR ────────────────────────────────────
 * Ela devolve uma LISTA de problemas, e quem chama decide o que fazer. A tela
 * mostra os problemas como aviso e continua deixando salvar.
 *
 * A razão é a mesma que o Davi deu sobre o bloco isento de jornada em 02/09
 * ("não põe teto, confio na operação"), e sobre o carimbo antecipado
 * ("posso acabar fazendo algo antes da data agendada por diversos motivos e o
 * sistema não deve barrar isso"): o cronograma é um PLANO, não um registro. Um
 * buraco de três dias entre a instalação e a configuração pode ser a espera de
 * um equipamento, e recusá-lo obrigaria o Vinicius a mentir na data para
 * conseguir salvar. Aviso visível é a ferramenta certa; recusa não é.
 *
 * O que É recusado, e pelo banco: fase fora da lista, `fim < inicio`, e fase
 * repetida. Essas três são forma, não julgamento.
 */
export function conferirCronograma(
  linhas: LinhaCronograma[],
  periodoInicio: string,
  periodoFim: string,
): ProblemaCronograma[] {
  const problemas: ProblemaCronograma[] = [];

  if (contarDiasUteis(periodoInicio, periodoFim) === 0) {
    problemas.push({ tipo: "sem_dia_util" });
  }

  const porFase = new Map<Fase, LinhaCronograma>();
  for (const l of linhas) porFase.set(l.fase, l);

  for (const fase of FASES) {
    if (!porFase.has(fase)) problemas.push({ tipo: "faltando", fase });
  }

  // Percorre na ORDEM CANÔNICA (ordemDaFase), e não na ordem em que as linhas
  // chegaram: o array vem do banco sem ORDER BY garantido, e conferir
  // sequência na ordem de chegada acusaria "fora de ordem" numa obra perfeita.
  const ordenadas = FASES.map((f) => porFase.get(f)).filter(
    (l): l is LinhaCronograma => l !== undefined,
  );

  let anterior: LinhaCronograma | null = null;
  for (const l of ordenadas) {
    if (l.fim < l.inicio) problemas.push({ tipo: "invertida", fase: l.fase });

    if (
      periodoInicio &&
      periodoFim &&
      (l.inicio < periodoInicio || l.fim > periodoFim)
    ) {
      problemas.push({ tipo: "fora_do_periodo", fase: l.fase });
    }

    if (anterior) {
      if (l.inicio < anterior.inicio) {
        problemas.push({
          tipo: "fora_de_ordem",
          fase: l.fase,
          anterior: anterior.fase,
        });
      } else if (l.inicio < anterior.fim) {
        // `<` e não `<=`: duas fases no MESMO dia é o caso normal da obra
        // curta (ver dividirEmFases), e não um defeito. Sobreposição é a fase
        // seguinte começar ANTES de a anterior acabar.
        problemas.push({
          tipo: "sobreposicao",
          fase: l.fase,
          anterior: anterior.fase,
        });
      } else if (l.inicio > anterior.fim) {
        // Conta o buraco em dias ÚTEIS: um "buraco" que é só um fim de semana
        // não é buraco nenhum, e avisar sobre ele treinaria o usuário a
        // ignorar os avisos.
        const vao = contarDiasUteis(
          somarDias(anterior.fim, 1),
          somarDias(l.inicio, -1),
        );
        if (vao > 0) {
          problemas.push({
            tipo: "buraco",
            fase: l.fase,
            anterior: anterior.fase,
            diasUteis: vao,
          });
        }
      }
    }
    anterior = l;
  }

  return problemas;
}

export function textoDoProblema(p: ProblemaCronograma): string {
  switch (p.tipo) {
    case "sem_dia_util":
      return "O período não tem nenhum dia útil — só fim de semana e feriado.";
    case "faltando":
      return `A fase ${FASE_LABEL[p.fase]} não está no cronograma.`;
    case "invertida":
      return `${FASE_LABEL[p.fase]}: o fim é anterior ao início.`;
    case "fora_do_periodo":
      return `${FASE_LABEL[p.fase]} cai fora do período da obra.`;
    case "sobreposicao":
      return `${FASE_LABEL[p.fase]} começa antes de ${FASE_LABEL[p.anterior]} acabar.`;
    case "buraco":
      return `${p.diasUteis} dia(s) útil(eis) sem fase entre ${FASE_LABEL[p.anterior]} e ${FASE_LABEL[p.fase]}.`;
    case "fora_de_ordem":
      return `${FASE_LABEL[p.fase]} começa antes de ${FASE_LABEL[p.anterior]}.`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// O CALENDÁRIO — a matéria-prima do PDF
// ═══════════════════════════════════════════════════════════════════════════

export interface DiaDoCalendario {
  iso: string;
  /** 0 = domingo … 6 = sábado */
  diaDaSemana: number;
  util: boolean;
  /** A fase que ocupa este dia, ou null. Se mais de uma, a de menor ordem. */
  fase: Fase | null;
  /** Todas as fases que ocupam este dia — o caso da obra curta. */
  fases: Fase[];
}

export interface MesDoCalendario {
  /** "AAAA-MM" */
  referencia: string;
  ano: number;
  mes: number;
  dias: DiaDoCalendario[];
}

const MES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function rotuloDoMes(referencia: string): string {
  const mes = Number(referencia.slice(5, 7));
  const ano = referencia.slice(0, 4);
  return `${MES_LABEL[mes - 1] ?? referencia} de ${ano}`;
}

/**
 * Monta o calendário do período, mês a mês, com cada dia marcado pela fase que
 * o ocupa.
 *
 * ── SEM TETO DE MESES, E É DECISÃO ────────────────────────────────────────
 * O plano fala em "calendário de até 6 meses". Seis é o TAMANHO TÍPICO de uma
 * obra, não um limite do mecanismo, e transformar isso em recusa quebraria
 * exatamente a obra grande — a que mais precisa de cronograma impresso. Uma
 * obra de dez meses gera um PDF de dez blocos, e isso é visível e inofensivo.
 * Mesma razão que o Davi deu para não pôr teto no bloco isento.
 *
 * O que existe é `DIAS_MAXIMOS`, e ele não é regra de negócio: é o freio que
 * impede um `fim` digitado com o ano errado (2226 em vez de 2026) de travar a
 * aba num laço de setenta mil voltas.
 */
export function calendarioDoPeriodo(
  inicio: string,
  fim: string,
  linhas: LinhaCronograma[],
): MesDoCalendario[] {
  if (!inicio || !fim || fim < inicio) return [];

  const ordenadas = FASES.map((f) => linhas.find((l) => l.fase === f)).filter(
    (l): l is LinhaCronograma => l !== undefined,
  );

  const meses: MesDoCalendario[] = [];
  let atual: MesDoCalendario | null = null;
  let cursor = inicio;
  let guarda = 0;

  while (cursor <= fim && guarda < DIAS_MAXIMOS) {
    const referencia = cursor.slice(0, 7);
    if (!atual || atual.referencia !== referencia) {
      atual = {
        referencia,
        ano: Number(cursor.slice(0, 4)),
        mes: Number(cursor.slice(5, 7)),
        dias: [],
      };
      meses.push(atual);
    }

    const dentro = ordenadas
      .filter((l) => cursor >= l.inicio && cursor <= l.fim)
      .map((l) => l.fase);

    atual.dias.push({
      iso: cursor,
      diaDaSemana: diaDaSemana(cursor),
      util: ehDiaUtil(cursor),
      fase: dentro.length > 0 ? dentro[0] : null,
      fases: dentro,
    });

    cursor = somarDias(cursor, 1);
    guarda += 1;
  }

  return meses;
}

/**
 * Um mês do calendário quebrado em SEMANAS de sete colunas, domingo a sábado.
 *
 * As posições que o período não alcança vêm `null` — e vêm null de propósito,
 * em vez de serem preenchidas com o resto do mês. Uma obra que começa dia 20
 * ocupa a última semana de outubro, e imprimir os dias 1 a 19 com aparência de
 * calendário faria o leitor procurar a obra neles. O que a folha mostra é o
 * TEMPO DA OBRA, colocado nos dias da semana em que ele cai.
 */
export function semanasDoMes(mes: MesDoCalendario): Array<Array<DiaDoCalendario | null>> {
  if (mes.dias.length === 0) return [];
  const semanas: Array<Array<DiaDoCalendario | null>> = [];
  let atual: Array<DiaDoCalendario | null> = new Array(7).fill(null);
  let anterior = -1;
  for (const dia of mes.dias) {
    // Vira a semana quando o dia da semana ANDA PARA TRÁS.
    //
    // Comparar com `=== 0` (é domingo?) dá HOJE exatamente o mesmo resultado, e
    // vale registrar por quê em vez de fingir que a escolha se defende sozinha:
    // `calendarioDoPeriodo` entrega dias CONSECUTIVOS, e numa sequência
    // consecutiva o dia da semana só decresce em sábado → domingo — que é o
    // mesmo instante em que ele vale 0. A bateria de mutação trocou uma pela
    // outra e o verificador ficou verde, como tinha de ficar.
    //
    // A diferença aparece com entrada NÃO consecutiva, e é aí que `<= anterior`
    // ganha: numa lista só de dias úteis (sexta, depois segunda), `=== 0` não
    // veria domingo nenhum e jogaria a segunda na MESMA semana da sexta, uma
    // coluna à esquerda dela. Esta função é exportada; quem a chamar amanhã com
    // uma grade só de dias úteis recebe a resposta certa. A asserção do
    // verificador exercita justamente esse caso.
    if (anterior >= 0 && dia.diaDaSemana <= anterior) {
      semanas.push(atual);
      atual = new Array(7).fill(null);
    }
    atual[dia.diaDaSemana] = dia;
    anterior = dia.diaDaSemana;
  }
  semanas.push(atual);
  return semanas;
}

/** 0 = domingo … 6 = sábado, lido da data ISO sem passar por fuso. */
export function diaDaSemana(iso: string): number {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0).getDay();
}

// ═══════════════════════════════════════════════════════════════════════════
// O AVISO DOS ANOS NÃO CONFERIDOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Diz se TODO o período cai em anos cujos feriados foram conferidos por um
 * humano (`src/lib/feriados.ts`).
 *
 * Fora da janela conferida os feriados continuam sendo CALCULADOS — a Páscoa é
 * algorítmica e as datas fixas não mudam —, o que falta é a checagem contra as
 * leis daquele ano. Então isto é um AVISO, nunca uma recusa: planejar obra
 * para 2027 é legítimo, e o cronograma sai certo salvo um feriado novo que o
 * Congresso invente no meio do caminho.
 */
export function periodoConferido(inicio: string, fim: string): boolean {
  if (!inicio || !fim || fim < inicio) return true;
  const de = Number(inicio.slice(0, 4));
  const ate = Number(fim.slice(0, 4));
  for (let ano = de; ano <= ate; ano += 1) {
    if (!conferido(ano)) return false;
  }
  return true;
}

export function avisoDeAnoNaoConferido(inicio: string, fim: string): string | null {
  if (periodoConferido(inicio, fim)) return null;
  return `Os feriados só foram conferidos à mão de ${ANO_CONFERIDO_DESDE} a ${ANO_CONFERIDO_ATE}. Fora dessa janela eles continuam calculados, mas confira as datas antes de imprimir.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// O RESUMO — o que o cabeçalho do PDF e o card mostram
// ═══════════════════════════════════════════════════════════════════════════

export interface ResumoDaObra {
  diasCorridos: number;
  diasUteis: number;
  meses: number;
  /** Fases com `concluida_em` preenchido, sobre 4. */
  fasesConcluidas: number;
  /** 0 a 100, ou null quando não há cronograma. */
  pctConcluido: number | null;
}

export function resumirObra(
  inicio: string,
  fim: string,
  linhas: Array<LinhaCronograma & { concluida_em?: string | null }>,
): ResumoDaObra {
  const uteis = contarDiasUteis(inicio, fim);
  const concluidas = linhas.filter((l) => l.concluida_em).length;
  // Denominador é o número de fases PLANEJADAS, não a constante 4: uma obra
  // com três fases no banco e três concluídas está 100% pronta, e mostrar 75%
  // faria o Vinicius procurar uma quarta fase que ninguém planejou.
  const total = linhas.length;
  return {
    diasCorridos: contarDiasCorridos(inicio, fim),
    diasUteis: uteis,
    meses: calendarioDoPeriodo(inicio, fim, []).length,
    fasesConcluidas: concluidas,
    pctConcluido: total > 0 ? Math.round((concluidas / total) * 100) : null,
  };
}
