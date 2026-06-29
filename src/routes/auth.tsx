import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type CSSProperties } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type AuthMode = "login" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleLogin() {
    if (!email || !senha) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function handleForgot() {
    if (!email) {
      toast.error("Informe seu e-mail.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link de recuperação enviado para " + email);
    setMode("login");
  }

  async function handleReset() {
    if (!novaSenha || !confirmarSenha) {
      toast.error("Preencha os campos.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (novaSenha.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada com sucesso!");
    navigate({ to: "/dashboard" });
  }

  const CARD: CSSProperties = {
    background: "rgba(8,8,12,0.55)",
    backdropFilter: "blur(20px) saturate(160%)",
    WebkitBackdropFilter: "blur(20px) saturate(160%)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: "32px 24px",
  };
  const INPUT: CSSProperties = {
    width: "100%",
    height: 52,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    color: "#fff",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 14,
    padding: "0 16px",
    outline: "none",
    boxSizing: "border-box",
  };
  const BTN_GOLD: CSSProperties = {
    width: "100%",
    height: 52,
    borderRadius: 26,
    background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
    border: "none",
    color: "#08090E",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 13,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 4px 24px rgba(255,192,0,0.35)",
  };
  const BTN_GHOST: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.06em",
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AnimatedBackground />
      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src="/logo-prever.svg"
            alt="Grupo Prever"
            style={{
              height: 72,
              width: "auto",
              objectFit: "contain",
              display: "block",
              margin: "0 auto 12px",
              filter:
                "drop-shadow(0 0 8px rgba(255,192,0,0.90)) " +
                "drop-shadow(0 0 20px rgba(255,192,0,0.55)) " +
                "drop-shadow(0 0 40px rgba(255,192,0,0.25))",
            }}
          />
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Sistema de Gestão
          </div>
        </div>

        <div style={CARD}>
          {mode === "login" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={LBL}>E-mail</label>
                <input
                  style={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <div>
                <label style={LBL}>Senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...INPUT, paddingRight: 48 }}
                    type={showSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((p) => !p)}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.4)",
                      display: "flex",
                    }}
                  >
                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                style={{ ...BTN_GOLD, opacity: loading ? 0.7 : 1, marginTop: 4 }}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <button onClick={() => setMode("forgot")} style={BTN_GHOST}>
                  Esqueci minha senha
                </button>
              </div>
            </div>
          )}

          {mode === "forgot" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button
                onClick={() => setMode("login")}
                style={{
                  ...BTN_GHOST,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 4,
                }}
              >
                <ArrowLeft size={14} /> Voltar ao login
              </button>
              <div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: 17,
                    color: "#fff",
                    marginBottom: 6,
                  }}
                >
                  Recuperar senha
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    lineHeight: 1.5,
                  }}
                >
                  Informe seu e-mail e enviaremos um link para criar uma nova senha.
                </div>
              </div>
              <div>
                <label style={LBL}>Seu e-mail</label>
                <input
                  style={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                />
              </div>
              <button
                onClick={handleForgot}
                disabled={loading}
                style={{ ...BTN_GOLD, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Enviando..." : "Enviar link de recuperação →"}
              </button>
            </div>
          )}

          {mode === "recovery" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: 17,
                    color: "#fff",
                    marginBottom: 6,
                  }}
                >
                  Nova senha
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    lineHeight: 1.5,
                  }}
                >
                  Defina sua nova senha de acesso.
                </div>
              </div>
              <div>
                <label style={LBL}>Nova senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...INPUT, paddingRight: 48 }}
                    type={showNovaSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Min. 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha((p) => !p)}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.4)",
                      display: "flex",
                    }}
                  >
                    {showNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={LBL}>Confirmar nova senha</label>
                <input
                  style={INPUT}
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a senha"
                  onKeyDown={(e) => e.key === "Enter" && handleReset()}
                />
              </div>
              <button
                onClick={handleReset}
                disabled={loading}
                style={{ ...BTN_GOLD, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Salvando..." : "Salvar nova senha →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
