# Inventário — o que JÁ EXISTE neste repo

> Leia isto **antes** de criar componente, escolher cor ou escrever estilo.
> Um componente novo que duplica um existente é o defeito mais caro deste
> arquivo: no dia em que o design mudar, um dos dois vai ficar para trás.
>
> Se a lista discordar do código, o código ganha — e esta lista se corrige.
> Confira com `ls src/components` e `grep -n "^export" src/lib/ui.ts`.

---

## 1. Superfície e estilo — `src/lib/ui.ts`

| Helper | O que devolve | Use para |
|---|---|---|
| `FONT` | `var(--fonte)` (Montserrat) | toda `fontFamily` |
| `card(isLight)` | fundo + borda + raio 18 + sombra do tema | **todo card de conteúdo** |
| `vidro(isLight)` | superfície translúcida com blur | painéis, popover, sidebar — não conteúdo |
| `goldButton()` | degradê dourado + glow + tinta `#0E0E0E` | a ação principal da tela |
| `botaoSelecao(ativo, isLight, cor?)` | botão de opção pintado pela COISA (R87) | escolher tipo, status, impacto, equipe |
| `title(isLight)` | título padrão da tela | cabeçalho |
| `GOLD_GRAD` · `GOLD_GLOW` | degradê e glow da marca | FAB, CTA |
| `CARD_BG_*` · `CARD_BORDER_*` · `CARD_SHADOW_*` | as partes soltas | só quando `card()` não serve; diga por quê |

**Nunca** monte fundo/borda de card à mão. Se `card()` não serve, o caso é
novo — registre-o no `DESIGN_SYSTEM.md` em vez de improvisar na tela.

## 2. Cor — `src/lib/paleta.ts`

Quatro escalas W3C do Grupo Prever: `SUPERNOVA` (primária), `SHAMROCK`
(sucesso), `CHRISTINE` (aviso), `MAHOGANY` (erro) — tons 50…950.

| O que | Como |
|---|---|
| Par de tema | `PRISMA.<cor>` → `{ dark, light, bg, border }`. Cores: amarelo, pessego, laranja, vermelho, rosa, azulClaro, azul, azulEscuro, verde, neutro |
| Primária / sucesso / aviso / erro | `PRIMARIA`, `SUCESSO`, `AVISO`, `ERRO` (`{dark, light}`) |
| Degradê da marca | `GRAD_PRIMARIA` (135°) · tinta por cima: `SOBRE_PRIMARIA` (`#0E0E0E`) |
| Rampa de gráfico (preenchimento) | `ESPECTRO.dark` / `.light` — 9 passos · `espectro(i, isLight)` |
| Rampa de gráfico (TEXTO) | `ESPECTRO_TEXTO` · `espectroTexto(i, isLight)` — é a que passa 4,5:1 |
| Degradê CSS completo | `degradePrisma(isLight, angulo)` · paradas: `ESPECTRO_STOPS` |
| Barra de gráfico | `gradienteBarra(a, b, isLight)` — insere a `COSTURA`, senão o meio fica **verde** |
| Fatia em SVG | `paradasBarra(i, isLight)` |
| Misturar / clarear | `misturar(hex, alvo, peso)` |
| Borda em degradê da cor | `degradeDeBorda(hex, isLight)` — a técnica do card de atividade (R136/R154) |
| Enfraquecer um `rgba` | `esmaecer(rgba, fator)` — glow |
| Avatar sem foto | `degradeAvatar(chave)` |

Regras de cor desta casa:

- **O degradê ESPECTRO é identidade de marca, não escala de dados.** Foi um
  mal-entendido já corrigido uma vez (v6).
- **Dados categóricos** usam a paleta fixa de 8 do `DESIGN_SYSTEM.md` §9
  (validada para daltonismo), na ordem, sem ciclar; o 9º vira "Outros"
  cinza.
- **Dourado como TEXTO/ÍCONE no claro é `#A06108`** (`--gold-primary`), não
  `#F8C811`. `--primary` é fundo; `--gold-primary` é tinta.
- Hex novo inventado na tela = defeito. Se a cor não existe, ela nasce na
  paleta, com nome e par de tema.

## 3. Componentes próprios — `src/components/`

| Componente | Para quê |
|---|---|
| `SeletorDeOpcao` | **a propriedade que se escolhe** — botão pintado pela cor da coisa que abre a lista (status, tipo, impacto). É o padrão da tela da atividade (R135) |
| `CampoComBusca` | select com busca e grupos; `compacto`, `limpavel`, `vazio`, `iconeEsquerda` |
| `AvatarPilha` | rostos empilhados (`ids`, `pessoas`, `max`, `tamanho`) |
| `PessoaComFoto` · `AvatarCirculo` | um rosto, com degradê estável quando não há foto |
| `StatusBadge` | chip de status |
| `TelaDeErro` | a tela de erro da casa, com código `PRV-ÁREA-CLASSE-ORIGEM` |
| `EditorDeDescricao` · `TextareaComMencoes` · `useMencao` | descrição em blocos, checklist real, menção com `@` |
| `TextoComChecklist` | leitura de texto com checklist |
| `ThemeToggle` | alternador claro/escuro |
| `SideNav` (≥1024px) · `BottomNav` (<1024px) | navegação — leem `nav-itens.ts` e a matriz de permissões |
| `NotificationPanel` · `NotificacoesSidebar` | sino e painel de avisos |
| `GlowBackground` | o fundo da página (degradê por tema) |
| `LogoPrever` | o logotipo oficial, **sem filtro nem recolorir** |

Fora de `components/`, mas compartilhados:

- `src/features/paineis/PainelBase.tsx` — **todo painel novo nasce daqui**
  (números com tom do espectro + atalhos filtrados por permissão +
  `children`). Três painéis com anatomia própria viram irmãos desiguais na
  primeira mudança de design.
- `src/features/home/MenuFiltro.tsx` · `CampoBusca.tsx` — filtro e busca.
- `src/features/home/CardAtividade.tsx` — o card com cor só na borda (R136).
  É o card de atividade em TODO lugar — a Início, o painel operacional e a
  ficha do cliente (R212) — sempre via `atividadeDoChamado`/`atividadeDaVisita`.
- `src/features/clientes/ClienteForm.tsx` — `CardLocal` · `CardContatos`
  (cards editáveis com lápis e Salvar/Cancelar no lugar, R203) · `Contato`
  (com os botões WhatsApp/copiar, R207) · a casca `CascaDoCard`.
- `src/features/clientes/InventarioCliente.tsx` · `EquipamentosDoCliente.tsx`
  — os dois painéis do vínculo por arrasto (R206): `estiloDoPainel`,
  `CabecalhoDoPainel`, `LinhaDoPatrimonio`, `SeletorDeSistema`.
- `src/features/chamados/FileiraDeReacoes.tsx` — a fileira de reações de um
  comentário (R217), a mesma no painel, na página e no chat.
- `src/features/home/ChatDeMencoes.tsx` — o botão flutuante e o painel do chat
  de menções (R215); `PainelChamado` com `posicao="central"` é o Dialog no
  meio da tela.
- `src/features/gerencial/NovaVisitaTecnica.tsx` — o formulário da proposta
  (R194), com `embutido` para viver dentro do "+" da Início (R214).

## 4. shadcn/ui — `src/components/ui/` (45 arquivos)

Existem: accordion, alert, alert-dialog, avatar, badge, breadcrumb, button,
calendar, card, carousel, chart, checkbox, collapsible, command,
context-menu, dialog, drawer, dropdown-menu, form, hover-card, input,
input-otp, label, menubar, navigation-menu, pagination, popover, progress,
radio-group, resizable, scroll-area, select, separator, sheet, sidebar,
skeleton, slider, sonner, switch, table, tabs, textarea, toggle,
toggle-group, tooltip.

**Ressalva (anti-padrão nº 7 do DS):** vários trazem estilo escuro embutido e
não leem o tema. Antes de usar um deles numa tela nova, confira no claro. As
telas recentes preferem estilo inline com os helpers de `ui.ts` justamente
por isso — mas `sonner` (toast) é o padrão de aviso do app e `skeleton`
serve de carregando.

## 5. Classes utilitárias — `src/styles.css`

| Classe | O que faz |
|---|---|
| `.sangra-x` | a margem lateral da casa; faixa, filtros e quadro compartilham |
| `.trilho-x` | trilho horizontal |
| `.elevavel` | elevação no hover — **move, não clareia** |
| `.detalhe-grid` | duas colunas (texto largo + propriedades) ≥1024px; uma no celular |
| `.cal-semana` | sete colunas no desktop, lista no celular |
| `.kanban-op`, `.kanban-op-coluna`, `.kanban-op-itens` | quadro por status |
| `.painel-numeros`, `.painel-atalhos` | anatomia do painel |
| `.lista-atividades`, `.barra-filtros` | a Início |
| `.ruido`, `.textura` | granulado sutil |
| `.campo-degrade` | o campo de IA com fundo em degradê |
| `.so-desktop` / `.so-celular` | troca por CSS no breakpoint 1024px — **nunca por JS** (media query não pisca no primeiro render) |
| `.clientes-duas-colunas`, `.clientes-lista`, `.fachada-card` | a tela de clientes |
| `.pagina-larga` | a página sangra até a borda da janela (a conta da `.sangra-x`) — a ficha do cliente (R205); use `paddingTop/Bottom`, nunca o atalho `padding` |
| `.ficha-grid` (+ `.ficha-identidade/-local/-atividades`) | as três áreas da ficha: uma coluna no celular, duas de 1024 a 1439, três a partir de 1440; colunas esticadas e alinhadas embaixo (R209/R219) |
| `.painel-vinculo` | os dois painéis do vínculo por arrasto, lado a lado e da mesma altura no desktop (R206/R208) |
| `.rolagem-fina` | barra de rolagem fina no desktop — todo contêiner que rola por dentro |
| `.fab-chat` · `.fab-chat-painel` | o botão flutuante do chat e o painel, acima da BottomNav no celular (R215) |
| `.nova-visita-colunas` · `.nova-visita-embutida` | as colunas do formulário da visita; embutido no "+", no máximo duas (R194/R214) |
| `.checklist-check`, `.editor-linha`, `.mencao-chip`, `.mencao-lista` | o editor |
| `@utility badge-pill`, `btn-gold`, `stat-card`, `section-eyebrow`… | utilitários Tailwind da casa |

## 6. Tokens CSS

Declarados em `:root` (escuro) e redefinidos em `[data-theme="light"]`.
**Todo token de cor tem par no claro** — é a invariante nº 9, travada por
asserção.

- Superfície: `--bg-base`, `--bg-elevated`, `--bg-overlay`, `--card`,
  `--card-bg`, `--popover`, `--sidebar`
- Texto: `--text-primary`, `--text-secondary`, `--text-muted`,
  `--foreground`, `--muted-foreground`, `--icon-color`
- Marca: `--primary` (fundo), `--gold-primary` (texto), `--gold-bright`,
  `--gold-dim`, `--gold-glow`, `--gold-glow-hv`
- Semântico: `--success`, `--warning`, `--destructive`, `--info` (+
  `-foreground` de cada)
- Traço: `--border`, `--border-color`, `--input`, `--ring`
- Geometria e efeito: `--radius` (1rem, **sem tema** — é a exceção),
  `--fonte`, `--rail` (0 no celular, 232px no desktop), `--vidro-blur`
  (none no celular), `--ruido`
- Gráfico: `--chart-1..5`

Valores do tema claro v10 (R154): página `#e9e9e9` · card `#ffffff` · texto
`#212121` · secundário `#505050` · apagado `#727272`.

## 7. Layout

- **Breakpoint único: 1024px.** É onde a sidebar aparece, `--rail` vira
  232px e `.detalhe-grid` abre em duas colunas. Há dois ajustes em 1600px.
- A tela precisa funcionar com a **sidebar recolhida** (232/72 —
  `src/lib/sidebar-recolhida.ts`, singleton com `useSyncExternalStore`). Não
  meça a tela pela janela sem descontar o rail.
- Grades com `repeat(auto-fit, minmax(…, 1fr))` e `gap` — sem margem solta.
- Raio padrão 16–18. Uma sombra por nível.

## 8. Armadilhas de renderização já pagas

- `filter: blur()` promove a camada para a GPU e **escapa do
  `border-radius`** de `overflow: hidden`. `clip-path` resolve, mas no pai
  corta o próprio `box-shadow`. Se um vidro vazar do raio do card, é isto.
- CSS não tem gradiente em `border`, e `border-image` descarta o
  `border-radius`. A borda em degradê se faz com **duas camadas de
  background** (`padding-box` sólido + `border-box` degradê) e borda
  transparente — receita em `DESIGN_SYSTEM.md` §6.12.
- Recharts **descarta `<defs>` embrulhado em componente** — escreva
  `<defs>{…}</defs>` direto no gráfico.
- Constante de estilo em nível de módulo não enxerga tema. Vire função.
