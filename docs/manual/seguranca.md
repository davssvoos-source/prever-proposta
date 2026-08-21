# Segurança — o que protege o sistema e o que já queimou

> Manual Prever Proposta — segmento: segurança. Gerado em 2026-08-21 a partir
> de revisão do código. Fonte de verdade: o código e as migrations; se este
> documento discordar deles, eles ganham.

## Para que serve este documento

O modelo de proteção em vigor (a blindagem S1 + U29), os riscos que foram
**aceitos conscientemente** (S4–S11) e as lições pagas caro — para ninguém
pagar de novo.

## O modelo em vigor

**RLS em tudo que importa.** A blindagem principal é
`supabase/migrations/20260820170000_s1_blindagem_rls.sql`:

- `clientes` e a cadeia do inventário (3 níveis, policies tabela por tabela —
  nunca por loop "esperto").
- **Storage privado**: buckets (`fotos-os`, `contratos`, fotos de visita…)
  com `public = false` e policies por vínculo (chamado/contrato/visita), não
  por "qualquer autenticado".
- `funil_comercial` (valores): leitura só para gestor.
- Funções de apoio com **fonte dual** (`e_admin()`, `pode_gerir_clientes()`
  — user_roles OU profiles.cargo) e `pode_editar_chamado()`.

**Capa nunca mais frouxa que o corpo** (U29): o chamado da proposta não herda
"sem responsável é de todos" — senão a lista de chamados vira porta dos
fundos do funil comercial.

**Três camadas de acesso** (cargo → matriz de telas → RLS): detalhadas em
`permissoes-e-acesso.md`. A de dados (RLS) é a única que segura URL direta e
consulta à API — as outras são conveniência de interface.

## Riscos aceitos e documentados (S4–S11)

A lista viva está em `docs/PENDENCIAS_TECNICAS.md`, seção S. Os dois que mais
importam para decisões futuras:

- **S10 — headers CSP revertidos.** `script-src 'self'` mata o script inline
  de hidratação do TanStack Start (derrubou o SSR). Para reintroduzir:
  começar por **`Content-Security-Policy-Report-Only`**, validar o build
  localmente com os headers, e só então endurecer.
- **S9 — o importador do QAP deve rodar como `service_role`.** O RLS de
  escrita em `clientes` não abre para usuário comum; o Sincronizar será
  server-side.

**P1 (CRÍTICO, de interface)**: o menu de filtro pintado atrás da barra
inferior — não é de segurança, mas é o único CRÍTICO em aberto na lista de
pendências; não confundir as listas.

## Lições pagas (nunca repetir)

1. **`REVOKE` de coluna não segmenta usuários no Supabase.** Todo logado é o
   MESMO papel `authenticated`; o REVOKE pegou o admin junto e quebrou todo
   `select *` da tabela (post-mortem na S1b). Visibilidade fina → policy/view.
2. **CSP direto em produção derruba SSR.** Sempre Report-Only primeiro
   (S10, acima).
3. **`.env` fora do repo = app fora do ar.** O Lovable builda do repo. É
   decisão registrada (comentário no `.gitignore` + asserções), não descuido.
   Consequência aceita: as chaves anon do Supabase estão versionadas — a
   proteção real dos dados é o RLS, nunca o segredo da anon key.
4. **Loop genérico em blindagem pula tabela em silêncio.** A S1 quase saiu
   sem o nível do meio do inventário. Blindagem é explícita, tabela por
   tabela, com SELECT de verificação contando policies.

## Checklist de segurança para coisa nova

**Tabela nova**: RLS ON no nascimento · policies por operação e por cargo ·
capa ≤ corpo · SELECT de verificação (ver `banco-e-migrations.md`).

**Tela nova**: guarda de rota (`guardaDeTela`) — menu esconder não protege ·
semente na matriz · nenhum valor R$ visível a SAC/técnico (R13), nem na
porta do painel.

**Bucket novo**: `public = false` · policy por vínculo de dado, nunca só
`bucket_id` + autenticado.

**Integração nova (QAP, WhatsApp)**: credencial em servidor
(`service_role` nunca no cliente) · payload externo é entrada não confiável.

## Referências

- `supabase/migrations/20260820170000_s1_blindagem_rls.sql` (com post-mortem)
  · `..._s1b_desfaz_revoke_coluna.sql` · U29 (policies da capa)
- `docs/PENDENCIAS_TECNICAS.md` — S4–S11, P1
- `docs/PLANO_UNIFICACAO.md` — o episódio do app fora do ar
