// supabase/functions/calcular/index.ts — Edge Function do BOM (Grupo Prever)
//
// Ações (POST JSON):
//   { action: "itens_bloco", codigo }                      → lista auto de um bloco de acesso
//   { action: "itens_bloco", tipo:"CFTV", tech, nDome, nBullet } → lista auto de um bloco CFTV
//   { action: "bom_projeto", blocos:[{codigo,qtd}], cftv:[{tech,nDome,nBullet,qtd}], itensPorBloco }
//   { action: "bom_projeto", visita_id }                   → lê do banco (best-effort)
//
// As regras vêm de regras_blocos / regras_cftv e os preços de equipamentos.
// Deploy:  supabase functions deploy calcular
//
// deno-lint-ignore-file no-explicit-any
import {
  computeBlocoItens, computeCftvItens, computeProjeto, enrich,
} from "../_shared/engine.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
            Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function tbl(path: string): Promise<any[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function loadRegras() {
  const [rb, rc, eqRows] = await Promise.all([
    tbl("regras_blocos?select=*"),
    tbl("regras_cftv?select=*"),
    tbl("equipamentos?select=code,nome,marca,modelo,custo,markup"),
  ]);
  const equipamentos: Record<string, any> = {};
  for (const e of eqRows) {
    const custo = Number(e.custo) || 0;
    const markup = Number(e.markup) || 1.389;
    equipamentos[e.code] = {
      nome: e.nome, marca: e.marca, modelo: e.modelo,
      custo, preco: +(custo * markup).toFixed(2),
    };
  }
  return { regras_blocos: rb, regras_cftv: rc, equipamentos };
}

// Lê uma visita do banco (best-effort: nomes de coluna com fallback)
async function loadVisita(visita_id: string) {
  const rows = await tbl(`visita_blocos?visita_id=eq.${visita_id}&select=*`);
  const blocos: any[] = [], cftv: any[] = [], ids: string[] = [];
  for (const r of rows) {
    const tipo = String(r.tipo ?? "").toUpperCase();
    const qtd = Number(r.quantidade ?? r.qtd ?? 1) || 1;
    if (tipo === "CFTV") {
      cftv.push({
        tech: String(r.tecnologia ?? r.tech ?? "").toUpperCase(),
        nDome: Number(r.qtd_dome ?? 0), nBullet: Number(r.qtd_bullet ?? 0), qtd,
      });
    } else if (r.codigo) {
      blocos.push({ codigo: r.codigo, qtd, id: r.id });
      if (r.id) ids.push(r.id);
    }
  }
  // itens editados (se a tabela existir)
  let itensPorBloco: Record<number, Record<string, number>> | null = null;
  if (ids.length) {
    try {
      const it = await tbl(
        `visita_bloco_itens?visita_bloco_id=in.(${ids.join(",")})&removido=eq.false&select=visita_bloco_id,cod_eq,qtd`,
      );
      if (it.length) {
        itensPorBloco = {};
        blocos.forEach((b, idx) => {
          const rowsFor = it.filter((x) => x.visita_bloco_id === b.id);
          if (rowsFor.length) {
            itensPorBloco![idx] = {};
            for (const x of rowsFor)
              itensPorBloco![idx][x.cod_eq] = (itensPorBloco![idx][x.cod_eq] || 0) + Number(x.qtd || 0);
          }
        });
      }
    } catch (_) { /* tabela ainda não criada — usa auto */ }
  }
  return { blocos, cftv, itensPorBloco };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const regras = await loadRegras();

    if (body.action === "itens_bloco") {
      const bom = (String(body.tipo).toUpperCase() === "CFTV" || body.tech)
        ? computeCftvItens(body.tech, body.nDome, body.nBullet, regras.regras_cftv, body.qtd ?? 1)
        : computeBlocoItens(body.codigo, regras.regras_blocos, body.qtd ?? 1);
      return json({ itens: enrich(bom, regras.equipamentos) });
    }

    if (body.action === "bom_projeto") {
      const payload = (body.blocos || body.cftv)
        ? { blocos: body.blocos ?? [], cftv: body.cftv ?? [], itensPorBloco: body.itensPorBloco ?? null }
        : await loadVisita(body.visita_id);
      const bom = computeProjeto(payload, regras);
      const itens = enrich(bom, regras.equipamentos);
      const total_preco = +itens.reduce((s: number, i: any) => s + i.total_preco, 0).toFixed(2);
      return json({ itens, total_preco });
    }

    return json({ error: "ação inválida (use itens_bloco | bom_projeto)" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
