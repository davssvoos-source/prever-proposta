-- ═══════════════════════════════════════════════════════════════════════════
-- U44 — MARCAÇÃO DE "MONITORAMENTO DE ALARMES" (R41, continuação da U36)
--
-- A U36 criou `clientes.servicos_prestados` e marcou os 29 de portaria
-- remota. Esta migration faz o mesmo para o OUTRO serviço do vocabulário —
-- `monitoramento_alarmes` — a partir da planilha "clientes-monitoramento"
-- que o Davi mandou (42 contas).
--
-- SÓ POR DOCUMENTO, DIFERENTE DA U36 (que também casava por nome): a
-- planilha de monitoramento tem fantasia em formato bem mais solto que a de
-- portaria ("Residencia Francisco (Rua Lelis Vieira, 201)", "RESIDENCIA
-- PARASMO (Residencia Ricardo Parasmo)"...) — um de-para por nome
-- normalizado erraria fácil. Em vez disso, cada linha abaixo foi conferida
-- À MÃO contra o cadastro (nome, documento OU endereço da U24) antes de
-- entrar nesta lista — o documento aqui é sempre o que já está em
-- `clientes.documento`, não o que veio (às vezes incompleto ou "0") na
-- planilha. Match por documento inteiro, sem fallback de nome: mais estrito
-- por construção, não precisa do fallback.
--
-- DUAS CONTAS PARA O MESMO CLIENTE, DE PROPÓSITO: "Páteo Klabin" (contas
-- 0040 e 4051) e "Ricardo Parasmo" (contas 9003 "Residencia Parasmo" e 8057
-- "Obra Ricardo Parasmo", mesmo CPF 035.531.948-98 nas duas) aparecem duas
-- vezes na planilha mas uma vez nesta lista — o UPDATE é por documento, uma
-- linha de sobra não muda o resultado (idempotente).
--
-- 9 CONTAS FICARAM DE FORA, sem correspondente confiável no cadastro atual
-- (nem por documento, nem por endereço exato) — marcá-las seria um chute:
--   · 9002 Residencia Beto (Rua Belini, 287)
--   · 8007 ALFALUX ALARME (R. Agostino Togneri, 617 — CNPJ "0" na planilha)
--   · 0039 Mãe Iliana (CPF 861.183.340-64)
--   · 1766 ARA ESCRITORIO RUA CAMPO VERDE
--   · 1655/1751 ARA RESIDENCIA — Ara Vartanian (Rua Lelis Vieira, 222)
--   · 1795 ARA LOJA IGUATEMI — Ara Vartanian (Rua Lelis Vieira, 222)
--   · 8047 Romma Serras (CNPJ 17.839.763/0001-23 — não bate com nada no cadastro)
--   · 8054 Residencia Adriana (Rua José Pedro Roschel, 4853 — rua bate com o
--     Sabuz da U24, mas o número não; pode ser outra casa na mesma rua)
--   · 8055 Residencia Valmir (Avenida Senador Teotônio Vilela, 4977)
-- Se algum destes já é cliente cadastrado sob outro nome, o PRÉ-VOO abaixo
-- não vai mostrá-los (eles nem entraram na lista) — quem decide se algum é
-- de fato um cliente existente é uma conferência humana, não este script.
--
-- Idempotente: rodar duas vezes não duplica o serviço no array. Termina com
-- um SELECT de verificação.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _monitoramento_u44;
CREATE TEMP TABLE _monitoramento_u44 (fantasia text, documento text);
INSERT INTO _monitoramento_u44 (fantasia, documento) VALUES
  ('Charm Bahia',                    '30.816.732/0001-15'),
  ('Residencia Francisco',           '303.129.968-02'),
  ('Lua de Algodão',                 '65.030.546/0001-30'),
  ('Lua de Algodão Fundamental',     '34.339.025/0001-36'),
  ('Simões & Cruz',                  '35.638.266/0001-49'),
  ('Universal Serras',               '02.409.968/0001-00'),
  ('Master Tower',                   '03.678.564/0001-76'),
  ('Green Village',                  '53.818.175/0001-77'),
  ('Residencia Nicole',              '367.844.618-35'),
  ('Ricardo Parasmo',                '035.531.948-98'),
  ('Condomínio Edifício Figueira',   '12.466.961/0001-75'),
  ('Artisan Moema',                  '49.995.453/0001-94'),
  ('Avant Garde',                    '10.994.733/0001-42'),
  ('GO Confecção',                   '39.631.243/0001-63'),
  ('Wafios',                         '62.249.586/0001-80'),
  ('San Francesco',                  '01.618.547/0001-18'),
  ('Humboldt',                       '57.036.782/0001-36'),
  ('Condominio Canamari',            '04.742.983/0001-92'),
  ('Residencia Robson Contador',     '012.282.648-56'),
  ('Grand Terrace Aclimação',        '20.135.644/0001-02'),
  ('Paço de Moema',                  '54.955.562/0001-18'),
  ('Ibira By You',                   '51.708.242/0001-75'),
  ('Associação Castelo',             '37.764.393/0001-10'),
  ('Clube Castelo',                  '60.554.623/0001-38'),
  ('Soma Perdizes',                  '56.911.617/0002-02'),
  ('Mirant',                         '53.963.516/0002-89'),
  ('Páteo Klabin',                   '24.331.496/0001-44'),
  ('Verana',                         '11.246.820/0001-84'),
  ('In Villa Lobos',                 '26.342.614/0001-45'),
  ('Alfaplast',                      '64.264.144/0001-38');

-- PRÉ-VOO (não altera nada; leia o resultado antes de seguir). Se voltar
-- alguma linha, o documento acima não bate com NENHUM cliente cadastrado —
-- os 30 já foram conferidos à mão, então uma linha aqui é sinal de que o
-- cadastro mudou desde esta migration (documento editado, cliente removido).
SELECT 'PRÉ-VOO · documento sem correspondente no cadastro' AS aviso, m.fantasia, m.documento
  FROM _monitoramento_u44 m
 WHERE NOT EXISTS (
   SELECT 1 FROM public.clientes c
    WHERE c.documento IS NOT NULL AND c.documento <> ''
      AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(m.documento, '\D', '', 'g')
 );

-- A marcação. `array_append` só quando ainda não está lá: rodar de novo não
-- duplica o serviço dentro do array.
UPDATE public.clientes c
   SET servicos_prestados = array_append(c.servicos_prestados, 'monitoramento_alarmes')
 WHERE NOT ('monitoramento_alarmes' = ANY (c.servicos_prestados))
   AND EXISTS (
     SELECT 1 FROM _monitoramento_u44 m
      WHERE c.documento IS NOT NULL AND c.documento <> ''
        AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(m.documento, '\D', '', 'g')
   );

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'clientes com monitoramento de alarmes (esperado 30)' AS item,
       count(*)::text AS valor
  FROM public.clientes WHERE 'monitoramento_alarmes' = ANY (servicos_prestados)
UNION ALL
SELECT 'linhas da lista sem cliente marcado (esperado 0)',
       count(*)::text
  FROM _monitoramento_u44 m
 WHERE NOT EXISTS (
   SELECT 1 FROM public.clientes c
    WHERE 'monitoramento_alarmes' = ANY (c.servicos_prestados)
      AND c.documento IS NOT NULL AND c.documento <> ''
      AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(m.documento, '\D', '', 'g')
 )
UNION ALL
SELECT 'serviço fora do vocabulário (esperado 0)',
       count(*)::text
  FROM public.clientes
 WHERE NOT (servicos_prestados <@ ARRAY['portaria_remota','monitoramento_alarmes']::text[]);
