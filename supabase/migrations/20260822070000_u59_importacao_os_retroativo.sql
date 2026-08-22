-- U59 — IMPORTAÇÃO RETROATIVA das 227 OS de manutenção (R70).
-- Fonte: lista-OS-retroativo/os_manutencao.csv (export "Tarefas por Técnico",
-- aberturas de 2026-06-02 a 2026-08-21). Pedido do Davi, 2026-08-22.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor).                <<<
-- >>> É IDEMPOTENTE: rodar de novo não duplica nada (chave `origem_id`).   <<<
-- >>> LEIA OS SELECTs DO FIM — eles dizem o que casou e o que não casou.   <<<
--
-- AS DUAS REGRAS DITADAS
--   1. "Como os chamados não têm título, coloque todos os títulos sendo o
--      tipo de demanda" → titulo = 'Manutenção Corretiva' (220),
--      'Implantação' (4) e 'Manutenção Preventiva' (3).
--   2. "Considere todos os itens Instalação como Implantação" → o tipo
--      'Instalação' da origem entra como `implantacao`, e o título dele é
--      'Implantação'. A palavra "Instalação" não sobra em lugar nenhum.
--
-- O QUE ENTRA
--   · natureza 'campo', equipe 'tecnica', status 'concluido' (as 227 estão
--     'Fechada' na origem), prioridade 'normal' (a origem não tem prioridade).
--   · created_at = data_abertura; finalizada_em/concluida_em/fechada_em =
--     data_conclusao. É isso que faz os indicadores lerem o histórico real.
--   · numero CH-2026-XXXX na ORDEM CRONOLÓGICA de abertura — chamado mais
--     antigo com número menor. A numeração sai do MESMO contador do app
--     (`chamado_contadores`), então o próximo chamado aberto na tela continua
--     de onde esta importação parou.
--   · numero_legado e origem_id = OS0001…OS0227. O primeiro serve para busca;
--     o segundo é a chave de idempotência e de desfazer.
--
-- O QUE **NÃO** ENTRA, DE PROPÓSITO — a régua do módulo: na dúvida, não invente
--   · prazo_limite fica NULO. O trigger `chamado_preencher` calcularia um
--     prazo de SLA a partir do created_at — um prazo que nunca existiu para
--     estas OS. E o indicador "Cumprimento de prazo" conta justamente quem
--     tem prazo E conclusão: as 227 entrariam com prazo inventado e mudariam
--     o número da operação inteira. Por isso a seção 4 desliga esse trigger e
--     a numeração é feita à mão na seção 3.
--   · iniciada_em fica NULO. A origem não tem hora de início: `duracao_horas`
--     é tempo de CICLO (abertura→fechamento), não esforço em campo — o
--     próprio README do dataset avisa. Preencher iniciada_em com a abertura
--     faria "tempo até começar" virar 0h nas 227 e apagaria um indicador que
--     hoje diz a verdade.
--   · contrato_id fica NULO: `contrato_vigente()` devolve o contrato de HOJE,
--     e amarrar contrato atual a serviço fechado há três meses é inventar
--     vínculo de cobrança.
--
-- NOTIFICAÇÕES: os avisos são desligados durante a carga. Sem isso, cada
-- técnico receberia 227 sinos de "Novo chamado para você" por trabalho que
-- ele terminou meses atrás.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) A LISTA, COMO VEIO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TEMP TABLE _os_retro (
  os_id          text PRIMARY KEY,
  data_abertura  timestamptz NOT NULL,
  data_conclusao timestamptz NOT NULL,
  tipo           text NOT NULL,
  titulo         text NOT NULL,
  tecnico        text,
  apoio          text,
  solicitante    text,
  conta          text,
  cliente_nome   text,
  cliente_razao  text
) ON COMMIT DROP;

INSERT INTO _os_retro
  (os_id, data_abertura, data_conclusao, tipo, titulo, tecnico, apoio,
   solicitante, conta, cliente_nome, cliente_razao)
VALUES
  ('OS0001', '2026-06-02T08:43:40', '2026-06-02T10:43:05', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2050', 'Villa Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0002', '2026-06-02T08:44:35', '2026-06-09T09:33:15', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2350', 'Condomínio Las Vegas', 'Condomínio Las Vegas'),
  ('OS0003', '2026-06-02T08:45:14', '2026-06-09T09:33:57', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0004', '2026-06-02T08:45:49', '2026-06-09T09:35:41', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0005', '2026-06-02T08:46:56', '2026-06-02T14:30:53', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3850', 'ESTORIL', 'CONTRATANTE CONDOMINIO EDIFICIO ESTORIL SOL'),
  ('OS0006', '2026-06-02T08:47:47', '2026-06-02T17:52:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0007', '2026-06-02T08:49:18', '2026-06-09T09:36:34', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0008', '2026-06-02T08:49:57', '2026-06-02T10:34:08', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0009', '2026-06-02T16:40:38', '2026-06-03T11:29:44', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0010', '2026-06-03T13:26:55', '2026-06-08T13:12:08', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0011', '2026-06-03T14:35:37', '2026-06-08T13:11:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0012', '2026-06-05T09:16:25', '2026-06-05T09:22:33', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0013', '2026-06-05T09:17:19', '2026-06-05T11:01:46', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0014', '2026-06-06T14:01:22', '2026-06-09T09:37:43', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0015', '2026-06-07T10:28:55', '2026-06-07T12:57:45', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3050', 'Eurico Gaspar Dutra', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0016', '2026-06-08T07:11:31', '2026-06-08T16:55:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '1150', 'Azaleia', 'Condominio Edificio Azaleia'),
  ('OS0017', '2026-06-08T13:08:33', '2026-06-08T13:16:17', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0018', '2026-06-08T13:08:59', '2026-06-08T13:18:50', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3050', 'Eurico Gaspar Dutra', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0019', '2026-06-08T13:09:26', '2026-06-08T13:13:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0020', '2026-06-08T13:11:06', '2026-06-08T13:14:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0021', '2026-06-08T13:12:12', '2026-06-08T13:17:55', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0022', '2026-06-08T13:12:42', '2026-06-09T09:38:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0023', '2026-06-08T13:13:21', '2026-06-08T15:03:01', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3050', 'Eurico Gaspar Dutra', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0024', '2026-06-09T13:53:03', '2026-06-09T17:05:57', 'implantacao', 'Implantação', 'Lucas', 'Paulo', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0025', '2026-06-09T13:59:44', '2026-06-26T13:52:52', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1950', 'Grupo Prever', 'Grupo Prever'),
  ('OS0026', '2026-06-09T16:17:51', '2026-06-09T17:58:35', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0027', '2026-06-10T06:05:52', '2026-06-10T07:15:03', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0028', '2026-06-11T20:48:41', '2026-06-11T21:57:53', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0029', '2026-06-12T06:19:03', '2026-06-12T14:14:31', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0030', '2026-06-12T13:20:15', '2026-06-12T15:59:31', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0031', '2026-06-20T20:40:23', '2026-06-21T12:04:54', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '1350', 'Fairmont Village', 'CONDOMINO FAIRMONT VILLAGE'),
  ('OS0032', '2026-06-22T08:07:53', '2026-06-22T12:22:36', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3850', 'ESTORIL', 'CONTRATANTE CONDOMINIO EDIFICIO ESTORIL SOL'),
  ('OS0033', '2026-06-22T11:01:52', '2026-06-22T13:39:07', 'preventiva', 'Manutenção Preventiva', 'Breno', 'Luan', 'Monitoramento', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0034', '2026-06-22T13:25:35', '2026-06-22T17:57:49', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0035', '2026-06-27T12:45:24', '2026-06-29T10:42:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '1350', 'Fairmont Village', 'CONDOMINO FAIRMONT VILLAGE'),
  ('OS0036', '2026-06-29T10:16:42', '2026-06-29T11:00:35', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '8050', 'Link Studios & Office', 'Link Studios & Office'),
  ('OS0037', '2026-07-01T05:55:52', '2026-07-01T16:37:19', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0038', '2026-07-01T11:17:57', '2026-07-02T14:19:10', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Monitoramento', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0039', '2026-07-01T11:21:34', '2026-07-02T15:13:58', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0040', '2026-07-01T20:01:12', '2026-07-01T22:04:46', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0041', '2026-07-02T08:18:05', '2026-07-02T10:11:51', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Area Tecnica', '0037', 'NICOLAU ALAYON', 'NICOLAU ALAYON'),
  ('OS0042', '2026-07-02T11:23:53', '2026-07-07T09:52:59', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0043', '2026-07-05T11:55:39', '2026-07-06T18:33:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0044', '2026-07-05T14:12:07', '2026-07-30T14:16:23', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0045', '2026-07-06T09:38:54', '2026-07-06T15:22:16', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0046', '2026-07-06T09:39:34', '2026-07-06T16:14:13', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0047', '2026-07-06T09:40:19', '2026-07-06T18:19:07', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0048', '2026-07-06T13:01:47', '2026-07-06T15:17:50', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8003', 'ASTURIAS', 'CONDOMINIO EDIFICIO ASTURIAS'),
  ('OS0049', '2026-07-07T16:16:45', '2026-07-08T16:20:07', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7011', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0050', '2026-07-08T09:10:24', '2026-07-08T10:24:59', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0051', '2026-07-08T09:22:20', '2026-07-08T13:56:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0052', '2026-07-08T09:24:03', '2026-07-08T15:22:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0053', '2026-07-08T09:24:25', '2026-07-08T17:40:26', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0054', '2026-07-08T09:33:14', '2026-07-08T12:48:53', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0055', '2026-07-08T09:33:34', '2026-07-08T15:56:13', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8044', 'Lua de Algodão Ensino Fundamental', 'Lua de Algodão'),
  ('OS0056', '2026-07-08T09:34:04', '2026-07-08T18:39:04', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8042', 'Lua de Algodão', 'Lua de Algodão'),
  ('OS0057', '2026-07-08T09:34:27', '2026-07-08T14:22:52', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1150', 'Azaleia', 'Condominio Edificio Azaleia'),
  ('OS0058', '2026-07-10T08:54:49', '2026-07-10T09:45:39', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', NULL, '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0059', '2026-07-10T08:55:35', '2026-07-10T11:12:15', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0060', '2026-07-10T08:56:06', '2026-07-10T11:24:38', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3850', 'ESTORIL', 'CONTRATANTE CONDOMINIO EDIFICIO ESTORIL SOL'),
  ('OS0061', '2026-07-10T08:57:59', '2026-07-10T12:05:50', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0041', 'Mirant Studios', 'Mirant Studios'),
  ('OS0062', '2026-07-10T10:36:33', '2026-07-28T17:10:10', 'implantacao', 'Implantação', 'André', 'Denner', 'Monitoramento', '4250', 'CONDOMÍNIO VELAZQUEZ', 'Condomínio Velazquez'),
  ('OS0063', '2026-07-10T15:05:19', '2026-07-13T08:59:43', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Area Tecnica', '0008', 'ECO LIFE', 'CONDOMÍNIO EDIFICIO ECO LIFE CIDADE UNIVERSITARIA'),
  ('OS0064', '2026-07-10T15:05:39', '2026-07-10T16:10:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0065', '2026-07-11T10:59:23', '2026-07-11T12:33:16', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0066', '2026-07-11T22:04:22', '2026-07-11T23:59:38', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0067', '2026-07-12T14:41:42', '2026-07-12T16:46:14', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0068', '2026-07-13T08:36:40', '2026-07-13T18:43:05', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2750', 'Paulistano', 'Condomínio Edifício Paulistano'),
  ('OS0069', '2026-07-13T08:37:18', '2026-07-14T12:04:17', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3650', 'In Out America', 'CONDOMINIO IN OUT AMERICA'),
  ('OS0070', '2026-07-13T08:46:21', '2026-07-13T17:05:18', 'preventiva', 'Manutenção Preventiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0071', '2026-07-13T09:08:25', '2026-07-13T10:41:07', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0072', '2026-07-13T20:31:05', '2026-07-13T20:53:50', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0073', '2026-07-14T10:07:10', '2026-07-22T11:34:02', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0074', '2026-07-14T10:07:38', '2026-07-14T10:30:56', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0075', '2026-07-15T10:13:51', '2026-07-15T19:49:10', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8050', 'Link Studios & Office', 'Link Studios & Office'),
  ('OS0076', '2026-07-15T10:50:57', '2026-07-15T17:08:41', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0077', '2026-07-15T16:30:32', '2026-07-15T18:23:00', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0078', '2026-07-16T05:02:22', '2026-07-16T07:34:15', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0079', '2026-07-16T10:13:31', '2026-07-16T10:19:09', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8032', 'Paco de Moema', 'Paco de Moema'),
  ('OS0080', '2026-07-16T10:15:12', '2026-07-16T18:09:16', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0081', '2026-07-16T10:16:00', '2026-07-16T17:06:11', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4450', 'Pedro Adam', 'Condomínio Edifício Pedro Adam'),
  ('OS0082', '2026-07-16T14:28:51', '2026-07-17T14:33:12', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8007', 'ALFALUX ALARME', 'ALFALUX'),
  ('OS0083', '2026-07-16T23:58:29', '2026-07-17T15:53:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0084', '2026-07-17T09:09:03', '2026-07-17T16:32:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3650', 'In Out America', 'CONDOMINIO IN OUT AMERICA'),
  ('OS0085', '2026-07-17T09:15:20', '2026-07-17T11:19:10', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0086', '2026-07-17T09:22:13', '2026-07-23T11:51:06', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8046', 'Universal Serras', 'UNIVERSAL SERRAS INDUSTRIA E COMERCIO LTDA'),
  ('OS0087', '2026-07-17T09:54:52', '2026-07-17T17:10:43', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0088', '2026-07-17T09:55:33', '2026-07-17T12:48:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3050', 'Eurico Gaspar Dutra', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0089', '2026-07-17T12:17:53', '2026-07-17T16:08:17', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0090', '2026-07-17T17:43:54', '2026-07-18T16:39:49', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0091', '2026-07-18T13:45:59', '2026-07-18T16:38:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0092', '2026-07-18T14:49:22', '2026-07-18T18:10:18', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0093', '2026-07-19T02:39:54', '2026-07-19T04:34:04', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0094', '2026-07-19T19:44:18', '2026-07-19T21:42:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0095', '2026-07-20T11:25:46', '2026-07-20T12:50:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2250', 'Aquidauana', 'CONDOMINIO EDIFICIO AQUIDAUANA'),
  ('OS0096', '2026-07-20T11:31:56', '2026-07-20T12:06:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0097', '2026-07-20T13:43:07', '2026-07-20T17:16:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4250', 'CONDOMÍNIO VELAZQUEZ', 'Condomínio Velazquez'),
  ('OS0098', '2026-07-20T13:43:44', '2026-07-20T15:42:18', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0099', '2026-07-21T10:03:17', '2026-07-21T16:26:55', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '1250', 'Manhattans Home', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0100', '2026-07-21T14:07:54', '2026-07-21T16:28:19', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0101', '2026-07-21T14:08:37', '2026-07-21T15:38:14', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0102', '2026-07-21T14:10:14', '2026-07-23T14:03:24', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0103', '2026-07-21T14:17:56', '2026-07-21T18:05:17', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1650', 'VILLAGIO SUZANA', 'Condomínio Residencial Villagio Suzana'),
  ('OS0104', '2026-07-21T18:09:45', '2026-07-21T22:17:26', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0105', '2026-07-21T21:39:08', '2026-07-21T22:18:34', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0106', '2026-07-22T09:54:46', '2026-07-30T12:26:43', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '1250', 'Manhattans Home', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0107', '2026-07-22T11:20:51', '2026-07-22T11:35:47', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0108', '2026-07-22T11:21:12', '2026-07-22T17:57:11', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0109', '2026-07-22T11:22:01', '2026-07-22T17:11:56', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0039', 'Mãe Iliana', 'Mãe Iliana'),
  ('OS0110', '2026-07-22T11:22:24', '2026-07-22T17:16:14', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0111', '2026-07-23T10:29:43', '2026-07-24T12:59:28', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0112', '2026-07-23T12:40:07', '2026-07-23T15:29:16', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0113', '2026-07-23T17:01:37', '2026-07-23T17:45:16', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2050', 'Villa Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0114', '2026-07-23T18:20:03', '2026-07-23T20:36:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0115', '2026-07-23T21:50:15', '2026-07-24T10:11:56', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0116', '2026-07-24T07:12:22', '2026-07-24T10:09:01', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2050', 'Villa Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0117', '2026-07-24T10:56:08', '2026-07-24T17:01:49', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '7011', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0118', '2026-07-24T10:57:26', '2026-07-24T16:23:29', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3150', 'Giovanni Pascoli', 'Condomínio Edifício Giovanni Pascoli'),
  ('OS0119', '2026-07-24T10:58:29', '2026-07-24T17:22:38', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0120', '2026-07-24T10:59:07', '2026-07-24T12:37:48', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8032', 'Paco de Moema', 'Paco de Moema'),
  ('OS0121', '2026-07-24T11:12:28', '2026-07-24T11:40:03', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0122', '2026-07-24T11:47:11', '2026-07-24T13:36:41', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8050', 'Link Studios & Office', 'Link Studios & Office'),
  ('OS0123', '2026-07-24T14:29:26', '2026-07-24T14:48:21', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8032', 'Paco de Moema', 'Paco de Moema'),
  ('OS0124', '2026-07-24T15:39:09', '2026-07-24T18:25:27', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '7009', 'Associação Castelo', 'Associação Castelo'),
  ('OS0125', '2026-07-24T16:55:14', '2026-07-24T17:44:57', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1650', 'VILLAGIO SUZANA', 'Condomínio Residencial Villagio Suzana'),
  ('OS0126', '2026-07-24T19:05:16', '2026-07-28T17:14:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2050', 'Villa Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0127', '2026-07-25T16:54:06', '2026-07-25T20:51:38', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0128', '2026-07-25T18:47:31', '2026-07-25T19:15:51', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2350', 'Condomínio Las Vegas', 'Condomínio Las Vegas'),
  ('OS0129', '2026-07-26T15:48:53', '2026-07-26T17:40:14', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0130', '2026-07-27T09:56:11', '2026-07-27T10:43:23', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0131', '2026-07-27T10:50:32', '2026-07-27T11:31:52', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8050', 'Link Studios & Office', 'Link Studios & Office'),
  ('OS0132', '2026-07-27T10:50:58', '2026-07-27T15:15:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0133', '2026-07-27T15:10:08', '2026-07-27T16:11:22', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0134', '2026-07-28T13:42:20', '2026-07-28T17:13:09', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0135', '2026-07-28T13:46:57', '2026-07-28T16:16:47', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0136', '2026-07-28T17:59:49', '2026-07-28T21:19:56', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2750', 'Paulistano', 'Condomínio Edifício Paulistano'),
  ('OS0137', '2026-07-28T22:02:18', '2026-07-28T22:15:37', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0138', '2026-07-29T08:19:40', '2026-07-29T11:03:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0139', '2026-07-29T08:20:22', '2026-07-29T20:59:50', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7002', 'In Villa Lobos', 'IN Villa Lobos'),
  ('OS0140', '2026-07-29T08:20:57', '2026-07-29T10:10:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8029', 'CONCORDE', 'Edificio Concorde'),
  ('OS0141', '2026-07-29T08:21:19', '2026-07-29T12:31:33', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2250', 'Aquidauana', 'CONDOMINIO EDIFICIO AQUIDAUANA'),
  ('OS0142', '2026-07-29T08:21:45', '2026-07-29T15:25:30', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2350', 'Condomínio Las Vegas', 'Condomínio Las Vegas'),
  ('OS0143', '2026-07-29T13:57:18', '2026-07-29T15:36:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0144', '2026-07-29T14:41:45', '2026-07-29T18:23:46', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0145', '2026-07-29T15:04:35', '2026-07-29T16:39:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0146', '2026-07-30T09:45:58', '2026-07-30T12:28:58', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0147', '2026-07-30T11:19:08', '2026-07-30T12:27:23', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1250', 'Manhattans Home', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0148', '2026-07-30T14:18:17', '2026-07-31T00:39:39', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0149', '2026-08-03T09:07:01', '2026-08-03T11:23:53', 'implantacao', 'Implantação', 'Breno', 'Luan', 'Area Tecnica', '8023', 'GOBS', 'Gobs Comercial Importadora e Exportadora Ltda ME'),
  ('OS0150', '2026-08-03T09:08:02', '2026-08-03T12:45:58', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0151', '2026-08-03T09:08:51', '2026-08-04T10:05:36', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0152', '2026-08-03T09:09:55', '2026-08-03T18:19:46', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8044', 'Lua de Algodão Ensino Fundamental', 'Lua de Algodão'),
  ('OS0153', '2026-08-03T09:23:42', '2026-08-03T09:40:08', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '3350', 'Rio Azul', 'CONDOMINIO EDIFÍCIO RIO AZUL'),
  ('OS0154', '2026-08-03T14:58:52', '2026-08-03T16:29:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0155', '2026-08-03T16:20:12', '2026-08-03T17:44:58', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0156', '2026-08-03T17:39:27', '2026-08-03T18:35:47', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2750', 'Paulistano', 'Condomínio Edifício Paulistano'),
  ('OS0157', '2026-08-04T09:44:24', '2026-08-04T19:03:24', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8043', 'Residencia Francisco', 'Rua Lelis Vieira, 201) (Residencia Francisco (Rua Lelis Vieira, 201)'),
  ('OS0158', '2026-08-04T12:16:42', '2026-08-04T13:59:44', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0159', '2026-08-04T12:17:28', '2026-08-05T09:23:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0160', '2026-08-04T18:02:50', '2026-08-05T09:24:13', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0161', '2026-08-04T18:34:53', '2026-08-04T18:50:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0162', '2026-08-05T10:11:04', '2026-08-05T11:19:35', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2350', 'Condomínio Las Vegas', 'Condomínio Las Vegas'),
  ('OS0163', '2026-08-05T10:12:45', '2026-08-05T16:36:34', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0164', '2026-08-06T09:56:19', '2026-08-06T11:16:30', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2350', 'Condomínio Las Vegas', 'Condomínio Las Vegas'),
  ('OS0165', '2026-08-06T09:56:44', '2026-08-06T16:36:23', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0166', '2026-08-06T09:57:06', '2026-08-06T17:07:54', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0167', '2026-08-06T10:17:51', '2026-08-06T13:23:11', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3650', 'In Out America', 'CONDOMINIO IN OUT AMERICA'),
  ('OS0168', '2026-08-06T11:10:39', '2026-08-07T21:04:55', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0169', '2026-08-06T13:54:41', '2026-08-06T14:02:02', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1150', 'Azaleia', 'Condominio Edificio Azaleia'),
  ('OS0170', '2026-08-06T16:33:07', '2026-08-06T17:08:28', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0171', '2026-08-06T16:58:36', '2026-08-06T18:48:01', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8044', 'Lua de Algodão Ensino Fundamental', 'Lua de Algodão'),
  ('OS0172', '2026-08-07T10:10:36', '2026-08-07T14:14:34', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0173', '2026-08-07T10:11:09', '2026-08-07T14:44:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0174', '2026-08-07T10:12:05', '2026-08-07T10:35:35', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0175', '2026-08-07T11:00:00', '2026-08-07T17:17:03', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0850', 'Copacabana', 'Condomínio Edifício Copacabana'),
  ('OS0176', '2026-08-08T09:30:52', '2026-08-08T10:22:34', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', NULL, '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0177', '2026-08-08T10:21:52', '2026-08-08T10:41:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0178', '2026-08-08T13:06:39', '2026-08-08T13:52:02', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0179', '2026-08-08T15:28:47', '2026-08-08T17:49:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0180', '2026-08-10T09:12:25', '2026-08-10T11:27:45', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '8050', 'Link Studios & Office', 'Link Studios & Office'),
  ('OS0181', '2026-08-10T09:12:52', '2026-08-11T08:22:32', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0182', '2026-08-10T09:13:13', '2026-08-11T10:08:07', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0183', '2026-08-10T09:14:06', '2026-08-10T09:37:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0184', '2026-08-11T10:11:42', '2026-08-11T11:14:43', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3050', 'Eurico Gaspar Dutra', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0185', '2026-08-11T10:11:57', '2026-08-11T15:45:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4450', 'Pedro Adam', 'Condomínio Edifício Pedro Adam'),
  ('OS0186', '2026-08-11T10:12:26', '2026-08-11T11:42:35', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0187', '2026-08-11T10:12:42', '2026-08-11T17:03:22', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0188', '2026-08-11T18:43:52', '2026-08-11T20:25:24', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0189', '2026-08-12T09:13:11', '2026-08-13T16:37:34', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0190', '2026-08-12T09:13:54', '2026-08-12T17:16:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4250', 'CONDOMÍNIO VELAZQUEZ', 'Condomínio Velazquez'),
  ('OS0191', '2026-08-12T09:14:59', '2026-08-14T11:45:25', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0192', '2026-08-12T09:15:35', '2026-08-12T11:02:43', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0193', '2026-08-12T09:16:14', '2026-08-12T14:34:17', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0194', '2026-08-12T09:17:04', '2026-08-12T23:11:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0195', '2026-08-12T10:57:11', '2026-08-12T17:13:13', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0196', '2026-08-13T08:27:38', '2026-08-13T10:01:26', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '0037', 'NICOLAU ALAYON', 'NICOLAU ALAYON'),
  ('OS0197', '2026-08-13T08:29:20', '2026-08-19T12:01:23', 'implantacao', 'Implantação', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0198', '2026-08-13T08:34:15', '2026-08-14T11:41:16', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '8007', 'ALFALUX ALARME', 'ALFALUX'),
  ('OS0199', '2026-08-13T17:09:51', '2026-08-14T09:11:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0200', '2026-08-14T09:04:32', '2026-08-14T10:29:08', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0039', 'Mãe Iliana', 'Mãe Iliana'),
  ('OS0201', '2026-08-14T09:05:35', '2026-08-14T14:56:09', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0202', '2026-08-14T14:30:19', '2026-08-20T20:09:49', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3350', 'Rio Azul', 'CONDOMINIO EDIFÍCIO RIO AZUL'),
  ('OS0203', '2026-08-15T11:05:06', '2026-08-15T12:19:53', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0204', '2026-08-15T22:16:53', '2026-08-16T00:39:35', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0205', '2026-08-17T09:00:40', '2026-08-17T11:56:28', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0206', '2026-08-17T09:01:38', '2026-08-17T18:01:24', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0207', '2026-08-17T09:03:12', '2026-08-17T19:19:24', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0208', '2026-08-17T10:11:11', '2026-08-17T14:26:18', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0209', '2026-08-17T10:11:50', '2026-08-17T17:51:44', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1250', 'Manhattans Home', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0210', '2026-08-18T09:52:04', '2026-08-18T10:37:57', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0211', '2026-08-18T09:52:23', '2026-08-18T18:50:42', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0212', '2026-08-18T09:52:42', '2026-08-18T14:06:30', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0213', '2026-08-18T09:53:02', '2026-08-18T18:21:42', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1250', 'Manhattans Home', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0214', '2026-08-18T09:53:26', '2026-08-18T12:07:18', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace Aclimacao', 'Grand Terrace Aclimacao'),
  ('OS0215', '2026-08-18T09:53:51', '2026-08-18T17:01:45', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0216', '2026-08-18T09:54:15', '2026-08-18T17:49:09', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0217', '2026-08-19T08:55:25', '2026-08-19T09:00:45', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '8046', 'Universal Serras', 'UNIVERSAL SERRAS INDUSTRIA E COMERCIO LTDA'),
  ('OS0218', '2026-08-19T09:02:08', '2026-08-19T13:26:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3150', 'Giovanni Pascoli', 'Condomínio Edifício Giovanni Pascoli'),
  ('OS0219', '2026-08-19T09:03:10', '2026-08-19T16:02:37', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0220', '2026-08-19T10:51:20', '2026-08-19T17:19:33', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0221', '2026-08-20T09:34:41', '2026-08-20T14:30:20', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0222', '2026-08-20T09:35:27', '2026-08-20T16:13:54', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0223', '2026-08-20T09:35:55', '2026-08-20T14:56:04', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '7009', 'Associação Castelo', 'Associação Castelo'),
  ('OS0224', '2026-08-20T14:55:57', '2026-08-20T17:18:03', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '1350', 'Fairmont Village', 'CONDOMINO FAIRMONT VILLAGE'),
  ('OS0225', '2026-08-20T17:11:14', '2026-08-21T12:10:33', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3350', 'Rio Azul', 'CONDOMINIO EDIFÍCIO RIO AZUL'),
  ('OS0226', '2026-08-21T08:44:41', '2026-08-21T10:47:27', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0227', '2026-08-21T08:45:10', '2026-08-21T16:06:44', 'preventiva', 'Manutenção Preventiva', 'Lucas', 'Paulo', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN')
;

-- a lista tem de chegar inteira antes de encostar em `chamados`
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _os_retro;
  IF n <> 227 THEN
    RAISE EXCEPTION 'Esperava 227 linhas, vieram %. Nada foi importado.', n;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) DE→PARA de pessoa e de cliente
-- ═══════════════════════════════════════════════════════════════════════
-- PESSOA: usa `public.resolver_tecnico()`, a função da casa (U0) — ela olha
-- primeiro os apelidos já cadastrados em `tecnico_aliases` e depois o nome
-- exato. Quem ela não achar, tenta PRIMEIRO NOME: a origem traz "Breno" e o
-- perfil pode ser "Breno Goes".
--
-- Em qualquer dos dois caminhos vale a regra do importador do Notion: casar
-- só quando é ÚNICO. Se dois perfis começam com "Lucas", nenhum é escolhido —
-- responsável errado é pior que responsável em branco, porque ninguém
-- confere um campo que já está preenchido.
CREATE TEMP TABLE _pessoa_de_para ON COMMIT DROP AS
WITH origem AS (
  SELECT DISTINCT tecnico AS nome FROM _os_retro WHERE tecnico IS NOT NULL
  UNION
  SELECT DISTINCT apoio          FROM _os_retro WHERE apoio   IS NOT NULL
),
pela_casa AS (
  SELECT o.nome, public.resolver_tecnico(o.nome) AS profile_id FROM origem o
),
por_primeiro_nome AS (
  SELECT c.nome,
         CASE WHEN count(p.id) = 1 THEN (array_agg(p.id))[1] END AS profile_id
    FROM pela_casa c
    LEFT JOIN public.profiles p
           ON p.ativo IS DISTINCT FROM false
          AND public.normalizar_texto(p.nome)
              LIKE public.normalizar_texto(c.nome) || ' %'
   WHERE c.profile_id IS NULL
   GROUP BY c.nome
)
SELECT c.nome,
       COALESCE(c.profile_id, x.profile_id) AS profile_id,
       (c.profile_id IS NULL AND x.profile_id IS NOT NULL) AS casou_por_primeiro_nome
  FROM pela_casa c
  LEFT JOIN por_primeiro_nome x ON x.nome = c.nome;

-- CLIENTE: a base do app não tem o código de conta, então o casamento é por
-- NOME — apelido curto primeiro, razão social depois. Também só quando único:
-- o README do dataset avisa que "WAFIOS" aparece sob duas contas.
CREATE TEMP TABLE _cliente_de_para ON COMMIT DROP AS
WITH origem AS (
  SELECT DISTINCT conta, cliente_nome, cliente_razao FROM _os_retro
),
por_apelido AS (
  SELECT o.conta, o.cliente_nome,
         CASE WHEN count(c.id) = 1 THEN (array_agg(c.id))[1] END AS cliente_id
    FROM origem o
    LEFT JOIN public.clientes c
           ON public.normalizar_texto(c.nome) = public.normalizar_texto(o.cliente_nome)
   GROUP BY o.conta, o.cliente_nome
),
por_razao AS (
  SELECT o.conta, o.cliente_nome,
         CASE WHEN count(c.id) = 1 THEN (array_agg(c.id))[1] END AS cliente_id
    FROM origem o
    LEFT JOIN public.clientes c
           ON public.normalizar_texto(c.nome) = public.normalizar_texto(o.cliente_razao)
   GROUP BY o.conta, o.cliente_nome
)
SELECT a.conta, a.cliente_nome,
       COALESCE(a.cliente_id, r.cliente_id) AS cliente_id
  FROM por_apelido a
  JOIN por_razao   r USING (conta, cliente_nome);

-- O apelido que só o primeiro nome resolveu vira ALIAS de verdade: a próxima
-- importação acha de primeira, e a tela de conferência passa a mostrar o
-- vínculo. É para isso que `tecnico_aliases` existe (U0).
INSERT INTO public.tecnico_aliases (nome_original, profile_id, origem)
SELECT nome, profile_id, 'manual'
  FROM _pessoa_de_para
 WHERE casou_por_primeiro_nome AND profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) RESERVA OS NÚMEROS — em bloco, para sair em ordem cronológica
-- ═══════════════════════════════════════════════════════════════════════
-- Por que não chamar `proximo_numero_chamado()` na linha do INSERT: ela é
-- VOLATILE, e o momento em que o Postgres avalia uma função volátil de lista
-- de seleção em relação ao ORDER BY não é garantido — a numeração poderia
-- sair fora de ordem em silêncio. Aqui o contador é avançado UMA vez pelo
-- total, e cada linha recebe `base + row_number()` na ordem de abertura.
-- O contador é o MESMO do app, então nada colide com chamados futuros.
CREATE TEMP TABLE _reserva ON COMMIT DROP AS
WITH pendente AS (
  SELECT EXTRACT(YEAR FROM r.data_abertura)::int AS ano, count(*)::int AS quantos
    FROM _os_retro r
   WHERE NOT EXISTS (SELECT 1 FROM public.chamados c
                      WHERE c.origem = 'importacao_retroativa'
                        AND c.origem_id = r.os_id)
   GROUP BY 1
),
avanco AS (
  INSERT INTO public.chamado_contadores AS k (ano, ultimo)
  SELECT ano, quantos FROM pendente
  ON CONFLICT (ano) DO UPDATE SET ultimo = k.ultimo + EXCLUDED.ultimo
  RETURNING k.ano, k.ultimo
)
SELECT a.ano, a.ultimo - p.quantos AS base
  FROM avanco a JOIN pendente p USING (ano);

-- ═══════════════════════════════════════════════════════════════════════
-- 4) SILENCIA OS TRIGGERS QUE ESTRAGARIAM A CARGA
-- ═══════════════════════════════════════════════════════════════════════
-- `chamado_preencher` inventaria prazo_limite de SLA (ver o cabeçalho).
-- `notify_chamado` mandaria 227 sinos por trabalho antigo. Voltam na seção 7.
ALTER TABLE public.chamados       DISABLE TRIGGER trg_chamado_preencher_ins;
ALTER TABLE public.chamados       DISABLE TRIGGER trg_notify_chamado_ins;
ALTER TABLE public.chamado_apoios DISABLE TRIGGER trg_notify_chamado_apoio;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) OS CHAMADOS
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO public.chamados (
  numero, numero_legado, natureza, equipe, tipo, status, prioridade,
  titulo, descricao_problema,
  cliente_id, cliente_origem_nome, responsavel_id,
  created_at, finalizada_em, concluida_em, fechada_em,
  tipo_servico, origem, origem_id
)
SELECT
  'CH-' || res.ano::text || '-' || lpad(
    (res.base + row_number() OVER (PARTITION BY res.ano
                                   ORDER BY r.data_abertura, r.os_id))::text, 4, '0'),
  r.os_id,
  'campo', 'tecnica', r.tipo, 'concluido', 'normal',
  r.titulo,
  -- a procedência fica escrita: sem isso o `solicitante` da origem
  -- (Área Técnica / Monitoramento) e o código de conta se perderiam
  'Importação retroativa ' || r.os_id
    || COALESCE(' · Solicitante: ' || r.solicitante, '')
    || COALESCE(' · Conta ' || r.conta, ''),
  cd.cliente_id,
  r.cliente_nome,          -- o nome da origem fica SEMPRE, casando ou não
  pd.profile_id,
  r.data_abertura, r.data_conclusao, r.data_conclusao, r.data_conclusao,
  CASE WHEN r.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END,
  'importacao_retroativa', r.os_id
FROM _os_retro r
JOIN _reserva res ON res.ano = EXTRACT(YEAR FROM r.data_abertura)::int
LEFT JOIN _cliente_de_para cd
       ON cd.conta = r.conta
      AND cd.cliente_nome IS NOT DISTINCT FROM r.cliente_nome
LEFT JOIN _pessoa_de_para pd ON pd.nome = r.tecnico
WHERE NOT EXISTS (
  SELECT 1 FROM public.chamados c
   WHERE c.origem = 'importacao_retroativa' AND c.origem_id = r.os_id
);

-- ═══════════════════════════════════════════════════════════════════════
-- 6) OS APOIOS (Breno→Luan, André→Denner, Lucas→Paulo; Vinicius não tem)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO public.chamado_apoios (chamado_id, profile_id, created_at)
SELECT c.id, pd.profile_id, r.data_abertura
  FROM _os_retro r
  JOIN public.chamados c
    ON c.origem = 'importacao_retroativa' AND c.origem_id = r.os_id
  JOIN _pessoa_de_para pd ON pd.nome = r.apoio
 WHERE r.apoio IS NOT NULL
   AND pd.profile_id IS NOT NULL
   AND pd.profile_id IS DISTINCT FROM c.responsavel_id   -- apoio de si mesmo não existe
ON CONFLICT (chamado_id, profile_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 7) RELIGA OS TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamados       ENABLE TRIGGER trg_chamado_preencher_ins;
ALTER TABLE public.chamados       ENABLE TRIGGER trg_notify_chamado_ins;
ALTER TABLE public.chamado_apoios ENABLE TRIGGER trg_notify_chamado_apoio;

-- ═══════════════════════════════════════════════════════════════════════
-- 8) CONFERÊNCIA — leia antes de fechar a janela
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'total importado' AS conferencia, count(*)::text AS valor, '227' AS esperado
  FROM public.chamados WHERE origem = 'importacao_retroativa'
UNION ALL SELECT 'corretiva', count(*)::text, '220'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND tipo = 'corretiva'
UNION ALL SELECT 'implantacao (era "Instalação")', count(*)::text, '4'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND tipo = 'implantacao'
UNION ALL SELECT 'preventiva', count(*)::text, '3'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND tipo = 'preventiva'
UNION ALL SELECT 'todos concluídos', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND status = 'concluido'
UNION ALL SELECT 'título = rótulo do tipo', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa'
    AND titulo = CASE tipo WHEN 'corretiva'   THEN 'Manutenção Corretiva'
                           WHEN 'preventiva'  THEN 'Manutenção Preventiva'
                           WHEN 'implantacao' THEN 'Implantação' END
UNION ALL SELECT 'nenhum prazo inventado', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND prazo_limite IS NULL
UNION ALL SELECT 'numeração em ordem cronológica', count(*)::text, '0 fora de ordem'
  FROM (SELECT numero, created_at,
               lag(numero)     OVER (ORDER BY created_at, origem_id) AS num_ant,
               lag(created_at) OVER (ORDER BY created_at, origem_id) AS dt_ant
          FROM public.chamados WHERE origem = 'importacao_retroativa') t
 WHERE num_ant IS NOT NULL AND numero < num_ant
UNION ALL SELECT '>> SEM responsável (quanto menor, melhor)', count(*)::text, '0'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND responsavel_id IS NULL
UNION ALL SELECT '>> SEM cliente vinculado', count(*)::text, '0'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND cliente_id IS NULL
UNION ALL SELECT 'apoios criados', count(*)::text, '222 se todos casaram'
  FROM public.chamado_apoios a JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.origem = 'importacao_retroativa';

-- QUEM NÃO CASOU. Lista vazia = casou tudo.
-- Cliente sem vínculo continua com o nome escrito em `cliente_origem_nome`,
-- e a tela mostra esse nome — nada se perdeu. Depois de cadastrar o cliente,
-- religar é um UPDATE (o rodapé traz ele pronto).
SELECT 'cliente não encontrado' AS problema,
       c.cliente_origem_nome    AS nome_na_origem,
       count(*)                 AS chamados
  FROM public.chamados c
 WHERE c.origem = 'importacao_retroativa' AND c.cliente_id IS NULL
 GROUP BY c.cliente_origem_nome
UNION ALL
SELECT 'pessoa não encontrada', d.nome, count(r.os_id)
  FROM _pessoa_de_para d
  LEFT JOIN _os_retro r ON r.tecnico = d.nome OR r.apoio = d.nome
 WHERE d.profile_id IS NULL
 GROUP BY d.nome
 ORDER BY 1, 3 DESC;

COMMIT;

-- ───────────────────────────────────────────────────────────────────────
-- DEPOIS, SE PRECISAR
--
-- Religar um cliente que não casou (cadastre-o primeiro, na tela Clientes):
--   UPDATE public.chamados c SET cliente_id = cl.id
--     FROM public.clientes cl
--    WHERE c.origem = 'importacao_retroativa' AND c.cliente_id IS NULL
--      AND public.normalizar_texto(cl.nome)
--          = public.normalizar_texto(c.cliente_origem_nome);
--
-- Ensinar um nome de pessoa que não casou (troque o e-mail):
--   INSERT INTO public.tecnico_aliases (nome_original, profile_id, origem)
--   SELECT 'Vinicius', p.id, 'manual' FROM public.profiles p
--    WHERE p.email = 'pessoa@exemplo.com';
--   -- e então:
--   UPDATE public.chamados c SET responsavel_id = public.resolver_tecnico('Vinicius')
--    WHERE c.origem = 'importacao_retroativa' AND c.responsavel_id IS NULL
--      AND c.descricao_problema LIKE '%OS____%';
--
-- DESFAZER A IMPORTAÇÃO INTEIRA (apoios e eventos saem junto, por CASCADE):
--   DELETE FROM public.chamados WHERE origem = 'importacao_retroativa';
-- ───────────────────────────────────────────────────────────────────────
