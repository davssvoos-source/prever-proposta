// A ESCALA, POR SEMANA (R253; a troca e o segundo plantonista na R254) — o
// lugar onde o Vinicius diz de quem é a semana, e o único gesto que a tela pede
// dele.
//
// Davi, 11/09/2026: "O mecanismo de registrar quem é o plantonista da semana
// deve ser um mecanismo otimizado, eficiente, com boa experiência do usuário,
// facilidade para leitura e lançamento."
//
// ── UMA LINHA POR SEMANA, UM SELETOR POR PLANTONISTA ──────────────────────
// A U86 pedia três gestos para escalar alguém (abrir a coluna do dia certo,
// achar o nome numa fileira de N botões-varinha, clicar) e punha DOIS botões
// por pessoa na tela. Aqui a semana já está dita pela linha, então o que sobra
// é o nome — e trocar o nome TROCA a semana, sem acumular:
//
//   Davi: "quando altera o usuário selecionado para fazer o plantão, as horas
//   zeram do usuário que estava e passa para o que colocou depois. Ou seja não
//   é cumulativo entre alternância do botão."
//
// ── O "+" (R254) ──────────────────────────────────────────────────────────
// "Adicione um botão na direita da linha do Plantonista escalado, este botão
// deverá ser para adicionar mais um plantonista para a mesma semana, caso em
// algum momento mais de um usuário fique de sobreaviso." O "+" abre um seletor
// VAZIO na mesma linha; escolher um nome nele lança a semana padrão para essa
// pessoa TAMBÉM — sem tirar de ninguém, porque aqui ninguém está saindo.
//
// ── O NOME NÃO É UMA COLUNA ───────────────────────────────────────────────
// Quem é plantonista sai de quem tem horas no MIOLO da semana
// (`plantonistasDaSemana`), nunca de um campo "escalado": um campo assim seria
// uma segunda verdade, e no dia em que alguém trocasse meio plantão as duas
// discordariam. É também por isso que o vizinho da virada — que tem 8h na
// segunda de entrada — não ganha um seletor nesta linha.

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Plus, Users } from "lucide-react";
import { FONT, card, rotuloDeSecao } from "@/lib/ui";
import { ERRO, AVISO, SUCESSO } from "@/lib/paleta";
import { SeletorDeOpcao, type OpcaoDoSeletor } from "@/components/SeletorDeOpcao";
import { rotuloDaSemana, type ResumoDaSemana } from "./modelo";

interface Props {
  semanas: ResumoDaSemana[];
  /** Quem pode ser escalado hoje — a equipe TÉCNICA, sem histórico (R254). */
  opcoes: OpcaoDoSeletor[];
  isLight: boolean;
  /** A segunda em foco: a linha ganha realce e a grade abaixo mostra ela. */
  ativa?: string | null;
  aoFocarSemana?: (segunda: string) => void;
  /**
   * R254: a troca. `de` é quem está no slot (null = slot novo, ninguém sai) e
   * `para` é quem foi escolhido (null = tirar o plantão de quem estava).
   * Os dois lados num gesto só, porque no banco eles são uma transação só.
   */
  aoTrocar?: (segunda: string, de: string | null, para: string | null) => void;
  ocupado?: boolean;
}

export function EscalaDasSemanas({
  semanas, opcoes, isLight, ativa, aoFocarSemana, aoTrocar, ocupado = false,
}: Props) {
  const textPrimary = isLight ? "#141414" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const linhaFina = isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)";
  const realce = isLight ? "rgba(200,136,6,0.07)" : "rgba(248,200,17,0.06)";

  // Os slots VAZIOS abertos pelo "+", por semana. Estado de tela e não de
  // dado: um slot vazio não existe no banco — ele vira plantonista quando
  // recebe um nome, e some sozinho quando a semana é relida.
  const [vagas, setVagas] = useState<Record<string, number>>({});

  const chip = (cor: string): CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
    fontFamily: FONT, fontWeight: 600, fontSize: 11, color: cor, whiteSpace: "nowrap",
  });

  return (
    <section style={{ ...card(isLight), padding: "12px 16px 8px" }} aria-label="A escala por semana">
      <div style={{ ...rotuloDeSecao(isLight), marginBottom: 4 }}>A escala</div>

      {semanas.map((s) => {
        const foco = !!ativa && s.segunda === ativa;
        const vagasAqui = vagas[s.segunda] ?? 0;
        return (
          <div
            key={s.segunda}
            onClick={aoFocarSemana ? () => aoFocarSemana(s.segunda) : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              // 36 + 6 + 6 de padding = 48px de alvo de toque (MEDIDO: não há
              // `box-sizing: border-box` global, então o `minHeight` é do
              // CONTEÚDO e o padding soma por fora).
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

            {/* um seletor por plantonista, mais as vagas abertas pelo "+" */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1, minWidth: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {s.plantonistas.map((q) => (
                <div key={q.pessoa.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 200 }}>
                    <SeletorDeOpcao
                      valor={q.pessoa.id}
                      opcoes={opcoes}
                      vazio="Sem plantonista"
                      compacto
                      cheio
                      desabilitado={!aoTrocar || ocupado}
                      aoMudar={(v) => aoTrocar?.(s.segunda, q.pessoa.id, v)}
                    />
                  </div>
                  <span style={{
                    fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: textSecondary,
                    fontVariantNumeric: "tabular-nums", minWidth: 42,
                  }}>
                    {q.horas} h
                  </span>
                </div>
              ))}

              {Array.from({ length: s.plantonistas.length === 0 ? Math.max(1, vagasAqui) : vagasAqui }, (_, i) => (
                <div key={`vaga-${i}`} style={{ width: 200 }}>
                  <SeletorDeOpcao
                    valor={null}
                    opcoes={opcoes}
                    vazio="Escalar…"
                    compacto
                    cheio
                    desabilitado={!aoTrocar || ocupado}
                    aoMudar={(v) => { if (v) aoTrocar?.(s.segunda, null, v); }}
                  />
                </div>
              ))}

              {/* R254: mais um plantonista para a MESMA semana. Só aparece
                  quando já há alguém — numa semana vazia o seletor de escalar
                  já está ali, e um "+" ao lado dele seria um botão para abrir
                  outro botão. */}
              {aoTrocar && s.plantonistas.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setVagas((v) => ({ ...v, [s.segunda]: (v[s.segunda] ?? 0) + 1 }))}
                  title="Escalar mais uma pessoa para esta semana"
                  aria-label="Escalar mais uma pessoa para esta semana"
                  style={{
                    width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                    color: textPrimary, cursor: "pointer",
                  }}
                >
                  <Plus size={15} />
                </button>
              ) : null}
            </div>

            {/* O ESTADO DA SEMANA, em uma frase curta. */}
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
            {s.sobrando > 0 ? (
              <span
                title="Mais de uma pessoa somando acima da cobertura do dia — legítimo quando dois ficam de sobreaviso juntos"
                style={{ ...chip(isLight ? AVISO.light : AVISO.dark), fontWeight: 400 }}
              >
                <Users size={13} /> {s.sobrando === 1 ? "1 dia com dois" : `${s.sobrando} dias com dois`}
              </span>
            ) : null}
          </div>
        );
      })}

      {semanas.length === 0 ? (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, padding: "10px 0 14px" }}>
          Nenhuma semana neste período.
        </div>
      ) : null}
    </section>
  );
}
