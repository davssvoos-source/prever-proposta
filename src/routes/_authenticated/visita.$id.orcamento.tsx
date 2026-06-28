import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchVisita } from "@/features/visitas/data";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento")({
  component: OrcamentoEtapa1,
});

const TODOS_SERVICOS: { id: string; label: string; emoji: string }[] = [
  { id: "portaria_remota", label: "Portaria Remota", emoji: "🏛️" },
  { id: "cftv", label: "CFTV", emoji: "📷" },
  { id: "alarme", label: "Alarme", emoji: "🔔" },
  { id: "cerca_eletrica", label: "Cerca Elétrica", emoji: "⚡" },
  { id: "acesso_pedestre", label: "Acesso Pedestre", emoji: "🚶" },
  { id: "acesso_veicular", label: "Acesso Veicular", emoji: "🚗" },
  { id: "elevadores", label: "Elevadores", emoji: "🛗" },
  { id: "manutencao", label: "Manutenção", emoji: "🔧" },
  { id: "consultoria", label: "Consultoria", emoji: "💼" },
];

const SISTEMAS = [
  { id: "portaria_presencial", emoji: "👨‍💼", label: "Portaria Presencial" },
  { id: "portaria_remota", emoji: "🖥️", label: "Portaria Remota" },
  { id: "autonoma", emoji: "🤖", label: "Portaria Autônoma" },
  { id: "interfone", emoji: "📞", label: "Apenas Interfone" },
  { id: "sem_sistema", emoji: "❌", label: "Sem Sistema" },
  { id: "outro", emoji: "⚙️", label: "Outro" },
];

const eyebrowStyle: React.CSSProperties = {
  fontWeight: 300,
  fontSize: 10,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "rgba(255,192,0,0.7)",
};

function OrcamentoEtapa1() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: visita, isLoading } = useQuery({
    queryKey: ["visita", id],
    queryFn: () => fetchVisita(id),
  });

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento", id],
    queryFn: async () => {
      const r = await supabase
        .from("visita_orcamentos" as never)
        .select("*")
        .eq("visita_id", id)
        .maybeSingle();
      return (r.data as never) ?? null;
    },
  });

  const [qtd, setQtd] = useState<number>(0);
  const [sistema, setSistema] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && (orcamento || visita)) {
      const o = orcamento as unknown as Record<string, unknown> | null;
      setQtd((o?.qtd_apartamentos as number) ?? 0);
      setSistema((o?.sistema_atual as string) ?? null);
      const fromOrc = (o?.servicos_ofertados as string[]) ?? null;
      const initial =
        fromOrc && fromOrc.length > 0
          ? fromOrc
          : (visita as { servico_solicitado?: string } | undefined)?.servico_solicitado
            ? [(visita as { servico_solicitado: string }).servico_solicitado]
            : [];
      setSelecionados(initial);
      setHydrated(true);
    }
  }, [orcamento, visita, hydrated]);

  // Redirect if user already past step 1
  useEffect(() => {
    const step = (orcamento as unknown as { step_atual?: number } | null)?.step_atual;
    if (step === 2) navigate({ to: "/visita/$id/orcamento", params: { id } });
  }, [orcamento, navigate, id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visita_orcamentos" as never)
        .upsert(
          {
            visita_id: id,
            qtd_apartamentos: qtd,
            sistema_atual: sistema,
            servicos_ofertados: selecionados,
            step_atual: 2,
          } as never,
          { onConflict: "visita_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      toast.success("Etapa 1 salva");
      // Próxima etapa (em construção) — por ora volta ao detalhe da visita
      navigate({ to: "/visita/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleServico(s: string) {
    setSelecionados((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  const canContinue = qtd > 0 && !!sistema && selecionados.length > 0;

  if (isLoading || !visita) {
    return (
      <div className="space-y-3 pb-32">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-40">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate({ to: "/visita/$id", params: { id } })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div
            style={{
              fontWeight: 300,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(200,200,200,0.6)",
            }}
          >
            Montagem do Orçamento
          </div>
          <div className="text-sm font-semibold text-foreground">Etapa 1 de 3</div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#FFC000",
            fontWeight: 500,
          }}
        >
          33%
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          width: "100%",
          background: "rgba(255,192,0,0.15)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "33%",
            height: "100%",
            background: "linear-gradient(90deg, #FFC000, #FFD740)",
            boxShadow: "0 0 10px rgba(255,192,0,0.5)",
            borderRadius: 999,
          }}
        />
      </div>

      {/* Resumo da visita */}
      <Card className="p-4">
        <div style={eyebrowStyle}>Visita</div>
        <div className="mt-1 text-base font-semibold text-foreground">
          🏢 {visita.nome_predio || visita.titulo}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{visita.endereco}</div>
        {visita.servico_solicitado && (
          <div className="mt-2">
            <Badge
              className="badge-pill"
              style={{
                background: "rgba(255,192,0,0.15)",
                color: "#FFC000",
                border: "1px solid rgba(255,192,0,0.3)",
                textTransform: "capitalize",
              }}
            >
              {visita.servico_solicitado.replace(/_/g, " ")}
            </Badge>
          </div>
        )}
      </Card>

      {/* Seção 1 */}
      <Card className="p-4 space-y-4">
        <div style={eyebrowStyle}>Seção 1 · Dados do condomínio</div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 400,
              color: "rgba(240,242,245,0.8)",
              marginBottom: 8,
            }}
          >
            Quantidade de apartamentos / unidades
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQtd((q) => Math.max(0, q - 1))}
              style={{
                background: "rgba(255,192,0,0.06)",
                border: "1px solid rgba(255,192,0,0.28)",
                color: "#FFC000",
                width: 44,
                height: 44,
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={qtd || ""}
              onChange={(e) => setQtd(Number(e.target.value) || 0)}
              placeholder="0"
              style={{
                textAlign: "center",
                fontSize: 22,
                fontWeight: 700,
                height: 44,
                background: "rgba(8,8,12,0.30)",
                border: "1px solid rgba(255,192,0,0.20)",
                color: "#F0F2F5",
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQtd((q) => q + 1)}
              style={{
                background: "rgba(255,192,0,0.06)",
                border: "1px solid rgba(255,192,0,0.28)",
                color: "#FFC000",
                width: 44,
                height: 44,
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 400,
              color: "rgba(240,242,245,0.8)",
              marginBottom: 8,
            }}
          >
            Sistema atual do condomínio
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SISTEMAS.map((s) => {
              const sel = sistema === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSistema(s.id)}
                  style={{
                    borderRadius: 14,
                    padding: "12px 8px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: sel
                      ? "rgba(255,192,0,0.10)"
                      : "rgba(8,8,12,0.20)",
                    border: sel
                      ? "2px solid #FFC000"
                      : "1px solid rgba(255,192,0,0.14)",
                    boxShadow: sel
                      ? "0 0 16px rgba(255,192,0,0.20)"
                      : "none",
                    color: sel ? "#FFC000" : "rgba(220,220,220,0.75)",
                    transition: "all 0.18s ease",
                  }}
                >
                  <div style={{ fontSize: 22 }}>{s.emoji}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 400,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {s.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Seção 2 — Serviços */}
      <Card className="p-4 space-y-4">
        <div style={eyebrowStyle}>Seção 2 · Serviços a ofertar</div>

        {/* Chips selecionados */}
        <div className="flex flex-wrap gap-2 min-h-[36px]">
          {selecionados.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Nenhum serviço selecionado. Escolha abaixo.
            </div>
          )}
          {selecionados.map((sid) => {
            const s = TODOS_SERVICOS.find((x) => x.id === sid);
            if (!s) return null;
            return (
              <span
                key={sid}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px 6px 12px",
                  borderRadius: 999,
                  background: "rgba(255,192,0,0.12)",
                  border: "1px solid rgba(255,192,0,0.30)",
                  color: "#FFC000",
                  fontSize: 12,
                  fontWeight: 400,
                }}
              >
                {s.emoji} {s.label}
                <button
                  type="button"
                  onClick={() => toggleServico(sid)}
                  aria-label="Remover"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#FFC000",
                    padding: 0,
                    lineHeight: 1,
                    cursor: "pointer",
                    display: "inline-flex",
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {TODOS_SERVICOS.map((s) => (
            <ServicoCard
              key={s.id}
              servico={s}
              selecionado={selecionados.includes(s.id)}
              onToggle={() => toggleServico(s.id)}
            />
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground text-center pt-1">
          Toque para selecionar · deslize → para adicionar · ← para remover
        </div>
      </Card>

      {/* Bottom CTA */}
      <div
        className="fixed left-0 right-0 z-30 px-4"
        style={{ bottom: 96 }}
      >
        <div className="mx-auto max-w-5xl">
          <Button
            className="h-12 w-full btn-pulse-gold"
            disabled={!canContinue || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Próxima etapa →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServicoCard({
  servico,
  selecionado,
  onToggle,
}: {
  servico: { id: string; label: string; emoji: string };
  selecionado: boolean;
  onToggle: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const moved = useRef(false);

  return (
    <button
      type="button"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
        moved.current = false;
      }}
      onTouchMove={(e) => {
        const dx = e.touches[0].clientX - startX.current;
        if (Math.abs(dx) > 6) moved.current = true;
        setDragX(Math.max(-60, Math.min(60, dx)));
      }}
      onTouchEnd={() => {
        if (Math.abs(dragX) > 40) onToggle();
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
        transition: dragX === 0 ? "transform 0.25s ease" : "none",
        background: selecionado
          ? "rgba(255,192,0,0.10)"
          : "rgba(8,8,12,0.20)",
        border: selecionado
          ? "1.5px solid rgba(255,192,0,0.55)"
          : "1px solid rgba(255,192,0,0.14)",
        borderRadius: 16,
        padding: "14px 8px",
        textAlign: "center",
        cursor: "pointer",
        position: "relative",
        boxShadow: selecionado
          ? "0 0 20px rgba(255,192,0,0.20), 0 4px 16px rgba(0,0,0,0.40)"
          : "0 4px 16px rgba(0,0,0,0.30)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        userSelect: "none",
        color: selecionado ? "#FFC000" : "rgba(220,220,220,0.85)",
      }}
    >
      {selecionado && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#FFC000",
            color: "#0A0A0A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      )}
      <div style={{ fontSize: 28, lineHeight: 1 }}>{servico.emoji}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          fontWeight: 300,
          letterSpacing: "0.02em",
        }}
      >
        {servico.label}
      </div>
    </button>
  );
}
