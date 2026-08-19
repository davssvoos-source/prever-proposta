/**
 * Fonte única da verdade das demandas internas — espelha src/lib/os-status.ts
 * (que por sua vez espelha visita-status.ts). Etapa U1 da unificação.
 *
 * Ciclo (do Notion): não iniciada → em andamento → aguardando aprovação →
 * concluída, com stand-by saindo e voltando de qualquer ponto.
 *
 * Stand-by existe AQUI e não no ciclo de OS de campo: lá o relógio de SLA não
 * sabe pausar (ver docs/PLANO_UNIFICACAO.md §3.3).
 */

export type DemandaStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "stand_by"
  | "aguardando_aprovacao"
  | "concluida"
  | "cancelada";

export type DemandaSprint = "este_mes" | "mes_que_vem" | "mes_passado" | "backlog";

export type DemandaTipo =
  | "melhoria"
  | "implantacao"
  | "corretiva"
  | "preventiva"
  | "operacional"
  | "pedido_compra";

export interface DemandaStatusInfo {
  label: string;
  labelUpper: string;
  color: string;
  colorLight: string;
  bg: string;
  border: string;
}

const STATUS: Record<DemandaStatus, DemandaStatusInfo> = {
  nao_iniciada: {
    label: "Não iniciada", labelUpper: "NÃO INICIADA",
    color: "#9ca3af", colorLight: "#6b7280",
    bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
  },
  em_andamento: {
    label: "Em andamento", labelUpper: "EM ANDAMENTO",
    color: "#FFC000", colorLight: "#b87800",
    bg: "rgba(255,192,0,0.12)", border: "rgba(255,192,0,0.30)",
  },
  stand_by: {
    label: "Stand-by", labelUpper: "STAND-BY",
    color: "#9085e9", colorLight: "#4a3aa7",
    bg: "rgba(144,133,233,0.14)", border: "rgba(144,133,233,0.32)",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação", labelUpper: "AGUARDANDO APROVAÇÃO",
    color: "#60A5FA", colorLight: "#1d4ed8",
    bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)",
  },
  concluida: {
    label: "Concluída", labelUpper: "CONCLUÍDA",
    color: "#34D399", colorLight: "#047857",
    bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.30)",
  },
  cancelada: {
    label: "Cancelada", labelUpper: "CANCELADA",
    color: "#F87171", colorLight: "#b91c1c",
    bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)",
  },
};

const FALLBACK: DemandaStatusInfo = {
  label: "—", labelUpper: "—",
  color: "#9ca3af", colorLight: "#6b7280",
  bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
};

export function demandaStatusInfo(status: string | null | undefined): DemandaStatusInfo {
  return STATUS[(status ?? "") as DemandaStatus] ?? FALLBACK;
}

export const DEMANDA_STATUS_ORDEM: DemandaStatus[] = [
  "nao_iniciada", "em_andamento", "stand_by", "aguardando_aprovacao", "concluida", "cancelada",
];

/** Status que ainda pedem ação de alguém. */
export function demandaEmAberto(status: string | null | undefined): boolean {
  return ["nao_iniciada", "em_andamento", "stand_by", "aguardando_aprovacao"].includes(status ?? "");
}

export const SPRINT_ORDEM: DemandaSprint[] = ["este_mes", "mes_que_vem", "mes_passado", "backlog"];

export const SPRINT_LABEL: Record<DemandaSprint, string> = {
  este_mes: "Este mês",
  mes_que_vem: "Mês que vem",
  mes_passado: "Mês passado",
  backlog: "Backlog",
};

export const TIPO_DEMANDA_LABEL: Record<DemandaTipo, string> = {
  melhoria: "Melhoria",
  implantacao: "Implantação",
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  operacional: "Operacional",
  // R6: o chamado do Controle Patrimonial
  pedido_compra: "Pedido de compra",
};

export const TIPOS_DEMANDA: DemandaTipo[] = [
  "melhoria", "implantacao", "corretiva", "preventiva", "operacional", "pedido_compra",
];

export const TIPO_DEMANDA_CORES: Record<DemandaTipo, { dark: string; light: string; bg: string; border: string }> = {
  melhoria:      { dark: "#34D399", light: "#047857", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.30)" },
  implantacao:   { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
  corretiva:     { dark: "#F87171", light: "#b91c1c", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
  preventiva:    { dark: "#FFC000", light: "#b87800", bg: "rgba(255,192,0,0.12)",   border: "rgba(255,192,0,0.30)" },
  operacional:   { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
  pedido_compra: { dark: "#A78BFA", light: "#6d28d9", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
};

/**
 * Espelho em TS de public.sugerir_tipo_demanda() — usado só para PRÉ-VISUALIZAR
 * a classificação enquanto a pessoa digita o título. Quem decide de verdade é o
 * banco, no INSERT: manter os dois em sincronia evita a tela prometer um tipo e
 * o registro nascer com outro.
 */
export function sugerirTipoDemanda(titulo: string, descricao?: string | null): DemandaTipo {
  const t = `${titulo ?? ""} ${descricao ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // colapsa whitespace como o normalizar_texto() do banco: sem isto,
    // "pedido de\nmaterial" (Enter no textarea) casaria no trigger e N\u00c3O na
    // pr\u00e9-visualiza\u00e7\u00e3o \u2014 a tela prometeria um tipo e o registro nasceria outro
    .replace(/\s+/g, " ")
    .trim();
  // inten\u00e7\u00e3o de compra vem primeiro: "Comprar pe\u00e7a para conserto" \u00e9 compra
  if (/(compra|comprar|cotacao|cotar|aquisicao|adquirir|fornecedor|pedido de material)/.test(t))
    return "pedido_compra";
  if (/(nao funciona|nao esta funcionando|parou|caiu|travand|travou|quebrad|defeito|falha|falhou|erro|bug|corrig|conserto|reparo|urgente|sem sinal|sem acesso|offline)/.test(t))
    return "corretiva";
  if (/(preventiv|revisao|inspec|limpeza|checagem|vistoria|rotina de manutencao|manutencao programada)/.test(t))
    return "preventiva";
  if (/(implanta|instala|nova unidade|novo sistema|migra|migracao|deploy|homologa|ativacao|start)/.test(t))
    return "implantacao";
  if (/(melhor|otimiz|aprimor|refator|upgrade|atualiz|padroniz|automatiz|redesenh|nova funcionalidade|criar tela)/.test(t))
    return "melhoria";
  return "operacional";
}

// ── Prazo (data simples, definida pelo responsável) ─────────────────────────

export type SituacaoPrazoDemanda = "sem_prazo" | "no_prazo" | "hoje" | "amanha" | "atrasada" | "encerrada";

export function situacaoPrazoDemanda(
  prazo: string | null | undefined,
  status: string | null | undefined,
  hoje: Date = new Date(),
): SituacaoPrazoDemanda {
  if (!demandaEmAberto(status)) return "encerrada";
  if (!prazo) return "sem_prazo";
  // prazo vem como 'AAAA-MM-DD': comparar como data local evita o pulo de fuso
  const [a, m, d] = prazo.slice(0, 10).split("-").map(Number);
  const alvo = new Date(a, (m ?? 1) - 1, d ?? 1);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
  if (dias < 0) return "atrasada";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanha";
  return "no_prazo";
}

export const PRAZO_DEMANDA_LABEL: Record<SituacaoPrazoDemanda, string> = {
  sem_prazo: "sem prazo",
  no_prazo: "no prazo",
  hoje: "vence hoje",
  amanha: "vence amanhã",
  atrasada: "atrasada",
  encerrada: "",
};

/** Texto curto do prazo — "em 3 dias", "vence hoje", "5 dias em atraso". */
export function textoPrazoDemanda(prazo: string | null | undefined, hoje: Date = new Date()): string {
  if (!prazo) return "sem prazo";
  const [a, m, d] = prazo.slice(0, 10).split("-").map(Number);
  const alvo = new Date(a, (m ?? 1) - 1, d ?? 1);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `em ${dias} dias`;
  return `${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"} em atraso`;
}
