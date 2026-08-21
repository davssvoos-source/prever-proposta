# Interface — como construir telas no padrão da casa

> Manual Prever Proposta — segmento: interface e design. Gerado em 2026-08-21
> a partir de revisão do código. Fonte de verdade: o código, DESIGN_SYSTEM.md
> e docs/PRODUTO.md; se este documento discordar deles, eles ganham.

## Para que serve este documento

`DESIGN_SYSTEM.md` (raiz do repo) tem os tokens, as tabelas e os
anti-padrões completos — **não duplicamos nada disso aqui**. Este documento
destila o COMO: a sequência prática de construir uma tela que parece da casa.

## A identidade: o degradê ESPECTRO

O degradê é **identidade de marca, não rampa de dados**. Composição fixa
(decisão do Davi): **20% tons de azul → 40% tons de amarelo → 20% laranja →
20% vermelho**, passando pelo vermelho do botão. Os amarelos do botão
(`#FCDE48 → #F8C811 → #E8B00A`) são os tons **principais** do degradê.

Tudo vem de `src/lib/paleta.ts`:

- `ESPECTRO_STOPS` — os stops (dark e light; o light é mais claro de
  propósito, v7).
- `espectro(tom, isLight)` / `espectroTexto()` — uma cor pontual do espectro
  (é o que os painéis usam nos números, `tom: 0..8` frio→quente).
- `gradienteBarra()` — gradiente para barras; insere a **COSTURA** na barra
  da emenda azul→amarelo, senão o meio renderiza **verde** (interpolação
  atravessa o verde; a costura é um trecho quase acromático).
- `degradeAvatar(nome)` — avatar sem foto: gradiente estável por hash, glow
  fraco.

**Nunca** gerar cores novas fora da paleta; P13 registra os amarelos fora de
paleta que ainda restam em telas legadas.

## Receita: tela nova em 8 passos

1. **Fonte**: `FONT` de `src/lib/ui.ts` (= `var(--fonte)` = Montserrat;
   pesos usados: regular/500/600/700). Números grandes: 700 com leve glow
   (`textShadow` com a própria cor a ~35%).
2. **Cartões**: `card(isLight)` de `src/lib/ui.ts` — nunca montar fundo/borda
   de card à mão. Raio padrão 16.
3. **Tema**: `useTheme()` → `isLight`. TODA cor tem os dois lados. Modo
   claro: fundos claros e textos escuros — os anti-padrões (e o que grepar
   para achá-los) estão no DESIGN_SYSTEM.md; a revisão bd1fa3d passou o pente.
4. **Layout**: título 22/600, subtítulo 12 secundário; margens da página
   iguais às da Início (a classe `sangra-x`); grids com
   `repeat(auto-fit, minmax(..., 1fr))` e `gap` — sem margin solta.
5. **Sidebar**: a tela deve funcionar com o menu recolhido —
   `src/lib/sidebar-recolhida.ts` (singleton com `useSyncExternalStore`;
   larguras 232/72). Não medir a tela por window sem descontar o rail.
6. **Painel?** Use `PainelBase` (`src/features/paineis/PainelBase.tsx`):
   números (`tom` do espectro) + atalhos filtrados por permissão + `children`
   para conteúdo próprio. Três painéis com anatomia própria viram irmãos
   desiguais na primeira mudança de design.
7. **Dataviz** (DESIGN_SYSTEM.md §9): paleta categórica FIXA (8 cores,
   validada para daltonismo), nunca ciclada além de 8 — excedente vira
   "Outros" **neutro**; "Sem técnico" idem; **identidade nunca só pela cor**
   (sempre legenda com rótulo). Donut com total no centro; tooltip no estilo
   da casa.
8. **Interação**: hover **move, não clareia** (decisão do Davi sobre o campo
   Abrir chamado — o brilho de hover é o brilho correto permanente); a classe
   `elevavel` dá a elevação padrão; bordas arredondadas no padrão do sistema;
   FAB dourado (`GOLD_GRAD` + `GOLD_GLOW`) para a ação principal.

## Fundo por prazo (cards de atividade)

Amarelo = vence nesta semana · azul = depois · vermelho = atrasado
(`faixaPrazo()` — regra em `operacao-campo.md`). Fundos de ÍCONES ficam na
cor normal do fundo do sistema (reversão pedida pelo Davi — não recolorir).

## Armadilha técnica conhecida

`filter: blur()` promove a camada para a GPU e **escapa do arredondamento**
de `overflow: hidden`; `clip-path` resolve, mas no pai corta o próprio
box-shadow. Se um vidro/blur vazar do raio do card, é isso.

## Anti-práticas

- Cor nova fora da paleta (P13 existe para ser esvaziado, não engordado).
- Degradê tratado como escala de dados (foi o mal-entendido corrigido na v6).
- Hover que clareia; foco que deforma botão arredondado (P11).
- Duplicar tokens/tabelas do DESIGN_SYSTEM.md em outro arquivo.
- Texto claro em fundo claro (a praga do modo claro — grep antes de entregar).

## Referências

- `DESIGN_SYSTEM.md` — tokens, §9 dataviz, anti-padrões de modo claro
- `src/lib/paleta.ts` · `src/lib/ui.ts` · `src/lib/sidebar-recolhida.ts`
- Exemplos bons: `painel.operacional.tsx`, `PainelBase.tsx`, dashboard
