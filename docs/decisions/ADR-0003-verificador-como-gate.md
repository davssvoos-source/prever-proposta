# ADR-0003 — O verificador da casa é o gate de testes

- **Data:** 2026-09-22
- **Status:** Aceito

## Contexto

O padrão exige seis comandos (`setup`, `build`, `test`, `lint`, `format`, `run`) e gates
que definem "pronto". O Prever OS não tem suíte de testes unitários convencional: tem
`scripts/verificar-logica.cjs`, com 3.581 asserções que executam a lógica pura (`carregar()`
transpila `.ts` na hora) e prendem por regex a forma das telas, dos documentos e das
migrations — e o `tsc` em zero como baseline. O banco muda por migration rodada à mão pelo
Davi, fora do alcance de qualquer gate.

## Decisão

- `test` = `node scripts/verificar-logica.cjs`; `lint` = `npx tsc --noEmit`;
  `build` = `npx vite build`; `format` = `npx prettier --write .`; `run` = `npx vite dev`;
  `setup` = `npm install`. Declarados em `.harness/harness.yaml`.
- Gates, nesta ordem: `docs-lint`, `sumarios` (`node scripts/sumario.cjs --check`),
  `adapters-in-sync`, `index-in-sync`, `runner-tests`, `lint`, `tests`, `build`.
  Todos obrigatórios. O CI (`.github/workflows/harness.yml`) roda o mesmo executor.
- Migration NÃO é gate: o repositório a escreve e o Davi a roda. O que o verificador prende
  é a FORMA da migration (idempotência, conferência, DESFAZER, semente) e a paridade entre
  catálogo de telas e semente. Pino descreve arquivo, nunca estado do banco.
- O ESLint continua disponível (`npm run lint`) mas não é gate: o baseline dele nunca foi
  zerado, e gate que falha sempre é ruído.

## Alternativas consideradas

- Introduzir Vitest e migrar as asserções: o verificador já é a suíte, com 3.5k casos e a
  convenção de `CRÍTICO`; migrar seria trabalho sem ganho de verificação. Descartada.
- ESLint como gate obrigatório: falharia hoje e ensinaria a ignorar gate vermelho.

## Consequências

- "Pronto" tem número: 0 falharam, 0 erros de tipo, build completo, docs e índices em dia.
- Regra nova sem asserção quebra o hábito, não o gate — o `state/<modulo>.md` expõe a
  cobertura por regra para o verifier conferir.
