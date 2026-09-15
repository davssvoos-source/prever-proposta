// As contas do dashboard do Painel Comercial (R302) — separadas da pintura.
//
// Mesmo padrão de features/home/metricas.ts e features/paineis/indicadores.ts:
// função pura, sem React, sem `Date.now()` — "agora" chega por parâmetro, para
// o verificador fixar o relógio e conferir os baldes com um lote de fixtures.
// Número de painel que ninguém confere é número que mente sem ninguém notar.
//
// O VOCABULÁRIO (R302, Davi, 15/09/2026):
//   · "proposta enviada" = `proposta_enviada_em` preenchido (R64: o ciclo
//     encerra no envio; aceite do cliente não é mapeado);
//   · "tipo de serviço" = `servicos_propostos`, a lista de sete de
//     servicosPropostos.ts, NORMALIZADA — visitas antigas gravaram chaves
//     legadas (implantacao_cftv…) que virariam fatias duplicadas;
//   · uma proposta com dois serviços conta nas DUAS fatias: a rosca responde
//     "quantas propostas ofereceram X", e o número de propostas está no funil.
//
// A INVARIANTE (DASHBOARD.md §7.2): o que a tela mostra sai daqui, e o filtro
// de Tipo de serviço da página passa pela MESMA `normalizarServicosPropostos`
// que monta a rosca — filtrar por CFTV e a fatia de CFTV nunca discordam.

import {
  inicioSemana, inicioMes, mesesAdiante, competencia, dataIso, rotuloReferencia,
} from "@/lib/periodos";
import { etapaDaVisita, funilComercial } from "@/features/comercial/etapas";
import {
  SERVICOS_PROPOSTOS, normalizarServicosPropostos, type ServicoPropostoKey,
} from "@/features/visitas/servicosPropostos";

/** O mínimo de uma linha de `visitas_tecnicas` para o dashboard contar. */
export interface PropostaParaMetrica {
  status: string | null;
  proposta_enviada_em: string | null;
  servicos_propostos?: string[] | null;
  /** quando a visita foi marcada — o ponto de partida do "tempo até o envio" */
  data_hora_agendada?: string | null;
  /** o plano B do ponto de partida, para visita sem data marcada */
  created_at?: string | null;
}

export type TipoPeriodo = "semana" | "mes";

/** Quantas barras o gráfico tem — as últimas 12 semanas OU os últimos 12 meses, incluindo o corrente. */
export const PERIODOS_NO_GRAFICO = 12;

export interface Periodo {
  /** semana: a segunda-feira em AAAA-MM-DD local · mês: a competência "AAAA-MM" */
  chave: string;
  /** o que vai no eixo: "05/10" (a segunda da semana) ou "out" ("jan/26" na virada do ano e na primeira barra) */
  rotulo: string;
  /** o que vai na dica: "semana de 05/10/2026" ou "outubro/2026" */
  rotuloLongo: string;
  /** o período corrente — a última barra */
  atual: boolean;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const z = (n: number) => String(n).padStart(2, "0");

/**
 * O balde de um instante ISO no eixo escolhido.
 *
 * Semana = segunda-feira ISO em data local (o mesmo `chaveSemanaDe` da Início);
 * mês = competência. Os dois em relógio LOCAL: uma proposta enviada às 23h de
 * 31/10 é de outubro para quem a enviou — `toISOString()` a jogaria para
 * novembro.
 */
export function chaveDoPeriodo(iso: string, tipo: TipoPeriodo): string {
  const d = new Date(iso);
  return tipo === "semana" ? dataIso(inicioSemana(d)) : competencia(d);
}

/**
 * Os últimos N períodos, do mais antigo ao corrente — a série tem SEMPRE N
 * pontos, para a barra de valor zero aparecer (uma semana sem proposta é
 * informação, não ausência de linha).
 *
 * Meses andam por `mesesAdiante`, nunca `setMonth` (P21: 31/01 − 1 mês em
 * `setMonth` cai em 3 de janeiro… do jeito errado). A base é o dia 1, então
 * não há nem o que aparar — mas a regra da casa é uma só.
 */
export function periodosRecentes(tipo: TipoPeriodo, agora: Date, quantos = PERIODOS_NO_GRAFICO): Periodo[] {
  const out: Periodo[] = [];
  if (tipo === "semana") {
    const base = inicioSemana(agora);
    for (let i = 0; i < quantos; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - (quantos - 1 - i) * 7);
      out.push({
        chave: dataIso(d),
        rotulo: `${z(d.getDate())}/${z(d.getMonth() + 1)}`,
        rotuloLongo: `semana de ${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`,
        atual: i === quantos - 1,
      });
    }
    return out;
  }
  const base = inicioMes(agora);
  for (let i = 0; i < quantos; i++) {
    const d = mesesAdiante(base, -(quantos - 1 - i));
    const comp = competencia(d);
    const mes = d.getMonth();
    // o ano só aparece onde ancora a leitura: na primeira barra e em janeiro
    const rotulo = i === 0 || mes === 0
      ? `${MESES_CURTOS[mes]}/${String(d.getFullYear()).slice(2)}`
      : MESES_CURTOS[mes];
    out.push({ chave: comp, rotulo, rotuloLongo: rotuloReferencia(comp), atual: i === quantos - 1 });
  }
  return out;
}

export interface PontoDaSerie extends Periodo {
  valor: number;
}

/**
 * (1) PROPOSTAS ENVIADAS POR PERÍODO — uma barra por semana ou por mês.
 *
 * Conta `proposta_enviada_em` no balde do envio; o que caiu fora da janela
 * (mais antigo que o primeiro período, ou no futuro por relógio errado) não
 * entra em barra nenhuma. Devolve os N pontos SEMPRE, com zero onde não houve.
 */
export function enviadasPorPeriodo(
  propostas: PropostaParaMetrica[], tipo: TipoPeriodo, agora: Date, quantos = PERIODOS_NO_GRAFICO,
): PontoDaSerie[] {
  const periodos = periodosRecentes(tipo, agora, quantos);
  const m: Record<string, number> = {};
  for (const p of propostas) {
    if (!p.proposta_enviada_em) continue;
    const k = chaveDoPeriodo(p.proposta_enviada_em, tipo);
    m[k] = (m[k] ?? 0) + 1;
  }
  return periodos.map((per) => ({ ...per, valor: m[per.chave] ?? 0 }));
}

export interface FatiaDeServico {
  chave: ServicoPropostoKey;
  rotulo: string;
  valor: number;
  /**
   * O passo da rampa é a POSIÇÃO do serviço na lista oficial, não a posição na
   * rosca: CFTV é sempre o mesmo tom, tenha ou não Alarmes ao lado dele hoje.
   * Cor é identidade da fatia, e identidade que muda quando a vizinha some
   * é identidade nenhuma.
   */
  passo: number;
}

export interface RoscaDeServicos {
  /** só os serviços com pelo menos uma proposta, na ordem da lista oficial */
  fatias: FatiaDeServico[];
  /** o número do meio da rosca — propostas, não fatias (uma proposta pode estar em duas) */
  totalEnviadas: number;
  /** enviadas cujo `servicos_propostos` não tem nenhuma chave conhecida — a fatia NEUTRA, fora da rampa */
  semServico: number;
}

/**
 * (2) PROPOSTAS ENVIADAS POR TIPO DE SERVIÇO — as fatias da rosca.
 *
 * Passa por `normalizarServicosPropostos`: "implantacao_cftv" e "cftv" são a
 * MESMA fatia. Uma proposta com dois serviços conta nas duas (R302) — por isso
 * a soma das fatias pode passar de `totalEnviadas`, e é `totalEnviadas` que vai
 * no centro da rosca.
 */
export function enviadasPorServico(propostas: PropostaParaMetrica[]): RoscaDeServicos {
  const contagem = new Map<ServicoPropostoKey, number>();
  let totalEnviadas = 0;
  let semServico = 0;
  for (const p of propostas) {
    if (!p.proposta_enviada_em) continue;
    totalEnviadas++;
    const chaves = normalizarServicosPropostos(p.servicos_propostos);
    if (chaves.length === 0) { semServico++; continue; }
    for (const k of chaves) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const fatias: FatiaDeServico[] = [];
  SERVICOS_PROPOSTOS.forEach((s, i) => {
    const valor = contagem.get(s.key) ?? 0;
    if (valor > 0) fatias.push({ chave: s.key, rotulo: s.label, valor, passo: i });
  });
  return { fatias, totalEnviadas, semServico };
}

/**
 * O FILTRO DE TIPO DE SERVIÇO da página (R302) — a MESMA normalização da rosca.
 *
 * Nada escolhido = tudo (a promessa da tela continua sendo a lista inteira).
 * Com escolha, fica quem ofereceu PELO MENOS UM dos serviços marcados — é o
 * "OU" que o filtro múltiplo da Início também faz. Vale para o dashboard, a
 * lista e o quadro: o painel do SAC sempre filtrou a página inteira (R8).
 */
export function filtrarPorServico<T extends { servicos_propostos?: string[] | null }>(
  visitas: T[], selecionados: string[],
): T[] {
  if (selecionados.length === 0) return visitas;
  const marcados = new Set(selecionados);
  return visitas.filter((v) => normalizarServicosPropostos(v.servicos_propostos).some((k) => marcados.has(k)));
}

/**
 * Quantos meses FECHADOS entram na média M-12 — "trailing twelve months" é
 * doze meses inteiros, e o corrente ainda não é um.
 */
export const MESES_DA_MEDIA = 12;

export interface KpisComerciais {
  /** enviadas nos 12 meses FECHADOS antes do corrente ÷ 12 — uma casa decimal */
  mediaPorMes: number;
  /** enviadas ÷ visitas do funil, em %; null sem visita nenhuma */
  taxaVisitaProposta: number | null;
  /** dias da visita marcada ao envio, média das enviadas com as duas datas; null sem amostra */
  tempoMedioDias: number | null;
  /** aprovadas sem proposta — a etapa "falta_proposta" de `etapaDaVisita` */
  aguardandoEnvio: number;
}

const DIA_MS = 86_400_000;

/**
 * (4) OS QUATRO KPIs (R302). "Ticket médio" NÃO está aqui de propósito: o
 * valor da proposta nasce em gerarProposta.ts e não é gravado em coluna
 * nenhuma — inventar o número seria fingir um dado que não existe.
 *
 * · média por mês (M-12): os doze meses FECHADOS antes do corrente — o mês
 *   em curso fica de fora do numerador E do divisor. Com ele dentro, no dia 1º
 *   o balde corrente valeria ~0 e ainda dividiria por 12: a média cairia todo
 *   começo de mês sem que nada tivesse mudado no comercial. O gráfico continua
 *   mostrando o corrente (parcial, sinalizado como `atual`) — são perguntas
 *   diferentes: "como vai este mês" e "qual é o ritmo";
 * · taxa visita → proposta: o funil em porcentagem (`funilComercial`);
 * · tempo médio: `proposta_enviada_em − data_hora_agendada` (ou created_at,
 *   sem data marcada). Envio antes da visita é data digitada errada — fica
 *   fora da média em vez de puxá-la para baixo;
 * · aguardando envio: `etapaDaVisita(...) === "falta_proposta"` — quem conta é
 *   quem filtra (a coluna do quadro usa a mesma função).
 */
export function kpisComerciais(propostas: PropostaParaMetrica[], agora: Date): KpisComerciais {
  // o último mês fechado é o anterior ao corrente: a janela são os 12 que
  // terminam nele (`mesesAdiante` no dia 1, sem transbordo — P21)
  const ultimoFechado = mesesAdiante(inicioMes(agora), -1);
  const meses = enviadasPorPeriodo(propostas, "mes", ultimoFechado, MESES_DA_MEDIA);
  const somaMeses = meses.reduce((s, m) => s + m.valor, 0);
  const mediaPorMes = Math.round((somaMeses / MESES_DA_MEDIA) * 10) / 10;

  const funil = funilComercial(propostas);
  const taxaVisitaProposta = funil.visitas > 0 ? Math.round((funil.enviadas / funil.visitas) * 100) : null;

  const amostras: number[] = [];
  for (const p of propostas) {
    if (!p.proposta_enviada_em) continue;
    const partida = p.data_hora_agendada ?? p.created_at;
    if (!partida) continue;
    const dias = (new Date(p.proposta_enviada_em).getTime() - new Date(partida).getTime()) / DIA_MS;
    if (Number.isNaN(dias) || dias < 0) continue;
    amostras.push(dias);
  }
  const tempoMedioDias = amostras.length > 0
    ? Math.round((amostras.reduce((s, d) => s + d, 0) / amostras.length) * 10) / 10
    : null;

  const aguardandoEnvio = propostas.filter((p) => etapaDaVisita(p) === "falta_proposta").length;

  return { mediaPorMes, taxaVisitaProposta, tempoMedioDias, aguardandoEnvio };
}

/**
 * A COR DE CADA BARRA DO TEMPO — a rampa INVERTIDA (DASHBOARD.md §5): o
 * passado é quente, o corrente é o amarelo da marca. A Início faz o mesmo com
 * oito semanas e um futuro azul; aqui não há futuro, então as doze barras
 * percorrem só a metade quente — do vermelho (passo 7) ao amarelo (passo 3) —
 * e o azul fica de fora, que é onde ele estaria: adiante.
 *
 * Devolve o passo de `paradasBarra` (0..PECAS_ESPECTRO−1). Com mais barras que
 * passos, barras vizinhas partilham um tom — o degradê continua contínuo.
 */
export function passoDoPeriodo(indice: number, total: number): number {
  const PASSO_PASSADO = 7;   // a ponta vermelha da rampa
  const PASSO_ATUAL = 3;     // o amarelo do coração do degradê
  if (total <= 1) return PASSO_ATUAL;
  const t = Math.min(Math.max(indice, 0), total - 1) / (total - 1);
  return Math.round(PASSO_PASSADO - t * (PASSO_PASSADO - PASSO_ATUAL));
}
