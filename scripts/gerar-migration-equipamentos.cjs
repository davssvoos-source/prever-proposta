#!/usr/bin/env node
// Gera a migration dos equipamentos do QAP (U110) a partir do retrato cru.
//
//   node scripts/gerar-migration-equipamentos.cjs
//
// ENTRADA (em docs/importacao/):
//   · qap-equipamentos.json — o retrato CRU da tela Patrimônio > Local/Uso do
//     QAP: uma linha por item, oito campos, como foram lidos. É a FONTE DA
//     VERDADE; a migration é derivada dele, e refazer a derivação é rodar
//     este script de novo.
//   · nomes-da-base.json (opcional) — nomes da nossa base para a PRÉVIA do
//     relatório de locais desconhecidos. Prévia, não vínculo: quem casa de
//     verdade é a própria migration, contra o banco vivo.
//
// SAÍDA:
//   · supabase/migrations/<data>_u110_equipamentos_do_qap.sql
//   · docs/importacao/locais-desconhecidos.md
//
// POR QUE O VÍNCULO É FEITO NA MIGRATION, E NÃO AQUI (decisão da U110):
// ligar item a cliente exige o UUID do cliente, que só existe no banco. Um
// retrato dos ids tirado agora já nasceria velho — clientes entraram pelo app
// depois da U24 —, então quem casa é o SQL, contra a base do momento em que o
// Davi rodar. O casamento no SQL é ESTRITO de propósito (`lower(btrim(...))`,
// sem mexer em acento): mais rígido que o daqui, ele erra para o lado de
// "não vinculou" e nunca para o lado de "vinculou no prédio errado" (R199).
//
// O que continua sendo decidido AQUI, com asserção em cima
// (src/features/equipamentos/importacao.ts): a VARIAÇÃO de catálogo de cada
// item, a CHAVE de importação (idempotência) e a leitura da data.

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
if (!fs.existsSync(ARQ_QAP)) {
  console.error(`ABORTA: falta ${ARQ_QAP}. Extraia a tela Patrimônio > Local/Uso do QAP antes.`);
  process.exit(1);
}
const linhas = JSON.parse(fs.readFileSync(ARQ_QAP, 'utf8'));
if (!Array.isArray(linhas) || linhas.length === 0) { console.error('ABORTA: o retrato do QAP está vazio'); process.exit(1); }

const ARQ_NOMES = 'docs/importacao/nomes-da-base.json';
const base = fs.existsSync(ARQ_NOMES) ? JSON.parse(fs.readFileSync(ARQ_NOMES, 'utf8')) : { clientes: [], pessoas: [] };
// a prévia casa por NOME (sem id): o módulo puro aceita qualquer objeto com
// `nome`/`nome_predio`, e aqui o "id" é o próprio nome, só para saber se casou
const clientesPrevia = (base.clientes ?? []).map((c) => ({ id: c.nome, nome: c.nome, nome_predio: c.posto ?? null }));
const pessoasPrevia = (base.pessoas ?? []).map((p) => ({ id: typeof p === 'string' ? p : p.nome, nome: typeof p === 'string' ? p : p.nome }));

const r = IMP.prepararImportacao(linhas, clientesPrevia, pessoasPrevia);
const semLocal = r.itens.filter((i) => !i.localQap).length;

// ── SQL ──────────────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
// O prefixo do nome é SEQUÊNCIA, não calendário: as migrations rodam na ordem
// dos nomes, e as desta casa correm à frente da data real (a U109 é
// 20260918...). Então o stamp é "o dia seguinte à última migration do repo" —
// com a data de hoje, a U110 ordenaria ANTES da U109 e o pré-voo abortaria.
const ultimoPrefixo = fs.readdirSync('supabase/migrations')
  .map((a) => (a.match(/^(\d{8})/) || [])[1]).filter(Boolean).sort().pop();
const dia = ultimoPrefixo
  ? new Date(Number(ultimoPrefixo.slice(0, 4)), Number(ultimoPrefixo.slice(4, 6)) - 1, Number(ultimoPrefixo.slice(6, 8)) + 1)
  : new Date();
const stamp = `${dia.getFullYear()}${String(dia.getMonth() + 1).padStart(2, '0')}${String(dia.getDate()).padStart(2, '0')}`;
const destino = `supabase/migrations/${stamp}090000_u110_equipamentos_do_qap.sql`;

const linhasCatalogo = r.catalogo.map((v) =>
  `  (${q(v.almoxarifado)}, ${q(v.nome)}, ${q(v.modelo)}, ${q(v.fabricante)}, ${q(v.chave)})`).join(',\n');

const linhasItens = r.itens.map((i) =>
  `  (${q(i.chaveVariacao)}, ${q(i.identificacao)}, ${q(i.localQap)}, ` +
  `${i.enviadoEm ? `${q(i.enviadoEm)}::date` : 'NULL'}, ${q(i.chaveImportacao)})`).join(',\n');

const sql = `-- ═══════════════════════════════════════════════════════════════════════════
-- U110 — OS EQUIPAMENTOS DO QAP ENTRAM NO SISTEMA (R196–R199)
--        ${r.totais.variacoes} variações no catálogo · ${r.totais.linhas} itens de patrimônio
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: DEPOIS da U109 (que cria as tabelas). O pré-voo aborta sem ela.
-- >>> GERADA por scripts/gerar-migration-equipamentos.cjs a partir de
-- >>>   docs/importacao/qap-equipamentos.json (o retrato cru do QAP, lido da
-- >>>   tela Patrimônio > Local/Uso com Status = "Uso").
-- >>>   NÃO EDITAR À MÃO: corrija o retrato ou o módulo de importação
-- >>>   (src/features/equipamentos/importacao.ts) e gere de novo.
--
-- O QUE ENTRA (R196 — os sete campos que o Davi mandou usar):
--   almoxarifado · nome (o "Tipo de Categoria" do QAP) · modelo · fabricante
--   · identificação · local/pessoa · data de envio
-- A "Categoria" do QAP e a contagem de passagens ficaram de fora, por decisão
-- dele. O id interno do item no QAP vira a \`chave_importacao\` (\`qap:<id>\`):
-- é o que faz rodar isto duas vezes não duplicar nada.
--
-- COMO O LOCAL É VINCULADO (R199): os itens entram com o TEXTO do QAP em
-- \`local_qap\` e sem vínculo; dois UPDATEs ligam ao cliente e à pessoa cujo
-- nome bate EXATO (\`lower(btrim(...))\`, acento incluído). Nada aproximado —
-- pôr equipamento no prédio errado é pior que deixá-lo sem prédio. Os UPDATEs
-- só preenchem o que está NULO, então uma correção que você fizer à mão depois
-- NÃO é desfeita ao rodar de novo.
--
-- OS NÚMEROS DESTE RETRATO:
--   itens ................................. ${String(r.totais.linhas).padStart(6)}
--   variações de catálogo ................. ${String(r.totais.variacoes).padStart(6)}
--   sem identificação (R197) .............. ${String(r.totais.semIdentificacao).padStart(6)}
--   sem local nenhum no QAP ............... ${String(semLocal).padStart(6)}
--   datas ilegíveis (entram nulas) ........ ${String(r.datasIlegiveis).padStart(6)}
--   identificações repetidas no QAP ....... ${String(r.identificacoesRepetidas.length).padStart(6)}
--   locais distintos ...................... ${String(new Set(r.itens.map((i) => i.localQap).filter(Boolean)).size).padStart(6)}
--
-- A conferência no fim imprime QUANTOS casaram e QUAIS locais não casaram —
-- é a relação que o Davi pediu, tirada da base viva. A prévia (contra a
-- planilha da U24) está em docs/importacao/locais-desconhecidos.md.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pré-voo: a U109 tem de ter rodado ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'catalogo_equipamentos') THEN
    RAISE EXCEPTION 'U110: rode a U109 antes — public.catalogo_equipamentos nao existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'equipamentos_patrimonio') THEN
    RAISE EXCEPTION 'U110: rode a U109 antes — public.equipamentos_patrimonio nao existe';
  END IF;
END $$;

-- ── 1) o catálogo: uma linha por variação (R198) ───────────────────────────
INSERT INTO public.catalogo_equipamentos (almoxarifado, nome, modelo, fabricante, chave) VALUES
${linhasCatalogo}
ON CONFLICT (chave) DO NOTHING;

-- ── 2) os itens físicos, ligados à variação pela chave (R196, R197) ────────
WITH entrada (chave_variacao, identificacao, local_qap, enviado_em, chave_importacao) AS (
  VALUES
${linhasItens}
)
INSERT INTO public.equipamentos_patrimonio
       (catalogo_id, identificacao, local_qap, enviado_em, chave_importacao, origem)
SELECT c.id, e.identificacao, e.local_qap, e.enviado_em, e.chave_importacao, 'qap'
  FROM entrada e
  JOIN public.catalogo_equipamentos c ON c.chave = e.chave_variacao
ON CONFLICT (chave_importacao) DO NOTHING;

-- ── 3) o vínculo com o CLIENTE, por nome exato (R199) ──────────────────────
UPDATE public.equipamentos_patrimonio p
   SET cliente_id = c.id, updated_at = now()
  FROM public.clientes c
 WHERE p.cliente_id IS NULL
   AND p.pessoa_id IS NULL
   AND p.local_qap IS NOT NULL
   AND (lower(btrim(c.nome)) = lower(btrim(p.local_qap))
        OR lower(btrim(coalesce(c.nome_predio, ''))) = lower(btrim(p.local_qap)));

-- ── 4) o vínculo com a PESSOA (o QAP mistura prédio e gente na mesma coluna) ─
UPDATE public.equipamentos_patrimonio p
   SET pessoa_id = f.id, updated_at = now()
  FROM public.profiles f
 WHERE p.cliente_id IS NULL
   AND p.pessoa_id IS NULL
   AND p.local_qap IS NOT NULL
   AND lower(btrim(coalesce(f.nome, ''))) = lower(btrim(p.local_qap));

-- ── Verificação ────────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'variações no catálogo' AS o_que,
         (SELECT count(*)::text FROM public.catalogo_equipamentos) AS obtido,
         '${r.totais.variacoes}' AS esperado
  UNION ALL
  SELECT 2, 'itens de patrimônio',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio), '${r.totais.linhas}'
  UNION ALL
  SELECT 3, 'nenhum item ficou sem variação (o JOIN pegou todos)',
         (SELECT CASE WHEN count(*) = ${r.totais.linhas} THEN 'sim' ELSE 'NAO' END
            FROM public.equipamentos_patrimonio p
            JOIN public.catalogo_equipamentos c ON c.id = p.catalogo_id), 'sim'
  UNION ALL
  SELECT 4, 'itens sem identificação (o QAP não tinha — R197)',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio WHERE identificacao IS NULL),
         '${r.totais.semIdentificacao}'
  UNION ALL
  SELECT 5, 'itens com CLIENTE vinculado (quanto mais, melhor — não há número esperado)',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio WHERE cliente_id IS NOT NULL), 'ver'
  UNION ALL
  SELECT 6, 'itens com PESSOA vinculada',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio WHERE pessoa_id IS NOT NULL), 'ver'
  UNION ALL
  SELECT 7, 'itens sem vínculo (local que não existe na base — a relação vem abaixo)',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio
           WHERE cliente_id IS NULL AND pessoa_id IS NULL), 'ver'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN esperado = 'ver' THEN 'olhar' WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ── A RELAÇÃO QUE O DAVI PEDIU: locais do QAP que não casaram com a base ────
SELECT coalesce(p.local_qap, '(sem local no QAP)') AS local_no_qap,
       count(*) AS itens
  FROM public.equipamentos_patrimonio p
 WHERE p.cliente_id IS NULL AND p.pessoa_id IS NULL
 GROUP BY 1
 ORDER BY 2 DESC, 1;

-- ── DESFAZER ───────────────────────────────────────────────────────────────
-- ║ Apaga SÓ o que esta importação trouxe (as linhas de origem 'qap'):
-- ║   BEGIN;
-- ║     DELETE FROM public.equipamentos_patrimonio WHERE origem = 'qap';
-- ║     DELETE FROM public.catalogo_equipamentos   WHERE origem = 'qap';
-- ║   COMMIT;
-- ║ O catálogo só apaga DEPOIS dos itens: a FK é RESTRICT de propósito, para
-- ║ ninguém apagar uma variação e deixar item órfão.
-- ║
-- ║ Para desfazer só os VÍNCULOS (e refazer o casamento depois de cadastrar os
-- ║ locais que faltam):
-- ║   UPDATE public.equipamentos_patrimonio SET cliente_id = NULL, pessoa_id = NULL
-- ║    WHERE origem = 'qap';
-- ║ e rode de novo os passos 3 e 4 desta migration.
`;

fs.mkdirSync('supabase/migrations', { recursive: true });
fs.writeFileSync(destino, sql);

// ── a prévia dos locais desconhecidos (item 3 do Davi) ──────────────────────
const temBase = clientesPrevia.length > 0;
const md = `# Locais do QAP que não estão na nossa base — PRÉVIA

Gerado por \`scripts/gerar-migration-equipamentos.cjs\` a partir de
\`docs/importacao/qap-equipamentos.json\` (${r.totais.linhas} itens, retrato da tela
*Patrimônio > Local/Uso* do QAP com Status = "Uso").

> **É prévia, não veredito.** Ela confere contra ${temBase ? `os ${clientesPrevia.length} nomes da planilha oficial semeada na migration U24` : 'NADA (o arquivo de nomes não existe)'} —
> cliente cadastrado pelo app depois daquela planilha não aparece aqui e pode
> muito bem existir. Quem casa de verdade é a **U110**, contra a base viva, e
> ela imprime a relação real na última consulta (R199).

| Local no QAP | Itens | Parecidos na planilha da U24 |
|---|---:|---|
${r.desconhecidos.map((d) => `| ${d.local} | ${d.quantidade} | ${d.sugestoes.join(' · ') || '—'} |`).join('\n')}

**Total:** ${r.desconhecidos.length} locais, ${r.desconhecidos.reduce((t, d) => t + d.quantidade, 0)} itens sem vínculo nesta prévia${semLocal ? `, mais ${semLocal} ${semLocal === 1 ? 'item que veio' : 'itens que vieram'} sem local nenhum no QAP` : ''}.

${r.identificacoesRepetidas.length > 0 ? `## Identificações repetidas no QAP

O mesmo número em mais de um item. Entram assim mesmo (R197): travar aqui
faria a importação inteira falhar por um número digitado duas vezes.

| Identificação | Itens |
|---|---:|
${r.identificacoesRepetidas.slice(0, 40).map((i) => `| ${i.identificacao} | ${i.quantidade} |`).join('\n')}
${r.identificacoesRepetidas.length > 40 ? `\n…e mais ${r.identificacoesRepetidas.length - 40}.\n` : ''}` : ''}`;

fs.mkdirSync('docs/importacao', { recursive: true });
fs.writeFileSync('docs/importacao/locais-desconhecidos.md', md);

console.log(`U110 gerada: ${destino} (${(fs.statSync(destino).size / 1024).toFixed(0)} KB)`);
console.log(`  ${r.totais.linhas} itens · ${r.totais.variacoes} variações · ${r.totais.semIdentificacao} sem identificação · ${semLocal} sem local`);
console.log(`  prévia: ${r.desconhecidos.length} locais fora da planilha da U24 → docs/importacao/locais-desconhecidos.md`);
if (r.qapIdsRepetidos.length) console.log(`  ATENÇÃO: ${r.qapIdsRepetidos.length} ids do QAP repetidos`);
