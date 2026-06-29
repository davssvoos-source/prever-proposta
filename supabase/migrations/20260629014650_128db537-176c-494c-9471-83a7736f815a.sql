
-- Add visita_id column to notificacoes
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS visita_id uuid REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notificacoes_user_id_created_at_idx
  ON public.notificacoes (user_id, created_at DESC);

-- Enable realtime
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger A: visita atribuída
CREATE OR REPLACE FUNCTION public.notify_visita_atribuida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NEW.tecnico_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'UPDATE' AND NEW.tecnico_id IS NOT DISTINCT FROM OLD.tecnico_id) THEN
    RETURN NEW;
  END IF;
  v_nome := COALESCE(NEW.nome_predio, NEW.titulo, 'local não informado');
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, visita_id)
  VALUES (
    NEW.tecnico_id,
    'visita_atribuida',
    'Nova visita atribuída',
    'Você foi atribuído à visita técnica de ' || v_nome,
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_visita_atribuida_ins ON public.visitas_tecnicas;
CREATE TRIGGER trg_notify_visita_atribuida_ins
  AFTER INSERT ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.notify_visita_atribuida();

DROP TRIGGER IF EXISTS trg_notify_visita_atribuida_upd ON public.visitas_tecnicas;
CREATE TRIGGER trg_notify_visita_atribuida_upd
  AFTER UPDATE OF tecnico_id ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.notify_visita_atribuida();

-- Trigger B: visita aprovada
CREATE OR REPLACE FUNCTION public.notify_visita_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NEW.tecnico_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF upper(COALESCE(NEW.status,'')) <> 'APROVADA' THEN
    RETURN NEW;
  END IF;
  IF upper(COALESCE(OLD.status,'')) = 'APROVADA' THEN
    RETURN NEW;
  END IF;
  v_nome := COALESCE(NEW.nome_predio, NEW.titulo, 'local não informado');
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, visita_id)
  VALUES (
    NEW.tecnico_id,
    'visita_aprovada',
    'Visita aprovada',
    'Sua visita técnica em ' || v_nome || ' foi aprovada!',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_visita_aprovada ON public.visitas_tecnicas;
CREATE TRIGGER trg_notify_visita_aprovada
  AFTER UPDATE OF status ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.notify_visita_aprovada();
