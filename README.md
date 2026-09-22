# Prever OS

Sistema interno do **Grupo Prever** (segurança eletrônica: portaria remota, monitoramento
24h, controle de acesso, CFTV). Concentra numa fila só o trabalho da empresa: chamados
técnicos de campo, atividades internas das equipes, propostas comerciais, clientes e seus
equipamentos, contratos, cobrança e painéis de gestão. Substitui o Notion e o Gestor OS.
Em **uso oficial desde 15/09/2026**.

Nasceu como automador de propostas (por isso o repositório ainda se chama
`prever-proposta`) e virou o sistema de atividades da casa. As regras de produto são
ditadas pelo Davi, em conversa, e registradas uma a uma em `docs/PRODUTO.md`.

## Stack

| Camada | Tecnologia |
|---|---|
| Front + SSR | React 19, TypeScript, TanStack Start (roteamento por arquivo, `src/routes/`) |
| Dados | Supabase: Postgres com RLS, autenticação, storage (`contratos`, `fotos-os`), realtime, edge functions, pg_cron |
| Gráficos | recharts, na rampa de cores da casa (`docs/DASHBOARD.md`) |
| Celular | Capacitor (`android/`) para o app do técnico |
| Publicação | Lovable publica cada push em `main`; pacote Windows Server via `npm run build:windows` |
| Documentos | proposta em `.docx`/PDF gerada pelo app |

## Onde roda

- Servidor da empresa: `http://192.168.10.182:5555` e `grupoprever.ddns.net:5555`
  (Windows Server, serviço WinSW — `docs/manual/hospedagem-windows.md`).
- Lovable: o endereço de pré-visualização, atualizado a cada push. Sair dela está
  decidido (R280), sem data — `ONBOARDING.md` §6 tem o plano.
- Banco: um projeto Supabase compartilhado pelos dois. Migrations são rodadas à mão pelo
  Davi no SQL Editor; o repositório só as escreve.

## Começando

```sh
npm install                          # setup
npx vite dev                         # run — http://localhost:8080
npx tsc --noEmit                     # lint: tem de dar 0 erros
node scripts/verificar-logica.cjs    # test: 3.581 asserções, "0 falharam"
npx vite build                       # build (regenera src/routeTree.gen.ts — commite)
py -3 -m pip install -r scripts/requirements.txt   # uma vez (Linux/CI: python3)
py -3 scripts/harness-gates.py       # todos os gates — a definição de pronto
```

Os seis comandos da stack e os gates estão declarados em `.harness/harness.yaml`; agentes
e CI leem de lá, nunca assumem. O app exige login; a chave pública do Supabase vem do
`.env` versionado. A service role key NUNCA entra no repositório.

## Mapa

O repositório segue o **Pattern Harness** da casa (Bitbucket `preverti/pattern`, adotado
em ADR-0001): fonte única em arquivos, adaptadores gerados por ferramenta, documentação
viva por módulo e gates que definem "pronto".

| Caminho | Camada | O quê |
|---|---|---|
| `AGENTS.md` | L1 | Cápsula de contexto: resumo, protocolo de leitura, ciclo, invariantes, mapa de módulos |
| `docs/REQUIREMENTS.md` → `docs/requirements/` | L2 | O "o quê" por módulo, apontando as regras R# de `docs/PRODUTO.md` (o catálogo) |
| `docs/state/` | L2 | O estado da implementação por módulo: o que existe, padrões a reusar, cobertura, pendências |
| `.claude/skills/` | L3 | Skills: `organizador`, `designer`, `banco`, `entrega` |
| `.harness/mcp/servers.json` | L4 | Ferramentas externas (MCP) — vazio hoje |
| `.harness/agents/` | L5 | Papéis: planner, implementer, reviewer, verifier |
| `.harness/INDEX.md` | L6 | Índice gerado (nó raiz) — não editar |
| `.harness/harness.yaml` + `.github/workflows/harness.yml` | L7 | Comandos e gates — a definição de pronto |
| `docs/ARCHITECTURE.md` → `docs/decisions/`, `docs/NFR.md`, `docs/conventions.md` | L8 | O porquê (ADRs), o que se promete, o aprendido |
| `scripts/harness-sync.sh` · `harness-index.sh` | L9 | Regeneram adaptadores e índice |

Os documentos que já existiam continuam sendo a fonte — o padrão os indexa, não os
reescreve (ADR-0002):

| Documento | O quê |
|---|---|
| `docs/ESTADO_ATUAL.md` | onde o projeto está: última regra e entrega, migrations, o que está no ar |
| `docs/DECISOES_PENDENTES.md` | tudo o que depende do Davi (também em Word, `Decisoes-Pendentes-Prever.docx`) |
| `docs/PRODUTO.md` | TODAS as regras de produto (R1–R305), com as frases do Davi |
| `docs/PLANO_UNIFICACAO.md` | o diário de entregas (U-série): o porquê de cada decisão técnica |
| `docs/VERSOES.md` | o que entrou em cada versão e a migration que ela exige |
| `docs/PENDENCIAS_TECNICAS.md` | dívida técnica conhecida (P-série) |
| `docs/CONTEXTO_*.md` | o que o Davi ditou sobre campo, atividades e viaturas |
| `docs/manual/` | o manual por segmento |
| `DESIGN_SYSTEM.md` | tokens, temas, componentes e anti-padrões |

## Regras de ouro

1. Regra de produto nasce ANTES do código, numerada, com a frase do Davi.
2. Toda regra vira asserção permanente; o verificador termina em `0 falharam`.
3. Migration é escrita aqui e rodada pelo Davi; idempotente, com conferência e DESFAZER.
4. Lógica pura em `modelo.ts`; tela só pinta. "Quem conta é quem filtra."
5. Nunca reescreva histórico do `main`; nunca edite arquivo gerado.
6. Pronto = gates verdes após a última alteração (`py -3 scripts/harness-gates.py`).

## Estrutura

```
src/routes/_authenticated/   telas (uma por arquivo; routeTree.gen.ts é gerado)
src/features/<dominio>/      modelo.ts (lógica pura) · data.ts (consultas) · componentes
src/lib/                     paleta, ui, telas (catálogo de permissões), períodos, status
supabase/migrations/         histórico completo do banco (a fonte do schema)
scripts/                     verificador, sumários, fechar-entrega, build Windows, harness
docs/                        documentação viva (índices: ESTADO_ATUAL, REQUIREMENTS, ARCHITECTURE)
.claude/skills/              as skills da casa
.harness/                    manifesto, papéis, índice gerado, MCP
```

Detalhe e regra de dependência: `docs/PROJECT-STRUCTURE.md`. A cópia local do padrão
em `docs/padrao-projeto/` é referência (clone do Bitbucket) e fica fora do git.
