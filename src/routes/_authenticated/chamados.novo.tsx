// Abertura unificada de chamado — a porta única do SAC (R9).
// O atendente abre UMA coisa e escolhe o trilho; o sistema leva para o
// formulário certo, que cria o registro no lugar certo. Esta tela não guarda
// nada: é triagem.
//
// Suposição registrada (questão 5 do PRODUTO §8): no trilho de proposta o SAC
// registra a visita e PODE agendar — técnico e data ficam opcionais no
// formulário; se ficarem vazios, o comercial agenda depois.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { CSSProperties, ComponentType } from "react";
import { ArrowLeft, ChevronRight, ClipboardList, FileText, ShoppingCart, Wrench } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";

export const Route = createFileRoute("/_authenticated/chamados/novo")({
  component: NovoChamadoPage,
});

interface Trilho {
  icone: ComponentType<{ size?: number; color?: string }>;
  titulo: string;
  descricao: string;
  exemplos: string;
  ir: (navigate: ReturnType<typeof useNavigate>) => void;
}

function NovoChamadoPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const trilhos: Trilho[] = [
    {
      icone: Wrench,
      titulo: "Chamado de campo",
      descricao: "Uma dupla vai até o cliente: conserto, preventiva, entrega de controle, implantação.",
      exemplos: "Ex.: portão travado no Green Village · entrega de 2 controles no Figueira",
      ir: (n) => n({ to: "/os/nova" }),
    },
    {
      icone: ClipboardList,
      titulo: "T.I",
      descricao: "Problema ou tarefa de tecnologia, resolvida remotamente pelo Erik ou Nicholas.",
      exemplos: "Ex.: câmera off-line no app · interfone sem registro · acesso novo no QAP",
      ir: (n) => n({ to: "/demandas/nova", search: { equipe: "ti" } as any }),
    },
    {
      icone: ShoppingCart,
      titulo: "Pedido de compra",
      descricao: "Material ou equipamento para o Controle Patrimonial cotar e comprar.",
      exemplos: "Ex.: 10 controles remotos · nobreak novo para a guarita · licença de software",
      ir: (n) => n({ to: "/demandas/nova", search: { equipe: "patrimonio", tipo: "pedido_compra" } as any }),
    },
    {
      icone: FileText,
      titulo: "Pedido de proposta",
      descricao: "Cliente ou prospecto quer orçamento: registra a visita técnica; agendar é opcional.",
      exemplos: "Ex.: síndico pediu proposta de CFTV · ampliação do controle de acesso",
      ir: (n) => n({ to: "/gerencial/nova" }),
    },
  ];

  const CARD: CSSProperties = {
    ...card(isLight),
    padding: "16px",
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/chamados" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Abrir chamado</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            De onde veio não importa — escolha para onde vai.
          </div>
        </div>
      </div>

      {trilhos.map((t) => {
        const Icone = t.icone;
        return (
          <button key={t.titulo} style={CARD} onClick={() => t.ir(navigate)}>
            <span style={{
              width: 44, height: 44, borderRadius: 13, flexShrink: 0,
              background: isLight ? "rgba(184,120,0,0.10)" : "rgba(255,192,0,0.10)",
              border: isLight ? "1px solid rgba(184,120,0,0.25)" : "1px solid rgba(255,192,0,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icone size={20} color={gold} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: FONT, fontWeight: 600, fontSize: 15, color: textPrimary }}>
                {t.titulo}
              </span>
              <span style={{
                display: "block", fontFamily: FONT, fontWeight: 300, fontSize: 12.5,
                color: textSecondary, marginTop: 3, lineHeight: 1.5,
              }}>
                {t.descricao}
              </span>
              <span style={{
                display: "block", fontFamily: FONT, fontWeight: 300, fontSize: 11,
                color: gold, marginTop: 5,
              }}>
                {t.exemplos}
              </span>
            </span>
            <ChevronRight size={18} color={textSecondary} style={{ flexShrink: 0, alignSelf: "center" }} />
          </button>
        );
      })}
    </div>
  );
}
