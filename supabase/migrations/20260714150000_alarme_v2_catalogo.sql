-- Alarme v2 — itens do fluxo de zonas (com fio / sem fio).
-- Política: só CRIA os que faltam; itens existentes (AMT 4010/8000, bateria,
-- XEG 4000, XAG 8000, XAR 4000, XAS 8000, XAS Sobrepor, XAS aço mini,
-- REP 8000, IVP 5311) permanecem intocados.
-- Preços da lista = VENDA; custo = venda / markup (1,389). Marca Intelbras,
-- fornecedor Bellfone.

INSERT INTO public.equipamentos (code, nome, cat, marca, modelo, un, custo, markup, fornecedor)
SELECT v.code, v.nome, 'Alarme', 'Intelbras', v.modelo, v.un, v.venda / 1.389, 1.389, 'Bellfone'
FROM (VALUES
  ('ALM_IVP7000',     'Sensor IVP externo MW',                 'IVP 7000 MW EX',            'un', 303.07),
  ('ALM_IVP4101',     'Sensor IVP interno sem fio',            'IVP 4101 PET Smart',        'un', 136.90),
  ('ALM_IVP8000EXG2', 'Sensor IVP externo sem fio',            'IVP 8000 EX G2',            'un', 398.30),
  ('ALM_IVA5040',     'Sensor de barreira IVA (par, até 40m)', 'IVA 5040 AT',               'un', 147.45),
  ('ALM_IVA5080',     'Sensor de barreira IVA (par, até 80m)', 'IVA 5080 AT',               'un', 205.36),
  ('ALM_IVA8040',     'Sensor de barreira IVA sem fio (par)',  'IVA 8040 AT',               'un', 911.89),
  ('ALM_XASPAS',      'Sensor porta de aço c/ suporte',        'XAS Porta de Aço c/ Sup.',  'un',  85.32),
  ('ALM_TX8000',      'Transmissor universal',                 'TX 8000',                   'un',  94.46),
  ('ALM_TX4020',      'Transmissor universal',                 'TX 4020 Smart',             'un',  94.46),
  ('ALM_XEZ4008',     'Expansor de zonas',                     'XEZ 4008 Smart',            'un', 242.40)
) AS v(code, nome, modelo, un, venda)
WHERE NOT EXISTS (SELECT 1 FROM public.equipamentos e WHERE e.code = v.code);
