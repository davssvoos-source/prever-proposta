-- U65 — 30 CHAMADOS FICTÍCIOS para ver o Painel Operacional cheio (R77).
--
-- Davi, 2026-08-22: "crie 30 chamados para a equipe Técnica, em diversos
-- tipos, aleatórios. Pode ser tudo fictício mesmo, antes de lançar o app
-- vamos resetar o banco de dados. Eu quero visualizar o dashboard."
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE. Idempotente.                         <<<
-- >>> DADO DE TESTE: sai inteiro com um DELETE (ver o rodapé).             <<<
-- >>> Rode a U64 ANTES — é ela que põe o apoio da dupla automaticamente.   <<<
--
-- ── POR QUE ELES SÃO MAJORITARIAMENTE EM ABERTO ────────────────────────────
-- As 227 OS importadas (U59/U61) são todas concluídas, e quase todo painel
-- desta tela conta o que está EM ABERTO: os 4 KPIs, a rosca de fila por
-- status, a carga por técnico, os abertos por cliente. Um lote de teste
-- também concluído deixaria o dashboard exatamente como está — vazio onde
-- importa. Aqui são 26 em aberto e 4 concluídos, espalhados pelos estados.
--
-- ── E POR QUE OS PRAZOS SÃO ESCOLHIDOS, NÃO SORTEADOS ──────────────────────
-- Para o dashboard mostrar o que ele sabe mostrar, o lote precisa conter os
-- casos: 4 com prazo estourado (acende "Prazo estourado" e a coluna
-- "Atrasados" do quadro), 3 urgentes, 3 sem responsável (acende "Sem
-- responsável") e 8 sem agendamento (enche "Não agendados"). Sorteio de
-- verdade daria um lote plausível e provavelmente sem nenhum desses casos.
--
-- ── DE ONDE SAEM AS PESSOAS E OS CLIENTES ──────────────────────────────────
-- Não há id escrito à mão aqui: os técnicos saem dos MEMBROS DE DUPLAS
-- ATIVAS (assim o gatilho da U64 tem par para preencher, e dá para ver o
-- mecanismo funcionando), e os clientes saem da própria tabela, em ordem de
-- nome. A migration se adapta ao banco em que roda.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) OS 30, EM TEXTO
-- ═══════════════════════════════════════════════════════════════════════
-- `dias_prazo`: negativo = já venceu; NULL = sem prazo.
-- `dias_agenda`: NULL = não agendado (vai para a 1ª coluna do quadro).
CREATE TEMP TABLE _seed (
  n            int PRIMARY KEY,
  titulo       text NOT NULL,
  tipo         text NOT NULL,
  status       text NOT NULL,
  prioridade   text NOT NULL,
  dias_aberto  int  NOT NULL,      -- há quantos dias foi aberto
  dias_prazo   int,                -- prazo, em dias a partir de hoje
  dias_agenda  int,                -- agendamento, em dias a partir de hoje
  sem_dono     boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

INSERT INTO _seed (n, titulo, tipo, status, prioridade, dias_aberto, dias_prazo, dias_agenda, sem_dono) VALUES
  -- ── atrasados (prazo vencido, ainda em aberto) ───────────────────────
  ( 1, 'Câmera do hall de entrada sem imagem',            'corretiva',   'aberto',       'urgente', 9, -4, -2, false),
  ( 2, 'Portão social não destrava pelo interfone',       'corretiva',   'em_andamento', 'alta',    7, -2, -1, false),
  ( 3, 'Fechadura eletromagnética da garagem solta',      'corretiva',   'aberto',       'alta',   12, -6, NULL, false),
  ( 4, 'DVR reiniciando sozinho durante a madrugada',     'corretiva',   'stand_by',     'alta',   15, -8, -5, false),
  -- ── urgentes no prazo ────────────────────────────────────────────────
  ( 5, 'Alarme disparando sem motivo no subsolo',         'corretiva',   'em_andamento', 'urgente', 1,  1,  0, false),
  ( 6, 'Central de incêndio em falha permanente',         'corretiva',   'agendado',     'urgente', 2,  2,  1, false),
  -- ── agendados, ritmo normal ──────────────────────────────────────────
  ( 7, 'Preventiva trimestral do CFTV',                   'preventiva',  'agendado',     'normal',  3,  6,  2, false),
  ( 8, 'Preventiva do sistema de alarme',                 'preventiva',  'agendado',     'normal',  4,  8,  3, false),
  ( 9, 'Troca do nobreak do rack de portaria',            'corretiva',   'agendado',     'alta',    2,  4,  1, false),
  (10, 'Ajuste de foco em quatro câmeras do perímetro',   'corretiva',   'agendado',     'normal',  5,  7,  4, false),
  (11, 'Instalação de câmera na área de lazer',           'implantacao', 'agendado',     'normal',  6, 14,  5, false),
  (12, 'Implantação de controle de acesso na portaria',   'implantacao', 'agendado',     'normal',  8, 20,  7, false),
  (13, 'Revisão do cabeamento do portão de pedestres',    'corretiva',   'agendado',     'normal',  4,  9,  3, false),
  (14, 'Reposicionamento da câmera da guarita',           'corretiva',   'agendado',     'baixa',   6, 12,  6, false),
  (15, 'Preventiva do controle de acesso',                'preventiva',  'agendado',     'normal',  3, 10,  4, false),
  (16, 'Substituição de fonte do sistema de portaria',    'corretiva',   'agendado',     'normal',  2,  5,  2, false),
  -- ── em andamento ─────────────────────────────────────────────────────
  (17, 'Configuração de acesso remoto ao DVR',            'operacional', 'em_andamento', 'normal',  2,  3,  0, false),
  (18, 'Troca de HD do gravador',                         'corretiva',   'em_andamento', 'alta',    1,  2,  0, false),
  -- ── não agendados (sem data marcada) ─────────────────────────────────
  (19, 'Orçamento de melhoria da iluminação do perímetro','operacional', 'aberto',       'baixa',   5, 20, NULL, false),
  (20, 'Vistoria do sistema após queda de energia',       'corretiva',   'aberto',       'normal',  3,  6, NULL, false),
  (21, 'Interfone do bloco B com ruído',                  'corretiva',   'aberto',       'normal',  4,  8, NULL, false),
  (22, 'Levantamento para troca do porteiro eletrônico',  'operacional', 'aberto',       'baixa',   7, NULL, NULL, false),
  (23, 'Câmera do playground fora de posição',            'corretiva',   'aberto',       'baixa',   6, 15, NULL, false),
  -- ── sem responsável (acendem o KPI "Sem responsável") ────────────────
  (24, 'Sensor de presença da escada não arma',           'corretiva',   'aberto',       'normal',  2,  5, NULL, true),
  (25, 'Ajuste de horário do portão automático',          'operacional', 'aberto',       'baixa',   3,  9, NULL, true),
  (26, 'Cerca elétrica sem sinal no trecho dos fundos',   'corretiva',   'aberto',       'alta',    1,  2, NULL, true),
  -- ── concluídos recentes (alimentam "Concluídos" e o fluxo do mês) ────
  (27, 'Troca de câmera queimada no corredor',            'corretiva',   'concluido',    'normal',  6, NULL, -4, false),
  (28, 'Preventiva semestral do portão de veículos',      'preventiva',  'concluido',    'normal',  9, NULL, -7, false),
  (29, 'Instalação de sensor no depósito',                'implantacao', 'concluido',    'normal', 11, NULL, -9, false),
  (30, 'Reparo no fecho elétrico do portão de serviço',   'corretiva',   'concluido',    'alta',    4, NULL, -3, false);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _seed;
  IF n <> 30 THEN RAISE EXCEPTION 'Esperava 30 chamados de teste, vieram %.', n; END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) A QUEM ATRIBUIR
-- ═══════════════════════════════════════════════════════════════════════
-- Só membros de DUPLA ATIVA: é o que faz o gatilho da U64 ter par para
-- preencher, e o apoio automático aparecer sozinho nos 30.
CREATE TEMP TABLE _tecnicos ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY p.nome) - 1 AS i, p.id
  FROM public.profiles p
 WHERE p.ativo IS DISTINCT FROM false
   AND EXISTS (SELECT 1 FROM public.duplas d
                WHERE d.ativa AND (d.membro_a = p.id OR d.membro_b = p.id));

CREATE TEMP TABLE _clientes ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY c.nome) - 1 AS i, c.id
  FROM public.clientes c;

DO $$
DECLARE t int; c int;
BEGIN
  SELECT count(*) INTO t FROM _tecnicos;
  SELECT count(*) INTO c FROM _clientes;
  IF t = 0 THEN
    RAISE EXCEPTION 'Nenhum técnico em dupla ativa. Cadastre as duplas antes (tela Operacional → Duplas), senão os 30 nasceriam sem responsável e sem apoio.';
  END IF;
  IF c = 0 THEN
    RAISE EXCEPTION 'Nenhum cliente cadastrado — os chamados de teste ficariam sem prédio.';
  END IF;
  RAISE NOTICE 'Distribuindo 30 chamados entre % técnico(s) e % cliente(s).', t, c;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) OS CHAMADOS
-- ═══════════════════════════════════════════════════════════════════════
-- O gatilho `chamado_preencher` fica LIGADO aqui (ao contrário da
-- importação): ele numera, e os prazos vêm escritos, então ele não tem o que
-- inventar. O de notificação fica desligado — 30 sinos de uma vez por dado
-- de teste é ruído.
ALTER TABLE public.chamados DISABLE TRIGGER trg_notify_chamado_ins;

INSERT INTO public.chamados (
  natureza, equipe, tipo, status, prioridade, titulo, descricao_problema,
  cliente_id, responsavel_id,
  created_at, data_hora_agendada, prazo_limite,
  iniciada_em, finalizada_em, concluida_em, fechada_em,
  tipo_servico, origem, origem_id
)
SELECT
  'campo', 'tecnica', s.tipo, s.status, s.prioridade, s.titulo,
  'Chamado fictício de teste (U65) — pode apagar com: '
    || 'DELETE FROM chamados WHERE origem = ''seed_teste'';',
  cl.id,
  CASE WHEN s.sem_dono THEN NULL ELSE tc.id END,
  now() - make_interval(days => s.dias_aberto),
  CASE WHEN s.dias_agenda IS NULL THEN NULL
       ELSE now() + make_interval(days => s.dias_agenda) END,
  CASE WHEN s.dias_prazo IS NULL THEN NULL
       ELSE now() + make_interval(days => s.dias_prazo) END,
  -- marcos de campo só nos que já começaram/terminaram, e sempre dentro da
  -- janela do próprio chamado: começou depois de aberto, terminou depois de
  -- começar. É a mesma ordem que os indicadores exigem (duração negativa é
  -- descartada em silêncio por indicadores.ts).
  CASE WHEN s.status IN ('em_andamento','concluido')
       THEN now() - make_interval(days => s.dias_aberto) + interval '3 hours' END,
  CASE WHEN s.status = 'concluido'
       THEN now() - make_interval(days => s.dias_aberto) + interval '5 hours' END,
  CASE WHEN s.status = 'concluido'
       THEN now() - make_interval(days => s.dias_aberto) + interval '5 hours' END,
  CASE WHEN s.status = 'concluido'
       THEN now() - make_interval(days => s.dias_aberto) + interval '5 hours' END,
  CASE WHEN s.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END,
  'seed_teste', 'TESTE-' || lpad(s.n::text, 2, '0')
FROM _seed s
-- distribuição por resto: espalha os 30 entre quem existe, sem repetir
-- padrão óbvio (o passo do cliente é 7 para não casar com o do técnico)
JOIN _tecnicos tc ON tc.i = s.n % (SELECT count(*) FROM _tecnicos)
JOIN _clientes cl ON cl.i = (s.n * 7) % (SELECT count(*) FROM _clientes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.chamados c
   WHERE c.origem = 'seed_teste' AND c.origem_id = 'TESTE-' || lpad(s.n::text, 2, '0')
);

ALTER TABLE public.chamados ENABLE TRIGGER trg_notify_chamado_ins;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) CONFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'chamados de teste' AS conferencia, count(*)::text AS valor, '30' AS esperado
  FROM public.chamados WHERE origem = 'seed_teste'
UNION ALL SELECT 'em aberto', count(*)::text, '26'
  FROM public.chamados WHERE origem = 'seed_teste'
    AND status IN ('aberto','agendado','em_andamento','stand_by')
UNION ALL SELECT 'com prazo estourado', count(*)::text, '4'
  FROM public.chamados WHERE origem = 'seed_teste'
    AND status IN ('aberto','agendado','em_andamento','stand_by') AND prazo_limite < now()
UNION ALL SELECT 'urgentes em aberto', count(*)::text, '3'
  FROM public.chamados WHERE origem = 'seed_teste'
    AND status IN ('aberto','agendado','em_andamento','stand_by') AND prioridade = 'urgente'
UNION ALL SELECT 'sem responsável', count(*)::text, '3'
  FROM public.chamados WHERE origem = 'seed_teste' AND responsavel_id IS NULL
-- as quatro colunas do quadro (R76), na MESMA precedência de
-- colunaOperacional: cancelado fora, concluído manda, atrasado vence
-- agendado, e o que sobra cai em "não agendado".
UNION ALL SELECT 'quadro · Não agendados', count(*)::text, '8'
  FROM public.chamados WHERE origem = 'seed_teste' AND status NOT IN ('concluido','cancelado')
    AND NOT (prazo_limite IS NOT NULL AND prazo_limite < now()) AND data_hora_agendada IS NULL
UNION ALL SELECT 'quadro · Agendados', count(*)::text, '14'
  FROM public.chamados WHERE origem = 'seed_teste' AND status NOT IN ('concluido','cancelado')
    AND NOT (prazo_limite IS NOT NULL AND prazo_limite < now()) AND data_hora_agendada IS NOT NULL
UNION ALL SELECT 'quadro · Atrasados', count(*)::text, '4'
  FROM public.chamados WHERE origem = 'seed_teste' AND status NOT IN ('concluido','cancelado')
    AND prazo_limite IS NOT NULL AND prazo_limite < now()
UNION ALL SELECT 'quadro · Concluídos', count(*)::text, '4'
  FROM public.chamados WHERE origem = 'seed_teste' AND status = 'concluido'
UNION ALL SELECT 'tipos distintos', count(DISTINCT tipo)::text, '4'
  FROM public.chamados WHERE origem = 'seed_teste'
UNION ALL
-- O MECANISMO DA U64 EM AÇÃO: quem tem responsável com dupla ganhou apoio
-- sozinho, sem ninguém preencher nada.
SELECT 'apoio preenchido pela dupla (U64)', count(*)::text, '27 (os que têm responsável, se a dupla dele tiver par)'
  FROM public.chamado_apoios a
  JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.origem = 'seed_teste' AND a.origem = 'dupla';

-- Quem ficou com o quê — dá para conferir o apoio automático olhando.
SELECT c.numero, c.titulo, c.status, c.prioridade,
       cl.nome AS cliente,
       COALESCE(pr.nome, '— sem responsável —') AS responsavel,
       COALESCE(pa.nome, '—') AS apoio_da_dupla
  FROM public.chamados c
  LEFT JOIN public.clientes cl ON cl.id = c.cliente_id
  LEFT JOIN public.profiles pr ON pr.id = c.responsavel_id
  LEFT JOIN public.chamado_apoios ap ON ap.chamado_id = c.id AND ap.origem = 'dupla'
  LEFT JOIN public.profiles pa ON pa.id = ap.profile_id
 WHERE c.origem = 'seed_teste'
 ORDER BY c.numero;

COMMIT;

-- ───────────────────────────────────────────────────────────────────────
-- APAGAR OS DADOS DE TESTE (os apoios saem junto, por CASCADE):
--   DELETE FROM public.chamados WHERE origem = 'seed_teste';
-- ───────────────────────────────────────────────────────────────────────
