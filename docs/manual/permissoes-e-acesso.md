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


## Sobreaviso (chave `sobreaviso`, U86)

**Ver é de todo mundo que trabalha aqui; editar é de gestor.** A chave
`sobreaviso` nasce liberada para os três papéis da matriz (técnico, comercial,
SAC), e a *policy* de leitura exige que quem pergunta tenha em `profiles` uma
linha **ativa** e **não pendente de aprovação**. A leitura é ampla de propósito:
a escala é **cobertura, não dinheiro** — a valoração das horas continua atrás de
`pode_ver_financeiro()`, em outra tabela —, e se o técnico não vê as horas dos
colegas a faixa de cobertura do mês mente para ele, mostrando buraco onde o
colega já cobre.

**Mas ampla não é `USING (true)`.** Os dois grupos que a *policy* recusa são
exatamente os dois que a tela já recusava e a fronteira não recusava: o
**convite pendente**, que tem login e ainda não é ninguém aqui, e o
**ex-funcionário**, cujo acesso nada no sistema revoga hoje. A folha de plantão
diz **quem estava trabalhando às duas da manhã, todo dia**; isso é informação de
pessoal, e é a *policy* que a guarda, porque todo usuário fala com o Postgres
com a mesma chave publicável.

**Escrever é `is_gestor()` E o mesmo vínculo, e `is_gestor()` INCLUI o SAC.** Não
foi criado um predicado novo: seria uma quarta lista de papéis a ter de
concordar com as três que já existem. O sobreaviso existe *para* o SAC — uma
escala que ele não pode corrigir fica velha exatamente quando importa, às 2h da
manhã. A defesa é o carimbo `alterada_por`/`alterada_em` em cada célula, mais a
grade ser visível para todos. As duas RPCs (`sobreaviso_aplicar_padrao` e
`sobreaviso_limpar`) são `SECURITY DEFINER` e **não passam pela policy**: o
mesmo teste de dois eixos está escrito dentro delas.

> **Dívida conhecida, e ela não é desta tela:** `is_gestor()` decide por cargo e
> por papel e **não olha `ativo`**. Um ex-funcionário com login vivo continua
> sendo gestor para o sistema inteiro — é o `AND EXISTS (… p.ativo …)` desta
> policy que o barra *aqui*, e só aqui. Está registrado como **P51**.

**Lembre da fronteira real:** `permissoes_tela` esconde o **item de menu**.
Quem impede escrita é a *policy*, e só ela — todo usuário fala com o Postgres
usando a mesma chave publicável. Se o Davi decidir que o SAC não edita a escala,
o lugar da mudança é o par de listas de papéis que já existe, não um predicado
novo e não a matriz de telas.


## Atendimento de plantão (SEM chave de tela, U87)

**Esta é a primeira superfície do sistema que não tem chave em
`permissoes_tela`, e a ausência é decisão.** O catálogo `src/lib/telas.ts` é o
mapa de **rotas** — "uma tela existe quando existe rota" —, e o registro do
atendimento de plantão **não tem rota**: ele é a terceira opção do botão "+" da
Início (R91), que já existe no celular. Uma chave sem rota seria órfã nos dois
sentidos da asserção que compara catálogo e semente, e por isso a migration da
U87 **não** entra em `ARQUIVOS_SEMENTE` no verificador. A decisão é **medida** —
conferência 217 da migration conta `0` chaves `plantao` no banco, e há asserção
no verificador contando `0` INSERTs em `permissoes_tela` no arquivo.

**Quem escreve: qualquer pessoa da casa, PARA SI.** O gate das duas portas
(`plantao_salvar`, `plantao_apagar`) tem duas metades:

- **vínculo** — linha `ativo` e `status <> 'pendente_aprovacao'` em `profiles`,
  escrita **ao lado** de `is_gestor()` e não dentro dela, porque `is_gestor()`
  **não olha `ativo`** (P51);
- **procuração** — `_plantonista = auth.uid()` **OU** `is_gestor(auth.uid())`.

Um gate de gestor impediria a **única pessoa que estava lá** de registrar: às 2h
da manhã quem atendeu foi o plantonista, e o SAC — que é gestor — estava
dormindo. Um gate aberto deixaria qualquer um lançar atendimento **em nome de
outro**, num registro que é de pessoal. A procuração é o meio-termo, e ela é a
única razão de `is_gestor` aparecer aqui.

**Quem lê: o dono da linha, e quem responde pela operação.** A policy é
`vínculo AND (plantonista_id = auth.uid() OR is_gestor(auth.uid()))`.

> **A régua que foi RECUSADA, e o motivo importa para a próxima tabela com
> `chamado_id`:** a escolha "óbvia" seria `USING (pode_acessar_chamado(chamado_id))`.
> Aquela função tem o ramo `c.responsavel_id IS NULL` **sem filtro de status**
> (`s2:152-155`) — chamado sem dono é de quem pegar, e isso é decisão de produto
> correta *para chamados*. Aplicada aqui, um plantão pendurado num chamado da
> fila aberta ficaria legível por **qualquer autenticado ativo**. É a mesma
> recusa que a U80 §3 já tinha feito, pelo mesmo motivo.

**A tabela é só-leitura no navegador, por privilégio.** `REVOKE ALL … FROM
PUBLIC, anon, authenticated` vem **antes** do `GRANT SELECT` — o desenho de
`agenda_campo` (u78), com o argumento dele: *"não escrevi um GRANT" não é o mesmo
que "não há GRANT"*, porque o bootstrap de um projeto Supabase pode conceder tudo
a `authenticated` por `ALTER DEFAULT PRIVILEGES`. A conferência 208 mede o
privilégio **efetivo**: `insert=false | update=false | delete=false | select=true`.

**Nenhum valor em reais passa por aqui.** A tabela não tem coluna de dinheiro —
medido pelo catálogo, por tipo (`numeric`/`money`) **e** por nome, na conferência
202 —, a migration não toca `cobrancas`, não reescreve `chamados_com_lancamento`
e não cria selo nenhum. O selo do plantão é mudo porque **não existe**. A R13
(o SAC não vê valores) não é atravessada aqui por não haver valor a ver.

## Onde se edita (R131, U94)

Usuários (convite, aprovação, cargo, equipe, desativar) e a matriz de acessos
por papel são **abas do painel Administrativo** (`/painel/administrativo?aba=usuarios`
e `?aba=permissoes`); as rotas antigas `/gerencial/usuarios` e
`/gerencial/permissoes` só redirecionam, e as duas chaves saíram da matriz
(migration U94). Quem edita continua sendo o **cargo admin** — regra de cargo,
não linha da matriz. A terceira aba, **APIs**, lista as integrações com
terceiros e se a chave de cada uma está no servidor (nunca o valor).

Chave que existe na matriz mas que nenhuma rota lê é **decorativa**: a revisão
de 03/09/2026 achou três (`historico`, `mapa`, `calendario`) e as ligou; a asserção da U94
passou a exigir que toda chave com rota própria tenha guarda — as exceções
conhecidas (`dashboard` e `perfil` são "sempre"; `chamados.novo` é a Q11;
`admin` é a Q15) estão listadas no próprio verificador.
