# Financeiro — contratos, fechamentos e valores

> Manual Prever Proposta — segmento: financeiro. Gerado em 2026-08-21 a partir
> de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md; se este
> documento discordar deles, eles ganham.

## Para que serve este documento

O que existe de financeiro no app (portado do gestor-os na unificação), onde
mora e a regra de visibilidade de valores que atravessa tudo.

## O que existe (construído nas etapas U2/U5)

- **Contratos** (`/contratos`, `/contratos/novo`, `/contratos/$id`) —
  cobertura e preços por cliente. Lista com busca (usa
  `normalizarTexto`/`formatarDocumento` de `src/lib/normalizar.ts`); filhas
  entram pelo Outlet. Feature: `src/features/contratos/`.
- **Fechamentos** (`/fechamentos`, `/fechamentos/$id`) — a apuração do
  período: o que foi feito e o que será cobrado. Feature:
  `src/features/financeiro/`.
- **Faturamento no chamado** — campos `faturamento_status`, `tipo_servico`,
  `contrato_id`, `numero_externo` na tabela `chamados` (visíveis em
  `src/features/chamados/data.ts`, CAMPOS).
- **Funil comercial com valores** (`funil_comercial`) — desde a S1, leitura
  **exige gestor**.

Detalhes finos de apuração (o que entra num fechamento, estados do contrato)
estão no código das features e no diário U2/U5 — este documento não os
duplica. EM ABERTO: documentar o passo a passo de apuração quando o fluxo for
exercitado com dados reais de produção.

## A regra que atravessa tudo: R13 — o SAC não vê valores

- As telas com dinheiro (`contratos`, `fechamentos`) têm padrão
  `[false, true, false]` no catálogo — técnico e SAC fora; há asserção:
  *"sem matriz, SAC não vê contratos"*.
- **Cuidado com as portas**: o Painel Administrativo NÃO mostra número de
  faturamento na entrada — um número grande na porta vazaria por cima da
  regra que as telas de dentro respeitam (comentário no próprio
  `painel.administrativo.tsx`, coberto por asserção que varre só linhas de
  código). Ao criar qualquer painel/dashboard novo, a mesma pergunta:
  **esse número vaza valor para quem não pode ver?**
- O mesmo raciocínio já apareceu no domínio de compras: o valor do pedido sem
  responsável tem leitura mais larga do que o ideal — risco aceito e
  documentado (memória `compra_valor_legivel_demais` / PENDENCIAS).

## Onde o financeiro se liga ao resto

- **Contrato ↔ cliente**: contrato pertence a um cliente da base QAP (R21 —
  sem cliente avulso).
- **Contrato ↔ chamado**: `contrato_id` no chamado liga o serviço executado à
  cobertura; `faturamento_status` marca o que vira cobrança.
- **Proposta aceita → contrato**: hoje é passo manual (a proposta vive no
  funil comercial; o contrato é cadastrado em `/contratos`). EM ABERTO:
  automatizar a virada proposta→contrato quando o Sincronizar QAP existir.

## Procedimentos

**Criar contrato:** `/contratos` → "+" → escolher cliente da base → cobertura
e preços. (Tela `contratos` exige cargo comercial/admin.)

**Apurar um fechamento:** `/fechamentos` → novo período → o sistema reúne o
faturável do período → conferir → fechar (cadeado). Fechamento fechado não se
edita — reabrir é decisão explícita.

## Anti-práticas

- Expor valor (R$) em tela, painel ou notificação acessível ao SAC (R13) —
  inclusive indiretamente (número de porta de painel).
- Ligar faturamento a visita `aprovada` (R4 — o que fatura é serviço
  executado/contrato, e negócio só fecha com aceite).
- Cadastrar "cliente" só para pendurar um contrato (R21).

## Referências

- `src/routes/_authenticated/contratos*.tsx` · `fechamentos*.tsx`
- `src/features/contratos/` · `src/features/financeiro/`
- `docs/PLANO_UNIFICACAO.md` §U2/U5 · `docs/PRODUTO.md` — R13
