import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento")({
  component: OrcamentoPasso1,
});

const SERVICOS_FALLBACK = [
  { id: "portaria_virtual", label: "Portaria Virtual 24h", icon: "🏢" },
  { id: "cftv", label: "CFTV / Câmeras", icon: "📷" },
  { id: "controle_acesso", label: "Controle de Acesso", icon: "🔐" },
  { id: "interfone_ip", label: "Interfone IP", icon: "📞" },
  { id: "alarme", label: "Alarme / Sensores", icon: "🚨" },
  { id: "cerca_eletrica", label: "Cerca Elétrica", icon: "⚡" },
  { id: "monitoramento", label: "Monitoramento Remoto", icon: "🖥️" },
  { id: "automacao", label: "Automação de Portões", icon: "🚪" },
];

const SISTEMAS = [
  "Portaria Presencial",
  "Portaria Remota / Virtual",
  "Portaria Autônoma",
  "Sistema Misto",
  "Sem portaria",
  "Outro",
];

function ServicoCard({
  label,
  icon,
  selected,
  onToggle,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const startX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);

  return (
    <div
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        dragging.current = true;
      }}
      onTouchMove={(e) => {
        if (!dragging.current) return;
        setDragX(Math.max(-60, Math.min(60, e.touches[0].clientX - startX.current)));
      }}
      onTouchEnd={() => {
        dragging.current = false;
        if (Math.abs(dragX) > 36) onToggle();
        setDragX(0);
      }}
      onClick={onToggle}
      style={{
        transform: `translateX(${dragX}px)`,
        transition:
          dragX === 0
            ? "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.2s, border 0.2s"
            : "none",
        background: selected ? "rgba(255,192,0,0.15)" : "rgba(8,8,12,0.35)",
        border: selected ? "1px solid rgba(255,192,0,0.55)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "14px 8px",
        textAlign: "center" as const,
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        userSelect: "none" as const,
        touchAction: "none",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 11,
          color: selected ? "#FFC000" : "rgba(255,255,255,0.75)",
          lineHeight: 1.25,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function OrcamentoPasso1() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const { data: servicosDB } = useQuery({
    queryKey: ["servicos-lista"],
    queryFn: async () => {
      const { data } = await supabase
        .from("servicos")
        .select("id,nome,code,ativo_padrao")
        .order("ordem");
      return data ?? [];
    },
  });

  const servicosList =
    servicosDB && servicosDB.length > 0
      ? servicosDB.map((s: any) => ({
          id: s.code ?? s.id,
          label: s.nome,
          icon: "🔧",
          defaultOn: s.ativo_padrao,
        }))
      : SERVICOS_FALLBACK.map((s) => ({ ...s, defaultOn: true }));

  const [qtd, setQtd] = useState<number | "">("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [sistema, setSistema] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    if (orcamento) {
      setQtd((orcamento as any).qtd_apartamentos ?? "");
      setSelecionados((orcamento as any).servicos_ofertados ?? []);
      setSistema((orcamento as any).sistema_atual ?? "");
      setReady(true);
    } else if (servicosList.length > 0) {
      setSelecionados([]);
      setReady(true);
    }
  }, [orcamento, servicosList, ready]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!qtd || Number(qtd) <= 0) throw new Error("Informe a quantidade de apartamentos.");
      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          qtd_apartamentos: Number(qtd),
          servicos_ofertados: selecionados,
          sistema_atual: sistema,
          step_atual: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visita_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const CARD: React.CSSProperties = {
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
    color: "rgba(255,192,0,0.65)",
    marginBottom: 10,
  };

  return (
    <div style={{ padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id", params: { id } })}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
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
              color: "#fff",
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
              color: "rgba(255,255,255,0.45)",
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
                background: active ? "#FFC000" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Qtd Apartamentos */}
      <div style={CARD}>
        <div style={LABEL}>Quantidade de apartamentos</div>
        <Input
          type="number"
          inputMode="numeric"
          value={qtd}
          onChange={(e) => setQtd(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Ex: 48"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,192,0,0.22)",
            borderRadius: 12,
            color: "#fff",
            fontSize: 28,
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            textAlign: "center",
            height: 68,
          }}
        />
      </div>

      {/* Serviços */}
      <div style={CARD}>
        <div style={LABEL}>Serviços ofertados</div>
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 11,
            color: "rgba(255,255,255,0.40)",
            marginBottom: 14,
          }}
        >
          Toque ou arraste para adicionar / remover
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {servicosList.map((s) => (
            <ServicoCard
              key={s.id}
              label={s.label}
              icon={s.icon}
              selected={selecionados.includes(s.id)}
              onToggle={() =>
                setSelecionados((p) =>
                  p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id],
                )
              }
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 11,
            color: "rgba(255,192,0,0.65)",
          }}
        >
          {selecionados.length} selecionado{selecionados.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Sistema Atual */}
      <div style={CARD}>
        <div style={LABEL}>Sistema atual do condomínio</div>
        <Select value={sistema} onValueChange={setSistema}>
          <SelectTrigger
            style={{
              background: "transparent",
              border: "1px solid rgba(255,192,0,0.22)",
              borderRadius: 12,
              color: "#fff",
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
            fontWeight: 300,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 24px rgba(255,192,0,0.35)",
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
