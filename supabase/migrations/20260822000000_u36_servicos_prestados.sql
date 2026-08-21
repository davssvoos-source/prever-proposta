-- ═══════════════════════════════════════════════════════════════════════════
-- U36 — SERVIÇO PRESTADO POR CLIENTE (R41)
--
-- Propriedade nova em `clientes`: quais serviços a Prever presta ali. Por ora
-- dois — portaria remota e monitoramento de alarmes.
--
-- POR QUE ARRAY, E NÃO UMA COLUNA COM UM VALOR: um condomínio pode ter os
-- DOIS. Guardar um só forçaria uma escolha falsa no cadastro e, pior, faria o
-- filtro esconder o cliente da outra lista. Com conjunto, "quem tem portaria"
-- e "quem tem alarme" são duas perguntas independentes sobre o mesmo campo.
--
-- O CHECK usa `<@` (contido em): garante o vocabulário sem impedir que a
-- lista cresça — serviço novo é uma linha aqui, não uma tabela nova.
--
-- ── A MARCAÇÃO DOS 29 ──────────────────────────────────────────────────────
-- A lista de portaria remota veio com CNPJ, e é por ele que o de-para é
-- feito. Medido antes de escrever: 28 dos 29 casam por CNPJ e 1 por nome
-- (Las Vegas, que veio sem documento na origem).
--
-- O CNPJ não é preciosismo: QUATRO deles têm nome diferente na base do QAP —
-- "Villa Lagos" é "Vila Lagos", "Estoril" é "Estoril Sol", "Manhattans Home"
-- é "Manhattans" e "Eurico Gaspar Dutra" é "Gaspar Dutra". Casar por nome
-- perderia os quatro em silêncio, e ninguém notaria até alguém perguntar por
-- que a portaria de um prédio sumiu do filtro.
--
-- Idempotente: a marcação é um UPDATE que só acrescenta o serviço se ele
-- ainda não estiver lá. Ao final, um SELECT de verificação.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS servicos_prestados text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_servicos_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_servicos_check
  CHECK (servicos_prestados <@ ARRAY['portaria_remota', 'monitoramento_alarmes']::text[]);

COMMENT ON COLUMN public.clientes.servicos_prestados IS
  'Serviços que a Prever presta neste cliente. Conjunto: o mesmo cliente pode '
  'ter portaria remota E monitoramento de alarmes.';

-- índice GIN: o filtro da tela pergunta "contém portaria_remota", e sem ele
-- isso é varredura da tabela inteira a cada clique
CREATE INDEX IF NOT EXISTS clientes_servicos_idx
  ON public.clientes USING GIN (servicos_prestados);

-- ── Os 29 da portaria remota ────────────────────────────────────────────────
DROP TABLE IF EXISTS _portaria_u36;
CREATE TEMP TABLE _portaria_u36 (fantasia text, cnpj text);
INSERT INTO _portaria_u36 (fantasia, cnpj) VALUES
  ('Las Vegas',           NULL),                    -- veio sem CNPJ na origem
  ('Sunset',              '53.827.903/0001-07'),
  ('Azaleia',             '09.373.696/0001-76'),
  ('Recanto Butantã',     '15.631.900/0001-04'),
  ('Fairmont Village',    '02.840-219/0001-24'),
  ('Amarilis',            '57.395.055/0001-65'),
  ('Irapuru',             '38.892.212/0001-01'),
  ('Paineiras',           '190.489.04/0001-15'),
  ('Eurico Gaspar Dutra', '54.325.162/0001-29'),    -- no QAP: "Gaspar Dutra"
  ('Villa Lagos',         '23.982.514/0001-95'),    -- no QAP: "Vila Lagos"
  ('Estoril',             '62.286.653/0001-36'),    -- no QAP: "Estoril Sol"
  ('Isabela',             '38.656.945/0001-39'),
  ('Sobradão',            '54.204.680/0001-94'),
  ('Paulistano',          '14.634.392/0001-55'),
  ('Rio Azul',            '56.268.154/0001-13'),
  ('José Hachem',         '60.910.486/0001-27'),
  ('California',          '05.123.477/0001-88'),
  ('Umuarama',            '55.442.446/0001-68'),
  ('Aquidauana',          '66.053.521/0001-15'),
  ('Giovanni Pascoli',    '04.792.757/0001-16'),
  ('Pedro Adam',          '64.914.849/0001-53'),
  ('Manhattans Home',     '02.017.083/0001-57'),    -- no QAP: "Manhattans"
  ('In Out America',      '40.187.987/0001-10'),
  ('Capadócia',           '33.667.514/0001-54'),
  ('Eugenia Vitale',      '54.325.311/0001-50'),
  ('Villagio Suzana',     '17652494000191'),
  ('Vitoria Régia',       '64.728.124/0001-70'),
  ('Páteo Klabin',        '24.331.496/0001-44'),
  ('Velazquez',           '03.051.230/0001-78');

-- normalização de nome, igual à da U24 (minúsculas, sem acento)
CREATE OR REPLACE FUNCTION pg_temp.norm_u36(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(translate(lower(coalesce(t, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '\s+', ' ', 'g'))
$$;

-- PRÉ-VOO: quem da lista NÃO tem correspondente. Leia antes de seguir — se
-- voltar alguma linha, um prédio vai ficar sem a marcação e sem ninguém saber.
SELECT 'PRÉ-VOO · sem correspondente no cadastro' AS aviso, p.fantasia
  FROM _portaria_u36 p
 WHERE NOT EXISTS (
   SELECT 1 FROM public.clientes c
    WHERE (p.cnpj IS NOT NULL
           AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(p.cnpj, '\D', '', 'g'))
       OR pg_temp.norm_u36(c.nome) = pg_temp.norm_u36(p.fantasia)
 );

-- A marcação. `array_append` só quando ainda não está lá: rodar de novo não
-- duplica o serviço dentro do array.
UPDATE public.clientes c
   SET servicos_prestados = array_append(c.servicos_prestados, 'portaria_remota')
 WHERE NOT ('portaria_remota' = ANY (c.servicos_prestados))
   AND EXISTS (
     SELECT 1 FROM _portaria_u36 p
      WHERE (p.cnpj IS NOT NULL
             AND c.documento IS NOT NULL AND c.documento <> ''
             AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(p.cnpj, '\D', '', 'g'))
         OR pg_temp.norm_u36(c.nome) = pg_temp.norm_u36(p.fantasia)
   );

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'clientes com portaria remota (esperado 29)' AS item,
       count(*)::text AS valor
  FROM public.clientes WHERE 'portaria_remota' = ANY (servicos_prestados)
UNION ALL
SELECT 'linhas da lista sem cliente marcado (esperado 0)',
       count(*)::text
  FROM _portaria_u36 p
 WHERE NOT EXISTS (
   SELECT 1 FROM public.clientes c
    WHERE 'portaria_remota' = ANY (c.servicos_prestados)
      AND ((p.cnpj IS NOT NULL
            AND c.documento IS NOT NULL AND c.documento <> ''
            AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(p.cnpj, '\D', '', 'g'))
        OR pg_temp.norm_u36(c.nome) = pg_temp.norm_u36(p.fantasia))
 )
UNION ALL
SELECT 'serviço fora do vocabulário (esperado 0)',
       count(*)::text
  FROM public.clientes
 WHERE NOT (servicos_prestados <@ ARRAY['portaria_remota','monitoramento_alarmes']::text[]);
