/**
 * Fonte única da verdade dos status de Ordem de Serviço — espelha o papel de
 * src/lib/visita-status.ts para as visitas técnicas.
 *
 * Ciclo: aberta → agendada → em_atendimento → executada → fechada
 *        (cancelada sai de qualquer ponto, com motivo)
 */

export type OsStatus =
  | "aberta"
  | "agendada"
  | "em_atendimento"
  | "executada"
  | "fechada"
  | "cancelada";

export type OsTipo = "corretiva" | "preventiva" | "implantacao" | "operacional";
export type OsPrioridade = "baixa" | "normal" | "alta" | "urgente";

export interface OsStatusInfo {
  label: string;
  labelUpper: string;
  color: string;
  colorLight: string;
  bg: string;
  border: string;
}

const STATUS: Record<OsStatus, OsStatusInfo> = {
  aberta: {
    label: "Aberta", labelUpper: "ABERTA",
    color: "#FFC000", colorLight: "#b87800",
    bg: "rgba(255,192,0,0.12)", border: "rgba(255,192,0,0.30)",
  },
  agendada: {
    label: "Agendada", labelUpper: "AGENDADA",
    color: "#60A5FA", colorLight: "#1d4ed8",
    bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)",
  },
  em_atendimento: {
    label: "Em atendimento", labelUpper: "EM ATENDIMENTO",
    color: "#9085e9", colorLight: "#4a3aa7",
    bg: "rgba(144,133,233,0.14)", border: "rgba(144,133,233,0.32)",
  },
  executada: {
    label: "Executada", labelUpper: "EXECUTADA",
    color: "#34D399", colorLight: "#047857",
    bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.30)",
  },
  fechada: {
    label: "Fechada", labelUpper: "FECHADA",
    color: "#9ca3af", colorLight: "#6b7280",
    bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
  },
  cancelada: {
    label: "Cancelada", labelUpper: "CANCELADA",
    color: "#F87171", colorLight: "#b91c1c",
    bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)",
  },
};

const FALLBACK: OsStatusInfo = {
  label: "—", labelUpper: "—",
  color: "#9ca3af", colorLight: "#6b7280",
  bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
};

export function osStatusInfo(status: string | null | undefined): OsStatusInfo {
  return STATUS[(status ?? "") as OsStatus] ?? FALLBACK;
}

export const OS_STATUS_ORDEM: OsStatus[] = [
  "aberta", "agendada", "em_atendimento", "executada", "fechada", "cancelada",
];

/** Status que ainda pedem ação de alguém. */
export function osEmAberto(status: string | null | undefined): boolean {
  return ["aberta", "agendada", "em_atendimento", "executada"].includes(status ?? "");
}

export const OS_TIPO_LABEL: Record<OsTipo, string> = {
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  implantacao: "Implantação",
  // R5: tarefa de campo que não é conserto nem rotina — entrega de controle
  // remoto, cadastros presenciais, retirada de equipamento…
  operacional: "Operacional",
};

export const OS_PRIORIDADE_LABEL: Record<OsPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const OS_PRIORIDADE_CORES: Record<OsPrioridade, { dark: string; light: string; bg: string; border: string }> = {
  baixa:   { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
  normal:  { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)" },
  alta:    { dark: "#c98500", light: "#b45309", bg: "rgba(201,133,0,0.14)",  border: "rgba(201,133,0,0.32)" },
  urgente: { dark: "#F87171", light: "#b91c1c", bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.34)" },
};

/** Situação do prazo de atendimento (SLA) de uma OS em aberto. */
export type SituacaoPrazo = "sem_prazo" | "no_prazo" | "proximo" | "estourado" | "concluida";

export function situacaoPrazo(
  prazoLimite: string | null | undefined,
  status: string | null | undefined,
  agora: Date = new Date(),
): SituacaoPrazo {
  if (!osEmAberto(status)) return "concluida";
  if (!prazoLimite) return "sem_prazo";
  const restanteMs = new Date(prazoLimite).getTime() - agora.getTime();
  if (restanteMs < 0) return "estourado";
  if (restanteMs < 4 * 60 * 60 * 1000) return "proximo";
  return "no_prazo";
}

export const PRAZO_LABEL: Record<SituacaoPrazo, string> = {
  sem_prazo: "sem prazo",
  no_prazo: "no prazo",
  proximo: "prazo próximo",
  estourado: "prazo estourado",
  concluida: "",
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
