// EQUIPAMENTOS REMOVIDOS E INSTALADOS pela atividade — os dados (R226, U119).
//
// Davi, 08/09/2026: "O campo 'Equipamentos envolvidos' deve virar 'Equipamentos
// Removidos' — lista os blocos do cliente, expande, remove; o equipamento passa
// a ser 'Retirado do cliente' — e 'Equipamentos Instalados' — lista os que não
// estão vinculados a nenhum bloco do cliente, e ao selecionar escolhe-se para
// qual bloco ele foi instalado. Só quando o cliente da atividade é um cliente
// único (não interna, não grupo)."
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

export interface EquipamentoLivre {
  patrimonio_id: string;
  identificacao: string | null;
  nome: string;
  modelo: string | null;
  fabricante: string | null;
  local_qap: string | null;
  pessoa_nome: string | null;
  situacao: string | null;
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

/** Os equipamentos que não estão em cliente nenhum — os candidatos a "Instalar". */
export function useEquipamentosLivres(busca: string, ativo = true) {
  return useQuery({
    queryKey: ["equipamentos-livres", busca.trim().toLowerCase()],
    enabled: ativo,
    staleTime: 15_000,
    queryFn: () => rpcLista<EquipamentoLivre>("buscar_equipamentos_livres", { _busca: busca.trim(), _teto: 30 }),
  });
}

/** O nome que a tela mostra para um item: "Câmera Intelbras VHD 1220 · nº 4471". */
export function rotuloDoEquipamento(e: { nome: string; modelo?: string | null; fabricante?: string | null; identificacao?: string | null }): string {
  const partes = [e.nome, e.fabricante, e.modelo].filter((x): x is string => !!x && x.trim().length > 0);
  const base = partes.join(" ");
  return e.identificacao ? `${base} · nº ${e.identificacao}` : base;
}

/** Agrupa o patrimônio do cliente por bloco — "sem bloco" no fim. */
export function agruparPorBloco(itens: readonly EquipamentoDoCliente[]): { sistemaId: string | null; nome: string; itens: EquipamentoDoCliente[] }[] {
  const mapa = new Map<string | null, { sistemaId: string | null; nome: string; itens: EquipamentoDoCliente[] }>();
  for (const it of itens) {
    const chave = it.sistema_id ?? null;
    const g = mapa.get(chave) ?? { sistemaId: chave, nome: it.sistema_nome ?? "Sem bloco", itens: [] };
    g.itens.push(it);
    mapa.set(chave, g);
  }
  return [...mapa.values()].sort((a, b) => {
    if (a.sistemaId === null) return 1;
    if (b.sistemaId === null) return -1;
    return a.nome.localeCompare(b.nome);
  });
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
