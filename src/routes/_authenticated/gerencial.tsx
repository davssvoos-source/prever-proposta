import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye, Clock, CheckCircle, XCircle, FileText, Users, CalendarDays, MapPin, User, Trash2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { visitaRouteFor } from "@/lib/visita-route";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


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
  pendente:              { label: "Pendente",              color: "#FFC000", icon: Clock },
  em_andamento:          { label: "Pendente",              color: "#FFC000", icon: Clock },
  aguardando_aprovacao:  { label: "Aguardando aprovação",  color: "#60A5FA", icon: Clock },
  concluida:             { label: "Aguardando aprovação",  color: "#60A5FA", icon: CheckCircle },
  cancelada:             { label: "Cancelada",             color: "#EF4444", icon: XCircle },
  aprovada:              { label: "Aprovada",              color: "#8B5CF6", icon: CheckCircle },
  reprovada:             { label: "Reprovada",             color: "#EF4444", icon: XCircle },
};

function GerencialPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const cardLight = "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)";
  const textPrimary = isLight ? "#0a0b0e" : "#F5F5F5";
  const textSecondary = isLight ? "#4a5060" : "#9ca3af";
  const cardBg = isLight ? cardLight : "rgba(255,255,255,0.05)";
  const cardBorder = isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.08)";
  const cardShadow = isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none";
  const numberGold = isLight ? "#b87800" : "#FFC000";

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
            nome_sindico,
            nome_predio,
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

  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-gerencial"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return (data ?? []).some((r) => r.role === "admin");
    },
    staleTime: 60_000,
  });

  const handleDelete = async (visitaId: string) => {
    setIsDeleting(true);
    try {
      const { data: blocos } = await supabase.from("visita_blocos").select("id").eq("visita_id", visitaId);
      const blocoIds = (blocos ?? []).map((b) => b.id);
      if (blocoIds.length) {
        await supabase.from("visita_bloco_itens").delete().in("visita_bloco_id", blocoIds);
      }
      await supabase.from("visita_blocos").delete().eq("visita_id", visitaId);
      await supabase.from("fotos_visita").delete().eq("visita_id", visitaId);
      await supabase.from("visita_orcamentos").delete().eq("visita_id", visitaId);
      const { error } = await supabase.from("visitas_tecnicas").delete().eq("id", visitaId);
      if (error) throw error;
      toast.success("Visita excluída com sucesso");
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ["gerencial-visitas"] });
    } catch (e: any) {
      toast.error("Erro ao excluir visita", { description: e?.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const tecMap = new Map(tecnicos.map((t) => [t.id, t.nome]));

  const stats = {
    total:        visitasRaw.length,
    pendentes:    visitasRaw.filter((v: any) => v.status === "pendente").length,
    em_andamento: visitasRaw.filter((v: any) => v.status === "em_andamento").length,
    concluidas:   visitasRaw.filter((v: any) => v.status === "concluida").length,
    aprovadas:    visitasRaw.filter((v: any) => v.status === "aprovada").length,
  };

  const visitas = visitasRaw as any[];

  if (pathname !== "/gerencial") {
    return <Outlet />;
  }

  return (
    <>
      <div style={{ paddingTop: 16, paddingBottom: 24, paddingLeft: 0, paddingRight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 24,
              color: textPrimary,
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
              color: textSecondary,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {stats.total} proposta{stats.total !== 1 ? "s" : ""} cadastrada{stats.total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/gerencial/usuarios" })}
          style={{
            background: isLight ? "#ffffff" : "rgba(255,255,255,0.07)",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: textPrimary,
            boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 400,
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: "0.06em",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <Users size={16} />
          Usuários
        </button>
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
          { label: "Total",        value: stats.total,        color: numberGold },
          { label: "Pendentes",    value: stats.pendentes,    color: numberGold },
          { label: "Em Andamento", value: stats.em_andamento, color: "#3B82F6" },
          { label: "Concluídas",   value: stats.concluidas,   color: "#10B981" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: cardBg,
              backdropFilter: isLight ? "none" : "blur(16px)",
              border: cardBorder,
              borderRadius: 16,
              padding: "18px 22px",
              boxShadow: cardShadow,
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
                color: textSecondary,
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
            const clienteNome =
              v.clientes?.nome ??
              v.nome_sindico ??
              v.nome_predio ??
              v.titulo ??
              "Sem nome";
            const tecnicoNome = v.tecnico_id ? tecMap.get(v.tecnico_id) : null;

            return (
              <div
                key={v.id}
                onClick={() => navigate(visitaRouteFor(v.status, v.id) as any)}
                style={{
                  background: cardBg,
                  backdropFilter: isLight ? "none" : "blur(16px)",
                  border: cardBorder,
                  borderRadius: 16,
                  padding: "18px 22px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  boxShadow: cardShadow,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = isLight ? "rgba(180,120,0,0.4)" : "rgba(255,192,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)";
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      color: textPrimary,
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
                      color: textSecondary,
                      lineHeight: 1.5,
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <CalendarDays size={12} style={{ opacity: 0.7 }} />
                    <span>{dataVisita}</span>
                    {v.endereco ? (<><span style={{ opacity: 0.4 }}>·</span><MapPin size={12} style={{ opacity: 0.7 }} /><span>{v.endereco}</span></>) : null}
                    {tecnicoNome ? (<><span style={{ opacity: 0.4 }}>·</span><User size={12} style={{ opacity: 0.7 }} /><span>{tecnicoNome}</span></>) : null}
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
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(v.id);
                    }}
                    aria-label="Excluir visita"
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 6,
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(239, 68, 68, 0.1)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                    }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && !isDeleting && setDeletingId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir visita técnica?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente e não pode ser desfeita. Todos os dados desta visita serão removidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(e) => {
              e.preventDefault();
              if (deletingId) handleDelete(deletingId);
            }}
            className="rounded-full bg-[#EF4444] font-bold text-white hover:bg-[#DC2626]"
          >
            {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* FAB — Nova Proposta */}
    <button
      onClick={() => navigate({ to: "/gerencial/nova" })}
      style={{
        position: "fixed",
        bottom: 100,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #FFD700, #FFC000, #FF9F00)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(255,192,0,0.55), 0 0 40px rgba(255,192,0,0.25)",
        zIndex: 50,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.08)";
        e.currentTarget.style.boxShadow = "0 6px 28px rgba(255,192,0,0.7), 0 0 50px rgba(255,192,0,0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,192,0,0.55), 0 0 40px rgba(255,192,0,0.25)";
      }}
      aria-label="Nova Proposta"
    >
      <Plus size={28} color="#08090E" strokeWidth={2.5} />
    </button>
    </>
  );
}
