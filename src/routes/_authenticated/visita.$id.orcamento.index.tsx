import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/")({
  component: OrcamentoPasso1,
});

const SISTEMAS = [
  "Portaria Presencial",
  "Portaria Remota / Virtual",
  "Portaria Autônoma",
  "Sistema Misto",
  "Sem portaria",
  "Outro",
];

function OrcamentoPasso1() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visita_orcamentos")
        .select("*")
        .eq("visita_id", id)
        .maybeSingle();
      return data;
    },
  });

  const [qtd, setQtd] = useState<number | "">("");
  const [sistema, setSistema] = useState("");
  const [airbnb, setAirbnb] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [erroVisible, setErroVisible] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    if (orcamento) {
      setQtd((orcamento as any).qtd_apartamentos ?? "");
      setSistema((orcamento as any).sistema_atual ?? "");
      setAirbnb((orcamento as any).airbnb ?? "");
      setReady(true);
    } else {
      setReady(true);
    }
  }, [orcamento, ready]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!qtd || Number(qtd) <= 0) throw new Error("Informe a quantidade de apartamentos.");
      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          qtd_apartamentos: Number(qtd),
          sistema_atual: sistema,
          airbnb: airbnb || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visita_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setErroVisible(null);
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      window.location.href = `/visita/${id}/orcamento/categorias`;
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
        background: "rgba(8,8,12,0.22)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
        padding: "18px 16px",
      };

  const LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,192,0,0.65)",
    marginBottom: 10,
  };

  const sliderValue = Math.min(Number(qtd) || 0, 200);
  const inputMax = 200;

  return (
    <div style={{ padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id", params: { id } })}
          style={{
            background: isLight ? "#ffffff" : "rgba(255,255,255,0.06)",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: isLight ? "#0a0b0e" : "#fff",
            boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 18,
              color: isLight ? "#0a0b0e" : "#fff",
              letterSpacing: "0.02em",
            }}
          >
            Orçamento
          </div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)",
              marginTop: 2,
            }}
          >
            Passo 1 de 3 — Informações gerais
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[true, false, false].map((active, i) => (
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

      {/* Qtd Apartamentos */}
      <div style={CARD}>
        <div style={LABEL}>Quantidade de apartamentos</div>
        {/* Número editável acima da barra */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <input
            type="number"
            min={0}
            value={qtd === "" ? 0 : qtd}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              setQtd(v);
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: isLight ? "#0a0b0e" : "#FFFFFF",
              fontWeight: 700,
              fontSize: 36,
              textAlign: "center",
              width: 120,
              fontFamily: "'Montserrat', sans-serif",
            }}
          />
        </div>
        {/* Barra slider customizada */}
        <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              height: 4,
              borderRadius: 2,
              width: `${(sliderValue / inputMax) * 100}%`,
              background: isLight
                ? "linear-gradient(90deg, #b87800, #d49a00)"
                : "linear-gradient(90deg, #FFC000, #FFD84D)",
              transition: "width 0.05s",
            }}
          />
          <input
            type="range"
            min={0}
            max={inputMax}
            step={1}
            value={sliderValue}
            onChange={(e) => setQtd(Number(e.target.value))}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              width: "100%",
              opacity: 0,
              height: 28,
              cursor: "pointer",
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${(sliderValue / inputMax) * 100}% - 11px)`,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: isLight ? "#ffffff" : "#FFFFFF",
              boxShadow: isLight
                ? "0 1px 6px rgba(0,0,0,0.18)"
                : "0 0 10px rgba(255,255,255,0.70), 0 0 20px rgba(255,255,255,0.30)",
              pointerEvents: "none",
              zIndex: 1,
              transition: "left 0.05s",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.4)" }}>0</span>
          <span style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.4)" }}>200</span>
        </div>
      </div>

      {/* Sistema Atual */}
      <div style={CARD}>
        <div style={LABEL}>Sistema atual do condomínio</div>
        <Select value={sistema} onValueChange={setSistema}>
          <SelectTrigger
            style={{
              background: isLight ? "#f0f1f4" : "transparent",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,192,0,0.22)",
              borderRadius: 12,
              color: isLight ? "#0a0b0e" : "#fff",
              height: 48,
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
            }}
          >
            <SelectValue placeholder="Selecione o sistema atual" />
          </SelectTrigger>
          <SelectContent>
            {SISTEMAS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Botão próxima etapa */}
      {erroVisible && (
        <p style={{ color: '#ff4d4f', fontFamily: "'Montserrat', sans-serif", fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
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
            background: isLight ? "#b87800" : "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
            border: "none",
            color: isLight ? "#ffffff" : "#08090E",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: isLight
              ? "0 4px 16px rgba(180,120,0,0.30)"
              : "0 4px 24px rgba(255,192,0,0.35)",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? "Salvando..." : "Próxima etapa"}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
