import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["perfil"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return { ...(data ?? {}), email: user.email } as any;
    },
  });

  const iniciais = perfil?.nome
    ? perfil.nome
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const cacheBusted = `${publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: cacheBusted })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      return cacheBusted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfil"] });
      qc.invalidateQueries({ queryKey: ["perfil-header"] });
      toast.success("Foto de perfil atualizada!");
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

  const CARD: CSSProperties = {
    background: "rgba(8,8,12,0.22)",
    backdropFilter: "blur(12px) saturate(130%)",
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

  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: 22,
          color: "#fff",
          marginBottom: 24,
        }}
      >
        Perfil
      </div>

      {/* Avatar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
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
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) avatarMutation.mutate(f);
          }}
        />
        {avatarMutation.isPending && (
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: "rgba(255,192,0,0.6)",
              marginTop: 8,
            }}
          >
            Enviando foto...
          </div>
        )}
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 18,
            color: "#fff",
            marginTop: 12,
          }}
        >
          {perfil?.nome ?? "—"}
        </div>
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            marginTop: 2,
          }}
        >
          {perfil?.email}
        </div>
        {perfil?.cargo && (
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,192,0,0.65)",
              marginTop: 4,
            }}
          >
            {perfil.cargo}
          </div>
        )}
      </div>

      {/* Conta */}
      <div style={CARD}>
        <div style={{ ...LBL, marginBottom: 14 }}>Informações da conta</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="Nome" value={perfil?.nome ?? "—"} />
          <Row label="E-mail" value={perfil?.email ?? "—"} />
          <Row label="Cargo" value={perfil?.cargo ?? "—"} highlight />
        </div>
      </div>

      {/* Senha */}
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
              fontWeight: 300,
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

      <button
        onClick={() => logoutMutation.mutate()}
        style={{
          width: "100%",
          height: 52,
          borderRadius: 26,
          background: "rgba(239,68,68,0.10)",
          border: "1px solid rgba(239,68,68,0.30)",
          color: "rgba(239,68,68,0.8)",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
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
