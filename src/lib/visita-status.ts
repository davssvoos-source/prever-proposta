/**
 * Fonte única da verdade para os status exibidos das visitas técnicas.
 *
 * Internamente o banco mantém a granularidade
 * (`pendente` / `em_andamento` / `aguardando_aprovacao` / `aprovada` / `reprovada`),
 * mas para o usuário final:
 *   - pendente        → "Pendente"
 *   - em_andamento    → "Pendente" (mesmo bucket)
 *   - aguardando_aprovacao → "Aguardando aprovação"
 *   - aprovada        → "Aprovada"
 *   - reprovada       → "Reprovada"
 */

export type VisitaStatusRaw =
  | "pendente"
  | "em_andamento"
  | "aguardando_aprovacao"
  | "aprovada"
  | "reprovada"
  | "concluida"
  | "cancelada"
  | "agendada"
  | string;

export type VisitaStatusBucket =
  | "pendente"
  | "aguardando_aprovacao"
  | "aprovada"
  | "reprovada";

/** Colapsa a granularidade interna no bucket exibido ao usuário. */
export function statusBucket(status: VisitaStatusRaw | null | undefined): VisitaStatusBucket | null {
  const s = (status ?? "").toString();
  if (s === "pendente" || s === "em_andamento" || s === "agendada") return "pendente";
  if (s === "aguardando_aprovacao" || s === "concluida") return "aguardando_aprovacao";
  if (s === "aprovada") return "aprovada";
  if (s === "reprovada" || s === "cancelada") return "reprovada";
  return null;
}

export interface VisitaStatusInfo {
  bucket: VisitaStatusBucket | null;
  label: string;
  labelUpper: string;
  color: string;
  /**
   * Par de `color` para o tema claro. Sem isto, quem monta chip de visita
   * acaba escrevendo `light: info.color` e repete o anti-padrão nº 3 do
   * DESIGN_SYSTEM (dourado #F8C811 sobre fundo branco não tem contraste).
   */
  colorLight: string;
  bg: string;
  border: string;
}

const INFO: Record<VisitaStatusBucket, Omit<VisitaStatusInfo, "bucket">> = {
  pendente: {
    label: "Pendente",
    labelUpper: "PENDENTE",
    color: "#F8C811",
    colorLight: "#A06108",
    bg: "rgba(248,200,17,0.12)",
    border: "rgba(248,200,17,0.30)",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    labelUpper: "AGUARDANDO APROVAÇÃO",
    color: "#60A5FA",
    colorLight: "#1d4ed8",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.30)",
  },
  aprovada: {
    label: "Aprovada",
    labelUpper: "APROVADA",
    color: "#2DD2A5",
    colorLight: "#047862",
    bg: "rgba(45,210,165,0.12)",
    border: "rgba(45,210,165,0.30)",
  },
  reprovada: {
    label: "Reprovada",
    labelUpper: "REPROVADA",
    color: "#F17881",
    colorLight: "#B1242E",
    bg: "rgba(241,120,129,0.12)",
    border: "rgba(241,120,129,0.30)",
  },
};

const FALLBACK: Omit<VisitaStatusInfo, "bucket"> = {
  label: "—",
  labelUpper: "—",
  color: "#9ca3af",
  colorLight: "#6b7280",
  bg: "rgba(156,163,175,0.10)",
  border: "rgba(156,163,175,0.25)",
};

export function getStatusInfo(status: VisitaStatusRaw | null | undefined): VisitaStatusInfo {
  const bucket = statusBucket(status);
  if (!bucket) return { bucket: null, ...FALLBACK };
  return { bucket, ...INFO[bucket] };
}

/** true quando o status deve ser exibido como "PENDENTE" (pendente OU em_andamento). */
export function isPendenteBucket(status: VisitaStatusRaw | null | undefined) {
  return statusBucket(status) === "pendente";
}

/** true para o bucket "AGUARDANDO APROVAÇÃO" (aguardando_aprovacao/concluida). */
export function isAguardandoAprovacaoBucket(status: VisitaStatusRaw | null | undefined) {
  return statusBucket(status) === "aguardando_aprovacao";
}
