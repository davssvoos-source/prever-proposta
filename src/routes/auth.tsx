import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type CSSProperties } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type AuthMode = "login" | "forgot" | "register";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
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

  async function handleRegister() {
    if (!nome.trim() || !email.trim() || !senha || !confirmarSenha) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: email.trim(),
          nome: nome.trim(),
          cargo: null,
          status: "pendente_aprovacao",
        } as any);
        await supabase.auth.signOut();
        toast.success("Solicitação enviada! Aguarde a aprovação do administrador.");
        setNome("");
        setEmail("");
        setSenha("");
        setConfirmarSenha("");
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
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
              "drop-shadow(0 0 4px rgba(255,192,0,0.45)) " +
              "drop-shadow(0 0 10px rgba(255,192,0,0.20))",
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
            SISTEMA DE PROJETOS ELETRÔNICOS
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
              <button
                onClick={() => {
                  setMode("register");
                  setEmail("");
                  setSenha("");
                  setNome("");
                  setConfirmarSenha("");
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.20)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "'Montserrat', sans-serif",
                  marginTop: 8,
                  transition: "all 0.2s",
                }}
              >
                Criar conta
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

          {mode === "register" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button
                onClick={() => setMode("login")}
                style={{ ...BTN_GHOST, display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
              >
                <ArrowLeft size={14} /> Voltar para o login
              </button>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 17, color: "#fff" }}>
                Criar conta
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 4 }}>
                Sua solicitação será analisada por um administrador.
              </div>

              <div>
                <label style={LBL}>Nome completo</label>
                <input
                  style={INPUT}
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label style={LBL}>E-mail</label>
                <input
                  style={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
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
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((p) => !p)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}
                  >
                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={LBL}>Confirmar senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...INPUT, paddingRight: 48 }}
                    type={showConfirmarSenha ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a senha"
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarSenha((p) => !p)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}
                  >
                    {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleRegister}
                disabled={loading}
                style={{ ...BTN_GOLD, opacity: loading ? 0.7 : 1, marginTop: 4 }}
              >
                {loading ? "Enviando..." : "Solicitar acesso"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
