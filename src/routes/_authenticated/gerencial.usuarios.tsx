import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, UserPlus, Shield, Trash2, Mail, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enviarConvite } from "@/lib/convites.functions";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/_authenticated/gerencial/usuarios")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .maybeSingle();
    if (perfil?.cargo !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: UsuariosPage,
});

const L = {
  card: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
  cardSolid: "#ffffff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderMd: "1px solid rgba(0,0,0,0.10)",
  shadow: "0 1px 6px rgba(0,0,0,0.07)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.05)",
  text: "#0a0b0e",
  textSub: "#4a5060",
  textMuted: "#8a909e",
  gold: "#b87800",
  goldBg: "rgba(180,120,0,0.10)",
  goldBorder: "1px solid rgba(180,120,0,0.22)",
  inputBg: "#f0f1f4",
  inputBorder: "1px solid rgba(0,0,0,0.10)",
};

type CargoId = "tecnico" | "comercial" | "admin";

const CARGO_LIGHT: Record<string, { color: string; bg: string; border: string }> = {
  tecnico:   { color: "#15803d", bg: "#dcfce7", border: "1px solid #bbf7d0" },
  comercial: { color: "#1d4ed8", bg: "#dbeafe", border: "1px solid #bfdbfe" },
  admin:     { color: "#b45309", bg: "#fef3c7", border: "1px solid #fde68a" },
};

const CARGO_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  tecnico:   { label: "Técnico",   color: "#34D399", desc: "Acessa apenas visitas atribuídas a ele" },
  comercial: { label: "Comercial", color: "#60A5FA", desc: "Acessa painel gerencial e todas as visitas" },
  admin:     { label: "Admin",     color: "#F87171", desc: "Acesso total + gerenciamento de usuários" },
};

type StaffUser = {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
  ativo: boolean;
  email: string;
  created_at: string;
};

type Convite = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  status: string;
  created_at: string;
};

function iniciais(nome: string) {
  return (nome ?? "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function UsuariosPage() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enviarConviteFn = useServerFn(enviarConvite);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteNome, setInviteNome] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCargo, setInviteCargo] = useState<CargoId>("tecnico");

  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editCargo, setEditCargo] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<StaffUser | null>(null);
  const [aprovarId, setAprovarId] = useState<string | null>(null);
  const [aprovarCargo, setAprovarCargo] = useState<CargoId>("tecnico");

  const GLASS: CSSProperties = isLight
    ? {
        background: L.card,
        border: L.border,
        borderRadius: 18,
        boxShadow: L.shadow,
      }
    : {
        background: "rgba(8,8,12,0.22)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
      };

  const INPUT: CSSProperties = {
    width: "100%",
    background: isLight ? L.inputBg : "rgba(8,8,12,0.30)",
    border: isLight ? L.inputBorder : "1px solid rgba(255,192,0,0.18)",
    borderRadius: 10,
    color: isLight ? L.text : "#F0F2F5",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,192,0,0.65)",
    marginBottom: 6,
    display: "block",
  };

  const SECTION_TITLE: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 10,
    color: isLight ? "rgba(0,0,0,0.45)" : "rgba(255,192,0,0.55)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 24,
  };

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo, avatar_url, ativo, email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        nome: p.nome ?? "Sem nome",
        cargo: p.cargo ?? "tecnico",
        avatar_url: p.avatar_url,
        ativo: p.ativo,
        email: p.email ?? "",
        created_at: p.created_at,
      })) as StaffUser[];
    },
  });

  const { data: convitesPendentes = [] } = useQuery({
    queryKey: ["convites-pendentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("convites")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      return (data ?? []) as Convite[];
    },
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["solicitacoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, created_at")
        .eq("status" as any, "pendente_aprovacao")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: async ({ userId, cargo }: { userId: string; cargo: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "ativo", cargo } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacoes-pendentes"] });
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      setAprovarId(null);
      toast.success("Usuário aprovado com sucesso!");
    },
    onError: () => toast.error("Erro ao aprovar usuário."),
  });

  const rejeitarMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejeitado" } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitacoes-pendentes"] });
      toast.success("Solicitação rejeitada.");
    },
    onError: () => toast.error("Erro ao rejeitar."),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim() || !inviteNome.trim()) {
        throw new Error("Preencha nome e e-mail");
      }
      await enviarConviteFn({
        data: { email: inviteEmail.trim(), nome: inviteNome.trim(), cargo: inviteCargo },
      });
    },
    onSuccess: () => {
      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteNome(""); setInviteEmail(""); setInviteCargo("tecnico");
      setShowInvite(false);
      qc.invalidateQueries({ queryKey: ["convites-pendentes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editCargoMutation = useMutation({
    mutationFn: async ({ id, cargo }: { id: string; cargo: string }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ cargo })
        .eq("id", id)
        .select("id");
      if (error) {
        console.error("[editCargo] profiles update error:", error);
        throw error;
      }
      if (!data || data.length === 0) {
        console.error("[editCargo] Nenhuma linha atualizada — verifique permissões (RLS) ou id do usuário.", { id, cargo });
        throw new Error("Sem permissão para alterar este usuário ou usuário não encontrado.");
      }
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", id);
      if (delErr) {
        console.error("[editCargo] user_roles delete error:", delErr);
        throw delErr;
      }
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: id, role: cargo as "admin" | "comercial" | "tecnico" });
      if (insErr) {
        console.error("[editCargo] user_roles insert error:", insErr);
        throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Permissão atualizada");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["bottomnav-cargo"] });
    },
    onError: (e: Error) => {
      console.error("[editCargo] mutation error:", e);
      toast.error(e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário desativado");
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ativos = usuarios.filter((u) => u.ativo !== false);
  const inativos = usuarios.filter((u) => u.ativo === false);

  return (
    <div style={{
      minHeight: "100vh",
      background: isLight ? "#f4f5f7" : "#08090E",
      padding: "20px 16px 120px",
      color: isLight ? L.text : "#F0F2F5",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate({ to: "/gerencial" })}
          style={{
            background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.06)",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12, width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: isLight ? L.text : "#fff",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 18,
            color: isLight ? L.text : "#fff",
          }}>
            Gerenciar Usuários
          </div>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
            color: isLight ? L.textMuted : "rgba(255,255,255,0.5)",
          }}>
            {ativos.length} ativo{ativos.length !== 1 ? "s" : ""}
            {convitesPendentes.length > 0 && ` · ${convitesPendentes.length} convite${convitesPendentes.length !== 1 ? "s" : ""} pendente${convitesPendentes.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            background: "linear-gradient(135deg, #FFD700, #FFC000, #FF9F00)",
            border: "none", borderRadius: 12, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
            color: "#08090E", fontFamily: "Montserrat, sans-serif",
            fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}
        >
          <UserPlus size={16} />
          Convidar
        </button>
      </div>

      {/* Formulário de convite */}
      {showInvite && (
        <div style={{ ...GLASS, marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 14,
            color: isLight ? L.text : "#fff", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Mail size={16} /> Convidar Novo Usuário
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={LABEL}>Nome completo *</label>
              <input
                style={INPUT}
                placeholder="Ex: João Silva"
                value={inviteNome}
                onChange={(e) => setInviteNome(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL}>E-mail *</label>
              <input
                style={INPUT}
                type="email"
                placeholder="nome@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL}>Cargo / Nível de acesso</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(Object.entries(CARGO_CONFIG) as [CargoId, typeof CARGO_CONFIG[string]][]).map(([id, cfg]) => {
                  const lightCfg = CARGO_LIGHT[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setInviteCargo(id)}
                      style={{
                        textAlign: "left", padding: "10px 14px", borderRadius: 12,
                        background: inviteCargo === id
                          ? (isLight ? lightCfg.bg : `${cfg.color}12`)
                          : (isLight ? "#f9fafb" : "rgba(255,255,255,0.03)"),
                        border: inviteCargo === id
                          ? (isLight ? lightCfg.border : `1.5px solid ${cfg.color}55`)
                          : (isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)"),
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13,
                        color: isLight ? lightCfg.color : cfg.color,
                      }}>
                        {cfg.label}
                      </div>
                      <div style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                        color: isLight ? L.textSub : "rgba(255,255,255,0.55)", marginTop: 2,
                      }}>
                        {cfg.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setShowInvite(false)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.05)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLight ? L.textSub : "rgba(255,255,255,0.6)",
                  fontFamily: "'Montserrat', sans-serif", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !inviteEmail.trim() || !inviteNome.trim()}
                style={{
                  flex: 2, padding: 12, borderRadius: 12,
                  background: "linear-gradient(135deg, #FFD700, #FFC000)",
                  border: "none", color: "#08090E",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600,
                  fontSize: 13, cursor: "pointer",
                  opacity: (inviteMutation.isPending || !inviteEmail.trim() || !inviteNome.trim()) ? 0.6 : 1,
                }}
              >
                {inviteMutation.isPending ? "Enviando..." : "Enviar Convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Solicitações de acesso */}
      {solicitacoes.length > 0 && (
        <>
          <div style={SECTION_TITLE}>Solicitações de acesso ({solicitacoes.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {solicitacoes.map((s: any) => (
              <div key={s.id} style={{ ...GLASS, padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: isLight ? "#fef3c7" : "rgba(255,192,0,0.12)",
                    border: isLight ? "1px solid #fde68a" : "1px solid rgba(255,192,0,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isLight ? "#b45309" : "#FFC000",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13,
                    flexShrink: 0,
                  }}>
                    {iniciais(s.nome ?? s.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13,
                      color: isLight ? L.text : "#fff",
                    }}>
                      {s.nome ?? "—"}
                    </div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                      color: isLight ? L.textMuted : "rgba(255,255,255,0.5)", marginTop: 2,
                    }}>
                      {s.email}
                    </div>
                  </div>
                  {aprovarId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={aprovarCargo}
                        onChange={(e) => setAprovarCargo(e.target.value as CargoId)}
                        style={{
                          padding: "6px 10px", borderRadius: 8,
                          border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.20)",
                          background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.08)",
                          color: isLight ? L.text : "#FFFFFF", fontSize: 13, cursor: "pointer", outline: "none",
                        }}
                      >
                        <option value="tecnico" style={{ background: isLight ? "#ffffff" : "#0a0a14" }}>Técnico</option>
                        <option value="comercial" style={{ background: isLight ? "#ffffff" : "#0a0a14" }}>Comercial</option>
                        <option value="admin" style={{ background: isLight ? "#ffffff" : "#0a0a14" }}>Admin</option>
                      </select>
                      <button
                        onClick={() => aprovarMutation.mutate({ userId: s.id, cargo: aprovarCargo })}
                        disabled={aprovarMutation.isPending}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#10B981", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setAprovarId(null)}
                        style={{
                          padding: "6px 10px", borderRadius: 8,
                          border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.20)",
                          background: "transparent",
                          color: isLight ? L.textMuted : "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setAprovarId(s.id); setAprovarCargo("tecnico"); }}
                        style={{
                          padding: "6px 14px", borderRadius: 8,
                          background: isLight ? "#fef3c7" : "rgba(255,192,0,0.15)",
                          border: isLight ? "1px solid #fde68a" : "1px solid rgba(255,192,0,0.40)",
                          color: isLight ? "#b45309" : "#FFC000",
                          fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Rejeitar esta solicitação?")) {
                            rejeitarMutation.mutate(s.id);
                          }
                        }}
                        style={{
                          padding: "6px 12px", borderRadius: 8,
                          border: isLight ? "1px solid #fecaca" : "1px solid rgba(239,68,68,0.40)",
                          background: isLight ? "#fee2e2" : "rgba(239,68,68,0.10)",
                          color: isLight ? "#dc2626" : "#EF4444",
                          fontSize: 13, cursor: "pointer",
                        }}
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Convites pendentes */}
      {convitesPendentes.length > 0 && (
        <>
          <div style={SECTION_TITLE}>Convites Pendentes ({convitesPendentes.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {convitesPendentes.map((c) => (
              <div key={c.id} style={{ ...GLASS, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13,
                    color: isLight ? L.text : "#fff",
                  }}>
                    {c.nome}
                  </div>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                    color: isLight ? L.textMuted : "rgba(255,255,255,0.5)",
                    display: "flex", alignItems: "center", gap: 6, marginTop: 2,
                  }}>
                    <Mail size={11} />
                    {c.email} · {CARGO_CONFIG[c.cargo]?.label ?? c.cargo}
                  </div>
                </div>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 10,
                  color: isLight ? "#b45309" : "#FFC000",
                  padding: "4px 10px", borderRadius: 999,
                  background: isLight ? "#fef3c7" : "rgba(255,192,0,0.10)",
                  border: isLight ? "1px solid #fde68a" : "1px solid rgba(255,192,0,0.25)",
                }}>
                  Aguardando
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lista de usuários ativos */}
      <div style={SECTION_TITLE}>Usuários Ativos ({ativos.length})</div>
      {isLoading ? (
        <div style={{ ...GLASS, textAlign: "center", color: isLight ? L.textMuted : "rgba(255,255,255,0.5)" }}>Carregando...</div>
      ) : ativos.length === 0 ? (
        <div style={{ ...GLASS, textAlign: "center", color: isLight ? L.textMuted : "rgba(255,255,255,0.5)" }}>Nenhum usuário encontrado</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ativos.map((u) => {
            const cfg = CARGO_CONFIG[u.cargo] ?? { label: u.cargo, color: "#9CA3AF", desc: "" };
            const lightCfg = CARGO_LIGHT[u.cargo] ?? { color: "#4b5563", bg: "#f3f4f6", border: "1px solid #e5e7eb" };
            return (
              <div key={u.id} style={{ ...GLASS, padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: isLight ? "#fef3c7" : "rgba(255,192,0,0.12)",
                    border: isLight ? "1px solid #fde68a" : "1px solid rgba(255,192,0,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isLight ? "#b45309" : "#FFC000",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14,
                    overflow: "hidden", flexShrink: 0,
                  }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt={u.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : iniciais(u.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 14,
                      color: isLight ? L.text : "#fff",
                    }}>
                      {u.nome}
                    </div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                      color: isLight ? L.textMuted : "rgba(255,255,255,0.5)", marginTop: 2,
                    }}>
                      {u.email}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 10,
                        color: isLight ? lightCfg.color : cfg.color,
                        padding: "3px 8px", borderRadius: 999,
                        background: isLight ? lightCfg.bg : `${cfg.color}15`,
                        border: isLight ? lightCfg.border : `1px solid ${cfg.color}40`,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditingUser(u); setEditCargo(u.cargo); }}
                      title="Editar permissão"
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: isLight ? "#f3f4f6" : "rgba(96,165,250,0.10)",
                        border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(96,165,250,0.25)",
                        color: "#60A5FA",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Shield size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(u)}
                      title="Desativar usuário"
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: isLight ? "#f3f4f6" : "rgba(239,68,68,0.10)",
                        border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(239,68,68,0.25)",
                        color: "#EF4444",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Usuários inativos */}
      {inativos.length > 0 && (
        <>
          <div style={SECTION_TITLE}>Usuários Inativos ({inativos.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inativos.map((u) => (
              <div key={u.id} style={{ ...GLASS, padding: "12px 14px", opacity: 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isLight ? "#9ca3af" : "rgba(255,255,255,0.4)",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
                  }}>
                    {iniciais(u.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13,
                      color: isLight ? L.textSub : "rgba(255,255,255,0.7)",
                    }}>{u.nome}</div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                      color: isLight ? L.textMuted : "rgba(255,255,255,0.4)",
                    }}>{u.email}</div>
                  </div>
                  <span style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 9,
                    color: isLight ? L.textMuted : "rgba(255,255,255,0.5)",
                    padding: "3px 8px", borderRadius: 999,
                    background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.05)",
                    letterSpacing: "0.10em",
                  }}>
                    INATIVO
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal: Editar Cargo */}
      {editingUser && (
        <div
          onClick={() => setEditingUser(null)}
          style={{
            position: "fixed", inset: 0, background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...GLASS,
              background: isLight ? "#ffffff" : "#0F1015",
              maxWidth: 420, width: "100%",
            }}
          >
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 16,
              color: isLight ? L.text : "#fff", marginBottom: 4,
            }}>
              Editar Permissão
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12,
              color: isLight ? L.textMuted : "rgba(255,255,255,0.55)", marginBottom: 16,
            }}>
              {editingUser.nome}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {Object.entries(CARGO_CONFIG).map(([id, cfg]) => {
                const lightCfg = CARGO_LIGHT[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditCargo(id)}
                    style={{
                      textAlign: "left", padding: "12px 14px", borderRadius: 12,
                      background: editCargo === id
                        ? (isLight ? lightCfg.bg : `${cfg.color}12`)
                        : (isLight ? "#f9fafb" : "rgba(255,255,255,0.03)"),
                      border: editCargo === id
                        ? (isLight ? lightCfg.border : `1.5px solid ${cfg.color}55`)
                        : (isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)"),
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13,
                      color: isLight ? lightCfg.color : cfg.color,
                    }}>
                      {cfg.label}
                    </div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                      color: isLight ? L.textSub : "rgba(255,255,255,0.55)", marginTop: 2,
                    }}>
                      {cfg.desc}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.05)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLight ? L.textSub : "rgba(255,255,255,0.6)",
                  fontFamily: "'Montserrat', sans-serif", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => editCargoMutation.mutate({ id: editingUser.id, cargo: editCargo })}
                disabled={editCargoMutation.isPending || editCargo === editingUser.cargo}
                style={{
                  flex: 2, padding: 12, borderRadius: 12,
                  background: "linear-gradient(135deg, #FFD700, #FFC000)",
                  border: "none", color: "#08090E",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  opacity: (editCargoMutation.isPending || editCargo === editingUser.cargo) ? 0.6 : 1,
                }}
              >
                {editCargoMutation.isPending ? "Salvando..." : "Salvar Permissão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar desativação */}
      {deleteConfirm && (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: "fixed", inset: 0, background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...GLASS,
              background: isLight ? "#ffffff" : "#0F1015",
              maxWidth: 380, width: "100%", textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
              <AlertTriangle size={36} color={isLight ? "#b45309" : "#F59E0B"} />
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 16,
              color: isLight ? L.text : "#fff", marginBottom: 8,
            }}>
              Desativar {deleteConfirm.nome}?
            </div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12,
              color: isLight ? L.textMuted : "rgba(255,255,255,0.55)", marginBottom: 20, lineHeight: 1.5,
            }}>
              O usuário perderá acesso ao sistema. Esta ação pode ser revertida restaurando o acesso posteriormente.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.05)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLight ? L.textSub : "rgba(255,255,255,0.6)",
                  fontFamily: "'Montserrat', sans-serif", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: isLight ? "#fee2e2" : "rgba(239,68,68,0.20)",
                  border: isLight ? "1px solid #fecaca" : "1px solid rgba(239,68,68,0.40)",
                  color: isLight ? "#dc2626" : "#F87171",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >
                {deleteMutation.isPending ? "Desativando..." : "Desativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
