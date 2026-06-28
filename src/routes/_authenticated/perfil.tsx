import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useUserRoles } from "@/lib/auth";
import { fetchProfile, fetchVisitas } from "@/features/visitas/data";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function PerfilPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const roles = useUserRoles(user?.id);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
  });
  const { data: visitas } = useQuery({ queryKey: ["visitas"], queryFn: fetchVisitas });

  const myVisits = useMemo(
    () => (visitas ?? []).filter((v) => v.tecnico_id === user?.id),
    [visitas, user?.id],
  );
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const realizadasMes = myVisits.filter(
    (v) => v.data_hora_inicio && new Date(v.data_hora_inicio) >= monthStart,
  ).length;
  const aprovadas = myVisits.filter((v) => v.status === "aprovada").length;
  const totalFinalizadas = myVisits.filter((v) =>
    ["aprovada", "reprovada"].includes(v.status),
  ).length;
  const taxa =
    totalFinalizadas === 0 ? 0 : Math.round((aprovadas / totalFinalizadas) * 100);

  const [form, setForm] = useState({ nome: "", telefone: "" });
  useEffect(() => {
    if (profile) setForm({ nome: profile.nome ?? "", telefone: profile.telefone ?? "" });
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ nome: form.nome, telefone: form.telefone })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || !user) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">
              {initials(profile?.nome || user.email || "U")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{profile?.nome || "Sem nome"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className="capitalize">
                {profile?.cargo ?? roles[0] ?? "usuário"}
              </Badge>
              {roles.includes("admin") && (
                <Badge style={{ backgroundColor: "#FFC000", color: "#1F3864" }}>admin</Badge>
              )}
            </div>
            {profile?.telefone && (
              <div className="mt-1 text-xs text-muted-foreground">{profile.telefone}</div>
            )}
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estatísticas pessoais
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Mini value={realizadasMes} label="Realizadas no mês" />
          <Mini value={aprovadas} label="Aprovadas" />
          <Mini value={`${taxa}%`} label="Taxa de aprovação" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Editar perfil
        </div>
        <div className="grid gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(11) 99999-0000"
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Configurações
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Notificações</div>
            <div className="text-xs text-muted-foreground">Receber alertas de visitas</div>
          </div>
          <Switch defaultChecked />
        </div>
      </Card>

      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive"
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

function Mini({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
