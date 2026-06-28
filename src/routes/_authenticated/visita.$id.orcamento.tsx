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
  const moved = useRef(false);

  return (
    <button
      type="button"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        dragging.current = true;
        moved.current = false;
      }}
      onTouchMove={(e) => {
        if (!dragging.current) return;
        const dx = e.touches[0].clientX - startX.current;
        if (Math.abs(dx) > 6) moved.current = true;
        setDragX(Math.max(-64, Math.min(64, dx)));
      }}
      onTouchEnd={() => {
        dragging.current = false;
        if (Math.abs(dragX) > 36) onToggle();
        setDragX(0);
      }}
      onClick={(e) => {
        if (moved.current) {
          e.preventDefault();
          return;
        }
        onToggle();
      }}
      style={{
        transform: `translateX(${dragX}px)`,
        transition:
          dragX === 0
            ? "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.2s, border 0.2s, box-shadow 0.2s"
            : "transform 0s",
        background: selected ? "rgba(255,192,0,0.15)" : "rgba(8,8,12,0.35)",
        border: selected
          ? "1px solid rgba(255,192,0,0.55)"
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "14px 8px",
        textAlign: "center",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: selected ? "0 0 16px rgba(255,192,0,0.15)" : "none",
        userSelect: "none",
        touchAction: "pan-y",
        position: "relative",
        color: selected ? "#FFC000" : "rgba(220,220,220,0.85)",
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#FFC000",
            color: "#0A0A0A",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✓
        </div>
      )}
    </button>
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
        .from("visita_orcamentos" as never)
        .select("*")
        .eq("visita_id", id)
        .maybeSingle();
      return (data as Record<string, unknown> | null) ?? null;
    },
  });

  const { data: servicosDB } = useQuery({
    queryKey: ["servicos-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("servicos")
        .select("id, nome, code, ativo_padrao")
        .order("ordem" as never);
      return (data as Array<{ id: string; nome: string; code: string | null; ativo_padrao: boolean | null }> | null) ?? [];
    },
  });

  const servicosList =
    servicosDB && servicosDB.length > 0
      ? servicosDB.map((s) => ({
          id: (s.code ?? s.id) as string,
          label: s.nome,
          icon: "🔧",
          defaultOn: !!s.ativo_padrao,
        }))
      : SERVICOS_FALLBACK.map((s) => ({ ...s, defaultOn: true }));

  const [qtdApartamentos, setQtdApartamentos] = useState<number | "">("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [sistemaAtual, setSistemaAtual] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (orcamento) {
      setQtdApartamentos((orcamento.qtd_apartamentos as number | null) ?? "");
      setSistemaAtual((orcamento.sistema_atual as string | null) ?? "");
      const ofertados = (orcamento.servicos_ofertados as string[] | null) ?? null;
      if (ofertados && ofertados.length > 0) {
        setSelecionados(ofertados);
      } else if (servicosList.length > 0) {
        setSelecionados(servicosList.filter((s) => s.defaultOn).map((s) => s.id));
      }
      setHydrated(true);
    } else if (servicosList.length > 0) {
      setSelecionados(servicosList.filter((s) => s.defaultOn).map((s) => s.id));
      setHydrated(true);
    }
  }, [orcamento, servicosList, hydrated]);

  const toggleServico = (sid: string) => {
    setSelecionados((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!qtdApartamentos || Number(qtdApartamentos) <= 0) {
        throw new Error("Informe a quantidade de apartamentos.");
      }
      const payload = {
        visita_id: id,
        qtd_apartamentos: Number(qtdApartamentos),
        servicos_ofertados: selecionados,
        sistema_atual: sistemaAtual,
        step_atual: 1,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("visita_orcamentos" as never)
        .upsert(payload as never, { onConflict: "visita_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      toast.success("Dados salvos");
      // Passo 2 ainda não existe — volta ao detalhe da visita
      navigate({ to: "/visita/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const LABEL_STYLE: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: "rgba(255,192,0,0.65)",
    marginBottom: 10,
  };

  const CARD_STYLE: React.CSSProperties = {
    background: "rgba(8,8,12,0.22)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    border: "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "18px 16px",
  };

  return (
    <div className="pb-40 space-y-5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
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
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div
            style={{
              fontWeight: 500,
              fontSize: 16,
              color: "#F5F5F5",
              letterSpacing: "0.02em",
            }}
          >
            Orçamento
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 300,
              color: "rgba(200,200,200,0.65)",
              letterSpacing: "0.04em",
            }}
          >
            Passo 1 de 2 — Informações gerais
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: 18, height: 4, borderRadius: 2, background: "#FFC000" }} />
          <div style={{ width: 18, height: 4, borderRadius: 2, background: "rgba(255,192,0,0.2)" }} />
        </div>
      </div>

      <div className="space-y-4">
        {/* Qtd Apartamentos */}
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Quantidade de apartamentos</div>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={qtdApartamentos}
            onChange={(e) =>
              setQtdApartamentos(e.target.value === "" ? "" : Number(e.target.value))
            }
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
              letterSpacing: "0.06em",
            }}
          />
        </div>

        {/* Serviços */}
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Serviços ofertados</div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(200,200,200,0.55)",
              marginBottom: 12,
              fontWeight: 300,
            }}
          >
            Toque ou arraste para adicionar / remover
          </div>
          <div className="grid grid-cols-3 gap-2">
            {servicosList.map((s) => (
              <ServicoCard
                key={s.id}
                label={s.label}
                icon={s.icon}
                selected={selecionados.includes(s.id)}
                onToggle={() => toggleServico(s.id)}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "#FFC000",
              textAlign: "center",
              fontWeight: 400,
              letterSpacing: "0.04em",
            }}
          >
            {selecionados.length} serviço{selecionados.length !== 1 ? "s" : ""} selecionado
            {selecionados.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Sistema Atual */}
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Sistema atual do condomínio</div>
          <Select value={sistemaAtual} onValueChange={setSistemaAtual}>
            <SelectTrigger
              style={{
                background: "transparent",
                border: "1px solid rgba(255,192,0,0.22)",
                borderRadius: 12,
                color: "#fff",
                height: 52,
                fontSize: 14,
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <SelectValue placeholder="Selecione..." />
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
      </div>

      {/* Botão fixo */}
      <div className="fixed left-0 right-0 z-30 px-4" style={{ bottom: 80 }}>
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 28,
              background: "linear-gradient(135deg, #FFD700, #FFC000, #FF9F00)",
              border: "none",
              color: "#08090E",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
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
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
