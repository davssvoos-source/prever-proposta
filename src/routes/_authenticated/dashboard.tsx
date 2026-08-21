// Início — todas as atividades que envolvem o usuário, em duas visões.
// Regra ditada pelo Davi: "Na página home devem aparecer todas as atividades
// possíveis que envolvam o usuário. Crie visualizações diferentes com um botão
// seletor: lista com cards (atual) e kanban." E depois: "kanban principal pode
// ser por status. Podem ter botões com padrões de kanban: sprint este mês,
// outra opção é standby. Aí dá pra filtrar por responsável, por apoio, etc."
//
// O que mudou de estrutura em relação à Home antiga:
//
// · Era uma tela de VISITAS com dois apêndices de chamado para o técnico, e
//   quatro consultas independentes. Virou uma tela de ATIVIDADES: um array só
//   alimenta banner, lista e quadro, então o número do banner não pode
//   discordar do que está logo abaixo dele.
// · "Seus chamados" e "Suas demandas" eram dois blocos separados por tabela de
//   origem. Viraram uma fila só — que é o que foi pedido.
// · Os quatro tiles de métrica de visita saíram: liam `visitasExibidas`, que já
//   passara pelo filtro de status, então com um status escolhido três dos
//   quatro ficavam obrigatoriamente em zero. E ocupavam viewport que o quadro
//   não tem sobrando num aparelho de 667px.
// · O dropdown de status saiu: filtro de status sobre um quadro de status é
//   redundante, e era ele que quebrava as métricas.
//
// Ver docs/PRODUTO.md §9 e o registro da etapa em docs/PLANO_UNIFICACAO.md.

import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, KanbanSquare, List as ListIcon, Search, WifiOff } from "lucide-react";

import bannerAsset from "@/assets/banner-home.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD } from "@/lib/ui";
import { toast } from "sonner";
import { statusDaNatureza } from "@/lib/chamado-status";
import { normalizarTexto } from "@/lib/normalizar";
import { visitaRouteFor } from "@/lib/visita-route";
import { usePessoas, mapaDePessoas, useMinhaEquipe, useChamadosRealtime, atualizarChamado } from "@/features/chamados/data";
import { atividadesDeHoje, type Atividade, type ColunaQuadro } from "@/features/atividades/modelo";
import { useSessao, useAtividades } from "@/features/home/data";
import {
  aplicarLentes, ordenar, ordemDoPreset, focoDoPreset, presetsDoCargo, presetPadrao,
  semData, FILTROS_INICIAIS, type Filtros, type Vinculo, type Periodo,
} from "@/features/home/lentes";
import { CardAtividade } from "@/features/home/CardAtividade";
import { TabelaAtividades } from "@/features/home/TabelaAtividades";
import { PainelChamado } from "@/features/chamados/PainelChamado";
import { CampoBusca } from "@/features/home/CampoBusca";
import { GraficoDemanda, GraficoMeta, PainelKpis } from "@/features/home/Graficos";
import { CriarRapido } from "@/features/home/CriarRapido";
import { MenuFiltro } from "@/features/home/MenuFiltro";
import { Quadro } from "@/features/home/Quadro";
import { ProximaVisita, proximaVisitaDe } from "@/features/home/ProximaVisita";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Home,
});

const CHAVE_VISAO = "prever-home-visao";
const CHAVE_FILTROS = "prever-home-filtros";
/**
 * Teto de linhas da tabela. Mais alto que o dos cards (60) porque uma linha
 * custa muito menos que um card — e o ganho da tabela é justamente poder
 * varrer muita coisa de uma vez. Acima disto o navegador começa a engasgar na
 * rolagem, e o caminho certo passa a ser filtrar.
 */
const TETO_TABELA = 200;
const VINCULOS: { chave: Vinculo; label: string }[] = [
  { chave: "responsavel", label: "Responsável" },
  { chave: "apoio", label: "Apoio" },
  { chave: "autor", label: "Eu abri" },
];
const PERIODOS: { chave: Exclude<Periodo, null>; label: string }[] = [
  { chave: "hoje", label: "Hoje" },
  { chave: "semana", label: "Semana" },
  { chave: "mes", label: "Mês" },
];

function Home() {
  const navigate = useNavigate();
  /** chamado aberto no painel lateral (null = fechado) */
  const [painelId, setPainelId] = useState<string | null>(null);
  const location = useLocation();
  const { isLight } = useTheme();
  const qc = useQueryClient();

  const { data: sessao } = useSessao();
  const s = sessao ?? { userId: null, cargo: null };
  const gestor = s.cargo === "admin" || s.cargo === "comercial" || s.cargo === "sac";

  const [visao, setVisao] = useState<"lista" | "quadro">(() => {
    try {
      const v = localStorage.getItem(CHAVE_VISAO);
      return v === "quadro" ? "quadro" : "lista";
    } catch { return "lista"; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_VISAO, visao); } catch { /* modo privado */ }
  }, [visao]);

  // Os filtros sobrevivem a abrir e fechar um card. Antes só a rolagem do
  // quadro voltava: preset, vínculo, período e busca eram perdidos, e quem
  // tinha montado um recorte refazia tudo a cada card aberto.
  const [filtros, setFiltros] = useState<Filtros>(() => {
    try {
      const bruto = sessionStorage.getItem(CHAVE_FILTROS);
      return bruto ? { ...FILTROS_INICIAIS, ...JSON.parse(bruto) } : FILTROS_INICIAIS;
    } catch { return FILTROS_INICIAIS; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(CHAVE_FILTROS, JSON.stringify(filtros)); } catch { /* modo privado */ }
  }, [filtros]);
  const [buscaAberta, setBuscaAberta] = useState(() => !!filtros.busca);

  // o preset padrão depende do perfil, que chega depois — aplicado uma vez só
  const [presetInicializado, setPresetInicializado] = useState(false);
  useEffect(() => {
    if (presetInicializado || !s.cargo) return;
    const p = presetPadrao(s.cargo);
    // só aplica se a pessoa ainda não escolheu nada nesta sessão
    if (p) setFiltros((f) => (f.preset === null && !f.busca && !f.periodo && !f.vinculos.length
      ? { ...f, preset: p } : f));
    setPresetInicializado(true);
  }, [s.cargo, presetInicializado]);

  // Um relógio que anda. Antes era `useMemo(() => new Date(), [atividades])`:
  // congelava na primeira carga, e um chamado que vencia às 14h continuava
  // "no prazo" para quem tinha deixado a tela aberta desde as 13h.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { atividades, historico, visitas, carregando, erro } = useAtividades(s, filtros.pessoa, agora);
  useChamadosRealtime();
  useEffect(() => {
    // o canal compartilhado cobre `chamados`; a visita é fonte da Início
    // também, e sem isto aprovar ou reagendar não refletia mais aqui
    const canal = supabase
      .channel("home-visitas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas_tecnicas" }, () =>
        qc.invalidateQueries({ queryKey: ["dashboard-visitas"] }))
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [qc]);
  const { data: pessoas = [] } = usePessoas();
  const { data: minhaEquipe = null } = useMinhaEquipe();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

  const ctx = useMemo(() => ({ agora, minhaEquipe }), [agora, minhaEquipe]);

  const filtradas = useMemo(
    () => ordenar(aplicarLentes(atividades, filtros, ctx, normalizarTexto), ordemDoPreset(filtros.preset)),
    [atividades, filtros, ctx],
  );

  /**
   * O conjunto que alimenta os painéis do topo (U33).
   *
   * Duas diferenças em relação a `filtradas`, e as duas são deliberadas:
   *
   * 1. INCLUI O HISTÓRICO. O quadro poda encerrados com mais de 7 dias — é
   *    fila de trabalho, não arquivo. Mas "concluídos por semana" precisa de
   *    quatro semanas e "concluídas no mês" precisa do mês; com só 7 dias, as
   *    barras do passado seriam sempre menores que a verdade.
   *
   * 2. IGNORA O FILTRO DE PERÍODO. O gráfico JÁ É um eixo de tempo — oito
   *    semanas. Aplicar "hoje" nele deixaria uma barra em pé e sete zeradas,
   *    respondendo a pergunta errada. Os outros filtros (pessoa, vínculo,
   *    situação, busca, preset) valem todos: filtrar por Erik mostra as barras
   *    do Erik, que é exatamente o que o Davi pediu.
   */
  const paraPaineis = useMemo(() => {
    const vistos = new Set<string>();
    const uniao: Atividade[] = [];
    // a Home primeiro: a versão dela é a mais fresca das duas
    for (const a of [...atividades, ...historico]) {
      if (vistos.has(a.id)) continue;
      vistos.add(a.id);
      uniao.push(a);
    }
    return aplicarLentes(uniao, { ...filtros, periodo: null }, ctx, normalizarTexto);
  }, [atividades, historico, filtros, ctx]);
  // O banner precisa contar a MESMA população que o toque nele abre. Contando
  // o array cru, o técnico lia "41 atividades hoje", tocava, e caía numa lista
  // de 1 — porque o preset "Meu dia" recorta por responsável e apoio.
  // quantos o período está escondendo por não terem data — some calado seria
  // a pior falha desta tela, e o número é o que torna a escolha auditável
  const ocultosSemData = useMemo(() => {
    if (!filtros.periodo) return 0;
    const semPeriodo = aplicarLentes(atividades, { ...filtros, periodo: null }, ctx, normalizarTexto);
    return semPeriodo.filter(semData).length;
  }, [atividades, filtros, ctx]);

  const hoje = useMemo(
    () => atividadesDeHoje(atividades.filter((a) => a.souResponsavel || a.souApoio), agora),
    [atividades, agora],
  );
  const proxima = useMemo(() => proximaVisitaDe(visitas, s.userId), [visitas, s.userId]);
  const presets = useMemo(() => presetsDoCargo(s.cargo), [s.cargo]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // Alvo de 40px: o app trava o zoom e quem opera está de luva. Os chips
  // antigos tinham ~31px de altura, o que dá erro de toque — e cada erro aqui
  // TROCA o que está na tela.
  const chip = (ativo: boolean): CSSProperties => ({
    minHeight: 40,
    padding: "0 15px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo ? GOLD_GRAD : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  const botaoIcone: CSSProperties = {
    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  };



  /**
   * Clicar num cartão abre o PAINEL de propriedades, não outra página.
   *
   * Quem varre a fila está comparando cartões: sair da Início e voltar perde
   * filtro, rolagem e a coluna onde a pessoa estava. O painel deixa o quadro
   * atrás vivo — e a página completa (execução, fotos, assinatura) continua a
   * um botão de distância, no cabeçalho do painel.
   *
   * A VISITA é a exceção: o cartão dela abre o fluxo da proposta direto. O
   * estado da visita decide qual tela é a certa (`visitaRouteFor`), e cair nas
   * propriedades da capa quando se quer orçar seria um desvio no meio do
   * trabalho. O painel dela existe pelo botão, dentro do fluxo.
   */
  function abrir(a: Atividade) {
    if (a.fonte === "visita") {
      const v = visitas.find((x) => x.id === a.registroId);
      navigate({ ...visitaRouteFor((v?.status ?? "pendente") as any, a.registroId), state: { from: location.pathname } } as any);
    } else {
      setPainelId(a.registroId);
    }
  }

  /** Do painel para a página completa — leva o id e fecha o painel. */
  function abrirPagina(id: string) {
    setPainelId(null);
    navigate({ to: "/chamados/$id", params: { id } });
  }

  /**
   * Soltar um card noutra coluna muda o STATUS. A tela valida o que consegue
   * (vocabulário da natureza); o resto é do banco — o trigger carimba as
   * datas da transição e a RLS pode recusar (técnico não conclui chamado de
   * campo). A recusa vira toast e o refetch devolve o card.
   */
  async function moverAtividade(a: Atividade, para: ColunaQuadro) {
    if (para === "sem_status") return;
    const natureza = a.natureza ?? "campo";
    if (!statusDaNatureza(natureza).includes(para as any)) {
      toast.error(`"${a.natureza === "interno" ? "Interno" : "De campo"}" não tem o status desta coluna.`);
      return;
    }
    try {
      await atualizarChamado(a.registroId, { status: para as any });
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(para === "concluido"
        ? "Concluir este chamado é ato do gestor."
        : msg || "Não consegui mover o chamado.");
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
    }
  }

  function trocarVinculo(v: Vinculo) {
    setFiltros((f) => ({
      ...f,
      vinculos: f.vinculos.includes(v) ? f.vinculos.filter((x) => x !== v) : [...f.vinculos, v],
    }));
  }

  // composição do banner: o número sozinho não é auditável
  const composicao = useMemo(() => {
    const partes: string[] = [];
    const ch = hoje.filter((a) => a.fonte === "chamado").length;
    const vi = hoje.filter((a) => a.fonte === "visita").length;
    const atr = hoje.filter((a) => a.prazoEstourado).length;
    if (ch) partes.push(`${ch} chamado${ch > 1 ? "s" : ""}`);
    if (vi) partes.push(`${vi} visita${vi > 1 ? "s" : ""}`);
    if (atr) partes.push(`${atr} atrasad${atr > 1 ? "os" : "o"}`);
    return partes.join(" · ");
  }, [hoje]);

  const semPerfil = !s.cargo;

  return (
    <>
      {/* Banner — margens negativas casadas com o padding do <main> */}
      <div className="banner-home so-celular" style={{
        marginTop: -76, marginLeft: -16, marginRight: -16,
        position: "relative", height: "28vh", minHeight: 180, overflow: "hidden",
      }}>
        <img
          src={isLight ? "/banner-home-light.jpg" : bannerAsset.url}
          alt="Frota Prever"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: isLight
            ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(244,245,247,0.9) 100%)"
            : "linear-gradient(to bottom, rgba(8,8,12,0.30) 0%, rgba(8,8,12,0.45) 60%, rgba(8,8,12,0.55) 100%)",
          pointerEvents: "none",
        }} />
        {!isLight && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
            background: "linear-gradient(to bottom, rgba(8,9,14,0) 0%, rgba(8,9,14,0.7) 55%, rgb(8,9,14) 100%)",
            pointerEvents: "none",
          }} />
        )}

        {/* O banner virou alvo de toque: aplica "Meu dia" e leva à lista que
            produziu o número. Antes era um enfeite não auditável. */}
        <button
          onClick={() => setFiltros((f) => ({
            ...f, preset: "meu_dia", situacao: "abertos", pessoa: "todos",
          }))}
          style={{
            position: "absolute", bottom: 14, left: 0, right: 0,
            background: "transparent", border: "none", cursor: "pointer",
            padding: "0 20px", textAlign: "center",
          }}
        >
          <div style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 24, lineHeight: 1.2, color: "#FFFFFF",
            textShadow: "0 1px 8px rgba(0,0,0,0.55), 0 2px 16px rgba(0,0,0,0.35)",
          }}>
            {semPerfil
              ? "Carregando seu dia"
              : hoje.length === 0
                ? "Nada para hoje."
                : `Você tem ${hoje.length} ${hoje.length === 1 ? "atividade" : "atividades"} hoje.`}
          </div>
          {composicao && (
            <div style={{
              fontFamily: FONT, fontWeight: 400, fontSize: 12.5, color: "rgba(255,255,255,0.85)",
              marginTop: 4, textShadow: "0 1px 6px rgba(0,0,0,0.6)",
            }}>
              {composicao}
            </div>
          )}
        </button>
      </div>

      <div style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Faixa superior do desktop. O banner e a frase "Você tem X hoje"
            saíram daqui (viraram cabeçalho da sidebar e conteúdo de celular),
            então a dobra abre com o trabalho. A busca encosta na margem
            direita do quadro; o meio fica livre de propósito — o Davi vai
            definir o que entra. */}
        {/* Painel superior (U18) — o desenho anotado do Davi:
            prazos futuros · meta do mês · 4 indicadores · notificações.
            Em telas entre 1024 e ~1400px o flexWrap quebra em duas linhas. */}
        <div className="so-desktop sangra-x" style={{ gap: 14, alignItems: "stretch", flexWrap: "wrap", paddingTop: 6 }}>
          {/* U33: os três leem o MESMO recorte que o quadro embaixo. Antes
              recebiam o array cru — e duas nem isso, consultavam o banco por
              conta própria —, então filtrar o quadro não mexia em nada aqui. */}
          <GraficoDemanda atividades={paraPaineis} />
          <GraficoMeta atividades={paraPaineis} />
          <PainelKpis atividades={paraPaineis} />
          <CriarRapido />
        </div>

        {/* O título desceu para cá — o quadrado azul do desenho: vira o
            cabeçalho da área de trabalho, logo acima dos filtros. */}
        <div className="so-desktop sangra-x" style={{ alignItems: "center", paddingTop: 4 }}>
          <h1 style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 22, margin: 0,
            color: textPrimary, letterSpacing: "-0.01em",
          }}>
            Suas atividades
          </h1>
        </div>

        <ProximaVisita
          visita={proxima}
          onAbrir={() => proxima && navigate({
            ...visitaRouteFor(proxima.status as any, proxima.id),
            state: { from: location.pathname },
          } as any)}
        />

        {/* Falha de rede não pode parecer "não tenho trabalho hoje" — é a
            mentira mais cara possível para quem está em campo. */}
        {erro && (
          <div style={{
            display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 12,
            background: isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)",
            border: isLight ? "1px solid rgba(177,36,46,0.22)" : "1px solid rgba(241,120,129,0.24)",
            fontFamily: FONT, fontSize: 12.5, color: isLight ? "#B1242E" : "#F17881",
          }}>
            <WifiOff size={15} style={{ flexShrink: 0 }} />
            Não consegui carregar suas atividades. O que está abaixo pode estar incompleto.
          </div>
        )}

        {/* Barra de controle: um botão por dimensão de filtro, cada um dizendo
            o que está escolhido sem precisar ser aberto. Antes eram duas
            fileiras de chips disputando a largura — quinze alvos sem hierarquia. */}
        {!semPerfil && (
          <div className="barra-filtros sangra-x" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MenuFiltro
              rotulo="Padrão"
              vazio="Padrão"
              opcoes={presets.map((p) => ({ valor: p.chave, label: p.label }))}
              selecionados={filtros.preset ? [filtros.preset] : []}
              onMudar={(v) => setFiltros((f) => ({
                ...f,
                preset: v[0] ?? null,
                // trocar de padrão zera o período: a interseção vazia entre
                // preset e período custa três toques cegos para descobrir
                periodo: null,
              }))}
            />
            <MenuFiltro
              rotulo="Vínculo"
              vazio="Meu vínculo"
              multi
              opcoes={VINCULOS.map((v) => ({ valor: v.chave, label: v.label }))}
              selecionados={filtros.vinculos}
              onMudar={(v) => setFiltros((f) => ({ ...f, vinculos: v as Vinculo[] }))}
            />
            <MenuFiltro
              rotulo="Período"
              vazio="Período"
              opcoes={PERIODOS.map((p) => ({ valor: p.chave, label: p.label }))}
              selecionados={filtros.periodo ? [filtros.periodo] : []}
              onMudar={(v) => setFiltros((f) => ({ ...f, periodo: (v[0] ?? null) as Periodo }))}
            />
            <MenuFiltro
              rotulo="Situação"
              vazio="Em aberto"
              opcoes={[
                { valor: "abertos", label: "Em aberto" },
                { valor: "encerrados", label: "Encerrados", nota: "últimos 7 dias" },
                { valor: "todos", label: "Todos" },
              ]}
              selecionados={[filtros.situacao]}
              onMudar={(v) => setFiltros((f) => {
                // sempre há uma situação vigente; limpar volta ao padrão
                const sit = (v[0] ?? "abertos") as Filtros["situacao"];
                return {
                  ...f,
                  situacao: sit,
                  // todo padrão exige item em aberto: manter um ligado aqui
                  // daria lista vazia por construção, sem o usuário saber
                  preset: sit === "abertos" ? f.preset : null,
                };
              })}
            />
            {gestor && pessoas.length > 0 && (
              <MenuFiltro
                rotulo="Pessoa"
                vazio="Responsável"
                larguraMenu={260}
                opcoes={pessoas.map((p) => ({ valor: p.id, label: p.nome }))}
                selecionados={filtros.pessoa === "todos" ? [] : [filtros.pessoa]}
                onMudar={(v) => setFiltros((f) => ({ ...f, pessoa: v[0] ?? "todos" }))}
              />
            )}

            <div style={{ flex: 1, minWidth: 8 }} />

            <button
              onClick={() => {
                if (buscaAberta) setFiltros((f) => ({ ...f, busca: "" }));
                setBuscaAberta((b) => !b);
              }}
              title="Buscar"
              style={botaoIcone}
            >
              <Search size={17} color={gold} />
            </button>
            <button
              onClick={() => setVisao((v) => (v === "lista" ? "quadro" : "lista"))}
              title={visao === "lista" ? "Ver como quadro por status" : "Ver como lista"}
              style={botaoIcone}
            >
              {/* o ícone mostra o DESTINO, igual a /chamados — trocar isso
                  deixaria as duas telas incoerentes entre si */}
              {visao === "lista" ? <KanbanSquare size={17} color={gold} /> : <ListIcon size={17} color={gold} />}
            </button>
            {/* no desktop a busca mora aqui, depois dos botões — encostada na
                margem direita do quadro, como o Davi desenhou */}
            <div className="so-desktop" style={{ width: 300, flexShrink: 0 }}>
              <CampoBusca
                valor={filtros.busca}
                onMudar={(v) => setFiltros((f) => ({ ...f, busca: v }))}
              />
            </div>
          </div>
        )}

        {/* No celular o campo abre pela lupa — não há largura para ele morar
            na barra junto dos cinco filtros. */}
        {buscaAberta && (
          <div className="so-celular">
            <CampoBusca
              autoFoco
              valor={filtros.busca}
              onMudar={(v) => setFiltros((f) => ({ ...f, busca: v }))}
            />
          </div>
        )}

        {/* Conteúdo */}
        {carregando || semPerfil ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                height: 84, borderRadius: 14,
                background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)",
              }} />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 9,
            padding: "30px 16px", borderRadius: 16,
            background: isLight ? "#ffffff" : "rgba(255,255,255,0.02)",
            border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.06)",
          }}>
            <Inbox size={28} color={gold} />
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: textPrimary }}>
              Nada nesta combinação
            </span>
            {/* o vazio nomeia a combinação culpada em vez de ficar mudo */}
            <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
              {[
                filtros.preset && presets.find((p) => p.chave === filtros.preset)?.label,
                filtros.periodo && PERIODOS.find((p) => p.chave === filtros.periodo)?.label,
                filtros.vinculos.length ? filtros.vinculos.map((v) => VINCULOS.find((x) => x.chave === v)?.label).join(" + ") : null,
                filtros.busca.trim() ? `busca "${filtros.busca.trim()}"` : null,
                filtros.situacao === "encerrados" ? "Encerrados" : null,
              ].filter(Boolean).join(" · ") || "Sem atividades em aberto."}
            </span>
            {(filtros.preset || filtros.periodo || filtros.vinculos.length > 0
              || filtros.busca.trim() || filtros.situacao !== "abertos") && (
              <button style={{ ...chip(false), marginTop: 4 }} onClick={() => { setFiltros(FILTROS_INICIAIS); setBuscaAberta(false); }}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {ocultosSemData > 0 && (
              <button
                onClick={() => setFiltros((f) => ({ ...f, periodo: null }))}
                style={{
                  fontFamily: FONT, fontSize: 12, color: textSecondary,
                  background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left", padding: "0 0 2px", minHeight: 32,
                }}
              >
                {ocultosSemData} sem data {ocultosSemData === 1 ? "está oculto" : "estão ocultos"} pelo período ·{" "}
                <span style={{ color: gold, fontWeight: 600 }}>mostrar</span>
              </button>
            )}
            {visao === "quadro" ? (
          <Quadro
            atividades={filtradas}
            foco={focoDoPreset(filtros.preset)}
            pessoas={pessoasPorId}
            onAbrir={abrir}
            onMover={moverAtividade}
          />
        ) : (
          <>
            {/* U33: a lista virou TABELA. Cards empilhados serviam para ler um
                item; comparar vinte pede colunas alinhadas. */}
            <TabelaAtividades
              atividades={filtradas.slice(0, TETO_TABELA)}
              pessoas={pessoasPorId}
              aoAbrir={abrir}
            />
            {filtradas.length > TETO_TABELA && (
              <span style={{
                display: "block", marginTop: 10,
                fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center",
              }}>
                Mostrando {TETO_TABELA} de {filtradas.length} — use a busca ou os filtros.
              </span>
            )}
          </>
            )}
          </>
        )}
      </div>

      <PainelChamado
        chamadoId={painelId}
        aoFechar={() => setPainelId(null)}
        aoAbrirPagina={abrirPagina}
      />
    </>
  );
}
