# Arquitetura — Índice

Decisões estruturais em formato **ADR** (uma por arquivo em `decisions/`), requisitos
não-funcionais em `NFR.md`, estrutura do repositório em `PROJECT-STRUCTURE.md`,
convenções aprendidas em `conventions.md`.

> **Protocolo**: leia apenas o(s) arquivo(s) pertinentes à tarefa — nunca a pasta inteira.
> As decisões de PRODUTO estão em `PRODUTO.md` (R-série) e o raciocínio de cada entrega,
> no diário `PLANO_UNIFICACAO.md` (U-série). ADR aqui é só decisão ESTRUTURAL.

## ADRs

| ADR | Decisão | Essência (1 linha) |
|---|---|---|
| [ADR-0001](decisions/ADR-0001-adotar-pattern-harness.md) | Adotar o Pattern Harness | Cápsula em AGENTS.md, CLAUDE.md gerado, gates como pronto; R# global e skills em .claude/skills são adaptações |
| [ADR-0002](decisions/ADR-0002-documentacao-viva-existente-e-a-fonte.md) | Os documentos existentes são a fonte | PRODUTO = catálogo de regras, PLANO = história, ESTADO = retrato; state por módulo aponta, não duplica |
| [ADR-0003](decisions/ADR-0003-verificador-como-gate.md) | O verificador é o gate de testes | 3.5k asserções sobre código e docs, tsc zero e vite build são os gates; migration fica fora dos gates |

## Convenções de ADR

- Arquivo `ADR-NNNN-titulo-kebab.md`, numeração sequencial; template em
  [`decisions/ADR-0000-template.md`](decisions/ADR-0000-template.md).
- ADR aceito é **imutável**: superado, escreva outro e marque o antigo com
  `Status: Substituído por ADR-NNNN`.
- Um ADR não duplica regra nem estado — **aponta** para eles e explica a escolha.

## Demais documentos

- [NFR.md](NFR.md) — o que o sistema promete com número verificável
- [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) — layout do repositório e regra de dependência
- [conventions.md](conventions.md) — as ferramentas da IA e as armadilhas que já morderam
- [DASHBOARD.md](DASHBOARD.md) — a receita obrigatória de painel (faixas, PRISMA × ESPECTRO)
- [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) — tokens, temas, componentes, anti-padrões (§8)
- [SISTEMA_OS.md](SISTEMA_OS.md) — o plano de arquitetura de origem (histórico, 15/08/2026)
- [REVISAO_2026-09-03.md](REVISAO_2026-09-03.md) — a revisão tela a tela
