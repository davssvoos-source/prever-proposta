-- Repara blocos "Central de Portaria Remota" (CENT) já existentes que foram
-- semeados com o item errado (EQ028 — Sensor de Porta Aberta PA 110) e por isso
-- mostravam apenas 1 item incorreto no resumo. Insere a lista correta da central
-- (mesma de computeCentral) e remove o EQ028. Idempotente.

-- 1) Insere a lista real da central nos blocos CENT que ainda não a têm.
INSERT INTO public.visita_bloco_itens (visita_bloco_id, cod_eq, qtd, origem, observacao)
SELECT b.id, v.cod_eq, v.qtd, 'auto', v.obs
FROM public.visita_blocos b
CROSS JOIN (VALUES
  ('EQ001', 1, 'Roteador Firewall — DrayTek Vigor 2915'),
  ('EQ002', 1, 'ATA PABX — Grandstream HT813'),
  ('EQ189', 1, 'Rack Armário 12U'),
  ('EQ190', 2, 'Rack Bandeja (2 unidades)'),
  ('EQ191', 1, 'Calha 8 Tomadas para Rack'),
  ('EQ192', 1, 'Caixa Comando Portaria Remota 80x60'),
  ('EQ193', 1, 'Caixa Rack para Relês'),
  ('EQ099', 1, 'Central de Alarme AMT 4010'),
  ('EQ100', 1, 'Sirene 12v'),
  ('EQ102', 1, 'Módulo GPRS XEG 4000'),
  ('EQ103', 4, 'Expansor de PGM XEP 4004 (4 un)'),
  ('EQ023', 1, 'Botão de Emergência'),
  ('EQ024', 1, 'GiroFlex 12v')
) AS v(cod_eq, qtd, obs)
WHERE b.tipo_bloco = 'CENT'
  AND NOT EXISTS (
    SELECT 1 FROM public.visita_bloco_itens i
    WHERE i.visita_bloco_id = b.id AND i.cod_eq = v.cod_eq
  );

-- 2) Remove o item errado (EQ028) semeado nos blocos CENT.
DELETE FROM public.visita_bloco_itens
WHERE origem = 'auto'
  AND cod_eq = 'EQ028'
  AND visita_bloco_id IN (SELECT id FROM public.visita_blocos WHERE tipo_bloco = 'CENT');
