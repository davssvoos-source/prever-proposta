// ═══════════════════════════════════════════════════════════════════════════
// O PAINEL DO PLANTÃO — lógica pura (R122, U91, Fase 5)
//
// A escala (`sobreaviso`, R116/U86) guarda o PLANO: quem DEVERIA estar. O
// atendimento (`atendimentos_plantao`, R117/U87) guarda o REGISTRO: quem de
// fato atendeu, a que horas, e o quê. Este módulo é o cruzamento dos dois — e
// é o único lugar do repositório que sabe fazê-lo. A tela não calcula nada
// (docs/manual/operacao-campo.md:89-90).
//
// ── O QUE ELE NÃO REINVENTA ───────────────────────────────────────────────
// A pergunta "esta pessoa estava na escala?" JÁ TEM RESPOSTA neste projeto, e
// ela tem TRÊS estados, não dois: `avisoDaEscala` (./modelo.ts) distingue
// `ok`, `fora` e `sem_escala`, com a razão escrita — colapsar os dois últimos
// acusaria o plantonista de furar uma escala que ninguém lançou, que é
// acusação sobre o trabalho de outro.
//
// O painel CHAMA aquela função e conta os vereditos dela. Não reimplementa a
// comparação: um contador que dissesse "fora da escala" onde o cartão diz "não
// há escala lançada" seria a segunda resposta para a mesma pergunta, e as duas
// discordariam no dia em que a doutrina mudasse num lugar só.
// ═══════════════════════════════════════════════════════════════════════════

import { avisoDaEscala, type TomDoAviso, type TipoDoAtendimento } from "./modelo";
import { diasDoMes } from "@/features/sobreaviso/modelo";
import { ehDiaUtil } from "@/lib/feriados";

// ═══════════════════════════════════════════════════════════════════════════
// A HORA, EM SÃO PAULO — e por que NÃO é a `horaCurta` do modelo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A hora do instante, de 0 a 23, no fuso de São Paulo.
 *
 * ── POR QUE NÃO REUSAR `horaCurta` ────────────────────────────────────────
 * `horaCurta` (./modelo.ts:302) formata no fuso DO APARELHO, e isso está
 * certo lá: a lista é lida pelo próprio plantonista, no mesmo aparelho em que
 * ele digitou, e formatar com fuso fixo faria a lista mostrar uma hora e o
 * campo de edição outra, no mesmo cartão.
 *
 * Aqui a pergunta é outra. Um painel CLASSIFICA — madrugada, expediente,
 * noite — e a classificação não pode depender de onde está o aparelho de quem
 * abriu a tela. O `dia` do atendimento já é projetado pelo gatilho em
 * America/Sao_Paulo (U87); a FAIXA tem de sair do mesmo fuso, senão o mesmo
 * atendimento cai na madrugada para o Davi e no expediente para alguém em
 * outro lugar — e o número do painel deixaria de ser um fato.
 *
 * A divergência com `horaCurta` é DELIBERADA e está escrita aqui para não ser
 * "unificada" depois por quem só vir as duas funções lado a lado.
 */
export function horaEmSaoPaulo(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const h = partes.find((p) => p.type === "hour")?.value;
    if (h === undefined) return null;
    const n = Number(h);
    // `hour12: false` devolve "24" para a meia-noite em algumas versões do
    // ICU — o famoso h24 × h23. `% 24` corrige sem depender da versão, e a
    // asserção do verificador prende a meia-noite em 0.
    //
    // O `: null` É INALCANÇÁVEL HOJE — `formatToParts` devolve dígitos — e
    // fica de propósito. A bateria de mutação trocou este `null` por `0` e
    // NADA ficou vermelho, porque não há entrada que chegue aqui com `h`
    // não-numérico: é mutante EQUIVALENTE, não buraco de teste. Se um dia
    // chegar, `0` viraria meia-noite e o atendimento seria contado como
    // madrugada — o painel inventaria um horário em vez de admitir que não
    // sabe. Não "simplifique" para `return n % 24`.
    return Number.isFinite(n) ? n % 24 : null;
  } catch {
    // Runtime sem ICU completo não conhece nomes de fuso. Devolver a hora do
    // aparelho aqui seria pior que devolver nada: o painel mostraria uma
    // distribuição plausível e ERRADA, e ninguém desconfiaria de um número
    // que parece certo. `null` faz a faixa virar `null`, e a tela conta
    // separado — ver `KpisDoPlantao.semHora`.
    return null;
  }
}

export type FaixaDoDia = "madrugada" | "expediente" | "noite";

export const FAIXA_LABEL: Record<FaixaDoDia, string> = {
  madrugada: "Madrugada (00h–08h)",
  expediente: "Expediente (08h–18h)",
  noite: "Noite (18h–24h)",
};

/**
 * Em que pedaço do dia o atendimento caiu.
 *
 * Os cortes NÃO são números soltos: 8 e 18 são as bordas do expediente que o
 * sobreaviso já declara (`HORAS_EXPEDIENTE = 10`, "08:00 às 18:00", e
 * `HORAS_MADRUGADA = 8`, "00:00 às 08:00"). O painel usa a MESMA régua que a
 * grade usa para dizer quanto um dia precisa de cobertura.
 */
export function faixaDaHora(iso: string): FaixaDoDia | null {
  const h = horaEmSaoPaulo(iso);
  if (h === null) return null;
  if (h < 8) return "madrugada";
  if (h < 18) return "expediente";
  return "noite";
}

// ═══════════════════════════════════════════════════════════════════════════
// AS FORMAS
// ═══════════════════════════════════════════════════════════════════════════

export interface AtendimentoParaPainel {
  id: string;
  /** timestamptz — o instante, já truncado ao minuto pelo gatilho. */
  hora: string;
  /** A projeção do gatilho em America/Sao_Paulo. */
  dia: string;
  plantonista_id: string | null;
  tipo: TipoDoAtendimento | string;
  cliente_id: string | null;
  cliente_informado: string | null;
  chamado_id: string | null;
}

export interface EscalaParaPainel {
  dia: string;
  pessoa_id: string;
  horas: number;
}

export interface KpisDoPlantao {
  total: number;
  remoto: number;
  presencial: number;
  comChamado: number;
  semChamado: number;
  madrugada: number;
  expediente: number;
  noite: number;
  /** Instante ilegível ou runtime sem fuso nomeado — ver `horaEmSaoPaulo`. */
  semHora: number;
  naEscala: number;
  foraDaEscala: number;
  semEscala: number;
  /**
   * Atendimentos no EXPEDIENTE de um DIA ÚTIL. Não é erro: o plantonista pode
   * atender às 10h de uma terça. Mas é a faixa em que a equipe deveria estar
   * respondendo, e um número alto aqui diz que o plantão está cobrindo o
   * horário comercial — que é uma conversa de operação, não de escala.
   */
  emHorarioDeEquipe: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// O CRUZAMENTO — e ele delega a decisão, não a repete
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O veredito de UM atendimento contra a escala do dia dele.
 *
 * Monta a mesma pergunta que a RPC de registro monta e entrega a
 * `avisoDaEscala`, lendo só o `tom`. É por isso que o painel e o cartão do
 * plantonista NUNCA podem discordar: existe uma função que decide, e as duas
 * telas a chamam.
 */
export function tomDoAtendimento(
  a: AtendimentoParaPainel,
  escala: EscalaParaPainel[],
): TomDoAviso {
  const doDia = escala.filter((e) => e.dia === a.dia);
  const somar = (linhas: EscalaParaPainel[]) =>
    linhas.reduce((t, e) => t + (Number.isFinite(e.horas) ? e.horas : 0), 0);
  return avisoDaEscala({
    atendimento_id: a.id,
    dia_do_plantao: a.dia,
    hora_gravada: a.hora,
    horas_escaladas: a.plantonista_id
      ? somar(doDia.filter((e) => e.pessoa_id === a.plantonista_id))
      : 0,
    horas_do_dia: somar(doDia),
  }).tom;
}

export function kpisDoPlantao(
  atendimentos: AtendimentoParaPainel[],
  escala: EscalaParaPainel[],
): KpisDoPlantao {
  const k: KpisDoPlantao = {
    total: atendimentos.length,
    remoto: 0, presencial: 0, comChamado: 0, semChamado: 0,
    madrugada: 0, expediente: 0, noite: 0, semHora: 0,
    naEscala: 0, foraDaEscala: 0, semEscala: 0, emHorarioDeEquipe: 0,
  };
  for (const a of atendimentos) {
    if (a.tipo === "remoto") k.remoto += 1;
    else if (a.tipo === "presencial") k.presencial += 1;

    if (a.chamado_id) k.comChamado += 1; else k.semChamado += 1;

    const faixa = faixaDaHora(a.hora);
    if (faixa === null) k.semHora += 1;
    else {
      k[faixa] += 1;
      if (faixa === "expediente" && ehDiaUtil(a.dia)) k.emHorarioDeEquipe += 1;
    }

    const tom = tomDoAtendimento(a, escala);
    if (tom === "ok") k.naEscala += 1;
    else if (tom === "fora") k.foraDaEscala += 1;
    else k.semEscala += 1;
  }
  return k;
}

// ═══════════════════════════════════════════════════════════════════════════
// OS RANKINGS
// ═══════════════════════════════════════════════════════════════════════════

export interface LinhaDeRanking {
  chave: string;
  rotulo: string;
  total: number;
  /** Só no ranking de plantonista: quantos daqueles atendimentos estavam na escala. */
  naEscala?: number;
}

/**
 * A ORDENAÇÃO É TOTAL, e isso não é preciosismo.
 *
 * `sort` só é estável dentro de um mesmo motor e de uma mesma versão. Empate
 * resolvido por contagem apenas faria duas pessoas com 3 atendimentos trocarem
 * de lugar entre um render e outro, e um ranking que dança sem que o dado mude
 * ensina a não confiar nele. O desempate é pelo RÓTULO, e depois pela CHAVE —
 * duas pessoas homônimas ainda ficam numa ordem fixa.
 */
function ordenarRanking(linhas: LinhaDeRanking[]): LinhaDeRanking[] {
  return [...linhas].sort(
    (a, b) =>
      b.total - a.total ||
      a.rotulo.localeCompare(b.rotulo, "pt-BR") ||
      a.chave.localeCompare(b.chave),
  );
}

export function porPlantonista(
  atendimentos: AtendimentoParaPainel[],
  escala: EscalaParaPainel[],
  nomes: Record<string, string>,
): LinhaDeRanking[] {
  const mapa = new Map<string, LinhaDeRanking>();
  for (const a of atendimentos) {
    // SEM PLANTONISTA É UMA LINHA, NÃO UM SUMIÇO. `plantonista_id` é
    // `ON DELETE RESTRICT` (U87), então isto só acontece se alguém gravar
    // NULL — e um atendimento que some do ranking é pior que um atendimento
    // sem dono nele.
    const chave = a.plantonista_id ?? "(sem plantonista)";
    const atual = mapa.get(chave) ?? {
      chave,
      rotulo: a.plantonista_id ? (nomes[a.plantonista_id] ?? "Sem nome") : "Sem plantonista",
      total: 0,
      naEscala: 0,
    };
    atual.total += 1;
    if (tomDoAtendimento(a, escala) === "ok") atual.naEscala = (atual.naEscala ?? 0) + 1;
    mapa.set(chave, atual);
  }
  return ordenarRanking([...mapa.values()]);
}

export function porCliente(
  atendimentos: AtendimentoParaPainel[],
  nomes: Record<string, string>,
): LinhaDeRanking[] {
  const mapa = new Map<string, LinhaDeRanking>();
  for (const a of atendimentos) {
    // O cliente pode ser CADASTRADO (`cliente_id`) ou INFORMADO à mão
    // (`cliente_informado`) — a U87 aceita as duas formas, e o CHECK garante
    // que é uma OU outra. O ranking respeita isso: o informado entra pelo
    // texto, normalizado, para "Padaria X" e "padaria x " não virarem duas
    // linhas de uma visita só.
    const informado = (a.cliente_informado ?? "").trim();
    const chave = a.cliente_id
      ? a.cliente_id
      : informado
        ? "informado:" + informado.toLocaleLowerCase("pt-BR")
        : "(sem cliente)";
    const rotulo = a.cliente_id
      ? (nomes[a.cliente_id] ?? "Cliente sem nome")
      : informado || "Sem cliente";
    const atual = mapa.get(chave) ?? { chave, rotulo, total: 0 };
    atual.total += 1;
    mapa.set(chave, atual);
  }
  return ordenarRanking([...mapa.values()]);
}

// ═══════════════════════════════════════════════════════════════════════════
// A SÉRIE DO MÊS — a matéria-prima do gráfico
// ═══════════════════════════════════════════════════════════════════════════

export interface PontoDoMes {
  iso: string;
  /** "01".."31" — o rótulo curto do eixo. */
  dia: string;
  util: boolean;
  total: number;
  madrugada: number;
  expediente: number;
  noite: number;
  /** Horas de sobreaviso lançadas para o dia, somando todo mundo. */
  horasDeEscala: number;
}

/**
 * Todos os dias do mês, inclusive os ZERADOS.
 *
 * Um gráfico montado só com os dias que tiveram atendimento comprime o eixo e
 * mente sobre o ritmo: três chamadas em três dias seguidos e três chamadas
 * espalhadas pelo mês viram a mesma figura. `diasDoMes` (do sobreaviso) é o
 * mesmo gerador que a grade usa, então painel e grade têm exatamente as mesmas
 * colunas — e é isso que deixa comparar um com o outro na mesma tela.
 */
export function serieDoMes(
  mes: string,
  atendimentos: AtendimentoParaPainel[],
  escala: EscalaParaPainel[],
): PontoDoMes[] {
  const porDia = new Map<string, AtendimentoParaPainel[]>();
  for (const a of atendimentos) {
    const lista = porDia.get(a.dia);
    if (lista) lista.push(a); else porDia.set(a.dia, [a]);
  }
  const horas = new Map<string, number>();
  for (const e of escala) {
    horas.set(e.dia, (horas.get(e.dia) ?? 0) + (Number.isFinite(e.horas) ? e.horas : 0));
  }
  return diasDoMes(mes).map((iso) => {
    const doDia = porDia.get(iso) ?? [];
    const conta = (f: FaixaDoDia) => doDia.filter((a) => faixaDaHora(a.hora) === f).length;
    return {
      iso,
      dia: iso.slice(8, 10),
      util: ehDiaUtil(iso),
      total: doDia.length,
      madrugada: conta("madrugada"),
      expediente: conta("expediente"),
      noite: conta("noite"),
      horasDeEscala: horas.get(iso) ?? 0,
    };
  });
}

/**
 * O DIA MAIS PESADO DO MÊS, e `null` quando não houve nenhum atendimento.
 *
 * `null` e não "dia 1 com zero": um painel que aponta um dia campeão de zero
 * atendimentos é um painel que inventa um fato. A tela decide o que dizer no
 * vazio — e "vazio" aqui é MESMO vazio, porque quem lê a lista já separou
 * erro de leitura de ausência de dado (a lição da U86).
 */
export function diaMaisPesado(serie: PontoDoMes[]): PontoDoMes | null {
  let melhor: PontoDoMes | null = null;
  for (const p of serie) {
    if (p.total === 0) continue;
    if (melhor === null || p.total > melhor.total) melhor = p;
  }
  return melhor;
}
