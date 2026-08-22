// Painel Operacional — R27, refeito na anatomia da Início (R67).
//
// A TELA TEM DUAS PARTES, e só duas: em cima o dashboard inteiro, embaixo a
// lista. Foi o pedido do Davi (2026-08-22): "o dashboard todo na parte
// superior da tela, ou seja os campos precisam ser menores... a parte
// restante deve ser visualização dos itens em lista das atividades.
// Inspire-se no layout da página início."
//
// A ESTRUTURA VEM DE docs/DASHBOARD.md — não é releitura livre da Início:
//   · FAIXAS de painéis com ALTURA ÚNICA (§4). É a constante que faz a
//     fileira ler como uma peça só; painel com altura própria transforma a
//     faixa numa colagem. Aqui são duas faixas de 216 (a Início usa 252 —
//     esta tela tem mais painéis e precisa terminar mais cedo, para a lista
//     começar dentro da primeira tela).
//   · Painel = card(isLight) + .elevavel, micro-rótulo no amarelo (§3, §6).
//   · KPIs no PRISMA, gráficos na paleta categórica do §9 do DESIGN_SYSTEM.
//   · Peça clicável = <button aria-pressed> com anel na própria cor (§7.1).
//   · A INVARIANTE (§7.2): o número de um KPI e a lista que ele abre saem da
//     MESMA função pura — `chamadosDoKpi`, em indicadores.ts.
//
// O QUE ENCOLHEU, e por quê. A versão anterior empilhava dez cards de altura
// livre: o dashboard ocupava três telas e a lista nascia fora de qualquer
// dobra — exatamente o que o Davi mandou consertar. Três movimentos deram o
// espaço de volta sem perder indicador:
//   1. Fluxo do mês + Ritmo + Cumprimento de prazo (3 cards) viraram UM
//      painel de seis micro-números com a barra de prazo no pé.
//   2. O card largo "Duplas de campo" sumiu: o botão que cadastra dupla
//      passou a morar no cabeçalho do gráfico que mostra duplas. Botão de
//      manutenção pertence à peça que ele mantém.
//   3. Fila por status perdeu a legenda embaixo do arco e ganhou legenda AO
//      LADO — mesma informação, metade da altura.
//
// A LISTA É A MESMA TABELA DA INÍCIO (features/home/TabelaAtividades), não
// uma parecida. Reescrever aqui uma lista de chamados criaria a segunda
// implementação da mesma tabela — e a segunda fica um passo atrás da
// primeira desde a primeira alteração de coluna. Como ela fala `Atividade`,
// os chamados passam por `atividadeDoChamado()`, o mesmo montador da Início:
// status, cores e rótulos saem de um lugar só.
//
// Só natureza "campo": a proposta comercial (U29) é funil, e as demandas
// internas têm sprint, não SLA — misturá-las faria o tempo de atendimento
// somar relógios diferentes.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useUserCargo, useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza, usePessoas, mapaDePessoas } from "@/features/chamados/data";
import { PainelChamado } from "@/features/chamados/PainelChamado";
import { useApoiosDeTodos } from "@/features/home/data";
import { TabelaAtividades } from "@/features/home/TabelaAtividades";
import { atividadeDoChamado, type Atividade } from "@/features/atividades/modelo";
import { useDuplas } from "@/features/duplas/data";
import { DialogoDuplas } from "@/features/duplas/DialogoDuplas";
import {
  serieAtividadesPorDupla, foraDeDupla, rotuloDaDupla, type SemanaDoGrafico,
} from "@/features/duplas/modelo";
import { chamadoStatusInfo } from "@/lib/chamado-status";
import { referenciaSemanal, inicioSemana } from "@/lib/periodos";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import {
  calcularIndicadores, horasTexto, JANELA_REINCIDENCIA_DIAS,
  chamadosDoKpi, KPI_OPERACIONAL_ORDEM, KPI_OPERACIONAL_LABEL, type ChaveKpiOperacional,
  idadePorFaixa, FAIXA_IDADE_LABEL, ordenarChamados,
} from "@/features/paineis/indicadores";
import { PainelBase, type AtalhoPainel } from "@/features/paineis/PainelBase";

export const Route = createFileRoute("/_authenticated/painel/operacional")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.operacional");
    if (!ok) throw redirect({ to: destinoNegado("painel.operacional") as any });
  },
  component: PainelOperacional,
});

// Os 4 atalhos ("Ir para") SAÍRAM na R58: todos eram itens do menu lateral, e
// o atalho repetia embaixo o que já está sempre visível à esquerda.
const ATALHOS: AtalhoPainel[] = [];

/**
 * A altura única de TODO painel das duas faixas (DASHBOARD.md §4).
 *
 * 216 e não os 252 da Início: lá são quatro painéis numa faixa só; aqui são
 * sete em duas. 2×216 + gap = 446px de dashboard — cabe na primeira tela de
 * um notebook com a lista já começando, que é o ponto do pedido.
 */
const ALTURA = 216;

/** Quantas semanas o gráfico de atividades por dupla mostra. */
const SEMANAS_NO_GRAFICO = 12;

/** Quantas barras cabem nos painéis de ranking sem espremer o rótulo. */
const TETO_BARRAS = 5;

/** Teto da tabela — o mesmo da Início. */
const TETO_TABELA = 200;

// Paleta categórica validada (DESIGN_SYSTEM.md §9) — ordem fixa, nunca ciclada
const CORES_DARK = ["#3987e5", "#008300", "#d55181", "#E2791D", "#199e70", "#d95926", "#9085e9", "#e66767"];
const CORES_LIGHT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];
const OUTROS_DARK = "#6b7280";
const OUTROS_LIGHT = "#9ca3af";

function PainelOperacional() {
  const navigate = useNavigate();
  const { data: cargo } = useUserCargo();
  const { data: chamados = [] } = useChamadosPorNatureza("campo");
  const { data: tecnicos = [] } = useTecnicos();
  const { data: duplas = [] } = useDuplas();
  const { data: pessoas = [] } = usePessoas();
  const { data: apoiosDoChamado } = useApoiosDeTodos();
  const { isLight } = useTheme();
  const [duplasAberto, setDuplasAberto] = useState(false);
  const [painelId, setPainelId] = useState<string | null>(null);
  // qual quadrado de KPI está filtrando a lista agora — null = nenhum, e a
  // lista mostra o padrão operacional (tudo em aberto)
  const [kpiAtivo, setKpiAtivo] = useState<ChaveKpiOperacional | null>(null);

  // nomes para a reincidência — só id/nome, a base tem ~200 linhas
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-nomes"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome");
      return (data as { id: string; nome: string }[]) ?? [];
    },
  });

  // um momento só para todas as contas do render — KPIs, indicadores,
  // histograma e ordenação da lista precisam concordar sobre "agora", ou um
  // chamado no limite do prazo poderia contar diferente em duas peças da
  // mesma tela
  const agora = useMemo(() => new Date(), [chamados]);
  const ind = useMemo(() => calcularIndicadores(chamados as any[], agora), [chamados, agora]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  const azul = isLight ? PRISMA.azul.light : PRISMA.azul.dark;
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  const superficie = isLight ? "#ffffff" : "#101016";
  const cores = isLight ? CORES_LIGHT : CORES_DARK;
  const neutro = isLight ? OUTROS_LIGHT : OUTROS_DARK;

  // O PAINEL da faixa: card + altura única + padding compacto. Todo painel
  // das duas fileiras passa por aqui — é o que garante o §4.
  const PAINEL: CSSProperties = {
    ...card(isLight), borderRadius: 16, height: ALTURA,
    padding: "12px 14px 10px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", minWidth: 0,
  };
  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
    whiteSpace: "nowrap",
  };
  const tooltipStyle: CSSProperties = {
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10, fontFamily: FONT, fontSize: 12, color: textPrimary,
  };
  const eixo = { fill: textSecondary, fontSize: 10, fontFamily: FONT };
  const grade = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";

  const nomeTecnico = useMemo(
    () => new Map((tecnicos as any[]).map((t) => [t.id, t.nome as string])),
    [tecnicos],
  );
  const nomeCliente = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nome])),
    [clientes],
  );
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

  // ── Os 4 KPIs, em 2×2 ─────────────────────────────────────────────────────
  // O NÚMERO de cada quadrado e a LISTA que o clique nele abre saem da mesma
  // função (chamadosDoKpi) — não há como um quadrado dizer "5" e a tabela
  // abaixo mostrar 4.
  const kpis = useMemo(() => {
    const corDe = (par: { dark: string; light: string }) => (isLight ? par.light : par.dark);
    const CORES_KPI: Record<ChaveKpiOperacional, { dark: string; light: string }> = {
      abertos: PRISMA.azul, sem_responsavel: PRISMA.amarelo,
      urgentes: PRISMA.laranja, atrasados: PRISMA.vermelho,
    };
    return KPI_OPERACIONAL_ORDEM.map((chave) => ({
      chave,
      rotulo: KPI_OPERACIONAL_LABEL[chave],
      cor: corDe(CORES_KPI[chave]),
      valor: chamadosDoKpi(chave, chamados, agora).length,
    }));
  }, [chamados, agora, isLight]);

  const cargaComNome = useMemo(
    () => ind.cargaPorPessoa.map((c) => ({
      nome: c.pessoaId ? nomeTecnico.get(c.pessoaId) ?? "Técnico" : "Sem técnico",
      valor: c.total,
    })),
    [ind, nomeTecnico],
  );

  const filaComRotulo = useMemo(
    () => ind.porStatus.map((f) => ({ nome: chamadoStatusInfo(f.status).label, valor: f.total })),
    [ind],
  );

  const backlogDados = useMemo(
    () => idadePorFaixa(chamados as any[], agora)
      .map((f) => ({ nome: FAIXA_IDADE_LABEL[f.faixa], valor: f.total })),
    [chamados, agora],
  );
  const CORES_BACKLOG = [verde, gold, laranja, vermelho];

  const reincidenciaComNome = useMemo(
    () => ind.reincidencia.map((r) => ({ nome: nomeCliente.get(r.clienteId) ?? "Cliente", valor: r.vezes })),
    [ind, nomeCliente],
  );

  // ── Atividades por dupla ao longo do tempo (R58) ─────────────────────────
  const duplasAtivas = useMemo(() => duplas.filter((d) => d.ativa), [duplas]);

  const semanas = useMemo<SemanaDoGrafico[]>(() => {
    const segundaDestaSemana = inicioSemana(new Date());
    return Array.from({ length: SEMANAS_NO_GRAFICO }, (_, i) => {
      const d = new Date(segundaDestaSemana);
      d.setDate(d.getDate() - (SEMANAS_NO_GRAFICO - 1 - i) * 7);
      return {
        chave: referenciaSemanal(d),
        // o rótulo é a segunda-feira da semana: "11/08" lê como "a semana do
        // dia 11", que é como quem programa fala do período
        rotulo: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      };
    });
  }, []);

  const serieDuplas = useMemo(
    () => serieAtividadesPorDupla(chamados as any[], duplasAtivas, semanas, referenciaSemanal),
    [chamados, duplasAtivas, semanas],
  );
  const semDuplaNaJanela = useMemo(
    () => foraDeDupla(chamados as any[], duplasAtivas, semanas, referenciaSemanal),
    [chamados, duplasAtivas, semanas],
  );
  const nomeDeTecnico = (id: string) => nomeTecnico.get(id) ?? "Técnico";

  // ── A lista ───────────────────────────────────────────────────────────────
  // Padrão: tudo em aberto (o foco operacional desta tela — histórico fechado
  // é o Painel de chamados). Um KPI ativo ESTREITA dentro desse conjunto, já
  // que os quatro são subconjuntos de "abertos" por construção: nunca há um
  // clique que AMPLIE a lista para fora do que a tela já mostra.
  const listaChamados = useMemo(
    () => ordenarChamados(chamadosDoKpi(kpiAtivo ?? "abertos", chamados, agora), agora),
    [kpiAtivo, chamados, agora],
  );

  // A tabela da Início fala `Atividade` — os chamados passam pelo MESMO
  // montador dela (atividadeDoChamado). `apoios`/`fichas` vazios: esta tela
  // não tem noção de "eu" (souResponsavel/souApoio não são usados aqui) e
  // chamado de campo nunca é pedido de compra, que é o que a ficha decide.
  const atividades = useMemo<Atividade[]>(() => {
    const ctx = { userId: null, apoios: new Set<string>(), fichas: new Map(), apoiosDoChamado };
    return listaChamados.map((c) => atividadeDoChamado(c as any, ctx));
  }, [listaChamados, apoiosDoChamado]);

  const semDados = ind.abertos === 0 && ind.entradasMes === 0 && ind.saidasMes === 0;

  // ── peças reutilizadas ────────────────────────────────────────────────────

  /** Cabeçalho de painel: micro-rótulo à esquerda, nota/ação à direita. */
  const Cabeca = ({ titulo, direita }: { titulo: string; direita?: ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, minHeight: 16 }}>
      <span style={MICRO}>{titulo}</span>
      {direita && <span style={{ marginLeft: "auto", minWidth: 0 }}>{direita}</span>}
    </div>
  );

  /** Micro-número do painel de fluxo/ritmo. */
  const Micro = ({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: FONT, fontWeight: 700, fontSize: 19, color: cor,
        fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
      }}>
        {valor}
      </div>
      <div style={{
        fontFamily: FONT, fontWeight: 500, fontSize: 8.5, letterSpacing: "0.05em",
        textTransform: "uppercase", color: textSecondary, marginTop: 3, lineHeight: 1.25,
      }}>
        {rotulo}
      </div>
    </div>
  );

  /** Painel de ranking (barra horizontal) — carga por técnico e reincidência. */
  const Ranking = ({ titulo, dados, corDe, sufixo, vazio }: {
    titulo: string;
    dados: { nome: string; valor: number }[];
    corDe: (nome: string, i: number) => string;
    sufixo: string;
    vazio: ReactNode;
  }) => (
    <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 244 }}>
      <Cabeca
        titulo={titulo}
        direita={dados.length > TETO_BARRAS ? (
          <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary }}>
            top {TETO_BARRAS} de {dados.length}
          </span>
        ) : undefined}
      />
      {dados.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontSize: 11.5, lineHeight: 1.45 }}>
          {vazio}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.slice(0, TETO_BARRAS)} layout="vertical" margin={{ left: 0, right: 14, top: 2, bottom: 2 }}>
              <CartesianGrid horizontal={false} stroke={grade} />
              <XAxis type="number" allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" width={96} tick={{ ...eixo, fill: textPrimary }} axisLine={false} tickLine={false} />
              <RTooltip
                formatter={(v: number) => [`${v} ${sufixo}${v === 1 ? "" : "s"}`, ""]}
                contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }}
              />
              <Bar dataKey="valor" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                {dados.slice(0, TETO_BARRAS).map((d, i) => (
                  <Cell key={d.nome} fill={corDe(d.nome, i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return (
    <PainelBase
      titulo="Painel Operacional"
      subtitulo="A operação de campo inteira, de relance: fila, ritmo, carga e o que volta"
      numeros={[]}
      atalhos={ATALHOS}
      isAdmin={cargo === "admin"}
    >
      {/* ══ FAIXA 1 — os números de cabeça e o estado da fila ══════════════ */}
      <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* os 4 KPIs em 2 colunas de 2, clicáveis */}
        <div style={{
          width: 252, flexShrink: 0, height: ALTURA, display: "grid",
          gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, boxSizing: "border-box",
        }}>
          {kpis.map((k) => {
            const selecionado = kpiAtivo === k.chave;
            const base = card(isLight);
            return (
              <button
                key={k.chave}
                onClick={() => setKpiAtivo(selecionado ? null : k.chave)}
                aria-pressed={selecionado}
                title={`${k.valor} — clique para filtrar a lista abaixo`}
                className="elevavel kpi-tile ruido"
                style={{
                  ...base, borderRadius: 16, padding: "8px 10px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  boxSizing: "border-box",
                  border: selecionado ? `1.5px solid ${k.cor}` : base.border,
                  boxShadow: selecionado ? `0 0 0 3px ${k.cor}2E` : base.boxShadow,
                  cursor: "pointer", font: "inherit", textAlign: "center",
                }}
              >
                <div className="kpi-num" style={{
                  fontFamily: FONT, fontWeight: 700, fontSize: 30, color: k.cor,
                  textShadow: `0 0 14px ${k.cor}59`,
                  fontVariantNumeric: "tabular-nums", lineHeight: 1,
                }}>
                  {k.valor}
                </div>
                <div style={{
                  fontFamily: FONT, fontWeight: 500, fontSize: 8.5, letterSpacing: "0.05em",
                  textTransform: "uppercase", color: textSecondary, lineHeight: 1.25,
                }}>
                  {k.rotulo}
                </div>
              </button>
            );
          })}
        </div>

        {/* Fila por status — rosca com a legenda AO LADO (metade da altura da
            legenda embaixo, mesma informação). Identidade nunca só pela cor. */}
        <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 252 }}>
          <Cabeca titulo="Fila por status" />
          {filaComRotulo.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontSize: 11.5, color: verde }}>
              Nenhum chamado em aberto.
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ position: "relative", width: 132, height: "100%", flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filaComRotulo} dataKey="valor" nameKey="nome"
                      innerRadius={40} outerRadius={60}
                      stroke={superficie} strokeWidth={2} isAnimationActive={false}
                    >
                      {filaComRotulo.map((f, i) => (
                        <Cell key={f.nome} fill={cores[i % 8]} />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(v: number, nome: string) => [
                        `${v} · ${ind.abertos > 0 ? Math.round((v / ind.abertos) * 100) : 0}%`,
                        nome,
                      ]}
                      contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", pointerEvents: "none",
                }}>
                  <span style={{
                    fontFamily: FONT, fontWeight: 700, fontSize: 20,
                    fontVariantNumeric: "tabular-nums", color: textPrimary, lineHeight: 1,
                  }}>
                    {ind.abertos}
                  </span>
                  <span style={{ ...MICRO, fontSize: 8, color: textSecondary, marginTop: 2 }}>em aberto</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {filaComRotulo.map((f, i) => (
                  <div key={f.nome} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2.5, flexShrink: 0, background: cores[i % 8] }} />
                    <span style={{
                      flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 11, color: textPrimary,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {f.nome}
                    </span>
                    <span style={{
                      fontFamily: FONT, fontSize: 11, fontWeight: 700, color: gold,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {f.valor}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fluxo e ritmo — os TRÊS cards antigos (fluxo do mês, ritmo,
            cumprimento de prazo) num painel só: seis micro-números e a barra
            de prazo no pé. */}
        <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 258 }}>
          <Cabeca
            titulo="Fluxo e ritmo"
            direita={
              <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary }}>
                mês · medianas
              </span>
            }
          />
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, alignContent: "center" }}>
            <Micro rotulo="Entraram" valor={String(ind.entradasMes)} cor={azul} />
            <Micro rotulo="Concluídos" valor={String(ind.saidasMes)} cor={verde} />
            {/* saldo positivo = a fila cresceu: é o número quente do painel */}
            <Micro
              rotulo="Saldo da fila"
              valor={ind.saldoMes > 0 ? `+${ind.saldoMes}` : String(ind.saldoMes)}
              cor={ind.saldoMes > 0 ? vermelho : verde}
            />
            <Micro rotulo="Até começar" valor={horasTexto(ind.horasAteComecar)} cor={gold} />
            <Micro rotulo="Executando" valor={horasTexto(ind.horasDeExecucao)} cor={azul} />
            {/* só entre os que TINHAM prazo — o módulo não deixa o número se
                elogiar sozinho */}
            <Micro
              rotulo="No prazo"
              valor={ind.pctNoPrazo === null ? "—" : `${ind.pctNoPrazo}%`}
              cor={ind.pctNoPrazo === null ? textSecondary
                : ind.pctNoPrazo >= 80 ? verde : ind.pctNoPrazo >= 50 ? gold : vermelho}
            />
          </div>
          {ind.pctNoPrazo !== null && (
            <div
              title={`${ind.pctNoPrazo}% dos chamados concluídos que tinham prazo terminaram dentro dele`}
              style={{
                height: 6, borderRadius: 3, marginTop: 8, overflow: "hidden", flexShrink: 0,
                background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)",
              }}
            >
              <div style={{
                width: `${ind.pctNoPrazo}%`, height: "100%",
                background: ind.pctNoPrazo >= 80
                  ? "linear-gradient(90deg,#2DD2A5,#047862)"
                  : ind.pctNoPrazo >= 50
                    ? "linear-gradient(90deg,#FCDE48,#E8B00A)"
                    : "linear-gradient(90deg,#F17881,#B1242E)",
              }} />
            </div>
          )}
        </div>

        {/* Backlog por idade — o histograma. Duas filas com a mesma mediana
            podem ter formas opostas (uma cauda de 3 muito velhos, ou 20
            parados há 20 dias); só a distribuição distingue os dois casos. */}
        <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 236 }}>
          <Cabeca
            titulo="Backlog por idade"
            direita={ind.idadeMaisVelho !== null ? (
              <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, whiteSpace: "nowrap" }}>
                mais antigo{" "}
                <strong style={{ color: ind.idadeMaisVelho > 30 ? vermelho : textPrimary, fontWeight: 700 }}>
                  {ind.idadeMaisVelho}d
                </strong>
              </span>
            ) : undefined}
          />
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backlogDados} layout="vertical" margin={{ left: 0, right: 14, top: 2, bottom: 2 }}>
                <CartesianGrid horizontal={false} stroke={grade} />
                <XAxis type="number" allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nome" width={68} tick={{ ...eixo, fill: textPrimary }} axisLine={false} tickLine={false} />
                <RTooltip
                  formatter={(v: number) => [`${v} em aberto`, ""]}
                  contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }}
                />
                <Bar dataKey="valor" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                  {backlogDados.map((f, i) => <Cell key={f.nome} fill={CORES_BACKLOG[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══ FAIXA 2 — quem faz, quem carrega, o que volta ══════════════════ */}
      <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Atividades por dupla ao longo do tempo — Davi, 2026-08-22: "cada
            item vertical é uma semana. Deve ser um gráfico de linhas".

            O botão que CADASTRA dupla mora aqui, no cabeçalho do gráfico que
            mostra duplas: era um card largo próprio, e botão de manutenção
            pertence à peça que ele mantém. */}
        <div className="elevavel" style={{ ...PAINEL, flex: 2, minWidth: 396 }}>
          <Cabeca
            titulo={`Atividades por dupla · ${SEMANAS_NO_GRAFICO} semanas`}
            direita={
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {semDuplaNaJanela > 0 && (
                  <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, whiteSpace: "nowrap" }}>
                    {semDuplaNaJanela} fora de dupla
                  </span>
                )}
                <button
                  onClick={() => setDuplasAberto(true)}
                  className="hover-suave"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    height: 26, padding: "0 10px", borderRadius: 13, flexShrink: 0,
                    background: "transparent", cursor: "pointer", color: gold,
                    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                    fontFamily: FONT, fontWeight: 600, fontSize: 11,
                  }}
                >
                  <Users size={12} />
                  Duplas
                </button>
              </span>
            }
          />
          {duplasAtivas.length === 0 ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              textAlign: "center", fontFamily: FONT, fontSize: 11.5, color: textSecondary,
              lineHeight: 1.5, padding: "0 20px",
            }}>
              Nenhuma dupla cadastrada — cadastre em <strong style={{ color: gold, fontWeight: 600 }}>Duplas</strong>{" "}
              para ver quem sai com quem ao longo das semanas.
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serieDuplas} margin={{ left: 0, right: 10, top: 2, bottom: 0 }}>
                  <CartesianGrid stroke={grade} />
                  <XAxis dataKey="semana" tick={eixo} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={24} />
                  <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                  <Legend
                    wrapperStyle={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary }}
                    iconSize={8}
                    formatter={(v: string) => {
                      const d = duplasAtivas.find((x) => x.id === v);
                      return d ? rotuloDaDupla(d, nomeDeTecnico) : v;
                    }}
                  />
                  {duplasAtivas.map((d, i) => (
                    <Line
                      key={d.id}
                      type="monotone"
                      dataKey={d.id}
                      stroke={cores[i % 8]}
                      strokeWidth={2}
                      dot={{ r: 2.5, strokeWidth: 0, fill: cores[i % 8] }}
                      activeDot={{ r: 4.5 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <Ranking
          titulo="Em aberto por técnico"
          dados={cargaComNome}
          corDe={(nome, i) => (nome === "Sem técnico" ? neutro : cores[i % 8])}
          sufixo="em aberto"
          vazio={<span style={{ color: textSecondary }}>Nada em aberto atribuído.</span>}
        />

        {/* Reincidência — o mais próximo de "serviço mal feito" que dá para
            medir sem inspeção: o mesmo cliente voltando com corretiva em
            menos de 30 dias */}
        <Ranking
          titulo={`Reincidência · ${JANELA_REINCIDENCIA_DIAS}d`}
          dados={reincidenciaComNome}
          corDe={() => vermelho}
          sufixo="retorno"
          vazio={
            <span style={{ color: verde }}>
              Nenhum cliente voltou com corretiva em menos de {JANELA_REINCIDENCIA_DIAS} dias.
            </span>
          }
        />
      </div>

      {semDados && (
        <div style={{
          ...card(isLight), borderRadius: 16, padding: "14px 16px", textAlign: "center",
          fontFamily: FONT, fontSize: 12.5, color: textSecondary,
        }}>
          Nenhum chamado de campo ainda — os indicadores se preenchem conforme a operação andar.
        </div>
      )}

      {/* ══ A LISTA — o resto da tela ══════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 18, margin: 0,
            color: textPrimary, letterSpacing: "-0.01em",
          }}>
            Chamados técnicos
          </h2>
          <button
            onClick={() => navigate({ to: "/chamados/painel" })}
            style={{
              marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer",
              color: gold, fontFamily: FONT, fontWeight: 600, fontSize: 11.5, padding: 0,
            }}
          >
            Ver todos os chamados →
          </button>
        </div>

        {/* A faixa que anuncia o recorte — o mesmo contrato da Início: a
            lista nunca fica filtrada sem dizer por quê. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, minHeight: 26,
          fontFamily: FONT, fontSize: 12, color: textSecondary,
        }}>
          Mostrando: <strong style={{ color: textPrimary, fontWeight: 600 }}>
            {kpiAtivo ? KPI_OPERACIONAL_LABEL[kpiAtivo] : "Chamados em aberto"}
          </strong>
          {kpiAtivo && (
            <button
              onClick={() => setKpiAtivo(null)}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 600, color: gold,
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              limpar
            </button>
          )}
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            {atividades.length}
          </span>
        </div>

        {atividades.length === 0 ? (
          <div style={{
            ...card(isLight), borderRadius: 16, padding: "28px 16px", textAlign: "center",
            fontFamily: FONT, fontSize: 13, color: textSecondary,
          }}>
            Nenhum chamado {kpiAtivo ? "nesta seleção" : "em aberto"} agora.
          </div>
        ) : (
          <>
            {/* A MESMA tabela da Início (U33/R67) — nove colunas alinhadas,
                cabeçalho que gruda, ordenação por coluna. */}
            <TabelaAtividades
              atividades={atividades.slice(0, TETO_TABELA)}
              pessoas={pessoasPorId}
              aoAbrir={(a) => setPainelId(a.registroId)}
            />
            {atividades.length > TETO_TABELA && (
              <span style={{
                display: "block", marginTop: 2, fontFamily: FONT, fontSize: 12,
                color: textSecondary, textAlign: "center",
              }}>
                Mostrando {TETO_TABELA} de {atividades.length} — use os indicadores acima para estreitar.
              </span>
            )}
          </>
        )}
      </div>

      <DialogoDuplas aberto={duplasAberto} aoFechar={() => setDuplasAberto(false)} />

      <PainelChamado
        chamadoId={painelId}
        aoFechar={() => setPainelId(null)}
        aoAbrirPagina={(id) => { setPainelId(null); navigate({ to: "/chamados/$id", params: { id } }); }}
      />
    </PainelBase>
  );
}
