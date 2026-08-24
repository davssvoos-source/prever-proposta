# ONBOARDING — migrar o desenvolvimento para outra máquina/conta

Guia da transição (escrito em 2026-08-24, na saída da máquina antiga). O
repositório é **autossuficiente**: nenhum código referencia arquivo fora
dele; os insumos históricos (planilhas, exports) já viraram migrations.

## 1. O que levar

| Item | Como |
|---|---|
| **O repositório** | `git clone` do GitHub (`davssvoos-source/prever-proposta`). É tudo: código, docs, migrations, `.env` público, template da proposta (`public/templates/`). |
| **Contexto do assistente** | Já está no repo: `CLAUDE.md` (método + armadilhas) é lido automaticamente por sessão nova do Claude Code — a memória da conta antiga NÃO migra, e foi portada para lá. |
| **`.env` da pasta-mãe** (opcional) | `prever-importacao/.env` tem a SERVICE key do Supabase — **NUNCA entra no repo**. Só foi usada para inspeção manual; se precisar, copie à parte ou gere outra no painel do Supabase. |
| **Pasta-mãe `prever-importacao/`** (opcional) | Insumos históricos (planilhas-base, `lista-OS-retroativo/`, `Base-Propostas/`). O app não depende deles; leve se quiser o arquivo morto. |

## 2. Preparar a máquina nova

```bash
# Node 20+ (a máquina antiga rodava v24) — nvm/asdf/brew, tanto faz
git clone <repo> && cd prever-proposta
npm install            # package-lock.json é o lockfile do dev local
                       # (bun.lock/bunfig.toml são do build da Lovable — deixe os dois)
```

Sanidade (as três têm de passar antes de qualquer mudança):

```bash
node scripts/verificar-logica.cjs   # "... 0 falharam"
npx vite build                      # completa
npx tsc --noEmit | grep -c "error TS"   # ~85 pré-existentes; é o baseline
```

> Nota: `docs/manual/desenvolvimento-e-verificacao.md` dizia que `tsc` nunca
> completava — era limitação do disco iCloud da máquina antiga. Se a nova
> não usar iCloud para o projeto, `tsc` roda em segundos. **Evite pasta
> sincronizada por nuvem para o repo** (Documents/iCloud foi a causa).

## 3. Acessos a reconfirmar

- **GitHub** — push em `main` publica via Lovable. A conta nova do Claude
  precisa de credencial git válida (a autorização do app do GitHub é por
  conta/máquina).
- **Lovable** — é quem builda e hospeda; migrations rodam no SQL Editor de
  lá. Nada muda com a troca de máquina, só confirme o login.
- **Supabase** — o painel continua o mesmo; a publishable key já está no
  `.env` versionado.

## 4. Primeira sessão do Claude na conta nova

1. Abrir o Claude Code na raiz do repo — o `CLAUDE.md` carrega sozinho.
2. Pedir qualquer tarefa pequena e conferir que o ciclo é seguido
   (R→PRODUTO / implementação / asserções / build / U→PLANO / commit).
3. A conta nova começa sem memória — está tudo em `CLAUDE.md` + `docs/`;
   memórias novas vão se acumulando a partir do uso.

## 5. Estado do projeto na entrega (2026-08-24)

- Última regra: **R79** (revisão de design/modo claro) · último diário:
  **U67** · **1332 asserções**, build limpo, 85 erros de tipo pré-existentes.
- Migrations pendentes de rodar: nenhuma anunciada como pendente — as duas
  últimas entregues (U64 apoio-da-dupla, U65 chamados de teste) dependem de
  o Davi já ter rodado; os SELECTs de conferência delas dizem o estado.
- Defeitos conhecidos e decisões adiadas: `docs/PENDENCIAS_TECNICAS.md`.
