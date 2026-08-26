// Calendário — a agenda do mês, tela cheia.
//
// O DEFEITO QUE ELE TINHA: a consulta de chamados pedia a coluna `tecnico_id`,
// que deixou de existir na fusão U7 (virou `responsavel_id`). O PostgREST
// respondia 42703, a consulta inteira falhava e a lista voltava vazia — então
// NENHUM chamado aparecia no calendário, só visitas. Silencioso porque o erro
// morria dentro do react-query. (Hoje isso apareceria como PRV-CAL-ESQM-42703.)
//
// A SEGUNDA CAUSA: só entrava quem tinha `data_hora_agendada`. As atividades
// internas — as 2100 que vieram do Notion — não têm hora marcada; o que elas
// têm é PRAZO. Um calendário que ignora prazo mostra a agenda de campo e finge
// que o resto do trabalho não tem data.
//
// Por isso cada item entra pela data que REALMENTE o coloca num dia:
//   · visita e chamado de campo → a hora agendada (é quando a dupla sai)
//   · chamado interno           → o prazo (é quando tem que estar pronto)
// A célula distingue os dois: hora para o que é agendado, "vence" para prazo.

import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserCargo } from "@/features/gerencial/data";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { chamadoStatusInfo, TIPO_LABEL } from "@/lib/chamado-status";
import { getStatusInfo as getStatusInfoVisita } from "@/lib/visita-status";
import { PRISMA } from "@/lib/paleta";
import { usePessoas } from "@/features/chamados/data";
import {
  useClientes, SERVICO_ORDEM, SERVICO_LABEL, type ServicoCliente,
} from "@/features/clientes/data";
import { AvatarPilha, type PessoaAvatar } from "@/components/AvatarPilha";
import { PainelChamado } from "@/features/chamados/PainelChamado";
import { visitaRouteFor } from "@/lib/visita-route";
import { MenuFiltro } from "@/features/home/MenuFiltro";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
});

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Um item do calendário, já normalizado. */
interface Evento {
  kind: "visita" | "chamado";
  id: string;
  titulo: string;
  status: string;
  tipo: string;
  natureza: string | null;
  /** quem toca — responsável primeiro, apoios depois */
  pessoas: string[];
  quando: string;
  /** true = entrou pelo PRAZO, não por hora marcada */
  porPrazo: boolean;
  /** true = já passou da data e não chegou a um estado final — pinta vermelho */
  atrasado: boolean;
  cor: string;
  /**
   * Os setores de serviço a que o evento pertence (R93, U73). Um evento chega
   * a um setor por DOIS caminhos, e os dois valem:
   *
   *   1. a ETIQUETA explícita em `chamado_locais.setor` (R85)
   *   2. o serviço prestado no local — `clientes.servicos_prestados` do
   *      cliente principal ou de qualquer cliente vinculado
   *
   * Vazio = não pertence a setor nenhum (atividade interna, prospecção, ou
   * cliente ainda sem serviço marcado).
   */
  setores: string[];
}

const chaveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLight } = useTheme();

  const textPrimary = isLight ? "#0a0b0e" : "#fff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.5)";
  const gold = isLight ? "#A06108" : "#F8C811";
  // SÓLIDA, não um véu translúcido de branco (era `rgba(255,255,255,0.03)`,
  // 2026-08-22: o Davi achou "um cinza muito claro"). Um véu de branco sobre
  // fundo escuro é frágil — o resultado depende de exatamente que cor está
  // por trás, e em qualquer camada/composição intermediária ele clareia mais
  // do que parece no código. `#101016` é o mesmo tom sólido que a tabela da
  // Início já usa para superfície escura (TabelaAtividades) — consistente
  // com o resto do app, e sempre este tom, não importa o que esteja atrás.
  const superficie = isLight ? "#ffffff" : "#101016";
  const foraDoMes = isLight ? "#fafafa" : "#0a0a0e";
  const linha = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  const hoje = new Date();
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [painelId, setPainelId] = useState<string | null>(null);

  const { data: cargo } = useUserCargo();
  // SAC é gestor de chamados: vê o calendário de TODOS (R8/R26)
  const isGestor = cargo === "admin" || cargo === "sac" || cargo === "comercial";

  const [pessoaFiltro, setPessoaFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [setorFiltro, setSetorFiltro] = useState("todos");

  // A base inteira, para saber que serviço cada local presta. Já vem de cache
  // (a tela de Clientes e o painel do chamado usam a mesma query) e traz
  // `servicos_prestados` no SELECT padrão.
  const { data: clientesBase = [] } = useClientes();
  const servicosPorCliente = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of clientesBase) m[c.id] = c.servicos_prestados ?? [];
    return m;
  }, [clientesBase]);

  const { data: pessoas = [] } = usePessoas();
  const mapaPessoas = useMemo(() => {
    const m: Record<string, PessoaAvatar> = {};
    for (const p of pessoas as any[]) m[p.id] = { nome: p.nome, avatar_url: p.avatar_url ?? null };
    return m;
  }, [pessoas]);

  const inicioMes = useMemo(() => new Date(mes.getFullYear(), mes.getMonth(), 1), [mes]);
  const fimMes = useMemo(() => new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59), [mes]);

  const { data: visitas = [], isLoading: carregandoVisitas } = useQuery({
    queryKey: ["calendario", "visitas", mes.getFullYear(), mes.getMonth(), isGestor],
    queryFn: async () => {
      let q = supabase
        .from("visitas_tecnicas")
        // cliente_id entra na U73: é por ele que a visita sabe de que setor
        // ela é. Visita de prospecção fica sem — e é correto, o prédio que
        // ainda não é cliente não presta serviço nenhum.
        .select("id, status, data_hora_agendada, titulo, nome_predio, tecnico_id, cliente_id")
        .not("data_hora_agendada", "is", null)
        .gte("data_hora_agendada", inicioMes.toISOString())
        .lte("data_hora_agendada", fimMes.toISOString());
      if (!isGestor) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) q = q.eq("tecnico_id", u.user.id);
      }
      const { data, error } = await q.order("data_hora_agendada");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  /**
   * Chamados do mês por DOIS caminhos: hora agendada ou prazo. O PostgREST
   * junta os dois com `or(...)`, senão seriam duas consultas para depois
   * misturar na mão — e a segunda esqueceria um filtro em algum refactor.
   */
  const { data: chamados = [], isLoading: carregandoChamados } = useQuery({
    queryKey: ["calendario", "chamados", mes.getFullYear(), mes.getMonth()],
    queryFn: async () => {
      const de = inicioMes.toISOString();
      const ate = fimMes.toISOString();
      const { data, error } = await supabase
        .from("chamados" as any)
        // responsavel_id, NÃO tecnico_id: a coluna mudou de nome na U7 e o
        // nome velho derrubava a consulta inteira (42703).
        // `!cliente_id`: desambigua o embed — ver features/home/data.ts (U45).
        .select("id, numero, status, tipo, natureza, titulo, data_hora_agendada, prazo_limite, responsavel_id, cliente_id, cliente:clientes!cliente_id(nome)")
        .or(`and(data_hora_agendada.gte.${de},data_hora_agendada.lte.${ate}),and(data_hora_agendada.is.null,prazo_limite.gte.${de},prazo_limite.lte.${ate})`);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  /** Apoios de todos os chamados do mês — para a pilha de avatares. */
  const { data: apoios = {} } = useQuery({
    queryKey: ["calendario", "apoios", mes.getFullYear(), mes.getMonth()],
    enabled: chamados.length > 0,
    queryFn: async () => {
      const ids = (chamados as any[]).map((c) => c.id);
      const { data, error } = await supabase
        .from("chamado_apoios" as any)
        .select("chamado_id, profile_id")
        .in("chamado_id", ids);
      if (error) return {};
      const m: Record<string, string[]> = {};
      for (const r of (data as any[]) ?? []) {
        (m[r.chamado_id] ??= []).push(r.profile_id);
      }
      return m;
    },
  });

  /**
   * Os LOCAIS de cada chamado do mês (U71), para o filtro de setor.
   *
   * Consulta crua, sem embed do PostgREST, de propósito: `chamado_locais` tem
   * duas FKs chegando em tabelas diferentes, e o embed ambíguo é o PGRST201
   * que já derrubou a Início inteira quando a U45 subiu. Aqui só precisamos
   * de `setor` e `cliente_id` — nenhum join é necessário.
   */
  const { data: locais = {} } = useQuery({
    queryKey: ["calendario", "locais", mes.getFullYear(), mes.getMonth()],
    enabled: chamados.length > 0,
    queryFn: async () => {
      const ids = (chamados as any[]).map((c) => c.id);
      const { data, error } = await supabase
        .from("chamado_locais" as any)
        .select("chamado_id, cliente_id, setor")
        .in("chamado_id", ids);
      if (error) return {};
      const m: Record<string, { setor: string | null; cliente_id: string | null }[]> = {};
      for (const r of (data as any[]) ?? []) {
        (m[r.chamado_id] ??= []).push({ setor: r.setor, cliente_id: r.cliente_id });
      }
      return m;
    },
  });

  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;

  // TODOS os eventos do mês, SEM filtro nenhum — é desta lista que os
  // seletores de Pessoa/Tipo tiram suas opções (ver `tiposPresentes` abaixo).
  // A cor de cada caixa também nasce aqui, calculada uma vez só: cada evento
  // já sai do useMemo sabendo sua própria cor, em vez de recalculá-la a cada
  // render dentro do JSX.
  const todosEventos = useMemo<Evento[]>(() => {
    const deVisitas: Evento[] = (visitas as any[]).map((v) => {
      // A VISITA tem vocabulário PRÓPRIO de status (pendente/aguardando_
      // aprovação/aprovada/reprovada) — é diferente do vocabulário do
      // chamado (aberto/em_andamento/concluído...). Usar chamadoStatusInfo
      // aqui SEMPRE caía no cinza de fallback (nenhum status de visita bate
      // com uma chave do chamado), e é por isso que toda visita no
      // calendário nascia igual: cinza, disfarçando a cor de verdade.
      const info = getStatusInfoVisita(v.status);
      // "aprovada"/"reprovada" são finais para a visita — pendente e
      // aguardando aprovação ainda podem estar atrasadas (a hora marcada já
      // passou e ninguém foi, ou a proposta não foi decidida a tempo).
      const final = info.bucket === "aprovada" || info.bucket === "reprovada";
      const atrasado = !final && !!v.data_hora_agendada
        && new Date(v.data_hora_agendada).getTime() < hoje.getTime();
      return {
        kind: "visita" as const,
        id: v.id,
        titulo: v.nome_predio ?? v.titulo ?? "Visita técnica",
        status: v.status,
        tipo: "visita",
        natureza: "comercial",
        pessoas: v.tecnico_id ? [v.tecnico_id] : [],
        quando: v.data_hora_agendada,
        porPrazo: false,
        atrasado,
        cor: atrasado ? vermelho : (isLight ? info.colorLight : info.color),
        setores: v.cliente_id ? (servicosPorCliente[v.cliente_id] ?? []) : [],
      };
    });
    const deChamados: Evento[] = (chamados as any[]).map((c) => {
      const info = chamadoStatusInfo(c.status);
      const final = c.status === "concluido" || c.status === "cancelado";
      const quando = c.data_hora_agendada ?? c.prazo_limite;
      const atrasado = !final && !!quando && new Date(quando).getTime() < hoje.getTime();
      return {
        kind: "chamado" as const,
        id: c.id,
        // o TÍTULO na frente: é o que responde "o que é isto?" varrendo o mês.
        // O cliente vira o complemento, quando existe.
        titulo: c.titulo ?? c.cliente?.nome ?? "Chamado",
        status: c.status,
        tipo: c.tipo ?? "—",
        natureza: c.natureza ?? null,
        pessoas: Array.from(new Set([
          ...(c.responsavel_id ? [c.responsavel_id] : []),
          ...((apoios as Record<string, string[]>)[c.id] ?? []),
        ])),
        quando,
        porPrazo: !c.data_hora_agendada,
        atrasado,
        cor: atrasado ? vermelho : (isLight ? info.colorLight : info.color),
        // etiqueta explícita + serviço do cliente principal + serviço de cada
        // cliente vinculado, sem repetir
        setores: Array.from(new Set([
          ...(c.cliente_id ? (servicosPorCliente[c.cliente_id] ?? []) : []),
          ...((locais as Record<string, { setor: string | null; cliente_id: string | null }[]>)[c.id] ?? [])
            .flatMap((l) => (l.setor
              ? [l.setor]
              : l.cliente_id ? (servicosPorCliente[l.cliente_id] ?? []) : [])),
        ])),
      };
    });
    return [...deVisitas, ...deChamados]
      .sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime());
  }, [visitas, chamados, apoios, locais, servicosPorCliente, isLight, vermelho, hoje]);

  const eventos = useMemo(
    () => todosEventos
      .filter((e) => pessoaFiltro === "todos" || e.pessoas.includes(pessoaFiltro))
      .filter((e) => tipoFiltro === "todos" || e.tipo === tipoFiltro)
      // Escolher um setor esconde quem não é de setor nenhum — atividade
      // interna, prospecção, cliente sem serviço marcado. É o que filtrar
      // significa, mas surpreende, então o menu avisa quantos ficam de fora.
      .filter((e) => setorFiltro === "todos" || e.setores.includes(setorFiltro)),
    [todosEventos, pessoaFiltro, tipoFiltro, setorFiltro],
  );

  const porDia = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    for (const e of eventos) (m[chaveDia(new Date(e.quando))] ??= []).push(e);
    return m;
  }, [eventos]);

  /**
   * As opções do filtro de Tipo vêm de TODOS os eventos do mês — NUNCA do
   * conjunto já filtrado por pessoa.
   *
   * O BUG QUE ISSO CORRIGE: antes, `tiposPresentes` nascia de `eventos` (o
   * array JÁ filtrado por pessoa). Escolher uma pessoa cujas atividades são
   * todas do MESMO tipo reduzia `tiposPresentes` a 1 item, e a condição
   * `tiposPresentes.length > 1` (mais abaixo) fazia o próprio BOTÃO "Tipo"
   * desaparecer da tela — não travava escondido, sumia de vez, e quem
   * tivesse acabado de escolher um tipo específico via esse botão perdia a
   * escolha (o valor ficava só na variável de estado, sem controle visível
   * para trocar ou limpar). "Um dos filtros some e dá bug" era exatamente
   * isto: o filtro de Pessoa apagando o de Tipo por baixo dos panos.
   */
  const tiposPresentes = useMemo(
    () => Array.from(new Set(todosEventos.map((e) => e.tipo))).sort(),
    [todosEventos],
  );

  /** Os setores com pelo menos um evento no mês — mesma regra do Tipo. */
  const setoresPresentes = useMemo(
    () => SERVICO_ORDEM.filter((s) => todosEventos.some((e) => e.setores.includes(s))) as string[],
    [todosEventos],
  );

  /** Quantos ficariam de fora ao escolher um setor — o aviso ao lado da conta. */
  const semSetor = useMemo(
    () => todosEventos.filter((e) => e.setores.length === 0).length,
    [todosEventos],
  );

  // A grade sempre começa no domingo e fecha a última semana: sem isso a
  // última linha teria menos colunas e as células mudariam de largura.
  const celulas = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    const dias: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      dias.push(d);
      // para em 35 se a sexta linha for toda do mês seguinte
      if (i === 34 && new Date(inicio.getTime() + 35 * 86400000).getMonth() !== mes.getMonth()) break;
    }
    return dias;
  }, [mes]);

  const carregando = carregandoVisitas || carregandoChamados;

  function abrir(e: Evento) {
    // a visita tem fluxo próprio; o chamado abre no painel de propriedades
    if (e.kind === "visita") {
      navigate({ ...visitaRouteFor(e.status as any, e.id), state: { from: location.pathname } } as any);
    } else {
      setPainelId(e.id);
    }
  }

  const navBtn: CSSProperties = {
    width: 34, height: 34, borderRadius: 10,
    background: isLight ? "rgba(0,0,0,0.05)" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  };
  const seletor: CSSProperties = {
    fontFamily: FONT, fontSize: 12, color: textPrimary,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, padding: "7px 10px", cursor: "pointer",
  };

  return (
    <>
      {/* TELA CHEIA — mas por PISO, não por teto: `minHeight` e não `height`.
          Com a linha crescendo conforme o dia mais cheio (sem rolagem por
          célula), uma altura fixa faria a grade transbordar do contêiner e as
          últimas semanas ficariam cortadas. Assim o mês vazio ainda preenche a
          tela e o mês cheio empurra a página, que rola uma vez só.
          `100dvh` e não `100vh` — no celular a barra do navegador entra e sai,
          e com `vh` a última semana ficaria escondida atrás dela. */}
      <div
        className="sangra-x"
        style={{
          display: "flex", flexDirection: "column",
          minHeight: "calc(100dvh - 96px)",
          paddingTop: 14, paddingBottom: 20, color: textPrimary,
        }}
      >
        {/* Cabeçalho */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          flexWrap: "wrap", marginBottom: 12, flexShrink: 0,
        }}>
          <CalendarDays size={20} color={gold} />
          <h1 style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 19, margin: 0,
            minWidth: 190,
          }}>
            {MESES[mes.getMonth()]} de {mes.getFullYear()}
          </h1>
          <button style={navBtn} aria-label="Mês anterior"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>
            <ChevronLeft size={17} />
          </button>
          <button style={navBtn} aria-label="Próximo mês"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>
            <ChevronRight size={17} />
          </button>
          <button
            style={{ ...seletor, fontWeight: 600 }}
            onClick={() => setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
          >
            Hoje
          </button>

          <div style={{ flex: 1 }} />

          {/* Design system: o mesmo MenuFiltro da Início, não um <select>
              nativo à parte. Eram dois vocabulários de filtro no mesmo app —
              um com botão-que-mostra-a-escolha e popover em portal, outro
              com a caixa cinza padrão do navegador, que muda de aparência
              conforme o sistema operacional e não segue tema nenhum. */}
          {isGestor && (
            <MenuFiltro
              rotulo="Pessoa"
              vazio="Todas as pessoas"
              opcoes={(pessoas as any[]).map((p) => ({ valor: p.id, label: p.nome }))}
              selecionados={pessoaFiltro === "todos" ? [] : [pessoaFiltro]}
              onMudar={(v) => setPessoaFiltro(v[0] ?? "todos")}
            />
          )}
          {/* U73: o botão passou a aparecer SEMPRE que há tipo no mês. Antes
              exigia `> 1`, e num mês de um tipo só ele sumia — o filtro
              existia e ninguém via. O rótulo virou "Tipo de demanda", que é
              como o resto do app chama esse campo. */}
          {tiposPresentes.length > 0 && (
            <MenuFiltro
              rotulo="Tipo de demanda"
              vazio="Todos os tipos"
              larguraMenu={230}
              opcoes={tiposPresentes.map((t) => ({
                valor: t,
                // "visita" não é um ChamadoTipo — só os de chamado têm rótulo
                // no vocabulário central; o próprio valor, com a primeira
                // maiúscula, é o fallback mais honesto que inventar um label
                label: TIPO_LABEL[t as keyof typeof TIPO_LABEL] ?? (t.charAt(0).toUpperCase() + t.slice(1)),
              }))}
              selecionados={tipoFiltro === "todos" ? [] : [tipoFiltro]}
              onMudar={(v) => setTipoFiltro(v[0] ?? "todos")}
            />
          )}
          {/* R93: setor = o SERVIÇO prestado no local (Portaria Remota,
              Monitoramento), o mesmo vocabulário de `servicos_prestados` e da
              etiqueta de setor da U71. As opções saem de `todosEventos`, nunca
              da lista já filtrada — a armadilha documentada em
              `tiposPresentes` logo acima vale igual aqui. */}
          {setoresPresentes.length > 0 && (
            <MenuFiltro
              rotulo="Setor"
              vazio="Todos os setores"
              larguraMenu={250}
              opcoes={setoresPresentes.map((s) => ({
                valor: s,
                label: SERVICO_LABEL[s as ServicoCliente] ?? s,
                nota: `${todosEventos.filter((e) => e.setores.includes(s)).length} no mês`,
              }))}
              selecionados={setorFiltro === "todos" ? [] : [setorFiltro]}
              onMudar={(v) => setSetorFiltro(v[0] ?? "todos")}
            />
          )}
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
            {eventos.length} no mês
            {/* Escolher setor esconde quem não tem setor nenhum. Sem este
                aviso, "12 no mês" num mês de 40 pareceria dado sumido. */}
            {setorFiltro !== "todos" && semSetor > 0 && (
              <span style={{ opacity: 0.75 }}> · {semSetor} sem setor</span>
            )}
          </span>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1, flexShrink: 0,
        }}>
          {DIAS_SEMANA.map((d) => (
            <div key={d} style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 9.5,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: textSecondary, textAlign: "center", padding: "6px 0",
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* A GRADE — a linha CRESCE com o dia mais cheio dela (pedido do Davi:
            sem rolagem por dia).
            `minmax(120px, auto)`: 120px é o piso, para um mês vazio ainda
            parecer um calendário; daí para cima a linha acompanha o conteúdo.
            Quem rola é a PÁGINA, uma vez só — antes eram 42 áreas de rolagem
            independentes, e um item escondido dentro de uma delas era um item
            que ninguém via. */}
        <div style={{
          // "1 0 auto": CRESCE para preencher a tela quando o mês é vazio, e
          // NÃO ENCOLHE quando é cheio. Um `flex: 1` puro (base 0) espremeria
          // a grade de volta à altura do contêiner e traria a rolagem cortada
          // de volta pela porta dos fundos.
          flex: "1 0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridAutoRows: "minmax(120px, auto)",
          gap: 1,
          background: linha,
          border: `1px solid ${linha}`,
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {celulas.map((d) => {
            const doMes = d.getMonth() === mes.getMonth();
            const eDeHoje = chaveDia(d) === chaveDia(hoje);
            const itens = porDia[chaveDia(d)] ?? [];
            return (
              <div
                key={d.toISOString()}
                style={{
                  background: doMes ? superficie : foraDoMes,
                  padding: "5px 5px 7px",
                  display: "flex", flexDirection: "column", gap: 3,
                  opacity: doMes ? 1 : 0.45,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: FONT, fontWeight: eDeHoje ? 700 : 500, fontSize: 11,
                    color: eDeHoje ? "#08090E" : textPrimary,
                    // o amarelo da marca, igual nos dois temas: `gold` é token
                    // de TEXTO (no claro, #A06108) e como SUPERFÍCIE deixava o
                    // número de 11px abaixo do contraste mínimo.
                    background: eDeHoje ? "#F8C811" : "transparent",
                    borderRadius: 999, minWidth: 19, height: 19,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: eDeHoje ? "0 5px" : 0,
                  }}>
                    {d.getDate()}
                  </span>
                  {itens.length > 2 && (
                    <span style={{ fontFamily: FONT, fontSize: 9, color: textSecondary }}>
                      {itens.length}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {itens.map((e) => {
                    return (
                      <button
                        key={`${e.kind}-${e.id}`}
                        onClick={() => abrir(e)}
                        // a hora e o "vence" saíram da célula (pedido do Davi):
                        // varrendo o mês, o que se procura é O QUE é, não a que
                        // horas. O detalhe fica no título do navegador e no
                        // painel, a um clique.
                        title={`${e.titulo}${e.porPrazo
                          ? " · vence neste dia"
                          : ` · ${new Date(e.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}`}
                        style={{
                          textAlign: "left", cursor: "pointer", width: "100%",
                          border: "none", borderLeft: `2.5px solid ${e.cor}`,
                          borderRadius: 5, padding: "4px 6px",
                          background: isLight ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.06)",
                          display: "flex", alignItems: "flex-start", gap: 5, minWidth: 0,
                        }}
                      >
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
                          color: textPrimary, lineHeight: 1.3,
                          display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {e.titulo}
                        </span>
                        {/* o(s) responsável(eis) — o rosto de quem toca, agora
                            ao lado do título em vez de numa segunda linha */}
                        {e.pessoas.length > 0 && (
                          <AvatarPilha ids={e.pessoas} pessoas={mapaPessoas} max={2} tamanho={15} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {carregando && (
          <div style={{
            fontFamily: FONT, fontSize: 11.5, color: textSecondary,
            paddingTop: 8, flexShrink: 0,
          }}>
            Carregando a agenda…
          </div>
        )}
      </div>

      <PainelChamado
        chamadoId={painelId}
        aoFechar={() => setPainelId(null)}
        aoAbrirPagina={(id) => { setPainelId(null); navigate({ to: "/chamados/$id", params: { id } }); }}
      />
    </>
  );
}
