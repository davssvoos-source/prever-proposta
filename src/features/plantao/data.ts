// Atendimento de plantão — a camada de dados (R117, U87).
//
// A LÓGICA PURA MORA EM ./modelo.ts E NÃO SE REPETE AQUI. Este arquivo não
// valida rascunho, não decide o que é divergência de escala e não formata hora:
// ele chama duas RPCs, lê uma lista e invalida cache.
//
// ── UMA PORTA SÓ DE ESCRITA, E ELA É ESTRUTURA ────────────────────────────
// `atendimentos_plantao` é SÓ-LEITURA no navegador por PRIVILÉGIO (a migration
// faz `REVOKE ALL … FROM authenticated` e concede só SELECT). Não existe um
// caminho de `upsert` direto como o da célula do sobreaviso, e a ausência é
// decisão: aqui não há auto-save por digitação — há um registro, que é uma
// DECISÃO, com recusa para mostrar e resposta para ler (a divergência com a
// escala). O que a U86 §data chama de "porta 1" simplesmente não existe neste
// domínio.
//
// `as any` nas consultas pela mesma razão do resto do app: o
// src/integrations/supabase/types.ts está desatualizado (baseline do tsc) e não
// conhece `public.atendimentos_plantao`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diasDoMes } from "@/features/sobreaviso/modelo";
import type { AtendimentoParaPainel } from "./painel";
import {
  corpoDoAtendimento,
  ordenarAtendimentos,
  type AtendimentoDePlantao,
  type RascunhoDoAtendimento,
  type RespostaDoPlantao,
} from "./modelo";

/**
 * As colunas, escritas à mão e não `*`, pelo mesmo motivo de
 * `programacao/data.ts`: nomear é o que faz uma coluna nova só chegar ao
 * cliente quando alguém decide.
 */
const CAMPOS =
  "id, hora, dia, plantonista_id, tipo, descricao, cliente_id, cliente_informado, chamado_id";

/**
 * OS ATENDIMENTOS DE UMA COMPETÊNCIA — a matéria-prima do painel (U91).
 *
 * Filtra por `dia`, que é a projeção do GATILHO em America/Sao_Paulo (U87), e
 * NÃO por `hora`. É a mesma razão que a U87 escreveu para a lista ser por
 * recência: o cliente não sabe o `dia`, e um filtro por `hora::date` calculado
 * aqui daria uma segunda resposta para "de que dia foi esse plantão" — as duas
 * discordariam na madrugada, que é justamente quando o plantão acontece.
 *
 * O RECORTE DE QUEM APARECE É DA POLICY, não daqui: o plantonista lê as linhas
 * dele, quem responde pela operação lê as de todos. O painel vive numa tela
 * que já é de gestor, então na prática ele vê o mês inteiro — mas se um dia a
 * tela abrir para mais gente, o número encolhe sozinho em vez de vazar.
 */
export function useAtendimentosDoMes(competencia: string) {
  const dias = diasDoMes(competencia);
  const de = dias[0];
  const ate = dias[dias.length - 1];
  return useQuery({
    queryKey: ["plantao", "mes", competencia],
    enabled: !!de && !!ate,
    queryFn: async (): Promise<AtendimentoParaPainel[]> => {
      const { data, error } = await (supabase as any)
        .from("atendimentos_plantao")
        .select(CAMPOS)
        .gte("dia", de)
        .lte("dia", ate)
        .order("dia");
      // A MENSAGEM DO SERVIDOR CHEGA, e o erro NÃO vira lista vazia. Um painel
      // que mostra "0 atendimentos" numa consulta RECUSADA é indistinguível de
      // um mês tranquilo — foi exatamente assim que a grade de sobreaviso da
      // U86 chegou a exportar um PDF dizendo "31 dias descobertos".
      if (error) throw new Error(error.message);
      return (data ?? []) as AtendimentoParaPainel[];
    },
    staleTime: 30_000,
  });
}

/**
 * OS ATENDIMENTOS DE PLANTÃO DE UM CLIENTE — o pedaço que faltava no histórico
 * dele (R123, U92).
 *
 * A ficha do cliente mostrava contratos, chamados e visitas. O plantão nasceu
 * na U87 e nunca chegou lá: um cliente atendido às 3h da manhã não tinha esse
 * fato em lugar nenhum da própria ficha, e "histórico completo" era o nome de
 * algo incompleto.
 *
 * SÓ O CLIENTE CADASTRADO. `cliente_informado` (texto livre) não entra: casar
 * por nome traria o atendimento de "Padaria X" para a ficha de outra padaria
 * homônima, e uma ficha que mostra o atendimento do vizinho é pior que uma
 * ficha que mostra de menos. Quem digitou o nome à mão aparece no painel do
 * mês, que agrupa por texto e não afirma identidade.
 */
export function useAtendimentosDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["plantao", "cliente", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async (): Promise<AtendimentoDePlantao[]> => {
      const { data, error } = await (supabase as any)
        .from("atendimentos_plantao")
        .select(CAMPOS)
        .eq("cliente_id", clienteId)
        .order("hora", { ascending: false })
        .limit(TETO_DA_LISTA);
      if (error) throw new Error(error.message);
      return ordenarAtendimentos(((data as any[]) ?? []) as AtendimentoDePlantao[]);
    },
  });
}

/** Quantos atendimentos a lista do painel mostra. */
export const TETO_DA_LISTA = 20;

/**
 * OS ÚLTIMOS ATENDIMENTOS QUE ESTE USUÁRIO PODE LER.
 *
 * ── POR QUE NÃO É "OS DO DIA" ─────────────────────────────────────────────
 * Porque o cliente NÃO SABE o `dia`. A projeção é do gatilho, em
 * America/Sao_Paulo; se esta consulta filtrasse por um dia calculado aqui, o
 * app passaria a ter uma segunda resposta para "de que dia foi esse plantão" —
 * e as duas divergiriam na madrugada, que é quando o plantão acontece. A lista
 * é por RECÊNCIA, que não precisa de fuso nenhum, e cada linha mostra o `dia`
 * que VOLTOU do servidor.
 *
 * O recorte de QUEM aparece é da policy e não daqui: o plantonista vê as suas
 * linhas, quem responde pela operação vê as de todos.
 */
/**
 * OS MEUS, E O RECORTE É DO PAINEL — não da policy.
 *
 * A policy é `plantonista_id = auth.uid() OR is_gestor(auth.uid())`, e ela está
 * certa: o gestor PRECISA poder ler para conferir. Mas esta consulta é a do
 * PAINEL DE REGISTRO, cujo cabeçalho diz "Últimos atendimentos" logo abaixo da
 * frase "não sai do seu registro" — e sem o `.eq` ela devolvia, para qualquer
 * gestor (e **o SAC é gestor**, R13), os últimos vinte da empresa inteira,
 * **sem o nome de ninguém**, com uma lixeira em cada linha que apaga sem deixar
 * lápide. Uma linha que parece duplicata do que a pessoa acabou de lançar é o
 * atendimento de outro plantonista, às 3h da manhã, e some.
 *
 * O conserto é o recorte, não uma coluna de nome: uma tela de gestão sobre
 * plantão de todo mundo é outra tela, e a R117 diz por escrito que ela não
 * existe nesta entrega. Aqui o painel só para de responder uma pergunta que
 * ninguém lhe fez.
 */
export function useMeusAtendimentos(euId: string | null) {
  return useQuery({
    queryKey: ["plantao", "recentes", euId],
    enabled: !!euId,
    staleTime: 30_000,
    queryFn: async (): Promise<AtendimentoDePlantao[]> => {
      const { data, error } = await (supabase as any)
        .from("atendimentos_plantao")
        .select(CAMPOS)
        .eq("plantonista_id", euId)
        .order("hora", { ascending: false })
        .limit(TETO_DA_LISTA);
      if (error) throw new Error(error.message);
      return ordenarAtendimentos(((data as any[]) ?? []) as AtendimentoDePlantao[]);
    },
  });
}

/**
 * Os chamados a que se pode PENDURAR um atendimento.
 *
 * Lista curta e de colunas curtas, de propósito: o painel abre às 2h da manhã,
 * num celular, e `useChamados()` traz o registro inteiro de todos. A RLS já
 * limita quem aparece; a porta confere de novo, com `pode_acessar_chamado`,
 * porque a lista da tela nunca é a fronteira.
 */
export interface ChamadoParaVincular {
  id: string;
  numero: string | null;
  titulo: string | null;
  status: string | null;
}

export function useChamadosParaVincular(habilitado: boolean) {
  return useQuery({
    queryKey: ["plantao", "chamados-para-vincular"],
    enabled: habilitado,
    staleTime: 60_000,
    queryFn: async (): Promise<ChamadoParaVincular[]> => {
      const { data, error } = await (supabase as any)
        .from("chamados")
        .select("id, numero, titulo, status")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return ((data as any[]) ?? []) as ChamadoParaVincular[];
    },
  });
}

/**
 * REGISTRA (ou CORRIGE, com `id`) — e devolve a resposta INTEIRA da porta.
 *
 * A resposta não é descartada: é dela que sai o dia projetado e o aviso de
 * escala. Uma mutação que só olhasse `error` jogaria fora a única coisa que
 * torna a divergência entre escala e registro visível para quem pode
 * consertá-la.
 *
 * A montagem do corpo é `corpoDoAtendimento`, no modelo puro. Se ele devolver
 * `null`, o rascunho não passa — e a mutação REJEITA com a mesma frase de
 * `erroDoAtendimento`, em vez de mandar uma requisição para receber um 22023.
 */
export async function salvarPlantao(
  rascunho: RascunhoDoAtendimento,
  id: string | null = null,
): Promise<RespostaDoPlantao> {
  const corpo = corpoDoAtendimento(rascunho, id);
  if (corpo === null) throw new Error("Rascunho incompleto.");
  const { data, error } = await (supabase as any).rpc("plantao_salvar", corpo);
  if (error) throw new Error(error.message);
  const linha = ((data as any[]) ?? [])[0];
  if (!linha) throw new Error("A porta não devolveu o atendimento gravado.");
  return linha as RespostaDoPlantao;
}

export function useSalvarPlantao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { rascunho: RascunhoDoAtendimento; id?: string | null }) =>
      salvarPlantao(v.rascunho, v.id ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantao"] }),
  });
}

/** Apagar é idempotente na porta: apagar o que já não existe devolve 0. */
export async function apagarPlantao(id: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("plantao_apagar", { _id: id });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export function useApagarPlantao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarPlantao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantao"] }),
  });
}

// NÃO existe aqui uma casca que traduza SQLSTATE para frase genérica: as duas
// RPCs rejeitam com a mensagem JÁ EM PORTUGUÊS, palavra por palavra igual ao
// gêmeo puro `erroDoAtendimento`. Uma casca apagaria a única coisa que o
// usuário podia usar — é a mesma nota que fecha `sobreaviso/data.ts`.
//
// E É POR ISSO QUE OS `throw` DAQUI EMBRULHAM EM `new Error(...)`. O PostgREST
// não lança: no caminho sem `shouldThrowOnError` ele faz `JSON.parse(body)` e
// devolve um OBJETO SIMPLES. `objeto instanceof Error` é **false** — e as duas
// telas fazem `e instanceof Error ? e.message : "não consegui…"`. Sem o
// embrulho, as CATORZE frases que a migration escreveu à mão (o gate de
// procuração, o acesso ao chamado, o duplo toque, as sete de validação)
// chegavam ao plantonista como a mesma frase genérica, às 2h da manhã, sem
// dizer o que consertar. A decisão declarada acima só vale se a frase
// sobreviver à fronteira — e a fronteira é aqui, não no `catch` da tela.
