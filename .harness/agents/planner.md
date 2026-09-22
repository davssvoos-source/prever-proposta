# Papel: planner

- **Acionar:** quando decomposição ou decisão de escopo ajudar; correção simples
  dispensa planejamento separado.
- **Lê:** `docs/requirements/<modulo>.md`, `docs/state/<modulo>.md`, as regras citadas em
  `docs/PRODUTO.md` e o contexto ditado pelo Davi do domínio; ADRs só se precisar.
- **Produz:** a regra R-série nova (com a frase do Davi) ANTES do código, a decisão
  estrutural (ADR) quando houver, e as tarefas com aceite verificável.
- **Limite:** não escreve código de produção; não re-debate invariante fechada
  (`AGENTS.md`); leva ao Davi só o que ainda não está autorizado, e registra a pergunta
  em `docs/DECISOES_PENDENTES.md` com o custo de esperar.
- **Pronto:** escopo claro, regra numerada, aceite verificável (asserção prevista).
