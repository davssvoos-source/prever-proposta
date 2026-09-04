// A gestão de usuários — quem tem conta, cargo e equipe; convites e
// solicitações de acesso.
//
// ── R131/U94: SAIU DA ROTA E VIROU SEÇÃO DO ADMINISTRATIVO ────────────────
// Até a U94 isto era a página `/gerencial/usuarios`, com cabeçalho e botão de
// voltar próprios. O Davi pediu (03/09/2026) que "os usuários sejam listados
// diretamente na página Administrativa e as permissões estejam junto" — então
// o corpo virou componente e mora na aba Usuários do painel. A rota antiga só
// redireciona. Nada da lógica mudou: as mesmas consultas, as mesmas mutações,
// as mesmas invalidações que fazem o usuário novo aparecer na hora nas listas
// que montam equipe, programação e responsável.
//
// A equipe aqui é ROTEAMENTO, não permissão (U0): ela define de quem é a fila
// de demandas. Quem vê o quê continua vindo do cargo — e a matriz de telas por
// papel é a seção vizinha (Permissoes.tsx).

import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Shield, Trash2, Mail, AlertTriangle, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enviarConvite } from "@/lib/convites.functions";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { EQUIPES, EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";

const L = {
  card: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
  cardSolid: "#ffffff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderMd: "1px solid rgba(0,0,0,0.10)",
  shadow: "0 1px 6px rgba(0,0,0,0.07)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.05)",
  text: "#1e2229",
  textSub: "#4a5060",
  textMuted: "#7d8391",
  gold: "#A06108",
  goldBg: "rgba(160,97,8,0.10)",
  goldBorder: "1px solid rgba(160,97,8,0.22)",
  inputBg: "#f0f1f4",
  inputBorder: "1px solid rgba(0,0,0,0.10)",
};

type CargoId = "tecnico" | "sac" | "comercial" | "admin";

const CARGO_LIGHT: Record<string, { color: string; bg: string; border: string }> = {
  tecnico:   { color: "#15803d", bg: "#dcfce7", border: "1px solid #bbf7d0" },
  sac:       { color: "#6d28d9", bg: "#ede9fe", border: "1px solid #ddd6fe" },
  comercial: { color: "#1d4ed8", bg: "#dbeafe", border: "1px solid #bfdbfe" },
  admin:     { color: "#A63E17", bg: "#fef3c7", border: "1px solid #fde68a" },
};

const CARGO_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  tecnico:   { label: "Técnico",   color: "#2DD2A5", desc: "Executa o que está atribuído a ele (3 abas)" },
  sac:       { label: "SAC",       color: "#A78BFA", desc: "Gestor de chamados — abre e acompanha tudo, não vê valores" },
  comercial: { label: "Comercial", color: "#60A5FA", desc: "Gestor que vê valores: propostas, contratos e fechamentos" },
  admin:     { label: "Admin",     color: "#F17881", desc: "Acesso total + gerenciamento de usuários" },
};

type StaffUser = {
  id: string;
  nome: string;
  cargo: string;
  /** Equipe de roteamento de demandas (U0) — atributo, não permissão. */
  equipe: string | null;
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

export function GestaoDeUsuarios() {
  const { isLight } = useTheme();
  const qc = useQueryClient();
  const enviarConviteFn = useServerFn(enviarConvite);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteNome, setInviteNome] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCargo, setInviteCargo] = useState<CargoId>("tecnico");

  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editCargo, setEditCargo] = useState<string>("");
  const [editEquipe, setEditEquipe] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<StaffUser | null>(null);
  const [aprovarId, setAprovarId] = useState<string | null>(null);
  const [aprovarCargo, setAprovarCargo] = useState<CargoId>("tecnico");

  const GLASS: CSSProperties = isLight
    ? {
        background: L.card,
        border: L.border,
        borderRadius: 18,
        boxShadow: L.shadow,
        padding: 16,
      }
    : {
        background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(248,200,17,0.10)",
        borderRadius: 18,
        padding: 16,
      };

  const INPUT: CSSProperties = {
    width: "100%",
    background: isLight ? L.inputBg : "rgba(8,8,12,0.30)",
    border: isLight ? L.inputBorder : "1px solid rgba(248,200,17,0.18)",
    borderRadius: 10,
    color: isLight ? L.text : "#F0F2F5",
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(248,200,17,0.65)",
    marginBottom: 6,
    display: "block",
  };

  const SECTION_TITLE: CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 10,
    color: isLight ? "rgba(0,0,0,0.45)" : "rgba(248,200,17,0.55)",
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
        .select("id, nome, cargo, equipe, avatar_url, ativo, email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        nome: p.nome ?? "Sem nome",
        cargo: p.cargo ?? "tecnico",
        equipe: p.equipe ?? null,
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
      qc.invalidateQueries({ queryKey: ["painel-admin-numeros"] });
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
      qc.invalidateQueries({ queryKey: ["painel-admin-numeros"] });
      toast.success("Solicitação rejeitada.");
    },
    onError: () => toast.error("Erro ao rejeitar."),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim() || !inviteNome.trim()) {
        throw new Error("Preencha nome e e-mail");
      }
      return await enviarConviteFn({
        data: { email: inviteEmail.trim(), nome: inviteNome.trim(), cargo: inviteCargo },
      });
    },
    onSuccess: (r: any) => {
      // R59: a conta existe nos dois casos — o que muda é se o convite saiu
      // por e-mail. Dizer "convite enviado" quando o envio falhou faria o
      // admin esperar por um e-mail que nunca vai chegar.
      if (r?.emailEnviado === false) {
        toast.success(
          `${inviteNome} já está cadastrado e pode ser usado no sistema. O e-mail de convite não saiu — peça para entrar por "esqueci minha senha".`,
          { duration: 8000 },
        );
      } else {
        toast.success(`Convite enviado para ${inviteEmail}`);
      }
      setInviteNome(""); setInviteEmail(""); setInviteCargo("tecnico");
      setShowInvite(false);
      qc.invalidateQueries({ queryKey: ["convites-pendentes"] });
      // o novo usuário precisa aparecer JÁ nas listas que montam duplas,
      // programação e responsável — sem isto ele só surgiria no próximo
      // refetch natural, e o admin acharia que o cadastro não pegou
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["pessoas-ativas"] });
      qc.invalidateQueries({ queryKey: ["tecnicos-ativos"] });
      qc.invalidateQueries({ queryKey: ["painel-admin-numeros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editCargoMutation = useMutation({
    mutationFn: async ({ id, cargo, equipe }: { id: string; cargo: string; equipe: string | null }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ cargo, equipe } as any)
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
      // user_roles é sincronizado pelo trigger trg_sync_user_role a partir do
      // cargo — fazer aqui também falharia quando um admin se rebaixa (perde a
      // permissão de escrever em user_roles no meio da operação).
    },
    onSuccess: () => {
      toast.success("Permissão atualizada");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["bottomnav-cargo"] });
      qc.invalidateQueries({ queryKey: ["tecnicos-ativos"] });
      qc.invalidateQueries({ queryKey: ["painel-admin-numeros"] });
    },
    onError: (e: Error) => {
      console.error("[editCargo] mutation error:", e);
      toast.error(e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ ativo: false })
        .eq("id", id)
        .select("id");
      if (error) {
        console.error("[deleteMutation] error:", error);
        throw error;
      }
      if (!data || data.length === 0) {
        console.error("[deleteMutation] Nenhuma linha atualizada — verifique permissões (RLS) ou id do usuário.", { id });
        throw new Error("Sem permissão para desativar este usuário.");
      }
    },
    onSuccess: () => {
      toast.success("Usuário desativado");
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["painel-admin-numeros"] });
    },
    onError: (e: Error) => {
      console.error("[deleteMutation] mutation error:", e);
      toast.error(e.message);
    },
  });

  const reativarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ ativo: true })
        .eq("id", id)
        .select("id");
      if (error) {
        console.error("[reativarMutation] error:", error);
        throw error;
      }
      if (!data || data.length === 0) {
        throw new Error("Sem permissão para reativar este usuário.");
      }
    },
    onSuccess: () => {
      toast.success("Usuário reativado");
      qc.invalidateQueries({ queryKey: ["staff-profiles"] });
      qc.invalidateQueries({ queryKey: ["painel-admin-numeros"] });
    },
    onError: (e: Error) => {
      console.error("[reativarMutation] mutation error:", e);
      toast.error(e.message);
    },
  });

  const ativos = usuarios.filter((u) => u.ativo !== false);
  const inativos = usuarios.filter((u) => u.ativo === false);

  return (
    <div style={{ color: isLight ? L.text : "#F0F2F5" }}>
      {/* Cabeçalho da seção: contagem e o botão de convidar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 15.5,
            color: isLight ? L.text : "#fff",
          }}>
            Usuários
          </div>
          <div style={{
            fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11.5,
            color: isLight ? L.textMuted : "rgba(255,255,255,0.5)",
          }}>
            {ativos.length} ativo{ativos.length !== 1 ? "s" : ""}
            {convitesPendentes.length > 0 && ` · ${convitesPendentes.length} convite${convitesPendentes.length !== 1 ? "s" : ""} pendente${convitesPendentes.length !== 1 ? "s" : ""}`}
            {" · "}a equipe define de quem é a fila; o cargo define o que se vê
          </div>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            background: "linear-gradient(135deg, #FCDE48, #F8C811, #E8B00A)",
            border: "none", borderRadius: 12, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
            color: "#08090E", fontFamily: "var(--fonte)",
            fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}
        >
          <UserPlus size={16} />
          Convidar
        </button>
      </div>

      {/* Formulário de convite */}
      {showInvite && (
        <div style={{ ...GLASS, marginBottom: 20, marginTop: 14 }}>
          <div style={{
            fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
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
                          : (isLight ? "#f9fafb" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)"),
                        border: inviteCargo === id
                          ? (isLight ? lightCfg.border : `1.5px solid ${cfg.color}55`)
                          : (isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)"),
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                        color: isLight ? lightCfg.color : cfg.color,
                      }}>
                        {cfg.label}
                      </div>
                      <div style={{
                        fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
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
                  background: isLight ? "#f3f4f6" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLight ? L.textSub : "rgba(255,255,255,0.6)",
                  fontFamily: "var(--fonte)", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !inviteEmail.trim() || !inviteNome.trim()}
                style={{
                  flex: 2, padding: 12, borderRadius: 12,
                  background: "linear-gradient(135deg, #FCDE48, #F8C811)",
                  border: "none", color: "#08090E",
                  fontFamily: "var(--fonte)", fontWeight: 600,
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
                    background: isLight ? "#fef3c7" : "rgba(248,200,17,0.12)",
                    border: isLight ? "1px solid #fde68a" : "1px solid rgba(248,200,17,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isLight ? "#A63E17" : "#F8C811",
                    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13,
                    flexShrink: 0,
                  }}>
                    {iniciais(s.nome ?? s.email)}
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                      color: isLight ? L.text : "#fff",
                    }}>
                      {s.nome ?? "—"}
                    </div>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
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
                          background: isLight ? "#f3f4f6" : "#191921",
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
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#059676", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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
                          background: isLight ? "#fef3c7" : "rgba(248,200,17,0.15)",
                          border: isLight ? "1px solid #fde68a" : "1px solid rgba(248,200,17,0.40)",
                          color: isLight ? "#A63E17" : "#F8C811",
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
                          color: isLight ? "#dc2626" : "#E64D58",
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
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                    color: isLight ? L.text : "#fff",
                  }}>
                    {c.nome}
                  </div>
                  <div style={{
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
                    color: isLight ? L.textMuted : "rgba(255,255,255,0.5)",
                    display: "flex", alignItems: "center", gap: 6, marginTop: 2,
                  }}>
                    <Mail size={11} />
                    {c.email} · {CARGO_CONFIG[c.cargo]?.label ?? c.cargo}
                  </div>
                </div>
                <div style={{
                  fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 10,
                  color: isLight ? "#A63E17" : "#F8C811",
                  padding: "4px 10px", borderRadius: 999,
                  background: isLight ? "#fef3c7" : "rgba(248,200,17,0.10)",
                  border: isLight ? "1px solid #fde68a" : "1px solid rgba(248,200,17,0.25)",
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
                    background: isLight ? "#fef3c7" : "rgba(248,200,17,0.12)",
                    border: isLight ? "1px solid #fde68a" : "1px solid rgba(248,200,17,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isLight ? "#A63E17" : "#F8C811",
                    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 14,
                    overflow: "hidden", flexShrink: 0,
                  }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt={u.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : iniciais(u.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
                      color: isLight ? L.text : "#fff",
                    }}>
                      {u.nome}
                    </div>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
                      color: isLight ? L.textMuted : "rgba(255,255,255,0.5)", marginTop: 2,
                    }}>
                      {u.email}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 10,
                        color: isLight ? lightCfg.color : cfg.color,
                        padding: "3px 8px", borderRadius: 999,
                        background: isLight ? lightCfg.bg : `${cfg.color}15`,
                        border: isLight ? lightCfg.border : `1px solid ${cfg.color}40`,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>
                        {cfg.label}
                      </span>
                      {u.equipe && (
                        <span style={{
                          fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 10,
                          color: isLight ? equipeCores(u.equipe).light : equipeCores(u.equipe).dark,
                          padding: "3px 8px", borderRadius: 999,
                          background: equipeCores(u.equipe).bg,
                          border: `1px solid ${equipeCores(u.equipe).border}`,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                        }}>
                          {EQUIPE_LABEL[u.equipe as Equipe] ?? u.equipe}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditingUser(u); setEditCargo(u.cargo); setEditEquipe(u.equipe ?? ""); }}
                      title="Editar permissão e equipe"
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: isLight ? "#f3f4f6" : "rgba(96,165,250,0.10)",
                        border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(96,165,250,0.25)",
                        color: isLight ? "#1d4ed8" : "#60A5FA",
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
                        color: isLight ? "#dc2626" : "#E64D58",
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
                    background: isLight ? "#f3f4f6" : "#191921",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isLight ? "#9ca3af" : "rgba(255,255,255,0.4)",
                    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12,
                  }}>
                    {iniciais(u.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                      color: isLight ? L.textSub : "rgba(255,255,255,0.7)",
                    }}>{u.nome}</div>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
                      color: isLight ? L.textMuted : "rgba(255,255,255,0.4)",
                    }}>{u.email}</div>
                  </div>
                  <span style={{
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 9,
                    color: isLight ? "#B1242E" : "#FCA5A5",
                    padding: "3px 8px", borderRadius: 999,
                    background: isLight ? "#fee2e2" : "rgba(239,68,68,0.12)",
                    border: isLight ? "1px solid #fecaca" : "1px solid rgba(239,68,68,0.25)",
                    letterSpacing: "0.10em",
                  }}>
                    INATIVO
                  </span>
                  <button
                    onClick={() => reativarMutation.mutate(u.id)}
                    disabled={reativarMutation.isPending}
                    title="Reativar usuário"
                    style={{
                      width: 34, height: 34, borderRadius: 10, marginLeft: 8,
                      background: isLight ? "#dcfce7" : "rgba(34,197,94,0.12)",
                      border: isLight ? "1px solid #bbf7d0" : "1px solid rgba(34,197,94,0.30)",
                      color: isLight ? "#15803d" : "#22C55E",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: reativarMutation.isPending ? "not-allowed" : "pointer",
                      opacity: reativarMutation.isPending ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
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
              fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 16,
              color: isLight ? L.text : "#fff", marginBottom: 4,
            }}>
              Permissão e equipe
            </div>
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12,
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
                        : (isLight ? "#f9fafb" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)"),
                      border: editCargo === id
                        ? (isLight ? lightCfg.border : `1.5px solid ${cfg.color}55`)
                        : (isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)"),
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                      color: isLight ? lightCfg.color : cfg.color,
                    }}>
                      {cfg.label}
                    </div>
                    <div style={{
                      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
                      color: isLight ? L.textSub : "rgba(255,255,255,0.55)", marginTop: 2,
                    }}>
                      {cfg.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Equipe — roteamento de demandas, não permissão (PLANO_UNIFICACAO §4.2) */}
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: isLight ? L.textMuted : "rgba(255,255,255,0.45)", marginBottom: 8,
            }}>
              Equipe
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {(["", ...EQUIPES] as string[]).map((eq) => {
                const ativo = editEquipe === eq;
                const cores = equipeCores(eq || null);
                return (
                  <button
                    key={eq || "sem"}
                    type="button"
                    onClick={() => setEditEquipe(eq)}
                    style={{
                      padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                      fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11,
                      color: ativo ? (isLight ? cores.light : cores.dark) : (isLight ? L.textSub : "rgba(255,255,255,0.55)"),
                      background: ativo ? cores.bg : (isLight ? "#f9fafb" : "rgba(255,255,255,0.03)"),
                      border: ativo
                        ? `1.5px solid ${cores.border}`
                        : (isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)"),
                    }}
                  >
                    {eq ? EQUIPE_LABEL[eq as Equipe] : "Sem equipe"}
                  </button>
                );
              })}
            </div>
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
              color: isLight ? L.textMuted : "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.5,
            }}>
              A equipe define de quem é a fila de demandas. Não altera permissão — quem vê o quê continua
              vindo do cargo.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: isLight ? "#f3f4f6" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLight ? L.textSub : "rgba(255,255,255,0.6)",
                  fontFamily: "var(--fonte)", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              {(() => {
                const semMudanca =
                  editCargo === editingUser.cargo && editEquipe === (editingUser.equipe ?? "");
                const travado = editCargoMutation.isPending || semMudanca;
                return (
                  <button
                    onClick={() =>
                      editCargoMutation.mutate({
                        id: editingUser.id,
                        cargo: editCargo,
                        equipe: editEquipe || null,
                      })
                    }
                    disabled={travado}
                    style={{
                      flex: 2, padding: 12, borderRadius: 12,
                      background: "linear-gradient(135deg, #FCDE48, #F8C811)",
                      border: "none", color: "#08090E",
                      fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13,
                      cursor: travado ? "default" : "pointer",
                      opacity: travado ? 0.6 : 1,
                    }}
                  >
                    {editCargoMutation.isPending ? "Salvando..." : "Salvar"}
                  </button>
                );
              })()}
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
              <AlertTriangle size={36} color={isLight ? "#A63E17" : "#F59E0B"} />
            </div>
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 16,
              color: isLight ? L.text : "#fff", marginBottom: 8,
            }}>
              Desativar {deleteConfirm.nome}?
            </div>
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12,
              color: isLight ? L.textMuted : "rgba(255,255,255,0.55)", marginBottom: 20, lineHeight: 1.5,
            }}>
              O usuário perderá acesso ao sistema. Esta ação pode ser revertida restaurando o acesso posteriormente.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  background: isLight ? "#f3f4f6" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: isLight ? L.textSub : "rgba(255,255,255,0.6)",
                  fontFamily: "var(--fonte)", fontSize: 13, cursor: "pointer",
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
                  color: isLight ? "#dc2626" : "#F17881",
                  fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13, cursor: "pointer",
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
