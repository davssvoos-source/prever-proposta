-- CFTV: cabeamento vira equipamento (EQ302 — Cabo de rede) e I.As viram serviços mensais (SV030–SV033).
-- Planilha v9 é a fonte da verdade: EQ302 = Cabo de rede; o Poste de Monitoramento (Totem) passa a EQ303.

-- 1) Conflito de código: se EQ302 estiver ocupado pelo Poste de Monitoramento, move para EQ303
UPDATE public.equipamentos
SET code = 'EQ303'
WHERE code = 'EQ302'
  AND nome ILIKE '%poste%'
  AND NOT EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ303');

-- Itens de blocos já salvos que referenciavam o poste como EQ302 (todos os EQ302 pré-existentes são do Totem)
UPDATE public.visita_bloco_itens
SET cod_eq = 'EQ303'
WHERE cod_eq = 'EQ302';

-- 2) Cabo de rede (1 un = caixa de 300 m) — dados da planilha v9
INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
SELECT 'EQ302', 'Cabo de rede', 'rede', 'cabeamento', 'Intelbras', 'CAT5-E', 'un', 620.40, 1.389, 'PortSeg'
WHERE NOT EXISTS (SELECT 1 FROM public.equipamentos WHERE code = 'EQ302');

-- 3) Serviços mensais de I.A por câmera (CFTV)
INSERT INTO public.servicos (code, nome, cat, preco_unitario_mensal, ativo_padrao, ordem)
SELECT v.code, v.nome, 'ia', v.preco, false, v.ordem
FROM (VALUES
  ('SV030', 'I.A — Leitura de Placas (LPR)', 170.00, 30),
  ('SV031', 'I.A — Detecção de presença',    110.00, 31),
  ('SV032', 'I.A — Detecção de ausência',    190.00, 32),
  ('SV033', 'I.A — Detecção de movimento',   190.00, 33)
) AS v(code, nome, preco, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.servicos s WHERE s.code = v.code);
