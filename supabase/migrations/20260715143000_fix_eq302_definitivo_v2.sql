-- 3ª tentativa de corrigir EQ302 aparecendo como "Poste 2,6m" (deveria ser
-- "Cabo de rede"). As duas migrações anteriores (20260712120000 e
-- 20260714163000) não surtiram efeito no banco ao vivo — o sintoma persistiu
-- idêntico. Esta versão não usa nenhuma cláusula WHERE condicional no UPDATE
-- final: sobrescreve EQ302 incondicionalmente sempre que rodar.

DO $$
DECLARE
  poste_correto_existe boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.equipamentos WHERE code <> 'EQ302' AND nome ILIKE '%poste%'
  ) INTO poste_correto_existe;

  IF poste_correto_existe THEN
    -- Já existe um "poste" correto em outro código — a linha em EQ302 é duplicata.
    DELETE FROM public.equipamentos WHERE code = 'EQ302' AND nome ILIKE '%poste%';
  ELSE
    UPDATE public.equipamentos SET code = 'EQ303' WHERE code = 'EQ302' AND nome ILIKE '%poste%';
  END IF;
END $$;

-- Garante EQ302 = Cabo de rede, incondicionalmente (sem WHERE de guarda).
INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
VALUES ('EQ302', 'Cabo de rede', 'rede', 'cabeamento', 'Intelbras', 'CAT5-E', 'un', 620.40, 1.389, 'PortSeg')
ON CONFLICT (code) DO UPDATE SET
  nome = 'Cabo de rede',
  cat = 'rede',
  subcat = 'cabeamento',
  marca = 'Intelbras',
  un = 'un',
  fornecedor = 'PortSeg';
