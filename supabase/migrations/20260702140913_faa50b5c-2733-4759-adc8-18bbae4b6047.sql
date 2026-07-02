
-- 1) Cadastro dos equipamentos Intelbras da linha de alarme (com fio + sem fio)
-- Custo = preco / 1.389 (markup padrão)
INSERT INTO public.equipamentos (code, nome, marca, modelo, un, custo, markup) VALUES
  ('ALM_AMT4010',   'Central de alarme com fio',        'Intelbras', 'AMT 4010 Smart',           'un', 321.92/1.389, 1.389),
  ('ALM_AMT8000',   'Central de alarme sem fio',        'Intelbras', 'AMT 8000',                 'un', 628.01/1.389, 1.389),
  ('ALM_XB1270',    'Bateria selada 12V 7Ah',           'Intelbras', 'XB 1270',                  'un', 101.70/1.389, 1.389),
  ('ALM_SIRMOREY',  'Sirene 12V',                       'Morey',     'Sirene 12V Morey',         'un',  12.95/1.389, 1.389),
  ('ALM_XAT4000',   'Teclado LCD com fio',              'Intelbras', 'XAT 4000 Smart',           'un', 210.43/1.389, 1.389),
  ('ALM_XEG4000',   'Módulo GPRS/Ethernet',             'Intelbras', 'XEG 4000 Smart',           'un', 300.12/1.389, 1.389),
  ('ALM_XEP4004',   'Expansor de PGM (+4)',             'Intelbras', 'XEP 4004 Smart',           'un', 206.98/1.389, 1.389),
  ('ALM_XEZ4108',   'Expansor de zonas (+8)',           'Intelbras', 'XEZ 4108 Smart',           'un', 241.63/1.389, 1.389),
  ('ALM_XAR4000',   'Receptor sem fio',                 'Intelbras', 'XAR 4000 Smart',           'un',  64.23/1.389, 1.389),
  ('ALM_IVA7100D',  'Barreira IVA 100m 2 feixes',       'Intelbras', 'IVA 7100 Dual',            'un', 268.65/1.389, 1.389),
  ('ALM_IVA7100Q',  'Barreira IVA 100m 4 feixes',       'Intelbras', 'IVA 7100 Quad',            'un', 395.48/1.389, 1.389),
  ('ALM_IVA7100H',  'Barreira IVA 100m 6 feixes',       'Intelbras', 'IVA 7100 Hexa',            'un', 499.95/1.389, 1.389),
  ('ALM_IVA7100O',  'Barreira IVA 100m 8 feixes',       'Intelbras', 'IVA 7100 Octa',            'un', 577.79/1.389, 1.389),
  ('ALM_IVP5001',   'Sensor IVP interno PET',           'Intelbras', 'IVP 5001 PET',             'un',  57.83/1.389, 1.389),
  ('ALM_IVP5311',   'Sensor IVP interno micro-ondas',   'Intelbras', 'IVP 5311 MW PET',          'un', 126.74/1.389, 1.389),
  ('ALM_IVP3000',   'Sensor IVP externo MW PET',        'Intelbras', 'IVP 3000 MW EX',           'un', 459.30/1.389, 1.389),
  ('ALM_IVP7001',   'Sensor IVP externo MW PET',        'Intelbras', 'IVP 7001 MW EX',           'un', 200.64/1.389, 1.389),
  ('ALM_XAS4010',   'Sensor magnético sem fio',         'Intelbras', 'XAS 4010 Smart',           'un',  36.00/1.389, 1.389),
  ('ALM_XASSOBP',   'Sensor magnético sobrepor (pct 5)','Intelbras', 'XAS Sobrepor Pacote 5',    'pct',  65.45/1.389, 1.389),
  ('ALM_XASPAM',    'Sensor magnético porta aço mini',  'Intelbras', 'XAS Porta de Aço Mini',    'un',  50.77/1.389, 1.389),
  ('ALM_XASPAN',    'Sensor magnético porta aço normal','Intelbras', 'XAS Porta de Aço Normal',  'un',  60.07/1.389, 1.389),
  ('ALM_XSS8000',   'Sirene sem fio',                   'Intelbras', 'XSS 8000',                 'un', 229.63/1.389, 1.389),
  ('ALM_XAT8000',   'Teclado sem fio',                  'Intelbras', 'XAT 8000',                 'un', 313.29/1.389, 1.389),
  ('ALM_XAG8000',   'Módulo GPRS sem fio',              'Intelbras', 'XAG 8000',                 'un', 233.31/1.389, 1.389),
  ('ALM_PGM8000',   'Atuador PGM sem fio',              'Intelbras', 'PGM 8000',                 'un', 147.60/1.389, 1.389),
  ('ALM_REP8000',   'Amplificador de alcance',          'Intelbras', 'REP 8000',                 'un', 284.76/1.389, 1.389),
  ('ALM_FXO8000',   'Módulo linha telefônica',          'Intelbras', 'FXO 8000',                 'un', 119.91/1.389, 1.389),
  ('ALM_XAC8000',   'Controle remoto sem fio',          'Intelbras', 'XAC 8000',                 'un',  81.18/1.389, 1.389),
  ('ALM_IVP8000P',  'Sensor IVP sem fio PET',           'Intelbras', 'IVP 8000 PET',             'un', 138.69/1.389, 1.389),
  ('ALM_IVP8000C',  'Sensor IVP sem fio PET com câmera','Intelbras', 'IVP 8000 PET CAM',         'un', 506.61/1.389, 1.389),
  ('ALM_IVP8000E',  'Sensor IVP externo sem fio',       'Intelbras', 'IVP 8000 EX',              'un', 373.41/1.389, 1.389),
  ('ALM_XAS8000',   'Sensor magnético sem fio',         'Intelbras', 'XAS 8000',                 'un', 111.42/1.389, 1.389)
ON CONFLICT (code) DO NOTHING;

-- 2) Coluna JSONB para persistir toda a configuração do wizard de alarme
ALTER TABLE public.visita_blocos
  ADD COLUMN IF NOT EXISTS alarme_config jsonb;
