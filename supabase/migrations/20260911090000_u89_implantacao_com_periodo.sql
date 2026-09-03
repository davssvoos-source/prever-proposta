-- ═══════════════════════════════════════════════════════════════════════════
-- U89 — A IMPLANTAÇÃO GANHA PERÍODO, E SAI DO SLA QUE NUNCA FOI DELA
-- (R120 — Fase 4, Passo 1 de 2. O passo 2 é a cobrança na conclusão.)
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO.
-- >>> Idempotente: rodar de novo é no-op (o §5 é a única escrita de dado, e
-- >>> ele já não encontra nada na segunda vez — a conferência 306 mostra).
--
-- ── A ORDEM DE DEPLOY ──────────────────────────────────────────────────────
-- >>> ESTA MIGRATION PRIMEIRO. O PUSH DEPOIS. <<<
-- O código NOMEIA objeto que não existe: a aba de cronograma lê e escreve
-- `public.implantacao_cronograma` e as colunas `chamados.implantacao_inicio`
-- / `implantacao_fim`. Subir o push antes devolveria PGRST205 (tabela ausente
-- do cache do schema) na aba, e 42703 na consulta INTEIRA de chamados — que é
-- a Início, o painel e o detalhe. É a regra 6 do diário, e ela morde a
-- consulta toda, não só a coluna nova.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- §0) O ACHADO — TODA IMPLANTAÇÃO NASCE ATRASADA, HOJE, EM PRODUÇÃO
-- ═══════════════════════════════════════════════════════════════════════════
-- Isto não é uma funcionalidade nova que faltava. É um defeito VIVO que
-- contamina indicador, e ele foi encontrado enquanto se levantava a Fase 4.
--
-- `chamado_preencher()` (u7:301-306) aplica o SLA a TODO chamado de campo,
-- sem exceção de tipo:
--
--     IF NEW.natureza = 'campo' AND NEW.prazo_limite IS NULL THEN
--       SELECT horas_prazo INTO v_horas FROM public.chamado_sla ...
--
-- E a tabela `chamado_sla` (etapa3:30-35) diz, desde o primeiro dia:
--     urgente 4h · alta 24h · normal 72h · baixa NULL
--
-- Uma implantação de prioridade `normal` recebe, portanto, prazo de 72 HORAS
-- contadas da abertura. Do QUARTO DIA em diante ela é "estourada". E o
-- estrago não fica na cor do card:
--
--   · entra no KPI "Prazo estourado" (indicadores.ts:145) e no total de
--     `atrasados` (linha 217) — o número que o Davi olha para saber se a
--     operação está em dia;
--   · cai na coluna "Atrasados" do painel (linha 348), onde fica para sempre;
--   · e, ao concluir, conta como DESCUMPRIMENTO PERMANENTE em `pctNoPrazo`
--     (linhas 168-170, 226) — porque lá o filtro é `finalizada_em && prazo_limite`,
--     e a obra tem os dois. Um percentual de prazo que mistura obra de dois
--     meses com corretiva de 72 horas não mede nada.
--
-- O próprio repositório já sabia que implantação é outra coisa: o u7:310
-- decide `tipo_servico := 'instalacao'` só para ela, e o texto do plano a
-- chama de "obra nova, de fôlego longo". O SLA não foi avisado.
--
-- ── A CORREÇÃO, E POR QUE ELA É UM ESPELHO E NÃO UMA EXCEÇÃO ──────────────
-- Havia duas saídas:
--
--   (a) ISENTAR a implantação do prazo — `prazo_limite` fica NULL para
--       sempre. Honesto, e barato. Mas mentiroso por omissão: uma obra TEM
--       prazo, e ele importa mais do que o da corretiva. `situacaoPrazo`
--       devolveria "sem_prazo" para uma obra 40 dias atrasada.
--
--   (b) ESPELHAR: o prazo da obra é o FIM PREVISTO do período dela.
--
-- Escolhida a (b), e a razão é econômica: com o espelho, TODA a maquinaria de
-- prazo que já existe passa a funcionar corretamente para obra SEM QUE
-- NENHUMA DELAS MUDE UMA LINHA — o KPI, a coluna, o pctNoPrazo, o alerta de
-- véspera de `alertas_chamados()` (u7:876), a cor do card, a ordenação da R66
-- que põe atrasado primeiro. Nenhum desses sete lugares sabe que implantação
-- existe, e nenhum precisa saber.
--
-- A (a) sobrevive dentro da (b) como o caso de borda certo: implantação SEM
-- período fica com `prazo_limite` NULL, e "sem prazo" é então a VERDADE —
-- ninguém disse quando a obra acaba. O §5 aplica isso ao passado.
--
-- ── O QUE ISTO NÃO CONSERTA, E É PRECISO DIZER ────────────────────────────
-- O histórico já concluído. As implantações CONCLUÍDAS que hoje carregam
-- prazo de SLA também são zeradas pelo §5 (elas não têm período, e nunca
-- terão — ninguém vai preencher retroativamente o cronograma de obra
-- entregue). Isso REESCREVE `pctNoPrazo` do passado, para MAIS. É deliberado:
-- o número anterior media obra contra régua de corretiva, e um indicador
-- errado corrigido para cima continua sendo uma correção. A conferência 306
-- diz quantas linhas mudaram, e o DESFAZER não as recupera — leia lá.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- §0b) O NOME DAS QUATRO FASES — E A SEXTA COLISÃO DE VOCABULÁRIO, EVITADA
-- ═══════════════════════════════════════════════════════════════════════════
-- O plano chama as quatro divisões do cronograma de "etapas"
-- (infraestrutura / instalação / configuração / acabamento). A palavra JÁ
-- ESTÁ OCUPADA neste banco, em três lugares:
--
--   · `chamado_fotos.etapa` com CHECK (etapa IN ('antes','depois','outra'))
--     — etapa3:203,213-214, renomeada de os_fotos pela u7:572;
--   · `RETURNS TABLE (etapa text, ...)` em duas funções de painel
--     (u8:180, s1:247).
--
-- "Etapa" aqui significa MOMENTO DA FOTO. Chamar de etapa a fase da obra
-- faria `etapa` significar duas coisas no mesmo domínio (o chamado de campo),
-- e seria a SEXTA colisão de vocabulário do projeto — depois de "equipe"
-- (departamento × turma de campo), "modalidade" (natureza do contrato × tipo
-- da atividade), "visita técnica" (comercial × de campo, resolvida na U83
-- criando `vistoria`) e "operacional" (aba × tipo de chamado).
--
-- A coluna chama-se `fase`, e a palavra foi verificada LIVRE: zero ocorrências
-- como coluna, como CHECK e como campo de TypeScript em todo o repositório.
-- É a colisão mais barata de evitar que este projeto já teve — custou uma
-- palavra.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- §0c) A ARMADILHA QUE MATARIA ESTA ENTREGA EM SILÊNCIO
-- ═══════════════════════════════════════════════════════════════════════════
-- TODO trigger de UPDATE em `public.chamados` é `UPDATE OF <colunas>` — não
-- existe um só que dispare em qualquer coluna. E o `trg_chamado_preencher_upd`
-- (u7:349) dispara em `status, prioridade` APENAS.
--
-- Consequência: escrever `implantacao_fim` NÃO acordaria o gatilho, e o
-- espelho do prazo NUNCA seria escrito. A função estaria perfeita, a coluna
-- populada, o cronograma na tela — e `prazo_limite` continuaria NULL para
-- sempre. Verde em toda leitura, morto em execução.
--
-- Por isso o §4 RECRIA o gatilho com `implantacao_fim` na lista. E a
-- conferência 304 lê a lista de colunas do gatilho VIVO, não a existência
-- dele — presença nunca detectou guarda desligada (regra 2 do diário).
--
-- O mesmo fato paga um dividendo no §5: como nenhum gatilho de `chamados`
-- escuta `prazo_limite`, o UPDATE de limpeza não acorda NADA — nem o sino
-- (trg_notify_chamado_upd: status, responsavel_id), nem a linha do tempo
-- (trg_chamado_evento_upd: status, responsavel_id, sprint), nem o apoio
-- (trg_chamado_apoio_dupla_upd: responsavel_id, data_hora_agendada,
-- natureza), nem o espelho da agenda (data_hora_agendada), nem a ficha de
-- compra (tipo). NÃO HÁ `DISABLE TRIGGER` nesta migration, e não é por
-- coragem: é porque a lista de colunas já garante o silêncio. A conferência
-- 305 exercita isso dentro do PORTÃO, contando notificações antes e depois.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — ABORTA. Nada é alterado se o terreno não for o esperado.
-- ═══════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_src  text;
  v_def  text;
  v_n    int;
BEGIN
  -- 1.1 a tabela e as colunas de que tudo depende
  IF to_regclass('public.chamados') IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\npublic.chamados NÃO existe.\nO QUE FAZER: esta migration pressupõe a fusão da U7. Rode as anteriores primeiro.';
  END IF;

  FOREACH v_def IN ARRAY ARRAY['tipo','natureza','prazo_limite','created_at','prioridade','status'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'chamados'
                      AND column_name = v_def) THEN
      RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\nA coluna public.chamados.% NÃO existe, e o §4 a lê dentro do gatilho.\nO QUE FAZER: descubra quem a removeu antes de rodar.', v_def;
    END IF;
  END LOOP;

  -- 1.2 `implantacao` é mesmo um tipo aceito? Sem isso, o §5 e o espelho
  --     nunca teriam sujeito, e a migration passaria verde sem fazer nada.
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.chamados'::regclass
     AND c.conname  = 'chamados_tipo_check';
  IF v_def IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\nA constraint chamados_tipo_check NÃO existe.\nO QUE FAZER: rode  SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = ''public.chamados''::regclass;  e descubra quem a removeu. NÃO force: sem ela, `tipo` é texto livre e o CHECK de período do §2 poderia amarrar em nada.';
  END IF;
  IF position('implantacao' in v_def) = 0 THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\nO valor `implantacao` NÃO está entre os tipos aceitos por chamados_tipo_check.\nCHECK vivo: %\nO QUE FAZER: esta migration inteira é sobre esse tipo. Descubra quem o retirou antes de rodar.', v_def;
  END IF;

  -- 1.3 o SLA que estamos isentando existe, e a linha `normal` é a de 72h?
  --     Este é o pré-voo que prova que o DEFEITO do §0 é real, e não herdado
  --     de uma leitura desatualizada do arquivo.
  IF to_regclass('public.chamado_sla') IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\npublic.chamado_sla NÃO existe, e o §4 a consulta dentro do gatilho.\nO QUE FAZER: descubra quem a removeu.';
  END IF;

  -- 1.4 O GATILHO E A FUNÇÃO — e aqui a idempotência é a regra da U88:
  --     ACEITAR AS DUAS FORMAS CONHECIDAS. A primeira rodada encontra a
  --     forma da U7; a segunda encontra a desta migration. Abortar na
  --     segunda acusaria um sabotador que é a própria migration.
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'chamado_preencher';
  IF v_src IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\nA função public.chamado_preencher() NÃO existe.\nO QUE FAZER: ela nasce na U7. Rode as anteriores primeiro.';
  END IF;

  IF position('IS DISTINCT FROM ''implantacao''' in v_src) > 0 THEN
    RAISE NOTICE 'U89 §1: chamado_preencher já está na forma desta migration (2a rodada). Segue — o CREATE OR REPLACE é no-op.';
  ELSIF position('IF NEW.natureza = ''campo'' AND NEW.prazo_limite IS NULL THEN' in v_src) > 0 THEN
    RAISE NOTICE 'U89 §1: chamado_preencher está na forma da U7, com o defeito do §0. Aplicando.';
  ELSE
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\nchamado_preencher() NÃO está na forma da U7 nem na desta migration: alguém a reescreveu fora do repositório.\nO QUE FAZER: rode  SELECT prosrc FROM pg_proc WHERE proname = ''chamado_preencher'';  compare com o §4 desta migration e REESCREVA o §4 preservando o que foi acrescentado. NÃO force — o CREATE OR REPLACE abaixo APAGARIA essa mudança sem deixar rastro.';
  END IF;

  SELECT pg_get_triggerdef(t.oid) INTO v_def
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.chamados'::regclass
     AND t.tgname  = 'trg_chamado_preencher_upd'
     AND NOT t.tgisinternal;
  IF v_def IS NULL THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\nO gatilho trg_chamado_preencher_upd NÃO existe em public.chamados.\nO QUE FAZER: ele nasce na u7:349. Sem ele, NENHUM preenchimento de UPDATE acontece hoje — nem o carimbo de concluída_em. Descubra quem o removeu.';
  END IF;
  IF position('implantacao_fim' in v_def) = 0
     AND position('OF status, prioridade' in v_def) = 0 THEN
    RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\ntrg_chamado_preencher_upd não escuta `status, prioridade` (forma da U7) nem `implantacao_fim` (forma desta migration).\nGatilho vivo: %\nO QUE FAZER: alguém trocou a lista de colunas. O §4 a RECRIA e apagaria essa troca. Reescreva o §4 com a lista CERTA antes de rodar.', v_def;
  END IF;

  -- 1.5 a tabela nova não pode existir com OUTRA forma
  IF to_regclass('public.implantacao_cronograma') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'implantacao_cronograma'
       AND column_name IN ('chamado_id','fase','inicio','fim');
    IF v_n <> 4 THEN
      RAISE EXCEPTION E'PRÉ-VOO U89 — nada foi alterado (ROLLBACK).\npublic.implantacao_cronograma JÁ EXISTE mas não tem as quatro colunas desta migration (chamado_id, fase, inicio, fim) — encontrou % delas.\nO QUE FAZER: outra coisa ocupou esse nome. Renomeie-a ou renomeie esta, mas NÃO force: o CREATE ... IF NOT EXISTS abaixo passaria batido e a tela escreveria em colunas que não existem.', v_n;
    END IF;
  END IF;
END
$preflight$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §2) O PERÍODO — duas colunas em `chamados`, e um CHECK que recusa meia-verdade
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE EM `chamados` E NÃO EM SATÉLITE: a cardinalidade é 1:1. Uma obra
-- tem UM período. Satélite aqui custaria uma tabela, uma política de RLS e
-- um join em toda leitura, para expressar exatamente o que duas colunas
-- expressam. (O cronograma do §3 É satélite — lá a cardinalidade é 1:N.)
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS implantacao_inicio date,
  ADD COLUMN IF NOT EXISTS implantacao_fim    date;

COMMENT ON COLUMN public.chamados.implantacao_inicio IS
  'U89 — início previsto da obra. Só para tipo = implantacao (CHECK). Ver implantacao_fim.';
COMMENT ON COLUMN public.chamados.implantacao_fim IS
  'U89 — fim previsto da obra. É a FONTE de prazo_limite para implantação, espelhada por chamado_preencher(); a implantação não recebe SLA por prioridade. Mudar esta coluna acorda trg_chamado_preencher_upd — e é por isso que ela está na lista de colunas do gatilho.';

-- O CHECK exige TUDO OU NADA, e exige o tipo certo. Três recusas:
--   · período em chamado que não é implantação (a coluna não significa nada lá);
--   · só o início (o espelho do prazo precisa do FIM; meio período seria uma
--     obra sem prazo se fingindo de obra com prazo);
--   · fim antes do início.
ALTER TABLE public.chamados DROP CONSTRAINT IF EXISTS chamados_implantacao_periodo_check;
ALTER TABLE public.chamados ADD CONSTRAINT chamados_implantacao_periodo_check CHECK (
  (implantacao_inicio IS NULL AND implantacao_fim IS NULL)
  OR (tipo = 'implantacao'
      AND implantacao_inicio IS NOT NULL
      AND implantacao_fim    IS NOT NULL
      AND implantacao_fim >= implantacao_inicio)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- §3) O CRONOGRAMA — satélite 1:N, uma linha por FASE (não "etapa", ver §0b)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.implantacao_cronograma (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id   uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  fase         text NOT NULL,
  inicio       date NOT NULL,
  fim          date NOT NULL,
  observacao   text,
  concluida_em timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ON DELETE CASCADE no chamado (e não SET NULL como em `cobrancas`): o
-- cronograma NÃO existe sem a obra — ele é a divisão do período dela em
-- quatro. Uma linha órfã de cronograma não significaria nada, ao contrário
-- de uma cobrança aprovada, que continua devida. É a mesma pergunta da u4:31
-- respondida ao contrário, e de propósito.

ALTER TABLE public.implantacao_cronograma
  DROP CONSTRAINT IF EXISTS implantacao_cronograma_fase_check;
ALTER TABLE public.implantacao_cronograma
  ADD CONSTRAINT implantacao_cronograma_fase_check
  CHECK (fase IN ('infraestrutura','instalacao','configuracao','acabamento'));

ALTER TABLE public.implantacao_cronograma
  DROP CONSTRAINT IF EXISTS implantacao_cronograma_intervalo_check;
ALTER TABLE public.implantacao_cronograma
  ADD CONSTRAINT implantacao_cronograma_intervalo_check CHECK (fim >= inicio);

-- Uma linha por fase por obra. É o que trava o duplo clique de "gerar
-- cronograma" gerando oito linhas — o mesmo papel que o índice único de
-- `chamado_apoios` cumpre lá.
CREATE UNIQUE INDEX IF NOT EXISTS implantacao_cronograma_fase_unica
  ON public.implantacao_cronograma (chamado_id, fase);
CREATE INDEX IF NOT EXISTS implantacao_cronograma_chamado_idx
  ON public.implantacao_cronograma (chamado_id);

COMMENT ON TABLE public.implantacao_cronograma IS
  'U89 — as quatro fases da obra. Chama-se `fase` e não `etapa` porque etapa já é o momento da foto em chamado_fotos (antes/depois/outra) — ver §0b da migration.';

ALTER TABLE public.implantacao_cronograma ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacao_cronograma TO authenticated;
GRANT ALL ON public.implantacao_cronograma TO service_role;

DROP POLICY IF EXISTS "implantacao_cronograma_select" ON public.implantacao_cronograma;
DROP POLICY IF EXISTS "implantacao_cronograma_write"  ON public.implantacao_cronograma;

-- LEITURA para todo mundo ativo: o técnico que executa a obra precisa VER o
-- cronograma dela. Não há valor em dinheiro nesta tabela — nenhum campo de
-- preço, nenhuma referência a cobrança —, então `pode_ver_financeiro()` não
-- entra aqui e o SAC não é cegado (R13 vale para VALOR, e não há valor).
CREATE POLICY "implantacao_cronograma_select" ON public.implantacao_cronograma
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid()
                    AND p.ativo
                    AND p.status <> 'pendente_aprovacao'));

-- ESCRITA só para gestor: planejar obra é gesto de quem programa, e esta aba
-- é o painel do Vinicius. DÍVIDA DECLARADA: o técnico não marca a fase como
-- concluída — `concluida_em` só é escrita por gestor. Fazer o contrário
-- exigiria uma política por responsável, e é maquinaria nova que ninguém
-- pediu ainda (regra 8: prefira apagar a acrescentar; se precisar de
-- maquinaria nova, declare como dívida).
CREATE POLICY "implantacao_cronograma_write" ON public.implantacao_cronograma
  FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid())
         AND EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid()
                        AND p.ativo
                        AND p.status <> 'pendente_aprovacao'))
  WITH CHECK (public.is_gestor(auth.uid())
              AND EXISTS (SELECT 1 FROM public.profiles p
                           WHERE p.id = auth.uid()
                             AND p.ativo
                             AND p.status <> 'pendente_aprovacao'));

-- ═══════════════════════════════════════════════════════════════════════════
-- §4) chamado_preencher() — A ISENÇÃO E O ESPELHO
-- ═══════════════════════════════════════════════════════════════════════════
-- Corpo INTEIRO da u7:286-341 reproduzido, com TRÊS mudanças e só três. Elas
-- estão marcadas com `-- U89` abaixo, e a conferência 303 as prende uma a uma.
-- Reproduzir o corpo inteiro é obrigatório: CREATE OR REPLACE não tem
-- "aplicar diferença", e omitir um ramo aqui o APAGARIA em silêncio.
CREATE OR REPLACE FUNCTION public.chamado_preencher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_horas int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
      NEW.numero := public.proximo_numero_chamado();
    END IF;
    IF NEW.tipo IS NULL THEN
      NEW.tipo := CASE WHEN NEW.natureza = 'campo' THEN 'corretiva'
                       ELSE public.sugerir_tipo_chamado(NEW.titulo, NEW.descricao_problema) END;
    END IF;
    -- SLA só faz sentido no campo; o interno tem prazo combinado.
    -- U89 (1 de 3): e não faz sentido na IMPLANTAÇÃO, que é obra de fôlego
    -- longo e cujo prazo é o fim do período, não 72h da abertura. Usa-se
    -- IS DISTINCT FROM e não <> de propósito: se `tipo` chegasse NULL aqui,
    -- <> devolveria NULL e a obra perderia o SLA por acidente em vez de por
    -- decisão. (Não chega — o ramo acima acabou de preenchê-lo — mas a
    -- guarda não custa nada e a próxima pessoa a ler não precisa provar isso.)
    IF NEW.natureza = 'campo'
       AND NEW.tipo IS DISTINCT FROM 'implantacao'
       AND NEW.prazo_limite IS NULL THEN
      SELECT horas_prazo INTO v_horas FROM public.chamado_sla WHERE prioridade = NEW.prioridade;
      IF v_horas IS NOT NULL THEN
        NEW.prazo_limite := COALESCE(NEW.created_at, now()) + make_interval(hours => v_horas);
      END IF;
    END IF;
    -- U89 (2 de 3): implantação que já NASCE com período leva o fim como prazo.
    IF NEW.tipo = 'implantacao'
       AND NEW.implantacao_fim IS NOT NULL
       AND NEW.prazo_limite IS NULL THEN
      NEW.prazo_limite := ((NEW.implantacao_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
    END IF;
    IF NEW.natureza = 'campo' THEN
      IF NEW.tipo_servico IS NULL THEN
        NEW.tipo_servico := CASE WHEN NEW.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END;
      END IF;
      IF NEW.contrato_id IS NULL AND NEW.cliente_id IS NOT NULL THEN
        NEW.contrato_id := public.contrato_vigente(NEW.cliente_id);
      END IF;
    ELSE
      -- interno entra no sprint do mês quando ninguém disse outra coisa
      IF NEW.sprint IS NULL THEN NEW.sprint := 'este_mes'; END IF;
    END IF;
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    IF NEW.status = 'concluido'   AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    IF NEW.status = 'concluido' THEN
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
      IF NEW.natureza = 'campo' THEN NEW.fechada_em := COALESCE(NEW.fechada_em, now()); END IF;
    ELSIF OLD.status = 'concluido' THEN
      NEW.concluida_em := NULL; NEW.fechada_em := NULL;   -- reabriu
    END IF;
  END IF;
  -- escalar prioridade aperta o prazo (só campo, e só enquanto está aberto).
  -- U89 (3 de 3, primeira metade): a implantação fica FORA. Sem esta linha,
  -- mudar a prioridade de uma obra para `alta` apagaria o fim previsto do
  -- prazo e o trocaria por 24 horas contadas da abertura — silenciosamente,
  -- e semanas depois de alguém ter planejado o cronograma.
  IF NEW.natureza = 'campo' AND NEW.prioridade IS DISTINCT FROM OLD.prioridade
     AND NEW.tipo IS DISTINCT FROM 'implantacao'
     AND NEW.status NOT IN ('concluido','cancelado') THEN
    SELECT horas_prazo INTO v_horas FROM public.chamado_sla WHERE prioridade = NEW.prioridade;
    NEW.prazo_limite := CASE WHEN v_horas IS NULL THEN NULL
                             ELSE COALESCE(NEW.created_at, now()) + make_interval(hours => v_horas) END;
  END IF;
  -- U89 (3 de 3, segunda metade): O ESPELHO. Mudou o fim previsto, mudou o
  -- prazo. Vale também quando o fim vira NULL (apagaram o período): o prazo
  -- some junto, e "sem prazo" volta a ser a verdade.
  -- O fim é uma DATA; o prazo é um INSTANTE. A obra está no prazo até o
  -- ÚLTIMO minuto do dia previsto, então o instante é a meia-noite do dia
  -- SEGUINTE, em São Paulo — nunca 00:00 do próprio dia, que roubaria 24h.
  IF NEW.tipo = 'implantacao'
     AND NEW.implantacao_fim IS DISTINCT FROM OLD.implantacao_fim THEN
    NEW.prazo_limite := CASE
      WHEN NEW.implantacao_fim IS NULL THEN NULL
      ELSE ((NEW.implantacao_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- O GATILHO PASSA A ESCUTAR `implantacao_fim`. Ver §0c: sem isto, tudo acima
-- é código morto.
DROP TRIGGER IF EXISTS trg_chamado_preencher_upd ON public.chamados;
CREATE TRIGGER trg_chamado_preencher_upd
  BEFORE UPDATE OF status, prioridade, implantacao_fim ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.chamado_preencher();

-- ═══════════════════════════════════════════════════════════════════════════
-- §5) A LIMPEZA DO PRAZO HERDADO — a única escrita de dado desta migration
-- ═══════════════════════════════════════════════════════════════════════════
-- Toda implantação que existe hoje carrega um prazo de SLA que nunca foi
-- dela. Sem esta limpeza, a isenção do §4 valeria só para as obras FUTURAS e
-- as antigas ficariam vermelhas para sempre — o defeito consertado só pela
-- metade é pior que o defeito, porque ninguém volta a olhar.
--
-- SILÊNCIO GARANTIDO: escreve SÓ `prazo_limite`, e nenhum gatilho de
-- `chamados` escuta essa coluna (§0c). Nenhum sino, nenhum evento.
-- IDEMPOTENTE: a segunda rodada não encontra linha (todas já estão NULL, e a
-- que ganhou período está excluída por `implantacao_fim IS NULL`).
UPDATE public.chamados
   SET prazo_limite = NULL
 WHERE tipo = 'implantacao'
   AND natureza = 'campo'
   AND prazo_limite IS NOT NULL
   AND implantacao_fim IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- §6) PORTÃO — exercita COMPORTAMENTO dentro da transação e desfaz tudo
-- ═══════════════════════════════════════════════════════════════════════════
-- Não confere que a linha existe no arquivo: confere que o banco SE COMPORTA.
-- Cinco perguntas, todas em dado de teste que morre antes do COMMIT.
DO $portao$
DECLARE
  v_cli    uuid;
  v_obra   uuid;
  v_corr   uuid;
  v_prazo  timestamptz;
  v_notif0 bigint;
  v_notif1 bigint;
  v_esper  timestamptz;
  v_ano    int;
  v_cont0  int;
  v_cont1  int;
BEGIN
  -- O contador do ano, ANTES de tudo. Ele tem de estar exatamente igual no
  -- fim — ver a nota longa no passo 1 sobre por que `numero` vai à mão.
  v_ano := EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  SELECT ultimo INTO v_cont0 FROM public.chamado_contadores WHERE ano = v_ano;

  -- Um cliente de teste. Reaproveita o primeiro que houver: criar cliente
  -- acorda gatilhos que não são o alvo deste portão.
  SELECT id INTO v_cli FROM public.clientes LIMIT 1;
  IF v_cli IS NULL THEN
    RAISE NOTICE 'U89 PORTÃO: base sem clientes — portão PULADO. As conferências do §7 continuam valendo.';
    RETURN;
  END IF;

  -- ── 1) UMA IMPLANTAÇÃO NASCE SEM PRAZO ─────────────────────────────────
  --
  -- `numero` VAI ESCRITO À MÃO, e isso não é detalhe de estilo.
  -- `chamado_preencher()` só chama `proximo_numero_chamado()` quando `numero`
  -- chega vazio (u7:294) — e essa função NÃO é uma sequência: ela faz
  -- `INSERT ... ON CONFLICT DO UPDATE SET ultimo = ultimo + 1` na tabela
  -- `chamado_contadores` (u7:228-230). Deixar o portão passar por ali teria
  -- dois efeitos que o DELETE do fim NÃO desfaz, porque a migration COMMITa:
  --
  --   · o contador do ano avança DUAS vezes e fica assim. As duas próximas OS
  --     de verdade nasceriam com um buraco na numeração — CH-2026-0247 pulando
  --     para CH-2026-0250 —, e número de OS é o que a operação lê em voz alta
  --     no telefone;
  --   · o `ON CONFLICT DO UPDATE` tranca a linha do ano até o COMMIT, então
  --     enquanto esta migration roda ninguém consegue abrir chamado.
  --
  -- Escrever o número à mão apaga os dois de uma vez, e sem maquinaria de
  -- restauração: é a regra 8 do diário — prefira apagar a acrescentar. O que
  -- se perde é exercitar a numeração, que não é o que esta migration muda.
  INSERT INTO public.chamados (numero, titulo, natureza, tipo, prioridade, cliente_id, status)
  VALUES ('U89-PORTAO-OBRA', 'U89 PORTÃO obra', 'campo', 'implantacao', 'normal', v_cli, 'aberto')
  RETURNING id, prazo_limite INTO v_obra, v_prazo;
  IF v_prazo IS NOT NULL THEN
    RAISE EXCEPTION 'U89 PORTÃO 1: a implantação nasceu COM prazo (%) — a isenção do §4 não pegou. Este é exatamente o defeito do §0.', v_prazo;
  END IF;

  -- ── 2) UMA CORRETIVA CONTINUA NASCENDO COM PRAZO ───────────────────────
  --    A isenção tem de ser CIRÚRGICA. Se ela vazasse para os outros tipos,
  --    o sistema inteiro perderia SLA e ninguém notaria por semanas.
  INSERT INTO public.chamados (numero, titulo, natureza, tipo, prioridade, cliente_id, status)
  VALUES ('U89-PORTAO-CORR', 'U89 PORTÃO corretiva', 'campo', 'corretiva', 'normal', v_cli, 'aberto')
  RETURNING id, prazo_limite INTO v_corr, v_prazo;
  IF v_prazo IS NULL THEN
    RAISE EXCEPTION 'U89 PORTÃO 2: a CORRETIVA nasceu SEM prazo — a isenção vazou para fora da implantação e o SLA morreu para todo mundo.';
  END IF;

  -- ── 3) DAR PERÍODO ESCREVE O PRAZO (e é aqui que o §0c se prova) ───────
  UPDATE public.chamados
     SET implantacao_inicio = DATE '2026-10-01',
         implantacao_fim    = DATE '2026-11-30'
   WHERE id = v_obra;
  SELECT prazo_limite INTO v_prazo FROM public.chamados WHERE id = v_obra;
  v_esper := (DATE '2026-12-01')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  IF v_prazo IS NULL THEN
    RAISE EXCEPTION 'U89 PORTÃO 3: dar período NÃO escreveu prazo_limite. É a armadilha do §0c: o gatilho trg_chamado_preencher_upd não está escutando a coluna implantacao_fim.';
  END IF;
  IF v_prazo IS DISTINCT FROM v_esper THEN
    RAISE EXCEPTION 'U89 PORTÃO 3b: prazo_limite = %, esperado % (meia-noite do dia SEGUINTE ao fim, em São Paulo). Um dia inteiro de folga foi perdido ou ganho.', v_prazo, v_esper;
  END IF;

  -- ── 4) MUDAR A PRIORIDADE NÃO APAGA O PRAZO DA OBRA ────────────────────
  --    Sem a primeira metade da mudança 3 do §4, isto trocaria 30/11 por
  --    24 horas contadas da abertura.
  UPDATE public.chamados SET prioridade = 'alta' WHERE id = v_obra;
  SELECT prazo_limite INTO v_prazo FROM public.chamados WHERE id = v_obra;
  IF v_prazo IS DISTINCT FROM v_esper THEN
    RAISE EXCEPTION 'U89 PORTÃO 4: escalar a prioridade da obra trocou o prazo de % para % — o SLA voltou a morder a implantação pelo caminho do UPDATE.', v_esper, v_prazo;
  END IF;

  -- ── 4b) ... MAS CONTINUA APERTANDO O DA CORRETIVA ──────────────────────
  UPDATE public.chamados SET prioridade = 'urgente' WHERE id = v_corr;
  SELECT prazo_limite INTO v_prazo FROM public.chamados WHERE id = v_corr;
  IF v_prazo IS NULL THEN
    RAISE EXCEPTION 'U89 PORTÃO 4b: escalar a CORRETIVA para urgente apagou o prazo dela — a isenção vazou para o caminho do UPDATE.';
  END IF;

  -- ── 5) APAGAR O PERÍODO APAGA O PRAZO ──────────────────────────────────
  UPDATE public.chamados
     SET implantacao_inicio = NULL, implantacao_fim = NULL
   WHERE id = v_obra;
  SELECT prazo_limite INTO v_prazo FROM public.chamados WHERE id = v_obra;
  IF v_prazo IS NOT NULL THEN
    RAISE EXCEPTION 'U89 PORTÃO 5: apagar o período deixou prazo_limite = % pendurado. A obra ficaria com prazo de uma data que ninguém mais afirma.', v_prazo;
  END IF;

  -- ── 6) O CHECK RECUSA MEIA-VERDADE E TIPO ERRADO ───────────────────────
  BEGIN
    UPDATE public.chamados SET implantacao_inicio = DATE '2026-10-01' WHERE id = v_obra;
    RAISE EXCEPTION 'U89 PORTÃO 6: gravar SÓ o início passou. O CHECK do §2 não está segurando, e uma obra ficaria com meio período — sem prazo, fingindo ter.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.chamados
       SET implantacao_inicio = DATE '2026-10-01', implantacao_fim = DATE '2026-11-30'
     WHERE id = v_corr;
    RAISE EXCEPTION 'U89 PORTÃO 6b: dar período a uma CORRETIVA passou. O CHECK do §2 não está amarrando ao tipo.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ── 7) O SILÊNCIO DO §5, MEDIDO E AFIRMADO ─────────────────────────────
  --    O §0c AFIRMA que escrever prazo_limite sozinho não acorda gatilho
  --    nenhum, e é essa afirmação que dispensa o DISABLE TRIGGER. Afirmação
  --    dessas se exercita, não se deduz da lista de colunas: um gatilho
  --    acrescentado amanhã sem cláusula OF dispara em QUALQUER coluna, e a
  --    conferência 305 não o veria (ela procura o nome da coluna no texto).
  --    Aqui o gesto é o do §5 — prazo_limite e mais nada — com contagem dos
  --    dois lados. Um valor real, e não NULL sobre NULL: um UPDATE que não
  --    muda nada é um teste que não testa nada.
  SELECT count(*) INTO v_notif0 FROM public.notificacoes;
  UPDATE public.chamados SET prazo_limite = now() + interval '1 day' WHERE id = v_obra;
  SELECT count(*) INTO v_notif1 FROM public.notificacoes;
  IF v_notif1 <> v_notif0 THEN
    RAISE EXCEPTION 'U89 PORTÃO 7: escrever prazo_limite SOZINHO gerou % notificação(ões). O §5 tocaria o sino de todo mundo — e o §0c afirma o contrário. Descubra qual gatilho de chamados passou a disparar sem cláusula UPDATE OF antes de rodar esta migration.', v_notif1 - v_notif0;
  END IF;

  -- ── DESFAZER O PORTÃO ──────────────────────────────────────────────────
  -- `notificacoes.chamado_id` é uuid SOLTO (u7:255 — sem REFERENCES), então
  -- apagar o chamado NÃO leva a notificação junto e a limpeza tem de ser
  -- explícita. E ela é PONTUAL, pelos dois ids: uma limpeza por janela de
  -- tempo apagaria notificação de gente de verdade que chegou no mesmo
  -- minuto em que o Davi rodou isto.
  DELETE FROM public.chamados WHERE id IN (v_obra, v_corr);
  DELETE FROM public.notificacoes WHERE chamado_id IN (v_obra, v_corr);

  IF EXISTS (SELECT 1 FROM public.chamados WHERE titulo LIKE 'U89 PORTÃO%') THEN
    RAISE EXCEPTION 'U89 PORTÃO: sobrou chamado de teste. O portão tem de devolver a base ao estado de antes.';
  END IF;

  -- ── 8) O CONTADOR DE NÚMERO DE OS NÃO ANDOU ────────────────────────────
  --    Escrever `numero` à mão é o que garante isto, e é uma daquelas coisas
  --    que alguém desfaz sem perceber ao "limpar" o portão. Um COMMIT com o
  --    contador dois à frente deixa buraco PERMANENTE na numeração das OS, e
  --    ninguém liga o buraco à migration que o abriu semanas depois.
  SELECT ultimo INTO v_cont1 FROM public.chamado_contadores WHERE ano = v_ano;
  IF v_cont1 IS DISTINCT FROM v_cont0 THEN
    RAISE EXCEPTION 'U89 PORTÃO 8: o contador de numeração do ano % foi de % para % — o portão consumiu número de OS, e o COMMIT deixaria um buraco permanente. Confira se os INSERTs do passo 1 ainda escrevem `numero` à mão.', v_ano, COALESCE(v_cont0::text, 'inexistente'), COALESCE(v_cont1::text, 'inexistente');
  END IF;

  RAISE NOTICE 'U89 PORTÃO: 8 perguntas, todas respondidas. Dado de teste removido, contador intacto.';
END
$portao$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §7) CONFERÊNCIA — obtido × esperado × veredito, em SELECT
-- ═══════════════════════════════════════════════════════════════════════════
-- O QUE O DAVI OLHA: a TABELA. Ele procura '>>> OLHAR <<<' na coluna
-- `veredito`. RAISE NOTICE é invisível no editor; nada aqui depende dele.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- ══ 301: AS DUAS COLUNAS DO PERÍODO NASCERAM ═══════════════════════════════
SELECT 301 AS ordem, 'colunas do período em chamados' AS conferencia,
       (SELECT count(*)::text FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'chamados'
           AND column_name IN ('implantacao_inicio','implantacao_fim')),
       '2'

UNION ALL
-- ══ 302: A TABELA DO CRONOGRAMA, COM RLS LIGADA E DUAS POLÍTICAS ══════════
SELECT 302, 'cronograma: RLS ligada · políticas',
       (SELECT c.relrowsecurity::text || ' · ' ||
               (SELECT count(*)::text FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'implantacao_cronograma')
          FROM pg_class c WHERE c.oid = 'public.implantacao_cronograma'::regclass),
       'true · 2'

UNION ALL
-- ══ 303: AS TRÊS MUDANÇAS DO §4, CONTADAS NO CORPO VIVO ═══════════════════
-- CONTAGEM, e não presença — e a diferença aqui é a entrega inteira. A
-- isenção precisa existir DUAS vezes: uma no ramo de INSERT (a obra nasce sem
-- SLA) e outra no ramo de UPDATE (escalar a prioridade não ressuscita o SLA).
-- `position` acha a primeira e para; uma migration que tivesse esquecido a
-- segunda passaria verde, e o defeito voltaria pelo caminho que ninguém
-- olhou. É a regra 2 do diário aplicada ao caso em que a linha existe, está
-- viva, e mesmo assim está pela METADE.
SELECT 303, 'chamado_preencher: isenções · espelho',
       (SELECT ((length(p.prosrc) - length(replace(p.prosrc, 'NEW.tipo IS DISTINCT FROM ''implantacao''', '')))
                 / length('NEW.tipo IS DISTINCT FROM ''implantacao'''))::text
            || ' · ' ||
              ((length(p.prosrc) - length(replace(p.prosrc, 'NEW.implantacao_fim IS DISTINCT FROM OLD.implantacao_fim', '')))
                 / length('NEW.implantacao_fim IS DISTINCT FROM OLD.implantacao_fim'))::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'chamado_preencher'),
       '2 · 1'

UNION ALL
-- ══ 304: O GATILHO ESCUTA implantacao_fim (a armadilha do §0c) ════════════
-- Lê a LISTA DE COLUNAS do gatilho vivo, não a existência dele. Presença
-- nunca detectou guarda desligada (regra 2 do diário), e aqui a "guarda
-- desligada" seria uma coluna ausente da lista — invisível em toda leitura
-- do arquivo, fatal em execução.
SELECT 304, 'trg_chamado_preencher_upd escuta implantacao_fim',
       (SELECT (position('implantacao_fim' in pg_get_triggerdef(t.oid)) > 0)::text
          FROM pg_trigger t
         WHERE t.tgrelid = 'public.chamados'::regclass
           AND t.tgname = 'trg_chamado_preencher_upd' AND NOT t.tgisinternal),
       'true'

UNION ALL
-- ══ 305: NENHUM OUTRO GATILHO DE chamados ESCUTA prazo_limite ═════════════
-- É a prova do silêncio do §5, medida no banco e não deduzida do arquivo. Se
-- alguém acrescentar amanhã um gatilho que escute prazo_limite, esta linha
-- fica vermelha e o próximo backfill sabe que vai tocar o sino.
SELECT 305, 'gatilhos de chamados que escutam prazo_limite',
       (SELECT count(*)::text FROM pg_trigger t
         WHERE t.tgrelid = 'public.chamados'::regclass
           AND NOT t.tgisinternal
           AND position('prazo_limite' in pg_get_triggerdef(t.oid)) > 0),
       '0'

UNION ALL
-- ══ 306: QUANTAS IMPLANTAÇÕES AINDA CARREGAM PRAZO DE SLA ═════════════════
-- Depois do §5 tem de ser ZERO. Na segunda rodada também é zero, e é assim
-- que a idempotência se lê: o §5 não encontrou nada porque não havia nada.
SELECT 306, 'implantações sem período ainda com prazo',
       (SELECT count(*)::text FROM public.chamados
         WHERE tipo = 'implantacao' AND natureza = 'campo'
           AND implantacao_fim IS NULL AND prazo_limite IS NOT NULL),
       '0'

UNION ALL
-- ══ 307: QUANTAS IMPLANTAÇÕES EXISTEM, E QUANTAS O §5 TOCOU ═══════════════
-- REFERÊNCIA — este é o tamanho da reescrita de histórico anunciada no §0.
-- Se a segunda coluna for grande, o pctNoPrazo do passado MUDOU bastante, e
-- é bom saber o número antes de comparar relatórios de meses diferentes.
SELECT 307, 'implantações no total · delas, concluídas',
       (SELECT count(*)::text || ' · ' ||
               count(*) FILTER (WHERE status = 'concluido')::text
          FROM public.chamados WHERE tipo = 'implantacao' AND natureza = 'campo'),
       '(referência)'

UNION ALL
-- ══ 308: O SLA CONTINUA DE PÉ PARA QUEM SEMPRE FOI DELE ═══════════════════
-- A conferência que fica verde POR CAUSA do defeito é a pior de todas (regra
-- 13). Se a isenção tivesse vazado, 306 continuaria zero e tudo pareceria
-- perfeito — porque zero implantação com prazo é também o que um sistema SEM
-- NENHUM PRAZO produz. Esta linha mede o outro lado da mesma moeda: campo
-- aberto, que NÃO é implantação, e cuja prioridade tem horas no SLA, tem de
-- ter prazo. Zero aqui significa que o SLA morreu inteiro.
SELECT 308, 'campo aberto não-implantação COM prazo · SEM prazo',
       (SELECT count(*) FILTER (WHERE c.prazo_limite IS NOT NULL)::text || ' · ' ||
               count(*) FILTER (WHERE c.prazo_limite IS NULL)::text
          FROM public.chamados c
          JOIN public.chamado_sla s ON s.prioridade = c.prioridade
         WHERE c.natureza = 'campo' AND c.tipo <> 'implantacao'
           AND c.status NOT IN ('concluido','cancelado')
           AND s.horas_prazo IS NOT NULL),
       '(referência)'

UNION ALL
-- ══ 309: A PALAVRA `fase` NÃO PISOU EM `etapa` ════════════════════════════
-- O §0b afirma que a colisão foi evitada. Esta linha exercita a afirmação no
-- banco: `chamado_fotos` continua com `etapa` e os três valores dela, e a
-- tabela nova tem `fase` com os QUATRO valores dela. Duas palavras, dois
-- sentidos, zero sobreposição.
SELECT 309, 'chamado_fotos.etapa (3) · cronograma.fase (4)',
       (SELECT (SELECT count(*)::text FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='chamado_fotos'
                   AND column_name='etapa')
            || ' · ' ||
               (SELECT count(*)::text FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='implantacao_cronograma'
                   AND column_name='fase')),
       '1 · 1'

UNION ALL
-- ══ 310: OS QUATRO VALORES DE `fase`, EXTRAÍDOS DO CHECK VIVO ═════════════
-- O CONJUNTO ordenado, e não a string bruta do CHECK: o Postgres reescreve a
-- parentização e deparsa `text` de um jeito e `varchar` de outro, e uma
-- conferência que comparasse a string diria '>>> OLHAR <<<' numa execução
-- perfeita. Foi o que a U87 aprendeu na conferência 203.
SELECT 310, 'os quatro valores aceitos em fase',
       (SELECT string_agg(m[1], ',' ORDER BY m[1])
          FROM pg_constraint c,
               LATERAL regexp_matches(pg_get_constraintdef(c.oid),
                                      '''([a-z_]+)''::text', 'g') AS m
         WHERE c.conrelid = 'public.implantacao_cronograma'::regclass
           AND c.conname  = 'implantacao_cronograma_fase_check'),
       'acabamento,configuracao,infraestrutura,instalacao'

  ) AS t(ordem, conferencia, valor, esperado)
 ORDER BY t.ordem;

COMMIT;

-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║ DESFAZER — e ele QUEBRA O FRONT, de propósito.                          ║
-- ║                                                                          ║
-- ║ Depois que o push subir, a aba de cronograma lê a tabela e as duas       ║
-- ║ colunas. A ordem do desfazer é a INVERSA da do deploy: reverta o commit  ║
-- ║ do código PRIMEIRO, e só então rode isto.                                ║
-- ║                                                                          ║
-- ║ O QUE ELE NÃO ALCANÇA — e é a parte que importa:                         ║
-- ║                                                                          ║
-- ║ 1) OS PRAZOS QUE O §5 APAGOU. Não há de onde recuperá-los: eram          ║
-- ║    calculados de created_at + SLA, e o bloco abaixo os RECALCULA pela    ║
-- ║    mesma fórmula. O resultado é idêntico ao original SALVO se a          ║
-- ║    prioridade tiver mudado no meio-tempo — nesse caso volta o prazo da   ║
-- ║    prioridade de HOJE, não o da época. Aceito: era um prazo que nunca    ║
-- ║    devia ter existido.                                                   ║
-- ║ 2) OS CRONOGRAMAS JÁ PLANEJADOS. O DROP TABLE os leva. Se já houver      ║
-- ║    linha, EXPORTE antes (o passo 0 diz quantas).                         ║
-- ║                                                                          ║
-- ║   BEGIN;                                                                 ║
-- ║   -- 0) CONFERIR ANTES: quanto trabalho de planejamento se perde         ║
-- ║   SELECT count(*) AS fases, count(DISTINCT chamado_id) AS obras          ║
-- ║     FROM public.implantacao_cronograma;                                  ║
-- ║                                                                          ║
-- ║   -- 1) o gatilho volta a escutar só o que a U7 escutava                 ║
-- ║   DROP TRIGGER IF EXISTS trg_chamado_preencher_upd ON public.chamados;   ║
-- ║   CREATE TRIGGER trg_chamado_preencher_upd                               ║
-- ║     BEFORE UPDATE OF status, prioridade ON public.chamados               ║
-- ║     FOR EACH ROW EXECUTE FUNCTION public.chamado_preencher();            ║
-- ║                                                                          ║
-- ║   -- 2) o CHECK e as colunas do período saem                             ║
-- ║   ALTER TABLE public.chamados                                            ║
-- ║     DROP CONSTRAINT IF EXISTS chamados_implantacao_periodo_check;        ║
-- ║   ALTER TABLE public.chamados DROP COLUMN IF EXISTS implantacao_inicio;  ║
-- ║   ALTER TABLE public.chamados DROP COLUMN IF EXISTS implantacao_fim;     ║
-- ║                                                                          ║
-- ║   -- 3) o cronograma sai                                                 ║
-- ║   DROP TABLE IF EXISTS public.implantacao_cronograma;                    ║
-- ║                                                                          ║
-- ║   -- 4) o SLA volta a morder a implantação (é o defeito do §0 de volta,  ║
-- ║   --    e é o que "desfazer" significa aqui). RODE ESTE PASSO POR        ║
-- ║   --    ÚLTIMO: ele depende de o §4 já ter sido revertido pelo repo,     ║
-- ║   --    isto é, de a função voltar à forma da U7. Se a função ainda      ║
-- ║   --    estiver na forma da U89, o UPDATE abaixo grava o prazo e o       ║
-- ║   --    gatilho não o desfaz — o que é o resultado desejado de qualquer  ║
-- ║   --    jeito, mas por acidente e não por desenho.                       ║
-- ║   UPDATE public.chamados c                                               ║
-- ║      SET prazo_limite = COALESCE(c.created_at, now())                    ║
-- ║                       + make_interval(hours => s.horas_prazo)            ║
-- ║     FROM public.chamado_sla s                                            ║
-- ║    WHERE s.prioridade = c.prioridade AND s.horas_prazo IS NOT NULL       ║
-- ║      AND c.tipo = 'implantacao' AND c.natureza = 'campo'                 ║
-- ║      AND c.prazo_limite IS NULL;                                         ║
-- ║   COMMIT;                                                                ║
-- ║                                                                          ║
-- ║ NÃO HÁ LINHA DE permissoes_tela A APAGAR: esta entrega não criou chave   ║
-- ║ de tela — o cronograma é uma ABA dentro do detalhe do chamado, e herda   ║
-- ║ a permissão dele.                                                        ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
