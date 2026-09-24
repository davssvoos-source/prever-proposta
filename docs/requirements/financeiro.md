# Financeiro — Requisitos

Identificador do módulo: `financeiro`.

Propósito: Contratos, cobrança do atendimento, conferência e fechamentos, e quem vê valores.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- QUANDO um atendimento é concluído, decidir a cobrança DEVE ser o mesmo gesto (R104); conferir e
  fechar DEVE decidir a cobrança e fechar de verdade (R121).
- O cartão da grade DEVE dizer em que ponto do ciclo financeiro o chamado está (R103).
- Aprovar a cobrança NÃO DEVE apagar o lançamento avulso (R118); "A cobrar este mês" DEVE ser só o
  que falta faturar (R161).
- O parcelamento de 1x a 12x DEVE existir só para a manutenção, e quem lança escolhe o mês em que
  começa (R290, R291).
- Os contratos DEVEM viver na ficha do cliente (R132); o regime dos equipamentos é o do contrato do
  condomínio (R157).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/financeiro.md`.

| Regra | Essência |
|---|---|
| R103 | O cartão da grade diz em que ponto do ciclo financeiro o atendimento está — e diz que HOUVE lançamento, nun… |
| R104 | Concluir um atendimento e decidir a cobrança são o mesmo gesto, e a decisão tem três respostas |
| R118 | Aprovar a cobrança de um chamado NÃO apaga o lançamento avulso que alguém pendurou naquele chamado |
| R119 | Montar fechamento volta a funcionar, e o número que a tela usa para abrir o período é contrato |
| R121 | Conferir e fechar decide a cobrança, e "fechar" passa a fechar de verdade |
| R132 | Os contratos vivem na ficha do cliente; a página de lista `/contratos` não existe mais |
| R157 | O regime dos equipamentos é o do contrato do condomínio; as exceções constam no contrato — não há regime po… |
| R161 | "A cobrar este mês" é só o que ainda falta faturar |
| R290 | O parcelamento de 1x a 12x é da MANUTENÇÃO |
| R291 | Quem lança escolhe o MÊS em que a cobrança começa |
| R311 | O texto padrão da cobrança e o tipo de serviço padrão |

## Fora de escopo

- Valores da proposta comercial (custo, venda, markup): módulo `comercial` (R164).
- Quem vê valores (`pode_ver_financeiro()`): módulo `acessos` (R13).

## Referências

- Manual: `../manual/financeiro.md`.
- ADRs: ADR-0002.
- Estado da implementação: `../state/financeiro.md`.
