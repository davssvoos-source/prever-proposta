// Sobreaviso — a lógica PURA (R116, U86).
//
// A TELA NÃO CALCULA. Tudo o que é conta mora aqui: a cobertura esperada de um
// dia, os oito números da semana padrão, a decisão do que fazer com o que já
// está preenchido, a projeção da grade e o veredito de cobertura. A grade e o
// PDF são projeções DESTE arquivo; o celular é uma TERCEIRA projeção da MESMA
// chamada (ver `gradeDoMes`).
//
// ── A UNIDADE DO DADO: UMA LINHA POR (DIA, PESSOA), HORAS ESCALAR ──────────
// Não é um mês por linha com um vetor de 31 posições, e não é um intervalo
// (dia, inicio_min, fim_min). As duas alternativas foram consideradas:
//
//  · O VETOR MENSAL tem uma virtude só — "uma linha, uma transação" — e ela é
//    FALSA no caso principal. A unidade de DECISÃO é a semana, a de RELATÓRIO
//    é a competência, e a semana padrão tem OITO dias de calendário: 12 das 52
//    segundas de um ano têm o oitavo dia no mês seguinte. Isso não é acidente
//    de 2026: todo mês contém exatamente uma segunda nos seus últimos sete
//    dias, então são 12 por ano, para sempre. Um vetor mensal precisaria de
//    duas linhas e duas transações em 23% das aplicações do gesto mais usado
//    da tela. O DIA é a única unidade que é subconjunto tanto da semana quanto
//    do mês.
//  · O INTERVALO já foi recusado pela U78 (`docs/PLANO_UNIFICACAO.md:5033`),
//    por ser fatal para plantão que atravessa a meia-noite.
//
// CUSTO ASSUMIDO, dito em voz alta: o escalar NÃO sabe a hora do handover.
// Se um dia precisar, o conserto é `RENAME horas TO minutos` + ×60 + CHECK
// novo — três linhas, uma vez, com o histórico inteiro dentro.
//
// ── CÉLULA VAZIA É AUSÊNCIA DE LINHA ───────────────────────────────────────
// `CHECK (horas > 0 AND horas <= 24)` no banco; zerar é DELETE. Isso mata a
// tricotomia 0 / NULL / ausente antes que ela exista — um `horas = 0` gravado
// seria invisível para a tela (que o leria como vazio) e VISÍVEL para o teste
// de colisão do gesto em massa, que é exatamente onde uma diferença silenciosa
// custa caro.

import { ehDiaUtil, ehFeriado, ehFimDeSemana, rotuloDoDia, somarDias } from "@/lib/feriados";

// ═══════════════════════════════════════════════════════════════════════════
// AS TRÊS CONSTANTES, E A CONTA QUE SAI DELAS
// ═══════════════════════════════════════════════════════════════════════════

/** Um dia tem 24 horas. O teto de uma célula é isto, e o CHECK do banco é o mesmo número. */
export const HORAS_MAX = 24;

/** O expediente normal: 08:00 às 18:00. Nele quem atende é a equipe, não o plantonista. */
export const HORAS_EXPEDIENTE = 10;

/** 00:00 às 08:00 — o pedaço do dia que sempre é sobreaviso, inclusive em dia útil. */
export const HORAS_MADRUGADA = 8;

/** A semana padrão vai de segunda 18:00 a segunda 08:00: OITO dias de calendário. */
export const DIAS_DO_PADRAO = 8;

/**
 * Quantas horas de sobreaviso um dia PRECISA ter para estar coberto.
 *
 * DERIVADA, não transcrita: `24 − (é dia útil ? 10 : 0)`. Dia útil = 14 (a
 * madrugada de 8h mais a noite de 6h); fim de semana e feriado = 24 (não há
 * expediente para descontar). Escrever `util ? 14 : 24` daria o mesmo número
 * hoje e esconderia de onde ele vem — é a diferença que
 * `src/features/programacao/modelo.ts:105` (`CAMPO_MIN = JORNADA_MIN −
 * RESERVA_MIN`) argumenta em prosa, e a doutrina da casa é a conta.
 *
 * Fim de semana e FERIADO valem o mesmo: 24. É por isso que a grade dá UMA
 * lavagem só para "não é dia útil" — o que os distingue é o NOME no `title`,
 * que cor nenhuma transporta.
 */
export function coberturaDoDia(dia: string): number {
  return HORAS_MAX - (ehDiaUtil(dia) ? HORAS_EXPEDIENTE : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// A SEMANA PADRÃO
// ═══════════════════════════════════════════════════════════════════════════

export interface CelulaDoPadrao {
  /** AAAA-MM-DD. */
  dia: string;
  /** Quanto ESTE plantonista cobre neste dia. */
  horas: number;
  /**
   * Nas duas pontas, quanto do dia pertence ao plantonista VIZINHO (o que sai
   * na segunda de entrada, o que entra na segunda de saída). No miolo é `null`
   * — o dia inteiro é desta pessoa.
   *
   * INVARIANTE, e ela é a razão de o campo existir:
   *   `horas + (absorve ?? 0) === coberturaDoDia(dia)` em TODAS as oito
   *   células. É `absorve` que permite ao gesto em massa distinguir "aqui já
   *   está a metade do vizinho, some" de "aqui está outra coisa, pergunte".
   */
  absorve: number | null;
}

/**
 * Os oito números de "aplicar semana padrão", a partir de uma SEGUNDA.
 *
 * Segunda 18:00 → segunda 08:00. Em semana sem feriado dá
 * 6 + 14×4 + 24×2 + 8 = **118 horas**, e a conta fecha por outro caminho
 * também: 14×5 dias úteis + 24×2 de fim de semana = 118.
 *
 * COM FERIADO NO MEIO ele NÃO dá 118, e isso é o certo: um feriado na terça
 * transforma 14 em 24, e a semana passa a 128. O número 118 é consequência do
 * calendário, não uma meta a bater.
 *
 * NENHUMA CÉLULA SAI ZERO, por construção: a cobertura mínima é 14 e a
 * madrugada é 8, então a ponta de entrada é no mínimo 6 e a de saída é sempre
 * 8. Uma célula 0 gravada seria vazia para a tela e preenchida para a colisão.
 */
export function semanaPadrao(segunda: string): CelulaDoPadrao[] {
  const out: CelulaDoPadrao[] = [];
  for (let i = 0; i < DIAS_DO_PADRAO; i++) {
    const dia = somarDias(segunda, i);
    const cobertura = coberturaDoDia(dia);
    // Entrada: a madrugada (00:00–08:00) desta segunda é do plantonista que SAI.
    // Saída: só a madrugada é deste plantonista; o resto do dia é do que ENTRA.
    const horas = i === 0
      ? cobertura - HORAS_MADRUGADA
      : i === DIAS_DO_PADRAO - 1
        ? HORAS_MADRUGADA
        : cobertura;
    const ponta = i === 0 || i === DIAS_DO_PADRAO - 1;
    out.push({ dia, horas, absorve: ponta ? cobertura - horas : null });
  }
  return out;
}

/** A soma das oito células — 118 numa semana sem feriado. */
export function totalDoPadrao(celulas: CelulaDoPadrao[]): number {
  return celulas.reduce((s, c) => s + c.horas, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// O GESTO DESTRUTIVO: O QUE FAZER COM O QUE JÁ ESTÁ PREENCHIDO
// ═══════════════════════════════════════════════════════════════════════════
//
// NENHUMA DAS TRÊS RESPOSTAS ÓBVIAS ACERTA. O caso que as derruba é a mesma
// pessoa em duas semanas seguidas: na segunda de virada ela já tem as 8h de
// madrugada que a semana ANTERIOR gravou, e a semana nova quer pôr 6h de noite.
//   · sobrescrever → 6, e perdem-se as 8h da madrugada;
//   · "só preenche vazio" → 8, e perdem-se as 6h da noite;
//   · perguntar sempre → pergunta no caso em que a resposta é óbvia, e treina
//     todo mundo a clicar "sim" sem ler, que é como o gesto vira silencioso.
// O certo é SOMAR até o teto: 8 + 6 = 14 = a cobertura daquela segunda.
//
// Daí as quatro ações NOMEADAS. Elas são o contrato entre esta função e a RPC
// `sobreaviso_aplicar_padrao` — o mesmo CASE, na mesma ordem, e o verificador
// mede o acordo exercitando os dois lados.

export type AcaoDoPadrao = "inserir" | "igual" | "somar" | "trocar";

export interface DecisaoDaCelula {
  acao: AcaoDoPadrao;
  /** O que a célula vale DEPOIS, se a aplicação for confirmada. */
  depois: number;
}

/**
 * O que acontece com uma célula quando a semana padrão passa por cima dela.
 *
 * A ORDEM DOS RAMOS É REGRA, e não estilo:
 *   1. vazio            → `inserir`
 *   2. já é o valor     → `igual`   (idempotência da primeira aplicação)
 *   3. é o pedaço do vizinho e cabe no teto → `somar`
 *   4. já é a soma      → `igual`   (idempotência da SEGUNDA aplicação — sem
 *                                    este ramo, reaplicar uma semana já somada
 *                                    cairia em `trocar` e o gesto pediria
 *                                    confirmação para não fazer nada)
 *   5. qualquer outra coisa → `trocar` (o único que exige confirmação)
 *
 * O ramo 3 tem de vir ANTES do 4: os dois olham `absorve`, e trocá-los faria o
 * caso da virada cair no lugar errado quando `horas` fosse zero — que não
 * acontece hoje (ver `semanaPadrao`) e não pode passar a acontecer em silêncio.
 */
export function acaoDoPadrao(
  antes: number | null | undefined,
  horas: number,
  absorve: number | null | undefined,
): DecisaoDaCelula {
  if (antes === null || antes === undefined) return { acao: "inserir", depois: horas };
  if (antes === horas) return { acao: "igual", depois: antes };
  if (absorve !== null && absorve !== undefined) {
    if (antes === absorve && antes + horas <= HORAS_MAX) return { acao: "somar", depois: antes + horas };
    if (antes === horas + absorve) return { acao: "igual", depois: antes };
  }
  return { acao: "trocar", depois: horas };
}

/**
 * O gesto vai perder dado que ninguém pediu para perder? Só `trocar` perde.
 *
 * NÃO existe uma "prévia local" neste modelo, e isso é decisão: quem monta a
 * prévia é a RPC, no MESMO instantâneo em que escreveria. Uma segunda prévia
 * calculada no app leria um cache e poderia discordar da escrita — e discordaria
 * justamente nas 12 semanas por ano que atravessam o mês, onde o outro lado da
 * fronteira pode nem estar carregado. Esta função CLASSIFICA a resposta que veio
 * do banco; ela não a reproduz.
 */
export function precisaConfirmar(decisoes: { acao: AcaoDoPadrao }[]): boolean {
  return decisoes.some((d) => d.acao === "trocar");
}

/** As frases das quatro ações, para a tabela de confirmação. Sem "tem certeza?". */
export const ACAO_LABEL: Record<AcaoDoPadrao, string> = {
  inserir: "preenche (estava vazio)",
  igual: "já está assim — nada muda",
  somar: "soma ao plantão que já estava",
  trocar: "SUBSTITUI o que está lá",
};

// ═══════════════════════════════════════════════════════════════════════════
// A GRADE DO MÊS
// ═══════════════════════════════════════════════════════════════════════════

export interface LinhaSobreaviso {
  dia: string;
  pessoa_id: string;
  horas: number;
  origem: string;
}

export interface PessoaCandidata {
  id: string;
  nome: string | null;
  ativo: boolean | null;
  /** `NOT NULL DEFAULT 'ativo'` no banco desde 2026-06-29; o `| null` é só o types.ts atrasado. */
  status: string | null;
  cargo: string | null;
}

export interface PessoaDaGrade {
  id: string;
  nome: string;
  /**
   * Está na grade só porque tem horas gravadas neste mês — saiu da empresa, ou
   * está pendente de aprovação. Aparece ESMAECIDA e não recebe célula nova.
   */
  historico: boolean;
}

/**
 * QUEM APARECE NA GRADE: quem pode ser escalado HOJE, mais quem tem horas
 * gravadas NESTE mês.
 *
 * ZERO literal de `cargo`, e é decisão. O CHECK vivo de `profiles.cargo` é
 * `cargo IS NULL OR cargo IN ('admin','comercial','sac','tecnico')`
 * (`20260818230000_u6a_papel_sac.sql:43`). Filtrar por `'tecnico'` tiraria da
 * escala o coordenador que atende às 2h da manhã — e ele atende. E `NULL` é o
 * convidado que ainda não tem papel: ele TEM linha em `profiles` e não pode ser
 * escalado, o que já é dito pelos outros dois eixos.
 *
 * OS DOIS EIXOS QUE VALEM: `ativo` (quem saiu da empresa) e `status`
 * (`pendente_aprovacao` é convite não aceito). A comparação é
 * `!== "pendente_aprovacao"` e não `=== "ativo"` de propósito: excluir O VALOR
 * QUE SE QUER EXCLUIR sobrevive a um status novo; `=== "ativo"` excluiria
 * qualquer valor futuro sem ninguém decidir isso.
 *
 * QUEM SAI DA EMPRESA NÃO SOME DO HISTÓRICO. Sai das grades futuras, continua
 * nas passadas, esmaecido. É o `ON DELETE RESTRICT` da FK contado em pixels.
 *
 * E NÃO HÁ SELEÇÃO MANUAL POR MÊS: seria uma quarta lista de gente, que é
 * exatamente a colisão de vocabulário que esta entrega recusou ao não criar
 * `funcionarios`.
 */
export function pessoasDaGrade(
  candidatas: PessoaCandidata[],
  linhas: LinhaSobreaviso[],
): PessoaDaGrade[] {
  const comHoras = new Set(linhas.map((l) => l.pessoa_id));
  const out: PessoaDaGrade[] = [];
  for (const p of candidatas) {
    const escalavel = p.ativo === true && p.status !== "pendente_aprovacao";
    if (!escalavel && !comHoras.has(p.id)) continue;
    out.push({ id: p.id, nome: p.nome?.trim() || "(sem nome)", historico: !escalavel });
  }
  // Quem pode ser escalado primeiro; dentro de cada bloco, por nome.
  out.sort((a, b) =>
    a.historico !== b.historico
      ? (a.historico ? 1 : -1)
      : a.nome.localeCompare(b.nome, "pt-BR"));
  return out;
}

/**
 * Todos os dias do mês, INCONDICIONALMENTE — 28, 29, 30 ou 31 colunas.
 *
 * É o OPOSTO de `diasDaGrade` (`src/features/programacao/modelo.ts`), que
 * esconde fim de semana sem nada marcado. Lá o fim de semana é exceção; aqui
 * ele é 48 das 118 horas da semana, e esconder uma coluna vazia esconderia
 * justamente o buraco de cobertura que a grade existe para mostrar.
 */
export function diasDoMes(competencia: string): string[] {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) return [];
  const quantos = new Date(ano, mes, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= quantos; d++) {
    out.push(`${competencia}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

export type VereditoDoDia = "vazio" | "curto" | "ok" | "sobra";

/**
 * O dia está coberto?
 *
 * `sobra` NÃO é erro: a PK (dia, pessoa_id) aceita N pessoas no mesmo dia, e
 * escalar dois de propósito é decisão legítima da operação. É veredito, e o
 * que ele diz é "aqui há mais horas contratadas do que o dia tem".
 */
export function vereditoDoDia(somado: number, cobertura: number): VereditoDoDia {
  if (somado === 0) return "vazio";
  if (somado < cobertura) return "curto";
  if (somado === cobertura) return "ok";
  return "sobra";
}

export const VEREDITO_LABEL: Record<VereditoDoDia, string> = {
  vazio: "sem ninguém",
  curto: "falta cobertura",
  ok: "coberto",
  sobra: "mais de um plantonista",
};

export interface ColunaDoMes {
  dia: string;
  /** 1..31, para o cabeçalho. */
  numero: number;
  /** 0 = domingo. */
  diaDaSemana: number;
  fimDeSemana: boolean;
  feriado: boolean;
  /** Falso em fim de semana E em feriado — a lavagem da grade sai daqui. */
  util: boolean;
  /** O nome do feriado / facultativo, para o `title`. Nulo em dia comum. */
  rotulo: string | null;
  cobertura: number;
  somado: number;
  veredito: VereditoDoDia;
}

export interface CelulaDaGrade {
  dia: string;
  horas: number | null;
  origem: string | null;
}

export interface LinhaDaGrade {
  pessoa: PessoaDaGrade;
  celulas: CelulaDaGrade[];
  /** O total do MÊS daquela pessoa — a entrada de folha. */
  total: number;
}

export interface GradeDoMes {
  competencia: string;
  colunas: ColunaDoMes[];
  linhas: LinhaDaGrade[];
  /** A soma de tudo o que está na grade. */
  total: number;
  /** Quantos dias do mês estão em cada veredito. É o censo da faixa de cobertura. */
  censo: Record<VereditoDoDia, number>;
}

/**
 * A projeção do mês inteiro — chamada UMA VEZ, nos dois viewports.
 *
 * UMA ESTRUTURA, DUAS PROJEÇÕES (a doutrina de
 * `src/features/programacao/ColunaDoDia.tsx`): o desktop desenha todas as
 * colunas; o celular faz `.find(c => c.dia === diaEscolhido)` sobre ESTE
 * resultado. O celular NUNCA chama `gradeDoMes` com um dia só — se chamasse, o
 * total do mês viraria o total do dia e o número passaria a mentir com a
 * mesma cara.
 */
export function gradeDoMes(
  competencia: string,
  candidatas: PessoaCandidata[],
  linhas: LinhaSobreaviso[],
): GradeDoMes {
  const dias = diasDoMes(competencia);
  const doMes = linhas.filter((l) => l.dia.slice(0, 7) === competencia);
  const pessoas = pessoasDaGrade(candidatas, doMes);

  const porChave = new Map<string, LinhaSobreaviso>();
  for (const l of doMes) porChave.set(`${l.dia}|${l.pessoa_id}`, l);

  const colunas: ColunaDoMes[] = dias.map((dia) => {
    const somado = doMes.reduce((s, l) => (l.dia === dia ? s + l.horas : s), 0);
    const cobertura = coberturaDoDia(dia);
    return {
      dia,
      numero: Number(dia.slice(8, 10)),
      diaDaSemana: new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)), 12).getDay(),
      fimDeSemana: ehFimDeSemana(dia),
      feriado: ehFeriado(dia),
      util: ehDiaUtil(dia),
      rotulo: rotuloDoDia(dia),
      cobertura,
      somado,
      veredito: vereditoDoDia(somado, cobertura),
    };
  });

  const linhasDaGrade: LinhaDaGrade[] = pessoas.map((pessoa) => {
    const celulas = dias.map((dia) => {
      const achou = porChave.get(`${dia}|${pessoa.id}`);
      return { dia, horas: achou ? achou.horas : null, origem: achou ? achou.origem : null };
    });
    return { pessoa, celulas, total: celulas.reduce((s, c) => s + (c.horas ?? 0), 0) };
  });

  const censo: Record<VereditoDoDia, number> = { vazio: 0, curto: 0, ok: 0, sobra: 0 };
  for (const c of colunas) censo[c.veredito] += 1;

  return {
    competencia,
    colunas,
    linhas: linhasDaGrade,
    total: linhasDaGrade.reduce((s, l) => s + l.total, 0),
    censo,
  };
}

/**
 * A projeção do CELULAR: quem está de sobreaviso num dia.
 *
 * Recebe a grade JÁ MONTADA — nunca o `competencia` de um dia só. Devolve
 * apenas quem tem horas, porque "quem está de plantão hoje" é normalmente uma
 * pessoa, e uma lista de trinta nomes com um número preenchido não é resposta.
 */
export function plantaoDoDia(
  grade: GradeDoMes,
  dia: string,
): { coluna: ColunaDoMes | null; quem: { pessoa: PessoaDaGrade; horas: number }[] } {
  const coluna = grade.colunas.find((c) => c.dia === dia) ?? null;
  const quem: { pessoa: PessoaDaGrade; horas: number }[] = [];
  for (const l of grade.linhas) {
    const cel = l.celulas.find((c) => c.dia === dia);
    if (cel && cel.horas !== null && cel.horas > 0) quem.push({ pessoa: l.pessoa, horas: cel.horas });
  }
  quem.sort((a, b) => b.horas - a.horas || a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR"));
  return { coluna, quem };
}

/** "2026-08" → "agosto de 2026". (`rotuloReferencia` diz "agosto/2026"; a barra do mês é frase.) */
export function rotuloDaCompetencia(competencia: string): string {
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mes = Number(competencia.slice(5, 7));
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return competencia;
  return `${nomes[mes - 1]} de ${competencia.slice(0, 4)}`;
}

/** Competência anterior / seguinte, sem sair de AAAA-MM. */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const d = new Date(ano, mes - 1 + meses, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A JANELA DE LEITURA É DE TRÊS MESES, e não do mês aberto.
 *
 * Porque a semana padrão ATRAVESSA: 12 das 52 segundas de um ano têm o oitavo
 * dia no mês seguinte. Ler só o mês aberto faria o gesto em massa decidir
 * `inserir` numa célula que já existe do outro lado da fronteira — e o gesto
 * mais destrutivo da tela passaria a mentir na prévia justamente nos 23% dos
 * casos em que ele é mais perigoso.
 */
export function janelaDaCompetencia(competencia: string): { de: string; ate: string } {
  const anterior = deslocarCompetencia(competencia, -1);
  const seguinte = deslocarCompetencia(competencia, 1);
  const dias = diasDoMes(seguinte);
  return { de: `${anterior}-01`, ate: dias[dias.length - 1] ?? `${seguinte}-28` };
}

/** A segunda-feira da semana ISO de um dia, em ISO. A porta do gesto em massa. */
export function segundaDaSemana(dia: string): string {
  const d = new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)), 12);
  const dow = d.getDay();
  return somarDias(dia, dow === 0 ? -6 : 1 - dow);
}
