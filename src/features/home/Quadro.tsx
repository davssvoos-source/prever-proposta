// O quadro por status. Território novo: não existia kanban neste app.
//
// Quatro decisões que vieram da revisão adversarial, e o porquê de cada uma:
//
// 1. ALTURA FIXA COM ROLAGEM POR COLUNA. Deixar a coluna crescer e a página
//    rolar parece mais simples e é pior: a 600px de rolagem o cabeçalho — a
//    única coisa que diz o que a coluna significa — sai da tela, e a partir
//    dali se arrasta de lado às cegas. Pior ainda, com "Aberto" em 20 cards e
//    "Cancelado" em 2, arrastar lá embaixo mostra espaço em branco e parece
//    coluna vazia. Altura fixa resolve os dois.
//
// 2. COLUNA DE 260px, NÃO 300. Num aparelho de 375px, 300px deixa 31px da
//    próxima coluna aparecendo — isso lê como padding, não como "tem mais
//    coisa aqui". 260px deixa ~75px, que lê de verdade. O espião é a única
//    pista de que rola de lado: o Chrome do Android não mostra barra.
//
// 3. `overscroll-behavior` CONTIDO. Sem isto, arrastar até o fim de uma coluna
//    continua na página, e arrastar para baixo no topo dispara o pull-to-refresh
//    do Android — que aqui é recarga completa com cache frio, refazendo auth e
//    todas as consultas.
//
// 4. A POSIÇÃO VOLTA. Abrir um card na coluna 6 e voltar recaindo na coluna 1
//    é o imposto clássico de kanban em celular: o roteador não restaura offset
//    de container interno. Guardamos em sessionStorage.
//
// 5. NO DESKTOP O QUADRO SANGRA ATÉ AS BORDAS e a roda do mouse rola de lado.
//    Um trilho horizontal não responde à roda vertical — sem tradução, quem
//    está no mouse precisa arrastar a barra, e a barra está escondida. A
//    conversão só acontece quando NÃO há para onde rolar na vertical dentro da
//    coluna sob o cursor, senão a roda deixaria de ler a coluna, que é o
//    gesto mais frequente.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import {
  COLUNAS, colunaLabel, colunaCores,
  type Atividade, type ColunaQuadro,
} from "@/features/atividades/modelo";
import { CardAtividade, PISO_TIPO } from "./CardAtividade";

const LARGURA_COLUNA = 260;
const CHAVE_ROLAGEM = "prever-home-quadro-x";
/** Teto inicial por coluna. O "ver mais" sobe daqui — nada fica inalcançável. */
const TETO = 25;

interface Props {
  atividades: Atividade[];
  foco: ColunaQuadro[];
  nomePorId: Record<string, string>;
  onAbrir: (a: Atividade) => void;
}

export function Quadro({ atividades, foco, nomePorId, onAbrir }: Props) {
  const { isLight } = useTheme();
  const trilhoRef = useRef<HTMLDivElement>(null);
  // teto por coluna: sem isto o "+ N nesta coluna" era um texto morto e os
  // itens além do 25º ficavam sem nenhuma forma de serem alcançados no quadro
  const [tetos, setTetos] = useState<Record<string, number>>({});

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const fundoColuna = isLight ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.022)";
  const fundoCabecalho = isLight ? "#f2f3f5" : "#101017";

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

  // Roda do mouse → rolagem lateral. Precisa de `passive: false` para poder
  // chamar preventDefault, e por isso não dá para usar onWheel do React, que
  // registra passivo. Trackpad com gesto horizontal (deltaX) passa direto.
  useEffect(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const naRoda = (e: WheelEvent) => {
      if (e.ctrlKey) return;                       // zoom do navegador
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;  // já é lateral

      // Se a coluna sob o cursor ainda tem para onde rolar na vertical, a roda
      // é dela. Só quando ela chega ao fim é que o movimento vira lateral.
      const coluna = (e.target as HTMLElement)?.closest?.("[data-corpo-coluna]") as HTMLElement | null;
      if (coluna) {
        const sobra = coluna.scrollHeight - coluna.clientHeight - coluna.scrollTop;
        if (e.deltaY > 0 && sobra > 1) return;
        if (e.deltaY < 0 && coluna.scrollTop > 0) return;
      }

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const alvo = el.scrollLeft + e.deltaY;
      // no limite, devolve a roda para a página em vez de travar o gesto
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft = alvo;
    };
    el.addEventListener("wheel", naRoda, { passive: false });
    return () => el.removeEventListener("wheel", naRoda);
  }, []);

  const porColuna = new Map<ColunaQuadro, Atividade[]>();
  for (const c of COLUNAS) porColuna.set(c, []);
  porColuna.set("sem_status", []);
  for (const a of atividades) {
    const lista = porColuna.get(a.coluna);
    if (lista) lista.push(a);
    else porColuna.set(a.coluna, [a]);
  }

  // "Sem status" só existe quando existe item quebrado
  const colunas: ColunaQuadro[] = [
    ...COLUNAS,
    ...((porColuna.get("sem_status")?.length ?? 0) > 0 ? (["sem_status"] as ColunaQuadro[]) : []),
  ];

  const COLUNA: CSSProperties = {
    width: LARGURA_COLUNA,
    height: "100%",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: fundoColuna,
    borderRadius: 14,
    border: isLight ? "1px solid rgba(0,0,0,0.05)" : "1px solid rgba(255,255,255,0.05)",
    overflow: "hidden",
  };

  return (
    <div
      ref={trilhoRef}
      className="trilho-x sangra-x"
      style={{
        // altura fixa: é o que mantém o cabeçalho na tela e as colunas
        // do mesmo tamanho, para não se arrastar de lado para o vazio
        height: "min(64vh, 680px)",
        minHeight: 340,
      }}
    >
      <div style={{ display: "flex", gap: 10, minWidth: "max-content", height: "100%", paddingBottom: 4 }}>
        {colunas.map((c) => {
          const itens = porColuna.get(c) ?? [];
          const cor = colunaCores(c);
          const destacada = foco.length > 0 && foco.includes(c);
          const apagada = foco.length > 0 && !destacada;
          // com você = quem pode destravar esta espera
          const comVoce = itens.filter((a) => a.souResponsavel || a.souApoio).length;

          return (
            <div key={c} className="coluna-quadro" style={{ ...COLUNA, opacity: apagada ? 0.5 : 1 }}>
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
                    <span style={{ color: isLight ? "#b45309" : "#c98500" }}> · {comVoce}</span>
                  )}
                </span>
              </div>

              <div
                data-corpo-coluna
                className="rolagem-fina"
                style={{
                flex: 1,
                overflowY: "auto",
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 9,
                minHeight: 0,
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
                        responsavelNome={a.responsavelId ? nomePorId[a.responsavelId] ?? null : null}
                        onClick={() => onAbrir(a)}
                      />
                    ))}
                    {itens.length > (tetos[c] ?? TETO) && (
                      <button
                        onClick={() => setTetos((t) => ({ ...t, [c]: (t[c] ?? TETO) + 25 }))}
                        style={{
                          fontFamily: FONT, fontWeight: 600, fontSize: PISO_TIPO,
                          color: isLight ? "#b87800" : "#FFC000",
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
    </div>
  );
}
