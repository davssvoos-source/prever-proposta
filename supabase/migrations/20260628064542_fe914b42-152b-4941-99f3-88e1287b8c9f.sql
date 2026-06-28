
CREATE TABLE IF NOT EXISTS public.visita_orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid UNIQUE REFERENCES public.visitas_tecnicas(id) ON DELETE CASCADE,
  qtd_apartamentos int,
  sistema_atual text CHECK (sistema_atual IS NULL OR sistema_atual IN (
    'portaria_presencial','portaria_remota','autonoma','interfone','sem_sistema','outro'
  )),
  servicos_ofertados text[] DEFAULT '{}',
  blocos_selecionados jsonb DEFAULT '{}'::jsonb,
  itens_variaveis jsonb DEFAULT '{}'::jsonb,
  fornecimento boolean DEFAULT true,
  valor_hora_hh numeric DEFAULT 120,
  obs_tecnico text,
  step_atual int DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_orcamentos TO authenticated;
GRANT ALL ON public.visita_orcamentos TO service_role;

ALTER TABLE public.visita_orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view orcamentos" ON public.visita_orcamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert orcamentos" ON public.visita_orcamentos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update orcamentos" ON public.visita_orcamentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete orcamentos" ON public.visita_orcamentos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_visita_orcamentos_updated
  BEFORE UPDATE ON public.visita_orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
