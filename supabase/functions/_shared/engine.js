// engine.js — Motor de cálculo do BOM (Grupo Prever) — ESM puro, sem dependências.
// Fonte canônica: roda em Node (testes) e em Deno (Edge Function calcular).
// Espelha calcular_projeto.py.
//
// Correção de eclusa: regras COMPOSTAS cujos tokens são todos "de portão"
// (siglas locais) são avaliadas POR PORTÃO — evita contaminação cruzada quando
// uma eclusa tem 2 pivotantes com folhas diferentes (1F + 2F).

export const KNOWN_SIGLAS = new Set([
  'PED','VEI','CAT','PORP','CAN','PORV','FAC','DIG','CTRL','TAG','LAC','FOT','LPR',
  'BOTANA','BOTAPR','PORTAR','MOT','MOL','NAD','BASC','PIVO','DESL','PP','PR',
  'CENT','CFTV','AL','CER','1F','2F','200CM','350CM','450CM','800KG','1300KG',
  '1500KG','15M','2M','25M','3M',
]);

const BARR = new Set(['1B','2B','3B']);
const PROJ = new Set(['PP','PR']);
const GATE_LEADERS = new Set(['PORV','CAN','PORP','CAT']);
const RELAY_IDS = new Set(['R07','R08','R09']);

// ── parse do código em portões (gates) + contador global ──────────────────────
export function parseGates(codigo) {
  const parts = String(codigo).toUpperCase().split('-');
  const tipo = parts[0];
  let barreiras = null, portaria = null;
  const whole = {};
  const gates = [];
  let cur = null;

  for (const p of parts.slice(1)) {
    if (BARR.has(p)) { barreiras = p; continue; }
    if (!KNOWN_SIGLAS.has(p)) continue;
    whole[p] = (whole[p] || 0) + 1;
    if (PROJ.has(p)) { portaria = p; continue; }
    if (GATE_LEADERS.has(p)) { cur = {}; gates.push(cur); cur[p] = 1; }
    else if (cur) cur[p] = (cur[p] || 0) + 1;
  }
  if (gates.length === 0) gates.push(whole);
  return { tipo, barreiras, portaria, gates, whole };
}

function tokenSatWhole(t, ctx) {
  if (BARR.has(t)) return ctx.barreiras === t;
  return (ctx.whole[t] || 0) >= 1;
}
function isGlobalToken(t, tipo) {
  return BARR.has(t) || PROJ.has(t) || t === tipo;
}

export function computeBlocoItens(codigo, regrasBlocos, blocoQty = 1) {
  const ctx = parseGates(codigo);
  const acc = {};
  const relay = {};

  for (const r of regrasBlocos) {
    if (r.escopo !== 'POR_BLOCO') continue;
    const cond = String(r.condicao || '');
    if (/TAG/i.test(cond) && /4/.test(cond)) continue;
    const tokens = cond.split('+').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (tokens.length === 0) continue;

    let mult = 0;
    if (tokens.length === 1) {
      const t = tokens[0];
      mult = isGlobalToken(t, ctx.tipo) ? (tokenSatWhole(t, ctx) ? 1 : 0)
                                        : (ctx.whole[t] || 0);
    } else if (tokens.some(t => isGlobalToken(t, ctx.tipo))) {
      mult = tokens.every(t => tokenSatWhole(t, ctx)) ? 1 : 0;
    } else {
      for (const gate of ctx.gates)
        if (tokens.every(t => (gate[t] || 0) >= 1)) mult += 1;
    }
    if (mult <= 0) continue;

    const total = (r.qtd || 0) * mult * blocoQty;
    const bucket = RELAY_IDS.has(r.regra_id) ? relay : acc;
    bucket[r.cod_eq] = (bucket[r.cod_eq] || 0) + total;
  }
  for (const [k, v] of Object.entries(relay)) acc[k] = (acc[k] || 0) + v;
  return acc;
}

export function computeCftvItens(tech, nDome, nBullet, regrasCftv, blocoQty = 1) {
  tech = String(tech || '').toUpperCase();
  nDome = parseInt(nDome) || 0; nBullet = parseInt(nBullet) || 0;
  const total = nDome + nBullet;
  const acc = {};
  if (!['IP', 'ANAL'].includes(tech) || total <= 0) return acc;
  const add = (eq, q) => { if (eq && q) acc[eq] = (acc[eq] || 0) + q * blocoQty; };

  const cam = (tp) => {
    const r = regrasCftv.find(x => x.tipo === 'CAMERA' && x.chave1 === tech && x.chave2 === tp);
    return r ? r.cod_eq : null;
  };
  add(cam('DOM'), nDome);
  add(cam('BUL'), nBullet);

  const grav = regrasCftv.find(x => x.tipo === 'GRAVADOR' && x.chave1 === tech &&
    parseInt(x.chave2) <= total && total <= parseInt(x.chave3));
  const units = [];
  if (grav) {
    units.push([grav.cod_eq, grav.qtd || 1]);
    if (grav.cod_eq2) units.push([grav.cod_eq2, grav.qtd2 || 1]);
  }
  for (const [eq, q] of units) {
    add(eq, q);
    const hd = regrasCftv.find(x => x.tipo === 'HD' && x.chave1 === eq);
    if (hd) add(hd.cod_eq, (hd.qtd || 1) * q);
  }
  for (const a of regrasCftv.filter(x => x.tipo === 'ACESSORIO'))
    if (a.chave1 === 'SEMPRE' || a.chave1 === tech) add(a.cod_eq, (a.qtd || 1) * total);

  return acc;
}

// ── Cerca Elétrica ──────────────────────────────────────────────────────────
// Entrada: perímetro (m) e nº de esquinas.
// `regrasCerca` é um mapa sigla→cod_eq populado a partir da tabela regras_cerca.
// Siglas esperadas:
//   ELC1, ELC2, ELC3            → eletrificador (até 400m / 401-1250 / 1251-1750; >1750 usa múltiplos ELC3)
//   HASTE_IND, SAPATA           → ⌈P/3⌉ cada
//   FIO                         → ⌈P/25⌉
//   PLACA                       → ⌈P/6⌉
//   CANTONEIRA                  → E (uma por esquina)
//   BATERIA, HASTE_ATER,
//   CONECTOR                    → 1 × nº de eletrificadores
//   CAIXA_ATER                  → 2 × nº de eletrificadores
export function computeCercaItens(perimetro, esquinas, regrasCerca, blocoQty = 1) {
  const P = Math.max(0, parseInt(perimetro) || 0);
  const E = Math.max(0, parseInt(esquinas) || 0);
  const acc = {};
  if (P <= 0) return acc;
  const map = regrasCerca || {};
  const add = (sigla, q) => {
    const eq = map[sigla];
    if (!eq || !q) return;
    acc[eq] = (acc[eq] || 0) + q * blocoQty;
  };

  // Eletrificador: escolhe o menor que cobre; acima de 1750 soma unidades de ELC3
  let elcSigla = null, elcQtd = 0;
  if (P <= 400)        { elcSigla = 'ELC1'; elcQtd = 1; }
  else if (P <= 1250)  { elcSigla = 'ELC2'; elcQtd = 1; }
  else if (P <= 1750)  { elcSigla = 'ELC3'; elcQtd = 1; }
  else                 { elcSigla = 'ELC3'; elcQtd = Math.ceil(P / 1750); }
  add(elcSigla, elcQtd);

  add('HASTE_IND', Math.ceil(P / 3));
  add('SAPATA',    Math.ceil(P / 3));
  add('FIO',       Math.ceil(P / 25));
  add('PLACA',     Math.ceil(P / 6));
  add('CANTONEIRA', E);

  add('BATERIA',    elcQtd);
  add('HASTE_ATER', elcQtd);
  add('CONECTOR',   elcQtd);
  add('CAIXA_ATER', 2 * elcQtd);

  return acc;
}

export function projectFlags(blocos) {
  const f = { has_pr: false, has_pp: false, has_vei: false, total_tag: 0 };
  for (const { codigo, qtd = 1 } of blocos) {
    const { whole } = parseGates(codigo);
    if (whole.PR) f.has_pr = true;
    if (whole.PP) f.has_pp = true;
    if (whole.VEI) f.has_vei = true;
    if (whole.TAG) f.total_tag += whole.TAG * qtd;
  }
  return f;
}

export function flagsComPortaria(blocos, portaria) {
  const f = projectFlags(blocos || []);
  if (portaria === 'PR') { f.has_pr = true; f.has_pp = false; }
  else if (portaria === 'PP') { f.has_pp = true; f.has_pr = false; }
  return f;
}

export function applyProjeto(bom, regrasBlocos, flags) {
  for (const r of regrasBlocos) {
    if (r.escopo !== 'POR_PROJETO') continue;
    const cond = String(r.condicao || '').toUpperCase().replace(/\s/g, '');
    if (cond.includes('TAG') && cond.includes('4')) {
      if (flags.total_tag > 0) bom[r.cod_eq] = (bom[r.cod_eq] || 0) + Math.ceil(flags.total_tag / 4);
    } else if (cond === 'PROJETO_PR') { if (flags.has_pr) bom[r.cod_eq] = (bom[r.cod_eq] || 0) + r.qtd; }
    else if (cond === 'PROJETO_PP') { if (flags.has_pp) bom[r.cod_eq] = (bom[r.cod_eq] || 0) + r.qtd; }
    else if (cond === 'PROJETO_PR+VEI' || cond === 'PROJETO_PRVEI') {
      if (flags.has_pr && flags.has_vei) bom[r.cod_eq] = (bom[r.cod_eq] || 0) + r.qtd;
    }
  }
  return bom;
}

export function computeProjeto({ blocos = [], cftv = [], cerca = [], itensPorBloco = null, portaria = null }, regras) {
  const { regras_blocos, regras_cftv, regras_cerca = {} } = regras;
  const bom = {};
  const addAll = (obj) => { for (const [k, v] of Object.entries(obj)) bom[k] = (bom[k] || 0) + v; };

  blocos.forEach((b, idx) => {
    if (itensPorBloco && itensPorBloco[idx]) addAll(itensPorBloco[idx]);
    else addAll(computeBlocoItens(b.codigo, regras_blocos, b.qtd || 1));
  });
  for (const c of cftv)
    addAll(computeCftvItens(c.tech, c.nDome, c.nBullet, regras_cftv, c.qtd || 1));
  for (const c of cerca)
    addAll(computeCercaItens(c.perimetro, c.esquinas, regras_cerca, c.qtd || 1));

  applyProjeto(bom, regras_blocos, flagsComPortaria(blocos, portaria));
  return bom;
}

export function computeBomFromItens(itens, blocos, regras, portaria = null) {
  const bom = {};
  for (const it of (itens || [])) {
    if (it && it.cod_eq && !it.removido)
      bom[it.cod_eq] = (bom[it.cod_eq] || 0) + (Number(it.qtd) || 0);
  }
  applyProjeto(bom, regras.regras_blocos, flagsComPortaria(blocos, portaria));
  return bom;
}

export function validarPortaria(blocos) {
  const f = projectFlags(blocos || []);
  if (f.has_pr && f.has_pp)
    return { ok: false, aviso: 'Projeto tem blocos PR e PP simultaneamente — não permitido. Defina o SISTEMA PROPOSTO (PR ou PP) uma vez para todo o projeto.' };
  return { ok: true };
}

export function enrich(bomObj, equipamentos) {
  return Object.entries(bomObj).map(([cod_eq, qtd]) => {
    const e = equipamentos[cod_eq] || {};
    return {
      cod_eq, qtd,
      nome: e.nome || '', marca: e.marca || '', modelo: e.modelo || '',
      preco: e.preco || 0, custo: e.custo || 0,
      total_preco: +( (e.preco || 0) * qtd ).toFixed(2),
    };
  }).sort((a, b) => a.cod_eq.localeCompare(b.cod_eq));
}
