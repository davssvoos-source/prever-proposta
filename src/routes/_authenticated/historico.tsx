import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoricoPage,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  concluida: { label: "Concluída", color: "#10B981", icon: CheckCircle },
  aprovada: { label: "Aprovada", color: "#8B5CF6", icon: CheckCircle },
  cancelada: { label: "Cancelada", color: "#EF4444", icon: XCircle },
};

type Filtro = "todos" | "concluida" | "aprovada" | "cancelada";

function HistoricoPage() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["historico-visitas"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, status, data_hora_agendada, titulo, endereco, clientes(nome)")
        .eq("tecnico_id", user.id)
        .in("status", ["concluida", "aprovada", "cancelada"])
        .order("data_hora_agendada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtradas = useMemo(
    () => (filtro === "todos" ? visitas : visitas.filter((v: any) => v.status === filtro)),
    [visitas, filtro],
  );

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: "todos", label: "Todas" },
    { key: "concluida", label: "Concluídas" },
    { key: "aprovada", label: "Aprovadas" },
    { key: "cancelada", label: "Canceladas" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: 22,
          color: "#fff",
          margin: 0,
        }}>Histórico</h1>
        <p style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          margin: "4px 0 0",
          letterSpacing: "0.06em",
        }}>
          {visitas.length} visita{visitas.length !== 1 ? "s" : ""} realizada{visitas.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        marginBottom: 16,
        paddingBottom: 4,
      }}>
        {FILTROS.map((f) => {
          const ativo = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: 20,
                border: ativo ? "1px solid #FFC000" : "1px solid rgba(255,255,255,0.12)",
                background: ativo ? "rgba(255,192,0,0.15)" : "rgba(255,255,255,0.05)",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: ativo ? 600 : 400,
                fontSize: 12,
                color: ativo ? "#FFC000" : "rgba(255,255,255,0.55)",
                cursor: "pointer",
                letterSpacing: "0.06em",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
          Carregando...
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
          <Archive size={40} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
            Nenhuma visita encontrada
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtradas.map((v: any) => {
            const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.concluida;
            const Icon = cfg.icon;
            const dataFormatada = new Date(v.data_hora_agendada).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const clienteNome = v.clientes?.nome ?? "Cliente";

            return (
              <button
                key={v.id}
                onClick={() => navigate({ to: "/visita/$id", params: { id: v.id } })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: `${cfg.color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Icon size={20} color={cfg.color} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#fff",
                    marginBottom: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>{clienteNome}</div>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    📅 {dataFormatada}
                    {v.endereco ? `  ·  📍 ${v.endereco}` : ""}
                  </div>
                </div>

                <span style={{
                  flexShrink: 0,
                  padding: "4px 10px",
                  borderRadius: 12,
                  background: `${cfg.color}22`,
                  color: cfg.color,
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
