// EQUIPAMENTOS DA ATIVIDADE — os dados (R226, U119; R237, U121).
//
// Davi, 08/09/2026 (R237): "Em uma atividade, o usuário só pode movimentar um
// equipamento para dentro de um bloco ou então clicar em remover um equipamento
// do cliente. Os equipamentos que vão para o cliente vão sempre
// OBRIGATORIAMENTE pelo QAP, e o sistema lê isso a partir do sincronismo."
//
// Isto corrige a leitura da U119: "os equipamentos que não estão vinculados a
// nenhum bloco do cliente" são os DO CLIENTE sem bloco (o que o QAP trouxe),
// não os de fora dele. Nada entra num cliente por aqui — por isso não existe
// mais a leitura "equipamentos livres" nesta feature.
//
// Tudo passa por RPCs da U119: as leituras são SECURITY DEFINER (a policy de
// leitura do patrimônio, U109, só mostra ao técnico o cliente que ele "vê"; com
// a R221 toda pessoa vê toda atividade, e a atividade mostra o patrimônio do
// cliente dela), e a ESCRITA é uma só — `mover_equipamento` — validada no banco
// (cliente único, bloco do cliente, item no cliente), com rastro em
// `equipamento_movimentos`. Não há UPDATE direto em equipamentos_patrimonio
// pela tela: o técnico não tem esse privilégio, e não deve ter.
//
// REGRA 5: até a U119 rodar, as funções não existem (42883/PGRST202) — as
// listas vêm vazias com `faltaMigration: true` e a tela explica.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function semFuncao(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return e?.code === "42883" || e?.code === "PGRST202" || /function .* does not exist|Could not find the function/i.test(e?.message ?? "");
}

export type TipoDeMovimento = "retirada" | "instalacao";

export interface MovimentoDeEquipamento {
  movimento_id: string;
  tipo: TipoDeMovimento;
  patrimonio_id: string;
  identificacao: string | null;
  nome: string;
  modelo: string | null;
  fabricante: string | null;
  sistema_id: string | null;
  sistema_nome: string | null;
  feito_por: string | null;
  feito_em: string;
}

export interface EquipamentoDoCliente {
  patrimonio_id: string;
  identificacao: string | null;
  nome: string;
  modelo: string | null;
  fabricante: string | null;
  sistema_id: string | null;
  sistema_nome: string | null;
}

interface Carregado<T> { itens: T[]; faltaMigration: boolean }

async function rpcLista<T>(nome: string, args: Record<string, unknown>): Promise<Carregado<T>> {
  const { data, error } = await supabase.rpc(nome as any, args as any);
  if (error) {
    if (semFuncao(error)) return { itens: [], faltaMigration: true };
    throw error;
  }
  return { itens: ((data as T[]) ?? []), faltaMigration: false };
}

/** O que ESTA atividade já removeu e instalou. */
export function useEquipamentosDaAtividade(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["equipamentos-atividade", chamadoId],
    enabled: !!chamadoId,
    queryFn: () => rpcLista<MovimentoDeEquipamento>("equipamentos_da_atividade", { _chamado: chamadoId }),
  });
}

/** O patrimônio ATIVO do cliente da atividade, com o bloco de cada item (para "Remover"). */
export function useEquipamentosDoClienteDaAtividade(chamadoId: string | undefined, ativo = true) {
  return useQuery({
    queryKey: ["equipamentos-cliente-atividade", chamadoId],
    enabled: !!chamadoId && ativo,
    queryFn: () => rpcLista<EquipamentoDoCliente>("equipamentos_do_cliente_da_atividade", { _chamado: chamadoId }),
  });
}

/** O nome que a tela mostra para um item: "Câmera Intelbras VHD 1220 · nº 4471". */
export function rotuloDoEquipamento(e: { nome: string; modelo?: string | null; fabricante?: string | null; identificacao?: string | null }): string {
  const partes = [e.nome, e.fabricante, e.modelo].filter((x): x is string => !!x && x.trim().length > 0);
  const base = partes.join(" ");
  return e.identificacao ? `${base} · nº ${e.identificacao}` : base;
}

export interface BlocoComItens {
  sistemaId: string;
  nome: string;
  itens: EquipamentoDoCliente[];
}

/**
 * Os DOIS painéis da atividade (R237, U121): os blocos do cliente — inclusive os
 * VAZIOS, porque o alvo do arrasto precisa existir antes do primeiro
 * equipamento — e, à parte, o que está "sem bloco" (o que o QAP trouxe e ainda
 * não foi posto em lugar nenhum). Um bloco que o inventário não trouxe mas que
 * tem item entra assim mesmo: item nenhum some da tela.
 */
export function repartirEquipamentos(
  sistemas: readonly { id: string; nome: string }[],
  itens: readonly EquipamentoDoCliente[],
): { blocos: BlocoComItens[]; semBloco: EquipamentoDoCliente[] } {
  const porSistema = new Map<string, EquipamentoDoCliente[]>();
  const semBloco: EquipamentoDoCliente[] = [];
  for (const i of itens) {
    if (!i.sistema_id) { semBloco.push(i); continue; }
    const arr = porSistema.get(i.sistema_id) ?? [];
    arr.push(i);
    porSistema.set(i.sistema_id, arr);
  }
  const blocos: BlocoComItens[] = sistemas.map((s) => ({ sistemaId: s.id, nome: s.nome, itens: porSistema.get(s.id) ?? [] }));
  for (const [k, arr] of porSistema) {
    if (blocos.some((b) => b.sistemaId === k)) continue;
    blocos.push({ sistemaId: k, nome: arr[0]?.sistema_nome ?? "Bloco", itens: arr });
  }
  blocos.sort((a, b) => a.nome.localeCompare(b.nome));
  return { blocos, semBloco };
}

export async function moverEquipamento(args: { patrimonioId: string; chamadoId: string; tipo: TipoDeMovimento; sistemaId?: string | null }): Promise<string> {
  const { data, error } = await supabase.rpc("mover_equipamento" as any, {
    _patrimonio: args.patrimonioId, _chamado: args.chamadoId, _tipo: args.tipo, _sistema: args.sistemaId ?? null,
  } as any);
  if (error) {
    if (semFuncao(error)) throw new Error("Os equipamentos da atividade precisam da migration U119.");
    throw new Error(error.message);
  }
  return data as string;
}

export async function desfazerMovimento(movimentoId: string): Promise<void> {
  const { error } = await supabase.rpc("desfazer_movimento_equipamento" as any, { _movimento: movimentoId } as any);
  if (error) throw new Error(error.message);
}
