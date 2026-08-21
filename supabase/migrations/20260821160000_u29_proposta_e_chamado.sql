-- U29 — A PROPOSTA COMERCIAL VIRA UM TIPO DE CHAMADO (R24, 2026-08-21)
--
-- "proposta comercial é um tipo de chamado, ela tem o fluxo próprio (já
--  criado) porém é um chamado como todos os outros e deve ser mapeado junto,
--  inclusive aparecendo no Kanban e tudo." — Davi
--
-- O QUE JÁ FUNCIONAVA, e por que ainda assim faltava: a visita já aparecia no
-- Kanban e na lista, porque `features/atividades/modelo.ts` a traduz. Mas ela
-- era cidadã de segunda classe — `numero: null`, `tipo: null`, sem prioridade
-- e sem equipe. Aparecia junto sem ser igual.
--
-- A TÉCNICA É A DA U7 (que absorveu demandas): o chamado nasce com o MESMO id
-- da visita. Assim os nove satélites de visita (visita_blocos,
-- visita_orcamentos, fotos_visita, visita_bloco_itens…) continuam apontando
-- para o mesmo uuid e NENHUMA FK precisa ser reescrita.
--
-- E `visitas_tecnicas` NÃO É DESMONTADA: ela vira satélite 1:1 do chamado,
-- exatamente como `chamado_compra` (U9) é do pedido de compra. O fluxo
-- comercial inteiro (/visita/$id, os wizards de orçamento, a geração da
-- proposta) continua lendo dela e não muda uma linha. Mover as colunas seria a
-- versão arriscada da mesma ideia, sem ganho.
--
-- Idempotente. Ao final, um SELECT de verificação.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. O VOCABULÁRIO ABRE ESPAÇO
-- ════════════════════════════════════════════════════════════════════════════
-- natureza 'comercial': o ciclo da proposta não é campo nem interno. Campo tem
-- deslocamento e assinatura; interno tem sprint. A proposta tem aprovação
-- interna e resposta do cliente — é um terceiro modo de execução.
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_natureza_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_natureza_check
  CHECK (natureza IN ('campo', 'interno', 'comercial'));

ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_tipo_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_tipo_check
  CHECK (tipo IN ('corretiva', 'preventiva', 'operacional', 'implantacao',
                  'melhoria', 'pedido_compra', 'proposta_comercial'));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. A VISITA VIRA SATÉLITE DO CHAMADO
-- ════════════════════════════════════════════════════════════════════════════
-- Só depois de a linha-capa existir (seção 3) é que a FK pode ser criada, por
-- isso ela vem no fim. Aqui fica o registro do desenho.

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CADA VISITA GANHA A SUA LINHA EM `chamados`, COM O MESMO id
-- ════════════════════════════════════════════════════════════════════════════
-- O status do chamado é DERIVADO do estado do funil. A tradução abaixo é a
-- mesma que `colunaDaVisita()` já fazia no app (atividades/modelo.ts) — se as
-- duas discordassem, o card mudaria de coluna ao recarregar a página.
--
--   sem data                        → aberto
--   com data marcada                → agendado
--   visita feita, esperando o comercial → aguardando_aprovacao
--   aprovada, proposta não enviada  → aguardando_aprovacao (bola no comercial)
--   proposta enviada, sem resposta  → aguardando_aprovacao (bola no cliente)
--   proposta aceita                 → concluido
--   proposta recusada               → cancelado
--   reprovada internamente          → aberto (volta para a fila: reagendar)
INSERT INTO public.chamados (
  id, natureza, tipo, titulo, descricao_problema,
  cliente_id, responsavel_id, status, prioridade,
  data_hora_agendada, aberto_por, created_at, updated_at
)
SELECT
  v.id,
  'comercial',
  'proposta_comercial',
  COALESCE(NULLIF(v.titulo, ''), NULLIF(v.nome_predio, ''), 'Proposta comercial'),
  v.descricao_pedido,
  v.cliente_id,
  v.tecnico_id,
  CASE
    WHEN lower(COALESCE(v.status, '')) = 'aprovada' AND v.proposta_resultado = 'aceita'   THEN 'concluido'
    WHEN lower(COALESCE(v.status, '')) = 'aprovada' AND v.proposta_resultado = 'recusada' THEN 'cancelado'
    WHEN lower(COALESCE(v.status, '')) = 'aprovada'                                        THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(v.status, '')) IN ('aguardando_aprovacao', 'concluida')            THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(v.status, '')) IN ('reprovada', 'cancelada')                       THEN 'aberto'
    WHEN lower(COALESCE(v.status, '')) = 'em_andamento'                                    THEN 'em_andamento'
    WHEN v.data_hora_agendada IS NOT NULL                                                  THEN 'agendado'
    ELSE 'aberto'
  END,
  COALESCE(NULLIF(v.prioridade, ''), 'normal'),
  v.data_hora_agendada,
  v.created_by,
  v.created_at,
  COALESCE(v.updated_at, v.created_at)
FROM public.visitas_tecnicas v
WHERE NOT EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = v.id);

-- Agora sim: a visita é satélite. A FK garante que não sobre visita órfã e que
-- apagar o chamado leve o fluxo comercial junto.
ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_e_chamado;
ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_e_chamado
  FOREIGN KEY (id) REFERENCES public.chamados(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. O CHAMADO ACOMPANHA O FUNIL
-- ════════════════════════════════════════════════════════════════════════════
-- Sem isto, a linha-capa congelaria no estado da migração: a visita andaria no
-- fluxo comercial e o Kanban continuaria mostrando a coluna de ontem.
CREATE OR REPLACE FUNCTION public.sincronizar_chamado_da_visita()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo_status text;
BEGIN
  novo_status := CASE
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada' AND NEW.proposta_resultado = 'aceita'   THEN 'concluido'
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada' AND NEW.proposta_resultado = 'recusada' THEN 'cancelado'
    WHEN lower(COALESCE(NEW.status, '')) = 'aprovada'                                          THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(NEW.status, '')) IN ('aguardando_aprovacao', 'concluida')              THEN 'aguardando_aprovacao'
    WHEN lower(COALESCE(NEW.status, '')) IN ('reprovada', 'cancelada')                         THEN 'aberto'
    WHEN lower(COALESCE(NEW.status, '')) = 'em_andamento'                                      THEN 'em_andamento'
    WHEN NEW.data_hora_agendada IS NOT NULL                                                    THEN 'agendado'
    ELSE 'aberto'
  END;

  -- INSERT de visita nova: cria a capa. UPDATE: mantém em dia.
  INSERT INTO public.chamados (
    id, natureza, tipo, titulo, descricao_problema,
    cliente_id, responsavel_id, status, prioridade,
    data_hora_agendada, aberto_por, created_at, updated_at
  ) VALUES (
    NEW.id, 'comercial', 'proposta_comercial',
    COALESCE(NULLIF(NEW.titulo, ''), NULLIF(NEW.nome_predio, ''), 'Proposta comercial'),
    NEW.descricao_pedido, NEW.cliente_id, NEW.tecnico_id, novo_status,
    COALESCE(NULLIF(NEW.prioridade, ''), 'normal'),
    NEW.data_hora_agendada, NEW.created_by, NEW.created_at,
    COALESCE(NEW.updated_at, NEW.created_at)
  )
  ON CONFLICT (id) DO UPDATE SET
    titulo             = EXCLUDED.titulo,
    descricao_problema = EXCLUDED.descricao_problema,
    cliente_id         = EXCLUDED.cliente_id,
    responsavel_id     = EXCLUDED.responsavel_id,
    status             = EXCLUDED.status,
    data_hora_agendada = EXCLUDED.data_hora_agendada,
    updated_at         = now();

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sincronizar_chamado_da_visita ON public.visitas_tecnicas;
CREATE TRIGGER trg_sincronizar_chamado_da_visita
  AFTER INSERT OR UPDATE OF status, proposta_resultado, data_hora_agendada,
                            titulo, nome_predio, cliente_id, tecnico_id, prioridade
  ON public.visitas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_chamado_da_visita();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. NUMERAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
-- As linhas nasceram sem número porque o INSERT não passou por onde a
-- numeração é atribuída. Numera as que ficaram sem, seguindo a sequência do
-- ano — o mesmo formato CH-AAAA-NNNN da U7.
DO $$
DECLARE r record; prox int; ano int;
BEGIN
  FOR r IN
    SELECT id, EXTRACT(YEAR FROM created_at)::int AS ano
    FROM public.chamados WHERE numero IS NULL ORDER BY created_at
  LOOP
    SELECT COALESCE(MAX(substring(numero from 'CH-\d{4}-(\d+)')::int), 0) + 1
      INTO prox
      FROM public.chamados
     WHERE numero LIKE 'CH-' || r.ano::text || '-%';
    UPDATE public.chamados
       SET numero = 'CH-' || r.ano::text || '-' || lpad(prox::text, 4, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. QUEM VÊ O CHAMADO DE PROPOSTA
-- ════════════════════════════════════════════════════════════════════════════
-- A visita sempre foi protegida por policy estreita (o técnico dono, ou
-- gestor). A capa não pode ser mais frouxa que o corpo, senão a lista de
-- chamados viraria a porta dos fundos do funil comercial: título, cliente e
-- responsável de toda negociação visíveis a quem não podia abrir a visita.
DROP POLICY IF EXISTS chamados_select ON public.chamados;
CREATE POLICY chamados_select ON public.chamados
  FOR SELECT TO authenticated
  USING (
    CASE
      WHEN natureza = 'comercial' THEN
        public.is_gestor(auth.uid()) OR responsavel_id = auth.uid()
      ELSE
        public.is_gestor(auth.uid())
        OR responsavel_id = auth.uid()
        OR aberto_por = auth.uid()
        OR responsavel_id IS NULL
        OR EXISTS (SELECT 1 FROM public.chamado_apoios a
                   WHERE a.chamado_id = chamados.id AND a.profile_id = auth.uid())
    END
  );

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
SELECT 'visitas no total' AS item, count(*)::text AS valor FROM public.visitas_tecnicas
UNION ALL
SELECT 'chamados de proposta criados',
       count(*)::text FROM public.chamados WHERE tipo = 'proposta_comercial'
UNION ALL
SELECT 'visita SEM chamado correspondente (esperado 0)',
       (SELECT count(*) FROM public.visitas_tecnicas v
         WHERE NOT EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = v.id))::text
UNION ALL
SELECT 'chamado sem número (esperado 0)',
       (SELECT count(*) FROM public.chamados WHERE numero IS NULL)::text
UNION ALL
SELECT 'a visita é satélite do chamado (FK)',
       (SELECT count(*) FROM pg_constraint
         WHERE conname = 'visitas_e_chamado')::text
UNION ALL
SELECT 'o trigger de sincronia existe',
       (SELECT count(*) FROM pg_trigger
         WHERE tgname = 'trg_sincronizar_chamado_da_visita' AND NOT tgisinternal)::text
UNION ALL
SELECT 'proposta na fila aberta NÃO vaza (policy trata comercial à parte)',
       (SELECT (qual LIKE '%comercial%')::text FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'chamados'
           AND policyname = 'chamados_select')
UNION ALL
SELECT 'natureza comercial aceita pelo CHECK',
       (SELECT count(*) FROM public.chamados WHERE natureza = 'comercial')::text;
