# Banco e migrations — procedimentos e convenções

> Manual Prever Proposta — segmento: banco e migrations. Gerado em 2026-08-21
> a partir de revisão do código. Fonte de verdade: o código e as migrations;
> se este documento discordar deles, eles ganham.

## Para que serve este documento

Como escrever, aplicar e não se machucar com migrations neste projeto — cujo
detalhe decisivo é: **nada se aplica sozinho**.

## O procedimento de aplicação (inegociável)

1. Migrations do repo (`supabase/migrations/`) **nunca rodam
   automaticamente**. O Davi as executa **manualmente no SQL Editor do
   Lovable**, na ordem dos timestamps.
2. Por isso toda migration é **idempotente** — rodar duas vezes dá no mesmo
   (`IF NOT EXISTS`, `ON CONFLICT`, `DROP POLICY IF EXISTS` antes de criar).
3. Toda migration termina com um **SELECT de verificação** com valores
   esperados no texto (`'... (esperado 0)'`). **`RAISE NOTICE` é invisível**
   no editor do Lovable — não use para verificação.
4. **Editar migration já aplicada é no-op.** Mudança nova = arquivo novo com
   timestamp maior. (Editar uma AINDA não aplicada também é arriscado se não
   houver certeza de que não rodou — na dúvida, arquivo novo.)
5. Depois de aplicar, conferir o resultado do SELECT contra o esperado e
   avisar divergência.

## Convenções da casa

**Satélite 1:1 com o MESMO id.** Quando um registro ganha uma "capa" em outra
tabela (demanda→chamado U7, compra U9, visita→chamado U29), a capa é inserida
**com o id do original**. Os satélites que apontavam para o original
continuam válidos — **nenhuma FK é reescrita**. É a técnica padrão de
absorção deste projeto.

**Trigger espelha função do app.** Quando um trigger traduz estado (ex.:
`trg_sincronizar_chamado_da_visita` ↔ `colunaDaVisita()`), os dois lados são
a MESMA tradução. Divergiram = o card muda de coluna ao recarregar. Mudou um,
mude o outro e rode o verificador.

**A semente da matriz evolui por migrations.** `permissoes_tela` foi semeada
na U11 e alterada por U24/U27/U28/U30 — **inclusive DELETE** (U30). O
verificador reconstrói a "semente efetiva" aplicando os arquivos em ordem e
compara com o catálogo (`src/lib/telas.ts`). Tela nova/removida sem migration
correspondente falha a paridade.

**`ON CONFLICT`**: `DO NOTHING` preserva escolha do admin; `DO UPDATE` é para
decisão de produto que vale por cima (U28/U30 documentam o porquê no próprio
arquivo). Escolha consciente, comente no SQL.

**Rename de tabela leva os triggers junto** — mas NÃO reescreve o corpo
deles (referências antigas dentro do corpo continuam). E para mexer em dados
com triggers no caminho: `ALTER TABLE ... DISABLE TRIGGER USER` antes,
`ENABLE` depois.

## Cicatrizes (anti-práticas com história)

- **`REVOKE` de coluna** (S1, revertido na S1b): no Supabase todo logado é o
  papel `authenticated` — o REVOKE atingiu o admin junto E quebrou qualquer
  `select *` da tabela. Visibilidade fina = policy ou view, nunca REVOKE.
- **Loop `FOREACH` com `IF EXISTS (coluna)`**: a primeira versão da S1 teria
  **pulado em silêncio** a tabela `cliente_equipamentos` (o nível do meio não
  tem `cliente_id`). Blindagem se escreve tabela por tabela, explícita.
- **Assumir a cadeia do inventário com FK direta**: são 3 níveis
  (`cliente_sistemas.cliente_id` → `cliente_equipamentos.cliente_sistema_id`
  → `cliente_equipamento_unidades.cliente_equipamento_id`).

## Checklist para tabela nova

1. `CREATE TABLE ... IF NOT EXISTS` com FKs explícitas.
2. **RLS ON** desde o nascimento + policies por operação (select/insert/
   update/delete), pensadas por cargo — capa nunca mais frouxa que corpo.
3. `updated_at`/triggers padrão se aplicável.
4. Se houver tela: semente de `permissoes_tela` na MESMA migration.
5. SELECT de verificação no fim.
6. Asserção no verificador se a tabela carrega regra de produto.

## Referências

- Modelos bons para copiar: `20260819180000_u11` (semente),
  `20260820170000_s1` (blindagem, com o post-mortem no cabeçalho),
  `20260821160000_u29` (satélite + trigger + policy),
  `20260821180000_u30` (DELETE na semente).
- `docs/PLANO_UNIFICACAO.md` — o diário com o porquê de cada uma.
