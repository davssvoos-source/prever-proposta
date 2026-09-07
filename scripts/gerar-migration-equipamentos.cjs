#!/usr/bin/env node
// Gera a migration dos equipamentos do QAP (U110) a partir do retrato cru.
//
//   node scripts/gerar-migration-equipamentos.cjs
//
// ENTRADA (as duas em docs/importacao/):
//   · qap-equipamentos.json — o retrato CRU da tela Patrimônio > Local/Uso do
//     QAP, uma linha por item, como foi lido. É a fonte da verdade: a migration
//     é DERIVADA dele, e refazer a derivação é rodar este script de novo.
//   · base-para-casar.json  — { clientes: [{id, nome, nome_predio}],
//     pessoas: [{id, nome}] }, o retrato da nossa base no momento da
//     importação. Sem ele o script aborta: casar local sem a base produziria
//     4.241 itens sem vínculo.
//
// SAÍDA:
//   · supabase/migrations/<data>_u110_equipamentos_do_qap.sql — idempotente,
//     com conferência e DESFAZER, no modelo da casa (.claude/skills/banco).
//   · docs/importacao/locais-desconhecidos.md — a relação que o Davi pediu
//     (item 3): os locais do QAP que não existem na nossa base.
//
// POR QUE UM GERADOR, E NÃO SQL ESCRITO À MÃO: as decisões (variação, vínculo,
// chave de importação) são as do módulo puro `src/features/equipamentos/
// importacao.ts`, que tem asserção em cima. Escrever 4.241 INSERTs à mão seria
// reimplementar essas decisões no SQL, onde nada as testa.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require(path.resolve('node_modules/typescript'));

// o mesmo carregador do verificador — resolve os apelidos "@/" e transpila TS
const cache = {};
function carregar(rel) {
  const arq = path.resolve(rel);
  if (cache[arq]) return cache[arq];
  const js = ts.transpileModule(fs.readFileSync(arq, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = new Module(arq); m.filename = arq; m.paths = Module._nodeModulePaths(path.dirname(arq));
  const req = (spec) => {
    if (spec.endsWith('integrations/supabase/client')) return { supabase: {} };
    if (spec === 'react' || spec === '@tanstack/react-query') return new Proxy({}, { get: () => () => undefined });
    return spec.startsWith('./') || spec.startsWith('@/')
      ? carregar(spec.startsWith('@/') ? 'src/' + spec.slice(2) + '.ts' : path.join(path.dirname(rel), spec) + '.ts')
      : require(spec);
  };
  m.exports = {}; cache[arq] = m.exports;
  new Function('exports', 'require', 'module', '__filename', '__dirname', js)(m.exports, req, m, arq, path.dirname(arq));
  cache[arq] = m.exports; return m.exports;
}

const IMP = carregar('src/features/equipamentos/importacao.ts');

const ARQ_QAP = 'docs/importacao/qap-equipamentos.json';
const ARQ_BASE = 'docs/importacao/base-para-casar.json';
for (const a of [ARQ_QAP, ARQ_BASE]) {
  if (!fs.existsSync(a)) {
    console.error(`ABORTA: falta ${a}. Rode a extração do QAP antes (Claude in Chrome > Patrimônio > Local/Uso).`);
    process.exit(1);
  }
}

const linhas = JSON.parse(fs.readFileSync(ARQ_QAP, 'utf8'));
const base = JSON.parse(fs.readFileSync(ARQ_BASE, 'utf8'));
if (!Array.isArray(linhas) || linhas.length === 0) { console.error('ABORTA: o retrato do QAP está vazio'); process.exit(1); }
if (!Array.isArray(base.clientes) || base.clientes.length === 0) { console.error('ABORTA: a base de clientes está vazia'); process.exit(1); }

const r = IMP.prepararImportacao(linhas, base.clientes, base.pessoas ?? []);

// ── SQL ──────────────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const hoje = new Date();
const stamp = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
const destino = `supabase/migrations/${stamp}090000_u110_equipamentos_do_qap.sql`;

const linhasCatalogo = r.catalogo.map((v) =>
  `  (${q(v.almoxarifado)}, ${q(v.nome)}, ${q(v.modelo)}, ${q(v.fabricante)}, ${q(v.chave)})`).join(',\n');

const linhasItens = r.itens.map((i) =>
  `  (${q(i.chaveVariacao)}, ${q(i.identificacao)}, ${q(i.localQap)}, ${q(i.clienteId)}, ${q(i.pessoaId)}, ` +
  `${i.enviadoEm ? `${q(i.enviadoEm)}::date` : 'NULL'}, ${q(i.chaveImportacao)})`).join(',\n');

const sql = `-- ═══════════════════════════════════════════════════════════════════════════
-- U110 — OS EQUIPAMENTOS DO QAP ENTRAM NO SISTEMA (R196–R199)
--        ${r.totais.variacoes} variações no catálogo · ${r.totais.linhas} itens de patrimônio
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: DEPOIS da U109 (as tabelas). O pré-voo abaixo aborta sem ela.
-- >>> GERADA por scripts/gerar-migration-equipamentos.cjs a partir de
-- >>>   docs/importacao/qap-equipamentos.json (o retrato cru do QAP).
-- >>>   NÃO EDITAR À MÃO: corrija o retrato ou o módulo de importação
-- >>>   (src/features/equipamentos/importacao.ts) e gere de novo.
--
-- O QUE ENTRA (R196 — os sete campos que o Davi mandou usar):
--   almoxarifado · nome (o "Tipo de Categoria" do QAP) · modelo · fabricante
--   · identificação · local/pessoa · data de envio
-- A "Categoria" do QAP e a contagem de passagens ficaram de fora, por
-- decisão dele.
--
-- OS NÚMEROS DESTE RETRATO:
--   itens ................................. ${String(r.totais.linhas).padStart(6)}
--   variações de catálogo ................. ${String(r.totais.variacoes).padStart(6)}
--   com cliente da nossa base ............. ${String(r.totais.comCliente).padStart(6)}
--   com pessoa nossa ...................... ${String(r.totais.comPessoa).padStart(6)}
--   sem vínculo (local desconhecido) ...... ${String(r.totais.semVinculo).padStart(6)}
--   sem identificação (R197) .............. ${String(r.totais.semIdentificacao).padStart(6)}
--   datas ilegíveis (entram nulas) ........ ${String(r.datasIlegiveis).padStart(6)}
--   identificações repetidas no QAP ....... ${String(r.identificacoesRepetidas.length).padStart(6)}
--
-- A relação dos locais desconhecidos está em docs/importacao/locais-desconhecidos.md.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pré-voo: a U109 tem de ter rodado ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'catalogo_equipamentos') THEN
    RAISE EXCEPTION 'U110: rode a U109 antes — public.catalogo_equipamentos nao existe';
  END IF;
END $$;

-- ── 1) o catálogo: uma linha por variação (R198) ───────────────────────────
INSERT INTO public.catalogo_equipamentos (almoxarifado, nome, modelo, fabricante, chave) VALUES
${linhasCatalogo}
ON CONFLICT (chave) DO NOTHING;

-- ── 2) os itens físicos, ligados à variação pela chave (R196) ──────────────
-- A chave_importacao é única: reimportar o mesmo retrato não duplica nada, e
-- itens iguais sem identificação não colapsam (o ordinal cuida disso).
WITH entrada (chave_variacao, identificacao, local_qap, cliente_id, pessoa_id, enviado_em, chave_importacao) AS (
  VALUES
${linhasItens}
)
INSERT INTO public.equipamentos_patrimonio
       (catalogo_id, identificacao, local_qap, cliente_id, pessoa_id, enviado_em, chave_importacao, origem)
SELECT c.id, e.identificacao, e.local_qap, e.cliente_id::uuid, e.pessoa_id::uuid, e.enviado_em, e.chave_importacao, 'qap'
  FROM entrada e
  JOIN public.catalogo_equipamentos c ON c.chave = e.chave_variacao
ON CONFLICT (chave_importacao) DO NOTHING;

-- ── Verificação ────────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'variações no catálogo' AS o_que,
         (SELECT count(*)::text FROM public.catalogo_equipamentos) AS obtido,
         '${r.totais.variacoes}' AS esperado
  UNION ALL
  SELECT 2, 'itens de patrimônio',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio), '${r.totais.linhas}'
  UNION ALL
  SELECT 3, 'itens com cliente vinculado',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio WHERE cliente_id IS NOT NULL), '${r.totais.comCliente}'
  UNION ALL
  SELECT 4, 'itens com pessoa',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio WHERE pessoa_id IS NOT NULL), '${r.totais.comPessoa}'
  UNION ALL
  SELECT 5, 'itens sem vínculo (local desconhecido)',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio
           WHERE cliente_id IS NULL AND pessoa_id IS NULL), '${r.totais.semVinculo}'
  UNION ALL
  SELECT 6, 'nenhum item ficou sem variação (o JOIN pegou todos)',
         (SELECT CASE WHEN count(*) = ${r.totais.linhas} THEN 'sim' ELSE 'NAO' END
            FROM public.equipamentos_patrimonio p JOIN public.catalogo_equipamentos c ON c.id = p.catalogo_id), 'sim'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ── DESFAZER ───────────────────────────────────────────────────────────────
-- ║ Apaga SÓ o que esta importação trouxe (as linhas de origem 'qap'):
-- ║   BEGIN;
-- ║     DELETE FROM public.equipamentos_patrimonio WHERE origem = 'qap';
-- ║     DELETE FROM public.catalogo_equipamentos   WHERE origem = 'qap';
-- ║   COMMIT;
-- ║ O catálogo só apaga depois dos itens: a FK é RESTRICT de propósito, para
-- ║ ninguém apagar uma variação e deixar item órfão.
`;

fs.mkdirSync('supabase/migrations', { recursive: true });
fs.writeFileSync(destino, sql);

// ── o relatório dos locais desconhecidos (item 3 do Davi) ────────────────────
const md = `# Locais do QAP que não estão na nossa base

Gerado por \`scripts/gerar-migration-equipamentos.cjs\` a partir de
\`docs/importacao/qap-equipamentos.json\`. R199: o equipamento entra com o
texto do QAP guardado e SEM vínculo — ninguém adivinha o prédio.

| Local no QAP | Itens | Parecidos na nossa base |
|---|---:|---|
${r.desconhecidos.map((d) => `| ${d.local} | ${d.quantidade} | ${d.sugestoes.join(' · ') || '—'} |`).join('\n')}

**Total:** ${r.desconhecidos.length} locais, ${r.desconhecidos.reduce((t, d) => t + d.quantidade, 0)} itens sem vínculo.

${r.identificacoesRepetidas.length > 0 ? `## Identificações repetidas no QAP

O mesmo número em mais de um item. Entram assim mesmo (travar aqui faria a
importação inteira falhar por um número digitado duas vezes).

| Identificação | Itens |
|---|---:|
${r.identificacoesRepetidas.map((i) => `| ${i.identificacao} | ${i.quantidade} |`).join('\n')}
` : ''}`;

fs.mkdirSync('docs/importacao', { recursive: true });
fs.writeFileSync('docs/importacao/locais-desconhecidos.md', md);

console.log(`U110 gerada: ${destino}`);
console.log(`  ${r.totais.linhas} itens · ${r.totais.variacoes} variações · ${r.totais.comCliente} com cliente · ` +
  `${r.totais.comPessoa} com pessoa · ${r.totais.semVinculo} sem vínculo`);
console.log(`  ${r.desconhecidos.length} locais desconhecidos → docs/importacao/locais-desconhecidos.md`);
if (r.qapIdsRepetidos.length) console.log(`  ATENÇÃO: ${r.qapIdsRepetidos.length} ids do QAP repetidos`);
