import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, PersonStanding, Car, Camera, ShieldAlert, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/categorias")({
  component: CategoriasPage,
});

const SLUG_TO_TIPO: Record<string, string> = {
  pedestres: "PED",
  veiculos: "VEI",
  cftv: "CFTV",
  alarme: "AL",
  cerca: "CER",
};


const ICON_COLOR = "#FFC000";

const CATEGORIAS = [
  { id: "pedestres", label: "Acesso de Pedestres", icon: <PersonStanding size={32} color={ICON_COLOR} />, desc: "Portas, cancelas e leitores de pedestre" },
  { id: "veiculos", label: "Acesso de Veículos", icon: <Car size={32} color={ICON_COLOR} />, desc: "Cancelas, barreiras e controles veiculares" },
  { id: "cftv", label: "CFTV", icon: <Camera size={32} color={ICON_COLOR} />, desc: "Câmeras, DVRs e NVRs" },
  { id: "alarme", label: "Alarme", icon: <ShieldAlert size={32} color={ICON_COLOR} />, desc: "Sensores, centrais e sirenes" },
  { id: "cerca", label: "Cerca Elétrica", icon: <Zap size={32} color={ICON_COLOR} />, desc: "Centrais e eletrificadores" },
];

// ——— SlideToNext ———————————————————————————————
function SlideToNext({
  onConfirm,
  pending,
}: {
  onConfirm: () => void;
  pending: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideXRef = useRef(0);
  const dragging = useRef(false);
  const startClientX = useRef(0);
  const [slideX, setSlideX] = useState(0);
  const KNOB = 52;

  const handleStart = (clientX: number) => {
    dragging.current = true;
    startClientX.current = clientX - slideXRef.current;
  };
  const handleMove = (clientX: number) => {
    if (!dragging.current || !trackRef.current) return;
    const max = trackRef.current.offsetWidth - KNOB;
    const next = Math.min(Math.max(0, clientX - startClientX.current), max);
    slideXRef.current = next;
    setSlideX(next);
    if (next >= max - 4) {
      dragging.current = false;
      onConfirm();
    }
  };
  const handleEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    slideXRef.current = 0;
    setSlideX(0);
  };

  return (
    <div
      ref={trackRef}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      style={{
        position: "relative",
        height: 56,
        borderRadius: 28,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.15)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: slideX + KNOB,
          background: "linear-gradient(135deg, rgba(255,215,0,0.35), rgba(255,160,0,0.30))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.06em",
          pointerEvents: "none",
        }}
      >
        {pending ? "Aguarde..." : "← deslize → Seguir para o próximo passo"}
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: slideX,
          transform: "translateY(-50%)",
          width: KNOB,
          height: KNOB,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FFC000, #FFD84D)",
          boxShadow: "0 0 12px rgba(255,192,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontSize: 20 }}>›</span>
      </div>
    </div>
  );
}

function CategoriasPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: visita } = useQuery({
    queryKey: ["visita", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, servicos_propostos")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: contagemBlocos = [] } = useQuery({
    queryKey: ["visita_blocos_count", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("tipo_bloco")
        .eq("visita_id", id);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const countPorTipo = (tipoSlug: string) => {
    const tipo = SLUG_TO_TIPO[tipoSlug];
    return contagemBlocos.filter((b: any) => b.tipo_bloco === tipo).length;
  };

  const totalBlocos = contagemBlocos.length;

  useEffect(() => {
    if (!visita) return;
    const servicos = (visita as any).servicos_propostos as string[] | null;
    if (!servicos?.includes("portaria_remota")) return;
    const jaExiste = contagemBlocos.some((b: any) => b.tipo_bloco === "CENT");
    if (jaExiste) return;

    (async () => {
      const { error } = await supabase.from("visita_blocos" as any).insert({
        visita_id: id,
        codigo_bloco: "CENT-PR",
        nome_descritivo: "Central de Portaria Remota",
        tipo_bloco: "CENT",
        eclusa: false,
        hh_padrao: 10,
        quantidade: 1,
        ordem: 999,
      });
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", id] });
      }
    })();
  }, [visita, contagemBlocos, id, queryClient]);

  const CARD: React.CSSProperties = {
    background: "rgba(8,8,12,0.22)",
    backdropFilter: "blur(12px) saturate(130%)",
    border: "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "20px 18px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    cursor: "pointer",
    transition: "border 0.2s, background 0.2s, transform 0.15s",
    touchAction: "manipulation",
    position: "relative",
  };


  return (
    <div style={{ padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento", params: { id } })}
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
            }}
          >
            Blocos do Orçamento
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
            Passo 2 de 3 — Selecione a categoria
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[false, true, false].map((active, i) => (
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

      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          marginBottom: 4,
        }}
      >
        Toque em uma categoria para configurar os blocos correspondentes
      </div>

      {CATEGORIAS.map((cat) => {
        const count = countPorTipo(cat.id);
        return (
          <div
            key={cat.id}
            style={CARD}
            onClick={() =>
              navigate({
                to: "/visita/$id/orcamento/blocos/$cat",
                params: { id, cat: cat.id },
              })
            }
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "rgba(255,192,0,0.08)";
              (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,192,0,0.30)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "rgba(8,8,12,0.22)";
              (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,192,0,0.10)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40 }}>{cat.icon}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 400,
                  fontSize: 15,
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                {cat.label}
              </div>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  lineHeight: 1.4,
                }}
              >
                {cat.desc}
              </div>
            </div>
            {count > 0 && (
              <div
                style={{
                  background: "rgba(34,197,94,0.18)",
                  border: "1px solid rgba(34,197,94,0.45)",
                  color: "#22C55E",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Montserrat', sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {count} {count === 1 ? "bloco" : "blocos"}
              </div>
            )}
            <ChevronRight size={20} color="rgba(255,192,0,0.55)" />
          </div>
        );
      })}

      {/* Botão deslizar para próximo passo */}
      <div style={{ marginTop: 24, paddingBottom: 16 }}>
        <SlideToNext
          pending={false}
          onConfirm={() => {
            if (totalBlocos === 0) {
              toast.error("Adicione pelo menos um bloco antes de continuar.");
              return;
            }
            navigate({ to: "/visita/$id/orcamento/pre-envio", params: { id } });
          }}
        />
      </div>

    </div>
  );
}
