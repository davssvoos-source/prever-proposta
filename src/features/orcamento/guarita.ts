// Reconciliação do Módulo Guarita IP (MG 3000 / EQ003) em nível de PROJETO.
//
// Regra: 1 Módulo Guarita a cada 4 receptores RF (RTX 3004 + RMF3004) somados de
// TODOS os blocos de acesso da visita. O item é exibido dentro de um bloco (como
// os demais equipamentos), mas a quantidade reflete o total do projeto — por isso
// os blocos "conversam entre si". Para não duplicar, a guarita é hospedada num
// único bloco (o primeiro bloco de acesso, por ordem, que tenha receptores) e
// removida de todos os outros.

import { supabase } from "@/integrations/supabase/client";
import {
  EQ_RECEPTOR_RTX,
  EQ_RECEPTOR_RMF,
  EQ_MODULO_GUARITA,
  qtdModulosGuarita,
} from "./blockAutoItems";

const ACCESS_TYPES = ["PED", "VEI"];

/** Recalcula e re-hospeda o Módulo Guarita IP do projeto. Idempotente. */
export async function reconcileGuaritaProjeto(visitaId: string): Promise<void> {
  // 1) Blocos de acesso (PED/VEI) da visita, ordenados
  const { data: blocos } = await supabase
    .from("visita_blocos" as any)
    .select("id, tipo_bloco, ordem")
    .eq("visita_id", visitaId);
  const acessoBlocos = ((blocos as any[]) ?? [])
    .filter((b) => ACCESS_TYPES.includes(b.tipo_bloco))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  if (acessoBlocos.length === 0) return;
  const blocoIds = acessoBlocos.map((b) => b.id);

  // 2) Soma dos receptores (RTX + RMF) não removidos de todos os blocos
  const { data: itens } = await supabase
    .from("visita_bloco_itens" as any)
    .select("visita_bloco_id, cod_eq, qtd, removido")
    .in("visita_bloco_id", blocoIds)
    .in("cod_eq", [EQ_RECEPTOR_RTX, EQ_RECEPTOR_RMF]);
  const rows = ((itens as any[]) ?? []).filter((r) => !r.removido);
  const totalReceptores = rows.reduce((s, r) => s + (Number(r.qtd) || 0), 0);
  const qtd = qtdModulosGuarita(totalReceptores);

  // 3) Bloco host: primeiro bloco de acesso (menor ordem) que tem receptores
  const idsComReceptores = new Set(rows.map((r) => r.visita_bloco_id));
  const host = acessoBlocos.find((b) => idsComReceptores.has(b.id)) ?? acessoBlocos[0];

  // 4) Remove a guarita (auto) de todos os blocos de acesso e re-hospeda no host
  await supabase
    .from("visita_bloco_itens" as any)
    .delete()
    .in("visita_bloco_id", blocoIds)
    .eq("cod_eq", EQ_MODULO_GUARITA)
    .eq("origem", "auto");

  if (qtd > 0) {
    await supabase.from("visita_bloco_itens" as any).insert({
      visita_bloco_id: host.id,
      cod_eq: EQ_MODULO_GUARITA,
      qtd,
      origem: "auto",
      observacao: "Módulo Guarita IP MG 3000 (1 a cada 4 receptores do projeto)",
    });
  }
}
