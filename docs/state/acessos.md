# Acessos — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Catálogo de telas em `src/lib/telas.ts` (`PAPEIS`, `T()` com cinco colunas, chave ESTÁVEL por tela) e a
  semente `permissoes_tela` nas migrations; matriz editável em `src/features/gerencial/permissoes.ts`.
- Funções do banco: `is_gestor()` (admin/comercial/sac/gestor), `pode_ver_financeiro()`
  (admin/comercial/gestor), `eh_tecnico()`, `eh_operacional()`, `pode_ver_cliente()` (escrita),
  `pode_ler_cliente()` (leitura) — U154 e U155.
- Administrativo em `painel.administrativo.tsx` (`Usuarios.tsx`, `Permissoes.tsx`, Viaturas, APIs);
  convites com reenvio (`convites.functions.ts`); `useUserCargo` mapeia gestor para a interface de admin.
- Navegação por cargo em `src/components/nav-itens.ts`; guarda por tela `guardaDeTela(chave)`.

- Convite aceito ao reenviar (R310, U160): `reenviarConvite` grava `status = aceito` quando o GoTrue
  diz que a pessoa já existe; a tela avisa e a lista de pendentes se limpa.
- Avisos automáticos só para o admin (R312, U159): `notify_chamado`, `alertas_chamados` e
  `alertas_chamado_faturamento` listam `cargo = admin`; responsável e quem abriu continuam avisados.
- Leitura de clientes para todos (R319, U160): `pode_ler_cliente` vale para qualquer autenticado;
  a escrita continua em `pode_ver_cliente`.

## Padrões a reusar

- Tela removida = rota vira redirect + `DELETE FROM permissoes_tela` na migration (chave nunca se renomeia).
- Cargo novo entra em: enum + CHECKs + `PAPEIS` + coluna do `T()` + semente + `is_gestor()`/derivadas + manual.
- Leitura e escrita separadas em funções distintas (`pode_ler_cliente` × `pode_ver_cliente`).

## Configuração

- `SITE_URL` no serviço do servidor decide para onde o convite leva (G3 em `../DECISOES_PENDENTES.md`).

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 25 · com asserção nominal no verificador: 23 · sem menção nominal: 2.

| Regra | Verificado por |
|---|---|
| produto:R1 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R2 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R3 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R6 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R13 | 17 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R15 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R18 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R59 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R81 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R129 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R131 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R158 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R193 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R204 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R221 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R244 | 18 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R264 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R277 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R294 | 22 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R298 | 25 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R304 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R305 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R310 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R312 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R319 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Rodar as migrations U159 (avisos só para o admin) e U160 (todos leem todos os clientes) — G5 em
  `../DECISOES_PENDENTES.md`. Até a U160, quem não é gestor nem operacional vê a lista podada.
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
