import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import {
  useCatalogos,
  useProjetoBlocos,
  useProjetoServicos,
  type Servico,
} from "./data";
import { computeServicoQty } from "./calc";

export function ServicosTab({ projetoId }: { projetoId: string }) {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const pb = useProjetoBlocos(projetoId);
  const ps = useProjetoServicos(projetoId);

  const psByServ = useMemo(() => {
    const m = new Map<string, { ativo: boolean; quantidade: number }>();
    for (const r of ps.data ?? []) m.set(r.servico_id, { ativo: r.ativo, quantidade: r.quantidade });
    return m;
  }, [ps.data]);

  async function upsert(s: Servico, patch: Partial<{ ativo: boolean; quantidade: number }>) {
    const prev = psByServ.get(s.id) ?? { ativo: false, quantidade: 0 };
    const row = {
      projeto_id: projetoId,
      servico_id: s.id,
      ativo: prev.ativo,
      quantidade: prev.quantidade,
      ...patch,
    };
    if (row.ativo && (!row.quantidade || row.quantidade < 1)) {
      row.quantidade =
        computeServicoQty(s, cat.data?.blocos ?? [], pb.data ?? []) || 1;
    }
    const { error } = await supabase
      .from("projeto_servicos")
      .upsert(row, { onConflict: "projeto_id,servico_id" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["projeto_servicos", projetoId] });
  }

  const total = useMemo(() => {
    if (!cat.data) return 0;
    let t = 0;
    for (const sv of cat.data.servicos) {
      const r = psByServ.get(sv.id);
      if (!r?.ativo) continue;
      t += Number(sv.preco_unitario_mensal) * (r.quantidade || 0);
    }
    return t;
  }, [cat.data, psByServ]);

  if (cat.isLoading || ps.isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grupos = new Map<string, Servico[]>();
  for (const s of cat.data?.servicos ?? []) {
    const k = s.cat ?? "OUTROS";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(s);
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between border-primary/30 bg-primary/5 p-4">
        <div className="text-sm font-medium">Total mensal de manutenção</div>
        <div className="text-2xl font-bold tabular-nums text-primary">{brl(total)}</div>
      </Card>

      {Array.from(grupos.entries()).map(([cat, items]) => (
        <Card key={cat} className="overflow-hidden">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
            {cat}
          </div>
          <div className="divide-y divide-border">
            {items.map((s) => {
              const row = psByServ.get(s.id);
              return (
                <ServicoRow
                  key={s.id}
                  servico={s}
                  ativo={!!row?.ativo}
                  quantidade={row?.quantidade ?? 0}
                  autoQty={computeServicoQty(s, cat?.length ? [] : [], [])}
                  onToggle={(v) => upsert(s, { ativo: v })}
                  onQty={(q) => upsert(s, { quantidade: q })}
                />
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ServicoRow({
  servico,
  ativo,
  quantidade,
  onToggle,
  onQty,
}: {
  servico: Servico;
  ativo: boolean;
  quantidade: number;
  autoQty: number;
  onToggle: (v: boolean) => void;
  onQty: (q: number) => void;
}) {
  const [q, setQ] = useState(quantidade);
  useEffect(() => setQ(quantidade), [quantidade]);
  const total = ativo ? Number(servico.preco_unitario_mensal) * q : 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Switch checked={ativo} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{servico.nome}</div>
        <div className="truncate text-xs text-muted-foreground">
          {servico.code} · {brl(servico.preco_unitario_mensal)}/mês
        </div>
      </div>
      <Input
        type="number"
        min={0}
        value={q}
        onChange={(e) => setQ(Math.max(0, Number(e.target.value) || 0))}
        onBlur={() => onQty(q)}
        disabled={!ativo}
        className="w-16 text-center"
      />
      <div className="w-24 text-right text-sm tabular-nums font-medium">
        {brl(total)}
      </div>
    </div>
  );
}
