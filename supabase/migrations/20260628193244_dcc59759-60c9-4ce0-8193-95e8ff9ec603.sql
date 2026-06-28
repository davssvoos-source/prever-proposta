-- Limpa valores antigos que violariam o novo constraint
UPDATE clientes
SET tipo_empreendimento = NULL
WHERE tipo_empreendimento IS NOT NULL
  AND tipo_empreendimento NOT IN ('residencial','comercial','industrial','misto','outro');

-- Remove constraint problemática se existir
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_empreendimento_check;

-- Adiciona colunas que o formulário precisa e que podem estar faltando
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_empreendimento text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nome_predio text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_local text;

-- Recria constraint com os valores corretos (lowercase, conforme o form envia)
ALTER TABLE clientes ADD CONSTRAINT clientes_tipo_empreendimento_check
  CHECK (tipo_empreendimento IN ('residencial','comercial','industrial','misto','outro'));