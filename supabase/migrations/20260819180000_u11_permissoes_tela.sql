-- ═══════════════════════════════════════════════════════════════════════════
-- U11 — PERMISSÃO POR TELA, EDITÁVEL PELO ADMIN
-- ═══════════════════════════════════════════════════════════════════════════
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor). <<<
-- >>> Conferir o SELECT final: cada linha traz o valor esperado ao lado.   <<<
--
-- Até aqui quem pode abrir cada tela estava escrito em código, espalhado por
-- doze `beforeLoad` e pelo rodapé. Mudar um acesso exigia deploy. Esta etapa
-- move a decisão para o banco, numa matriz tela × papel que o admin edita.
--
-- REGRA DE OURO DESTA MIGRATION: aplicar não pode mudar nada. A semente abaixo
-- reproduz EXATAMENTE o que o código faz hoje, guarda por guarda — inclusive
-- onde o que existe hoje é discutível (ver os comentários marcados "hoje é
-- assim"). Assim a tela nasce mostrando a verdade, e qualquer mudança é ato
-- explícito de alguém, com nome e hora registrados.
--
-- O admin não aparece na matriz: ele sempre tem tudo, e isso é regra de
-- sistema, não linha de tabela — senão um clique errado tranca o próprio admin
-- para fora da tela de permissões.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) A MATRIZ
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.permissoes_tela (
  tela           text NOT NULL,
  cargo          text NOT NULL,
  permitido      boolean NOT NULL DEFAULT false,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tela, cargo)
);

ALTER TABLE public.permissoes_tela DROP CONSTRAINT IF EXISTS permissoes_tela_cargo_check;
ALTER TABLE public.permissoes_tela ADD CONSTRAINT permissoes_tela_cargo_check
  CHECK (cargo IN ('tecnico', 'comercial', 'sac'));

COMMENT ON TABLE public.permissoes_tela IS
  'Quem abre cada tela. O catálogo de telas vive em src/lib/telas.ts (é o mapa '
  'de rotas, pertence ao código); aqui ficam só as chaves e o sim/não. Admin '
  'não entra: tem tudo por regra de sistema.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) RLS — todo mundo lê, só admin escreve
-- ═══════════════════════════════════════════════════════════════════════
-- A leitura é aberta ao time autenticado porque cada pessoa precisa saber o
-- que ela mesma pode abrir, e a matriz não contém dado de cliente — só a
-- estrutura do app, que qualquer um já vê pelo rodapé.
ALTER TABLE public.permissoes_tela ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissoes_select" ON public.permissoes_tela;
DROP POLICY IF EXISTS "permissoes_escrita" ON public.permissoes_tela;

CREATE POLICY "permissoes_select" ON public.permissoes_tela
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "permissoes_escrita" ON public.permissoes_tela
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.cargo = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid() AND p.cargo = 'admin'));

-- ═══════════════════════════════════════════════════════════════════════
-- 3) GRAVAÇÃO EM LOTE — a tela salva a matriz inteira de uma vez
-- ═══════════════════════════════════════════════════════════════════════
-- Sem isto seriam ~75 chamadas soltas e um estado intermediário visível: um
-- refresh no meio pegaria metade da matriz nova e metade da velha.
CREATE OR REPLACE FUNCTION public.salvar_permissoes(_linhas jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.cargo = 'admin') THEN
    RAISE EXCEPTION 'Somente administrador altera permissões.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.permissoes_tela (tela, cargo, permitido, atualizado_em, atualizado_por)
  SELECT x.tela, x.cargo, x.permitido, now(), auth.uid()
  FROM jsonb_to_recordset(_linhas) AS x(tela text, cargo text, permitido boolean)
  WHERE x.cargo IN ('tecnico', 'comercial', 'sac')
  ON CONFLICT (tela, cargo) DO UPDATE
    SET permitido = EXCLUDED.permitido,
        atualizado_em = now(),
        atualizado_por = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salvar_permissoes(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.salvar_permissoes(jsonb) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) SEMENTE — o retrato fiel do código de hoje
-- ═══════════════════════════════════════════════════════════════════════
-- `ON CONFLICT DO NOTHING`: rodar de novo nunca desfaz escolha do admin.
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  -- Início e Perfil: todo mundo, sempre. A tela marca as duas como
  -- obrigatórias e nem deixa desmarcar — bloquear o perfil tiraria o botão
  -- de sair do app.
  ('dashboard',            'tecnico',   true),
  ('dashboard',            'comercial', true),
  ('dashboard',            'sac',       true),
  ('perfil',               'tecnico',   true),
  ('perfil',               'comercial', true),
  ('perfil',               'sac',       true),

  -- Calendário: sem guarda hoje, todos entram (o técnico vê só o que é dele,
  -- por RLS — a permissão de tela não substitui a de dado)
  ('calendario',           'tecnico',   true),
  ('calendario',           'comercial', true),
  ('calendario',           'sac',       true),

  -- Chamados: a lista é de coordenação. O técnico chega nos dele pelos cards
  -- da Início, e as rotas filhas continuam passando (chamados.tsx:34-36).
  ('chamados',             'tecnico',   false),
  ('chamados',             'comercial', true),
  ('chamados',             'sac',       true),
  ('chamados.novo',        'tecnico',   false),
  ('chamados.novo',        'comercial', true),
  ('chamados.novo',        'sac',       true),
  ('chamados.painel',      'tecnico',   false),
  ('chamados.painel',      'comercial', true),
  ('chamados.painel',      'sac',       true),
  ('chamados.indicadores', 'tecnico',   false),
  ('chamados.indicadores', 'comercial', true),
  ('chamados.indicadores', 'sac',       true),
  ('chamados.programacao', 'tecnico',   false),
  ('chamados.programacao', 'comercial', true),
  ('chamados.programacao', 'sac',       true),
  ('chamados.importar',    'tecnico',   false),
  ('chamados.importar',    'comercial', true),
  ('chamados.importar',    'sac',       true),

  -- Comercial
  ('gerencial',            'tecnico',   false),
  ('gerencial',            'comercial', true),
  ('gerencial',            'sac',       false),
  -- o SAC abre o formulário de visita pelo trilho de proposta da triagem,
  -- mas não o painel (gerencial.tsx:33-37)
  ('gerencial.nova',       'tecnico',   false),
  ('gerencial.nova',       'comercial', true),
  ('gerencial.nova',       'sac',       true),

  -- Clientes: hoje é assim — nenhuma destas três tem guarda de cargo.
  -- "clientes.migrar" consolida cadastros e é operação pesada; se a intenção
  -- era restringir, agora dá para fazer sem deploy.
  ('clientes',             'tecnico',   true),
  ('clientes',             'comercial', true),
  ('clientes',             'sac',       true),
  ('clientes.novo',        'tecnico',   true),
  ('clientes.novo',        'comercial', true),
  ('clientes.novo',        'sac',       true),
  ('clientes.migrar',      'tecnico',   true),
  ('clientes.migrar',      'comercial', true),
  ('clientes.migrar',      'sac',       true),

  -- Financeiro: R13 — o SAC não vê valores
  ('contratos',            'tecnico',   false),
  ('contratos',            'comercial', true),
  ('contratos',            'sac',       false),
  ('fechamentos',          'tecnico',   false),
  ('fechamentos',          'comercial', true),
  ('fechamentos',          'sac',       false),

  -- Legado: hoje é assim — sem guarda, sem entrada no rodapé
  ('historico',            'tecnico',   true),
  ('historico',            'comercial', true),
  ('historico',            'sac',       true),
  ('mapa',                 'tecnico',   true),
  ('mapa',                 'comercial', true),
  ('mapa',                 'sac',       true),

  -- Administração: só admin, e admin não entra na matriz
  ('gerencial.usuarios',   'tecnico',   false),
  ('gerencial.usuarios',   'comercial', false),
  ('gerencial.usuarios',   'sac',       false),
  ('gerencial.permissoes', 'tecnico',   false),
  ('gerencial.permissoes', 'comercial', false),
  ('gerencial.permissoes', 'sac',       false),
  ('admin',                'tecnico',   false),
  ('admin',                'comercial', false),
  ('admin',                'sac',       false)
ON CONFLICT (tela, cargo) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'tabela permissoes_tela',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                         WHERE table_schema='public' AND table_name='permissoes_tela')
       THEN 'sim' ELSE 'NAO' END, 'sim'
UNION ALL
SELECT 'telas no catalogo', count(DISTINCT tela)::text, '22'
FROM public.permissoes_tela
UNION ALL
SELECT 'linhas semeadas (telas x 3 papeis)', count(*)::text, '66'
FROM public.permissoes_tela
UNION ALL
SELECT 'o que o TECNICO abre hoje',
       string_agg(tela, ', ' ORDER BY tela), '(dashboard, perfil, calendario, clientes*, historico, mapa)'
FROM public.permissoes_tela WHERE cargo='tecnico' AND permitido
UNION ALL
SELECT 'o que o SAC abre hoje',
       string_agg(tela, ', ' ORDER BY tela), '(sem gerencial, sem contratos, sem fechamentos)'
FROM public.permissoes_tela WHERE cargo='sac' AND permitido
UNION ALL
SELECT 'RPC de gravacao em lote', count(*)::text, '1'
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='salvar_permissoes'
UNION ALL
SELECT 'policies', count(*)::text, '2'
FROM pg_policies WHERE schemaname='public' AND tablename='permissoes_tela';
