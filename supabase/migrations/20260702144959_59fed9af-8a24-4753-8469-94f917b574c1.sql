INSERT INTO public.equipamentos (code, nome, cat, marca, modelo, un, custo, markup, fornecedor) VALUES
  ('ELV_KIT_SWITCH',   'Switch POE 4P p/ elevadores',        'Elevador', 'Intelbras', 'POE SF 500 HI-POE',  'un', 0, 1.389, 'Bellfone'),
  ('ELV_KIT_ROTEADOR', 'Roteador Wi-Fi p/ elevadores',       'Elevador', 'Intelbras', 'W4-300S',            'un', 0, 1.389, 'Bellfone'),
  ('ELV_KIT_ANTENA',   'Antena Transmissora p/ elevadores',  'Elevador', 'Intelbras', 'Wom 5a',             'un', 0, 1.389, 'Bellfone'),
  ('ELV_KIT_SUPORTE',  'Suporte p/ IVA p/ elevadores',       'Elevador', 'ConfiSeg',  '40 cm',              'un', 0, 1.389, 'Bellfone'),
  ('ELV_KIT_TELEFONE', 'Telefone IP POE p/ elevadores',      'Elevador', 'Intelbras', 'TDMI 400 IP POE',    'un', 0, 1.389, 'Bellfone'),
  ('ELV_KIT_CAMERA',   'Câmera IP Dome p/ elevadores',       'Elevador', 'Intelbras', 'VIP 1230 D G4',      'un', 0, 1.389, 'Bellfone'),
  ('ELV_KIT_FILTRO',   'Filtro de Linha p/ elevadores',      'Elevador', 'Intelbras', '5 Tomadas',          'un', 0, 1.389, 'Bellfone')
ON CONFLICT (code) DO NOTHING;