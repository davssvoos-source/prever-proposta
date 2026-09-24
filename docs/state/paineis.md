# Painéis — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Início em `dashboard.tsx` com dados e lentes em `src/features/home/{data.ts,lentes.ts}`: quadro/lista,
  filtros, ordenação com direção (R88), busca pelo prédio (R250), filtro de tipo (R251), painel que recolhe (R175).
- Operacional Técnica em `painel.operacional.tsx`: kanban por dia como padrão, botão de ações do card
  (`src/features/paineis/AcoesDoCard.tsx`: re-agendar, desmarcar, cancelar), KPI vindo da URL (`?kpi=`).
- Gestão Técnica em `gestao-tecnica.tsx` (chave de tela `sobreaviso`, estável): `DashboardOperacional.tsx`,
  `FilaDeDecisao.tsx`, Fechamentos, Equipes, escala e plantão; `sobreaviso.tsx` e `chamados.painel.tsx` são
  redirects.
- Calendário em `calendario.tsx`: mensal e semanal, barra do sobreaviso, arrasto entre dias (R152), feriados (R115).
- Barra de ferramentas na régua: `pilulaDaBarra` 40/raio 11 e `botaoDaBarra` 42/raio 12 em `src/lib/ui.ts`.

- Limpar filtros (R321, U160): botão 42/12 ao lado do último filtro na Início (`limparFiltros`,
  `temFiltroAtivo` em `dashboard.tsx`) e na Operacional (limpa o recorte de KPI); o "Mostrando:" saiu.
- A faixa de validação saiu da Início (R320): a Fila de decisão da Gestão Técnica é quem conta.
- Operacional sem scroll horizontal (R322): `.kanban-op` reparte `--colunas` no desktop; a barra quebra.
- Meta do mês pelo PRAZO no mês (R323): `doMesFiltro` em `src/features/home/metricas.ts` — a base da rosca,
  do clique nela e dos tiles "Concluídas/Faltam no mês"; os baldes de sprint não decidem mais a meta.

## Padrões a reusar

- KPI e lista saem da mesma função (`chamadosDoKpi`, `filaDeRetornos`); nunca conte na tela.
- Coluna do quadro por estado (`CORES_COLUNA`), realce de "hoje" só por cor/contraste — sem outline fixo (R79).
- Preferência de visão gravada por chave `prever-*` no `localStorage`, lida por `lerPreferencia()`.
- Menu flutuante por portal: alvo `closest([role=dialog]) ?? body` (R243).

## Configuração

- Aviso das 08h (atividade agendada para hoje) é pg_cron no Supabase; listas de destinatários no banco (P73).

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 67 · com asserção nominal no verificador: 60 · sem menção nominal: 7.

| Regra | Verificado por |
|---|---|
| produto:R8 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R17 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R20 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R26 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R27 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R31 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R34 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R35 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R36 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R37 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R42 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R43 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R44 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R46 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R58 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R60 | 13 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R65 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R66 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R67 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R68 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R69 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R73 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R76 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R88 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R89 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R91 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R93 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R94 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R95 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R115 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R123 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R124 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R125 | 38 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R126 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R133 | 13 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R145 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R152 | 19 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R153 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R175 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R178 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R179 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R180 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R181 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R182 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R187 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R188 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R189 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R190 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R191 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R227 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R233 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R246 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R248 | 7 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R250 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R251 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R257 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R261 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R289 | 1 menção nominal em `scripts/verificar-logica.cjs` |
| produto:R295 | 13 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R296 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R299 | 38 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R300 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R301 | 25 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R320 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R321 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R322 | 6 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R323 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Orçamento de largura da Gestão Técnica a 1366px (P77) — medir com sessão aberta.
- Notificações ao cargo Gestor (D6 em `../DECISOES_PENDENTES.md`).
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
