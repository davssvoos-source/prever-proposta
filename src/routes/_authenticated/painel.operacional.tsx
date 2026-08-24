// Painel Operacional — R27, na anatomia da Início (R67) e no degradê dela (R68).
//
// A TELA TEM DUAS PARTES, e só duas: o dashboard em cima, a lista no resto.
// Não há título nem subtítulo (R68) — o nome da tela já está aceso no menu à
// esquerda, e repeti-lo custava a faixa vertical que faz a lista começar
// dentro da primeira metade da tela, que é o contrato desta página.
//
// A ESTRUTURA VEM DE docs/DASHBOARD.md:
//   · FAIXAS de painéis com ALTURA ÚNICA (§4) — a constante que faz a
//     fileira ler como uma peça só. Duas faixas de 168: 350px de dashboard,
//     e a lista abre acima da metade da tela.
//   · Painel = card(isLight) + .elevavel, micro-rótulo no amarelo (§3, §6).
//   · KPIs no PRISMA; TODO O RESTO no ESPECTRO (§5).
//   · Peça clicável = <button aria-pressed> com anel na própria cor (§7.1).
//   · A INVARIANTE (§7.2): o número de um KPI e a lista que ele abre saem da
//     MESMA função pura — `chamadosDoKpi`, em indicadores.ts.
//
// O DEGRADÊ É O MESMO DA INÍCIO, agora também aqui (R68, pedido do Davi:
// "quero ver o degradê igualzinho o do início em tudo"). Lá as barras são
// <div> com `gradienteBarra()` em CSS e a rosca é SVG à mão; aqui tudo passa
// pelo recharts, que pinta em SVG — `linear-gradient()` de CSS não vale em
// `fill`. Daí `paradasBarra()` (paleta.ts): a irmã SVG de `gradienteBarra`,
// com a MESMA regra da costura — o par que cruza a emenda da rampa ganha a
// parada acromática no meio, senão o miolo da peça fica verde.
//
// A REGRA DA RAMPA, igual à da Início: a peça i vai de ESPECTRO[i] a
// ESPECTRO[i+1]. O pé direito de uma emenda no pé esquerdo da próxima, e a
// série inteira — barras, fatias da rosca, linhas — lê como um degradê só.
// Máximo de 8 peças (§9 do DESIGN_SYSTEM); "Sem técnico"/"Sem cliente"
// continuam NEUTROS, fora da rampa: são ausência de identidade, não mais uma
// identidade.
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
import { Users, LayoutGrid, List } from "lucide-react";
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
import { chamadoStatusInfo, textoPrazo } from "@/lib/chamado-status";
import { referenciaSemanal, inicioSemana } from "@/lib/periodos";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import {
  PRISMA, paradasBarra, gradienteBarra, espectro, espectroTexto, PECAS_ESPECTRO,
  GRAD_PRIMARIA, SOBRE_PRIMARIA,
} from "@/lib/paleta";
import {
  calcularIndicadores, horasTexto,
  chamadosDoKpi, KPI_OPERACIONAL_ORDEM, KPI_OPERACIONAL_LABEL, type ChaveKpiOperacional,
  abertosPorCliente, ordenarChamados, ordenarHistorico,
  chamadosDaLente, LENTE_ORDEM, LENTE_LABEL, type LenteLista,
  agruparPorColuna, COLUNA_OP_ORDEM, COLUNA_OP_LABEL, type ColunaOperacional,
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
 * 168 e não os 252 da Início: lá são quatro painéis numa faixa só. Aqui são
 * seis em duas, e o contrato desta tela (R68) é a LISTA COMEÇAR NO MÁXIMO NA
 * METADE DA TELA. A conta que fixou o número, e que o verificador refaz:
 * 2×168 + 14 de gap + 6 de respiro + os 24 de `--topo` = 380px — o cabeçalho
 * da lista abre aí, acima da metade (384) mesmo num notebook de 768px de
 * viewport. Mexer nesta constante para cima quebra a asserção CRÍTICO.
 */
const ALTURA = 168;

/** O gap entre painéis e entre as faixas (DASHBOARD.md §6). */
const GAP = 14;

/**
 * A altura de um painel que ocupa AS DUAS FAIXAS — o "Abertos por cliente".
 *
 * Derivada, nunca digitada: ele precisa terminar exatamente onde a segunda
 * faixa termina, e um 350 solto aqui se descolaria de `ALTURA`/`GAP` na
 * primeira vez que um dos dois mudasse. Travado por asserção.
 */
const ALTURA_DUPLA = ALTURA * 2 + GAP;

/** Quantas semanas o gráfico de atividades por dupla mostra. */
const SEMANAS_NO_GRAFICO = 12;

/** Quantas barras cabem num ranking de uma faixa sem espremer o rótulo. */
const TETO_BARRAS = 5;

/** …e num de duas faixas, que tem o dobro de altura para gastar. */
const TETO_BARRAS_ALTO = 12;

/** Teto da tabela — o mesmo da Início. */
const TETO_TABELA = 200;

/**
 * Os `<linearGradient>` de uma série pintada na rampa: um por peça, i → i+1.
 *
 * DEVOLVE OS GRADIENTES, NÃO O `<defs>` — e isso não é estilo, é
 * obrigatório. Recharts filtra os filhos do gráfico por
 * `isString(child.type)` (`isSvgElement`, em util/ReactUtils): só passa
 * elemento SVG LITERAL. Um componente próprio que devolvesse `<defs>` tem
 * `type` de função, é descartado em silêncio, e todo `url(#id)` da tela
 * resolve para nada — barra sem preenchimento, rosca sem anel, linha sem
 * traço. Foi exatamente o bug da primeira versão da R68. Por isso o `<defs>`
 * é escrito à mão em cada gráfico e só o MIOLO dele vem daqui.
 *
 * O `id` precisa ser único NA PÁGINA — daí o prefixo por gráfico: dois
 * `<defs>` com o mesmo id fariam o segundo gráfico herdar silenciosamente as
 * cores do primeiro.
 *
 * `userSpace` existe por causa da LINHA. Com o padrão `objectBoundingBox`, a
 * caixa de uma linha toda no zero tem ALTURA ZERO — e o SVG manda não
 * desenhar quem tem caixa de área nula, então a linha some justamente na
 * semana em que não houve atendimento. Em `userSpaceOnUse` o degradê é medido
 * na viewport do gráfico, não na caixa da peça, e a linha aparece sempre.
 * Barra e fatia ficam no padrão: elas só têm caixa nula quando valem zero, e
 * aí não há mesmo o que pintar.
 */
function gradientesEspectro(
  prefixo: string, quantas: number, isLight: boolean, userSpace = false,
) {
  return Array.from({ length: Math.min(quantas, PECAS_ESPECTRO) }, (_, i) => (
    // x1→x2 na horizontal: barra deitada cresce no X, e a linha corre no X.
    // Na fatia da rosca a caixa é o arco, e a horizontal é o que mantém a
    // leitura contínua de uma fatia para a vizinha.
    <linearGradient
      key={i}
      id={`${prefixo}-${i}`}
      x1="0" y1="0" x2={userSpace ? "100%" : "1"} y2="0"
      gradientUnits={userSpace ? "userSpaceOnUse" : undefined}
    >
      {paradasBarra(i, isLight).map((p) => (
        <stop key={p.pos} offset={p.pos} stopColor={p.cor} />
      ))}
    </linearGradient>
  ));
}

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
  // lista mostra a lente inteira
  const [kpiAtivo, setKpiAtivo] = useState<ChaveKpiOperacional | null>(null);
  // R73: a lente da lista. "Em aberto" é o padrão (esta é a tela de quem
  // coordena o dia); "Concluídos" e "Todos" existem porque o histórico —
  // as 227 OS retroativas, por exemplo — não tinha onde ser visto.
  const [lente, setLente] = useState<LenteLista>("abertos");
  // R76: lista ou quadro. O quadro mostra as quatro colunas de uma vez —
  // inclusive Concluídos —, então lente e KPI não valem nele: os dois
  // recortam para subconjuntos de "em aberto" e esvaziariam colunas.
  const [visao, setVisao] = useState<"lista" | "kanban">("lista");

  // nomes dos clientes para o gráfico por cliente — só id/nome
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-nomes"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome");
      return (data as { id: string; nome: string }[]) ?? [];
    },
  });

  // um momento só para todas as contas do render — KPIs, indicadores e
  // ordenação da lista precisam concordar sobre "agora", ou um chamado no
  // limite do prazo poderia contar diferente em duas peças da mesma tela
  const agora = useMemo(() => new Date(), [chamados]);
  const ind = useMemo(() => calcularIndicadores(chamados as any[], agora), [chamados, agora]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  const azul = isLight ? PRISMA.azul.light : PRISMA.azul.dark;
  const superficie = isLight ? "#ffffff" : "#101016";
  const neutro = isLight ? PRISMA.neutro.light : PRISMA.neutro.dark;
  // As cores das colunas do quadro (R76) seguem o vocabulário de ESTADO do
  // sistema (lib/chamado-status): azul = ainda não começou, amarelo = está
  // em curso, vermelho = atraso, verde = terminado. Não é a rampa do
  // ESPECTRO de propósito — coluna é estado, não série de dados.
  const CORES_COLUNA: Record<ColunaOperacional, string> = {
    nao_agendado: isLight ? PRISMA.azul.light : PRISMA.azul.dark,
    agendado:     isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
    atrasado:     isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark,
    concluido:    isLight ? PRISMA.verde.light : PRISMA.verde.dark,
  };

  // O PAINEL da faixa: card + altura única + padding compacto. Todo painel
  // das duas fileiras passa por aqui — é o que garante o §4.
  const PAINEL: CSSProperties = {
    ...card(isLight), borderRadius: 16, height: ALTURA,
    padding: "10px 13px 8px", boxSizing: "border-box",
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
  // abaixo mostrar 4. Os KPIs ficam no PRISMA, não na rampa: azul/amarelo/
  // laranja/vermelho aqui é escala de SEVERIDADE, não série de dados.
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
      semDono: !c.pessoaId,
    })),
    [ind, nomeTecnico],
  );

  // R68 — no lugar de "Backlog por idade" e "Reincidência 30d". O Map de
  // `abertosPorCliente` só tem chave de cliente que apareceu: quem não tem
  // chamado aberto simplesmente não entra na lista.
  const clientesComAberto = useMemo(
    () => abertosPorCliente(chamados).map((c) => ({
      nome: c.clienteId ? nomeCliente.get(c.clienteId) ?? "Cliente" : "Sem cliente",
      valor: c.total,
      semDono: !c.clienteId,
    })),
    [chamados, nomeCliente],
  );

  const filaComRotulo = useMemo(
    () => ind.porStatus.map((f) => ({ nome: chamadoStatusInfo(f.status).label, valor: f.total })),
    [ind],
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
  // A LENTE manda; um KPI ativo estreita dentro de "em aberto" (os quatro são
  // subconjuntos dele por construção). Ordem: em aberto por urgência de
  // prazo; histórico pelo mais recente — encerrado não tem urgência, e os
  // importados nem prazo têm, então empatariam todos.
  const listaChamados = useMemo(() => {
    if (kpiAtivo) return ordenarChamados(chamadosDoKpi(kpiAtivo, chamados, agora), agora);
    const daLente = chamadosDaLente(lente, chamados, agora);
    return lente === "abertos" ? ordenarChamados(daLente, agora) : ordenarHistorico(daLente);
  }, [kpiAtivo, lente, chamados, agora]);

  /** As contagens dos chips saem da MESMA função que a lista usa. */
  const contagemLente = useMemo(
    () => Object.fromEntries(
      LENTE_ORDEM.map((l) => [l, chamadosDaLente(l, chamados, agora).length]),
    ) as Record<LenteLista, number>,
    [chamados, agora],
  );

  // A tabela da Início fala `Atividade` — os chamados passam pelo MESMO
  // montador dela. `apoios`/`fichas` vazios: esta tela não tem noção de "eu"
  // (souResponsavel/souApoio não são lidos aqui) e chamado de campo nunca é
  // pedido de compra, que é o que a ficha decide.
  const atividades = useMemo<Atividade[]>(() => {
    const ctx = { userId: null, apoios: new Set<string>(), fichas: new Map(), apoiosDoChamado };
    return listaChamados.map((c) => atividadeDoChamado(c as any, ctx));
  }, [listaChamados, apoiosDoChamado]);

  /** As quatro colunas do quadro (R76) — cancelado fica de fora. */
  const quadro = useMemo(() => agruparPorColuna(chamados as any[], agora), [chamados, agora]);

  const semDados = ind.abertos === 0 && ind.entradasMes === 0 && ind.saidasMes === 0;

  // ── peças reutilizadas ────────────────────────────────────────────────────

  /** Cabeçalho de painel: micro-rótulo à esquerda, nota/ação à direita. */
  const Cabeca = ({ titulo, direita }: { titulo: string; direita?: ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, minHeight: 15 }}>
      <span style={MICRO}>{titulo}</span>
      {direita && <span style={{ marginLeft: "auto", minWidth: 0 }}>{direita}</span>}
    </div>
  );

  /** Micro-número do painel de fluxo/ritmo. */
  const Micro = ({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: FONT, fontWeight: 700, fontSize: 17, color: cor,
        fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
      }}>
        {valor}
      </div>
      <div style={{
        fontFamily: FONT, fontWeight: 500, fontSize: 8, letterSpacing: "0.05em",
        textTransform: "uppercase", color: textSecondary, marginTop: 2, lineHeight: 1.2,
      }}>
        {rotulo}
      </div>
    </div>
  );

  /**
   * Painel de ranking: barras DEITADAS na rampa — carga por técnico e
   * chamados abertos por cliente.
   *
   * `semDono` (sem técnico / sem cliente) pinta NEUTRO e fica fora da rampa:
   * é ausência de identidade, não mais uma identidade. É a mesma regra do
   * "Outros" no §9 do DESIGN_SYSTEM.
   */
  const Ranking = ({ titulo, prefixo, dados, sufixo, vazio, altura = ALTURA, teto = TETO_BARRAS, estilo }: {
    titulo: string;
    prefixo: string;
    dados: { nome: string; valor: number; semDono?: boolean }[];
    sufixo: string;
    vazio: ReactNode;
    /** ALTURA (uma faixa) ou ALTURA_DUPLA (as duas). */
    altura?: number;
    teto?: number;
    estilo?: CSSProperties;
  }) => {
    const visiveis = dados.slice(0, teto);
    return (
      <div className="elevavel" style={{ ...PAINEL, height: altura, flex: 1, minWidth: 244, ...estilo }}>
        <Cabeca
          titulo={titulo}
          direita={dados.length > teto ? (
            <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, whiteSpace: "nowrap" }}>
              top {teto} de {dados.length}
            </span>
          ) : undefined}
        />
        {visiveis.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontSize: 11.5, lineHeight: 1.45 }}>
            {vazio}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visiveis} layout="vertical" margin={{ left: 0, right: 14, top: 2, bottom: 2 }}>
                <defs>{gradientesEspectro(prefixo, visiveis.length, isLight)}</defs>
                <CartesianGrid horizontal={false} stroke={grade} />
                <XAxis type="number" allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
                {/* interval={0}: sem isso o recharts ESCONDE rótulo de
                    categoria quando o painel é baixo — um ranking que omite
                    nome em silêncio mente sobre quem está na lista */}
                <YAxis
                  type="category" dataKey="nome" width={96} interval={0}
                  tick={{ ...eixo, fill: textPrimary }} axisLine={false} tickLine={false}
                />
                <RTooltip
                  cursor={{ fill: grade }}
                  formatter={(v: number) => [`${v} ${sufixo}${v === 1 ? "" : "s"}`, ""]}
                  contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }}
                />
                <Bar dataKey="valor" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                  {visiveis.map((d, i) => (
                    <Cell key={d.nome} fill={d.semDono ? neutro : `url(#${prefixo}-${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <PainelBase numeros={[]} atalhos={ATALHOS} isAdmin={cargo === "admin"}>
      {/* ══ O DASHBOARD ═══════════════════════════════════════════════════
          Duas colunas: à esquerda as duas faixas empilhadas, à direita o
          "Abertos por cliente" ocupando AS DUAS (R69). O painel alto é o que
          mais ganha com altura — cada cliente é uma barra, e com o dobro do
          espaço ele passa de 5 para 12 sem espremer nome.

          A coluna esquerda tem base 700px: é o mínimo em que a faixa 1
          (KPIs 244 + fila 210 + fluxo 216 + gaps) cabe numa linha só. Abaixo
          disso o painel da direita quebra para baixo — e é ele que quebra,
          não as faixas, porque quebrar as faixas descolaria as alturas. */}
      <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ flex: "4 1 700px", minWidth: 0, display: "flex", flexDirection: "column", gap: GAP }}>

        {/* ══ FAIXA 1 — os números de cabeça e o estado da fila ══════════════ */}
        <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* os 4 KPIs em 2 colunas de 2, clicáveis */}
          <div style={{
            width: 244, flexShrink: 0, height: ALTURA, display: "grid",
            gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, boxSizing: "border-box",
          }}>
            {kpis.map((k) => {
              const selecionado = kpiAtivo === k.chave;
              const base = card(isLight);
              return (
                <button
                  key={k.chave}
                  onClick={() => {
                    // os 4 KPIs contam só o que está EM ABERTO: clicar num
                    // deles com a lente no histórico abriria uma lista que
                    // não corresponde ao número tocado. A lente volta junto.
                    setLente("abertos");
                    setVisao("lista");   // KPI é drill-down de LISTA
                    setKpiAtivo(selecionado ? null : k.chave);
                  }}
                  aria-pressed={selecionado}
                  title={`${k.valor} — clique para filtrar a lista abaixo`}
                  className="elevavel kpi-tile ruido"
                  style={{
                    ...base, borderRadius: 14, padding: "6px 8px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 3,
                    boxSizing: "border-box",
                    border: selecionado ? `1.5px solid ${k.cor}` : base.border,
                    boxShadow: selecionado ? `0 0 0 3px ${k.cor}2E` : base.boxShadow,
                    cursor: "pointer", font: "inherit", textAlign: "center",
                  }}
                >
                  <div className="kpi-num" style={{
                    fontFamily: FONT, fontWeight: 700, fontSize: 26, color: k.cor,
                    textShadow: `0 0 14px ${k.cor}59`,
                    fontVariantNumeric: "tabular-nums", lineHeight: 1,
                  }}>
                    {k.valor}
                  </div>
                  <div style={{
                    fontFamily: FONT, fontWeight: 500, fontSize: 8, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: textSecondary, lineHeight: 1.2,
                  }}>
                    {k.rotulo}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fila por status — a rosca na RAMPA: cada fatia vai da sua cor à da
              seguinte, então o anel inteiro lê como o degradê da casa, igual às
              barras da Início. Legenda ao lado (metade da altura da legenda
              embaixo) — e o quadradinho dela carrega o MESMO degradê da fatia,
              em CSS, senão a legenda apontaria para uma cor que não existe no
              gráfico. Identidade nunca só pela cor. */}
          <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 210 }}>
            <Cabeca titulo="Fila por status" />
            {filaComRotulo.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontSize: 11.5, color: verde }}>
                Nenhum chamado em aberto.
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ position: "relative", width: 118, height: "100%", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>{gradientesEspectro("op-fila", filaComRotulo.length, isLight)}</defs>
                      <Pie
                        data={filaComRotulo} dataKey="valor" nameKey="nome"
                        innerRadius={33} outerRadius={51}
                        stroke={superficie} strokeWidth={2} isAnimationActive={false}
                      >
                        {filaComRotulo.map((f, i) => (
                          <Cell key={f.nome} fill={`url(#op-fila-${i % PECAS_ESPECTRO})`} />
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
                      fontFamily: FONT, fontWeight: 700, fontSize: 18,
                      fontVariantNumeric: "tabular-nums", color: textPrimary, lineHeight: 1,
                    }}>
                      {ind.abertos}
                    </span>
                    <span style={{ ...MICRO, fontSize: 7.5, color: textSecondary, marginTop: 2 }}>em aberto</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  {filaComRotulo.map((f, i) => {
                    const passo = i % PECAS_ESPECTRO;
                    return (
                      <div key={f.nome} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          width: 9, height: 9, borderRadius: 2.5, flexShrink: 0,
                          background: gradienteBarra(espectro(passo, isLight), espectro(passo + 1, isLight), isLight),
                        }} />
                        <span style={{
                          flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 10.5, color: textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {f.nome}
                        </span>
                        {/* o número na rampa de TEXTO, não na de preenchimento:
                            o miolo amarelo claro não passa de 4.5:1 sobre branco */}
                        <span style={{
                          fontFamily: FONT, fontSize: 10.5, fontWeight: 700,
                          color: espectroTexto(passo, isLight), fontVariantNumeric: "tabular-nums",
                        }}>
                          {f.valor}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fluxo e ritmo — os TRÊS cards antigos (fluxo do mês, ritmo,
              cumprimento de prazo) num painel só: seis micro-números e a barra
              de prazo no pé. */}
          <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 216 }}>
            <Cabeca
              titulo="Fluxo e ritmo"
              direita={
                <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary }}>
                  mês · medianas
                </span>
              }
            />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, alignContent: "center" }}>
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
                  height: 5, borderRadius: 3, marginTop: 6, overflow: "hidden", flexShrink: 0,
                  background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)",
                }}
              >
                {/* mesma cor e mesmos limiares do Micro "No prazo" logo acima:
                    barra e número falam do mesmo número, então não podem
                    discordar. Sólido do PRISMA por tema — o degradê fixo
                    abria no tom do tema escuro e sumia no trilho claro. */}
                <div style={{
                  width: `${ind.pctNoPrazo}%`, height: "100%",
                  background: ind.pctNoPrazo >= 80 ? verde : ind.pctNoPrazo >= 50 ? gold : vermelho,
                }} />
              </div>
            )}
          </div>
        </div>

        {/* ══ FAIXA 2 — quem faz e quem carrega ══════════════════════════════ */}
        <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* Atividades por dupla ao longo do tempo — Davi, 2026-08-22: "cada
              item vertical é uma semana. Deve ser um gráfico de linhas".

              As linhas correm na RAMPA (R68): cada dupla ganha um passo do
              degradê, e o traço dela vai da sua cor à da seguinte. O botão que
              CADASTRA dupla mora aqui, no cabeçalho do gráfico que mostra
              duplas — botão de manutenção pertence à peça que ele mantém. */}
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
                      height: 24, padding: "0 9px", borderRadius: 12, flexShrink: 0,
                      background: "transparent", cursor: "pointer", color: gold,
                      border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                      fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
                    }}
                  >
                    <Users size={11} />
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
                    {/* userSpace: linha toda no zero tem caixa de altura zero,
                        e degradê em objectBoundingBox não desenha sobre caixa
                        de área nula — a linha sumiria na semana sem trabalho */}
                    <defs>{gradientesEspectro("op-dupla", duplasAtivas.length, isLight, true)}</defs>
                    <CartesianGrid stroke={grade} />
                    <XAxis dataKey="semana" tick={eixo} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={22} />
                    <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                    <Legend
                      wrapperStyle={{ fontFamily: FONT, fontSize: 10, color: textSecondary }}
                      iconSize={8}
                      formatter={(v: string) => {
                        const d = duplasAtivas.find((x) => x.id === v);
                        return d ? rotuloDaDupla(d, nomeDeTecnico) : v;
                      }}
                    />
                    {duplasAtivas.map((d, i) => {
                      const passo = i % PECAS_ESPECTRO;
                      return (
                        <Line
                          key={d.id}
                          type="monotone"
                          dataKey={d.id}
                          stroke={`url(#op-dupla-${passo})`}
                          strokeWidth={2}
                          // ponto e legenda não aceitam url(#…) de forma
                          // confiável — levam a cor SÓLIDA do passo, que é o
                          // início do degradê daquela linha
                          dot={{ r: 2.5, strokeWidth: 0, fill: espectro(passo, isLight) }}
                          activeDot={{ r: 4.5, fill: espectro(passo, isLight) }}
                          legendType="circle"
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <Ranking
            titulo="Em aberto por técnico"
            prefixo="op-tec"
            dados={cargaComNome}
            sufixo="em aberto"
            vazio={<span style={{ color: textSecondary }}>Nada em aberto atribuído.</span>}
          />
        </div>
        </div>

        {/* R68 — no lugar de "Backlog por idade" e "Reincidência 30d": quem
            está pedindo mais. Só clientes COM chamado aberto entram — é o Map
            de `abertosPorCliente` que garante isso, sem precisar cruzar com a
            lista de clientes.

            R69: ocupa AS DUAS FAIXAS. Altura derivada de ALTURA/GAP, nunca
            digitada — ele tem de terminar exatamente onde a faixa 2 termina. */}
        <Ranking
          titulo="Abertos por cliente"
          prefixo="op-cli"
          dados={clientesComAberto}
          sufixo="em aberto"
          altura={ALTURA_DUPLA}
          teto={TETO_BARRAS_ALTO}
          estilo={{ flex: "1 1 280px", minWidth: 264 }}
          vazio={<span style={{ color: verde }}>Nenhum chamado em aberto.</span>}
        />
      </div>

      {semDados && (
        <div style={{
          ...card(isLight), borderRadius: 16, padding: "12px 16px", textAlign: "center",
          fontFamily: FONT, fontSize: 12.5, color: textSecondary,
        }}>
          Nenhum chamado de campo ainda — os indicadores se preenchem conforme a operação andar.
        </div>
      )}

      {/* ══ A LISTA — o resto da tela ══════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 17, margin: 0,
            color: textPrimary, letterSpacing: "-0.01em",
          }}>
            Chamados técnicos
          </h2>
          {/* R76 — o alternador. O quadro é uma segunda LEITURA da mesma
              fila, não outro conteúdo: as quatro colunas cobrem tudo o que
              as lentes cobrem, de uma vez. */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {([["lista", List, "Lista"], ["kanban", LayoutGrid, "Quadro"]] as const).map(([v, Icone, rotulo]) => {
              const ativa = visao === v;
              return (
                <button
                  key={v}
                  onClick={() => { setVisao(v); if (v === "kanban") setKpiAtivo(null); }}
                  aria-pressed={ativa}
                  title={rotulo}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    height: 28, padding: "0 10px", borderRadius: 14, cursor: "pointer",
                    border: ativa ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                    background: ativa ? GRAD_PRIMARIA : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                    color: ativa ? SOBRE_PRIMARIA : textPrimary,
                    fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
                  }}
                >
                  <Icone size={13} />
                  {rotulo}
                </button>
              );
            })}
          </div>

          {/* R73 — as três lentes. Sem elas, chamado ENCERRADO não tinha onde
              ser visto no sistema inteiro: esta tela listava só o que está em
              aberto, o Painel de chamados idem, e a Início poda encerrado com
              mais de 7 dias. As 227 OS retroativas entraram concluídas e
              ficaram invisíveis por isso. O número de cada chip sai da MESMA
              função que monta a lista (chamadosDaLente). */}
          {visao === "lista" && (
          <div className="trilho-x" style={{ display: "flex", gap: 6 }}>
            {LENTE_ORDEM.map((l) => {
              const ativa = !kpiAtivo && lente === l;
              return (
                <button
                  key={l}
                  onClick={() => { setKpiAtivo(null); setLente(l); }}
                  aria-pressed={ativa}
                  style={{
                    padding: "5px 11px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
                    border: ativa ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                    background: ativa ? GRAD_PRIMARIA : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                    color: ativa ? SOBRE_PRIMARIA : textPrimary,
                    fontFamily: FONT, fontWeight: 600, fontSize: 11.5, whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {LENTE_LABEL[l]} · {contagemLente[l]}
                </button>
              );
            })}
          </div>
          )}

          {/* O anúncio do recorte (DASHBOARD.md §7.3) — o mesmo contrato da
              Início: a lista nunca fica filtrada sem dizer por quê. */}
          {kpiAtivo && (
            <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
              · Mostrando: <strong style={{ color: textPrimary, fontWeight: 600 }}>
                {KPI_OPERACIONAL_LABEL[kpiAtivo]}
              </strong>{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>({atividades.length})</span>
              <button
                onClick={() => setKpiAtivo(null)}
                style={{
                  marginLeft: 8,
                  fontFamily: FONT, fontSize: 12, fontWeight: 600, color: gold,
                  background: "transparent", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                limpar
              </button>
            </span>
          )}
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

        {visao === "kanban" ? (
          <div className="kanban-op" style={{ flex: 1, minHeight: 0 }}>
            {COLUNA_OP_ORDEM.map((col) => {
              const itens = quadro[col];
              const cor = CORES_COLUNA[col];
              return (
                <div key={col} className="kanban-op-coluna">
                  {/* cabeçalho da coluna: nome, contagem e um filete na cor
                      dela — o mesmo vocabulário de estado do resto do app */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                    padding: "0 2px 8px",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: cor, flexShrink: 0 }} />
                    <span style={{ ...MICRO, color: cor }}>{COLUNA_OP_LABEL[col]}</span>
                    <span style={{
                      marginLeft: "auto", fontFamily: FONT, fontWeight: 700, fontSize: 11,
                      color: textSecondary, fontVariantNumeric: "tabular-nums",
                    }}>
                      {itens.length}
                    </span>
                  </div>

                  <div className="kanban-op-itens">
                    {itens.length === 0 ? (
                      <div style={{
                        fontFamily: FONT, fontSize: 11.5, color: textSecondary,
                        padding: "10px 2px", textAlign: "center",
                      }}>
                        vazio
                      </div>
                    ) : itens.map((c: any) => {
                      const info = chamadoStatusInfo(c.status);
                      return (
                        <button
                          key={c.id}
                          className="elevavel"
                          onClick={() => setPainelId(c.id)}
                          style={{
                            ...card(isLight), borderRadius: 12, padding: "9px 11px",
                            textAlign: "left", cursor: "pointer", color: textPrimary,
                            display: "flex", flexDirection: "column", gap: 4,
                            width: "100%", flexShrink: 0,
                            // o filete na cor da coluna: dá para saber de onde
                            // o card é mesmo depois de rolar o cabeçalho
                            borderLeft: `3px solid ${cor}`,
                          }}
                        >
                          <div style={{
                            fontFamily: FONT, fontWeight: 600, fontSize: 12.5, lineHeight: 1.3,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                            overflow: "hidden",
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
                              padding: "1px 6px", borderRadius: 999,
                              background: info.bg, color: isLight ? info.colorLight : info.color,
                              fontFamily: FONT, fontWeight: 700, fontSize: 8.5,
                              letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                            }}>
                              {info.label}
                            </span>
                            <span style={{
                              fontFamily: FONT, fontSize: 10, whiteSpace: "nowrap",
                              color: col === "atrasado" ? vermelho : textSecondary,
                            }}>
                              {c.responsavel_id ? nomeTecnico.get(c.responsavel_id) ?? "Técnico" : "Sem técnico"}
                              {c.prazo_limite && col !== "concluido" ? ` · ${textoPrazo(c.prazo_limite, agora)}` : ""}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : atividades.length === 0 ? (
          <div style={{
            ...card(isLight), borderRadius: 16, padding: "24px 16px", textAlign: "center",
            fontFamily: FONT, fontSize: 13, color: textSecondary,
          }}>
            Nenhum chamado {kpiAtivo ? "nesta seleção" : `em "${LENTE_LABEL[lente]}"`}.
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
