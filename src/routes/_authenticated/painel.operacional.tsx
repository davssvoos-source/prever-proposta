// Painel Operacional — R27, agora com os indicadores de campo NA ENTRADA.
//
// A antiga /chamados/indicadores foi absorvida aqui: um painel que só aponta
// para o dashboard é uma escada para subir um degrau. Quem coordena abre o
// painel e vê a operação — não um atalho para vê-la.
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
// "Outros"/"Sem técnico" neutro — identidade nunca só pela cor).

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { CalendarDays, ClipboardList, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useUserCargo, useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza } from "@/features/chamados/data";
import { chamadoStatusInfo } from "@/lib/chamado-status";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { calcularIndicadores, horasTexto, JANELA_REINCIDENCIA_DIAS } from "@/features/paineis/indicadores";
import { PainelBase, type AtalhoPainel, type NumeroPainel } from "@/features/paineis/PainelBase";

export const Route = createFileRoute("/_authenticated/painel/operacional")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.operacional");
    if (!ok) throw redirect({ to: destinoNegado("painel.operacional") as any });
  },
  component: PainelOperacional,
});

// A lista /chamados morreu (R31 — a Início entrega a fila em kanban e lista),
// e os indicadores agora moram aqui — por isso nenhum atalho aponta para os dois.
const ATALHOS: AtalhoPainel[] = [
  { label: "Calendário", descricao: "Agenda de todos — visitas e chamados com data",
    icon: CalendarDays, para: "/calendario", tela: "calendario" },
  { label: "Programação das duplas", descricao: "Quem sai com quem, e para onde",
    icon: Users, para: "/chamados/programacao", tela: "chamados.programacao" },
  { label: "Painel de chamados", descricao: "Dashboards e a série de manutenções",
    icon: ClipboardList, para: "/chamados/painel", tela: "chamados.painel" },
  { label: "Clientes", descricao: "A base vinda do QAP, com equipamentos por posto",
    icon: Building2, para: "/clientes", tela: "clientes" },
];

// Paleta categórica validada (DESIGN_SYSTEM.md §9) — ordem fixa, nunca ciclada
const CORES_DARK = ["#3987e5", "#008300", "#d55181", "#E2791D", "#199e70", "#d95926", "#9085e9", "#e66767"];
const CORES_LIGHT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];
const OUTROS_DARK = "#6b7280";
const OUTROS_LIGHT = "#9ca3af";

function PainelOperacional() {
  const { data: cargo } = useUserCargo();
  const { data: chamados = [] } = useChamadosPorNatureza("campo");
  const { data: tecnicos = [] } = useTecnicos();
  const { isLight } = useTheme();

  // nomes para a reincidência — só id/nome, a base tem ~200 linhas
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-nomes"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome");
      return (data as { id: string; nome: string }[]) ?? [];
    },
  });

  const ind = useMemo(() => calcularIndicadores(chamados as any[]), [chamados]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const verde = isLight ? "#047862" : "#2DD2A5";
  const vermelho = isLight ? "#B1242E" : "#F17881";
  const azul = isLight ? "#1d4ed8" : "#60A5FA";
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

  // os números de cabeça: a leitura de relance, do frio ao quente
  const numeros = useMemo<NumeroPainel[]>(() => [
    { rotulo: "Chamados em aberto", valor: ind.abertos, tom: 8, para: "/dashboard" },
    { rotulo: "Sem responsável", valor: ind.semResponsavel, tom: 5, para: "/dashboard" },
    { rotulo: "Prazo estourado", valor: ind.atrasados, tom: 0, para: "/dashboard" },
    { rotulo: "Urgentes", valor: ind.urgentes, tom: 2, para: "/dashboard" },
  ], [ind]);

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

  const semDados = ind.abertos === 0 && ind.entradasMes === 0 && ind.saidasMes === 0;

  return (
    <PainelBase
      titulo="Painel Operacional"
      subtitulo="A operação de campo inteira, de relance: fila, ritmo, carga e o que volta"
      numeros={numeros}
      atalhos={ATALHOS}
      isAdmin={cargo === "admin"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ ...SEC, letterSpacing: "0.10em", fontSize: 10.5, color: gold }}>
          Indicadores de campo
        </span>

        {semDados ? (
          <div style={{ ...CARD, textAlign: "center", padding: "28px 16px" }}>
            <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
              Nenhum chamado de campo ainda — os indicadores aparecem conforme a operação andar.
            </span>
          </div>
        ) : (
          <>
            {/* trio de leitura: fluxo, ritmo, backlog */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {/* A fila cresceu? Entradas contra saídas no mês. */}
              <div style={CARD}>
                <span style={SEC}>Fluxo do mês</span>
                <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
                  <Metrica rotulo="Entraram" valor={String(ind.entradasMes)} cor={azul} />
                  <Metrica rotulo="Concluídos" valor={String(ind.saidasMes)} cor={verde} />
                  {/* saldo positivo = a fila cresceu: é o número quente do card */}
                  <Metrica
                    rotulo="Saldo da fila"
                    valor={ind.saldoMes > 0 ? `+${ind.saldoMes}` : String(ind.saldoMes)}
                    cor={ind.saldoMes > 0 ? vermelho : verde}
                  />
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

              {/* O que está parado, e há quanto tempo. */}
              <div style={CARD}>
                <span style={SEC}>Backlog</span>
                <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
                  <Metrica rotulo="Idade típica" valor={ind.idadeMediana === null ? "—" : `${ind.idadeMediana}d`} cor={gold} />
                  <Metrica rotulo="Mais antigo" valor={ind.idadeMaisVelho === null ? "—" : `${ind.idadeMaisVelho}d`} cor={ind.idadeMaisVelho !== null && ind.idadeMaisVelho > 30 ? vermelho : azul} />
                  <Metrica rotulo="Há mais de 30d" valor={String(ind.encalhados)} cor={ind.encalhados > 0 ? vermelho : verde} />
                </div>
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
                {ind.reincidencia.length === 0 ? (
                  <div style={{ fontFamily: FONT, fontSize: 12.5, color: verde, marginTop: 10 }}>
                    Nenhum cliente voltou com corretiva em menos de {JANELA_REINCIDENCIA_DIAS} dias.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                    {ind.reincidencia.slice(0, 8).map((r, i) => (
                      <div
                        key={r.clienteId}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                          borderTop: i === 0 ? "none" : isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 13, fontWeight: 600, color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nomeCliente.get(r.clienteId) ?? "Cliente"}
                        </span>
                        <span style={{ flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 700, color: vermelho, fontVariantNumeric: "tabular-nums" }}>
                          {r.vezes} retorno{r.vezes === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PainelBase>
  );
}
