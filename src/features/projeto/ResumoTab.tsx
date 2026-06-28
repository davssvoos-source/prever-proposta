import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench, Package, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { useCatalogos, useProjetoBlocos, useProjetoItensVar, useProjetoServicos } from "./data";
import { computeBom, computeServicoQty } from "./calc";

type Projeto = {
  id: string;
  fornecimento: boolean;
  valor_hora_hh: number;
  tipo_contrato: string;
};

export function ResumoTab({ projeto }: { projeto: Projeto }) {
  const qc = useQueryClient();
  const cat = useCatalogos();
  const pb = useProjetoBlocos(projeto.id);
  const piv = useProjetoItensVar(projeto.id);
  const ps = useProjetoServicos(projeto.id);

  const bom = useMemo(() => {
    if (!cat.data || !pb.data) return null;
    return computeBom({
      blocos: cat.data.blocos,
      blocosItens: cat.data.blocos_itens,
      equipamentos: cat.data.equipamentos,
      projetoBlocos: pb.data,
      projetoItensVar: piv.data ?? [],
    });
  }, [cat.data, pb.data, piv.data]);

  const totalMensal = useMemo(() => {
    if (!cat.data || !pb.data || !ps.data) return 0;
    let t = 0;
    for (const psRow of ps.data) {
      if (!psRow.ativo) continue;
      const sv = cat.data.servicos.find((s) => s.id === psRow.servico_id);
      if (!sv) continue;
      const qty = psRow.quantidade || computeServicoQty(sv, cat.data.blocos, pb.data);
      t += Number(sv.preco_unitario_mensal) * qty;
    }
    return t;
  }, [cat.data, pb.data, ps.data]);

  if (cat.isLoading || pb.isLoading || !bom) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isManut = projeto.tipo_contrato === "manutencao";
  const subtotalEquip = projeto.fornecimento && !isManut ? bom.subtotal : 0;
  const subtotalInst = isManut ? 0 : bom.totalHH * Number(projeto.valor_hora_hh);
  const totalImplant = subtotalEquip + subtotalInst;

  async function toggleFornecimento(v: boolean) {
    const { error } = await supabase
      .from("projetos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ fornecimento: v } as any)
      .eq("id", projeto.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["projeto", projeto.id] });
  }

  return (
    <div className="space-y-4">
      {!isManut && (
        <Card className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium">Fornecimento de equipamentos</div>
            <div className="text-xs text-muted-foreground">
              Desligue se o cliente já possui os equipamentos.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {projeto.fornecimento ? "SIM" : "NÃO"}
            </span>
            <Switch checked={projeto.fornecimento} onCheckedChange={toggleFornecimento} />
          </div>
        </Card>
      )}

      {!isManut && bom.rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold">
            <Package className="h-4 w-4" /> Equipamentos ({bom.rows.length})
          </div>
          <div className="divide-y divide-border">
            {bom.rows.map((r) => (
              <div key={r.modelo} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.marca} · {r.modelo}
                  </div>
                </div>
                <div className="w-12 text-right tabular-nums">
                  {r.qty}
                  <span className="text-xs text-muted-foreground"> {r.un}</span>
                </div>
                <div className="w-24 text-right tabular-nums text-muted-foreground">
                  {brl(r.precoUnit)}
                </div>
                <div className="w-28 text-right tabular-nums font-medium">
                  {projeto.fornecimento ? brl(r.precoTotal) : "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-2 p-4">
        <SummaryRow
          icon={<Package className="h-4 w-4" />}
          label="Subtotal equipamentos"
          value={subtotalEquip}
          dim={!projeto.fornecimento || isManut}
        />
        <SummaryRow
          icon={<Wrench className="h-4 w-4" />}
          label={`Instalação (${bom.totalHH.toFixed(1)} HH × ${brl(projeto.valor_hora_hh)})`}
          value={subtotalInst}
          dim={isManut}
        />
        <div className="my-2 border-t border-border" />
        <SummaryRow
          icon={<Calculator className="h-4 w-4 text-primary" />}
          label={isManut ? "Total implantação" : "Total implantação"}
          value={totalImplant}
          big
        />
        <div className="rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          + Manutenção mensal:{" "}
          <span className="font-semibold text-foreground">{brl(totalMensal)}</span>
        </div>
      </Card>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  big,
  dim,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  big?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${big ? "text-base font-semibold" : "text-sm"} ${dim ? "text-muted-foreground" : ""}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="tabular-nums">{brl(value)}</div>
    </div>
  );
}
