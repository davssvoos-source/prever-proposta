import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, LogOut, Pencil, Check, X, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { tempoRelativo } from "@/hooks/useNotificacoes";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  tecnico: "Técnico de Campo",
};

function PerfilPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [editandoConta, setEditandoConta] = useState(false);
  const [nomeEdit, setNomeEdit] = useState("");
  const [cargoEdit, setCargoEdit] = useState("");

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["perfil"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return { ...(data ?? {}), id: user.id, email: user.email } as any;
    },
    staleTime: 60_000,
  });

  const { data: role } = useQuery({
    queryKey: ["perfil-role", perfil?.id],
    enabled: !!perfil?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", perfil.id)
        .limit(1)
        .maybeSingle();
      return (data?.role as string | undefined) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["perfil-stats", perfil?.id],
    enabled: !!perfil?.id,
    queryFn: async () => {
      const total = await supabase
        .from("visitas_tecnicas")
        .select("id", { count: "exact", head: true })
        .eq("tecnico_id", perfil.id);
      const aprov = await supabase
        .from("visitas_tecnicas")
        .select("id", { count: "exact", head: true })
        .eq("tecnico_id", perfil.id)
        .ilike("status", "APROVADA");
      const realizadas = total.count ?? 0;
      const aprovadas = aprov.count ?? 0;
      const taxa = realizadas > 0 ? Math.round((aprovadas / realizadas) * 100) : null;
      return { realizadas, aprovadas, taxa };
    },
    staleTime: 60_000,
  });

  const { data: ultimasVisitas = [] } = useQuery({
    queryKey: ["perfil-visitas", perfil?.id],
    enabled: !!perfil?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("id, nome_predio, status, data_hora_agendada, created_at")
        .eq("tecnico_id", perfil.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: ultimasNotifs = [] } = useQuery({
    queryKey: ["perfil-notifs", perfil?.id],
    enabled: !!perfil?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, corpo, tipo, lida, created_at, visita_id")
        .or(`user_id.eq.${perfil.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return data ?? [];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (perfil && !editandoConta) {
      setNomeEdit(perfil.nome ?? "");
      setCargoEdit(perfil.cargo ?? "");
    }
  }, [perfil, editandoConta]);

  const iniciais = perfil?.nome
    ? perfil.nome
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const FORMATOS_ACEITOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!FORMATOS_ACEITOS.includes(file.type)) {
        throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // bucket é privado — usar signed URL (1 ano)
      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;
      const finalUrl = `${signed.signedUrl}${signed.signedUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: finalUrl })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      return finalUrl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfil"] });
      qc.invalidateQueries({ queryKey: ["meu-perfil-header"] });
      toast.success("Foto de perfil atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contaMutation = useMutation({
    mutationFn: async () => {
      if (!perfil?.id) throw new Error("Sem perfil");
      const { error } = await supabase
        .from("profiles")
        .update({ nome: nomeEdit.trim(), cargo: cargoEdit.trim() || null })
        .eq("id", perfil.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfil"] });
      qc.invalidateQueries({ queryKey: ["perfil-header"] });
      setEditandoConta(false);
      toast.success("Dados atualizados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const senhaMutation = useMutation({
    mutationFn: async () => {
      if (novaSenha.length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres.");
      if (novaSenha !== confirmarSenha) throw new Error("As senhas não coincidem.");
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovaSenha("");
      setConfirmarSenha("");
      toast.success("Senha alterada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logoutMutation = useMutation({
    mutationFn: () => supabase.auth.signOut(),
    onSuccess: () => {
      window.location.href = "/auth";
    },
  });

  if (isLoading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 60,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
        }}
      >
        Carregando...
      </div>
    );
  }

  const roleLabel = role ? ROLE_LABEL[role] ?? role : null;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: 22,
          color: "#fff",
          marginBottom: 20,
        }}
      >
        Perfil
      </div>

      {/* Seção 1 - Hero */}
      <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          {perfil?.avatar_url ? (
            <img
              src={perfil.avatar_url}
              alt="avatar"
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid rgba(255,192,0,0.45)",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#FFD700,#FF9F00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: 28,
                color: "#08090E",
                border: "3px solid rgba(255,192,0,0.3)",
              }}
            >
              {iniciais}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarMutation.isPending}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#FFD700,#FFC000)",
              border: "2px solid #08090E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Camera size={14} color="#08090E" />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) avatarMutation.mutate(f);
          }}
        />
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: "#fff",
            marginTop: 14,
          }}
        >
          {perfil?.nome ?? "—"}
        </div>
        {perfil?.cargo && (
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#FFC000",
              marginTop: 4,
            }}
          >
            {perfil.cargo}
          </div>
        )}
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 4,
          }}
        >
          {perfil?.email}
        </div>
        {roleLabel && (
          <div
            style={{
              marginTop: 12,
              padding: "5px 12px",
              borderRadius: 999,
              background: "rgba(255,192,0,0.10)",
              border: "1px solid rgba(255,192,0,0.30)",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "#FFC000",
            }}
          >
            {roleLabel}
          </div>
        )}
      </div>

      {/* Seção 2 - Estatísticas */}
      <div style={CARD}>
        <div style={LBL}>Atividade no sistema</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            marginTop: 14,
          }}
        >
          <Stat label="Visitas" value={String(stats?.realizadas ?? 0)} />
          <Divisor />
          <Stat label="Aprovadas" value={String(stats?.aprovadas ?? 0)} />
          <Divisor />
          <Stat
            label="Aprovação"
            value={stats?.taxa == null ? "—" : `${stats.taxa}%`}
          />
        </div>
      </div>

      {/* Seção 3 - Últimas visitas */}
      <div style={CARD}>
        <div style={LBL}>Atividade recente</div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {ultimasVisitas.length === 0 ? (
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                padding: "16px 0",
                textAlign: "center",
              }}
            >
              Nenhuma visita registrada ainda
            </div>
          ) : (
            ultimasVisitas.map((v: any) => (
              <button
                key={v.id}
                onClick={() => navigate({ to: "/visita/$id", params: { id: v.id } })}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  textAlign: "left",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: 13,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {v.nome_predio ?? "Sem nome"}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                      marginTop: 2,
                    }}
                  >
                    {new Date(v.data_hora_agendada ?? v.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                {v.status && <StatusBadge status={String(v.status).toLowerCase()} />}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Seção 4 - Conta */}
      <div style={CARD}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ ...LBL, marginBottom: 0 }}>Informações da conta</div>
          {!editandoConta ? (
            <button
              onClick={() => setEditandoConta(true)}
              style={iconBtn}
              aria-label="Editar"
            >
              <Pencil size={14} />
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => contaMutation.mutate()}
                disabled={contaMutation.isPending}
                style={{ ...iconBtn, color: "#FFC000" }}
                aria-label="Salvar"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setEditandoConta(false)}
                style={iconBtn}
                aria-label="Cancelar"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        {!editandoConta ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Row label="Nome" value={perfil?.nome ?? "—"} />
            <Row label="E-mail" value={perfil?.email ?? "—"} />
            <Row label="Cargo" value={perfil?.cargo ?? "—"} highlight />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={LBL}>Nome</label>
              <input
                style={INPUT}
                value={nomeEdit}
                onChange={(e) => setNomeEdit(e.target.value)}
              />
            </div>
            <div>
              <label style={LBL}>Cargo</label>
              <input
                style={INPUT}
                value={cargoEdit}
                onChange={(e) => setCargoEdit(e.target.value)}
              />
            </div>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              E-mail não pode ser alterado por aqui.
            </div>
          </div>
        )}
      </div>

      {/* Seção 5 - Segurança */}
      <div style={CARD}>
        <div style={{ ...LBL, marginBottom: 14 }}>Alterar senha</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={LBL}>Nova senha</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...INPUT, paddingRight: 44 }}
                type={showNova ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Min. 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNova((p) => !p)}
                style={eyeBtnStyle}
              >
                {showNova ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label style={LBL}>Confirmar nova senha</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...INPUT, paddingRight: 44 }}
                type={showConf ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
              />
              <button
                type="button"
                onClick={() => setShowConf((p) => !p)}
                style={eyeBtnStyle}
              >
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            onClick={() => senhaMutation.mutate()}
            disabled={senhaMutation.isPending || !novaSenha || !confirmarSenha}
            style={{
              height: 48,
              borderRadius: 24,
              background:
                novaSenha && confirmarSenha
                  ? "linear-gradient(135deg,#FFD700,#FFC000)"
                  : "rgba(255,255,255,0.07)",
              border: "none",
              color: novaSenha && confirmarSenha ? "#08090E" : "rgba(255,255,255,0.3)",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 13,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: novaSenha && confirmarSenha ? "pointer" : "default",
              transition: "all 0.2s",
              opacity: senhaMutation.isPending ? 0.7 : 1,
            }}
          >
            {senhaMutation.isPending ? "Salvando..." : "Salvar nova senha →"}
          </button>
        </div>
      </div>

      {/* Seção 6 - Notificações recentes */}
      {ultimasNotifs.length > 0 && (
        <div style={CARD}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ ...LBL, marginBottom: 0 }}>Notificações recentes</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ultimasNotifs.map((n: any) => (
              <button
                key={n.id}
                onClick={() => {
                  if (n.visita_id) navigate({ to: "/visita/$id", params: { id: n.visita_id } });
                }}
                style={{
                  background: n.lida ? "transparent" : "rgba(255,192,0,0.05)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: n.visita_id ? "pointer" : "default",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: n.lida ? 400 : 500,
                    fontSize: 12,
                    color: "#fff",
                  }}
                >
                  {n.titulo}
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    color: "rgba(255,192,0,0.55)",
                    marginTop: 3,
                    letterSpacing: "0.06em",
                  }}
                >
                  {tempoRelativo(n.created_at)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => logoutMutation.mutate()}
        style={{
          width: "100%",
          height: 52,
          borderRadius: 26,
          background: "rgba(239,68,68,0.10)",
          border: "1px solid rgba(239,68,68,0.30)",
          color: "rgba(239,68,68,0.85)",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 400,
          fontSize: 13,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <LogOut size={16} />
        Sair da conta
      </button>
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
  marginBottom: 16,
};

const LBL: CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 300,
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,192,0,0.65)",
  marginBottom: 8,
  display: "block",
};

const INPUT: CSSProperties = {
  width: "100%",
  height: 50,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  color: "#fff",
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 300,
  fontSize: 14,
  padding: "0 14px",
  outline: "none",
  boxSizing: "border-box",
};

const iconBtn: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(255,255,255,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const eyeBtnStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "rgba(255,255,255,0.4)",
  display: "flex",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: 28,
          color: "#FFC000",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 11,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Divisor() {
  return (
    <div
      style={{
        width: 1,
        height: 36,
        background: "linear-gradient(180deg,transparent,rgba(255,192,0,0.35),transparent)",
      }}
    />
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 400,
          fontSize: 12,
          color: highlight ? "#FFC000" : "#fff",
        }}
      >
        {value}
      </span>
    </div>
  );
}
