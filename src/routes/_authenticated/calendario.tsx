import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserCargo } from "@/features/gerencial/data";
import { useTheme } from "@/contexts/ThemeContext";

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
  em_andamento: "Em andamento",
  concluida: "Concluída",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function CalendarioPage() {
  const navigate = useNavigate();
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
    background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
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
  const isAdmin = cargo === "admin";

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["calendario", mes.getFullYear(), mes.getMonth(), isAdmin],
    enabled: cargo !== undefined,
    queryFn: async () => {
      const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString();
      const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59).toISOString();

      if (isAdmin) {
        const { data, error } = await supabase
          .from("visitas_tecnicas")
          .select("id, status, data_hora_agendada, titulo, nome_predio")
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
          .select("id, status, data_hora_agendada, titulo, nome_predio")
          .eq("tecnico_id", user.id)
          .gte("data_hora_agendada", inicio)
          .lte("data_hora_agendada", fim)
          .order("data_hora_agendada");
        if (error) throw error;
        return data ?? [];
      }
    },
  });

  const { diasGrid, visitasPorDia } = useMemo(() => {
    const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
    const totalDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();

    const map = new Map<number, any[]>();
    visitas.forEach((v: any) => {
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
  }, [mes, visitas]);

  const visitasDoDia = useMemo(() => {
    if (diaSelecionado === null) return visitas;
    return visitasPorDia.get(diaSelecionado) ?? [];
  }, [diaSelecionado, visitasPorDia, visitas]);

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
          color: "#fff",
          margin: 0,
        }}>Calendário</h1>
        <p style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          margin: "4px 0 0",
          letterSpacing: "0.06em",
        }}>
          {isAdmin ? "Todas as visitas técnicas" : "Suas visitas agendadas"}
        </p>
      </div>

      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button
            onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1)); setDiaSelecionado(null); }}
            style={NAV_BTN}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: "#fff",
          }}>
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </div>
          <button
            onClick={() => { setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1)); setDiaSelecionado(null); }}
            style={NAV_BTN}
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
              color: "rgba(255,255,255,0.4)",
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
                    ? "1.5px solid rgba(255,192,0,0.55)"
                    : "1.5px solid transparent",
                  background: selecionado ? "#FFC000" : "transparent",
                  cursor: "pointer",
                  minHeight: 44,
                  transition: "background 0.15s",
                }}
              >
                <span style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: selecionado || hoje_ ? 600 : 400,
                  fontSize: 13,
                  color: selecionado ? "#08090E" : "#fff",
                  lineHeight: 1,
                }}>{dia}</span>
                {temVisitas && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {visitasDia.slice(0, 3).map((v: any, i: number) => (
                      <span key={i} style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: selecionado ? "#08090E" : (STATUS_CORES[v.status] ?? "#FFC000"),
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
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          {diaSelecionado
            ? `${diaSelecionado} de ${MESES[mes.getMonth()]} · ${visitasDoDia.length} visita${visitasDoDia.length !== 1 ? "s" : ""}`
            : `${MESES[mes.getMonth()]} · ${visitas.length} visita${visitas.length !== 1 ? "s" : ""}`}
        </div>

        {isLoading ? (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
            Carregando...
          </div>
        ) : visitasDoDia.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
            <CalendarDays size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
              {diaSelecionado ? "Nenhuma visita neste dia" : "Nenhuma visita neste mês"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visitasDoDia.map((v: any) => {
              const cor = STATUS_CORES[v.status] ?? "#FFC000";
              const label = STATUS_LABELS[v.status] ?? v.status;
              const hora = new Date(v.data_hora_agendada).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const clienteNome = (v as any).nome_predio ?? v.titulo ?? "Visita";

              return (
                <button
                  key={v.id}
                  onClick={() => navigate({ to: "/visita/$id", params: { id: v.id } })}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
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
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#fff",
                      marginBottom: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>{clienteNome}</div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      display: "inline-flex",
                      alignItems: "center",
                    }}><Clock size={11} style={{ marginRight: 3, flexShrink: 0, opacity: 0.7 }} />{hora}</div>

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

const CARD: CSSProperties = {
  background: "rgba(8,8,12,0.22)",
  backdropFilter: "blur(12px) saturate(130%)",
  WebkitBackdropFilter: "blur(12px) saturate(130%)",
  border: "1px solid rgba(255,192,0,0.10)",
  borderRadius: 18,
  padding: "20px 16px",
  marginBottom: 20,
};

const NAV_BTN: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(255,255,255,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
