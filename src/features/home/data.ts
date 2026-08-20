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

/** Encerrados mais velhos que isto não entram na Home. */
export const DIAS_ENCERRADO = 7;

const CAMPOS_CHAMADO =
  "id, numero, titulo, status, natureza, tipo, prioridade, equipe, sprint, " +
  "prazo_limite, data_hora_agendada, responsavel_id, aberto_por, " +
  "concluida_em, fechada_em, faturamento_status, created_at, updated_at, " +
  "cliente:clientes(nome)";

const CAMPOS_VISITA =
  "id, status, titulo, nome_predio, tecnico_id, data_hora_agendada, created_at, " +
  "foto_fachada_url, endereco, nome_sindico, proposta_enviada_em, proposta_resultado, " +
  "proposta_resultado_em, clientes(nome)";

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
        .or(`status.not.in.(concluido,cancelado),updated_at.gte.${corte}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as BrutoChamado[];
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
  const visitas = useVisitasDaHome(s, tecnicoFiltro);

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
      if (!a.emAberto) {
        // refino do corte: quando o chamado saiu da fila de verdade.
        // `finalizada_em` NÃO é usada aqui de propósito — ela é o carimbo do
        // motor de cobrança (quando o técnico entregou), não o de encerramento.
        const bruto = c as any;
        const fim = bruto.concluida_em ?? bruto.fechada_em ?? c.updated_at ?? c.created_at;
        if (new Date(fim).getTime() < corte) continue;
      }
      lista.push(a);
    }
    for (const v of visitas.data ?? []) {
      const a = atividadeDaVisita(v, ctx);
      if (!a.emAberto) {
        // pela data do DESFECHO, não pela de criação: uma proposta aceita hoje
        // numa visita de três meses atrás sumia no instante do registro
        const fim = (v as any).proposta_resultado_em ?? v.created_at;
        if (new Date(fim).getTime() < corte) continue;
      }
      lista.push(a);
    }
    return lista;
    // `agora` entra nas dependências de propósito: sem isso o "atrasado"
    // calculado na montagem nunca mais muda enquanto a tela fica aberta
  }, [chamados.data, visitas.data, apoios.data, fichas.data, s.userId, s.cargo, agora]);

  return {
    atividades,
    visitas: visitas.data ?? [],
    carregando: chamados.isLoading || visitas.isLoading,
    erro: chamados.isError || visitas.isError,
  };
}
