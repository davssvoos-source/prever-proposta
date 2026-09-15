// Painel Operacional Técnica — R27, na anatomia da Início (R67), no degradê
// dela (R68), recortado pela equipe técnica (R95) e reorganizado para as três
// perguntas do Vinicius (R125): o que cada equipe faz, como está cada
// implantação, quanto vai ser cobrado no mês.
//
// R299 (15/09/2026): O DASHBOARD SAIU DAQUI. Davi: "O Dashboard e KPIs da
// página Operacional Técnica trocarão de lugar, agora deverão estar em
// 'Gestão Técnica'". Ele vive em features/paineis/DashboardOperacional.tsx e
// é montado pela Gestão Técnica; o clique num KPI de lá chega aqui por
// `?kpi=` e recorta a lista com a MESMA função (chamadosDoKpi) — a
// invariante "quem conta é quem filtra" (DASHBOARD.md §7.2) atravessa a
// tela. O que sobrou desta página é a FILA: todos os chamados da equipe de
// campo (R301), em lista ou quadro.
//
// (o que segue é o retrato de antes da R299, mantido para quem procurar o
// porquê do desenho do dashboard — o desenho continua igual, só mudou de tela)
//
// A TELA TINHA DUAS PARTES, e só duas: o dashboard em cima, a lista no resto.
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
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Plus, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado, usePermissoes } from "@/features/gerencial/permissoes";
import { useUserCargo, useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza, usePessoas, mapaDePessoas } from "@/features/chamados/data";
import { PainelChamado } from "@/features/chamados/PainelChamado";
import { NovoChamadoTecnicoDialog } from "@/features/chamados/NovoChamadoTecnicoDialog";
import { useApoiosDeTodos } from "@/features/home/data";
import { TabelaAtividades } from "@/features/home/TabelaAtividades";
import { MenuFiltro } from "@/features/home/MenuFiltro";
// `lugarNoCalendario`: a MESMA conta do calendário decide em que DIA o card
// cai no eixo por dia do quadro (P57). Duas contas fariam as duas telas
// discordarem sobre a mesma atividade — que foi exatamente o defeito da P57.
import { atividadeDoChamado, lugarNoCalendario, type Atividade } from "@/features/atividades/modelo";
import { useDuplas, useEscala } from "@/features/duplas/data";
import { montarEscala, duplaDaPessoaNaSemana } from "@/features/duplas/modelo";
import { chamadoStatusInfo, TIPO_LABEL, STATUS_ORDEM, type ChamadoTipo } from "@/lib/chamado-status";
import { referenciaSemanal, inicioSemana, dataIso } from "@/lib/periodos";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton, botaoDaBarra } from "@/lib/ui";
import { PRISMA, PRIMARIA, GRAD_PRIMARIA, SOBRE_PRIMARIA } from "@/lib/paleta";
import {
  chamadosDoKpi, KPI_OPERACIONAL_ORDEM, KPI_OPERACIONAL_LABEL, type ChaveKpiOperacional,
  ordenarChamados, ordenarHistorico,
  chamadosDaLente, LENTE_ORDEM, LENTE_LABEL, type LenteLista,
  agruparPorColuna, type ColunaOperacional,
  colunasDoQuadro, EIXO_LABEL, EIXO_NOTA, momentoDoCard, type EixoDoQuadro,
  ORDENS_DE_CAMPO, ORDEM_DE_CAMPO_PADRAO, ordenarCampo,
} from "@/features/paineis/indicadores";
import { PainelBase, type AtalhoPainel } from "@/features/paineis/PainelBase";
// R301 C: o pop-up de re-agendar · desmarcar · cancelar do card do quadro.
import { AcoesDoCard } from "@/features/paineis/AcoesDoCard";
export const Route = createFileRoute("/_authenticated/painel/operacional")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.operacional");
    if (!ok) throw redirect({ to: destinoNegado("painel.operacional") as any });
  },
  // R299: o KPI clicado na Gestão Técnica chega por aqui. Entrada de URL é
  // entrada de usuário — valor fora da lista cai em "nenhum", e a tela abre
  // como sempre abre.
  // A chave é OPCIONAL no tipo (`{}` quando não há), e não `kpi: undefined`:
  // com a chave obrigatória, todo `redirect`/`Link` para esta rota passaria
  // a exigir `search` — o tsc pegou no redirect da chamados.painel.
  validateSearch: (s: Record<string, unknown>): { kpi?: ChaveKpiOperacional } =>
    typeof s.kpi === "string" && KPIS_DA_URL.has(s.kpi) ? { kpi: s.kpi as ChaveKpiOperacional } : {},
  component: PainelOperacional,
});

/** Os KPIs que a URL pode pedir: os quatro do 2×2 e o quinto (conferência). */
const KPIS_DA_URL = new Set<string>([...KPI_OPERACIONAL_ORDEM, "aguardando_conferencia"]);

// Os 4 atalhos ("Ir para") SAÍRAM na R58: todos eram itens do menu lateral, e
// o atalho repetia embaixo o que já está sempre visível à esquerda.
const ATALHOS: AtalhoPainel[] = [];

/** Teto da tabela — o mesmo da Início. */
const TETO_TABELA = 200;

/** R296: a ordem escolhida também é preferência — quem ordena por cliente
 *  ordena por cliente todo dia. */
const CHAVE_ORDEM_OP = "prever-operacional-ordem";

/**
 * R301: a VISÃO, o EIXO do quadro e a LENTE da lista também são preferência
 * da pessoa. Davi (15/09/2026): "Caso o usuário altere os filtros, ou tipo de
 * visualização, o sistema deve deixar salvo no cache, ou no PC do usuário
 * para que quando ele volte lá, esteja com os mesmos filtros e modo de
 * visualização." Uma chave por coisa, ao lado da ordem (R296) — nunca um
 * objeto só: mudar o formato de uma não pode apagar as outras.
 */
const CHAVE_VISAO_OP = "prever-operacional-visao";
const CHAVE_EIXO_OP = "prever-operacional-eixo";
const CHAVE_LENTE_OP = "prever-operacional-lente";

/**
 * Lê uma preferência gravada, aceitando SÓ valores da lista — o localStorage
 * é entrada de usuário como a URL, e um valor de uma versão antiga do app
 * (ou digitado à mão) cai no padrão em vez de quebrar a tela.
 */
function lerPreferencia<T extends string>(chave: string, validos: readonly T[], padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v !== null && (validos as readonly string[]).includes(v) ? (v as T) : padrao;
  } catch {
    return padrao;   // modo privado
  }
}

function PainelOperacional() {
  const navigate = useNavigate();
  const { data: cargo } = useUserCargo();
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
  const [novoAberto, setNovoAberto] = useState(false);
  const [painelId, setPainelId] = useState<string | null>(null);
  // R301 C: qual card está com o pop-up de ações aberto, e o botão que o abriu
  const [acoesDe, setAcoesDe] = useState<{ id: string; ancora: HTMLElement } | null>(null);
  // qual quadrado de KPI está filtrando a lista agora — null = nenhum, e a
  // lista mostra a lente inteira. "aguardando_conferencia" também mora aqui
  // (R125): é o quinto recorte, fora do 2×2 mas na mesma função.
  const [kpiAtivo, setKpiAtivo] = useState<ChaveKpiOperacional | null>(null);
  // R73: a lente da lista. "Em aberto" é o padrão (esta é a tela de quem
  // coordena o dia); "Concluídos" e "Todos" existem porque o histórico —
  // as 227 OS retroativas, por exemplo — não tinha onde ser visto.
  const [lente, setLente] = useState<LenteLista>(() => lerPreferencia(CHAVE_LENTE_OP, LENTE_ORDEM, "abertos"));
  // R76: lista ou quadro. O quadro mostra as quatro colunas de uma vez —
  // inclusive Concluídos —, então lente e KPI não valem nele: os dois
  // recortam para subconjuntos de "em aberto" e esvaziariam colunas.
  // R301: o QUADRO é o padrão — Davi: "O modo de visualização dos chamados
  // técnicos padrão deverá ser o modo Kanban, com visualização das colunas
  // por dia da semana."
  const [visao, setVisao] = useState<"lista" | "kanban">(() => lerPreferencia(CHAVE_VISAO_OP, ["lista", "kanban"] as const, "kanban"));
  // R295: por que eixo o quadro separa as colunas. `estado` continua a
  // primeira opção do menu e a leitura da R76; o PADRÃO passou a ser o DIA
  // (R301) — quem abre a tela vê a semana.
  const [eixoDoQuadro, setEixoDoQuadro] = useState<EixoDoQuadro>(() => lerPreferencia(CHAVE_EIXO_OP, ["estado", "status", "equipe", "dia"] as const, "dia"));
  // R296: a ordem da lista. Antes não havia nenhuma — a fila vinha na ordem
  // em que o banco devolveu, que muda sozinha entre duas visitas à tela.
  const [ordem, setOrdem] = useState<string>(() => {
    try { return localStorage.getItem(CHAVE_ORDEM_OP) ?? ORDEM_DE_CAMPO_PADRAO; } catch { return ORDEM_DE_CAMPO_PADRAO; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_ORDEM_OP, ordem); } catch { /* modo privado */ }
  }, [ordem]);
  // R301: visão, eixo e lente gravadas a cada mudança, como a ordem.
  useEffect(() => {
    try { localStorage.setItem(CHAVE_VISAO_OP, visao); } catch { /* modo privado */ }
  }, [visao]);
  useEffect(() => {
    try { localStorage.setItem(CHAVE_EIXO_OP, eixoDoQuadro); } catch { /* modo privado */ }
  }, [eixoDoQuadro]);
  useEffect(() => {
    try { localStorage.setItem(CHAVE_LENTE_OP, lente); } catch { /* modo privado */ }
  }, [lente]);

  // R299: o KPI que a Gestão Técnica mandou pela URL vira o recorte da lista
  // — a lente volta a "em aberto" e a visão à lista, exatamente o que o clique
  // no quadrado fazia quando ele morava aqui. A URL é LIMPA em seguida
  // (`replace`), para o F5 não recortar de novo uma lista que a pessoa já
  // tinha liberado com o "limpar".
  const busca = Route.useSearch();
  useEffect(() => {
    if (!busca.kpi) return;
    setLente("abertos");
    setVisao("lista");
    setKpiAtivo(busca.kpi);
    navigate({ to: "/painel/operacional", search: {} as any, replace: true });
  }, [busca.kpi]);

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
  /** 'AAAA-MM-DD' de hoje, para o progresso das obras — texto, não Date (fuso). */
  const hoje = useMemo(() => dataIso(agora), [agora]);
  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
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

  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
    whiteSpace: "nowrap",
  };
  const nomeTecnico = useMemo(
    () => new Map((tecnicos as any[]).map((t) => [t.id, t.nome as string])),
    [tecnicos],
  );
  const nomeCliente = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nome])),
    [clientes],
  );
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

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

  return (
    <PainelBase numeros={[]} atalhos={ATALHOS} isAdmin={cargo === "admin"}>
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

              Desmarcar no menu devolve ao `dia` (o padrão da R301): o quadro
              não tem como não ter eixo, e voltar ao padrão é a leitura certa
              do gesto. */}
          {visao === "kanban" && (
            <MenuFiltro
              rotulo="Colunas"
              larguraMenu={260}
              opcoes={(["estado", "status", "equipe", "dia"] as EixoDoQuadro[]).map((e) => ({
                valor: e, label: EIXO_LABEL[e], nota: EIXO_NOTA[e],
              }))}
              selecionados={[eixoDoQuadro]}
              onMudar={(v) => setEixoDoQuadro((v[0] as EixoDoQuadro) ?? "dia")}
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
            {/* R301 (15/09/2026): o botão "Ver todos" SAIU — Davi:
                "na tela 'Operacional Técnica' já deverão aparecer TODOS os
                chamados, então o botão levaria a uma tela com as mesmas
                informações". A tela /chamados/painel redireciona para cá. */}
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

            {/* R299 (15/09/2026): os botões EQUIPES e RECOLHER INDICADORES foram
                para a Gestão Técnica junto com o dashboard — "Mova também o
                botão de expandir e recolher o dashboard"; "O botão 'Equipes de
                Campo' […] deverá ser movido para a página 'Gestão Técnica'". */}
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
              style={botaoDaBarra(isLight, textPrimary)}
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
              // R301 — Davi: "Os textos dos dias da semana estão muito apagados,
              // deixe-os mais brancos, e o dia de hoje em amarelo." Nos eixos sem
              // vocabulário de cor (equipe, dia) o TÍTULO lê no texto primário —
              // o véu fica só no filete e no ponto; e HOJE ganha o dourado da
              // marca: o de TEXTO no claro (PRIMARIA.light, #A06108), o disco
              // #F8C811 no escuro.
              const eHoje = eixoDoQuadro === "dia" && coluna.chave === hoje;
              const dourado = isLight ? PRIMARIA.light : PRIMARIA.dark;
              const corDoTitulo = col in CORES_COLUNA ? cor : eHoje ? dourado : textPrimary;
              return (
                <div key={coluna.chave} className="kanban-op-coluna">
                  {/* cabeçalho da coluna: nome, contagem e um filete na cor
                      dela — o mesmo vocabulário de estado do resto do app */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                    padding: "0 2px 8px",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: eHoje ? dourado : cor, flexShrink: 0 }} />
                    <span style={{ ...MICRO, color: corDoTitulo }} aria-current={eHoje ? "date" : undefined}>{coluna.titulo}</span>
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
                        // <div role="button">, e não <button>: o botão de ações
                        // mora DENTRO do card, e botão dentro de botão é HTML
                        // inválido (o navegador desaninha e o clique vaza).
                        <div
                          key={c.id}
                          role="button"
                          tabIndex={0}
                          className="elevavel"
                          onClick={() => setPainelId(c.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPainelId(c.id); } }}
                          style={{
                            ...card(isLight), borderRadius: 12, padding: "9px 11px",
                            textAlign: "left", cursor: "pointer", color: textPrimary,
                            display: "flex", flexDirection: "column", gap: 4,
                            width: "100%", flexShrink: 0, boxSizing: "border-box",
                            // R301 C: o canto inferior direito é do botão de ações
                            position: "relative",
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
                            // reserva o canto para o botão de ações (26px + folga)
                            paddingRight: 30,
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

                          {/* R301 C — o botão circular de AÇÕES, discreto; o hover
                              dourado com glow é CSS (`.acao-do-card`, só com
                              ponteiro fino — R174: brilho é exceção e é feedback).
                              stopPropagation: o clique nele não abre o chamado. */}
                          <button
                            type="button"
                            className="acao-do-card"
                            aria-label={`Ações de ${c.titulo}`}
                            aria-haspopup="menu"
                            aria-expanded={acoesDe?.id === c.id}
                            title="Re-agendar, desmarcar ou cancelar"
                            onClick={(e) => {
                              e.stopPropagation();
                              // capturada AQUI: o React esvazia e.currentTarget ao fim do
                              // handler, e o updater pode rodar depois disso (medido: a
                              // âncora chegava null e o pop-up estourava em `.closest`)
                              const ancora = e.currentTarget;
                              setAcoesDe((atual) => (atual?.id === c.id ? null : { id: c.id, ancora }));
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {acoesDe && acoesDe.id === c.id && (
                            <AcoesDoCard
                              chamado={c}
                              ancora={acoesDe.ancora}
                              aoFechar={() => setAcoesDe(null)}
                              aoReagendar={() => setPainelId(c.id)}
                            />
                          )}
                        </div>
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
