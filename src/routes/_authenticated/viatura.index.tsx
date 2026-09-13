// /viatura — a LISTA das viaturas, para quando a etiqueta falha (descolou, o
// celular não tem NFC, a pessoa esqueceu de bipar ao sair). A etiqueta é
// atalho, não exigência (R266). Escolher um carro leva à mesma tela que a
// etiqueta abriria.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Car } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { useViagensAbertas, useViaturas } from "@/features/viaturas/data";
import { usePessoas, mapaDePessoas } from "@/features/chamados/data";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/viatura/")({
  component: ListaDeViaturas,
});

function ListaDeViaturas() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const cz = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const textPrimary = isLight ? "#212121" : "#FFFFFF";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const { data: viaturas = [], isLoading } = useViaturas();
  const { data: abertas = [] } = useViagensAbertas();
  const { data: pessoas = [] } = usePessoas();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);
  const ativas = viaturas.filter((v) => v.ativa);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, paddingTop: 8, paddingBottom: 96, color: textPrimary }}>
      <button onClick={() => navigate({ to: "/dashboard" })} aria-label="Voltar para a Início" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: textSecondary, fontFamily: FONT, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
        <ArrowLeft size={16} /> Início
      </button>
      <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>Qual viatura?</h1>
      <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
        Sem a etiqueta, escolha o carro aqui — é a mesma tela que ela abriria.
      </div>
      {isLoading && <div style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>Carregando…</div>}
      {!isLoading && ativas.length === 0 && (
        <div style={{ ...card(isLight), padding: 16, fontFamily: FONT, fontSize: 13, color: textSecondary, lineHeight: 1.5 }}>
          Nenhuma viatura cadastrada ainda. A gestão cadastra em Administrativo › Viaturas.
        </div>
      )}
      {ativas.map((v) => {
        const aberta = abertas.find((a) => a.viatura_id === v.id);
        return (
          <button key={v.id} onClick={() => navigate({ to: "/viatura/$codigo", params: { codigo: v.codigo } })}
            style={{ ...card(isLight), padding: "14px 16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, color: textPrimary, width: "100%" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: cz.campo, display: "grid", placeItems: "center", color: gold, flexShrink: 0 }}><Car size={20} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14 }}>{v.apelido}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, marginTop: 2 }}>
                {v.placa}{aberta ? ` · com ${pessoasPorId[aberta.tecnico_id]?.nome ?? "alguém"} desde ${new Date(aberta.saida_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : " · livre"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
