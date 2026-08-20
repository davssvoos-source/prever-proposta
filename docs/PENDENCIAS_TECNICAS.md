# Pendências técnicas — registro dos defeitos da revisão

Registro formal do que a revisão adversarial encontrou.

**Situação em 2026-08-20 (fim do dia):** dos 12 itens, 9 foram corrigidos e
3 (P2, P6, P9) ficaram **sem objeto** — o handler de roda do quadro, origem dos
três, foi removido quando o kanban virou página única (U17). Pendente de
verdade resta só o **P7**. O histórico dos resolvidos fica aqui de
propósito: quando um deles voltar, o caminho de quebra já está escrito.

Este documento existe para que nada aqui vire descoberta futura. Cada item traz
o arquivo, como quebra, e a correção mínima — para que consertar seja executar,
não investigar de novo.

## Como ler o status de verificação

A revisão foi **encerrada antes da fase de refutação**, em que cada achado é
atacado por um cético antes de virar conclusão. Por isso os itens estão
separados:

- **CONFIRMADO** — eu li o código e verifiquei o caminho de quebra. É defeito.
- **A CONFIRMAR** — veio da revisão e é plausível, mas não passou pelo cético
  nem pela minha verificação. Pode ser falso positivo. Verificar antes de mexer.

Origem: `wf_1a7b7d3f-316` (revisão do desktop, U12), interrompida com 17 dos
achados já produzidos e a fase de refutação incompleta.

---

## P1 · CRÍTICO · O menu de filtro é pintado atrás da barra inferior

**Status:** **RESOLVIDO** (2026-08-20) — popover em `createPortal` para o `body`, com posição calculada do retângulo do botão.
**Arquivo:** `src/features/home/MenuFiltro.tsx` (o popover) +
`src/styles.css:366` + `src/routes/_authenticated/route.tsx:232-240`

**Como quebra.** `#root, main, header, nav { position: relative; z-index: 1 }`
faz do `<main>` um **contexto de empilhamento**. O popover do filtro vive dentro
dele com `z-index: 60`, mas esse 60 só compete com irmãos dentro do `<main>` —
para o resto da página, o menu inteiro vale `z-index: 1`. A `BottomNav` é
`position: fixed; z-index: 50` e é **irmã** do `<main>`, então pinta por cima.

Na prática, no celular: abrir o menu "Padrão" e tocar na última opção acerta a
BottomNav e **navega para outra tela** em vez de escolher o filtro.

**Correção mínima.** Renderizar o popover em portal para `document.body`
(`createPortal`), com `position: fixed` e coordenadas calculadas do
`getBoundingClientRect()` do botão. Sair do `<main>` é o que resolve; subir o
z-index não resolve, porque o problema não é o valor.

**Aproveitar a mesma mudança para P3.**

---

## P2 · ALTO · A roda do mouse anda 3px por clique no Firefox

**Status:** **SEM OBJETO** desde a U17 — o handler de roda foi removido inteiro: o quadro virou página única e a roda rola a página, como o Davi pediu.
**Arquivo:** `src/features/home/Quadro.tsx`, handler `naRoda`

**Como quebra.** O handler usa `e.deltaY` cru. O Firefox entrega
`deltaMode = 1` (LINHAS), com `deltaY ≈ 3` por clique da roda — o Chrome
entrega `deltaMode = 0` (PIXELS), com `deltaY ≈ 100`. Resultado: no Firefox o
quadro anda 3px por clique e parece travado.

**Correção mínima.** Normalizar antes de usar:

```ts
const passo =
  e.deltaMode === 1 ? e.deltaY * 16 :          // linhas
  e.deltaMode === 2 ? e.deltaY * el.clientWidth : // páginas
  e.deltaY;                                     // pixels
```

---

## P3 · ALTO · O menu abre sempre para baixo, sem olhar o fim da tela

**Status:** **RESOLVIDO** (2026-08-20) — junto com o P1: vira para cima quando não cabe e limita a altura ao espaço da janela.
**Arquivo:** `src/features/home/MenuFiltro.tsx`

**Como quebra.** O popover é `top: calc(100% + 6px)` incondicional. O menu
"Pessoa" pode ter dezenas de opções (`maxHeight: 320`). Com o botão na metade
de baixo da tela, metade das opções nasce fora da janela — e como o `<main>`
rola, a pessoa precisa rolar a página com o menu aberto, o que em alguns
navegadores fecha o menu.

Só o eixo horizontal foi tratado (`aDireita`).

**Correção mínima.** Junto com o portal do P1: medir o espaço abaixo do botão e
abrir para cima quando não couber; limitar `maxHeight` ao espaço disponível.

---

## P4 · ALTO · `prefers-reduced-motion` congela os indicadores de carregamento

**Status:** **RESOLVIDO** (2026-08-20) — a regra passa a excluir `.animate-spin`, que gira mais devagar em vez de parar.
**Arquivo:** `src/styles.css`, bloco `@media (prefers-reduced-motion: reduce)`

**Como quebra.** A regra aplica `animation-iteration-count: 1 !important` a
tudo. Quem tem "reduzir movimento" ligado no sistema — comum em quem sofre com
enjoo de movimento — vê o `Loader2 animate-spin` de
`features/projeto/{ResumoTab,ServicosTab,VariaveisTab,ExportarTab}.tsx` dar
**um quarto de volta e parar**. Um spinner parado lê como "travou", não como
"carregando".

**Correção mínima.** Excluir o que precisa girar para comunicar estado:

```css
@media (prefers-reduced-motion: reduce) {
  *:not(.animate-spin):not(.animate-spin *) { /* … */ }
}
```

Ou preferir trocar o spinner por uma barra de progresso indeterminada sem
rotação. A regra ainda deve matar `btn-pulse-gold` e `gold-shimmer`, que são
decorativos.

---

## P5 · MÉDIO · "Em aberto" nunca aparece marcada no menu Situação

**Status:** **RESOLVIDO** (2026-08-20) — passa sempre `[filtros.situacao]`.
**Arquivo:** `src/routes/_authenticated/dashboard.tsx`, `<MenuFiltro rotulo="Situação">`

**Como quebra.** A prop é
`selecionados={filtros.situacao === "abertos" ? [] : [filtros.situacao]}`. Como
"abertos" é o padrão, o menu abre com **nenhuma** opção marcada, e tocar em "Em
aberto" não muda nada visível. A pessoa fica sem saber qual filtro está valendo
— justamente o problema que os menus vieram resolver.

**Correção mínima.** Passar sempre `[filtros.situacao]`; usar `vazio` só para o
texto do botão fechado quando o valor é o padrão.

---

## P6 · MÉDIO · Roda sobre o cabeçalho da coluna arrasta o quadro

**Status:** **SEM OBJETO** desde a U17 — o handler de roda foi removido inteiro (quadro de página única).
**Arquivo:** `src/features/home/Quadro.tsx`, `naRoda`

**Como quebra.** A delegação usa `closest("[data-corpo-coluna]")`. O cabeçalho
da coluna é **irmão** do corpo rolante, não ancestral — então `closest` devolve
`null` e a roda vira movimento lateral. Com o cursor sobre o título da coluna
(alvo grande, e onde o olho está ao procurar uma coluna) a roda faz a coisa
errada.

**Correção mínima.** Marcar a coluna inteira (`data-coluna`) e, a partir dela,
buscar o corpo: `closest("[data-coluna]")?.querySelector("[data-corpo-coluna]")`.

---

## P7 · MÉDIO · O botão "Meu vínculo" não mostra o vínculo que está valendo

**Status:** PENDENTE · a confirmar
**Arquivo:** `src/features/home/lentes.ts` (`Preset.vinculo`) + `dashboard.tsx`

**Como quebra (alegado).** Presets como "Meu dia" e "Tudo meu" trazem um
`vinculo` implícito, aplicado em `aplicarLentes` quando o usuário não escolheu
nenhum. O botão "Vínculo", porém, reflete só a escolha manual — então o filtro
está aplicado e o botão diz que não há filtro.

**Correção sugerida.** Tirar o `vinculo` implícito do preset e mover a regra de
propriedade para dentro do `aplica` de cada preset. Aí o botão passa a refletir
exatamente o que é manual, sem estado escondido.

---

## P8 · MÉDIO · A barra de filtros quebra em três fileiras a 375px

**Status:** **RESOLVIDO** (2026-08-20) — trilho no celular, `flex-wrap` a partir de 1024px.
**Arquivo:** `src/routes/_authenticated/dashboard.tsx`, barra de controle

**Como quebra (alegado).** São cinco menus mais dois botões de ícone num
`flexWrap: "wrap"`. Em 375px isso empilha em três fileiras — e como o rótulo do
botão muda de largura conforme a seleção ("Padrão" → "Padrão: Sprint deste
mês"), os botões se rearranjam entre fileiras a cada escolha, deslocando a lista
abaixo.

**Correção sugerida.** Trilho horizontal (`.trilho-x`) no celular, mantendo
`flex-wrap` só a partir de 1024px. Altura da barra fica estável e a lista para
de pular.

---

## P9 · MÉDIO · Inércia do trackpad vaza para o quadro

**Status:** **SEM OBJETO** desde a U17 — a inércia do trackpad só vazava por causa do handler de roda, que não existe mais.
**Arquivo:** `src/features/home/Quadro.tsx`, `naRoda`

**Como quebra (alegado).** No macOS, terminar uma rolagem vertical dentro da
coluna deixa eventos de inércia chegando. Quando a coluna acaba, esses eventos
residuais viram movimento lateral e o quadro "escorrega" sozinho para o lado.

**Correção sugerida.** Ignorar eventos de roda por ~150ms depois que a coluna
esgota, ou exigir que o gesto comece com o quadro já no limite.

---

## P10 · BAIXO · "Mostrando 60 de N" vira uma célula da grade

**Status:** **RESOLVIDO** (2026-08-20) — `gridColumn: 1 / -1`.
**Arquivo:** `src/routes/_authenticated/dashboard.tsx`, fim da visão de lista

**Como quebra.** O aviso é filho direto de `.lista-atividades`, que virou grade
no desktop. Ele ocupa uma célula, ao lado do último card, em vez de ficar
centralizado embaixo.

**Correção mínima.** `style={{ gridColumn: "1 / -1" }}`.

---

## P11 · BAIXO · A regra de foco deforma botões arredondados

**Status:** **RESOLVIDO** (2026-08-20) — `border-radius` saiu da regra de foco.
**Arquivo:** `src/styles.css`, bloco `:focus-visible`

**Como quebra.** A regra inclui `border-radius: 8px`, que **sobrescreve** o raio
real do elemento enquanto ele está focado. Um chip de `border-radius: 999px`
vira retângulo de cantos suaves ao receber foco por teclado.

**Correção mínima.** Tirar `border-radius` da regra — `outline` já acompanha o
raio do elemento.

---

## P12 · BAIXO · `Esc` fecha o menu e larga o foco no `body`

**Status:** **RESOLVIDO** (2026-08-20) — `Esc` devolve o foco ao botão.
**Arquivo:** `src/features/home/MenuFiltro.tsx`

**Como quebra.** Quem navega por teclado abre o menu, aperta `Esc`, e perde a
posição: o próximo `Tab` recomeça do topo da página.

**Correção mínima.** Devolver o foco ao botão (`botaoRef.current?.focus()`) ao
fechar por `Esc`.

---

## Fora desta lista, mas registrado em outro lugar

- **Valor da compra legível demais** — `chamado_compra_select` usa
  `pode_acessar_chamado()`, que é verdadeiro quando `responsavel_id IS NULL`.
  É decisão de produto (S2/S3 do documento de decisões), não defeito de código.
  Ver `docs/PLANO_UNIFICACAO.md` §U9.
- **O rótulo "Aguardando início"** fica ao lado de "Aguardando aprovação". Não é
  defeito; é escolha a validar no uso.

## P13 — Amarelos fora da paleta em telas legadas (2026-08-20)

A auditoria da v7 varreu o sistema e achou amarelos de fora da paleta em telas
que a reforma de design ainda não alcançou:

- `visita.$id.pendente.tsx:444` — degradês avulsos terminando em `#FFA500`,
  `#FFB300`, `#FFD84D`, `#d49a00`, `#d4a800`, `#FFA000`;
- `gerencial.usuarios.tsx:496` — véu claro em `#fef3c7`/`#fde68a` (Tailwind
  amber) com o escuro já em `rgba(248,200,17,…)`;
- `chamados.indicadores.tsx:28` — cartelas categóricas com `#eda100`/`#E2791D`.

Não corrigidos porque estas telas estão fora do escopo da Início e serão
redesenhadas por inteiro na reforma v7 delas. Quando forem, os amarelos viram
`PRISMA.amarelo`/`SUPERNOVA` — e nada além.
