// Lista oficial dos 8 serviços propostos de um projeto.
// Cada serviço pode (no futuro) ter uma central correspondente
// que entra automaticamente no orçamento.

export type ServicoPropostoKey =
  | "portaria_remota"
  | "monitoramento_alarmes"
  | "implantacao_controle_acesso"
  | "implantacao_cftv"
  | "implantacao_alarmes"
  | "manutencao_alarmes"
  | "manutencao_controle_acesso"
  | "manutencao_cftv";

export const SERVICOS_PROPOSTOS: {
  key: ServicoPropostoKey;
  label: string;
  emoji: string;
  /** Código do bloco central correspondente, se já existir no banco. */
  centralCode: string | null;
}[] = [
  { key: "portaria_remota",              label: "Portaria Remota",                              emoji: "🏛️", centralCode: "CENT-PR" },
  { key: "monitoramento_alarmes",        label: "Monitoramento de Alarmes",                     emoji: "🛰️", centralCode: "CENT-MA" },
  { key: "implantacao_controle_acesso",  label: "Implantação de Controle de Acesso Eletrônico", emoji: "🔐", centralCode: "CENT-CA" },
  { key: "implantacao_cftv",             label: "Implantação de CFTV",                          emoji: "📷", centralCode: "CENT-CV" },
  { key: "implantacao_alarmes",          label: "Implantação de Sistema de Alarmes",            emoji: "🔔", centralCode: "CENT-AL" },
  { key: "manutencao_alarmes",           label: "Manutenção de Sistema de Alarmes",             emoji: "🛠️", centralCode: "CENT-MNA" },
  { key: "manutencao_controle_acesso",   label: "Manutenção de Sistema de Controle de Acesso",  emoji: "🧰", centralCode: "CENT-MCA" },
  { key: "manutencao_cftv",              label: "Manutenção de CFTV",                           emoji: "🎥", centralCode: "CENT-MCV" },
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
