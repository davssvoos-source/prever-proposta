import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useCatalogos, useProjetoBlocos, useProjetoItensVar } from "./data";
import { toast } from "sonner";

export function VariaveisTab({ projetoId }: { projetoId: string }) {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const pb = useProjetoBlocos(projetoId);
  const piv = useProjetoItensVar(projetoId);

  const itensAgrupados = useMemo(() => {
    if (!cat.data || !pb.data) return [];
    const activeIds = new Set(pb.data.filter((p) => p.ativo).map((p) => p.bloco_id));
    const blocosAtivos = cat.data.blocos.filter((b) => activeIds.has(b.id));
    return blocosAtivos
      .map((b) => ({
        bloco: b,
        itens: cat.data.blocos_itens.filter((bi) => bi.bloco_id === b.id && bi.variavel),
      }))
      .filter((g) => g.itens.length > 0);
  }, [cat.data, pb.data]);

  const qtyByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of piv.data ?? []) m.set(r.bloco_item_id, r.quantidade);
    return m;
  }, [piv.data]);

  async function setQty(itemId: string, q: number) {
    const { error } = await supabase
      .from("projeto_itens_variaveis")
      .upsert(
        { projeto_id: projetoId, bloco_item_id: itemId, quantidade: q },
        { onConflict: "projeto_id,bloco_item_id" },
      );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["projeto_itens_var", projetoId] });
  }

  if (cat.isLoading || pb.isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (itensAgrupados.length === 0) {
    return (
      <Card className="grid place-items-center py-12 text-center">
        <p className="text-sm text-muted-foreground">Não há itens variáveis nos blocos ativos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Defina as quantidades de itens marcados como variáveis (ex.: motorização).
      </p>
      {itensAgrupados.map((g) => (
        <Card key={g.bloco.id} className="p-4">
          <div className="mb-3">
            <div className="text-xs text-muted-foreground">{g.bloco.code}</div>
            <div className="font-semibold">{g.bloco.name}</div>
          </div>
          <div className="space-y-2">
            {g.itens.map((it) => (
              <VarRow
                key={it.id}
                nome={it.nome}
                modelo={it.modelo}
                value={qtyByItem.get(it.id) ?? 0}
                onChange={(q) => setQty(it.id, q)}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function VarRow({
  nome,
  modelo,
  value,
  onChange,
}: {
  nome: string;
  modelo: string;
  value: number;
  onChange: (q: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{nome}</div>
        <div className="truncate text-xs text-muted-foreground">{modelo}</div>
      </div>
      <Input
        type="number"
        min={0}
        value={v}
        onChange={(e) => setV(Math.max(0, Number(e.target.value) || 0))}
        onBlur={() => onChange(v)}
        className="w-20 text-center"
      />
    </div>
  );
}
