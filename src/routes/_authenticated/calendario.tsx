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
import { usePessoas } from "@/features/chamados/data";
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
  const superficie = isLight ? "#ffffff" : "rgba(255,255,255,0.03)";
  const linha = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  const hoje = new Date();
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [painelId, setPainelId] = useState<string | null>(null);

  const { data: cargo } = useUserCargo();
  // SAC é gestor de chamados: vê o calendário de TODOS (R8/R26)
  const isGestor = cargo === "admin" || cargo === "sac" || cargo === "comercial";

  const [pessoaFiltro, setPessoaFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");

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
        .select("id, status, data_hora_agendada, titulo, nome_predio, tecnico_id")
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
        // nome velho derrubava a consulta inteira (42703)
        .select("id, numero, status, tipo, natureza, titulo, data_hora_agendada, prazo_limite, responsavel_id, cliente:clientes(nome)")
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

  const eventos = useMemo<Evento[]>(() => {
    const deVisitas: Evento[] = (visitas as any[]).map((v) => ({
      kind: "visita",
      id: v.id,
      titulo: v.nome_predio ?? v.titulo ?? "Visita técnica",
      status: v.status,
      tipo: "visita",
      natureza: "comercial",
      pessoas: v.tecnico_id ? [v.tecnico_id] : [],
      quando: v.data_hora_agendada,
      porPrazo: false,
    }));
    const deChamados: Evento[] = (chamados as any[]).map((c) => ({
      kind: "chamado",
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
      quando: c.data_hora_agendada ?? c.prazo_limite,
      porPrazo: !c.data_hora_agendada,
    }));
    return [...deVisitas, ...deChamados]
      .filter((e) => pessoaFiltro === "todos" || e.pessoas.includes(pessoaFiltro))
      .filter((e) => tipoFiltro === "todos" || e.tipo === tipoFiltro)
      .sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime());
  }, [visitas, chamados, apoios, pessoaFiltro, tipoFiltro]);

  const porDia = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    for (const e of eventos) (m[chaveDia(new Date(e.quando))] ??= []).push(e);
    return m;
  }, [eventos]);

  const tiposPresentes = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.tipo))).sort(),
    [eventos],
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
          {tiposPresentes.length > 1 && (
            <MenuFiltro
              rotulo="Tipo"
              vazio="Todos os tipos"
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
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
            {eventos.length} no mês
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
                  background: doMes ? superficie : (isLight ? "#fafafa" : "rgba(255,255,255,0.012)"),
                  padding: "5px 5px 7px",
                  display: "flex", flexDirection: "column", gap: 3,
                  opacity: doMes ? 1 : 0.45,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: FONT, fontWeight: eDeHoje ? 700 : 500, fontSize: 11,
                    color: eDeHoje ? "#08090E" : textPrimary,
                    background: eDeHoje ? gold : "transparent",
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
                    const info = chamadoStatusInfo(e.status);
                    const cor = e.porPrazo && new Date(e.quando) < hoje && !["concluido", "cancelado"].includes(e.status)
                      ? (isLight ? "#B1242E" : "#F17881")
                      : info.color;
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
                          border: "none", borderLeft: `2.5px solid ${cor}`,
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
