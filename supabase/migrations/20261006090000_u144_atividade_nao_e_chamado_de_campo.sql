-- ═══════════════════════════════════════════════════════════════════════════
-- U144 — CRIAR ATIVIDADE DEIXA DE SER A MESMA CHAVE DE ABRIR CHAMADO (R294)
--
-- Davi, 14/09/2026: "O Erik foi criar uma atividade para ele executar em breve,
-- e o sistema confundiu um ponto importante: os usuários que não são da Equipe
-- Técnica, que não têm cargo TÉCNICO, não deverão executar CHAMADOS, eles
-- executam Atividades."
--
-- ── O DEFEITO, E ELE É DE VOCABULÁRIO ──────────────────────────────────────
-- O pop-up "Nova atividade" da Início cria SEMPRE `natureza: 'interno'` — ele
-- nunca abriu chamado de campo. Mas o corpo dele era travado pela chave
-- `chamados.novo`, que é a chave da TRIAGEM `/chamados/novo`, de onde sai o
-- chamado DE CAMPO.
--
-- Resultado para quem não tem essa chave: em vez do formulário de atividade, a
-- tela do técnico de campo — "Abrir chamado é tarefa do SAC e da gestão; o
-- chamado chega a você pela programação; o que você registra por aqui é o
-- atendimento de plantão". Para o técnico isso é verdade (R163). Para o
-- OPERACIONAL, que trabalha na sede e cria as próprias atividades, é uma porta
-- trancada com a placa errada — e foi exatamente o que o Erik encontrou.
--
-- ── O QUE MUDA ─────────────────────────────────────────────────────────────
-- Nasce a chave `atividades.nova` — "criar atividade pela Início". Ela é o que
-- o pop-up passa a ler. `chamados.novo` continua sendo o que era: quem abre
-- CHAMADO DE CAMPO.
--
--   atividades.nova   técnico NÃO · comercial SIM · SAC SIM · operacional SIM
--   chamados.novo     (não muda)   técnico NÃO · comercial SIM · SAC SIM · operacional NÃO
--
-- O técnico continua caindo na porta do plantão, com a frase certa: para ele o
-- chamado REALMENTE chega pela programação (R163/R263).
--
-- ── POR QUE ISTO PRECISA DE MIGRATION ──────────────────────────────────────
-- O catálogo de telas (`src/lib/telas.ts`) tem um padrão por cargo que vale
-- enquanto não existe linha no banco — então o conserto funcionaria sem tocar
-- no Postgres. Mas há asserção no verificador exigindo que CATÁLOGO e SEMENTE
-- tenham as mesmas chaves e os mesmos padrões: chave nova sem linha semeada é
-- chave que some da matriz do Administrativo, e o Davi não consegue mudá-la.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING — rodar duas vezes não sobrescreve uma
-- escolha que o Davi tenha feito na matriz depois.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §0  PRÉ-VOO ────────────────────────────────────────────────────────────
DO $u144pre$
BEGIN
  IF to_regclass('public.permissoes_tela') IS NULL THEN
    RAISE EXCEPTION 'U144 PRÉ-VOO: `permissoes_tela` não existe — a U11 não rodou.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permissoes_tela WHERE tela = 'chamados.novo') THEN
    RAISE EXCEPTION E'U144 PRÉ-VOO: não há linha de `chamados.novo` na matriz.\nA semente das telas nunca rodou — semear só a chave nova deixaria a matriz pela metade.';
  END IF;
END
$u144pre$;

-- ── §1  A CHAVE NOVA ───────────────────────────────────────────────────────
-- DO NOTHING e não DO UPDATE: se o Davi já tiver mexido nesta chave na matriz,
-- a escolha dele vence a semente. Semente é o que vale na ausência de decisão.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('atividades.nova', 'tecnico',     false),
  ('atividades.nova', 'comercial',   true),
  ('atividades.nova', 'sac',         true),
  ('atividades.nova', 'operacional', true)
ON CONFLICT (tela, cargo) DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2  CONFERÊNCIA — olhe a coluna VEREDITO
-- ═══════════════════════════════════════════════════════════════════════════
WITH conferencia AS (

  SELECT 1 AS n, 'a chave nova tem as quatro linhas' AS o_que,
         (SELECT count(*)::text FROM public.permissoes_tela WHERE tela = 'atividades.nova') AS obtido,
         '4' AS esperado
  UNION ALL
  SELECT 2, 'o OPERACIONAL pode criar atividade (era este o bug do Erik)',
         (SELECT permitido::text FROM public.permissoes_tela
           WHERE tela = 'atividades.nova' AND cargo = 'operacional'), 'true'
  UNION ALL
  SELECT 3, 'o TÉCNICO continua sem criar atividade (para ele o chamado vem pela programação, R163)',
         (SELECT permitido::text FROM public.permissoes_tela
           WHERE tela = 'atividades.nova' AND cargo = 'tecnico'), 'false'
  UNION ALL
  SELECT 4, 'o OPERACIONAL continua sem abrir CHAMADO DE CAMPO (R294)',
         (SELECT permitido::text FROM public.permissoes_tela
           WHERE tela = 'chamados.novo' AND cargo = 'operacional'), 'false'
  UNION ALL
  SELECT 5, '`chamados.novo` não foi tocado — comercial e SAC seguem abrindo chamado',
         (SELECT string_agg(cargo || '=' || permitido::text, ', ' ORDER BY cargo)
            FROM public.permissoes_tela
           WHERE tela = 'chamados.novo' AND cargo IN ('comercial', 'sac')),
         'comercial=true, sac=true'

)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia ORDER BY n;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3  DESFAZER (só se precisar)
--
--   DELETE FROM public.permissoes_tela WHERE tela = 'atividades.nova';
--
-- E tire a chave de `src/lib/telas.ts` junto: o verificador exige que catálogo
-- e semente tenham as mesmas chaves, e apagar só um lado acende a asserção.
-- ═══════════════════════════════════════════════════════════════════════════
