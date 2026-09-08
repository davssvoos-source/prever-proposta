// O CHAT da Início — os dados (R215, U117; R222–R223, U119).
//
// As MENÇÕES vêm da função `minhas_mencoes()` (U117; v2 na U119, com o status,
// o prazo, a agenda e "respondida"): os comentários e os campos da atividade
// que mencionam quem está logado, já filtrados pela RLS (a função é SECURITY
// INVOKER). Não é um SELECT de chamado_eventos entre chamados — o verificador
// proíbe isso em chamados/data.ts, e a função é a porta certa: a regex da
// menção mora em UM lugar no banco (mencoes_em, U95).
//
// As MENSAGENS PARA TODOS (R223) vêm de `mensagens_chat` (U119), e chegam ao
// vivo pelo canal realtime da tabela.
//
// REGRA 5: até o Davi rodar a migration, a função não existe — 42883 (Postgres)
// ou PGRST202 (o PostgREST não a acha no cache) — ou a tabela não existe (42P01):
// tudo vira `faltaMigration: true`, e o chat explica em vez de quebrar. A v1 da
// função (U117) devolve menos colunas: as novas chegam undefined e o modelo as
// trata como "sem cor, não respondida".
//
// Atualização: toda menção nova gera uma notificação (U95), e o canal realtime
// de `notificacoes` (useNotificacoes) invalida ["minhas-mencoes"] junto.

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mencaoDaLinha, mensagemDaLinha,
  type LinhaDeMencao, type LinhaDeMensagem, type Mencao, type MensagemParaTodos,
} from "./chat";

export interface MencoesCarregadas {
  mencoes: Mencao[];
  faltaMigration: boolean;
}

function semFuncao(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return e?.code === "42883" || e?.code === "PGRST202" || /function .* does not exist|Could not find the function/i.test(e?.message ?? "");
}

function semTabela(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return e?.code === "42P01" || /relation .* does not exist/i.test(e?.message ?? "");
}

export const TETO_DE_MENCOES = 100;
export const TETO_DE_MENSAGENS = 100;

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

export interface MensagensCarregadas {
  mensagens: MensagemParaTodos[];
  faltaMigration: boolean;
}

/** As últimas mensagens para todo mundo (R223). Carrega mesmo com o chat recolhido — o selo precisa delas. */
export function useMensagensDoChat(ativo = true) {
  return useQuery({
    queryKey: ["mensagens-chat"],
    enabled: ativo,
    staleTime: 30_000,
    queryFn: async (): Promise<MensagensCarregadas> => {
      const { data, error } = await supabase
        .from("mensagens_chat" as any)
        .select("id, autor_id, texto, criado_em")
        .order("criado_em", { ascending: false })
        .limit(TETO_DE_MENSAGENS);
      if (error) {
        if (semTabela(error)) return { mensagens: [], faltaMigration: true };
        throw error;
      }
      return { mensagens: ((data as unknown as LinhaDeMensagem[]) ?? []).map(mensagemDaLinha), faltaMigration: false };
    },
  });
}

/** O canal ao vivo da tabela: mensagem nova de alguém recarrega a lista (e o selo). */
export function useCanalDoChat(ativo = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ativo) return;
    const canal = supabase
      .channel("mensagens-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_chat" }, () => {
        qc.invalidateQueries({ queryKey: ["mensagens-chat"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [ativo, qc]);
}

export async function enviarMensagemParaTodos(texto: string): Promise<void> {
  const t = texto.trim();
  if (!t) throw new Error("Escreva alguma coisa antes de enviar.");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Faça login para enviar.");
  const { error } = await supabase.from("mensagens_chat" as any).insert({ autor_id: u.user.id, texto: t } as any);
  if (error) {
    if (semTabela(error)) throw new Error("O chat para todos precisa da migration U119.");
    throw error;
  }
}

export async function apagarMensagemDoChat(id: string): Promise<void> {
  const { error } = await supabase.from("mensagens_chat" as any).delete().eq("id", id);
  if (error) throw error;
}
