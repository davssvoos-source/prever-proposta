import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Clock, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LAYER_INFO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useCatalogos,
  useProjetoBlocos,
  type Bloco,
  type ProjetoBloco,
} from "./data";

export function BlocosTab({
  projetoId,
  onGoToResumo,
}: {
  projetoId: string;
  onGoToResumo: () => void;
}) {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const pb = useProjetoBlocos(projetoId);

  const byBlocoId = useMemo(() => {
    const m = new Map<string, ProjetoBloco>();
    for (const r of pb.data ?? []) m.set(r.bloco_id, r);
    return m;
  }, [pb.data]);

  const grouped = useMemo(() => {
    const groups = new Map<number, Bloco[]>();
    for (const b of cat.data?.blocos ?? []) {
      if (!groups.has(b.layer)) groups.set(b.layer, []);
      groups.get(b.layer)!.push(b);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [cat.data]);

  const ativos = (pb.data ?? []).filter((p) => p.ativo);
  const totalHH = useMemo(() => {
    const bById = new Map((cat.data?.blocos ?? []).map((b) => [b.id, b]));
    return ativos.reduce((s, p) => {
      const b = bById.get(p.bloco_id);
      return s + (b ? Number(b.hh) * Math.max(1, p.quantidade || 1) : 0);
    }, 0);
  }, [ativos, cat.data]);

  async function upsert(bloco: Bloco, patch: Partial<ProjetoBloco>) {
    const existing = byBlocoId.get(bloco.id);
    const row = {
      projeto_id: projetoId,
      bloco_id: bloco.id,
      ativo: existing?.ativo ?? false,
      quantidade: existing?.quantidade ?? 0,
      ...patch,
    };
    if (row.ativo && row.quantidade < 1) row.quantidade = 1;

    const { error } = await supabase
      .from("projeto_blocos")
      .upsert(row, { onConflict: "projeto_id,bloco_id" });
    if (error) return toast.error(error.message);

    // Auto-ativação CENT-PR quando há blocos -PR ativos
    if (row.ativo && bloco.code.endsWith("-PR") && bloco.code !== "CENT-PR") {
      const cent = (cat.data?.blocos ?? []).find((b) => b.code === "CENT-PR");
      const centRow = cent ? byBlocoId.get(cent.id) : undefined;
      if (cent && (!centRow || !centRow.ativo)) {
        await supabase.from("projeto_blocos").upsert(
          {
            projeto_id: projetoId,
            bloco_id: cent.id,
            ativo: true,
            quantidade: 1,
          },
          { onConflict: "projeto_id,bloco_id" },
        );
        toast.info("CENT-PR ativada automaticamente.");
      }
    }
    qc.invalidateQueries({ queryKey: ["projeto_blocos", projetoId] });
  }

  if (cat.isLoading || pb.isLoading) {
    return (
      <div className="grid place-items-center py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <Accordion
        type="multiple"
        defaultValue={grouped.map(([k]) => `g-${k}`)}
        className="space-y-2"
      >
        {grouped.map(([layer, blocos]) => {
          const info = LAYER_INFO[layer] ?? { label: `Camada ${layer}`, icon: "📦" };
          const activeCount = blocos.filter((b) => byBlocoId.get(b.id)?.ativo).length;
          return (
            <AccordionItem
              key={layer}
              value={`g-${layer}`}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex w-full items-center gap-2">
                  <span className="text-lg">{info.icon}</span>
                  <span className="font-medium">{info.label}</span>
                  <span className="ml-auto mr-2 text-xs text-muted-foreground">
                    {activeCount}/{blocos.length} ativos
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 px-3 pb-3">
                {blocos.map((b) => {
                  const row = byBlocoId.get(b.id);
                  const active = !!row?.ativo;
                  return (
                    <BlocoCard
                      key={b.id}
                      bloco={b}
                      active={active}
                      quantidade={row?.quantidade ?? 0}
                      onToggle={(v) =>
                        upsert(b, { ativo: v, quantidade: v ? Math.max(1, row?.quantidade ?? 1) : 0 })
                      }
                      onQty={(q) => upsert(b, { quantidade: q })}
                    />
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-1 text-sm">
            <Layers className="h-4 w-4 text-primary" />
            <strong>{ativos.length}</strong> blocos
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <strong>{totalHH.toFixed(1)}</strong> HH
          </div>
          <Button className="ml-auto" onClick={onGoToResumo}>
            Ver orçamento →
          </Button>
        </div>
      </div>
    </div>
  );
}

function BlocoCard({
  bloco,
  active,
  quantidade,
  onToggle,
  onQty,
}: {
  bloco: Bloco;
  active: boolean;
  quantidade: number;
  onToggle: (v: boolean) => void;
  onQty: (q: number) => void;
}) {
  const [local, setLocal] = useState(quantidade || 1);
  return (
    <Card
      className={cn(
        "p-3 transition-all",
        active && "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              {bloco.code}
            </code>
            <span className="rounded-full bg-accent/30 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              {Number(bloco.hh).toFixed(0)} HH
            </span>
          </div>
          <div className="mt-1 text-sm font-medium leading-tight">{bloco.name}</div>
          {bloco.descricao && (
            <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {bloco.descricao}
            </div>
          )}
          {active && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  const v = Math.max(1, local - 1);
                  setLocal(v);
                  onQty(v);
                }}
                className="h-6 w-6 rounded hover:bg-muted"
                aria-label="Diminuir"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={local}
                onChange={(e) => setLocal(Math.max(1, Number(e.target.value) || 1))}
                onBlur={() => onQty(local)}
                className="w-12 bg-transparent text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const v = local + 1;
                  setLocal(v);
                  onQty(v);
                }}
                className="h-6 w-6 rounded hover:bg-muted"
                aria-label="Aumentar"
              >
                +
              </button>
            </div>
          )}
        </div>
        <Switch checked={active} onCheckedChange={onToggle} className="mt-1" />
      </div>
    </Card>
  );
}
