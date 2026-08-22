// Indicadores de campo — o cálculo, separado da tela.
//
// Puro de propósito: recebe as linhas e devolve números, sem React e sem
// consulta. É o que permite travar cada métrica com asserção — indicador que
// ninguém confere é indicador que mente sem ninguém notar, e um número errado
// num painel é pior que número nenhum, porque decisão vai ser tomada em cima.
//
// AS PERGUNTAS QUE ESTES NÚMEROS RESPONDEM (essa é a régua — indicador que não
// responde uma pergunta de gestão é enfeite):
//   · a fila está crescendo?         → saldo (entradas − saídas no mês)
//   · o que está encalhado?          → idade do backlog, e o mais velho
//   · estamos cumprindo prazo?       → % no prazo, entre as que tinham prazo
//   · quanto demoramos a COMEÇAR?    → tempo até o primeiro toque
//   · quem está sobrecarregado?      → carga por pessoa e o desvio entre elas
//   · quem está pedindo mais?        → chamados em aberto por cliente
//   · onde o problema volta?         → reincidência por cliente
//
// O MÓDULO CALCULA MAIS DO QUE UMA TELA MOSTRA, e isso é intencional: ele é
// a biblioteca de indicadores de campo, não o espelho do layout da vez.
// Hoje `idadeMediana`, `encalhados` e `reincidencia` não têm painel — saíram
// da tela em revisões de layout (R67/R68), não por deixarem de valer. Ficam
// aqui, puros e cobertos por asserção, prontos para o próximo painel.
//
// Duas escolhas que mudam o que o número significa:
//
// 1. TEMPO ATÉ COMEÇAR, não só tempo total. O tempo total (abertura →
//    conclusão) mistura "demoramos a ir" com "o serviço é demorado". Separar
//    os dois é o que distingue problema de agenda de problema de execução.
//
// 2. REINCIDÊNCIA por cliente em janela curta. É o indicador mais próximo de
//    "serviço mal feito" que dá para extrair sem inspeção humana: o mesmo
//    cliente voltando em menos de 30 dias com corretiva.

import { chamadoEmAberto, situacaoPrazo, type ChamadoStatus } from "@/lib/chamado-status";

/** O mínimo que o cálculo precisa de cada chamado. */
export interface ChamadoParaIndicador {
  id: string;
  status: string | null;
  tipo?: string | null;
  prioridade?: string | null;
  cliente_id?: string | null;
  responsavel_id?: string | null;
  prazo_limite?: string | null;
  created_at: string;
  iniciada_em?: string | null;
  finalizada_em?: string | null;
  fechada_em?: string | null;
  natureza?: string | null;
}

export interface Indicadores {
  /** em aberto agora */
  abertos: number;
  /** em aberto e com prazo já vencido */
  atrasados: number;
  /** em aberto sem ninguém responsável — trabalho que ninguém pegou */
  semResponsavel: number;
  /** em aberto com prioridade urgente */
  urgentes: number;
  /** abertos no mês corrente */
  entradasMes: number;
  /** concluídos no mês corrente */
  saidasMes: number;
  /** entradas − saídas: positivo = a fila cresceu no mês */
  saldoMes: number;
  /** dias do chamado aberto mais antigo (null se não há nenhum aberto) */
  idadeMaisVelho: number | null;
  /** mediana de dias em aberto — resiste a um outlier, ao contrário da média */
  idadeMediana: number | null;
  /** abertos há mais de 30 dias */
  encalhados: number;
  /** % concluído dentro do prazo, entre os que tinham prazo (null se nenhum) */
  pctNoPrazo: number | null;
  /** horas medianas da abertura até alguém começar (null se ninguém começou) */
  horasAteComecar: number | null;
  /** horas medianas do começo à conclusão */
  horasDeExecucao: number | null;
  /** carga em aberto por responsável, do maior para o menor */
  cargaPorPessoa: { pessoaId: string | null; total: number }[];
  /** clientes que voltaram com corretiva em menos de 30 dias */
  reincidencia: { clienteId: string; vezes: number }[];
  /** fila em aberto por status */
  porStatus: { status: ChamadoStatus; total: number }[];
}

function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

const DIA = 86_400_000;
const HORA = 3_600_000;

/** Janela da reincidência: dois chamados do mesmo cliente dentro dela contam. */
export const JANELA_REINCIDENCIA_DIAS = 30;

// a proposta comercial (U29) NÃO entra: ela é funil, não trabalho de campo.
// Misturar as duas faria "tempo médio de atendimento" somar negociação com
// conserto — dois relógios diferentes no mesmo número.
export function naturezaCampo<T extends ChamadoParaIndicador>(chamados: T[]): T[] {
  return chamados.filter((c) => c.natureza !== "comercial");
}

/** Em aberto, só campo — a base que os indicadores E os quadrados de KPI compartilham. */
export function abertosDeCampo<T extends ChamadoParaIndicador>(chamados: T[]): T[] {
  return naturezaCampo(chamados).filter((c) => chamadoEmAberto(c.status));
}

export type ChaveKpiOperacional = "abertos" | "sem_responsavel" | "urgentes" | "atrasados";

// A ordem de leitura do 2×2 (R66): azul → amarelo → laranja → vermelho, a
// MESMA rampa de severidade do PRISMA (DASHBOARD.md §5) — top-left é o mais
// frio, bottom-right é o que arde.
export const KPI_OPERACIONAL_ORDEM: ChaveKpiOperacional[] =
  ["abertos", "sem_responsavel", "urgentes", "atrasados"];

export const KPI_OPERACIONAL_LABEL: Record<ChaveKpiOperacional, string> = {
  abertos: "Chamados em aberto",
  sem_responsavel: "Sem responsável",
  urgentes: "Urgentes",
  atrasados: "Prazo estourado",
};

/**
 * O que cada quadrado de KPI conta — e a MESMA função que a lista de
 * chamados usa quando um quadrado está filtrando (R66, o mesmo gesto da
 * Início/R60: "quem conta é quem filtra"). `calcularIndicadores` chama esta
 * função para os 4 números; não existe uma segunda cópia do predicado
 * escondida ali — foi assim que um painel já disse um número com a lista
 * mostrando outro.
 */
export function chamadosDoKpi<T extends ChamadoParaIndicador>(
  chave: ChaveKpiOperacional,
  chamados: T[],
  agora: Date = new Date(),
): T[] {
  const abertos = abertosDeCampo(chamados);
  switch (chave) {
    case "abertos": return abertos;
    case "sem_responsavel": return abertos.filter((c) => !c.responsavel_id);
    case "urgentes": return abertos.filter((c) => c.prioridade === "urgente");
    case "atrasados": return abertos.filter((c) => situacaoPrazo(c.prazo_limite, c.status, agora) === "estourado");
  }
}

export function calcularIndicadores(
  chamados: ChamadoParaIndicador[],
  agora: Date = new Date(),
): Indicadores {
  const campo = naturezaCampo(chamados);

  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const abertos = chamadosDoKpi("abertos", chamados, agora);

  const entradasMes = campo.filter((c) => new Date(c.created_at) >= inicioMes).length;
  const saidasMes = campo.filter(
    (c) => c.finalizada_em && new Date(c.finalizada_em) >= inicioMes,
  ).length;

  const idades = abertos.map((c) => (agora.getTime() - new Date(c.created_at).getTime()) / DIA);

  // Cumprimento de prazo: só entre os que TINHAM prazo e foram concluídos.
  // Contar os sem prazo como "no prazo" inflaria o número — e um indicador que
  // se elogia sozinho é o pior tipo de indicador.
  const concluidosComPrazo = campo.filter((c) => c.finalizada_em && c.prazo_limite);
  const noPrazo = concluidosComPrazo.filter(
    (c) => new Date(c.finalizada_em as string) <= new Date(c.prazo_limite as string),
  ).length;

  const ateComecar = campo
    .filter((c) => c.iniciada_em)
    .map((c) => (new Date(c.iniciada_em as string).getTime() - new Date(c.created_at).getTime()) / HORA)
    .filter((h) => h >= 0);

  const execucao = campo
    .filter((c) => c.iniciada_em && c.finalizada_em)
    .map((c) =>
      (new Date(c.finalizada_em as string).getTime() - new Date(c.iniciada_em as string).getTime()) / HORA)
    .filter((h) => h >= 0);

  const carga = new Map<string | null, number>();
  for (const c of abertos) {
    const k = c.responsavel_id ?? null;
    carga.set(k, (carga.get(k) ?? 0) + 1);
  }

  // Reincidência: corretivas do mesmo cliente com menos de 30 dias entre uma e
  // a seguinte. Conta os PARES próximos, não o total do cliente — quem tem 10
  // chamados espalhados no ano não é reincidência, é cliente grande.
  const porCliente = new Map<string, number[]>();
  for (const c of campo) {
    if (c.tipo !== "corretiva" || !c.cliente_id) continue;
    (porCliente.get(c.cliente_id) ?? porCliente.set(c.cliente_id, []).get(c.cliente_id)!)
      .push(new Date(c.created_at).getTime());
  }
  const reincidencia: { clienteId: string; vezes: number }[] = [];
  for (const [clienteId, datas] of porCliente) {
    const o = datas.sort((a, b) => a - b);
    let pares = 0;
    for (let i = 1; i < o.length; i++) {
      if (o[i] - o[i - 1] <= JANELA_REINCIDENCIA_DIAS * DIA) pares++;
    }
    if (pares > 0) reincidencia.push({ clienteId, vezes: pares });
  }

  const statusVistos = new Map<string, number>();
  for (const c of abertos) {
    const s = c.status ?? "";
    statusVistos.set(s, (statusVistos.get(s) ?? 0) + 1);
  }

  return {
    abertos: abertos.length,
    atrasados: chamadosDoKpi("atrasados", chamados, agora).length,
    semResponsavel: chamadosDoKpi("sem_responsavel", chamados, agora).length,
    urgentes: chamadosDoKpi("urgentes", chamados, agora).length,
    entradasMes,
    saidasMes,
    saldoMes: entradasMes - saidasMes,
    idadeMaisVelho: idades.length ? Math.floor(Math.max(...idades)) : null,
    idadeMediana: idades.length ? Math.round(mediana(idades) as number) : null,
    encalhados: idades.filter((d) => d > 30).length,
    pctNoPrazo: concluidosComPrazo.length
      ? Math.round((noPrazo / concluidosComPrazo.length) * 100)
      : null,
    horasAteComecar: ateComecar.length ? Math.round(mediana(ateComecar) as number) : null,
    horasDeExecucao: execucao.length ? Math.round(mediana(execucao) as number) : null,
    cargaPorPessoa: Array.from(carga, ([pessoaId, total]) => ({ pessoaId, total }))
      .sort((a, b) => b.total - a.total),
    reincidencia: reincidencia.sort((a, b) => b.vezes - a.vezes),
    porStatus: Array.from(statusVistos, ([status, total]) => ({ status: status as ChamadoStatus, total }))
      .sort((a, b) => b.total - a.total),
  };
}

/**
 * Chamados EM ABERTO por cliente — só quem TEM (R68).
 *
 * O Map só ganha chave de cliente que apareceu, então cliente sem chamado
 * aberto simplesmente não existe no resultado: é o "aparecendo dinamicamente
 * somente os clientes que têm chamado aberto" do pedido, sem precisar de uma
 * lista de clientes para cruzar.
 *
 * `clienteId: null` é o balde de quem não tem cliente amarrado, e ele FICA.
 * Descartá-lo faria as barras somarem menos que "chamados em aberto" — o
 * gráfico sumindo com trabalho em silêncio, que é o defeito que a régua
 * deste módulo proíbe. A tela pinta esse balde em neutro, como faz com "Sem
 * técnico".
 *
 * Mesma base dos quatro KPIs (`abertosDeCampo`), de propósito: a soma das
 * barras é exatamente `indicadores.abertos`, e isso é travado por asserção.
 */
export function abertosPorCliente<T extends ChamadoParaIndicador>(
  chamados: T[],
): { clienteId: string | null; total: number }[] {
  const porCliente = new Map<string | null, number>();
  for (const c of abertosDeCampo(chamados)) {
    const k = c.cliente_id ?? null;
    porCliente.set(k, (porCliente.get(k) ?? 0) + 1);
  }
  return Array.from(porCliente, ([clienteId, total]) => ({ clienteId, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * A LENTE da lista de chamados (R73).
 *
 * Nasceu de um defeito real: as 227 OS retroativas entraram concluídas, e a
 * tela — que listava só o que está EM ABERTO — não tinha como mostrá-las.
 * Nenhuma outra tinha: o Painel de chamados também só lista aberto, e a
 * Início poda encerrado com mais de 7 dias. O histórico existia no banco e
 * não existia em lugar nenhum da interface.
 *
 * "Em aberto" continua sendo o padrão — esta é a tela de quem coordena o
 * dia. As outras duas lentes existem para conferir e para consultar.
 */
export type LenteLista = "abertos" | "concluidos" | "todos";

export const LENTE_ORDEM: LenteLista[] = ["abertos", "concluidos", "todos"];

export const LENTE_LABEL: Record<LenteLista, string> = {
  abertos: "Em aberto",
  concluidos: "Concluídos",
  todos: "Todos",
};

/** O que cada lente mostra — e o que conta o número do chip dela. */
export function chamadosDaLente<T extends ChamadoParaIndicador>(
  lente: LenteLista,
  chamados: T[],
  agora: Date = new Date(),
): T[] {
  switch (lente) {
    case "abertos": return chamadosDoKpi("abertos", chamados, agora);
    case "concluidos": return naturezaCampo(chamados).filter((c) => c.status === "concluido");
    case "todos": return naturezaCampo(chamados);
  }
}

/**
 * As colunas do KANBAN do Painel Operacional (R76).
 *
 * Davi, 2026-08-22: "Não agendados · Agendados · Atrasados · Concluídos. O
 * status cancelado não tem necessidade de aparecer."
 *
 * Elas NÃO são o campo `status` — são a leitura operacional dele cruzada com
 * agendamento e prazo. "Atrasado" não existe como status no banco (é
 * `situacaoPrazo`), e "não agendado" é a ausência de `data_hora_agendada`.
 * Derivar aqui, numa função só, é o que impede a tela de reimplementar essa
 * conta e discordar do resto do painel.
 */
export type ColunaOperacional = "nao_agendado" | "agendado" | "atrasado" | "concluido";

export const COLUNA_OP_ORDEM: ColunaOperacional[] = [
  "nao_agendado", "agendado", "atrasado", "concluido",
];

export const COLUNA_OP_LABEL: Record<ColunaOperacional, string> = {
  nao_agendado: "Não agendados",
  agendado: "Agendados",
  atrasado: "Atrasados",
  concluido: "Concluídos",
};

/**
 * Em que coluna o chamado cai — ou `null` quando ele não pertence ao quadro.
 *
 * A ORDEM DOS TESTES É A REGRA, e cada degrau tem motivo:
 *   1. cancelado sai do quadro (pedido explícito) — e sai ANTES de tudo,
 *      senão um cancelado sem prazo cairia em "não agendado";
 *   2. concluído é destino final: não interessa se o prazo estourou no
 *      caminho, ele já acabou;
 *   3. ATRASADO vence AGENDADO. Um chamado marcado para terça que venceu
 *      continua marcado — se "agendado" ganhasse, o atraso desapareceria
 *      atrás de uma data, que é exatamente o que a coluna existe para
 *      denunciar;
 *   4. tem data marcada → agendado; não tem → não agendado.
 */
export function colunaOperacional(
  c: ChamadoParaIndicador & { data_hora_agendada?: string | null },
  agora: Date = new Date(),
): ColunaOperacional | null {
  if (c.status === "cancelado") return null;
  if (c.status === "concluido") return "concluido";
  if (situacaoPrazo(c.prazo_limite, c.status, agora) === "estourado") return "atrasado";
  return c.data_hora_agendada ? "agendado" : "nao_agendado";
}

/** Os chamados de campo agrupados nas quatro colunas, na ordem de leitura. */
export function agruparPorColuna<T extends ChamadoParaIndicador & { data_hora_agendada?: string | null }>(
  chamados: T[],
  agora: Date = new Date(),
): Record<ColunaOperacional, T[]> {
  const balde: Record<ColunaOperacional, T[]> = {
    nao_agendado: [], agendado: [], atrasado: [], concluido: [],
  };
  for (const c of naturezaCampo(chamados)) {
    const col = colunaOperacional(c, agora);
    if (col) balde[col].push(c);
  }
  // dentro da coluna: quem está em aberto vem por urgência de prazo; o
  // concluído, pelo mais recente — a mesma régua das duas ordens da lista
  for (const k of COLUNA_OP_ORDEM) {
    balde[k] = k === "concluido" ? ordenarHistorico(balde[k]) : ordenarChamados(balde[k], agora);
  }
  return balde;
}

/**
 * A ordem do HISTÓRICO: o mais recente primeiro.
 *
 * `ordenarChamados` não serve aqui — ela ordena por urgência de prazo, e
 * chamado encerrado não tem urgência: os 227 importados nem prazo têm, então
 * todos empatariam e a lista sairia na ordem em que o banco devolveu.
 * "Quando foi" é a única pergunta que se faz de um histórico.
 */
export function ordenarHistorico<T extends ChamadoParaIndicador>(chamados: T[]): T[] {
  const quando = (c: T) =>
    new Date(c.finalizada_em ?? c.fechada_em ?? c.created_at).getTime();
  return [...chamados].sort((a, b) => quando(b) - quando(a));
}

/**
 * A ordem da lista de chamados (R66): atrasado primeiro — é o que pede ação
 * agora —, depois por prazo mais próximo. Sem prazo vai para o FIM, não
 * para o início: não tem urgência para anunciar, então não empurra quem tem.
 */
export function ordenarChamados<T extends ChamadoParaIndicador>(
  chamados: T[],
  agora: Date = new Date(),
): T[] {
  const peso = (c: T) => {
    const sit = situacaoPrazo(c.prazo_limite, c.status, agora);
    if (sit === "estourado") return 0;
    if (sit === "proximo") return 1;
    if (sit === "no_prazo") return 2;
    return 3; // sem_prazo / encerrado
  };
  return [...chamados].sort((a, b) => {
    const diferenca = peso(a) - peso(b);
    if (diferenca !== 0) return diferenca;
    const da = a.prazo_limite ? new Date(a.prazo_limite).getTime() : Infinity;
    const db = b.prazo_limite ? new Date(b.prazo_limite).getTime() : Infinity;
    return da - db;
  });
}

/** Horas em texto curto: 6h, 2d, 3d 4h — o painel não tem espaço para frase. */
export function horasTexto(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
}
