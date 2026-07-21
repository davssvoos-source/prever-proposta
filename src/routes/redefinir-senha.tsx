import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DatacenterBackground } from "@/components/DatacenterBackground";
import { LightBackground } from "@/components/LightBackground";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ready = false;
    const markReady = () => {
      ready = true;
      setPronto(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });

    const timeout = setTimeout(() => {
      if (!ready) {
        toast.error("Link inválido ou expirado. Solicite um novo.");
        navigate({ to: "/auth" });
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  async function handleReset() {
    if (!novaSenha || !confirmarSenha) {
      toast.error("Preencha os dois campos.");
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
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const CARD: CSSProperties = {
    background: isLight ? "#ffffff" : "#101014",
    backdropFilter: isLight ? "none" : "blur(20px) saturate(160%)",
    WebkitBackdropFilter: isLight ? "none" : "blur(20px) saturate(160%)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: "32px 24px",
    boxShadow: isLight ? "0 4px 24px rgba(0,0,0,0.08)" : undefined,
  };
  const INPUT: CSSProperties = {
    width: "100%",
    height: 52,
    background: isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    color: isLight ? "#0a0b0e" : "#fff",
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
  const LBL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,192,0,0.65)",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isLight ? "#eef0f4" : "#08090E",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isLight ? <LightBackground /> : <DatacenterBackground />}
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
              color: isLight ? "#6b7280" : "rgba(255,255,255,0.35)",
            }}
          >
            SISTEMA DE PROJETOS ELETRÔNICOS
          </div>
        </div>

        <div style={CARD}>
          {!pronto ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "16px 0" }}>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 13,
                  color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)",
                  letterSpacing: "0.08em",
                }}
              >
                Verificando link...
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: 17,
                    color: isLight ? "#0a0b0e" : "#fff",
                    marginBottom: 6,
                  }}
                >
                  Criar nova senha
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 12,
                    color: isLight ? "#6b7280" : "rgba(255,255,255,0.45)",
                    lineHeight: 1.5,
                  }}
                >
                  Defina sua nova senha de acesso ao sistema.
                </div>
              </div>

              <div>
                <label style={LBL}>Nova senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...INPUT, paddingRight: 48 }}
                    type={showNova ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova((p) => !p)}
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
                    {showNova ? <EyeOff size={18} /> : <Eye size={18} />}
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
