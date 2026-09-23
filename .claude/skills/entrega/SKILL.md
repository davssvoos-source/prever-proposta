---
name: entrega
description: O fecho de toda entrega no Prever OS — regra antes do código, asserção, diário, documentação só do que mudou, derivados regenerados e gates verdes.
---

# Entrega

Processo proporcional ao risco. O que se repete a cada entrega está em ferramenta;
o que exige julgamento está aqui. Os passos numerados do ciclo estão em `AGENTS.md`.

## 1. Orientar e escolher o caminho

Localize o módulo no mapa de `AGENTS.md`; leia `docs/requirements/<modulo>.md`,
`docs/state/<modulo>.md`, as regras R# citadas e o contexto ditado do domínio. Leia ADR
só se precisar do detalhe; não releia o que já conhece na sessão. Análise sem edição
termina nos achados.

- **Correção ou manutenção sem alterar contrato:** corrigir, adicionar a asserção que
  teria pegado o defeito, verificar. Não cria regra nem ADR.
- **Comportamento novo ou alterado:** a regra R-série entra em `docs/PRODUTO.md` ANTES do
  código, citando a frase do Davi. Pedido dele é autorização; dúvida que mude
  comportamento, risco ou dinheiro vai para `docs/DECISOES_PENDENTES.md`.
- **Mudança estrutural ou de alto impacto:** ADR em `docs/decisions/` e revisão independente
  (RLS, migration, cobrança, dados históricos, publicação). Se toca o banco, a skill `banco`:
  migration idempotente, pré-voo, conferência, DESFAZER — e o aviso ao Davi para rodar.

Invariante fechada em `AGENTS.md` não se re-debate. Chave de tela gravada não se renomeia.

## 2. Implementar

- Lógica PURA primeiro (`features/<dominio>/modelo.ts`), tela depois; cor de `paleta.ts`,
  superfície de `ui.ts`, réguas do `DESIGN_SYSTEM.md`. Tela é da skill `designer`.
- Toda regra tocada vira asserção permanente em `scripts/verificar-logica.cjs`; construção
  de código procura-se com `soCodigo`; pino descreve ARQUIVO, nunca estado do banco.
- Patch por `scripts/lib/editar.cjs` (tudo-ou-nada); rascunho `.cjs` pelo Write no scratchpad.
- Tela visual: MEDIR no navegador antes de dizer pronto. Sem sessão aberta, medir é do Davi
  — declare isso, não simule.
- Papéis (`.harness/agents/`) são responsabilidades, não quatro agentes obrigatórios.
  Revisão independente usa outro contexto; se indisponível, declare a pendência.

## 3. Fechar a entrega

Atualize SÓ o que mudou, cada fato na sua morada:

| Mudou… | Atualize |
|---|---|
| comportamento | a regra em `docs/PRODUTO.md` (já entrou no passo 1) e o manual do segmento em `docs/manual/` |
| o que existe no módulo | `docs/state/<modulo>.md` — no PRESENTE; a história é do diário e do git |
| a lista de regras do módulo | a tabela de `docs/requirements/<modulo>.md` e o Status em `docs/REQUIREMENTS.md` (1 linha) |
| decisão estrutural | o ADR e a linha dele em `docs/ARCHITECTURE.md` |
| token, componente, receita | `DESIGN_SYSTEM.md` com os valores resolvidos |
| o retrato | `docs/ESTADO_ATUAL.md` (última regra, diário, migrations, o que está no ar) |
| o que depende do Davi | `docs/DECISOES_PENDENTES.md` (entra, ou sai quando vira regra) |
| versão instalável | a entrada `## vX — data (Un) · migration…` em `docs/VERSOES.md`, antes do fechar-entrega |

Sempre: a entrada U-série em `docs/PLANO_UNIFICACAO.md` com o raciocínio (por que assim, o
que se recusou, o que a verificação pegou). Depois, na ordem:

```sh
node scripts/fechar-entrega.cjs --versao X --regra Rn --diario Un   # ou sem --versao quando não há versão nova
node scripts/harness-sync.cjs && node scripts/harness-index.cjs && node scripts/cobertura-regras.cjs
node scripts/harness-gates.cjs        # Windows, Linux e CI — todos os gates verdes = pronto
```

Alteração depois dos gates exige rodá-los de novo. Informe mudanças, evidências e
pendências; resuma os gates e os trechos de falha. Commit em português; o push publica
na Lovable e instala nada no servidor — o pacote Windows é outro gesto (`build:windows`).
