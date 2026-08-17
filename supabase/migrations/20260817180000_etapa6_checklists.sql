-- ETAPA 6 do sistema de Ordens de Serviço — Preventiva e Implantação.
-- Referência: docs/SISTEMA_OS.md §5.4 e §5.5.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Cria:
--   os_checklist_templates — roteiro de verificação por tipo de sistema, usado
--                            para montar a preventiva (editável por vocês)
--   os_checklist           — os itens da OS, marcados um a um pelo técnico
--
-- Os itens iniciais são uma primeira versão para ajustar com os técnicos:
--   UPDATE public.os_checklist_templates SET item = '...' WHERE id = '...';
--   INSERT INTO public.os_checklist_templates (tipo_sistema, item, ordem) VALUES (...);
--   DELETE FROM public.os_checklist_templates WHERE ...;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) MODELOS DE CHECKLIST
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.os_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- tipo de sistema (mesma taxonomia de cliente_sistemas) ou 'GERAL'
  tipo_sistema text NOT NULL,
  item text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS os_checklist_templates_unico
  ON public.os_checklist_templates (tipo_sistema, item);

GRANT SELECT ON public.os_checklist_templates TO authenticated;
GRANT ALL ON public.os_checklist_templates TO service_role;
ALTER TABLE public.os_checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "os_checklist_templates_select" ON public.os_checklist_templates;
CREATE POLICY "os_checklist_templates_select" ON public.os_checklist_templates
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.os_checklist_templates (tipo_sistema, item, ordem) VALUES
  -- Geral (entra em toda preventiva)
  ('GERAL', 'Conferir alimentação elétrica e disjuntores do rack', 1),
  ('GERAL', 'Verificar nobreak e baterias (autonomia e alarmes)', 2),
  ('GERAL', 'Limpar rack e conferir organização do cabeamento', 3),
  ('GERAL', 'Testar link de internet e conectividade dos equipamentos', 4),
  ('GERAL', 'Conferir data/hora dos equipamentos', 5),
  -- Eclusa de pedestres
  ('PED', 'Testar leitora facial: cadastro, leitura e tempo de resposta', 1),
  ('PED', 'Limpar lente da leitora facial e acrílicos', 2),
  ('PED', 'Testar fechadura magnética e sensor de porta', 3),
  ('PED', 'Conferir mola aérea e fechamento completo da porta', 4),
  ('PED', 'Testar botoeira e display Puxe/Empurre', 5),
  ('PED', 'Testar interfone/vídeo porteiro com a central', 6),
  ('PED', 'Testar intertravamento da eclusa', 7),
  -- Eclusa veicular
  ('VEI', 'Testar abertura por controle e por leitura facial', 1),
  ('VEI', 'Conferir motor: fixação, engraxamento e curso completo', 2),
  ('VEI', 'Testar fotocélula (anti-esmagamento)', 3),
  ('VEI', 'Testar laço indutivo e sensores de posição', 4),
  ('VEI', 'Conferir receptor RF e alcance dos controles', 5),
  ('VEI', 'Testar giroflex e sinalização sonora', 6),
  -- CFTV
  ('CFTV', 'Conferir imagem de todas as câmeras (foco e enquadramento)', 1),
  ('CFTV', 'Limpar lentes e domos', 2),
  ('CFTV', 'Verificar gravação e dias de retenção no gravador', 3),
  ('CFTV', 'Checar saúde do HD (SMART) e espaço livre', 4),
  ('CFTV', 'Testar acesso remoto e alertas', 5),
  -- Alarme
  ('AL', 'Testar todos os sensores por zona', 1),
  ('AL', 'Testar sirene e comunicação com a central', 2),
  ('AL', 'Verificar bateria da central e dos sensores sem fio', 3),
  ('AL', 'Conferir módulo GPRS/comunicação de eventos', 4),
  -- Cerca elétrica
  ('CER', 'Medir tensão do eletrificador em todos os trechos', 1),
  ('CER', 'Conferir isoladores, hastes e tensionamento dos fios', 2),
  ('CER', 'Testar alarme de rompimento e aterramento', 3),
  ('CER', 'Conferir placas de aviso', 4),
  -- Central de portaria remota
  ('CENT', 'Testar áudio e vídeo de todos os acessos na central', 1),
  ('CENT', 'Conferir acionamento remoto de cada barreira', 2),
  ('CENT', 'Testar botão de pânico e procedimentos de emergência', 3),
  ('CENT', 'Revisar cadastros de moradores no software', 4),
  -- Elevadores
  ('ELV', 'Testar chamada de elevador pelo controle de acesso', 1),
  ('ELV', 'Conferir antena/kit de comunicação da cabine', 2),
  ('ELV', 'Testar câmera e interfone da cabine', 3),
  -- Totem
  ('TOT', 'Conferir imagem das câmeras do totem', 1),
  ('TOT', 'Verificar alimentação e switch do poste', 2),
  ('TOT', 'Testar comunicação com a central de monitoramento', 3)
ON CONFLICT (tipo_sistema, item) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) CHECKLIST DA OS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.os_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  -- agrupador exibido na tela (nome do sistema ou "Geral")
  grupo text,
  item text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  observacao text,
  concluido_em timestamptz,
  concluido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS os_checklist_os_idx ON public.os_checklist (os_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_checklist TO authenticated;
GRANT ALL ON public.os_checklist TO service_role;
ALTER TABLE public.os_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "os_checklist_select" ON public.os_checklist;
DROP POLICY IF EXISTS "os_checklist_insert" ON public.os_checklist;
DROP POLICY IF EXISTS "os_checklist_update" ON public.os_checklist;
DROP POLICY IF EXISTS "os_checklist_delete" ON public.os_checklist;
CREATE POLICY "os_checklist_select" ON public.os_checklist
  FOR SELECT TO authenticated USING (public.pode_acessar_os(os_id));
CREATE POLICY "os_checklist_insert" ON public.os_checklist
  FOR INSERT TO authenticated WITH CHECK (public.pode_acessar_os(os_id));
CREATE POLICY "os_checklist_update" ON public.os_checklist
  FOR UPDATE TO authenticated USING (public.pode_acessar_os(os_id)) WITH CHECK (public.pode_acessar_os(os_id));
CREATE POLICY "os_checklist_delete" ON public.os_checklist
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabelas criadas (os_checklist_templates, os_checklist)' AS verificacao,
       count(*)::text AS resultado, '2' AS esperado
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('os_checklist_templates','os_checklist')
UNION ALL
SELECT 'itens de checklist cadastrados', count(*)::text, '41' FROM public.os_checklist_templates
UNION ALL
SELECT 'tipos de sistema com roteiro',
       string_agg(DISTINCT tipo_sistema, ', ' ORDER BY tipo_sistema), 'AL, CENT, CER, CFTV, ELV, GERAL, PED, TOT, VEI'
FROM public.os_checklist_templates
UNION ALL
SELECT 'policies do checklist', count(*)::text, '5'
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('os_checklist','os_checklist_templates');
