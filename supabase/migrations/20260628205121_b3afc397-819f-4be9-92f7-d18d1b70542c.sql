DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = 'visitas_tecnicas' AND c.contype = 'c') LOOP
    EXECUTE 'ALTER TABLE visitas_tecnicas DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;