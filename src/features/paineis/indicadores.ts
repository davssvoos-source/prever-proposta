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

export function calcularIndicadores(
  chamados: ChamadoParaIndicador[],
  agora: Date = new Date(),
): Indicadores {
  // a proposta comercial (U29) NÃO entra: ela é funil, não trabalho de campo.
  // Misturar as duas faria "tempo médio de atendimento" somar negociação com
  // conserto — dois relógios diferentes no mesmo número.
  const campo = chamados.filter((c) => c.natureza !== "comercial");

  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const abertos = campo.filter((c) => chamadoEmAberto(c.status));

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
    atrasados: abertos.filter(
      (c) => situacaoPrazo(c.prazo_limite, c.status, agora) === "estourado",
    ).length,
    semResponsavel: abertos.filter((c) => !c.responsavel_id).length,
    urgentes: abertos.filter((c) => c.prioridade === "urgente").length,
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

/** Horas em texto curto: 6h, 2d, 3d 4h — o painel não tem espaço para frase. */
export function horasTexto(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
}
