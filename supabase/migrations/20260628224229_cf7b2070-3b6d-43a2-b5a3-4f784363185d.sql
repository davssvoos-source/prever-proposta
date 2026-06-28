DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'visita_orcamentos'
      AND n.nspname = 'public'
      AND c.contype = 'c'
  ) LOOP
    EXECUTE 'ALTER TABLE public.visita_orcamentos DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;