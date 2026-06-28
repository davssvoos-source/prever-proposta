import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { brl, formatDate, CONTRATO_LABEL } from "@/lib/format";
import { BlocosTab } from "@/features/projeto/BlocosTab";
import { VariaveisTab } from "@/features/projeto/VariaveisTab";
import { ResumoTab } from "@/features/projeto/ResumoTab";
import { ServicosTab } from "@/features/projeto/ServicosTab";
import { ExportarTab } from "@/features/projeto/ExportarTab";

export const Route = createFileRoute("/_authenticated/projeto/$id")({
  component: ProjetoPage,
});

function ProjetoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("blocos");

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, cliente:clientes(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  async function updateProjeto(patch: Record<string, any>) {
    const { error } = await supabase.from("projetos").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["projeto", id] });
    qc.invalidateQueries({ queryKey: ["projetos"] });
  }

  async function excluir() {
    if (!confirm("Excluir esta proposta? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("projetos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Proposta excluída");
    navigate({ to: "/dashboard" });
  }

  if (isLoading || !projeto) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Propostas
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{projeto.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {projeto.cliente?.nome ?? "—"} · Visita {formatDate(projeto.data_visita)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={projeto.status} />
            <Button size="icon" variant="ghost" onClick={excluir} aria-label="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <FieldSelect
            label="Status"
            value={projeto.status}
            onChange={(v) => updateProjeto({ status: v })}
            options={[
              { v: "rascunho", l: "Rascunho" },
              { v: "enviado", l: "Enviado" },
              { v: "aprovado", l: "Aprovado" },
              { v: "perdido", l: "Perdido" },
            ]}
          />
          <FieldSelect
            label="Tipo de contrato"
            value={projeto.tipo_contrato}
            onChange={(v) => updateProjeto({ tipo_contrato: v })}
            options={Object.entries(CONTRATO_LABEL).map(([v, l]) => ({ v, l }))}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Valor hora (R$)
            </label>
            <Input
              type="number"
              defaultValue={projeto.valor_hora_hh}
              onBlur={(e) =>
                updateProjeto({ valor_hora_hh: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="blocos">Blocos</TabsTrigger>
          <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="exportar">PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="blocos" className="mt-4">
          <BlocosTab projetoId={id} onGoToResumo={() => setTab("resumo")} />
        </TabsContent>
        <TabsContent value="variaveis" className="mt-4">
          <VariaveisTab projetoId={id} />
        </TabsContent>
        <TabsContent value="resumo" className="mt-4">
          <ResumoTab projeto={projeto} />
        </TabsContent>
        <TabsContent value="servicos" className="mt-4">
          <ServicosTab projetoId={id} />
        </TabsContent>
        <TabsContent value="exportar" className="mt-4">
          <ExportarTab projeto={projeto} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
