// Motor de cálculo do bloco Alarme (Intelbras AMT 4010 com fio / AMT 8000 sem fio).
// TS puro — usado pelo AlarmeWizard para calcular o BOM em tempo real e persistir
// direto em visita_bloco_itens (origem='auto'). A config (zonas) é gravada em
// visita_blocos.alarme_config.
//
// Conceito de ZONA: zona = ambiente. Cada zona suporta até 3 sensores (ou 3 pares,
// quando o sensor trabalha em par, caso dos IVA). A cada 8 zonas no projeto,
// 1 expansor XEZ 4008 Smart (⌈zonas/8⌉ — regra confirmada com o cliente).

export type AlarmeRamo = "CAB" | "SF";

/** Tipos de sensor disponíveis por ramo. */
export type AlarmeSensorTipo =
  // Com fio (AMT 4010)
  | "ivp_int"      // IVP 5311 MW PET
  | "ivp_ext"      // IVP 7000 MW EX
  | "iva40"        // IVA 5040 AT (par, até 40 m)
  | "iva80"        // IVA 5080 AT (par, até 80 m)
  | "porta_int"    // XAS Sobrepor (pacote c/ 5)
  | "porta_ext"    // XAS Porta de Aço Mini
  | "janela_int"   // XAS Sobrepor (pacote c/ 5)
  | "janela_ext"   // XAS Porta de Aço Mini
  // Sem fio (AMT 8000)
  | "sf_ivp_int"   // IVP 4101 PET Smart
  | "sf_ivp_ext"   // IVP 8000 EX G2
  | "sf_iva40"     // IVA 8040 AT (par, 40 m)
  | "sf_abertura"; // XAS 8000 (porta ou janela)

export interface AlarmeZona {
  tipo: AlarmeSensorTipo;
  /** Sensores (ou pares) na zona — 1 a 3. */
  qtd: number;
  /** Com fio: metros de cabo da zona (0 quando usa transmissor TX). */
  metros: number;
  /** Com fio: sensor distante convertido em sem fio via TX 4020 (1 por sensor). */
  tx: boolean;
}

export interface AlarmeConfig {
  ramo: AlarmeRamo;
  zonas: AlarmeZona[];
  /** Sem fio: repetidores de sinal REP 8000 (técnico decide pela distância). */
  repetidores?: number;
  /** Com fio: Residência/Galpão adiciona XAR 4000 Smart à central. */
  residenciaOuGalpao?: boolean;
  /** Projeto de Portaria Remota: a central (AMT 4010 + GPRS + bateria) já vem no
   *  bloco CENT — o Alarme COM FIO não deve adicionar outra (só as zonas/sensores). */
  portariaRemota?: boolean;
}

export interface CalcRow {
  cod_eq: string;
  qtd: number;
  auto: boolean;
  regra?: string;
}

export interface CalcResult {
  itens: CalcRow[];
  zonas: number;
  totalMetros: number;
  alertas: { tipo: "warn" | "error"; msg: string }[];
}

export const MAX_SENSORES_POR_ZONA = 3;

const ceil = (a: number, b: number) => (b <= 0 ? 0 : Math.ceil(Math.max(0, a) / b));

/** Sensor de cada tipo (código + se trabalha em par). */
export const SENSOR_INFO: Record<AlarmeSensorTipo, { cod: string; par: boolean; label: string }> = {
  ivp_int:     { cod: "ALM_IVP5311",     par: false, label: "IVP Interno" },
  ivp_ext:     { cod: "ALM_IVP7000",     par: false, label: "IVP Externo" },
  iva40:       { cod: "ALM_IVA5040",     par: true,  label: "IVA até 40 m" },
  iva80:       { cod: "ALM_IVA5080",     par: true,  label: "IVA até 80 m" },
  porta_int:   { cod: "ALM_XASSOBP",     par: false, label: "Porta interna" },
  porta_ext:   { cod: "ALM_XASPAM",      par: false, label: "Porta externa" },
  janela_int:  { cod: "ALM_XASSOBP",     par: false, label: "Janela interna" },
  janela_ext:  { cod: "ALM_XASPAM",      par: false, label: "Janela externa" },
  sf_ivp_int:  { cod: "ALM_IVP4101",     par: false, label: "IVP Interno" },
  sf_ivp_ext:  { cod: "ALM_IVP8000EXG2", par: false, label: "IVP Externo" },
  sf_iva40:    { cod: "ALM_IVA8040",     par: true,  label: "IVA 40 m" },
  sf_abertura: { cod: "ALM_XAS8000",     par: false, label: "Porta / Janela" },
};

function push(acc: CalcRow[], cod_eq: string, qtd: number, auto = false, regra?: string) {
  if (!qtd || qtd <= 0) return;
  const existing = acc.find((r) => r.cod_eq === cod_eq);
  if (existing) {
    existing.qtd += qtd;
    if (auto && !existing.auto) existing.auto = true;
    if (regra && !existing.regra) existing.regra = regra;
  } else {
    acc.push({ cod_eq, qtd, auto, regra });
  }
}

export function computeAlarme(cfg: AlarmeConfig): CalcResult {
  const itens: CalcRow[] = [];
  const alertas: { tipo: "warn" | "error"; msg: string }[] = [];
  const zonas = cfg.zonas ?? [];
  const nZonas = zonas.length;

  // ── Sensores por zona ────────────────────────────────────────────────────
  // XAS Sobrepor vende em pacote c/ 5 → acumula unidades e converte no final.
  let sobreporUnidades = 0;
  let sensoresTx = 0;
  let totalMetros = 0;

  for (const z of zonas) {
    const info = SENSOR_INFO[z.tipo];
    if (!info) continue;
    const qtd = Math.max(1, Math.min(MAX_SENSORES_POR_ZONA, z.qtd || 1));
    if (info.cod === "ALM_XASSOBP") sobreporUnidades += qtd;
    else push(itens, info.cod, qtd, false, `${info.label} — ${qtd}× na zona`);

    if (cfg.ramo === "CAB") {
      if (z.tx) sensoresTx += qtd;
      else totalMetros += Math.max(0, z.metros || 0);
    }
  }

  if (sobreporUnidades > 0) {
    const pacotes = ceil(sobreporUnidades, 5);
    push(itens, "ALM_XASSOBP", pacotes, false,
      `${sobreporUnidades} sensor(es) sobrepor → ${pacotes} pacote(s) de 5`);
  }

  if (cfg.ramo === "CAB") {
    // ── Central com fio ──────────────────────────────────────────────────
    // Em projeto de Portaria Remota o painel AMT 4010 + GPRS + bateria já
    // vêm no bloco CENT (mesmo painel físico) — não duplica aqui.
    if (!cfg.portariaRemota) {
      push(itens, "ALM_AMT4010", 1, true, "Central de alarme AMT 4010 (com fio)");
      push(itens, "ALM_XEG4000", 1, true, "Módulo de comunicação GPRS/Ethernet");
      push(itens, "ALM_XB1270", 1, true, "Bateria 12V 7Ah");
    }
    if (cfg.residenciaOuGalpao) {
      push(itens, "ALM_XAR4000", 1, true, "XAR 4000 Smart — Residência/Galpão");
    }

    // ── Expansor de zonas: 1 XEZ 4008 a cada 8 zonas ─────────────────────
    push(itens, "ALM_XEZ4008", ceil(nZonas, 8), true,
      `${nZonas} zona(s) → 1 expansor a cada 8`);

    // ── TX 4020: sensor distante convertido em sem fio (1 por sensor) ────
    push(itens, "ALM_TX4020", sensoresTx, false,
      "Transmissor universal — sensor distante sem cabeamento");

    // ── Cabeamento: mesma regra do CFTV (caixa de 300 m) ─────────────────
    push(itens, "EQ302", ceil(totalMetros, 300), true,
      `Cabo — caixa 300 m (total ${totalMetros} m)`);
  } else {
    // ── Central sem fio ──────────────────────────────────────────────────
    push(itens, "ALM_AMT8000", 1, true, "Central de alarme AMT 8000 (sem fio)");
    push(itens, "ALM_XAG8000", 1, true, "Módulo de comunicação GPRS XAG 8000");

    // ── Repetidor de sinal (decisão do técnico) ──────────────────────────
    push(itens, "ALM_REP8000", Math.max(0, cfg.repetidores ?? 0), false,
      "Repetidor de sinal — ampliação de alcance dos sensores");
  }

  return { itens, zonas: nZonas, totalMetros, alertas };
}

// Metadados legíveis dos códigos, para a UI (fallback quando o catálogo não carrega).
export const ALARME_LABELS: Record<string, { nome: string; modelo: string }> = {
  ALM_AMT4010:     { nome: "Central de alarme",              modelo: "AMT 4010 Smart" },
  ALM_AMT8000:     { nome: "Central de alarme",              modelo: "AMT 8000" },
  ALM_XB1270:      { nome: "Bateria 12V 7Ah",                modelo: "XB 1270" },
  ALM_XEG4000:     { nome: "Módulo GPRS/Ethernet",           modelo: "XEG 4000 Smart" },
  ALM_XAG8000:     { nome: "Módulo GPRS sem fio",            modelo: "XAG 8000" },
  ALM_XAR4000:     { nome: "Receptor sem fio",               modelo: "XAR 4000 Smart" },
  ALM_XEZ4008:     { nome: "Expansor de zonas",              modelo: "XEZ 4008 Smart" },
  ALM_TX4020:      { nome: "Transmissor universal",          modelo: "TX 4020 Smart" },
  ALM_TX8000:      { nome: "Transmissor universal",          modelo: "TX 8000" },
  ALM_REP8000:     { nome: "Repetidor de sinal",             modelo: "REP 8000" },
  ALM_IVP5311:     { nome: "Sensor IVP interno MW",          modelo: "IVP 5311 MW PET" },
  ALM_IVP7000:     { nome: "Sensor IVP externo MW",          modelo: "IVP 7000 MW EX" },
  ALM_IVP4101:     { nome: "Sensor IVP interno sem fio",     modelo: "IVP 4101 PET Smart" },
  ALM_IVP8000EXG2: { nome: "Sensor IVP externo sem fio",     modelo: "IVP 8000 EX G2" },
  ALM_IVA5040:     { nome: "Barreira IVA (par, até 40m)",    modelo: "IVA 5040 AT" },
  ALM_IVA5080:     { nome: "Barreira IVA (par, até 80m)",    modelo: "IVA 5080 AT" },
  ALM_IVA8040:     { nome: "Barreira IVA sem fio (par)",     modelo: "IVA 8040 AT" },
  ALM_XASSOBP:     { nome: "Sensor sobrepor (pct 5)",        modelo: "XAS Sobrepor" },
  ALM_XASPAM:      { nome: "Sensor porta aço mini",          modelo: "XAS Porta Aço Mini" },
  ALM_XASPAS:      { nome: "Sensor porta aço c/ suporte",    modelo: "XAS Aço c/ Suporte" },
  ALM_XAS8000:     { nome: "Sensor magnético sem fio",       modelo: "XAS 8000" },
  EQ302:           { nome: "Cabo de rede",                   modelo: "CAT5-E (caixa 300 m)" },
};
