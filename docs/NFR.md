# Requisitos Não-Funcionais

Só o que o sistema realmente promete, com número ou condição verificável. O que ainda
é desejo está em `DECISOES_PENDENTES.md` (§4) e não entra aqui.

## Segurança

- Segredos não entram no repositório: o `.env` versionado só tem chaves PÚBLICAS do
  Supabase; a service role key e a chave da Anthropic vivem no `config.env` do servidor.
- Toda tabela tem RLS; a leitura por cargo é decidida no banco, não na tela: o cargo
  TÉCNICO lê só atividade de campo e a dele (R264); o SAC não vê valores (R13);
  o OPERACIONAL lê a base de clientes inteira (R305, U155).
- Migration idempotente, com pré-voo, conferência obtido × esperado e DESFAZER — e rodada
  por uma pessoa, nunca pelo repositório.

## Qualidade verificável

- `npx tsc --noEmit`: **0 erros** (baseline zero desde a U138).
- `node scripts/verificar-logica.cjs`: **0 falharam** (3.581 asserções em 22/09/2026).
- `npx vite build` completa; `src/routeTree.gen.ts` commitado.
- Sumários dos documentos mestre em sincronia (`node scripts/sumario.cjs --check`).

## Interface

- Pesos de fonte só {100, 400, 600, 700} (R195; asserção CRÍTICA).
- Contraste de texto ≥ 4,5:1; preenchimento ≥ 3:1 (2,5:1 no tema claro, decisão R154).
- Todo token de cor do `:root` tem par no tema claro; nenhum hex fora de `src/lib/paleta.ts`.
- Alvo de toque ≥ 40px no celular; hover só com ponteiro fino (`@media (hover: hover)`).

## Disponibilidade e backup

- Nenhuma promessa registrada ainda. O backup é o do plano atual do Supabase e nunca foi
  restaurado em teste — decisão pendente I3 em `DECISOES_PENDENTES.md`.
