# Interface — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Tokens e temas em `src/styles.css` (`:root` + `[data-theme="light"]`), paleta e misturas em
  `src/lib/paleta.ts` (escala CINZA neutra, PRIMARIA dourada por tema), superfícies em `src/lib/ui.ts`
  (`card`, `vidro`, `pilulaDaBarra`, `botaoDaBarra`).
- Réguas: margem `--gutter` 16/24 e `--barra`; escala 8/12/16/24; z-index até o modal em 70; barra 40/42.
- Tema claro: página `#e9e9e9`, card `#ffffff`, texto `#212121`, glow fraco (R154, R186).
- Verificador prende: pesos, par de token, hex fora da paleta, `padding` inline, outline dourado fixo.

## Padrões a reusar

- Constante de estilo em módulo não vê tema: vire função `(isLight)`.
- Nunca `padding` atalho inline (anti-padrão nº 10); use `paddingInline/paddingBlock`.
- Componente novo só depois do inventário (`.claude/skills/designer/references/inventario.md`).

## Configuração

- Tema escolhido pelo usuário em `localStorage`; sem variável de ambiente.

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 15 · com asserção nominal no verificador: 13 · sem menção nominal: 2.

| Regra | Verificado por |
|---|---|
| produto:R28 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R39 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R45 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R79 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R87 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R136 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R154 | 18 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R174 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R176 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R177 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R186 | 22 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R195 | 12 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R239 | 30 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R275 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R303 | 1 menção nominal em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Aplicar a revisão de tipografia (66 desvios): caminho a escolher pelo Davi (D3 em `../DECISOES_PENDENTES.md`).
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
