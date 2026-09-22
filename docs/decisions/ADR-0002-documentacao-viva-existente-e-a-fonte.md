# ADR-0002 — A documentação viva que já existia é a fonte; o padrão a indexa

- **Data:** 2026-09-22
- **Status:** Aceito

## Contexto

O padrão prevê requisito e estado por módulo, ADRs e índices. O Prever OS chegou com
documentos que fazem esse papel há um mês de uso real: `PRODUTO.md` (as regras, com as
frases do Davi), `PLANO_UNIFICACAO.md` (o diário: o porquê de cada decisão técnica),
`ESTADO_ATUAL.md` (o retrato), `PENDENCIAS_TECNICAS.md`, `DECISOES_PENDENTES.md`, os
contextos ditados e o manual por segmento. Reescrevê-los para caber no template destruiria
o que sobrevive ao tempo (o próprio ADR-0003 do padrão diz o que sobrevive: cápsula,
documentação por módulo entrada por índices, ADRs, skills que fecham o ciclo).

## Decisão

- `docs/PRODUTO.md` é o **catálogo de requisitos** (R-série, global, imutável por número).
  `docs/requirements/<modulo>.md` é a VISTA por módulo: propósito, as regras que o governam,
  fora de escopo, referências. Não reescreve regra.
- `docs/PLANO_UNIFICACAO.md` é a **história** (U-série). O padrão diz "estado ≠ história":
  a história tem casa própria e o `state/<modulo>.md` fica no presente.
- `docs/ESTADO_ATUAL.md` é o **retrato do sistema** (o que está no ar, migrations, ordem de
  leitura); `docs/DECISOES_PENDENTES.md` é o **retrato da decisão** (o que depende do Davi).
  O `state/<modulo>.md` aponta para eles nas pendências, não os copia.
- Decisão de PRODUTO continua em regra R-série; ADR é só para decisão ESTRUTURAL.
- Os sumários gerados (`scripts/sumario.cjs`) continuam sendo o índice dos documentos
  mestre; o `.harness/INDEX.md` é o nó raiz do harness. Os dois são derivados.

## Alternativas consideradas

- Migrar tudo para EARS por módulo e apagar PRODUTO/PLANO: perde as frases do Davi (a
  evidência de cada regra) e a rastreabilidade de 155 entregas. Descartada.
- Um único `state.md`: é o anti-padrão que o próprio padrão nomeia (estado-história).

## Consequências

- O custo de orientação de uma tarefa: cápsula + 1 linha do índice + requisito do módulo +
  state do módulo + as regras citadas — nada mais.
- A "Cobertura R# → verificação" do state é DERIVADA do verificador (quantas asserções citam
  cada regra); regra sem menção nominal aparece como tal, e isso é informação.
- Documento mestre novo entra em três lugares: mapa do `AGENTS.md`, ordem de leitura do
  `ESTADO_ATUAL.md` e `PROJECT-STRUCTURE.md`.
