## O que muda

<!-- Uma frase. A regra que autoriza (R# em docs/PRODUTO.md) — ou "correção, sem regra nova". -->

## Checklist da entrega (skill `entrega`)

- [ ] Comportamento novo: a regra R# entrou em `docs/PRODUTO.md` ANTES do código, com a frase do Davi
- [ ] Toda regra tocada tem asserção permanente em `scripts/verificar-logica.cjs`
- [ ] Se toca o banco: migration idempotente, com conferência e DESFAZER — e o aviso ao Davi para rodar
- [ ] `docs/state/<modulo>.md` no presente · `docs/ESTADO_ATUAL.md` · diário U# em `docs/PLANO_UNIFICACAO.md`
- [ ] Derivados regenerados: `node scripts/harness-sync.cjs`, `harness-index.cjs`, `cobertura-regras.cjs`
- [ ] `node scripts/harness-gates.cjs` verde DEPOIS da última alteração (o CI repete em Windows e Linux)
