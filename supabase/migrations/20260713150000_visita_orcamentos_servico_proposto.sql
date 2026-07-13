-- Residência/Galpão: 1ª tela do orçamento vira seleção de SERVIÇO PROPOSTO
-- (monitoramento_24h | implantacao_sistema), sem qtd de apartamentos/sistema/airbnb.
ALTER TABLE public.visita_orcamentos
  ADD COLUMN IF NOT EXISTS servico_proposto text;
