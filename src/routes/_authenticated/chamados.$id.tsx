// Chamado — a página. Etapa U7 da unificação.
// Endereço único: depois da fusão não existe mais /os/$id e /demandas/$id.
// A natureza decide o corpo — campo (deslocamento, fotos, assinatura, cobrança)
// ou interno (o antigo quadro do Notion: sprint, equipe, apoio).
//
// O useChamado aqui e o de dentro do corpo compartilham a mesma chave de
// cache, então a consulta acontece uma vez só.

import { createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useChamado } from "@/features/chamados/data";
import { DetalheCampo } from "@/features/chamados/DetalheCampo";
import { DetalheInterno } from "@/features/chamados/DetalheInterno";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  component: ChamadoPage,
});

function ChamadoPage() {
  const { id } = Route.useParams();
  const { isLight } = useTheme();
  const { data: chamado, isLoading } = useChamado(id);

  const aviso: CSSProperties = {
    padding: "40px 0",
    textAlign: "center",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 13,
    color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)",
  };

  if (isLoading) return <div style={aviso}>Carregando…</div>;
  if (!chamado) return <div style={aviso}>Chamado não encontrado.</div>;

  return chamado.natureza === "interno" ? <DetalheInterno id={id} /> : <DetalheCampo id={id} />;
}
