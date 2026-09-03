// A aba APIs do Administrativo (R129/R131, U94).
//
// Davi, 03/09/2026: "teremos uma aba dentro da janela 'Administrativo' que terá
// as APIs para conectarmos com terceiros" e "A parte de configuração de APIs
// pode ter um botão na página Administrativa".
//
// HOJE ela LISTA e diz a verdade: quais integrações o sistema usa, se a chave
// de cada uma está no servidor, e o que é plano (o QAP, Fase E). Ela não
// configura nada ainda — configurar é a entrega da Fase E, e uma tela que
// oferecesse um campo de chave sem haver onde gravá-la em segurança seria o
// tipo de promessa que este repositório não faz. O que ela já garante é o
// LUGAR: quando o conector do QAP existir, é aqui que ele aparece.
//
// Nenhum valor de chave chega a esta tela — a server function devolve só a
// presença (integracoes.functions.ts).

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { statusDasIntegracoes, type SituacaoIntegracao } from "@/lib/integracoes.functions";

const SITUACAO_LABEL: Record<SituacaoIntegracao, string> = {
  configurada: "Configurada",
  sem_chave: "Falta a chave",
  planejada: "Planejada",
};

export function Integracoes() {
  const { isLight } = useTheme();
  const consultar = useServerFn(statusDasIntegracoes);
  const q = useQuery({
    queryKey: ["integracoes-status"],
    staleTime: 60_000,
    queryFn: async () => consultar(),
  });

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const corDa = (s: SituacaoIntegracao) => {
    const par = s === "configurada" ? PRISMA.verde : s === "sem_chave" ? PRISMA.laranja : PRISMA.neutro;
    return { texto: isLight ? par.light : par.dark, fundo: par.bg, borda: par.border };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15.5 }}>APIs e integrações</div>
        <div style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
          O que o sistema conversa com terceiros. As chaves ficam no servidor e nunca aparecem aqui —
          esta lista mostra só se cada uma está configurada. O conector do QAP ERP (só leitura) é
          configurado nesta aba quando entrar (Fase E do plano).
        </div>
      </div>

      {/* Três estados, o erro primeiro (lição da U86). */}
      {q.isError ? (
        <div style={{ ...card(isLight), padding: 16, fontFamily: FONT, fontSize: 12.5, color: isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark }}>
          Não consegui consultar as integrações: {(q.error as Error).message}
        </div>
      ) : q.isLoading ? (
        <div style={{ ...card(isLight), padding: 16, fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>
          Consultando o servidor…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(q.data ?? []).map((i) => {
            const cor = corDa(i.situacao);
            return (
              <div key={i.chave} style={{ ...card(isLight), padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: gold,
                }}>
                  <Plug size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5 }}>{i.nome}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontFamily: FONT, fontWeight: 700, fontSize: 9.5,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: cor.texto, background: cor.fundo, border: `1px solid ${cor.borda}`,
                    }}>
                      {SITUACAO_LABEL[i.situacao]}
                    </span>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, marginTop: 3, lineHeight: 1.45 }}>{i.uso}</div>
                  <div style={{ fontFamily: FONT, fontSize: 11.5, color: textPrimary, marginTop: 4, lineHeight: 1.45 }}>{i.sentido}</div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: cor.texto, marginTop: 4, lineHeight: 1.45 }}>{i.nota}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
