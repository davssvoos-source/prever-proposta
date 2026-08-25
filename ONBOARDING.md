# ONBOARDING — migração para a máquina nova

Atualizado em 2026-08-24. O plano: PC novo **sem iCloud**, conta nova do
Claude (a empresa vai assinar para o T.I.), dados operacionais zerados para
lançar do zero. Este sistema substitui o Notion (assinatura será cancelada) e
o Sigma OS.

> **A Lovable FICA, por enquanto** (decisão do Davi, 2026-08-24). Ou seja: a
> migração de máquina não mexe em deploy, hospedagem nem banco — é só clonar
> o repo na máquina nova e continuar. O plano de saída existe e está pronto
> na §6, para o dia em que valer a pena; não é pré-requisito de nada aqui.

## 1. O que levar

| Item | Como |
|---|---|
| **O sistema** | `git clone` do GitHub (`davssvoos-source/prever-proposta`). Código, docs, migrations, `.env` público, template da proposta — tudo viaja no git. |
| **Contexto do assistente** | Já está no repo: `CLAUDE.md` é lido automaticamente por qualquer sessão nova do Claude Code — vale para a sua conta nova E para as contas do resto do T.I. |
| **`.env` da pasta-mãe** | Tem a SERVICE key do Supabase — **NUNCA entra no repo**. Copie à parte (gerenciador de senhas) ou gere outra no painel. |
| **`arquivo/`** (opcional) | O histórico morto da pasta-mãe, já organizado (ver o README de lá). Nada roda a partir dele. |

## 2. Estrutura de pastas na máquina nova

O ninho `app-prever/prever-importacao/prever-proposta` é fóssil da época em
que isto era só um automador de propostas. Na máquina nova, plano:

```
~/prever/
├── sistema/     ← git clone (o repo; o nome do diretório local é livre)
└── arquivo/     ← cópia única da pasta arquivo/ antiga (opcional)
```

**Nunca dentro de pasta sincronizada por nuvem** (Documents/iCloud/Drive) —
o iCloud era a causa do `tsc` travado e de builds lentos na máquina antiga.

Renomear o repositório no GitHub (ex.: `prever-sistema`) é opcional e só
DEPOIS de sair da Lovable — renomear enquanto conectado quebra o sync.

## 3. Preparar a máquina

```bash
# Node 20+ (a antiga rodava v24)
git clone <repo> && cd <pasta>
npm install
```

Sanidade (as três têm de passar antes de qualquer mudança):

```bash
node scripts/verificar-logica.cjs        # "... 0 falharam"
npx vite build                           # completa
npx tsc --noEmit | grep -c "error TS"    # ~85 pré-existentes; é o baseline
```

## 4. Zerar os dados operacionais

Rodar `supabase/migrations/20260824110000_u69_limpeza_dados_operacionais.sql`
no SQL Editor do Supabase — **leia o cabeçalho antes**: é irreversível, exige
backup confirmado, e a seção C (funil comercial/propostas) pode ser comentada
se quiser preservá-lo. Depois dela, **nunca re-rode** U59/U61/U65 (as
importações — reimportariam tudo num banco limpo).

## 5. Conhecimento da empresa (Obsidian + Claude do T.I.)

- `docs/` é Markdown puro — **abre direto como vault do Obsidian** (ou entra
  num vault da organização como subpasta). Nada a converter.
- A fonte de verdade continua sendo o repo (versionada, assertada). O vault
  é espelho de leitura; regra nova entra por commit, não só pela nota.
- Toda conta do Claude do T.I. herda o método pelo `CLAUDE.md` — ele é o
  onboarding dos colegas também.

## 6. A saída da Lovable — plano guardado, NÃO é para agora

A Lovable **fica** por enquanto. Enquanto ficar, nada aqui precisa ser feito
e nada muda: push em `main` publica, o `.env` segue versionado (é dele que o
build dela lê), o `AGENTS.md` e o `.lovable/` continuam onde estão. O SQL
Editor pode ser o dela ou o do Supabase — é o mesmo banco, só muda a porta.

Esta seção existe pronta para o dia em que a saída valer a pena. A ordem
importa, e o primeiro passo é o único perigoso de tudo:

1. **CONFIRME QUE O PROJETO SUPABASE É SEU.** O banco
   (`lrepuyaootngrbotmvhn.supabase.co`) hoje é acessado pelo painel da
   Lovable. Entre em **supabase.com** com a conta da empresa e veja se o
   projeto aparece na sua organização.
   - **Aparece** → cancelar a Lovable não toca no banco. Siga.
   - **NÃO aparece** → o projeto é gerenciado por ela e **pode ser destruído
     no cancelamento**. Antes: exporte tudo (Database → Backups, ou
     `pg_dump`), crie um projeto Supabase próprio, restaure, troque as
     chaves no `.env`. Só então cancele.

   Vale fazer essa verificação **hoje**, mesmo sem cancelar nada — é 2
   minutos e responde se os dados da empresa dependem de uma assinatura.
2. **Hospedagem substituta** — o build já sai pronto para **Cloudflare
   Workers** (o nitro gera `.output/` + `wrangler.json`). Menor atrito: conta
   Cloudflare + `npx wrangler deploy`, ou uma GitHub Action no push. Testar
   ANTES de cancelar.
3. **Variáveis** no novo host: as `VITE_*` públicas (hoje no `.env`) e os
   segredos (SERVICE key, ANTHROPIC) só no painel, nunca com prefixo VITE_.
4. **Cancelar a Lovable** — só com o passo 1 confirmado e o deploy novo no ar.
5. **Faxina pós-saída** (commit próprio): remover `AGENTS.md` (boilerplate
   da Lovable) e `.lovable/`; avaliar tirar o `.env` do versionamento — a
   razão de ele ser versionado era a Lovable buildar do repo; sem ela, o
   novo pipeline injeta as variáveis e o `.gitignore` + as DUAS asserções
   sobre isso devem ser invertidas juntas.

## 7. Estado do projeto na entrega (2026-08-24)

- Última regra: **R79** · último diário: **U69** · **1341+ asserções**,
  build limpo, 85 erros de tipo pré-existentes (baseline).
- Pendências conhecidas: `docs/PENDENCIAS_TECNICAS.md`.
- Migrations aguardando o Davi rodar: U69 (a limpeza, acima).
