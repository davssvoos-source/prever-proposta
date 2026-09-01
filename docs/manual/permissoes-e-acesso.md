# Permissões e acesso — cargos, matriz e RLS

> Manual Prever Proposta — segmento: permissões e acesso. Gerado em 2026-08-21
> a partir de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md;
> se este documento discordar deles, eles ganham.

## Para que serve este documento

O acesso tem **três camadas** que não se substituem. Este documento diz o que
cada uma decide, onde mora e como adicionar uma tela nova sem abrir buraco.

## Camada 1 — cargo (quem a pessoa é)

Fonte **dual**: `user_roles` (linha de role) OU `profiles.cargo`. As funções
SQL `e_admin()` e `pode_gerir_clientes()` leem as duas — **sempre as duas**.
Cicatriz: `has_role()` lia só `user_roles` e teria trancado para fora o
comercial cadastrado via `cargo` (pego na revisão da S1). No app, o padrão é
o mesmo (ver a consulta `is-admin` em `gerencial.tsx`).

Cargos: `admin`, `comercial`, `sac`, `tecnico` (ver `visao-geral.md`).

## Camada 2 — matriz de telas (que portas o cargo abre)

- **Catálogo** `src/lib/telas.ts`: toda tela com permissão tem uma chave
  (`gerencial`, `chamados.painel`…), um padrão por cargo e opções (`sempre`
  para as obrigatórias).
- **Banco** `permissoes_tela` (tela, cargo, permitido): o que o admin
  configura na tela de Permissões. **Linha ausente = vale o padrão do
  catálogo** — a matriz não tranca por omissão.
- **Admin NUNCA entra na matriz** — regra de sistema, passa por fora.
- Telas obrigatórias (`dashboard`, `perfil`) não são bloqueáveis nem de
  propósito (perfil é por onde se sai do app).
- Chave de tela é **gravada no banco**: renomear uma chave invalida as linhas
  configuradas em silêncio. Não renomeie (há asserção sobre `gerencial`).

**Paridade catálogo ↔ semente.** O verificador reconstrói a "semente efetiva"
aplicando as migrations em ordem (U11 → U24 → U27 → U28 → U30, **inclusive os
DELETEs** da U30) e exige que catálogo e semente falem das mesmas telas com os
mesmos padrões. Tela nova sem semente, ou semente sem catálogo, falha o
verificador — de propósito: senão o app se comporta de um jeito antes da
migration e de outro depois.

**Aplicação no app:** `guardaDeTela(chave)` no `beforeLoad` da rota (e
`destinoNegado()` manda para a Início). O menu (`nav-itens.ts`) e os atalhos
de painel filtram por `podeVer()` — **menu esconder não é proteção**; a
guarda de rota é obrigatória (cicatriz: `chamados.painel` ficou sem guarda
até a U30).

## Camada 3 — RLS (que linhas a pessoa vê)

Postgres Row-Level Security, por tabela. A permissão de tela não substitui a
de dado: o calendário abre para o técnico, mas o RLS só devolve o que é dele.

Pontos que valem regra:

- **Blindagem S1** (`20260820170000_s1_blindagem_rls.sql`): clientes,
  inventário (cadeia de 3 níveis), storage, `funil_comercial` só gestor.
- **Natureza comercial à parte** (U29): chamado de proposta NÃO herda
  "sem responsável é de todos" — a capa não pode ser mais frouxa que o corpo.
- **Papel `authenticated` é UM só** no Supabase: todo logado é o mesmo papel
  de banco. Por isso `REVOKE` de coluna é ferramenta errada (atinge admin
  junto E quebra `select *` — cicatriz S1b). Visibilidade fina = policy ou
  view, nunca REVOKE.
- **Duas réguas, e elas NÃO são sinônimos** (U6a): `is_gestor()` =
  admin+comercial+**sac** decide **operação**; `pode_ver_financeiro()` =
  admin+comercial decide **dinheiro** (R13: o SAC não vê valores). Escolher a
  errada é o erro mais comum desta base, e ele é silencioso: `is_gestor` numa
  policy de valor abre para o SAC sem que nada reclame. No app o par é
  `useIsGerente` × `useVeFinanceiro` (`features/gerencial/data.ts`), espelhos
  fiéis das duas.
- **`is_gestor()` já mudou de significado uma vez** — a U6a acrescentou o SAC
  três dias depois de a etapa0/etapa1 a usarem "pensando em admin+comercial", e
  as policies daquelas migrations herdaram o papel novo por efeito colateral. A
  S1 §7 consertou `clientes`; a S4 encontrou a mesma deriva viva nas visitas
  (P23). **Policy de valor não delega para uma função cujo nome fala de
  hierarquia** — usa `pode_ver_financeiro`, ou uma função com o papel no nome.
- **Gate de papel de `SECURITY DEFINER` mora no CORPO, e o catálogo não o
  enxerga.** Numa DEFINER o `GRANT` tem de ser `authenticated` (senão ninguém
  chama), então `has_function_privilege` dá "ok" mesmo com a checagem apagada.
  Foi assim que a U80 perdeu o gate de `aprovar_chamado_financeiro` com a
  conferência verde (S4). Conferência de DEFINER = catálogo para o ACL **mais**
  uma leitura ORDENADA de `prosrc` para o gate: ele tem de vir ANTES da leitura
  que protege, e ser a primeira instrução executável.
- **Policy de SELECT FILTRA LINHAS; ela NÃO levanta erro.** Fechar demais
  devolve `[]` — indistinguível de "não há nada" — e a tela desenha o estado
  vazio para uma conversa cheia. Por isso toda proposta de aperto responde
  "quem usa isto hoje, e para quê" **por varredura do `src/`** antes de virar
  migration. Quando o número em si é fato operacional e o valor é privilégio, o
  padrão é uma DEFINER que devolve **um bit** (`chamados_com_lancamento`, R103).
- **Duas policies permissivas somam com OR.** Uma nova, restritiva, não fecha
  nada se a antiga aberta continuar de pé — e `DROP POLICY IF EXISTS` de um nome
  que não existe não avisa (cicatriz S1 §2.3 / P24). O verificador mantém um
  **censo das policies `USING (true)` vivas** contra a lista das que são
  deliberadas: uma policy nova e frouxa fica vermelha sozinha.

## Procedimento: adicionar uma tela nova com permissão

1. **Catálogo**: entrada `T("chave", "Nome", "/rota", "Grupo", [tec, com, sac], {...})`
   em `src/lib/telas.ts`.
2. **Semente**: migration nova inserindo as 3 linhas com os MESMOS valores
   (`ON CONFLICT DO NOTHING` se não quiser sobrescrever escolha do admin;
   `DO UPDATE` só quando a mudança é decisão de produto — padrão U28/U30).
3. **Guarda**: `beforeLoad` com `guardaDeTela("chave")` + redirect.
4. **Menu**: item em `nav-itens.ts` com `tela: "chave"` (se entra no menu).
5. **Asserção**: o verificador já cobre paridade; adicione asserções do
   comportamento específico se a tela tiver regra própria.
6. Rodar `node scripts/verificar-logica.cjs` — a paridade acusa esquecimento.

**Remover uma tela** é o espelho: tirar do catálogo + migration com DELETE
das linhas + a semente efetiva absorve o DELETE (modelo: U30).

## Anti-práticas

- Guardar rota só escondendo do menu.
- `REVOKE` de coluna para esconder valor de um cargo.
- Checar admin/gestão por UMA fonte só (roles OU cargo).
- Renomear chave de tela.
- Dar à capa (chamado) leitura mais larga que a do corpo (satélite).
- Usar `is_gestor()` numa policy que protege dinheiro (ela inclui o SAC).
- Escrever valor em reais em texto livre que outra régua vai ler — a linha do
  tempo não é o livro-caixa; o evento diz QUE a etapa aconteceu, e o valor mora
  na tabela que tem a régua certa.
- Provar gate de papel de `SECURITY DEFINER` só pelo ACL do catálogo.
- Confiar que um `DROP POLICY IF EXISTS` fechou algo sem conferir o nome vivo.
- Fechar uma policy sem antes varrer quem lê aquela tabela hoje.

## Referências

- `src/lib/telas.ts` · `src/features/gerencial/permissoes.ts`
- Migrations U11, U6a, S1/S1b, S2, S3, S4, U28, U30 · `scripts/verificar-logica.cjs`
  (seção da semente; e o bloco S4 no fim, com os três censos)
- `docs/PRODUTO.md` — R13, R18, R103 · `docs/PENDENCIAS_TECNICAS.md` — P22, P23, P24
