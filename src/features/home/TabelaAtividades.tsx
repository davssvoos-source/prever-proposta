// A visão de LISTA da Início — uma tabela de verdade (U33).
//
// Era uma pilha de cards, o mesmo componente do quadro empilhado. Servia para
// ler UM item; não servia para comparar VINTE, que é o que se faz numa lista.
// Comparar exige colunas alinhadas: o olho desce a coluna "Prazo" e acha o que
// vence antes sem ler mais nada.
//
// As nove colunas são as que o Davi pediu, nesta ordem — cliente antes do
// título porque a primeira pergunta ao varrer é "de qual prédio é?".
//
// TRÊS CUIDADOS QUE VALEM MAIS QUE O CÓDIGO:
//
// 1. A tabela ROLA DENTRO DELA (overflow-x no envelope). Nove colunas não
//    cabem num celular, e sem o envelope a PÁGINA inteira rolaria de lado —
//    o defeito que o design system proíbe em §layout.
//
// 2. O CABEÇALHO GRUDA no topo ao rolar. Vinte linhas abaixo, uma data solta
//    sem cabeçalho não diz se é recebimento ou prazo.
//
// 3. ORDENAR é da tabela, não do filtro. Clicar no cabeçalho ordena por
//    aquela coluna — é o que qualquer pessoa tenta fazer numa tabela, e não
//    tentar seria fingir que ela é uma lista com bordas.

import { useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Building2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { AvatarPilha, type PessoaAvatar } from "@/components/AvatarPilha";
import { EQUIPE_LABEL, type Equipe } from "@/lib/equipes";
import type { Atividade } from "@/features/atividades/modelo";

export type ColunaTabela =
  | "cliente" | "titulo" | "responsavel" | "apoio" | "equipe"
  | "tipo" | "status" | "recebido" | "prazo";

interface Props {
  atividades: Atividade[];
  pessoas: Record<string, PessoaAvatar>;
  aoAbrir: (a: Atividade) => void;
}

const COLUNAS: { chave: ColunaTabela; titulo: string; largura: number; ordenavel: boolean }[] = [
  { chave: "cliente",     titulo: "Cliente",     largura: 150, ordenavel: true },
  { chave: "titulo",      titulo: "Título",      largura: 300, ordenavel: true },
  { chave: "responsavel", titulo: "Responsável", largura: 130, ordenavel: true },
  { chave: "apoio",       titulo: "Apoio",       largura: 90,  ordenavel: false },
  { chave: "equipe",      titulo: "Equipe",      largura: 130, ordenavel: true },
  { chave: "tipo",        titulo: "Tipo",        largura: 120, ordenavel: true },
  { chave: "status",      titulo: "Status",      largura: 130, ordenavel: true },
  { chave: "recebido",    titulo: "Recebido em", largura: 105, ordenavel: true },
  { chave: "prazo",       titulo: "Prazo",       largura: 105, ordenavel: true },
];

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export function TabelaAtividades({ atividades, pessoas, aoAbrir }: Props) {
  const { isLight } = useTheme();
  const [ordem, setOrdem] = useState<{ col: ColunaTabela; desc: boolean } | null>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const vermelho = isLight ? "#B1242E" : "#F17881";
  const superficie = isLight ? "#ffffff" : "#101016";
  const cabecalhoBg = isLight ? "#f5f6f8" : "#16161d";
  const linhaCor = isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";

  const nomeDe = (id: string | null) => (id ? pessoas[id]?.nome ?? "—" : "—");
  /** Apoio = quem está na atividade menos quem é o responsável. */
  const apoiosDe = (a: Atividade) => a.participantes.filter((p) => p !== a.responsavelId);

  const linhas = useMemo(() => {
    if (!ordem) return atividades;
    const valor = (a: Atividade): string => {
      switch (ordem.col) {
        case "cliente": return a.cliente ?? "";
        case "titulo": return a.titulo;
        case "responsavel": return nomeDe(a.responsavelId);
        case "equipe": return a.equipe ? EQUIPE_LABEL[a.equipe as Equipe] ?? a.equipe : "";
        case "tipo": return a.tipoLabel ?? "";
        case "status": return a.statusLabel;
        // datas comparam como ISO — texto, mas ordena certo, e sem construir
        // um Date por linha a cada clique de ordenação
        case "recebido": return a.criadoEm;
        // mesma fonte da célula: a visita ordena pela data agendada
        case "prazo": return a.prazoLimite ?? a.agendadaEm ?? "";
        default: return "";
      }
    };
    return [...atividades].sort((x, y) => {
      const vx = valor(x); const vy = valor(y);
      // vazio sempre por último, nos dois sentidos: uma coluna de prazos que
      // começa com dez traços não responde "o que vence primeiro?"
      if (!vx && vy) return 1;
      if (vx && !vy) return -1;
      const c = vx.localeCompare(vy, "pt-BR", { numeric: true });
      return ordem.desc ? -c : c;
    });
  }, [atividades, ordem, pessoas]);

  const th: CSSProperties = {
    position: "sticky", top: 0, zIndex: 1,
    background: cabecalhoBg,
    fontFamily: FONT, fontWeight: 700, fontSize: 9.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: textSecondary,
    textAlign: "left", padding: "9px 10px", whiteSpace: "nowrap",
    borderBottom: `1px solid ${linhaCor}`,
  };
  const td: CSSProperties = {
    fontFamily: FONT, fontSize: 12, color: textPrimary,
    padding: "9px 10px", borderBottom: `1px solid ${linhaCor}`,
    verticalAlign: "middle",
  };
  const corte: CSSProperties = {
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  if (atividades.length === 0) return null;

  return (
    // O envelope que rola de lado — a página nunca rola junto.
    //
    // `overflowY: "clip"` e NÃO `"visible"`: com `overflow-x: auto`, o CSS
    // resolve um `overflow-y: visible` para `auto`, e isso cria um contêiner
    // de rolagem de altura automática. O cabeçalho `sticky` passa a grudar
    // NESSE contêiner — que nunca rola verticalmente —, então ele não gruda
    // em nada quando a página desce. `clip` não cria contêiner de rolagem e
    // deixa o sticky se prender à página, que é o que se quer.
    <div style={{
      overflowX: "auto", overflowY: "clip",
      border: `1px solid ${linhaCor}`, borderRadius: 14,
      background: superficie,
    }}>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        minWidth: COLUNAS.reduce((s, c) => s + c.largura, 0),
      }}>
        <thead>
          <tr>
            {COLUNAS.map((c) => {
              const ativa = ordem?.col === c.chave;
              return (
                <th key={c.chave} style={{ ...th, width: c.largura }} scope="col"
                    aria-sort={ativa ? (ordem!.desc ? "descending" : "ascending") : undefined}>
                  {c.ordenavel ? (
                    <button
                      onClick={() => setOrdem((o) =>
                        o?.col === c.chave ? { col: c.chave, desc: !o.desc } : { col: c.chave, desc: false })}
                      style={{
                        border: "none", background: "transparent", padding: 0, cursor: "pointer",
                        font: "inherit", letterSpacing: "inherit", textTransform: "inherit",
                        color: ativa ? gold : "inherit",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}
                    >
                      {c.titulo}
                      {ativa && (ordem!.desc ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
                    </button>
                  ) : c.titulo}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map((a) => {
            const apoios = apoiosDe(a);
            return (
              // A linha é operável por TECLADO. Ela substituiu um
              // `CardAtividade`, que era um `<button>` e portanto focável;
              // um `<tr onClick>` não entra na ordem de tabulação, e quem
              // navega sem mouse perderia o acesso a todas as atividades.
              <tr
                key={a.id}
                onClick={() => aoAbrir(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    aoAbrir(a);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Abrir ${a.titulo}`}
                className="linha-tabela"
                style={{ cursor: "pointer" }}
              >
                <td style={{ ...td, ...corte, maxWidth: 150 }} title={a.cliente ?? ""}>
                  {a.cliente ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      <Building2 size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                      <span style={corte}>{a.cliente}</span>
                    </span>
                  ) : <span style={{ color: textSecondary }}>—</span>}
                </td>

                <td style={{ ...td, ...corte, maxWidth: 300, fontWeight: 600 }} title={a.titulo}>
                  {/* o número CH- antes do título: é como as pessoas se
                      referem ao chamado por telefone */}
                  {a.numero && (
                    <span style={{
                      fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10,
                      color: gold, marginRight: 6,
                    }}>
                      {a.numero}
                    </span>
                  )}
                  {a.titulo}
                </td>

                <td style={{ ...td, ...corte, maxWidth: 130 }} title={nomeDe(a.responsavelId)}>
                  {a.responsavelId
                    ? nomeDe(a.responsavelId)
                    : <span style={{ color: gold }}>sem responsável</span>}
                </td>

                <td style={td}>
                  {apoios.length > 0
                    ? <AvatarPilha ids={apoios} pessoas={pessoas} max={3} tamanho={20} />
                    : <span style={{ color: textSecondary }}>—</span>}
                </td>

                <td style={{ ...td, ...corte, maxWidth: 130 }}>
                  {/* equipe é invariante do modelo: só o interno tem. Em campo
                      quem organiza é a dupla, e o traço diz isso sem mentir */}
                  {a.equipe
                    ? EQUIPE_LABEL[a.equipe as Equipe] ?? a.equipe
                    : <span style={{ color: textSecondary }}>—</span>}
                </td>

                <td style={td}>
                  {a.tipoLabel && a.tipoCor ? (
                    <span style={{
                      padding: "2px 8px", borderRadius: 999,
                      fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
                      color: isLight ? a.tipoCor.light : a.tipoCor.dark,
                      background: a.tipoCor.bg, whiteSpace: "nowrap",
                    }}>
                      {a.tipoLabel}
                    </span>
                  ) : <span style={{ color: textSecondary }}>—</span>}
                </td>

                <td style={td}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 999,
                    fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
                    color: isLight ? a.statusCor.light : a.statusCor.dark,
                    background: a.statusCor.bg, whiteSpace: "nowrap",
                  }}>
                    {a.rotuloNativo ?? a.statusLabel}
                  </span>
                </td>

                <td style={{ ...td, color: textSecondary, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {dataCurta(a.criadoEm)}
                </td>

                {/* PRAZO. A visita não tem `prazoLimite` — o relógio dela é a
                    data agendada —, mas TEM `prazoEstourado` (visita marcada
                    que passou da hora). Colorir pelo atraso sem olhar se há
                    data pintava um traço de vermelho-negrito: alarme sobre
                    nada. Aqui a data manda no que é exibido, e o atraso só
                    colore o que existe; a visita mostra a data agendada, que
                    é o prazo dela de verdade. */}
                <td style={{
                  ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
                  color: a.prazoEstourado && (a.prazoLimite || a.agendadaEm) ? vermelho : textSecondary,
                  fontWeight: a.prazoEstourado && (a.prazoLimite || a.agendadaEm) ? 600 : 400,
                }}>
                  {dataCurta(a.prazoLimite ?? a.agendadaEm)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
