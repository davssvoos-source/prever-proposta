# CLAUDE.md — como se trabalha neste repositório

Este arquivo existe para uma sessão NOVA (outra máquina, outra conta) começar
com o método inteiro, sem arqueologia. Ele carrega o que antes vivia só na
memória local do assistente. Se algo aqui discordar do código, o código ganha.

## O que é o sistema

**Prever Proposta** — sistema interno do Grupo Prever (segurança eletrônica):
orçamento/proposta comercial, chamados técnicos (campo e interno), clientes,
contratos, cobrança e painéis. Substitui o Notion e o Sigma OS. React +
TypeScript + TanStack Start (SSR), Supabase, deploy pela **Lovable**: push em
`main` publica automaticamente — mantenha a branch sempre buildável e **nunca
reescreva histórico** (force push/rebase/amend em commit já enviado corrompe
o histórico do lado dela).

Sair da Lovable é uma possibilidade FUTURA, não um plano em andamento: o
passo a passo está guardado em `ONBOARDING.md` §6. Até lá, nada de "arrumar"
o que existe por causa dela — `.env` versionado, `AGENTS.md` e `.lovable/`
ficam como estão. Existe, desde a U118, um **segundo alvo do mesmo código**: o
pacote para **Windows Server** (`npm run build:windows` → `dist-windows/`, com
o instalador de porta configurável e o serviço — `docs/manual/hospedagem-windows.md`,
R220). Ele pode rodar em paralelo à Lovable apontando para o mesmo Supabase.

O usuário é o **Davi** — dita regras de produto em conversa, em português.
Todo o repo (nomes, comentários, docs) é em **português**.

## O ciclo de trabalho (obrigatório, nesta ordem)

1. **Regra de produto nova?** Numere como R-série em `docs/PRODUTO.md`
   (última usada: ver o fim do arquivo), citando a frase do Davi.
2. **Implemente** — lógica PURA primeiro (`features/*/modelo.ts`,
   `indicadores.ts`, `etapas.ts`…), tela depois. Tradução de dados nunca mora
   em componente.
3. **Asserções** — TODA regra vira asserção permanente em
   `scripts/verificar-logica.cjs` (`node scripts/verificar-logica.cjs`, tem
   de terminar em `0 falharam`). Igualdades número-mostrado ↔ lista-aberta
   são marcadas `CRÍTICO`. O helper `carregar()` transpila `.ts` na hora
   (unidade real); `.tsx` só por regex no fonte — e grep acha comentário,
   filtre linhas que começam com `//` (já rendeu 5+ falsos positivos).
4. **Build** — `npx vite build` (também regenera `src/routeTree.gen.ts`;
   commite o gerado). `npx tsc --noEmit` funciona e tem **57 erros
   pré-existentes** (types.ts do Supabase desatualizado) — o critério é não
   criar erro NOVO nos arquivos tocados. O número JÁ CAIU DUAS VEZES por
   conserto de verdade (85 → 83 → 78 → 59 → 57), e a U84 é a lição: **baseline de
   erro de tipo é onde defeito de PRODUÇÃO se esconde.** Dois dos que saíram
   eram escritas de `situacao: 'prospecto'`, valor que o CHECK recusa desde a
   U27 — cadastrar prédio novo e consolidar duplicata estavam QUEBRADOS, e o
   compilador vinha dizendo isso dentro de um número que ninguém olhava.
   Quando o baseline cair, atualize aqui E em `docs/manual/desenvolvimento-e-verificacao.md`.
5. **Diário** — entrada U-série em `docs/PLANO_UNIFICACAO.md` com o
   raciocínio em prosa (por que assim, o que se recusou a fazer, o que a
   verificação pegou). É o histórico de decisões do projeto.
6. **Commit + push** — mensagem descritiva em português; o push publica.
7. **Estado** — atualize `docs/ESTADO_ATUAL.md` (última regra, último
   diário, migrations pendentes, perguntas abertas, o que o Davi vai mandar).
   É a memória que viaja com o repo: numa máquina nova é o primeiro arquivo
   que se lê depois deste, e uma asserção confere que a "última regra" dele
   bate com a do PRODUTO.
8. **Sumários** — `node scripts/sumario.cjs` regenera o bloco de sumário no
   topo de cada documento mestre (PRODUTO, diário, pendências, plano, design
   system, contextos, manual de campo). O verificador roda `--check`: sumário
   velho é asserção vermelha. Ninguém lê 10 mil linhas; navega-se pelo mapa.

## Migrations (regra inegociável)

O repo **nunca aplica** migration: o Davi roda À MÃO no SQL Editor do
Supabase. Toda migration é **idempotente**, termina com **SELECTs de
conferência** (valor obtido × esperado, e "quem não casou"), e traz o comando
de DESFAZER no rodapé. Migration entregue = arquivo em `supabase/migrations/`
+ aviso ao Davi para rodar. Nunca edite migration que o Davi JÁ RODOU — faça outra (editar não
mudaria o banco, e a alteração ficaria invisível). Migration que abortou e
não aplicou nada corrige-se NO LUGAR: mandar outra para consertar o que a
primeira nem chegou a criar é pior para quem lê depois.
Detalhes e cicatrizes: `docs/manual/banco-e-migrations.md`.

## As invariantes que não podem regredir

- **"Quem conta é quem filtra"**: o número num KPI/gráfico e a lista que o
  clique abre saem da MESMA função pura. Receita completa de dashboards:
  `docs/DASHBOARD.md`.
- **Ciclo comercial encerra no ENVIO da proposta** (R64): aprovação é
  interna; aceite/recusa do cliente NÃO é rastreado. `proposta_enviada_em`
  vence `status`.
- **Dupla é DERIVADA do responsável; apoio é GRAVADO no momento da
  atribuição** (U47 × U64) — dupla responde "de quem é hoje", apoio responde
  "quem foi", e registro não muda quando o cadastro muda.
- **Todo token de cor do `:root` tem par no `[data-theme="light"]`**
  (anti-padrão nº 9). Os oito anteriores: `DESIGN_SYSTEM.md` §8 — todos
  foram bug real, o verificador trava vários deles.
- **`.env` FICA versionado** (só chaves públicas VITE_*) — removê-lo derrubou
  o app duas vezes; o comentário no `.gitignore` explica.

## Armadilhas que já morderam (não redescubra)

- **PGRST201**: embed ambíguo depois de junção N:N — use a dica
  `tabela!coluna` (nome da COLUNA, não da constraint; rename de tabela não
  renomeia constraint).
- **Rename de tabela leva os triggers**, mas NÃO reescreve o corpo deles;
  `DISABLE TRIGGER USER` antes de mexer em dados históricos (e desligue
  notificações em cargas — senão são centenas de sinos).
- **Recharts descarta `<defs>` embrulhado em componente** (filtra filhos por
  tipo literal) — escreva `<defs>{...}</defs>` direto no gráfico; linha toda
  no zero precisa `gradientUnits="userSpaceOnUse"`. Ver `DASHBOARD.md` §5.
- **Funções voláteis (ex. numeração) em SELECT com ORDER BY** não garantem
  ordem — reserve em bloco + `row_number()`.
- **CSP `script-src 'self'` derruba o SSR** (S10 em
  `docs/PENDENCIAS_TECNICAS.md`) — só Report-Only até validar local.
- Constante de estilo em nível de módulo não enxerga tema — vire função
  `(isLight)`.

## Mapa do repo

**Comece por `docs/ESTADO_ATUAL.md`** — ele diz onde o projeto está e em que
ordem ler o resto.

| Onde | O quê |
|---|---|
| `docs/ESTADO_ATUAL.md` | ONDE ESTAMOS: última regra e diário, migrations rodadas e pendentes, decisões recentes, perguntas abertas, o que o Davi vai mandar, quem é quem, a ordem de leitura — atualizado a cada entrega (passo 7) |
| `docs/VERSOES.md` | o que entrou em cada VERSÃO instalada no servidor (R229) e a migration que ela exige; a versão mora em `package.json` = `src/lib/versao.ts` (o verificador compara) e vai em `VERSAO.txt` no pacote |
| `docs/CONTEXTO_OPERACAO_TECNICA.md` | o contexto da operação técnica DITADO PELO DAVI (quem é quem, as três atividades, cliente como centro, QAP só lido, validação do gestor) — leia antes de mexer em campo/técnica |
| `docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md` | a estrutura das atividades DITADA PELO DAVI (os seis tipos e a matriz de campos, as duas perguntas da criação, equipe das pessoas, impacto operacional, grupos de clientes, o que saiu: pedido de compra e sprint) — leia antes de mexer em atividade/chamado interno, no pop-up de criação ou na ficha do cliente |
| `docs/PLANO_V0.1.md` | o plano de ação rumo à v0.1: fases A–G, inventário do que já existe, perguntas em aberto |
| `docs/REVISAO_2026-09-03.md` | a revisão tela a tela (veredito por rota, achados transversais, perguntas Q11–Q17) |
| `docs/PRODUTO.md` | TODAS as regras de produto (R-série) |
| `docs/PLANO_UNIFICACAO.md` | diário de implementação (U-série) |
| `docs/DASHBOARD.md` | receita obrigatória de dashboards |
| `DESIGN_SYSTEM.md` | tokens, temas, anti-padrões §8 |
| `docs/PENDENCIAS_TECNICAS.md` | defeitos conhecidos e não corrigidos |
| `docs/manual/` | manual por segmento (atualizar junto com regra nova) |
| `scripts/verificar-logica.cjs` | as ~2900 asserções — leia um bloco recente antes de escrever |
| `src/lib/paleta.ts`, `src/lib/ui.ts` | cor e superfície — nunca hex solto em tela |
| `.claude/skills/designer/` | a SKILL de designer UI/UX (SKILL.md + 3 referências): briefing antes do código, inventário do que já existe, estados/acessibilidade, roteiro de análise de tela. Carrega sozinha em tarefa de interface; invoca-se por `/designer` |
| `.claude/skills/organizador/` | a SKILL de organização e planejamento: onde mora cada fato (documentos mestre), os quatro rituais (início de sessão · pedido do Davi · durante · fim de entrega), estratégias de leitura por sumário e de escrita que dura. Carrega em toda sessão; `/organizador` |
| `.claude/skills/banco/` | a SKILL de migrations: o procedimento inegociável, a regra 5 (ordem de deploy e as listas NAO_OFERECIDOS), o que cada tipo de mudança exige, as cicatrizes, o modelo de migration para copiar. Carrega em toda mudança de schema/RLS/gatilho; `/banco` |
| `scripts/sumario.cjs` | gera/confere os sumários dos documentos mestre (`--check` no verificador) |
| `src/features/*/modelo.ts` | a lógica pura de cada domínio |
| `supabase/migrations/` | histórico completo do banco (fonte do schema) |

## Confirmações rápidas de sanidade

```bash
node scripts/verificar-logica.cjs   # tem de terminar "0 falharam"
npx vite build                      # tem de completar
npx tsc --noEmit | grep -c "error TS"   # baseline 57; não crie novos
```
