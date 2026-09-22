# <Módulo> — Requisitos

<!-- O "o quê" VIVO do módulo, atualizado a cada entrega, ANTES do código.
     Adaptação do padrão (ADR-0001/0002): as regras NÃO são reescritas aqui. O catálogo é
     ../PRODUTO.md, com R# ÚNICO no sistema inteiro e a frase do Davi; este arquivo é a vista
     do módulo — síntese EARS + tabela "| Rn | essência |". A tabela é lida por
     scripts/cobertura-regras.cjs para montar a cobertura no state.

     Módulo novo: copiar para requirements/<modulo>.md, criar state/<modulo>.md a partir do
     template dele e adicionar a linha nos DOIS índices — docs/REQUIREMENTS.md e o mapa de
     módulos da cápsula (AGENTS.md). Checkpoints: skill entrega. -->

Identificador do módulo: `<modulo>`.

Propósito: <uma linha>.

## Síntese (EARS)

<!-- Ubíquo: O sistema DEVE … · Dirigido: QUANDO …, o sistema DEVE … · Estado: ENQUANTO …
     Indesejado: SE …, ENTÃO o sistema DEVE … · Opcional: ONDE …, o sistema DEVE …
     Toda frase cita a(s) regra(s) que a autorizam: (R#). Sem "rápido/robusto" sem número. -->

- O sistema DEVE … (R#).

## As regras que governam o módulo

| Regra | Essência |
|---|---|
| R# | <a essência, como está no catálogo> |

## Fora de escopo

- <recorte, citando o módulo vizinho, a regra ou o ADR>

## Referências

- Contexto ditado / manual / ADRs.
- Estado da implementação: `../state/<modulo>.md`.
