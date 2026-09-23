<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Prever OS — Cápsula de Contexto

Sistema interno do Grupo Prever (segurança eletrônica: portaria remota, monitoramento,
controle de acesso). Atividades da empresa numa fila só: chamados técnicos de campo,
atividades internas, propostas comerciais, clientes e equipamentos, contratos, cobrança
e painéis. Substitui o Notion e o Gestor OS. React + TypeScript + TanStack Start (SSR),
Supabase (Postgres com RLS), publicado pela Lovable a cada push em `main` e instalado
num Windows Server da empresa. Quem dita as regras é o **Davi**, em português; o gestor
da equipe técnica de campo é o **Vinicius**. Todo o repositório é em **português**.

**Estado (resumo)**: v1.0.2 em uso oficial desde 15/09/2026; 305 regras de produto,
156 entregas no diário, mais de 3.500 asserções no verificador, `tsc` em zero. O retrato vivo é
`docs/ESTADO_ATUAL.md`; o que espera o Davi, `docs/DECISOES_PENDENTES.md`.

## Protocolo de leitura (economia de contexto)

- `docs/` é o contrato vigente. Pedido do Davi que o altere vira regra R-série em
  `docs/PRODUTO.md` **antes** do código, citando a frase dele; a documentação nunca se
  sobrepõe ao que ele acabou de dizer.
- **Nunca leia `docs/` por inteiro.** Entre pelos índices e leia só o pertinente:

| Onde | O quê |
|---|---|
| `docs/ESTADO_ATUAL.md` | ONDE ESTAMOS: última regra e diário, migrations, o que está no ar, a ordem de leitura — o primeiro arquivo depois deste |
| `docs/DECISOES_PENDENTES.md` | tudo o que depende do Davi (gestos, decisões, o que ele vai mandar, T.I.) |
| `docs/REQUIREMENTS.md` → `docs/requirements/<modulo>.md` | o "o quê" do módulo da tarefa, apontando as regras R# de `docs/PRODUTO.md` |
| `docs/state/<modulo>.md` | o que existe, os padrões a reusar, a cobertura R# → verificação e as pendências — SÓ o módulo da tarefa |
| `docs/ARCHITECTURE.md` | ADRs (`docs/decisions/`), `docs/NFR.md`, `docs/PROJECT-STRUCTURE.md`, `docs/conventions.md` |
| `docs/PRODUTO.md` | TODAS as regras de produto (R-série, global) com as frases do Davi — cite pelo número |
| `docs/PLANO_UNIFICACAO.md` | o diário (U-série): o porquê de cada decisão técnica |
| `docs/VERSOES.md` | o que entrou em cada versão instalada e a migration que ela exige |
| `docs/CONTEXTO_OPERACAO_TECNICA.md` | a operação técnica DITADA pelo Davi — leia antes de mexer em campo/técnica |
| `docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md` | a estrutura das atividades DITADA pelo Davi — leia antes de mexer em atividade ou no pop-up de criação |
| `docs/CONTEXTO_VIATURAS.md` | o controle das viaturas DITADO pelo Davi — leia antes de mexer em viatura/viagem |
| `docs/PLANO_V0.1.md` · `docs/REVISAO_2026-09-03.md` | o plano por fases e a revisão tela a tela |
| `docs/PENDENCIAS_TECNICAS.md` · `docs/DASHBOARD.md` · `DESIGN_SYSTEM.md` | dívida técnica (P-série) · receita de painel · tokens e anti-padrões |
| `docs/manual/` | o manual por segmento — atualizar junto com regra nova |
| `scripts/verificar-logica.cjs` | as asserções permanentes — leia um bloco recente antes de escrever o seu |

- Os documentos mestre têm **sumário gerado** no topo (`node scripts/sumario.cjs`);
  navega-se pelo sumário, e regra cita-se pelo número (R305), entrega pelo diário (U155).
- Skills da casa: `.claude/skills/organizador/` (toda sessão: rituais, documentos mestre),
  `.claude/skills/designer/` (interface), `.claude/skills/banco/` (migrations),
  `.claude/skills/entrega/` (o fecho). Papéis em `.harness/agents/`.
- Ferramentas da IA: `scripts/lib/editar.cjs` (patch tudo-ou-nada, rascunho `.cjs` escrito pelo
  Write no scratchpad — nunca heredoc nem `node -e`), `scripts/fechar-entrega.cjs` (o fim de
  entrega), `soCodigo()` no verificador. Detalhe e armadilhas: `docs/conventions.md`.

## Ciclo de trabalho (obrigatório, nesta ordem)

1. **Regra** — pedido novo vira R-série em `docs/PRODUTO.md` com a frase do Davi.
2. **Implementação** — lógica PURA primeiro (`features/*/modelo.ts`, `indicadores.ts`),
   tela depois. Tradução de dados nunca mora em componente.
3. **Asserções** — toda regra vira asserção permanente em `scripts/verificar-logica.cjs`
   (`node scripts/verificar-logica.cjs` termina em `0 falharam`). Igualdade número-mostrado
   ↔ lista-aberta é `CRÍTICO`. `.tsx` só por regex; comentário não conta (`soCodigo`).
4. **Build** — `npx vite build` (regenera `src/routeTree.gen.ts`; commite) e
   `npx tsc --noEmit` em **0 erros**. O baseline de tipos é ZERO desde a U138.
5. **Diário** — entrada U-série em `docs/PLANO_UNIFICACAO.md`: por que assim, o que se
   recusou, o que a verificação pegou.
6. **Commit + push** — mensagem em português; o push publica na Lovable.
7. **Estado** — `docs/ESTADO_ATUAL.md` (última regra, último diário, migrations, pendências).
8. **Sumários** e gates — `node scripts/fechar-entrega.cjs --versao X --regra Rn --diario Un`
   regenera os sumários e roda o verificador; `node scripts/harness-gates.cjs` é a definição
   de pronto (Windows, Linux e CI — sem Python nem sh).

## Migrations (regra inegociável)

O repositório **nunca aplica** migration: o Davi roda À MÃO no SQL Editor do Supabase.
Toda migration é idempotente, tem pré-voo, conferência obtido × esperado × veredito e o
DESFAZER no rodapé. Nunca edite migration que ele JÁ RODOU — faça outra. O procedimento
inteiro está na skill `banco` e em `docs/manual/banco-e-migrations.md`.

## Comandos e definição de pronto

Nunca assuma comandos da stack; consulte `commands:` em `.harness/harness.yaml`. Os gates
do manifesto são a definição de pronto: `docs-lint`, sumários em dia, adaptadores e índice
em sincronia, testes do executor, `tsc` zero, verificador em `0 falharam` e `vite build`.
O pacote Windows (`npm run build:windows`, `docs/manual/hospedagem-windows.md`) sai com o
dev server PARADO — senão o zip vem incompleto.

## Mapa de módulos

| Módulo | Responsabilidade | Requisito |
|---|---|---|
| atividades | a atividade como unidade: naturezas, tipos, estrutura, Início, chat | `docs/requirements/atividades.md` |
| campo | agenda de campo, programação, equipes, retorno, plantão, viaturas, app do técnico | `docs/requirements/campo.md` |
| comercial | visita técnica, orçamento por blocos, proposta, funil, painel comercial | `docs/requirements/comercial.md` |
| clientes | cadastro que vem do QAP, prospecção, locais, sistemas e equipamentos, ficha | `docs/requirements/clientes.md` |
| financeiro | contratos, cobrança do chamado, fechamentos, quem vê valores | `docs/requirements/financeiro.md` |
| acessos | cargos, matriz de telas, RLS, convites, Administrativo | `docs/requirements/acessos.md` |
| paineis | Início, Operacional Técnica, Gestão Técnica, indicadores | `docs/requirements/paineis.md` |
| interface | design system, temas, tipografia, réguas | `docs/requirements/interface.md` |
| plataforma | build, publicação, versões, Supabase, migrations, verificação, hospedagem | `docs/requirements/plataforma.md` |

## Invariantes (decisões fechadas — não re-derivar nem re-debater)

- **"Quem conta é quem filtra"**: o número num KPI e a lista que o clique abre saem da
  MESMA função pura (`docs/DASHBOARD.md` §7.2).
- **O ciclo comercial encerra no ENVIO da proposta** (R64): aprovação é interna; aceite
  ou recusa do cliente não é rastreado. `proposta_enviada_em` vence `status`.
- **Cliente vem do QAP** (R21/R22): o Prever OS nunca cadastra cliente; prédio orçado é
  prospecção e continua prospecção depois da proposta.
- **Dupla é DERIVADA do responsável; apoio é GRAVADO na atribuição** (U47 × U64).
- **Chave de tela gravada não se renomeia** (`permissoes_tela`): muda rótulo e rota.
- **Todo token de cor do `:root` tem par no `[data-theme="light"]`**; cor sai de
  `src/lib/paleta.ts`, superfície de `src/lib/ui.ts`; pesos só {100, 400, 600, 700} (R195).
- **`.env` fica versionado** (só chaves públicas): removê-lo derrubou o app duas vezes.
- **Regras globais**: o identificador `R#` é único no sistema inteiro (catálogo em
  `docs/PRODUTO.md`), não local ao módulo — ADR-0001 registra a adaptação ao padrão.

## Manutenção da documentação (o fecho de toda entrega)

O procedimento vive na skill `entrega`: correção não cria regra; comportamento novo cria
R-série antes do código; mudança estrutural cria ADR e, se toca o banco, migration. Atualize
só o que mudou: regra, state do módulo, ESTADO, diário, versões, manual do segmento.
Regras de concisão e as armadilhas conhecidas: `docs/conventions.md`.

## Limites

- **Nunca reescreva histórico** (force push, rebase, amend em commit enviado): a Lovable
  publica de `main` e perde o histórico. Sair da Lovable está decidido (R280), sem data;
  enquanto não houver, `.env`, `AGENTS.md` (o bloco dela) e `.lovable/` ficam como estão.
- Não edite arquivos gerados (`CLAUDE.md`, `.cursor/`, `.gemini/`, `.agent/`,
  `.github/copilot-instructions.md`, `.mcp.json`, `.harness/INDEX.md`, `src/routeTree.gen.ts`,
  os sumários); rode os scripts após alterar a fonte.
- Merge é checkpoint humano; migration é gesto do Davi; senha ninguém digita por ele.
