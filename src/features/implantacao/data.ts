// O cronograma da implantação — a camada de dados (R120, U89).
//
// A LÓGICA PURA MORA EM ./modelo.ts E NÃO SE REPETE AQUI. Este arquivo não
// divide período em fases, não conta dia útil e não decide o que é buraco: ele
// lê uma tabela, escreve nela e invalida cache.
//
// ── O PRAZO NÃO É ESCRITO DAQUI, E ISSO É DELIBERADO ──────────────────────
// Salvar o período move `chamados.prazo_limite` — mas quem o move é o gatilho
// `chamado_preencher()`, no banco (U89 §4). O app manda `implantacao_inicio` e
// `implantacao_fim` e mais nada.
//
// Escrever o prazo daqui criaria uma segunda verdade sobre "quando esta obra
// vence", e as duas divergiriam no primeiro caminho que não passasse por esta
// tela — o SQL Editor, uma carga, a própria migration. A regra é a mesma que
// governa `data_hora_agendada` desde a U78: espelho tem UM escritor.
//
// `as any` nas consultas pela mesma razão do resto do app: o
// src/integrations/supabase/types.ts está desatualizado (baseline do tsc) e não
// conhece `public.implantacao_cronograma`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dividirEmFases, FASES, type Fase } from "./modelo";

/**
 * As colunas, escritas à mão e não `*`, pelo mesmo motivo de
 * `programacao/data.ts`: nomear é o que faz uma coluna nova só chegar ao
 * cliente quando alguém decide.
 */
const CAMPOS = "id, chamado_id, fase, inicio, fim, observacao, concluida_em";

export interface LinhaDoCronograma {
  id: string;
  chamado_id: string;
  fase: Fase;
  inicio: string;
  fim: string;
  observacao: string | null;
  concluida_em: string | null;
}

export const chaveCronograma = (chamadoId: string) => ["implantacao", "cronograma", chamadoId];
export const chavePeriodo = (chamadoId: string) => ["implantacao", "periodo", chamadoId];

/**
 * O PERÍODO DA OBRA — e ele é lido AQUI, não pelo `useChamado`.
 *
 * ── ISTO É DESENHO DE ORDEM DE DEPLOY, E NÃO DUPLICAÇÃO POR DESCUIDO ──────
 * `features/chamados/data.ts` monta o SELECT nomeando cada coluna à mão
 * (`CAMPOS`, linha 76). Acrescentar `implantacao_inicio, implantacao_fim`
 * naquela string amarraria o sistema INTEIRO a esta migration: enquanto ela
 * não rodasse, o PostgREST devolveria 42703 para a consulta toda — e a
 * consulta toda é o detalhe do chamado, a lista, a Início e o painel. Uma
 * coluna que ainda não existe derrubaria telas que nada têm a ver com obra.
 *
 * Lendo daqui, a mesma falha fica CONTIDA: o card do cronograma mostra o erro
 * e todo o resto do app continua de pé. É a regra 6 do diário aplicada pelo
 * lado do desenho — ordem de deploy é propriedade do CÓDIGO, e código que
 * limita o próprio estrago não depende de ninguém lembrar da ordem.
 *
 * O custo é uma consulta a mais numa tela que já faz oito. O que se compra é
 * que rodar a migration deixe de ser pré-condição para o sistema funcionar.
 */
export function usePeriodoDaObra(chamadoId: string | undefined) {
  return useQuery({
    queryKey: chavePeriodo(chamadoId ?? ""),
    enabled: !!chamadoId,
    queryFn: async (): Promise<{ inicio: string | null; fim: string | null }> => {
      const { data, error } = await (supabase as any)
        .from("chamados")
        .select("implantacao_inicio, implantacao_fim")
        .eq("id", chamadoId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        inicio: (data?.implantacao_inicio as string | null) ?? null,
        fim: (data?.implantacao_fim as string | null) ?? null,
      };
    },
  });
}

/**
 * AS FASES DE UMA OBRA.
 *
 * Ordenadas AQUI pela ordem canônica das FASES, e não por `ORDER BY` no
 * servidor: a ordem de execução é uma constante do domínio (ver
 * `ordemDaFase`), não uma coluna. Um `ORDER BY inicio` daria a ordem errada no
 * dia em que alguém planejasse a configuração para começar junto com a
 * instalação — e é justamente aí que a ordem importa para ler.
 */
export function useCronograma(chamadoId: string | undefined) {
  return useQuery({
    queryKey: chaveCronograma(chamadoId ?? ""),
    enabled: !!chamadoId,
    queryFn: async (): Promise<LinhaDoCronograma[]> => {
      const { data, error } = await (supabase as any)
        .from("implantacao_cronograma")
        .select(CAMPOS)
        .eq("chamado_id", chamadoId);
      // A mensagem do servidor CHEGA. `error` do PostgREST é objeto simples,
      // não instância de Error — um `catch` que testasse `instanceof Error`
      // engoliria o texto e mostraria "erro desconhecido" (lição da U87).
      if (error) throw new Error(error.message);
      const linhas = (data ?? []) as LinhaDoCronograma[];
      return [...linhas].sort(
        (a, b) => FASES.indexOf(a.fase) - FASES.indexOf(b.fase),
      );
    },
  });
}

/**
 * SALVAR O PERÍODO DA OBRA.
 *
 * Aceita `null` nos dois campos para APAGAR o período — e o CHECK do banco
 * exige que os dois sejam nulos juntos, então esta função nunca manda um só.
 * Apagar o período apaga o prazo (o gatilho cuida), e "sem prazo" volta a ser
 * a verdade: ninguém mais afirma quando a obra acaba.
 */
export function useSalvarPeriodo(chamadoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { inicio: string; fim: string } | null) => {
      const { error } = await (supabase as any)
        .from("chamados")
        .update(
          p === null
            ? { implantacao_inicio: null, implantacao_fim: null }
            : { implantacao_inicio: p.inicio, implantacao_fim: p.fim },
        )
        .eq("id", chamadoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // O chamado TAMBÉM é invalidado: salvar o período moveu `prazo_limite`
      // no servidor, e o cartão de prazo lá em cima lê essa coluna. Sem esta
      // linha a tela mostraria o prazo velho até o próximo F5 — e o prazo
      // velho é o de SLA, exatamente o número que esta entrega existe para
      // corrigir.
      qc.invalidateQueries({ queryKey: ["chamado", chamadoId] });
      qc.invalidateQueries({ queryKey: chavePeriodo(chamadoId) });
      qc.invalidateQueries({ queryKey: chaveCronograma(chamadoId) });
    },
  });
}

/**
 * GERAR AS QUATRO FASES a partir do período.
 *
 * `ON CONFLICT DO NOTHING` no servidor (índice único por chamado+fase) é o que
 * torna o duplo clique inofensivo. Aqui o `upsert` com `ignoreDuplicates`
 * pede exatamente esse comportamento: gerar duas vezes não cria oito linhas e
 * não sobrescreve um ajuste que alguém já fez à mão.
 *
 * Quem quiser REDISTRIBUIR de fato apaga e gera de novo — e o botão que faz
 * isso diz que apaga, porque apagar ajuste manual sem avisar é o tipo de gesto
 * que só se descobre depois.
 */
export function useGerarCronograma(chamadoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { inicio: string; fim: string; refazer?: boolean }) => {
      const fases = dividirEmFases(p.inicio, p.fim);
      if (fases.length === 0) {
        throw new Error(
          "O período não tem nenhum dia útil — só fim de semana e feriado. Ajuste as datas antes de gerar o cronograma.",
        );
      }
      if (p.refazer) {
        const { error: erroApagar } = await (supabase as any)
          .from("implantacao_cronograma")
          .delete()
          .eq("chamado_id", chamadoId);
        if (erroApagar) throw new Error(erroApagar.message);
      }
      const { error } = await (supabase as any)
        .from("implantacao_cronograma")
        .upsert(
          fases.map((f) => ({
            chamado_id: chamadoId,
            fase: f.fase,
            inicio: f.inicio,
            fim: f.fim,
          })),
          { onConflict: "chamado_id,fase", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveCronograma(chamadoId) }),
  });
}

/** Ajustar as datas ou a observação de UMA fase. */
export function useSalvarFase(chamadoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id: string;
      inicio: string;
      fim: string;
      observacao: string | null;
    }) => {
      const { error } = await (supabase as any)
        .from("implantacao_cronograma")
        .update({ inicio: p.inicio, fim: p.fim, observacao: p.observacao })
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveCronograma(chamadoId) }),
  });
}

/**
 * MARCAR OU DESMARCAR UMA FASE COMO CONCLUÍDA.
 *
 * O carimbo é o INSTANTE em que se clicou, e não a data de fim planejada — a
 * fase pode acabar antes ou depois do plano, e é isso que o Davi disse sobre o
 * bloco agendado em 02/09: "posso acabar fazendo algo antes da data agendada
 * por diversos motivos e o sistema não deve barrar isso". O plano é plano; o
 * carimbo é registro.
 */
export function useAlternarFase(chamadoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; concluida: boolean }) => {
      const { error } = await (supabase as any)
        .from("implantacao_cronograma")
        .update({ concluida_em: p.concluida ? new Date().toISOString() : null })
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveCronograma(chamadoId) }),
  });
}

/** Apagar o cronograma inteiro, deixando o período de pé. */
export function useApagarCronograma(chamadoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("implantacao_cronograma")
        .delete()
        .eq("chamado_id", chamadoId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveCronograma(chamadoId) }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AS OBRAS EM ANDAMENTO, DE UMA VEZ — para o painel da Operacional Técnica
// (R125). Mesma decisão de `usePeriodoDaObra`: as colunas de período NÃO
// entram no `CAMPOS` de chamados/data.ts, então o painel lê daqui e a falha
// fica contida no card — o resto da tela não depende desta consulta.
// ═══════════════════════════════════════════════════════════════════════════

export interface ResumoDaObra {
  chamado_id: string;
  inicio: string | null;
  fim: string | null;
  fases: { fase: Fase; concluida_em: string | null }[];
}

/** A chave ordena os ids: a mesma lista em outra ordem é a MESMA consulta. */
export const chaveObras = (ids: string[]) => ["implantacao", "obras", [...ids].sort().join(",")];

/**
 * Duas consultas em paralelo (período e fases), um mapa por chamado.
 *
 * Obras em andamento são poucas — dezenas, não centenas —, então `.in()` numa
 * lista só basta. Se um dia passarem de ~200, vale fatiar como
 * `emFatias()` faz em programacao/data.ts; o teto está declarado aqui para
 * ninguém o descobrir pelo erro.
 */
export function useObrasEmAndamento(ids: string[]) {
  return useQuery({
    queryKey: chaveObras(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, ResumoDaObra>> => {
      const [periodos, fases] = await Promise.all([
        (supabase as any)
          .from("chamados")
          .select("id, implantacao_inicio, implantacao_fim")
          .in("id", ids),
        (supabase as any)
          .from("implantacao_cronograma")
          .select("chamado_id, fase, concluida_em")
          .in("chamado_id", ids),
      ]);
      // A mensagem do servidor CHEGA (lição da U87): `error` do PostgREST não
      // é instância de Error, e engoli-lo mostraria "erro desconhecido".
      if (periodos.error) throw new Error(periodos.error.message);
      if (fases.error) throw new Error(fases.error.message);

      const mapa: Record<string, ResumoDaObra> = {};
      for (const p of (periodos.data ?? []) as any[]) {
        mapa[p.id] = {
          chamado_id: p.id,
          inicio: (p.implantacao_inicio as string | null) ?? null,
          fim: (p.implantacao_fim as string | null) ?? null,
          fases: [],
        };
      }
      for (const f of (fases.data ?? []) as any[]) {
        const r = mapa[f.chamado_id];
        if (r) r.fases.push({ fase: f.fase as Fase, concluida_em: (f.concluida_em as string | null) ?? null });
      }
      for (const r of Object.values(mapa)) {
        r.fases.sort((a, b) => FASES.indexOf(a.fase) - FASES.indexOf(b.fase));
      }
      return mapa;
    },
  });
}
