export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function brl(n: number | null | undefined): string {
  return BRL.format(Number(n ?? 0));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = new Date(d.length === 10 ? `${d}T12:00:00` : d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  perdido: "Perdido",
};

export const CONTRATO_LABEL: Record<string, string> = {
  implantacao: "Implantação",
  aproveitamento: "Aproveitamento",
  manutencao: "Manutenção",
};

export const TIPO_EMP_LABEL: Record<string, string> = {
  condominio: "Condomínio",
  empresa: "Empresa",
  hospital: "Hospital",
  shopping: "Shopping",
  outro: "Outro",
};

export const LAYER_INFO: Record<number, { label: string; icon: string }> = {
  1: { label: "Portaria Central", icon: "🏢" },
  2: { label: "Acesso Pedestre", icon: "🚶" },
  3: { label: "Acesso Veicular", icon: "🚗" },
  4: { label: "Elevadores", icon: "🛗" },
  5: { label: "CFTV", icon: "📷" },
  6: { label: "Alarme", icon: "🔔" },
  7: { label: "Cerca Elétrica", icon: "⚡" },
};
