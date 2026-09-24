// Chamado — a página. Etapa U7 da unificação.
// Endereço único: depois da fusão não existe mais /os/$id e /demandas/$id.
// A natureza decide o corpo — campo (deslocamento, fotos, assinatura, cobrança)
// ou interno (o antigo quadro do Notion: sprint, equipe, apoio). R307 (U162):
// na atividade de CAMPO, o participante que não é técnico nem gere (o
// operacional no apoio) a vê no formato interno do tipo dela — `layoutDaAtividade`.
//
// O useChamado aqui e o de dentro do corpo compartilham a mesma chave de
// cache, então a consulta acontece uma vez só.

import { createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useChamado, useChamadoApoios } from "@/features/chamados/data";
import { useSessao } from "@/features/home/data";
import { layoutDaAtividade, souParticipante } from "@/features/atividades/fluxos-de-campo";
import { DetalheCampo } from "@/features/chamados/DetalheCampo";
import { DetalheInterno } from "@/features/chamados/DetalheInterno";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  component: ChamadoPage,
});

function ChamadoPage() {
  const { id } = Route.useParams();
  const { isLight } = useTheme();
  const { data: chamado, isLoading } = useChamado(id);
  const { data: apoios = [] } = useChamadoApoios(id);
  const { data: sessao, isLoading: sessaoCarregando } = useSessao();

  const aviso: CSSProperties = {
    padding: "40px 0",
    textAlign: "center",
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 13,
    color: isLight ? "#505050" : "rgba(255,255,255,0.55)",
  };

  if (isLoading) return <div style={aviso}>Carregando…</div>;
  if (!chamado) return <div style={aviso}>Chamado não encontrado.</div>;
  // a tela de campo espera o cargo: sem ele, o apoio de outro cargo veria a
  // tela errada por um instante e a certa depois
  if (chamado.natureza === "campo" && sessaoCarregando) return <div style={aviso}>Carregando…</div>;

  const layout = layoutDaAtividade({
    natureza: chamado.natureza,
    cargo: sessao?.cargo ?? null,
    souParticipante: souParticipante(sessao?.userId, chamado.responsavel_id, apoios),
  });
  return layout === "interno" ? <DetalheInterno id={id} /> : <DetalheCampo id={id} />;
}
