# Prever — Design System v2 (Supernova)

<!-- sumario:inicio -->
> **Sumário** — 52 seções. Gerado por `node scripts/sumario.cjs`; não edite à mão. Para ir a uma seção: `grep -n "^## <título>"` no arquivo.

- [1. Identidade](#1-identidade)
- [2. Tokens de cor](#2-tokens-de-cor)
  - [2.1 As quatro escalas (tokens W3C — `src/lib/paleta.ts`)](#21-as-quatro-escalas-tokens-w3c-srclibpaletats)
  - [2.2 Superfícies](#22-superfícies)
  - [2.3 Texto e ícone](#23-texto-e-ícone)
  - [2.4 Status semântico](#24-status-semântico)
  - [2.5 Botão de sucesso (confirmar/aprovar)](#25-botão-de-sucesso-confirmaraprovar)
- [3. Tipografia](#3-tipografia)
- [4. Forma, elevação e movimento](#4-forma-elevação-e-movimento)
- [5. Fundos de página (v4 minimalista · v10 no claro)](#5-fundos-de-página-v4-minimalista-v10-no-claro)
- [5b. Navegação — sidebar no desktop, barra no celular (v2)](#5b-navegação-sidebar-no-desktop-barra-no-celular-v2)
  - [Alinhamento à margem do quadro](#alinhamento-à-margem-do-quadro)
  - [Campo de busca (`CampoBusca.tsx`)](#campo-de-busca-campobuscatsx)
- [6. Padrões de componente](#6-padrões-de-componente)
  - [6.1 Card (bloco de conteúdo)](#61-card-bloco-de-conteúdo)
  - [6.2 Micro-label de seção (v2 — 2026-09-10, R243)](#62-micro-label-de-seção-v2-2026-09-10-r243)
  - [6.2b Popover de lista dentro de um diálogo (R243)](#62b-popover-de-lista-dentro-de-um-diálogo-r243)
  - [6.3 CTA primário (pílula dourada)](#63-cta-primário-pílula-dourada)
  - [6.4 Botão de seleção (opção marcável)](#64-botão-de-seleção-opção-marcável)
  - [6.5 Input / textarea](#65-input-textarea)
  - [6.6 Chip de status](#66-chip-de-status)
  - [6.7 Botão circular de voltar (header)](#67-botão-circular-de-voltar-header)
  - [6.8 Header de tela](#68-header-de-tela)
  - [6.9 Barra de navegação flutuante (mobile)](#69-barra-de-navegação-flutuante-mobile)
  - [6.10 Modal / popup](#610-modal-popup)
  - [6.11 Linha de lista (chave → valor)](#611-linha-de-lista-chave-valor)
  - [6.12 Card de atividade — a cor hierárquica só na borda (v10 — 2026-09-04)](#612-card-de-atividade-a-cor-hierárquica-só-na-borda-v10-2026-09-04)
  - [6.14 Etiqueta — a categoria PREENCHIDA (v11 — 2026-09-04, R177)](#614-etiqueta-a-categoria-preenchida-v11-2026-09-04-r177)
  - [6.15 Avatar — sem glow (v11 — 2026-09-04, R176)](#615-avatar-sem-glow-v11-2026-09-04-r176)
  - [6.16 Configurador rápido — o painel da atividade (v12 — 2026-09-04, R183–R185)](#616-configurador-rápido-o-painel-da-atividade-v12-2026-09-04-r183r185)
  - [6.17 Calendário — o card tingido e a dica expandida (v12 — 2026-09-04, R187–R191)](#617-calendário-o-card-tingido-e-a-dica-expandida-v12-2026-09-04-r187r191)
  - [6.18 Página em duas colunas — o Administrativo (v12 — 2026-09-04, R193)](#618-página-em-duas-colunas-o-administrativo-v12-2026-09-04-r193)
  - [6.19 Formulário em colunas — a Nova Visita (v12 — 2026-09-04, R194)](#619-formulário-em-colunas-a-nova-visita-v12-2026-09-04-r194)
  - [6.20 Ficha do cliente — três colunas de desktop, os dois painéis do vínculo e os cards editáveis (v15 — 2026-09-08, R200–R210)](#620-ficha-do-cliente-três-colunas-de-desktop-os-dois-painéis-do-vínculo-e-os-cards-editáveis-v15-2026-09-08-r200r210)
  - [6.13 Card de cliente — a fachada sobreposta (v8 — 2026-09-03)](#613-card-de-cliente-a-fachada-sobreposta-v8-2026-09-03)
  - [6.21 O chat da Início — botão flutuante, a conversa 9:16, o campo colorido e as caixas de mensagem (v17 — 2026-09-09, R215–R217, R222–R223, R240)](#621-o-chat-da-início-botão-flutuante-a-conversa-916-o-campo-colorido-e-as-caixas-de-mensagem-v17-2026-09-09-r215r217-r222r223-r240)
  - [6.22 O editor de texto — uma área, blocos com marcador próprio, menção como chip (v16 — 2026-09-08, R135, R224)](#622-o-editor-de-texto-uma-área-blocos-com-marcador-próprio-menção-como-chip-v16-2026-09-08-r135-r224)
  - [6.23 A tela da atividade — documento à esquerda, ficha à direita (v19 — 2026-09-08, R234–R239)](#623-a-tela-da-atividade-documento-à-esquerda-ficha-à-direita-v19-2026-09-08-r234r239)
  - [6.24 Os dois quadros — o realce do "A seguir" e o quadro do Comercial (v21 — 2026-09-10, R248/R252)](#624-os-dois-quadros-o-realce-do-a-seguir-e-o-quadro-do-comercial-v21-2026-09-10-r248r252)
- [7. Arquitetura de tema](#7-arquitetura-de-tema)
- [8. Anti-padrões (erros reais já cometidos neste sistema)](#8-anti-padrões-erros-reais-já-cometidos-neste-sistema)
- [9. Visualização de dados](#9-visualização-de-dados)
- [10. Checklist de conformidade](#10-checklist-de-conformidade)
- [11. PRISMA — a paleta do degradê (v5 — 2026-08-20)](#11-prisma-a-paleta-do-degradê-v5-2026-08-20)
  - [11.1 As nove cores](#111-as-nove-cores)
  - [11.2 O degradê (v7 — 2026-08-20)](#112-o-degradê-v7-2026-08-20)
  - [11.3 Prazo → cor da BORDA do card (v8 — 2026-09-03, R136)](#113-prazo-cor-da-borda-do-card-v8-2026-09-03-r136)
  - [11.4 Os efeitos, e quando cada um cabe](#114-os-efeitos-e-quando-cada-um-cabe)
  - [11.5 Um amarelo só](#115-um-amarelo-só)
- [12. Tipografia (v12 — 2026-09-04, R195)](#12-tipografia-v12-2026-09-04-r195)
- [13. Avatares sem foto](#13-avatares-sem-foto)
- [14. O campo "Abrir chamado"](#14-o-campo-abrir-chamado)
<!-- sumario:fim -->

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

**O sistema é ferramenta de trabalho (v11 — 2026-09-04, R174).** Quem usa o
app passa horas nele; o que impressiona numa demonstração cansa num turno.
Luminosidade e cor saturada valem onde carregam informação — a ação principal,
o que está atrasado, o que pede atenção. O resto é superfície neutra e
tipografia. Glow decorativo não entra, e o que já existe se justifica ou sai:
foi assim que o halo dos avatares saiu (R176), o painel de indicadores da
Início ganhou botão de recolher (R175) e a etiqueta trocou o véu colorido por
preenchimento sólido (R177, §6.14).

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
color: #0E0E0E;                                  /* SEMPRE texto escuro */
box-shadow: 0 6px 20px rgba(248,200,17,0.35);
```

**Matizes fora das escalas** (informativos, sem papel de marca — mantidos da
v1): azul `#60A5FA/#1d4ed8` (agendado), violeta `#9085e9/#4a3aa7` (em
andamento), lilás `#A78BFA/#6d28d9` (pedido de compra), teal `#2DD4BF/#0f766e`
(aguardando aprovação).

### 2.2 Superfícies

| Token | Escuro | Claro |
|---|---|---|
| `bg-base` (página) | `#0E0E0E` | `#e9e9e9` |
| `bg-elevated` (card) | `#141414` | `#ffffff` |
| `bg-overlay` (popover/modal) | `#1b1b1b` | `#e8e8e8` |
| `card-gradient` | `linear-gradient(160deg, #161616 0%, #101010 100%)` | `linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)` |
| `card-border` | `1px solid rgba(248,200,17,0.10)` | `1px solid rgba(0,0,0,0.07)` |
| `card-shadow` | `none` (ou glow) | `0 1px 6px rgba(0,0,0,0.07)` |
| `input-bg` | `linear-gradient(160deg, #161616 0%, #101010 100%)` | `#ffffff` |
| `input-border` | `1px solid rgba(255,255,255,0.10)` | `1px solid rgba(0,0,0,0.12)` |

**v10 (2026-09-04, R154) — o claro desceu.** Até a v9 a página clara começava
em `#ffffff` e o card era `#ffffff`: 1.09:1 entre os dois, o card sumia. Davi:
"o fundo deveria ser um branco mais escuro e os cards um branco mais claro".
Agora a **página é `#e9e9e9`** (degradê `#eeeeee → #e9e9e9 → #e2e2e2`, §5) e o
**card segue `#ffffff`** — 1.19:1, o card lê como superfície. Popover/modal
(`bg-overlay`) não mudou.

**v12 (2026-09-04, R186) — o cinza neutro.** Davi: "O Fundo está com tons de
azul, eu quero que você utilize somente tons de cinza". Até a U108 as
superfícies puxavam para o azul (08090E, 0F111A, 161926, e9ebef — sem o "#",
para a varredura do cinza não as caçar); a tabela acima já está nos valores
novos. A escala é `CINZA` em `src/lib/paleta.ts` — cada degrau é cinza **puro**
(R = G = B), e o verificador cobra isso:

| Degrau | Escuro | Claro | Onde |
|---|---|---|---|
| `pagina` | `#0e0e0e` | `#e9e9e9` | o fundo da página |
| `superficie` | `#141414` | `#ffffff` | card, painel lateral |
| `elevada` | `#1b1b1b` | `#f4f4f4` | cabeçalho de painel, menu |
| `campo` | `#222222` | `#f7f7f7` | input, chip neutro |
| `divisoria` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.10)` | bordas e linhas |

A escala **nasceu na U104** (o Configurador rápido, §6.16, foi a primeira tela
a pintar com ela) e a **U108 varreu o resto**: 29 hexes azulados trocados em
cem arquivos — superfícies pela escala, e o texto neutro por cinzas de **mesma
luminância** (`#1e2229` → `#212121`, `#4a5060` → `#505050`, `#7d8391` →
`#727272`, `#5a6172` → `#616161`), de modo que os contrastes medidos da R154
continuam: 16:1 no card, 13,4:1 na página, 7:1 o secundário, 3,9:1 o apagado.
O texto sobre dourado (`text-on-gold`) foi de `08090E` para `#0E0E0E` pelo mesmo
motivo. Uma segunda passada pegou mais 21 cinzas frios menores (06070b, 0b0d14,
11131d, 1a1a22, e4e7ec, f3f4f6…), também para cinzas de mesma luminância; as
tintas de verdade (o verde de sucesso, o rosa de erro, o dourado escuro) ficaram.
Duas asserções travam a volta: nenhum dos 50 pode reaparecer em `src/`, e
**nenhum cinza que puxe para o azul** (canal azul à frente dos outros em até 16)
pode entrar. Os degradês de card (`CARD_BG_DARK`, `card-gradient`) viraram
`#161616 → #101010`.

### 2.3 Texto e ícone

| Token | Escuro | Claro |
|---|---|---|
| `text-primary` | `#ffffff` | `#212121` |
| `text-secondary` | `rgba(255,255,255,0.55)` | `#505050` |
| `text-muted` | `rgba(255,255,255,0.40)` | `#727272` |
| `text-on-gold` | `#0E0E0E` | `#0E0E0E` |
| `label-caps` (micro-label) | `rgba(248,200,17,0.65)` | `rgba(0,0,0,0.55)` |
| `border-subtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.07)` |
| `divider` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.07)` |
| `placeholder` | herda `text-muted` | `rgba(0,0,0,0.35)` |

**v10 (R154):** o texto primário claro era `#0a0b0e`, quase preto; Davi pediu
"um cinza bem escuro". `#212121` dá 16:1 sobre o card e 13:1 sobre a página
nova. `text-muted` subiu de `#8a909e` (3,2:1) para `#727272` (3,9:1) para não
perder leitura na página mais escura. `text-secondary` (`#505050`, 6,7:1 sobre
a página) não mudou.

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
| Título de página | 22px | 700 | `letter-spacing: -0.02em` (R195: era 600) |
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

## 5. Fundos de página (v4 minimalista · v10 no claro)

O fundo é um **degradê vertical puro**, sem camadas (`GlowBackground.tsx`,
v4 — 2026-08-20): no minimalismo apple-like o fundo é silêncio, e a
profundidade vem da sombra dos cards e do vidro dos painéis.

| tema | degradê (180deg) |
|---|---|
| escuro | `#131315 0%` → `#0a0a0b 45%` → `#030303 100%` |
| claro (v10) | `#eeeeee 0%` → `#e9e9e9 55%` → `#e2e2e2 100%` |

O claro **desceu na v10** (2026-09-04, R154): até então ia de `#ffffff` a
`#ebebee`, e o card branco (§6.1) sumia na página (1.09:1). Com a página em
`#e9e9e9` o card é o branco mais claro da tela (1.19:1) — Davi: "o fundo
deveria ser um branco mais escuro e os cards um branco mais claro".

Por cima do degradê o `body::before` põe um granulado SVG a 2,5% de
opacidade, igual nos dois temas. A cor de base do `body` (`--bg-base`) é o que
aparece no overscroll e antes do React: `#0E0E0E` / `#e9e9e9`.

**História.** A v3 (Yellow Glow, importado do claude.design) tinha quatro
camadas — palco, duas manchas de luz amarela animadas, grade e granulado. Saiu
na v4: sobre um degradê quase liso, o glow virava ruído. As telas públicas
(login, redefinir senha) mantêm os fundos da v1 — o login tem identidade
própria.

---

## 5b. Navegação — sidebar no desktop, barra no celular (v2)

| Contexto | Navegação |
|---|---|
| ≥ 1024px | **Sidebar fixa à esquerda, 232px** (`SideNav.tsx`): banner da fachada sangrando no topo, logotipo pousado sobre o degradê dele, itens com ícone+rótulo, alternador de tema e cartão de perfil no rodapé. Item ativo = pílula no gradiente primário com texto `#0E0E0E`. |
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
- **A RÉGUA DE MARGEM (`--gutter`, R239, v2 — 2026-09-08).** Uma variável, o
  sistema inteiro: **16px** no celular, **24px** no desktop. Quem a lê: o
  `<main>` (`padding-left/right`), a sangria `.sangra-x`, e as páginas largas.
  Nenhuma tela tem padding lateral próprio — foi assim que a Início, a
  atividade e a ficha do cliente acabaram com quatro margens diferentes (16,
  24, 28 e 40), que é o que a R239 veio corrigir.
- **Página larga é UMA receita**: `main:has(.pagina-larga)` /
  `main:has(.pagina-trabalho)` solta o teto de 1280px do `<main>`, e a margem
  continua sendo `--gutter`. A classe na raiz da página, e
  `paddingTop`/`paddingBottom` em vez do atalho `padding` (anti-padrão nº 10).
- **A meia barra de rolagem (`--barra`)**: a largura da janela conta a barra de
  rolagem e a do container não, então a sangria por viewport escorregava meia
  barra para a esquerda — o quadro da Início começava em 249 e a atividade em
  256 (MEDIDO em 1920). O CSS não sabe essa largura; o `route.tsx` mede
  (`innerWidth − clientWidth`, no load e no resize) e escreve `--barra`, que a
  `.sangra-x` desconta pela metade nos dois lados. Piso `0px`: sem o JS o
  comportamento é o de antes, não um layout quebrado. Depois disso as três
  telas MEDEM 256 à esquerda e 24 à direita em 1920.
- **As camadas (z-index)**, de baixo para cima: conteúdo `1` · barra inferior
  do celular `50` · menu lateral `55` · botão flutuante e popover de
  notificações `60` · **diálogo e folha lateral `70`** · avisos (sonner) acima
  de tudo. Um modal cobre a casca INTEIRA, inclusive o menu — era o contrário
  disto (menu em 55, diálogo em 50) que cortava o pop-up da atividade em 232px
  (R239).
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
    ? "linear-gradient(135deg,#ffffff 0%,#f5f5f5 100%)"
    : "linear-gradient(160deg, #161616 0%, #101010 100%)",
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

### 6.2 Micro-label de seção (v2 — 2026-09-10, R243)

O rótulo que anuncia um bloco: PROBLEMA DETECTADO, FICHA, COMENTÁRIOS,
PROGRESSO, FOTOS E ARQUIVOS. **Mora num lugar só** — `rotuloDeSecao(isLight)`,
em `src/lib/ui.ts`. Era uma constante copiada byte a byte em cinco telas
(DetalheInterno, DetalheCampo, FormularioChamadoTecnico, CronogramaObra,
PainelDoPlantao), e subir o tamanho numa deixaria as outras quatro dizendo a
mesma coisa menor.

```jsx
export const rotuloDeSecao = (isLight) => ({
  fontFamily: FONT, fontWeight: 700,
  fontSize: 12,                       // R243: era 10 — "aumente algo em torno de 20%"
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
});
```

O rótulo de CAMPO (o de um input, dentro de um formulário) é outro e continua
menor — 10/600 com `0.12em`, `LABEL` na tela que o usa. Seção anuncia bloco;
campo anuncia caixa.

### 6.2b Popover de lista dentro de um diálogo (R243)

Todo menu que abre por portal — `SeletorDeOpcao`, `MenuFiltro` — desenha-se no
`<body>`. **Dentro de um diálogo modal isso não funciona**, e o defeito é
silencioso: o Radix põe `pointer-events: none` no `<body>` e devolve `auto` só
para a árvore do diálogo, então a lista fica INERTE e o clique atravessa para o
véu, que fecha a janela. A regra:

- o alvo do portal é `botao.closest('[role="dialog"]') ?? document.body`,
  decidido ao ABRIR (não a cada render);
- dentro de um ancestral com `transform` (o Radix centra o diálogo com
  `translate`), `position: fixed` mede a partir da caixa de **padding** dele —
  as coordenadas saem relativas ao container e descontam `clientLeft`/
  `clientTop` (MEDIDO: sem o desconto o menu cai 1px fora);
- o limite de "não vazar" passa a ser a caixa do diálogo, o que também impede o
  corte pelo `overflow: hidden` dele;
- `pointerEvents: "auto"` no menu, de qualquer forma — dentro é redundante e
  barato, fora é a garantia.

### 6.3 CTA primário (pílula dourada)

```jsx
const CTA_GOLD = {
  width: "100%", height: 56, borderRadius: 28, border: "none",
  background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
  color: "#0E0E0E",                                  // nos DOIS temas
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

O padrão mais usado do app. **Use `botaoSelecao(ativo, isLight, cor)` de
`lib/ui.ts`** — não escreva o estilo à mão (havia três cópias divergentes antes
da U72).

**A cor é a da coisa escolhida, não o dourado** (R87, 2026-08-26). Status pega
a cor do status, equipe a da equipe, classificação a do tipo. A fileira inteira
fica colorida: a opção ativa ganha o degradê e o relevo, as outras ficam no véu
da própria cor.

```jsx
// ativo, com cor própria
{
  background: degradeDaCor(cor.dark),   // 3 paradas, 135deg, como o dourado
  color: tintaSobreDegrade(cor.dark),   // decidido por CONTRASTE, >= 4.5:1
  border: "none",
  boxShadow: `0 6px 20px rgba(${rgb},0.35)`,
}
// inativo, com cor própria
{ background: cor.bg, color: isLight ? cor.light : cor.dark, border: `1px solid ${cor.border}` }
```

Sem cor própria (sprint, por exemplo), o dourado da marca segue valendo.

**Por que mudou:** quando toda opção escolhida fica dourada, a cor deixa de
dizer QUAL opção foi escolhida e passa a dizer só "está selecionado" — coisa
que a forma do botão já dizia. O canal mais forte da interface estava sendo
gasto à toa.

**O degradê é igual nos dois temas**, como o dourado sempre foi (§2.1): parte
de `cor.dark`, o tom saturado, não do par de tema. Não é o anti-padrão nº 1 —
é a mesma decisão que o `GRAD_PRIMARIA` já tomava, e a legibilidade vem da
tinta calculada, não do tema.

**Botão de AÇÃO continua dourado** (§6.3). Ali o dourado é a marca, não uma
escala — e é essa distinção que faz "escolher" e "confirmar" parecerem coisas
diferentes.

### 6.5 Input / textarea

```jsx
{
  width: "100%", height: 52, borderRadius: 14, padding: "0 16px",
  background: isLight ? "#ffffff" : "linear-gradient(160deg, #161616 0%, #101010 100%)",
  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
  color: isLight ? "#212121" : "#fff",
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
  background: isLight ? "#ffffff" : "#1b1b1b",
  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
  color: isLight ? "#212121" : "#fff",
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
  background: isLight ? "#ffffff" : "linear-gradient(160deg, #161616 0%, #101010 100%)",
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
  background: isLight ? "#ffffff" : "linear-gradient(160deg, #161616 0%, #101010 100%)",
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

### 6.12 Card de atividade — a cor hierárquica só na borda (v10 — 2026-09-04)

É o card do quadro por status da Início (`CardAtividade.tsx`), regra R136.
Até 2026-09-03 o fundo inteiro levava um véu da cor do prazo. A partir da
R136, **o fundo é sempre a superfície neutra do tema** — `#141414` no escuro,
`#ffffff` no claro, o mesmo de qualquer card — e **só a borda reage à cor
hierárquica**: um degradê do tom claro ao tom escuro da MESMA cor, contornado
por um glow externo bem fraco. Nada no fundo, nada nos chips.

Cinco estados: quatro cores (a §11.3 diz qual cor em qual situação) e o
neutro.

```jsx
// A superfície neutra do tema — a mesma de qualquer card (ui.ts: card()).
const FUNDO  = isLight ? "#ffffff" : "#141414";
const SOMBRA = isLight
  ? "0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.07)"
  : "0 1px 2px rgba(0,0,0,0.50), 0 10px 30px rgba(0,0,0,0.30)";

// COM cor hierárquica — `base`, `clara`, `escura` e `glow` vêm da tabela abaixo.
const CARD_COM_COR = {
  backgroundImage:
    `linear-gradient(${FUNDO}, ${FUNDO}), ` +                // 1ª camada: o miolo, sólido
    `linear-gradient(135deg, ${clara}, ${base}, ${escura})`,  // 2ª camada: só a borda
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
  border: "1.5px solid transparent",
  borderRadius: 16,
  boxShadow: `${SOMBRA}, 0 0 6px ${glow}`,   // glow: a cor a 3,5%, blur 6px, sem spread
  padding: "12px 14px",
  minHeight: 76,
};

// SEM cor (sem prazo por perto e não concluído): o card normal, sem truque.
const CARD_NEUTRO = {
  background: FUNDO,
  border: isLight ? "1px solid rgba(0,0,0,0.05)" : "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16, boxShadow: SOMBRA, padding: "12px 14px", minHeight: 76,
};
```

**Por que duas camadas de `background`.** CSS não tem gradiente em `border`, e
`border-image` descarta o `border-radius`. A camada sólida em `padding-box`
cobre o miolo; a de degradê em `border-box` só aparece na faixa de 1,5px que
a borda transparente deixa. Por isso o card com cor **não** usa o atalho
`background` — ele apagaria as duas camadas de uma vez.

**Os tons do degradê** saem de uma função só, `misturar(hex, alvo, peso)`
(`paleta.ts`): mistura linear canal a canal entre `hex` e `alvo`, com
arredondamento. Três paradas, sempre nesta ordem e neste ângulo:

- `base`   = o tom **saturado** da cor — o `.dark` da escala (§2.1) — **nos
  dois temas** (v10; até a v9 o claro usava o tom rebaixado, `#A06108` etc.,
  que existe para texto passar de 4.5:1 e numa borda virava marrom/vinho)
- `clara`  = misturar(base, `#ffffff`, **0.5** no escuro · **0.30** no claro)
- `escura` = misturar(base, `#000000`, **0.32** no escuro · **0.28** no claro)
- ângulo **135°** — o mesmo do degradê da marca (`GRAD_PRIMARIA`, §6.3)

No claro as pontas se afastam menos da base: a borda é um filete de 1,5px
sobre branco e já é a única cor do card — não precisa de peso, precisa de cor.
Em código: `degradeDeBorda(hex, isLight)` (`paleta.ts`), com `hex` sempre o
tom saturado.

Valores resolvidos, para quem reproduz sem a função:

| cor | tema | base | clara | escura | glow (`esmaecer(bg, 0.25)`) |
|---|---|---|---|---|---|
| vermelho | escuro | `#F17881` | `#f8bcc0` | `#a45258` | `rgba(241,120,129,0.035)` |
| vermelho | claro | `#F17881` | `#f5a1a7` | `#ae565d` | `rgba(241,120,129,0.035)` |
| amarelo | escuro | `#F8C811` | `#fce488` | `#a9880c` | `rgba(248,200,17,0.035)` |
| amarelo | claro | `#F8C811` | `#fad958` | `#b3900c` | `rgba(248,200,17,0.035)` |
| azul | escuro | `#4F94E9` | `#a7caf4` | `#36659e` | `rgba(79,148,233,0.035)` |
| azul | claro | `#4F94E9` | `#84b4f0` | `#396ba8` | `rgba(79,148,233,0.035)` |
| verde | escuro | `#2DD2A5` | `#96e9d2` | `#1f8f70` | `rgba(45,210,165,0.035)` |
| verde | claro | `#2DD2A5` | `#6ce0c0` | `#209777` | `rgba(45,210,165,0.035)` |

As linhas "claro" são da v10 (2026-09-04, R154 — Davi: "as bordas dos cards da
tela Início podem estar mais claras"). Na v9 eram `#B1242E`/`#d89297`/`#78181f`,
`#A06108`/`#d0b084`/`#6d4205`, `#236FC7`/`#91b7e3`/`#184b87` e
`#047862`/`#82bcb1`/`#035243` — pesadas demais para um filete.

**O glow** (v9, 2026-09-04 — Davi: "diminua mais o glow do contorno […] pode
diminuir bastante") é o véu (`bg`) que o PRISMA já define para cada cor — 14%
de alfa —, mas **enfraquecido**: `esmaecer(bg, 0.25)` (`paleta.ts`) multiplica
só o alfa, preservando o RGB, e o resultado (3,5%) é o que entra no
`box-shadow`, com blur reduzido de 16px para **6px** — sem spread, somado à
sombra normal do card. A primeira versão (v8) usava o `.bg` puro com blur
16px; ficou grande demais para "levíssimo". Ainda não é um alfa novo por
cor: é o mesmo token, encolhido por uma função — os dois números que valem a
força (`FATOR_GLOW`, `GLOW_BLUR_PX`) moram em `CardAtividade.tsx`. O glow é o
mesmo nos dois temas (é a cor saturada, não o tom do tema).

**O que NÃO muda com a cor:** o fundo, o raio, o padding, a tipografia e os
chips. Os chips de tipo, prioridade (campo), impacto operacional (interno) e
status usam **sempre** a cor própria (`chipStyle`, §6.6). O disfarce cinza que
eles vestiam sobre o fundo colorido (`sobreFaixa`) saiu junto com o fundo
colorido.

### 6.14 Etiqueta — a categoria PREENCHIDA (v11 — 2026-09-04, R177)

A etiqueta de categoria (tipo, status, impacto, equipe, prioridade, serviço)
é uma **forma sólida**: fundo no tom FUNDO da cor e texto **branco**, sem
borda — o preenchimento já separa do card.

```jsx
// ui.ts — uma função, dezessete etiquetas, nove telas.
export const etiqueta = (cor: { dark: string; light: string }) => ({
  background: cor.light,   // o tom FUNDO, nos dois temas
  color: "#ffffff",
});
```

Forma, tamanho e peso ficam com quem chama: a etiqueta de 9px maiúscula da
página e a de 11px do card são densidades diferentes de propósito.

**O que ela substituiu.** Até a v10 a etiqueta era véu: fundo na cor a 14% de
alfa (`.bg` do PRISMA) e texto na cor do tema. Empilhava três coisas fracas —
fundo lavado, texto colorido, às vezes borda — e numa lista de trinta linhas
o resultado é ruído de baixa legibilidade. O véu **continua** valendo para
superfície (fundo de campo, anel de seleção); o que saiu foi o véu como
etiqueta.

**Por que o tom FUNDO, e igual nos dois temas.** Três candidatos, medidos
antes de escolher:

| preenchimento | branco na pior cor | soma de luminância dos 10 |
|---|---|---|
| tom vivo (`.dark`) | 1,58:1 (amarelo) — **reprova** | 4,174 |
| tom vivo misturado 45% com o card | 4,33:1 — no limite | 1,375 |
| **tom fundo (`.light`)** | **4,99:1** | **1,232** |

O tom vivo obrigaria tinta quase-preta e — o que decidiu — **triplica** a luz
que a tela emite, contra o que a R174 pede. O tom fundo passa de 4,99:1 com
branco nas dez cores do PRISMA, é o mais calmo dos três e deixa a etiqueta
**idêntica nos dois temas**: um número a menos para raciocinar.

A objeção ao tom fundo era o contraste contra o card escuro (1,55:1), mas a
razão engana perto do preto: a fórmula comprime, e o preenchimento é de **7 a
29 vezes** mais luminoso que o card `#141414` — lê como forma sem
dificuldade. Quem carrega a informação é o texto branco, em 4,99:1.

Valores resolvidos, para quem reproduz sem a função:

| cor | preenchimento | branco sobre ele |
|---|---|---|
| amarelo | `#A06108` | 4,99:1 |
| pêssego | `#9D5C00` | 5,30:1 |
| laranja | `#AD4700` | 5,71:1 |
| vermelho | `#B1242E` | 6,64:1 |
| rosa | `#A83A63` | 6,09:1 |
| azul claro | `#005F87` | 7,03:1 |
| azul | `#236FC7` | 5,04:1 |
| azul escuro | `#0A3573` | 11,87:1 |
| verde | `#047862` | 5,43:1 |
| neutro | `#616161` | 6,20:1 |

Uma asserção confere o piso de 4,5:1 nas dez: se um tom da paleta clarear, a
etiqueta acusa antes de chegar à tela.

### 6.15 Avatar — sem glow (v11 — 2026-09-04, R176)

O rosto de quem toca a atividade não espalha luz. O halo colorido saiu dos
três desenhos; numa lista de trinta atividades eram trinta faróis, e o
degradê estável por hash (§13) já distingue as pessoas.

Na **pilha** os círculos se sobrepõem em 7px e precisam de separação — e a
separação de uma pilha de avatares é um **anel na cor da superfície**, que
separa sem acrescentar luz:

```jsx
boxShadow: `0 0 0 2px ${isLight ? "#ffffff" : "#141414"}`   // a cor do card
```

O avatar solto não leva anel: não há sobreposição para separar. **No
calendário (R188, U105) a pilha vai sem anel** (`anel={false}`): o card tem
fundo colorido (§6.17) e o anel na cor do card lia como um contorno em volta
de cada rosto; sem anel a sobreposição cai para 4px.

### 6.16 Configurador rápido — o painel da atividade (v12 — 2026-09-04, R183–R185)

O painel lateral que abre ao clicar num card (`features/chamados/PainelChamado.tsx`)
tem duas partes com funções diferentes, e o desenho diz isso:

**O cabeçalho é a INFORMAÇÃO** (superfície `cinzas(isLight).elevada`), em três
linhas que quebram (`flex-wrap`), nunca em grade fixa:

1. Título 22/700 editável no lugar + botão "abrir a página" (32px).
2. **Estado:** status, tipo e a régua de urgência como **seletores compactos**;
   prazo como pílula de data; equipes e "Atrasado" como etiquetas (§6.14);
   "Recebido de X em …" à direita, 11,5px secundário.
3. **Pessoas e local:** três **grupos** — Responsável (campo com busca
   compacto, 210px, com avatar), Apoio (chips + "+ adicionar"), Local (chips +
   etiquetas de setor + "+ adicionar").
4. Só campo: **Agenda de campo**, recolhida atrás de um botão-pílula
   (`aria-expanded`).

**O corpo é o REGISTRO** (superfície `cinzas(isLight).superficie`), nesta
ordem: barra 1→2 · Problema · Diagnóstico · Comentários · Linha do tempo.

As peças e seus números:

| Peça | Medidas | Cor |
|---|---|---|
| **Seletor compacto** (`SeletorDeOpcao compacto`) | 30px de altura, pílula (`999`), 12px/600, padding `0 9px 0 11px`, seta 13px | a mesma da opção escolhida (`botaoSelecao`); o popover não muda |
| **Grupo** (rótulo + controle + selo) | rótulo 10,5px/700, maiúsculas, `letter-spacing .08em` | rótulo em `text-secondary`; o controle leva a própria cor |
| **Barra 1→2** | círculos 26px com borda 2px e o número 12/700; barra 3px entre eles (máx. 280px); rótulo 10,5px maiúsculo embaixo | feito = dourado (`PRISMA.amarelo` do tema) no círculo, na barra e no rótulo (700); por fazer = `rgba(0,0,0,0.14)` / `rgba(255,255,255,0.16)` e rótulo secundário (500) |
| **Rótulo de registro** (`Campo destaque`) | 11,5px/700, maiúsculas, `.12em` | dourado — é o rótulo de seção, porque estes dois campos SÃO a área principal |
| **Linha do tempo** | ponto 8px + frase 13px + "quem · quando" 11,5px | ponto dourado, frase primária, meta secundária |

O que a barra decide não mora na tela: `etapasDoRegistro(problema, diagnostico)`
(`features/chamados/registro.ts`) diz o que acende, `fraseDoProgresso` dá o
texto do `aria-label` — cor nunca fala sozinha (§6, "status nunca só por cor").

**Só na corretiva (R213, 2026-09-08).** A barra 1→2 e o par Problema/Diagnóstico
aparecem quando `temDiagnostico(chamado.tipo)` (lista `TIPOS_COM_DIAGNOSTICO`,
hoje só `corretiva`). Nos outros tipos o corpo tem um único `Campo destaque`
**Descrição** (sobre `descricao_problema`, altura mínima 160) e o Diagnóstico só
entra, sem destaque, quando já tem texto.

### 6.17 Calendário — o card tingido e a dica expandida (v12 — 2026-09-04, R187–R191)

O card de atividade do calendário (mensal e semanal) tem **fundo na cor do
status, esmaecido e sólido**:

```ts
const tinta = (cor: string) => misturar(cor, superficie, isLight ? 0.86 : 0.80);
// 14% da cor no claro (sobre #ffffff), 20% no escuro (sobre #141414)
background: tinta(e.cor), borderLeft: `2.5px solid ${e.cor}`   // a borda continua a cor pura
```

Por que mistura e não `rgba`: uma opacidade de verdade depende do que está
atrás (célula do mês, célula fora do mês, realce de alvo) e clareia mais do
que parece no código — a lição da U13 sobre véus. A mistura é a cor que a
opacidade *pareceria* sobre a superfície, sempre a mesma. O verificador mede:
texto primário ≥ 4,5:1 sobre o fundo tingido de qualquer cor do PRISMA, nos
dois temas, e o tingido difere da superfície em ≥ 1,08:1 (senão a cor não se
vê).

**Rostos sem anel** (R188): `<AvatarPilha … anel={false} />` nas duas visões.

**Meses seguintes ao rolar** (R189): uma sentinela de 1px depois da última
grade, observada por `IntersectionObserver` (`rootMargin` 120px); cada
interseção anexa um mês, até três. Cada mês anexado leva `<h2>` 15/600 com
"Mês de Ano" e a mesma grade; só o primeiro tem `flex: 1 0 auto`.

**A dica expandida** (R190, só na mensal): `role="tooltip"` em portal,
280px, superfície `cinzas(isLight).elevada`, borda `divisoria`, raio 12,
sombra `0 10px 28px` (14% no claro, 45% no escuro), `pointer-events: none`.
Título 12,5/700 com a borda esquerda na cor do status; linhas "rótulo →
valor" com rótulo 9,5/700 maiúsculo (112px) e valor 12; o *quando* 10,5
secundário no fim. Abre embaixo do card; se não couberem 170px, abre em
cima. Some enquanto se arrasta.

### 6.18 Página em duas colunas — o Administrativo (v12 — 2026-09-04, R193)

Quando duas listas são consultadas JUNTAS (usuários e a matriz de permissões:
quem é, o que pode), elas ficam lado a lado em vez de abas:

```css
.admin-colunas { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
@media (min-width: 1024px) {
  .admin-colunas { grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); }
}
```

Cada coluna é um `<section aria-labelledby>` com card(isLight), raio 18,
padding 16, e um `<h2>` no micro-label dourado (10,5/700, maiúsculas, .10em)
com o ícone da seção. A coluna da lista mais larga leva 1.45fr. O conteúdo que
não se consulta junto (as APIs) entra por um **botão-pílula** (`botaoAba`) e
troca a página inteira para uma coluna, com o botão de voltar no mesmo lugar.
Breakpoint 1024px — o mesmo de `.cal-semana` e da sidebar.

### 6.19 Formulário em colunas — a Nova Visita (v12 — 2026-09-04, R194)

Um formulário longo que era **duas etapas** virou **três colunas** na mesma
tela: cada coluna responde a uma pergunta (onde · com quem e o quê · quando) e
tem um título com número dourado (`TituloDaColuna`: círculo 24px em
`GOLD_GRAD`, título 13,5/700, subtítulo 11 secundário). Dentro, cada bloco de
campos é um `card(isLight)` com padding 16 e um micro-rótulo (10,5/700,
maiúsculas, .10em, `textoSecundario`).

```css
.nova-visita-colunas { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: start; }
@media (min-width: 1024px) { … repeat(2, minmax(0, 1fr)); a última seção ocupa a linha inteira }
@media (min-width: 1360px) { … repeat(3, minmax(0, 1fr)) }
```

Campos: fundo `cinzas(isLight).campo`, borda `divisoria`, raio 12, 14px/500,
`color-scheme` do tema. Botões de escolha (tipo de local, serviços) usam
`botaoSelecao(ativo, isLight, null)` **com `boxShadow: "none"`** — o brilho é
exceção (R174). O seletor de pessoa é o `SeletorDeOpcao`, não um `<select>`.
A ação principal fica na última coluna, dentro do card do resumo, com a lista
do que falta escrita acima dela — o botão nunca é a única fonte de feedback.

O que saiu, e não volta: a paleta local `L` (um segundo tema claro só daquela
tela) e o "vidro dourado" dos campos no escuro — um design system por tela é o
primeiro anti-padrão da skill de designer.

**Embutido no "+" da Início (R214, 2026-09-08).** O formulário virou o
componente `NovaVisitaTecnica` (`features/gerencial/`), e a rota é só a casca.
Com `embutido`, ele perde a sangria e o cabeçalho de página (o diálogo já tem
os seus) e as colunas ficam em no máximo DUAS (`.nova-visita-embutida`
sobrescreve `.nova-visita-colunas` a partir de 1360px, com o agendamento
embaixo): três colunas em 1120px de diálogo seriam ilegíveis.

### 6.20 Ficha do cliente — três colunas de desktop, os dois painéis do vínculo e os cards editáveis (v15 — 2026-09-08, R200–R210)

A ficha é a página que se trabalha por mais tempo, e o desenho segue a ordem
do trabalho — no desktop, que é onde ela é usada (R205):

- **Largura toda** (`.pagina-larga`): a receita única de página larga (§5b,
  R239) — o `<main>` solta o teto por `:has()` e a margem lateral é a régua do
  sistema (`--gutter`: 24px no desktop, 16 no celular), a mesma da Início.
  Receita para outra página que precise da largura: a classe na raiz da
  página, e `paddingTop`/`paddingBottom` em vez do atalho `padding`, que
  sobrescreveria o horizontal da classe.
- **A grade** (`.ficha-grid`, R209): três ÁREAS nomeadas com a forma do
  conteúdo. `identidade` (cards curtos) · `local` (os dois painéis do vínculo
  — querem largura) · `atividades` (a coluna ALTA). Celular: uma coluna,
  `local → atividades → identidade`. De 1024 a 1439: `minmax(0,1fr) |
  clamp(320px, 32%, 400px)`, identidade à direita e o resto empilhado. A
  partir de 1440: `clamp(320px, 24%, 400px) | minmax(0,1fr) | clamp(320px,
  26%, 420px)` — identidade | local | atividades; o que cresce com o monitor é
  a coluna do local. Gap 14 (18 no desktop).
- **Cabeçalho de página** (largura toda): botão de voltar 40px · `h1` 22/700
  com o nome · chip de situação (`etiqueta`) · tipo de local com ícone ·
  linha de meta 12,5 secundária (endereço · contagens). O serviço prestado
  saiu daqui para o card O local (R210). Não há botão de configurar: a edição
  é no lugar, card a card (R203).
- **Coluna de atividades** (R209/R212/R218): o card tem `max-height:
  min(72vh, 900px)` e a lista rola por dentro (`.rolagem-fina`). Cada item é
  o **`CardAtividade` da Início** (§6.12) — chamados E visitas técnicas na
  mesma lista, pelos montadores da Início: fundo neutro, a cor estratégica só
  na borda em degradê pela faixa de prazo, chip de status preenchido, pilha de
  avatares — a coluna ALTA da ficha não tem card próprio. Atividade que veio
  pelo grupo ou como local extra leva a nota 10,5 secundária embaixo. Teto
  declarado de 12 com "ver todas". O Plantão rola por dentro com `max-height`
  320.
- **Colunas alinhadas embaixo** (R219): nos dois breakpoints de desktop a
  grade tem `align-items: stretch`; o último card da identidade e o card dos
  sistemas crescem (`flex: 1 1 auto; min-height: 0`), e na coluna de
  atividades cresce o PRIMEIRO (a lista). Dentro do card dos sistemas o
  `.painel-vinculo` cresce junto. As três colunas terminam na mesma linha.
- **Card**: `card(isLight)`, raio 18, padding 18, micro-rótulo dourado 10,5/700
  com ícone 15px e a contagem em 11,5 secundário ao lado.
- **Linha de lista clicável** (atividade, visita, contrato): fundo
  `cinzas().campo`, borda `divisoria`, borda esquerda 3px na cor do status,
  raio 12, padding 9×12; título 12,5/600, meta 11 secundário, chip de status
  9/700 caixa alta à direita.
- **Os dois painéis do vínculo** (`.painel-vinculo`: 1 coluna no celular, 2
  iguais a partir de 1024px, gap 14), dentro do card "Sistemas instalados"
  (R206). Cada painel é uma `<section>` com moldura `1px divisoria`, raio 14,
  padding 12, altura mínima 180, e um micro-rótulo (`CabecalhoDoPainel`:
  ícone dourado · título 10,5/700 caixa alta · contagem 11,5 secundário).
  · **Blocos** (esquerda): cada bloco é um card em `campo` (raio 14) com
    cabeçalho — chevron de recolher · nome 13,5/600 · tipo 11,5 secundário ·
    código do bloco em mono dourado 10,5 quando veio do orçamento · a
    **contagem grande** (15/700 + rótulo 9 caixa alta) · lixeira 28px. Os
    sub-itens são `LinhaDoPatrimonio` (nome 12,5/600, meta 11, identificação
    mono 11, data 10,5) sobre `superficie`, com a alça `GripVertical` 14 à
    esquerda e o botão de desvincular 28px (`Unlink`) à direita. Bloco vazio
    mostra a zona tracejada "Solte aqui os equipamentos deste bloco".
    "Previsto no orçamento" é um `<details>` recolhido, 9,5 caixa alta.
  · **Sem bloco** (direita): barra do gesto em `campo` (caixa "marcar todos",
    a frase do que fazer e — só com seleção — o `SeletorDeSistema` compacto
    como caminho sem arrasto); embaixo, uma linha por equipamento com caixa
    de seleção e alça. Filtro em pílula 28px quando há mais de 8.
  · **Altura e rolagem** (R208): o painel tem `max-height: min(64vh, 720px)`
    e, no desktop, os dois têm a mesma altura (`align-items: stretch`). Só a
    LISTA rola (`ROLAGEM_DO_PAINEL`: `overflow-y: auto; min-height: 0; flex: 1`,
    com a classe `.rolagem-fina`); cabeçalho e barra do gesto ficam parados.
    A página não cresce com a quantidade de equipamentos.
  · **Estados do arrasto** (`estiloDoPainel`): em repouso, moldura
    `divisoria`; destino possível, `1.5px dashed` dourado; com o arrasto em
    cima, `1.5px solid` dourado + `PRISMA.amarelo.bg` — e o texto "Solte para
    tirar do bloco" ocupa o painel "Sem bloco". A linha em arrasto fica a 45%
    de opacidade; o cursor é `grab`. Só o tipo MIME próprio
    (`application/x-prever-equipamentos`) abre as zonas.
- **Card editável** (`CardLocal` · `CardContatos`, em
  `features/clientes/ClienteForm.tsx`): em leitura, cada linha é uma GRADE
  `minmax(96px, 30%) | 1fr` — rótulo 12/600 secundário, valor 13/400 texto,
  alinhado à esquerda, 7px de altura de linha, divisória entre linhas. O
  lápis 30px fica no canto, só para quem edita. **Botões de ação** (R207):
  28px, raio 8, fundo `campo`, borda `divisoria`, ícone dourado 13, encostados
  à direita da célula do valor — `MessageCircle` (WhatsApp), `Copy` (e-mail,
  endereço). Em edição, dentro do MESMO card: campos de 42px em `campo` com
  borda `divisoria`, chips `botaoSelecao` sem brilho, nota de campo 11,5
  secundário, e o rodapé com **Cancelar** (leve, 36px) e a ação dourada
  **Salvar** — a única primária do card. Cada card grava só os seus campos.
  O card **O local** traz o **Serviço prestado** (R210): em leitura, uma
  etiqueta sólida por serviço (`etiqueta(SERVICO_CORES[s])`, 10/700 caixa
  alta, pílula) ou "nenhum"; em edição, chips `botaoSelecao` que ligam e
  desligam. A linha "Coordenadas" não existe mais em leitura.

### 6.13 Card de cliente — a fachada sobreposta (v8 — 2026-09-03)

R146. O card da lista de clientes recebe a **foto da fachada** como camada
absoluta pela DIREITA, atrás do texto, entrando com transição de opacidade
quando a imagem carrega. Uma máscara some para a esquerda, onde está o texto —
a foto identifica o prédio de relance, não disputa a leitura.

```css
.fachada-card {
  position: absolute; top: 0; right: 0; bottom: 0; width: 58%;
  height: 100%; object-fit: cover; pointer-events: none;
  opacity: 0; transition: opacity .45s ease;
  mask-image: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 45%, #000 100%);
}
.fachada-card.pronta { opacity: 0.55; }              /* tema escuro */
[data-theme="light"] .fachada-card.pronta { opacity: 0.45; }
```

O card precisa de `position: relative` e `overflow: hidden`; o conteúdo fica
com `position: relative; z-index: 1`. A classe `.pronta` entra no `onLoad` da
imagem — sem ela a foto não aparece, e é isso que faz a entrada ser uma
transição e não um salto. A opacidade final é menor no claro, onde a foto
competiria com o texto escuro sobre branco.

### 6.21 O chat da Início — botão flutuante, a conversa 9:16, o campo colorido e as caixas de mensagem (v17 — 2026-09-09, R215–R217, R222–R223, R240)

- **Botão flutuante** (`.fab-chat`): círculo de 54px em `goldButton()` (a ação
  principal da tela), ícone `MessageCircle` 22, sombra discreta. `position:
  fixed`, canto inferior direito: no celular `bottom: calc(max(16px,
  safe-area) + 84px)` para ficar acima da BottomNav; no desktop 24px. `z-index:
  60` — acima da BottomNav (50) e da sidebar (55), abaixo dos diálogos (100).
  O **selo de não lidas** (R222) é um disco 20px **vermelho**
  (`PRISMA.vermelho.dark`/`.light`) com fonte **branca** 11/700, no canto
  **superior esquerdo** (`top: -4, left: -4`), borda 2px na cor da página. Conta
  menções não lidas + recados para todos chegados depois da última abertura.
- **A conversa** (`.fab-chat-painel`): `card(isLight)` raio 18, **9:16** —
  `width: min(380px, 100vw − 24px)`, `height: min(676px, 100vh − 120px)` (no
  desktop `100vh − 48px`). Três faixas: a **alça** (`.fab-chat-alca`:
  `cursor: grab`, `touch-action: none`; `GripHorizontal` 16 secundário, "Chat"
  11/700 caixa alta em `texto`, "menções e recados para todos" 11 secundário,
  e o botão **recolher** 30×30 `ChevronDown` à direita) — segurar e arrastar
  move o painel (`left/top` gravados em `localStorage`, `prever-chat-posicao`,
  sempre dentro da tela por `posicaoDentroDaTela`); o **corpo** rola por
  dentro (`.rolagem-fina`) sobre o fundo da PÁGINA (`cinzas.pagina`) — é o
  contraste bolha × fundo do celular —, da mensagem mais antiga em cima à mais
  nova embaixo; o **rodapé** fixo em `superficie` com o campo
  (`TextareaComMencoes`, raio 14, fundo `campo`) e o botão **enviar** 40×40
  redondo em `goldButton()` — o único degradê amarelo da conversa.
- **A CONVERSA — o campo colorido** (R240): cada menção é **UM CAMPO** na cor
  estratégica do prazo — `PRISMA[cor].bg` de fundo e `PRISMA[cor].border` de
  borda (a MESMA régua do card, R136: vermelho/amarelo/azul/verde); sem prazo,
  `superficie` + `divisoria`. Raio 14, padding 8, gap 6. Dentro dele, de cima
  para baixo: o **título da atividade** 12/600 em `texto` (o botão que abre a
  atividade no pop-up) com o ponto 7px de "não respondida" à direita; uma
  **caixa por mensagem**; e, em menção de comentário, **responder** (botão
  28×28 `Reply` 14, fundo `superficie`) + a `FileiraDeReacoes`. Mensagem sem
  resposta: filete `inset 3px` na cor do prazo. Nenhum código de atividade
  aparece. O título mora DENTRO do campo — Davi, 09/09/2026: "as mensagens
  devem conter o titulo junto com o fundo colorido".
- **A CAIXA DE MENSAGEM** (`CaixaDeMensagem`, R240): `AvatarCirculo` 22 · nome
  11,5/600 (o meu é "Você") · hora `dd/mm HH:mm` 10,5 secundário · o texto 13
  com 1,5 de entrelinha (`TextoComChecklist`). Fundo
  `rgba(255,255,255,0.80)` no claro e `rgba(0,0,0,0.30)` no escuro, raio 10,
  padding 6×9, gap 8, e a borda **tingida** da cor do campo
  (`PRISMA[cor].border`). MEDIDO: a caixa contra o campo dá **1,25** no claro e
  **1,12** no escuro — dois tons escuros não produzem razão maior (o piso de
  0,05 da fórmula domina), e é por isso que no sistema inteiro quem separa
  superfície de superfície é a BORDA; tingida, ela amarra a caixa ao campo. O
  texto dentro fica com **15:1** no claro e **17:1** no escuro. A menção é a
  primeira caixa e cada resposta é a sua — Davi: "caixas de mensagem diferentes
  no mesmo campo (fundo colorido)". Em menção de campo (descrição/diagnóstico/
  solução) a caixa inteira é o botão que abre a atividade, com `ExternalLink`
  12 no canto.
- **O recado para todos**: a MESMA anatomia, com o destino no lugar do título —
  campo neutro (`superficie`; o meu `elevada`, encostado à direita, `max-width:
  94%`), o cabeçalho "PARA TODOS" 11/600 caixa alta espaçada em secundário
  dentro dele, e uma caixa de mensagem embaixo.
- **A resposta armada**: um chip pílula com `Reply` 12 e o `#Código`, pintado
  como a bolha daquela atividade (fundo `.bg`, texto `.dark`/`.light`), com o
  botão × 24px ao lado; o envio vira comentário na atividade (R223).
- **Reações** (`FileiraDeReacoes`): um chip por emoji usado — `botaoSelecao`
  sem brilho, 24px, pílula, emoji + contagem tabular; o meu acende. O "+"
  (`SmilePlus`) é um círculo tracejado 26×24 que abre a lista fechada
  `EMOJIS_REACAO`. A mesma fileira no Configurador rápido, na página da
  atividade e no chat.

### 6.22 O editor de texto — uma área, blocos com marcador próprio, menção como chip (v16 — 2026-09-08, R135, R224)

- **A área** (`.editor-rico-area`): um `contentEditable` só, `role="textbox"`,
  texto 14/400 em `textPrimary`, `line-height 1.55`, padding `10 13 12`,
  `min-height` por campo (220 na descrição, 160 na solução, 40 na caixa de
  comentário); cresce com o texto, sem scroll interno. Vazia, mostra o convite
  em `--text-muted` por `::before` (`data-placeholder`).
- **O bloco** (`[data-bloco]`): parágrafo, `lista` ou `checklist`; padding
  `3px 0`, `min-height 1.55em`; lista e checklist recuam 30px à esquerda e o
  **marcador** (`.editor-marcador`, `contenteditable=false`, `position:
  absolute`) mora nesse recuo: a caixa `.checklist-check` 19px (a mesma do
  texto de leitura, Uiverse) ou o `.lista-ponto` 6px dourado. Item marcado
  (`[data-marcado="1"]`): riscado, opacidade 0,7, caixa com o traço dourado e
  o "pop" de escala 1,14 (o mesmo CSS do `.checklist-input:checked`, escrito
  para o atributo; `prefers-reduced-motion` tira o pop).
- **A menção** é um `.mencao-chip` `contenteditable=false` com "@Nome" — o
  token `@[Nome](user:id)` só existe no texto gravado (`data-mencao`,
  `data-nome`). Backspace apaga o chip inteiro. A lista do "@"
  (`SugestoesDeMencao`, `.mencao-lista`) abre sob a área.
- **A barra** (só no editor, não na caixa de comentário): dentro da borda do
  campo, cinco `.ferramenta-botao` 44×44 — Negrito, Itálico | Checklist,
  Lista | Mencionar — com dois divisores de 1×22px, e a dica à direita
  10,5 secundário: "@ menciona · Enter nova linha · selecione várias linhas e
  clique em Checklist". Checklist/Lista agem em TODOS os blocos da seleção;
  Negrito/Itálico são `execCommand` (a seleção fica). Atalhos Ctrl+B / Ctrl+I.
- **O campo** (`EditorDeDescricao`): borda 1px (`rgba(0,0,0,0.14)` /
  `rgba(255,255,255,0.14)`), raio 12, fundo `#fff` / `rgba(255,255,255,0.055)`,
  barra em cima, área embaixo; grava pelo `useRascunhoSalvo` (R90). A caixa de
  comentário (`TextareaComMencoes`) é a mesma área sem barra, com o estilo de
  entrada do lugar (raio 14 no chat, `est.entrada` no painel), e o Enter é de
  quem a usa (envia).

### 6.23 A tela da atividade — documento à esquerda, ficha à direita (v19 — 2026-09-08, R234–R239)

Aprovada pelo Davi sobre o mockup "Layout da Atividade" (artifact, 08/09/2026),
e revista no mesmo dia pela R239 (a régua, o scroll, o modal, os equipamentos).
A atividade é um DOCUMENTO com uma FICHA — o padrão de item de trabalho de
Linear, Jira e Notion.

- **A casca** (`.pagina-trabalho` + `.trabalho-miolo`): a receita de página
  larga (§5b) — o `<main>` abre mão do teto por `:has()` e a margem lateral é
  `--gutter`, a mesma de todas as telas. Miolo com teto de **1880px**. Estilo
  inline nesta página mexe só no eixo VERTICAL (anti-padrão nº 10). No diálogo
  (R238) a casca é `.atividade-embutida`, com a MESMA régua por dentro.
- **A grade** (`.atividade-grade`): `minmax(0,1fr) 340px` a partir de 1024,
  `1fr 360px` a partir de 1700; gap **16** em toda largura; uma coluna no
  celular, a ficha embaixo. Medido em 1920: documento 1249px, ficha 360px.
- **UM SCROLL SÓ** (R239): a ficha **não** é sticky e **não** tem
  `overflow-y`; os painéis de equipamento não têm teto de altura. Quem rola é a
  página — ou o diálogo. Rolagem dentro de rolagem é defeito nesta tela.
- **A escala de espaçamento**: 8 (controles vizinhos, chips, itens de lista),
  12 (dentro do card, rótulo → valor), 16 (entre cards e entre colunas), 24 (a
  margem da página). Não há quinto número.
- **O documento** (`.atividade-documento`): cabeçalho (na página, o quadrado de
  voltar de 40px; no diálogo, nada — a chapelaria é da barra do diálogo), título
  `22/700` com `text-wrap: balance`, meta 11,5 secundário: número · "aberta há
  Nd por Fulano" · tipo; os **textos** (`.atividade-textos`, `min-height` 520
  quando é um só, 440 cada quando são dois; `.duplo` lado a lado a partir de
  **1700px**); os equipamentos; a conversa. Sem etiqueta de status no título.
- **O cabeçalho de um bloco**: rótulo (`SEC`, 10/700 caixa alta) e, na MESMA
  linha, a dica em 11 secundário — `cabecalho(titulo, dica?)`. Todo card abre
  igual; dica pendurada por margem negativa é remendo.
- **A ficha** (`.atividade-ficha`): abre com o **card do progresso**
  (`RoscaDeProgresso` 96px: rosca + "PROGRESSO" 10/700 caixa alta + a fração
  `13/600` "1 de 3 itens" + a origem 10,5 secundário "checklist da Descrição ·
  concluída = 100%"); depois o card **Ficha** com as linhas; depois fotos e
  arquivos (grade de 3 quadrados) e a linha do tempo; por fim "Excluir chamado"
  (gerente).
- **A linha da ficha** (`.ficha-linha`): `grid-template-columns: 96px
  minmax(0,1fr)`, `gap 12px`, `min-height 40px`, `padding 5px 0`, borda de 1px
  (`--border-color`) entre linhas. O rótulo alinha pelo **topo** (8px de
  respiro): com três chips empilhados no valor, um rótulo centrado no meio da
  linha não aponta para nada. Nove linhas: Status · Tipo · Impacto* · Quando ·
  Responsável · Apoio · Equipes · Proposta* · Cliente. O recebimento é o rodapé
  fino do card.
- **Os equipamentos** (R237/R239): **recolhido por padrão**. O cabeçalho traz o
  resumo ("134 sem bloco · 3 em 2 blocos · 1 movimento nesta atividade") e o
  botão que expande na **extremidade direita** (pílula 28px, 11/600, com o
  chevron que gira). Aberto: a casca dos painéis da ficha (`estiloDoPainel` com
  `maxHeight: "none"`, `CabecalhoDoPainel`, `.painel-vinculo`) — **Blocos do
  cliente** (cada bloco uma zona de soltar: borda tracejada dourada = "pode
  soltar aqui", sólida + `PRISMA.amarelo.bg` = "está sobre mim") | **Sem
  bloco** (o que o QAP trouxe, em COLUNAS de 220px, os primeiros 24, com filtro
  a partir de 8 e "mostrar todos"). Cada item: `GripVertical`, o rótulo e o
  botão **remover**. Embaixo, "Nesta atividade" com o desfazer.
- **O diálogo** (`DialogDaAtividade`): `width: min(1600px, 96vw)`, `height:
  min(94vh, 1040px)`, fundo `cinzas.pagina`, **z-70** (acima do menu). Barra de
  **48px** no topo: o número à esquerda, "Página inteira" à direita e os 48px
  finais reservados ao "X" do Radix, que é absoluto e antes caía em cima do
  card do progresso. O conteúdo rola por baixo dela.

#### v20 — 2026-09-10 (R245, R247): a tela de campo na mesma grade; a caixa do chat

- **O chamado de campo usa a grade** (`.atividade-grade.campo-grade`): o
  trabalho (problema, roteiro, cronograma, execução, cobrança, conferência,
  linha do tempo) em `.atividade-documento`; o estado e as ações (status,
  cliente, técnico, agenda, "Iniciar atendimento", relatório, reabrir,
  cancelar) em `.atividade-ficha`. Casca, régua e escala são as desta seção. A
  diferença é UMA e é de celular: `.campo-grade .atividade-ficha { order: -1 }`
  abaixo de 1024px — o técnico abre a tela no prédio para ver o status e
  apertar "Iniciar atendimento", então a ficha vem primeiro. Título 22/700
  (R195); o quadrado de voltar só existe na página (no diálogo a chapelaria é
  da barra, como na atividade interna).
- **A caixa de texto rola sem barra** (`.rolagem-oculta`: `scrollbar-width:
  none` + `::-webkit-scrollbar { display: none }`): o teto de altura fica
  (120px no chat), a rolagem fica, a barra sai. Só para caixas com teto — uma
  área que cresce sozinha não precisa.
- **O placeholder herda o padding da área**
  (`.editor-rico-area[data-vazio="1"]::before` com `padding: inherit;
  box-sizing: border-box`): ele nasce exatamente onde o texto nasce, seja a
  caixa grande (13/14) ou a do chat (10/12). Nunca chutar `left`/`top` fixos
  num placeholder — a caixa muda de padding e ele fica torto.
- **A lista do `#`** (`SugestoesDeAtividade`) é irmã da lista do `@`
  (`mencao-lista`): mesma casca, mesma marcação por teclado (↑ ↓ Enter Tab
  Esc), e cada item mostra SÓ o nome da atividade (R245). Escolher arma a
  resposta (o chip `#Código`); não insere texto.

### 6.24 Os dois quadros — o realce do "A seguir" e o quadro do Comercial (v21 — 2026-09-10, R248/R252)

**O card em destaque** (`CardAtividade aSeguir`, R248). Um card do quadro pode
ser marcado como "o próximo" sem virar outro card: **só cor e contraste mudam**.

- **Geometria intocada**: raio 16, padding `12px 14px`, altura mínima 76,
  largura 100% — os mesmos valores do card normal, herdados por espalhamento do
  mesmo objeto de estilo. O realce reescreve **uma** propriedade: `boxShadow`.
- **O anel é `inset`** (`inset 0 0 0 2px`), nunca `outline`: um contorno com
  `outline-offset` sai 4px para fora e o trilho que rola de lado (`.trilho-x`,
  `overflow-x: auto`) corta o que passa da borda. Glow de 14px na mesma cor,
  no lugar dos 6px do card comum.
- **A etiqueta ocupa a vaga do chip de status**, que no quadro está vazia
  (`mostrarStatus={false}`) — é por isso que o realce não acrescenta linha e o
  card não cresce ao lado dos vizinhos.
- **Duas cores, uma regra**: âmbar (`PRISMA.amarelo`) para o que vem,
  vermelho (`PRISMA.vermelho`) quando a hora já passou — a mesma faixa de prazo
  que decide a borda decide a etiqueta, então as duas nunca se contradizem.

**O quadro do Comercial** (`QuadroComercial`, R252) reusa a casca do quadro da
Início: `.trilho-x.sangra-x`, colunas `flex: 1 1 0` com piso de **200px** (o
nome de prédio é mais longo que o título de um chamado), `align-items: stretch`
para a coluna curta continuar existindo ao lado da cheia, cabeçalho com bolinha
da cor da etapa + rótulo 11/700 caixa alta + contagem à direita, cards com
`gap: 9`. Diferenças de propósito: **não há arrasto** (a etapa é derivada, não
um campo) e **o card não repete a etiqueta da etapa** — a coluna já a diz.

**A lição que vale para qualquer visão nova**: lista e quadro são o MESMO
componente com um `formato`, nunca dois trechos de JSX parecidos
(`CartaoDaVisita`, como `CardAtividade` já fazia com `mostrarStatus`). Dois
desenhos do mesmo objeto divergem no primeiro ajuste.

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
  --bg-base: #0E0E0E;   --text-primary: #ffffff;
  --text-secondary: #9CA3AF;   --text-muted: #4B5563;
  --border-color: rgba(255,255,255,0.08);
  --gold-primary: #F8C811;
}
[data-theme="light"] {
  --bg-base: #e9e9e9;   --text-primary: #212121;
  --text-secondary: #505050;   --text-muted: #727272;
  --border-color: rgba(0,0,0,0.10);
  --gold-primary: #A06108;
}
```

---

## 8. Anti-padrões (erros reais já cometidos neste sistema)

Todos abaixo foram bugs de produção — verifique cada um antes de entregar.

1. **Cor fixa fora de branch de tema.** Qualquer `color: "#fff"` ou
   `background: "linear-gradient(160deg,#161616…)"` sem `isLight ?` é um bug
   esperando o usuário trocar de tema. Varredura obrigatória:
   ```bash
   grep -rnE 'color: ?"#fff|color: ?"rgba\(255, ?255, ?255' src/ | grep -v isLight
   grep -rnE 'background: ?"(linear-gradient\(160deg, ?#161616|#1b1b1b|#141414)' src/ | grep -v isLight
   ```
2. **Texto branco sobre o gradiente dourado.** ~2:1 de contraste. Use `#0E0E0E`.
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
9. **Token declarado no `:root` sem par no `[data-theme="light"]`.** É o pior
   da lista porque não aparece no arquivo que quebra: o `styles.css` declarava
   ~35 tokens no escuro e redefinia 14 no claro, então `--input`, `--popover`,
   `--muted`, `--accent-foreground`, `--destructive`, `--success`, `--info` e
   `--border` seguiam com valor de tema escuro sobre página branca. O sintoma
   nascia longe: borda de `Input` invisível, painel do `Select` abrindo escuro
   sobre a página clara, `TabsList` azul-marinho dentro do card branco,
   `StatusBadge` ilegível — tudo em telas que nunca escreveram cor nenhuma.
   Varredura obrigatória (R79 travou isto por asserção):
   ```bash
   node scripts/verificar-logica.cjs   # "TODO token de cor do :root tem par"
   ```
   Exceção única: `--radius`, que é geometria e não tem tema.

   Corolário: **`--primary` é FUNDO, `--gold-primary` é TEXTO.** O dourado
   vivo continua sendo `--primary` nos dois temas (é o botão da marca, com
   texto quase-preto por cima); quem precisa de dourado como texto/ícone usa
   `--gold-primary`, que escurece para `#A06108` no claro.

10. **O atalho `padding` inline apagando o padding lateral da classe.** É o
    mais barato de cometer e o mais difícil de ver: um elemento com
    `className="pagina-larga"` (ou `.pagina-trabalho`), que dá
    `padding-left/right`, e ao lado `style={{ padding: "12px 0 48px" }}`. O
    atalho escreve os QUATRO lados, e o `0` do meio zera o padding lateral da
    classe — o CSS está certo, a tela é que fica encostada nas duas bordas da
    janela. Foi exatamente o defeito que o Davi viu na tela da atividade
    (08/09/2026: "você não respeitou as margens da direita e esquerda"), e o
    `padding-left` computado medido no navegador era **0px**. Regra: em página
    que tem classe de largura, estilo inline mexe só no eixo VERTICAL
    (`paddingTop`/`paddingBottom`). Varredura (asserção CRÍTICA na R234):
    ```bash
    grep -rn 'className="pagina-\(larga\|trabalho\)"' src/ | grep 'style={{ padding: '
    ```
    Corolário: sangria com `calc(50% - 50vw …)` **desalinha** as margens onde
    há barra de rolagem (`100vw` a inclui, o `<main>` centra na largura útil:
    ~8px de diferença por lado, medidos em 1920px). Quando as margens precisam
    ser iguais, prefira `main:has(.sua-classe) { max-width: none }` + a régua
    `--gutter` (R239) — e onde a sangria for mesmo necessária (o quadro da
    Início), desconte `var(--barra)/2` dos dois lados.

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

- [ ] Brilho só onde carrega informação — glow decorativo não entra (R174)
- [ ] Etiqueta de categoria é sólida, via `etiqueta()`, sem borda (§6.14)
- [ ] Avatar sem glow; pilha com anel na cor da superfície (§6.15)

- [ ] No tema claro, a página é `#e9e9e9` e o card `#ffffff` — o card tem de
      ser o branco mais claro da tela, nunca o mesmo branco da página (v10).
- [ ] Texto primário claro é `#212121` (cinza bem escuro), não `#000` nem o
      quase-preto `#0a0b0e` (v10).

- [ ] Montserrat carregada com pesos 300/400/600/700
- [ ] Fundo radial + textura de ruído aplicados no `body`
- [ ] Toda seção aberta por micro-label maiúsculo espaçado
- [ ] CTA principal = pílula dourada 56px com texto escuro maiúsculo espaçado
- [ ] Cards com gradiente (160° escuro / 135° claro), raio 16–18px
- [ ] Card de atividade: fundo neutro do tema, cor hierárquica SÓ na borda (degradê 135°, clara → base → escura) e glow bem fraco (véu do PRISMA esmaecido, blur 6px) (§6.12)
- [ ] Nenhuma cor fixa fora de branch de tema (rodar os `grep` da §8)
- [ ] Todo token do `:root` com par no `[data-theme="light"]` (§8.9)
- [ ] Dourado escurecido para `#A06108` em todo texto/ícone do tema claro
- [ ] Inputs com `colorScheme` acompanhando o tema
- [ ] Status sempre com ícone + rótulo, nunca só cor
- [ ] Transição global de 0.35s para troca de tema
- [ ] Navegação inferior flutuante respeitando `env(safe-area-inset-bottom)`

---

## 11. PRISMA — a paleta do degradê (v5 — 2026-08-20)

A partir da v5 a Início inteira fala uma cor só. A fonte é uma imagem que o
Davi mandou: um degradê fosco laranja → vermelho → rosa → amarelo → azul, visto
através de vidro. Dela saíram nove cores nomeadas (`PRISMA`, em `paleta.ts`) e
uma rampa de oito passos (`ESPECTRO`).

**O amarelo é o principal.** É a cor da marca, é a cor da ação e é a cor do que
vence esta semana. Onde houver dúvida, é ele.

### 11.1 As nove cores

| nome | escuro | claro | onde manda |
|---|---|---|---|
| `amarelo` | `#F5BE45` | `#B5840F` | **principal** · status `aberto` · tipo `preventiva` · prazo desta semana · KPI "faltam" |
| `pessego` | `#F5A96B` | `#C07A3E` | `aguardando_aprovacao` · `pedido_compra` |
| `laranja` | `#F0763A` | `#C25217` | `stand_by` · prioridade `alta` · "com você" |
| `vermelho` | `#E0483F` | `#B22F28` | tipo `corretiva` · prioridade `urgente` · **prazo em atraso** |
| `rosa` | `#F090A2` | `#C25370` | tipo `melhoria` *(amarração pedida por nome)* |
| `azulClaro` | `#7CC2E4` | `#3C88AE` | `agendado` · chip de visita técnica |
| `azul` | `#3B93C4` | `#1D6690` | `em_andamento` *(amarração pedida por nome)* · prioridade `normal` |
| `azulEscuro` | `#6FA6CE`¹ | `#123F63` | `concluido` · tipo `implantacao` · **prazo adiante** |
| `neutro` | `#9AA6B2` | `#657585` | `cancelado` · `operacional` · prioridade `baixa` |

¹ O `dark` do azul escuro é mais claro que o `#1E5F8D` da imagem porque ele é
**texto de chip sobre preto** e o tom original some. O véu (`bg`/`border`)
continua no azul profundo da imagem — é ele que pinta o fundo do card.

Cada entrada carrega `dark`, `light`, `bg` (véu translúcido) e `border`. Quem
consome nunca escolhe alfa na mão.

### 11.2 O degradê (v7 — 2026-08-20)

Composição fixa, do frio ao quente:

| faixa | fatia | do quê |
|---|---|---|
| azul | **20%** | `#4F94E9` → `#A7D9E5` |
| costura | 18–23% | quase acromática — ver abaixo |
| amarelo | **40%** | **`#FCDE48` → `#F8C811` → `#E8B00A`** |
| laranja | **20%** | `#F0A300` → `#FF7E3B` |
| vermelho | **20%** | `#F47967` → `#F17881` |

#### Um amarelo só no sistema inteiro

Os três amarelos da faixa de 40% **são os do botão da marca** — SUPERNOVA
300/400/500, exatamente os de `GRAD_PRIMARIA`. Estão literais em
`ESPECTRO_STOPS`, não reconstruídos em oklch, e três asserções garantem que
continuem lá.

Era a última divergência de cor do sistema: o degradê tinha um amarelo e o
botão tinha outro, a poucos graus de matiz — perto o bastante para ler como
erro, longe o bastante para incomodar. O coração do degradê, em 42%, é
`#F8C811`. `PRISMA.amarelo.dark` é o mesmo hex.

`PRISMA.amarelo.light` continua fundo (`#A06108`) porque é **texto sobre
branco**: `#F8C811` sobre branco dá 1.58:1.

#### As duas pontas

A quente termina em `#F17881`, o vermelho que os botões já usam. A fria começa
em `#4F94E9`. O degradê *percorre* a paleta em vez de correr por fora dela.

#### A costura, e por que ela é clara

Azul e amarelo estão em pontas opostas do matiz, e o caminho entre eles **cruza
o verde**. Não há como evitar interpolando: ou passa pelo verde, ou pelo
magenta. A saída é atravessar tão rápido e com croma tão baixo que o matiz não
chega a aparecer — daí a costura estreita (18–23%) e quase acromática.

E ela é **clara**, não média. Cinza é baixo croma em luminosidade média; em
luminosidade alta, o mesmo baixo croma lê como **brilho**.

#### O tema claro subiu

A v6 deixou a rampa clara em L .40–.56 — barro sobre branco. A v7 subiu para
L .54–.72. Uma asserção impede que ela volte a afundar (L média > 0.60) e outra
garante que ela siga mais escura que a rampa do tema escuro, que é o que a faz
ler no branco.

#### v10 — o claro subiu de novo (2026-09-04, R154)

Davi: "deixa as cores do gráfico (o degradê) num tom mais claro de cada cor, o
dashboard em si está escuro". Cada amostra da v7 foi misturada com branco —
**20%** nas pontas (azul, laranja, vermelho), **18%** na costura, **12%** nos
amarelos, que já estavam no piso:

```
ESPECTRO.light (v10)
#4F8CD2 #54AACF #B3A01F #C09C1F #C7981F #D48E29 #E18133 #DE7761 #D9747E
(v7: #236FC7 #2E97C5 #A99300 #B78E00 #BF8A00 #CC7900 #D96200 #D65539 #CF515E)

ESPECTRO_STOPS.light (v10)
#4F8CD2 0% · #42A3D5 10% · #84B9C6 18% · #ABC1BE 20.5% · #B2A11F 23% ·
#B89E1F 29% · #C39A1F 42% · #C8971F 52% · #D19229 60% · #DF8833 70% ·
#E27B33 80% · #DD7669 90% · #D9747E 100%

COSTURA.light = #ABC1BE
```

O preço, assumido: o **preenchimento** claro desce de 3:1 para um piso de
**2,5:1** sobre branco (mínimo real 2,62). É aceitável porque barra e arco
nunca carregam a informação sozinhos — o número ao lado é a rampa de TEXTO,
que **não mudou** e segue ≥ 4,5:1. Não é aceitável para texto; é exatamente
por isso que as duas rampas existem separadas. A asserção do verificador
passou a ter dois pisos (3 no escuro, 2,5 no claro), e as demais invariantes
(nenhuma amostra verde, nenhuma emenda cinza, L média entre 0,60 e a do
escuro) continuam valendo.

#### Duas rampas, e por quê

`ESPECTRO` é **preenchimento**. `ESPECTRO_TEXTO` é o que pinta o número de 13px
da barra.

No tema **claro** elas divergem: depois da subida, o miolo amarelo dá 2.5:1
sobre branco e não serve de texto. No tema **escuro** são a mesma coisa — a
rampa já é clara e passa de sobra. É o espelho exato do problema da v5.1, onde
quem precisava de socorro era o escuro. **A assimetria é do fundo, não da
paleta.**

#### O gráfico de barras roda invertido

As barras usam a rampa ao contrário: **vermelho no passado, amarelo na semana
corrente, azul no futuro**. Além de ser o que o Davi pediu, conserta uma
contradição que estava na tela: os cards dizem "adiante = azul" e as barras
diziam "adiante = vermelho".

A rosca e o painel "Abrir chamado" seguem a ordem original — são a identidade
do degradê, não uma escala de tempo.

### 11.3 Prazo → cor da BORDA do card (v8 — 2026-09-03, R136)

A regra mais visível do sistema. Até 2026-09-03 o card inteiro se pintava
com a cor do prazo; a partir da R136 **só a borda leva a cor** — em degradê,
com glow — e o fundo fica na superfície neutra do tema. A receita de CSS está
em §6.12; aqui fica a semântica, que é o que o card comunica:

| estado | cor | quando |
|---|---|---|
| `atraso` | vermelho `#F17881` / `#B1242E` | prazo já passou |
| `esta_semana` | **amarelo `#F8C811` / `#A06108`** | vence até domingo 23:59 da semana corrente |
| `adiante` | azul `#4F94E9` / `#236FC7` | vence da segunda seguinte em diante |
| `concluido` | verde `#2DD2A5` / `#047862` | está na coluna Concluído |
| — | nenhuma (borda neutra) | sem prazo por perto e não concluído — cancelado incluído |

O primeiro hex é o tom do tema escuro, o segundo o do claro (§2.1). Vermelho,
amarelo e azul são literalmente as pontas e o miolo do degradê, não
aproximações dele — é o que faz o quadro e os gráficos parecerem a mesma
peça. O verde não está na rampa (§11.1 explica por quê), mas é o mesmo verde
de "terminado com sucesso" que cobrança, contratos e o checklist de campo já
usam — a coluna Concluído do quadro e a bolinha de status já eram desta cor;
a borda só passou a concordar com elas.

**Prazo vence conclusão.** `faixaPrazo()` (em `atividades/modelo.ts`) decide
primeiro, e continua sabendo só de prazo — atraso / esta semana / adiante /
nada. Só quando ela não devolve faixa o card olha a coluna; se for Concluído,
verde. As duas cores nunca competem pelo mesmo card.

Dois detalhes que custaram decisão:

- **O corte é o fim da semana, não "daqui a 7 dias".** Na quinta-feira, "esta
  semana" precisa querer dizer dois dias. Sete dias corridos jogariam a terça
  que vem no amarelo e apagariam a fronteira que o quadro existe para mostrar.
  Travado em `verificar-logica.cjs` (10 asserções).
- **Os chips não mudam com a cor do card.** Com o fundo neutro, tipo,
  prioridade, status e compra usam sempre a cor própria (§6.6). O disfarce
  cinza que eles vestiam sobre o fundo colorido (`sobreFaixa`) saiu — sem
  fundo colorido, não havia mais com o que brigar.

### 11.4 Os efeitos, e quando cada um cabe

| efeito | classe | onde | onde NÃO |
|---|---|---|---|
| especular + granulado | `.textura` | barras do gráfico | superfícies grandes |
| granulado só | `.ruido` | ícones, pastilhas, avatares | **linhas curvas finas** |
| halo de cor | `feDropShadow` | arco da rosca | texto |
| glow de contorno | inline (`box-shadow`, cor esmaecida a ~3,5%, blur 6px) | borda dos cards com cor hierárquica (§6.12) | cards neutros, fundo, texto |

A linha do "onde NÃO" do granulado é uma correção do Davi: sobre o arco de 14px
da rosca ele serrilhou a borda em vez de dar textura. Granulado quer área.

**O degradê não vai atrás dos dados — vai atrás do convite.** Cheguei a pôr a
imagem borrada sob vidro nos quatro painéis do topo; o Davi mandou reverter
(2026-08-20). Com quatro caixas coloridas em sequência, o painel superior virava
o assunto da tela, e o assunto é o quadro embaixo.

A exceção, que ele pediu no mesmo dia, prova a regra: **"Abrir chamado" é o
único painel com o degradê no fundo** (`.campo-degrade`). Ali não há dado para
competir — é um convite a escrever, e a cor faz o convite. Granulado em **0.10**
contra 0.38 do resto: quase invisível, presente só para quebrar o *banding* que
um blur de 46px produz num degradê tão liso.

Os outros três painéis usam `card()`, a superfície normal do sistema.

### 11.5 Um amarelo só

O dourado da marca (`SUPERNOVA[400]`, `#F8C811`) e o amarelo do prisma
(`#F5BE45`) ficam a poucos graus de matiz um do outro. Lado a lado, a diferença
não lê como escolha — lê como erro. Por isso, **na Início vale o prisma**, em
tudo: micro-rótulos, filtros, alvo de arraste, contador de notificações.

O dourado da marca continua onde é gradiente e lê como coisa própria:
`GRAD_PRIMARIA` nos botões de **ação** e o logotipo.

**Atualização da U72 (R87):** "gradiente = dourado" deixou de valer para o
botão de **escolha**. Ele passou a levar o degradê da cor da própria escala
(status, equipe, tipo), gerado por `degradeDaCor()` a partir do tom saturado —
ver §6.4. A regra que sobrou, e que é a que interessa, é a distinção de papel:
**dourado é ação, cor é escala.** O amarelo do prisma e o dourado continuam sem
disputar espaço, porque agora nunca aparecem no mesmo tipo de botão.

## 12. Tipografia (v12 — 2026-09-04, R195)

**Montserrat**, em quatro pesos e só quatro — **100, 400, 600 e 700**.
Carregada do Google Fonts com `display=swap`: o texto aparece na fonte do
sistema enquanto a webfont baixa, em vez de a tela ficar em branco no 4G de
obra.

**R195 — a régua** (Davi, 04/09/2026: tipografia estratégica, "mais grosso
onde cabe, mais fino no resto"). O peso diz o PAPEL do texto, não o gosto:

| peso | onde | por quê |
|---|---|---|
| **100 Thin** | o `%` da rosca (52px) | no tamanho, o peso vira ruído: quem carrega a hierarquia é o corpo do número |
| **400 Regular** | corpo, descrição, **valor digitado em campo**, metadado ("quem · quando"), placeholder | leitura longa — e o campo de texto é leitura, não título |
| **600 SemiBold** | título de card, nome de pessoa ou cliente, chip, item de menu, botão, **rótulo pequeno (≤ 10,5px)** | o degrau mais usado; texto pequeno precisa de peso para existir |
| **700 Bold** | **título de página (22px)**, título de coluna e de seção, micro-rótulo em caixa alta, valor de barra, **número do KPI** | o que organiza a tela leva o peso |

**Não existe 500 nem 800.** Pedir um peso que não foi carregado faz o navegador
escolher o vizinho ou *sintetizar* — engordar ou afinar o desenho por conta —
e Montserrat sintetizada fica borrada. A v6 tinha varrido 500 e 800 e eles
voltaram (14 e 6 usos); a U108 varreu de novo — valor de campo → 400, rótulo
pequeno → 600, 800 → 700 — e desta vez o **verificador cobra**: o conjunto de
`fontWeight` em `src/` é exatamente {100, 400, 600, 700}, e nenhum título de
22px é 600. Se algum peso novo for preciso, ele entra na URL da fonte primeiro
e nesta tabela depois.

Numeral em coluna leva `fontVariantNumeric: "tabular-nums"`.

## 13. Avatares sem foto

Quatro degradês, um por família do prisma — azul, amarelo, laranja, vermelho —
com **glow fraco** (`0 0 10px`, alfa .42): o suficiente para a pastilha descolar
do card sem virar farol numa lista com dez delas.

A cor sai de um **hash do id da pessoa**, não de sorteio. Sorteio de verdade
trocaria a cor a cada render, e a cor do avatar é justamente como se reconhece
alguém de relance numa lista. Travado por asserção (`degradeAvatar` estável).

## 14. O campo "Abrir chamado"

O único painel com o degradê no fundo. Quatro regras, todas aprendidas errando:

**Raio 20px, declarado uma vez.** `.campo-degrade` usa `!important` porque o
`card()` inline diria 18. A caixa de texto interna é 16 — **a de fora precisa
ser mais redonda que a de dentro**; invertido, o olho lê a interna como solta.

**O canto parecia reto e não era.** A 150° o degradê começa pelo azul, e em
opacidade baixa aquele canto ficava quase preto — igual ao fundo da página. O
arredondamento estava lá, invisível. Diagnóstico de cor, não de geometria.

**O brilho é constante: 0.80 (0.42 no claro).** Era o valor que só aparecia no
hover, e era o certo.

**O hover movimenta, não acende.** O degradê expande (`scale(1.14)`, 450ms) e o
card sobe (`.elevavel`). Nenhuma mudança de opacidade. Anulado sob
`prefers-reduced-motion`.

O clipe de anexo acende no amarelo principal (`--amarelo-principal`, que espelha
`PRISMA.amarelo`) com `!important` — o fundo do botão é inline, e inline ganha
de classe.

**O canto reto era reto mesmo.** `filter: blur()` promove a camada para a GPU, e
camada promovida **escapa do arredondamento de `overflow: hidden`** — o Chrome
pintava o degradê em retângulo por cima dos cantos. A correção é `clip-path`,
que clipa no compositor.

Mas `clip-path` clipa também a **sombra do próprio elemento**: posto no painel,
ele apagaria o realce do `.elevavel` no hover. Daí a camada intermediária
`.campo-degrade-clip` — ela clipa, e o painel guarda a sombra.

Os KPIs ganharam um glow levíssimo na **própria cor do número**
(`textShadow: 0 0 16px <cor>59`), não um véu branco: cada indicador brilha no
seu tom.
