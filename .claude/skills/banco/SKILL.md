---
name: banco
description: Banco de dados e migrations do app Prever (Supabase/Postgres). Use SEMPRE que a tarefa tocar em schema, coluna, CHECK, tabela, RLS/policy, função SQL, gatilho, cron, bucket de storage, semente de permissões (permissoes_tela), ou quando uma tela nova precisar de um valor que o banco ainda não aceita. Escreve a migration no padrão da casa (idempotente, pré-voo, conferência obtido × esperado × veredito, DESFAZER), aplica a regra 5 da ordem de deploy (listas NAO_OFERECIDOS até o Davi rodar) e prepara o aviso ao Davi — que é quem roda tudo, à mão, no SQL Editor.
---

# Banco — migrations que o Davi roda à mão

O detalhe que governa tudo aqui: **nada se aplica sozinho**. O repo nunca
roda migration; o Davi copia o arquivo no SQL Editor do Supabase e executa.
Entre o `git push` (que publica o app na hora, pela Lovable) e esse clique
pode passar uma hora ou uma semana — e o app precisa funcionar nas duas
pontas. Toda decisão desta skill nasce desse fato.

Fonte de verdade: as migrations em `supabase/migrations/` (o histórico do
schema) e `docs/manual/banco-e-migrations.md` (procedimento, convenções,
cicatrizes). Esta skill é o método por cima deles.

---

## 1. O procedimento inegociável

1. **Arquivo novo, timestamp maior**: `supabase/migrations/AAAAMMDDhhmmss_uNNN_assunto.sql`.
   O `uNNN` é o número da entrega no diário. O timestamp só ordena.
2. **Idempotente.** Rodar duas vezes dá no mesmo: `IF NOT EXISTS`,
   `DROP … IF EXISTS` antes de criar, `ON CONFLICT`, `DO $$ … EXCEPTION WHEN
   duplicate_object` para constraint.
3. **Pré-voo quando depende de outra.** Um `DO $$ … RAISE EXCEPTION` que
   aborta se a migration anterior não rodou (a U99 exigia a U96 porque a U96
   ainda tocava objetos que a U99 apagava). Na ordem errada, aborta com frase
   em português — não corrompe.
4. **Conferência no fim**, no padrão da casa: `WITH conferencia AS (SELECT n,
   o_que, obtido, esperado …) SELECT …, CASE WHEN obtido = esperado THEN 'ok'
   ELSE '>>> OLHAR <<<' END AS veredito`. Uma linha por efeito. `RAISE
   NOTICE` **não serve**: é invisível no editor do Supabase.
5. **DESFAZER no rodapé**, comentado, honesto sobre o que é irreversível
   ("NÃO há desfazer para os dados; a estrutura se recria pela U9").
6. **Nunca edite migration que o Davi já rodou.** Editar não muda o banco e
   esconde a mudança. Mudança nova = arquivo novo.
7. **Migration que abortou e não aplicou nada corrige-se NO LUGAR** — o
   editor roda o script inteiro numa transação; se abortou, nada entrou. Mandar
   outra para consertar o que a primeira nem criou é pior para quem lê depois.
8. **Aviso ao Davi**, no resumo da entrega: o nome do arquivo, a ordem (depois
   de qual), quantas linhas de conferência esperar e o que fazer se alguma
   vier `>>> OLHAR <<<`.

O modelo completo, para copiar: `references/modelo-de-migration.sql`.

## 2. A regra 5 — a ordem de deploy

O push publica o código antes de a migration rodar. Logo:

- **Coluna nova que a tela LÊ**: a leitura não pode quebrar antes da
  migration. Hoje isso já não é problema para as colunas existentes (a U96
  rodou); para a próxima, a leitura entra **junto com a migration**, e o Davi
  roda antes de usar — ou você usa a ponte que a U96 usou (`comFallbackDaU96`,
  documentada no diário U96) só enquanto durar a janela.
- **Valor novo que um CHECK ainda recusa** (tipo, código, grupo): o app
  **RENDERIZA** o valor (rótulo, cor) desde o push, mas **NÃO OFERECE** para
  gravar até o Davi rodar. O mecanismo são as listas `NAO_OFERECIDOS`
  (`chamado-status.ts`), `TIPOS_SISTEMA_NAO_OFERECIDOS` (`inventario.ts`),
  `SERVICOS_NAO_OFERECIDOS` (`clientes/data.ts`). Os seletores leem a lista
  OFERECIDA. Quando o Davi confirmar que rodou: esvaziar a lista, um commit,
  uma linha — e o `ESTADO_ATUAL.md` §4 registra o que está segurado.
- **Coluna que a tela ESCREVE**: idem — a escrita nasce desligada ou
  guardada até a migration.

Oferecer antes do CHECK aceitar é um `23514` na cara do técnico.

## 3. O que cada tipo de mudança exige

| Mudança | Além do procedimento |
|---|---|
| **Tabela nova** | RLS ON desde o nascimento + policies por operação pensadas por cargo (capa nunca mais frouxa que corpo); `updated_at`; se tem tela, semente de `permissoes_tela` na MESMA migration; asserção se carrega regra de produto |
| **Coluna nova** | `ADD COLUMN IF NOT EXISTS`; `COMMENT ON COLUMN` dizendo a regra (R) e o que ela NÃO é (a `data_agendada` diz que não é `data_hora_agendada`); tipo TS (`Chamado`, `ChamadoPatch`) e lista de colunas do SELECT (`CAMPOS_CHAMADO`, `CAMPOS_DA_HOME`) |
| **CHECK que ganha valor** | `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` com a lista completa; se DOIS CHECKs guardam a mesma lista (serviço do cliente × etiqueta de grupo), os dois mudam **na mesma migration**; a lista do CHECK é a mesma do código, e uma asserção compara as duas |
| **Tela que sai ou entra** | `DELETE FROM public.permissoes_tela WHERE tela IN (…)` (ou o INSERT da semente) **e** o arquivo entra em `ARQUIVOS_SEMENTE` do verificador — senão a asserção "catálogo e semente têm as mesmas telas" acusa |
| **Apagar tabela/função** | `DROP … IF EXISTS`; procurar quem a cita (`grep -rn nome supabase/migrations src`); se alguma função viva lê a tabela, ela quebra em runtime (Postgres não valida corpo no DROP); oferecer `CREATE TABLE arquivo_x AS SELECT * FROM x` comentado antes, se os dados importam |
| **Gatilho / função que escreve na linha do tempo** | o verificador tem um CENSO das funções vivas que inserem em `chamado_eventos` — apagar ou criar uma exige mexer na lista escrita à mão, com o motivo |
| **Dados históricos com gatilho no caminho** | `ALTER TABLE … DISABLE TRIGGER USER` antes, `ENABLE` depois; desligar notificações em carga (senão são centenas de sinos) |
| **Rename de tabela** | leva os gatilhos, **não reescreve o corpo** deles nem renomeia constraints — procurar o nome antigo em todo corpo de função |

## 4. As cicatrizes (leia antes de escrever SQL que faz efeito colateral)

Estão completas em `docs/manual/banco-e-migrations.md` §Cicatrizes. As que
mais mordem:

- `REVOKE` de coluna atinge o admin junto e quebra `select *` — visibilidade
  fina é policy ou view.
- `AFTER UPDATE OF <coluna>` dispara pela **presença** da coluna no `SET`,
  mesmo sem mudar o valor — escreva só as colunas que mudam.
- Gatilho `BEFORE` em X que escreve em Y cuja cascata volta para X é `09000`
  intermitente; em `AFTER` a cascata morre no gate em silêncio. Se o gatilho
  precisa que a cascata rode, não pode ser gatilho.
- `UPDATE` em conjunto × laço quando há gatilho `AFTER` de linha: o espelho
  salta da primeira à última linha. Quando o efeito por linha importa, o laço
  é a semântica.
- `now()` não avança dentro da transação; `clock_timestamp()` quando N linhas
  precisam de instantes diferentes.
- `string_agg(text[], …)` não existe — a U96 abortou por isso na primeira
  rodada; agregue o elemento (`m.grupo[1]`), não o array.
- **`ON CONFLICT` não infere índice PARCIAL** sem o predicado repetido na
  cláusula: com `CREATE UNIQUE INDEX … (col) WHERE col IS NOT NULL`, o
  `ON CONFLICT (col) DO NOTHING` responde **42P10** ("no unique or exclusion
  constraint matching the ON CONFLICT specification") e a carga inteira
  aborta. Escreva `ON CONFLICT (col) WHERE col IS NOT NULL DO NOTHING`. A
  U110 morreu nisso na primeira rodada, com 4.241 linhas na mesa; o par de
  asserções que trava os dois lados (índice e cláusula) está no bloco da U110
  do verificador.
- PGRST201 depois de junção N:N: embed ambíguo — dica `tabela!coluna`.

## 5. O que o verificador cobra (e você escreve junto)

Para cada migration nova, no bloco da entrega:

- idempotência (todo `CREATE`/`ALTER … ADD`/`DROP` com `IF (NOT) EXISTS`,
  fora o CHECK recriado);
- o pré-voo, quando há dependência;
- a conferência com N linhas e o `'>>> OLHAR <<<'`;
- o `DESFAZER` no rodapé;
- que a lista do CHECK é a MESMA do código;
- que **toda tabela citada** (`public.<x>`) nasceu em alguma migration
  anterior — foi um `public.contratos` fantasma que abortou a U69;
- se mexeu em `permissoes_tela`, que o arquivo está em `ARQUIVOS_SEMENTE`.

E o que o `carregar()` pode testar de verdade (função pura que espelha um
gatilho — `colunaDaVisita()` ↔ `trg_sincronizar_chamado_da_visita`): quando os
dois lados traduzem o mesmo estado, os dois têm asserção e mudam juntos.

## 6. Depois que o Davi rodou

Ele diz "rodei". Então:

1. Esvazie a lista `NAO_OFERECIDOS` que segurava o valor (um commit).
2. Feche a P-série que dependia da migration.
3. `ESTADO_ATUAL.md` §4: "rodadas até a Uxxx; nenhuma pendente".
4. Se ele reportou uma linha `>>> OLHAR <<<`: leia o `obtido`, entenda antes
   de propor — e se a migration abortou inteira, corrija **no lugar** (§1.7).

## 7. Como avisar o Davi (o texto)

> **Migration Uxxx** — `supabase/migrations/<arquivo>.sql`. Rodar **depois
> da Uyyy** (ou: independe das anteriores). Espera **N linhas "ok"**. Se
> alguma vier `>>> OLHAR <<<`, me mande o `obtido`. Até rodar, o app mostra
> [o valor novo] mas não deixa gravá-lo.

Curto, com o nome do arquivo copiável. Ele roda entre duas reuniões.

---

### Arquivos de referência

| Arquivo | Quando ler |
|---|---|
| `references/modelo-de-migration.sql` | **ao começar qualquer migration** — copie e preencha |
| `docs/manual/banco-e-migrations.md` | convenções da casa e as cicatrizes completas |
| `supabase/migrations/20260915090000_u99_respostas_do_davi.sql` | exemplo real recente com pré-voo, DELETE na semente, DROP, CHECK, coluna e conferência |
| `supabase/migrations/20260819180000_u11_permissoes_tela.sql` | a semente de permissões (modelo de INSERT … ON CONFLICT) |
