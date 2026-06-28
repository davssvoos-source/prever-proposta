import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_VISITA } from "@/features/visitas/types";
import {
  PRIORIDADE_LABEL,
  SERVICO_COLOR,
  SERVICO_ICON,
  SERVICO_LABEL,
  SERVICOS,
  TIPO_ICON,
  TIPO_LABEL,
} from "@/features/gerencial/constants";
import { type Tecnico, type Visita, useTecnicos, useVisitasGerencial } from "@/features/gerencial/data";

export const Route = createFileRoute("/_authenticated/gerencial")({
  component: GerencialLayout,
});

function GerencialLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/gerencial") return <Outlet />;
  return <GerencialIndex />;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

type PeriodoKey = "semana" | "mes" | "30dias" | "todos";

function GerencialIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: visitas, isLoading } = useVisitasGerencial();
  const { data: tecnicos } = useTecnicos();

  const [busca, setBusca] = useState("");
  const [filTec, setFilTec] = useState("todos");
  const [filSrv, setFilSrv] = useState("todos");
  const [filSta, setFilSta] = useState("todos");
  const [filPer, setFilPer] = useState<PeriodoKey>("todos");
  const [view, setView] = useState<"lista" | "tecnico">("lista");

  const tecMap = useMemo(() => {
    const m = new Map<string, Tecnico>();
    (tecnicos ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [tecnicos]);

  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const month30 = new Date(now); month30.setDate(now.getDate() + 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);

  const stats = useMemo(() => {
    const list = visitas ?? [];
    return {
      semana: list.filter((v) => {
        const d = new Date(v.data_hora_agendada);
        return d >= now && d <= weekEnd;
      }).length,
      semTec: list.filter((v) => !v.tecnico_id && v.status === "pendente").length,
      andamento: list.filter((v) => v.status === "em_andamento").length,
      concluidasMes: list.filter(
        (v) =>
          ["concluida", "aprovada"].includes(v.status) &&
          v.data_hora_inicio &&
          new Date(v.data_hora_inicio) >= monthStart &&
          new Date(v.data_hora_inicio) <= monthEnd,
      ).length,
    };
  }, [visitas]);

  const filtradas = useMemo(() => {
    const list = visitas ?? [];
    const q = busca.trim().toLowerCase();
    return list
      .filter((v) => {
        if (filTec !== "todos" && v.tecnico_id !== filTec) return false;
        if (filSrv !== "todos" && v.servico_solicitado !== filSrv) return false;
        if (filSta !== "todos" && v.status !== filSta) return false;
        const d = new Date(v.data_hora_agendada);
        if (filPer === "semana" && !(d >= now && d <= weekEnd)) return false;
        if (filPer === "mes" && !(d >= monthStart && d <= monthEnd)) return false;
        if (filPer === "30dias" && !(d >= now && d <= month30)) return false;
        if (q) {
          const hay = `${v.nome_predio ?? ""} ${v.nome_sindico ?? ""} ${v.endereco ?? ""} ${v.titulo ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.data_hora_agendada).getTime();
        const tb = new Date(b.data_hora_agendada).getTime();
        const aPast = ta < now.getTime();
        const bPast = tb < now.getTime();
        if (aPast !== bPast) return aPast ? 1 : -1;
        return ta - tb;
      });
  }, [visitas, busca, filTec, filSrv, filSta, filPer]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({ status: "reprovada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visita cancelada");
      qc.invalidateQueries({ queryKey: ["visitas-gerencial"] });
      qc.invalidateQueries({ queryKey: ["visitas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="h-6 w-6 text-[#FFC000]" /> Painel Gerencial
          </h1>
          <p className="text-sm text-muted-foreground">
            Agendamento e gestão de visitas técnicas
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/gerencial/nova" })}>
          <Plus className="h-4 w-4" /> Nova Visita
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<CalendarClock className="h-4 w-4" />} value={stats.semana} label="Esta semana" />
        <StatCard icon={<UserX className="h-4 w-4" />} value={stats.semTec} label="Aguardando técnico" />
        <StatCard icon={<Loader2 className="h-4 w-4" />} value={stats.andamento} label="Em andamento" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} value={stats.concluidasMes} label="Concluídas no mês" />
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar prédio, síndico, endereço…"
                className="pl-8"
              />
            </div>
          </div>
          <Select value={filTec} onValueChange={setFilTec}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos técnicos</SelectItem>
              {(tecnicos ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filSrv} onValueChange={setFilSrv}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos serviços</SelectItem>
              {SERVICOS.map((s) => (
                <SelectItem key={s} value={s}>{SERVICO_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filSta} onValueChange={setFilSta}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="aprovada">Aprovada</SelectItem>
              <SelectItem value="reprovada">Reprovada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Select value={filPer} onValueChange={(v) => setFilPer(v as PeriodoKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos períodos</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="30dias">Próximos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-full border border-[rgba(255,192,0,0.18)] p-1 text-xs">
            <button
              onClick={() => setView("lista")}
              className="rounded-full px-3 py-1 transition"
              style={{
                background: view === "lista" ? "rgba(255,192,0,0.15)" : "transparent",
                color: view === "lista" ? "#FFC000" : "#9ca3af",
              }}
            >
              Lista
            </button>
            <button
              onClick={() => setView("tecnico")}
              className="rounded-full px-3 py-1 transition"
              style={{
                background: view === "tecnico" ? "rgba(255,192,0,0.15)" : "transparent",
                color: view === "tecnico" ? "#FFC000" : "#9ca3af",
              }}
            >
              Por Técnico
            </button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : view === "lista" ? (
        <ListaVisitas
          visitas={filtradas}
          tecMap={tecMap}
          onCancel={(id) => cancelMutation.mutate(id)}
        />
      ) : (
        <PorTecnico tecnicos={tecnicos ?? []} visitas={visitas ?? []} />
      )}
    </div>
  );
}

function StatCard({
  icon, value, label,
}: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="text-[#FFC000]">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold" style={{ color: "#FFC000" }}>{value}</div>
    </Card>
  );
}


function ListaVisitas({
  visitas, tecMap, onCancel,
}: {
  visitas: Visita[];
  tecMap: Map<string, Tecnico>;
  onCancel: (id: string) => void;
}) {
  const navigate = useNavigate();
  if (visitas.length === 0) {
    return (
      <Card className="grid place-items-center p-10 text-center text-sm text-muted-foreground">
        Nenhuma visita encontrada com os filtros atuais.
      </Card>
    );
  }
  const now = Date.now();
  return (
    <Card className="overflow-hidden">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-black/60 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3 font-medium">Data/Hora</th>
              <th className="p-3 font-medium">Prédio</th>
              <th className="p-3 font-medium">Síndico</th>
              <th className="p-3 font-medium">Serviço</th>
              <th className="p-3 font-medium">Técnico</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {visitas.map((v) => {
              const tec = v.tecnico_id ? tecMap.get(v.tecnico_id) : undefined;
              const d = new Date(v.data_hora_agendada);
              const isHoje = d.toDateString() === new Date().toDateString();
              const isPast = d.getTime() < now;
              const semTec = !v.tecnico_id && v.status === "pendente";
              const urgente = v.prioridade === "urgente";
              const stripe = urgente
                ? "#FFC000"
                : semTec
                ? "#EF4444"
                : "transparent";
              const sInfo = STATUS_VISITA[v.status as keyof typeof STATUS_VISITA];
              const srvColor = v.servico_solicitado
                ? SERVICO_COLOR[v.servico_solicitado]
                : "#6b7280";
              return (
                <tr
                  key={v.id}
                  className="cursor-pointer border-t border-[rgba(255,255,255,0.04)] transition hover:bg-[rgba(255,192,0,0.04)]"
                  style={{
                    borderLeft: `3px solid ${stripe}`,
                    animation: urgente ? "pulse 2s ease-in-out infinite" : undefined,
                    opacity: isPast && v.status === "pendente" ? 0.6 : 1,
                  }}
                  onClick={() => navigate({ to: "/visita/$id", params: { id: v.id } })}
                >
                  <td className="p-3">
                    <div
                      className="text-xs font-semibold"
                      style={{ color: isHoje ? "#FFC000" : "#F5F5F5" }}
                    >
                      {isHoje ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{v.tipo_local ? TIPO_ICON[v.tipo_local] : "📍"}</span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{v.nome_predio ?? v.titulo}</div>
                        <div className="truncate text-xs text-muted-foreground">{v.endereco}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {v.nome_sindico ? (
                      <>
                        <div className="text-sm">{v.nome_sindico}</div>
                        {v.contato_sindico && (
                          <div className="text-xs text-muted-foreground">{v.contato_sindico}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {v.servico_solicitado ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${srvColor}22`,
                          color: srvColor,
                          border: `1px solid ${srvColor}55`,
                        }}
                      >
                        {SERVICO_ICON[v.servico_solicitado]} {SERVICO_LABEL[v.servico_solicitado]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {tec ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-[#FFC000] text-[10px] text-black">
                            {initials(tec.nome ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{tec.nome}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-red-400">Sem técnico</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {sInfo?.label ?? v.status}
                    </span>
                    {urgente && (
                      <div className="mt-1 text-[10px] font-semibold text-[#FFC000]">
                        ⚑ {PRIORIDADE_LABEL[v.prioridade ?? "normal"]}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded p-1 hover:bg-[rgba(255,255,255,0.05)]"
                          aria-label="Ações"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/gerencial/visita/$id/editar" params={{ id: v.id }}>
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/visita/$id" params={{ id: v.id }}>
                            Ver no app
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm("Cancelar esta visita?")) onCancel(v.id);
                          }}
                        >
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        <ul className="divide-y divide-[rgba(255,255,255,0.05)]">
          {visitas.map((v) => {
            const tec = v.tecnico_id ? tecMap.get(v.tecnico_id) : undefined;
            const d = new Date(v.data_hora_agendada);
            const isHoje = d.toDateString() === new Date().toDateString();
            const semTec = !v.tecnico_id && v.status === "pendente";
            const urgente = v.prioridade === "urgente";
            const stripe = urgente ? "#FFC000" : semTec ? "#EF4444" : "transparent";
            const sInfo = STATUS_VISITA[v.status as keyof typeof STATUS_VISITA];
            return (
              <li key={v.id} style={{ borderLeft: `3px solid ${stripe}` }}>
                <Link
                  to="/visita/$id"
                  params={{ id: v.id }}
                  className="block p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold" style={{ color: isHoje ? "#FFC000" : "#9ca3af" }}>
                        {d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">
                        {v.tipo_local && <span className="mr-1">{TIPO_ICON[v.tipo_local]}</span>}
                        {v.nome_predio ?? v.titulo}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{v.endereco}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {v.servico_solicitado && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              background: `${SERVICO_COLOR[v.servico_solicitado]}22`,
                              color: SERVICO_COLOR[v.servico_solicitado],
                            }}
                          >
                            {SERVICO_LABEL[v.servico_solicitado]}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {tec?.nome ?? "Sem técnico"}
                        </span>
                        <span className="text-[10px]">{sInfo?.label ?? v.status}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function PorTecnico({ tecnicos, visitas }: { tecnicos: Tecnico[]; visitas: Visita[] }) {
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {tecnicos.map((t) => {
        const proximas = visitas
          .filter((v) => v.tecnico_id === t.id && new Date(v.data_hora_agendada) >= now)
          .sort((a, b) => new Date(a.data_hora_agendada).getTime() - new Date(b.data_hora_agendada).getTime());
        const semana = proximas.filter((v) => new Date(v.data_hora_agendada) <= weekEnd).length;
        const load = Math.min(100, (semana / 10) * 100);
        return (
          <Card key={t.id} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-[#FFC000] text-sm text-black">
                  {initials(t.nome ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.nome}</div>
                <div className="text-xs text-muted-foreground">{t.cargo ?? "técnico"}</div>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{semana} visitas esta semana</span>
                <span style={{ color: "#FFC000" }}>{semana}/10</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${load}%`,
                    background: "linear-gradient(90deg,#FFD700,#FFC000,#FF9F00)",
                  }}
                />
              </div>
            </div>
            <ul className="space-y-1.5">
              {proximas.slice(0, 3).map((v) => {
                const d = new Date(v.data_hora_agendada);
                return (
                  <li key={v.id} className="flex justify-between rounded bg-black/30 px-2 py-1.5 text-[11px]">
                    <span className="truncate pr-2">{v.nome_predio ?? v.titulo}</span>
                    <span className="text-muted-foreground">
                      {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {" "}
                      {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                );
              })}
              {proximas.length === 0 && (
                <li className="text-[11px] text-muted-foreground">Sem visitas agendadas</li>
              )}
            </ul>
          </Card>
        );
      })}
      {tecnicos.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
          Nenhum técnico ativo cadastrado.
        </Card>
      )}
    </div>
  );
}
