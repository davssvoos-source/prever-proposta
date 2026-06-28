import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

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
  const qc = useQueryClient();

  const { data: perfil } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("cargo, nome")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["dashboard-visitas", perfil?.cargo],
    enabled: !!perfil,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase
        .from("visitas_tecnicas")
        .select(`
          id, status, data_hora_agendada, endereco, titulo,
          nome_sindico, nome_predio, tecnico_id,
          clientes (nome)
        `)
        .order("data_hora_agendada", { ascending: true });

      if (perfil?.cargo === "tecnico") {
        q = q.eq("tecnico_id", user!.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("visitas-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas_tecnicas" },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
          qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const pendentes = visitas.filter((v: any) => v.status === "pendente");
  const emAndamento = visitas.filter((v: any) => v.status === "em_andamento");
  const concluidas = visitas.filter((v: any) => v.status === "concluida" || v.status === "aprovada");

  const metrics = [
    { label: "Pendentes", value: pendentes.length, color: "#FFC000", icon: <Clock size={16} /> },
    { label: "Em andamento", value: emAndamento.length, color: "#60A5FA", icon: <CalendarDays size={16} /> },
    { label: "Concluídas", value: concluidas.length, color: "#34D399", icon: <ClipboardCheck size={16} /> },
  ];

  return (
    <div className="space-y-5">
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
          {saudacao()}{perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""} 👋
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
          {perfil?.cargo === "tecnico"
            ? "Aqui estão suas visitas técnicas"
            : "Visão geral das visitas técnicas"}
        </p>
      </div>

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
            Nenhuma visita encontrada.
          </p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && <Section title="📅 Pendentes" items={pendentes} />}
          {emAndamento.length > 0 && <Section title="▶️ Em andamento" items={emAndamento} />}
          {concluidas.length > 0 && <Section title="✅ Concluídas" items={concluidas.slice(0, 5)} />}
        </>
      )}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  pendente: "#FFC000",
  em_andamento: "#60A5FA",
  concluida: "#34D399",
  aprovada: "#34D399",
  reprovada: "#F87171",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

function VisitaCard({ visita }: { visita: any }) {
  const color = STATUS_COLOR[visita.status] ?? "#888";
  const label = STATUS_LABEL[visita.status] ?? visita.status;
  const nome =
    visita.nome_predio ??
    visita.clientes?.nome ??
    visita.nome_sindico ??
    visita.titulo ??
    "Sem nome";
  return (
    <div
      style={{
        background: "rgba(8,8,12,0.22)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
        padding: "18px 16px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 15,
            color: "#fff",
            flex: 1,
          }}
        >
          {nome}
        </div>
        <div
          style={{
            background: `${color}22`,
            border: `1px solid ${color}55`,
            borderRadius: 20,
            padding: "3px 10px",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 10,
            letterSpacing: "0.10em",
            color,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
      {visita.endereco && (
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          📍 {visita.endereco}
        </div>
      )}
      {visita.data_hora_agendada && (
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 11,
            color: "rgba(255,192,0,0.75)",
            marginTop: 6,
            letterSpacing: "0.06em",
          }}
        >
          🗓️ {fmtData(visita.data_hora_agendada)}
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
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
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((v) => (
          <li key={v.id}>
            <Link
              to="/visita/$id"
              params={{ id: v.id }}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <VisitaCard visita={v} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
