import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, PersonStanding, Car, Camera, ShieldAlert, Zap, Building2 } from "lucide-react";
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
  elevadores: "ELV",
};


const ICON_COLOR = "#FFC000";

const CATEGORIAS = [
  { id: "pedestres", label: "Acesso de Pedestres", icon: <PersonStanding size={32} color={ICON_COLOR} />, desc: "Portas, cancelas e leitores de pedestre" },
  { id: "veiculos", label: "Acesso de Veículos", icon: <Car size={32} color={ICON_COLOR} />, desc: "Cancelas, barreiras e controles veiculares" },
  { id: "cftv", label: "CFTV", icon: <Camera size={32} color={ICON_COLOR} />, desc: "Câmeras, DVRs e NVRs" },
  { id: "alarme", label: "Alarme", icon: <ShieldAlert size={32} color={ICON_COLOR} />, desc: "Sensores, centrais e sirenes" },
  { id: "cerca", label: "Cerca Elétrica", icon: <Zap size={32} color={ICON_COLOR} />, desc: "Centrais e eletrificadores" },
  { id: "elevadores", label: "Elevadores", icon: <Building2 size={32} color={ICON_COLOR} />, desc: "Kit Antena p/ elevador (rede, câmera e telefone IP)" },
];


function CategoriasPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLight } = useTheme();
  const iconColor = isLight ? "#b87800" : "#FFC000";
  const textPrimary = isLight ? "#0a0b0e" : "#fff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.45)";
  const CATEGORIAS_T = [
    { id: "pedestres", label: "Acesso de Pedestres", icon: <PersonStanding size={32} color={iconColor} />, desc: "Portas, cancelas e leitores de pedestre" },
    { id: "veiculos", label: "Acesso de Veículos", icon: <Car size={32} color={iconColor} />, desc: "Cancelas, barreiras e controles veiculares" },
    { id: "cftv", label: "CFTV", icon: <Camera size={32} color={iconColor} />, desc: "Câmeras, DVRs e NVRs" },
    { id: "alarme", label: "Alarme", icon: <ShieldAlert size={32} color={iconColor} />, desc: "Sensores, centrais e sirenes" },
    { id: "cerca", label: "Cerca Elétrica", icon: <Zap size={32} color={iconColor} />, desc: "Centrais e eletrificadores" },
    { id: "elevadores", label: "Elevadores", icon: <Building2 size={32} color={iconColor} />, desc: "Kit Antena p/ elevador (rede, câmera e telefone IP)" },
  ];

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
    background: isLight ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)" : "rgba(8,8,12,0.22)",
    backdropFilter: isLight ? "none" : "blur(12px) saturate(130%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "20px 18px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    cursor: "pointer",
    transition: "border 0.2s, background 0.2s, transform 0.15s",
    touchAction: "manipulation",
    position: "relative",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };


  return (
    <div style={{ padding: "12px 14px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento", params: { id } })}
          style={{
            background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: textPrimary,
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
              color: textPrimary,
            }}
          >
            Montagem do escopo do projeto.
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
                background: active ? iconColor : (isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)"),
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
          color: textSecondary,
          marginBottom: 4,
        }}
      >
        Toque em uma categoria para configurar os blocos correspondentes
      </div>

      {CATEGORIAS_T.map((cat) => {
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
              (e.currentTarget as HTMLDivElement).style.background = isLight ? "rgba(180,120,0,0.06)" : "rgba(255,192,0,0.08)";
              (e.currentTarget as HTMLDivElement).style.border = isLight ? "1px solid rgba(180,120,0,0.30)" : "1px solid rgba(255,192,0,0.30)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = (CARD.background as string) || "";
              (e.currentTarget as HTMLDivElement).style.border = (CARD.border as string) || "";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40 }}>{cat.icon}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 400,
                  fontSize: 15,
                  color: textPrimary,
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
                  color: textSecondary,
                  lineHeight: 1.4,
                }}
              >
                {cat.desc}
              </div>
            </div>
            {count > 0 && (
              <div
                style={{
                  background: isLight ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.18)",
                  border: isLight ? "1px solid rgba(34,197,94,0.30)" : "1px solid rgba(34,197,94,0.45)",
                  color: isLight ? "#15803d" : "#22C55E",
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
            <ChevronRight size={20} color={iconColor} />
          </div>
        );
      })}

      {/* Botão ESCOPO CONCLUÍDO fixo */}
      <button
        onClick={() => {
          if (totalBlocos === 0) {
            toast.error("Adicione pelo menos um bloco antes de continuar.");
            return;
          }
          navigate({ to: "/visita/$id/orcamento/pre-envio", params: { id } });
        }}
        style={{
          position: "fixed",
          bottom: "calc(72px + 16px)",
          left: 16,
          right: 16,
          height: 56,
          borderRadius: 28,
          background: isLight ? "#b87800" : "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
          border: "none",
          color: isLight ? "#ffffff" : "#08090E",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
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
          zIndex: 50,
        }}
      >
        Escopo concluído
        <ChevronRight size={18} />
      </button>

    </div>
  );
}
