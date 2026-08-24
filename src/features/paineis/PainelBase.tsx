// A casca compartilhada dos três painéis (R27) — Operacional, Comercial e
// Administrativo.
//
// Um painel é uma tela de ENTRADA para um domínio: alguns números que dizem
// como está, e os atalhos para as telas onde se trabalha. Ele não substitui
// nenhuma tela — reúne o que estava espalhado no "Gerencial", que virou três.
//
// Por que uma base compartilhada: os três têm exatamente a mesma anatomia. Se
// cada um tivesse a sua, a terceira mudança de design já teria deixado um
// deles para trás — que é como painéis viram irmãos desiguais.
//
// O atalho respeita a matriz de permissões: item que leva a uma tela bloqueada
// não aparece. Atalho para porta trancada é armadilha, e o Gerencial já
// filtrava assim.

import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, espectroTexto } from "@/lib/paleta";
import { usePermissoes } from "@/features/gerencial/permissoes";

export interface NumeroPainel {
  rotulo: string;
  valor: number | string;
  /** índice no espectro do degradê — mantém os painéis na mesma língua de cor. */
  tom: number;
  /** para onde o número leva, quando ele é acionável. */
  para?: string;
}

export interface AtalhoPainel {
  label: string;
  descricao: string;
  icon: LucideIcon;
  para: string;
  /** chave em `permissoes_tela`; null = sempre visível. */
  tela: string | null;
  /** true = só admin vê (telas sem chave própria na matriz). */
  soAdmin?: boolean;
}

interface Props {
  /**
   * Título da tela. OPCIONAL desde a R68: o Painel Operacional abre direto no
   * dashboard, sem cabeçalho — a tela precisava do espaço vertical, e um
   * título que só repete o nome do item de menu selecionado à esquerda paga
   * caro por pouco. Os outros dois painéis seguem com o deles.
   */
  titulo?: string;
  subtitulo?: string;
  numeros: NumeroPainel[];
  atalhos: AtalhoPainel[];
  /** o admin vê o que é dele; vem de fora para o painel não repetir a consulta. */
  isAdmin: boolean;
  /** conteúdo próprio do painel (funil, gráfico) entre os números e os atalhos. */
  children?: ReactNode;
}

export function PainelBase({ titulo, subtitulo, numeros, atalhos, isAdmin, children }: Props) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const { podeVer } = usePermissoes();

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const visiveis = atalhos.filter((a) =>
    a.soAdmin ? isAdmin : (!a.tela || podeVer(a.tela) !== false),
  );

  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };

  return (
    // sem cabeçalho o respiro de cima encolhe: a razão de existir do padding
    // era separar o título da barra do topo, e sem título ele só empurraria
    // o conteúdo para baixo à toa
    <div className="sangra-x" style={{ paddingTop: titulo ? 18 : 6, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 16, color: textPrimary }}>
      {titulo && (
        <div>
          <h1 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>
            {titulo}
          </h1>
          {subtitulo && (
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, marginTop: 2 }}>
              {subtitulo}
            </div>
          )}
        </div>
      )}

      {numeros.length > 0 && (
        <div className="painel-numeros">
          {numeros.map((n) => {
            // o número é TEXTO pintado com a rampa: ESPECTRO é preenchimento e
            // no claro não chega a 4.5:1 — ESPECTRO_TEXTO garante (no escuro as
            // duas rampas são a mesma)
            const cor = espectroTexto(n.tom, isLight);
            const conteudo = (
              <>
                <div style={{
                  fontFamily: FONT, fontWeight: 700, fontSize: 34, color: cor,
                  textShadow: `0 0 14px ${cor}59`,
                  fontVariantNumeric: "tabular-nums", lineHeight: 1,
                }}>
                  {n.valor}
                </div>
                <div style={{
                  fontFamily: FONT, fontWeight: 500, fontSize: 9,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  color: textSecondary, lineHeight: 1.3, textAlign: "center", marginTop: 6,
                }}>
                  {n.rotulo}
                </div>
              </>
            );
            const estilo: CSSProperties = {
              ...card(isLight), borderRadius: 16, padding: "14px 12px",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              boxSizing: "border-box", minHeight: 96,
              border: "none", width: "100%",
              cursor: n.para ? "pointer" : "default",
            };
            return n.para ? (
              <button key={n.rotulo} className="elevavel" style={estilo}
                onClick={() => navigate({ to: n.para as any })}>
                {conteudo}
              </button>
            ) : (
              <div key={n.rotulo} className="elevavel" style={estilo}>{conteudo}</div>
            );
          })}
        </div>
      )}

      {children}

      {visiveis.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={MICRO}>Ir para</span>
          <div className="painel-atalhos">
            {visiveis.map(({ label, descricao, icon: Icon, para }) => (
              <button
                key={label}
                className="elevavel"
                onClick={() => navigate({ to: para as any })}
                style={{
                  ...card(isLight), borderRadius: 16, padding: "14px 16px",
                  display: "flex", alignItems: "flex-start", gap: 12,
                  textAlign: "left", cursor: "pointer", color: textPrimary,
                  border: "none", width: "100%",
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: gold,
                }}>
                  <Icon size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT, fontWeight: 600, fontSize: 13.5 }}>
                    {label}
                  </span>
                  <span style={{
                    display: "block", fontFamily: FONT, fontWeight: 400, fontSize: 11.5,
                    color: textSecondary, marginTop: 2, lineHeight: 1.4,
                  }}>
                    {descricao}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
