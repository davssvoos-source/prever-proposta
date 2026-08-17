// Checklist da OS (preventiva e implantação) — Etapa 6 do sistema de OS.
// Preventiva: roteiro por tipo de sistema, a partir dos modelos.
// Implantação: um item por equipamento do escopo aprovado, agrupado por bloco.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isServicoCode } from "@/features/orcamento/blockAutoItems";
import { TIPO_SISTEMA_LABEL, type TipoSistema } from "@/features/clientes/inventario";

export interface ItemChecklist {
  id: string;
  grupo: string | null;
  item: string;
  ordem: number;
  concluido: boolean;
  observacao: string | null;
}

export function useChecklist(osId: string | undefined) {
  return useQuery({
    queryKey: ["os-checklist", osId],
    enabled: !!osId,
    queryFn: async (): Promise<ItemChecklist[]> => {
      const { data, error } = await supabase
        .from("os_checklist" as any)
        .select("id, grupo, item, ordem, concluido, observacao")
        .eq("os_id", osId as string)
        .order("ordem");
      if (error) throw error;
      return ((data as any[]) ?? []) as ItemChecklist[];
    },
  });
}

export async function marcarItemChecklist(id: string, concluido: boolean): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("os_checklist" as any)
    .update({
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null,
      concluido_por: concluido ? u.user?.id ?? null : null,
    } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function anotarItemChecklist(id: string, observacao: string | null): Promise<void> {
  const { error } = await supabase
    .from("os_checklist" as any)
    .update({ observacao } as any)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Monta o checklist de uma preventiva a partir dos modelos: itens GERAL +
 * os itens do tipo de cada sistema informado. Não duplica se já houver
 * checklist na OS.
 */
export async function montarChecklistPreventiva(
  osId: string,
  sistemas: { id: string; nome: string; tipo: TipoSistema }[],
): Promise<number> {
  const { data: existente, error: errE } = await supabase
    .from("os_checklist" as any)
    .select("id")
    .eq("os_id", osId)
    .limit(1);
  if (errE) throw errE;
  if (((existente as any[]) ?? []).length > 0) return 0;

  const tipos = Array.from(new Set(["GERAL", ...sistemas.map((s) => s.tipo)]));
  const { data: modelos, error } = await supabase
    .from("os_checklist_templates" as any)
    .select("tipo_sistema, item, ordem")
    .in("tipo_sistema", tipos)
    .eq("ativo", true)
    .order("ordem");
  if (error) throw error;

  const porTipo = new Map<string, { item: string; ordem: number }[]>();
  for (const m of ((modelos as any[]) ?? [])) {
    const arr = porTipo.get(m.tipo_sistema as string) ?? [];
    arr.push({ item: m.item as string, ordem: Number(m.ordem ?? 0) });
    porTipo.set(m.tipo_sistema as string, arr);
  }

  const linhas: { os_id: string; grupo: string; item: string; ordem: number }[] = [];
  let ordem = 0;

  for (const g of porTipo.get("GERAL") ?? []) {
    linhas.push({ os_id: osId, grupo: "Geral", item: g.item, ordem: ordem++ });
  }
  for (const s of sistemas) {
    for (const it of porTipo.get(s.tipo) ?? []) {
      linhas.push({ os_id: osId, grupo: s.nome, item: it.item, ordem: ordem++ });
    }
  }
  if (linhas.length === 0) return 0;

  const { error: errIns } = await supabase.from("os_checklist" as any).insert(linhas as any);
  if (errIns) throw errIns;
  return linhas.length;
}

/**
 * Monta o checklist de uma implantação a partir do escopo aprovado da visita:
 * um item por equipamento (com quantidade), agrupado pelo bloco.
 */
export async function montarChecklistImplantacao(osId: string, visitaId: string): Promise<number> {
  const { data: existente } = await supabase
    .from("os_checklist" as any)
    .select("id")
    .eq("os_id", osId)
    .limit(1);
  if (((existente as any[]) ?? []).length > 0) return 0;

  const { data: blocosRaw, error: errB } = await supabase
    .from("visita_blocos" as any)
    .select("id, tipo_bloco, nome_acesso, ordem")
    .eq("visita_id", visitaId)
    .order("ordem");
  if (errB) throw errB;
  const blocos = ((blocosRaw as any[]) ?? []);
  if (blocos.length === 0) return 0;

  const { data: itensRaw, error: errI } = await supabase
    .from("visita_bloco_itens" as any)
    .select("visita_bloco_id, cod_eq, qtd, removido")
    .in("visita_bloco_id", blocos.map((b) => b.id));
  if (errI) throw errI;
  const itens = ((itensRaw as any[]) ?? []).filter(
    (i) => !i.removido && !isServicoCode(String(i.cod_eq ?? "")),
  );

  const codigos = Array.from(new Set(itens.map((i) => String(i.cod_eq))));
  const nomes: Record<string, string> = {};
  if (codigos.length > 0) {
    const { data: eq } = await supabase.from("equipamentos").select("code, nome").in("code", codigos);
    for (const e of ((eq as any[]) ?? [])) nomes[e.code as string] = e.nome as string;
  }

  const contador: Record<string, number> = {};
  const linhas: { os_id: string; grupo: string; item: string; ordem: number }[] = [];
  let ordem = 0;

  for (const b of blocos) {
    const tipo = b.tipo_bloco as string;
    contador[tipo] = (contador[tipo] || 0) + 1;
    const base = TIPO_SISTEMA_LABEL[tipo as TipoSistema] ?? tipo;
    const grupo = (b.nome_acesso as string | null)?.trim()
      || (tipo === "CENT" ? base : `${base} ${String(contador[tipo]).padStart(2, "0")}`);

    for (const it of itens.filter((i) => i.visita_bloco_id === b.id)) {
      const cod = String(it.cod_eq);
      const qtd = Number(it.qtd || 0);
      linhas.push({
        os_id: osId,
        grupo,
        item: `Instalar ${qtd}× ${nomes[cod] ?? cod}`,
        ordem: ordem++,
      });
    }
    linhas.push({ os_id: osId, grupo, item: `Testar e validar ${grupo}`, ordem: ordem++ });
  }

  const { error: errIns } = await supabase.from("os_checklist" as any).insert(linhas as any);
  if (errIns) throw errIns;
  return linhas.length;
}
