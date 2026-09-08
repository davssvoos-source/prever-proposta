// REAÇÕES a comentário — os dados (R217, U117).
//
// Tabela `chamado_reacoes` (migration U117): uma linha por pessoa+comentário+
// emoji. Lê-se por ATIVIDADE (o Configurador rápido e a página) ou por lista de
// comentários (o chat de menções); reagir é INSERT, tirar a reação é DELETE —
// não há UPDATE. A RLS é a régua da casa: quem vê a atividade vê as reações;
// só o próprio cria e apaga a sua.
//
// REGRA 5 (ordem de deploy): até o Davi rodar a U117 a tabela não existe — o
// 42P01 vira `faltaMigration: true` e a tela esconde as reações, sem erro.
//
// Fica FORA de chamados/data.ts de propósito: o verificador conta os SELECTs
// de chamado_eventos daquele arquivo (um só, por atividade), e reação não é
// evento — é outra tabela, outro módulo.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReacaoLinha {
  id: string;
  evento_id: string;
  chamado_id: string;
  profile_id: string;
  emoji: string;
}

export interface ReacoesCarregadas {
  reacoes: ReacaoLinha[];
  /** true = a U117 ainda não rodou; a tela esconde as reações */
  faltaMigration: boolean;
}

const VAZIO: ReacoesCarregadas = { reacoes: [], faltaMigration: false };

/** 42P01 = a tabela ainda não existe (a migration não rodou). */
function semTabela(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return e?.code === "42P01" || /relation .* does not exist/i.test(e?.message ?? "");
}

const CAMPOS = "id, evento_id, chamado_id, profile_id, emoji";

/** Todas as reações dos comentários de UMA atividade — um SELECT. */
export function useReacoesDoChamado(chamadoId: string | null | undefined) {
  return useQuery({
    queryKey: ["reacoes", "chamado", chamadoId],
    enabled: !!chamadoId,
    staleTime: 15_000,
    queryFn: async (): Promise<ReacoesCarregadas> => {
      const { data, error } = await supabase
        .from("chamado_reacoes" as any)
        .select(CAMPOS)
        .eq("chamado_id", chamadoId!);
      if (error) {
        if (semTabela(error)) return { reacoes: [], faltaMigration: true };
        throw error;
      }
      return { reacoes: ((data as any[]) ?? []) as ReacaoLinha[], faltaMigration: false };
    },
  });
}

/** As reações de uma LISTA de comentários (o chat de menções) — um SELECT. */
export function useReacoesDeEventos(eventoIds: readonly string[]) {
  const chave = [...eventoIds].sort().join(",");
  return useQuery({
    queryKey: ["reacoes", "eventos", chave],
    enabled: eventoIds.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<ReacoesCarregadas> => {
      const { data, error } = await supabase
        .from("chamado_reacoes" as any)
        .select(CAMPOS)
        .in("evento_id", [...eventoIds]);
      if (error) {
        if (semTabela(error)) return { reacoes: [], faltaMigration: true };
        throw error;
      }
      return { reacoes: ((data as any[]) ?? []) as ReacaoLinha[], faltaMigration: false };
    },
  });
}

export { VAZIO as SEM_REACOES };

/**
 * Reagir ou tirar a reação — um toggle por pessoa+comentário+emoji (R217).
 * O `chamadoId` desnormalizado vai junto porque a policy o confere contra o do
 * comentário; e o banco recusa emoji fora da lista (CHECK).
 */
export async function alternarReacao(args: {
  chamadoId: string; eventoId: string; emoji: string; euId: string; jaReagi: boolean;
}): Promise<void> {
  const { chamadoId, eventoId, emoji, euId, jaReagi } = args;
  if (jaReagi) {
    const { error } = await supabase
      .from("chamado_reacoes" as any)
      .delete()
      .eq("evento_id", eventoId)
      .eq("profile_id", euId)
      .eq("emoji", emoji);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("chamado_reacoes" as any)
    .insert({ evento_id: eventoId, chamado_id: chamadoId, profile_id: euId, emoji } as any);
  // 23505 = já existia (dois cliques rápidos): a reação está lá, não é erro
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Invalida toda leitura de reações — a da atividade e a do chat. */
export function useInvalidarReacoes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["reacoes"] });
}
