// O VÍNCULO POR ARRASTO (R206, U114) — a lógica pura por trás dos dois painéis
// da ficha do cliente: "Blocos" à esquerda, "Sem bloco" à direita.
//
// Davi, 2026-09-07: "dois campos um ao lado do outro, um com bloco e sub-itens
// sendo os equipamentos já vinculados a aquele bloco, e o outro campo são os
// equipamentos sem bloco vinculado, e aí só de arrastar o equipamento ao bloco,
// o sistema já vincula."
//
// Nada aqui toca DOM nem banco: são as contas que decidem o que viaja no
// arrasto, o que muda de lugar ao soltar e o que o toast diz depois. A tela
// (InventarioCliente / EquipamentosDoCliente) só chama.

import type { ItemDePatrimonio } from "@/features/equipamentos/data";

/**
 * O tipo MIME próprio do arrasto. Só o que a ficha pôs no `dataTransfer` cai
 * nas zonas de soltar — um texto arrastado de fora da página, ou um card do
 * calendário aberto em outra aba, não vira "vincular".
 */
export const TIPO_ARRASTO = "application/x-prever-equipamentos";

/** O arrasto em curso é um dos nossos? (`dataTransfer.types` da zona de soltar) */
export function arrastoEhNosso(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false;
  return Array.from(types as readonly string[]).includes(TIPO_ARRASTO);
}

/**
 * Arrastar um item MARCADO leva todos os marcados; arrastar um item solto leva
 * só ele — mesmo que haja outros marcados. É o gesto do explorador de arquivos,
 * e é o que faz "40 câmeras para o CFTV" ser um arrasto, não quarenta.
 */
export function idsParaArrastar(idArrastado: string, selecionados: ReadonlySet<string>): string[] {
  return selecionados.has(idArrastado) ? [...selecionados] : [idArrastado];
}

export function serializarArrasto(ids: readonly string[]): string {
  return JSON.stringify(ids);
}

/** Lê o que veio no arrasto; lixo, duplicata e não-texto caem fora, nunca explodem. */
export function lerArrasto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  try {
    const v: unknown = JSON.parse(texto);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))];
  } catch {
    return [];
  }
}

type ItemMinimo = Pick<ItemDePatrimonio, "id" | "cliente_sistema_id">;

/**
 * Dos ids soltos, os que de fato MUDAM de lugar em `destino` (null = "Sem
 * bloco"). Soltar o equipamento no bloco em que ele já está não grava nada —
 * e um id que não é deste cliente (não está na lista) também não.
 */
export function idsQueMudam(itens: readonly ItemMinimo[], ids: readonly string[], destino: string | null): string[] {
  const atual = new Map(itens.map((i) => [i.id, i.cliente_sistema_id] as const));
  return ids.filter((id) => atual.has(id) && atual.get(id) !== destino);
}

export interface Agrupamento<T> {
  /** bloco → os equipamentos do QAP vinculados a ele, na ordem da lista */
  porSistema: Map<string, T[]>;
  /** o painel "Sem bloco" */
  semSistema: T[];
}

/** Separa a lista do QAP em "dentro de qual bloco" e "sem bloco" — uma passada. */
export function agruparPorSistema<T extends Pick<ItemDePatrimonio, "cliente_sistema_id">>(itens: readonly T[]): Agrupamento<T> {
  const porSistema = new Map<string, T[]>();
  const semSistema: T[] = [];
  for (const i of itens) {
    if (!i.cliente_sistema_id) { semSistema.push(i); continue; }
    const arr = porSistema.get(i.cliente_sistema_id) ?? [];
    arr.push(i);
    porSistema.set(i.cliente_sistema_id, arr);
  }
  return { porSistema, semSistema };
}

/** O texto em que o filtro do painel "Sem bloco" procura (a tela normaliza os dois lados). */
export function textoDoItem(i: Pick<ItemDePatrimonio, "identificacao" | "catalogo">): string {
  return [i.catalogo?.nome, i.catalogo?.modelo, i.catalogo?.fabricante, i.catalogo?.almoxarifado, i.identificacao]
    .filter(Boolean)
    .join(" ");
}

/** A frase do toast — a mesma nos dois painéis, para o mesmo gesto dizer a mesma coisa. */
export function fraseDoVinculo(qtd: number, nomeDoBloco: string | null): string {
  if (nomeDoBloco) {
    return qtd === 1
      ? `1 equipamento vinculado a ${nomeDoBloco}.`
      : `${qtd} equipamentos vinculados a ${nomeDoBloco}.`;
  }
  return qtd === 1
    ? "1 equipamento desvinculado — voltou para “Sem bloco”."
    : `${qtd} equipamentos desvinculados — voltaram para “Sem bloco”.`;
}
