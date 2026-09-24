# Interface — Requisitos

Identificador do módulo: `interface`.

Propósito: O design system: tokens, temas, tipografia, réguas de margem e de barra, e os
anti-padrões.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- Toda cor DEVE sair de `src/lib/paleta.ts` e toda superfície de `src/lib/ui.ts`; todo token do
  `:root` DEVE ter par no `[data-theme="light"]`.
- O sistema DEVE usar só quatro pesos de fonte — 100, 400, 600 e 700 — cada um com função (R195).
- O fundo DEVE ser só cinza neutro (R186); brilho é exceção (R174); a cor estratégica mora na borda
  do card (R136).
- QUANDO uma tela nasce, ela NÃO DEVE ficar pronta sem a revisão de margem (`--gutter`, R239, R275).
- Hover DEVE existir só com ponteiro fino (`@media (hover: hover) and (pointer: fine)`) e move, não
  clareia.
- Os títulos, tamanhos, cores e famílias DEVEM seguir uma escala única por página (R303).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/interface.md`.

| Regra | Essência |
|---|---|
| R28 | Cada perfil tem o seu aparelho |
| R39 | Campo de escolha com BUSCA nas listas longas |
| R45 | Os cinco status do chamado têm cor fixa, do nosso degradê |
| R79 | Revisão geral de design, com foco no modo claro |
| R87 | A cor do botão de escolha é a cor da coisa escolhida |
| R136 | Nos cards da Início, a cor estratégica mora só na borda, não no fundo |
| R154 | Tema claro v10: a página é um branco mais escuro, o card é o branco mais claro, o texto é um cinza bem escuro |
| R174 | O sistema é ferramenta de trabalho: brilho é exceção, não acabamento |
| R176 | O avatar não espalha glow |
| R177 | A etiqueta colorida é PREENCHIDA: fundo sólido no tom fundo da cor e texto branco, igual nos dois temas, se… |
| R186 | O fundo do sistema é só CINZA: cinza escuro no tema escuro, cinza claro no tema claro — sem azul |
| R195 | Tipografia estratégica: quatro pesos, cada um com função |
| R239 | A revisão geral da tela da atividade: uma régua de margem, um scroll, o pop-up por cima de tudo e os equipa… |
| R275 | Tela nova não fica pronta sem a revisão de margem — e o vocabulário visual é o que o app JÁ fala |
| R303 | Os títulos, tamanhos, cores e famílias de fonte das páginas principais seguem UMA escala |
| R309 | A revisão de tipografia é aplicada INTEIRA, numa entrega só (Opção C) |

## Fora de escopo

- Receita de painel (faixas, rampa de cores): `../DASHBOARD.md`.
- Layout de tela específica: no módulo da tela.

## Referências

- Fonte de verdade: `../../DESIGN_SYSTEM.md` (§2 tokens, §6 componentes, §8 anti-padrões).
- Skill: `.claude/skills/designer/` (briefing antes do código, inventário, estados).
- Manual: `../manual/interface-e-design.md`.
- Auditoria: `../REVISAO_TIPOGRAFIA_2026-09-15.md`.
- Estado da implementação: `../state/interface.md`.
