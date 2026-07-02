export type VisitaStatus = "pendente" | "aguardando_aprovacao" | "aprovado";

export const STATUS_VISITA: Record<
  VisitaStatus,
  { label: string; color: string; bg: string; pin: string; icon: string }
> = {
  pendente: {
    label: "Pendente",
    color: "#FFC000",
    bg: "rgba(255,192,0,0.12)",
    pin: "#FFC000",
    icon: "🕓",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    color: "#60A5FA",
    bg: "rgba(96,165,250,0.12)",
    pin: "#60A5FA",
    icon: "🕐",
  },
  aprovado: {
    label: "Aprovado",
    color: "#34D399",
    bg: "rgba(52,211,153,0.12)",
    pin: "#34D399",
    icon: "✅",
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
