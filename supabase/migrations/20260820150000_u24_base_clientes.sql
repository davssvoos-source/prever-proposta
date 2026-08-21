-- U24 — A BASE DE CLIENTES OFICIAL + a tela Clientes no menu (2026-08-20)
--
-- O Davi entregou a planilha definitiva: "atualmente nossos clientes são os
-- da lista". Esta migration:
--   1. dá à tabela as colunas que a planilha traz (cep, cidade, uf, posto);
--   2. casa cada linha da planilha com o cadastro por NOME normalizado (sem
--      acento, sem caixa) OU por documento — e atualiza os casados;
--   3. insere os que não existem;
--   4. rebaixa para 'inativo' os ativos que NÃO estão na planilha — com a
--      lista exata guardada em clientes_rebaixados_u24 (o mesmo padrão
--      reversível da U8);
--   5. preenche latitude/longitude no nível do CEP (AwesomeAPI/Nominatim,
--      geocodificado fora do banco) APENAS onde está NULL — coordenada já
--      apurada em campo vale mais que CEP;
--   6. tira o técnico das telas de Clientes (decisão: admin, comercial e SAC).
--
-- Idempotente: rodar duas vezes não duplica nem re-rebaixa.

-- ── 1. Colunas novas ────────────────────────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cep           text,
  ADD COLUMN IF NOT EXISTS cidade        text,
  ADD COLUMN IF NOT EXISTS uf            text,
  ADD COLUMN IF NOT EXISTS posto_servico text;

-- ── 2. A planilha, linha a linha ────────────────────────────────────────────
DROP TABLE IF EXISTS _planilha_u24;
CREATE TEMP TABLE _planilha_u24 (
  nome text, documento text, logradouro text, cidade text, uf text,
  cep text, posto text, lat numeric, lng numeric
);
INSERT INTO _planilha_u24 (nome, documento, logradouro, cidade, uf, cep, posto, lat, lng) VALUES
    ('Actis', '08.864.041/0001-38', 'Avenida Brigadeiro Faria Lima, 3200', 'São Paulo', 'SP', '01451-000', 'Actis', -23.5773909, -46.6868810),
    ('Alcino Braga', '57.752.107/0001-03', 'Rua Alcino Braga, 120', 'São Paulo', 'SP', '04004-020', 'Alcino Braga', -23.5752203, -46.6498478),
    ('Alfaplast', '64.264.144/0001-38', 'Rua Ptolomeu, 211 B', 'São Paulo', 'SP', '04762-040', 'Alfalux Plast', -23.6654757, -46.7193153),
    ('Amadeu Santisi', '54.221.254/0001-69', 'Rua Saint Hilaire, 118', 'São Paulo', 'SP', '01423-040', 'Amadeu Santisi', -23.5707328, -46.6543498),
    ('Amarilis', '57.395.055/0001-65', 'Rua Tomás Aquino de Macedo, 164', 'São Paulo', 'SP', '04679-310', 'Amarilis', -23.6747231, -46.6848259),
    ('AP Geradores', '03.594.972/0001-40', 'Rua João Prey, 109', 'São Paulo', 'SP', '04809-170', 'AP Geradores', -23.7176669, -46.6941917),
    ('AP Geradores Indaiatuba', '17.634.244/0001-29', 'Rua Alberto Magnusson, 222', 'Indaiatuba', 'SP', '13347-633', 'AP Geradores Indaiatuba', -23.1423315, -47.2374212),
    ('Aquidauana', '66.053.521/0001-15', 'Rua José Getúlio, 261', 'São Paulo', 'SP', '01509-001', 'Aquidauana', -23.5684410, -46.6346539),
    ('Ara Vartaniam Iguatemi', '61.368.350/0005-23', 'Avenida Brigadeiro Faria Lima, 2232', 'São Paulo', 'SP', '01489-900', 'Ara Iguatemi', -23.5773004, -46.6882566),
    ('Artisan Moema', '49.995.453/0001-94', 'Avenida Lavandisca, 515', 'São Paulo', 'SP', '04515-011', 'Artisan Moema', -23.6015867, -46.6657615),
    ('Associação Castelo', '37.764.393/0001-10', 'Avenida Alcindo Ferreira, 208', 'São Paulo', 'SP', '04803-170', 'Associação Castelo', -23.7155395, -46.7120850),
    ('Asturias', '59.393.637/0001-38', 'Rua Pamplona, 788', 'São Paulo', 'SP', '01405-001', 'Asturias', -23.5661045, -46.6560946),
    ('Asturias Tropical', '03.024.336/0001-82', 'Rua Doutor Tirso Martins, 100', 'São Paulo', 'SP', '04120-050', 'Asturias Tropical', -23.5956789, -46.6350278),
    ('Augusto Meireles', '54.573.472/0001-62', 'Rua Augusta, 348', 'São Paulo', 'SP', '01304-000', 'Augusto Meireles', -23.5569581, -46.6589677),
    ('Avanhandava', '54.327.705/0001-47', 'Rua Martinho Prado, 154', 'São Paulo', 'SP', '01306-040', 'Avanhandava', -23.5511101, -46.6457820),
    ('Avant Garde', '10.994.733/0001-42', 'Rua Juquis, 204', 'São Paulo', 'SP', '04081-010', 'Avant Garde', -23.6079512, -46.6647429),
    ('Azaléia', '09.373.696/0001-76', 'Rua Monte Caseros, 90', 'São Paulo', 'SP', '05590-130', 'Azaléia', -23.5745299, -46.7320956),
    ('Barao de Itapetininga', '03.867.379/0001-20', 'Galeria Itapetininga, 267', 'São Paulo', 'SP', '01042-020', 'Barão de Itapetininga', -23.5441070, -46.6416600),
    ('Bela Flor', '65.084.881/0001-11', 'Rua Ouvidor Peleja, 489', 'São Paulo', 'SP', '04128-000', 'Bela Flor', -23.6028548, -46.6312571),
    ('Berrini', '11.642.396/0001-97', 'Avenida Nova Independência, 87', 'São Paulo', 'SP', '04570-000', 'Berrini', -23.6031100, -46.6908339),
    ('Bolonha', '59.936.971/0001-90', 'Avenida Bolonha, 62', 'São Paulo', 'SP', '05334-000', 'Bolonha', -23.5483068, -46.7464680),
    ('Boticario Incense', '15.416.526/0002-05', 'Rua Padre José Garzotti, 315', 'São Paulo', 'SP', '04806-000', 'Boticario Incense', -23.7107973, -46.7010847),
    ('Boulevard', '03.919.178/0001-29', 'Rua Desembargador Aragão, 21', 'São Paulo', 'SP', '04102-010', 'Boulevard', -23.5931395, -46.6310411),
    ('British Garden', '54.531.603/0001-49', 'Rua Madre Cabrini, 332', 'São Paulo', 'SP', '04020-900', 'British Garden', -23.5916636, -46.6377764),
    ('BSGA', '26.179.963/0001-98', 'Rua Recife, 249', 'São Paulo', 'SP', '03631-020', 'BSGA', -23.5299545, -46.5512493),
    ('California', '05.123.477/0001-88', 'Rua Zike Tuma, 355', 'São Paulo', 'SP', '04458-000', 'California', -23.6884900, -46.6718463),
    ('Canamari I', '04.742.983/0001-92', 'Rua Imuris, 135', 'São Paulo', 'SP', '04787-150', 'Canamari I', -23.6972286, -46.7130540),
    ('Canamari II', '05.369.805/0001-20', 'Rua Imuris, 134', 'São Paulo', 'SP', '04787-150', 'Canamari II', -23.6972286, -46.7130540),
    ('Capadócia', '33.667.514/0001-54', 'Rua Frederico Rene de Jaegher, 481', 'São Paulo', 'SP', '04826-010', 'Capadócia', -23.7191400, -46.7013610),
    ('Carolina', '55.438.980/0001-09', 'Avenida Giovanni Gronchi, 6701', 'São Paulo', 'SP', '05724-005', 'Carolina', -23.6211213, -46.7334144),
    ('Celebration', '14.575.469/0001-63', 'Rua Rubens Meireles, 105', 'São Paulo', 'SP', '01141-000', 'Celebration', -23.5185233, -46.6655562),
    ('Charm Bahia', '30.816.732/0001-15', 'Rua Manoel Alves dos Santos, 08', 'Porto Seguro', 'BA', '45816-000', 'Charm Bahia', -16.4871411, -39.0788887),
    ('Claudio Monteiro', '54.218.391/0001-44', 'Praça Padre Manuel da Nóbrega, 21', 'São Paulo', 'SP', '01015-901', 'Claudio Monteiro', -23.5479836, -46.6335777),
    ('Clube Castelo', '60.554.623/0001-38', 'Rua Celso Mantovani, 1', 'São Paulo', 'SP', '04803-240', 'Clube Castelo', -23.7143455, -46.7152565),
    ('Concorde', '54.364.799/0001-24', 'Rua Funchal, 203', 'São Paulo', 'SP', '04551-904', 'Concorde', -23.5931588, -46.6885468),
    ('Copacabana', '14.355.109/0001-56', 'Alameda Jurua, 115', 'Bertioga', 'SP', '11262-144', 'Copacabana', -23.7932600, -46.0255400),
    ('Córdoba', '11.910.831/0001-17', 'Avenida Dom Pedro I, 335', 'Osasco', 'SP', '06083-010', 'Córdoba', -23.5407297, -46.7814963),
    ('CST Nacional', '13.527.858/0001-50', 'Estrada de Santo André, 128', 'Santana de Parnaíba', 'SP', '06517-510', 'CST Fazenda São José', -23.4640067, -46.9095937),
    ('Cullinan', '08.598.453/0001-73', 'Rua Iara, 123', 'São Paulo', 'SP', '04542-030', 'Cullinan', -23.5853516, -46.6741213),
    ('Cyrela Living', '07.960.892/0001-11', 'Rua Doutor Ribeiro de Almeida, 88', 'São Paulo', 'SP', '01137-020', 'Cyrela Living', -23.5247973, -46.6531904),
    ('Diferencial Service', '03.203.261/0001-05', 'Avenida Etiópia, 539', 'Barueri', 'SP', '06408-030', 'Diferencial Service', -23.4960841, -46.8850954),
    ('Dona Rachel', '96.294.319/0001-46', 'Avenida Francisco Matarazzo, 108', 'São Paulo', 'SP', '05001-000', 'Dona Rachel', -23.5272573, -46.6722512),
    ('Dona Rachel Frei Caneca', '61.183.174/0001-21', 'Rua Frei Caneca, 1101', 'São Paulo', 'SP', '01307-905', 'Dona Rachel Frei Caneca', -23.5565071, -46.6568571),
    ('Ecolife', '09.649.698/0001-45', 'Rua Valson Lopes, 70', 'São Paulo', 'SP', '05360-020', 'Ecolife', -23.5687321, -46.7436773),
    ('EKDS', '02.097.692/0001-63', 'Rua Doutor Tirso Martins, 100', 'São Paulo', 'SP', '04120-050', 'EKDS', -23.5956789, -46.6350278),
    ('Electra', '03.486.088/0001-91', 'Rua Otávio Tarquínio de Sousa, 160', 'São Paulo', 'SP', '04613-000', 'Electra', -23.6173653, -46.6690889),
    ('Empório da Segurança', '16.993.030/0001-86', 'Rua Marina Vieira de Carvalho Mesquita, 349', 'Campinas', 'SP', '13092-506', 'Empório da Segurança', -22.8972838, -47.0259349),
    ('Especializados', '04.498.020/0001-95', 'Rua Miguel Fontanarosa, 219', 'São Paulo', 'SP', '04802-120', 'Prever Especializados', -23.7101742, -46.7053559),
    ('Estoril Sol', '62.286.653/0001-36', 'Rua Bela Cintra, 1714', 'São Paulo', 'SP', '01415-001', 'Estoril Sol', -23.5574223, -46.6629813),
    ('Eugenia Vitale', '54.325.311/0001-50', 'Rua Bela Flor, 164', 'São Paulo', 'SP', '04128-050', 'Eugenia Vitale', -23.6028528, -46.6316035),
    ('Evolution Paraiso', '21.524.579/0001-61', 'Rua Apeninos, 418', 'São Paulo', 'SP', '01533-000', 'Evolution Paraiso', -23.5727458, -46.6392093),
    ('Fairmont Village', '02.840.219/0001-24', 'Rua Tibiriçá, 559', 'São Paulo', 'SP', '04622-011', 'Fairmont Village', -23.6342996, -46.6744344),
    ('Fascinio', '18.180.263/0001-95', 'Rua Jaci, 51', 'São Paulo', 'SP', '04140-080', 'Fascinio', -23.6058436, -46.6289279),
    ('Figueira', '12.466.961/0001-75', 'Rua Coronel Deraldo Jordão, 214', 'São Paulo', 'SP', '04125-030', 'Figueira', -23.6001711, -46.6197790),
    ('GAC Brasil', '13.631.679/0001-69', 'Rua Apeninos, 400', 'São Paulo', 'SP', '01533-000', 'GAC Brasil', -23.5727458, -46.6392093),
    ('Gaspar Dutra', '54.325.162/0001-29', 'Alameda dos Jurupis, 586', 'São Paulo', 'SP', '04088-001', 'Eurico Gaspar Dutra', -23.6070770, -46.6623937),
    ('Gaspar Lourenço', '71.522.825/0001-14', 'Rua Alceu Wamosy, 75', 'São Paulo', 'SP', '04105-040', 'Gaspar Lourenço', -23.5799365, -46.6371675),
    ('Giovanni Pascoli', '04.792.757/0001-16', 'Alameda dos Guaramomis, 662', 'São Paulo', 'SP', '04076-011', 'Giovanni Pascoli', -23.6112486, -46.6572808),
    ('Go Confecção', '39.631.243/0001-63', 'Avenida Interlagos, 6885', 'São Paulo', 'SP', '04777-001', 'Go Confecção', -23.6827302, -46.6903154),
    ('GoBS', '14.219.543/0002-90', 'Avenida do Jangadeiro, 347', 'São Paulo', 'SP', '04815-020', 'GoBS', -23.7071117, -46.6994987),
    ('GPS Pamcary', '71.721.385/0001-24', 'Rua Abílio Soares, 409', 'São Paulo', 'SP', '04005-001', 'GPS Pamcary', -23.5770428, -46.6504211),
    ('Grand Terrace', '20.135.644/0001-02', 'Avenida Lacerda Franco, 200', 'São Paulo', 'SP', '01536-000', 'Grand Terrace', -23.5723220, -46.6242539),
    ('Grand Vitrali', '58.914.249/0001-92', 'Avenida Jamaris, 407', 'São Paulo', 'SP', '04078-001', 'Grand Vitrali', -23.6071873, -46.6587773),
    ('Green Village', '53.818.175/0001-77', 'Rua Cambuci do Vale, 597', 'São Paulo', 'SP', '04805-110', 'Green Village', -23.7141976, -46.7021173),
    ('Green Village II', '03.768.852/0001-11', 'Rua Bitencourt Sampaio, 268', 'São Paulo', 'SP', '04126-060', 'Green Village II', -23.5984187, -46.6306124),
    ('Gregório Serrão', '55.651.475/0001-30', 'Rua Doutor José de Queirós Aranha, 245', 'São Paulo', 'SP', '04106-061', 'Gregório Serrão', -23.5804546, -46.6366233),
    ('Hicatu', '57.659.120/0001-12', 'Rua Alceu Wamosy, 185', 'São Paulo', 'SP', '04105-040', 'Hicatu', -23.5799365, -46.6371675),
    ('Humboldt', '57.036.782/0001-36', 'Avenida Engenheiro Alberto Kuhlmann, 525', 'São Paulo', 'SP', '04784-010', 'Humboldt', -23.6865239, -46.7097886),
    ('Ibira By You', '51.708.242/0001-75', 'Alameda dos Arapanés, 195', 'São Paulo', 'SP', '04524-000', 'Ibira By You', -23.6055572, -46.6659894),
    ('Ibirapitanga', '04.955.427/0001-02', 'Estrada do Ouro Fino', 'Santa Isabel', 'SP', '07500-000', 'Ibirapitanga', -23.3195270, -46.2267426),
    ('Ibirapuera Office', '00.411.320/0001-34', 'Avenida Iraí, 143', 'São Paulo', 'SP', '04082-000', 'Ibirapuera Office', -23.6126978, -46.6605574),
    ('Icon Berrini', '48.128.660/0001-89', 'Rua Jaceru, 224', 'São Paulo', 'SP', '04705-000', 'Icon', -23.6223737, -46.6940864),
    ('In Out America', '40.187.987/0001-10', 'Rua Amália de Noronha, 99', 'São Paulo', 'SP', '05410-010', 'In Out America', -23.5520551, -46.6808420),
    ('Indianopolis Petropolis', '54.606.975/0001-97', 'Avenida Santo Amaro, 835', 'São Paulo', 'SP', '04505-001', 'Indianopolis Petropolis', -23.6177290, -46.6818226),
    ('Inhambu', '54.071.790/0001-25', 'Rua Inhambú, 1208', 'São Paulo', 'SP', '04520-014', 'Inhambu', -23.6025538, -46.6696475),
    ('Ipiranga Premium', '05.803.202/0001-95', 'Rua Gama Lobo, 1217', 'São Paulo', 'SP', '04269-000', 'Ipiranga Premium', -23.5950910, -46.6122935),
    ('Irapuru', '38.892.212/0001-01', 'Rua Augusta, 2945', 'São Paulo', 'SP', '01413-100', 'Irapuru', -23.5569581, -46.6589677),
    ('Isabela', '38.656.945/0001-39', 'Rua Orestes Barbosa, 70', 'São Paulo', 'SP', '04457-000', 'Isabela', -23.6883831, -46.6774851),
    ('Itaparica', '54.464.409/0001-98', 'Rua Pantaleão Brás, 22', 'São Paulo', 'SP', '05372-080', 'Itaparica', -23.5819461, -46.7637639),
    ('Jardim Botanico', '13.225.928/0001-16', 'Avenida dos Ourives, 632', 'São Paulo', 'SP', '04194-260', 'Jardim Botanico', -23.6542915, -46.6103118),
    ('Jose Hachem', '60.910.486/0001-27', 'Alameda Itu, 1067', 'São Paulo', 'SP', '01421-001', 'Jose Hachem', -23.5627220, -46.6607749),
    ('JR Pavimentação', '10.519.450/0001-49', 'Avenida Interlagos, 6870', 'São Paulo', 'SP', '04777-000', 'JR Pavimentação', -23.6827302, -46.6903154),
    ('Julia Baldassarri', '71.587.562/0001-21', 'Avenida Brigadeiro Luís Antônio, 393', 'São Paulo', 'SP', '01317-000', 'Julia Baldassarri', -23.5694975, -46.6507747),
    ('Kapptec', '55.645.485/0001-62', 'Rua Solimões, 60', 'Diadema', 'SP', '09930-570', 'Kapptec', -23.6701253, -46.6209476),
    ('La Grand Maison', '10.743.118/0001-63', 'Rua Pereira da Nóbrega, 110', 'São Paulo', 'SP', '01549-020', 'La Grand Maison', -23.5767739, -46.6144148),
    ('Las Vegas', '57.864.795/0001-01', 'Parque da Aclimação, 548', 'São Paulo', 'SP', '01534-050', 'Las Vegas', -23.5714870, -46.6309716),
    ('Le Jardin', '05.272.892/0001-01', 'Rua Luisiania, 407', 'São Paulo', 'SP', '04560-021', 'Le Jardin', -23.6089552, -46.6815845),
    ('Lelis Vieira', '34.046.511/0001-66', 'Rua Lélis Vieira', 'São Paulo', 'SP', '05419-010', 'Lelis Vieira', -23.5571813, -46.6993779),
    ('LG Dutra', '04.633.906/0001-02', 'Rua Padre José Garzotti, 280', 'São Paulo', 'SP', '04806-000', 'LG Dutra', -23.7107973, -46.7010847),
    ('Link Studios', '25.139.003/0001-31', 'Avenida dos Parques, 45', 'Santana de Parnaíba', 'SP', '06544-300', 'Link Studios', -23.4645663, -46.8673712),
    ('Living Zona Oeste', '47.253.476/0001-06', 'Rua Doutor Ribeiro de Almeida, 88', 'São Paulo', 'SP', '01137-020', 'Living Zona Oeste', -23.5247973, -46.6531904),
    ('Lua de Algodao', '65.030.546/0001-30', 'Rua Doutor Romeo Ferro, 245', 'São Paulo', 'SP', '05591-000', 'Lua de Algodao', -23.5793191, -46.7327812),
    ('Lua de Algodão Fundamental', '34.339.025/0001-36', 'Rua José Piragibe, 36', 'São Paulo', 'SP', '05585-040', 'Lua de Algodão Fundamental', -23.5717553, -46.7266409),
    ('Luca', '58.412.651/0001-79', 'Praça Monteiro dos Santos, 69', 'São Paulo', 'SP', '04117-095', 'Luca', -23.5890092, -46.6289914),
    ('Macunaima', '54.325.980/0001-21', 'Avenida Arruda Botelho, 466', 'São Paulo', 'SP', '05466-000', 'Macunaima', -23.5509210, -46.7181577),
    ('Maison Chartres', '05.310.665/0001-15', 'Rua Moliére, 354', 'São Paulo', 'SP', '04671-090', 'Maison Chartres', -23.6573908, -46.6925872),
    ('Maison Classic', '02.287.069/0001-73', 'Rua Rio Grande, 308', 'São Paulo', 'SP', '04018-000', 'Maison Classic', -23.5883936, -46.6424009),
    ('Maison Classique', '05.482.154/0001-80', 'Rua Doutor Tomás Carvalhal, 884', 'São Paulo', 'SP', '04006-003', 'Maison Classique', -23.5771073, -46.6463604),
    ('Manhattans', '02.017.083/0001-57', 'Rua Bela Cintra, 164', 'São Paulo', 'SP', '01415-000', 'Manhattans', -23.5572259, -46.6627653),
    ('Mansões do Lago', '27.551.868/0001-36', 'Avenida do Rio Bonito, 1440', 'São Paulo', 'SP', '04776-002', 'Mansões do Lago', -23.6858382, -46.7025349),
    ('Maria Domitila', '65.036.261/0001-07', 'Avenida Ordem e Progresso, 1190', 'São Paulo', 'SP', '02518-130', 'Maria Domitila', -23.5116821, -46.6663164),
    ('Master Tower', '03.678.564/0001-76', 'Rua Américo Brasiliense, 2171', 'São Paulo', 'SP', '04715-004', 'Master Tower', -23.6326915, -46.6998379),
    ('Mercadinho', '13.776.437/0001-63', 'Rodovia Raposo Tavares, 36700', 'Cotia', 'SP', '06701-000', 'Mercadinho Rec Butanta', -23.6002406, -46.9014983),
    ('Miami Plaza', '54.222.690/0001-52', 'Rua Pamplona, 1551', 'São Paulo', 'SP', '01405-002', 'Miami Plaza', -23.5661045, -46.6560946),
    ('Michelangelo', '02.738.678/0001-00', 'Rua São Benedito, 931', 'São Paulo', 'SP', '04735-000', 'Michelangelo', -23.6423052, -46.6971249),
    ('Mirant Vila Madalena Residencial', '53.963.516/0003-60', 'Rua Senador César Lacerda Vergueiro, 470', 'São Paulo', 'SP', '05435-010', 'Mirant Torre', -23.5475642, -46.6925395),
    ('Mirant Vila Madalena Studios', '53.963.516/0002-89', 'Rua Paulistânia, 130', 'São Paulo', 'SP', '05435-001', 'Mirant Studios', -23.5529616, -46.6896075),
    ('Monte Bianco', '55.641.518/0001-04', 'Avenida Doutor Cardoso de Melo, 155', 'São Paulo', 'SP', '04548-901', 'Monte Bianco', -23.6026549, -46.6760727),
    ('Monte Carlo', '61.409.462/0001-51', 'Rua Tamarataca, 239', 'São Paulo', 'SP', '03119-010', 'Monte Carlo', -23.5663855, -46.5931396),
    ('Mosaico da Aldeia', '19.364.375/0001-69', 'Estrada do Agrônomo, 759', 'Santana de Parnaíba', 'SP', '06519-020', 'Mosaico da Aldeia', -23.4844641, -46.9609039),
    ('Muiraquita', '54.749.023/0001-22', 'Rua Cônego Eugênio Leite, 1068', 'São Paulo', 'SP', '05414-001', 'Muiraquita', -23.5633225, -46.6810342),
    ('Nice', '54.964.580/0001-66', 'Rua Professor Artur Ramos, 213', 'São Paulo', 'SP', '01454-011', 'Nice', -23.5829662, -46.6880230),
    ('Norgren', '46.277.349/0001-76', 'Avenida Engenheiro Alberto de Zagottis, 696', 'São Paulo', 'SP', '04675-085', 'Norgren', -23.6693864, -46.6957886),
    ('One Implantes', '30.072.205/0001-43', 'Avenida Nova Independência, 87', 'São Paulo', 'SP', '04570-000', 'One Implantes', -23.6031100, -46.6908339),
    ('Paco de Moema', '54.955.562/0001-18', 'Rua Pintassilgo, 519', 'São Paulo', 'SP', '04514-032', 'Paco de Moema', -23.6021132, -46.6722357),
    ('Paineiras', '19.048.904/0001-15', 'Rua Engelbert Romer, 124', 'São Paulo', 'SP', '04802-090', 'Paineiras', -23.7106096, -46.7066300),
    ('Palma de Mallorca', '61.383.618/0001-72', 'Rua Marcos Fernandes, 185', 'São Paulo', 'SP', '04149-120', 'Palma de Mallorca', -23.6180898, -46.6207995),
    ('Pamplona I', '59.941.492/0001-62', 'Rua Pamplona, 1813', 'São Paulo', 'SP', '01405-003', 'Pamplona I', -23.5661045, -46.6560946),
    ('Park I', '59.087.452/0001-03', 'Avenida São Remo, 463', 'São Paulo', 'SP', '05360-150', 'Park I', -23.5633611, -46.7448015),
    ('Paroquia Nossa Senhora da Esperança', '60.909.843/0012-90', 'Rua Nossa Senhora de Nazaré, 101', 'São Paulo', 'SP', '04805-100', 'Paroquia Nossa Senhora da Esperança', -23.7147898, -46.6998784),
    ('Pateo Klabin', '24.331.496/0001-44', 'Rua Pedro Victor, 31', 'São Paulo', 'SP', '04124-130', 'Pateo Klabin', -23.5960984, -46.6187785),
    ('Paulistano', '14.634.392/0001-55', 'Rua Tatuí, 77', 'São Paulo', 'SP', '01409-010', 'Paulistano', -23.5664312, -46.6616063),
    ('Paysage Clair', '04.498.056/0001-79', 'Rua Carolina do Norte, 83', 'Vargem Grande Paulista', 'SP', '06730-000', 'Paysage Clair', -23.5998435, -47.0224745),
    ('Paysage Noble', '01.416.812/0001-85', 'Rua Los Angeles, 32', 'Vargem Grande Paulista', 'SP', '06738-196', 'Paysage Noble', -23.6403800, -47.0300100),
    ('Pedro Adam', '64.914.849/0001-53', 'Rua Agostinho Lattari, 94', 'São Paulo', 'SP', '03125-080', 'Pedro Adam', -23.5789905, -46.5915533),
    ('Perola de Osasco', '10.312.721/0001-90', 'Rua Manoel Siqueira Gonçalves, 11', 'Osasco', 'SP', '06040-130', 'Perola de Osasco', -23.5672025, -46.7810119),
    ('Piazza San Pietro', '09.591.357/0001-66', 'Rua Marina Crespi, 118', 'São Paulo', 'SP', '03112-090', 'Piazza San Pietro', -23.5565401, -46.6044189),
    ('Place Vendome', '02.510.092/0001-85', 'Avenida Horácio Lafer', 'São Paulo', 'SP', '04538-082', 'Place Vendome', -23.5878901, -46.6835801),
    ('Pride Ipiranga', '30.331.112/0001-96', 'Rua Doutor Mário Vicente, 1416', 'São Paulo', 'SP', '04270-002', 'Pride Ipiranga', -23.5879688, -46.6147535),
    ('Primavera', '62.025.044/0001-23', 'Rua Galeno de Almeida, 207', 'São Paulo', 'SP', '05410-030', 'Primavera', -23.5522547, -46.6769028),
    ('Prop Starter', '96.474.101/0001-73', 'Rua do Paraíso, 596', 'São Paulo', 'SP', '04103-001', 'Prop Starter', -23.5741280, -46.6385990),
    ('Quintessence', '09.350.751/0001-02', 'Rua Marcos Fernandes, 114', 'São Paulo', 'SP', '04149-120', 'Quintessence', -23.6180898, -46.6207995),
    ('Recanto Butantã', '15.631.900/0001-04', 'Rua Tomás Gonçalves, 121', 'São Paulo', 'SP', '05590-030', 'Recanto Butantã', -23.5768878, -46.7329392),
    ('Renoir e Monet', '55.439.582/0001-07', 'Rua Campo Largo, 190', 'São Paulo', 'SP', '03186-010', 'Renoir e Monet', -23.5670698, -46.5781564),
    ('Reserva Julieta', '56.342.614/0001-06', 'Rua Duarte Leite, 25', 'São Paulo', 'SP', '04720-070', 'Reserva Julieta', -23.6354516, -46.7053941),
    ('Rio Azul', '56.268.154/0001-13', 'Avenida Nove de Julho, 3206', 'São Paulo', 'SP', '01406-000', 'Rio Azul', -23.5666493, -46.6587609),
    ('Rio das Pedras', '54.202.676/0001-97', 'Rua Jesuíno Arruda, 254', 'São Paulo', 'SP', '04532-080', 'Rio das Pedras', -23.5820151, -46.6744995),
    ('Rio Preto', '54.282.892/0001-90', 'Rua Raul Pompéia, 537', 'São Paulo', 'SP', '05025-010', 'Rio Preto', -23.5306458, -46.6880726),
    ('Riservato Alto da Lapa', '11.117.530/0001-30', 'Rua Camândulas, 112', 'São Paulo', 'SP', '05303-030', 'Riservato Alto da Lapa', -23.5273264, -46.7326327),
    ('Rossini', '13.724.194/0001-10', 'Rua Luís Góis, 1820', 'São Paulo', 'SP', '04043-200', 'Rossini', -23.6040259, -46.6392833),
    ('Runaway', '01.422.202/0001-94', 'Rua Nossa Senhora do Outeiro, 240', 'São Paulo', 'SP', '04807-010', 'Runaway', -23.7128374, -46.7010648),
    ('Sabuz', '05.966.481/0001-08', 'Rua José Pedro Roschel, 35 e 43', 'São Paulo', 'SP', '04837-100', 'Sabuz', -23.7386822, -46.7005209),
    ('Saint Cyr', '54.321.641/0001-77', 'Rua Maria Figueiredo, 85', 'São Paulo', 'SP', '04002-000', 'Saint Cyr', -23.5712645, -46.6494730),
    ('San Francesco e San Vittorio', '01.618.547/0001-18', 'Rua Pantaleão Brás, 21', 'São Paulo', 'SP', '05372-080', 'San Francesco e San Vittorio', -23.5819461, -46.7637639),
    ('San Marino', '10.573.383/0001-40', 'Rua Campo Largo, 216', 'São Paulo', 'SP', '03186-010', 'San Marino', -23.5670698, -46.5781564),
    ('São Luiz', '00.367.620/0001-63', 'Rua Doutor Alceu de Campos Rodrigues, 301', 'São Paulo', 'SP', '04544-000', 'São Luiz', -23.5905646, -46.6741114),
    ('Shopping Marajoara', '67.832.246/0001-09', 'Avenida Nossa Senhora do Sabará, 765', 'São Paulo', 'SP', '04685-000', 'Shopping Marajoara', -23.6847665, -46.6808154),
    ('Simoes & Cruz', '35.638.266/0001-49', 'Rua João Pedro, 280', 'São Paulo', 'SP', '04781-040', 'Simoes & Cruz', -23.6899752, -46.7070442),
    ('Sobradão', '54.204.680/0001-94', 'Rua Bela Cintra, 1744', 'São Paulo', 'SP', '01415-006', 'Sobradão', -23.5527377, -46.6560256),
    ('Solar Anhembi', '54.064.555/0001-26', 'Rua Doutor Tomás Carvalhal, 873', 'São Paulo', 'SP', '04006-003', 'Solar Anhembi', -23.5771073, -46.6463604),
    ('Soma Perdizes Offices', '56.911.617/0002-02', 'Avenida Sumaré, 169', 'São Paulo', 'SP', '05016-090', 'Soma Perdizes Offices', -23.5319431, -46.6761655),
    ('Soma Perdizes Residencial', '56.911.617/0001-13', 'Avenida Sumaré, 169', 'São Paulo', 'SP', '05016-090', 'Soma Perdizes Residencial', -23.5319431, -46.6761655),
    ('SPE Bandeirantes', '33.092.919/0001-01', 'Avenida Nova Independência, 87 - Cjto 41', 'São Paulo', 'SP', '04570-000', 'SPE Bandeirantes', -23.6031100, -46.6908339),
    ('Sun Gate', '01.525.630/0001-42', 'Avenida Engenheiro Luiz Gomes Cardim Sangirardi, 531', 'São Paulo', 'SP', '04112-080', 'Sun Gate', -23.5837000, -46.6327408),
    ('Sunnyvale', '49.467.293/0001-00', 'Rua Quatá, 521', 'São Paulo', 'SP', '04546-043', 'Sunnyvale', -23.5956098, -46.6835652),
    ('Sunnyvale Itaqua', '49.467.293/0002-91', 'Rua Radium, 100', 'Itaquaquecetuba', 'SP', '08586-430', 'Sunnyvale Itaqua', -23.4358191, -46.3286279),
    ('Sunset', '53.827.903/0001-07', 'Rua Bergamota, 86', 'São Paulo', 'SP', '05468-000', 'Sunset', -23.5387752, -46.7167986),
    ('Sweet Park', '04.936.694/0001-24', 'Rua Machado de Assis, 822', 'São Paulo', 'SP', '04106-001', 'Sweet Park', -23.5822325, -46.6371444),
    ('Taman', '18.669.284/0001-79', 'Rua Nicola Rollo, 151', 'São Paulo', 'SP', '05726-140', 'Taman', -23.6277955, -46.7420082),
    ('Tarumã', '71.735.278/0001-55', 'Rua Aimorés, 208', 'Santana de Parnaíba', 'SP', '06515-380', 'Tarumã', -23.4774590, -46.8902543),
    ('Telerisco', '27.782.559/0001-77', 'Rua Doutor Rafael de Barros, 209', 'São Paulo', 'SP', '04003-041', 'Telerisco', -23.5730372, -46.6474607),
    ('Tenis Village', '56.339.179/0001-60', 'Estrada dos Pereiras, 1151', 'Cotia', 'SP', '06726-360', 'Tenis Village', -23.6659968, -47.0368910),
    ('Theo', '07.023.473/0001-53', 'Rua Jaci, 30', 'São Paulo', 'SP', '04140-080', 'Theo', -23.6058436, -46.6289279),
    ('Top One', '00.061.563/0001-90', 'Rua Doutor José Estefno, 236', 'São Paulo', 'SP', '04116-060', 'Top One', -23.5837000, -46.6327408),
    ('Top Tower', '05.331.864/0001-00', 'Rua Francisco Leitão, 115', 'São Paulo', 'SP', '05414-025', 'Top Tower', -23.5593767, -46.6825581),
    ('Umuarama', '55.442.446/0001-68', 'Rua Manguaba, 292', 'São Paulo', 'SP', '04650-020', 'Umuarama', -23.6559372, -46.6780503),
    ('Universal Serras', '02.409.968/0001-00', 'Rua Lauzane, 564', 'São Paulo', 'SP', '04782-010', 'Universal Serras', -23.6860804, -46.7049549),
    ('Varanda Ipiranga', '23.772.645/0001-48', 'Rua Clemente Pereira, 665', 'São Paulo', 'SP', '04216-060', 'Varanda Ipiranga', -23.5983359, -46.6048030),
    ('Velazquez', '03.051.230/0001-78', 'Avenida Coronel Francisco Júlio César Alkeri, 144', 'São Paulo', 'SP', '04651-000', 'Velazquez', -23.6344957, -46.6682760),
    ('Veneza', '02.999.632/0001-36', 'Rua Dom Antônio Barreiros, 73', 'São Paulo', 'SP', '04134-090', 'Veneza', -23.6073433, -46.6223328),
    ('Verana', '11.246.820/0001-84', 'Rua Guaipá, 452', 'São Paulo', 'SP', '05089-000', 'Verana', -23.5212608, -46.7304877),
    ('Via Nacoes', '37.899.315/0001-22', 'Rua Jubair Celestino, 195', 'Osasco', 'SP', '06216-160', 'Via Nacoes', -23.5225132, -46.7690313),
    ('Vienna', '74.326.216/0001-88', 'Rua Antônia Bizarro, 70', 'Osasco', 'SP', '06083-160', 'Vienna', -23.5403365, -46.7802921),
    ('Vila de Bragança', '13.784.864/0001-93', 'Rua Cisplatina, 178', 'São Paulo', 'SP', '04211-040', 'Vila de Bragança', -23.5876262, -46.5987387),
    ('Vila Lagos', '23.982.514/0001-95', 'Rua Nicolau Alayon, 477', 'São Paulo', 'SP', '04802-000', 'Vila Lagos', -23.7089742, -46.7061559),
    ('Vila Velha', '08.242.335/0001-28', 'Rua Pamplona, 1736', 'São Paulo', 'SP', '01405-002', 'Vila Velha', -23.5661045, -46.6560946),
    ('Villa Lobos', '26.342.614/0001-45', 'Rua Ibitirama, 2130', 'São Paulo', 'SP', '03134-002', 'Villa Lobos', -23.5834291, -46.5847695),
    ('Villagio Suzana', '17.652.494/0001-91', 'Rua João Pedro, 430', 'São Paulo', 'SP', '04781-040', 'Villagio Suzana', -23.6899752, -46.7070442),
    ('Ville Marseille', '03.576.850/0001-20', 'Rua Alabarda, 240', 'São Paulo', 'SP', '04641-020', 'Ville Marseille', -23.6396628, -46.6868584),
    ('Vitoria Regia', '64.728.124/0001-70', 'Rua Loefgren, 359', 'São Paulo', 'SP', '04040-030', 'Vitoria Regia', -23.5996778, -46.6423183),
    ('Wafios', '62.249.586/0001-80', 'Avenida Engenheiro Alberto de Zagottis, 696', 'São Paulo', 'SP', '04675-085', 'Wafios', -23.6693864, -46.6957886),
    ('Window Moema Mall', '54.883.436/0002-86', 'Avenida Ibirapuera, 1835', 'São Paulo', 'SP', '04029-100', 'Window Moema Mall', -23.5955036, -46.6546668),
    ('Window Moema Residencial', '54.883.436/0001-03', 'Avenida Açocê, 50', 'São Paulo', 'SP', '04075-020', 'Window Moema Residencial', -23.6033587, -46.6566278),
    ('Alexandre Gama de Medeiros', '010.130.168-58', 'Rua Lélis Vieira, 135', 'São Paulo', 'SP', '05419-010', 'Resid. Gama', -23.5571813, -46.6993779),
    ('Caio Augusto Cardoso', '268.952.378-79', 'Rua Atibaia, 104', 'São Paulo', 'SP', '01235-010', 'Resid. Caio Cardoso', -23.5509581, -46.6629677),
    ('Clovis Residencia', '125.605.988-92', 'Rua Fradique Coutinho, 1845', 'São Paulo', 'SP', '05416-010', 'Residencia Clovis', -23.5638974, -46.6859616),
    ('Eduardo Carballido', '825.739.217-00', 'Rua Lélis Vieira, 185', 'São Paulo', 'SP', '05419-010', 'Resid. Carballido', -23.5571813, -46.6993779),
    ('Francisco Goeye', '303.129.968-02', 'Rua Lélis Vieira, 201', 'São Paulo', 'SP', '05419-010', 'Resid. Francisco', -23.5571813, -46.6993779),
    ('Gustavo Roxo', '149.225.568-85', 'Rua Lélis Vieira, 100', 'São Paulo', 'SP', '05419-010', 'Resid. Gustavo Roxo', -23.5571813, -46.6993779),
    ('Nicole Caetano', '367.844.618-35', 'Rua Gomes Pedrosa, 379', 'São Paulo', 'SP', '04805-340', 'Nicole', -23.7135324, -46.7071828),
    ('Ricardo Parasmo', '035.531.948-98', 'Rua Nebraska, 522', 'São Paulo', 'SP', '04560-012', 'Resid. Parasmo', -23.6100900, -46.6818470),
    ('Robson Altino de Lima', '012.282.648-56', 'Rua das Sempre-Vivas, 98', 'São Paulo', 'SP', '04704-030', 'Robson', -23.6252485, -46.6893714);

-- normalização de nome: sem acento (translate cobre o português), sem caixa,
-- espaços colapsados — a mesma régua dos dois lados do casamento
CREATE OR REPLACE FUNCTION pg_temp.norm_u24(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(translate(lower(coalesce(t, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '\s+', ' ', 'g'))
$$;

-- ── 3. Casamento e atualização ──────────────────────────────────────────────
-- PRÉ-VOO (não altera nada; leia o resultado antes de seguir).
-- Se voltar alguma linha, existe cadastro com o NOME de um cliente e outro
-- com o DOCUMENTO dele. Consolide em /clientes/migrar ANTES de rodar o resto:
-- a etapa 3 tentaria mover o documento e bateria no índice único da U0.
SELECT p.nome AS linha_da_planilha,
       a.id   AS casado_por_nome,
       b.id   AS dono_do_documento
FROM _planilha_u24 p
JOIN public.clientes a ON pg_temp.norm_u24(a.nome) = pg_temp.norm_u24(p.nome)
JOIN public.clientes b ON b.documento IS NOT NULL AND b.documento <> ''
                      AND regexp_replace(b.documento, '\D', '', 'g')
                        = regexp_replace(p.documento, '\D', '', 'g')
WHERE a.id <> b.id;

DROP TABLE IF EXISTS _casados_u24;
CREATE TEMP TABLE _casados_u24 AS
SELECT DISTINCT ON (p.nome)
       c.id AS cliente_id, p.nome AS nome_planilha
FROM _planilha_u24 p
JOIN public.clientes c
  ON pg_temp.norm_u24(c.nome) = pg_temp.norm_u24(p.nome)
  OR (c.documento IS NOT NULL AND c.documento <> ''
      AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(p.documento, '\D', '', 'g'))
-- O desempate PREFERE quem já é dono do documento. É o que impede o script de
-- morrer: a U0 criou índice único em somente_digitos(documento), e se o
-- casamento escolhesse o cadastro mais antigo (tipicamente o de visita, sem
-- documento) o UPDATE gravaria um CNPJ que outro registro ainda segura →
-- unique_violation → rollback de tudo. NULLS LAST é obrigatório: DESC no
-- Postgres é NULLS FIRST, e sem documento a expressão é NULL.
ORDER BY p.nome,
         (c.documento IS NOT NULL AND c.documento <> ''
          AND regexp_replace(c.documento, '\D', '', 'g')
            = regexp_replace(p.documento, '\D', '', 'g')) DESC NULLS LAST,
         c.created_at;

-- Um MESMO cadastro casado por duas linhas da planilha (nome de um, documento
-- de outro) daria UPDATE não-determinístico, em silêncio. Aqui ele grita.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT cliente_id FROM _casados_u24 GROUP BY cliente_id HAVING count(*) > 1
  ) x;
  IF n > 0 THEN
    RAISE EXCEPTION 'U24: % cadastro(s) casaram com mais de uma linha da planilha. Consolide em /clientes/migrar antes de rodar.', n;
  END IF;
END $$;

UPDATE public.clientes c
SET documento      = p.documento,
    endereco       = p.logradouro,
    cidade         = p.cidade,
    uf             = p.uf,
    cep            = p.cep,
    posto_servico  = p.posto,
    -- só promove quem ainda não é cliente. 'ativo' incondicional faria a
    -- reexecução ressuscitar quem um gestor inativou na mão depois da 1ª vez.
    situacao       = CASE WHEN c.situacao = 'prospecto' THEN 'ativo' ELSE c.situacao END,
    updated_at     = now(),
    latitude       = COALESCE(c.latitude,  p.lat),
    longitude      = COALESCE(c.longitude, p.lng)
FROM _casados_u24 m
JOIN _planilha_u24 p ON p.nome = m.nome_planilha
WHERE c.id = m.cliente_id;

-- ── 4. Inserção dos que não existem ─────────────────────────────────────────
-- owner_id: NOT NULL herdado do schema original; o dono passa a ser o admin
-- mais antigo (a coluna virou vestígio — a leitura é liberada por RLS).
INSERT INTO public.clientes
  (owner_id, nome, documento, endereco, cidade, uf, cep, posto_servico,
   situacao, latitude, longitude)
SELECT
  (SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1),
  p.nome, p.documento, p.logradouro, p.cidade, p.uf, p.cep, p.posto,
  'ativo', p.lat, p.lng
FROM _planilha_u24 p
WHERE NOT EXISTS (SELECT 1 FROM _casados_u24 m WHERE m.nome_planilha = p.nome)
  AND NOT EXISTS (SELECT 1 FROM public.clientes c
                   WHERE pg_temp.norm_u24(c.nome) = pg_temp.norm_u24(p.nome));

-- ── 5. Rebaixamento auditável (padrão U8) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes_rebaixados_u24 (
  cliente_id uuid PRIMARY KEY,
  nome text NOT NULL,
  situacao_anterior text NOT NULL,
  rebaixado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes_rebaixados_u24 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rebaixados_u24_admin ON public.clientes_rebaixados_u24;
CREATE POLICY rebaixados_u24_admin ON public.clientes_rebaixados_u24
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

WITH fora AS (
  SELECT c.id, c.nome, c.situacao
  FROM public.clientes c
  WHERE c.situacao = 'ativo'
    AND NOT EXISTS (
      SELECT 1 FROM _planilha_u24 p
      WHERE pg_temp.norm_u24(p.nome) = pg_temp.norm_u24(c.nome)
         OR (c.documento IS NOT NULL AND c.documento <> ''
             AND regexp_replace(c.documento, '\D', '', 'g') = regexp_replace(p.documento, '\D', '', 'g'))
    )
), audit AS (
  INSERT INTO public.clientes_rebaixados_u24 (cliente_id, nome, situacao_anterior)
  SELECT id, nome, situacao FROM fora
  ON CONFLICT (cliente_id) DO NOTHING
  RETURNING cliente_id
)
UPDATE public.clientes c
SET situacao = 'inativo', updated_at = now()
FROM fora f
WHERE c.id = f.id;

-- ── 6. Permissões: Clientes sai do técnico ──────────────────────────────────
-- (mesmo formato literal da U11 — o verificador de lógica lê este bloco e o
-- da U11 e compõe a semente efetiva; ver scripts/verificar-logica.cjs)
INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES
  ('clientes',        'tecnico',   false),
  ('clientes',        'comercial', true),
  ('clientes',        'sac',       true),
  ('clientes.novo',   'tecnico',   false),
  ('clientes.novo',   'comercial', true),
  ('clientes.novo',   'sac',       true),
  ('clientes.migrar', 'tecnico',   false),
  ('clientes.migrar', 'comercial', true),
  ('clientes.migrar', 'sac',       true)
ON CONFLICT (tela, cargo) DO UPDATE SET permitido = EXCLUDED.permitido;

-- ── Verificação ─────────────────────────────────────────────────────────────
SELECT 'planilha' AS etapa, count(*) AS qtd FROM _planilha_u24
UNION ALL
SELECT 'ativos agora', count(*) FROM public.clientes WHERE situacao = 'ativo'
UNION ALL
SELECT 'com coordenada', count(*) FROM public.clientes
 WHERE situacao = 'ativo' AND latitude IS NOT NULL
UNION ALL
SELECT 'com documento', count(*) FROM public.clientes
 WHERE situacao = 'ativo' AND documento IS NOT NULL AND documento <> ''
UNION ALL
SELECT 'rebaixados nesta rodada', count(*) FROM public.clientes_rebaixados_u24
 WHERE rebaixado_em > now() - interval '5 minutes'
UNION ALL
SELECT 'rebaixados (total acumulado)', count(*) FROM public.clientes_rebaixados_u24
UNION ALL
SELECT 'inseridos agora (sem visita anterior)', count(*) FROM public.clientes
 WHERE posto_servico IS NOT NULL AND created_at > now() - interval '5 minutes' 
UNION ALL
SELECT 'permissao clientes/tecnico = false', count(*) FROM public.permissoes_tela
 WHERE tela LIKE 'clientes%' AND cargo = 'tecnico' AND permitido = false;
