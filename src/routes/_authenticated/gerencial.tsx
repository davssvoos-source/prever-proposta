import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye, Clock, CheckCircle, XCircle, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gerencial")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .maybeSingle();
    if (!["admin", "comercial"].includes(perfil?.cargo ?? "")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: GerencialPage,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente:    { label: "Pendente",     color: "#FFC000", icon: Clock },
  em_andamento:{ label: "Em andamento", color: "#3B82F6", icon: Clock },
  concluida:   { label: "Concluída",    color: "#10B981", icon: CheckCircle },
  cancelada:   { label: "Cancelada",    color: "#EF4444", icon: XCircle },
  aprovada:    { label: "Aprovada",     color: "#8B5CF6", icon: CheckCircle },
};

function GerencialPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  // Se estamos em uma rota filha (/gerencial/nova, /gerencial/usuarios, etc.),
  // renderiza o componente filho em tela cheia — não mostra o painel
  if (pathname !== "/gerencial") {
    return <Outlet />;
  }

  const { data: visitasRaw = [], isLoading } = useQuery({
    queryKey: ["gerencial-visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select(`
          id,
          status,
          data_hora_agendada,
          endereco,
          servicos_solicitados,
          created_at,
          cliente_id,
          tecnico_id,
          titulo,
          clientes (nome, email)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tecMap = new Map(tecnicos.map((t) => [t.id, t.nome]));

  // Estatísticas
  const stats = {
    total:        visitasRaw.length,
    pendentes:    visitasRaw.filter((v: any) => v.status === "pendente").length,
    em_andamento: visitasRaw.filter((v: any) => v.status === "em_andamento").length,
    concluidas:   visitasRaw.filter((v: any) => v.status === "concluida").length,
    aprovadas:    visitasRaw.filter((v: any) => v.status === "aprovada").length,
  };

  const visitas = visitasRaw as any[];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 24,
              color: "#F5F5F5",
              letterSpacing: "0.05em",
              margin: 0,
            }}
          >
            Painel Gerencial
          </h1>
          <p
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 300,
              fontSize: 13,
              color: "#9ca3af",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {stats.total} proposta{stats.total !== 1 ? "s" : ""} cadastrada{stats.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate({ to: "/gerencial/nova" })}
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFC000, #FF9F00)",
              border: "none",
              borderRadius: 12,
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#08090E",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              letterSpacing: "0.08em",
            }}
          >
            <Plus size={16} />
            Nova Proposta
          </button>
          <button
            onClick={() => navigate({ to: "/gerencial/usuarios" })}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "rgba(255,255,255,0.75)",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 400,
              fontSize: 13,
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            <Users size={16} />
            Usuários
          </button>
        </div>
      </div>

      {/* Cards de estatística */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total",        value: stats.total,        color: "#FFC000" },
          { label: "Pendentes",    value: stats.pendentes,    color: "#FFC000" },
          { label: "Em Andamento", value: stats.em_andamento, color: "#3B82F6" },
          { label: "Concluídas",   value: stats.concluidas,   color: "#10B981" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "18px 22px",
            }}
          >
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: 28,
                fontWeight: 700,
                color: s.color,
                letterSpacing: "0.02em",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: 11,
                fontWeight: 300,
                color: "#9ca3af",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Lista de visitas */}
      {isLoading ? (
        <p style={{ color: "#9ca3af", textAlign: "center", padding: 40 }}>Carregando...</p>
      ) : visitas.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#9ca3af",
          }}
        >
          <FileText size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: 14 }}>
            Nenhuma proposta cadastrada ainda.
          </p>
          <button
            onClick={() => navigate({ to: "/gerencial/nova" })}
            style={{
              marginTop: 16,
              background: "linear-gradient(135deg, #FFD700, #FFC000)",
              border: "none",
              borderRadius: 10,
              padding: "10px 24px",
              color: "#08090E",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Criar primeira proposta
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visitas.map((v) => {
            const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.pendente;
            const Icon = cfg.icon;
            const dataVisita = v.data_hora_agendada
              ? new Date(v.data_hora_agendada).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Sem data";
            const clienteNome = v.clientes?.nome ?? "Cliente";
            const tecnicoNome = v.tecnico_id ? tecMap.get(v.tecnico_id) : null;

            return (
              <div
                key={v.id}
                onClick={() => navigate({ to: "/visita/$id", params: { id: v.id } })}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "18px 22px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,192,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#F5F5F5",
                      marginBottom: 6,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {clienteNome}
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 12,
                      fontWeight: 300,
                      color: "#9ca3af",
                      lineHeight: 1.5,
                    }}
                  >
                    📅 {dataVisita}
                    {v.endereco ? `  ·  📍 ${v.endereco}` : ""}
                    {tecnicoNome ? `  ·  👤 ${tecnicoNome}` : ""}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} color={cfg.color} />
                  <span
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      color: cfg.color,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                <Eye
                  size={16}
                  color="#9ca3af"
                  style={{ flexShrink: 0, opacity: 0.6 }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
