import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, ClipboardCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth";
import { STATUS_VISITA, type VisitaStatus } from "@/features/visitas/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const GLASS: React.CSSProperties = {
  background: "rgba(8, 8, 12, 0.18)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
  border: "1px solid rgba(255, 192, 0, 0.20)",
  borderRadius: 18,
  boxShadow: "0 0 0 1px rgba(255,192,0,0.06) inset, 0 8px 32px rgba(0,0,0,0.35)",
};

function fmtData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hhmm}`;
  if (d.toDateString() === amanha.toDateString()) return `Amanhã, ${hhmm}`;
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Dashboard() {
  const { user } = useAuthUser();
  const qc = useQueryClient();

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["visitas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("*")
        .eq("tecnico_id", user.id)
        .order("data_hora_agendada", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("visitas-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas_tecnicas" },
        () => {
          qc.invalidateQueries({ queryKey: ["visitas"] });
          qc.invalidateQueries({ queryKey: ["visitas-gerencial"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, user]);

  const pendentes = visitas.filter((v) => v.status === "pendente");
  const aguardando = visitas.filter((v) => v.status === "aguardando_aprovacao");
  const aprovadas = visitas.filter((v) => v.status === "aprovado");

  const metrics = [
    { label: "Pendentes", value: pendentes.length, color: "#FFC000", icon: <Clock size={16} /> },
    { label: "Ag. Aprov.", value: aguardando.length, color: "#60A5FA", icon: <CalendarDays size={16} /> },
    { label: "Aprovadas", value: aprovadas.length, color: "#34D399", icon: <ClipboardCheck size={16} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Saudação */}
      <div>
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 22,
            color: "#F0F2F5",
            margin: 0,
          }}
        >
          Bom dia 👋
        </h1>
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            color: "rgba(200,200,200,0.6)",
            margin: "4px 0 0",
          }}
        >
          Aqui estão suas visitas técnicas
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} style={{ ...GLASS, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ color: m.color, display: "flex", justifyContent: "center" }}>{m.icon}</div>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: 22,
                color: m.color,
                marginTop: 4,
              }}
            >
              {m.value}
            </div>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 10,
                color: "rgba(200,200,200,0.55)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ ...GLASS, padding: 24, textAlign: "center", color: "rgba(200,200,200,0.5)" }}>
          Carregando visitas...
        </div>
      ) : visitas.length === 0 ? (
        <div style={{ ...GLASS, padding: 32, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 13,
              color: "rgba(200,200,200,0.6)",
              margin: 0,
            }}
          >
            Nenhuma visita atribuída ainda.
          </p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <Section title="📅 Próximas visitas" items={pendentes} />
          )}
          {aguardando.length > 0 && (
            <Section title="🕐 Aguardando aprovação" items={aguardando} compact />
          )}
          {aprovadas.length > 0 && (
            <Section title="✅ Aprovadas" items={aprovadas.slice(0, 3)} compact />
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: any[];
  compact?: boolean;
}) {
  return (
    <section>
      <h2
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 400,
          fontSize: 13,
          color: "rgba(255,192,0,0.85)",
          letterSpacing: "0.06em",
          margin: "0 0 10px",
        }}
      >
        {title}
      </h2>
      <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((v) => {
          const sInfo = STATUS_VISITA[v.status as VisitaStatus];
          const emAndamento = v.status === "pendente" && v.data_hora_inicio && !v.data_hora_fim;
          return (
            <li key={v.id}>
              <Link
                to="/visita/$id"
                params={{ id: v.id }}
                style={{
                  ...GLASS,
                  display: "block",
                  padding: compact ? "12px 14px" : "14px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: 14,
                      color: "#F0F2F5",
                    }}
                  >
                    {v.nome_predio ?? v.titulo}
                  </div>
                  {emAndamento ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 500,
                        color: "#FFC000",
                        background: "rgba(255,192,0,0.12)",
                        border: "1px solid rgba(255,192,0,0.30)",
                        padding: "3px 8px",
                        borderRadius: 999,
                        letterSpacing: "0.08em",
                      }}
                    >
                      EM ANDAMENTO
                    </span>
                  ) : (
                    sInfo && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 500,
                          color: sInfo.color,
                          background: sInfo.bg,
                          border: `1px solid ${sInfo.color}55`,
                          padding: "3px 8px",
                          borderRadius: 999,
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sInfo.label.toUpperCase()}
                      </span>
                    )
                  )}
                </div>
                {!compact && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(200,200,200,0.65)", fontSize: 12 }}>
                      <CalendarDays size={12} />
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>
                        {fmtData(v.data_hora_agendada)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(200,200,200,0.5)", fontSize: 11 }}>
                      <MapPin size={12} />
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>
                        {v.endereco}
                      </span>
                    </div>
                  </div>
                )}
                {compact && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "rgba(200,200,200,0.45)", fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>
                    {v.endereco}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
