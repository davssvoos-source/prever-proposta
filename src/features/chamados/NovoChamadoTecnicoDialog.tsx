// O pop-up do "+" da Operacional Técnica (R126, U93).
//
// Davi, 2026-09-03: "Na tela de Operacional Técnica deverá ter um botão de '+'
// que o Vinicius poderá abrir um chamado técnico, atribuindo o responsável
// (equipe ou técnico solo), cliente, problema se for manutenção, sistema se for
// implantação, data do agendamento".
//
// ELE NÃO TEM FORMULÁRIO PRÓPRIO. O miolo é `FormularioChamadoTecnico`, o mesmo
// componente da página `/chamados/novo-campo` — um formulário, um caminho de
// escrita, as mesmas recusas da porta da agenda. O que este arquivo faz é a
// MOLDURA: o overlay que fecha no clique de fora, o card, o cabeçalho com o
// ícone dourado e o X — a mesma moldura do `DialogoDuplas`, para os dois pop-ups
// do painel lerem como irmãos.
//
// Por que um pop-up e não navegar para a página: é a R33 aplicada ao gesto de
// criar. Quem está no painel está olhando a fila e o gráfico das equipes; abrir
// o chamado numa página nova perde a tela. Aqui abre, preenche, e o chamado
// recém-nascido desliza no painel lateral — a lista atrás já o mostra.

import { Plus, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { FormularioChamadoTecnico } from "./FormularioChamadoTecnico";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** o chamado nasceu (e o horário entrou, se era para entrar) */
  aoCriar: (id: string) => void;
}

export function NovoChamadoTecnicoDialog({ aberto, aoFechar, aoCriar }: Props) {
  const { isLight } = useTheme();
  if (!aberto) return null;

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  return (
    <div
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Novo chamado técnico"
      style={{
        position: "fixed", inset: 0, zIndex: 100, padding: 20,
        background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...card(isLight), padding: 18, width: "100%", maxWidth: 640,
          maxHeight: "90vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Plus size={17} color={gold} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: textPrimary }}>
              Novo chamado técnico
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
              Equipe técnica · o número é gerado ao salvar. Com equipe, dia e duração, o horário já entra na agenda.
            </div>
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0, cursor: "pointer",
              background: isLight ? "#ffffff" : "#191921",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        <FormularioChamadoTecnico aoConcluir={aoCriar} />
      </div>
    </div>
  );
}
