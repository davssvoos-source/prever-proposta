
-- 1) Dedupe existing CENT blocks per visita, keeping the oldest (ties broken by id)
WITH ranked AS (
  SELECT id, visita_id,
    ROW_NUMBER() OVER (PARTITION BY visita_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.visita_blocos
  WHERE tipo_bloco = 'CENT'
)
DELETE FROM public.visita_blocos vb
USING ranked r
WHERE vb.id = r.id AND r.rn > 1;

-- 2) Enforce uniqueness: at most 1 CENT block per visita
CREATE UNIQUE INDEX IF NOT EXISTS visita_blocos_one_cent_per_visita
  ON public.visita_blocos (visita_id)
  WHERE tipo_bloco = 'CENT';
