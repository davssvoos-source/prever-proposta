// Motor de cálculo do módulo Alarme de Intrusão (Intelbras AMT 4010 / AMT 8000).
// TS puro — usado pelo wizard para calcular o BOM em tempo real e persistir
// direto em visita_bloco_itens (origem='auto'). O Edge Function `calcular`
// recompõe o total do projeto a partir dos itens já salvos.

export type AlarmeRamo = "CAB" | "SF";

export interface AlarmePerimetro {
  distancia: number;           // metros
  feixes: 2 | 4 | 6 | 8;
}

export interface AlarmeConfig {
  ramo: AlarmeRamo;

  // ── Ramo A — AMT 4010 (com fio) ──────────────────────────────────────
  aberturas_comuns?: number;      // XAS Sobrepor (pacote 5)
  portao_mini?: number;           // XAS Porta Aço Mini
  portao_normal?: number;         // XAS Porta Aço Normal
  aberturas_sf?: number;          // XAS 4010 Smart (sem fio) → força XAR 4000
  ivp_interno?: number;           // IVP 5001 PET
  ivp_interno_mw?: number;        // IVP 5311 MW PET
  ivp_externo_qtd?: number;
  ivp_externo_modelo?: "ALM_IVP7001" | "ALM_IVP3000";
  perimetro_enable?: boolean;
  perimetros?: AlarmePerimetro[];
  fonte_modelo?: string;          // default EQ008
  teclados_extras?: number;       // XAT 4000 (0-3 — total máx 4)
  controles?: number;             // referência p/ acionar XAR 4000
  sirenes?: number;               // Morey 12V (0-2)
  monitoramento_app?: boolean;    // XEG 4000
  automacoes?: number;            // PGMs (3 na central, +XEP 4004 acima)

  // ── Ramo B — AMT 8000 (sem fio) ──────────────────────────────────────
  aberturas?: number;             // XAS 8000
  ivp_interno_sf?: number;        // IVP 8000 PET
  ivp_cam_sf?: number;            // IVP 8000 PET CAM
  ivp_externo_sf?: number;        // IVP 8000 EX
  teclados_extras_sf?: number;    // XAT 8000 além do automático
  usuarios_controle?: number;     // XAC 8000
  sirenes_sf?: number;            // XSS 8000 (default 1)
  redundancia_gsm?: boolean;      // XAG 8000
  linha_telefonica?: boolean;     // FXO 8000
  automacoes_sf?: number;         // PGM 8000
  distancia_faixa?: 100 | 300 | 600 | 1000;
  muitos_obstaculos?: boolean;
  repetidores?: number;           // REP 8000 (0-4)
}

export interface CalcRow {
  cod_eq: string;
  qtd: number;
  auto: boolean;
  regra?: string;
}

export interface CalcResult {
  itens: CalcRow[];
  zonas_cabeadas: number;
  zonas_sem_fio: number;
  dispositivos_sf: number;
  alertas: { tipo: "warn" | "error"; msg: string }[];
}

const ceil = (a: number, b: number) => (b <= 0 ? 0 : Math.ceil(a / b));

const IVA_MODELO: Record<2 | 4 | 6 | 8, string> = {
  2: "ALM_IVA7100D",
  4: "ALM_IVA7100Q",
  6: "ALM_IVA7100H",
  8: "ALM_IVA7100O",
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

  if (cfg.ramo === "CAB") {
    // ── Central + bateria ──────────────────────────────────────────────
    push(itens, "ALM_AMT4010", 1, true, "Central definida pela estrutura COM FIO");
    push(itens, "ALM_XB1270", 1, true, "Central não acompanha bateria");

    const aberturas_comuns = cfg.aberturas_comuns ?? 0;
    const portao_mini = cfg.portao_mini ?? 0;
    const portao_normal = cfg.portao_normal ?? 0;
    const aberturas_sf = cfg.aberturas_sf ?? 0;
    const ivp_i = cfg.ivp_interno ?? 0;
    const ivp_imw = cfg.ivp_interno_mw ?? 0;
    const ivp_e = cfg.ivp_externo_qtd ?? 0;
    const ivp_e_modelo = cfg.ivp_externo_modelo ?? "ALM_IVP7001";
    const controles = cfg.controles ?? 0;
    const teclados_extras = Math.min(cfg.teclados_extras ?? 0, 3);
    const sirenes = Math.min(cfg.sirenes ?? 1, 2);
    const monitoramento = !!cfg.monitoramento_app;
    const automacoes = cfg.automacoes ?? 0;

    // ── Sensores magnéticos ────────────────────────────────────────────
    if (aberturas_comuns > 0) {
      const pacotes = ceil(aberturas_comuns, 5);
      push(itens, "ALM_XASSOBP", pacotes, false,
        `${aberturas_comuns} aberturas → ${pacotes} pacote(s) de 5 (sobram ${pacotes * 5 - aberturas_comuns})`);
    }
    push(itens, "ALM_XASPAM", portao_mini);
    push(itens, "ALM_XASPAN", portao_normal);
    push(itens, "ALM_XAS4010", aberturas_sf);

    // ── IVPs ───────────────────────────────────────────────────────────
    push(itens, "ALM_IVP5001", ivp_i);
    push(itens, "ALM_IVP5311", ivp_imw);
    push(itens, ivp_e_modelo, ivp_e);

    // ── Perímetro (IVAs) ───────────────────────────────────────────────
    let total_ivas = 0;
    if (cfg.perimetro_enable && cfg.perimetros?.length) {
      for (const p of cfg.perimetros) {
        if (!p.distancia || p.distancia <= 0) continue;
        const conjuntos = ceil(p.distancia, 100);
        total_ivas += conjuntos;
        push(itens, IVA_MODELO[p.feixes], conjuntos, false,
          `Vão de ${p.distancia}m ÷ 100 = ${conjuntos} conjunto(s)`);
      }
    }

    // ── Fonte auxiliar 12V (se ≥ 4 IVAs) ───────────────────────────────
    if (total_ivas >= 4) {
      const fontes = ceil(total_ivas, 4);
      const fonteModelo = cfg.fonte_modelo || "EQ008";
      push(itens, fonteModelo, fontes, true,
        `${total_ivas} IVAs ≥ 4 → saída auxiliar da central não alimenta, 1 fonte a cada 4`);
    }

    // ── Cálculo de zonas ───────────────────────────────────────────────
    const zonas_cabeadas =
      aberturas_comuns + portao_mini + portao_normal + ivp_i + ivp_imw + ivp_e + total_ivas;
    const zonas_sem_fio = aberturas_sf;

    // ── Expansor de zonas ──────────────────────────────────────────────
    if (zonas_cabeadas > 10) {
      const xez = Math.min(ceil(zonas_cabeadas - 10, 8), 6);
      push(itens, "ALM_XEZ4108", xez, true,
        `${zonas_cabeadas} zonas cabeadas > 10 → ceil((${zonas_cabeadas}-10)/8) = ${xez} expansor(es)`);
    }

    // ── Receptor sem fio (se houver SF ou controles) ───────────────────
    if (aberturas_sf > 0 || controles > 0) {
      push(itens, "ALM_XAR4000", 1, true,
        "Receptor necessário para dispositivos/controles sem fio");
    }

    // ── Teclado adicional (1 vem com a central) ────────────────────────
    push(itens, "ALM_XAT4000", teclados_extras);

    // ── Sirenes ────────────────────────────────────────────────────────
    push(itens, "ALM_SIRMOREY", sirenes);

    // ── Comunicação ────────────────────────────────────────────────────
    if (monitoramento) push(itens, "ALM_XEG4000", 1, true, "Monitoramento por app/internet");

    // ── Expansor PGM ───────────────────────────────────────────────────
    if (automacoes > 3) {
      const xep = Math.min(ceil(automacoes - 3, 4), 4);
      push(itens, "ALM_XEP4004", xep, true,
        `${automacoes} automações > 3 PGMs da central → ${xep} expansor(es)`);
    }

    // ── Validações ─────────────────────────────────────────────────────
    if (zonas_cabeadas > 58 && zonas_cabeadas <= 64) {
      alertas.push({
        tipo: "warn",
        msg: `Zonas cabeadas em ${zonas_cabeadas}/64 — adicione teclados extras (+2 zonas cada) ou divida em 2 centrais.`,
      });
    }
    if (zonas_cabeadas + zonas_sem_fio > 64) {
      alertas.push({
        tipo: "error",
        msg: `Total ${zonas_cabeadas + zonas_sem_fio} zonas > 64 — divida o projeto em 2 centrais.`,
      });
    }

    return { itens, zonas_cabeadas, zonas_sem_fio, dispositivos_sf: 0, alertas };
  }

  // ─── RAMO B — AMT 8000 ────────────────────────────────────────────────
  push(itens, "ALM_AMT8000", 1, true, "Central definida pela estrutura SEM FIO");
  push(itens, "ALM_XAT8000", 1, true, "Central não acompanha teclado — 1 obrigatório");

  const aberturas = cfg.aberturas ?? 0;
  const ivp_i = cfg.ivp_interno_sf ?? 0;
  const ivp_c = cfg.ivp_cam_sf ?? 0;
  const ivp_e = cfg.ivp_externo_sf ?? 0;
  const teclados_extras = Math.min(cfg.teclados_extras_sf ?? 0, 15);
  const usuarios = Math.min(cfg.usuarios_controle ?? 0, 98);
  const sirenes = Math.min(cfg.sirenes_sf ?? 1, 16);
  const automacoes = Math.min(cfg.automacoes_sf ?? 0, 16);
  const repetidores = Math.min(cfg.repetidores ?? 0, 4);

  push(itens, "ALM_XAS8000", aberturas);
  push(itens, "ALM_IVP8000P", ivp_i);
  push(itens, "ALM_IVP8000C", ivp_c);
  push(itens, "ALM_IVP8000E", ivp_e);
  push(itens, "ALM_XAT8000", teclados_extras);
  push(itens, "ALM_XAC8000", usuarios);
  push(itens, "ALM_XSS8000", sirenes);
  push(itens, "ALM_PGM8000", automacoes);

  if (cfg.redundancia_gsm) push(itens, "ALM_XAG8000", 1);
  if (cfg.linha_telefonica) push(itens, "ALM_FXO8000", 1);

  // ── Repetidor: sugestão automática ─────────────────────────────────────
  const sugerirRep =
    cfg.distancia_faixa === 1000 ||
    (cfg.distancia_faixa === 600 && !!cfg.muitos_obstaculos);
  const repFinal = repetidores > 0 ? repetidores : (sugerirRep ? 1 : 0);
  if (repFinal > 0) {
    push(itens, "ALM_REP8000", repFinal, repetidores === 0,
      "Sugerido pela distância/obstáculos — cascata não permitida (alcance final até 1,2 km)");
  }

  const dispositivos_sf = aberturas + ivp_i + ivp_c + ivp_e;
  if (dispositivos_sf > 60 && dispositivos_sf <= 64) {
    alertas.push({ tipo: "warn", msg: `Dispositivos ${dispositivos_sf}/64 — próximo do limite.` });
  }
  if (dispositivos_sf > 64) {
    alertas.push({ tipo: "error", msg: `Total ${dispositivos_sf} dispositivos > 64 — divida em 2 centrais.` });
  }

  return { itens, zonas_cabeadas: 0, zonas_sem_fio: 0, dispositivos_sf, alertas };
}

// Metadados legíveis dos códigos, para a UI de resumo
export const ALARME_LABELS: Record<string, { nome: string; modelo: string }> = {
  ALM_AMT4010:  { nome: "Central de alarme",           modelo: "AMT 4010 Smart" },
  ALM_AMT8000:  { nome: "Central de alarme",           modelo: "AMT 8000" },
  ALM_XB1270:   { nome: "Bateria 12V 7Ah",             modelo: "XB 1270" },
  ALM_SIRMOREY: { nome: "Sirene 12V",                  modelo: "Morey 12V" },
  ALM_XAT4000:  { nome: "Teclado LCD",                 modelo: "XAT 4000 Smart" },
  ALM_XEG4000:  { nome: "Módulo GPRS/Ethernet",        modelo: "XEG 4000 Smart" },
  ALM_XEP4004:  { nome: "Expansor de PGM",             modelo: "XEP 4004 Smart" },
  ALM_XEZ4108:  { nome: "Expansor de zonas",           modelo: "XEZ 4108 Smart" },
  ALM_XAR4000:  { nome: "Receptor sem fio",            modelo: "XAR 4000 Smart" },
  ALM_IVA7100D: { nome: "Barreira 100m 2 feixes",      modelo: "IVA 7100 Dual" },
  ALM_IVA7100Q: { nome: "Barreira 100m 4 feixes",      modelo: "IVA 7100 Quad" },
  ALM_IVA7100H: { nome: "Barreira 100m 6 feixes",      modelo: "IVA 7100 Hexa" },
  ALM_IVA7100O: { nome: "Barreira 100m 8 feixes",      modelo: "IVA 7100 Octa" },
  ALM_IVP5001:  { nome: "Sensor IVP interno PET",      modelo: "IVP 5001 PET" },
  ALM_IVP5311:  { nome: "Sensor IVP interno MW",       modelo: "IVP 5311 MW PET" },
  ALM_IVP3000:  { nome: "Sensor IVP externo",          modelo: "IVP 3000 MW EX" },
  ALM_IVP7001:  { nome: "Sensor IVP externo",          modelo: "IVP 7001 MW EX" },
  ALM_XAS4010:  { nome: "Sensor magnético sem fio",    modelo: "XAS 4010 Smart" },
  ALM_XASSOBP:  { nome: "Sensor sobrepor (pct 5)",     modelo: "XAS Sobrepor" },
  ALM_XASPAM:   { nome: "Sensor porta aço mini",       modelo: "XAS Porta Aço Mini" },
  ALM_XASPAN:   { nome: "Sensor porta aço normal",     modelo: "XAS Porta Aço Normal" },
  ALM_XSS8000:  { nome: "Sirene sem fio",              modelo: "XSS 8000" },
  ALM_XAT8000:  { nome: "Teclado sem fio",             modelo: "XAT 8000" },
  ALM_XAG8000:  { nome: "Módulo GPRS sem fio",         modelo: "XAG 8000" },
  ALM_PGM8000:  { nome: "Atuador PGM",                 modelo: "PGM 8000" },
  ALM_REP8000:  { nome: "Amplificador de alcance",     modelo: "REP 8000" },
  ALM_FXO8000:  { nome: "Módulo linha telefônica",     modelo: "FXO 8000" },
  ALM_XAC8000:  { nome: "Controle remoto",             modelo: "XAC 8000" },
  ALM_IVP8000P: { nome: "Sensor IVP sem fio PET",      modelo: "IVP 8000 PET" },
  ALM_IVP8000C: { nome: "Sensor IVP com câmera",       modelo: "IVP 8000 PET CAM" },
  ALM_IVP8000E: { nome: "Sensor IVP externo sem fio",  modelo: "IVP 8000 EX" },
  EQ008:        { nome: "Fonte 12V 10A colmeia",       modelo: "FT-1210" },
};

export const GRUPO_CODIGO: Record<string, "central" | "sensores" | "comunicacao" | "automacao"> = {
  ALM_AMT4010: "central", ALM_AMT8000: "central", ALM_XB1270: "central",
  ALM_XAT4000: "central", ALM_XAT8000: "central", ALM_SIRMOREY: "central",
  ALM_XSS8000: "central", ALM_XAR4000: "central", ALM_XEZ4108: "central",
  ALM_REP8000: "central", EQ008: "central",
  ALM_IVP5001: "sensores", ALM_IVP5311: "sensores", ALM_IVP3000: "sensores",
  ALM_IVP7001: "sensores", ALM_IVP8000P: "sensores", ALM_IVP8000C: "sensores",
  ALM_IVP8000E: "sensores", ALM_XAS4010: "sensores", ALM_XASSOBP: "sensores",
  ALM_XASPAM: "sensores", ALM_XASPAN: "sensores", ALM_XAS8000: "sensores",
  ALM_IVA7100D: "sensores", ALM_IVA7100Q: "sensores",
  ALM_IVA7100H: "sensores", ALM_IVA7100O: "sensores",
  ALM_XEG4000: "comunicacao", ALM_XAG8000: "comunicacao", ALM_FXO8000: "comunicacao",
  ALM_XEP4004: "automacao", ALM_PGM8000: "automacao", ALM_XAC8000: "automacao",
};
