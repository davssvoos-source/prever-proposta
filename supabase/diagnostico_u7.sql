-- Diagnóstico antes de repetir a U7 — só lê, não altera nada.
-- Responde uma pergunta: a tentativa que falhou desfez tudo, ou parou no meio?
SELECT
  'ordens_servico' AS tabela,
  CASE WHEN to_regclass('public.ordens_servico') IS NULL THEN 'não existe' ELSE 'existe' END AS estado,
  'existe (se sumiu, a fusão avançou)' AS esperado_para_repetir
UNION ALL
SELECT 'demandas',
  CASE WHEN to_regclass('public.demandas') IS NULL THEN 'não existe' ELSE 'existe' END,
  'existe'
UNION ALL
SELECT 'chamados',
  CASE WHEN to_regclass('public.chamados') IS NULL THEN 'não existe' ELSE 'existe' END,
  'NÃO existe'
UNION ALL
SELECT 'os_sla',
  CASE WHEN to_regclass('public.os_sla') IS NULL THEN 'não existe' ELSE 'existe' END,
  'existe'
UNION ALL
SELECT 'quantas demandas',
  COALESCE((SELECT count(*)::text FROM public.demandas), '—'),
  '~537'
UNION ALL
SELECT 'quantas OS',
  COALESCE((SELECT count(*)::text FROM public.ordens_servico), '—'),
  '(o que você já tinha)';
