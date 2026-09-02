// CONCLUIR COM DECISÃO DE COBRANÇA (R104) — U80.
//
// ── O PAINEL ROTEIA; ELE NÃO ESCREVE DINHEIRO POR CONTA PRÓPRIA ───────────
// Tudo que cria ou muda dinheiro passa por RPC — é a primeira frase de
// `features/chamados/cobranca.ts`, e continua valendo. Aqui há UMA porta
// (`concluir_chamado_com_cobranca`) e ela conclui e decide na MESMA transação.
// Duas chamadas (concluir, depois lançar) teriam um estado intermediário
// observável: chamado concluído, dinheiro não lançado, ninguém sabendo.
//
// ── OS CAMINHOS SÃO DISJUNTOS, E QUEM DECIDE ISSO É O SERVIDOR ────────────
// Onde HOUVE análise item a item, a cobrança sai da APROVAÇÃO — com o bloqueio
// de `revisar`/`nao_identificado` que a U4 escreveu ("cobrança indevida custa
// mais caro do que uma conferência"). Onde não houve, o valor digitado é a
// única verdade que existe. A porta RECUSA `lancar` num chamado que tem
// análise, e este painel nem oferece o formulário nesse caso: a tela ANTECIPA
// a recusa, o servidor a IMPÕE.
//
// ── O QUE ESTE PAINEL NUNCA MOSTRA A QUEM NÃO VÊ VALORES ──────────────────
// `veFinanceiro` é o espelho exato de `pode_ver_financeiro` (R13: o SAC é
// gestor que NÃO vê valores). Sem ele: nenhum campo de valor, nenhum botão de
// lançar, nenhuma soma. Sobra "concluir e deixar para a conferência", que é
// `pode_editar_chamado` e não é privilégio financeiro — concluir não é decidir.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { PRISMA } from "@/lib/paleta";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { parcelar } from "@/lib/periodos";
import { useChamado } from "@/features/chamados/data";
import { useVeFinanceiro } from "@/features/gerencial/data";
import {
  FATURAMENTO_LABEL, moeda, useAnaliseChamado, useLancamentoDoChamado,
  type FaturamentoStatus,
} from "@/features/chamados/cobranca";
import { useAfirmarVisitas, useConcluirComCobranca, sqlstateDoErro } from "./data";
import { ConfirmacaoDasVisitas, useConfirmacaoDasVisitas } from "./ConfirmacaoDasVisitas";
import { classeDoErro, erroDoLancamento, podeConcluirDoCartao, reaisDigitados } from "./modelo";

interface Props {
  chamadoId: string;
  isLight: boolean;
  aoFechar: () => void;
  aoAbrirChamado: (id: string) => void;
}

export function PainelDoCiclo({ chamadoId, isLight, aoFechar, aoAbrirChamado }: Props) {
  const { data: chamado, isPending } = useChamado(chamadoId);
  const { data: veFinanceiro = false } = useVeFinanceiro();
  const { data: analise = [] } = useAnaliseChamado(chamadoId);
  const { data: temLancamento } = useLancamentoDoChamado(chamadoId);
  const concluir = useConcluirComCobranca();
  /**
   * A SEGUNDA MÃO DO CARIMBO (U82). Este painel é o funil das TRÊS decisões do
   * ciclo, e as três encerram o atendimento — logo a pergunta entra no topo de
   * `disparar()`, ANTES da porta que escreve o status.
   *
   * `concluir_chamado_com_cobranca` continua NÃO marcando `cumprido_em`, e o
   * COMMENT dela (u80:541-542) continua verdadeiro palavra por palavra: quem
   * afirma é `agenda_campo_afirmar`, numa chamada separada e anterior.
   */
  const conf = useConfirmacaoDasVisitas(chamadoId);
  const afirmar = useAfirmarVisitas();

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [erro, setErro] = useState<{ frase: string; code: string | null } | null>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;

  const CARD = { ...card(isLight), padding: "16px 18px", display: "flex", flexDirection: "column" as const, gap: 12 };
  const INPUT = {
    width: "100%", boxSizing: "border-box" as const, height: 40, borderRadius: 10, padding: "0 12px",
    background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, fontFamily: FONT, fontSize: 13, outline: "none",
  };
  const btnSec = {
    flex: 1, minWidth: 130, minHeight: 40, borderRadius: 12, cursor: "pointer",
    background: "transparent", color: textPrimary,
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  };

  const tipoServico = (chamado?.tipo_servico ?? "manutencao") as "instalacao" | "manutencao";
  const nTotal = reaisDigitados(valor);
  const nParcelas = Number(parcelas);
  const candidato = {
    descricao, valorTotal: Number.isFinite(nTotal) ? nTotal : 0,
    parcelas: Number.isFinite(nParcelas) ? nParcelas : 0, tipoServico,
  };
  const erroLocal = erroDoLancamento(candidato);
  const previa = erroLocal ? [] : parcelar(candidato.valorTotal, candidato.parcelas);

  const disparar = async (
    decisao: "conferir_depois" | "nada_a_cobrar" | "lancar",
    extra?: { descricao: string; valorTotal: number; parcelas: number[] },
  ) => {
    setErro(null);
    // A AFIRMAÇÃO VEM ANTES DO STATUS, e a colisão de agenda custa uma pergunta
    // — nunca um encerramento perdido: se ela falhar, NADA foi escrito, o
    // chamado NÃO foi concluído e as duas saídas aparecem no mesmo painel.
    // O CÓDIGO VEM DO MODELO PURO, junto com a frase. Um `code: "42501"` fixo
    // pintava de "permissão" (escudo, "o gesto não vai acontecer") até a recusa
    // de NATUREZA, que a porta levanta como `55000` = regra ("dá para corrigir
    // aqui"). A mesma frase ganhava duas caras conforme quem a dissesse.
    if (conf.recusa) { setErro({ frase: conf.recusa.frase, code: conf.recusa.code }); return; }
    try {
      const r = await afirmar.mutateAsync({ chamadoId, ...conf.payload });
      if (r.portaAusente) {
        toast.message(
          "As visitas não foram marcadas como feitas: a atualização do banco ainda não foi aplicada. Marque-as pela grade.",
        );
      } else if (r.portaMuda) {
        toast.message(
          "Não consegui gravar a resposta sobre as visitas agora (conexão). O chamado foi encerrado; responda depois pelo aviso do chamado.",
        );
      }
    } catch (e: unknown) {
      setErro({ frase: (e as Error).message, code: sqlstateDoErro(e) });
      return;
    }
    concluir.mutate(
      { chamadoId, decisao, tipoServico, ...(extra ?? {}) },
      {
        onSuccess: (r) => {
          toast.success(
            decisao === "lancar"
              ? `Atendimento concluído · ${r.itens} parcela(s) lançada(s).`
              : "Atendimento concluído.",
          );
          aoFechar();
        },
        // A frase vem CRUA da porta, em português, palavra por palavra igual à
        // do modelo puro — e o rosto sai de `classeDoErro(code)`. Trocar a
        // mensagem por um texto genérico apagaria a única coisa que o usuário
        // podia usar.
        onError: (e: unknown) =>
          setErro({ frase: (e as Error).message, code: sqlstateDoErro(e) }),
      },
    );
  };

  const recusaDeConcluir = chamado
    ? podeConcluirDoCartao({
        status: chamado.status,
        diagnostico: chamado.diagnostico,
        servico_executado: chamado.servico_executado,
      })
    : null;

  const jaDecidido = chamado ? chamado.faturamento_status !== "a_analisar" : false;
  const temAnalise = analise.length > 0;

  const classe = classeDoErro(erro?.code);
  const corErro = classe === "permissao"
    ? (isLight ? PRISMA.laranja.light : PRISMA.laranja.dark)
    : (isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Concluir com decisão de cobrança"
      onClick={aoFechar}
      style={{
        position: "fixed", inset: 0, zIndex: 60, padding: 16,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...CARD, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Receipt size={16} color={gold} />
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", color: gold,
          }}>
            Concluir o atendimento
          </span>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            style={{
              marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
              color: textSecondary, display: "flex", padding: 2,
            }}
          >
            <X size={17} />
          </button>
        </div>

        {isPending || !chamado ? (
          <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>Carregando…</span>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: textPrimary }}>
                {chamado.numero ?? "—"} · {chamado.titulo}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
                {chamado.cliente?.nome ?? "cliente"}
                {" · "}
                {FATURAMENTO_LABEL[chamado.faturamento_status as FaturamentoStatus] ?? chamado.faturamento_status}
              </span>
            </div>

            {/* 1) O LAUDO NÃO É PULÁVEL PELO ATALHO. A frase é a MESMA da porta
                   (passo 4), e o modelo puro é quem a escreve. */}
            {recusaDeConcluir && (
              <div style={{
                padding: "11px 13px", borderRadius: 12,
                background: isLight ? "rgba(250,132,45,0.07)" : "rgba(250,132,45,0.08)",
                border: `1px solid ${PRISMA.laranja.border}`,
                display: "flex", gap: 9, alignItems: "flex-start",
              }}>
                <AlertTriangle size={15} color={isLight ? PRISMA.laranja.light : PRISMA.laranja.dark}
                  style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontFamily: FONT, fontSize: 12, color: textPrimary, lineHeight: 1.5 }}>
                  {recusaDeConcluir}
                </span>
              </div>
            )}

            {/* 2) O ESTADO DO CICLO, em uma frase — e nunca um valor. */}
            {!recusaDeConcluir && veFinanceiro && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {temLancamento === true ? (
                  <span style={{ fontFamily: FONT, fontSize: 12.5, color: verde, lineHeight: 1.5 }}>
                    Este atendimento já tem lançamento vinculado. Não há o que decidir aqui —
                    concluir só fecha o atendimento.
                  </span>
                ) : jaDecidido ? (
                  <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
                    A cobrança deste atendimento já foi decidida. A porta só aceita decidir a partir
                    de “A analisar”, e nenhum caminho devolve um chamado a esse estado.
                  </span>
                ) : temAnalise ? (
                  <>
                    <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
                      Este atendimento foi analisado item a item. A cobrança sai da conferência — com o
                      valor do contrato — e não de um valor digitado aqui.
                    </span>
                    <button
                      onClick={() => aoAbrirChamado(chamadoId)}
                      style={{ ...btnSec, borderColor: gold, color: gold }}
                    >
                      Conferir e aprovar no chamado
                    </button>
                  </>
                ) : (
                  /* 3) O FORMULÁRIO — só quando NÃO houve análise. */
                  <>
                    <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
                      Nenhuma peça foi analisada. Se há o que cobrar, lance agora — o lançamento nasce
                      já vinculado a este atendimento, e isso é o que impede um segundo lançamento em cima.
                    </span>
                    <input
                      style={INPUT}
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="O que está sendo cobrado"
                      aria-label="Descrição da cobrança"
                    />
                    <div style={{ display: "flex", gap: 9 }}>
                      <input
                        style={{ ...INPUT, flex: 2 }}
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        inputMode="decimal"
                        placeholder="Valor total"
                        aria-label="Valor total"
                      />
                      <input
                        style={{ ...INPUT, flex: 1 }}
                        value={parcelas}
                        onChange={(e) => setParcelas(e.target.value)}
                        inputMode="numeric"
                        placeholder="parcelas"
                        aria-label="Número de parcelas"
                      />
                    </div>
                    {/* A PRÉVIA SAI DE `parcelar()`, a mesma função que produz o
                        array mandado à porta — o usuário vê exatamente o que vai
                        ser gravado, centavo por centavo, com o resto na primeira. */}
                    {previa.length > 0 && (
                      <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
                        {previa.length > 1
                          ? `${previa.length}× — primeira de ${moeda(previa[0])}, demais de ${moeda(previa[previa.length - 1])}`
                          : `parcela única de ${moeda(previa[0])}`}
                      </span>
                    )}
                    {descricao.trim() !== "" && erroLocal && (
                      <span style={{ fontFamily: FONT, fontSize: 11.5, color: corErro }}>
                        {erroLocal}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* O `erro` VAI PARA DENTRO DO PAINEL, e não só para a caixa
                vermelha lá embaixo: as DUAS SAÍDAS do 23P01 ("escolha
                'Aconteceu no dia marcado' aqui mesmo, ou ajuste o horário na
                grade") moram em `ConfirmacaoDasVisitas`, ao lado dos botões que
                as executam. Sem esta prop, o gestor via a frase vermelha do
                conflito e nada mais — com a saída desenhada quinze pixels
                acima, sem ninguém apontá-la — e concluía que a agenda travou o
                faturamento. É o erro que mais precisa de painel sendo o único
                painel sem ele. */}
            {!recusaDeConcluir && (
              <ConfirmacaoDasVisitas estado={conf} isLight={isLight} erro={erro} />
            )}

            {!recusaDeConcluir && !veFinanceiro && (
              <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
                Concluir aqui encerra o atendimento e deixa a cobrança para quem responde pelo
                financeiro. Você não decide valor nesta tela.
              </span>
            )}

            {/* E a caixa de baixo NÃO REPETE o conflito: quando
                `classe === "conflito"` a frase já está dentro do painel, com as
                duas saídas ao lado. Aqui ela cobre o resto (a recusa do
                lançamento, o erro de `concluir`). */}
            {erro && classe !== "conflito" && (
              <div style={{
                padding: "11px 13px", borderRadius: 12,
                background: isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)",
                border: `1px solid ${corErro}44`,
                fontFamily: FONT, fontSize: 12, color: corErro, lineHeight: 1.5,
              }}>
                {erro.frase}
              </div>
            )}

            {/* 4) OS BOTÕES. "Conferir depois" existe SEMPRE que dá para
                   concluir: concluir não é decidir, e obrigar a decidir seria
                   pôr uma escolha financeira na frente de quem só quer fechar
                   o atendimento. */}
            {!recusaDeConcluir && (
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                {veFinanceiro && !jaDecidido && temLancamento !== true && !temAnalise && (
                  <>
                    <button
                      disabled={!!erroLocal || concluir.isPending || afirmar.isPending}
                      onClick={() => { void disparar("lancar", {
                        descricao: descricao.trim(),
                        valorTotal: candidato.valorTotal,
                        parcelas: previa,
                      }); }}
                      style={{
                        ...btnSec, border: "none", background: GOLD_GRAD, color: "#08090E",
                        fontWeight: 700, opacity: erroLocal || concluir.isPending ? 0.5 : 1,
                        cursor: erroLocal || concluir.isPending ? "not-allowed" : "pointer",
                      }}
                    >
                      <CheckCircle2 size={15} /> Concluir e lançar
                    </button>
                    <button
                      disabled={concluir.isPending || afirmar.isPending}
                      onClick={() => { void disparar("nada_a_cobrar"); }}
                      style={btnSec}
                    >
                      Nada a cobrar
                    </button>
                  </>
                )}
                <button
                  disabled={concluir.isPending || afirmar.isPending}
                  onClick={() => { void disparar("conferir_depois"); }}
                  style={btnSec}
                >
                  {concluir.isPending ? "Concluindo…" : conf.rotulo("Concluir · conferir depois")}
                </button>
              </div>
            )}

            <button
              onClick={() => aoAbrirChamado(chamadoId)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                alignSelf: "flex-start",
                color: textSecondary, fontFamily: FONT, fontSize: 11.5, textDecoration: "underline",
              }}
            >
              Abrir o chamado
            </button>
          </>
        )}
      </div>
    </div>
  );
}
