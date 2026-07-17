-- Correções dos técnicos — 2ª rodada (2026-07-17).
-- Rodar no SQL Editor da Lovable (Cloud → SQL editor). Idempotente.

-- 8) Custo do Poste de Monitoramento 2,6 m (Totem Inteligente)
UPDATE public.equipamentos SET custo = 1390.00 WHERE code = 'EQ303';

-- 7) Switch do Kit Antena de elevadores: TL-SF1005D (substitui o SF 500 HI-POE na automação)
INSERT INTO public.equipamentos (code, nome, cat, subcat, marca, modelo, un, custo, markup, fornecedor)
VALUES ('EQ307', 'Switch 4 Portas', 'infraestrutura', 'switch',
        'TP-LINK', 'TL-SF1005D', 'un', 60.00, 1.5, 'ML')
ON CONFLICT (code) DO UPDATE
SET nome = excluded.nome, modelo = excluded.modelo, custo = excluded.custo,
    marca = excluded.marca, fornecedor = excluded.fornecedor;
