# Comercial — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- Painel Comercial em `src/routes/_authenticated/gerencial.tsx`: lista × quadro por etapa
  (`src/features/comercial/QuadroComercial.tsx`), filtro por tipo de serviço, dashboard
  (`DashboardComercial.tsx`) com métricas puras em `src/features/comercial/metricas.ts` (média de 12 meses).
- Visita e orçamento: `visita.$id.tsx` e `visita.$id.orcamento.*.tsx` (categorias, blocos por categoria,
  complementos, pré-envio), pagamento em `visita.$id.pagamento.tsx`; lógica em `src/features/orcamento/`
  e `src/features/visitas/`; mensalidades em `src/features/comercial/mensalidadesProjeto.ts`.
- Geração da proposta (.docx/PDF) em `src/features/proposta/gerarProposta.ts`; projeto em
  `src/features/projeto/` e `projeto.$id.tsx` (tela legada, Q13).
- Nova Visita Técnica numa tela só (R194) em `gerencial.nova.tsx`; prospecção como aba (R38).

- Ticket médio (R306, U158): `visitas_tecnicas.valor_anual_recorrente` e `valor_implantacao` gravados
  pela tela de pagamento ao gerar a proposta (`src/features/comercial/ticket.ts`, função pura);
  quinto KPI do dashboard em duas colunas (`CincoKpis`), média só das enviadas com valor.

## Padrões a reusar

- `proposta_enviada_em` vence `status`: toda etapa do funil é derivada por função pura.
- Métricas com relógio injetado (`agora`): o fixture do verificador usa data fixa.
- Nenhum valor aparece para quem não passa em `pode_ver_financeiro()` (módulo `acessos`).

## Configuração

- Template da proposta viaja no repositório; a geração roda no navegador.

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 19 · com asserção nominal no verificador: 18 · sem menção nominal: 1.

| Regra | Verificado por |
|---|---|
| produto:R4 | — sem menção nominal; cobertura indireta (tsc, build, asserções da tela) |
| produto:R23 | 4 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R29 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R32 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R38 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R64 | 15 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R78 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R147 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R164 | 11 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R170 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R194 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R214 | 8 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R241 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R252 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R259 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R260 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R279 | 2 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R302 | 21 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R306 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Rodar a migration U158 (as duas colunas do ticket) — até lá a tela grava e o banco recusa (só o console avisa).
- Histórico de propostas passado (M4): entra por migration quando o Davi mandar os dados.
- Telas legadas `/projeto/$id`, `/visita/$id/pendente`, `/gerencial/visita/$id/editar` (D7 / Q13).
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
