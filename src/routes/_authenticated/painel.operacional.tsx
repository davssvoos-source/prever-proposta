// Painel Operacional Técnica — R27, na anatomia da Início (R67), no degradê
// dela (R68), recortado pela equipe técnica (R95) e reorganizado para as três
// perguntas do Vinicius (R125): o que cada equipe faz, como está cada
// implantação, quanto vai ser cobrado no mês.
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
// O ARRANJO DA R125 (Davi, 03/09/2026), em três colunas:
//
//   [ Abertos por cliente ] [ KPIs 2×2 | Fila | A cobrar / Aguardando ] [ Implantações ]
//   [   (duas faixas)     ] [ Atividades por equipe · 8 semanas         ] [ em andamento ]
//
//   · "Fluxo e ritmo" e "Em aberto por técnico" SAÍRAM da tela. Os números
//     deles continuam em indicadores.ts, puros e assertados — saíram do
//     layout, não da biblioteca (é a mesma história de backlog/reincidência).
//   · "Abertos por cliente" foi para a ESQUERDA (era a coluna da direita na
//     R69) e continua com a altura das duas faixas.
//   · A coluna da direita é NOVA: as implantações em andamento, uma barra por
//     obra — o painel que o Davi chamou de "o principal".
//   · Entre os KPIs e o gráfico das equipes, a coluna dos dois quadrados de
//     dinheiro e conferência.
//
// O DEGRADÊ É O MESMO DA INÍCIO (R68). Lá as barras são <div> com
// `gradienteBarra()` em CSS e a rosca é SVG à mão; aqui tudo passa pelo
// recharts, que pinta em SVG — `linear-gradient()` de CSS não vale em `fill`.
// Daí `paradasBarra()` (paleta.ts): a irmã SVG de `gradienteBarra`, com a MESMA
// regra da costura. A REGRA DA RAMPA: a peça i vai de ESPECTRO[i] a
// ESPECTRO[i+1]. Máximo de 8 peças (§9 do DESIGN_SYSTEM); "Sem cliente"
// continua NEUTRO, fora da rampa: é ausência de identidade, não mais uma.
//
// Só natureza "campo" E equipe "tecnica" (R95/R124): a proposta comercial (U29)
// é funil, as demandas internas são do quadro, e o T.I. em campo é de outra
// equipe.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { Users, LayoutGrid, List, Plus, ChevronsDownUp, ChevronsUpDown, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado, usePermissoes } from "@/features/gerencial/permissoes";
import { useUserCargo, useTecnicos, useVeFinanceiro } from "@/features/gerencial/data";
import { useChamadosPorNatureza, usePessoas, mapaDePessoas } from "@/features/chamados/data";
import { PainelChamado } from "@/features/chamados/PainelChamado";
import { NovoChamadoTecnicoDialog } from "@/features/chamados/NovoChamadoTecnicoDialog";
import { moeda, useCobrancasDaCompetencia } from "@/features/chamados/cobranca";
import { useApoiosDeTodos } from "@/features/home/data";
import { TabelaAtividades } from "@/features/home/TabelaAtividades";
import { MenuFiltro } from "@/features/home/MenuFiltro";
// `lugarNoCalendario`: a MESMA conta do calendário decide em que DIA o card
// cai no eixo por dia do quadro (P57). Duas contas fariam as duas telas
// discordarem sobre a mesma atividade — que foi exatamente o defeito da P57.
import { atividadeDoChamado, lugarNoCalendario, type Atividade } from "@/features/atividades/modelo";
import { useDuplas, useEscala } from "@/features/duplas/data";
// R285 (U142): a tela de equipes deixou de ter eixo de SEMANA — a composição
// vale do instante da troca, e o pop-up mostra quem está com quem agora.
import { DialogoEquipes } from "@/features/duplas/DialogoEquipes";
import {
  serieAtividadesPorEscala, foraDeEscala, duplasNaJanela, composicaoDaDupla,
  montarEscala, rotuloDaComposicao, duplaDaPessoaNaSemana, type SemanaDoGrafico,
} from "@/features/duplas/modelo";
import { useObrasEmAndamento } from "@/features/implantacao/data";
import { progressoDaObra, rotuloDoProgresso, preenchimentoDaBarra } from "@/features/implantacao/modelo";
import { chamadoStatusInfo, textoPrazo, TIPO_LABEL, STATUS_ORDEM, type ChamadoTipo } from "@/lib/chamado-status";
import { referenciaSemanal, inicioSemana, competencia, dataIso } from "@/lib/periodos";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton } from "@/lib/ui";
import {
  PRISMA, paradasBarra, gradienteBarra, espectro, espectroTexto, PECAS_ESPECTRO,
  GRAD_PRIMARIA, SOBRE_PRIMARIA,
} from "@/lib/paleta";
import {
  calcularIndicadores,
  chamadosDoKpi, KPI_OPERACIONAL_ORDEM, KPI_OPERACIONAL_LABEL, type ChaveKpiOperacional,
  abertosPorCliente, abertosPorTipo, ordenarChamados, ordenarHistorico,
  chamadosDaLente, LENTE_ORDEM, LENTE_LABEL, type LenteLista,
  agruparPorColuna, COLUNA_OP_ORDEM, COLUNA_OP_LABEL, type ColunaOperacional,
  colunasDoQuadro, EIXO_LABEL, EIXO_NOTA, momentoDoCard, type EixoDoQuadro,
  ORDENS_DE_CAMPO, ORDEM_DE_CAMPO_PADRAO, ordenarCampo,
  implantacoesEmAndamento, totalACobrar, moedaCurta,
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
 * mais, em duas, e o contrato desta tela (R68) é a LISTA COMEÇAR NO MÁXIMO NA
 * METADE DA TELA. A conta que fixou o número, e que o verificador refaz:
 * 2×168 + 14 de gap + 6 de respiro + os 24 de `--topo` = 380px — o cabeçalho
 * da lista abre aí, acima da metade (384) mesmo num notebook de 768px de
 * viewport. Mexer nesta constante para cima quebra a asserção CRÍTICO.
 */
const ALTURA = 168;

/** O gap entre painéis e entre as faixas (DASHBOARD.md §6). */
const GAP = 14;

/**
 * A altura de um painel que ocupa AS DUAS FAIXAS — "Abertos por cliente" e
 * "Implantações em andamento".
 *
 * Derivada, nunca digitada: ele precisa terminar exatamente onde a segunda
 * faixa termina, e um 350 solto aqui se descolaria de `ALTURA`/`GAP` na
 * primeira vez que um dos dois mudasse. Travado por asserção.
 */
const ALTURA_DUPLA = ALTURA * 2 + GAP;

/** Quantas semanas o gráfico de atividades por equipe mostra (R125: era 12). */
const SEMANAS_NO_GRAFICO = 8;

/** Quantas barras cabem num ranking de uma faixa sem espremer o rótulo. */
const TETO_BARRAS = 5;

/** …e num de duas faixas, que tem o dobro de altura para gastar. */
const TETO_BARRAS_ALTO = 12;

/** Quantas obras cabem no painel de implantações (duas linhas por obra). */
const TETO_OBRAS = 8;

/** Teto da tabela — o mesmo da Início. */
const TETO_TABELA = 200;

/**
 * R296: a medida do botão quadrado da barra, MEDIDA na Início — 42×42, raio
 * 12. Num lugar só porque são quatro botões: escrever o número quatro vezes
 * é como a tela acaba com três alturas na mesma linha, que foi o defeito.
 */
function BOTAO_DA_BARRA(isLight: boolean, cor: string): CSSProperties {
  return {
    width: 42, height: 42, borderRadius: 12, padding: 0, flexShrink: 0, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    background: isLight ? "#ffffff" : "#1b1b1b",
    color: cor,
  };
}

/**
 * R296: a faixa de indicadores nasce ABERTA e a preferência fica gravada.
 *
 * Chave PRÓPRIA, separada da `prever-home-painel` da Início: são duas telas
 * com duas rotinas, e quem recolhe os gráficos aqui pode querer os de lá.
 * Compartilhar a chave faria uma tela decidir pela outra em silêncio.
 */
const CHAVE_PAINEL_OP = "prever-operacional-painel";

/** R296: a ordem escolhida também é preferência — quem ordena por cliente
 *  ordena por cliente todo dia. */
const CHAVE_ORDEM_OP = "prever-operacional-ordem";

/**
 * O ORÇAMENTO DE LARGURA — a conta que o verificador refaz.
 *
 * As três colunas têm de caber numa linha no menor desktop em que esta tela é
 * usada: 1366px de viewport com a sidebar aberta (232px de `--rail`) = 1134px
 * de coluna. Acima disso o flex distribui a folga; abaixo, o `flexWrap` joga a
 * coluna da DIREITA para baixo — e é ela que quebra, de propósito, porque as
 * faixas do meio não podem descolar do painel alto da esquerda.
 *
 *   coluna esquerda  236 (Abertos por cliente)
 *   coluna do meio   244 (KPIs) + 190 (fila) + 128 (dinheiro/conferência) + 2×14 = 590
 *   coluna direita   262 (implantações)
 *   dois gaps         28
 *   ────────────────────
 *                   1116 ≤ 1134
 */
const LARGURA_KPIS = 244;
const LARGURA_FILA = 190;
const LARGURA_TILES = 128;
const BASE_CLIENTES = 236;
const BASE_MEIO = LARGURA_KPIS + LARGURA_FILA + LARGURA_TILES + 2 * GAP;
const BASE_OBRAS = 262;

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
  const { data: veFinanceiro = false } = useVeFinanceiro();
  const { podeVer } = usePermissoes();
  const { data: chamadosDeCampo = [] } = useChamadosPorNatureza("campo");
  /**
   * R95/R124: este painel é da equipe TÉCNICA, não de todo chamado de campo.
   *
   * Até a U75 a tela lia `natureza="campo"` e pronto — e acertava por
   * COINCIDÊNCIA: todo chamado de campo nasce com `equipe: "tecnica"`
   * (chamados/data.ts). Nada no banco impede um chamado de campo de outra
   * equipe (o T.I. em campo, por exemplo), e no dia em que existir um ele
   * apareceria aqui sem ninguém pedir. O recorte é explícito, e é o que faz
   * este ser o painel do Vinicius.
   */
  const chamados = useMemo(
    () => chamadosDeCampo.filter((c) => c.equipe === "tecnica"),
    [chamadosDeCampo],
  );
  const { data: tecnicos = [] } = useTecnicos();
  const { data: duplas = [] } = useDuplas();
  const { data: escala = montarEscala([], []) } = useEscala();
  const { data: pessoas = [] } = usePessoas();
  const { data: apoiosDoChamado } = useApoiosDeTodos();
  const { isLight } = useTheme();
  const [duplasAberto, setDuplasAberto] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [painelId, setPainelId] = useState<string | null>(null);
  // qual quadrado de KPI está filtrando a lista agora — null = nenhum, e a
  // lista mostra a lente inteira. "aguardando_conferencia" também mora aqui
  // (R125): é o quinto recorte, fora do 2×2 mas na mesma função.
  const [kpiAtivo, setKpiAtivo] = useState<ChaveKpiOperacional | null>(null);
  // R73: a lente da lista. "Em aberto" é o padrão (esta é a tela de quem
  // coordena o dia); "Concluídos" e "Todos" existem porque o histórico —
  // as 227 OS retroativas, por exemplo — não tinha onde ser visto.
  const [lente, setLente] = useState<LenteLista>("abertos");
  // R76: lista ou quadro. O quadro mostra as quatro colunas de uma vez —
  // inclusive Concluídos —, então lente e KPI não valem nele: os dois
  // recortam para subconjuntos de "em aberto" e esvaziariam colunas.
  const [visao, setVisao] = useState<"lista" | "kanban">("lista");
  // R295: por que eixo o quadro separa as colunas. `estado` é o de sempre
  // (R76) e continua o padrão — a R76 recusou o status CRU como única
  // leitura, e continua certa; o que o Davi pediu foi acrescentar modos.
  const [eixoDoQuadro, setEixoDoQuadro] = useState<EixoDoQuadro>("estado");
  // R296: a faixa de indicadores RECOLHE, e fica recolhida — o mesmo
  // mecanismo que a R175 deu à Início. Chave própria: recolher aqui não
  // pode recolher lá, são duas telas e duas rotinas.
  const [painelAberto, setPainelAberto] = useState(() => {
    try { return localStorage.getItem(CHAVE_PAINEL_OP) !== "fechado"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_PAINEL_OP, painelAberto ? "aberto" : "fechado"); } catch { /* modo privado */ }
  }, [painelAberto]);
  // R296: a ordem da lista. Antes não havia nenhuma — a fila vinha na ordem
  // em que o banco devolveu, que muda sozinha entre duas visitas à tela.
  const [ordem, setOrdem] = useState<string>(() => {
    try { return localStorage.getItem(CHAVE_ORDEM_OP) ?? ORDEM_DE_CAMPO_PADRAO; } catch { return ORDEM_DE_CAMPO_PADRAO; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_ORDEM_OP, ordem); } catch { /* modo privado */ }
  }, [ordem]);

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
  /** 'AAAA-MM-DD' de hoje, para o progresso das obras — texto, não Date (fuso). */
  const hoje = useMemo(() => dataIso(agora), [agora]);
  const competenciaAtual = useMemo(() => competencia(agora), [agora]);

  // ── "A cobrar este mês" (R125) — SÓ para quem vê valores (R13) ───────────
  // A consulta nem é disparada para o SAC: o painel não existe para ele, e
  // uma consulta que a RLS filtraria para "[]" viraria "R$ 0,00" — zero e
  // "escondido" não podem ser a mesma coisa.
  const cobrancasMes = useCobrancasDaCompetencia(competenciaAtual, veFinanceiro);
  const aCobrar = useMemo(
    () => totalACobrar(cobrancasMes.data ?? [], competenciaAtual),
    [cobrancasMes.data, competenciaAtual],
  );

  // ── "Aguardando conferência" (R125) — o quinto recorte de chamadosDoKpi ──
  const aguardandoConferencia = useMemo(
    () => chamadosDoKpi("aguardando_conferencia", chamados as any[], agora).length,
    [chamados, agora],
  );

  // ── "Implantações em andamento" (R125) ───────────────────────────────────
  // A lista vem dos chamados já carregados; o PERÍODO e as FASES vêm de uma
  // consulta própria (implantacao/data.ts), pela razão de deploy da U89: se
  // ela falhar, falha o progresso — não a tela.
  const obras = useMemo(() => implantacoesEmAndamento(chamados as any[]), [chamados]);
  const idsDasObras = useMemo(() => obras.map((o) => o.id), [obras]);
  const resumoDasObras = useObrasEmAndamento(idsDasObras);

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  const pessego = isLight ? PRISMA.pessego.light : PRISMA.pessego.dark;
  const superficie = isLight ? "#ffffff" : "#141414";
  const neutro = isLight ? PRISMA.neutro.light : PRISMA.neutro.dark;
  const trilho = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";
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
    background: isLight ? "#ffffff" : "#1b1b1b",
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
    const CORES_KPI: Record<Exclude<ChaveKpiOperacional, "aguardando_conferencia">, { dark: string; light: string }> = {
      abertos: PRISMA.azul, sem_responsavel: PRISMA.amarelo,
      urgentes: PRISMA.laranja, atrasados: PRISMA.vermelho,
    };
    return KPI_OPERACIONAL_ORDEM.map((chave) => ({
      chave,
      rotulo: KPI_OPERACIONAL_LABEL[chave],
      cor: corDe(CORES_KPI[chave as keyof typeof CORES_KPI]),
      valor: chamadosDoKpi(chave, chamados, agora).length,
    }));
  }, [chamados, agora, isLight]);

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

  // ── Em aberto por TIPO (R123) ────────────────────────────────────────────
  // O plano chamava isto de "ranking por modalidade". O rótulo da tela diz
  // TIPO, e não modalidade, de propósito: `cliente_contratos.modalidade` já é
  // outra coisa (locação/manutenção/comodato/venda), e repetir a palavra aqui
  // reabriria a colisão de vocabulário que a decisão da Fase 1 fechou.
  //
  // MESMA BASE dos KPIs e do ranking de cliente — a soma das três listas é o
  // mesmo `abertos`, e o verificador trava isso.
  /**
   * QUAL CORTE A ROSCA MOSTRA. Estado LOCAL e não persistido: é pergunta do
   * momento ("como a fila se divide?"), não preferência de quem abre a tela.
   * A rosca já responde exatamente esta pergunta — "como a fila EM ABERTO se
   * divide" —, só que por um eixo. Dar a ela o segundo eixo custa dois botões
   * e zero pixel de layout.
   */
  const [corteDaRosca, setCorteDaRosca] = useState<"status" | "tipo">("status");

  const tiposComRotulo = useMemo(
    () => abertosPorTipo(chamados).map((t) => ({
      nome: t.tipo ? (TIPO_LABEL[t.tipo as ChamadoTipo] ?? t.tipo) : "Sem tipo",
      valor: t.total,
      semDono: !t.tipo,
    })),
    [chamados],
  );

  // A SÉRIE DA ROSCA, derivada do corte. As duas saem de `abertosDeCampo`,
  // então a soma das fatias é o MESMO `ind.abertos` nos dois cortes — o número
  // do meio da rosca não muda quando o eixo muda, e é isso que deixa comparar.
  const roscaComRotulo = corteDaRosca === "status" ? filaComRotulo : tiposComRotulo;

  // ── Atividades por equipe de campo ao longo do tempo (R58/R96/R125) ──────
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

  // Ganha <Line> quem teve ESCALA em alguma semana da janela — não quem está
  // ativa hoje. Desde a U76 a equipe desfeita continua explicando o histórico:
  // ela some do futuro pela ausência na escala, não do gráfico do passado.
  const duplasDoGrafico = useMemo(
    () => duplasNaJanela(duplas, semanas, escala),
    [duplas, semanas, escala],
  );
  const serieDuplas = useMemo(
    () => serieAtividadesPorEscala(chamados as any[], duplas, semanas, escala, referenciaSemanal),
    [chamados, duplas, semanas, escala],
  );
  const semDuplaNaJanela = useMemo(
    () => foraDeEscala(chamados as any[], semanas, escala, referenciaSemanal),
    [chamados, semanas, escala],
  );
  // a legenda mostra a composição da semana MAIS RECENTE da janela: é o rótulo
  // "como está agora", e as semanas antigas continuam somando onde somavam
  const semanaDaLegenda = semanas[semanas.length - 1]?.chave ?? "";
  const nomeDeTecnico = (id: string) => nomeTecnico.get(id) ?? "Técnico";

  // ── A lista ───────────────────────────────────────────────────────────────
  // A LENTE manda; um KPI ativo estreita dentro de "em aberto" (os quatro são
  // subconjuntos dele por construção). "Aguardando conferência" é a exceção:
  // são chamados CONCLUÍDOS, e histórico se ordena pelo mais recente — prazo
  // não tem urgência depois de encerrado. Ordem: em aberto por urgência de
  // prazo; histórico pelo mais recente.
  const listaChamados = useMemo(() => {
    const base = kpiAtivo === "aguardando_conferencia"
      ? ordenarHistorico(chamadosDoKpi(kpiAtivo, chamados, agora))
      : kpiAtivo
        ? ordenarChamados(chamadosDoKpi(kpiAtivo, chamados, agora), agora)
        : lente === "abertos"
          ? ordenarChamados(chamadosDaLente(lente, chamados, agora), agora)
          : ordenarHistorico(chamadosDaLente(lente, chamados, agora));
    // R296 — a ordem ESCOLHIDA, por cima da ordem inteligente. `sort` é
    // estável: o empate na escolhida cai na de antes, então duas atividades
    // no mesmo dia saem por urgência (em aberto) ou pela mais recente
    // (histórico), em vez de na ordem em que o banco devolveu.
    return ordenarCampo(base as any[], ordem, (c: any) => (c.cliente_id ? nomeCliente.get(c.cliente_id) ?? null : null)) as typeof base;
  }, [kpiAtivo, lente, chamados, agora, ordem, nomeCliente]);

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

  /**
   * Os SEIS dias da semana desenhada, para o eixo `dia` (R295).
   *
   * Segunda a sábado: domingo não é dia de campo, e uma coluna que nunca
   * enche empurra as outras seis para fora da tela. O rótulo traz o dia da
   * semana E a data, porque "Qua" sozinho não diz de qual semana.
   */
  const diasDaSemana = useMemo(() => {
    const segunda = inicioSemana(agora);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(segunda);
      d.setDate(d.getDate() + i);
      return {
        chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        titulo: `${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][i]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      };
    });
  }, [agora]);

  /**
   * As colunas do quadro, pelo eixo escolhido.
   *
   * A equipe do chamado é DERIVADA do responsável (nunca houve
   * `chamados.dupla_id`, de propósito — ver a U47), pela composição da
   * semana do agendamento. O dia sai de `lugarNoCalendario`, a MESMA conta do
   * calendário: duas contas para "em que dia isto cai" é como o quadro e o
   * calendário passam a discordar sobre a mesma atividade (foi o P57).
   */
  const colunas = useMemo(() => colunasDoQuadro(eixoDoQuadro, chamados as any[], {
    agora,
    equipes: duplas.filter((d) => d.ativa).map((d) => ({ id: d.id, nome: d.nome })),
    equipeDoChamado: (c: any) => {
      if (!c.responsavel_id) return null;
      const semana = referenciaSemanal(new Date(c.data_hora_agendada ?? c.created_at ?? agora));
      const id = duplaDaPessoaNaSemana(c.responsavel_id, semana, escala);
      const d = id ? duplas.find((x) => x.id === id) : null;
      return d ? { id: d.id, nome: d.nome } : null;
    },
    diaDoChamado: (c: any) => {
      const quando = lugarNoCalendario(c).quando;
      if (!quando) return null;
      const d = new Date(quando);
      return Number.isNaN(d.getTime()) ? null
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
    dias: diasDaSemana,
    status: (STATUS_ORDEM as string[]).filter((s) => s !== "cancelado")
      .map((s) => ({ chave: s, titulo: chamadoStatusInfo(s as any).label })),
  }), [eixoDoQuadro, chamados, agora, duplas, escala, diasDaSemana]);

  const semDados = ind.abertos === 0 && ind.entradasMes === 0 && ind.saidasMes === 0;

  // ── peças reutilizadas ────────────────────────────────────────────────────

  /** Cabeçalho de painel: micro-rótulo à esquerda, nota/ação à direita. */
  const Cabeca = ({ titulo, direita }: { titulo: string; direita?: ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, minHeight: 15 }}>
      <span style={MICRO}>{titulo}</span>
      {direita && <span style={{ marginLeft: "auto", minWidth: 0 }}>{direita}</span>}
    </div>
  );

  /**
   * O quadrado pequeno — irmão dos tiles do 2×2, na coluna de dinheiro e
   * conferência (R125). `ativo` desenha o anel na própria cor (§7.1); quem
   * não filtra nada (o de dinheiro) não recebe `aoClicar` de drill-down, e o
   * clique dele navega. Número grande para contagem, menor para moeda — "R$
   * 12,3 mil" a 26px não cabe em 128px.
   */
  const Tile = ({ rotulo, valor, sub, cor, ativo = false, aoClicar, title, compacto = false }: {
    rotulo: string; valor: string; sub?: string; cor: string;
    ativo?: boolean; aoClicar?: () => void; title?: string; compacto?: boolean;
  }) => {
    const base = card(isLight);
    return (
      <button
        onClick={aoClicar}
        aria-pressed={ativo}
        title={title}
        className="elevavel kpi-tile ruido"
        style={{
          ...base, borderRadius: 14, padding: "6px 8px",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3,
          boxSizing: "border-box", minWidth: 0,
          border: ativo ? `1.5px solid ${cor}` : base.border,
          boxShadow: ativo ? `0 0 0 3px ${cor}2E` : base.boxShadow,
          cursor: aoClicar ? "pointer" : "default", font: "inherit", textAlign: "center",
        }}
      >
        <div className="kpi-num" style={{
          fontFamily: FONT, fontWeight: 700, fontSize: compacto ? 17 : 26, color: cor,
          textShadow: `0 0 14px ${cor}59`, whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
        }}>
          {valor}
        </div>
        <div style={{
          fontFamily: FONT, fontWeight: 600, fontSize: 8, letterSpacing: "0.05em",
          textTransform: "uppercase", color: textSecondary, lineHeight: 1.2,
        }}>
          {rotulo}
        </div>
        {sub && (
          <div style={{ fontFamily: FONT, fontSize: 8.5, color: textSecondary, lineHeight: 1.2, whiteSpace: "nowrap" }}>
            {sub}
          </div>
        )}
      </button>
    );
  };

  /**
   * Painel de ranking: barras DEITADAS na rampa — chamados abertos por
   * cliente (e o que mais precisar de um ranking de uma ou duas faixas).
   *
   * `semDono` (sem cliente) pinta NEUTRO e fica fora da rampa: é ausência de
   * identidade, não mais uma identidade. É a mesma regra do "Outros" no §9 do
   * DESIGN_SYSTEM.
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

  /**
   * IMPLANTAÇÕES EM ANDAMENTO (R125) — uma barra por obra, duas linhas por
   * barra: quem (cliente) e quanto (o rótulo do progresso), e o prazo.
   *
   * O PREENCHIMENTO é o REAL (fases concluídas, R120); a MARCA fina é o
   * PLANO (dias úteis decorridos). Sem cronograma a barra mostra o plano e o
   * rótulo diz "% do período" — é plano, e diz que é. Sem período, "sem
   * período" e barra vazia: ninguém afirmou quando a obra acaba, e a tela não
   * inventa. A conta inteira é `progressoDaObra` (implantacao/modelo.ts).
   *
   * TRÊS ESTADOS DA CONSULTA DE PROGRESSO, e o erro vem antes do vazio (lição
   * da U86): a LISTA de obras vem dos chamados já carregados e aparece sempre;
   * o que a consulta própria pode não trazer é o progresso — e aí a linha
   * mostra "—" e o rodapé diz por quê, em vez de uma barra vazia fingindo zero.
   */
  const PainelObras = () => {
    const visiveis = obras.slice(0, TETO_OBRAS);
    return (
      <div
        className="elevavel"
        style={{ ...PAINEL, height: ALTURA_DUPLA, flex: `2 1 ${BASE_OBRAS}px`, minWidth: 250 }}
      >
        <Cabeca
          titulo="Implantações em andamento"
          direita={obras.length > TETO_OBRAS ? (
            <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, whiteSpace: "nowrap" }}>
              top {TETO_OBRAS} de {obras.length}
            </span>
          ) : undefined}
        />
        {visiveis.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontSize: 11.5, color: verde, lineHeight: 1.45 }}>
            Nenhuma implantação em andamento.
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
            {visiveis.map((c: any, i) => {
              const resumo = resumoDasObras.data?.[c.id];
              const progresso = resumo
                ? progressoDaObra({ inicio: resumo.inicio, fim: resumo.fim }, resumo.fases, hoje)
                : null;
              const pct = progresso ? preenchimentoDaBarra(progresso) : null;
              const passo = i % PECAS_ESPECTRO;
              const atrasada = progresso?.atrasada ?? false;
              return (
                <button
                  key={c.id}
                  onClick={() => setPainelId(c.id)}
                  className="hover-suave"
                  title={`${c.titulo}${c.numero ? ` · ${c.numero}` : ""} — clique para abrir`}
                  style={{
                    display: "flex", flexDirection: "column", gap: 3, padding: "4px 6px",
                    borderRadius: 8, border: "none", background: "transparent", cursor: "pointer",
                    textAlign: "left", color: textPrimary, font: "inherit", minWidth: 0, flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.cliente?.nome ?? c.cliente_origem_nome ?? c.titulo}
                    </span>
                    {c.prazo_limite && (
                      <span style={{ fontFamily: FONT, fontSize: 10, whiteSpace: "nowrap", color: atrasada ? vermelho : textSecondary }}>
                        {textoPrazo(c.prazo_limite, agora)}
                      </span>
                    )}
                    <span style={{
                      fontFamily: FONT, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                      color: espectroTexto(passo, isLight), fontVariantNumeric: "tabular-nums",
                    }}>
                      {resumoDasObras.isError ? "—" : progresso ? rotuloDoProgresso(progresso) : "…"}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 6, borderRadius: 3, overflow: "hidden", background: trilho }}>
                    {pct !== null && (
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: gradienteBarra(espectro(passo, isLight), espectro(passo + 1, isLight), isLight),
                      }} />
                    )}
                    {/* a marca do PLANO só aparece quando a barra pinta o REAL —
                        sobre o próprio plano ela seria o fim da barra */}
                    {progresso && progresso.pctReal !== null && progresso.pctPlano !== null && (
                      <div
                        title={`plano: ${progresso.pctPlano}% do período`}
                        style={{
                          position: "absolute", top: 0, bottom: 0, width: 2,
                          left: `calc(${progresso.pctPlano}% - 1px)`,
                          background: textPrimary, opacity: 0.7,
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
            {resumoDasObras.isError && (
              <span style={{ fontFamily: FONT, fontSize: 10, color: vermelho, lineHeight: 1.3 }}>
                Progresso indisponível: {(resumoDasObras.error as Error).message}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <PainelBase numeros={[]} atalhos={ATALHOS} isAdmin={cargo === "admin"}>
      {/* ══ O DASHBOARD ═══════════════════════════════════════════════════
          Três colunas (R125): "Abertos por cliente" à ESQUERDA com as duas
          faixas de altura; as duas faixas no MEIO; "Implantações em
          andamento" à DIREITA, também com as duas faixas. As bases de largura
          somam 1116 ≤ 1134 (o orçamento lá em cima); abaixo disso quebra a
          coluna da direita — e é ela que quebra, não as faixas, porque quebrar
          as faixas descolaria as alturas dos dois painéis altos. */}
      {painelAberto && (
      <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* R68/R125 — quem está pedindo mais. Só clientes COM chamado aberto
            entram — é o Map de `abertosPorCliente` que garante isso, sem
            precisar cruzar com a lista de clientes. Altura derivada de
            ALTURA/GAP, nunca digitada: ele tem de terminar exatamente onde a
            faixa 2 termina. */}
        <Ranking
          titulo="Abertos por cliente"
          prefixo="op-cli"
          dados={clientesComAberto}
          sufixo="em aberto"
          altura={ALTURA_DUPLA}
          teto={TETO_BARRAS_ALTO}
          estilo={{ flex: `0 1 ${BASE_CLIENTES}px`, minWidth: BASE_CLIENTES }}
          vazio={<span style={{ color: verde }}>Nenhum chamado em aberto.</span>}
        />

        <div style={{ flex: `3 1 ${BASE_MEIO}px`, minWidth: 0, display: "flex", flexDirection: "column", gap: GAP }}>

        {/* ══ FAIXA 1 — os números de cabeça, o estado da fila, dinheiro e conferência ══ */}
        <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* os 4 KPIs em 2 colunas de 2, clicáveis */}
          <div style={{
            width: LARGURA_KPIS, flexShrink: 0, height: ALTURA, display: "grid",
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
                    fontFamily: FONT, fontWeight: 600, fontSize: 8, letterSpacing: "0.05em",
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
              gráfico. Identidade nunca só pela cor. R125: mais estreita — o
              arco encolheu de 118 para 100px e a legenda corta com reticências
              (o nome inteiro está no tooltip do arco). */}
          <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: LARGURA_FILA }}>
            <Cabeca
              titulo={corteDaRosca === "status" ? "Fila por status" : "Fila por tipo"}
              direita={
                <span style={{ display: "flex", gap: 4 }}>
                  {(["status", "tipo"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCorteDaRosca(c)}
                      aria-pressed={corteDaRosca === c}
                      className="hover-suave"
                      style={{
                        height: 20, padding: "0 8px", borderRadius: 10, cursor: "pointer",
                        fontFamily: FONT, fontSize: 9.5, fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        background: corteDaRosca === c
                          ? (isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)")
                          : "transparent",
                        color: corteDaRosca === c ? textPrimary : textSecondary,
                        border: corteDaRosca === c
                          ? `1px solid ${isLight ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.18)"}`
                          : "1px solid transparent",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </span>
              }
            />
            {roscaComRotulo.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontSize: 11.5, color: verde }}>
                Nenhum chamado em aberto.
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ position: "relative", width: 100, height: "100%", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>{gradientesEspectro("op-fila", roscaComRotulo.length, isLight)}</defs>
                      <Pie
                        data={roscaComRotulo} dataKey="valor" nameKey="nome"
                        innerRadius={29} outerRadius={45}
                        stroke={superficie} strokeWidth={2} isAnimationActive={false}
                      >
                        {roscaComRotulo.map((f, i) => (
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
                      fontFamily: FONT, fontWeight: 700, fontSize: 16,
                      fontVariantNumeric: "tabular-nums", color: textPrimary, lineHeight: 1,
                    }}>
                      {ind.abertos}
                    </span>
                    <span style={{ ...MICRO, fontSize: 7, color: textSecondary, marginTop: 2 }}>em aberto</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  {roscaComRotulo.map((f, i) => {
                    const passo = i % PECAS_ESPECTRO;
                    return (
                      <div key={f.nome} style={{ display: "flex", alignItems: "center", gap: 5 }} title={`${f.nome} · ${f.valor}`}>
                        <span style={{
                          width: 9, height: 9, borderRadius: 2.5, flexShrink: 0,
                          background: gradienteBarra(espectro(passo, isLight), espectro(passo + 1, isLight), isLight),
                        }} />
                        <span style={{
                          flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 10, color: textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {f.nome}
                        </span>
                        {/* o número na rampa de TEXTO, não na de preenchimento:
                            o miolo amarelo claro não passa de 4.5:1 sobre branco */}
                        <span style={{
                          fontFamily: FONT, fontSize: 10, fontWeight: 700,
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

          {/* R125 — a coluna de DINHEIRO e CONFERÊNCIA: dois quadrados
              empilhados, irmãos dos tiles do 2×2. O de dinheiro só existe
              para quem vê valores (R13) — para o SAC a coluna tem um quadrado
              só, e o de conferência ocupa a altura inteira. */}
          <div style={{
            width: LARGURA_TILES, flexShrink: 0, height: ALTURA, display: "grid",
            gridTemplateRows: veFinanceiro ? "1fr 1fr" : "1fr", gap: 10, boxSizing: "border-box",
          }}>
            {veFinanceiro && (
              <Tile
                rotulo="A cobrar este mês"
                compacto
                valor={cobrancasMes.isError ? "—" : cobrancasMes.isLoading ? "…" : moedaCurta(aCobrar.total)}
                sub={cobrancasMes.isError
                  ? "erro ao ler"
                  : cobrancasMes.isLoading
                    ? undefined
                    : `${aCobrar.quantidade} a faturar · ${aCobrar.emAberto} em aberto`}
                cor={verde}
                title={cobrancasMes.isError
                  ? `Não consegui ler as cobranças: ${(cobrancasMes.error as Error).message}`
                  : `${moeda(aCobrar.total)} a faturar na competência ${competenciaAtual} (R161: faturadas e canceladas ficam fora — ${aCobrar.faturadas} já faturada(s), ${moeda(aCobrar.totalFaturado)}) · ${moeda(aCobrar.totalEmAberto)} ainda fora de fechamento — clique para ir aos Fechamentos`}
                aoClicar={() => navigate({ to: "/fechamentos" })}
              />
            )}
            <Tile
              rotulo="Aguardando conferência"
              valor={String(aguardandoConferencia)}
              sub="concluídos sem decisão"
              cor={pessego}
              ativo={kpiAtivo === "aguardando_conferencia"}
              title={`${aguardandoConferencia} — clique para filtrar a lista abaixo`}
              aoClicar={() => {
                // não é subconjunto de "em aberto" — a lente não importa aqui,
                // mas a visão tem de ser a LISTA (o quadro não tem esta coluna)
                setVisao("lista");
                setKpiAtivo(kpiAtivo === "aguardando_conferencia" ? null : "aguardando_conferencia");
              }}
            />
          </div>
        </div>

        {/* ══ FAIXA 2 — quem faz o quê, semana a semana ═══════════════════════ */}
        <div style={{ display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* Atividades por equipe de campo ao longo do tempo — Davi, 2026-08-22:
              "cada item vertical é uma semana. Deve ser um gráfico de linhas".
              R125: oito semanas, não doze.

              As linhas correm na RAMPA (R68): cada equipe ganha um passo do
              degradê, e o traço dela vai da sua cor à da seguinte. O botão que
              CADASTRA equipe mora aqui, no cabeçalho do gráfico que mostra
              equipes — botão de manutenção pertence à peça que ele mantém. */}
          <div className="elevavel" style={{ ...PAINEL, flex: 1, minWidth: 396 }}>
            <Cabeca
              titulo={`Atividades por equipe · ${SEMANAS_NO_GRAFICO} semanas`}
              direita={
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {semDuplaNaJanela > 0 && (
                    <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, whiteSpace: "nowrap" }}>
                      {semDuplaNaJanela} fora de equipe
                    </span>
                  )}
                  {/* R296 (15/09/2026): o botão "Equipes" SAIU daqui e foi para a
                      barra de ferramentas. Ele era a ÚNICA porta da janela de
                      equipes, e o recolher da faixa de indicadores o levava junto
                      — medido: 1 com a faixa aberta, ZERO com ela recolhida, e a
                      preferência fica gravada. O que continua aqui é o aviso de
                      quem está fora de equipe: isso é leitura do gráfico. */}
                </span>
              }
            />
            {duplasDoGrafico.length === 0 ? (
              <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                textAlign: "center", fontFamily: FONT, fontSize: 11.5, color: textSecondary,
                lineHeight: 1.5, padding: "0 20px",
              }}>
                Nenhuma equipe de campo com escala nestas semanas — cadastre e escale em{" "}
                <strong style={{ color: gold, fontWeight: 600 }}>Equipes</strong>{" "}
                para ver quem sai com quem ao longo do tempo.
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serieDuplas} margin={{ left: 0, right: 10, top: 2, bottom: 0 }}>
                    {/* userSpace: linha toda no zero tem caixa de altura zero,
                        e degradê em objectBoundingBox não desenha sobre caixa
                        de área nula — a linha sumiria na semana sem trabalho */}
                    <defs>{gradientesEspectro("op-dupla", duplasDoGrafico.length, isLight, true)}</defs>
                    <CartesianGrid stroke={grade} />
                    <XAxis dataKey="semana" tick={eixo} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} width={22} />
                    <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                    <Legend
                      wrapperStyle={{ fontFamily: FONT, fontSize: 10, color: textSecondary }}
                      iconSize={8}
                      formatter={(v: string) => {
                        const d = duplasDoGrafico.find((x) => x.id === v);
                        return d
                          ? rotuloDaComposicao(d, composicaoDaDupla(d.id, semanaDaLegenda, escala), nomeDeTecnico)
                          : v;
                      }}
                    />
                    {duplasDoGrafico.map((d, i) => {
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
        </div>
        </div>

        {/* R125 — "o principal": as implantações em andamento, uma barra por
            obra, com a altura das duas faixas. */}
        <PainelObras />
      </div>
      )}

      {semDados && painelAberto && (
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
          {/* R296 — o eixo do quadro numa PÍLULA com menu, não em quatro
              botões. Quatro botões lado a lado é a barra dizendo que os quatro
              modos pesam igual; o `estado` é o padrão da R76, e os outros três
              são lentes que se procura. Só no quadro — na lista seria controle
              inerte, e controle inerte é pior que controle ausente.

              Desmarcar no menu devolve ao `estado`: o quadro não tem como não
              ter eixo, e voltar ao padrão é a leitura certa do gesto. */}
          {visao === "kanban" && (
            <MenuFiltro
              rotulo="Colunas"
              larguraMenu={260}
              opcoes={(["estado", "status", "equipe", "dia"] as EixoDoQuadro[]).map((e) => ({
                valor: e, label: EIXO_LABEL[e], nota: EIXO_NOTA[e],
              }))}
              selecionados={[eixoDoQuadro]}
              onMudar={(v) => setEixoDoQuadro((v[0] as EixoDoQuadro) ?? "estado")}
            />
          )}
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
                    // R296: 40px e raio 11 — a medida MEDIDA na barra da Início,
                    // onde as pílulas de filtro têm exatamente isso. Antes eram
                    // ~26px pelo padding, ao lado de botões de 28: dois pisos na
                    // mesma linha, que foi o que o Davi viu como "desalinhados".
                    display: "inline-flex", alignItems: "center",
                    height: 40, padding: "0 13px", borderRadius: 11, flexShrink: 0, cursor: "pointer",
                    border: ativa ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                    background: ativa ? GRAD_PRIMARIA : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                    color: ativa ? SOBRE_PRIMARIA : textPrimary,
                    fontFamily: FONT, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap",
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
          {/* R296 — O GRUPO DA DIREITA, na ordem da Início: o que a ordem está
              fazendo, ordenar, recolher, trocar de vista, criar. Todos 42×42,
              a medida de lá. Um bloco só, encostado à direita por `marginLeft:
              auto`, em vez de cinco controles espalhados pela linha. */}
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
            flexShrink: 0, flexWrap: "wrap",
          }}>
            <button
              onClick={() => navigate({ to: "/chamados/painel" })}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: gold, fontFamily: FONT, fontWeight: 600, fontSize: 11.5, padding: 0,
              }}
            >
              Ver todos os chamados →
            </button>

            {/* o rótulo da ordem EM VIGOR. A Início o tem pelo mesmo motivo: a
                ordem padrão é uma que ninguém escolheu, e uma lista ordenada
                por critério invisível parece ordenada por nada. */}
            {visao === "lista" && (
              <span
                className="so-desktop"
                aria-live="polite"
                style={{ fontFamily: FONT, fontSize: 11.5, whiteSpace: "nowrap", color: textSecondary }}
              >
                {ORDENS_DE_CAMPO.find((o) => o.valor === ordem)?.label ?? ""}
              </span>
            )}

            {/* R296 — ORDENAR. A tela nunca teve: a lista vinha na ordem em que
                o banco devolveu, que muda sozinha. As opções NÃO são as da
                Início: metade das de lá é por PRAZO, e a R284 tirou o prazo do
                chamado de campo (ver ORDENS_DE_CAMPO). */}
            {visao === "lista" && (
              <MenuFiltro
                rotulo="Ordenar"
                icone={ArrowUpDown}
                larguraMenu={270}
                opcoes={ORDENS_DE_CAMPO.map((o) => ({ valor: o.valor, label: o.label, nota: o.nota }))}
                selecionados={[ordem]}
                onMudar={(v) => setOrdem(v[0] ?? ORDEM_DE_CAMPO_PADRAO)}
              />
            )}

            {/* R296 (15/09/2026) — a porta das EQUIPES. Ela mora na barra, e não
                no cabeçalho de um gráfico, por um motivo medido: o recolher desta
                mesma regra escondia a única porta que havia. Montar equipe é
                gesto de gestão, e gesto de gestão não pode depender de um painel
                de leitura estar aberto. */}
            <button
              onClick={() => setDuplasAberto(true)}
              title="Equipes de campo"
              aria-label="Abrir as equipes de campo"
              style={BOTAO_DA_BARRA(isLight, textPrimary)}
            >
              <Users size={17} />
            </button>
            {/* R296 — o recolher da faixa de indicadores. Fica NESTA barra, e
                não junto dos gráficos, pelo mesmo motivo da Início: é daqui que
                se trabalha, e o botão tem de estar onde a mão já está.

                RECOLHER LIMPA O KPI ATIVO, de propósito. Os quadrados são
                controles de filtro (R125) — esconder o controle deixando o
                filtro ligado é o defeito que a U94 consertou no calendário: a
                lista recortada por um controle que não está mais na tela. */}
            <button
              onClick={() => setPainelAberto((v) => { if (v) setKpiAtivo(null); return !v; })}
              aria-pressed={!painelAberto}
              title={painelAberto ? "Recolher os indicadores" : "Mostrar os indicadores"}
              aria-label={painelAberto ? "Recolher a faixa de indicadores" : "Mostrar a faixa de indicadores"}
              style={BOTAO_DA_BARRA(isLight, textPrimary)}
            >
              {painelAberto ? <ChevronsDownUp size={17} /> : <ChevronsUpDown size={17} />}
            </button>

            {/* R76/R296 — o alternador, agora UM botão que mostra o DESTINO,
                como na Início e em /chamados. O quadro é uma segunda LEITURA da
                mesma fila, não outro conteúdo.

                Ir para o quadro LIMPA o KPI: lente e KPI recortam subconjuntos
                de "em aberto" e esvaziariam colunas que têm chamado. */}
            <button
              onClick={() => setVisao((v) => {
                const proximo = v === "lista" ? "kanban" : "lista";
                if (proximo === "kanban") setKpiAtivo(null);
                return proximo;
              })}
              title={visao === "lista" ? "Ver como quadro" : "Ver como lista"}
              aria-label={visao === "lista" ? "Ver como quadro" : "Ver como lista"}
              style={BOTAO_DA_BARRA(isLight, textPrimary)}
            >
              {visao === "lista" ? <LayoutGrid size={17} /> : <List size={17} />}
            </button>

            {/* R126 — o "+": abre chamado técnico sem sair da tela, como na
                Início (R91). Some para quem não pode abrir chamado (a matriz de
                permissões manda; botão para porta trancada é armadilha). */}
            {podeVer("chamados.novo") !== false && (
              <button
                onClick={() => setNovoAberto(true)}
                title="Abrir chamado técnico"
                aria-label="Abrir chamado técnico"
                style={{
                  ...goldButton(), width: 42, height: 42, borderRadius: 12, padding: 0, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Plus size={17} />
              </button>
            )}
          </div>
        </div>

        {visao === "kanban" ? (
          <div className="kanban-op" style={{ flex: 1, minHeight: 0 }}>
            {colunas.map((coluna) => {
              const col = coluna.chave as ColunaOperacional;
              const itens = coluna.itens as any[];
              // a cor só existe no eixo de ESTADO, que é o único com
              // vocabulário de cor próprio (R76). Nos outros o filete é
              // neutro: inventar cor por equipe ou por dia faria a tela
              // dizer um significado que a casa não tem.
              const cor = CORES_COLUNA[col] ?? (isLight ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)");
              return (
                <div key={coluna.chave} className="kanban-op-coluna">
                  {/* cabeçalho da coluna: nome, contagem e um filete na cor
                      dela — o mesmo vocabulário de estado do resto do app */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                    padding: "0 2px 8px",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: cor, flexShrink: 0 }} />
                    <span style={{ ...MICRO, color: cor }}>{coluna.titulo}</span>
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
                      // R295: a data que o ESTADO pede, e o rótulo que diz
                      // o que ela é — "14/09 08:00" sozinho não distingue
                      // "vai começar" de "começou".
                      const momento = momentoDoCard(c);
                      const equipeDoCard = c.responsavel_id
                        ? duplas.find((d) => d.id === duplaDaPessoaNaSemana(
                            c.responsavel_id,
                            referenciaSemanal(new Date(c.data_hora_agendada ?? c.created_at ?? agora)),
                            escala,
                          ))?.nome ?? null
                        : null;
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
                            {/* R295: o TIPO DE DEMANDA, que o Davi pediu e o
                                card não tinha — sem ele, corretiva e
                                preventiva são o mesmo retângulo. */}
                            <span style={{
                              fontFamily: FONT, fontSize: 9.5, whiteSpace: "nowrap",
                              color: textSecondary,
                            }}>
                              {TIPO_LABEL[c.tipo as ChamadoTipo] ?? c.tipo ?? "—"}
                            </span>
                          </div>

                          {/* a linha de QUEM e QUANDO. A equipe entra ao lado
                              do técnico porque é ela que sai no carro (R100) —
                              e some quando o eixo JÁ é equipe, para o card não
                              repetir o nome da coluna em que está. */}
                          <div style={{
                            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                            fontFamily: FONT, fontSize: 10,
                            color: col === "atrasado" ? vermelho : textSecondary,
                          }}>
                            <span style={{ whiteSpace: "nowrap" }}>
                              {c.responsavel_id ? nomeTecnico.get(c.responsavel_id) ?? "Técnico" : "Sem técnico"}
                            </span>
                            {equipeDoCard && eixoDoQuadro !== "equipe" && (
                              <span style={{ whiteSpace: "nowrap" }}>· {equipeDoCard}</span>
                            )}
                            {momento.inicio && (
                              <span style={{ whiteSpace: "nowrap", marginLeft: "auto" }}>
                                {/* R295: a data SECA não ganha horário inventado. O
                                    `T00:00:00` que `momentoDoCard` devolve existe para
                                    a ordenação; imprimir "00:00" seria o card prometendo
                                    uma hora que ninguém combinou. */}
                                {momento.rotulo}{" "}
                                {new Date(momento.inicio).toLocaleString("pt-BR",
                                  momento.temHora
                                    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                                    : { day: "2-digit", month: "2-digit" })}
                                {momento.fim && ` → ${new Date(momento.fim).toLocaleString("pt-BR",
                                  momento.temHora
                                    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                                    : { day: "2-digit", month: "2-digit" })}`}
                              </span>
                            )}
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

      <DialogoEquipes aberto={duplasAberto} aoFechar={() => setDuplasAberto(false)} />

      {/* R126 — o chamado nasce aqui e desliza no painel lateral (R33): quem
          abriu dez chamados continua olhando a mesma fila. */}
      <NovoChamadoTecnicoDialog
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        aoCriar={(id) => { setNovoAberto(false); setPainelId(id); }}
      />

      <PainelChamado
        chamadoId={painelId}
        aoFechar={() => setPainelId(null)}
        aoAbrirPagina={(id) => { setPainelId(null); navigate({ to: "/chamados/$id", params: { id } }); }}
      />
    </PainelBase>
  );
}
