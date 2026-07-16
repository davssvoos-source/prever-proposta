-- Regras comerciais v11 (planilha base_de_dados v10/v11 + instruções do usuário em 2026-07-16).
-- ATENÇÃO: rodar manualmente no SQL Editor do Supabase (migrações não são aplicadas
-- automaticamente pela Lovable neste setup).

-- 1) Markup padrão único: venda = custo × 1,5 para TODOS os equipamentos.
UPDATE public.equipamentos SET markup = 1.5;

-- 1b) DEFENSIVO: a coluna "ordem" já existe no CREATE TABLE original
--     (20260628044253), mas o erro 42703 ao rodar este script mostrou que o
--     banco ao vivo não tem essa coluna — ou seja, aquela migration (e a de
--     12/07 que inseria SV030-033) nunca rodaram de fato. Garante a coluna
--     antes de usá-la abaixo.
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS ordem int NOT NULL DEFAULT 0;

-- 2) Garante que as I.As (SV030-033) existem com os preços corretos —
--    upsert em vez de UPDATE porque, pelo motivo acima, é possível que essas
--    linhas nunca tenham sido inseridas (presença e ausência também estavam
--    trocadas no seed antigo).
INSERT INTO public.servicos (code, nome, cat, preco_unitario_mensal, ativo_padrao, ordem) VALUES
  ('SV030', 'I.A — Leitura de Placas (LPR)', 'ia', 170.00, false, 30),
  ('SV031', 'I.A — Detecção de presença',    'ia', 190.00, false, 31),
  ('SV032', 'I.A — Detecção de ausência',    'ia', 110.00, false, 32),
  ('SV033', 'I.A — Detecção de movimento',   'ia', 190.00, false, 33)
ON CONFLICT (code) DO UPDATE SET preco_unitario_mensal = excluded.preco_unitario_mensal;

-- 3) Smart Sampa por câmera no fluxo CFTV (botão igual às I.As).
--    Valor assumido: R$ 100/mês (mesmo delta da tabela de totem) — ajustar se necessário.
INSERT INTO public.servicos (code, nome, cat, preco_unitario_mensal, ativo_padrao, ordem)
VALUES ('SV034', 'Smart Sampa (conexão por câmera)', 'ia', 100.00, false, 34)
ON CONFLICT (code) DO NOTHING;

-- 4) Novos campos de complementos do projeto (página pós-blocos):
--    redundância energética, fornecimento do link de internet, gerador e app Prever Acessos.
ALTER TABLE public.visita_orcamentos
  ADD COLUMN IF NOT EXISTS redundancia_energetica boolean,
  ADD COLUMN IF NOT EXISTS link_internet_fornecimento text, -- 'prever' | 'cliente'
  ADD COLUMN IF NOT EXISTS possui_gerador boolean,
  ADD COLUMN IF NOT EXISTS app_prever_acessos boolean;
