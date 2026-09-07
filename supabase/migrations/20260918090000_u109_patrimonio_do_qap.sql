-- ═══════════════════════════════════════════════════════════════════════════
-- U109 — O PATRIMÔNIO DO QAP GANHA LUGAR NO BANCO (R196–R199)
--        catálogo de variações + itens físicos · a tela "Equipamentos
--        cadastrados" entra na matriz · a tela "Catálogo" (/admin) sai
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente.
-- >>> ORDEM: DEPOIS da U106 (a última rodada). O pré-voo abaixo aborta se as
-- >>>        tabelas de que ela depende (clientes, profiles, cliente_sistemas)
-- >>>        não existirem.
-- >>> ORDEM DE DEPLOY DO CÓDIGO: RODAR ESTA ANTES não é obrigatório, mas é o
-- >>>        melhor. O código publicado já lê as duas tabelas novas; enquanto
-- >>>        elas não existirem, a tela "Equipamentos cadastrados" mostra o
-- >>>        estado VAZIO com o aviso de que a migration U109 ainda não rodou
-- >>>        (o erro 42P01 é tratado, a tela não cai — ver
-- >>>        src/features/equipamentos/data.ts).
--
-- O QUE E POR QUÊ:
--
--   1) `catalogo_equipamentos` — uma linha por VARIAÇÃO de equipamento
--      (almoxarifado + nome + modelo + fabricante). É a tela "Equipamentos
--      cadastrados" (R198 — Davi, 04/09/2026: "Crie uma tela com
--      'Equipamentos cadastrados' contendo todas as variações de modelos de
--      equipamentos que foram cadastrados nessa rodada de acesso ao QAP, e aí
--      essa tela será o nosso catalogo"). `nome` é o "Tipo de Categoria" do
--      QAP (R196 — Davi: "O Tipo de categoria é o nome do equipamento no
--      nosso formato"). A "Categoria" do QAP NÃO entra, por pedido dele.
--
--      SEM COLUNA DE VALOR, de propósito. O passo seguinte é "inserir
--      valores", e valor tem regra própria nesta casa: a R13 barra o SAC de
--      ver dinheiro e a R164 restringe valor a admin e comercial. RLS trava
--      LINHA, não COLUNA — uma coluna de preço nesta tabela (que o técnico
--      precisa ler para ver o equipamento do cliente) vazaria preço para
--      quem não pode ver. O valor nasce na próxima migration, em tabela
--      própria, atrás de `pode_ver_financeiro` — como a S4 já faz.
--
--   2) `equipamentos_patrimonio` — o item FÍSICO. Aponta para a variação e
--      guarda o que é dele: identificação (opcional, R197 — Davi: "nem todo
--      equipamento tem identificação… mas de qualquer jeito deve ter o espaço
--      para por a identificação"), o local, e a data de envio.
--
--      TRÊS COLUNAS PARA O "LOCAL / PESSOA" do QAP, e as três importam:
--        · `local_qap` — o TEXTO CRU, sempre que existir. É o que permite
--          refazer o vínculo depois sem voltar ao QAP, e é o que sai no
--          relatório de locais desconhecidos (R199). ACEITA NULO porque a
--          extração de 04/09/2026 achou 5 itens (de 4.241) que o QAP traz com
--          a coluna Local/Pessoa vazia: NULO diz "não havia nada lá", e
--          string vazia num campo obrigatório seria fingir que havia.
--        · `cliente_id` — quando o texto casou EXATO com um cliente nosso.
--        · `pessoa_id` — quando casou com uma pessoa nossa (o QAP mistura os
--          dois na mesma coluna: "Soma Perdizes Offices" é cliente,
--          "Giovanni Pascoli" é gente). Equipamento com pessoa é equipamento
--          que está COM alguém, não num prédio.
--      Local que não casou fica com os dois nulos e o texto guardado — nunca
--      se adivinha o prédio (pôr equipamento no prédio errado é pior que
--      deixá-lo sem vínculo).
--
--      `cliente_sistema_id` NASCE NULA e é o gancho do passo seguinte (R199 —
--      Davi: "posteriormente iremos associar cada equipamento a um bloco do
--      condomínio… Antes ainda vamos cadastrar os sistemas implantados em
--      cada cliente"). Fica aqui porque é uma FK nullable: criá-la agora
--      custa nada e evita uma migration só para ela.
--
--      `chave_importacao` é o que faz REIMPORTAR não duplicar nem perder
--      item. A lógica que a monta é pura e testada
--      (src/features/equipamentos/importacao.ts): com o id interno do QAP é
--      ele; sem ele, é a linha normalizada mais um ORDINAL entre linhas
--      idênticas — sem o ordinal, dez botões de emergência iguais no mesmo
--      cliente no mesmo dia (que é o normal quando não há identificação)
--      colapsariam em UM no `ON CONFLICT DO NOTHING`, e nove itens sumiriam
--      sem erro nenhum.
--
--   3) permissoes_tela: entra 'equipamentos' — técnico não, comercial sim,
--      SAC não (o catálogo vai receber valor, e a R13/R164 mandam) — e SAI
--      'admin', a tela "Catálogo" que o Davi mandou excluir (R198). A rota
--      /admin passa a redirecionar para /equipamentos.
--
-- O QUE ESTA MIGRATION NÃO FAZ:
--   · NÃO apaga a tabela `equipamentos` (a antiga, com custo/markup): ela é o
--     catálogo do ORÇAMENTO — `visita_bloco_itens.cod_eq` aponta para ela e o
--     wizard da proposta a lê. O Davi mandou excluir a TELA, não a tabela; e a
--     R166 já dizia que o catálogo seria refeito. Enquanto o novo não assumir
--     o orçamento, apagá-la derrubaria a geração de proposta.
--   · NÃO importa item nenhum. Os 4.241 itens vêm na U110, gerada por
--     `scripts/gerar-migration-equipamentos.cjs` a partir do retrato do QAP.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pré-voo: o que esta migration referencia tem de existir ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'clientes') THEN
    RAISE EXCEPTION 'U109: a tabela public.clientes nao existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'cliente_sistemas') THEN
    RAISE EXCEPTION 'U109: a tabela public.cliente_sistemas nao existe — rode a etapa2_inventario antes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'pode_ver_cliente') THEN
    RAISE EXCEPTION 'U109: a funcao public.pode_ver_cliente nao existe — rode a S1 antes';
  END IF;
END $$;

-- ── 1) o catálogo de variações (R198) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalogo_equipamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- os quatro campos que definem a variação (R196)
  almoxarifado  text NOT NULL,
  nome          text NOT NULL,
  modelo        text,
  fabricante    text,
  -- a chave normalizada que a importação usa para não duplicar variação
  chave         text NOT NULL,
  observacao    text,
  origem        text NOT NULL DEFAULT 'qap',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_equipamentos_origem_check CHECK (origem IN ('qap', 'manual'))
);

COMMENT ON TABLE  public.catalogo_equipamentos IS
  'R198 (U109): uma linha por VARIACAO de equipamento (almoxarifado + nome + modelo + fabricante). E a tela "Equipamentos cadastrados". Nao confundir com public.equipamentos, que e o catalogo do ORCAMENTO (custo/markup, lido pelo wizard da proposta).';
COMMENT ON COLUMN public.catalogo_equipamentos.nome IS
  'R196: o "Tipo de Categoria" do QAP — o nome do equipamento no nosso formato. A "Categoria" do QAP nao entra, por decisao do Davi.';
COMMENT ON COLUMN public.catalogo_equipamentos.chave IS
  'R198: almoxarifado|nome|modelo|fabricante normalizados (chaveDaVariacao em src/features/equipamentos/importacao.ts). E a chave de idempotencia da importacao.';

CREATE UNIQUE INDEX IF NOT EXISTS catalogo_equipamentos_chave_idx
  ON public.catalogo_equipamentos (chave);
CREATE INDEX IF NOT EXISTS catalogo_equipamentos_almoxarifado_idx
  ON public.catalogo_equipamentos (almoxarifado, nome);

-- ── 2) o item físico (R196, R197, R199) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipamentos_patrimonio (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id        uuid NOT NULL REFERENCES public.catalogo_equipamentos(id) ON DELETE RESTRICT,

  -- R197: pode faltar — e o campo existe de qualquer jeito
  identificacao      text,

  -- o "Local / Pessoa" do QAP, nas três formas (ver o cabeçalho)
  local_qap          text,
  cliente_id         uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  pessoa_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- "Data de envio" do QAP; nula quando o QAP não trouxe data legível
  enviado_em         date,

  -- o gancho do passo seguinte: o bloco/sistema do condomínio (R199)
  cliente_sistema_id uuid REFERENCES public.cliente_sistemas(id) ON DELETE SET NULL,

  origem             text NOT NULL DEFAULT 'qap',
  chave_importacao   text,
  observacao         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipamentos_patrimonio_origem_check CHECK (origem IN ('qap', 'manual')),
  -- o item está NUM LUGAR ou COM ALGUÉM, nunca nos dois
  CONSTRAINT equipamentos_patrimonio_um_vinculo CHECK (num_nonnulls(cliente_id, pessoa_id) <= 1)
);

COMMENT ON TABLE  public.equipamentos_patrimonio IS
  'R196 (U109): o equipamento FISICO importado do QAP (Patrimonio > Local/Uso). Sete campos, por decisao do Davi: almoxarifado, nome (Tipo de Categoria), modelo e fabricante ficam no catalogo; identificacao, local e data de envio ficam aqui.';
COMMENT ON COLUMN public.equipamentos_patrimonio.local_qap IS
  'R199: o texto CRU do "Local / Pessoa" do QAP, guardado sempre — mesmo quando casou com cliente ou pessoa. E o que permite refazer o vinculo sem voltar ao QAP. NULO = o QAP trouxe a coluna vazia (5 itens em 4.241 na extracao de 04/09/2026).';
COMMENT ON COLUMN public.equipamentos_patrimonio.cliente_sistema_id IS
  'R199: nasce NULA. O passo seguinte cadastra os sistemas de cada cliente e depois vincula cada equipamento a um bloco.';
COMMENT ON COLUMN public.equipamentos_patrimonio.chave_importacao IS
  'Idempotencia da importacao: id do QAP quando existe; senao a linha normalizada + ORDINAL entre linhas identicas (chaveDeImportacao em src/features/equipamentos/importacao.ts). Sem o ordinal, itens iguais sem identificacao colapsariam num so.';

CREATE UNIQUE INDEX IF NOT EXISTS equipamentos_patrimonio_chave_idx
  ON public.equipamentos_patrimonio (chave_importacao)
  WHERE chave_importacao IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipamentos_patrimonio_cliente_idx
  ON public.equipamentos_patrimonio (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipamentos_patrimonio_pessoa_idx
  ON public.equipamentos_patrimonio (pessoa_id) WHERE pessoa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipamentos_patrimonio_catalogo_idx
  ON public.equipamentos_patrimonio (catalogo_id);
-- identificação NÃO é única de propósito: o QAP tem repetição, e travar aqui
-- faria a importação inteira falhar por um número de série digitado duas vezes.
-- O relatório da importação conta as repetições para o Davi ver.
CREATE INDEX IF NOT EXISTS equipamentos_patrimonio_identificacao_idx
  ON public.equipamentos_patrimonio (identificacao) WHERE identificacao IS NOT NULL;

-- updated_at pelo gatilho da casa
DROP TRIGGER IF EXISTS catalogo_equipamentos_set_updated_at ON public.catalogo_equipamentos;
CREATE TRIGGER catalogo_equipamentos_set_updated_at
  BEFORE UPDATE ON public.catalogo_equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS equipamentos_patrimonio_set_updated_at ON public.equipamentos_patrimonio;
CREATE TRIGGER equipamentos_patrimonio_set_updated_at
  BEFORE UPDATE ON public.equipamentos_patrimonio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3) RLS — as duas nascem trancadas ───────────────────────────────────────
ALTER TABLE public.catalogo_equipamentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_patrimonio   ENABLE ROW LEVEL SECURITY;

-- O CATÁLOGO é lido por todo mundo autenticado: é vocabulário (nome, modelo,
-- fabricante), não dado de cliente nem dinheiro — e o técnico precisa dele
-- para ler o equipamento que está no prédio. Escrever é de gestor.
--
-- E "de gestor" AQUI É is_gestor MAIS O VÍNCULO ATIVO, como na U87 e na U89 —
-- nunca is_gestor sozinho. A dívida P51 é medida pelo verificador: is_gestor()
-- decide por cargo e por papel e NÃO olha `profiles.ativo`, então um
-- ex-funcionário com login vivo seria gestor para o sistema inteiro. Enquanto
-- a P51 estiver de pé, o teste de dois eixos vem escrito ao lado.
DROP POLICY IF EXISTS "catalogo_equipamentos_select" ON public.catalogo_equipamentos;
CREATE POLICY "catalogo_equipamentos_select" ON public.catalogo_equipamentos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "catalogo_equipamentos_insert" ON public.catalogo_equipamentos;
CREATE POLICY "catalogo_equipamentos_insert" ON public.catalogo_equipamentos
  FOR INSERT TO authenticated WITH CHECK (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));
DROP POLICY IF EXISTS "catalogo_equipamentos_update" ON public.catalogo_equipamentos;
CREATE POLICY "catalogo_equipamentos_update" ON public.catalogo_equipamentos
  FOR UPDATE TO authenticated
  USING      (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'))
  WITH CHECK (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));
DROP POLICY IF EXISTS "catalogo_equipamentos_delete" ON public.catalogo_equipamentos;
CREATE POLICY "catalogo_equipamentos_delete" ON public.catalogo_equipamentos
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));

-- O ITEM segue o acesso ao CLIENTE (a régua da S1/U71): gestor vê tudo; o
-- técnico vê o equipamento dos clientes que ele atende e o que está COM ELE.
-- Item sem vínculo (local desconhecido, R199) é do gestor — é inventário
-- nosso, e quem vai resolver o vínculo é quem administra a base.
DROP POLICY IF EXISTS "equipamentos_patrimonio_select" ON public.equipamentos_patrimonio;
CREATE POLICY "equipamentos_patrimonio_select" ON public.equipamentos_patrimonio
  FOR SELECT TO authenticated
  USING (
    (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'))
    OR (cliente_id IS NOT NULL AND public.pode_ver_cliente(cliente_id))
    OR pessoa_id = auth.uid()
  );
DROP POLICY IF EXISTS "equipamentos_patrimonio_insert" ON public.equipamentos_patrimonio;
CREATE POLICY "equipamentos_patrimonio_insert" ON public.equipamentos_patrimonio
  FOR INSERT TO authenticated WITH CHECK (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));
DROP POLICY IF EXISTS "equipamentos_patrimonio_update" ON public.equipamentos_patrimonio;
CREATE POLICY "equipamentos_patrimonio_update" ON public.equipamentos_patrimonio
  FOR UPDATE TO authenticated
  USING      (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'))
  WITH CHECK (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));
DROP POLICY IF EXISTS "equipamentos_patrimonio_delete" ON public.equipamentos_patrimonio;
CREATE POLICY "equipamentos_patrimonio_delete" ON public.equipamentos_patrimonio
  FOR DELETE TO authenticated USING (public.is_gestor(auth.uid())
          AND EXISTS (SELECT 1 FROM public.profiles p
                       WHERE p.id = auth.uid() AND p.ativo AND p.status <> 'pendente_aprovacao'));

-- ── 4) a matriz de telas: entra 'equipamentos', sai 'admin' (R198) ──────────
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('equipamentos', 'tecnico', false), ('equipamentos', 'comercial', true), ('equipamentos', 'sac', false)
ON CONFLICT (tela, cargo) DO NOTHING;

DELETE FROM public.permissoes_tela WHERE tela IN ('admin');

-- ── Verificação ─────────────────────────────────────────────────────────────
WITH conferencia AS (
  SELECT 1 AS n, 'as duas tabelas existem' AS o_que,
         (SELECT count(*)::text FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name IN ('catalogo_equipamentos', 'equipamentos_patrimonio')) AS obtido,
         '2' AS esperado
  UNION ALL
  SELECT 2, 'RLS ligada nas duas',
         (SELECT count(*)::text FROM pg_class c JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
           WHERE nsp.nspname = 'public'
             AND c.relname IN ('catalogo_equipamentos', 'equipamentos_patrimonio')
             AND c.relrowsecurity), '2'
  UNION ALL
  SELECT 3, 'oito policies (quatro em cada)',
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('catalogo_equipamentos', 'equipamentos_patrimonio')), '8'
  UNION ALL
  SELECT 4, 'a chave da variação é única',
         (SELECT CASE WHEN count(*) = 1 THEN 'sim' ELSE 'NAO' END FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'catalogo_equipamentos_chave_idx'), 'sim'
  UNION ALL
  SELECT 5, 'a tela equipamentos entrou na matriz (3 linhas)',
         (SELECT count(*)::text FROM public.permissoes_tela WHERE tela = 'equipamentos'), '3'
  UNION ALL
  SELECT 6, 'comercial vê equipamentos; técnico e SAC não',
         (SELECT string_agg(cargo || '=' || permitido::text, ',' ORDER BY cargo)
            FROM public.permissoes_tela WHERE tela = 'equipamentos'),
         'comercial=true,sac=false,tecnico=false'
  UNION ALL
  SELECT 7, 'linhas órfãs da tela admin (esperado 0)',
         (SELECT count(*)::text FROM public.permissoes_tela WHERE tela = 'admin'), '0'
  UNION ALL
  SELECT 8, 'a tabela do orçamento (equipamentos) continua intacta',
         (SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                                    WHERE table_schema = 'public' AND table_name = 'equipamentos')
                 THEN 'sim' ELSE 'NAO' END), 'sim'
  UNION ALL
  SELECT 9, 'nenhum item importado ainda (a U110 traz os itens)',
         (SELECT count(*)::text FROM public.equipamentos_patrimonio), '0'
  UNION ALL
  SELECT 10, 'local_qap aceita nulo (5 itens do QAP vêm sem local)',
         (SELECT is_nullable FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'equipamentos_patrimonio'
             AND column_name = 'local_qap'), 'YES'
)
SELECT n, o_que, obtido, esperado,
       CASE WHEN obtido = esperado THEN 'ok' ELSE '>>> OLHAR <<<' END AS veredito
  FROM conferencia
 ORDER BY n;

-- ── DESFAZER ────────────────────────────────────────────────────────────────
-- ║ BEGIN;
-- ║   DROP TABLE IF EXISTS public.equipamentos_patrimonio;
-- ║   DROP TABLE IF EXISTS public.catalogo_equipamentos;
-- ║   DELETE FROM public.permissoes_tela WHERE tela = 'equipamentos';
-- ║   INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
-- ║     ('admin', 'tecnico', false), ('admin', 'comercial', false), ('admin', 'sac', false)
-- ║   ON CONFLICT (tela, cargo) DO NOTHING;
-- ║ COMMIT;
-- ║
-- ║ E o front teria de voltar junto (git revert do commit da U109): a tela
-- ║ /equipamentos, o bloco de equipamentos na ficha do cliente, a chave no
-- ║ telas.ts e o /admin que hoje redireciona. Sem a linha 'admin' na matriz a
-- ║ chave volta ao PADRÃO DO CATÁLOGO — e ela já era [false,false,false], com
-- ║ o cargo admin passando por regra de sistema, então o Catálogo antigo
-- ║ reapareceria só para o admin, como sempre foi.
-- ║
-- ║ DADOS: nada é apagado por esta migration além das linhas de permissão da
-- ║ tela 'admin' — e o DESFAZER acima as recria.
