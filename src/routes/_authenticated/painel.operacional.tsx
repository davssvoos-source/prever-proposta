// Painel Operacional — R27, com os indicadores de campo NA ENTRADA, e agora
// (R66) com a MESMA estrutura documentada em docs/DASHBOARD.md: os 4 KPIs em
// 2×2, os indicadores de campo como GRÁFICOS (não números soltos), tudo isso
// como um dashboard só no topo — e, abaixo dele, a lista dos chamados
// técnicos em si. Antes o painel só apontava números; agora ele também
// entrega o trabalho: clicar num KPI filtra a lista abaixo, a mesma
// garantia "quem conta é quem filtra" que a Início usa (R60/R65) — os 4
// números e a lista saem da MESMA função pura (`chamadosDoKpi`).
//
// O CÁLCULO não mora nesta tela. Ele vive em features/paineis/indicadores.ts,
// puro e coberto por asserção; aqui só se pinta. Os números respondem as
// perguntas de quem coordena (a régua do módulo): a fila cresceu? o que está
// encalhado? demoramos a começar ou a executar? quem está sobrecarregado?
// onde o problema volta?
//
// Só natureza "campo": a proposta comercial (U29) é funil, e as demandas
// internas têm sprint, não SLA — misturá-las faria o tempo de atendimento
// somar relógios diferentes.
//
// Paleta de dataviz conforme DESIGN_SYSTEM.md §9 (ordem fixa, máx. 8 séries,
// "Outros"/"Sem técnico" neutro — identidade nunca só pela cor). Os 4 KPIs
// usam PRISMA, não essa paleta categórica: é a convenção da Início
// (DASHBOARD.md §5) — azul→amarelo→laranja→vermelho é rampa de SEVERIDADE,
// não uma lista de categorias.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useUserCargo, useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza } from "@/features/chamados/data";
import { useDuplas } from "@/features/duplas/data";
import { DialogoDuplas } from "@/features/duplas/DialogoDuplas";
import {
  serieAtividadesPorDupla, foraDeDupla, rotuloDaDupla, type SemanaDoGrafico,
} from "@/features/duplas/modelo";
import { chamadoStatusInfo, situacaoPrazo, textoPrazo } from "@/lib/chamado-status";
import { referenciaSemanal, inicioSemana } from "@/lib/periodos";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
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

// Os 4 atalhos ("Ir para": Calendário, Programação, Painel de chamados,
// Clientes) SAÍRAM a pedido do Davi (2026-08-22, R58). Todos os quatro são
// itens do menu lateral — o atalho repetia, na parte de baixo do painel, o
// que já está sempre visível à esquerda. `PainelBase` esconde a seção
// inteira quando a lista está vazia, então não sobra um título "Ir para" solto.
const ATALHOS: AtalhoPainel[] = [];

/** Quantas semanas o gráfico de atividades por dupla mostra. */
const SEMANAS_NO_GRAFICO = 12;

/** Quantas linhas a lista de chamados técnicos mostra antes de truncar. */
const LIMITE_LISTA = 50;

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
  const { isLight } = useTheme();
  const [duplasAberto, setDuplasAberto] = useState(false);
  // qual quadrado de KPI está filtrando a lista de chamados agora (R66) —
  // null = nenhum, e a lista mostra o padrão operacional (tudo em aberto)
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
  // histograma de idade e ordenação da lista precisam concordar sobre
  // "agora", ou um chamado no limite do prazo poderia contar diferente em
  // duas peças da mesma tela
  const agora = useMemo(() => new Date(), [chamados]);
  const ind = useMemo(() => calcularIndicadores(chamados as any[], agora), [chamados, agora]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const verde = isLight ? "#047862" : "#2DD2A5";
  const vermelho = isLight ? "#B1242E" : "#F17881";
  const azul = isLight ? "#1d4ed8" : "#60A5FA";
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  const superficie = isLight ? "#ffffff" : "#101016";
  const cores = isLight ? CORES_LIGHT : CORES_DARK;
  const neutro = isLight ? OUTROS_LIGHT : OUTROS_DARK;

  const CARD: CSSProperties = { ...card(isLight), borderRadius: 16, padding: 16 };
  const SEC: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const tooltipStyle: CSSProperties = {
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10, fontFamily: FONT, fontSize: 12, color: textPrimary,
  };

  const nomeTecnico = useMemo(
    () => new Map((tecnicos as any[]).map((t) => [t.id, t.nome as string])),
    [tecnicos],
  );
  const nomeCliente = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nome])),
    [clientes],
  );

  // ── Os 4 KPIs, em 2×2 (R66) ───────────────────────────────────────────────
  // O NÚMERO de cada quadrado e a LISTA que o clique nele abre saem da
  // mesma função (chamadosDoKpi, em indicadores.ts) — não há como um
  // quadrado dizer "5" e a lista abaixo mostrar 4.
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

  // Fluxo do mês virou 2 barras (Entraram/Concluídos) em vez de 3 números
  // soltos — o desequilíbrio entre elas é o que salta aos olhos.
  const fluxoDados = useMemo(
    () => [
      { nome: "Entraram", valor: ind.entradasMes },
      { nome: "Concluídos", valor: ind.saidasMes },
    ],
    [ind],
  );

  // Backlog virou histograma por faixa de idade — não é só "quantos passaram
  // de 30 dias", é ONDE a fila está concentrada.
  const backlogDados = useMemo(
    () => idadePorFaixa(chamados as any[], agora).map((f) => ({ nome: FAIXA_IDADE_LABEL[f.faixa], valor: f.total })),
    [chamados, agora],
  );
  const CORES_BACKLOG = [verde, gold, laranja, vermelho];

  // Reincidência virou barra horizontal (como "Em aberto por técnico") em
  // vez de lista — mesmo vocabulário de gráfico, e dá para comparar clientes
  // de relance em vez de ler linha por linha.
  const reincidenciaComNome = useMemo(
    () => ind.reincidencia.map((r) => ({ nome: nomeCliente.get(r.clienteId) ?? "Cliente", valor: r.vezes })),
    [ind, nomeCliente],
  );

  // ── Atividades por dupla ao longo do tempo (R58) ─────────────────────────
  // "cada item vertical é uma semana": as 12 últimas semanas no eixo X, uma
  // LINHA por dupla ativa. A conta é pura (features/duplas/modelo.ts); aqui
  // só se decide a janela e se pinta.
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

  // um par rótulo+valor dentro dos cards de trio
  const Metrica = ({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: cor, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: textSecondary, marginTop: 4, lineHeight: 1.3 }}>
        {rotulo}
      </div>
    </div>
  );

  // uma linha da lista de chamados técnicos (R66) — clicar abre o chamado
  const Linha = ({ c, idx }: { c: (typeof chamados)[number]; idx: number }) => {
    const info = chamadoStatusInfo(c.status);
    const sit = situacaoPrazo(c.prazo_limite, c.status, agora);
    const corSit = sit === "estourado" ? vermelho : sit === "proximo" ? gold : textSecondary;
    return (
      <button
        onClick={() => navigate({ to: "/chamados/$id", params: { id: c.id } })}
        className="hover-suave"
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "10px 6px", background: "transparent", cursor: "pointer",
          border: "none", borderRadius: 8,
          borderTop: idx === 0 ? "none" : isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
          textAlign: "left", font: "inherit", color: "inherit",
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: isLight ? info.colorLight : info.color,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, color: textSecondary, flexShrink: 0 }}>
              {c.numero ?? "—"}
            </span>
            <span style={{
              fontFamily: FONT, fontWeight: 600, fontSize: 13, color: textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {c.titulo}
            </span>
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 11, color: textSecondary, marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {c.cliente?.nome ?? "Cliente não identificado"} · {c.responsavel_id ? nomeTecnico.get(c.responsavel_id) ?? "Técnico" : "Sem técnico"}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 10.5, color: isLight ? info.colorLight : info.color, whiteSpace: "nowrap" }}>
            {info.label}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: corSit, marginTop: 2, whiteSpace: "nowrap" }}>
            {textoPrazo(c.prazo_limite, agora)}
          </div>
        </div>
      </button>
    );
  };

  const semDados = ind.abertos === 0 && ind.entradasMes === 0 && ind.saidasMes === 0;

  // ── A lista de chamados técnicos (R66) ───────────────────────────────────
  // Padrão: tudo em aberto (o foco operacional da tela — histórico fechado
  // é o Painel de chamados). Um KPI ativo ESTREITA dentro desse conjunto,
  // já que os 4 são subconjuntos de "abertos" por construção.
  const listaBase = useMemo(
    () => chamadosDoKpi(kpiAtivo ?? "abertos", chamados, agora),
    [kpiAtivo, chamados, agora],
  );
  const listaOrdenada = useMemo(() => ordenarChamados(listaBase, agora), [listaBase, agora]);
  const listaVisivel = useMemo(() => listaOrdenada.slice(0, LIMITE_LISTA), [listaOrdenada]);

  return (
    <PainelBase
      titulo="Painel Operacional"
      subtitulo="A operação de campo inteira, de relance: fila, ritmo, carga e o que volta"
      numeros={[]}
      atalhos={ATALHOS}
      isAdmin={cargo === "admin"}
    >
      {/* ── O DASHBOARD (R66) ────────────────────────────────────────────
          KPIs em 2×2, duplas ao longo do tempo, e os indicadores de campo
          como gráficos — uma coisa só, no vocabulário de docs/DASHBOARD.md. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {kpis.map((k) => {
          const selecionado = kpiAtivo === k.chave;
          const base = card(isLight);
          return (
            <button
              key={k.chave}
              onClick={() => setKpiAtivo(selecionado ? null : k.chave)}
              aria-pressed={selecionado}
              className="elevavel kpi-tile ruido"
              style={{
                ...base, borderRadius: 16, padding: "16px 14px", minHeight: 110,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                boxSizing: "border-box",
                border: selecionado ? `1.5px solid ${k.cor}` : base.border,
                boxShadow: selecionado ? `0 0 0 3px ${k.cor}2E` : base.boxShadow,
                cursor: "pointer", font: "inherit", textAlign: "center",
              }}
            >
              <div className="kpi-num" style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 34, color: k.cor,
                textShadow: `0 0 14px ${k.cor}59`,
                fontVariantNumeric: "tabular-nums", lineHeight: 1,
              }}>
                {k.valor}
              </div>
              <div style={{
                fontFamily: FONT, fontWeight: 500, fontSize: 9.5, letterSpacing: "0.05em",
                textTransform: "uppercase", color: textSecondary, lineHeight: 1.3, textAlign: "center",
              }}>
                {k.rotulo}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          width: 36, height: 36, borderRadius: 11, flexShrink: 0,
          background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center", color: gold,
        }}>
          <Users size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: textPrimary }}>
            Duplas de campo
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, marginTop: 2 }}>
            {duplasAtivas.length === 0
              ? "Nenhuma dupla cadastrada — cadastre para ver o gráfico por dupla."
              : `${duplasAtivas.length} dupla${duplasAtivas.length === 1 ? "" : "s"} ativa${duplasAtivas.length === 1 ? "" : "s"} · quem sai com quem`}
          </div>
        </div>
        <button
          onClick={() => setDuplasAberto(true)}
          style={{
            height: 40, padding: "0 18px", borderRadius: 20, border: "none", background: GOLD_GRAD,
            color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 12,
            letterSpacing: "0.04em", cursor: "pointer", flexShrink: 0,
            boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
          }}
        >
          Cadastrar duplas
        </button>
      </div>

      <DialogoDuplas aberto={duplasAberto} aoFechar={() => setDuplasAberto(false)} />

      {/* Atividades por dupla ao longo do tempo — Davi, 2026-08-22: "gráfico
          de qntd de atividades por dupla ao longo do tempo (cada item
          vertical é uma semana). Deve ser um gráfico de linhas."

          Só aparece com dupla cadastrada: um gráfico de linhas sem nenhuma
          linha é uma moldura vazia que não explica por que está vazia — o
          card acima é que diz o que fazer. */}
      {duplasAtivas.length > 0 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={SEC}>Atividades por dupla · {SEMANAS_NO_GRAFICO} semanas</span>
            {semDuplaNaJanela > 0 && (
              <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
                {semDuplaNaJanela} atendimento(s) fora de dupla, não somados
              </span>
            )}
          </div>
          <div style={{ width: "100%", height: 260, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieDuplas} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} />
                <XAxis
                  dataKey="semana"
                  tick={{ fill: textSecondary, fontSize: 11, fontFamily: FONT }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: textSecondary, fontSize: 11, fontFamily: FONT }}
                  axisLine={false} tickLine={false} width={28}
                />
                <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                <Legend
                  wrapperStyle={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}
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
                    dot={{ r: 3, strokeWidth: 0, fill: cores[i % 8] }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {semDados ? (
        <div style={{ ...CARD, textAlign: "center", padding: "28px 16px" }}>
          <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
            Nenhum chamado de campo ainda — os indicadores aparecem conforme a operação andar.
          </span>
        </div>
      ) : (
        <>
          {/* fluxo, ritmo, backlog, cumprimento de prazo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {/* A fila cresceu? Entraram × concluídos, e o saldo do mês. */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={SEC}>Fluxo do mês</span>
                <span style={{
                  marginLeft: "auto", fontFamily: FONT, fontWeight: 700, fontSize: 12,
                  color: ind.saldoMes > 0 ? vermelho : verde, fontVariantNumeric: "tabular-nums",
                }}>
                  {ind.saldoMes > 0 ? `+${ind.saldoMes}` : ind.saldoMes} saldo
                </span>
              </div>
              <div style={{ width: "100%", height: 96, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fluxoDados} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: textSecondary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" width={72} tick={{ fill: textPrimary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                    <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                      <Cell fill={azul} />
                      <Cell fill={verde} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demoramos a IR ou a FAZER? Os dois relógios, separados. */}
            <div style={CARD}>
              <span style={SEC}>Ritmo (mediana)</span>
              <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
                <Metrica rotulo="Até começar" valor={horasTexto(ind.horasAteComecar)} cor={gold} />
                <Metrica rotulo="Executando" valor={horasTexto(ind.horasDeExecucao)} cor={azul} />
              </div>
            </div>

            {/* O que está parado, e ONDE — histograma por faixa de idade. */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={SEC}>Backlog por idade</span>
                {ind.idadeMaisVelho !== null && (
                  <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                    mais antigo <strong style={{ color: ind.idadeMaisVelho > 30 ? vermelho : textPrimary }}>{ind.idadeMaisVelho}d</strong>
                  </span>
                )}
              </div>
              <div style={{ width: "100%", height: 152, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={backlogDados} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: textSecondary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" width={78} tick={{ fill: textPrimary, fontSize: 10.5, fontFamily: FONT }} axisLine={false} tickLine={false} />
                    <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                      {backlogDados.map((f, i) => (
                        <Cell key={f.nome} fill={CORES_BACKLOG[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cumprimento de prazo — só entre os que tinham prazo (o módulo
                não deixa o número se elogiar sozinho) */}
            {ind.pctNoPrazo !== null && (
              <div style={CARD}>
                <span style={SEC}>Cumprimento de prazo</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                  <span style={{
                    fontFamily: FONT, fontWeight: 700, fontSize: 26,
                    color: ind.pctNoPrazo >= 80 ? verde : ind.pctNoPrazo >= 50 ? gold : vermelho,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {ind.pctNoPrazo}%
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
                    dos chamados concluídos que tinham prazo terminaram dentro dele
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, marginTop: 12, overflow: "hidden", background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)" }}>
                  <div style={{
                    width: `${ind.pctNoPrazo}%`, height: "100%",
                    background: ind.pctNoPrazo >= 80
                      ? "linear-gradient(90deg,#2DD2A5,#047862)"
                      : ind.pctNoPrazo >= 50
                        ? "linear-gradient(90deg,#FCDE48,#E8B00A)"
                        : "linear-gradient(90deg,#F17881,#B1242E)",
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* fila por status, carga por técnico, reincidência */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {/* Fila por status */}
            {filaComRotulo.length >= 2 && (
              <div style={CARD}>
                <span style={SEC}>Fila por status</span>
                <div style={{ position: "relative", width: "100%", height: 200, marginTop: 6 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={filaComRotulo} dataKey="valor" nameKey="nome"
                        innerRadius={54} outerRadius={84}
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
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: textPrimary }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, fontVariantNumeric: "tabular-nums", color: textPrimary }}>
                      {ind.abertos}
                    </span>
                    <span style={{ ...SEC, fontSize: 9, color: textSecondary }}>em aberto</span>
                  </div>
                </div>
                {/* legenda: identidade nunca só pela cor */}
                <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                  {filaComRotulo.map((f, i) => (
                    <div key={f.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: cores[i % 8] }} />
                      <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12, color: textPrimary }}>{f.nome}</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: gold, fontVariantNumeric: "tabular-nums" }}>
                        {f.valor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Carga por técnico */}
            {cargaComNome.length > 0 && (
              <div style={CARD}>
                <span style={SEC}>Em aberto por técnico</span>
                <div style={{ width: "100%", height: Math.max(140, cargaComNome.length * 42), marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cargaComNome} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: textSecondary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fill: textPrimary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                      <Bar dataKey="valor" name="Em aberto" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                        {cargaComNome.map((t, i) => (
                          <Cell key={t.nome} fill={t.nome === "Sem técnico" ? neutro : cores[i % 8]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Reincidência — o mais próximo de "serviço mal feito" que dá
                para medir sem inspeção: o mesmo cliente voltando com
                corretiva em menos de 30 dias */}
            <div style={CARD}>
              <span style={SEC}>Reincidência ({JANELA_REINCIDENCIA_DIAS} dias)</span>
              {reincidenciaComNome.length === 0 ? (
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: verde, marginTop: 10 }}>
                  Nenhum cliente voltou com corretiva em menos de {JANELA_REINCIDENCIA_DIAS} dias.
                </div>
              ) : (
                <div style={{ width: "100%", height: Math.max(140, Math.min(8, reincidenciaComNome.length) * 36), marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reincidenciaComNome.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: textSecondary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fill: textPrimary, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
                      <RTooltip formatter={(v: number) => [`${v} retorno${v === 1 ? "" : "s"}`, "Retornos"]} contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                      <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill={vermelho} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── CHAMADOS TÉCNICOS (R66, novo) ─────────────────────────────────
          Abaixo do dashboard: a lista em si, não só os números dela. Padrão
          é "em aberto" (o foco operacional); um KPI ativo estreita dentro
          disso, e "Mostrando: …" sempre anuncia o recorte, como na Início. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...SEC, letterSpacing: "0.10em", fontSize: 10.5, color: gold }}>
            Chamados técnicos
          </span>
          <button
            onClick={() => navigate({ to: "/chamados/painel" })}
            style={{
              marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer",
              color: gold, fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
            }}
          >
            Ver todos os chamados →
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 26, fontFamily: FONT, fontSize: 12, color: textSecondary }}>
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
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{listaOrdenada.length}</span>
        </div>

        {listaOrdenada.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: "28px 16px" }}>
            <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
              Nenhum chamado {kpiAtivo ? "nesta seleção" : "em aberto"} agora.
            </span>
          </div>
        ) : (
          <div style={CARD}>
            {listaVisivel.map((c, idx) => <Linha key={c.id} c={c} idx={idx} />)}
            {listaOrdenada.length > LIMITE_LISTA && (
              <span style={{ display: "block", marginTop: 10, fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
                Mostrando {LIMITE_LISTA} de {listaOrdenada.length} — refine pelos indicadores acima ou abra o Painel de chamados.
              </span>
            )}
          </div>
        )}
      </div>
    </PainelBase>
  );
}
