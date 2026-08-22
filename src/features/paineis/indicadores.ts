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
//   · onde o problema volta?         → reincidência por cliente
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

export type FaixaIdade = "0-7" | "8-15" | "16-30" | "31+";

export const FAIXA_IDADE_ORDEM: FaixaIdade[] = ["0-7", "8-15", "16-30", "31+"];

export const FAIXA_IDADE_LABEL: Record<FaixaIdade, string> = {
  "0-7": "0–7 dias", "8-15": "8–15 dias", "16-30": "16–30 dias", "31+": "31+ dias",
};

function faixaDeIdade(dias: number): FaixaIdade {
  if (dias <= 7) return "0-7";
  if (dias <= 15) return "8-15";
  if (dias <= 30) return "16-30";
  return "31+";
}

/**
 * O backlog em aberto, em 4 faixas de idade — o histograma que troca o card
 * de 3 números (Backlog) por um gráfico de verdade (R66): a pergunta não é
 * só "quantos passaram de 30 dias", é ONDE a fila está concentrada. Mesma
 * base (`abertosDeCampo`) e mesma conta de idade que `idadeMediana`.
 */
export function idadePorFaixa(
  chamados: ChamadoParaIndicador[],
  agora: Date = new Date(),
): { faixa: FaixaIdade; total: number }[] {
  const contagem: Record<FaixaIdade, number> = { "0-7": 0, "8-15": 0, "16-30": 0, "31+": 0 };
  for (const c of abertosDeCampo(chamados)) {
    const dias = (agora.getTime() - new Date(c.created_at).getTime()) / DIA;
    contagem[faixaDeIdade(dias)]++;
  }
  return FAIXA_IDADE_ORDEM.map((faixa) => ({ faixa, total: contagem[faixa] }));
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
