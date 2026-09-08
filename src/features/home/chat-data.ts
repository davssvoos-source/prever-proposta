// O CHAT DE MENÇÕES — os dados (R215, U117).
//
// A lista vem da função `minhas_mencoes()` (migration U117): os comentários e
// as descrições que mencionam quem está logado, já filtrados pela RLS (a
// função é SECURITY INVOKER). Não é um SELECT de chamado_eventos entre
// chamados — o verificador proíbe isso em chamados/data.ts, e a função é a
// porta certa: a regex da menção mora em UM lugar no banco (mencoes_em, U95).
//
// REGRA 5: até o Davi rodar a U117 a função não existe — 42883 (Postgres) ou
// PGRST202 (o PostgREST não a acha no cache) viram `faltaMigration: true`, e o
// chat explica em vez de quebrar.
//
// Atualização: toda menção nova gera uma notificação (U95), e o canal realtime
// de `notificacoes` (useNotificacoes) invalida ["minhas-mencoes"] junto.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mencaoDaLinha, type LinhaDeMencao, type Mencao } from "./chat";

export interface MencoesCarregadas {
  mencoes: Mencao[];
  faltaMigration: boolean;
}

function semFuncao(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return e?.code === "42883" || e?.code === "PGRST202" || /function .* does not exist|Could not find the function/i.test(e?.message ?? "");
}

export const TETO_DE_MENCOES = 100;

export function useMinhasMencoes(ativo = true) {
  return useQuery({
    queryKey: ["minhas-mencoes"],
    enabled: ativo,
    staleTime: 30_000,
    queryFn: async (): Promise<MencoesCarregadas> => {
      const { data, error } = await supabase.rpc("minhas_mencoes" as any, { _limite: TETO_DE_MENCOES } as any);
      if (error) {
        if (semFuncao(error)) return { mencoes: [], faltaMigration: true };
        throw error;
      }
      return { mencoes: ((data as LinhaDeMencao[]) ?? []).map(mencaoDaLinha), faltaMigration: false };
    },
  });
}
