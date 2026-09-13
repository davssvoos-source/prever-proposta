// Home — as consultas que alimentam lista e quadro. Ver docs/PRODUTO.md §9.
//
// Dois cuidados que valem mais que o código (o primeiro da lista original —
// "valor de compra não é buscado" — morreu com o pedido de compra, R140/U96):
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
  type Atividade, type BrutoChamado, type BrutoVisita,
} from "@/features/atividades/modelo";
import { usePessoas } from "@/features/chamados/data";
import { SERVICO_LABEL, type ServicoCliente } from "@/features/clientes/data";
import { inicioSemana } from "@/lib/periodos";

/** Encerrados mais velhos que isto não entram na Home. */
/**
 * R246 (Davi, 10/09/2026): "Todas as atividades devem aparecer para todos na
 * tela INICIO, bem como as atividades que já foram concluídas." A poda de 7
 * dias das encerradas SAIU. O que fica é um teto de CONTAGEM, não de data: as
 * 300 encerradas mais recentes (a importação do Notion gravou ~2000 concluídas
 * de uma vez, e o PostgREST TRUNCA em silêncio perto de 1000 linhas — teto sem
 * aviso é o pior jeito de faltar dado). Sem cliff de data: uma atividade
 * concluída há meses continua aparecendo enquanto estiver entre as 300.
 */
export const TETO_ENCERRADAS_NA_INICIO = 300;
/** @deprecated R246: a Início não poda mais por dias — fica só para quem ainda lê o nome. */
export const DIAS_ENCERRADO = 7;

/**
 * As colunas da Início. `sprint` saiu (R141: é cálculo sobre o prazo) e
 * `impacto_operacional` entrou (R142). Entre a U96 e a U100 esta lista era uma
 * função do fallback da ordem de deploy (`comFallbackDaU96`); a migration
 * rodou e a lista voltou a ser constante (P60).
 */
const CAMPOS_DA_HOME =
  "id, numero, titulo, status, natureza, tipo, prioridade, equipe, " +
  "impacto_operacional, " +
  "prazo_limite, data_hora_agendada, data_agendada, responsavel_id, aberto_por, " +
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
  cargo: "tecnico" | "sac" | "comercial" | "admin" | "operacional" | null;
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
      const cargo = c === "tecnico" || c === "sac" || c === "comercial" || c === "admin" || c === "operacional" ? c : null;
      return { userId: user.id, cargo };
    },
  });
}

/**
 * `semEncerradas` (R263): a Início do técnico só lista pendência — as 300
 * encerradas são peso morto num aparelho em 4G.
 */
export function useChamadosDaHome(s: Sessao, semEncerradas = false) {
  return useQuery({
    queryKey: ["home-chamados", s.userId, s.cargo, semEncerradas],
    enabled: !!s.userId,
    queryFn: async (): Promise<BrutoChamado[]> => {
      // R246: DUAS consultas — as em aberto TODAS, e as encerradas pelas 300
      // mais recentes (ver TETO_ENCERRADAS_NA_INICIO). Era uma só, com a poda
      // de 7 dias por updated_at; a poda saiu.
      // R264 (U132): cinto e suspensório para o técnico — quem recorta é o
      // banco; o front só deixa de pedir o interno na janela entre subir o
      // pacote e rodar a migration (e poupa o 4G dele).
      const soCampo = (q: any) => (s.cargo === "tecnico" ? q.neq("natureza", "interno") : q);
      const { data: encerradas, error: erroEnc } = semEncerradas
        ? { data: [] as any[], error: null }
        : await soCampo(supabase
          .from("chamados" as any)
          .select(CAMPOS_DA_HOME)
          .neq("natureza", "comercial"))
          .in("status", ["concluido", "cancelado"])
          .order("updated_at", { ascending: false })
          .limit(TETO_ENCERRADAS_NA_INICIO);
      if (erroEnc) throw erroEnc;
      const { data, error } = await soCampo(supabase
        .from("chamados" as any)
        .select(CAMPOS_DA_HOME))
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
        .not("status", "in", "(concluido,cancelado)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const lista = [...(((data as any[]) ?? []) as BrutoChamado[]), ...(((encerradas as any[]) ?? []) as BrutoChamado[])];
      // R225 (U119) — REGRA 5: `reagendamentos` vem numa consulta à parte, só
      // dos que foram remarcados (poucos), porque até a migration rodar a
      // coluna não existe (42703) e pôr o nome dela no SELECT principal
      // derrubaria a Início inteira. Sem a coluna, os cards só não dizem
      // "Re-agendado Nx".
      const rem = await supabase.from("chamados" as any).select("id, reagendamentos").gt("reagendamentos", 0);
      if (!rem.error && Array.isArray(rem.data)) {
        const porId = new Map<string, number>((rem.data as any[]).map((r) => [r.id as string, Number(r.reagendamentos) || 0]));
        for (const c of lista) c.reagendamentos = porId.get(c.id) ?? 0;
      }
      return lista;
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

/**
 * TODOS os locais dos cards (R84/R85, U71). Mesma razão do `useApoiosDeTodos`
 * acima: a tabela é pequena e de leitura aberta, então uma consulta inteira
 * sai mais barata que um `.in()` com centenas de ids na URL.
 *
 * O local é resolvido para RÓTULO aqui, e não no card: o card não precisa
 * saber que existe cliente, prospecção e setor — para ele os três são "onde a
 * atividade acontece". Setor vira o nome do serviço ("Portaria Remota");
 * cliente e prospecção viram o nome do lugar.
 *
 * Um embed do PostgREST resolveria os nomes numa ida só, mas NÃO se faz isso
 * aqui: `chamado_locais` tem duas FKs chegando em tabelas diferentes, e o
 * embed ambíguo é exatamente o PGRST201 que derrubou a Início quando a U45
 * subiu (ver o comentário em CAMPOS_CHAMADO). Consultas simples e um `Map`
 * montado à mão é mais chato de ler e não cai.
 */
export function useLocaisDeTodos() {
  return useQuery({
    queryKey: ["home-locais-todos"],
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const m = new Map<string, string[]>();
      const { data, error } = await supabase
        .from("chamado_locais" as any)
        .select("chamado_id, cliente_id, prospeccao_id, setor")
        .limit(4000);
      if (error) return m;
      const linhas = ((data as any[]) ?? []);
      if (!linhas.length) return m;

      const idsCliente = [...new Set(linhas.map((r) => r.cliente_id).filter(Boolean))];
      const idsProsp = [...new Set(linhas.map((r) => r.prospeccao_id).filter(Boolean))];

      const nomes = new Map<string, string>();
      if (idsCliente.length) {
        const { data: cs } = await supabase
          .from("clientes" as any).select("id, nome").in("id", idsCliente);
        for (const c of ((cs as any[]) ?? [])) nomes.set(c.id as string, c.nome as string);
      }
      if (idsProsp.length) {
        const { data: ps } = await supabase
          .from("prospeccoes" as any).select("id, nome").in("id", idsProsp);
        for (const p of ((ps as any[]) ?? [])) nomes.set(p.id as string, p.nome as string);
      }

      for (const r of linhas) {
        const rotulo = r.setor
          ? (SERVICO_LABEL[r.setor as ServicoCliente] ?? (r.setor as string))
          : nomes.get((r.cliente_id ?? r.prospeccao_id) as string);
        // sem rótulo = a RLS não devolveu o nome. Silêncio é melhor que um
        // chip "undefined" no card.
        if (!rotulo) continue;
        const lista = m.get(r.chamado_id as string) ?? [];
        if (!lista.includes(rotulo)) lista.push(rotulo);
        m.set(r.chamado_id as string, lista);
      }
      return m;
    },
  });
}

// `useEquipesDeTodos` (R83, U71) MORREU AQUI (R139, U96): a equipe da atividade
// é a das pessoas nela, e `chamado_equipes` deixou de ser lida — e de ser
// escrita. A tabela fica no banco como histórico.

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

/** Mantém a chave antiga de propósito — cinco arquivos a invalidam de fora. */
export function useVisitasDaHome(s: Sessao, tecnicoFiltro: string) {
  return useQuery({
    queryKey: ["dashboard-visitas", s.cargo, tecnicoFiltro, s.userId],
    enabled: !!s.userId,
    queryFn: async (): Promise<BrutoVisita[]> => {
      let q = supabase.from("visitas_tecnicas").select(CAMPOS_VISITA);
      // R221 (U119): o técnico vê as visitas de todos — o filtro por pessoa é
      // escolha de quem olha, não recorte do cargo
      if (tecnicoFiltro !== "todos") q = q.eq("tecnico_id", tecnicoFiltro);
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
export function useAtividades(
  s: Sessao,
  tecnicoFiltro: string,
  agora: Date,
  opcoes: { semEncerradas?: boolean } = {},
): AtividadesDaHome {
  const chamados = useChamadosDaHome(s, !!opcoes.semEncerradas);
  const apoios = useMeusApoios(s);
  const apoiosDeTodos = useApoiosDeTodos();
  const locaisDeTodos = useLocaisDeTodos();
  const visitas = useVisitasDaHome(s, tecnicoFiltro);
  const historicoBruto = useHistoricoAmplo(s, !opcoes.semEncerradas);
  // R139: a equipe de cada atividade sai do cadastro das PESSOAS nela. Os
  // perfis já estão em cache (a Início inteira os usa para os avatares).
  const { data: pessoas = [] } = usePessoas();
  const equipeDePessoa = useMemo(
    () => new Map<string, string | null>(pessoas.map((p) => [p.id, p.equipe ?? null])),
    [pessoas],
  );

  const atividades = useMemo<Atividade[]>(() => {
    const ctx = {
      userId: s.userId,
      apoios: new Set(apoios.data ?? []),
      apoiosDoChamado: apoiosDeTodos.data,
      locaisDoChamado: locaisDeTodos.data,
      equipeDePessoa,
    };
    const lista: Atividade[] = [];

    // R221 (U119): o recorte "só o meu" do técnico SAIU. Davi, 08/09/2026:
    // "Todos os usuários devem poder visualizar todas as atividades do
    // sistema." A lente "Meu dia" e o filtro por pessoa continuam sendo o
    // jeito de olhar só o seu — escolha, não imposição.
    for (const c of chamados.data ?? []) {
      // R246: sem poda por data — o que veio do servidor entra. O teto é de
      // contagem (as 300 encerradas mais recentes), lá na consulta.
      lista.push(atividadeDoChamado(c, ctx));
    }
    for (const v of visitas.data ?? []) {
      lista.push(atividadeDaVisita(v, ctx));
    }
    return lista;
    // `agora` entra nas dependências de propósito: sem isso o "atrasado"
    // calculado na montagem nunca mais muda enquanto a tela fica aberta
  }, [chamados.data, visitas.data, apoios.data, apoiosDeTodos.data, locaisDeTodos.data, equipeDePessoa, s.userId, s.cargo, agora]);

  /**
   * O histórico, montado com o MESMO contexto — só para os painéis do topo.
   *
   * Passa pelo mesmo `atividadeDoChamado` de propósito: se tivesse um caminho
   * próprio, um status novo ou uma cor nova precisaria ser ensinada duas
   * vezes, e a segunda seria esquecida.
   *
   * R221 (U119): sem recorte por cargo — o gráfico de todo mundo conta a casa
   * inteira, como a Início de todo mundo mostra a casa inteira.
   */
  const historico = useMemo<Atividade[]>(() => {
    const ctx = {
      userId: s.userId,
      apoios: new Set(apoios.data ?? []),
      apoiosDoChamado: apoiosDeTodos.data,
      locaisDoChamado: locaisDeTodos.data,
      equipeDePessoa,
    };
    const lista: Atividade[] = [];
    for (const c of historicoBruto.data ?? []) {
      lista.push(atividadeDoChamado(c, ctx));
    }
    return lista;
  }, [historicoBruto.data, apoios.data, apoiosDeTodos.data, locaisDeTodos.data, equipeDePessoa, s.userId, s.cargo]);

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
/** `habilitado = false` (R263): a Início do técnico não tem painéis — não pede o histórico. */
export function useHistoricoAmplo(s: Sessao, habilitado = true) {
  const desde = useMemo(() => {
    const agora = new Date();
    const quatroSemanas = inicioSemana(agora);
    quatroSemanas.setDate(quatroSemanas.getDate() - 28);
    const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return (quatroSemanas < inicioDoMes ? quatroSemanas : inicioDoMes).toISOString();
  }, []);

  return useQuery({
    queryKey: ["home-historico", s.userId, s.cargo, desde.slice(0, 10)],
    enabled: !!s.userId && habilitado,
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
        .select(CAMPOS_DA_HOME)
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
