-- Correções da reunião com os técnicos (2026-07-17).
-- Rodar no SQL Editor da Lovable (Cloud → SQL editor) — mesmo banco do app.
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.

-- 1) Observação por bloco (nuances para a implantação)
ALTER TABLE public.visita_blocos ADD COLUMN IF NOT EXISTS observacao text;

-- 2) Molas aéreas por peso da porta (marca Intelbras, fornecedor Bellfone)
UPDATE public.equipamentos
SET nome = 'Mola Aérea p/ Porta (até 45Kg)', modelo = 'MH 102 A Preta',
    marca = 'Intelbras', fornecedor = 'Bellfone', custo = 125.87
WHERE code = 'EQ029';

UPDATE public.equipamentos
SET nome = 'Mola Aérea p/ Porta (até 65Kg)', modelo = 'MH 103 A Preta',
    marca = 'Intelbras', fornecedor = 'Bellfone', custo = 167.28
WHERE code = 'EQ030';

INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
VALUES ('EQ304', 'Mola Aérea p/ Porta (até 85Kg)', 'controle_acesso', 'acessorio',
        'Intelbras', 'MH 104 A Preta', 'un', 195.12, 1.5, 'Bellfone')
ON CONFLICT (code) DO UPDATE
SET nome = excluded.nome, custo = excluded.custo, marca = excluded.marca, fornecedor = excluded.fornecedor;

-- 3) Fechadura Magnética 300Kgf FE10300 (PR + portão veicular; 1 por PORV, 1 por eclusa)
UPDATE public.equipamentos
SET nome = 'Fechadura Magnética 300Kgf', marca = 'Intelbras',
    fornecedor = 'Bellfone', custo = 726.57
WHERE code = 'EQ204';

-- 4) Interfone XPE (elevador em Portaria Presencial — 1 a cada 2 elevadores)
--    ⚠ CUSTO PENDENTE: cadastrado com custo 0 até o usuário informar o valor real.
INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
VALUES ('EQ305', 'Interfone XPE', 'controle_acesso', 'interfonia',
        'Intelbras', 'XPE', 'un', 0, 1.5, 'Bellfone')
ON CONFLICT (code) DO NOTHING;
