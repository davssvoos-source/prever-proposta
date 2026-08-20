# Prever — Design System v2 (Supernova)

Contexto de design extraído do app **Prever Proposta**. Este documento é
autossuficiente: contém todos os tokens, padrões de componente e regras
necessárias para reproduzir a mesma identidade visual em outro sistema,
sem depender do código original.

Stack de referência: React + TypeScript, estilos inline (`style={{}}`) com
tokens em CSS custom properties. Os padrões abaixo funcionam igualmente em
Tailwind, CSS-in-JS ou CSS puro — o que importa são os valores.

---

## 1. Identidade

**Dark-first, dourado como único acento.** Fundo em degradê com glow,
superfícies elevadas em degradê sutil, e o dourado **Supernova** (`#F8C811`)
que carrega toda a hierarquia de ação. Desde a v2 (2026-08-20) a paleta segue
os tokens W3C fornecidos pelo Grupo Prever, com quatro escalas nomeadas —
Supernova (primária), Shamrock (sucesso), Christine (aviso) e Flush Mahogany
(erro) — e o desktop ganhou navegação lateral. Referências de layout: os
dashboards Nixtio (escuro) e "My Organization" (claro) escolhidos pelo Davi.

**Logotipo**: o arquivo oficial `public/logo-grupo-prever.png` (999×641, PNG
vazado), servido **sem modificação** pelo componente
`src/components/LogoPrever.tsx`. Monocromático dourado com transparência,
serve nos dois temas. Não aplicar filtro de cor nem recolorir.

Princípios que governam as decisões:

1. **Um acento só.** Dourado é ação, destaque e identidade. Nunca introduza
   uma segunda cor de marca; cores adicionais existem apenas como status
   semântico (sucesso/erro/info).
2. **Superfícies de VIDRO sobre o glow (v3, 2026-08-20).** Todo card é
   translúcido com desfoque (`backdrop-filter: var(--vidro-blur)`) sobre o
   fundo Yellow Glow — profundidade vem do fundo atravessando a superfície.
   No celular o desfoque é desligado pela variável (`--vidro-blur: none`):
   blur é caro na GPU, e lá fica a superfície semiopaca. Os valores:
   `rgba(18,18,24,0.52)` escuro / `rgba(255,255,255,0.58)` claro, borda
   `rgba(255,255,255,0.09)` / `rgba(255,255,255,0.72)`. A regra v1/v2
   ("nunca glassy") foi invertida pelo Davi junto com o fundo novo —
   referências Versa UI.
3. **Tipografia com peso, não com tamanho.** Montserrat SemiBold/Bold para
   títulos; hierarquia vem de peso, `letter-spacing` e maiúsculas.
4. **Rótulos em caixa alta espaçada.** Toda seção é anunciada por um micro-label
   de 10–11px, `letter-spacing` largo, maiúsculo — é a assinatura do sistema.
5. **Dois temas de verdade.** Claro não é o escuro invertido: é um conjunto
   próprio de valores. Nenhum componente pode ter cor fixa fora de um branch
   de tema (ver §8, o erro mais comum).

---

## 2. Tokens de cor

### 2.1 As quatro escalas (tokens W3C — `src/lib/paleta.ts`)

**Supernova — primária (o dourado da marca)**

| 50 | 100 | 200 | 300 | 400 ● | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#FEFCE8` | `#FEF9C3` | `#FDEE8B` | `#FCDE48` | `#F8C811` | `#E8B00A` | `#C88806` | `#A06108` | `#844C0F` | `#703E13` | `#422006` |

**Shamrock — sucesso**

| 50 | 100 | 200 | 300 | 400 ● | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#ECFDF7` | `#D1FAE9` | `#A7F3D7` | `#6EE7C2` | `#2DD2A5` | `#10B991` | `#059676` | `#047862` | `#065F4E` | `#064E42` | `#022C26` |

**Christine — aviso**

| 50 | 100 | 200 | 300 | 400 | 500 ● | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#FDF7ED` | `#FAE9CB` | `#F4D193` | `#EEB45B` | `#EA9A35` | `#E2791D` | `#C85917` | `#A63E17` | `#873119` | `#702917` | `#401208` |

**Flush Mahogany — erro**

| 50 | 100 | 200 | 300 | 400 | 500 | 600 ● | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#FDF3F4` | `#FDE3E5` | `#FBCDD0` | `#F7AAB0` | `#F17881` | `#E64D58` | `#D22D39` | `#B1242E` | `#92222A` | `#7A2228` | `#420D11` |

(● = tom-chave da escala, como marcado nos tokens.)

**Regra de tema, igual para as quatro escalas:**

| Papel | Escuro | Claro |
|---|---|---|
| primária (texto/ícone) | Supernova **400** `#F8C811` | Supernova **700** `#A06108` |
| sucesso | Shamrock **400** `#2DD2A5` | Shamrock **700** `#047862` |
| aviso | Christine **500** `#E2791D` | Christine **700** `#A63E17` |
| erro | Flush Mahogany **400** `#F17881` | Flush Mahogany **700** `#B1242E` |

> **Regra crítica (inalterada da v1):** tom 300–400 é para fundo escuro; sobre
> branco ele cai para ~2:1 de contraste. No claro, texto e ícone usam 600–700.

**Gradiente primário (CTA, pílula ativa do menu)** — idêntico nos dois temas:

```css
background: linear-gradient(135deg, #FCDE48, #F8C811, #E8B00A);  /* 300→400→500 */
color: #08090E;                                  /* SEMPRE texto escuro */
box-shadow: 0 6px 20px rgba(248,200,17,0.35);
```

**Matizes fora das escalas** (informativos, sem papel de marca — mantidos da
v1): azul `#60A5FA/#1d4ed8` (agendado), violeta `#9085e9/#4a3aa7` (em
andamento), lilás `#A78BFA/#6d28d9` (pedido de compra), teal `#2DD4BF/#0f766e`
(aguardando aprovação).

### 2.2 Superfícies

| Token | Escuro | Claro |
|---|---|---|
| `bg-base` (página) | `#08090E` | `#f4f5f7` |
| `bg-elevated` (card) | `#0F111A` | `#ffffff` |
| `bg-overlay` (popover/modal) | `#161926` | `#e8eaee` |
| `card-gradient` | `linear-gradient(160deg, #14141b 0%, #0b0b10 100%)` | `linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)` |
| `card-border` | `1px solid rgba(248,200,17,0.10)` | `1px solid rgba(0,0,0,0.07)` |
| `card-shadow` | `none` (ou glow) | `0 1px 6px rgba(0,0,0,0.07)` |
| `input-bg` | `linear-gradient(160deg, #14141b 0%, #0b0b10 100%)` | `#ffffff` |
| `input-border` | `1px solid rgba(255,255,255,0.10)` | `1px solid rgba(0,0,0,0.12)` |

### 2.3 Texto e ícone

| Token | Escuro | Claro |
|---|---|---|
| `text-primary` | `#ffffff` | `#0a0b0e` |
| `text-secondary` | `rgba(255,255,255,0.55)` | `#4a5060` |
| `text-muted` | `rgba(255,255,255,0.40)` | `#8a909e` |
| `text-on-gold` | `#08090E` | `#08090E` |
| `label-caps` (micro-label) | `rgba(248,200,17,0.65)` | `rgba(0,0,0,0.55)` |
| `border-subtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.07)` |
| `divider` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.07)` |
| `placeholder` | herda `text-muted` | `rgba(0,0,0,0.35)` |

### 2.4 Status semântico

Cada status tem trio `color` / `bg` / `border`. O `bg` é sempre a cor a 12%
e a `border` a 30% — mantenha essa proporção ao criar novos status.

| Status | Cor (escuro) | Cor (claro) | bg | border |
|---|---|---|---|---|
| Pendente / aviso | `#F8C811` | `#A06108` | `rgba(248,200,17,0.12)` | `rgba(248,200,17,0.30)` |
| Info / em análise | `#60A5FA` | `#1d4ed8` | `rgba(96,165,250,0.12)` | `rgba(96,165,250,0.30)` |
| Sucesso / aprovado | `#2DD2A5` | `#047862` | `rgba(52,211,153,0.12)` | `rgba(52,211,153,0.30)` |
| Erro / reprovado | `#F17881` | `#B1242E` | `rgba(248,113,113,0.12)` | `rgba(248,113,113,0.30)` |
| Neutro / vazio | `#9ca3af` | `#6b7280` | `rgba(156,163,175,0.10)` | `rgba(156,163,175,0.25)` |

> Status **nunca** é comunicado só por cor: sempre acompanha ícone + rótulo.

### 2.5 Botão de sucesso (confirmar/aprovar)

Verde sólido com brilho, usado para a ação de confirmação final:

```css
background: linear-gradient(135deg, #2DD2A5 0%, #059676 40%, #059669 100%);
color: #FFFFFF;
box-shadow: 0 4px 20px rgba(16,185,129,0.45),
            inset 0 0 0 1px rgba(110,231,183,0.35),
            inset 0 1px 0 rgba(255,255,255,0.20);
text-shadow: 0 1px 3px rgba(0,0,0,0.35);
```

---

## 3. Tipografia

**Família:** `"Montserrat", "Inter", ui-sans-serif, system-ui, sans-serif`
Pesos carregados: 200, 300, 400, 500, 600, 700.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
```

| Papel | Tamanho | Peso | Extras |
|---|---|---|---|
| Título de página | 22px | 600 | `letter-spacing: -0.02em` |
| Título de tela/header | 18px | 600 | `letter-spacing: 0.02em` |
| Título de card | 16px | 600 | — |
| **Micro-label de seção** | **10–11px** | **700** | `letter-spacing: 0.12–0.18em`, `text-transform: uppercase` |
| Corpo | 13–14px | 300–500 | — |
| Corpo secundário | 12px | 300 | cor `text-secondary` |
| Legenda/observação | 10–11px | 300 | cor `text-muted` |
| **Label de botão CTA** | **13px** | **700** | `letter-spacing: 0.16–0.18em`, `uppercase` |
| Valor monetário destaque | 20px | 800 | — |

O micro-label maiúsculo é o elemento mais característico do sistema —
use-o para abrir **toda** seção de conteúdo.

---

## 4. Forma, elevação e movimento

| Token | Valor |
|---|---|
| Raio base (`--radius`) | `1rem` (16px) |
| Raio de card | 16–18px |
| Raio de input/botão secundário | 12–14px |
| Raio de CTA (pílula) | 28px (metade da altura 56) |
| Raio de chip/badge | 999px (ou 12px em chips retangulares) |
| Raio de avatar/ícone circular | `50%` |
| Altura de CTA principal | 56px |
| Altura de input | 50–52px |
| Altura de botão secundário | 44–48px |
| Ícone de botão circular | 40×40px (ícone 18px) |
| Padding de card | `16–20px` vertical, `16–18px` horizontal |
| Gap entre cards | 12–16px |
| Gap interno (lista) | 8–10px |

**Transição global** (dá o efeito de troca suave de tema):

```css
*, *::before, *::after {
  transition: background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease;
}
```

Transições de interação: `all 0.15s` em botões/chips, `0.2s` em bordas.

**Textura de ruído** sobre o fundo escuro (sutileza que evita banding):

```css
body::before {
  content: '';
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
```

---

## 5. Fundos de página (v3 — Yellow Glow, importado do claude.design)

O fundo oficial é o **Yellow Glow Background** (claude.design, projeto
`5e4850a6`, arquivo `Yellow Glow Background - Export.dc.html`), traduzido de
DC para React em `GlowBackground.tsx`. Quatro camadas, na ordem:

1. **palco** — quase-preto quente, `oklch(0.075 0.013 98)` (matiz 98 = o
   amarelo da marca);
2. **deriva** — duas manchas de luz amarela (`oklch(0.72 0.17 84)` e
   `oklch(0.62 0.16 94)`) com `blur(80px)`, animadas em 34s
   (`@keyframes deriva-glow`, escala até 1.08) — é o glow que o vidro dos
   cards desfoca;
3. **grade** — linhas de 40px em `rgba(0,0,0,0.34)` mascaradas num oval
   central;
4. **granulado** — ruído SVG em `mix-blend-mode: overlay`, opacidade 0.4.

O tema claro é derivação: palco `oklch(0.97 0.008 98)`, manchas mais suaves
(`0.87/0.12` e `0.90/0.09`), grade a 0.08 e granulado a 0.22.

As telas públicas (login, redefinir senha) mantiveram os fundos da v1 por
enquanto — trocar é decisão à parte, o login tem identidade própria.

---

## 5b. Navegação — sidebar no desktop, barra no celular (v2)

| Contexto | Navegação |
|---|---|
| ≥ 1024px | **Sidebar fixa à esquerda, 232px** (`SideNav.tsx`): banner da fachada sangrando no topo, logotipo pousado sobre o degradê dele, itens com ícone+rótulo, alternador de tema e cartão de perfil no rodapé. Item ativo = pílula no gradiente primário com texto `#08090E`. |
| < 1024px | **Barra inferior flutuante** (`BottomNav.tsx`), como sempre foi — é onde o polegar alcança. |

Regras de implementação:
- As duas leem a **mesma lista** (`nav-itens.ts`) e a mesma matriz de
  permissões (U11). Menu novo = editar um arquivo.
- A troca é por **CSS** (`.so-desktop` / `.so-celular`, breakpoint 1024px),
  nunca por JS — media query não pisca no primeiro render.
- O deslocamento do conteúdo é a variável `--rail` (0 no celular, 232px no
  desktop). Header fixo usa `left: var(--rail)`; o wrapper do `<main>` usa
  `padding-left: var(--rail)`; a sangria `.sangra-x` compensa `var(--rail)/2`
  na margem — a conta está comentada no styles.css.
- O alternador de tema (`ThemeToggle.tsx`) é a pílula Light/Dark com botão
  deslizante + o disco sol/lua com crescente animado (adaptado do Uiverse de
  Pradeepsaranbishnoi; o degradê do sol é Supernova 300→500).
- **O banner da fachada é cabeçalho do MENU, não da Home.** No desktop a dobra
  da Início abre direto no trabalho; a identidade mora na sidebar. No celular
  o banner segue no topo da Home, com a frase "Você tem X atividades hoje" —
  lá não há sidebar para carregá-la.

### Alinhamento à margem do quadro

Faixa superior, barra de filtros e quadro compartilham a classe `.sangra-x`.
Sem isso, o quadro sangrava até a borda e os controles começavam onde o
`<main>` começa: nunca se alinhavam. Com a sangria compartilhada, título e
filtros nascem na coluna da primeira coluna do quadro, e a busca encosta na
margem da última.

### Campo de busca (`CampoBusca.tsx`)

Pílula clara com halo difuso e botão de lupa em bloco à direita — adaptação do
Uiverse de Gautammsharma. Três desvios do original, registrados: a paleta verde
virou a da marca (verde é *sucesso* aqui, usá-lo numa busca diria algo falso); o
`filter: blur` de uma div de sombra virou `box-shadow` no container (mesmo halo,
sem elemento extra nem camada de composição); e o tema escuro ganhou tratamento
próprio, porque o original é claro-only e a pílula branca sobre preto fica
estridente. No desktop mora na faixa superior; no celular abre pela lupa, onde
não há largura para conviver com os cinco filtros.

---

## 6. Padrões de componente

Todos os exemplos assumem uma variável booleana `isLight` disponível.

### 6.1 Card (bloco de conteúdo)

```jsx
const CARD = {
  background: isLight
    ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
    : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
  border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
  borderRadius: 18,
  padding: "20px 18px",
  boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
};
```

Variante "glass" (só no escuro, para sobrepor o fundo animado):
```jsx
background: "rgba(8,8,12,0.22)",
backdropFilter: "blur(24px) saturate(200%)",
```

### 6.2 Micro-label de seção

```jsx
const LABEL = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: isLight ? 600 : 300,
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: isLight ? "rgba(0,0,0,0.55)" : "rgba(248,200,17,0.65)",
  marginBottom: 8,
};
```

### 6.3 CTA primário (pílula dourada)

```jsx
const CTA_GOLD = {
  width: "100%", height: 56, borderRadius: 28, border: "none",
  background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
  color: "#08090E",                                  // nos DOIS temas
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700, fontSize: 13,
  letterSpacing: "0.16em", textTransform: "uppercase",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
  cursor: "pointer",
};
```

Variante outline: `background: transparent`, `color: #F59E0B`,
`border: 1.5px solid #F59E0B`.

### 6.4 Botão de seleção (opção marcável)

O padrão mais usado do app — grid de opções onde a selecionada vira dourada:

```jsx
{
  height: 60, borderRadius: 14,
  border: selected ? "none"
    : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
  background: selected
    ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
    : isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
  color: selected ? "#08090E" : isLight ? "#0a0b0e" : "#fff",
  boxShadow: selected ? "0 6px 20px rgba(248,200,17,0.35)" : undefined,
  fontWeight: 600, fontSize: 14, textTransform: "uppercase",
  transition: "all 0.15s",
}
```

### 6.5 Input / textarea

```jsx
{
  width: "100%", height: 52, borderRadius: 14, padding: "0 16px",
  background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
  color: isLight ? "#0a0b0e" : "#fff",
  fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
  outline: "none", boxSizing: "border-box",
  colorScheme: isLight ? "light" : "dark",   // obrigatório em date/time
}
```

### 6.6 Chip de status

```jsx
{
  padding: "4px 10px", borderRadius: 12,
  background: status.bg,                    // cor a 12%
  color: isLight ? status.colorDark : status.color,
  fontWeight: 600, fontSize: 10,
  letterSpacing: "0.06em", textTransform: "uppercase",
}
```

### 6.7 Botão circular de voltar (header)

```jsx
{
  width: 40, height: 40, borderRadius: 12,
  background: isLight ? "#ffffff" : "#191921",
  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
  color: isLight ? "#0a0b0e" : "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
  cursor: "pointer",
}
```

### 6.8 Header de tela

Botão voltar + título/subtítulo + indicador de passo (barrinhas de 20×4px):

```jsx
<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
  <button style={BACK_BTN}><ArrowLeft size={18} /></button>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontWeight: 600, fontSize: 18 }}>Título</div>
    <div style={{ fontSize: 12, color: textSecondary }}>Subtítulo</div>
  </div>
  <div style={{ display: "flex", gap: 4 }}>
    {[true, false, false].map((active, i) => (
      <div key={i} style={{
        width: 20, height: 4, borderRadius: 2,
        background: active ? gold : isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
      }} />
    ))}
  </div>
</div>
```

### 6.9 Barra de navegação flutuante (mobile)

Pílula centralizada, fixa acima da safe-area:

```jsx
{
  position: "fixed", left: "50%", bottom: "max(16px, env(safe-area-inset-bottom))",
  transform: "translateX(-50%)", zIndex: 50,
  display: "flex", gap: 8, padding: "10px 14px",
  background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
  backdropFilter: "blur(30px) saturate(180%)",
  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.22)",
  borderRadius: 40, minWidth: 220,
  boxShadow: isLight
    ? "0 6px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.03) inset"
    : "0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.04) inset",
}
```

Item ativo: fundo `rgba(160,97,8,0.10)` (claro) / `rgba(255,255,255,0.12)` (escuro),
ícone com `strokeWidth` 2.4 (vs 1.8), ponto de 4px abaixo, e glow
`drop-shadow(0 0 8px …)` apenas no escuro.

### 6.10 Modal / popup

```jsx
// backdrop
{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", zIndex: 90 }

// painel
{
  position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
  width: "min(440px, 92vw)", maxHeight: "86vh", overflowY: "auto", zIndex: 100,
  borderRadius: 18, padding: "20px 18px",
  background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(252,222,72,0.16)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
}
```

### 6.11 Linha de lista (chave → valor)

```jsx
{
  display: "flex", justifyContent: "space-between", alignItems: "baseline",
  gap: 10, padding: "7px 0",
  borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
}
// label: fontSize 13, fontWeight 600
// valor: fontSize 13, fontWeight 700, color: gold
```

---

## 7. Arquitetura de tema

Um contexto simples com persistência em `localStorage` e atributo no `<html>`:

```tsx
type Theme = "dark" | "light";

// no provider:
useEffect(() => {
  localStorage.setItem("app-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}, [theme]);

// consumo:
const { isLight, toggleTheme } = useTheme();
```

Os tokens globais vivem em CSS custom properties, sobrescritos por
`[data-theme="light"]`; os componentes leem `isLight` para os valores que
precisam ser calculados em JS.

```css
:root {                          /* escuro = padrão */
  --bg-base: #08090E;   --text-primary: #ffffff;
  --text-secondary: #9CA3AF;   --text-muted: #4B5563;
  --border-color: rgba(255,255,255,0.08);
  --gold-primary: #F8C811;
}
[data-theme="light"] {
  --bg-base: #f4f5f7;   --text-primary: #0a0b0e;
  --text-secondary: #4a5060;   --text-muted: #8a909e;
  --border-color: rgba(0,0,0,0.10);
  --gold-primary: #A06108;
}
```

---

## 8. Anti-padrões (erros reais já cometidos neste sistema)

Todos abaixo foram bugs de produção — verifique cada um antes de entregar.

1. **Cor fixa fora de branch de tema.** Qualquer `color: "#fff"` ou
   `background: "linear-gradient(160deg,#14141b…)"` sem `isLight ?` é um bug
   esperando o usuário trocar de tema. Varredura obrigatória:
   ```bash
   grep -rnE 'color: ?"#fff|color: ?"rgba\(255, ?255, ?255' src/ | grep -v isLight
   grep -rnE 'background: ?"(linear-gradient\(160deg, ?#14141b|#191921|#101014)' src/ | grep -v isLight
   ```
2. **Texto branco sobre o gradiente dourado.** ~2:1 de contraste. Use `#08090E`.
3. **Dourado `#F8C811` como texto/ícone no modo claro.** Use `#A06108`.
4. **Constantes de estilo em nível de módulo.** `const CARD = {…}` fora do
   componente não enxerga o tema — transforme em função: `cardStyle(isLight)`.
5. **`colorScheme` fixo em inputs nativos.** `colorScheme: "dark"` num
   `datetime-local` renderiza o calendário escuro sobre página clara.
6. **Header dependente de scroll.** Cor de texto que só considera o estado
   "rolado" some no topo da página no tema oposto.
7. **Componentes de biblioteca (shadcn/ui) com estilo escuro embutido.** O
   `Card` base precisa ler o tema também.
8. **Sombra escura no tema claro.** No claro use `0 1px 6px rgba(0,0,0,0.07)`;
   sombras fortes sujam o layout.

---

## 9. Visualização de dados

Paleta categórica validada para daltonismo (ΔE ≥ 8 em deuteranopia/protanopia,
≥ 15 em visão normal, contraste ≥ 3:1 contra a superfície) — **ordem fixa,
nunca cicle as cores**:

| Slot | Escuro | Claro |
|---|---|---|
| 1 | `#3987e5` | `#2a78d6` |
| 2 | `#008300` | `#008300` |
| 3 | `#d55181` | `#e87ba4` |
| 4 | `#E2791D` | `#eda100` |
| 5 | `#199e70` | `#1baf7a` |
| 6 | `#d95926` | `#eb6834` |
| 7 | `#9085e9` | `#4a3aa7` |
| 8 | `#e66767` | `#e34948` |

Regras:
- Máximo 8 séries; o excedente agrupa em **"Outros"** (cinza `#6b7280` /
  `#9ca3af`), nunca uma 9ª cor gerada.
- Separação de 2px entre fatias/segmentos, na cor da superfície.
- Identidade **nunca** só por cor: legenda com chip + nome + valor.
- Donut com valor total no centro; tooltip com valor absoluto e percentual.

---

## 10. Checklist de conformidade

- [ ] Montserrat carregada com pesos 300/400/600/700
- [ ] Fundo radial + textura de ruído aplicados no `body`
- [ ] Toda seção aberta por micro-label maiúsculo espaçado
- [ ] CTA principal = pílula dourada 56px com texto escuro maiúsculo espaçado
- [ ] Cards com gradiente (160° escuro / 135° claro), raio 16–18px
- [ ] Nenhuma cor fixa fora de branch de tema (rodar os `grep` da §8)
- [ ] Dourado escurecido para `#A06108` em todo texto/ícone do tema claro
- [ ] Inputs com `colorScheme` acompanhando o tema
- [ ] Status sempre com ícone + rótulo, nunca só cor
- [ ] Transição global de 0.35s para troca de tema
- [ ] Navegação inferior flutuante respeitando `env(safe-area-inset-bottom)`

---

## 11. Espectro de gráfico (v4.1 — 2026-08-20)

Rampa de 8 cores para séries de dados, derivada das cores escolhidas pelo Davi
(`#411139 #d8ad1a #01847f #AA1C41 #760031 #403D88 #7F2020`).

**O que foi feito com elas.** As matizes foram mantidas; a luminosidade e o
croma, normalizados. As originais iam de **L\*0.28 a L\*0.77** — quase três
vezes de diferença, o que numa série faz barra sumir e barra gritar. Agora as
oito têm a mesma L e o mesmo croma em oklch, com as matizes espaçadas do frio
ao quente.

| # | Escuro (L .74 / C .145) | Claro (L .52 / C .155) |
|---|---|---|
| 0 | `#00C6C7` | `#008284` |
| 1 | `#20B9F6` | `#0074B1` |
| 2 | `#84A6FF` | `#4360C1` |
| 3 | `#B994F8` | `#784FB3` |
| 4 | `#DB88D9` | `#964295` |
| 5 | `#EF82B4` | `#A73A72` |
| 6 | `#F98281` | `#B1393E` |
| 7 | `#DC9E24` | `#985900` |

**Uso:** `espectro(i, isLight)` em `src/lib/paleta.ts`, com laço para séries de
qualquer tamanho. Como a rampa é perceptualmente contínua, séries vizinhas se
emendam: no gráfico de barras, cada barra vai da própria cor à cor da seguinte
(`linear-gradient(90deg, cor, corFim)`), e as oito lêem como um degradê só.

**Textura.** Duas classes em `styles.css`, ambas por pseudo-elemento:

- `.textura` — brilho especular (`::before`) + granulado em `soft-light`
  (`::after`). É o "glossy ofuscado" das barras e de qualquer superfície de
  dado colorida.
- `.ruido` — só o granulado, em `overlay`. Para ícones, pastilhas e avatares,
  onde o especular seria demais.

O granulado vem de `--ruido`, um SVG `feTurbulence` inline reaproveitado pelas
duas.
