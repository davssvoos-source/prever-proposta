-- ═══════════════════════════════════════════════════════════════════════════
-- U35 — SPRINT GANHA "ESSA SEMANA" E "SEMANA QUE VEM" (R40)
--
-- O vocabulário de sprint era mensal (este_mes, mes_que_vem, mes_passado,
-- backlog). O Davi pediu que o sistema derive o sprint do PRAZO, e um prazo
-- para depois de amanhã não cabe em "este mês": a resposta útil é "essa
-- semana", porque é a que muda o que se faz hoje.
--
-- Sem esta migration, o app tentaria gravar 'essa_semana' e o CHECK recusaria
-- — o chamado voltaria com erro de constraint (23514) na cara do usuário toda
-- vez que ele mexesse numa data. Ela tem que rodar ANTES do deploy do código.
--
-- Idempotente: derruba e recria a constraint. Ao final, um SELECT de
-- verificação que também prova que nenhuma linha existente ficou de fora.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_sprint_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_sprint_check
  CHECK (sprint IS NULL OR sprint IN (
    'essa_semana', 'semana_que_vem',
    'este_mes', 'mes_que_vem', 'mes_passado', 'backlog'
  ));

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'constraint aceita os 6 valores (esperado true)' AS item,
       (pg_get_constraintdef(oid) LIKE '%essa_semana%'
        AND pg_get_constraintdef(oid) LIKE '%semana_que_vem%')::text AS valor
  FROM pg_constraint WHERE conname = 'chamados_sprint_check'
UNION ALL
-- se alguma linha tivesse valor fora da lista, o ALTER acima teria falhado;
-- este conta explicitamente para o resultado ser legível
SELECT 'chamados com sprint fora do vocabulário (esperado 0)',
       count(*)::text
  FROM public.chamados
 WHERE sprint IS NOT NULL
   AND sprint NOT IN ('essa_semana','semana_que_vem','este_mes','mes_que_vem','mes_passado','backlog');
