export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function brl(n: number | null | undefined): string {
  return BRL.format(Number(n ?? 0));
}

/**
 * Nome de arquivo seguro a partir de texto livre — a peça que estava
 * TRIPLICADA (`features/chamados/relatorio.ts`, `features/projeto/ExportarTab.tsx`
 * e, agora, `features/sobreaviso/pdf.ts`).
 *
 * Só a versão do relatório de OS tratava ACENTO (NFD + strip dos diacríticos);
 * a do projeto não, e "Condomínio Jardim" virava `Condom-nio-Jardim` no nome do
 * arquivo que o cliente recebe. Extrair era regra 8 (prefira apagar a
 * acrescentar): este é o quarto PDF do sistema e já havia três esquemas de nome.
 *
 * O SEPARADOR É PARÂMETRO porque os dois esquemas vivos discordam — o relatório
 * usa `_`, o projeto usa `-` — e trocar o nome de um arquivo que já circula por
 * e-mail não é conserto, é ruído. `-` é o padrão para quem nasce agora.
 */
export function slug(s: string, separador: "-" | "_" = "-"): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, separador)
    .replace(new RegExp(`^${separador}+|${separador}+$`, "g"), "");
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
