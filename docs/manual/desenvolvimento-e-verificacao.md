# Desenvolvimento — como trabalhar neste repo sem quebrá-lo

> Manual Prever Proposta — segmento: desenvolvimento e verificação. Gerado em
> 2026-08-21 a partir de revisão do código. Fonte de verdade: o código; se
> este documento discordar dele, ele ganha.

## Para que serve este documento

O toolchain real deste repositório é peculiar (disco iCloud, deploy via
Lovable, tsc inviável). Este documento é o fluxo de trabalho que funciona e
as três coisas que já derrubaram o app quando ignoradas.

## O fluxo: mudar → checar → verificar → build → commit → push

1. **Checar sintaxe/imports** — o checador próprio (scratchpad `checar.cjs`):
   varre os ~200 arquivos, confere sintaxe e cruza imports.
   Falsos positivos CONHECIDOS (ignorar): `router.tsx`, `start.ts`,
   `styles.css?url`, `*.asset.json` em routeTree/__root.
2. **Verificar lógica** — `node scripts/verificar-logica.cjs`: 360+
   asserções. TEM que terminar em `0 falharam`.
3. **Build** — `npx vite build`: obrigatório antes de dar por pronto. O
   checador não pega tudo (ex. real: comentário JSX sem fechar passou nele e
   quebrou o build). O build também **regenera `src/routeTree.gen.ts`**.
4. **Commit + push** — o deploy é automático via Lovable a partir do repo.

### `tsc` — funciona, com um baseline

(Atualizado em 2026-08-24.) A nota antiga dizia que `tsc --noEmit` nunca
completava — era o disco iCloud da máquina de então. Ele completa em
segundos e reporta **~85 erros PRÉ-EXISTENTES** (o `types.ts` gerado do
Supabase está desatualizado desde a Etapa 1 do sistema de OS). O critério
não é zerar: é **não criar erro novo nos arquivos tocados** —
`npx tsc --noEmit | grep -c "error TS"` tem de continuar no baseline.
Verificador + vite build continuam obrigatórios.

## As três regras que já derrubaram o app

1. **`.env` FICA VERSIONADO.** O Lovable builda a partir do repo; remover o
   `.env` derrubou o app duas vezes (tela preta) — e não reproduzia
   localmente porque o arquivo seguia no disco. O `.gitignore` explica isso
   em comentário; há asserção nos dois sentidos. Não "arrume" isso.
2. **`routeTree.gen.ts` é gerado e COMMITADO.** Apagou/criou rota → rode o
   build (ou o gerador Node com `@tanstack/router-generator`, que roda sem
   vite) e **commite o routeTree novo**, senão o deploy quebra.
3. **Headers CSP: só em Report-Only primeiro.** `script-src 'self'` mata o
   script inline de hidratação do TanStack Start (derrubou o SSR — S10).
   Pré-requisito para tentar de novo: validar o build localmente com os
   headers antes de publicar.

## A prática das asserções (o que mantém o sistema honesto)

**Cada regra de produto vira asserção permanente** em
`scripts/verificar-logica.cjs`. O helper `carregar()` transpila TS na hora —
dá para importar módulos do app e fazer **teste de unidade real** (ex.: os
indicadores de campo têm dados de laboratório, não grep).

Lições acumuladas escrevendo asserções:

- **Grep em arquivo acha comentário também.** Asserções que procuram um
  termo proibido devem filtrar linhas de código (`.filter` de linhas que não
  começam com `//`) ou recortar o corpo da função — já houve 4 falsos
  positivos por comentário explicativo.
- Asserção estrutural (arquivo existe, rota redireciona, menu não tem item)
  vale tanto quanto a de cálculo — a R31/U30 tem uma varredura de `src/`
  inteira garantindo que ninguém navega para a lista morta.
- A **paridade catálogo↔semente** de permissões roda a cada verificação (ver
  `permissoes-e-acesso.md`).

**Ao corrigir um bug ou fechar uma regra: escreva a asserção junto.** É o que
impede o bug de voltar sem ninguém notar.

## Convenções de código

- Português nos nomes e comentários (o repo inteiro é assim).
- Comentário diz o PORQUÊ/a restrição, não o quê.
- Modelo compartilhado antes de tela: tradução de dados mora em
  `features/*/modelo.ts|data.ts`, nunca dentro de componente (cicatriz das
  duas traduções de visita).
- Cores/fonte/cards: sempre pelos módulos (`paleta.ts`, `ui.ts`) — ver
  `interface-e-design.md`.

## Referências

- `scripts/verificar-logica.cjs` — leia o topo e um bloco recente antes de
  escrever asserção nova
- `.gitignore` — o comentário do `.env`
- `docs/PENDENCIAS_TECNICAS.md` — S10 (CSP) e os defeitos conhecidos
