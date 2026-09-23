# Estrutura do Repositório

```
AGENTS.md                    cápsula de contexto — fonte canônica de instruções (bloco da Lovable no topo)
CLAUDE.md                    adaptador gerado (= @AGENTS.md)
README.md                    o mapa geral do projeto
ONBOARDING.md                a migração de máquina e o plano de saída da Lovable (§6)
DESIGN_SYSTEM.md             tokens, temas, componentes, anti-padrões (§8), réguas (§6.26)
src/
├── routes/_authenticated/   uma tela por arquivo; rota removida vira redirect; routeTree.gen.ts é gerado
├── features/<dominio>/      modelo.ts (lógica PURA, testada) · data.ts (consultas) · componentes
├── lib/                     paleta.ts, ui.ts, telas.ts (catálogo de permissões), periodos.ts, chamado-status.ts
├── components/              peças compartilhadas (nav, seletores, editor)
└── integrations/supabase/   cliente e tipos gerados
supabase/migrations/         a fonte do schema: uma migration por entrega, numerada (U-série)
supabase/functions/          3 edge functions
scripts/
├── verificar-logica.cjs     as asserções permanentes (o gate de testes)
├── sumario.cjs              gera/confere os sumários dos documentos mestre
├── fechar-entrega.cjs       o fim de entrega: versão, ESTADO, sumários, verificador
├── build-windows.cjs        o pacote do servidor Windows
├── lib/editar.cjs           patch tudo-ou-nada dos rascunhos .cjs
├── harness-gates.cjs        valida e executa os gates do manifesto (Node — Windows, Linux, CI)
├── harness-sync.cjs         regenera os adaptadores por ferramenta
├── harness-index.cjs        regenera .harness/INDEX.md
├── docs-lint.cjs            regras anti-obesidade da documentação (R1–R5)
├── cobertura-regras.cjs     regenera a cobertura R# → verificação dos states
└── tests/                   testes do executor e do lint (node --test)
docs/
├── ESTADO_ATUAL.md          o retrato: onde estamos (índice de leitura)
├── DECISOES_PENDENTES.md    o que depende do Davi
├── PRODUTO.md               o catálogo de regras (R-série, global)
├── PLANO_UNIFICACAO.md      o diário (U-série) — a história vive aqui e no git
├── VERSOES.md · PENDENCIAS_TECNICAS.md · PLANO_V0.1.md · CONTEXTO_*.md · DASHBOARD.md
├── REQUIREMENTS.md → requirements/<modulo>.md   o "o quê" por módulo, apontando R#
├── ARCHITECTURE.md → decisions/ADR-NNNN-*.md · NFR.md · conventions.md
├── state/<modulo>.md        o estado por módulo (presente, não história)
├── manual/                  o manual por segmento
├── importacao/              dados da carga do QAP (não é documentação)
└── padrao-projeto/          referência local do Pattern Harness (clone; fora do git)
.claude/skills/              organizador · designer · banco · entrega (padrão aberto Agent Skills)
.harness/                    harness.yaml · INDEX.md (gerado) · agents/ · mcp/servers.json
.github/workflows/           harness.yml — o CI roda os mesmos gates em Windows e Linux; pull_request_template.md
.cursor/ · .gemini/ · .agent/ · .github/copilot-instructions.md · .mcp.json   adaptadores gerados
dist-windows/                pacotes gerados (fora do git)
```

Regra de dependência do código: `modelo.ts` não importa React nem Supabase; `data.ts`
consulta e traduz; a tela pinta. Tradução de dados nunca mora em componente. Regra de
dependência da documentação: requisito aponta regra e não cita código; estado cita código
e regra; ADR cita ambos e explica a escolha; a cápsula resume e aponta — nunca duplica.
