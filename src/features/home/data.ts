// Home — as consultas que alimentam lista e quadro. Ver docs/PRODUTO.md §9.
//
// Três cuidados que valem mais que o código:
//
// 1. VALOR DE COMPRA NÃO É BUSCADO. `chamado_compra` tem valor_estimado e
//    valor_final, e a policy dela é pode_acessar_chamado() — que devolve true
//    quando responsavel_id IS NULL. Ou seja, o valor de um pedido recém-aberto
//    é legível por qualquer autenticado. Em vez de buscar e esconder no
//    cliente (um spread de distância do vazamento), a Home simplesmente não
//    pede as colunas. Defesa por construção, não por disciplina.
//
// 2. AS CHAVES CARREGAM O USUÁRIO. As três consultas de chamado da Home antiga
//    tinham chave estática, então ao trocar de conta o React Query servia o
//    dado do usuário anterior até o refetch.
//
// 3. `dashboard-visitas` NÃO É RENOMEADA. Cinco arquivos a invalidam de fora
//    (visita.$id.tsx ×4 e visita.$id.reagendar.tsx). Renomear não quebra nada
//    visivelmente — só deixa a tela de entrada velha depois de aprovar,
//    reprovar ou reagendar uma visita.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  atividadeDoChamado, atividadeDaVisita,
  type Atividade, type BrutoChamado, type BrutoVisita, type FichaCompra,
} from "@/features/atividades/modelo";
import type { SituacaoCompra } from "@/features/chamados/compra";
import { inicioSemana } from "@/lib/periodos";

/** Encerrados mais velhos que isto não entram na Home. */
export const DIAS_ENCERRADO = 7;

const CAMPOS_CHAMADO =
  "id, numero, titulo, status, natureza, tipo, prioridade, equipe, sprint, " +
  "prazo_limite, data_hora_agendada, responsavel_id, aberto_por, " +
  "concluida_em, fechada_em, faturamento_status, created_at, updated_at, " +
  // `!cliente_id` DESAMBIGUA o vínculo (U45/R54): desde que `chamado_clientes`
  // existe, há DOIS caminhos de `chamados` para `clientes` — a FK direta
  // (`chamados.cliente_id`, o cliente principal) e o caminho N:N pela tabela
  // de junção dos clientes extras. O PostgREST recusa o embed ambíguo com
  // PGRST201 e a consulta inteira falha — foi o que derrubou a Home assim que
  // a U45 rodou no banco. A dica é o NOME DA COLUNA, não o da constraint:
  // `chamados` nasceu como `ordens_servico` e o rename não renomeia
  // constraints, então o nome real da FK é `ordens_servico_cliente_id_fkey` —
  // um detalhe histórico que ninguém adivinharia lendo o schema de hoje.
  "cliente_origem_nome, cliente:clientes!cliente_id(nome)";

const CAMPOS_VISITA =
  "id, status, titulo, nome_predio, tecnico_id, data_hora_agendada, created_at, " +
  "foto_fachada_url, endereco, nome_sindico, proposta_enviada_em, proposta_resultado, " +
  "proposta_resultado_em, prioridade, clientes(nome), " +
  // U29: o chamado-capa tem o MESMO id da visita. É de onde vêm o número CH- e
  // a prioridade — sem isto a proposta volta a entrar no quadro sem número.
  "chamado:chamados!visitas_e_chamado(numero, prioridade)";

export interface Sessao {
  userId: string | null;
  cargo: "tecnico" | "sac" | "comercial" | "admin" | null;
}

/** Papel e id numa consulta só — o layout já busca o perfil sob outra chave. */
export function useSessao() {
  return useQuery({
    queryKey: ["home-sessao"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Sessao> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { userId: null, cargo: null };
      const { data } = await supabase
        .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
      const c = (data as any)?.cargo as string | undefined;
      const cargo = c === "tecnico" || c === "sac" || c === "comercial" || c === "admin" ? c : null;
      return { userId: user.id, cargo };
    },
  });
}

export function useChamadosDaHome(s: Sessao) {
  const corte = new Date(Date.now() - DIAS_ENCERRADO * 864e5).toISOString();
  return useQuery({
    queryKey: ["home-chamados", s.userId, s.cargo, corte.slice(0, 10)],
    enabled: !!s.userId,
    queryFn: async (): Promise<BrutoChamado[]> => {
      // corte grosso no servidor por updated_at; o refino por data de
      // encerramento é no cliente, porque PostgREST não tem coalesce.
      const { data, error } = await supabase
        .from("chamados" as any)
        .select(CAMPOS_CHAMADO)
        // A CAPA DA PROPOSTA FICA DE FORA — a visita já a representa.
        //
        // Desde a U29 toda visita tem um chamado com o MESMO id do lado. Os
        // dois viram Atividade, com ids diferentes (`vis-x` e `ch-x`), então
        // nenhuma deduplicação por id os junta: a proposta aparecia DUAS VEZES
        // no quadro e contava dobrado nos painéis. A R29 pede a proposta no
        // Kanban, e ela está lá — pela visita, que é a versão rica (traduz o
        // funil, tem a foto, sabe para qual tela do fluxo levar) e que desde a
        // U29 já carrega o número CH- vindo da capa pelo join.
        .neq("natureza", "comercial")
        .or(`status.not.in.(concluido,cancelado),updated_at.gte.${corte}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as BrutoChamado[];
    },
  });
}

/**
 * TODOS os apoios, para a pilha de avatares dos cards. A tabela é pequena
 * (centenas de linhas) e a leitura é aberta — buscar tudo numa consulta é mais
 * barato que um `.in()` com centenas de ids na URL.
 */
export function useApoiosDeTodos() {
  return useQuery({
    queryKey: ["home-apoios-todos"],
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data, error } = await supabase
        .from("chamado_apoios" as any)
        .select("chamado_id, profile_id")
        .limit(2000);
      const m = new Map<string, string[]>();
      if (error) return m;
      for (const r of ((data as any[]) ?? [])) {
        const lista = m.get(r.chamado_id as string) ?? [];
        lista.push(r.profile_id as string);
        m.set(r.chamado_id as string, lista);
      }
      return m;
    },
  });
}

/** Chamados onde entrei como apoio — não dá para join, a RLS não devolveria. */
export function useMeusApoios(s: Sessao) {
  return useQuery({
    queryKey: ["home-apoios", s.userId],
    enabled: !!s.userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("chamado_apoios" as any)
        .select("chamado_id")
        .eq("profile_id", s.userId as string);
      if (error) return [];
      return ((data as any[]) ?? []).map((r) => r.chamado_id as string);
    },
  });
}

/**
 * Situação das compras — SEM as colunas de valor, de propósito (ver cabeçalho).
 * Quando um pedido volta sem ficha a causa é acesso, não legado: a U9 garante
 * ficha para 100% dos pedidos por trigger e backfill.
 */
export function useFichasDeCompra(ids: string[], userId: string | null) {
  const chave = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["home-compras-situacao", userId, chave],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, SituacaoCompra>> => {
      const { data, error } = await supabase
        .from("chamado_compra" as any)
        .select("chamado_id, situacao")
        .in("chamado_id", ids);
      if (error) return {};
      const m: Record<string, SituacaoCompra> = {};
      for (const r of ((data as any[]) ?? [])) m[r.chamado_id as string] = r.situacao as SituacaoCompra;
      return m;
    },
  });
}

/** Mantém a chave antiga de propósito — cinco arquivos a invalidam de fora. */
export function useVisitasDaHome(s: Sessao, tecnicoFiltro: string) {
  return useQuery({
    queryKey: ["dashboard-visitas", s.cargo, tecnicoFiltro, s.userId],
    enabled: !!s.userId,
    queryFn: async (): Promise<BrutoVisita[]> => {
      let q = supabase.from("visitas_tecnicas").select(CAMPOS_VISITA);
      if (s.cargo === "tecnico") q = q.eq("tecnico_id", s.userId as string);
      else if (tecnicoFiltro !== "todos") q = q.eq("tecnico_id", tecnicoFiltro);
      const { data, error } = await q.order("data_hora_agendada", { ascending: true });
      if (error) throw error;
      return ((data as any[]) ?? []) as BrutoVisita[];
    },
  });
}

export interface AtividadesDaHome {
  atividades: Atividade[];
  /** encerrados de até ~5 semanas — só os painéis do topo usam (U33) */
  historico: Atividade[];
  visitas: BrutoVisita[];
  carregando: boolean;
  erro: boolean;
}

/**
 * Junta tudo num array só. É este array que alimenta o banner, a lista e o
 * quadro — sem consulta paralela, então o número do banner não pode discordar
 * do que está na tela.
 */
export function useAtividades(s: Sessao, tecnicoFiltro: string, agora: Date): AtividadesDaHome {
  const chamados = useChamadosDaHome(s);
  const apoios = useMeusApoios(s);
  const apoiosDeTodos = useApoiosDeTodos();
  const visitas = useVisitasDaHome(s, tecnicoFiltro);
  const historicoBruto = useHistoricoAmplo(s);

  const idsCompra = useMemo(
    () => (chamados.data ?? []).filter((c) => c.tipo === "pedido_compra").map((c) => c.id),
    [chamados.data],
  );
  const fichas = useFichasDeCompra(idsCompra, s.userId);

  const atividades = useMemo<Atividade[]>(() => {
    const ctx = {
      userId: s.userId,
      apoios: new Set(apoios.data ?? []),
      fichas: new Map<string, FichaCompra>(
        Object.entries(fichas.data ?? {}).map(([k, v]) => [k, { situacao: v }]),
      ),
      apoiosDoChamado: apoiosDeTodos.data,
    };
    const corte = agora.getTime() - DIAS_ENCERRADO * 864e5;
    const lista: Atividade[] = [];

    const soMeus = s.cargo === "tecnico";
    for (const c of chamados.data ?? []) {
      const a = atividadeDoChamado(c, ctx);
      // "todas as atividades que ENVOLVEM o usuário" — para o técnico isso é
      // recorte, não decoração: sem ele a Home dele mostra os 537 chamados
      // internos que a policy entrega a qualquer autenticado
      if (soMeus && !(a.souResponsavel || a.souApoio || a.souAutor)) continue;
      // refino do corte: quando o chamado saiu da fila de verdade. A conta
      // mora no modelo (`encerradoEm`) porque o gráfico precisa do mesmo
      // número — duas contas do mesmo fato acabam discordando.
      if (a.encerradoEm && new Date(a.encerradoEm).getTime() < corte) continue;
      lista.push(a);
    }
    for (const v of visitas.data ?? []) {
      const a = atividadeDaVisita(v, ctx);
      if (a.encerradoEm && new Date(a.encerradoEm).getTime() < corte) continue;
      lista.push(a);
    }
    return lista;
    // `agora` entra nas dependências de propósito: sem isso o "atrasado"
    // calculado na montagem nunca mais muda enquanto a tela fica aberta
  }, [chamados.data, visitas.data, apoios.data, apoiosDeTodos.data, fichas.data, s.userId, s.cargo, agora]);

  /**
   * O histórico, montado com o MESMO contexto — só para os painéis do topo.
   *
   * Passa pelo mesmo `atividadeDoChamado` de propósito: se tivesse um caminho
   * próprio, um status novo ou uma cor nova precisaria ser ensinada duas
   * vezes, e a segunda seria esquecida.
   *
   * O recorte do técnico é repetido aqui porque a policy entrega a ele todos
   * os chamados internos sem responsável — sem o filtro, o gráfico dele
   * contaria o trabalho da casa inteira.
   */
  const historico = useMemo<Atividade[]>(() => {
    const ctx = {
      userId: s.userId,
      apoios: new Set(apoios.data ?? []),
      fichas: new Map<string, FichaCompra>(),
      apoiosDoChamado: apoiosDeTodos.data,
    };
    const soMeus = s.cargo === "tecnico";
    const lista: Atividade[] = [];
    for (const c of historicoBruto.data ?? []) {
      const a = atividadeDoChamado(c, ctx);
      if (soMeus && !(a.souResponsavel || a.souApoio || a.souAutor)) continue;
      lista.push(a);
    }
    return lista;
  }, [historicoBruto.data, apoios.data, apoiosDeTodos.data, s.userId, s.cargo]);

  return {
    atividades,
    historico,
    visitas: visitas.data ?? [],
    carregando: chamados.isLoading || visitas.isLoading,
    erro: chamados.isError || visitas.isError,
  };
}

// ── Histórico amplo, só para os painéis do topo ─────────────────────────────

/**
 * As atividades ENCERRADAS numa janela larga — quatro semanas para trás, ou o
 * começo do mês, o que for mais antigo.
 *
 * POR QUE EXISTE: a Home poda encerrados com mais de 7 dias (DIAS_ENCERRADO),
 * e faz bem — o quadro é fila de trabalho, não arquivo. Mas os painéis do topo
 * falam de PERÍODO: "concluídos por semana" precisa de quatro semanas
 * inteiras, e "concluídas no mês" precisa do mês inteiro. Sem esta consulta,
 * as barras do passado e a meta seriam sempre menores que a verdade na última
 * semana do mês.
 *
 * POR QUE DEVOLVE ATIVIDADE, E NÃO CONTAGEM: antes eram duas consultas que
 * traziam só `concluida_em` e `status` — números prontos, que os filtros do
 * quadro não tinham como recortar. Trazendo as MESMAS colunas da Home e
 * passando pelo mesmo montador, o painel do topo responde aos filtros
 * exatamente como o quadro embaixo. É o que o Davi pediu: gráfico e quadro
 * contando a mesma história.
 */
export function useHistoricoAmplo(s: Sessao) {
  const desde = useMemo(() => {
    const agora = new Date();
    const quatroSemanas = inicioSemana(agora);
    quatroSemanas.setDate(quatroSemanas.getDate() - 28);
    const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return (quatroSemanas < inicioDoMes ? quatroSemanas : inicioDoMes).toISOString();
  }, []);

  return useQuery({
    queryKey: ["home-historico", s.userId, s.cargo, desde.slice(0, 10)],
    enabled: !!s.userId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrutoChamado[]> => {
      // Filtra pela DATA DE ENCERRAMENTO, não por `updated_at`.
      //
      // Medido no export do Notion antes de escrever isto: a importação grava
      // 2000 atividades concluídas de uma vez, e todas nascem com `updated_at`
      // = hoje. Um corte por `updated_at` traria as 2000 — passando do teto de
      // linhas do PostgREST, que TRUNCA em silêncio. Os gráficos ficariam
      // errados sem nenhum sinal de erro, que é o pior jeito de estarem
      // errados.
      //
      // `or` porque PostgREST não tem coalesce: vale a data de conclusão ou a
      // de fechamento. Encerrado sem nenhuma das duas fica de fora — não dá
      // para colocar numa semana o que não tem data, e a Home já o mostra
      // enquanto for recente.
      const { data, error } = await supabase
        .from("chamados" as any)
        .select(CAMPOS_CHAMADO)
        // mesma razão da consulta da Home: a capa da proposta duplicaria a
        // visita, e aqui o efeito é uma barra do gráfico contando dobrado
        .neq("natureza", "comercial")
        .in("status", ["concluido", "cancelado"])
        .or(`concluida_em.gte.${desde},fechada_em.gte.${desde}`)
        // rede de segurança: se algum dia a janela crescer, é melhor faltar
        // barra do que a resposta ser cortada sem avisar
        .limit(2000);
      if (error) throw error;
      return ((data as any[]) ?? []) as BrutoChamado[];
    },
  });
}
