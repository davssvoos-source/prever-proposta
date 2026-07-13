export const SERVICO_LABEL: Record<string, string> = {
  portaria_remota: "Portaria Remota",
  cftv: "CFTV",
  alarme: "Alarme",
  cerca_eletrica: "Cerca Elétrica",
  acesso_pedestre: "Acesso Pedestre",
  acesso_veicular: "Acesso Veicular",
  elevadores: "Elevadores",
  manutencao: "Manutenção",
  consultoria: "Consultoria",
  outro: "Outro",
};

export const SERVICO_ICON: Record<string, string> = {
  portaria_remota: "🏛️",
  cftv: "📷",
  alarme: "🔔",
  cerca_eletrica: "⚡",
  acesso_pedestre: "🚶",
  acesso_veicular: "🚗",
  elevadores: "🛗",
  manutencao: "🔧",
  consultoria: "💼",
  outro: "➕",
};

export const SERVICO_COLOR: Record<string, string> = {
  portaria_remota: "#3B82F6",
  cftv: "#8B5CF6",
  alarme: "#EF4444",
  cerca_eletrica: "#F59E0B",
  acesso_pedestre: "#10B981",
  acesso_veicular: "#06B6D4",
  elevadores: "#6B7280",
  manutencao: "#F97316",
  consultoria: "#EC4899",
  outro: "#9CA3AF",
};

export const SERVICOS = Object.keys(SERVICO_LABEL) as Array<keyof typeof SERVICO_LABEL>;

export const TIPO_LABEL: Record<string, string> = {
  condominio_vertical: "Cond. Vertical",
  condominio_horizontal: "Cond. Horizontal",
  empresa: "Galpão",
  residencia: "Residência",
};

export const TIPO_ICON: Record<string, string> = {
  condominio_vertical: "🏢",
  condominio_horizontal: "🏘️",
  empresa: "🏭",
  residencia: "🏠",
};

export const TIPOS_LOCAL = Object.keys(TIPO_LABEL) as Array<keyof typeof TIPO_LABEL>;

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_COLOR: Record<string, string> = {
  baixa: "rgba(156,163,175,0.15)",
  normal: "rgba(59,130,246,0.15)",
  alta: "rgba(245,158,11,0.20)",
  urgente: "rgba(239,68,68,0.20)",
};

export const PRIORIDADE_BORDER: Record<string, string> = {
  baixa: "rgba(156,163,175,0.4)",
  normal: "rgba(59,130,246,0.4)",
  alta: "rgba(245,158,11,0.5)",
  urgente: "rgba(239,68,68,0.6)",
};

export const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;

export function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function whatsappLink(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const full = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${full}`;
}
