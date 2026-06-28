import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  enviado: "bg-info/15 text-info border-info/30",
  aprovado: "bg-success/15 text-success border-success/30",
  perdido: "bg-destructive/10 text-destructive border-destructive/30",
};

const LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  perdido: "Perdido",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        MAP[status] ?? MAP.rascunho,
      )}
    >
      {LABEL[status] ?? status}
    </span>
  );
}
