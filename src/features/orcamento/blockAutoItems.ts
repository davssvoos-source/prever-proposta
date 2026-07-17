// Motor de regras de equipamentos por bloco — base v9 (EQ codes).
// Referências: sempre pelo CÓDIGO EQ (mesma tabela `equipamentos`).

import { gerarCodigoBloco, type BlocoConfig, type CftvCamera, type TipoBloco } from "@/lib/blocos";

export interface AutoBlockItem {
  cod_eq: string;
  qtd: number;
  observacao?: string | null;
}

type ComputeInput = {
  codigo: string;
  tipoBloco: TipoBloco;
  tecnologia?: string | null;
  qtdDome?: number | null;
  qtdBullet?: number | null;
  cftvCameras?: CftvCamera[] | null;
  perimetro?: number | null;
  esquinas?: number | null;
};

// ─── CFTV: I.A por câmera → serviços mensais (tabela `servicos`) ─────────────
export const CFTV_IA_SERVICOS: Record<string, string> = {
  "Leitura de Placas": "SV030",
  "Detecção de presença": "SV031",
  "Detecção de ausência": "SV032",
  "Detecção de movimento": "SV033",
  "Smart Sampa": "SV034",
};

// As 4 I.As marcáveis por câmera (Smart Sampa no Totem é por totem, não por câmera).
export const IA_OPCOES_CAMERA = [
  "Leitura de Placas",
  "Detecção de presença",
  "Detecção de ausência",
  "Detecção de movimento",
];

/** Itens com código SV* são serviços mensais — exibidos em "Mensalidades", não em equipamentos. */
export const isServicoCode = (cod: string) => /^SV\d+/i.test(cod);

// ─── Receptores RF e Módulo Guarita (regra por projeto) ──────────────────────
export const EQ_RECEPTOR_RTX = "EQ004"; // Receptor RF RTX 3004 (1 por bloco com CTRL)
export const EQ_RECEPTOR_RMF = "EQ007"; // Receptor HCS Multifunção RMF3004 (sub-central: 4 antenas cada)
export const EQ_ANTENA_TAG = "EQ008"; // Antena Veicular para TAG RTAG 3000 (1 por sigla TAG)
export const EQ_MODULO_GUARITA = "EQ003"; // Módulo Guarita IP MG 3000

/** Receptor HCS Multifunção: sub-central que suporta 4 Antenas TAG. */
export function qtdMultifuncao(totalAntenas: number): number {
  return Math.ceil(Math.max(0, totalAntenas) / 4);
}

/** Módulo Guarita IP MG 3000: 16 canais, divididos em 8 para RTX e 8 para RMF.
 *  Ex.: 9 RTX → 2 módulos. Obrigatório (mín. 1) em Portaria Remota; em Portaria
 *  Presencial só quando há RTX ou RMF no projeto. */
export function qtdModulosGuarita(totalRtx: number, totalRmf: number, portariaRemota: boolean): number {
  const porCapacidade = Math.max(
    Math.ceil(Math.max(0, totalRtx) / 8),
    Math.ceil(Math.max(0, totalRmf) / 8),
  );
  return portariaRemota ? Math.max(1, porCapacidade) : porCapacidade;
}

const ceil = (value: number, divisor: number) =>
  divisor <= 0 ? 0 : Math.ceil(Math.max(0, value) / divisor);

function add(acc: Map<string, AutoBlockItem>, cod_eq: string, qtd: number, observacao: string) {
  if (!cod_eq || qtd <= 0) return;
  const prev = acc.get(cod_eq);
  if (prev) {
    prev.qtd += qtd;
    if (!prev.observacao) prev.observacao = observacao;
  } else {
    acc.set(cod_eq, { cod_eq, qtd, observacao });
  }
}

function countTokens(codigo: string) {
  const counts: Record<string, number> = {};
  for (const token of codigo.toUpperCase().split("-")) counts[token] = (counts[token] || 0) + 1;
  return counts;
}

// Tokens que iniciam um segmento de barreira dentro do código de um bloco de acesso.
const BARRIER_TYPES = new Set(["CAT", "PORP", "CAN", "PORV", "ELEV"]);

/** Divide o código do bloco em segmentos de barreira: cada segmento começa num
 *  token de tipo (CAT/PORP/CAN/PORV) e carrega os tokens seguintes (entrada,
 *  saída, abertura, porte...). Ex.: VEI-2B-CAN-CTRL-TAG-PORV-CTRL-FAC-DESL-PR →
 *  [{tipo:"CAN", toks:{CTRL,TAG}}, {tipo:"PORV", toks:{CTRL,FAC,DESL,PR}}]. */
function parseBarreiras(codigo: string): { tipo: string; toks: Set<string> }[] {
  const parts = codigo.toUpperCase().split("-");
  const out: { tipo: string; toks: Set<string> }[] = [];
  let atual: { tipo: string; toks: Set<string> } | null = null;
  for (const p of parts) {
    if (BARRIER_TYPES.has(p)) {
      atual = { tipo: p, toks: new Set() };
      out.push(atual);
    } else if (atual) {
      atual.toks.add(p);
    }
  }
  return out;
}

// ─── Acesso (PED / VEI) ──────────────────────────────────────────────────────
function computeAcesso(input: ComputeInput): AutoBlockItem[] {
  const acc = new Map<string, AutoBlockItem>();
  const tokens = countTokens(input.codigo);
  const tipo = input.tipoBloco;
  const barreiras = tokens["2B"] ? 2 : 1;
  const portariaPR = !!tokens.PR;
  const portariaPP = !!tokens.PP;

  const fac = tokens.FAC || 0;
  const botana = tokens.BOTANA || 0;
  const botapr = tokens.BOTAPR || 0;
  const dig = tokens.DIG || 0;
  const lac = tokens.LAC || 0;
  const fot = tokens.FOT || 0;
  const mol = tokens.MOL || 0;
  const cat = tokens.CAT || 0;
  const porp = tokens.PORP || 0;
  const can = tokens.CAN || 0;
  const mot = tokens.MOT || 0;
  const lpr = tokens.LPR || 0;

  const porv = tokens.PORV || 0;
  const segmentos = parseBarreiras(input.codigo);
  const ctrlBarreiras = segmentos.filter((b) => b.toks.has("CTRL")).length;
  const tag = tokens.TAG || 0;

  // Leitoras / acionamentos
  add(acc, "EQ011", fac, "Leitora Facial selecionada no bloco");
  add(acc, "EQ032", fac, "Acrílico Somente Facial (1 por leitora facial)");
  add(acc, "EQ021", botana, "Botoeira comum selecionada no bloco");
  add(acc, "EQ035", botana, "Acrílico do botão");
  add(acc, "EQ020", botapr, "Botoeira por aproximação selecionada no bloco");
  add(acc, "EQ214", dig, "Leitora Biometria Digital selecionada no bloco");
  add(acc, "EQ092", lpr, "Câmera IP LPR selecionada no bloco");

  // Receptores RF: 1 RTX 3004 por BLOCO com controle remoto (CTRL) — 1 receptor já
  // atende as 2 barreiras da mesma eclusa de portão, não soma por barreira.
  // TAG: 1 Antena Veicular RTAG 3000 (EQ008) por sigla TAG. O Receptor HCS
  // Multifunção (RMF3004/EQ007) NÃO é adicionado aqui: é sub-central por
  // PROJETO (⌈antenas/4⌉), reconciliado por `reconcileGuaritaProjeto` — assim
  // como o Módulo Guarita IP (EQ003: 8 canais RTX + 8 canais RMF) e o RTX
  // adicional por eclusa veicular em Portaria Remota (hospedado na CENT).
  const rtxQtd = Math.min(ctrlBarreiras, 1);
  add(acc, "EQ004", rtxQtd, "Receptor RF RTX 3004 (1 por bloco/eclusa com controle remoto)");
  add(acc, "EQ008", tag, "Antena Veicular para TAG RTAG 3000 (1 por TAG)");

  // XAS porta de aço c/ suporte: 1 por portão veicular (PORV) — qualquer portaria
  if (porv > 0) {
    add(acc, "ALM_XASPAS", porv, "XAS porta de aço c/ suporte (1 por portão veicular)");
  }

  // Laço indutivo: 1 central + 1 laço físico POR LAC selecionado
  add(acc, "EQ064", lac, "Central de Laço Indutivo (1 por laço)");
  add(acc, "EQ065", lac, "Laço Indutivo físico (1 por laço)");

  // Fotocélula (EQ215 já é vendida em par — 1 unidade = 1 par) — só em blocos veiculares:
  //  • Cancela (CAN): 2 pares por cancela.
  //  • Portão veicular (PORV): deslizante → 1 par; pivotante ou basculante → 2 pares.
  //  • Cada sigla FOT (saída por fotocélula) soma +1 par.
  if (tipo === "VEI") {
    let pares = 0;
    for (const b of segmentos) {
      if (b.tipo === "CAN") pares += 2;
      else if (b.tipo === "PORV") {
        if (b.toks.has("DESL")) pares += 1;
        else if (b.toks.has("PIVO") || b.toks.has("BASC")) pares += 2;
      }
    }
    pares += fot;
    add(acc, "EQ215", pares, `Fotocélula anti-esmagamento (${pares} par(es))`);
  }

  // Molas aéreas por peso da porta (MH 102/103/104 A Preta).
  // Fallback: MOL sem token de peso (blocos antigos) → MH 103 A (comportamento anterior).
  const mol45 = tokens.MOL45 || 0;
  const mol65 = tokens.MOL65 || 0;
  const mol85 = tokens.MOL85 || 0;
  add(acc, "EQ029", mol45, "Mola aérea até 45 kg (MH 102 A Preta)");
  add(acc, "EQ030", mol65, "Mola aérea até 65 kg (MH 103 A Preta)");
  add(acc, "EQ304", mol85, "Mola aérea até 85 kg (MH 104 A Preta)");
  add(acc, "EQ030", Math.max(0, mol - mol45 - mol65 - mol85), "Mola aérea (peso não informado — bloco antigo)");

  // Cancela
  add(acc, "EQ055", can, "Cancela e Braço 4m selecionada no bloco");

  // Porta pedestre — display + fechadura.
  // Display Puxe/Empurre só em porta SEM motor de giro (com motor não precisa).
  const porpSemMotor = segmentos.filter((b) => b.tipo === "PORP" && !b.toks.has("MOT")).length;
  add(acc, "EQ022", porpSemMotor, "Display sinalizador Puxe/Empurre (porta sem motor)");
  add(acc, "EQ027", porp, "Fechadura magnética com sensor");

  // Catraca
  add(acc, "EQ016", cat, "Catraca selecionada no bloco");
  if (cat > 0 && fac > 0) add(acc, "EQ012", fac, "Suporte facial para catraca");

  // PORP + PED + MOT → motor pedestre
  if (tipo === "PED" && porp > 0 && mot > 0) {
    add(acc, "EQ201", mot, "Motor de giro para porta pedestre");
  }

  // PORP + PR: sensor magnético por porta; módulo relé por porta SEM mola aérea
  // (com mola aérea o relé Arduino não é necessário — correção dos técnicos).
  if (porp > 0 && portariaPR) {
    add(acc, "EQ118", porp, "Sensor magnético mini (porta pedestre)");
    const porpSemMola = segmentos.filter((b) => b.tipo === "PORP" && !b.toks.has("MOL")).length;
    add(acc, "EQ213", porpSemMola, "Módulo relé (1 por porta sem mola aérea, Portaria Remota)");
  }

  // VEI + PR: 1 módulo relé por portão veicular (PORV)
  if (tipo === "VEI" && portariaPR) {
    add(acc, "EQ213", porv, "Módulo relé (1 por portão veicular, Portaria Remota)");
  }

  // PR + eclusa (2B): 1 relé adicional da eclusa (ex.: eclusa de 2 portões = 2 + 1 = 3)
  if (portariaPR && barreiras >= 2) {
    add(acc, "EQ213", 1, "Módulo relé adicional para eclusa (2B)");
  }

  // Eclusa (PED ou VEI, qualquer portaria): 1 Módulo de Intertravamento 2 Botões
  if (barreiras >= 2) {
    add(acc, "EQ005", 1, "Módulo de Intertravamento 2 Botões (1 por eclusa)");
  }

  // PR + portão veicular: Fechadura Magnética 300Kgf FE10300 — 1 por PORV,
  // exceto eclusa: 1 por eclusa mesmo com 2 PORV.
  if (portariaPR && porv > 0) {
    const fechaduras = barreiras >= 2 ? 1 : porv;
    add(acc, "EQ204", fechaduras, "Fechadura Magnética 300Kgf FE10300 (1 por portão; 1 por eclusa)");
  }

  // Elevador (Controle de Acesso de Pedestres — tipo de porta ELEV):
  //  • PCF (porta corta-fogo): 1 fechadura magnética c/ sensor + 1 botoeira analógica.
  //  • A cada 2 elevadores: 1 leitora facial + 1 interfone (IP Intercom em PR; XPE em PP).
  for (const b of segmentos) {
    if (b.tipo !== "ELEV") continue;
    const nEl = b.toks.has("4EL") ? 4 : b.toks.has("3EL") ? 3 : b.toks.has("2EL") ? 2 : 1;
    if (b.toks.has("PCF")) {
      add(acc, "EQ027", 1, "Fechadura magnética c/ sensor (porta corta-fogo)");
      add(acc, "EQ021", 1, "Botoeira analógica (porta corta-fogo)");
    }
    const kits = Math.ceil(nEl / 2);
    add(acc, "EQ011", kits, `Leitora facial (1 a cada 2 elevadores — ${nEl} elevador(es))`);
    if (portariaPR) {
      add(acc, "EQ017", kits, `Interfone IP Intercom PoE (1 a cada 2 elevadores, Portaria Remota)`);
    } else if (portariaPP) {
      add(acc, "EQ305", kits, `Interfone XPE (1 a cada 2 elevadores, Portaria Presencial)`);
    }
  }

  // Interfone IP + acrílico (Portaria Remota):
  //  • Pedestres (PED): 1 por barreira (mantido como estava).
  //  • Veicular (VEI): NÃO leva interfone, exceto eclusa com portão veicular e
  //    facial (PORV + 2B + FAC) → 1 interfone + 1 acrílico.
  if (portariaPR) {
    if (tipo === "PED") {
      add(acc, "EQ017", barreiras, `Interfone IP (Portaria Remota, ${barreiras}B)`);
      add(acc, "EQ033", barreiras, `Acrílico do interfone (${barreiras}B)`);
    } else if (tipo === "VEI" && porv > 0 && barreiras >= 2 && fac > 0) {
      add(acc, "EQ017", 1, "Interfone IP (PORV + eclusa + facial)");
      add(acc, "EQ033", 1, "Acrílico do interfone (PORV + eclusa + facial)");
    }
  }
  // Vídeo porteiro (Portaria Presencial):
  //  • Pedestres (PED): 1 por barreira que tenha FAC, DIG ou PORTAR.
  //  • Veicular (VEI): mesma regra do interfone PR — só PORV + eclusa (2B) + FAC → 1.
  if (portariaPP) {
    if (tipo === "PED") {
      const nBar = segmentos.filter(
        (b) => b.toks.has("FAC") || b.toks.has("DIG") || b.toks.has("PORTAR"),
      ).length;
      add(acc, "EQ019", nBar, "Vídeo porteiro (1 por barreira com FAC/DIG/Portaria)");
    } else if (tipo === "VEI" && porv > 0 && barreiras >= 2 && fac > 0) {
      add(acc, "EQ019", 1, "Vídeo porteiro (PORV + eclusa + facial)");
    }
  }

  // Motores veiculares por porte (basculante/deslizante)
  const MOTOR_SIZE: Record<string, string> = {
    "15M": "EQ038", "2M": "EQ039", "25M": "EQ040", "3M": "EQ041",
    "800KG": "EQ042", "1300KG": "EQ043", "1500KG": "EQ044",
  };
  for (const [tok, eq] of Object.entries(MOTOR_SIZE)) {
    if (tokens[tok]) add(acc, eq, tokens[tok], `Motor veicular ${tok}`);
  }

  // Motores pivotantes
  const has1F = !!tokens["1F"];
  const has2F = !!tokens["2F"];
  if (tokens.PIVO) {
    const size = tokens["200CM"] ? "200CM" : tokens["350CM"] ? "350CM" : tokens["450CM"] ? "450CM" : null;
    if (size) {
      if (has2F) {
        const pair: Record<string, [string, string]> = {
          "200CM": ["EQ048", "EQ051"],
          "350CM": ["EQ049", "EQ052"],
          "450CM": ["EQ050", "EQ053"],
        };
        add(acc, pair[size][0], 1, `Motor pivotante ${size} direita`);
        add(acc, pair[size][1], 1, `Motor pivotante ${size} esquerda`);
      } else if (has1F) {
        const solo: Record<string, string> = {
          "200CM": "EQ045",
          "350CM": "EQ046",
          "450CM": "EQ047",
        };
        add(acc, solo[size], 1, `Motor pivotante ${size} completo (1 folha)`);
      }
    }
  }

  return Array.from(acc.values());
}

// ─── CFTV ────────────────────────────────────────────────────────────────────
function computeCftv(input: ComputeInput): AutoBlockItem[] {
  const acc = new Map<string, AutoBlockItem>();
  const dome = Number(input.qtdDome ?? 0) || 0;
  const bullet = Number(input.qtdBullet ?? 0) || 0;
  const total = dome + bullet;
  if (total <= 0) return [];
  const isIp = (input.tecnologia ?? "").toUpperCase() === "IP";

  // Câmeras
  if (isIp) {
    add(acc, "EQ089", dome, "Câmera IP Dome G4");
    add(acc, "EQ300", bullet, "Câmera IP Bullet");
  } else {
    add(acc, "EQ078", dome, "Câmera analógica Dome");
    add(acc, "EQ077", bullet, "Câmera analógica Bullet");
  }

  // Gravadores por faixa
  type Grav = { eq: string; ch: 4 | 8 | 16 | 32; label: string };
  const GRAV_IP: Record<4 | 8 | 16 | 32, Grav> = {
    4:  { eq: "EQ301", ch: 4,  label: "NVR 4 canais" },
    8:  { eq: "EQ084", ch: 8,  label: "NVR 8 canais" },
    16: { eq: "EQ085", ch: 16, label: "NVR 16 canais" },
    32: { eq: "EQ086", ch: 32, label: "NVR 32 canais" },
  };
  const GRAV_AN: Record<4 | 8 | 16 | 32, Grav> = {
    4:  { eq: "EQ069", ch: 4,  label: "DVR 4 canais" },
    8:  { eq: "EQ068", ch: 8,  label: "DVR 8 canais" },
    16: { eq: "EQ067", ch: 16, label: "DVR 16 canais" },
    32: { eq: "EQ066", ch: 32, label: "DVR 32 canais" },
  };
  const G = isIp ? GRAV_IP : GRAV_AN;

  const gravadores: Grav[] = [];
  if (total <= 4)       gravadores.push(G[4]);
  else if (total <= 8)  gravadores.push(G[8]);
  else if (total <= 16) gravadores.push(G[16]);
  else if (total <= 32) gravadores.push(G[32]);
  else if (total <= 36) { gravadores.push(G[32], G[4]); }
  else if (total <= 40) { gravadores.push(G[32], G[8]); }
  else if (total <= 48) { gravadores.push(G[32], G[16]); }
  else if (total <= 64) { gravadores.push(G[32], G[32]); }
  else {
    // Acima de 64: n × 32ch
    const n = ceil(total, 32);
    for (let i = 0; i < n; i++) gravadores.push(G[32]);
  }

  // HD por gravador
  const HD_POR_CH: Record<number, string> = { 4: "EQ097", 8: "EQ096", 16: "EQ096", 32: "EQ095" };
  for (const g of gravadores) {
    add(acc, g.eq, 1, g.label);
    add(acc, HD_POR_CH[g.ch], 1, `HD para ${g.label}`);
  }

  // Acessórios
  if (!isIp) add(acc, "EQ073", total, "Balun passivo (analógico)");
  add(acc, "EQ098", total, "Caixa plástica organizadora");

  // Cabeamento: 1 caixa de cabo de rede (300 m) a cada 300 m somados das câmeras
  const cams = input.cftvCameras ?? [];
  const totalMetros = cams.reduce((s, c) => s + (Number(c.metros) || 0), 0);
  add(acc, "EQ302", ceil(totalMetros, 300), `Cabo de rede CAT5-E — caixa 300 m (total ${totalMetros} m)`);

  // I.A por câmera → serviços mensais (SV) — qtd = nº de câmeras com a I.A marcada
  for (const [ia, sv] of Object.entries(CFTV_IA_SERVICOS)) {
    const n = cams.filter((c) => (c.ia ?? []).includes(ia)).length;
    add(acc, sv, n, `I.A — ${ia} (mensal, por câmera)`);
  }

  return Array.from(acc.values());
}

// ─── Cerca Elétrica ──────────────────────────────────────────────────────────
function computeCerca(input: ComputeInput): AutoBlockItem[] {
  const acc = new Map<string, AutoBlockItem>();
  const perim = Number(input.perimetro ?? 0) || 0;
  const esq = Number(input.esquinas ?? 0) || 0;
  if (perim <= 0) return [];

  add(acc, "EQ146", ceil(perim, 3), "Haste industrial a cada 3 m");
  add(acc, "EQ147", ceil(perim, 3), "Sapata por haste");
  add(acc, "EQ150", ceil(perim, 25), "Fio inox 0,90 mm — rolo a cada 25 m");
  add(acc, "EQ153", ceil(perim, 6), "Placa de aviso a cada 6 m");
  add(acc, "EQ148", esq, "Haste cantoneira por esquina");

  // Eletrificador
  let nEnerg = 0;
  if (perim <= 400)         { add(acc, "EQ141", 1, "Eletrificador ELC 5001 (≤400m)"); nEnerg = 1; }
  else if (perim <= 1250)   { add(acc, "EQ142", 1, "Eletrificador ELC 5002 (≤1250m)"); nEnerg = 1; }
  else if (perim <= 1750)   { add(acc, "EQ143", 1, "Eletrificador ELC 5003 (≤1750m)"); nEnerg = 1; }
  else {
    nEnerg = ceil(perim, 1750);
    add(acc, "EQ143", nEnerg, "Eletrificadores ELC 5003 (>1750m)");
  }

  add(acc, "EQ154", nEnerg, "Bateria 12v 7A por eletrificador");
  add(acc, "EQ155", nEnerg, "Haste de aterramento por eletrificador");
  add(acc, "EQ156", nEnerg, "Conector de aterramento por eletrificador");
  add(acc, "EQ157", nEnerg * 2, "Caixas de aterramento (2 por eletrificador)");

  return Array.from(acc.values());
}

// ─── Elevadores ──────────────────────────────────────────────────────────────
// Kit Antena por elevador (correções dos técnicos 2026-07-17): switch TP-LINK
// TL-SF1005D no lugar do SF 500 HI-POE, sem roteador Wi-Fi (inclusão manual se
// necessário), com Fonte Nobreak EFB 1201 + Bateria 12V 7Ah, câmera VIP 1230D G4.
function computeElevadorFromCodigo(codigo: string): AutoBlockItem[] {
  const kits = Number(codigo.match(/ELV-(\d+)KIT/i)?.[1] ?? 1) || 1;
  return [
    { cod_eq: "EQ307", qtd: kits,     observacao: "Switch 4P TL-SF1005D — 1× por Kit Antena" },
    { cod_eq: "EQ167", qtd: kits,     observacao: "Antena Wom 5a — 1× por Kit Antena" },
    { cod_eq: "EQ170", qtd: kits * 2, observacao: "Suporte 40cm — 2× por Kit Antena" },
    { cod_eq: "EQ169", qtd: kits,     observacao: "Telefone TDMI 400 — 1× por Kit Antena" },
    { cod_eq: "EQ089", qtd: kits,     observacao: "Câmera IP Dome VIP 1230D G4 — 1× por Kit Antena" },
    { cod_eq: "EQ171", qtd: kits,     observacao: "Filtro de linha 5 tomadas — 1× por Kit Antena" },
    { cod_eq: "EQ179", qtd: kits,     observacao: "Fonte Nobreak EFB 1201 — 1× por Kit Antena" },
    { cod_eq: "EQ154", qtd: kits,     observacao: "Bateria 12V 7Ah — 1× por Kit Antena" },
  ];
}

// ─── Totem Inteligente ───────────────────────────────────────────────────────
function computeTotemFromCodigo(codigo: string): AutoBlockItem[] {
  const match = codigo.match(/TOT-(\d+)x(\d+)CAM/i);
  const nTotens = Number(match?.[1] ?? 1) || 1;
  const cameras = Number(match?.[2] ?? nTotens * 3) || nTotens * 3;
  return [
    { cod_eq: "EQ197", qtd: nTotens, observacao: "Switch 8P — 1× por Totem" },
    { cod_eq: "EQ174", qtd: nTotens, observacao: "Fonte 12v 5A — 1× por Totem" },
    { cod_eq: "EQ303", qtd: nTotens, observacao: "Poste 2,6 m — 1× por Totem" },
    { cod_eq: "EQ300", qtd: cameras, observacao: "Câmera IP Bullet — total de câmeras dos totens" },
  ];
}

// ─── Central de Portaria Remota (CENT-PR) ────────────────────────────────────
function computeCentral(): AutoBlockItem[] {
  return [
    { cod_eq: "EQ001", qtd: 1, observacao: "Roteador Firewall — DrayTek Vigor 2915" },
    { cod_eq: "EQ002", qtd: 1, observacao: "ATA PABX — Grandstream HT813" },
    { cod_eq: "EQ189", qtd: 1, observacao: "Rack Armário 12U" },
    { cod_eq: "EQ190", qtd: 2, observacao: "Rack Bandeja (2 unidades)" },
    { cod_eq: "EQ191", qtd: 1, observacao: "Calha 8 Tomadas para Rack" },
    { cod_eq: "EQ192", qtd: 1, observacao: "Caixa Comando Portaria Remota 80x60" },
    { cod_eq: "EQ193", qtd: 1, observacao: "Caixa Rack para Relês" },
    { cod_eq: "EQ099", qtd: 1, observacao: "Central de Alarme AMT 4010" },
    { cod_eq: "EQ100", qtd: 1, observacao: "Sirene 12v" },
    { cod_eq: "EQ102", qtd: 1, observacao: "Módulo GPRS XEG 4000" },
    { cod_eq: "EQ103", qtd: 4, observacao: "Expansor de PGM XEP 4004 (4 un)" },
    { cod_eq: "EQ023", qtd: 1, observacao: "Botão de Emergência" },
    { cod_eq: "EQ024", qtd: 1, observacao: "GiroFlex 12v" },
  ];
}

export function computeAutoItemsForBloco(input: ComputeInput): AutoBlockItem[] {
  if (input.tipoBloco === "PED" || input.tipoBloco === "VEI") return computeAcesso(input);
  if (input.tipoBloco === "CFTV") return computeCftv(input);
  if (input.tipoBloco === "CER") return computeCerca(input);
  if (input.tipoBloco === "ELV") return computeElevadorFromCodigo(input.codigo);
  if (input.tipoBloco === "TOT") return computeTotemFromCodigo(input.codigo);
  if ((input.tipoBloco as string) === "CENT") return computeCentral();
  return [];
}

export function computeAutoItemsFromConfig(config: BlocoConfig): AutoBlockItem[] {
  return computeAutoItemsForBloco({
    codigo: gerarCodigoBloco(config),
    tipoBloco: config.tipoBloco,
    tecnologia: config.tecnologia,
    qtdDome: config.qtdDome,
    qtdBullet: config.qtdBullet,
    cftvCameras: config.cftvCameras,
    perimetro: config.perimetro,
    esquinas: config.esquinas,
  });
}
