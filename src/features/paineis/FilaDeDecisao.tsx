// A FILA DE DECISÃO da Gestão Técnica (R300) — o que espera o gestor HOJE.
//
// Davi, 15/09/2026: "deverão aparecer os cards das atividades aguardando
// retorno, ou aguardando o Vinicius lançar cobrança (Ou não). Este campo é
// importante e o Vinicius olhará todos os dias."
//
// DOIS GRUPOS, DUAS FUNÇÕES PURAS que já existiam — nada é contado aqui:
//   · "Aguardando retorno"  = `filaDeRetornos` (R286): a ida não resolveu, o
//     retorno foi registrado e ainda não tem data futura; mais idas primeiro.
//   · "Aguardando cobrança" = `chamadosDoKpi("aguardando_conferencia")` (R125):
//     concluída sem decisão de cobrança — o MESMO recorte do quadrado do
//     dashboard e da lista da Operacional, para os três números baterem.
//
// O card é o card do quadro da Operacional (título, cliente, status + tipo,
// quem e quando), com o filete na cor do grupo e, no retorno, a etiqueta
// "Retornado Nx" (R286). Clique abre o chamado no painel lateral (R33).
// TETO por grupo: doze — a fila é para decidir, não para rolar; o resto está
// na Operacional recortada pelo mesmo KPI, a um clique.

import { useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, rotuloDeSecao } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { useChamadosPorNatureza } from "@/features/chamados/data";
import { useTecnicos } from "@/features/gerencial/data";
import { chamadoStatusInfo, TIPO_LABEL, type ChamadoTipo } from "@/lib/chamado-status";
import {
  chamadosDoKpi, filaDeRetornos, etiquetaDeRetorno, momentoDoCard,
} from "@/features/paineis/indicadores";

/** Quantos cards um grupo mostra antes de mandar para a Operacional. */
export const TETO_DA_FILA = 12;

interface Props {
  aoAbrir: (id: string) => void;
  /** "ver todas" do grupo de cobrança: a Operacional recortada por `aguardando_conferencia`. */
  aoVerCobrancas: () => void;
}

export function FilaDeDecisao({ aoAbrir, aoVerCobrancas }: Props) {
  const { isLight } = useTheme();
  const consulta = useChamadosPorNatureza("campo");
  // R95/R124: a fila é da equipe TÉCNICA, como o dashboard e a Operacional.
  const chamados = useMemo(
    () => (consulta.data ?? []).filter((c) => c.equipe === "tecnica"),
    [consulta.data],
  );
  const { data: tecnicos = [] } = useTecnicos();
  const nomeTecnico = useMemo(
    () => new Map((tecnicos as any[]).map((t) => [t.id, t.nome as string])),
    [tecnicos],
  );
  // um "agora" só para os dois grupos — um retorno marcado para hoje conta
  // igual nos dois lados da tela
  const agora = useMemo(() => new Date(), [chamados]);
  const retornos = useMemo(() => filaDeRetornos(chamados as any[], agora), [chamados, agora]);
  const cobrancas = useMemo(
    () => chamadosDoKpi("aguardando_conferencia", chamados as any[], agora),
    [chamados, agora],
  );

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  const pessego = isLight ? PRISMA.pessego.light : PRISMA.pessego.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;

  // ERRO, CARREGANDO E VAZIO SÃO TRÊS TELAS (lição da U86): uma fila vazia por
  // falha de leitura tem a mesma cara de "nada a decidir" — e é a mais cara.
  if (consulta.isError) {
    return (
      <div style={{ ...card(isLight), borderRadius: 14, paddingInline: 16, paddingBlock: 12, fontFamily: FONT, fontSize: 12.5, color: vermelho }}>
        <strong>A fila de decisão não pôde ser lida — isto NÃO é uma fila vazia.</strong>
        <span style={{ color: textSecondary }}> {(consulta.error as Error)?.message ?? "erro desconhecido"}</span>
      </div>
    );
  }

  const Grupo = ({ titulo, nota, itens, cor, vazio, etiqueta, aoVerTodos }: {
    titulo: string; nota: string; itens: any[]; cor: string; vazio: string;
    etiqueta?: (c: any) => string | null; aoVerTodos?: () => void;
  }) => {
    const visiveis = itens.slice(0, TETO_DA_FILA);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={rotuloDeSecao(isLight)}>{titulo}</span>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 12, color: cor,
            fontVariantNumeric: "tabular-nums",
          }}>
            {consulta.isLoading ? "…" : itens.length}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>{nota}</span>
          {itens.length > TETO_DA_FILA && aoVerTodos ? (
            <button
              type="button"
              onClick={aoVerTodos}
              style={{
                marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer",
                fontFamily: FONT, fontSize: 11.5, fontWeight: 600, padding: 0,
                color: isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
              }}
            >
              ver todas as {itens.length} na Operacional →
            </button>
          ) : null}
        </div>
        {consulta.isLoading ? (
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>Carregando…</span>
        ) : visiveis.length === 0 ? (
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>{vazio}</span>
        ) : (
          <div style={{
            display: "grid", gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          }}>
            {visiveis.map((c: any) => {
              const info = chamadoStatusInfo(c.status);
              const momento = momentoDoCard(c);
              const marca = etiqueta?.(c) ?? null;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="elevavel"
                  onClick={() => aoAbrir(c.id)}
                  title={`${c.titulo}${c.numero ? ` · ${c.numero}` : ""} — clique para abrir`}
                  style={{
                    ...card(isLight), borderRadius: 12, paddingInline: 11, paddingBlock: 9,
                    textAlign: "left", cursor: "pointer", color: textPrimary, font: "inherit",
                    display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
                    borderLeft: `3px solid ${cor}`,
                  }}
                >
                  <div style={{
                    fontFamily: FONT, fontWeight: 600, fontSize: 12.5, lineHeight: 1.3,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {c.titulo}
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 10.5, color: textSecondary,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.cliente?.nome ?? c.cliente_origem_nome ?? "Sem cliente"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      paddingInline: 6, paddingBlock: 1, borderRadius: 999,
                      background: info.bg, color: isLight ? info.colorLight : info.color,
                      fontFamily: FONT, fontWeight: 700, fontSize: 8.5,
                      letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                    }}>
                      {info.label}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 9.5, whiteSpace: "nowrap", color: textSecondary }}>
                      {TIPO_LABEL[c.tipo as ChamadoTipo] ?? c.tipo ?? "—"}
                    </span>
                    {marca ? (
                      // R286: a etiqueta do retorno — o número de idas é o que faz
                      // o crônico PARECER crônico
                      <span style={{
                        fontFamily: FONT, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em",
                        textTransform: "uppercase", whiteSpace: "nowrap", color: cor,
                      }}>
                        {marca}
                      </span>
                    ) : null}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                    fontFamily: FONT, fontSize: 10, color: textSecondary,
                  }}>
                    <span style={{ whiteSpace: "nowrap" }}>
                      {c.responsavel_id ? nomeTecnico.get(c.responsavel_id) ?? "Técnico" : "Sem técnico"}
                    </span>
                    {momento.inicio ? (
                      <span style={{ whiteSpace: "nowrap", marginLeft: "auto" }}>
                        {momento.rotulo}{" "}
                        {new Date(momento.inicio).toLocaleString("pt-BR",
                          momento.temHora
                            ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                            : { day: "2-digit", month: "2-digit" })}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Grupo
        titulo="Aguardando retorno"
        nota="a ida não resolveu e a volta ainda não tem data"
        itens={retornos}
        cor={laranja}
        vazio="Nenhuma atividade aguardando retorno."
        etiqueta={(c) => etiquetaDeRetorno(c.retornos)}
      />
      <Grupo
        titulo="Aguardando cobrança"
        nota="concluídas sem decisão de cobrança — lançar, ou não"
        itens={cobrancas}
        cor={pessego}
        vazio="Nenhuma atividade aguardando cobrança."
        aoVerTodos={aoVerCobrancas}
      />
    </div>
  );
}
