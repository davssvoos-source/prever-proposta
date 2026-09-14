import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type CSSProperties } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VERSAO } from "@/lib/versao";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { LightBackground } from "@/components/LightBackground";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

// R277: não há mais "register" — a conta nasce por convite do admin
// (Administrativo › Usuários), nunca por auto-cadastro.
type AuthMode = "login" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

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
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link de recuperação enviado para " + email);
    setMode("login");
  }




  const textPrimary = isLight ? "#212121" : "#fff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.45)";
  const goldDark = isLight ? "#A06108" : "rgba(248,200,17,0.65)";
  const CARD: CSSProperties = {
    background: isLight ? "rgba(255,255,255,0.92)" : "rgba(8,8,12,0.55)",
    backdropFilter: "blur(20px) saturate(160%)",
    WebkitBackdropFilter: "blur(20px) saturate(160%)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: "32px 24px",
    boxShadow: isLight ? "0 4px 24px rgba(0,0,0,0.08)" : "0 4px 24px rgba(0,0,0,0.5)",
  };
  const INPUT: CSSProperties = {
    width: "100%",
    height: 52,
    background: isLight ? "#f5f5f5" : "linear-gradient(160deg, #161616 0%, #101010 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    color: textPrimary,
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 14,
    padding: "0 16px",
    outline: "none",
    boxSizing: "border-box",
  };
  const BTN_GOLD: CSSProperties = {
    width: "100%",
    height: 52,
    borderRadius: 26,
    background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
    border: "none",
    color: "#0E0E0E",
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: isLight ? "0 4px 16px rgba(160,97,8,0.35)" : "0 4px 24px rgba(248,200,17,0.35)",
  };
  const BTN_GHOST: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 12,
    color: textSecondary,
    letterSpacing: "0.06em",
  };
  const LBL: CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: goldDark,
    marginBottom: 8,
    display: "block",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isLight ? "#eeeeee" : "#0E0E0E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isLight ? <LightBackground /> : <AnimatedBackground />}
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
              "drop-shadow(0 0 4px rgba(248,200,17,0.45)) " +
              "drop-shadow(0 0 10px rgba(248,200,17,0.20))",
            }}
          />
          {/* R230 (U120), Davi: "o nome do sistema será Prever OS, e deverá
              estar no título da página de login." A ordem é a da identidade: a
              MARCA é o Grupo Prever (o logotipo acima), o PRODUTO é o Prever
              OS. A linha de baixo diz de quem é e em que versão — a versão é a
              primeira coisa que o suporte pergunta (R229), e aqui ela é lida
              antes de entrar. */}
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--fonte)",
              fontWeight: 600,
              fontSize: 27,
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
              color: isLight ? "#212121" : "#ffffff",
            }}
          >
            Prever OS
          </h1>
          <div
            style={{
              marginTop: 7,
              fontFamily: "var(--fonte)",
              fontWeight: 400,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: isLight ? "#727272" : "rgba(255,255,255,0.35)",
            }}
          >
            Grupo Prever · v{VERSAO}
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
                      color: isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)",
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
                  color: isLight ? "#505050" : "rgba(255,255,255,0.5)",
                  marginBottom: 4,
                }}
              >
                <ArrowLeft size={14} /> Voltar ao login
              </button>
              <div>
                <div
                  style={{
                    fontFamily: "var(--fonte)",
                    fontWeight: 400,
                    fontSize: 17,
                    color: isLight ? "#212121" : "#fff",
                    marginBottom: 6,
                  }}
                >
                  Recuperar senha
                </div>
                <div
                  style={{
                    fontFamily: "var(--fonte)",
                    fontWeight: 400,
                    fontSize: 12,
                    color: isLight ? "#6b7280" : "rgba(255,255,255,0.45)",
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


        </div>
      </div>
    </div>
  );
}
