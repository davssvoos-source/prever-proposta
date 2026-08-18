-- ETAPA U3 da unificação — OS de campo completa (o que mata o SIGMA).
-- Referência: docs/PLANO_UNIFICACAO.md §4.1, §5.2 e §10.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). Idempotente. <<<
-- >>> Rodar DEPOIS da U0 e da U2.                                       <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado. <<<
--
-- Fecha as três lacunas que faziam o SIGMA continuar existindo:
--   1) o que foi INSTALADO e o que foi RETIRADO em cada atendimento
--      (hoje pecas_texto é texto livre — §7 do SISTEMA_OS já previa a troca)
--   2) o número de série de cada item físico no cliente (a Unidade do QAP)
--   3) o veredito de cobrança item a item, que a U4 vai preencher
--
-- Cria:
--   cliente_equipamento_unidades — o item físico serializado no cliente
--   os_pecas                     — movimentação física do atendimento
--   os_pecas_analise             — o veredito financeiro, 1:1 com a peça
--   alertas_os_faturamento()     — automação 5 do §6

-- ═══════════════════════════════════════════════════════════════════════
-- 1) UNIDADE FÍSICA (a Unidade do QAP)
-- ═══════════════════════════════════════════════════════════════════════
-- Só para o que é serializável. Consumível (cabo, conector, parafuso) segue
-- controlado por quantidade em cliente_equipamentos — é a mesma regra do QAP,
-- que agrupa item barato por volume.
CREATE TABLE IF NOT EXISTS public.cliente_equipamento_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_equipamento_id uuid NOT NULL
    REFERENCES public.cliente_equipamentos(id) ON DELETE CASCADE,
  numero_serie text,
  tag_patrimonio text,
  imei text,
  codigo_barras text,
  -- reservados para o de-para da fase 2 do QAP (PLANO_UNIFICACAO §8).
  -- Gravar as chaves naturais desde já é o que torna a integração um de-para
  -- e não uma migração.
  qap_unidade_id text,
  qap_modelo_codigo text,
  estado text NOT NULL DEFAULT 'instalado',
  instalado_em date,
  retirado_em date,
  os_instalacao_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  os_retirada_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  observacao text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.cliente_equipamento_unidades ADD CONSTRAINT unidades_estado_check
    CHECK (estado IN ('instalado','retirado','em_manutencao'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'estado fora da lista — constraint nao criada';
END $$;

-- Número de série se repete entre fabricantes (é por isso que a fase 2 do QAP
-- pede um id imutável de unidade): a unicidade vale dentro da linha de
-- equipamento do cliente, não globalmente.
CREATE UNIQUE INDEX IF NOT EXISTS unidades_serie_unica
  ON public.cliente_equipamento_unidades (cliente_equipamento_id, public.normalizar_texto(numero_serie))
  WHERE numero_serie IS NOT NULL;
CREATE INDEX IF NOT EXISTS unidades_equip_idx ON public.cliente_equipamento_unidades (cliente_equipamento_id);
CREATE INDEX IF NOT EXISTS unidades_busca_idx
  ON public.cliente_equipamento_unidades (public.normalizar_texto(numero_serie));
CREATE INDEX IF NOT EXISTS unidades_tag_idx
  ON public.cliente_equipamento_unidades (public.normalizar_texto(tag_patrimonio));
CREATE INDEX IF NOT EXISTS unidades_qap_idx ON public.cliente_equipamento_unidades (qap_unidade_id)
  WHERE qap_unidade_id IS NOT NULL;

DROP TRIGGER IF EXISTS unidades_set_updated_at ON public.cliente_equipamento_unidades;
CREATE TRIGGER unidades_set_updated_at
  BEFORE UPDATE ON public.cliente_equipamento_unidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 2) MOVIMENTAÇÃO NA OS
-- ═══════════════════════════════════════════════════════════════════════
-- Sucede pecas_texto (§7 do SISTEMA_OS: "pecas_texto dá lugar a uma tabela
-- os_pecas conciliável com a movimentação do ERP"). Serve DOIS consumidores:
-- a decisão de cobrança (U4) e o relatório de movimentação patrimonial que o
-- Gilleno lança no QAP (U6).
CREATE TABLE IF NOT EXISTS public.os_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  direcao text NOT NULL DEFAULT 'instalado',
  tipo text NOT NULL DEFAULT 'peca',
  -- vínculos, quando existem: catálogo, inventário do cliente e unidade física
  equipamento_id uuid REFERENCES public.equipamentos(id) ON DELETE SET NULL,
  cliente_equipamento_id uuid REFERENCES public.cliente_equipamentos(id) ON DELETE SET NULL,
  unidade_id uuid REFERENCES public.cliente_equipamento_unidades(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  marca text,
  modelo text,
  numero_serie text,
  tag_patrimonio text,
  quantidade numeric NOT NULL DEFAULT 1,
  -- valor que o técnico anotou na OS; tem precedência sobre qualquer tabela
  -- de preço na cascata de valoração (regra do valorarItem do gestor-os)
  valor_unitario_informado numeric(12,2),
  observacao text,
  chave_busca text GENERATED ALWAYS AS (
    public.normalizar_texto(
      COALESCE(marca, '') || ' ' || COALESCE(modelo, '') || ' ' || COALESCE(descricao, '')
    )
  ) STORED,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.os_pecas ADD CONSTRAINT os_pecas_direcao_check
    CHECK (direcao IN ('instalado','retirado','substituido'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'direcao fora da lista — constraint nao criada';
END $$;

DO $$
BEGIN
  ALTER TABLE public.os_pecas ADD CONSTRAINT os_pecas_tipo_check
    CHECK (tipo IN ('peca','mao_de_obra','deslocamento','servico','outro'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'tipo fora da lista — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS os_pecas_os_idx    ON public.os_pecas (os_id);
CREATE INDEX IF NOT EXISTS os_pecas_chave_idx ON public.os_pecas (chave_busca);
CREATE INDEX IF NOT EXISTS os_pecas_serie_idx ON public.os_pecas (public.normalizar_texto(numero_serie));

DROP TRIGGER IF EXISTS os_pecas_set_updated_at ON public.os_pecas;
CREATE TRIGGER os_pecas_set_updated_at
  BEFORE UPDATE ON public.os_pecas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.ordens_servico.pecas_texto IS
  'LEGADO — sucedido por public.os_pecas na Etapa U3. Mantido só para leitura do histórico anterior.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3) O VEREDITO FINANCEIRO (1:1 com a peça)
-- ═══════════════════════════════════════════════════════════════════════
-- DESVIO CONSCIENTE do §4.1, que previa os campos financeiros dentro de
-- os_pecas: a RLS do Postgres é por LINHA, não por coluna, e o §4.4 exige que
-- o técnico não enxergue valor. Com tudo na mesma tabela seria preciso
-- column-level GRANT + view — mais máquina do que benefício. Aqui o movimento
-- físico continua tendo UMA fonte de verdade (os_pecas, que o técnico
-- preenche) e o veredito vive ao lado, com a régua financeira.
CREATE TABLE IF NOT EXISTS public.os_pecas_analise (
  peca_id uuid PRIMARY KEY REFERENCES public.os_pecas(id) ON DELETE CASCADE,
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  resultado text NOT NULL DEFAULT 'revisar',
  -- o item do contrato que o matching casou (validado contra o contrato antes
  -- de aceitar — invariante 4 do gestor-os)
  cobertura_item_id uuid REFERENCES public.contrato_cobertura_itens(id) ON DELETE SET NULL,
  valor_calculado numeric(12,2),
  confianca numeric(4,3),
  justificativa text,
  -- ajuste humano trava o item contra reanálise (invariante 3)
  ajustado_manualmente boolean NOT NULL DEFAULT false,
  ajustado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  analisado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.os_pecas_analise ADD CONSTRAINT os_pecas_analise_resultado_check
    CHECK (resultado IN ('coberto','faturavel','nao_identificado','revisar'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'resultado fora da lista — constraint nao criada';
END $$;

-- item sem preço vira REVISAR, nunca cobrança zerada (invariante 2)
DO $$
BEGIN
  ALTER TABLE public.os_pecas_analise ADD CONSTRAINT os_pecas_analise_valor_check
    CHECK (resultado <> 'faturavel' OR valor_calculado IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN
  RAISE NOTICE 'ha item faturavel sem valor — constraint nao criada';
END $$;

CREATE INDEX IF NOT EXISTS os_pecas_analise_os_idx ON public.os_pecas_analise (os_id, resultado);

DROP TRIGGER IF EXISTS os_pecas_analise_set_updated_at ON public.os_pecas_analise;
CREATE TRIGGER os_pecas_analise_set_updated_at
  BEFORE UPDATE ON public.os_pecas_analise
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- 4) O AS-BUILT SE ATUALIZA SOZINHO NO FECHAMENTO
-- ═══════════════════════════════════════════════════════════════════════
-- Ao fechar a OS, o que o técnico registrou como instalado/retirado vira
-- unidade no inventário do cliente. Sem isto, o as-built envelhece e a
-- conciliação com o QAP (U6) começa errada.
CREATE OR REPLACE FUNCTION public.os_sincronizar_unidades()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p record;
  v_unidade uuid;
BEGIN
  IF NEW.status <> 'fechada' OR OLD.status = 'fechada' THEN
    RETURN NEW;
  END IF;

  FOR p IN
    SELECT * FROM public.os_pecas
    WHERE os_id = NEW.id
      AND numero_serie IS NOT NULL
      AND cliente_equipamento_id IS NOT NULL
  LOOP
    -- cada volta decide o seu próprio destino: sem isto, um UPDATE que não
    -- casa nada deixaria a unidade da volta anterior colada em v_unidade
    v_unidade := NULL;

    IF p.direcao IN ('instalado','substituido') THEN
      INSERT INTO public.cliente_equipamento_unidades
        (cliente_equipamento_id, numero_serie, tag_patrimonio, estado, instalado_em,
         os_instalacao_id, created_by)
      VALUES
        (p.cliente_equipamento_id, p.numero_serie, p.tag_patrimonio, 'instalado',
         COALESCE(NEW.finalizada_em, now())::date, NEW.id, p.created_by)
      -- a expressão vai entre parênteses próprios: é a forma canônica de
      -- inferir índice de expressão, e o predicado repete o do índice parcial
      ON CONFLICT (cliente_equipamento_id, (public.normalizar_texto(numero_serie)))
        WHERE numero_serie IS NOT NULL
      DO UPDATE SET estado = 'instalado',
                    tag_patrimonio = COALESCE(EXCLUDED.tag_patrimonio, cliente_equipamento_unidades.tag_patrimonio),
                    os_instalacao_id = EXCLUDED.os_instalacao_id,
                    retirado_em = NULL,
                    updated_at = now()
      RETURNING id INTO v_unidade;
    ELSE
      UPDATE public.cliente_equipamento_unidades u
      SET estado = 'retirado',
          retirado_em = COALESCE(NEW.finalizada_em, now())::date,
          os_retirada_id = NEW.id,
          updated_at = now()
      WHERE u.cliente_equipamento_id = p.cliente_equipamento_id
        AND public.normalizar_texto(u.numero_serie) = public.normalizar_texto(p.numero_serie)
      RETURNING u.id INTO v_unidade;
    END IF;

    IF v_unidade IS NOT NULL AND p.unidade_id IS DISTINCT FROM v_unidade THEN
      UPDATE public.os_pecas SET unidade_id = v_unidade WHERE id = p.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_sincronizar_unidades ON public.ordens_servico;
CREATE TRIGGER trg_os_sincronizar_unidades
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_sincronizar_unidades();

-- ═══════════════════════════════════════════════════════════════════════
-- 5) RLS
-- ═══════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_equipamento_unidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_pecas                     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_pecas_analise             TO authenticated;
GRANT ALL ON public.cliente_equipamento_unidades, public.os_pecas,
             public.os_pecas_analise TO service_role;

ALTER TABLE public.cliente_equipamento_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_pecas                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_pecas_analise             ENABLE ROW LEVEL SECURITY;

-- Unidades: quem trabalha em campo precisa ler (é o inventário do cliente);
-- escrever é do gestor ou de quem está com a OS aberta do cliente.
DROP POLICY IF EXISTS "unidades_select" ON public.cliente_equipamento_unidades;
DROP POLICY IF EXISTS "unidades_write"  ON public.cliente_equipamento_unidades;
CREATE POLICY "unidades_select" ON public.cliente_equipamento_unidades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "unidades_write" ON public.cliente_equipamento_unidades
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- Peças: é o técnico que registra o que instalou e o que trouxe de volta.
-- Depois de fechada, ninguém mais mexe: o registro vira base de cobrança.
DROP POLICY IF EXISTS "os_pecas_select" ON public.os_pecas;
DROP POLICY IF EXISTS "os_pecas_insert" ON public.os_pecas;
DROP POLICY IF EXISTS "os_pecas_update" ON public.os_pecas;
DROP POLICY IF EXISTS "os_pecas_delete" ON public.os_pecas;
CREATE POLICY "os_pecas_select" ON public.os_pecas
  FOR SELECT TO authenticated USING (public.pode_acessar_os(os_id));
CREATE POLICY "os_pecas_insert" ON public.os_pecas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_acessar_os(os_id)
    AND EXISTS (SELECT 1 FROM public.ordens_servico o
                WHERE o.id = os_id AND o.status NOT IN ('fechada','cancelada'))
  );
CREATE POLICY "os_pecas_update" ON public.os_pecas
  FOR UPDATE TO authenticated
  USING (public.pode_acessar_os(os_id))
  WITH CHECK (
    public.is_gestor(auth.uid())
    OR EXISTS (SELECT 1 FROM public.ordens_servico o
               WHERE o.id = os_id AND o.status NOT IN ('fechada','cancelada'))
  );
CREATE POLICY "os_pecas_delete" ON public.os_pecas
  FOR DELETE TO authenticated
  USING (
    public.pode_acessar_os(os_id)
    AND (public.is_gestor(auth.uid())
         OR EXISTS (SELECT 1 FROM public.ordens_servico o
                    WHERE o.id = os_id AND o.status NOT IN ('fechada','cancelada')))
  );

-- Veredito financeiro: só quem enxerga financeiro. O técnico registra a peça
-- mas não vê (nem discute) se ela vai ser cobrada.
DROP POLICY IF EXISTS "os_pecas_analise_select" ON public.os_pecas_analise;
DROP POLICY IF EXISTS "os_pecas_analise_write"  ON public.os_pecas_analise;
CREATE POLICY "os_pecas_analise_select" ON public.os_pecas_analise
  FOR SELECT TO authenticated USING (public.pode_ver_financeiro(auth.uid()));
CREATE POLICY "os_pecas_analise_write" ON public.os_pecas_analise
  FOR ALL TO authenticated
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- 6) OS EXECUTADA SEM ANÁLISE DE COBRANÇA (§6, automação 5)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.alertas_os_faturamento(_dias int DEFAULT 2)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_envios int := 0;
BEGIN
  INSERT INTO public.notificacoes (user_id, tipo, titulo, corpo, os_id)
  SELECT p.id, 'os_sem_analise', 'Chamado esperando análise de cobrança',
         o.numero || ' · ' || COALESCE(cl.nome, 'cliente')
         || ' — executado há ' || EXTRACT(DAY FROM now() - o.finalizada_em)::int::text || ' dias.',
         o.id
  FROM public.ordens_servico o
  JOIN public.clientes cl ON cl.id = o.cliente_id
  CROSS JOIN public.profiles p
  WHERE o.status = 'executada'
    AND o.faturamento_status = 'a_analisar'
    AND o.finalizada_em IS NOT NULL
    AND o.finalizada_em < now() - make_interval(days => _dias)
    AND p.cargo IN ('admin','comercial')
    AND p.ativo IS DISTINCT FROM false
    AND p.status IS DISTINCT FROM 'rejeitado'
    AND p.status IS DISTINCT FROM 'pendente_aprovacao'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.os_id = o.id AND n.tipo = 'os_sem_analise' AND n.user_id = p.id
        AND n.created_at > now() - interval '3 days');
  GET DIAGNOSTICS v_envios = ROW_COUNT;
  RETURN 'avisos de OS sem analise: ' || v_envios;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alertas_os_faturamento(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alertas_os_faturamento(int) TO service_role;

DO $$
DECLARE r text;
BEGIN
  -- 09:00 de Brasília = 12:00 UTC, dias úteis
  r := public.agendar_job('alertas-os-faturamento', '0 12 * * 1-5',
                          'SELECT public.alertas_os_faturamento();');
  RAISE NOTICE '%', r;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agendamento nao aplicado: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabelas criadas (unidades, os_pecas, os_pecas_analise)' AS verificacao,
       count(*)::text AS resultado, '3' AS esperado
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('cliente_equipamento_unidades','os_pecas','os_pecas_analise')
UNION ALL
SELECT 'constraints de dominio (estado, direcao, tipo, resultado, valor)', count(*)::text, '5'
FROM pg_constraint
WHERE conname IN ('unidades_estado_check','os_pecas_direcao_check','os_pecas_tipo_check',
                  'os_pecas_analise_resultado_check','os_pecas_analise_valor_check')
UNION ALL
SELECT 'chaves naturais reservadas para o QAP', count(*)::text, '6'
FROM information_schema.columns
WHERE table_schema='public' AND table_name='cliente_equipamento_unidades'
  AND column_name IN ('numero_serie','tag_patrimonio','imei','codigo_barras',
                      'qap_unidade_id','qap_modelo_codigo')
UNION ALL
SELECT 'trigger que atualiza o as-built no fechamento',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
         WHERE NOT tgisinternal AND tgname='trg_os_sincronizar_unidades')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'policies criadas (unidades 2 + pecas 4 + analise 2)', count(*)::text, '8'
FROM pg_policies
WHERE schemaname='public' AND tablename IN
  ('cliente_equipamento_unidades','os_pecas','os_pecas_analise')
UNION ALL
SELECT 'veredito financeiro invisivel para o tecnico',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
         WHERE schemaname='public' AND tablename='os_pecas_analise'
           AND policyname='os_pecas_analise_select' AND qual LIKE '%pode_ver_financeiro%')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'funcao de alerta instalada', count(*)::text, '1'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname = 'alertas_os_faturamento'
UNION ALL
SELECT 'OS com pecas_texto preenchido (migrar a mao se precisar)', count(*)::text,
       '(informativo — pecas_texto virou legado)'
FROM public.ordens_servico WHERE COALESCE(pecas_texto,'') <> ''
UNION ALL
SELECT 'jobs agendados', public.jobs_agendados(),
       'alertas-os-faturamento deve aparecer na lista';
