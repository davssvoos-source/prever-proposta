// Leitura e escrita do patrimônio (R196–R199, U109).
//
// Duas tabelas, criadas pela migration U109:
//   · `catalogo_equipamentos`   — as VARIAÇÕES (a tela "Equipamentos cadastrados")
//   · `equipamentos_patrimonio` — os itens FÍSICOS (o que está em cada cliente)
//
// A TELA NÃO CAI SEM A MIGRATION. O ciclo desta casa publica o código antes de
// o Davi rodar o SQL à mão (regra 5 do CLAUDE.md), então enquanto as tabelas
// não existirem o Postgres responde 42P01 ("relation does not exist"). Em vez
// de deixar o erro subir e virar tela vermelha, as leituras devolvem
// `faltaMigration: true` e a tela diz a verdade: a estrutura ainda não existe.
// É o mesmo espírito do `comFallbackDaU96`, que morreu quando a U96 rodou —
// este também sai quando a U109 rodar.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** 42P01 = a tabela ainda não existe (a migration não rodou). */
function semTabela(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return e?.code === "42P01" || /relation .* does not exist/i.test(e?.message ?? "");
}

export interface VariacaoDoCatalogo {
  id: string;
  almoxarifado: string;
  nome: string;
  modelo: string | null;
  fabricante: string | null;
  observacao: string | null;
  /** quantos itens físicos existem desta variação */
  quantidade: number;
}

export interface ItemDePatrimonio {
  id: string;
  identificacao: string | null;
  local_qap: string;
  cliente_id: string | null;
  pessoa_id: string | null;
  enviado_em: string | null;
  cliente_sistema_id: string | null;
  observacao: string | null;
  catalogo: { id: string; almoxarifado: string; nome: string; modelo: string | null; fabricante: string | null } | null;
}

export interface CatalogoCarregado {
  variacoes: VariacaoDoCatalogo[];
  /** true = a U109 ainda não rodou; a tela mostra o aviso em vez de erro */
  faltaMigration: boolean;
}

const CAMPOS_CATALOGO = "id, almoxarifado, nome, modelo, fabricante, observacao";

/** O catálogo inteiro, com a contagem de itens de cada variação. */
export function useCatalogoDoPatrimonio() {
  return useQuery({
    queryKey: ["catalogo-patrimonio"],
    queryFn: async (): Promise<CatalogoCarregado> => {
      const { data, error } = await supabase
        .from("catalogo_equipamentos" as any)
        .select(`${CAMPOS_CATALOGO}, itens:equipamentos_patrimonio(count)`)
        .order("almoxarifado")
        .order("nome");
      if (error) {
        if (semTabela(error)) return { variacoes: [], faltaMigration: true };
        throw error;
      }
      const variacoes = ((data as any[]) ?? []).map((v) => ({
        id: v.id,
        almoxarifado: v.almoxarifado,
        nome: v.nome,
        modelo: v.modelo ?? null,
        fabricante: v.fabricante ?? null,
        observacao: v.observacao ?? null,
        // o count embutido do PostgREST vem como [{ count: n }]
        quantidade: Number(v.itens?.[0]?.count ?? 0),
      })) as VariacaoDoCatalogo[];
      return { variacoes, faltaMigration: false };
    },
  });
}

/** Os equipamentos que estão NUM cliente — o bloco da ficha (R199). */
export function useEquipamentosDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["equipamentos-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<{ itens: ItemDePatrimonio[]; faltaMigration: boolean }> => {
      const { data, error } = await supabase
        .from("equipamentos_patrimonio" as any)
        .select(
          "id, identificacao, local_qap, cliente_id, pessoa_id, enviado_em, cliente_sistema_id, observacao, " +
            `catalogo:catalogo_equipamentos(${CAMPOS_CATALOGO})`,
        )
        .eq("cliente_id", clienteId as string)
        .order("enviado_em", { ascending: false, nullsFirst: false });
      if (error) {
        if (semTabela(error)) return { itens: [], faltaMigration: true };
        throw error;
      }
      return { itens: ((data as any[]) ?? []) as ItemDePatrimonio[], faltaMigration: false };
    },
  });
}

/** Os números do topo da tela do catálogo. */
export function useTotaisDoPatrimonio() {
  return useQuery({
    queryKey: ["patrimonio-totais"],
    queryFn: async () => {
      const conta = async (filtro: (q: any) => any) => {
        const { count, error } = await filtro(
          supabase.from("equipamentos_patrimonio" as any).select("id", { count: "exact", head: true }),
        );
        if (error) {
          if (semTabela(error)) return null;
          throw error;
        }
        return count ?? 0;
      };
      const itens = await conta((q: any) => q);
      if (itens === null) return { itens: 0, semVinculo: 0, semIdentificacao: 0, faltaMigration: true };
      const semVinculo = await conta((q: any) => q.is("cliente_id", null).is("pessoa_id", null));
      const semIdentificacao = await conta((q: any) => q.is("identificacao", null));
      return {
        itens,
        semVinculo: semVinculo ?? 0,
        semIdentificacao: semIdentificacao ?? 0,
        faltaMigration: false,
      };
    },
  });
}

/** Anotação livre numa variação do catálogo (o valor é o passo seguinte). */
export async function atualizarVariacao(
  id: string,
  patch: { observacao?: string | null; nome?: string; modelo?: string | null; fabricante?: string | null },
): Promise<void> {
  const { error } = await supabase.from("catalogo_equipamentos" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

/** Invalida o que a tela do catálogo e a ficha do cliente leem. */
export function useRecarregarPatrimonio() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["catalogo-patrimonio"] });
    qc.invalidateQueries({ queryKey: ["patrimonio-totais"] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente"] });
  };
}

// ── O VÍNCULO com o sistema instalado (R200, U111) ──────────────────────────

/**
 * Liga (ou desliga, com `null`) equipamentos do QAP a um bloco do cliente.
 *
 * Davi (2026-09-07): "os equipamentos de cada cliente são importados pelo QAP,
 * e aí no nosso sistema, o usuário vincula o equipamento ao sistema instalado
 * (ambos no mesmo cliente)". Vários de uma vez, porque é assim que se
 * trabalha: 40 câmeras do mesmo prédio vão para o mesmo bloco de CFTV num
 * gesto, não em 40.
 *
 * O "mesmo cliente" é conferido AQUI, não só na tela: o sistema escolhido tem
 * de pertencer ao cliente dos itens, senão um clique errado penduraria a
 * câmera de um prédio no bloco de outro — e nada depois denunciaria.
 */
export async function vincularAoSistema(ids: string[], sistemaId: string | null): Promise<void> {
  if (ids.length === 0) return;
  if (sistemaId) {
    const { data: sis, error: errS } = await supabase
      .from("cliente_sistemas" as any).select("id, cliente_id").eq("id", sistemaId).maybeSingle();
    if (errS) throw errS;
    if (!sis) throw new Error("Este sistema não existe mais — recarregue a ficha.");
    const { data: itens, error: errI } = await supabase
      .from("equipamentos_patrimonio" as any).select("id, cliente_id").in("id", ids);
    if (errI) throw errI;
    const deOutro = ((itens as any[]) ?? []).filter((i) => i.cliente_id !== (sis as any).cliente_id);
    if (deOutro.length > 0) {
      throw new Error("Equipamento e sistema têm de ser do MESMO cliente — nada foi vinculado.");
    }
  }
  const { error } = await supabase
    .from("equipamentos_patrimonio" as any)
    .update({ cliente_sistema_id: sistemaId } as any)
    .in("id", ids);
  if (error) throw error;
}
