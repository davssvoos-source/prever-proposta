# Prompt da primeira sessão no PC novo

Cole o texto abaixo (tudo dentro do bloco) no Claude Code, aberto em qualquer
lugar dentro da pasta `prever-proposta` copiada. Ele foi escrito em
2026-08-24 na máquina antiga.

---

```
Contexto: eu (Davi, T.I. do Grupo Prever) acabei de migrar para este PC novo.
COPIEI as pastas `app-prever` e `gestor-os` da máquina antiga (um Mac, onde
elas ficavam em ~/Documents e o iCloud estava ativo) — não clonei do git.
Este PC não tem iCloud.

O sistema principal é o `prever-proposta`, que está aninhado assim:
app-prever/prever-importacao/prever-proposta. Ele é um repositório git de
verdade, com remote no GitHub (davssvoos-source/prever-proposta), e tem na
raiz um CLAUDE.md que explica o método de trabalho inteiro — LEIA ELE
PRIMEIRO, é o meu onboarding para você.

Preciso que você faça, nesta ordem, e me mostre o resultado de cada etapa:

1) INTEGRIDADE DA CÓPIA
   - Confirme que estamos num repositório git válido: `git status`,
     `git log --oneline -3`, `git remote -v`. O último commit deve ser sobre
     "a Lovable fica — reenquadra ONBOARDING e CLAUDE.md".
   - Compare com o GitHub (`git fetch && git status`) e me diga se a cópia
     está igual, atrás ou à frente do remoto.
   - Procure arquivos truncados/vazios que denunciem cópia incompleta do
     iCloud: qualquer arquivo `.icloud`, e arquivos-chave com 0 byte
     (src/, docs/, supabase/migrations/, public/templates/).
   - Confirme que existem: `.env` na raiz do repo (é versionado DE
     PROPÓSITO, não "arrume" isso), `public/templates/proposta_comercial.docx`
     e as ~90 migrations em `supabase/migrations/`.

2) LIMPEZA DO QUE NÃO ATRAVESSA MÁQUINA
   - Apague `node_modules`, `.output`, `dist`, `.tanstack`, `.wrangler` do
     prever-proposta (binários compilados para o SO antigo; serão refeitos).
   - Apague os `.DS_Store` que vieram do Mac.

3) AMBIENTE
   - Verifique a versão do Node (preciso de 20+; a máquina antiga rodava
     v24). Se não tiver, me diga como instalar neste SO.
   - `npm install`.

4) AS TRÊS SANIDADES (têm que passar antes de eu confiar na migração)
   - `node scripts/verificar-logica.cjs` → tem que terminar em "0 falharam"
     (são ~1355 asserções).
   - `npx vite build` → tem que completar.
   - `npx tsc --noEmit | grep -c "error TS"` → tem que dar ~85. NÃO é zero:
     85 é o baseline conhecido (types.ts do Supabase desatualizado). Se der
     muito diferente disso, me avise.
   Se alguma falhar, PARE e me mostre a saída — não tente consertar sozinho.

5) ORGANIZAÇÃO DAS PASTAS
   O aninhamento app-prever/prever-importacao/prever-proposta é fóssil de
   quando isto era só um automador de propostas (hoje é o sistema de gestão
   completo, que substitui o Notion e o Sigma OS). Quero achatar para algo
   como ~/prever/sistema (o ONBOARDING.md do repo, seção 2, tem o plano).
   - Me proponha a estrutura final antes de mover qualquer coisa.
   - IMPORTANTE: fora de qualquer pasta sincronizada por nuvem (iCloud,
     OneDrive, Google Drive) — foi isso que deixou o `tsc` inutilizável na
     máquina antiga.
   - Depois de mover, me diga para reabrir você no caminho novo.

6) O gestor-os — ATENÇÃO
   É o sistema ANTECESSOR (Next.js + Prisma) de onde veio a lógica de
   cobrança que hoje vive no prever-proposta. Ele **não tem git nenhum** —
   existia só na máquina antiga, então esta cópia é a única que resta.
   - Confirme que a cópia veio íntegra (src/, prisma/schema.prisma,
     scripts/, package.json).
   - O `.env` dele tem SEGREDOS REAIS (ANTHROPIC_API_KEY, DATABASE_URL,
     AUTH_SECRET, chave VAPID privada, CRON_SECRET). Não exponha esses
     valores no chat nem em nenhum arquivo.
   - Me recomende como versioná-lo (repositório PRIVADO, com o .env fora do
     versionamento) — não crie nada ainda, só me diga o caminho.

Não altere código do sistema nesta sessão. É migração e conferência.
Ao final, me dê um resumo do estado e do que ficou pendente.
```

---

## Depois que ele terminar

- **Confirme o dono do projeto Supabase** (2 min, e vale mesmo sem cancelar
  nada): entre em supabase.com com a conta da empresa e veja se o projeto
  `lrepuyaootngrbotmvhn` aparece na sua organização. Responde se os dados da
  empresa dependem de uma assinatura de terceiro.
- **A Lovable continua ativa** — deploy segue automático no push para `main`.
  Nada a fazer.
- **Migration pendente**: `20260824110000_u69_limpeza_dados_operacionais.sql`
  (zerar os dados operacionais), quando você quiser começar a lançar do zero.
