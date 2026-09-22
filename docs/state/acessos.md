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

## Padrões a reusar

- Tela removida = rota vira redirect + `DELETE FROM permissoes_tela` na migration (chave nunca se renomeia).
- Cargo novo entra em: enum + CHECKs + `PAPEIS` + coluna do `T()` + semente + `is_gestor()`/derivadas + manual.
- Leitura e escrita separadas em funções distintas (`pode_ler_cliente` × `pode_ver_cliente`).

## Configuração

- `SITE_URL` no serviço do servidor decide para onde o convite leva (G3 em `../DECISOES_PENDENTES.md`).

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 22 · com asserção nominal no verificador: 20 · sem menção nominal: 2.

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
<!-- cobertura:fim -->

## Pendências

- Trocar o cargo do Vinicius para Gestor (G2) — e, no mesmo dia, as listas de aviso do banco (D6 / P73).
- Convites já aceitos continuam "pendentes" (D4 / P75).
- Migration U155 pendente (G1).
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
