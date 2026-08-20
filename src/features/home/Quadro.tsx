// O quadro por status — página única (U17).
//
// A primeira versão tinha altura fixa com rolagem interna por coluna, para o
// cabeçalho nunca sair da tela. O Davi decidiu o contrário: "o kanban seja
// tudo uma página só — se o usuário scrolla para baixo, a página toda desce,
// não seja separado por status o scroll". Então:
//
// · a coluna cresce até o próprio conteúdo e quem rola é a página;
// · a roda do mouse NÃO é mais traduzida em rolagem lateral — roda é página,
//   como em qualquer página (o handler de wheel, com a normalização de
//   deltaMode do Firefox e a delegação por coluna, saiu junto; as pendências
//   P2/P6/P9 ficam sem objeto);
// · o trilho continua rolando de lado (barra escondida, .trilho-x) para as
//   colunas que não cabem, e a posição lateral segue voltando ao reabrir.
//
// O teto de renderização por coluna continua: 25 + "ver mais" — nada some.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import {
  COLUNAS, colunaLabel, colunaCores, colunaVisivel,
  type Atividade, type ColunaQuadro,
} from "@/features/atividades/modelo";
import { CardAtividade, PISO_TIPO } from "./CardAtividade";

const LARGURA_COLUNA = 260;
const CHAVE_ROLAGEM = "prever-home-quadro-x";
/** Teto inicial por coluna. O "ver mais" sobe daqui — nada fica inalcançável. */
const TETO = 25;

import type { PessoaAvatar } from "@/components/AvatarPilha";

interface Props {
  atividades: Atividade[];
  foco: ColunaQuadro[];
  pessoas: Record<string, PessoaAvatar>;
  onAbrir: (a: Atividade) => void;
}

export function Quadro({ atividades, foco, pessoas, onAbrir }: Props) {
  const { isLight } = useTheme();
  const trilhoRef = useRef<HTMLDivElement>(null);
  // teto por coluna: sem isto o "+ N nesta coluna" era um texto morto e os
  // itens além do 25º ficavam sem nenhuma forma de serem alcançados no quadro
  const [tetos, setTetos] = useState<Record<string, number>>({});

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  // a coluna é o painel de vidro; os cards são vidro sobre vidro, como nas
  // referências Versa — o custo do blur duplo é só do desktop (--vidro-blur)
  const fundoColuna = isLight ? "rgba(255,255,255,0.42)" : "rgba(14,14,20,0.42)";
  const fundoCabecalho = isLight ? "rgba(255,255,255,0.55)" : "rgba(18,18,26,0.55)";

  // devolve o usuário onde ele estava ao voltar de um card
  useEffect(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const salvo = Number(sessionStorage.getItem(CHAVE_ROLAGEM) ?? "0");
    if (salvo > 0) el.scrollLeft = salvo;
    const guardar = () => sessionStorage.setItem(CHAVE_ROLAGEM, String(el.scrollLeft));
    el.addEventListener("scroll", guardar, { passive: true });
    return () => el.removeEventListener("scroll", guardar);
  }, []);

  const porColuna = new Map<ColunaQuadro, Atividade[]>();
  for (const c of COLUNAS) porColuna.set(c, []);
  porColuna.set("sem_status", []);
  let semColuna = 0;
  for (const a of atividades) {
    const destino = colunaVisivel(a.coluna);
    if (!destino) { semColuna++; continue; }   // cancelado: fica só na lista
    const lista = porColuna.get(destino);
    if (lista) lista.push(a);
    else porColuna.set(destino, [a]);
  }

  // "Sem status" só existe quando existe item quebrado
  const colunas: ColunaQuadro[] = [
    ...COLUNAS,
    ...((porColuna.get("sem_status")?.length ?? 0) > 0 ? (["sem_status"] as ColunaQuadro[]) : []),
  ];

  const COLUNA: CSSProperties = {
    width: LARGURA_COLUNA,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: fundoColuna,
    borderRadius: 14,
    border: isLight ? "1px solid rgba(255,255,255,0.65)" : "1px solid rgba(255,255,255,0.07)",
    overflow: "hidden",
    backdropFilter: "var(--vidro-blur)" as any,
    WebkitBackdropFilter: "var(--vidro-blur)" as any,
  };

  return (
    <div
      ref={trilhoRef}
      className="trilho-x sangra-x"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: "max-content", paddingBottom: 4 }}>
        {colunas.map((c) => {
          const itens = porColuna.get(c) ?? [];
          const cor = colunaCores(c);
          const destacada = foco.length > 0 && foco.includes(c);
          const apagada = foco.length > 0 && !destacada;
          // com você = quem pode destravar esta espera
          const comVoce = itens.filter((a) => a.souResponsavel || a.souApoio).length;

          return (
            <div key={c} data-coluna className="coluna-quadro" style={{ ...COLUNA, opacity: apagada ? 0.5 : 1 }}>
              <div style={{
                flexShrink: 0,
                background: fundoCabecalho,
                padding: "10px 12px",
                borderBottom: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                  background: isLight ? cor.light : cor.dark,
                }} />
                <span style={{
                  fontFamily: FONT, fontWeight: 700, fontSize: PISO_TIPO,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: textPrimary, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {colunaLabel(c)}
                </span>
                <span style={{
                  marginLeft: "auto", flexShrink: 0,
                  fontFamily: FONT, fontWeight: 600, fontSize: PISO_TIPO,
                  color: textSecondary, fontVariantNumeric: "tabular-nums",
                }}>
                  {itens.length}
                  {c === "aguardando_aprovacao" && comVoce > 0 && (
                    <span style={{ color: isLight ? "#A63E17" : "#E2791D" }}> · {comVoce}</span>
                  )}
                </span>
              </div>

              <div
                style={{
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
              >
                {itens.length === 0 ? (
                  <span style={{
                    fontFamily: FONT, fontWeight: 300, fontSize: PISO_TIPO,
                    color: textSecondary, textAlign: "center", padding: "18px 0",
                  }}>
                    vazia
                  </span>
                ) : (
                  <>
                    {itens.slice(0, tetos[c] ?? TETO).map((a) => (
                      <CardAtividade
                        key={a.id}
                        a={a}
                        mostrarStatus={false}
                        pessoas={pessoas}
                        onClick={() => onAbrir(a)}
                      />
                    ))}
                    {itens.length > (tetos[c] ?? TETO) && (
                      <button
                        onClick={() => setTetos((t) => ({ ...t, [c]: (t[c] ?? TETO) + 25 }))}
                        style={{
                          fontFamily: FONT, fontWeight: 600, fontSize: PISO_TIPO,
                          color: isLight ? "#A06108" : "#F8C811",
                          background: "transparent", border: "none", cursor: "pointer",
                          padding: "10px 0", minHeight: 40,
                        }}
                      >
                        ver mais {itens.length - (tetos[c] ?? TETO)}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* O que não tem coluna precisa aparecer em algum lugar: sumir calado
          é pior que ocupar uma linha. */}
      {semColuna > 0 && (
        <div style={{
          fontFamily: FONT, fontSize: PISO_TIPO, color: textSecondary,
          padding: "8px 0 0", position: "sticky", left: 0,
        }}>
          {semColuna} cancelado{semColuna > 1 ? "s" : ""} — veja na lista, em “Encerrados”.
        </div>
      )}
    </div>
  );
}
