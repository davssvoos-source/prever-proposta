-- Excluir visita técnica: a policy antiga só aceitava admins registrados na
-- tabela user_roles (has_role). O restante do app identifica admin por
-- profiles.cargo = 'admin' — mesmo padrão das policies de select/update desta
-- tabela. Alinha a policy de DELETE para aceitar os dois caminhos.

DROP POLICY IF EXISTS "visitas_delete" ON public.visitas_tecnicas;
CREATE POLICY "visitas_delete" ON public.visitas_tecnicas
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.cargo = 'admin'
    )
  );
