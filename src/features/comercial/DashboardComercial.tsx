// O DASHBOARD DO PAINEL COMERCIAL — R302.
//
// Davi, 15/09/2026: "No lugar do atual 'Funil Comercial', vamos inserir um
// dashboard, que contém: 1- Propostas enviadas por período (Botão de switch
// entre SEMANA e MÊS…) 2- Gráfico de rosca de propostas enviadas por tipo de
// serviço prestado… 3- Funil comercial 4- KPIs".
//
// SÓ PINTA. Toda conta mora em metricas.ts (função pura, testável); este
// arquivo recebe as propostas JÁ FILTRADAS pela página (o filtro de Tipo de
// serviço vale para o dashboard, a lista e o quadro — R8) e um único "agora",
// para as quatro peças concordarem sobre que dia é hoje.
//
// A ESTRUTURA VEM DE docs/DASHBOARD.md e do irmão DashboardOperacional.tsx:
//   · UMA faixa de quatro painéis com ALTURA única (§4) — a MESMA 168 do
//     Operacional, gap 14, flexWrap;
//   · painel = card(isLight) + .elevavel, micro-rótulo no amarelo (§3, §6);
//   · barras e rosca no ESPECTRO via `paradasBarra` + um <defs> LITERAL por
//     gráfico, com prefixo de id próprio (§5 — "com-periodo", "com-servico");
//   · KPIs no PRISMA (escala, não série de dados); o funil também;
//   · Semana | Mês é o ALTERNADOR DE PAINEL de 20px que o Operacional usa no
//     corte da rosca (status | tipo) — controle de LEITURA dentro do cabeçalho
//     de um painel, não a pílula de 40px da barra de ferramentas (DS §6.26 é
//     da linha entre o título e a lista; e o degradê dourado é vocabulário de
//     AÇÃO, DS §11.5). Os cabeçalhos dos quatro painéis têm a mesma altura,
//     para os corpos começarem na mesma linha.
//
// UM DESENHO SÓ — e o celular vê PARTE dele. A faixa é a mesma em toda
// largura; o que muda é quais painéis existem: as BARRAS e a ROSCA são
// `.so-desktop` (doze barras em 343px não têm eixo legível, e a rosca com
// legenda precisa dos seus 236), enquanto o FUNIL e os quatro KPIs aparecem
// sempre — o telefone TINHA o funil antes da R302 e continua tendo, com os
// MESMOS painéis do desktop, não uma versão "compacta" própria (é o §9 item
// 3 lido ao pé da letra: `.so-desktop` só onde há o que mostrar em vez dele,
// e o que se mostra é o resto da faixa). No celular o `flexWrap` empilha os
// dois em coluna; a troca é por CSS, nunca por JS — não pisca no primeiro
// render.

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import {
  PRISMA, paradasBarra, gradienteBarra, espectro, espectroTexto, PECAS_ESPECTRO,
} from "@/lib/paleta";
import { funilComercial } from "@/features/comercial/etapas";
import {
  enviadasPorPeriodo, enviadasPorServico, kpisComerciais, moedaCurta, passoDoPeriodo,
  PERIODOS_NO_GRAFICO, MESES_DA_MEDIA, type KpisComerciais, type PropostaParaMetrica, type TipoPeriodo,
} from "@/features/comercial/metricas";

/**
 * A altura única dos quatro painéis (DASHBOARD.md §4) — a MESMA do
 * DashboardOperacional (168), e sai de um ORÇAMENTO.
 *
 * Esta página tem título (22 + subtítulo 12) acima da faixa e a barra de
 * ferramentas abaixo, e a lista de propostas precisa aparecer no primeiro
 * quadro de um notebook de 768px: 24 (`--topo`) + 18 (respiro) + 43 (título e
 * subtítulo) + 16 + ALTURA + 16 + 42 (barra) + 16 = 175 + ALTURA. Com 168 o
 * cabeçalho da lista abre em 343px e o primeiro cartão (76) termina em 419.
 *
 * Dentro do painel: 168 − 20 (paddingBlock 10 + 10) − 24 (cabeçalho 20 +
 * marginBottom 4) = 124px de corpo — dois a menos que a rosca do Operacional
 * (126: padding 10/8 e o mesmo cabeçalho de 20 + 4), porque aqui o padding de
 * baixo também é 10; a diferença não muda o que cabe. O cabeçalho tem 20
 * porque o alternador Semana | Mês tem 20 — e não os 40 da pílula da barra:
 * com a pílula, o corpo cairia para 104 ou a faixa subiria para 188 e a
 * lista sairia do primeiro quadro. A altura da faixa é puxada pelo DADO,
 * nunca pelo controle.
 */
const ALTURA = 168;

/** O gap entre painéis (DASHBOARD.md §6). */
const GAP = 14;

/** A altura do cabeçalho de TODO painel — a do alternador, para os quatro corpos alinharem. */
const ALTURA_CABECA = 20;

/**
 * O ORÇAMENTO DE LARGURA — os quatro painéis numa linha só no menor desktop
 * em que a tela é usada: 1366px com a sidebar aberta (232 de `--rail`) = 1134.
 *
 *   barras   380 (doze barras com rótulo de eixo legível)
 *   rosca    236 (arco de 100 + legenda com contagem)
 *   funil    200
 *   KPIs     244 (o mesmo 2×2 do Operacional)
 *   gaps      42
 *   ─────────────
 *           1102 ≤ 1134
 *
 * Abaixo disso o flexWrap joga o funil e os KPIs para uma segunda linha
 * (entre 1024 e ~1101px de janela) — o mesmo comportamento da faixa do
 * Operacional, e o preço de não esconder painel nenhum.
 */
const BASE_BARRAS = 380;
const BASE_ROSCA = 236;
const BASE_FUNIL = 200;
const LARGURA_KPIS = 366; // R306: três colunas — cinco tiles, o ticket médio ocupa duas

/**
 * A LARGURA DO BLOCO DE KPIs — 244 fixos, como o 2×2 do Operacional, ENQUANTO
 * a linha der para o funil e os KPIs a dividirem. Abaixo de BASE_FUNIL + GAP +
 * LARGURA_KPIS (458px — o celular, onde barras e rosca nem existem) os dois
 * empilham, e um bloco de 244 numa linha de 343 deixaria 99px vazios à
 * direita dos quatro tiles. Então o bloco toma a linha inteira.
 *
 * Sem media query (não há uma inline) e sem JS medindo a janela: a base do
 * flex é `max(244px, (458px − 100%) × 999)`. Linha mais larga que o limiar →
 * a diferença é negativa e vale o 244; mais estreita → o produto estoura
 * qualquer largura e o `maxWidth: 100%` apara na linha. O 999 só precisa
 * ser grande — quem decide a largura final é o `maxWidth`.
 */
const LIMIAR_EMPILHA = BASE_FUNIL + GAP + LARGURA_KPIS;
const LARGURA_DOS_KPIS: CSSProperties = {
  flex: `0 1 max(${LARGURA_KPIS}px, calc((${LIMIAR_EMPILHA}px - 100%) * 999))`,
  maxWidth: "100%",
};

/**
 * Os tokens de tema que a tela inteira usa — UMA função, para os componentes
 * do nível do módulo lerem os mesmos valores que o corpo do dashboard.
 */
function tokensDoTema(isLight: boolean) {
  return {
    textPrimary: isLight ? "#212121" : "#ffffff",
    textSecondary: isLight ? "#505050" : "rgba(255,255,255,0.55)",
    gold: isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
    azul: isLight ? PRISMA.azul.light : PRISMA.azul.dark,
    verde: isLight ? PRISMA.verde.light : PRISMA.verde.dark,
    pessego: isLight ? PRISMA.pessego.light : PRISMA.pessego.dark,
    laranja: isLight ? PRISMA.laranja.light : PRISMA.laranja.dark,
    neutro: isLight ? PRISMA.neutro.light : PRISMA.neutro.dark,
    superficie: isLight ? "#ffffff" : "#141414",
    trilho: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)",
    grade: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
  };
}
type Tokens = ReturnType<typeof tokensDoTema>;

/** O micro-rótulo de painel (DASHBOARD.md §6): 10/700, caixa alta, no amarelo. */
function micro(t: Tokens): CSSProperties {
  return {
    fontFamily: FONT, fontWeight: 700, fontSize: 10,
    letterSpacing: "0.10em", textTransform: "uppercase", color: t.gold,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
  };
}

/**
 * O ALTERNADOR DE PAINEL — dois botões de 20px no cabeçalho, `aria-pressed`,
 * o ativo com fundo e borda discretos. É o MESMO desenho do corte da rosca
 * do DashboardOperacional (status | tipo); vive aqui em cópia porque ui.ts
 * não é deste pacote — o lugar dele é lá, como `alternadorDoPainel(isLight,
 * ativo)`, com o Operacional apontado para o mesmo helper.
 */
function alternadorDoPainel(isLight: boolean, ativo: boolean, t: Tokens): CSSProperties {
  return {
    height: ALTURA_CABECA, paddingInline: 8, paddingBlock: 0, borderRadius: 10, cursor: "pointer",
    fontFamily: FONT, fontSize: 9.5, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase",
    background: ativo ? (isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)") : "transparent",
    color: ativo ? t.textPrimary : t.textSecondary,
    border: ativo
      ? `1px solid ${isLight ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.18)"}`
      : "1px solid transparent",
  };
}

/**
 * Os `<linearGradient>` de uma série pintada na rampa: um por peça, i → i+1.
 *
 * REESCRITA COM O MESMO CORPO da função local de
 * src/features/paineis/DashboardOperacional.tsx (ela não é exportada, e
 * exportá-la mexeria numa tela com duzentos pinos). O que vale lá vale aqui:
 * DEVOLVE OS GRADIENTES, NÃO O `<defs>` — recharts filtra os filhos do gráfico
 * por `isString(child.type)` e descarta em silêncio um componente próprio que
 * devolvesse `<defs>`; todo `url(#id)` resolveria para nada. Por isso o
 * `<defs>` é escrito à mão em cada gráfico e só o MIOLO dele vem daqui. O
 * prefixo é único NA PÁGINA: dois `<defs>` com o mesmo id fariam o segundo
 * gráfico herdar as cores do primeiro.
 */
function gradientesEspectro(
  prefixo: string, quantas: number, isLight: boolean, userSpace = false,
) {
  return Array.from({ length: Math.min(quantas, PECAS_ESPECTRO) }, (_, i) => (
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

// ── Os componentes do nível do MÓDULO ─────────────────────────────────────
//
// Definidos fora do corpo do dashboard de propósito: um componente declarado
// dentro do render ganha identidade nova a cada estado, e o React desmonta e
// remonta a subárvore inteira — clicar em "Mês" remontaria o próprio botão
// clicado e o foco do teclado cairia no body. Aqui a identidade é estável.

/** Cabeçalho de painel: micro-rótulo à esquerda, ação/nota à direita. Altura fixa para os quatro corpos alinharem. */
function Cabeca({ t, titulo, direita }: { t: Tokens; titulo: string; direita?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, height: ALTURA_CABECA, flexShrink: 0 }}>
      <span style={micro(t)}>{titulo}</span>
      {direita && <span style={{ marginLeft: "auto", minWidth: 0, flexShrink: 0 }}>{direita}</span>}
    </div>
  );
}

/** O corpo de um painel sem dado — carregando e vazio são frases diferentes. */
function Aviso({ t, children }: { t: Tokens; children: ReactNode }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: t.textSecondary, lineHeight: 1.45, paddingInline: 8,
    }}>
      {children}
    </div>
  );
}

/**
 * O tile de KPI — o mesmo desenho do 2×2 do Operacional (card raio 14,
 * número 26/700 com glow na própria cor, rótulo 8/600 em caixa alta). É um
 * `<div>`, não botão, e NÃO carrega `.kpi-tile` nem `.elevavel`: os quatro
 * KPIs desta faixa não recortam lista nenhuma (R302 não pede drill-down), e
 * subir no hover com o número crescendo é o gesto da peça CLICÁVEL
 * (DASHBOARD.md §7.1) — prometeria um clique que não existe. Fica só o
 * `.ruido`, que é textura de superfície, não convite.
 */
function Tile({ t, isLight, rotulo, valor, sub, cor, title, carregando, estilo }: {
  t: Tokens; isLight: boolean; rotulo: string; valor: string; sub?: string; cor: string; title: string;
  carregando: boolean;
  /** R306: o tile do ticket ocupa duas colunas da grade */
  estilo?: CSSProperties;
}) {
  return (
    <div
      title={title}
      className="ruido"
      style={{
        ...card(isLight), borderRadius: 14, paddingBlock: 6, paddingInline: 8, ...estilo,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
        boxSizing: "border-box", minWidth: 0, textAlign: "center",
      }}
    >
      <div style={{
        fontFamily: FONT, fontWeight: 700, fontSize: 26, color: cor,
        textShadow: `0 0 14px ${cor}59`, whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums", lineHeight: 1,
      }}>
        {carregando ? "…" : valor}
      </div>
      <div style={{
        fontFamily: FONT, fontWeight: 600, fontSize: 8, letterSpacing: "0.05em",
        textTransform: "uppercase", color: t.textSecondary, lineHeight: 1.2,
      }}>
        {rotulo}
      </div>
      {sub && !carregando && (
        <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 8.5, color: t.textSecondary, lineHeight: 1.2, whiteSpace: "nowrap" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const umaCasa = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/**
 * Os quatro KPIs (R302), no PRISMA: azul (o ritmo), verde (a taxa), pêssego
 * (o tempo), laranja (o que está na mão do comercial agora) — e o "ticket
 * médio" (R306, U158) no amarelo da marca, em duas colunas: a média anual
 * recorrente em cima, a implantação e a amostra no subtítulo.
 */
function CincoKpis({ t, isLight, kpis, funil, carregando }: {
  t: Tokens; isLight: boolean; kpis: KpisComerciais;
  funil: { visitas: number; enviadas: number }; carregando: boolean;
}) {
  const comum = { t, isLight, carregando };
  return (
    <>
      <Tile
        {...comum}
        rotulo="Propostas por mês"
        sub={`média de ${MESES_DA_MEDIA} meses fechados`}
        valor={umaCasa(kpis.mediaPorMes)}
        cor={t.azul}
        title={`Média de propostas enviadas por mês nos ${MESES_DA_MEDIA} meses fechados antes do atual (M-12) — o mês em curso não entra`}
      />
      <Tile
        {...comum}
        rotulo="Visita → proposta"
        sub={`${funil.enviadas} de ${funil.visitas} visitas`}
        valor={kpis.taxaVisitaProposta === null ? "—" : `${kpis.taxaVisitaProposta}%`}
        cor={t.verde}
        title="Quantas visitas viraram proposta enviada — o funil em porcentagem"
      />
      <Tile
        {...comum}
        rotulo="Da visita ao envio"
        sub="tempo médio"
        valor={kpis.tempoMedioDias === null ? "—" : `${Math.round(kpis.tempoMedioDias)} d`}
        cor={t.pessego}
        title="Dias, em média, entre a visita marcada e o envio da proposta (só as enviadas com as duas datas)"
      />
      <Tile
        {...comum}
        rotulo="Aguardando envio"
        sub="aprovadas sem proposta"
        valor={String(kpis.aguardandoEnvio)}
        cor={t.laranja}
        title="Visitas técnicas aprovadas que ainda não tiveram a proposta enviada — o que está na mão do comercial agora"
      />
      <Tile
        {...comum}
        rotulo="Ticket médio"
        sub={kpis.propostasComValor === 0
          ? "nenhuma proposta com valor gravado"
          : `implantação ${moedaCurta(kpis.ticketImplantacao ?? 0)} · ${kpis.propostasComValor} proposta${kpis.propostasComValor === 1 ? "" : "s"}`}
        valor={kpis.ticketAnual === null ? "—" : `${moedaCurta(kpis.ticketAnual)}/ano`}
        cor={t.gold}
        estilo={{ gridColumn: "span 2" }}
        title="R306: média do valor anual recorrente (12 × mensal) e da implantação entre as propostas enviadas que têm os valores gravados — as anteriores a 23/09/2026 não entram"
      />
    </>
  );
}

/** A nota do funil — VISÍVEL, não em balão: no toque e no leitor de tela o `title` não existe. */
const NOTA_DO_FUNIL = "Aprovação é interna · o aceite do cliente não é mapeado aqui";

interface Props {
  /** as visitas/propostas JÁ recortadas pelo filtro da página */
  propostas: PropostaParaMetrica[];
  /** o relógio único do render — a página decide, o dashboard só lê */
  agora: Date;
  /** a consulta ainda não voltou: cada painel diz "Carregando…" em vez de "zero" */
  carregando?: boolean;
}

export function DashboardComercial({ propostas, agora, carregando = false }: Props) {
  const { isLight } = useTheme();
  const t = tokensDoTema(isLight);

  /**
   * SEMANA × MÊS — estado LOCAL, não persistido: é pergunta do momento
   * ("como foi por semana?"), não preferência de quem abre a tela — a mesma
   * decisão do corte da rosca no Operacional.
   */
  const [tipo, setTipo] = useState<TipoPeriodo>("semana");

  const serie = useMemo(() => enviadasPorPeriodo(propostas, tipo, agora), [propostas, tipo, agora]);
  const rosca = useMemo(() => enviadasPorServico(propostas), [propostas]);
  const funil = useMemo(() => funilComercial(propostas), [propostas]);
  const kpis = useMemo(() => kpisComerciais(propostas, agora), [propostas, agora]);

  const totalNoPeriodo = serie.reduce((s, p) => s + p.valor, 0);

  // O PAINEL da faixa: card + altura única + padding compacto. Os quatro
  // passam por aqui — é o que garante o §4.
  const PAINEL: CSSProperties = {
    ...card(isLight), borderRadius: 16, height: ALTURA,
    paddingBlock: 10, paddingInline: 13, boxSizing: "border-box",
    display: "flex", flexDirection: "column", minWidth: 0,
  };
  const tooltipStyle: CSSProperties = {
    background: isLight ? "#ffffff" : "#1b1b1b",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10, fontFamily: FONT, fontSize: 12, color: t.textPrimary,
  };
  const eixo = { fill: t.textSecondary, fontSize: 10, fontFamily: FONT };

  /** Os três estágios do funil — cumulativos, e acaba no envio (R64). */
  const estagios = [
    { rotulo: "Visitas", valor: funil.visitas, cor: t.gold },
    { rotulo: "Aprovadas", valor: funil.aprovadas, cor: t.azul },
    { rotulo: "Enviadas", valor: funil.enviadas, cor: t.verde },
  ];
  const pctDe = (valor: number) => (funil.visitas > 0 ? Math.round((valor / funil.visitas) * 100) : 0);

  return (
    // ═══ A FAIXA — quatro painéis, altura única (DASHBOARD.md §4). Barras e
    // rosca são `.so-desktop`; funil e KPIs existem em toda largura. ═════════
    <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>

      {/* ── (1) Propostas enviadas por período — doze barras, semana ou mês.
          SÓ DESKTOP: doze barras em 343px não têm eixo legível. Sem `title`
          no painel: a dica de cada barra já traz o período por extenso, e
          dois balões ao mesmo tempo (o nativo e o do gráfico) era o que o
          `title` produzia. */}
      <div className="so-desktop elevavel" style={{ ...PAINEL, flex: `2 1 ${BASE_BARRAS}px`, minWidth: BASE_BARRAS }}>
        <Cabeca
          t={t}
          titulo="Propostas enviadas"
          direita={
            <span style={{ display: "flex", gap: 4 }}>
              {([["semana", "Semana"], ["mes", "Mês"]] as const).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setTipo(valor)}
                  aria-pressed={tipo === valor}
                  className="hover-suave"
                  style={alternadorDoPainel(isLight, tipo === valor, t)}
                >
                  {rotulo}
                </button>
              ))}
            </span>
          }
        />
        {carregando ? (
          <Aviso t={t}>Carregando…</Aviso>
        ) : totalNoPeriodo === 0 ? (
          <Aviso t={t}>Nenhuma proposta enviada no período.</Aviso>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ left: 0, right: 6, top: 14, bottom: 0 }}>
                {/* rampa INVERTIDA por tempo (DASHBOARD.md §5): passado quente,
                    o corrente no amarelo — passoDoPeriodo decide o tom */}
                <defs>{gradientesEspectro("com-periodo", PECAS_ESPECTRO, isLight)}</defs>
                <CartesianGrid vertical={false} stroke={t.grade} />
                {/* preserveStartEnd: as duas pontas sempre aparecem; entre
                    elas o recharts só omite rótulo quando ele sobreporia o
                    vizinho — e a dica traz o período por extenso */}
                <XAxis dataKey="rotulo" tick={eixo} interval="preserveStartEnd" minTickGap={6} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={22} />
                <RTooltip
                  cursor={{ fill: t.grade }}
                  formatter={(v: number) => [`${v} proposta${v === 1 ? "" : "s"}`, ""]}
                  labelFormatter={(rotulo: string, payload: any[]) => payload?.[0]?.payload?.rotuloLongo ?? rotulo}
                  contentStyle={tooltipStyle} itemStyle={{ color: t.textPrimary }}
                />
                <Bar dataKey="valor" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                  {serie.map((p, i) => (
                    <Cell key={p.chave} fill={`url(#com-periodo-${passoDoPeriodo(i, serie.length)})`} />
                  ))}
                  <LabelList
                    dataKey="valor"
                    position="top"
                    formatter={(v: number) => (v > 0 ? String(v) : "")}
                    style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, fill: t.textPrimary }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── (2) Propostas enviadas por tipo de serviço — a rosca na rampa ──
          Uma proposta com dois serviços conta nas DUAS fatias (R302): a rosca
          responde "quantas propostas ofereceram X"; o número do meio é o de
          PROPOSTAS, e por isso as fatias podem somar mais que ele. A legenda
          carrega o MESMO degradê da fatia (identidade nunca só pela cor) e o
          número na rampa de TEXTO. "Sem tipo" fica NEUTRO, fora da rampa.
          SÓ DESKTOP, como as barras. */}
      <div className="so-desktop elevavel" style={{ ...PAINEL, flex: `1 1 ${BASE_ROSCA}px`, minWidth: BASE_ROSCA }}>
        <Cabeca t={t} titulo="Enviadas por tipo de serviço" />
        {carregando ? (
          <Aviso t={t}>Carregando…</Aviso>
        ) : rosca.totalEnviadas === 0 ? (
          <Aviso t={t}>Nenhuma proposta enviada ainda.</Aviso>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: 100, height: "100%", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>{gradientesEspectro("com-servico", PECAS_ESPECTRO, isLight)}</defs>
                  <Pie
                    data={[
                      ...rosca.fatias,
                      ...(rosca.semServico > 0 ? [{ chave: "sem_tipo", rotulo: "Sem tipo", valor: rosca.semServico, passo: -1 }] : []),
                    ]}
                    dataKey="valor" nameKey="rotulo"
                    innerRadius={29} outerRadius={45}
                    stroke={t.superficie} strokeWidth={2} isAnimationActive={false}
                  >
                    {rosca.fatias.map((f) => (
                      <Cell key={f.chave} fill={`url(#com-servico-${f.passo % PECAS_ESPECTRO})`} />
                    ))}
                    {rosca.semServico > 0 && <Cell key="sem_tipo" fill={t.neutro} />}
                  </Pie>
                  <RTooltip
                    formatter={(v: number, nome: string) => [
                      `${v} · ${Math.round((v / rosca.totalEnviadas) * 100)}% das enviadas`,
                      nome,
                    ]}
                    contentStyle={tooltipStyle} itemStyle={{ color: t.textPrimary }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", pointerEvents: "none",
              }}>
                <span style={{
                  fontFamily: FONT, fontWeight: 700, fontSize: 16,
                  fontVariantNumeric: "tabular-nums", color: t.textPrimary, lineHeight: 1,
                }}>
                  {rosca.totalEnviadas}
                </span>
                <span style={{ ...micro(t), fontSize: 7, color: t.textSecondary, marginTop: 2 }}>enviadas</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              {rosca.fatias.map((f) => {
                const passo = f.passo % PECAS_ESPECTRO;
                return (
                  <div key={f.chave} style={{ display: "flex", alignItems: "center", gap: 5 }} title={`${f.rotulo} · ${f.valor}`}>
                    <span style={{
                      width: 9, height: 9, borderRadius: 2.5, flexShrink: 0,
                      background: gradienteBarra(espectro(passo, isLight), espectro(passo + 1, isLight), isLight),
                    }} />
                    <span style={{
                      flex: 1, minWidth: 0, fontFamily: FONT, fontWeight: 400, fontSize: 10, color: t.textPrimary,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {f.rotulo}
                    </span>
                    <span style={{
                      fontFamily: FONT, fontSize: 10, fontWeight: 700,
                      color: espectroTexto(passo, isLight), fontVariantNumeric: "tabular-nums",
                    }}>
                      {f.valor}
                    </span>
                  </div>
                );
              })}
              {rosca.semServico > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }} title={`Sem tipo de serviço · ${rosca.semServico}`}>
                  <span style={{ width: 9, height: 9, borderRadius: 2.5, flexShrink: 0, background: t.neutro }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontWeight: 400, fontSize: 10, color: t.textSecondary, whiteSpace: "nowrap" }}>
                    Sem tipo
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, color: t.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                    {rosca.semServico}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── (3) Funil comercial — TRÊS estágios, cumulativos, e acaba no envio
          (R64). É o card que existia, encolhido num painel: número em 20/700
          na cor do estágio e uma barra proporcional às visitas, para o funil
          LER como funil. A nota da R64 é VISÍVEL no rodapé, não `title`.
          "Aceitas/Recusadas" continuam fora: nenhum fluxo preenche o
          resultado no cliente desde a R38. */}
      <div className="elevavel" style={{ ...PAINEL, flex: `1 1 ${BASE_FUNIL}px`, minWidth: BASE_FUNIL }}>
        <Cabeca t={t} titulo="Funil comercial" />
        {carregando ? (
          <Aviso t={t}>Carregando…</Aviso>
        ) : funil.visitas === 0 ? (
          <Aviso t={t}>Nenhuma visita ainda.</Aviso>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {estagios.map((e) => {
              const pct = pctDe(e.valor);
              return (
                <div key={e.rotulo} title={`${e.valor} de ${funil.visitas} · ${pct}%`}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{
                      fontFamily: FONT, fontWeight: 700, fontSize: 20, color: e.cor,
                      fontVariantNumeric: "tabular-nums", lineHeight: 1,
                    }}>
                      {e.valor}
                    </span>
                    <span style={{
                      fontFamily: FONT, fontWeight: 400, fontSize: 10, color: t.textSecondary,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      {e.rotulo}
                    </span>
                    <span style={{
                      marginLeft: "auto", fontFamily: FONT, fontWeight: 600, fontSize: 10,
                      color: t.textSecondary, fontVariantNumeric: "tabular-nums",
                    }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 5, borderRadius: 3, overflow: "hidden", background: t.trilho, marginTop: 3 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: e.cor, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 9.5, color: t.textSecondary, lineHeight: 1.3 }}>
              {NOTA_DO_FUNIL}
            </div>
          </div>
        )}
      </div>

      {/* ── (4) Os KPIs, em 3×2 (R306: cinco tiles) — 366 fixos; no celular,
          onde só ele e o funil sobram, o bloco toma a linha (LARGURA_DOS_KPIS).
          Não é painel (não tem card em volta): é a grade de quatro tiles. */}
      <div style={{
        ...LARGURA_DOS_KPIS, height: ALTURA, display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, boxSizing: "border-box",
      }}>
        <CincoKpis t={t} isLight={isLight} kpis={kpis} funil={funil} carregando={carregando} />
      </div>
    </div>
  );
}
