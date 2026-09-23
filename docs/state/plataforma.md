# Plataforma — Estado da Implementação

<!-- ESTADO ATUAL, não história: a história vive em ../PLANO_UNIFICACAO.md (U-série) e no git.
     Ao entregar, REESCREVA a seção afetada; datas só em Pendências. -->

## O que existe

- React 19 + TypeScript + TanStack Start; `npx vite build` gera `src/routeTree.gen.ts` e `.output/`.
- Supabase: Postgres com RLS, GoTrue, buckets `contratos` e `fotos-os`, realtime, 3 edge functions
  (`supabase/functions/`), pg_cron; 31 RPCs; migrations numeradas em `supabase/migrations/` (fonte do schema).
- Pacote Windows: `npm run build:windows` → `dist-windows/Prever-<versão>.zip` com WinSW e `atualizar.ps1`;
  serviço em `192.168.10.182:5555` e `grupoprever.ddns.net:5555`.
- Verificação: `scripts/verificar-logica.cjs` (asserções permanentes), `scripts/sumario.cjs` (sumários),
  `scripts/fechar-entrega.cjs` (fim de entrega), `scripts/lib/editar.cjs` (patch tudo-ou-nada).
- Harness em Node (ADR-0004): `.harness/harness.yaml` (seis verbos + nove gates), `scripts/harness-gates.cjs`,
  `harness-sync.cjs`, `harness-index.cjs`, `docs-lint.cjs`, `cobertura-regras.cjs`, testes em
  `scripts/tests/*.test.cjs` (`node --test`); CI em `.github/workflows/harness.yml` (Windows e Linux).

## Padrões a reusar

- Migration nova: pré-voo, idempotência, conferência obtido × esperado × veredito, DESFAZER (skill `banco`).
- Nunca editar migration já rodada; nunca reescrever histórico do `main`.
- Parar o dev server antes do `build:windows` (o zip sai incompleto com ele rodando).
- Pino do verificador descreve arquivo, nunca estado do banco.

## Configuração

- `.env` versionado só com chaves públicas (`VITE_*`); service role key e chave da Anthropic no `config.env`
  do servidor. `SITE_URL` no serviço (convites).
- O harness só precisa do Node 24 (o mesmo do app): `node scripts/harness-gates.cjs` no PowerShell, no cmd,
  no bash e no CI. Comando de gate é neutro de shell (roda em cmd.exe e em sh).

## Cobertura R# → verificação

<!-- cobertura:inicio -->
<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->

Regras do módulo: 7 · com asserção nominal no verificador: 7 · sem menção nominal: 0.

| Regra | Verificado por |
|---|---|
| produto:R77 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R167 | 10 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R220 | 9 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R229 | 14 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R230 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R278 | 3 menções nominalis em `scripts/verificar-logica.cjs` |
| produto:R280 | 5 menções nominalis em `scripts/verificar-logica.cjs` |
<!-- cobertura:fim -->

## Pendências

- Instalar a v1.0.2 no servidor (G4 em `../DECISOES_PENDENTES.md`): ele está na v0.0.7 desde 08/09/2026.
- Sair da Lovable (I1) e o backup testado (I3) — com o T.I.
- Migration U155 pendente (G1).
- O que depende do Davi está consolidado em `../DECISOES_PENDENTES.md`; a dívida técnica, em
  `../PENDENCIAS_TECNICAS.md`.
