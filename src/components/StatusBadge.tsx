// O chip de status da proposta. As cores vêm dos pares do PRISMA — cada um
// já traz o tom de TEXTO por tema (`dark`/`light`), o véu de fundo e a borda:
// sobre o Card branco do tema claro, os tons do escuro ficavam abaixo de 3:1.
import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { PRISMA, type CorPrisma } from "@/lib/paleta";

const COR: Record<string, CorPrisma> = {
  rascunho: PRISMA.neutro,
  enviado: PRISMA.azulClaro,
  aprovado: PRISMA.verde,
  perdido: PRISMA.vermelho,
};

const LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  perdido: "Perdido",
};

export function StatusBadge({ status }: { status: string }) {
  const { isLight } = useTheme();
  const c = COR[status] ?? PRISMA.neutro;
  const estilo: CSSProperties = {
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: isLight ? c.light : c.dark,
  };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={estilo}
    >
      {LABEL[status] ?? status}
    </span>
  );
}
