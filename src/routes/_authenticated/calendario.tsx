import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserCargo } from "@/features/gerencial/data";
import { useTheme } from "@/contexts/ThemeContext";
import { chamadoStatusInfo } from "@/lib/chamado-status";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
});

const STATUS_CORES: Record<string, string> = {
  pendente: "#FFC000",
  em_andamento: "#3B82F6",
  concluida: "#10B981",
  aprovada: "#8B5CF6",
  cancelada: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Pendente",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Aguardando aprovação",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  cancelada: "Cancelada",
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function CalendarioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#fff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.5)";
  const goldDark = isLight ? "#b87800" : "#FFC000";
  const CARD_T: CSSProperties = {
    background: isLight ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)" : "rgba(8,8,12,0.22)",
    backdropFilter: isLight ? "none" : "blur(12px) saturate(130%)",
    WebkitBackdropFilter: isLight ? "none" : "blur(12px) saturate(130%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "20px 16px",
    marginBottom: 20,
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const NAV_BTN_T: CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: isLight ? "rgba(0,0,0,0.05)" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
  const hoje = new Date();
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(hoje.getDate());

  const { data: cargo } = useUserCargo();
  // SAC é gestor de chamados: vê o calendário de TODOS os técnicos (R8, aba 2)
  const isAdmin = cargo === "admin" || cargo === "sac";

  // Filtros da aba 2 (R8): por técnico e por tipo de chamado
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  const { data: tecnicosLista = [] } = useQuery({
    queryKey: ["calendario-tecnicos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("cargo", "tecnico")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["calendario", mes.getFullYear(), mes.getMonth(), isAdmin],
    enabled: cargo !== undefined,
    queryFn: async () => {
      const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString();
      const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59).toISOString();

      if (isAdmin) {
        const { data, error } = await supabase
          .from("visitas_tecnicas")
          .select("id, status, data_hora_agendada, titulo, nome_predio, tecnico_id")
          .gte("data_hora_agendada", inicio)
          .lte("data_hora_agendada", fim)
          .order("data_hora_agendada");
        if (error) throw error;
        return data ?? [];
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await supabase
          .from("visitas_tecnicas")
          .select("id, status, data_hora_agendada, titulo, nome_predio, tecnico_id")
          .eq("tecnico_id", user.id)
          .gte("data_hora_agendada", inicio)
          .lte("data_hora_agendada", fim)
          .order("data_hora_agendada");
        if (error) throw error;
        return data ?? [];
      }
    },
  });

  // Chamados agendados no mês entram no mesmo calendário (a RLS já limita o
  // técnico aos dele). Etapa 3 do sistema de OS.
  const { data: ordens = [] } = useQuery({
    queryKey: ["calendario-os", mes.getFullYear(), mes.getMonth()],
    queryFn: async () => {
      const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString();
      const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("chamados" as any)
        .select("id, numero, status, tipo, titulo, data_hora_agendada, tecnico_id, cliente:clientes(nome)")
        .not("data_hora_agendada", "is", null)
        .gte("data_hora_agendada", inicio)
        .lte("data_hora_agendada", fim)
        .order("data_hora_agendada");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // Visitas e chamados normalizados no mesmo formato para grade e lista.
  // Os filtros (R8) entram AQUI: grade, contagem por dia e lista respeitam.
  const eventos = useMemo(() => {
    const deVisitas = (visitas as any[]).map((v) => ({
      kind: "visita" as const,
      id: v.id as string,
      status: v.status as string,
      tipo: "visita" as string,
      tecnico_id: (v.tecnico_id ?? null) as string | null,
      data_hora_agendada: v.data_hora_agendada as string,
      nome: (v.nome_predio ?? v.titulo ?? "Visita") as string,
      detalhe: null as string | null,
    }));
    const deOs = (ordens as any[]).map((o) => ({
      kind: "os" as const,
      id: o.id as string,
      status: o.status as string,
      tipo: (o.tipo ?? "corretiva") as string,
      tecnico_id: (o.tecnico_id ?? null) as string | null,
      data_hora_agendada: o.data_hora_agendada as string,
      nome: (o.cliente?.nome ?? "Chamado") as string,
      detalhe: `${o.numero ?? ""} ${o.titulo}`.trim() as string | null,
    }));
    return [...deVisitas, ...deOs]
      .filter((e) => tecnicoFiltro === "todos" || e.tecnico_id === tecnicoFiltro)
      .filter((e) => tipoFiltro === "todos" || e.tipo === tipoFiltro)
      .sort(
        (a, b) => new Date(a.data_hora_agendada).getTime() - new Date(b.data_hora_agendada).getTime(),
      );
  }, [visitas, ordens, tecnicoFiltro, tipoFiltro]);

  const corDoEvento = (e: { kind: "visita" | "os"; status: string }) =>
    e.kind === "os"
      ? (isLight ? chamadoStatusInfo(e.status).colorLight : chamadoStatusInfo(e.status).color)
      : (STATUS_CORES[e.status] ?? goldDark);

  const rotuloDoEvento = (e: { kind: "visita" | "os"; status: string }) =>
    e.kind === "os" ? chamadoStatusInfo(e.status).label : (STATUS_LABELS[e.status] ?? e.status);

  const { diasGrid, visitasPorDia } = useMemo(() => {
    const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
    const totalDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();

    const map = new Map<number, any[]>();
    eventos.forEach((v: any) => {
      const d = new Date(v.data_hora_agendada);
      if (d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear()) {
        const dia = d.getDate();
        if (!map.has(dia)) map.set(dia, []);
        map.get(dia)!.push(v);
      }
    });

    const grid: (number | null)[] = [];
    for (let i = 0; i < primeiroDia; i++) grid.push(null);
    for (let i = 1; i <= totalDias; i++) grid.push(i);
    while (grid.length % 7 !== 0) grid.push(null);

    return { diasGrid: grid, visitasPorDia: map };
  }, [mes, eventos]);

  const visitasDoDia = useMemo(() => {
    if (diaSelecionado === null) return eventos;
    return visitasPorDia.get(diaSelecionado) ?? [];
  }, [diaSelecionado, visitasPorDia, eventos]);

  function isHoje(dia: number) {
    return (
      dia === hoje.getDate() &&
      mes.getMonth() === hoje.getMonth() &&
      mes.getFullYear() === hoje.getFullYear()
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: 22,
          color: textPrimary,
          margin: 0,
        }}>Calendário</h1>
        <p style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 12,
          color: textSecondary,
          margin: "4px 0 0",
          letterSpacing: "0.06em",
        }}>
          {isAdmin ? "Tudo o que está previsto — visitas e chamados de todos os técnicos" : "Sua agenda"}
        </p>
      </div>

      {/* Filtros da aba 2 (R8): por técnico e por tipo de chamado */}
      {isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <select
            value={tecnicoFiltro}
            onChange={(e) => setTecnicoFiltro(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 12px",
              background: isLight ? "#ffffff" : "#16161d",
              border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
              color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontSize: 13,
              outline: "none", colorScheme: isLight ? "light" : "dark",
            }}
          >
            <option value="todos">Todos os técnicos</option>
            {(tecnicosLista as any[]).map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {([
              ["todos", "Tudo"],
              ["visita", "Visitas"],
              ["corretiva", "Corretiva"],
              ["preventiva", "Preventiva"],
              ["operacional", "Operacional"],
              ["implantacao", "Implantação"],
            ] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                onClick={() => setTipoFiltro(valor)}
                style={{
                  padding: "7px 13px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
                  border: tipoFiltro === valor
                    ? "none"
                    : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                  background: tipoFiltro === valor
                    ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                    : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                  color: tipoFiltro === valor ? "#08090E" : textPrimary,
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11.5,
                  whiteSpace: "nowrap",
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={CARD_T}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button
            onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1)); setDiaSelecionado(null); }}
            style={NAV_BTN_T}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: textPrimary,
          }}>
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </div>
          <button
            onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1)); setDiaSelecionado(null); }}
            style={NAV_BTN_T}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {DIAS_SEMANA.map((d) => (
            <div key={d} style={{
              textAlign: "center",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: 10,
              color: textSecondary,
              letterSpacing: "0.08em",
              padding: "4px 0",
            }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {diasGrid.map((dia, idx) => {
            if (dia === null) return <div key={idx} />;

            const selecionado = dia === diaSelecionado;
            const hoje_ = isHoje(dia);
            const visitasDia = visitasPorDia.get(dia) ?? [];
            const temVisitas = visitasDia.length > 0;

            return (
              <button
                key={idx}
                onClick={() => setDiaSelecionado(selecionado ? null : dia)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "6px 2px",
                  borderRadius: 10,
                  border: hoje_ && !selecionado
                    ? `1.5px solid ${isLight ? "rgba(180,120,0,0.55)" : "rgba(255,192,0,0.55)"}`
                    : "1.5px solid transparent",
                  background: selecionado ? goldDark : "transparent",
                  cursor: "pointer",
                  minHeight: 44,
                  transition: "background 0.15s",
                }}
              >
                <span style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: selecionado || hoje_ ? 600 : 400,
                  fontSize: 13,
                  color: selecionado ? "#fff" : textPrimary,
                  lineHeight: 1,
                }}>{dia}</span>
                {temVisitas && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {visitasDia.slice(0, 3).map((v: any, i: number) => (
                      <span key={i} style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: selecionado ? "#fff" : corDoEvento(v),
                      }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 500,
          fontSize: 12,
          color: goldDark,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          {diaSelecionado
            ? `${diaSelecionado} de ${MESES[mes.getMonth()]} · ${visitasDoDia.length} compromisso${visitasDoDia.length !== 1 ? "s" : ""}`
            : `${MESES[mes.getMonth()]} · ${eventos.length} compromisso${eventos.length !== 1 ? "s" : ""}`}
        </div>

        {isLoading ? (
          <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
            Carregando...
          </div>
        ) : visitasDoDia.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: textSecondary }}>
            <CalendarDays size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
              {diaSelecionado ? "Nada agendado neste dia" : "Nada agendado neste mês"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visitasDoDia.map((v: any) => {
              const cor = corDoEvento(v);
              const label = rotuloDoEvento(v);
              const hora = new Date(v.data_hora_agendada).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const clienteNome = v.nome;

              return (
                <button
                  key={v.id}
                  onClick={() =>
                    v.kind === "os"
                      ? navigate({ to: "/chamados/$id", params: { id: v.id } })
                      : navigate({ to: "/visita/$id", params: { id: v.id }, state: { from: location.pathname } as any })
                  }
                  style={{
                    background: isLight ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.08)",
                    borderLeft: `3px solid ${cor}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    textAlign: "left",
                    width: "100%",
                    boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      color: textPrimary,
                      marginBottom: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>{clienteNome}</div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: textSecondary,
                      display: "inline-flex",
                      alignItems: "center",
                    }}><Clock size={11} style={{ marginRight: 3, flexShrink: 0, opacity: 0.7 }} />{hora}
                      {v.detalhe ? ` · ${v.detalhe}` : ""}</div>

                  </div>
                  <span style={{
                    flexShrink: 0,
                    padding: "4px 10px",
                    borderRadius: 12,
                    background: `${cor}22`,
                    color: cor,
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
