# Financeiro — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Contratos em `contratos.tsx`, `contratos.$id.tsx`, `contratos.novo.tsx` e na ficha do cliente (R132);
  arquivos no bucket `contratos`.
- Cobrança do chamado e conferência: fila "Aguardando conferência" na Operacional Técnica; fechamentos em
  `fechamentos.tsx` e `fechamentos.$id.tsx` (montar fechamento, R119).
- Lógica em `src/features/financeiro/` e `src/features/contratos/`.

## Padrões a reusar

- Valor só aparece atrás de `pode_ver_financeiro()`; a tela não decide cargo.
- Conta de cobrança sobre valor de tipo conhecido (a lição da U138): nada de `any` em dinheiro.

## Configuração

- Sem variável própria.

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 10 · com asserção nominal no verificador: 10 · sem menção nominal: 0.

| Regra | Verificado por |
|---|---|
| produto:R103 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R104 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R118 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R119 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R121 | 21 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R132 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R157 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R161 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R290 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R291 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Texto padrão da cobrança e tipo de serviço padrão (D5 / Q8 em `../DECISOES_PENDENTES.md`) — com o Vinicius.
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
