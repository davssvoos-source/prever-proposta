export type VisitaStatus =
  | "pendente"
  | "em_andamento"
  | "concluida"
  | "aprovada"
  | "reprovada";

export const STATUS_VISITA: Record<
  VisitaStatus,
  { label: string; color: string; icon: string; pin: string }
> = {
  pendente: { label: "Pendente", color: "bg-info text-info-foreground", icon: "🕓", pin: "#3b82f6" },
  em_andamento: {
    label: "Em andamento",
    color: "bg-warning text-warning-foreground",
    icon: "▶️",
    pin: "#f59e0b",
  },
  concluida: {
    label: "Ag. aprovação",
    color: "bg-accent text-accent-foreground",
    icon: "🕐",
    pin: "#eab308",
  },
  aprovada: {
    label: "Aprovada",
    color: "bg-success text-success-foreground",
    icon: "✅",
    pin: "#22c55e",
  },
  reprovada: {
    label: "Reprovada",
    color: "bg-destructive text-destructive-foreground",
    icon: "❌",
    pin: "#ef4444",
  },
};

export function formatDuracao(inicio?: string | null, fim?: string | null): string {
  if (!inicio || !fim) return "—";
  const diff = new Date(fim).getTime() - new Date(inicio).getTime();
  if (diff <= 0) return "—";
  const min = Math.floor(diff / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function formatDataHora(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDataHoraLong(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeFuture(d?: string | null): string {
  if (!d) return "";
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return "Atrasada";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `Em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Em ${h}h ${min % 60}min`;
  const days = Math.floor(h / 24);
  return `Em ${days} dia${days > 1 ? "s" : ""} e ${h % 24}h`;
}

export function smartDayLabel(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const hhmm = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoje, ${hhmm}`;
  if (isTomorrow) return `Amanhã, ${hhmm}`;
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
