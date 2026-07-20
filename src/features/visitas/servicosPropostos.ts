// Lista oficial dos serviços propostos de um projeto — reduzida a 7 opções
// (decisão do usuário em 2026-07-20): Controle de Acesso Eletrônico, Portaria
// Remota, Monitoramento 24h, CFTV, Alarmes, Totem de Monitoramento e Cerca
// Elétrica. As chaves antigas (implantacao_*/manutencao_*, etc.) continuam
// gravadas em visitas antigas — normalizar com normalizarServicosPropostos().

export type ServicoPropostoKey =
  | "controle_acesso"
  | "portaria_remota"
  | "monitoramento_24h"
  | "cftv"
  | "alarmes"
  | "totem_monitoramento"
  | "cerca_eletrica";

export const SERVICOS_PROPOSTOS: {
  key: ServicoPropostoKey;
  label: string;
  emoji: string;
  /** Código do bloco central correspondente, se já existir no banco. */
  centralCode: string | null;
}[] = [
  { key: "controle_acesso",     label: "Controle de Acesso Eletrônico", emoji: "🔐", centralCode: null },
  { key: "portaria_remota",     label: "Portaria Remota",               emoji: "🏛️", centralCode: "CENT-PR" },
  { key: "monitoramento_24h",   label: "Monitoramento 24h",             emoji: "🛰️", centralCode: null },
  { key: "cftv",                label: "CFTV",                          emoji: "📷", centralCode: null },
  { key: "alarmes",             label: "Alarmes",                       emoji: "🔔", centralCode: null },
  { key: "totem_monitoramento", label: "Totem de Monitoramento",        emoji: "📡", centralCode: null },
  { key: "cerca_eletrica",      label: "Cerca Elétrica",                emoji: "⚡", centralCode: null },
];

/** Chaves antigas (visitas criadas antes da lista de 7) → chave nova. */
export const SERVICOS_LEGADO: Record<string, ServicoPropostoKey> = {
  implantacao_controle_acesso: "controle_acesso",
  manutencao_controle_acesso: "controle_acesso",
  gestao_portaria_presencial: "controle_acesso",
  implantacao_cftv: "cftv",
  manutencao_cftv: "cftv",
  implantacao_alarmes: "alarmes",
  manutencao_alarmes: "alarmes",
  monitoramento_alarmes: "monitoramento_24h",
  implantacao_cerca_eletrica: "cerca_eletrica",
  manutencao_cerca_eletrica: "cerca_eletrica",
};

/** Converte chaves (novas ou legadas) para o conjunto atual de 7, sem duplicar. */
export function normalizarServicosPropostos(keys: string[] | null | undefined): ServicoPropostoKey[] {
  const validas = new Set(SERVICOS_PROPOSTOS.map((s) => s.key as string));
  const out: ServicoPropostoKey[] = [];
  for (const k of keys ?? []) {
    const nova = validas.has(k) ? (k as ServicoPropostoKey) : SERVICOS_LEGADO[k];
    if (nova && !out.includes(nova)) out.push(nova);
  }
  return out;
}

export const SERVICO_PROPOSTO_LABEL: Record<string, string> = {
  ...Object.fromEntries(SERVICOS_PROPOSTOS.map((s) => [s.key, s.label])),
  // Rótulos das chaves legadas (para exibir visitas antigas sem quebrar)
  implantacao_controle_acesso: "Controle de Acesso Eletrônico",
  manutencao_controle_acesso: "Controle de Acesso Eletrônico",
  gestao_portaria_presencial: "Controle de Acesso Eletrônico",
  implantacao_cftv: "CFTV",
  manutencao_cftv: "CFTV",
  implantacao_alarmes: "Alarmes",
  manutencao_alarmes: "Alarmes",
  monitoramento_alarmes: "Monitoramento 24h",
  implantacao_cerca_eletrica: "Cerca Elétrica",
  manutencao_cerca_eletrica: "Cerca Elétrica",
};

/** Códigos das centrais que devem aparecer automaticamente no orçamento. */
export function centraisAutomaticas(servicosPropostos: string[] | null | undefined): string[] {
  const norm = normalizarServicosPropostos(servicosPropostos);
  return SERVICOS_PROPOSTOS
    .filter((s) => s.centralCode && norm.includes(s.key))
    .map((s) => s.centralCode as string);
}

/** Combinações inválidas de serviços propostos no mesmo projeto (nenhuma na lista atual). */
export function validarServicosPropostos(_keys: string[]): string | null {
  return null;
}

/** Serviços de acesso/portaria que não se aplicam a projetos de Residência. */
export const SERVICOS_INDISPONIVEIS_RESIDENCIA: ServicoPropostoKey[] = [
  "controle_acesso",
  "portaria_remota",
];
