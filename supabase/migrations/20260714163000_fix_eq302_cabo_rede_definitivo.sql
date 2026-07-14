-- Correção definitiva: CFTV e Alarme estavam exibindo "Poste de Monitoramento"
-- ao adicionar cabeamento (EQ302). A migração anterior (20260712120000) só
-- renomeava o poste de EQ302→EQ303 sob condição — se não bateu (nome diferente
-- do esperado, ordem de execução, etc.), EQ302 continuou sendo o poste e o
-- cabo de rede nunca foi criado/corrigido. Esta migração é idempotente e
-- resolve os 3 estados possíveis sem depender do estado anterior.

DO $$
BEGIN
  -- 1) Se EQ302 ainda é o poste, libera o código
  IF EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ302' AND nome ILIKE '%poste%') THEN
    IF EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ303') THEN
      -- EQ303 já existe (poste correto) → remove o duplicado em EQ302
      DELETE FROM public.equipamentos WHERE code = 'EQ302' AND nome ILIKE '%poste%';
    ELSE
      UPDATE public.equipamentos SET code = 'EQ303' WHERE code = 'EQ302' AND nome ILIKE '%poste%';
    END IF;
  END IF;
END $$;

-- 2) Qualquer item de bloco já salvo como poste sob o código errado
UPDATE public.visita_bloco_itens
SET cod_eq = 'EQ303'
WHERE cod_eq = 'EQ302'
  AND EXISTS (
    SELECT 1 FROM public.equipamentos e WHERE e.code = 'EQ303' AND e.nome ILIKE '%poste%'
  );

-- 3) Garante EQ302 = Cabo de rede (cria se faltar, corrige nome/modelo se divergente)
INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
VALUES ('EQ302', 'Cabo de rede', 'rede', 'cabeamento', 'Intelbras', 'CAT5-E', 'un', 620.40, 1.389, 'PortSeg')
ON CONFLICT (code) DO UPDATE SET
  nome = EXCLUDED.nome,
  cat = EXCLUDED.cat,
  subcat = EXCLUDED.subcat,
  marca = EXCLUDED.marca,
  un = EXCLUDED.un,
  fornecedor = EXCLUDED.fornecedor
WHERE public.equipamentos.nome ILIKE '%poste%' OR public.equipamentos.nome IS DISTINCT FROM 'Cabo de rede';
