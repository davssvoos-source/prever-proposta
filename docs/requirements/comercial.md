# Comercial — Requisitos

Identificador do módulo: `comercial`.

Propósito: Visita técnica, orçamento por blocos, proposta comercial, funil e o Painel Comercial.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- O ciclo comercial DEVE encerrar no ENVIO da proposta (R38 retificada, R64): aprovação é ato
  interno (R4) e aceite ou recusa do cliente não é rastreado.
- A Proposta Comercial DEVE ser um tipo de chamado com o fluxo da visita (R29, R147), nascer com
  responsável do Comercial (R260) e expandir no próprio "+" da Início (R214).
- Visita Técnica e Proposta Comercial DEVEM ser duas atividades ligadas (R170); o admin também faz
  visita (R241).
- SE alguma linha do orçamento está SOB CONSULTA, ENTÃO NÃO DEVE haver total (R279).
- O Painel Comercial DEVE ter lista e quadro por etapa (R252) e um dashboard no lugar do funil
  (R302).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/comercial.md`.

| Regra | Essência |
|---|---|
| R4 | Aprovar visita é ato interno do comercial; quem aprova ou recusa a proposta é o cliente |
| R23 | Proposta também se faz para cliente existente |
| R29 | A proposta comercial é um TIPO DE CHAMADO |
| R32 | "Visitas e propostas" É o Painel Comercial |
| R38 | Prospecção é ABA do Painel Comercial |
| R64 | O Painel Comercial é uma lista única |
| R78 | Dois acertos no Painel Comercial |
| R147 | A Proposta Comercial é o fluxo da visita, com o vocabulário do Davi |
| R164 | Os valores da visita — custo, venda, markup, mensalidades — são só de admin e comercial |
| R170 | Visita Técnica e Proposta Comercial são duas atividades, no mesmo fluxo |
| R194 | A Nova Visita Técnica é UMA tela, em colunas: Local · Contatos e serviços · Agendamento |
| R214 | A Proposta Comercial expande no próprio "+" da Início, como os outros tipos de demanda |
| R241 | O admin também faz visita técnica |
| R252 | O Painel Comercial tem as duas visões: lista e quadro |
| R259 | A tela da Proposta Comercial fala menos — e o que sobrou fica alinhado |
| R260 | Proposta Comercial nasce com responsável do Comercial |
| R279 | Com item SOB CONSULTA não há total |
| R302 | O Painel Comercial ganha um dashboard no lugar do funil, um filtro de Tipo de Serviço no lugar dos chips de… |
| R306 | Ticket médio: dois valores, guardados separadamente — o anual recorrente e a implantação |

## Fora de escopo

- Prospecção e cadastro de prédio orçado: módulo `clientes` (R21, R22) — o Prever OS nunca cadastra cliente.
- Ticket médio: o valor da proposta não é gravado; decisão D1 em `../DECISOES_PENDENTES.md`.

## Referências

- Regras dos blocos do orçamento: `../REGRAS_BLOCOS.md`.
- Manual: `../manual/comercial.md`.
- ADRs: ADR-0002.
- Estado da implementação: `../state/comercial.md`.
