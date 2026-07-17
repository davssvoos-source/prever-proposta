// Reconciliação por PROJETO dos receptores de acesso (regras dos técnicos, 2026-07-17):
//
// • Antena TAG (RTAG 3000/EQ008): 1 por sigla TAG — adicionada por bloco (motor de regras).
// • Receptor HCS Multifunção (RMF3004/EQ007): sub-central que suporta 4 antenas.
//   Quantidade por PROJETO = ⌈total de antenas / 4⌉, hospedada num único bloco.
// • Receptor RF (RTX 3004/EQ004): 1 por bloco com CTRL (motor de regras) e, em
//   Portaria Remota, +1 por ECLUSA VEICULAR do projeto — este montado na Central
//   de Portaria Remota (bloco CENT), usado para comandos remotos (manter portões
//   abertos / desligar intertravamento; cada RTX suporta 4 comandos).
// • Módulo Guarita IP (MG 3000/EQ003): 16 canais = 8 RTX + 8 RMF (bancos separados).
//   Qtd = max(⌈RTX/8⌉, ⌈RMF/8⌉). Obrigatório (mín. 1) quando Portaria Remota;
//   em Portaria Presencial só se houver RTX ou RMF.
//
// Os itens de projeto são hospedados num único bloco (o primeiro bloco de acesso
// por ordem que os justifique) e removidos dos demais. Idempotente.

import { supabase } from "@/integrations/supabase/client";
import {
  EQ_RECEPTOR_RTX,
  EQ_RECEPTOR_RMF,
  EQ_ANTENA_TAG,
  EQ_MODULO_GUARITA,
  qtdModulosGuarita,
  qtdMultifuncao,
} from "./blockAutoItems";

const ACCESS_TYPES = ["PED", "VEI"];

/** Recalcula e re-hospeda Guarita, Multifunção e RTX de eclusas do projeto. Idempotente. */
export async function reconcileGuaritaProjeto(visitaId: string): Promise<void> {
  // 0) Portaria do projeto (PR/PP/PA) — define obrigatoriedade da guarita e RTX da CENT
  const { data: orc } = await supabase
    .from("visita_orcamentos")
    .select("sistema_proposto")
    .eq("visita_id", visitaId)
    .maybeSingle();
  const portariaRemota = ((orc as any)?.sistema_proposto ?? "PR") === "PR";

  // 1) Blocos da visita
  const { data: blocos } = await supabase
    .from("visita_blocos" as any)
    .select("id, tipo_bloco, ordem, eclusa")
    .eq("visita_id", visitaId);
  const todos = ((blocos as any[]) ?? []);
  const acessoBlocos = todos
    .filter((b) => ACCESS_TYPES.includes(b.tipo_bloco))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const centBloco = todos.find((b) => b.tipo_bloco === "CENT") ?? null;
  if (acessoBlocos.length === 0 && !centBloco) return;
  const blocoIds = acessoBlocos.map((b) => b.id);

  // 2) RTX adicional por eclusa veicular (Portaria Remota) — hospedado na CENT
  const eclusasVeiculares = acessoBlocos.filter((b) => b.tipo_bloco === "VEI" && !!b.eclusa).length;
  const rtxCentQtd = portariaRemota ? eclusasVeiculares : 0;
  if (centBloco) {
    await supabase
      .from("visita_bloco_itens" as any)
      .delete()
      .eq("visita_bloco_id", centBloco.id)
      .eq("cod_eq", EQ_RECEPTOR_RTX)
      .eq("origem", "auto");
    if (rtxCentQtd > 0) {
      await supabase.from("visita_bloco_itens" as any).insert({
        visita_bloco_id: centBloco.id,
        cod_eq: EQ_RECEPTOR_RTX,
        qtd: rtxCentQtd,
        origem: "auto",
        observacao: "Receptor RF RTX 3004 — comandos remotos (1 por eclusa veicular do projeto)",
      });
    }
  }

  if (blocoIds.length === 0) return;

  // 3) Totais do projeto: antenas TAG e RTX dos blocos de acesso (não removidos)
  const { data: itens } = await supabase
    .from("visita_bloco_itens" as any)
    .select("visita_bloco_id, cod_eq, qtd, removido")
    .in("visita_bloco_id", blocoIds)
    .in("cod_eq", [EQ_RECEPTOR_RTX, EQ_ANTENA_TAG]);
  const rows = ((itens as any[]) ?? []).filter((r) => !r.removido);
  const totalAntenas = rows
    .filter((r) => r.cod_eq === EQ_ANTENA_TAG)
    .reduce((s, r) => s + (Number(r.qtd) || 0), 0);
  const totalRtx =
    rows.filter((r) => r.cod_eq === EQ_RECEPTOR_RTX).reduce((s, r) => s + (Number(r.qtd) || 0), 0) +
    rtxCentQtd;

  // 4) Multifunção do projeto: ⌈antenas/4⌉, hospedado no 1º bloco com antenas
  const totalRmf = qtdMultifuncao(totalAntenas);
  const idsComAntena = new Set(
    rows.filter((r) => r.cod_eq === EQ_ANTENA_TAG).map((r) => r.visita_bloco_id),
  );
  const hostRmf = acessoBlocos.find((b) => idsComAntena.has(b.id)) ?? acessoBlocos[0];

  await supabase
    .from("visita_bloco_itens" as any)
    .delete()
    .in("visita_bloco_id", blocoIds)
    .eq("cod_eq", EQ_RECEPTOR_RMF)
    .eq("origem", "auto");
  if (totalRmf > 0) {
    await supabase.from("visita_bloco_itens" as any).insert({
      visita_bloco_id: hostRmf.id,
      cod_eq: EQ_RECEPTOR_RMF,
      qtd: totalRmf,
      origem: "auto",
      observacao: "Receptor HCS Multifunção RMF3004 (1 a cada 4 antenas TAG do projeto)",
    });
  }

  // 5) Módulo Guarita IP do projeto: max(⌈RTX/8⌉, ⌈RMF/8⌉); mín. 1 em Portaria Remota
  const qtdGuarita = qtdModulosGuarita(totalRtx, totalRmf, portariaRemota);
  const idsComReceptores = new Set(rows.map((r) => r.visita_bloco_id));
  const hostGuarita = acessoBlocos.find((b) => idsComReceptores.has(b.id)) ?? acessoBlocos[0];

  await supabase
    .from("visita_bloco_itens" as any)
    .delete()
    .in("visita_bloco_id", blocoIds)
    .eq("cod_eq", EQ_MODULO_GUARITA)
    .eq("origem", "auto");
  if (qtdGuarita > 0) {
    await supabase.from("visita_bloco_itens" as any).insert({
      visita_bloco_id: hostGuarita.id,
      cod_eq: EQ_MODULO_GUARITA,
      qtd: qtdGuarita,
      origem: "auto",
      observacao: "Módulo Guarita IP MG 3000 (8 canais RTX + 8 canais RMF por módulo)",
    });
  }
}
