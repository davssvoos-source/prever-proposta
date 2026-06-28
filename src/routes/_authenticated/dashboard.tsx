import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarPlus, MapPin } from "lucide-react";
import { fetchVisitas, fetchProfiles } from "@/features/visitas/data";
import { STATUS_VISITA, formatDuracao, smartDayLabel } from "@/features/visitas/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NovaVisitaDialog } from "@/features/visitas/NovaVisitaDialog";
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Dashboard() {
  const navigate = useNavigate();
  const { data: visitas, isLoading } = useQuery({
    queryKey: ["visitas"],
    queryFn: fetchVisitas,
  });

  const tecnicoIds = useMemo(
    () => Array.from(new Set((visitas ?? []).map((v) => v.tecnico_id).filter(Boolean) as string[])),
    [visitas],
  );
  const { data: profiles } = useQuery({
    queryKey: ["profiles", tecnicoIds],
    queryFn: () => fetchProfiles(tecnicoIds),
    enabled: tecnicoIds.length > 0,
  });
  const profileMap = useMemo(() => {
    const m = new Map<string, { nome: string; cargo?: string | null }>();
    (profiles ?? []).forEach((p) => m.set(p.id, { nome: p.nome, cargo: p.cargo }));
    return m;
  }, [profiles]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = useMemo(() => {
    const list = visitas ?? [];
    const realizadas = list.filter(
      (v) => v.data_hora_inicio && new Date(v.data_hora_inicio) >= monthStart,
    ).length;
    const ag = list.filter((v) => v.status === "concluida").length;
    const aprovadas = list.filter((v) => v.status === "aprovada").length;
    const pendentes = list.filter((v) => v.status === "pendente").length;
    return { realizadas, ag, aprovadas, pendentes };
  }, [visitas, monthStart]);

  const proximas = useMemo(() => {
    return (visitas ?? [])
      .filter(
        (v) =>
          (v.status === "pendente" || v.status === "em_andamento") &&
          new Date(v.data_hora_agendada) >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.data_hora_agendada).getTime() - new Date(b.data_hora_agendada).getTime(),
      );
  }, [visitas, now]);

  const [mesFiltro, setMesFiltro] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  const concluidas = useMemo(() => {
    const [y, m] = mesFiltro.split("-").map(Number);
    return (visitas ?? [])
      .filter(
        (v) =>
          ["concluida", "aprovada", "reprovada"].includes(v.status) &&
          v.data_hora_inicio &&
          new Date(v.data_hora_inicio).getFullYear() === y &&
          new Date(v.data_hora_inicio).getMonth() + 1 === m,
      )
      .sort(
        (a, b) =>
          new Date(b.data_hora_inicio!).getTime() - new Date(a.data_hora_inicio!).getTime(),
      )
      .slice(0, 10);
  }, [visitas, mesFiltro]);

  const mesOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({
        value,
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      });
    }
    return opts;
  }, [now]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats card navy */}
      <div
        className="rounded-xl p-4 text-white shadow-sm"
        style={{ backgroundColor: "#1F3864" }}
      >
        <div className="mb-3 text-xs font-medium uppercase tracking-wider opacity-80">
          Visitas técnicas
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat value={stats.realizadas} label="Realizadas no mês" />
          <Stat value={stats.ag} label="Ag. aprovação" />
          <Stat value={stats.aprovadas} label="Aprovadas" />
          <Stat value={stats.pendentes} label="Pendentes" />
        </div>
      </div>

      {/* Próximas */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            📅 Próximas Visitas{" "}
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {proximas.length}
            </span>
          </h2>
          <NovaVisitaDialog>
            <button className="text-xs font-medium text-primary">+ Nova</button>
          </NovaVisitaDialog>
        </div>
        {proximas.length === 0 ? (
          <Card className="grid place-items-center px-6 py-10 text-center">
            <CalendarPlus className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="mb-3 text-sm text-muted-foreground">Nenhuma visita agendada</p>
            <NovaVisitaDialog />
          </Card>
        ) : (
          <ul className="space-y-3">
            {proximas.map((v) => {
              const sInfo = STATUS_VISITA[v.status as keyof typeof STATUS_VISITA];
              const stripe = v.status === "em_andamento" ? "#FFC000" : "#1F3864";
              return (
                <li key={v.id}>
                  <Link
                    to="/visita/$id"
                    params={{ id: v.id }}
                    className="flex overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="w-1.5 shrink-0" style={{ backgroundColor: stripe }} />
                    <div className="flex-1 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {smartDayLabel(v.data_hora_agendada)}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">
                        {v.cliente?.nome ?? v.titulo}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{v.endereco}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge className={sInfo.color}>{sInfo.label}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          Ver detalhes <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Concluídas */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">✅ Visitas Concluídas</h2>
          <Select value={mesFiltro} onValueChange={setMesFiltro}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mesOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {concluidas.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-muted-foreground">
            Nenhuma visita concluída neste mês
          </Card>
        ) : (
          <ul className="space-y-3">
            {concluidas.map((v) => {
              const sInfo = STATUS_VISITA[v.status as keyof typeof STATUS_VISITA];
              const tec = v.tecnico_id ? profileMap.get(v.tecnico_id) : undefined;
              return (
                <li key={v.id}>
                  <Link
                    to="/visita/$id"
                    params={{ id: v.id }}
                    className="block rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span>{sInfo.icon}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(v.data_hora_inicio!).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold">
                          {v.cliente?.nome ?? v.titulo}
                        </div>
                        {tec && (
                          <div className="mt-2 flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                                {initials(tec.nome)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{tec.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              · {formatDuracao(v.data_hora_inicio, v.data_hora_fim)}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge className={sInfo.color}>{sInfo.label}</Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {concluidas.length >= 10 && (
          <div className="mt-3 text-center">
            <button
              className="text-xs font-medium text-primary"
              onClick={() => navigate({ to: "/mapa" })}
            >
              Ver todas
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div
        className="text-3xl font-bold leading-none"
        style={{ color: "#FFC000" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wide opacity-90">{label}</div>
    </div>
  );
}
