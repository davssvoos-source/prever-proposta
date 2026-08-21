# Manual Prever Proposta

Documentos instrutivos por segmento — procedimentos, práticas e regras.
Gerados em 2026-08-21 a partir da mega revisão do sistema (pedido do Davi).

**Fonte de verdade:** o código e `docs/PRODUTO.md` (regras R1–R32). Se um
documento daqui discordar deles, eles ganham — e o documento deve ser
corrigido. Ao mudar uma regra ou um fluxo, atualize o documento do segmento
na mesma leva.

| Documento | O que cobre |
|---|---|
| [visao-geral.md](visao-geral.md) | O que o sistema é, cargos, fluxo macro, navegação, o que ainda não existe |
| [comercial.md](comercial.md) | Funil: visita → orçamento → aprovação → proposta → resposta; formato do .docx; R4/R21/R29/R32 |
| [operacao-campo.md](operacao-campo.md) | Ciclo do chamado, a fila na Início, programação, os indicadores e o que cada um responde |
| [clientes-qap.md](clientes-qap.md) | QAP como fonte única, base provisória, inventário 3 níveis, o mapa de SP |
| [permissoes-e-acesso.md](permissoes-e-acesso.md) | As 3 camadas (cargo, matriz de telas, RLS) e o procedimento de tela nova |
| [financeiro.md](financeiro.md) | Contratos, fechamentos, faturamento e a R13 (SAC não vê valores) |
| [interface-e-design.md](interface-e-design.md) | A receita de tela no padrão da casa; o degradê como identidade; dataviz |
| [banco-e-migrations.md](banco-e-migrations.md) | Migrations manuais e idempotentes, satélite mesmo-id, cicatrizes de SQL |
| [desenvolvimento-e-verificacao.md](desenvolvimento-e-verificacao.md) | O toolchain real (sem tsc), asserções, routeTree, .env/Lovable |
| [seguranca.md](seguranca.md) | Blindagem RLS, riscos aceitos S4–S11, lições pagas, checklists |
| [codigos-de-erro.md](codigos-de-erro.md) | Como ler o código (`PRV-ÁREA-CLASSE-ORIGEM`), as 7 classes e o que fazer com cada uma |

Leitura recomendada para alguém novo: **visao-geral** →
**desenvolvimento-e-verificacao** → o segmento onde vai trabalhar.
