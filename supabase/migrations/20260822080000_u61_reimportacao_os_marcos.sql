-- U61 — REIMPORTAÇÃO das 227 OS: marcos de campo + nomes de cliente
-- padronizados (R72). Sucede a U59, que o Davi já rodou.
-- Fonte: lista-OS-retroativo/os_manutencao.csv, versão de 2026-08-22 com as
-- colunas `chegada` e `saida`.
--
-- >>> RODAR NO SQL EDITOR DA LOVABLE (Cloud → SQL editor).                <<<
-- >>> ATUALIZA EM LUGAR — não apaga e reimporta. Pode rodar quantas vezes. <<<
-- >>> LEIA OS SELECTs DO FIM.                                             <<<
--
-- POR QUE ATUALIZAR EM VEZ DE APAGAR E REFAZER
-- Os 227 chamados da U59 já existem, já têm número CH-2026-XXXX e já têm id.
-- Apagar e reinserir: (a) daria números novos, deixando buraco na sequência;
-- (b) trocaria os ids, quebrando qualquer link que já aponte para eles;
-- (c) perderia o histórico de eventos. Conferi que `os_id` continua estável
-- entre as duas versões do arquivo — mesma abertura, mesma conclusão, mesma
-- conta, mesmo tipo em todas as 227 —, então casar por `origem_id` é seguro.
-- O que mudou de verdade foram os marcos novos e 42 nomes de cliente.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Preenche os MARCOS DE CAMPO, que a U59 teve de deixar em branco por
--      não existirem no arquivo antigo:
--        iniciada_em   := chegada        (o técnico chegou)
--        finalizada_em := saida          (o técnico saiu)
--        concluida_em  := data_conclusao (fechou no sistema)
--      É isso que faz os indicadores "Até começar" e "Executando" do Painel
--      Operacional pararem de ignorar as 227 e passarem a contar o histórico
--      de verdade.
--   2. Reaplica o de→para de CLIENTE com os nomes padronizados (42 linhas
--      mudaram: "Villa Lagos"→"Vila Lagos", "ESTORIL"→"Estoril Sol", …), o
--      que deve religar clientes que antes não casavam.
--   3. Reaplica o de→para de PESSOA — se algum técnico/apoio ganhou conta
--      desde a U59 (Vinicius, Paulo), ele passa a aparecer agora.
--   4. Insere o que porventura falte (se a U59 não tiver rodado inteira).
--
-- O TÍTULO CONTINUA SENDO O TIPO DE DEMANDA
-- Davi, 2026-08-22: "como as atividades não têm título, você deve criar um
-- título, e ele deve ser o tipo de demanda — contexto: depois eu vou alterar
-- os títulos um por um." Por causa dessa última parte, o UPDATE do título tem
-- GUARDA: ele só reescreve enquanto o título ainda for um dos três rótulos
-- automáticos. Assim, rodar esta migration de novo DEPOIS de o Davi renomear
-- chamados à mão não desfaz o trabalho dele. Mesma guarda na descrição.
--
-- O QUE CONTINUA NÃO SENDO INVENTADO
--   · prazo_limite segue NULO — a origem não tem prazo, e um prazo de SLA
--     calculado hoje entraria no indicador "Cumprimento de prazo" como
--     medição fabricada.
--   · contrato_id segue NULO: contrato de hoje não vale para serviço fechado
--     há três meses.
--
-- NOTA DE QUALIDADE DO PRÓPRIO ARQUIVO (README, nota 3): em parte das linhas
-- `saida - chegada` dá poucos minutos, o que sugere apontamento em lote e não
-- visita real. O número entra como está — é o dado da operação —, mas
-- "Executando" no painel deve ser lido com essa ressalva.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1) A LISTA NOVA, COMO VEIO
-- ═══════════════════════════════════════════════════════════════════════
CREATE TEMP TABLE _os_retro (
  os_id          text PRIMARY KEY,
  data_abertura  timestamptz NOT NULL,
  chegada        timestamptz NOT NULL,
  saida          timestamptz NOT NULL,
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
  (os_id, data_abertura, chegada, saida, data_conclusao, tipo, titulo,
   tecnico, apoio, solicitante, conta, cliente_nome, cliente_razao)
VALUES
  ('OS0001', '2026-06-02T08:43:40', '2026-06-02T10:43:00', '2026-06-02T10:43:05', '2026-06-02T10:43:05', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2050', 'Vila Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0002', '2026-06-02T08:44:35', '2026-06-09T09:33:08', '2026-06-09T09:33:15', '2026-06-09T09:33:15', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2350', 'Las Vegas', 'Condomínio Las Vegas'),
  ('OS0003', '2026-06-02T08:45:14', '2026-06-09T09:33:49', '2026-06-09T09:33:57', '2026-06-09T09:33:57', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0004', '2026-06-02T08:45:49', '2026-06-09T09:35:32', '2026-06-09T09:35:41', '2026-06-09T09:35:41', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0005', '2026-06-02T08:46:56', '2026-06-02T14:27:51', '2026-06-02T14:30:53', '2026-06-02T14:30:53', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3850', 'Estoril Sol', 'CONTRATANTE CONDOMINIO EDIFICIO ESTORIL SOL'),
  ('OS0006', '2026-06-02T08:47:47', '2026-06-02T11:54:30', '2026-06-02T17:52:20', '2026-06-02T17:52:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0007', '2026-06-02T08:49:18', '2026-06-09T09:36:27', '2026-06-09T09:36:34', '2026-06-09T09:36:34', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0008', '2026-06-02T08:49:57', '2026-06-02T10:31:19', '2026-06-02T10:34:08', '2026-06-02T10:34:08', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0009', '2026-06-02T16:40:38', '2026-06-03T10:32:53', '2026-06-03T11:29:44', '2026-06-03T11:29:44', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0010', '2026-06-03T13:26:55', '2026-06-08T13:11:29', '2026-06-08T13:12:08', '2026-06-08T13:12:08', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0011', '2026-06-03T14:35:37', '2026-06-08T13:09:18', '2026-06-08T13:11:20', '2026-06-08T13:11:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0012', '2026-06-05T09:16:25', '2026-06-05T09:18:04', '2026-06-05T09:22:33', '2026-06-05T09:22:33', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0013', '2026-06-05T09:17:19', '2026-06-05T10:57:53', '2026-06-05T11:01:46', '2026-06-05T11:01:46', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0014', '2026-06-06T14:01:22', '2026-06-09T09:37:35', '2026-06-09T09:37:43', '2026-06-09T09:37:43', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0015', '2026-06-07T10:28:55', '2026-06-07T12:17:34', '2026-06-07T12:57:45', '2026-06-07T12:57:45', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3050', 'Eurico Gaspar', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0016', '2026-06-08T07:11:31', '2026-06-08T13:00:29', '2026-06-08T16:55:25', '2026-06-08T16:55:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '1150', 'Azaleia', 'Condominio Edificio Azaleia'),
  ('OS0017', '2026-06-08T13:08:33', '2026-06-08T13:14:32', '2026-06-08T13:16:17', '2026-06-08T13:16:17', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0018', '2026-06-08T13:08:59', '2026-06-08T13:18:00', '2026-06-08T13:18:50', '2026-06-08T13:18:50', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3050', 'Eurico Gaspar', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0019', '2026-06-08T13:09:26', '2026-06-08T13:12:16', '2026-06-08T13:13:19', '2026-06-08T13:13:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0020', '2026-06-08T13:11:06', '2026-06-08T13:13:54', '2026-06-08T13:14:25', '2026-06-08T13:14:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0021', '2026-06-08T13:12:12', '2026-06-08T13:16:29', '2026-06-08T13:17:55', '2026-06-08T13:17:55', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0022', '2026-06-08T13:12:42', '2026-06-09T09:38:17', '2026-06-09T09:38:23', '2026-06-09T09:38:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0023', '2026-06-08T13:13:21', '2026-06-08T13:29:59', '2026-06-08T15:03:01', '2026-06-08T15:03:01', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3050', 'Eurico Gaspar', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0024', '2026-06-09T13:53:03', '2026-06-09T13:59:21', '2026-06-09T17:05:57', '2026-06-09T17:05:57', 'implantacao', 'Implantação', 'Lucas', 'Paulo', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0025', '2026-06-09T13:59:44', '2026-06-26T13:50:40', '2026-06-26T13:52:52', '2026-06-26T13:52:52', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1950', 'Grupo Prever', 'Grupo Prever'),
  ('OS0026', '2026-06-09T16:17:51', '2026-06-09T17:55:31', '2026-06-09T17:58:35', '2026-06-09T17:58:35', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0027', '2026-06-10T06:05:52', '2026-06-10T07:14:23', '2026-06-10T07:15:03', '2026-06-10T07:15:03', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0028', '2026-06-11T20:48:41', '2026-06-11T21:45:19', '2026-06-11T21:57:53', '2026-06-11T21:57:53', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0029', '2026-06-12T06:19:03', '2026-06-12T14:13:06', '2026-06-12T14:14:31', '2026-06-12T14:14:31', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0030', '2026-06-12T13:20:15', '2026-06-12T15:13:51', '2026-06-12T15:59:30', '2026-06-12T15:59:31', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0031', '2026-06-20T20:40:23', '2026-06-21T12:02:14', '2026-06-21T12:04:54', '2026-06-21T12:04:54', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '1350', 'Fairmont Village', 'CONDOMINO FAIRMONT VILLAGE'),
  ('OS0032', '2026-06-22T08:07:53', '2026-06-22T11:15:00', '2026-06-22T12:22:36', '2026-06-22T12:22:36', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3850', 'Estoril Sol', 'CONTRATANTE CONDOMINIO EDIFICIO ESTORIL SOL'),
  ('OS0033', '2026-06-22T11:01:52', '2026-06-22T12:22:48', '2026-06-22T13:39:07', '2026-06-22T13:39:07', 'preventiva', 'Manutenção Preventiva', 'Breno', 'Luan', 'Monitoramento', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0034', '2026-06-22T13:25:35', '2026-06-22T15:19:01', '2026-06-22T17:57:49', '2026-06-22T17:57:49', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0035', '2026-06-27T12:45:24', '2026-06-29T10:41:42', '2026-06-29T10:42:20', '2026-06-29T10:42:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '1350', 'Fairmont Village', 'CONDOMINO FAIRMONT VILLAGE'),
  ('OS0036', '2026-06-29T10:16:42', '2026-06-29T10:42:27', '2026-06-29T11:00:35', '2026-06-29T11:00:35', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '8050', 'Link Studios', 'Link Studios & Office'),
  ('OS0037', '2026-07-01T05:55:52', '2026-07-01T16:36:16', '2026-07-01T16:37:19', '2026-07-01T16:37:19', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0038', '2026-07-01T11:17:57', '2026-07-02T14:17:24', '2026-07-02T14:19:10', '2026-07-02T14:19:10', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Monitoramento', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0039', '2026-07-01T11:21:34', '2026-07-02T14:59:06', '2026-07-02T15:13:58', '2026-07-02T15:13:58', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0040', '2026-07-01T20:01:12', '2026-07-01T22:03:17', '2026-07-01T22:04:46', '2026-07-01T22:04:46', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0041', '2026-07-02T08:18:05', '2026-07-02T09:24:00', '2026-07-02T10:11:51', '2026-07-02T10:11:51', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Area Tecnica', '0037', 'NICOLAU ALAYON', 'NICOLAU ALAYON'),
  ('OS0042', '2026-07-02T11:23:53', '2026-07-07T09:24:32', '2026-07-07T09:52:59', '2026-07-07T09:52:59', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0043', '2026-07-05T11:55:39', '2026-07-06T18:32:22', '2026-07-06T18:33:54', '2026-07-06T18:33:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0044', '2026-07-05T14:12:07', '2026-07-29T15:44:29', '2026-07-30T14:16:23', '2026-07-30T14:16:23', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0045', '2026-07-06T09:38:54', '2026-07-06T15:21:09', '2026-07-06T15:22:16', '2026-07-06T15:22:16', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0046', '2026-07-06T09:39:34', '2026-07-06T15:51:17', '2026-07-06T16:14:13', '2026-07-06T16:14:13', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0047', '2026-07-06T09:40:19', '2026-07-06T17:18:08', '2026-07-06T18:19:07', '2026-07-06T18:19:07', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0048', '2026-07-06T13:01:47', '2026-07-06T15:14:53', '2026-07-06T15:17:50', '2026-07-06T15:17:50', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8003', 'ASTURIAS', 'CONDOMINIO EDIFICIO ASTURIAS'),
  ('OS0049', '2026-07-07T16:16:45', '2026-07-08T16:17:58', '2026-07-08T16:20:07', '2026-07-08T16:20:07', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7011', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0050', '2026-07-08T09:10:24', '2026-07-08T09:29:34', '2026-07-08T10:24:59', '2026-07-08T10:24:59', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0051', '2026-07-08T09:22:20', '2026-07-08T11:28:40', '2026-07-08T13:56:25', '2026-07-08T13:56:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0052', '2026-07-08T09:24:03', '2026-07-08T14:37:02', '2026-07-08T15:22:25', '2026-07-08T15:22:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0053', '2026-07-08T09:24:25', '2026-07-08T16:20:24', '2026-07-08T17:40:26', '2026-07-08T17:40:26', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0054', '2026-07-08T09:33:14', '2026-07-08T10:48:45', '2026-07-08T12:48:53', '2026-07-08T12:48:53', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0055', '2026-07-08T09:33:34', '2026-07-08T09:47:33', '2026-07-08T15:56:13', '2026-07-08T15:56:13', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8044', 'Lua de Algodão Ensino Fundamental', 'Lua de Algodão'),
  ('OS0056', '2026-07-08T09:34:04', '2026-07-08T16:21:33', '2026-07-08T18:39:04', '2026-07-08T18:39:04', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8042', 'Lua de Algodão', 'Lua de Algodão'),
  ('OS0057', '2026-07-08T09:34:27', '2026-07-08T12:49:44', '2026-07-08T14:22:52', '2026-07-08T14:22:52', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1150', 'Azaleia', 'Condominio Edificio Azaleia'),
  ('OS0058', '2026-07-10T08:54:49', '2026-07-10T09:12:44', '2026-07-10T09:45:38', '2026-07-10T09:45:39', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', NULL, '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0059', '2026-07-10T08:55:35', '2026-07-10T10:25:10', '2026-07-10T11:12:15', '2026-07-10T11:12:15', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0060', '2026-07-10T08:56:06', '2026-07-10T11:23:30', '2026-07-10T11:24:38', '2026-07-10T11:24:38', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3850', 'Estoril Sol', 'CONTRATANTE CONDOMINIO EDIFICIO ESTORIL SOL'),
  ('OS0061', '2026-07-10T08:57:59', '2026-07-10T11:53:44', '2026-07-10T12:05:50', '2026-07-10T12:05:50', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0041', 'Mirant', 'Mirant Studios'),
  ('OS0062', '2026-07-10T10:36:33', '2026-07-28T17:08:13', '2026-07-28T17:10:10', '2026-07-28T17:10:10', 'implantacao', 'Implantação', 'André', 'Denner', 'Monitoramento', '4250', 'CONDOMÍNIO VELAZQUEZ', 'Condomínio Velazquez'),
  ('OS0063', '2026-07-10T15:05:19', '2026-07-13T08:58:53', '2026-07-13T08:59:43', '2026-07-13T08:59:43', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Area Tecnica', '0008', 'Eco Life', 'CONDOMÍNIO EDIFICIO ECO LIFE CIDADE UNIVERSITARIA'),
  ('OS0064', '2026-07-10T15:05:39', '2026-07-10T15:34:17', '2026-07-10T16:10:25', '2026-07-10T16:10:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0065', '2026-07-11T10:59:23', '2026-07-11T12:12:04', '2026-07-11T12:33:16', '2026-07-11T12:33:16', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0066', '2026-07-11T22:04:22', '2026-07-11T22:30:57', '2026-07-11T23:59:38', '2026-07-11T23:59:38', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0067', '2026-07-12T14:41:42', '2026-07-12T16:13:50', '2026-07-12T16:46:14', '2026-07-12T16:46:14', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Monitoramento', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0068', '2026-07-13T08:36:40', '2026-07-13T17:47:49', '2026-07-13T18:43:05', '2026-07-13T18:43:05', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2750', 'Paulistano', 'Condomínio Edifício Paulistano'),
  ('OS0069', '2026-07-13T08:37:18', '2026-07-14T11:04:59', '2026-07-14T12:04:17', '2026-07-14T12:04:17', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3650', 'In Out America', 'CONDOMINIO IN OUT AMERICA'),
  ('OS0070', '2026-07-13T08:46:21', '2026-07-13T10:25:23', '2026-07-13T17:05:18', '2026-07-13T17:05:18', 'preventiva', 'Manutenção Preventiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0071', '2026-07-13T09:08:25', '2026-07-13T10:18:40', '2026-07-13T10:41:07', '2026-07-13T10:41:07', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0072', '2026-07-13T20:31:05', '2026-07-13T20:48:03', '2026-07-13T20:53:50', '2026-07-13T20:53:50', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0073', '2026-07-14T10:07:10', '2026-07-14T12:41:44', '2026-07-22T11:34:02', '2026-07-22T11:34:02', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0074', '2026-07-14T10:07:38', '2026-07-14T10:14:09', '2026-07-14T10:30:56', '2026-07-14T10:30:56', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0075', '2026-07-15T10:13:51', '2026-07-15T10:33:22', '2026-07-15T19:49:10', '2026-07-15T19:49:10', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8050', 'Link Studios', 'Link Studios & Office'),
  ('OS0076', '2026-07-15T10:50:57', '2026-07-15T17:08:11', '2026-07-15T17:08:41', '2026-07-15T17:08:41', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0077', '2026-07-15T16:30:32', '2026-07-15T17:50:07', '2026-07-15T18:23:00', '2026-07-15T18:23:00', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0078', '2026-07-16T05:02:22', '2026-07-16T06:11:56', '2026-07-16T07:34:15', '2026-07-16T07:34:15', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0079', '2026-07-16T10:13:31', '2026-07-16T10:17:39', '2026-07-16T10:19:09', '2026-07-16T10:19:09', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8032', 'Paco de Moema', 'Paco de Moema'),
  ('OS0080', '2026-07-16T10:15:12', '2026-07-16T14:15:48', '2026-07-16T18:09:16', '2026-07-16T18:09:16', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0081', '2026-07-16T10:16:00', '2026-07-16T11:37:08', '2026-07-16T17:06:11', '2026-07-16T17:06:11', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4450', 'Pedro Adam', 'Condomínio Edifício Pedro Adam'),
  ('OS0082', '2026-07-16T14:28:51', '2026-07-17T12:56:11', '2026-07-17T14:33:12', '2026-07-17T14:33:12', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8007', 'Alfalux', 'ALFALUX'),
  ('OS0083', '2026-07-16T23:58:29', '2026-07-17T15:52:19', '2026-07-17T15:53:23', '2026-07-17T15:53:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0084', '2026-07-17T09:09:03', '2026-07-17T15:53:32', '2026-07-17T16:32:02', '2026-07-17T16:32:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3650', 'In Out America', 'CONDOMINIO IN OUT AMERICA'),
  ('OS0085', '2026-07-17T09:15:20', '2026-07-17T09:56:43', '2026-07-17T11:19:10', '2026-07-17T11:19:10', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0086', '2026-07-17T09:22:13', '2026-07-23T10:30:06', '2026-07-23T11:51:06', '2026-07-23T11:51:06', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8046', 'Universal Serras', 'UNIVERSAL SERRAS INDUSTRIA E COMERCIO LTDA'),
  ('OS0087', '2026-07-17T09:54:52', '2026-07-17T17:09:28', '2026-07-17T17:10:43', '2026-07-17T17:10:43', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0088', '2026-07-17T09:55:33', '2026-07-17T11:31:02', '2026-07-17T12:48:26', '2026-07-17T12:48:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3050', 'Eurico Gaspar', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0089', '2026-07-17T12:17:53', '2026-07-17T12:48:36', '2026-07-17T16:08:17', '2026-07-17T16:08:17', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0090', '2026-07-17T17:43:54', '2026-07-18T16:38:33', '2026-07-18T16:39:49', '2026-07-18T16:39:49', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0091', '2026-07-18T13:45:59', '2026-07-18T15:17:18', '2026-07-18T16:38:25', '2026-07-18T16:38:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0092', '2026-07-18T14:49:22', '2026-07-18T17:23:51', '2026-07-18T18:10:18', '2026-07-18T18:10:18', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2950', 'Vitoria Régia', 'CONDOMÍNIO EDIFICIO VITORIA REGIA'),
  ('OS0093', '2026-07-19T02:39:54', '2026-07-19T03:32:23', '2026-07-19T04:34:04', '2026-07-19T04:34:04', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0094', '2026-07-19T19:44:18', '2026-07-19T21:00:07', '2026-07-19T21:42:30', '2026-07-19T21:42:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0095', '2026-07-20T11:25:46', '2026-07-20T12:35:18', '2026-07-20T12:50:02', '2026-07-20T12:50:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2250', 'Aquidauana', 'CONDOMINIO EDIFICIO AQUIDAUANA'),
  ('OS0096', '2026-07-20T11:31:56', '2026-07-20T11:34:01', '2026-07-20T12:06:54', '2026-07-20T12:06:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0097', '2026-07-20T13:43:07', '2026-07-20T16:58:16', '2026-07-20T17:16:02', '2026-07-20T17:16:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4250', 'CONDOMÍNIO VELAZQUEZ', 'Condomínio Velazquez'),
  ('OS0098', '2026-07-20T13:43:44', '2026-07-20T14:19:22', '2026-07-20T15:42:18', '2026-07-20T15:42:18', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0099', '2026-07-21T10:03:17', '2026-07-21T16:16:52', '2026-07-21T16:26:55', '2026-07-21T16:26:55', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '1250', 'Manhattans', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0100', '2026-07-21T14:07:54', '2026-07-21T16:27:22', '2026-07-21T16:28:19', '2026-07-21T16:28:19', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0101', '2026-07-21T14:08:37', '2026-07-21T15:34:06', '2026-07-21T15:38:14', '2026-07-21T15:38:14', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0102', '2026-07-21T14:10:14', '2026-07-23T14:02:20', '2026-07-23T14:03:24', '2026-07-23T14:03:24', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0103', '2026-07-21T14:17:56', '2026-07-21T17:59:28', '2026-07-21T18:05:17', '2026-07-21T18:05:17', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1650', 'VILLAGIO SUZANA', 'Condomínio Residencial Villagio Suzana'),
  ('OS0104', '2026-07-21T18:09:45', '2026-07-21T22:16:44', '2026-07-21T22:17:26', '2026-07-21T22:17:26', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0105', '2026-07-21T21:39:08', '2026-07-21T22:17:36', '2026-07-21T22:18:34', '2026-07-21T22:18:34', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0106', '2026-07-22T09:54:46', '2026-07-30T11:18:27', '2026-07-30T12:26:43', '2026-07-30T12:26:43', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '1250', 'Manhattans', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0107', '2026-07-22T11:20:51', '2026-07-22T11:34:24', '2026-07-22T11:35:47', '2026-07-22T11:35:47', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0108', '2026-07-22T11:21:12', '2026-07-22T11:35:59', '2026-07-22T17:57:11', '2026-07-22T17:57:11', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0109', '2026-07-22T11:22:01', '2026-07-22T11:34:17', '2026-07-22T17:11:56', '2026-07-22T17:11:56', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0039', 'Mãe Iliana', 'Mãe Iliana'),
  ('OS0110', '2026-07-22T11:22:24', '2026-07-22T17:12:07', '2026-07-22T17:16:14', '2026-07-22T17:16:14', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0111', '2026-07-23T10:29:43', '2026-07-23T12:51:07', '2026-07-24T12:59:28', '2026-07-24T12:59:28', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0112', '2026-07-23T12:40:07', '2026-07-23T15:18:48', '2026-07-23T15:29:16', '2026-07-23T15:29:16', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0113', '2026-07-23T17:01:37', '2026-07-23T17:34:10', '2026-07-23T17:45:16', '2026-07-23T17:45:16', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2050', 'Vila Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0114', '2026-07-23T18:20:03', '2026-07-23T20:34:16', '2026-07-23T20:36:25', '2026-07-23T20:36:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0115', '2026-07-23T21:50:15', '2026-07-24T10:09:12', '2026-07-24T10:11:56', '2026-07-24T10:11:56', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0116', '2026-07-24T07:12:22', '2026-07-24T08:11:54', '2026-07-24T10:09:01', '2026-07-24T10:09:01', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2050', 'Vila Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0117', '2026-07-24T10:56:08', '2026-07-24T16:18:51', '2026-07-24T17:01:49', '2026-07-24T17:01:49', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '7011', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0118', '2026-07-24T10:57:26', '2026-07-24T14:30:37', '2026-07-24T16:23:29', '2026-07-24T16:23:29', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3150', 'Giovanni Pascoli', 'Condomínio Edifício Giovanni Pascoli'),
  ('OS0119', '2026-07-24T10:58:29', '2026-07-24T17:20:24', '2026-07-24T17:22:38', '2026-07-24T17:22:38', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0120', '2026-07-24T10:59:07', '2026-07-24T12:21:42', '2026-07-24T12:37:48', '2026-07-24T12:37:48', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8032', 'Paco de Moema', 'Paco de Moema'),
  ('OS0121', '2026-07-24T11:12:28', '2026-07-24T11:38:51', '2026-07-24T11:40:03', '2026-07-24T11:40:03', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0122', '2026-07-24T11:47:11', '2026-07-24T12:38:00', '2026-07-24T13:36:41', '2026-07-24T13:36:41', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8050', 'Link Studios', 'Link Studios & Office'),
  ('OS0123', '2026-07-24T14:29:26', '2026-07-24T14:38:34', '2026-07-24T14:48:21', '2026-07-24T14:48:21', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8032', 'Paco de Moema', 'Paco de Moema'),
  ('OS0124', '2026-07-24T15:39:09', '2026-07-24T18:25:00', '2026-07-24T18:25:27', '2026-07-24T18:25:27', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '7009', 'Associação Castelo', 'Associação Castelo'),
  ('OS0125', '2026-07-24T16:55:14', '2026-07-24T17:17:31', '2026-07-24T17:44:57', '2026-07-24T17:44:57', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1650', 'VILLAGIO SUZANA', 'Condomínio Residencial Villagio Suzana'),
  ('OS0126', '2026-07-24T19:05:16', '2026-07-28T17:13:26', '2026-07-28T17:14:04', '2026-07-28T17:14:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2050', 'Vila Lagos', 'Condomínio Residencial Villa Lagos'),
  ('OS0127', '2026-07-25T16:54:06', '2026-07-25T19:33:20', '2026-07-25T20:51:38', '2026-07-25T20:51:38', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0128', '2026-07-25T18:47:31', '2026-07-25T18:48:58', '2026-07-25T19:15:51', '2026-07-25T19:15:51', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2350', 'Las Vegas', 'Condomínio Las Vegas'),
  ('OS0129', '2026-07-26T15:48:53', '2026-07-26T17:35:03', '2026-07-26T17:40:14', '2026-07-26T17:40:14', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0130', '2026-07-27T09:56:11', '2026-07-27T10:29:03', '2026-07-27T10:43:23', '2026-07-27T10:43:23', 'corretiva', 'Manutenção Corretiva', 'Vinicius', NULL, 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0131', '2026-07-27T10:50:32', '2026-07-27T10:57:05', '2026-07-27T11:31:52', '2026-07-27T11:31:52', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8050', 'Link Studios', 'Link Studios & Office'),
  ('OS0132', '2026-07-27T10:50:58', '2026-07-27T14:11:29', '2026-07-27T15:15:04', '2026-07-27T15:15:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0133', '2026-07-27T15:10:08', '2026-07-27T15:52:34', '2026-07-27T16:11:22', '2026-07-27T16:11:22', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8048', 'Avant Garde', 'Avant Garde'),
  ('OS0134', '2026-07-28T13:42:20', '2026-07-28T17:11:25', '2026-07-28T17:13:09', '2026-07-28T17:13:09', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0135', '2026-07-28T13:46:57', '2026-07-28T14:45:08', '2026-07-28T16:16:47', '2026-07-28T16:16:47', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0136', '2026-07-28T17:59:49', '2026-07-28T20:07:13', '2026-07-28T21:19:56', '2026-07-28T21:19:56', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2750', 'Paulistano', 'Condomínio Edifício Paulistano'),
  ('OS0137', '2026-07-28T22:02:18', '2026-07-28T22:10:56', '2026-07-28T22:15:37', '2026-07-28T22:15:37', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0138', '2026-07-29T08:19:40', '2026-07-29T10:58:59', '2026-07-29T11:03:54', '2026-07-29T11:03:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0139', '2026-07-29T08:20:22', '2026-07-29T20:57:46', '2026-07-29T20:59:50', '2026-07-29T20:59:50', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7002', 'In Villa Lobos', 'IN Villa Lobos'),
  ('OS0140', '2026-07-29T08:20:57', '2026-07-29T09:46:37', '2026-07-29T10:10:20', '2026-07-29T10:10:20', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8029', 'CONCORDE', 'Edificio Concorde'),
  ('OS0141', '2026-07-29T08:21:19', '2026-07-29T10:52:39', '2026-07-29T12:31:33', '2026-07-29T12:31:33', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2250', 'Aquidauana', 'CONDOMINIO EDIFICIO AQUIDAUANA'),
  ('OS0142', '2026-07-29T08:21:45', '2026-07-29T12:43:45', '2026-07-29T15:25:30', '2026-07-29T15:25:30', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2350', 'Las Vegas', 'Condomínio Las Vegas'),
  ('OS0143', '2026-07-29T13:57:18', '2026-07-29T14:25:15', '2026-07-29T15:36:04', '2026-07-29T15:36:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0144', '2026-07-29T14:41:45', '2026-07-29T16:31:50', '2026-07-29T18:23:46', '2026-07-29T18:23:46', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0145', '2026-07-29T15:04:35', '2026-07-29T16:14:30', '2026-07-29T16:39:54', '2026-07-29T16:39:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0146', '2026-07-30T09:45:58', '2026-07-30T12:27:32', '2026-07-30T12:28:58', '2026-07-30T12:28:58', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0147', '2026-07-30T11:19:08', '2026-07-30T12:26:53', '2026-07-30T12:27:23', '2026-07-30T12:27:23', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1250', 'Manhattans', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0148', '2026-07-30T14:18:17', '2026-07-31T00:29:43', '2026-07-31T00:39:39', '2026-07-31T00:39:39', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0149', '2026-08-03T09:07:01', '2026-08-03T09:30:36', '2026-08-03T11:23:53', '2026-08-03T11:23:53', 'implantacao', 'Implantação', 'Breno', 'Luan', 'Area Tecnica', '8023', 'GOBS', 'Gobs Comercial Importadora e Exportadora Ltda ME'),
  ('OS0150', '2026-08-03T09:08:02', '2026-08-03T12:41:42', '2026-08-03T12:45:58', '2026-08-03T12:45:58', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0151', '2026-08-03T09:08:51', '2026-08-04T10:04:07', '2026-08-04T10:05:36', '2026-08-04T10:05:36', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0152', '2026-08-03T09:09:55', '2026-08-03T16:09:29', '2026-08-03T18:19:46', '2026-08-03T18:19:46', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8044', 'Lua de Algodão Ensino Fundamental', 'Lua de Algodão'),
  ('OS0153', '2026-08-03T09:23:42', '2026-08-03T09:38:08', '2026-08-03T09:40:08', '2026-08-03T09:40:08', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '3350', 'Rio Azul', 'CONDOMINIO EDIFÍCIO RIO AZUL'),
  ('OS0154', '2026-08-03T14:58:52', '2026-08-03T16:23:05', '2026-08-03T16:29:25', '2026-08-03T16:29:25', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0155', '2026-08-03T16:20:12', '2026-08-03T16:56:39', '2026-08-03T17:44:58', '2026-08-03T17:44:58', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0156', '2026-08-03T17:39:27', '2026-08-03T18:20:01', '2026-08-03T18:35:47', '2026-08-03T18:35:47', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2750', 'Paulistano', 'Condomínio Edifício Paulistano'),
  ('OS0157', '2026-08-04T09:44:24', '2026-08-04T10:05:43', '2026-08-04T19:03:24', '2026-08-04T19:03:24', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8043', 'Residencia Francisco', 'Rua Lelis Vieira, 201) (Residencia Francisco (Rua Lelis Vieira, 201)'),
  ('OS0158', '2026-08-04T12:16:42', '2026-08-04T13:58:05', '2026-08-04T13:59:44', '2026-08-04T13:59:44', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0159', '2026-08-04T12:17:28', '2026-08-05T09:16:35', '2026-08-05T09:23:25', '2026-08-05T09:23:25', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3750', 'Amarilis', 'Condominio Edificio Amarilis'),
  ('OS0160', '2026-08-04T18:02:50', '2026-08-05T09:23:38', '2026-08-05T09:24:13', '2026-08-05T09:24:13', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0161', '2026-08-04T18:34:53', '2026-08-04T18:47:54', '2026-08-04T18:50:02', '2026-08-04T18:50:02', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0162', '2026-08-05T10:11:04', '2026-08-05T10:45:21', '2026-08-05T11:19:35', '2026-08-05T11:19:35', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2350', 'Las Vegas', 'Condomínio Las Vegas'),
  ('OS0163', '2026-08-05T10:12:45', '2026-08-05T13:47:38', '2026-08-05T16:36:34', '2026-08-05T16:36:34', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0164', '2026-08-06T09:56:19', '2026-08-06T10:00:17', '2026-08-06T11:16:30', '2026-08-06T11:16:30', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2350', 'Las Vegas', 'Condomínio Las Vegas'),
  ('OS0165', '2026-08-06T09:56:44', '2026-08-06T15:26:57', '2026-08-06T16:36:23', '2026-08-06T16:36:23', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0166', '2026-08-06T09:57:06', '2026-08-06T15:26:41', '2026-08-06T17:07:54', '2026-08-06T17:07:54', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0167', '2026-08-06T10:17:51', '2026-08-06T11:54:21', '2026-08-06T13:23:11', '2026-08-06T13:23:11', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3650', 'In Out America', 'CONDOMINIO IN OUT AMERICA'),
  ('OS0168', '2026-08-06T11:10:39', '2026-08-07T21:03:40', '2026-08-07T21:04:55', '2026-08-07T21:04:55', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0169', '2026-08-06T13:54:41', '2026-08-06T14:00:11', '2026-08-06T14:02:02', '2026-08-06T14:02:02', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1150', 'Azaleia', 'Condominio Edificio Azaleia'),
  ('OS0170', '2026-08-06T16:33:07', '2026-08-06T17:08:02', '2026-08-06T17:08:28', '2026-08-06T17:08:28', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0171', '2026-08-06T16:58:36', '2026-08-06T17:57:47', '2026-08-06T18:48:00', '2026-08-06T18:48:01', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8044', 'Lua de Algodão Ensino Fundamental', 'Lua de Algodão'),
  ('OS0172', '2026-08-07T10:10:36', '2026-08-07T12:23:01', '2026-08-07T14:14:34', '2026-08-07T14:14:34', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3250', 'Eugenia Vitale', 'Condominio Edificio Eugenia Vitale'),
  ('OS0173', '2026-08-07T10:11:09', '2026-08-07T14:26:32', '2026-08-07T14:44:23', '2026-08-07T14:44:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '8053', 'Condomínio Edifício Figueira', 'Condomínio Edifício Figueira'),
  ('OS0174', '2026-08-07T10:12:05', '2026-08-07T10:31:11', '2026-08-07T10:35:35', '2026-08-07T10:35:35', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0175', '2026-08-07T11:00:00', '2026-08-07T11:26:53', '2026-08-07T17:17:03', '2026-08-07T17:17:03', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0850', 'Copacabana', 'Condomínio Edifício Copacabana'),
  ('OS0176', '2026-08-08T09:30:52', '2026-08-08T09:52:52', '2026-08-08T10:22:34', '2026-08-08T10:22:34', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', NULL, '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0177', '2026-08-08T10:21:52', '2026-08-08T10:22:43', '2026-08-08T10:41:26', '2026-08-08T10:41:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0178', '2026-08-08T13:06:39', '2026-08-08T13:21:45', '2026-08-08T13:52:02', '2026-08-08T13:52:02', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0179', '2026-08-08T15:28:47', '2026-08-08T16:05:52', '2026-08-08T17:49:31', '2026-08-08T17:49:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0180', '2026-08-10T09:12:25', '2026-08-10T10:50:26', '2026-08-10T11:27:44', '2026-08-10T11:27:45', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '8050', 'Link Studios', 'Link Studios & Office'),
  ('OS0181', '2026-08-10T09:12:52', '2026-08-10T12:26:09', '2026-08-11T08:22:32', '2026-08-11T08:22:32', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2550', 'Cordoba', 'Condomínio Edifício Cordoba'),
  ('OS0182', '2026-08-10T09:13:13', '2026-08-10T09:35:32', '2026-08-11T10:08:07', '2026-08-11T10:08:07', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0183', '2026-08-10T09:14:06', '2026-08-10T09:30:32', '2026-08-10T09:37:23', '2026-08-10T09:37:23', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4150', 'Capadócia', 'Residencial Capadócia'),
  ('OS0184', '2026-08-11T10:11:42', '2026-08-11T10:46:01', '2026-08-11T11:14:43', '2026-08-11T11:14:43', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3050', 'Eurico Gaspar', 'EDIFICIO GENERAL EURICO GASPAR DUTRA'),
  ('OS0185', '2026-08-11T10:11:57', '2026-08-11T11:42:48', '2026-08-11T15:45:54', '2026-08-11T15:45:54', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '4450', 'Pedro Adam', 'Condomínio Edifício Pedro Adam'),
  ('OS0186', '2026-08-11T10:12:26', '2026-08-11T11:26:45', '2026-08-11T11:42:35', '2026-08-11T11:42:35', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '1550', 'Paineiras', 'CONDOMINIO RESIDENCIAL PAINEIRAS'),
  ('OS0187', '2026-08-11T10:12:42', '2026-08-11T13:08:38', '2026-08-11T17:03:22', '2026-08-11T17:03:22', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0188', '2026-08-11T18:43:52', '2026-08-11T20:21:39', '2026-08-11T20:25:24', '2026-08-11T20:25:24', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Monitoramento', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0189', '2026-08-12T09:13:11', '2026-08-13T14:13:55', '2026-08-13T16:37:34', '2026-08-13T16:37:34', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0190', '2026-08-12T09:13:54', '2026-08-12T09:14:27', '2026-08-12T17:16:31', '2026-08-12T17:16:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4250', 'CONDOMÍNIO VELAZQUEZ', 'Condomínio Velazquez'),
  ('OS0191', '2026-08-12T09:14:59', '2026-08-12T16:02:33', '2026-08-14T11:45:25', '2026-08-14T11:45:25', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0192', '2026-08-12T09:15:35', '2026-08-12T09:57:36', '2026-08-12T11:02:42', '2026-08-12T11:02:43', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0193', '2026-08-12T09:16:14', '2026-08-12T13:14:52', '2026-08-12T14:34:17', '2026-08-12T14:34:17', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0194', '2026-08-12T09:17:04', '2026-08-12T09:30:16', '2026-08-12T23:11:04', '2026-08-12T23:11:04', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0195', '2026-08-12T10:57:11', '2026-08-12T16:03:54', '2026-08-12T17:13:13', '2026-08-12T17:13:13', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0196', '2026-08-13T08:27:38', '2026-08-13T09:25:49', '2026-08-13T10:01:26', '2026-08-13T10:01:26', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '0037', 'NICOLAU ALAYON', 'NICOLAU ALAYON'),
  ('OS0197', '2026-08-13T08:29:20', '2026-08-13T08:59:56', '2026-08-19T12:01:23', '2026-08-19T12:01:23', 'implantacao', 'Implantação', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0198', '2026-08-13T08:34:15', '2026-08-13T11:34:48', '2026-08-14T11:41:16', '2026-08-14T11:41:16', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '8007', 'Alfalux', 'ALFALUX'),
  ('OS0199', '2026-08-13T17:09:51', '2026-08-14T09:10:55', '2026-08-14T09:11:26', '2026-08-14T09:11:26', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3950', 'California', 'Condomínio Edilício Residencial California'),
  ('OS0200', '2026-08-14T09:04:32', '2026-08-14T09:11:38', '2026-08-14T10:29:07', '2026-08-14T10:29:08', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0039', 'Mãe Iliana', 'Mãe Iliana'),
  ('OS0201', '2026-08-14T09:05:35', '2026-08-14T12:05:36', '2026-08-14T14:56:09', '2026-08-14T14:56:09', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '4350', 'José Hachem', 'Condomínio Edifício José Hachem'),
  ('OS0202', '2026-08-14T14:30:19', '2026-08-20T20:09:04', '2026-08-20T20:09:49', '2026-08-20T20:09:49', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '3350', 'Rio Azul', 'CONDOMINIO EDIFÍCIO RIO AZUL'),
  ('OS0203', '2026-08-15T11:05:06', '2026-08-15T11:52:35', '2026-08-15T12:19:53', '2026-08-15T12:19:53', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0204', '2026-08-15T22:16:53', '2026-08-15T23:25:09', '2026-08-16T00:39:35', '2026-08-16T00:39:35', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Monitoramento', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0205', '2026-08-17T09:00:40', '2026-08-17T09:14:33', '2026-08-17T11:56:28', '2026-08-17T11:56:28', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0206', '2026-08-17T09:01:38', '2026-08-17T10:13:59', '2026-08-17T18:01:24', '2026-08-17T18:01:24', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0207', '2026-08-17T09:03:12', '2026-08-17T11:33:41', '2026-08-17T19:19:24', '2026-08-17T19:19:24', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '2150', 'Irapuru', 'Condomínio Edifício Irapuru'),
  ('OS0208', '2026-08-17T10:11:11', '2026-08-17T14:15:01', '2026-08-17T14:26:18', '2026-08-17T14:26:18', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '8051', 'San Francesco', 'Condominio San Francesco'),
  ('OS0209', '2026-08-17T10:11:50', '2026-08-17T14:53:58', '2026-08-17T17:51:44', '2026-08-17T17:51:44', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1250', 'Manhattans', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0210', '2026-08-18T09:52:04', '2026-08-18T09:56:06', '2026-08-18T10:37:57', '2026-08-18T10:37:57', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN'),
  ('OS0211', '2026-08-18T09:52:23', '2026-08-18T10:26:31', '2026-08-18T18:50:42', '2026-08-18T18:50:42', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0212', '2026-08-18T09:52:42', '2026-08-18T10:27:58', '2026-08-18T14:06:30', '2026-08-18T14:06:30', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1450', 'Sobradão', 'CONDOMÍNIO EDIFICIO SOBRADAO'),
  ('OS0213', '2026-08-18T09:53:02', '2026-08-18T14:31:56', '2026-08-18T18:21:42', '2026-08-18T18:21:42', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '1250', 'Manhattans', 'CONDOMINIO EDIFÍCIO MANHATTANS HOME'),
  ('OS0214', '2026-08-18T09:53:26', '2026-08-18T11:38:50', '2026-08-18T12:07:18', '2026-08-18T12:07:18', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2650', 'Grand Terrace', 'Grand Terrace Aclimacao'),
  ('OS0215', '2026-08-18T09:53:51', '2026-08-18T13:18:31', '2026-08-18T17:01:45', '2026-08-18T17:01:45', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '3550', 'Recanto Butantã', 'EDIFICIO RECANTO BUTANTA'),
  ('OS0216', '2026-08-18T09:54:15', '2026-08-18T17:35:26', '2026-08-18T17:49:09', '2026-08-18T17:49:09', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '3450', 'Sunset', 'CONDOMÍNIO EDIFICIO SUNSET'),
  ('OS0217', '2026-08-19T08:55:25', '2026-08-19T08:56:52', '2026-08-19T09:00:45', '2026-08-19T09:00:45', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '8046', 'Universal Serras', 'UNIVERSAL SERRAS INDUSTRIA E COMERCIO LTDA'),
  ('OS0218', '2026-08-19T09:02:08', '2026-08-19T10:09:09', '2026-08-19T13:26:31', '2026-08-19T13:26:31', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '3150', 'Giovanni Pascoli', 'Condomínio Edifício Giovanni Pascoli'),
  ('OS0219', '2026-08-19T09:03:10', '2026-08-19T15:40:33', '2026-08-19T16:02:37', '2026-08-19T16:02:37', 'corretiva', 'Manutenção Corretiva', 'Breno', 'Luan', 'Area Tecnica', '0003', 'WAFIOS', 'WAFIOS LTDA'),
  ('OS0220', '2026-08-19T10:51:20', '2026-08-19T11:27:22', '2026-08-19T17:19:33', '2026-08-19T17:19:33', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0221', '2026-08-20T09:34:41', '2026-08-20T09:36:51', '2026-08-20T14:30:20', '2026-08-20T14:30:20', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '7007', 'Green Village', 'Conjunto Arquitetonico Green Village'),
  ('OS0222', '2026-08-20T09:35:27', '2026-08-20T16:08:23', '2026-08-20T16:13:54', '2026-08-20T16:13:54', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2450', 'Umuarama', 'Condominio Residencial Jardim Umuarama'),
  ('OS0223', '2026-08-20T09:35:55', '2026-08-20T14:51:38', '2026-08-20T14:56:04', '2026-08-20T14:56:04', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '7009', 'Associação Castelo', 'Associação Castelo'),
  ('OS0224', '2026-08-20T14:55:57', '2026-08-20T17:08:43', '2026-08-20T17:18:03', '2026-08-20T17:18:03', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '1350', 'Fairmont Village', 'CONDOMINO FAIRMONT VILLAGE'),
  ('OS0225', '2026-08-20T17:11:14', '2026-08-20T20:10:00', '2026-08-21T12:10:33', '2026-08-21T12:10:33', 'corretiva', 'Manutenção Corretiva', 'André', 'Denner', 'Area Tecnica', '3350', 'Rio Azul', 'CONDOMINIO EDIFÍCIO RIO AZUL'),
  ('OS0226', '2026-08-21T08:44:41', '2026-08-21T09:51:16', '2026-08-21T10:47:27', '2026-08-21T10:47:27', 'corretiva', 'Manutenção Corretiva', 'Lucas', 'Paulo', 'Area Tecnica', '2850', 'Isabela', 'Edifício Isabela'),
  ('OS0227', '2026-08-21T08:45:10', '2026-08-21T11:50:29', '2026-08-21T16:06:44', '2026-08-21T16:06:44', 'preventiva', 'Manutenção Preventiva', 'Lucas', 'Paulo', 'Area Tecnica', '4050', 'PATEO KLABIN', 'CONDOMÍNIO EDIFICIO PATEO KLABIN')
;

DO $$
DECLARE n int; fora int;
BEGIN
  SELECT count(*) INTO n FROM _os_retro;
  IF n <> 227 THEN
    RAISE EXCEPTION 'Esperava 227 linhas, vieram %. Nada foi alterado.', n;
  END IF;
  -- os marcos têm de ser cronológicos: abertura ≤ chegada ≤ saída ≤ conclusão.
  -- Um único par invertido viraria duração negativa e o indicador do painel
  -- descartaria a linha em silêncio (indicadores.ts filtra h >= 0).
  SELECT count(*) INTO fora FROM _os_retro
   WHERE NOT (data_abertura <= chegada AND chegada <= saida AND saida <= data_conclusao);
  IF fora > 0 THEN
    RAISE EXCEPTION '% linha(s) com marcos fora de ordem. Nada foi alterado.', fora;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) DE→PARA de pessoa e de cliente (igual à U59)
-- ═══════════════════════════════════════════════════════════════════════
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

INSERT INTO public.tecnico_aliases (nome_original, profile_id, origem)
SELECT nome, profile_id, 'manual'
  FROM _pessoa_de_para
 WHERE casou_por_primeiro_nome AND profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) SILENCIA OS TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════
-- Além dos dois da U59, aqui entram os de UPDATE: religar responsável em 227
-- chamados dispararia 227 notificações "novo chamado para você" e 227 linhas
-- no histórico de cada um, por uma correção de importação.
ALTER TABLE public.chamados       DISABLE TRIGGER trg_chamado_preencher_ins;
ALTER TABLE public.chamados       DISABLE TRIGGER trg_notify_chamado_ins;
ALTER TABLE public.chamados       DISABLE TRIGGER trg_notify_chamado_upd;
ALTER TABLE public.chamados       DISABLE TRIGGER trg_chamado_evento_upd;
ALTER TABLE public.chamado_apoios DISABLE TRIGGER trg_notify_chamado_apoio;

-- ═══════════════════════════════════════════════════════════════════════
-- 4) ATUALIZA OS QUE JÁ ESTÃO LÁ (a U59 já os criou)
-- ═══════════════════════════════════════════════════════════════════════
UPDATE public.chamados c
   SET iniciada_em   = r.chegada,
       finalizada_em = r.saida,
       concluida_em  = r.data_conclusao,
       fechada_em    = r.data_conclusao,
       cliente_id           = COALESCE(cd.cliente_id, c.cliente_id),
       cliente_origem_nome  = r.cliente_nome,
       responsavel_id       = COALESCE(pd.profile_id, c.responsavel_id),
       -- TÍTULO: só reescreve enquanto ainda for um dos três rótulos
       -- automáticos. O Davi vai renomear os chamados um por um, e rodar
       -- esta migration de novo não pode desfazer isso.
       titulo = CASE WHEN c.titulo IN ('Manutenção Corretiva','Manutenção Preventiva','Implantação')
                     THEN r.titulo ELSE c.titulo END,
       -- DESCRIÇÃO: mesma guarda — se deixou de ser a linha de procedência,
       -- alguém escreveu ali e o texto é dele.
       descricao_problema = CASE
         WHEN c.descricao_problema LIKE 'Importação retroativa %'
           THEN 'Importação retroativa ' || r.os_id
                || COALESCE(' · Solicitante: ' || r.solicitante, '')
                || COALESCE(' · Conta ' || r.conta, '')
         ELSE c.descricao_problema END
  FROM _os_retro r
  LEFT JOIN _cliente_de_para cd
         ON cd.conta = r.conta AND cd.cliente_nome IS NOT DISTINCT FROM r.cliente_nome
  LEFT JOIN _pessoa_de_para pd ON pd.nome = r.tecnico
 WHERE c.origem = 'importacao_retroativa' AND c.origem_id = r.os_id;

-- ═══════════════════════════════════════════════════════════════════════
-- 5) INSERE O QUE FALTAR (se a U59 não rodou, ou rodou pela metade)
-- ═══════════════════════════════════════════════════════════════════════
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

INSERT INTO public.chamados (
  numero, numero_legado, natureza, equipe, tipo, status, prioridade,
  titulo, descricao_problema,
  cliente_id, cliente_origem_nome, responsavel_id,
  created_at, iniciada_em, finalizada_em, concluida_em, fechada_em,
  tipo_servico, origem, origem_id
)
SELECT
  'CH-' || res.ano::text || '-' || lpad(
    (res.base + row_number() OVER (PARTITION BY res.ano
                                   ORDER BY r.data_abertura, r.os_id))::text, 4, '0'),
  r.os_id,
  'campo', 'tecnica', r.tipo, 'concluido', 'normal',
  r.titulo,
  'Importação retroativa ' || r.os_id
    || COALESCE(' · Solicitante: ' || r.solicitante, '')
    || COALESCE(' · Conta ' || r.conta, ''),
  cd.cliente_id,
  r.cliente_nome,
  pd.profile_id,
  r.data_abertura, r.chegada, r.saida, r.data_conclusao, r.data_conclusao,
  CASE WHEN r.tipo = 'implantacao' THEN 'instalacao' ELSE 'manutencao' END,
  'importacao_retroativa', r.os_id
FROM _os_retro r
JOIN _reserva res ON res.ano = EXTRACT(YEAR FROM r.data_abertura)::int
LEFT JOIN _cliente_de_para cd
       ON cd.conta = r.conta AND cd.cliente_nome IS NOT DISTINCT FROM r.cliente_nome
LEFT JOIN _pessoa_de_para pd ON pd.nome = r.tecnico
WHERE NOT EXISTS (
  SELECT 1 FROM public.chamados c
   WHERE c.origem = 'importacao_retroativa' AND c.origem_id = r.os_id
);

-- ═══════════════════════════════════════════════════════════════════════
-- 6) APOIOS — inclui os que só passaram a casar agora
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO public.chamado_apoios (chamado_id, profile_id, created_at)
SELECT c.id, pd.profile_id, r.data_abertura
  FROM _os_retro r
  JOIN public.chamados c
    ON c.origem = 'importacao_retroativa' AND c.origem_id = r.os_id
  JOIN _pessoa_de_para pd ON pd.nome = r.apoio
 WHERE r.apoio IS NOT NULL
   AND pd.profile_id IS NOT NULL
   AND pd.profile_id IS DISTINCT FROM c.responsavel_id
ON CONFLICT (chamado_id, profile_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 7) RELIGA OS TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.chamados       ENABLE TRIGGER trg_chamado_preencher_ins;
ALTER TABLE public.chamados       ENABLE TRIGGER trg_notify_chamado_ins;
ALTER TABLE public.chamados       ENABLE TRIGGER trg_notify_chamado_upd;
ALTER TABLE public.chamados       ENABLE TRIGGER trg_chamado_evento_upd;
ALTER TABLE public.chamado_apoios ENABLE TRIGGER trg_notify_chamado_apoio;

-- ═══════════════════════════════════════════════════════════════════════
-- 8) CONFERÊNCIA
-- ═══════════════════════════════════════════════════════════════════════
SELECT 'total da importação' AS conferencia, count(*)::text AS valor, '227' AS esperado
  FROM public.chamados WHERE origem = 'importacao_retroativa'
UNION ALL SELECT 'com marco de CHEGADA (iniciada_em)', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND iniciada_em IS NOT NULL
UNION ALL SELECT 'com marco de SAÍDA (finalizada_em)', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND finalizada_em IS NOT NULL
UNION ALL SELECT 'marcos em ordem (abertura≤chegada≤saída)', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa'
    AND created_at <= iniciada_em AND iniciada_em <= finalizada_em
UNION ALL SELECT 'título = rótulo do tipo (os ainda não renomeados)', count(*)::text, '227 até você renomear'
  FROM public.chamados WHERE origem = 'importacao_retroativa'
    AND titulo = CASE tipo WHEN 'corretiva'   THEN 'Manutenção Corretiva'
                           WHEN 'preventiva'  THEN 'Manutenção Preventiva'
                           WHEN 'implantacao' THEN 'Implantação' END
UNION ALL SELECT 'nenhum prazo inventado', count(*)::text, '227'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND prazo_limite IS NULL
UNION ALL SELECT '>> SEM cliente vinculado', count(*)::text, '0'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND cliente_id IS NULL
UNION ALL SELECT '>> SEM responsável', count(*)::text, '0'
  FROM public.chamados WHERE origem = 'importacao_retroativa' AND responsavel_id IS NULL
UNION ALL SELECT 'apoios vinculados', count(*)::text, '222 se todos casaram'
  FROM public.chamado_apoios a JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.origem = 'importacao_retroativa';

-- Os dois números que o Painel Operacional passa a mostrar (medianas, em
-- horas) — confira contra o README do dataset: resposta ~1,83h, execução
-- ~0,48h. Se baterem, os marcos entraram certos.
SELECT 'mediana até começar (h)' AS indicador,
       round(percentile_cont(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (iniciada_em - created_at)) / 3600.0)::numeric, 2) AS valor
  FROM public.chamados WHERE origem = 'importacao_retroativa'
UNION ALL
SELECT 'mediana executando (h)',
       round(percentile_cont(0.5) WITHIN GROUP (
         ORDER BY EXTRACT(EPOCH FROM (finalizada_em - iniciada_em)) / 3600.0)::numeric, 2)
  FROM public.chamados WHERE origem = 'importacao_retroativa';

-- QUEM NÃO CASOU. Lista vazia = casou tudo.
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
-- Religar cliente que não casou (cadastre-o antes, na tela Clientes):
--   UPDATE public.chamados c SET cliente_id = cl.id
--     FROM public.clientes cl
--    WHERE c.origem = 'importacao_retroativa' AND c.cliente_id IS NULL
--      AND public.normalizar_texto(cl.nome)
--          = public.normalizar_texto(c.cliente_origem_nome);
--
-- DESFAZER A IMPORTAÇÃO INTEIRA (apoios e eventos saem junto, por CASCADE):
--   DELETE FROM public.chamados WHERE origem = 'importacao_retroativa';
-- ───────────────────────────────────────────────────────────────────────
