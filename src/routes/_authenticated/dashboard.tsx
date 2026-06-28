import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, CONTRATO_LABEL } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos status" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "enviado", label: "Enviados" },
  { value: "aprovado", label: "Aprovados" },
  { value: "perdido", label: "Perdidos" },
];

function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");

  const { data: projetos, isLoading } = useQuery({
    queryKey: ["projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*, cliente:clientes(nome, tipo_empreendimento)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (projetos ?? []).filter((p: any) => {
      if (status !== "todos" && p.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        return p.nome?.toLowerCase().includes(q) || p.cliente?.nome?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [projetos, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Propostas</h1>
          <p className="text-sm text-muted-foreground">
            Seus orçamentos e contratos do Grupo Prever.
          </p>
        </div>
        <Button asChild className="sm:hidden">
          <Link to="/novo">
            <Plus className="h-4 w-4" /> Nova
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar projeto ou cliente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">Nenhuma proposta encontrada</h3>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            {projetos?.length === 0
              ? "Comece criando sua primeira proposta."
              : "Ajuste os filtros para ver outros projetos."}
          </p>
          <Button onClick={() => navigate({ to: "/novo" })}>
            <Plus className="h-4 w-4" /> Nova proposta
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {filtered.map((p: any) => (
            <Link key={p.id} to="/projeto/$id" params={{ id: p.id }} className="group">
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.nome}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.cliente?.nome ?? "—"}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(p.data_visita)}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5">
                    {CONTRATO_LABEL[p.tipo_contrato]}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
