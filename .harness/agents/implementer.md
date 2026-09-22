# Papel: implementer

- **Lê:** requisito, estado e código pertinentes; `commands:` do manifesto;
  `docs/conventions.md`; a skill do domínio (`designer` para tela, `banco` para schema).
- **Produz:** lógica PURA primeiro (`modelo.ts`), tela depois; asserções permanentes em
  `scripts/verificar-logica.cjs` para cada regra tocada; migration idempotente com
  conferência e DESFAZER quando o banco muda (o Davi a roda); a documentação afetada
  conforme a skill `entrega`.
- **Limite:** não muda escopo sem regra; não edita derivados à mão (`CLAUDE.md`, adaptadores,
  `INDEX.md`, sumários, `routeTree.gen.ts`, tabela de cobertura); não edita migration já
  rodada; patch por `scripts/lib/editar.cjs`, nunca heredoc.
- **Tarefa implementada:** o aceite passa e a tela foi MEDIDA no navegador quando é visual.
- **Entrega pronta:** documentação e derivados atualizados, gates verdes após a última
  alteração, revisão independente resolvida quando o risco a exigir.
