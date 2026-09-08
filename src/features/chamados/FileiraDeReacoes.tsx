// A FILEIRA DE REAÇÕES de um comentário (R217, U117) — a mesma no Configurador
// rápido, na página da atividade e no chat de menções.
//
// Um chip por emoji que alguém usou (contagem; o meu acende como botão de
// seleção) e o "+" que abre a lista fechada de EMOJIS_REACAO. Clicar num chip
// que é meu tira a reação; num que não é, acrescenta a minha. Sem a U117
// (`faltaMigration`) a fileira não aparece — regra 5.
//
// COMPONENTE DE MÓDULO (lição do PainelChamado): declarado dentro do pai
// remontaria a cada render e o seletor de emoji fecharia sozinho.

import { useState, type CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, botaoSelecao } from "@/lib/ui";
import { cinzas } from "@/lib/paleta";
import { EMOJIS_REACAO, agruparReacoes, type ReacaoMinima } from "@/features/home/chat";
import { alternarReacao, useInvalidarReacoes } from "./reacoes";

export function FileiraDeReacoes({ chamadoId, eventoId, reacoes, faltaMigration, euId }: {
  chamadoId: string;
  eventoId: string;
  reacoes: readonly ReacaoMinima[];
  faltaMigration: boolean;
  /** quem sou eu — sem isso os chips são só leitura */
  euId: string | null;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const [escolhendo, setEscolhendo] = useState(false);
  const invalidar = useInvalidarReacoes();

  const grupos = agruparReacoes(reacoes, eventoId, euId);

  const alternar = useMutation({
    mutationFn: async ({ emoji, jaReagi }: { emoji: string; jaReagi: boolean }) => {
      if (!euId) throw new Error("Entre de novo para reagir.");
      await alternarReacao({ chamadoId, eventoId, emoji, euId, jaReagi });
    },
    onSuccess: () => { invalidar(); setEscolhendo(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (faltaMigration) return null;

  const chip = (ativo: boolean): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, null), boxShadow: "none",
    minHeight: 24, padding: "1px 8px", borderRadius: 999,
    fontFamily: FONT, fontSize: 12, fontWeight: 600, lineHeight: 1.4,
    display: "inline-flex", alignItems: "center", gap: 4, cursor: euId ? "pointer" : "default",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {grupos.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => euId && alternar.mutate({ emoji: g.emoji, jaReagi: g.eu })}
          disabled={alternar.isPending || !euId}
          aria-pressed={g.eu}
          title={g.eu ? "Tirar a minha reação" : "Reagir também"}
          style={chip(g.eu)}
        >
          <span aria-hidden>{g.emoji}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{g.total}</span>
        </button>
      ))}
      {euId && (
        <span style={{ position: "relative", display: "inline-flex" }}>
          <button
            type="button"
            onClick={() => setEscolhendo((v) => !v)}
            aria-label="Reagir a este comentário"
            aria-expanded={escolhendo}
            title="Reagir"
            style={{
              width: 26, height: 24, borderRadius: 999, cursor: "pointer",
              background: "transparent", border: `1px dashed ${c.divisoria}`, color: c.textoSecundario,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <SmilePlus size={13} />
          </button>
          {escolhendo && (
            <div
              role="listbox"
              aria-label="Escolha a reação"
              style={{
                position: "absolute", left: 0, bottom: "calc(100% + 6px)", zIndex: 5,
                display: "flex", gap: 4, padding: "6px 8px", borderRadius: 999,
                background: c.superficie, border: `1px solid ${c.divisoria}`,
                boxShadow: isLight ? "0 6px 20px rgba(0,0,0,0.10)" : "0 6px 20px rgba(0,0,0,0.45)",
              }}
            >
              {EMOJIS_REACAO.map((emoji) => {
                const ja = grupos.some((g) => g.emoji === emoji && g.eu);
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="option"
                    aria-selected={ja}
                    onClick={() => alternar.mutate({ emoji, jaReagi: ja })}
                    disabled={alternar.isPending}
                    title={ja ? "Tirar" : "Reagir"}
                    style={{
                      width: 28, height: 28, borderRadius: 999, cursor: "pointer", fontSize: 15, lineHeight: 1,
                      background: ja ? c.campo : "transparent", border: "none",
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}
        </span>
      )}
    </div>
  );
}
