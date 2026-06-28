import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/categorias")({
  component: CategoriasPage,
});

const CATEGORIAS = [
  { id: "pedestres", label: "Acesso de Pedestres", icon: "🚶", desc: "Portas, cancelas e leitores de pedestre" },
  { id: "veiculos", label: "Acesso de Veículos", icon: "🚗", desc: "Cancelas, barreiras e controles veiculares" },
  { id: "cftv", label: "CFTV", icon: "📷", desc: "Câmeras, DVRs e NVRs" },
  { id: "alarme", label: "Alarme", icon: "🚨", desc: "Sensores, centrais e sirenes" },
  { id: "cerca", label: "Cerca Elétrica", icon: "⚡", desc: "Centrais e eletrificadores" },
  { id: "central", label: "Central de Comando", icon: "🖥️", desc: "Racks, nobreaks e infraestrutura" },
];

function CategoriasPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

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

      {CATEGORIAS.map((cat) => (
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
          <div style={{ fontSize: 32 }}>{cat.icon}</div>
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
          <ChevronRight size={20} color="rgba(255,192,0,0.55)" />
        </div>
      ))}
    </div>
  );
}
