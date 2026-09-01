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

## O ciclo financeiro no cartão da grade (R103/R104, U80)

A tela da programação passou a mostrar, por atendimento, **em que ponto do ciclo
financeiro ele está** — e ela é liberada ao SAC, que por regra (R13) **não vê
valores**. Três coisas decorrem disso e importam a quem cuida do financeiro:

**1. O cartão mostra um BIT, nunca um valor.** "Lançado" diz que existe
lançamento vinculado; não diz quantos, nem quanto, nem em que competência, nem o
status da cobrança. Quatro dos seis selos nem chegam a consultar `cobrancas` —
saem de `chamados.faturamento_status`, que quem lê o chamado já lê.

**2. Ausência de selo não é ausência de cobrança.** Quando o sistema não pode
contar, ele cala. Isso é deliberado: um `[]` devolvido por RLS e um `[]` de "não
há" são indistinguíveis num SELECT direto, e um cartão obrigado a dizer alguma
coisa transformaria essa omissão em mentira. A função
`chamados_com_lancamento(uuid[])` existe só para separar os dois casos.

**3. Um atendimento pode aparecer "A conferir" para o SAC e ele não conseguir
resolvê-lo.** O card de Cobrança do chamado é de quem vê valores, e a aprovação
recusa quem não é. Se isso incomodar na prática, a decisão é de permissão e é do
Davi — a linha 108 da conferência da U80 diz quantas pessoas estão nessa
situação hoje.

## Lançar cobrança pelo painel de conclusão

Existe agora uma **terceira forma** de uma cobrança nascer, e ela é estreita de
propósito:

| Via | Quando | Onde |
|---|---|---|
| Aprovação da conferência | há peças analisadas | painel do chamado |
| Avulso sem chamado | mensalidade, acerto | `/fechamentos` |
| **Avulso VINCULADO** | atendimento **sem** peça analisada | painel de conclusão da grade |

**As vias 1 e 3 são disjuntas por construção**: a porta recusa lançar um valor
digitado num atendimento que teve análise item a item. Onde houve análise, o
valor do contrato tem opinião e a cobrança sai da conferência. Sem essa recusa,
alguém digitaria R$ 480 num chamado com seis peças analisadas.

O lançamento nasce com `chamado_id` preenchido, `chamado_peca_id` nulo,
`contrato_id` herdado do chamado, e crava `faturamento_status = 'aprovada'` na
**mesma transação** — é isso que faz o selo encontrá-lo e que impede a
aprovação de rodar por cima.

**As parcelas são divididas em centavos com o resto na primeira** (a mesma regra
de sempre), e o servidor **confere que a soma fecha** em vez de repetir a
divisão: a conta tem um dono só.

## Duplicata de cobrança: o que mudou

Antes da U80 **não existia UNIQUE nenhum** em `cobrancas`, e dois cenários
duplicavam de verdade:

- dois gestores aprovando o mesmo atendimento no mesmo minuto (o `DELETE` que
  protege a reaprovação é idempotente de uma thread só);
- reaprovar **depois que o período fechou** — o `DELETE` só apaga o que está
  `aberta`, e as `fechada`/`faturada` sobreviviam com um jogo novo ao lado.

Agora há dois índices únicos parciais: **uma peça rende uma cobrança viva**, e
**um avulso vinculado é único por chamado, competência e descrição**. Os dois
ignoram `cancelada` — cancelar libera a peça para ser cobrada de novo, que é o
que a palavra quer dizer, e é o mesmo recorte que o fechamento já usa.

**Efeito visível:** "Aprovar cobrança" pode passar a **recusar** onde antes
duplicava em silêncio. A mensagem foi traduzida ("já tem cobrança lançada para
estas peças; recarregue a tela"). É correção trocando silêncio por barulho.

**O que continua sem trava:** o avulso **sem** chamado, em `/fechamentos` — dois
cliques em "Lançar" ainda criam dois jogos de parcelas, e nenhum dos dois índices
o alcança. Ver P21 em `docs/PENDENCIAS_TECNICAS.md`.

## Conferência: um atendimento pode estar parado sem ninguém ver

`faturamento_status = 'em_conferencia'` é escrito ao fim da análise automática,
e **nenhum gate do sistema lê esse valor**. O atendimento sai da fila "a
conferir", para de gerar alerta diário, e os botões "Ajustar", "Aprovar
cobrança" e o card de Conferência **somem** — sem ninguém ter aprovado nada.

O cartão da grade agora conta `em_conferencia` como **A conferir** e é a primeira
superfície que os traz de volta à vista. Isso não conserta o defeito (P20):
o motor aceita a aprovação, é só a visibilidade dos botões que está errada.

Para saber quantos estão nessa situação:

```sql
SELECT count(*) FROM public.chamados
 WHERE natureza = 'campo' AND status = 'concluido'
   AND faturamento_status = 'em_conferencia';
```

## Anti-práticas (acréscimo)

- Fazer um selo, chip ou contador do ciclo financeiro sair de um **SELECT
  direto** em `cobrancas`. A policy filtra linhas sem levantar erro: o resultado
  é `[]` para quem não vê valores, indistinguível de "não há". Use a RPC.
- Tratar linha ausente na resposta da RPC como `false`. Ausência é "não sei", e
  um mapa preenchido com `false` é a mesma mentira, inventada no cliente.
- Devolver `valor`, `competencia`, `status` da cobrança ou **contagem** numa
  função concedida a `authenticated` por causa do ciclo. O `status` conta que
  alguém cancelou; a contagem conta o volume de peças faturáveis.

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
