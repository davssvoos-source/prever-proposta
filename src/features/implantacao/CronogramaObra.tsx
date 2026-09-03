// O cronograma da obra, dentro do detalhe do chamado (R120, U89).
//
// ── A TELA NÃO CALCULA NADA ───────────────────────────────────────────────
// Quem divide período em fases, conta dia útil, acha buraco e monta calendário
// é `./modelo.ts`, coberto por asserção no verificador. Aqui só há JSX, estado
// de digitação e chamadas de mutação. É a regra da casa
// (docs/manual/operacao-campo.md:89-90), e ela existe porque o número que sai
// daqui vai para a folha que o cliente recebe.
//
// ── O PLANO É PLANO, E O SISTEMA NÃO BARRA ────────────────────────────────
// `conferirCronograma` devolve AVISOS, e esta tela os mostra em âmbar sem
// travar nada. Um vão de três dias entre a instalação e a configuração pode
// ser a espera de um equipamento; recusá-lo obrigaria a mentir na data para
// conseguir salvar. É a mesma decisão que o Davi deu em 02/09 sobre o
// atendimento antecipado e sobre o teto do bloco isento.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle, CalendarRange, CheckSquare, FileDown, RefreshCw, Square, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { card } from "@/lib/ui";
import {
  FASES, FASE_LABEL, conferirCronograma, textoDoProblema, dividirEmFases,
  contarDiasUteis, contarDiasCorridos, avisoDeAnoNaoConferido, resumirObra,
  type Fase,
} from "./modelo";
import {
  useCronograma, usePeriodoDaObra, useSalvarPeriodo, useGerarCronograma,
  useSalvarFase, useAlternarFase, useApagarCronograma, type LinhaDoCronograma,
} from "./data";
import { gerarPdfCronograma, digitoDaFase } from "./pdf";

/** A mensagem do servidor CHEGA. `error` do PostgREST não é instância de Error. */
function texto(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Não foi possível concluir. Tente de novo.";
}

const CORES: Record<Fase, { claro: string; escuro: string }> = {
  infraestrutura: { claro: "#FFECB3", escuro: "#5C4A12" },
  instalacao: { claro: "#FFD56E", escuro: "#6B5410" },
  configuracao: { claro: "#BBDEFB", escuro: "#173A5E" },
  acabamento: { claro: "#C8E6C9", escuro: "#1B4620" },
};

export function CronogramaObra({
  chamadoId,
  isLight,
  podeEditar,
  dadosDoPdf,
}: {
  chamadoId: string;
  isLight: boolean;
  podeEditar: boolean;
  dadosDoPdf: { numero: string | null; titulo: string | null; cliente: string | null; endereco: string | null };
}) {
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const ambar = isLight ? "#8A5A00" : "#F0B429";

  const CARD: CSSProperties = {
    ...card(isLight), padding: 16,
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", borderRadius: 10, padding: "9px 11px",
    fontFamily: "var(--fonte)", fontSize: 12.5, color: textPrimary,
    background: isLight ? "#f6f7f9" : "rgba(255,255,255,0.04)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
  };
  const BOTAO: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 10, padding: "8px 13px", cursor: "pointer",
    fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600,
    background: isLight ? "#f0f1f4" : "rgba(255,255,255,0.06)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.09)",
    color: textPrimary,
  };

  // ── O PERÍODO ───────────────────────────────────────────────────────────
  // Lido por consulta PRÓPRIA e não pelo `useChamado` — ver `usePeriodoDaObra`
  // em ./data.ts: é o que impede que uma coluna ainda inexistente derrube o
  // detalhe do chamado inteiro em vez de só este card.
  const periodoQ = usePeriodoDaObra(chamadoId);
  const periodoInicio = periodoQ.data?.inicio ?? null;
  const periodoFim = periodoQ.data?.fim ?? null;

  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  useEffect(() => { setIni(periodoInicio ?? ""); setFim(periodoFim ?? ""); },
    [periodoInicio, periodoFim]);

  // O que está DIGITADO diverge do que está SALVO? A tela diz, em vez de
  // deixar o usuário achar que salvou. É a lição da U86 pelo lado do desenho:
  // lá um valor recusado ficava na tela parecendo gravado.
  const naoSalvo = ini !== (periodoInicio ?? "") || fim !== (periodoFim ?? "");
  const periodoValido = !!ini && !!fim && fim >= ini;

  const salvarPeriodo = useSalvarPeriodo(chamadoId);
  const { data: linhas = [], isLoading, isError, error } = useCronograma(chamadoId);
  const gerar = useGerarCronograma(chamadoId);
  const salvarFase = useSalvarFase(chamadoId);
  const alternar = useAlternarFase(chamadoId);
  const apagar = useApagarCronograma(chamadoId);

  const problemas = useMemo(
    () => (periodoInicio && periodoFim && linhas.length > 0
      ? conferirCronograma(linhas, periodoInicio, periodoFim)
      : []),
    [linhas, periodoInicio, periodoFim],
  );

  const resumo = useMemo(
    () => (periodoInicio && periodoFim ? resumirObra(periodoInicio, periodoFim, linhas) : null),
    [linhas, periodoInicio, periodoFim],
  );

  const aviso = periodoInicio && periodoFim
    ? avisoDeAnoNaoConferido(periodoInicio, periodoFim) : null;

  // ── EDIÇÃO DE UMA FASE ──────────────────────────────────────────────────
  // Modo de edição explícito, com Salvar e Cancelar. NÃO é auto-save: o campo
  // de data auto-salvo é exatamente a forma que produziu o defeito da U86
  // (digitar "24" gravava 4, porque cada tecla era uma escrita). Aqui o que
  // está em edição está declaradamente em edição.
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ inicio: string; fim: string; observacao: string }>(
    { inicio: "", fim: "", observacao: "" },
  );

  const abrirEdicao = (l: LinhaDoCronograma) => {
    setEditando(l.id);
    setRascunho({ inicio: l.inicio, fim: l.fim, observacao: l.observacao ?? "" });
  };

  const porFase = new Map<Fase, LinhaDoCronograma>();
  for (const l of linhas) porFase.set(l.fase, l);

  const previa = periodoValido ? dividirEmFases(ini, fim) : [];

  // A FALHA DE LEITURA DO PERÍODO APARECE, e o card para aqui.
  // Sem esta saída, `periodoInicio` viria null numa consulta RECUSADA e a tela
  // diria "defina o período da obra" para uma obra que já tem um — convidando
  // a redigitar por cima de dado que existe. Falha silenciosa que vira convite
  // a sobrescrever é a forma mais cara de erro de leitura.
  if (periodoQ.isError) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarRange size={15} color={gold} />
          <span style={SEC}>Cronograma da obra</span>
        </div>
        <Aviso cor={isLight ? "#B42318" : "#FF6B6B"} isLight={isLight}>
          Não foi possível ler o período da obra: {texto(periodoQ.error)}
        </Aviso>
      </div>
    );
  }

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <CalendarRange size={15} color={gold} />
        <span style={SEC}>Cronograma da obra</span>
        <span style={{ flex: 1 }} />
        {resumo && resumo.pctConcluido !== null && (
          <span style={{
            fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 700,
            color: resumo.pctConcluido === 100 ? (isLight ? "#047862" : "#2DD2A5") : gold,
            fontVariantNumeric: "tabular-nums",
          }}>
            {resumo.fasesConcluidas}/{linhas.length} fases
          </span>
        )}
      </div>

      {/* ── O PERÍODO ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 140px", minWidth: 130 }}>
          <label style={LABEL}>Início previsto</label>
          <input type="date" style={INPUT} value={ini} disabled={!podeEditar}
                 onChange={(e) => setIni(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 130 }}>
          <label style={LABEL}>Fim previsto</label>
          <input type="date" style={INPUT} value={fim} disabled={!podeEditar}
                 onChange={(e) => setFim(e.target.value)} />
        </div>
        {podeEditar && (
          <button
            style={{ ...BOTAO, opacity: naoSalvo && (periodoValido || (!ini && !fim)) ? 1 : 0.5 }}
            disabled={salvarPeriodo.isPending || !naoSalvo || !(periodoValido || (!ini && !fim))}
            onClick={() => {
              salvarPeriodo.mutate(periodoValido ? { inicio: ini, fim: fim } : null, {
                onSuccess: () => toast.success(
                  periodoValido ? "Período salvo. O prazo da obra passou a ser o fim previsto."
                                : "Período apagado. A obra ficou sem prazo.",
                ),
                onError: (e) => toast.error(texto(e)),
              });
            }}
          >
            {salvarPeriodo.isPending ? "Salvando…" : "Salvar período"}
          </button>
        )}
      </div>

      {ini && fim && fim < ini && (
        <Aviso cor={ambar} isLight={isLight}>O fim é anterior ao início.</Aviso>
      )}

      {naoSalvo && periodoValido && (
        <Aviso cor={ambar} isLight={isLight}>
          Período digitado e ainda não salvo. Ele só passa a valer como prazo da obra depois de salvar.
        </Aviso>
      )}

      {periodoValido && (
        <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary }}>
          {contarDiasUteis(ini, fim)} dias úteis de {contarDiasCorridos(ini, fim)} corridos.
          {previa.length === 0 && " O período não tem nenhum dia útil."}
        </div>
      )}

      {aviso && <Aviso cor={ambar} isLight={isLight}>{aviso}</Aviso>}

      {/* ── AS FASES ──────────────────────────────────────────────────── */}
      {!periodoInicio || !periodoFim ? (
        <div style={{ fontFamily: "var(--fonte)", fontSize: 12.5, color: textSecondary }}>
          Defina o período da obra para planejar as quatro fases. Enquanto não houver
          período, esta implantação fica sem prazo — e é a verdade: ninguém disse
          quando ela acaba.
        </div>
      ) : isLoading ? (
        <div style={{ fontFamily: "var(--fonte)", fontSize: 12.5, color: textSecondary }}>
          Carregando as fases…
        </div>
      ) : isError ? (
        // O ERRO APARECE. Um cronograma vazio por falha de rede é
        // indistinguível de um cronograma que ninguém planejou, e foi assim
        // que a grade de sobreaviso da U86 chegou a exportar um PDF dizendo
        // "31 dias descobertos" quando o que houve foi uma consulta recusada.
        <Aviso cor={isLight ? "#B42318" : "#FF6B6B"} isLight={isLight}>
          Não foi possível ler o cronograma: {texto(error)}
        </Aviso>
      ) : linhas.length === 0 ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12.5, color: textSecondary, flex: 1 }}>
            Nenhuma fase planejada ainda.
          </span>
          {podeEditar && (
            <button style={BOTAO} disabled={gerar.isPending}
              onClick={() => gerar.mutate({ inicio: periodoInicio, fim: periodoFim }, {
                onSuccess: () => toast.success("Cronograma gerado. Ajuste as datas de cada fase como precisar."),
                onError: (e) => toast.error(texto(e)),
              })}>
              <CalendarRange size={14} />
              {gerar.isPending ? "Gerando…" : "Gerar as quatro fases"}
            </button>
          )}
        </div>
      ) : (
        <>
          {problemas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {problemas.map((p, i) => (
                <Aviso key={i} cor={ambar} isLight={isLight}>{textoDoProblema(p)}</Aviso>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {FASES.map((fase) => {
              const l = porFase.get(fase);
              const cor = CORES[fase];
              const emEdicao = l && editando === l.id;
              return (
                <div key={fase} style={{
                  display: "flex", gap: 10, padding: "9px 0", alignItems: "flex-start",
                  borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: 6,
                    background: isLight ? cor.claro : cor.escuro,
                    color: isLight ? "#3b2f00" : "#ffffff",
                    fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{digitoDaFase(fase)}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--fonte)", fontSize: 12.5, fontWeight: 600,
                      color: textPrimary, opacity: l?.concluida_em ? 0.6 : 1,
                      textDecoration: l?.concluida_em ? "line-through" : "none",
                    }}>
                      {FASE_LABEL[fase]}
                    </div>

                    {!l ? (
                      <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: ambar }}>
                        Sem linha no cronograma.
                      </div>
                    ) : emEdicao ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input type="date" style={{ ...INPUT, flex: "1 1 120px" }}
                                 value={rascunho.inicio}
                                 onChange={(e) => setRascunho((r) => ({ ...r, inicio: e.target.value }))} />
                          <input type="date" style={{ ...INPUT, flex: "1 1 120px" }}
                                 value={rascunho.fim}
                                 onChange={(e) => setRascunho((r) => ({ ...r, fim: e.target.value }))} />
                        </div>
                        <input type="text" style={INPUT} placeholder="Observação (opcional)"
                               value={rascunho.observacao}
                               onChange={(e) => setRascunho((r) => ({ ...r, observacao: e.target.value }))} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={BOTAO} disabled={salvarFase.isPending || rascunho.fim < rascunho.inicio}
                            onClick={() => salvarFase.mutate({
                              id: l.id, inicio: rascunho.inicio, fim: rascunho.fim,
                              observacao: rascunho.observacao.trim() || null,
                            }, {
                              onSuccess: () => setEditando(null),
                              onError: (e) => toast.error(texto(e)),
                            })}>
                            {salvarFase.isPending ? "Salvando…" : "Salvar"}
                          </button>
                          <button style={BOTAO} onClick={() => setEditando(null)}>Cancelar</button>
                        </div>
                        {rascunho.fim < rascunho.inicio && (
                          <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: ambar }}>
                            O fim é anterior ao início.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {br(l.inicio)} a {br(l.fim)} · {contarDiasUteis(l.inicio, l.fim)} dia(s) útil(eis)
                        {l.observacao ? ` · ${l.observacao}` : ""}
                      </div>
                    )}
                  </div>

                  {l && podeEditar && !emEdicao && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        title={l.concluida_em ? "Desmarcar" : "Marcar como concluída"}
                        onClick={() => alternar.mutate(
                          { id: l.id, concluida: !l.concluida_em },
                          { onError: (e) => toast.error(texto(e)) },
                        )}
                        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                      >
                        {l.concluida_em
                          ? <CheckSquare size={17} color={isLight ? "#047862" : "#2DD2A5"} />
                          : <Square size={17} color={textSecondary} />}
                      </button>
                      <button title="Ajustar datas"
                        onClick={() => abrirEdicao(l)}
                        style={{
                          background: "transparent", border: "none", cursor: "pointer",
                          padding: 2, fontFamily: "var(--fonte)", fontSize: 11,
                          fontWeight: 600, color: gold,
                        }}>
                        Ajustar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={BOTAO}
              onClick={() => {
                gerarPdfCronograma({
                  ...dadosDoPdf, inicio: periodoInicio, fim: periodoFim, linhas,
                }).catch((e) => toast.error(texto(e)));
              }}>
              <FileDown size={14} /> Baixar cronograma (PDF)
            </button>
            {podeEditar && (
              <>
                <button style={BOTAO} disabled={gerar.isPending}
                  onClick={() => {
                    // Diz o que apaga ANTES de apagar. Refazer a divisão joga
                    // fora todo ajuste manual, e descobrir isso depois custa o
                    // planejamento de uma obra inteira.
                    if (!window.confirm(
                      "Refazer a divisão apaga as quatro fases e as recria a partir do período. Todo ajuste de data e toda observação se perdem. Continuar?",
                    )) return;
                    gerar.mutate({ inicio: periodoInicio, fim: periodoFim, refazer: true }, {
                      onSuccess: () => toast.success("Cronograma redistribuído pelo período."),
                      onError: (e) => toast.error(texto(e)),
                    });
                  }}>
                  <RefreshCw size={14} /> Refazer a divisão
                </button>
                <button style={{ ...BOTAO, color: isLight ? "#B42318" : "#FF8A80" }}
                  disabled={apagar.isPending}
                  onClick={() => {
                    if (!window.confirm("Apagar o cronograma inteiro? O período da obra continua.")) return;
                    apagar.mutate(undefined, { onError: (e) => toast.error(texto(e)) });
                  }}>
                  <Trash2 size={14} /> Apagar cronograma
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Aviso({ children, cor, isLight }: { children: React.ReactNode; cor: string; isLight: boolean }) {
  return (
    <div style={{
      display: "flex", gap: 7, alignItems: "flex-start",
      borderRadius: 10, padding: "8px 10px",
      background: isLight ? "rgba(240,180,41,0.10)" : "rgba(240,180,41,0.08)",
      border: `1px solid ${cor}33`,
    }}>
      <AlertTriangle size={14} color={cor} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: cor, lineHeight: 1.45 }}>
        {children}
      </span>
    </div>
  );
}

const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
