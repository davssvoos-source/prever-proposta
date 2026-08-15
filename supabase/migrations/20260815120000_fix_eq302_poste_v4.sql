-- 4ª correção do EQ302 exibido como "Poste de Monitoramento 2,6m" em todo
-- bloco (deveria ser "Cabo de rede"). As 3 tentativas anteriores
-- (20260712120000 / 20260714163000 / 20260715143000) não surtiram efeito no
-- banco ao vivo — o canal de aplicação é o SQL Editor da Lovable e elas
-- aparentemente nunca foram executadas lá.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> O resultado do SELECT final DEVE mostrar EQ302 = Cabo de rede,      <<<
-- >>> EQ303 = Poste, e os dois contadores de itens zerados.               <<<
--
-- Sintoma: todo bloco (acesso, CFTV, totem…) adiciona cabeamento EQ302; como a
-- linha EQ302 da tabela `equipamentos` ainda é o Poste 2,6m, o escopo/proposta
-- mostra um "poste/totem 2,6m" em todos os blocos.
-- Passos em DO blocks independentes: um erro num passo não desfaz os demais.
-- (RAISE NOTICE não aparece no SQL editor — a verificação final é o que vale.)

-- 1) Se EQ302 é o poste/totem: move para EQ303 (ou remove a duplicata se o
--    poste já existe em EQ303). Só mexe quando EQ303 é comprovadamente o poste.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.equipamentos
    WHERE code = 'EQ302' AND (nome ILIKE '%poste%' OR nome ILIKE '%totem%')
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.equipamentos
      WHERE code = 'EQ303' AND (nome ILIKE '%poste%' OR nome ILIKE '%totem%')
    ) THEN
      DELETE FROM public.equipamentos WHERE code = 'EQ302';
    ELSIF NOT EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ303') THEN
      UPDATE public.equipamentos SET code = 'EQ303' WHERE code = 'EQ302';
    END IF;
    -- EQ303 ocupado por algo que NÃO é poste: estado anômalo — não tocar.
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fix EQ302 v4 — passo 1 falhou: %', SQLERRM;
END $$;

-- 2a) Itens antigos de blocos TOT que apontavam o poste como EQ302 → EQ303.
--     (As linhas de cabo legítimas têm observação contendo "cabo"; as do poste, não.)
DO $$
BEGIN
  UPDATE public.visita_bloco_itens i
  SET cod_eq = 'EQ303'
  FROM public.visita_blocos b
  WHERE i.visita_bloco_id = b.id
    AND b.tipo_bloco = 'TOT'
    AND i.cod_eq = 'EQ302'
    AND (i.observacao IS NULL OR i.observacao NOT ILIKE '%cabo%');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fix EQ302 v4 — passo 2a falhou: %', SQLERRM;
END $$;

-- 2b) Reparo inverso: as migrations antigas (0712/0714) viravam TODO EQ302 de
--     itens para EQ303, inclusive cabos legítimos. Se alguma rodou parcialmente,
--     itens de cabo ficaram presos em EQ303 — volta para EQ302.
DO $$
BEGIN
  UPDATE public.visita_bloco_itens
  SET cod_eq = 'EQ302'
  WHERE cod_eq = 'EQ303' AND observacao ILIKE '%cabo%';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fix EQ302 v4 — passo 2b falhou: %', SQLERRM;
END $$;

-- 3) Garante EQ302 = Cabo de rede. No UPDATE não toca em `modelo` (UNIQUE) nem
--    em `custo`, e só normaliza se a linha já parece o cabo (não mascara uma
--    linha anômala como cabo). markup = 1.5 (regra comercial v11).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ302') THEN
    UPDATE public.equipamentos
    SET nome = 'Cabo de rede', cat = 'rede', subcat = 'cabeamento',
        marca = 'Intelbras', un = 'un', fornecedor = 'PortSeg', markup = 1.5
    WHERE code = 'EQ302'
      AND (nome ILIKE '%cabo%' OR modelo ILIKE '%CAT5%' OR modelo ILIKE '%CAT 5%');
  ELSE
    INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
    VALUES ('EQ302', 'Cabo de rede', 'rede', 'cabeamento', 'Intelbras', 'CAT5-E', 'un', 620.40, 1.5, 'PortSeg');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fix EQ302 v4 — passo 3 falhou: %', SQLERRM;
END $$;

-- 4) Garante EQ303 = Poste de Monitoramento 2,6m (custo 1.390 — correção dos
--    técnicos de 2026-07-17; markup 1.5 — regra v11). Só ajusta custo se a
--    linha EQ303 for mesmo o poste.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ303') THEN
    INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
    VALUES ('EQ303', 'Poste de Monitoramento 2,6m', 'totem', 'estrutura', 'Prever', 'Poste 2,6 m', 'un', 1390.00, 1.5, 'Prever');
  ELSE
    UPDATE public.equipamentos
    SET custo = 1390.00, markup = 1.5
    WHERE code = 'EQ303'
      AND (nome ILIKE '%poste%' OR nome ILIKE '%totem%')
      AND (custo <> 1390.00 OR markup <> 1.5);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fix EQ302 v4 — passo 4 falhou: %', SQLERRM;
END $$;

-- Verificação final (o SQL editor mostra só o último resultado — este SELECT
-- cobre TODOS os passos). Esperado:
--   equip EQ302 → Cabo de rede | CAT5-E
--   equip EQ303 → Poste de Monitoramento 2,6m | Poste 2,6 m
--   itens TOT ainda com poste como EQ302 → 0
--   itens de cabo presos em EQ303        → 0
SELECT 'equip ' || code AS verificacao,
       nome || ' | modelo=' || modelo || ' | custo=' || custo || ' | markup=' || markup AS resultado
FROM public.equipamentos
WHERE code IN ('EQ302', 'EQ303')
UNION ALL
SELECT 'itens TOT ainda com poste como EQ302',
       count(*)::text
FROM public.visita_bloco_itens i
JOIN public.visita_blocos b ON b.id = i.visita_bloco_id
WHERE b.tipo_bloco = 'TOT' AND i.cod_eq = 'EQ302'
  AND (i.observacao IS NULL OR i.observacao NOT ILIKE '%cabo%')
UNION ALL
SELECT 'itens de cabo presos em EQ303',
       count(*)::text
FROM public.visita_bloco_itens
WHERE cod_eq = 'EQ303' AND observacao ILIKE '%cabo%';
