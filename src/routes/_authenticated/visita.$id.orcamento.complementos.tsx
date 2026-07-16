// Complementos do projeto — etapa entre a conclusão dos blocos e o resumo
// (pre-envio): redundância energética, fornecimento do link de internet,
// gerador de energia e app Grupo Prever Acessos.
// Requer as colunas criadas na migration 20260716180000 em visita_orcamentos.

import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Zap, Wifi, Power, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/complementos")({
  component: ComplementosPage,
});

type SimNao = "sim" | "nao" | "";
type LinkFornecimento = "prever" | "cliente" | "";

function ComplementosPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { isLight } = useTheme();

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento_complementos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_orcamentos")
        .select("*")
        .eq("visita_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [redundancia, setRedundancia] = useState<SimNao>("");
  const [linkInternet, setLinkInternet] = useState<LinkFornecimento>("");
  const [gerador, setGerador] = useState<SimNao>("");
  const [appAcessos, setAppAcessos] = useState<SimNao>("");
  const [ready, setReady] = useState(false);
  const [erroVisible, setErroVisible] = useState<string | null>(null);

  useEffect(() => {
    if (ready || orcamento === undefined) return;
    const o = orcamento as any;
    if (typeof o?.redundancia_energetica === "boolean") setRedundancia(o.redundancia_energetica ? "sim" : "nao");
    if (o?.link_internet_fornecimento === "prever" || o?.link_internet_fornecimento === "cliente") {
      setLinkInternet(o.link_internet_fornecimento);
    }
    if (typeof o?.possui_gerador === "boolean") setGerador(o.possui_gerador ? "sim" : "nao");
    if (typeof o?.app_prever_acessos === "boolean") setAppAcessos(o.app_prever_acessos ? "sim" : "nao");
    setReady(true);
  }, [orcamento, ready]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!redundancia || !linkInternet || !gerador || !appAcessos) {
        throw new Error("Responda todas as perguntas antes de continuar.");
      }
      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          redundancia_energetica: redundancia === "sim",
          link_internet_fornecimento: linkInternet,
          possui_gerador: gerador === "sim",
          app_prever_acessos: appAcessos === "sim",
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "visita_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setErroVisible(null);
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      qc.invalidateQueries({ queryKey: ["orcamento_complementos", id] });
      navigate({
        to: "/visita/$id/orcamento/pre-envio",
        params: { id },
        state: { from: location.pathname } as any,
      });
    },
    onError: (e: Error) => {
      setErroVisible(e.message);
      toast.error(e.message);
    },
  });

  const CARD: React.CSSProperties = isLight
    ? {
        background: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 18,
        padding: "18px 16px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      }
    : {
        background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
        padding: "18px 16px",
      };

  const LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,192,0,0.65)",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const optBtn = (selected: boolean): React.CSSProperties => ({
    height: 48,
    borderRadius: 12,
    border: selected
      ? "none"
      : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: selected
      ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
      : isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    color: selected ? "#08090E" : isLight ? "#0a0b0e" : "#fff",
    boxShadow: selected ? "0 6px 20px rgba(255,192,0,0.35)" : undefined,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
  });

  const perguntaSimNao = (
    label: string,
    Icon: typeof Zap,
    valor: SimNao,
    setter: (v: SimNao) => void,
  ) => (
    <div style={CARD}>
      <div style={LABEL}>
        <Icon size={14} />
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <button onClick={() => setter("sim")} style={optBtn(valor === "sim")}>Sim</button>
        <button onClick={() => setter("nao")} style={optBtn(valor === "nao")}>Não</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento/categorias", params: { id } })}
          style={{
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: isLight ? "#0a0b0e" : "#fff",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
              fontSize: 18,
              color: isLight ? "#0a0b0e" : "#fff",
              letterSpacing: "0.02em",
            }}
          >
            Complementos
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[true, true, false].map((active, i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 4,
                borderRadius: 2,
                background: active
                  ? isLight ? "#b87800" : "#FFC000"
                  : isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {perguntaSimNao("Haverá redundância energética no projeto?", Zap, redundancia, setRedundancia)}

      {/* Link de internet: Cliente / Prever */}
      <div style={CARD}>
        <div style={LABEL}>
          <Wifi size={14} />
          Quem fornece o link de internet?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <button onClick={() => setLinkInternet("cliente")} style={optBtn(linkInternet === "cliente")}>
            Cliente
          </button>
          <button onClick={() => setLinkInternet("prever")} style={optBtn(linkInternet === "prever")}>
            Prever
          </button>
        </div>
      </div>

      {perguntaSimNao("O condomínio possui gerador de energia?", Power, gerador, setGerador)}
      {perguntaSimNao("Fornecer o aplicativo Grupo Prever Acessos?", Smartphone, appAcessos, setAppAcessos)}

      {erroVisible && (
        <p style={{ color: "#ff4d4f", fontFamily: "'Montserrat', sans-serif", fontSize: 12, textAlign: "center", marginBottom: 8 }}>
          {erroVisible}
        </p>
      )}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 28,
            background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
            border: "none",
            color: "#08090E",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? "Salvando..." : "Ir para o resumo"}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
