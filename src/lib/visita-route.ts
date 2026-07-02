import type { NavigateOptions } from "@tanstack/react-router";
import { getStatusInfo } from "@/lib/visita-status";

/** Rota principal para acessar a visita a partir de listas.
 *  Todos os estados canônicos ({@link statusLabel}) usam a tela de detalhe
 *  `/visita/$id`, que renderiza os CTAs corretos conforme o status. */
export function visitaRouteFor(
  _status: string | null | undefined,
  id: string,
): NavigateOptions {
  return { to: "/visita/$id", params: { id } };
}

/** Rótulo + cores para cada status canônico. Delegado ao helper único. */
export function statusLabel(status: string | null | undefined) {
  const info = getStatusInfo(status ?? "");
  return { label: info.label, color: info.color, bg: info.bg };
}
