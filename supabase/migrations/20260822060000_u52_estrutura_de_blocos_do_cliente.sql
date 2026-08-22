-- ═══════════════════════════════════════════════════════════════════════════
-- U52 — ESTRUTURA DE BLOCOS PERMANENTE DO CLIENTE (R63)
--
-- Davi, 2026-08-22: "Na página de cada cliente, nós vamos montar a estrutura
-- de cada cliente de acordo com os blocos de cada cliente. Uma vez que a
-- gente registrar o layout de cada cliente, não precisaremos mais fazer
-- isso, pois ficará salvo... por enquanto eu quero que você registre de
-- maneira ordenada, lógica e estruturada essas informações, crie a base
-- para isso funcionar, crie os campos na página de cada cliente."
--
-- NÃO É TABELA NOVA — `cliente_sistemas` (Etapa 2, U... "inventário do
-- cliente") já é "um bloco do mundo real no cliente" (docs/SISTEMA_OS.md
-- §4.2, literal) e já usa a MESMA taxonomia de categoria dos blocos do
-- orçamento (`tipo`). O que faltava era a CONFIGURAÇÃO do bloco — hoje
-- `cliente_sistemas` só guarda nome/descrição em texto livre; não sabia
-- dizer "2 barreiras, facial nas duas entradas, motor". Duas colunas novas:
--
--   codigo_bloco  text  — o código no MESMO formato do orçamento
--                         (PED-2B-PORP-FAC-FAC-MOT-...-PR), gerado por
--                         `gerarCodigoBloco()` (src/lib/blocos.ts) a partir
--                         de config_bloco. Guardado (não só calculado on the
--                         fly) pelo mesmo motivo de `visita_blocos.
--                         codigo_bloco`: é o que a busca/exibição/o motor de
--                         checklist por bloco vão ler direto, sem recalcular.
--   config_bloco  jsonb — a configuração estruturada, no MESMO formato do
--                         `BlocoConfig` de src/lib/blocos.ts (tipoBloco,
--                         eclusa, b1, b2, tecnologia, perimetro, esquinas,
--                         portaria...). JSONB, não ~20 colunas (b1_tipo,
--                         b1_entrada...) como `visita_blocos` — mesmo
--                         precedente de `visita_blocos.alarme_config`, e a
--                         vantagem aqui é maior: sem tradutor entre banco e
--                         `BlocoConfig`, o TypeScript lê a coluna e já tem o
--                         objeto que `gerarCodigoBloco`/`gerarDescricaoBloco`
--                         esperam.
--
-- SEM BACKFILL: sistema já cadastrado (nome/descrição em texto livre) fica
-- com config_bloco NULL — "ainda não estruturado", não "estruturado errado".
-- A tela continua funcionando para ele exatamente como antes; a estrutura é
-- opcional por cima do que já existia, não uma migração forçada.
--
-- ESCOPO DESTA RODADA (R63): só os 6 tipos que `gerarCodigoBloco` sabe
-- montar — PED, VEI, CFTV, AL, CER, CENT. ELV e TOT (kits de elevador e
-- totem) geram código por um caminho DIFERENTE no orçamento
-- (`ELV-{n}KIT`/`TOT-{n}x{m}CAM`, calculado direto nas mutações de
-- `blocos.$cat.tsx`, não por `gerarCodigoBloco`) — replicar os dois
-- sub-wizards deles aqui é passo futuro, não desta rodada. Ficam com
-- config_bloco NULL por enquanto, e a tela continua no modo simples
-- (nome/descrição) pra eles.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.cliente_sistemas
  ADD COLUMN IF NOT EXISTS codigo_bloco text,
  ADD COLUMN IF NOT EXISTS config_bloco jsonb;

COMMENT ON COLUMN public.cliente_sistemas.codigo_bloco IS
  'Código no formato do orçamento (PED-2B-PORP-FAC-FAC-MOT-...-PR), gerado '
  'por gerarCodigoBloco() a partir de config_bloco. Null = bloco ainda não '
  'estruturado (só nome/descrição em texto livre).';
COMMENT ON COLUMN public.cliente_sistemas.config_bloco IS
  'Configuração estruturada do bloco, no formato BlocoConfig de '
  'src/lib/blocos.ts. Null = bloco ainda não estruturado.';

CREATE INDEX IF NOT EXISTS cliente_sistemas_codigo_bloco_idx
  ON public.cliente_sistemas (codigo_bloco) WHERE codigo_bloco IS NOT NULL;

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'colunas novas existem' AS item,
       (EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='cliente_sistemas'
                   AND column_name='codigo_bloco')
        AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='cliente_sistemas'
                   AND column_name='config_bloco'))::text AS valor
UNION ALL
SELECT 'sistemas já com bloco estruturado (esperado 0 — sem backfill)',
       count(*)::text
  FROM public.cliente_sistemas WHERE config_bloco IS NOT NULL
UNION ALL
SELECT 'sistemas cadastrados no total (não muda com esta migration)',
       count(*)::text
  FROM public.cliente_sistemas;
