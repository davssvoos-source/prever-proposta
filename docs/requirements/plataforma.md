# Plataforma — Requisitos

Identificador do módulo: `plataforma`.

Propósito: Build, publicação, versões, Supabase e migrations, verificação, hospedagem e o próprio
harness.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- O sistema DEVE ser versionado: `package.json` = `src/lib/versao.ts` = a entrada mais nova de
  `VERSOES.md` (R229).
- O sistema DEVE ser hospedável em servidor Windows próprio, com porta configurável (R220), e DEVE
  sair da Lovable quando houver data (R280).
- O repositório NÃO DEVE aplicar migration: o Davi roda à mão; toda migration é idempotente, com
  conferência e DESFAZER.
- Foto guardada DEVE ser endereço no storage, nunca URL (R278).
- Pronto DEVE ser mecânico: `tsc` em zero, verificador em "0 falharam", build completo, docs e
  derivados em dia (gates de `.harness/harness.yaml`).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/plataforma.md`.

| Regra | Essência |
|---|---|
| R77 | Trinta chamados fictícios de teste para o dashboard poder ser visto cheio |
| R167 | A tela "Importar do Notion" saiu |
| R220 | O sistema é hospedável em servidor Windows próprio, como serviço, na porta que o setup escolher |
| R229 | O sistema é versionado; esta é a v0.0.2 |
| R230 | O sistema se chama Prever OS |
| R278 | Foto guardada é ENDEREÇO no storage, nunca URL |
| R280 | O sistema sai da Lovable: host próprio, domínio próprio |

## Fora de escopo

- Regras de produto de cada domínio: nos módulos respectivos.
- Sair do Supabase: não é troca de hospedagem (I2 em `../DECISOES_PENDENTES.md`) — auto-hospedar preserva o código.

## Referências

- ADRs: ADR-0001 (o padrão), ADR-0003 (o verificador como gate).
- Manual: `../manual/hospedagem-windows.md`, `../manual/desenvolvimento-e-verificacao.md`,
- `../manual/banco-e-migrations.md`, `../manual/codigos-de-erro.md`; `../../ONBOARDING.md` §6 (sair da Lovable).
- Estado da implementação: `../state/plataforma.md`.
