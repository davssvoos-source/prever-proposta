-- U27 — PROSPECÇÃO: prospecto sai da base de clientes (2026-08-21)
--
-- Regras novas do Davi (PRODUTO.md R21–R23):
--   R21  o cliente é do QAP; o app não cria cliente por nenhuma via;
--   R22  prospecto NÃO é cliente — é prédio que orçamos e não fechou, e vive
--        numa tela própria com o registro das propostas geradas;
--   R23  também se faz proposta para cliente EXISTENTE (ampliação). Nesse caso
--        o chamado é vinculado ao cliente; a aprovação e o aditivo ficam no
--        ERP e não entram no app.
--
-- POR QUE UMA TABELA PRÓPRIA, e não uma coluna `origem` em `clientes`:
-- `clientes` passa a ser espelho do QAP, e o botão Sincronizar vai fazer
-- upsert (e algum dia delete) nela. Prospecção morando ali seria apagada por
-- um sync — e é justamente a informação que o Davi quer guardar. Separar é o
-- que protege o dado do sync que ainda nem existe.
--
-- A VISITA JÁ ERA AUTOSSUFICIENTE: `visitas_tecnicas` guarda nome do prédio,
-- endereço, coordenada, síndico, zelador e fachada nela mesma, e `cliente_id`
-- sempre foi nullable. O vínculo com `clientes` foi acrescentado depois (Etapa
-- 1) para consolidar cadastros. Ou seja: nada se perde ao desfazer o vínculo.
--
-- NÃO É DESTRUTIVA. Prospecto que tenha chamado, contrato ou cobrança apontando
-- para ele (FKs com RESTRICT) NÃO é apagado — fica em `clientes` e sai listado
-- na verificação, para decisão humana. Melhor sobrar um cadastro do que a
-- migration abortar no meio ou apagar algo com histórico.
--
-- Idempotente. Ao final, um SELECT de verificação.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. A TABELA
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.prospeccoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- o prédio/local
  nome             text NOT NULL,
  tipo_local       text,
  endereco         text,
  complemento      text,
  cidade           text,
  uf               text,
  cep              text,
  latitude         numeric,
  longitude        numeric,

  -- contatos do local (mesma forma que a visita já usa)
  nome_sindico     text,
  telefone_sindico text,
  email_sindico    text,
  nome_zelador     text,
  telefone_zelador text,
  email_zelador    text,

  foto_fachada_url text,
  qtd_apartamentos integer,
  qtd_acessos      integer,
  observacoes      text,

  -- em_prospeccao: orçando ou aguardando resposta
  -- ganha:  a proposta foi aceita. NÃO vira cliente aqui — quem cria cliente é
  --         o QAP (R21); isto só registra o desfecho para o funil não mentir.
  -- perdida: recusada ou desistida.
  situacao text NOT NULL DEFAULT 'em_prospeccao'
    CHECK (situacao IN ('em_prospeccao', 'ganha', 'perdida')),

  -- preenchido quando a prospecção virou cliente e o cliente apareceu no QAP.
  -- É de-para para histórico, não promoção: continua sendo o sync que decide
  -- quem é cliente.
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,

  -- de onde veio esta linha (a migração marca 'migracao_u27')
  origem     text NOT NULL DEFAULT 'manual',

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospeccoes_situacao_idx ON public.prospeccoes (situacao);
CREATE INDEX IF NOT EXISTS prospeccoes_nome_idx     ON public.prospeccoes (nome);

DROP TRIGGER IF EXISTS set_updated_at_prospeccoes ON public.prospeccoes;
CREATE TRIGGER set_updated_at_prospeccoes
  BEFORE UPDATE ON public.prospeccoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccoes TO authenticated;
GRANT ALL ON public.prospeccoes TO service_role;
ALTER TABLE public.prospeccoes ENABLE ROW LEVEL SECURITY;

-- Prospecção é trabalho comercial: quem monta visita precisa ler e escrever.
-- Segue is_gestor (admin/comercial/sac) — o SAC agenda a visita de proposta.
-- O técnico chega pela VISITA dele, não pela lista; por isso não abrimos aqui.
DROP POLICY IF EXISTS prospeccoes_select ON public.prospeccoes;
CREATE POLICY prospeccoes_select ON public.prospeccoes
  FOR SELECT TO authenticated USING (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS prospeccoes_write ON public.prospeccoes;
CREATE POLICY prospeccoes_write ON public.prospeccoes
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. A VISITA APONTA PARA UM DOS DOIS
-- ════════════════════════════════════════════════════════════════════════════
-- cliente_id  → proposta para cliente existente (ampliação, R23)
-- prospeccao_id → proposta para prédio que ainda não é cliente (R22)
-- Nunca os dois. Pode não ter nenhum: visita antiga, ou recém-criada antes de
-- alguém dizer de quem é — não travamos o rascunho.
ALTER TABLE public.visitas_tecnicas
  ADD COLUMN IF NOT EXISTS prospeccao_id uuid REFERENCES public.prospeccoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS visitas_prospeccao_idx ON public.visitas_tecnicas (prospeccao_id);

ALTER TABLE public.visitas_tecnicas DROP CONSTRAINT IF EXISTS visitas_alvo_unico;
ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_alvo_unico
  CHECK (cliente_id IS NULL OR prospeccao_id IS NULL);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. MIGRAÇÃO — os prospectos saem de `clientes`
-- ════════════════════════════════════════════════════════════════════════════
-- Trilha permanente do de-para: sem ela, reapontar as visitas na 2ª execução
-- seria impossível e o rollback também.
CREATE TABLE IF NOT EXISTS public.prospeccoes_migradas_u27 (
  cliente_id    uuid PRIMARY KEY,
  prospeccao_id uuid NOT NULL REFERENCES public.prospeccoes(id) ON DELETE CASCADE,
  migrado_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prospeccoes_migradas_u27 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prospeccoes_migradas_admin ON public.prospeccoes_migradas_u27;
CREATE POLICY prospeccoes_migradas_admin ON public.prospeccoes_migradas_u27
  FOR SELECT TO authenticated USING (public.e_admin(auth.uid()));

-- 3.1 copia (só quem ainda não foi copiado — idempotente).
-- Laço explícito, e não INSERT..SELECT..RETURNING: o RETURNING devolve o id
-- NOVO, e eu preciso do PAR (cliente antigo → prospecção nova) para reapontar
-- as visitas. Casar por nome+data depois seria adivinhação. São ~70 linhas;
-- a clareza vale mais que o desempenho aqui.
DO $$
DECLARE r record; novo uuid;
BEGIN
  FOR r IN
    SELECT c.* FROM public.clientes c
    WHERE c.situacao = 'prospecto'
      AND NOT EXISTS (SELECT 1 FROM public.prospeccoes_migradas_u27 m WHERE m.cliente_id = c.id)
  LOOP
    INSERT INTO public.prospeccoes (
      nome, tipo_local, endereco, complemento, cidade, uf, cep, latitude, longitude,
      nome_sindico, telefone_sindico, email_sindico,
      nome_zelador, telefone_zelador, email_zelador,
      foto_fachada_url, qtd_apartamentos, qtd_acessos, observacoes,
      situacao, origem, created_at
    ) VALUES (
      r.nome, r.tipo_local, r.endereco, r.complemento, r.cidade, r.uf, r.cep,
      r.latitude, r.longitude,
      r.nome_sindico, r.telefone_sindico, r.email_sindico,
      r.nome_zelador, r.telefone_zelador, r.email_zelador,
      r.foto_fachada_url, r.qtd_apartamentos, r.qtd_acessos, r.observacoes,
      'em_prospeccao', 'migracao_u27', r.created_at
    )
    RETURNING id INTO novo;

    INSERT INTO public.prospeccoes_migradas_u27 (cliente_id, prospeccao_id)
    VALUES (r.id, novo);
  END LOOP;
END $$;

-- 3.1.1 o desfecho já conhecido entra junto: prospecção cuja visita teve
-- proposta aceita/recusada nasce com a situação certa, senão o funil da tela
-- nova começaria mentindo que está tudo "em prospecção".
UPDATE public.prospeccoes p
SET situacao = CASE WHEN v.proposta_resultado = 'aceita' THEN 'ganha' ELSE 'perdida' END
FROM public.prospeccoes_migradas_u27 m
JOIN public.visitas_tecnicas v ON v.cliente_id = m.cliente_id
WHERE p.id = m.prospeccao_id
  AND v.proposta_resultado IN ('aceita', 'recusada')
  AND p.situacao = 'em_prospeccao';

-- 3.2 as visitas passam a apontar para a prospecção
UPDATE public.visitas_tecnicas v
SET prospeccao_id = m.prospeccao_id,
    cliente_id    = NULL
FROM public.prospeccoes_migradas_u27 m
WHERE v.cliente_id = m.cliente_id;

-- 3.3 o mesmo para projetos e demandas/chamados que apontavam para prospecto
--     (SET NULL na FK — o vínculo era frouxo de qualquer forma)
UPDATE public.projetos p
SET cliente_id = NULL
FROM public.prospeccoes_migradas_u27 m
WHERE p.cliente_id = m.cliente_id;

-- 3.4 apaga de `clientes` SÓ quem não tem dependência dura.
--     chamados, cliente_contratos e cobrancas têm FK RESTRICT: se algum
--     prospecto tiver um desses, ele FICA e aparece na verificação. Prospecto
--     com contrato é contradição — quero isso na tela, não escondido.
DELETE FROM public.clientes c
USING public.prospeccoes_migradas_u27 m
WHERE c.id = m.cliente_id
  AND NOT EXISTS (SELECT 1 FROM public.chamados          x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cliente_contratos x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cobrancas         x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cliente_sistemas  x WHERE x.cliente_id = c.id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. `situacao` do cliente perde o valor 'prospecto'
-- ════════════════════════════════════════════════════════════════════════════
-- Só aperta o CHECK se realmente não sobrou nenhum — senão a migration
-- abortaria por causa das linhas presas na 3.4.
DO $$
DECLARE sobraram int;
BEGIN
  SELECT count(*) INTO sobraram FROM public.clientes WHERE situacao = 'prospecto';
  IF sobraram = 0 THEN
    ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_situacao_check;
    ALTER TABLE public.clientes ADD CONSTRAINT clientes_situacao_check
      CHECK (situacao IN ('ativo', 'inativo'));
  ELSE
    RAISE WARNING 'U27: % cliente(s) seguem como prospecto (têm chamado/contrato/cobrança). CHECK não apertado — resolva e rode de novo.', sobraram;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. O ACEITE PARA DE MEXER NO CADASTRO DO CLIENTE (R21/R23)
-- ════════════════════════════════════════════════════════════════════════════
-- A U8 fez o aceite promover clientes.situacao para 'ativo', e a U24b ampliou
-- para reativar 'inativo'. Sob a R21 essa coluna passa a ser do QAP, e o app
-- escrevendo nela cria dois donos para o mesmo dado: o aceite marcaria 'ativo'
-- e o próximo Sincronizar desfaria, sem nada na tela explicando.
--
-- O resto da função CONTINUA: o funil comercial é dado nosso. O que sai é só
-- o efeito colateral em `clientes`.
--
-- (CREATE OR REPLACE porque migration deste repo não se auto-aplica — editar
-- a U8 ou a U24b no arquivo não mudaria nada no banco já migrado.)
CREATE OR REPLACE FUNCTION public.registrar_resultado_proposta(
  _visita_id uuid, _resultado text, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_enviada timestamptz;
  v_prospeccao uuid;
BEGIN
  IF NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Somente gestor registra a resposta do cliente.' USING ERRCODE = '42501';
  END IF;
  IF _resultado NOT IN ('aguardando', 'aceita', 'recusada') THEN
    RAISE EXCEPTION 'Resultado inválido: %', _resultado;
  END IF;

  SELECT proposta_enviada_em, prospeccao_id INTO v_enviada, v_prospeccao
  FROM public.visitas_tecnicas WHERE id = _visita_id;

  IF v_enviada IS NULL THEN
    RAISE EXCEPTION 'Registre primeiro o envio da proposta ao cliente.';
  END IF;

  UPDATE public.visitas_tecnicas
  SET proposta_resultado     = _resultado,
      proposta_resultado_em  = CASE WHEN _resultado = 'aguardando' THEN NULL ELSE now() END,
      proposta_motivo_recusa = CASE WHEN _resultado = 'recusada' THEN _motivo ELSE NULL END
  WHERE id = _visita_id;

  -- O desfecho marca a PROSPECÇÃO, nunca o cliente. Virar cliente é ato do
  -- QAP; aqui só se registra o que aconteceu com a proposta, para o funil.
  IF v_prospeccao IS NOT NULL AND _resultado <> 'aguardando' THEN
    UPDATE public.prospeccoes
    SET situacao = CASE WHEN _resultado = 'aceita' THEN 'ganha' ELSE 'perdida' END,
        updated_at = now()
    WHERE id = v_prospeccao;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_resultado_proposta(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_resultado_proposta(uuid, text, text) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. O APP NÃO CRIA MAIS CLIENTE (R21)
-- ════════════════════════════════════════════════════════════════════════════
-- A tela some no deploy, mas a policy é o que realmente fecha: sem ela, um
-- INSERT direto pelo console do navegador continuaria funcionando.
DROP POLICY IF EXISTS "clientes_insert_gestor" ON public.clientes;
-- (sem policy de INSERT, ninguém insere — só o service_role, que é o caminho
--  do Sincronizar quando ele existir)

-- ════════════════════════════════════════════════════════════════════════════
-- 7. PERMISSÕES DE TELA
-- ════════════════════════════════════════════════════════════════════════════
-- Prospecção entra para comercial e SAC (quem orça e quem agenda a visita).
-- Criar/consolidar cliente saem para todos — a rota redireciona, mas a matriz
-- precisa concordar, senão o item volta a aparecer no menu de alguém.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('prospeccao',      'tecnico',   false),
  ('prospeccao',      'comercial', true),
  ('prospeccao',      'sac',       true),
  ('clientes.novo',   'tecnico',   false),
  ('clientes.novo',   'comercial', false),
  ('clientes.novo',   'sac',       false),
  ('clientes.migrar', 'tecnico',   false),
  ('clientes.migrar', 'comercial', false),
  ('clientes.migrar', 'sac',       false)
ON CONFLICT (tela, cargo) DO UPDATE SET permitido = EXCLUDED.permitido;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
SELECT 'prospecções criadas' AS item, count(*)::text AS valor FROM public.prospeccoes
UNION ALL
SELECT 'migradas de clientes', count(*)::text FROM public.prospeccoes_migradas_u27
UNION ALL
SELECT 'visitas reapontadas para prospecção',
       count(*)::text FROM public.visitas_tecnicas WHERE prospeccao_id IS NOT NULL
UNION ALL
SELECT 'clientes que SOBRARAM como prospecto (esperado 0)',
       count(*)::text FROM public.clientes WHERE situacao = 'prospecto'
UNION ALL
SELECT 'clientes agora (só ativo/inativo)', count(*)::text FROM public.clientes
UNION ALL
SELECT 'o app ainda pode inserir cliente? (esperado 0)',
       (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'clientes' AND cmd = 'INSERT')::text
UNION ALL
SELECT 'o aceite ainda mexe em clientes? (esperado false)',
       (SELECT (pg_get_functiondef(p.oid) LIKE '%UPDATE public.clientes%')::text
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'registrar_resultado_proposta')
UNION ALL
SELECT 'visita com alvo duplo (esperado 0)',
       count(*)::text FROM public.visitas_tecnicas
       WHERE cliente_id IS NOT NULL AND prospeccao_id IS NOT NULL
UNION ALL
SELECT 'prospecção liberada p/ comercial e sac (esperado 2)',
       (SELECT count(*) FROM public.permissoes_tela
         WHERE tela = 'prospeccao' AND permitido = true)::text
UNION ALL
SELECT 'criar/consolidar cliente negado a todos (esperado 6)',
       (SELECT count(*) FROM public.permissoes_tela
         WHERE tela IN ('clientes.novo','clientes.migrar') AND permitido = false)::text;
