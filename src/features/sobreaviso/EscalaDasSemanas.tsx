// A ESCALA, POR SEMANA (R253, U129) — o lugar onde o Vinicius diz de quem é a
// semana, e o único gesto que a tela pede dele.
//
// Davi, 11/09/2026: "O mecanismo de registrar quem é o plantonista da semana
// deve ser um mecanismo otimizado, eficiente, com boa experiência do usuário,
// facilidade para leitura e lançamento."
//
// ── O QUE ISTO SUBSTITUI ──────────────────────────────────────────────────
// A U86 pedia três coisas em sequência para escalar alguém: abrir a coluna do
// dia certo na grade (o gesto que define de qual segunda se fala), achar o
// nome da pessoa numa fileira de N botões-varinha, e clicar. A fileira tinha
// DOIS botões por pessoa (aplicar e apagar) — com oito técnicos, dezesseis
// botões sempre na tela para exprimir uma escolha por semana. Aqui é UMA
// LINHA POR SEMANA e UM seletor por linha: a semana já está dita pela linha,
// então o que sobra é o nome.
//
// ── CADA LINHA DIZ A VERDADE INTEIRA ──────────────────────────────────────
// Quem, quantas horas, e se a semana ficou coberta. O nome vem de
// `resumoDaSemana` (quem tem MAIS horas na janela), nunca de uma coluna
// "escalado" — coluna assim seria uma segunda verdade, e no dia em que alguém
// trocasse meio plantão as duas discordariam. Quando mais de uma pessoa tem
// horas na janela a linha diz "dividida" e nomeia a segunda: um nome sozinho
// ali seria mentira.

import type { CSSProperties } from "react";
import { AlertTriangle, Check, Users } from "lucide-react";
import { FONT, card, rotuloDeSecao } from "@/lib/ui";
import { ERRO, SUCESSO } from "@/lib/paleta";
import { SeletorDeOpcao, type OpcaoDoSeletor } from "@/components/SeletorDeOpcao";
import { rotuloDaSemana, type ResumoDaSemana } from "./modelo";

interface Props {
  semanas: ResumoDaSemana[];
  /** Quem pode ser escalado hoje — sem histórico, que não recebe célula nova. */
  opcoes: OpcaoDoSeletor[];
  isLight: boolean;
  /** A segunda em foco: a linha ganha realce e a grade abaixo mostra ela. */
  ativa?: string | null;
  aoFocarSemana?: (segunda: string) => void;
  /** Ausente = só leitura (quem não é gestor vê a escala e não a muda). */
  aoEscalar?: (segunda: string, pessoaId: string) => void;
  /** Escolher "ninguém" na semana que tem plantonista: apagar o que foi lançado. */
  aoLimpar?: (segunda: string, pessoaId: string) => void;
  ocupado?: boolean;
}

export function EscalaDasSemanas({
  semanas, opcoes, isLight, ativa, aoFocarSemana, aoEscalar, aoLimpar, ocupado = false,
}: Props) {
  const textPrimary = isLight ? "#141414" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const linhaFina = isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)";
  const realce = isLight ? "rgba(200,136,6,0.07)" : "rgba(248,200,17,0.06)";

  const chip = (cor: string): CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
    fontFamily: FONT, fontWeight: 600, fontSize: 11, color: cor, whiteSpace: "nowrap",
  });

  return (
    <section style={{ ...card(isLight), padding: "12px 16px 4px" }} aria-label="A escala por semana">
      <div style={{ ...rotuloDeSecao(isLight), marginBottom: 4 }}>A escala</div>

      {semanas.map((s) => {
        const foco = !!ativa && s.segunda === ativa;
        const segundo = s.quem[1] ?? null;
        return (
          <div
            key={s.segunda}
            onClick={aoFocarSemana ? () => aoFocarSemana(s.segunda) : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              // 36 + 6 + 6 de padding = 48px de alvo de toque (MEDIDO no
              // navegador: não há `box-sizing: border-box` global, então o
              // `minHeight` é do CONTEÚDO e o padding soma por fora). O seletor
              // tem 30px e fica folgado dentro disso; cinco linhas de 48 cabem
              // na tela sem empurrar a grade para baixo da dobra.
              minHeight: 36, padding: "6px 8px", margin: "0 -8px",
              borderTop: linhaFina,
              background: foco ? realce : "transparent",
              borderRadius: foco ? 10 : 0,
              cursor: aoFocarSemana ? "pointer" : "default",
            }}
          >
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: textPrimary,
              fontVariantNumeric: "tabular-nums", minWidth: 108, flexShrink: 0,
            }}>
              {rotuloDaSemana(s.segunda)}
            </span>

            {/* O seletor é o gesto: escolher o nome LANÇA a semana inteira. */}
            <div style={{ width: 210, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <SeletorDeOpcao
                valor={s.plantonista?.id ?? null}
                opcoes={opcoes}
                vazio="Escalar…"
                compacto
                cheio
                desabilitado={!aoEscalar || ocupado}
                aoMudar={(v) => {
                  if (v) { aoEscalar?.(s.segunda, v); return; }
                  if (s.plantonista) aoLimpar?.(s.segunda, s.plantonista.id);
                }}
              />
            </div>

            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: textSecondary,
              fontVariantNumeric: "tabular-nums", minWidth: 52, flexShrink: 0,
            }}>
              {s.horas > 0 ? `${s.horas} h` : "—"}
            </span>

            {/* O ESTADO DA SEMANA, em uma frase curta. Buraco vence "dividida":
                dividida é um arranjo legítimo; buraco é trabalho sem ninguém. */}
            {s.buracos > 0 ? (
              <span style={chip(isLight ? ERRO.light : ERRO.dark)}>
                <AlertTriangle size={13} />
                {s.buracos === 1 ? "1 dia sem cobertura" : `${s.buracos} dias sem cobertura`}
              </span>
            ) : (
              <span style={chip(isLight ? SUCESSO.light : SUCESSO.dark)}>
                <Check size={13} /> coberta
              </span>
            )}

            {segundo ? (
              <span
                title={s.quem.map((q) => `${q.pessoa.nome}: ${q.horas} h`).join(" · ")}
                style={{ ...chip(textSecondary), fontWeight: 400 }}
              >
                <Users size={13} /> dividida com {segundo.pessoa.nome} ({segundo.horas} h)
              </span>
            ) : null}
          </div>
        );
      })}

      {semanas.length === 0 ? (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, padding: "10px 0 14px" }}>
          Nenhuma semana neste período.
        </div>
      ) : <div style={{ height: 8 }} />}
    </section>
  );
}
