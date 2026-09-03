// Novo chamado de CAMPO — a PÁGINA.
//
// O formulário mora em `features/chamados/FormularioChamadoTecnico.tsx` desde
// a R126 (U93): o "+" da Operacional Técnica abre o MESMO formulário num
// pop-up, e um formulário só é um caminho de escrita só. Esta rota é a moldura
// de página — guarda de tela, cabeçalho com o botão de voltar, e para onde ir
// ao terminar (o chamado recém-aberto). Toda a regra, toda a ordem de falha e
// todo o texto da agenda estão lá, e são os mesmos nos dois lugares.

import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FormularioChamadoTecnico } from "@/features/chamados/FormularioChamadoTecnico";

export const Route = createFileRoute("/_authenticated/chamados/novo-campo")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("chamados.novo");
    if (!ok) throw redirect({ to: destinoNegado("chamados.novo") as any });
  },
  component: NovaOsPage,
});

function NovaOsPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18 }}>Abrir chamado</div>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            O número é gerado ao salvar
          </div>
        </div>
      </div>

      <FormularioChamadoTecnico
        aoConcluir={(id) => navigate({ to: "/chamados/$id", params: { id } })}
      />
    </div>
  );
}
