import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

function AdminPage() {
  const [tab, setTab] = useState("equipamentos");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-sm text-muted-foreground">Gerencie equipamentos, blocos e serviços.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="blocos">Blocos</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
        </TabsList>
        <TabsContent value="equipamentos" className="mt-4">
          <EquipamentosAdmin />
        </TabsContent>
        <TabsContent value="blocos" className="mt-4">
          <BlocosAdmin />
        </TabsContent>
        <TabsContent value="servicos" className="mt-4">
          <ServicosAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EquipamentosAdmin() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["equipamentos"],
    queryFn: async () => {
      const r = await supabase.from("equipamentos").select("*").order("nome");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const filt = useMemo(
    () =>
      (data ?? []).filter((e) =>
        [e.nome, e.modelo, e.marca].join(" ").toLowerCase().includes(q.toLowerCase()),
      ),
    [data, q],
  );

  async function updateCusto(id: string, custo: number) {
    const { error } = await supabase
      .from("equipamentos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ custo } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Preço atualizado");
    qc.invalidateQueries({ queryKey: ["equipamentos"] });
    qc.invalidateQueries({ queryKey: ["catalogos"] });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar equipamento..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_120px] border-b border-border bg-muted/50 px-3 py-2 text-xs font-semibold uppercase">
          <div>Nome</div>
          <div className="text-right">Custo</div>
          <div className="text-right">Markup</div>
          <div className="text-right">Venda</div>
        </div>
        <div className="divide-y divide-border">
          {filt.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[1fr_120px_120px_120px] items-center px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{e.nome}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {e.marca} · {e.modelo}
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                defaultValue={Number(e.custo)}
                onBlur={(ev) => {
                  const v = Number(ev.target.value);
                  if (v !== Number(e.custo)) updateCusto(e.id, v);
                }}
                className="text-right"
              />
              <div className="text-right text-sm text-muted-foreground tabular-nums">
                {Number(e.markup).toFixed(3)}
              </div>
              <div className="text-right font-semibold tabular-nums">
                {brl(Number(e.custo) * Number(e.markup))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BlocosAdmin() {
  const { data } = useQuery({
    queryKey: ["admin_blocos"],
    queryFn: async () => {
      const r = await supabase
        .from("blocos")
        .select("*, blocos_itens(*)")
        .order("layer")
        .order("code");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <div className="space-y-3">
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {(data ?? []).map((b: any) => (
        <Card key={b.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{b.code}</code>
            <span className="font-semibold">{b.name}</span>
            <span className="ml-auto rounded-full bg-accent/30 px-2 py-0.5 text-xs text-accent-foreground">
              {b.hh} HH
            </span>
          </div>
          {b.descricao && <p className="mt-1 text-xs text-muted-foreground">{b.descricao}</p>}
          <div className="mt-2 space-y-1 text-xs">
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {(b.blocos_itens ?? []).map((it: any) => (
              <div
                key={it.id}
                className="flex gap-2 rounded border border-border bg-background px-2 py-1"
              >
                <span className="flex-1 truncate">
                  {it.nome} <span className="text-muted-foreground">· {it.modelo}</span>
                </span>
                <span className="tabular-nums">
                  {it.qty} {it.variavel ? "(V)" : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ServicosAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin_servicos"],
    queryFn: async () => {
      const r = await supabase.from("servicos").select("*").order("ordem");
      if (r.error) throw r.error;
      return r.data;
    },
  });

  async function updatePreco(id: string, preco: number) {
    const { error } = await supabase
      .from("servicos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ preco_unitario_mensal: preco } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Preço atualizado");
    qc.invalidateQueries({ queryKey: ["admin_servicos"] });
    qc.invalidateQueries({ queryKey: ["catalogos"] });
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1fr_140px] border-b border-border bg-muted/50 px-3 py-2 text-xs font-semibold uppercase">
        <div>Serviço</div>
        <div className="text-right">Preço/mês</div>
      </div>
      <div className="divide-y divide-border">
        {(data ?? []).map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_140px] items-center px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{s.nome}</div>
              <div className="truncate text-xs text-muted-foreground">
                {s.code} · {s.cat}
              </div>
            </div>
            <Input
              type="number"
              step="0.01"
              defaultValue={Number(s.preco_unitario_mensal)}
              onBlur={(ev) => {
                const v = Number(ev.target.value);
                if (v !== Number(s.preco_unitario_mensal)) updatePreco(s.id, v);
              }}
              className="text-right"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
