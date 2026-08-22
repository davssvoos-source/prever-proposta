// As contas dos painéis do topo da Início — separadas da pintura.
//
// Mesmo padrão de features/paineis/indicadores.ts: função pura, sem React,
// para poder ser travada com asserção. Número de painel que ninguém confere é
// número que mente sem ninguém notar — e aqui já aconteceu duas vezes (ver
// os comentários de cada função).

import type { Atividade } from "@/features/atividades/modelo";
import { inicioSemana, dataIso } from "@/lib/periodos";
import { SPRINTS_DO_MES } from "@/lib/chamado-status";

/**
 * Quantos foram concluídos em cada semana, das PRÓPRIAS atividades.
 *
 * Era uma consulta à parte que trazia só `concluida_em` — números prontos, que
 * os filtros do quadro não tinham como recortar. Filtrar o futuro e não o
 * passado deixaria metade do gráfico respondendo ao filtro e metade não, que é
 * pior do que não filtrar nada: o mesmo gráfico contaria duas histórias.
 */
/** A chave de semana usada em TODO o painel: segunda-feira, AAAA-MM-DD local. */
export function chaveSemanaDe(iso: string): string {
  return dataIso(inicioSemana(new Date(iso)));
}

// Os DOIS predicados das barras — o de contar e o de filtrar são o MESMO
// (R65): a barra do passado conta entregas da semana, a do futuro conta
// prazos em aberto da semana. `atividadesDaSemana` (o clique) filtra por
// estes exatos predicados, então o número da barra e a lista que ela abre
// não têm como discordar.
function ehConcluidaDaSemana(a: Atividade, chave: string): boolean {
  // `encerradoEm` é null enquanto está em aberto, e cancelar não é entregar
  if (!a.encerradoEm || a.coluna === "cancelado") return false;
  return chaveSemanaDe(a.encerradoEm) === chave;
}
function ehPrevistaDaSemana(a: Atividade, chave: string): boolean {
  if (!a.emAberto || !a.prazoLimite) return false;
  return chaveSemanaDe(a.prazoLimite) === chave;
}

export function concluidosPorSemana(atividades: Atividade[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const a of atividades) {
    if (!a.encerradoEm || a.coluna === "cancelado") continue;
    const k = chaveSemanaDe(a.encerradoEm);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

/**
 * O lado FUTURO do gráfico de barras: quantos itens em aberto vencem em cada
 * semana. Morava inline no GraficoDemanda — extraído (R65) para o clique na
 * barra filtrar pela MESMA conta que a desenhou.
 */
export function prazosPorSemana(atividades: Atividade[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const a of atividades) {
    if (!a.emAberto || !a.prazoLimite) continue;
    const k = chaveSemanaDe(a.prazoLimite);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

/** As atividades de UMA barra — passado = entregas da semana, futuro = prazos. */
export function atividadesDaSemana(
  chave: string,
  passado: boolean,
  atividades: Atividade[],
): Atividade[] {
  return atividades.filter((a) => (passado ? ehConcluidaDaSemana(a, chave) : ehPrevistaDaSemana(a, chave)));
}

/**
 * A meta do mês: o que está no prato deste mês e o que já saiu dele.
 *
 * Era uma consulta presa ao `userId` — o painel mostrava a meta de quem estava
 * logado mesmo com o quadro filtrado por outra pessoa: dois números na mesma
 * tela falando de gente diferente. Contando do recorte, filtrar por Erik
 * mostra a meta do Erik e "todos" mostra a da casa.
 *
 * A ETIQUETA DE SPRINT ENVELHECE. "Este mês" no Notion é um rótulo que ninguém
 * volta para tirar: no export de 2026-08-21 havia 7 atividades marcadas "este
 * mês" concluídas em junho e julho. Contadas pela etiqueta, apareceriam como
 * entregas de agosto — a meta comemorando trabalho de dois meses atrás. Então
 * a etiqueta diz a INTENÇÃO e a data diz o FATO: entra o que ainda está em
 * aberto (é o que falta fazer) e o que foi encerrado DENTRO do mês corrente.
 */
/** A população "no prato deste mês" — extraída para ser a MESMA base que
 *  `metaDoMes` (o número) e `atividadesDoKpi('concluidas_mes'/'faltam_mes', …)`
 *  (o clique que filtra a lista, R60) enxergam. Duplicar o filtro em dois
 *  lugares é como um vira "42" e o outro "41" sem ninguém notar por meses. */
function doMesFiltro(atividades: Atividade[], agora: Date): Atividade[] {
  const mes = agora.getMonth();
  const ano = agora.getFullYear();
  const nesteMes = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === mes && d.getFullYear() === ano;
  };

  // R40 partiu "este mês" em três baldes (essa semana, semana que vem, este
  // mês). Contar só `este_mes` faria a meta despencar sem nada ter mudado no
  // trabalho — a tarefa de quarta-feira simplesmente sairia da conta.
  return atividades.filter(
    (a) =>
      a.natureza === "interno" &&
      a.sprint !== null && (SPRINTS_DO_MES as string[]).includes(a.sprint) &&
      a.coluna !== "cancelado" &&
      (a.emAberto || nesteMes(a.encerradoEm)),
  );
}

export function metaDoMes(
  atividades: Atividade[],
  agora: Date = new Date(),
): { total: number; feitas: number } {
  const doMes = doMesFiltro(atividades, agora);
  return { total: doMes.length, feitas: doMes.filter((a) => !a.emAberto).length };
}

// ── Os 4 indicadores viram filtro ao clicar (R60) ───────────────────────────
//
// Davi, 2026-08-22: "ao clicar em qualquer um dos quadrados, o sistema deve
// filtrar o que está sendo exibido de acordo com o quadrado que o usuário
// clicou." Cada chave abaixo é EXATAMENTE a população que o tile mostra —
// PainelKpis (a contagem) e o clique (o recorte da lista) chamam a mesma
// função, então o número do tile e o tamanho da lista que ele abre NUNCA
// podem discordar um do outro.
export type ChaveKpi = "concluidas_mes" | "faltam_mes" | "corretivas_urgentes" | "atrasadas_aberto";

/** Rótulo de cada tile — uma fonte só, para o painel e para o "Mostrando: …"
 *  que aparece na lista quando um deles está filtrando (dashboard.tsx). */
export const KPI_LABEL: Record<ChaveKpi, string> = {
  concluidas_mes: "Concluídas no mês",
  faltam_mes: "Faltam no mês",
  corretivas_urgentes: "Corretivas urgentes",
  atrasadas_aberto: "Atrasadas em aberto",
};

export function atividadesDoKpi(
  chave: ChaveKpi,
  atividades: Atividade[],
  agora: Date = new Date(),
): Atividade[] {
  switch (chave) {
    case "concluidas_mes":
      return doMesFiltro(atividades, agora).filter((a) => !a.emAberto);
    case "faltam_mes":
      return doMesFiltro(atividades, agora).filter((a) => a.emAberto);
    case "corretivas_urgentes":
      return atividades.filter((a) => a.emAberto && a.tipo === "corretiva" && a.prioridade === "urgente");
    case "atrasadas_aberto":
      return atividades.filter((a) => a.emAberto && a.prazoEstourado);
  }
}

/** A população da rosca da meta — exatamente a que `metaDoMes` conta. */
export function atividadesDaMeta(atividades: Atividade[], agora: Date = new Date()): Atividade[] {
  return doMesFiltro(atividades, agora);
}

// ── O drill-down unificado do painel (R65) ──────────────────────────────────
//
// R60 fez os 4 quadrados de KPI filtrarem a lista ao clicar. R65 estende o
// mesmo gesto às DUAS outras peças do painel — cada barra do gráfico de
// demanda e a rosca da meta — sob um único estado de seleção. Um tipo só
// (em vez de três estados soltos) é o que garante que nunca há duas peças
// "ativas" ao mesmo tempo brigando pela lista.

export type SelecaoPainel =
  | { tipo: "kpi"; chave: ChaveKpi }
  | { tipo: "semana"; chave: string; rotulo: string; passado: boolean }
  | { tipo: "meta" };

/**
 * A lista que a seleção abre — SEMPRE derivada das mesmas funções que
 * desenham os números (atividadesDoKpi / atividadesDaSemana /
 * atividadesDaMeta). É a invariante central do painel: o número tocado e o
 * tamanho da lista aberta não podem discordar.
 */
export function atividadesDaSelecao(
  sel: SelecaoPainel,
  atividades: Atividade[],
  agora: Date = new Date(),
): Atividade[] {
  switch (sel.tipo) {
    case "kpi": return atividadesDoKpi(sel.chave, atividades, agora);
    case "semana": return atividadesDaSemana(sel.chave, sel.passado, atividades);
    case "meta": return atividadesDaMeta(atividades, agora);
  }
}

/** O rótulo da faixa "Mostrando: …" — diz o que está filtrando, em português. */
export function rotuloDaSelecao(sel: SelecaoPainel): string {
  switch (sel.tipo) {
    case "kpi": return KPI_LABEL[sel.chave];
    case "semana":
      return sel.passado
        ? `Concluídas na semana de ${sel.rotulo}`
        : `Com prazo na semana de ${sel.rotulo}`;
    case "meta": return "Meta do mês";
  }
}
