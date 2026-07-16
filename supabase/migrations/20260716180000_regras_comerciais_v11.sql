-- Regras comerciais v11 (planilha base_de_dados v10/v11 + instruções do usuário em 2026-07-16).
-- ATENÇÃO: rodar manualmente no SQL Editor do Supabase (migrações não são aplicadas
-- automaticamente pela Lovable neste setup).

-- 1) Markup padrão único: venda = custo × 1,5 para TODOS os equipamentos.
UPDATE public.equipamentos SET markup = 1.5;

-- 2) Corrige mensalidades das I.As (presença e ausência estavam trocadas no seed antigo).
UPDATE public.servicos SET preco_unitario_mensal = 170 WHERE code = 'SV030'; -- Leitura de Placas (LPR)
UPDATE public.servicos SET preco_unitario_mensal = 190 WHERE code = 'SV031'; -- Detecção de presença
UPDATE public.servicos SET preco_unitario_mensal = 110 WHERE code = 'SV032'; -- Detecção de ausência
UPDATE public.servicos SET preco_unitario_mensal = 190 WHERE code = 'SV033'; -- Detecção de movimento

-- 3) Smart Sampa por câmera no fluxo CFTV (botão igual às I.As).
--    Valor assumido: R$ 100/mês (mesmo delta da tabela de totem) — ajustar se necessário.
INSERT INTO public.servicos (code, nome, cat, preco_unitario_mensal, ativo_padrao, ordem)
SELECT 'SV034', 'Smart Sampa (conexão por câmera)', 'ia', 100.00, false, 34
WHERE NOT EXISTS (SELECT 1 FROM public.servicos s WHERE s.code = 'SV034');

-- 4) Novos campos de complementos do projeto (página pós-blocos):
--    redundância energética, fornecimento do link de internet, gerador e app Prever Acessos.
ALTER TABLE public.visita_orcamentos
  ADD COLUMN IF NOT EXISTS redundancia_energetica boolean,
  ADD COLUMN IF NOT EXISTS link_internet_fornecimento text, -- 'prever' | 'cliente'
  ADD COLUMN IF NOT EXISTS possui_gerador boolean,
  ADD COLUMN IF NOT EXISTS app_prever_acessos boolean;
