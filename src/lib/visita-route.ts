import type { NavigateOptions } from "@tanstack/react-router";

/** Rota principal para acessar a visita a partir de listas.
 *  Todos os estados canônicos ({@link statusLabel}) usam a tela de detalhe
 *  `/visita/$id`, que renderiza os CTAs corretos conforme o status. */
export function visitaRouteFor(
  _status: string | null | undefined,
  id: string,
): NavigateOptions {
  return { to: "/visita/$id", params: { id } };
}

/** Rótulo + cores para cada status canônico. */
export function statusLabel(status: string | null | undefined) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pendente:     { label: "Pendente",     color: "#b87800", bg: "rgba(180,120,0,0.10)" },
    em_andamento: { label: "Em andamento", color: "#1d4ed8", bg: "rgba(29,78,216,0.10)" },
    aprovada:     { label: "Aprovada",     color: "#15803d", bg: "rgba(21,128,61,0.10)" },
    reprovada:    { label: "Reprovada",    color: "#dc2626", bg: "rgba(220,38,38,0.10)" },
  };
  return map[status ?? ""] ?? { label: status ?? "—", color: "#4a5060", bg: "rgba(0,0,0,0.06)" };
}
