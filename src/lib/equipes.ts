// Equipes — Etapa U0 da unificação. Ver docs/PLANO_UNIFICACAO.md §4.2.
//
// Equipe é ATRIBUTO DE ROTEAMENTO, não permissão. Quem pode o quê continua
// decidido por user_roles/is_gestor() (etapas 0–6 do sistema de OS): meter as
// equipes no app_role quebraria a RLS inteira. A equipe responde a outra
// pergunta — "de quem é esta fila de demandas?".
//
// A lista vem do Notion (campo Equipe), que a U1 substitui.

export type Equipe =
  | "ti" | "patrimonio" | "audiovisual" | "business_ops" | "tecnica"
  | "comercial" | "sac" | "monitoramento";

export const EQUIPES: Equipe[] = [
  "ti",
  "patrimonio",
  "tecnica",
  "sac",
  "monitoramento",
  "comercial",
  "audiovisual",
  "business_ops",
];

export const EQUIPE_LABEL: Record<Equipe, string> = {
  ti: "T.I.",
  patrimonio: "Controle Patrimonial",
  tecnica: "Técnica",
  sac: "SAC",
  monitoramento: "Monitoramento / Portaria",
  comercial: "Comercial",
  audiovisual: "Audiovisual",
  business_ops: "Business Ops",
};

/** Cores por equipe — claro/escuro, no padrão do design system (§9). */
export const EQUIPE_CORES: Record<Equipe, { dark: string; light: string; bg: string; border: string }> = {
  ti:            { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
  patrimonio:    { dark: "#A78BFA", light: "#6d28d9", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
  tecnica:       { dark: "#F8C811", light: "#A06108", bg: "rgba(248,200,17,0.12)",   border: "rgba(248,200,17,0.30)" },
  sac:           { dark: "#2DD4BF", light: "#0f766e", bg: "rgba(45,212,191,0.12)",  border: "rgba(45,212,191,0.30)" },
  monitoramento: { dark: "#818CF8", light: "#4338ca", bg: "rgba(129,140,248,0.12)", border: "rgba(129,140,248,0.30)" },
  comercial:     { dark: "#FB923C", light: "#c2410c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.30)" },
  audiovisual:   { dark: "#F472B6", light: "#be185d", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.30)" },
  business_ops:  { dark: "#2DD2A5", light: "#047862", bg: "rgba(45,210,165,0.12)",  border: "rgba(45,210,165,0.30)" },
};

export function equipeLabel(e: string | null | undefined): string {
  if (!e) return "Sem equipe";
  return EQUIPE_LABEL[e as Equipe] ?? e;
}

/** Cores de uma equipe, com fallback neutro para valor desconhecido. */
export function equipeCores(e: string | null | undefined) {
  return (
    EQUIPE_CORES[e as Equipe] ?? {
      dark: "#9ca3af",
      light: "#6b7280",
      bg: "rgba(156,163,175,0.10)",
      border: "rgba(156,163,175,0.25)",
    }
  );
}
