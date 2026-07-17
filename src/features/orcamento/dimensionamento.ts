// Dimensionamento automático do projeto — switches, fontes 12V, nobreak e
// baterias — espelhando a aba DIMENSIONAMENTO da planilha base_de_dados.
//
// Fontes das regras (planilha v12, confirmada com os técnicos):
// • SWITCH: portas PoE + portas de rede de todos os equipamentos do projeto.
//   ≤8 portas → 1× SF 900 HI-POE (EQ159) · ≤16 → 1× SF 1821 POE (EQ160) ·
//   >16 → ⌈portas/24⌉ × switch 24P classe PoE (EQ212 S1128G-PA — modelo a
//   confirmar com o técnico, como anota a própria planilha).
// • FONTES 12V: corrente total dos equipamentos 12 Vcc × 1,2 (margem) ÷ 5 A →
//   n × Fonte 12V 5A (EQ174).
// • NOBREAK/BATERIAS (só quando o projeto tem redundância energética, resposta
//   da página Complementos): carga = W(12V) + W(budget PoE) + W(outros DC),
//   +15% overhead; VA = W/0,85 → ⌈VA/2000⌉ × SUPER PLUS 2KVA (EQ182).
//   Autonomia 4 h: Ah = W×4/12/0,8 → ⌈Ah/56⌉ × bateria 70Ah DF 1000 (EQ187,
//   70 Ah × 80% usável = 56 Ah por unidade).
//
// Os itens calculados são hospedados no bloco CENT (Central de Portaria
// Remota) com origem 'auto'. Idempotente — recalcula do zero a cada chamada.

import { supabase } from "@/integrations/supabase/client";

type Consumo = {
  /** Portas PoE ocupadas no switch (por unidade). */
  poe?: number;
  /** Watts consumidos do budget PoE do switch (por unidade). */
  wattsPoe?: number;
  /** Portas de rede não-PoE (por unidade). */
  rede?: number;
  /** Corrente em A @12V (por unidade) — dimensiona as fontes 12V 5A. */
  amps12?: number;
  /** Watts de equipamentos DC com adaptador próprio (entram só no nobreak). */
  wattsDc?: number;
};

// Tabela de consumo por código EQ (aba CONSUMO_EQUIP / DIMENSIONAMENTO da planilha).
const CONSUMO: Record<string, Consumo> = {
  EQ001: { rede: 1, amps12: 0.65 },   // Roteador Firewall Vigor 2915
  EQ002: { rede: 1, wattsDc: 3 },     // ATA PABX HT813 (adaptador 5V)
  EQ003: { rede: 1, amps12: 0.5 },    // Módulo Guarita IP MG 3000
  EQ004: { amps12: 0.167 },           // Receptor RF RTX 3004
  EQ007: { amps12: 0.167 },           // Receptor HCS Multifunção RMF3004
  EQ008: { rede: 1, amps12: 0.417 },  // Antena Veicular RTAG 3000
  EQ011: { rede: 1, amps12: 1 },      // Leitora Facial DS-K1T342AMF
  EQ017: { poe: 1, wattsPoe: 6 },     // Interfone IP sem câmera (PoE)
  EQ018: { poe: 1, wattsPoe: 6 },     // Interfone IP com câmera (PoE)
  EQ020: { amps12: 0.042 },           // Botoeira por aproximação BT 4000
  EQ021: { amps12: 0.042 },           // Botoeira BT 3000 IN
  EQ022: { amps12: 0.25 },            // Display Puxe/Empurre
  EQ024: { amps12: 0.833 },           // GiroFlex 12V
  EQ026: { amps12: 0.5 },             // Fechadura magnética FS 150
  EQ027: { amps12: 0.5 },             // Fechadura magnética FE21150D
  EQ089: { poe: 1, wattsPoe: 6 },     // Câmera IP Dome VIP 1230D G4
  EQ099: { amps12: 0.5 },             // Central de alarme AMT 4010
  EQ100: { amps12: 1.25 },            // Sirene 12V
  EQ101: { amps12: 0.083 },           // Teclado XAT 4000
  EQ102: { amps12: 0.417 },           // Módulo GPRS XEG 4000
  EQ103: { amps12: 0.1 },             // Expansor PGM XEP 4004
  EQ166: { rede: 1, wattsDc: 9 },     // Roteador W4-300S (adaptador 9V)
  EQ167: { poe: 1, wattsPoe: 7 },     // Antena Wom 5a (PoE passivo 24V)
  EQ201: { amps12: 2 },               // Motor de giro pedestre
  EQ204: { amps12: 3 },               // Fechadura Magnética 300Kgf FE10300
  EQ213: { amps12: 0.167 },           // Módulo relé
  EQ215: { amps12: 0.2 },             // Fotocélula IVA 5015 (par)
};

// Saídas do dimensionamento (deletadas/recriadas a cada reconcílio no CENT)
const EQ_SWITCH_8P = "EQ159";  // Intelbras SF 900 HI-POE
const EQ_SWITCH_16P = "EQ160"; // Intelbras SF 1821 POE
const EQ_SWITCH_24P = "EQ212"; // Intelbras S1128G-PA (classe 24P PoE — confirmar modelo)
const EQ_FONTE_5A = "EQ174";   // Fonte 12V 5A MCM
const EQ_NOBREAK_2K = "EQ182"; // SUPER PLUS 2KVA Paulo Port
const EQ_BATERIA_70 = "EQ187"; // Freedom DF 1000 12V 70Ah
const OUTPUT_CODES = [EQ_SWITCH_8P, EQ_SWITCH_16P, EQ_SWITCH_24P, EQ_FONTE_5A, EQ_NOBREAK_2K, EQ_BATERIA_70];

const AUTONOMIA_HORAS = 4; // padrão da planilha (célula C75)

/** Recalcula switches/fontes/nobreak/baterias do projeto e hospeda no bloco CENT. */
export async function reconcileDimensionamentoProjeto(visitaId: string): Promise<void> {
  // 1) Blocos — o dimensionamento é hospedado na Central de Portaria Remota
  const { data: blocos } = await supabase
    .from("visita_blocos" as any)
    .select("id, tipo_bloco")
    .eq("visita_id", visitaId);
  const todos = ((blocos as any[]) ?? []);
  const cent = todos.find((b) => b.tipo_bloco === "CENT");
  if (!cent) return; // sem central (projeto não-PR): dimensionamento fica de fora por ora

  // 2) Redundância energética (página Complementos) — habilita nobreak/baterias
  const { data: orc } = await supabase
    .from("visita_orcamentos")
    .select("redundancia_energetica")
    .eq("visita_id", visitaId)
    .maybeSingle();
  const comRedundancia = (orc as any)?.redundancia_energetica === true;

  // 3) Consumos de TODOS os itens do projeto (auto + manuais, não removidos),
  //    ignorando as próprias saídas do dimensionamento
  const blocoIds = todos.map((b) => b.id);
  const { data: itens } = await supabase
    .from("visita_bloco_itens" as any)
    .select("cod_eq, qtd, removido")
    .in("visita_bloco_id", blocoIds);
  const rows = ((itens as any[]) ?? []).filter(
    (r) => !r.removido && !OUTPUT_CODES.includes(r.cod_eq),
  );

  let portasPoe = 0;
  let portasRede = 0;
  let wattsPoe = 0;
  let amps12 = 0;
  let wattsDc = 0;
  for (const r of rows) {
    const c = CONSUMO[r.cod_eq];
    if (!c) continue;
    const q = Number(r.qtd) || 0;
    portasPoe += (c.poe ?? 0) * q;
    portasRede += (c.rede ?? 0) * q;
    wattsPoe += (c.wattsPoe ?? 0) * q;
    amps12 += (c.amps12 ?? 0) * q;
    wattsDc += (c.wattsDc ?? 0) * q;
  }

  const novos: { cod_eq: string; qtd: number; observacao: string }[] = [];

  // 4) Switch
  const portas = portasPoe + portasRede;
  if (portas > 0) {
    if (portas <= 8) {
      novos.push({
        cod_eq: EQ_SWITCH_8P,
        qtd: 1,
        observacao: `Dimensionamento: ${portas} porta(s) (${portasPoe} PoE + ${portasRede} rede) → SF 900 HI-POE 8P`,
      });
    } else if (portas <= 16) {
      novos.push({
        cod_eq: EQ_SWITCH_16P,
        qtd: 1,
        observacao: `Dimensionamento: ${portas} porta(s) (${portasPoe} PoE + ${portasRede} rede) → SF 1821 POE 16P`,
      });
    } else {
      novos.push({
        cod_eq: EQ_SWITCH_24P,
        qtd: Math.ceil(portas / 24),
        observacao: `Dimensionamento: ${portas} porta(s) → classe 24P PoE (definir modelo com o técnico)`,
      });
    }
  }

  // 5) Fontes 12V 5A: corrente × 1,2 de margem ÷ 5A por fonte
  const fontes = Math.ceil((amps12 * 1.2) / 5);
  if (fontes > 0) {
    novos.push({
      cod_eq: EQ_FONTE_5A,
      qtd: fontes,
      observacao: `Dimensionamento: ${amps12.toFixed(2)} A @12V × 1,2 margem → ${fontes} fonte(s) 12V 5A`,
    });
  }

  // 6) Nobreak + baterias (somente com redundância energética contratada)
  if (comRedundancia) {
    const watts12 = amps12 * 12;
    const cargaBase = watts12 + wattsPoe + wattsDc;
    const carga = cargaBase * 1.15; // overhead switch/conversores
    if (carga > 0) {
      const va = Math.ceil(carga / 0.85);
      const nobreaks = Math.ceil(va / 2000);
      novos.push({
        cod_eq: EQ_NOBREAK_2K,
        qtd: nobreaks,
        observacao: `Dimensionamento: carga ${carga.toFixed(0)} W (${va} VA) → SUPER PLUS 2KVA`,
      });
      const ah = Math.ceil((carga * AUTONOMIA_HORAS) / 12 / 0.8);
      const baterias = Math.ceil(ah / 56); // 70Ah × 80% usável
      novos.push({
        cod_eq: EQ_BATERIA_70,
        qtd: baterias,
        observacao: `Dimensionamento: ${ah} Ah p/ ${AUTONOMIA_HORAS}h de autonomia → bateria 70Ah (56Ah úteis)`,
      });
    }
  }

  // 7) Re-hospeda no CENT (remove as saídas antigas e insere as novas)
  await supabase
    .from("visita_bloco_itens" as any)
    .delete()
    .eq("visita_bloco_id", cent.id)
    .in("cod_eq", OUTPUT_CODES)
    .eq("origem", "auto");

  if (novos.length > 0) {
    await supabase.from("visita_bloco_itens" as any).insert(
      novos.map((n) => ({
        visita_bloco_id: cent.id,
        cod_eq: n.cod_eq,
        qtd: n.qtd,
        origem: "auto",
        observacao: n.observacao,
      })),
    );
  }
}
