import type { NavigateOptions } from "@tanstack/react-router";

export function visitaRouteFor(
  status: string | null | undefined,
  id: string,
): NavigateOptions {
  switch (status) {
    case "pendente":
      return { to: "/visita/$id/pendente", params: { id } };
    case "em_andamento":
      return { to: "/visita/$id/pre-envio", params: { id } };
    case "aguardando_aprovacao":
    case "aprovada":
    case "reprovada":
    default:
      return { to: "/visita/$id", params: { id } };
  }
}

export function statusLabel(status: string | null | undefined) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pendente:             { label: "Pendente",          color: "#b87800", bg: "rgba(180,120,0,0.10)" },
    em_andamento:         { label: "Em andamento",      color: "#1d4ed8", bg: "rgba(29,78,216,0.10)" },
    aguardando_aprovacao: { label: "Aguard. Aprovação", color: "#ea580c", bg: "rgba(234,88,12,0.10)" },
    aprovada:             { label: "Aprovada",          color: "#15803d", bg: "rgba(21,128,61,0.10)"  },
    reprovada:            { label: "Reprovada",         color: "#dc2626", bg: "rgba(220,38,38,0.10)"  },
  };
  return map[status ?? ""] ?? { label: status ?? "—", color: "#4a5060", bg: "rgba(0,0,0,0.06)" };
}
