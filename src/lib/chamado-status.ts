/**
 * Fonte única da verdade do CHAMADO — Etapa U7 da unificação.
 * Substitui os-status.ts (campo) e demanda-status.ts (interno): depois da
 * fusão existe um conceito só, com dois modos de execução.
 *
 * Ciclo do campo:   aguardando início → agendado → em andamento → concluído
 * Ciclo do interno: aguardando início → em andamento → (stand-by | aguardando aprovação) → concluído
 * Cancelado sai de qualquer ponto, com motivo.
 *
 * "Executado" NÃO existe mais (U13): era um concluído que esperava conferência,
 * e conferência nunca dependeu do status — quem manda nela é
 * `faturamento_status`, que a U0 deixou de fora do ciclo justamente para isso.
 * "Stand-by" vale para os dois lados: chamado de campo parado esperando
 * material é exatamente esse estado.
 */

export type ChamadoStatus =
  | "aberto"
  | "agendado"
  | "em_andamento"
  | "stand_by"
  | "aguardando_aprovacao"
  | "concluido"
  | "cancelado";

/** Como o chamado é executado — define ciclo, telas e regras. */
export type Natureza = "campo" | "interno";

export type ChamadoTipo =
  | "corretiva"
  | "preventiva"
  | "operacional"
  | "implantacao"
  | "melhoria"
  | "pedido_compra";

export type ChamadoPrioridade = "baixa" | "normal" | "alta" | "urgente";
export type ChamadoSprint = "este_mes" | "mes_que_vem" | "mes_passado" | "backlog";

export interface StatusInfo {
  label: string;
  labelUpper: string;
  color: string;
  colorLight: string;
  bg: string;
  border: string;
}

const STATUS: Record<ChamadoStatus, StatusInfo> = {
  aberto: {
    // O valor gravado continua 'aberto' (está no CHECK chamados_status_check,
    // em triggers e em policies). Só o que a pessoa lê mudou.
    label: "Aguardando início", labelUpper: "AGUARDANDO INÍCIO",
    color: "#F8C811", colorLight: "#A06108",
    bg: "rgba(248,200,17,0.12)", border: "rgba(248,200,17,0.30)",
  },
  agendado: {
    label: "Agendado", labelUpper: "AGENDADO",
    color: "#60A5FA", colorLight: "#1d4ed8",
    bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)",
  },
  em_andamento: {
    label: "Em andamento", labelUpper: "EM ANDAMENTO",
    color: "#9085e9", colorLight: "#4a3aa7",
    bg: "rgba(144,133,233,0.14)", border: "rgba(144,133,233,0.32)",
  },
  stand_by: {
    label: "Stand-by", labelUpper: "STAND-BY",
    color: "#E2791D", colorLight: "#A63E17",
    bg: "rgba(226,121,29,0.14)", border: "rgba(226,121,29,0.32)",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação", labelUpper: "AGUARDANDO APROVAÇÃO",
    color: "#2DD4BF", colorLight: "#0f766e",
    bg: "rgba(45,212,191,0.12)", border: "rgba(45,212,191,0.30)",
  },
  concluido: {
    label: "Concluído", labelUpper: "CONCLUÍDO",
    color: "#2DD2A5", colorLight: "#047862",
    bg: "rgba(45,210,165,0.12)", border: "rgba(45,210,165,0.30)",
  },
  cancelado: {
    label: "Cancelado", labelUpper: "CANCELADO",
    color: "#F17881", colorLight: "#B1242E",
    bg: "rgba(241,120,129,0.12)", border: "rgba(241,120,129,0.30)",
  },
};

const FALLBACK: StatusInfo = {
  label: "—", labelUpper: "—",
  color: "#9ca3af", colorLight: "#6b7280",
  bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
};

export function chamadoStatusInfo(status: string | null | undefined): StatusInfo {
  return STATUS[(status ?? "") as ChamadoStatus] ?? FALLBACK;
}

export const STATUS_ORDEM: ChamadoStatus[] = [
  "aberto", "agendado", "em_andamento", "stand_by",
  "aguardando_aprovacao", "concluido", "cancelado",
];

/** Status que ainda pedem ação de alguém. */
export function chamadoEmAberto(status: string | null | undefined): boolean {
  return ["aberto", "agendado", "em_andamento", "stand_by", "aguardando_aprovacao"]
    .includes(status ?? "");
}

/**
 * Quais status fazem sentido em cada natureza. "Agendado" pressupõe
 * deslocamento com hora marcada — não cabe no chamado interno.
 */
export function statusDaNatureza(natureza: Natureza): ChamadoStatus[] {
  return natureza === "campo"
    ? ["aberto", "agendado", "em_andamento", "stand_by", "concluido", "cancelado"]
    : ["aberto", "em_andamento", "stand_by", "aguardando_aprovacao", "concluido", "cancelado"];
}

export const NATUREZA_LABEL: Record<Natureza, string> = {
  campo: "Campo",
  interno: "Interno",
};

// ── Tipos ───────────────────────────────────────────────────────────────────

export const TIPO_LABEL: Record<ChamadoTipo, string> = {
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  operacional: "Operacional",
  implantacao: "Implantação",
  melhoria: "Melhoria",
  pedido_compra: "Pedido de compra",
};

/** Tipos que fazem sentido em cada natureza (o seletor usa isto). */
export function tiposDaNatureza(natureza: Natureza): ChamadoTipo[] {
  return natureza === "campo"
    ? ["corretiva", "preventiva", "operacional", "implantacao"]
    : ["melhoria", "corretiva", "preventiva", "operacional", "implantacao", "pedido_compra"];
}

export const TIPOS: ChamadoTipo[] = [
  "corretiva", "preventiva", "operacional", "implantacao", "melhoria", "pedido_compra",
];

export const TIPO_CORES: Record<ChamadoTipo, { dark: string; light: string; bg: string; border: string }> = {
  corretiva:     { dark: "#F17881", light: "#B1242E", bg: "rgba(241,120,129,0.12)", border: "rgba(241,120,129,0.30)" },
  preventiva:    { dark: "#F8C811", light: "#A06108", bg: "rgba(248,200,17,0.12)",   border: "rgba(248,200,17,0.30)" },
  operacional:   { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
  implantacao:   { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
  melhoria:      { dark: "#2DD2A5", light: "#047862", bg: "rgba(45,210,165,0.12)",  border: "rgba(45,210,165,0.30)" },
  pedido_compra: { dark: "#A78BFA", light: "#6d28d9", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
};

// ── Prioridade ──────────────────────────────────────────────────────────────

export const PRIORIDADE_LABEL: Record<ChamadoPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_CORES: Record<ChamadoPrioridade, { dark: string; light: string; bg: string; border: string }> = {
  baixa:   { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
  normal:  { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
  alta:    { dark: "#E2791D", light: "#A63E17", bg: "rgba(226,121,29,0.14)",   border: "rgba(226,121,29,0.32)" },
  urgente: { dark: "#F17881", light: "#B1242E", bg: "rgba(241,120,129,0.14)", border: "rgba(241,120,129,0.34)" },
};

// ── Sprint (organiza a fila do trabalho interno) ────────────────────────────

export const SPRINT_ORDEM: ChamadoSprint[] = ["este_mes", "mes_que_vem", "mes_passado", "backlog"];

export const SPRINT_LABEL: Record<ChamadoSprint, string> = {
  este_mes: "Este mês",
  mes_que_vem: "Mês que vem",
  mes_passado: "Mês passado",
  backlog: "Backlog",
};

// ── Prazo ───────────────────────────────────────────────────────────────────
// Depois da fusão existe um campo só: prazo_limite (timestamptz). No campo ele
// nasce do SLA da prioridade; no interno é a data combinada, gravada às 23:59.

export type SituacaoPrazo = "sem_prazo" | "no_prazo" | "proximo" | "estourado" | "encerrado";

export function situacaoPrazo(
  prazoLimite: string | null | undefined,
  status: string | null | undefined,
  agora: Date = new Date(),
): SituacaoPrazo {
  if (!chamadoEmAberto(status)) return "encerrado";
  if (!prazoLimite) return "sem_prazo";
  const restanteMs = new Date(prazoLimite).getTime() - agora.getTime();
  if (restanteMs < 0) return "estourado";
  if (restanteMs < 24 * 60 * 60 * 1000) return "proximo";
  return "no_prazo";
}

export const PRAZO_LABEL: Record<SituacaoPrazo, string> = {
  sem_prazo: "sem prazo",
  no_prazo: "no prazo",
  proximo: "prazo próximo",
  estourado: "prazo estourado",
  encerrado: "",
};

/** Texto curto de quanto falta (ou passou) do prazo. */
export function textoPrazo(prazoLimite: string | null | undefined, agora: Date = new Date()): string {
  if (!prazoLimite) return "sem prazo";
  const ms = new Date(prazoLimite).getTime() - agora.getTime();
  const abs = Math.abs(ms);
  const horas = Math.floor(abs / 3_600_000);
  const dias = Math.floor(horas / 24);
  const parte = dias >= 1 ? `${dias}d` : `${Math.max(1, horas)}h`;
  return ms >= 0 ? `faltam ${parte}` : `${parte} em atraso`;
}

/** `prazo_limite` (timestamptz) → `AAAA-MM-DD` local, para o input de data. */
export function prazoParaData(prazoLimite: string | null | undefined): string {
  if (!prazoLimite) return "";
  const d = new Date(prazoLimite);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `AAAA-MM-DD` do input → fim daquele dia, que é como o banco guarda. */
export function dataParaPrazo(data: string | null | undefined): string | null {
  if (!data) return null;
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1, 23, 59, 59).toISOString();
}

// ── Classificação sugerida ──────────────────────────────────────────────────

/**
 * Espelho em TS de public.sugerir_tipo_demanda() — pré-visualiza a
 * classificação enquanto a pessoa digita. Quem decide é o banco, no trigger:
 * os dois PRECISAM concordar, inclusive no colapso de espaços (senão uma
 * quebra de linha no texto faz a tela prometer um tipo e o registro nascer
 * com outro).
 */
export function sugerirTipoChamado(titulo: string, descricao?: string | null): ChamadoTipo {
  const t = `${titulo ?? ""} ${descricao ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
