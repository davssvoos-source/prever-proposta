# Prever — Estrutura de Dashboard (v1, R65)

A anatomia formal do dashboard da página **Início** (`/dashboard`), peça por
peça — do fundo ao clique. Este documento existe para que o PRÓXIMO
dashboard do sistema nasça com exatamente a mesma estrutura, sem arqueologia
no código. Tudo aqui está implementado na Início e travado por asserção em
`scripts/verificar-logica.cjs`; nada é aspiração.

Complementa o `DESIGN_SYSTEM.md` (tokens gerais do app). Onde os dois
falarem do mesmo assunto, este detalha o CASO dashboard; aquele manda no
resto do sistema.

---

## 1. Fundo

O dashboard não pinta fundo próprio — ele flutua sobre o **Yellow Glow**
(`GlowBackground.tsx`, DESIGN_SYSTEM §5), que o layout autenticado
(`route.tsx`) já monta para todas as telas. Quatro camadas, na ordem:

1. **palco** — quase-preto quente `oklch(0.075 0.013 98)` (matiz 98 = o
   amarelo da marca); claro: `oklch(0.97 0.008 98)`;
2. **deriva** — duas manchas de luz amarela com `blur(80px)`, animadas em
   34s (`@keyframes deriva-glow`) — é o glow que o vidro desfoca;
3. **grade** — linhas de 40px mascaradas num oval central;
4. **granulado** — ruído SVG em `mix-blend-mode: overlay`.

Regra: **nenhum painel do dashboard declara fundo de página**. Painel é
superfície (§3) sobre o glow — é o fundo atravessando as bordas dos cards
que dá a profundidade da tela.

## 2. A régua (margens e larguras)

| Variável / classe | Valor | Papel |
|---|---|---|
| `--rail` | 0 (celular) · 232px (desktop) · 72px (sidebar recolhida) | deslocamento da sidebar; o `<main>` lê `padding-left: var(--rail)` |
| `--topo` | 76px (celular, header fixo) · 24px (desktop) | respiro acima do conteúdo |
| `<main>` | `mx-auto max-w-5xl lg:max-w-7xl`, padding lateral 16, `paddingBottom` 110 | a coluna de leitura |
| `.sangra-x` | sangria negativa compartilhada | faz faixa de painéis, título, filtros e quadro nascerem NA MESMA coluna — colados na régua da sidebar à esquerda, na borda da janela à direita |

Regra: **toda fileira estrutural do dashboard usa `.sangra-x`** (faixa de
painéis, cabeçalho da área de trabalho, barra de filtros, quadro/tabela).
Margem inventada por painel é o que desalinha telas irmãs.

## 3. Superfícies

- **Painel** = `card(isLight)` de `lib/ui` — `#ffffff` / `#141416`, borda
  `rgba(0,0,0,0.05)` / `rgba(255,255,255,0.06)`, raio 18, sombra em duas
  camadas (`0 1px 2px` + `0 10px 30px`). Nunca um gradiente próprio da tela.
- **Popover/menu** = `vidro(isLight)` (translúcido + `--vidro-blur`).
- Acabamentos de gráfico: `.textura` (especular + granulado) **só em área**
  — barras sim; linhas curvas finas NUNCA (o granulado serrilha o arco da
  rosca; o acabamento dela é o halo `feDropShadow` do próprio traço).

## 4. A faixa de painéis

```
[ Demanda no tempo (flex:2, min 430) | Meta do mês (224) | 4 KPIs (268) | Criar rápido ]
```

- Wrapper: `.so-desktop .sangra-x`, `gap: 14`, `alignItems: stretch`,
  `flexWrap: wrap` (entre 1024 e ~1400px quebra em duas linhas), `paddingTop: 6`.
- **`ALTURA = 252`** — todos os painéis da faixa têm a MESMA altura fixa.
  É a constante que mantém a fileira lendo como uma peça só.
- **O valor de `ALTURA` sai de um ORÇAMENTO, não do gosto**: some as faixas,
  os gaps, o respiro do topo e o `--topo` do layout, e o resultado tem de
  caber na parte da tela que o dashboard pode ocupar. O Painel Operacional
  (R68) fixa esse contrato em número — a lista começa acima da metade — e o
  verificador **refaz a conta**, então subir a altura quebra a asserção em
  vez de quebrar a tela em silêncio. Duas faixas de 168 lá; uma de 252 aqui.
- **Título é opcional.** O Painel Operacional abre direto no dashboard: o
  nome da tela já está aceso no menu à esquerda, e repeti-lo custa a faixa
  vertical do orçamento acima. `PainelBase` omite o cabeçalho — e encolhe o
  respiro de cima junto — quando não recebe `titulo`.
- A faixa é desktop-only (`.so-desktop`): no celular o espaço é do quadro.
- O quarto painel (Criar rápido) é AÇÃO, não indicador — ele não participa
  do drill-down (§7).

## 5. Cor

- **A rampa é o ESPECTRO** (`paleta.ts`, DESIGN_SYSTEM §11): 8 passos do
  degradê da casa. `ESPECTRO` pinta preenchimento; `ESPECTRO_TEXTO` pinta
  número (no claro divergem — o miolo amarelo não serve de texto sobre
  branco).
- **Barras: rampa INVERTIDA** — vermelho no passado, amarelo na semana
  corrente, azul no futuro. É a mesma leitura da faixa de prazo dos cards
  ("adiante" é azul). Cada barra vai da SUA cor à da SEGUINTE
  (`gradienteBarra(cor, corFim)`): o pé direito de uma emenda no pé
  esquerdo da próxima e as oito leem como um degradê contínuo.
- **Rosca: rampa na ordem ORIGINAL** (identidade do degradê, não eixo de
  tempo), percorrendo o arco via `linearGradient` com `ESPECTRO_STOPS`.
- **Gráfico em SVG (recharts): `paradasBarra(i, isLight)`.** `fill`/`stroke`
  de SVG não aceitam `linear-gradient()` de CSS, então a peça referencia um
  `<linearGradient>` por `url(#id)` e `paradasBarra` devolve as paradas dele
  — com a MESMA regra da costura de `gradienteBarra`. Um `<defs>` por
  gráfico, com **prefixo de id próprio**: dois `<defs>` com o mesmo id fazem
  o segundo gráfico herdar as cores do primeiro, em silêncio. Máx. 8 peças
  (`PECAS_ESPECTRO`); "Outros"/"Sem técnico"/"Sem cliente" ficam NEUTROS,
  fora da rampa — são ausência de identidade, não mais uma identidade.
  Legenda de fatia leva o MESMO degradê (via `gradienteBarra`, em CSS):
  legenda apontando para uma cor que não existe no gráfico é pior que
  legenda nenhuma. Número de legenda vai em `espectroTexto`, não na rampa de
  preenchimento.
- **KPIs: PRISMA** — azul (feito), amarelo (a fazer), laranja e vermelho (o
  que arde). As mesmas cores dos fundos de card do quadro: quem vê "3" em
  vermelho aqui procura os três cards vermelhos embaixo e os acha.
- **Um amarelo só na Início**: `PRISMA.amarelo` (`#F5BE45` / `#B5840F`).
  O dourado da marca (`#F8C811`) fica onde é gradiente — botões, logotipo.
- Micro-rótulo de seção sempre no amarelo do prisma (claro: tom escurecido).

## 6. Tipografia e espaçamento

| Papel | Fonte |
|---|---|
| Micro-rótulo do painel (`MICRO`) | Montserrat 700 · 10.5px · tracking 0.10em · caixa alta · amarelo |
| Número da barra | 700 · 13px · `tabular-nums` · cor de `ESPECTRO_TEXTO` |
| Número do KPI | 700 · 40px · glow na própria cor (`textShadow: 0 0 14px ${cor}59`) |
| % da rosca | **100 Thin** · 52px (no tamanho, o peso viraria ruído) |
| Rótulo de semana / do KPI | 400 · 10px / 9px caixa alta |

Espaçamentos canônicos: gap 14 entre painéis · padding de painel
`14px 18px 12px` · gap 3 entre colunas de barra · KPIs em grid 2×2 com gap
10, tiles `10px 12px`. Números em coluna sempre `tabular-nums`.

## 7. Dinamismo — TUDO no dashboard é dinâmico (R60 + R65)

### 7.1 Os quatro estados de toda peça

| Estado | Aparência |
|---|---|
| repouso | superfície `card()` |
| hover (só ponteiro fino) | `.elevavel` sobe 2px + sombra; número do KPI `scale(1.09)`; barra `scaleY(1.05)` + `brightness(1.18)`; rosca `scale(1.04)` |
| **ativo** (filtrando a lista) | **anel na própria cor**: KPI `border 1.5px ${cor}` + halo `0 0 0 3px ${cor}2E`; barra `box-shadow 0 0 0 2px ${corTexto}`; rosca anel dourado. Sempre com `aria-pressed` |
| desabilitado | sem cursor pointer (ex.: rosca sem meta no mês — não há o que abrir) |

Toda peça clicável é um `<button>` de verdade (acessível por teclado). Na
barra, o botão é a COLUNA inteira (número + barra + rótulo) — alvo
generoso; clicar numa barra de 3px não pode exigir pontaria.

### 7.2 A INVARIANTE central: quem conta é quem filtra

O número mostrado numa peça e a lista que o clique nela abre saem da
**MESMA função pura** (`metricas.ts`). É proibido reimplementar o predicado
na tela — foi assim que um painel já disse "42" com o quadro mostrando 6.

| Peça | Conta com | Clique abre |
|---|---|---|
| Tile de KPI | `atividadesDoKpi(chave, …).length` | `atividadesDoKpi(chave, …)` |
| Barra do passado | `concluidosPorSemana(…)[chave]` | `atividadesDaSemana(chave, true, …)` |
| Barra do futuro | `prazosPorSemana(…)[chave]` | `atividadesDaSemana(chave, false, …)` |
| Rosca da meta | `metaDoMes(…)` | `atividadesDaMeta(…)` |

Asserções marcadas CRÍTICO no verificador travam cada igualdade.

### 7.3 A semântica do drill-down

- **Um estado só**: `SelecaoPainel = {tipo:"kpi"} | {tipo:"semana"} |
  {tipo:"meta"}` — nunca duas peças ativas brigando pela lista.
  `atividadesDaSelecao()` despacha; `rotuloDaSelecao()` nomeia.
- **Local, não persistido**: drill-down é pergunta do momento, não
  preferência — fora de `sessionStorage`.
- **Toggle**: clicar de novo na mesma peça desliga.
- **Zera quando a base muda** (pessoa/vínculo/equipe): a lista nunca fica
  presa a um recorte que a tela já não anuncia.
- **Sempre anunciado**: a faixa "Mostrando: *rótulo* · limpar" acima da
  lista; o estado vazio nomeia a seleção culpada.
- **Substitui, não compõe**: a seleção vence preset/prazo — compor deixaria
  a lista menor que o número tocado, quebrando a invariante.

### 7.4 Movimento

- **Barras escorrem**: `height .45s cubic-bezier(.22,1,.36,1)` — declarada
  FORA do media de hover, para valer também no toque: mudar qualquer
  recorte anima as barras ao novo valor em vez de saltar.
- **Rosca preenche**: `stroke-dasharray .6s ease`.
- **Tema**: transição global de .35s (DESIGN_SYSTEM §4).
- **`prefers-reduced-motion`** desliga escorrer e pop — sempre.

## 8. Os dados dos painéis

Os painéis leem `paraPaineis` = `recorteDosPaineis(atividades ∪ histórico)`:

- **União com o histórico amplo**: o quadro poda encerrados com +7 dias; as
  barras do passado e a meta precisam do mês inteiro.
- **`recorteDosPaineis` filtra só QUEM e O QUÊ** (pessoa, vínculo, equipe,
  busca) — **nunca QUANDO ou ESTADO**. O gráfico fala de passado e futuro ao
  mesmo tempo: recorte por estado apaga uma das metades (defeito real,
  documentado em `lentes.ts`).
- Assim os painéis respondem aos filtros do quadro — filtrar por uma pessoa
  redesenha barras, rosca e KPIs para aquela pessoa.

## 9. Checklist — criando um novo dashboard

1. Nada de fundo próprio: monte sobre o `GlowBackground` do layout.
2. Toda fileira estrutural com `.sangra-x`; respiro `var(--topo)`.
3. Faixa de painéis: `gap 14`, `ALTURA` única, `flexWrap: wrap`,
   `.so-desktop` se houver versão de celular própria.
4. Painel = `card(isLight)` + `.elevavel`; micro-rótulo `MICRO` em amarelo.
5. Cores de DADO pelo `ESPECTRO`/`PRISMA` — nunca hex novo; texto de número
   por `ESPECTRO_TEXTO`; um amarelo só. Em SVG, `paradasBarra` + um `<defs>`
   com prefixo de id por gráfico.
6. **Cada conta em função pura** num `metricas.ts` do domínio — a tela só
   pinta.
7. **Cada peça clicável**: `<button aria-pressed>`, alvo generoso, hover de
   `.elevavel`, anel na própria cor quando ativa.
8. **Drill-down**: um `Selecao*` por tela + `atividadesDaSelecao` +
   `rotuloDaSelecao`; local, toggle, zera na troca de base, faixa
   "Mostrando:", substitui em vez de compor.
9. Movimento: valores animam (height/dasharray), fora do media de hover,
   com `prefers-reduced-motion` desligando.
10. Cada regra acima vira asserção no `verificar-logica.cjs` — em especial
    as igualdades "quem conta é quem filtra", marcadas CRÍTICO.
