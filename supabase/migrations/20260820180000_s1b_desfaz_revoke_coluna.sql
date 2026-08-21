-- S1b — DESFAZ os REVOKE de coluna da S1 (2026-08-20)
--
-- A S1 tentou proteger `profiles.telefone` (leitura) e `profiles.cargo` /
-- `profiles.equipe` (escrita) com REVOKE de COLUNA. Foi um erro de projeto meu,
-- por dois motivos — e o segundo quebra o app.
--
-- 1. NÃO SEPARA NINGUÉM. GRANT/REVOKE são por ROLE DE BANCO, e no Supabase
--    TODO usuário logado é o mesmo role: `authenticated`. Não existe "gestor vê
--    telefone, técnico não" por GRANT — o REVOKE tira de todos, admin
--    inclusive. A proteção que eu queria só se expressa por RLS (linha) ou por
--    view, nunca por privilégio de coluna.
--
-- 2. QUEBRA QUALQUER `select *`. Se uma coluna está revogada, o Postgres
--    recusa a consulta INTEIRA, não a coluna. E o app faz exatamente isso:
--      · src/features/visitas/data.ts  → fetchProfile: .select("*")
--      · src/features/gerencial/data.ts → .select("… , telefone, ativo")
--    Ou seja: perfil e lista de técnicos passariam a falhar com
--    "permission denied for column telefone" — e fetchProfile roda no início
--    da sessão.
--
-- O buraco que o REVOKE de `cargo` tentava tapar (auto-promoção a admin) NÃO
-- reabre: quem barra isso é o trigger `trg_guard_profiles_privilegios` (etapa0),
-- que a auditoria verificou e confirmou fechado. O REVOKE era uma segunda
-- camada — e uma segunda camada que derruba o app não é camada, é defeito.
--
-- O telefone dos funcionários volta a ser legível pelo time. Está registrado
-- como pendência S4 em docs/PENDENCIAS_TECNICAS.md, com o caminho certo
-- (RLS/view) para quando valer a pena.

GRANT SELECT (telefone) ON public.profiles TO authenticated;
GRANT UPDATE (cargo)    ON public.profiles TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'profiles'
                AND column_name = 'equipe') THEN
    GRANT UPDATE (equipe) ON public.profiles TO authenticated;
  END IF;
END $$;

-- ── Verificação ─────────────────────────────────────────────────────────────
-- `select *` em profiles precisa voltar a funcionar para `authenticated`.
SELECT 'telefone legível de novo' AS item,
       has_column_privilege('authenticated', 'public.profiles', 'telefone', 'SELECT')::text AS ok
UNION ALL
SELECT 'cargo gravável de novo (o trigger é quem barra a promoção)',
       has_column_privilege('authenticated', 'public.profiles', 'cargo', 'UPDATE')::text
UNION ALL
SELECT 'o trigger que impede auto-promoção continua no lugar',
       (EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.profiles'::regclass
                   AND tgname = 'trg_guard_profiles_privilegios'
                   AND NOT tgisinternal))::text;
