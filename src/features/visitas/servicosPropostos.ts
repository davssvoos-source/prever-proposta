// Lista oficial dos serviços propostos de um projeto — 4 famílias com
// Implantação e/ou Manutenção (Controle de Acesso, CFTV, Alarme, Cerca
// Elétrica), 1 combinado (Totem — sempre implantação e manutenção juntas)
// e 3 serviços de Operação (Monitoramento de Alarmes, Portaria Remota,
// Gestão de Portaria Presencial).
// Cada serviço pode (no futuro) ter uma central correspondente
// que entra automaticamente no orçamento.

export type ServicoPropostoKey =
  | "implantacao_controle_acesso"
  | "manutencao_controle_acesso"
  | "implantacao_cftv"
  | "manutencao_cftv"
  | "implantacao_alarmes"
  | "manutencao_alarmes"
  | "implantacao_cerca_eletrica"
  | "manutencao_cerca_eletrica"
  | "totem_monitoramento"
  | "monitoramento_alarmes"
  | "portaria_remota"
  | "gestao_portaria_presencial";

export const SERVICOS_PROPOSTOS: {
  key: ServicoPropostoKey;
  label: string;
  emoji: string;
  /** Código do bloco central correspondente, se já existir no banco. */
  centralCode: string | null;
}[] = [
  { key: "implantacao_controle_acesso", label: "Implantação de Controle de Acesso Eletrônico", emoji: "🔐", centralCode: "CENT-CA" },
  { key: "manutencao_controle_acesso",  label: "Manutenção de Controle de Acesso Eletrônico",  emoji: "🧰", centralCode: "CENT-MCA" },
  { key: "implantacao_cftv",            label: "Implantação de CFTV",                          emoji: "📷", centralCode: "CENT-CV" },
  { key: "manutencao_cftv",             label: "Manutenção de CFTV",                           emoji: "🎥", centralCode: "CENT-MCV" },
  { key: "implantacao_alarmes",         label: "Implantação de Alarme",                        emoji: "🔔", centralCode: "CENT-AL" },
  { key: "manutencao_alarmes",          label: "Manutenção de Alarme",                         emoji: "🛠️", centralCode: "CENT-MNA" },
  { key: "implantacao_cerca_eletrica",  label: "Implantação de Cerca Elétrica",                emoji: "⚡", centralCode: "CENT-CE" },
  { key: "manutencao_cerca_eletrica",   label: "Manutenção de Cerca Elétrica",                 emoji: "🔧", centralCode: "CENT-MCE" },
  { key: "totem_monitoramento",         label: "Totem de Monitoramento",                       emoji: "📡", centralCode: "CENT-TOT" },
  { key: "monitoramento_alarmes",       label: "Monitoramento de Alarmes",                     emoji: "🛰️", centralCode: "CENT-MA" },
  { key: "portaria_remota",             label: "Portaria Remota",                              emoji: "🏛️", centralCode: "CENT-PR" },
  { key: "gestao_portaria_presencial",  label: "Gestão de Controle de Acesso — Portaria Presencial", emoji: "🧑‍💼", centralCode: null },
];

export const SERVICO_PROPOSTO_LABEL: Record<string, string> = Object.fromEntries(
  SERVICOS_PROPOSTOS.map((s) => [s.key, s.label]),
);

/** Códigos das centrais que devem aparecer automaticamente no orçamento. */
export function centraisAutomaticas(servicosPropostos: string[] | null | undefined): string[] {
  if (!servicosPropostos?.length) return [];
  return SERVICOS_PROPOSTOS
    .filter((s) => s.centralCode && servicosPropostos.includes(s.key))
    .map((s) => s.centralCode as string);
}

/** Combinações inválidas de serviços propostos no mesmo projeto. */
export function validarServicosPropostos(keys: string[]): string | null {
  if (keys.includes("portaria_remota") && keys.includes("gestao_portaria_presencial")) {
    return "Portaria Remota e Gestão de Portaria Presencial não podem estar no mesmo projeto — são tipos de operação diferentes.";
  }
  return null;
}

/** Serviços de acesso/portaria que não se aplicam a projetos de Residência. */
export const SERVICOS_INDISPONIVEIS_RESIDENCIA: ServicoPropostoKey[] = [
  "implantacao_controle_acesso",
  "manutencao_controle_acesso",
  "portaria_remota",
  "gestao_portaria_presencial",
];
