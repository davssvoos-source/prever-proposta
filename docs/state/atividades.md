# Atividades — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Registro único `chamados` com natureza, tipo (vocabulário da R48/R137), locais N:N, equipes N:N,
  impacto operacional, prazo OU dia agendado (R232), retornos (`CAMPOS_CHAMADO` em
  `src/features/chamados/data.ts`).
- Tela da atividade em `src/routes/_authenticated/chamados.$id.tsx`: quatro faixas no desktop (R234),
  ficha sticky de propriedades, editor de uma área (R224), rosca de progresso por checklist (R235),
  equipamentos removidos/instalados por arrasto (R226, R236). O pop-up da Início mostra a MESMA tela (R238).
- Criação: `chamados.novo.tsx` (as duas perguntas, R138), `chamados.novo-interno.tsx`,
  `chamados.novo-campo.tsx`; abertura rápida por I.A. que atribui gente e equipe (R80, R82).
- Lógica pura em `src/features/atividades/modelo.ts` (tipos, impacto, datas) e
  `src/features/duplas/modelo.ts` (a dupla derivada do responsável).
- Chat de menções da Início: conversa 9:16, recado para todos, `#Código`, reações, resposta que volta
  pela ligação `responde_a` (R215–R217, R222, R223, R240, R245, R249, R258).

## Padrões a reusar

- Layout segue a NATUREZA (`DetalheInterno` × `DetalheCampo`), nunca o cargo de quem está na atividade.
- Tradução de dados em `data.ts`/`modelo.ts`; componente só pinta. Tudo salva sozinho (R90).
- Equipe da atividade = equipe das pessoas atribuídas (R139); apoio é GRAVADO na atribuição (U64).
- Novo tipo de atividade entra no vocabulário (R137) + matriz de campos + asserção — nunca só na tela.

## Configuração

- Sem variável própria. RLS de leitura: todos veem todas as atividades (R221); o cargo técnico é
  recortado no banco (R264, módulo `acessos`).

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 65 · com asserção nominal no verificador: 57 · sem menção nominal: 8.

| Regra | Verificado por |
|---|---|
| produto:R9 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R16 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R19 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R24 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R25 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R30 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R33 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R40 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R47 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R48 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R49 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R50 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R53 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R54 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R80 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R82 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R83 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R84 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R85 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R86 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R90 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R113 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R135 | 41 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R137 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R138 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R139 | 33 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R140 | 21 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R141 | 16 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R142 | 18 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R143 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R144 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R149 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R150 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R151 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R168 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R169 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R171 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R183 | 24 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R184 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R185 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R213 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R215 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R216 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R217 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R222 | 16 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R223 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R224 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R225 | 23 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R226 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R228 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R231 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R232 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R234 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R235 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R236 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R238 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R240 | 20 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R243 | 25 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R245 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R249 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R255 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R258 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R262 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R281 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R282 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
<!-- cobertura:fim -->

## Pendências

- Os fluxos por tipo de demanda (campos e caminho de corretiva, preventiva, implantação) — o Davi vai
  mandar (M1 em `../DECISOES_PENDENTES.md`); é o maior bloqueio.
- Tipo de atividade → impacto operacional preenchido pelo sistema (M2).
- Atividade com técnico de campo e operacional juntos: decisão D2 (proposta: duas atividades ligadas).
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
