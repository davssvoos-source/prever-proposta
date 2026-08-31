-- ═══════════════════════════════════════════════════════════════════════════
-- U78 — A GRADE DA PROGRAMAÇÃO: O BLOCO DE AGENDA E O BLOQUEIO DE HORÁRIO
--        (R99/R100/R101 — Fase 1, Passo 1.2 da absorção do Gestor OS)
--
-- Davi, 2026-08-31: "emergencial não é tipo novo — é corretiva com prioridade
-- urgente." A mesma régua vale para o desenho inteiro: nada de conceito novo
-- onde a cardinalidade já obriga a uma tabela, e nada de tabela nova onde uma
-- derivação resolve.
--
-- >>> RODAR NO SQL EDITOR DO SUPABASE, À MÃO. Idempotente: rodar de novo é
-- >>> no-op (não há backfill de bloco nenhum — de propósito, ver §9.7).
-- >>> Esta migration é ADITIVA e pode ir SOZINHA, antes do código novo: nada
-- >>> do que existe hoje passa a ler ou escrever a tabela nova, e a coluna
-- >>> chamados.data_hora_agendada continua sendo escrita pelos mesmos três
-- >>> caminhos de sempre enquanto não houver bloco. A ordem segura é:
-- >>> MIGRATION PRIMEIRO, DEPLOY DEPOIS.
--
-- ── O DEFEITO QUE ESTA MIGRATION EXISTE PARA CONSERTAR ─────────────────────
-- /chamados/programacao grava `new Date(`${novaData}T12:00:00`)`. Meio-dia é um
-- SENTINELA, não uma hora escolhida — e reprogramar por aquela tela APAGA a hora
-- que /chamados/novo-campo e o PainelChamado gravaram. Não existe duração, não
-- existe deslocamento, não existe conflito, e portanto não existe como somar a
-- jornada de ninguém nem dizer se a semana da equipe cabe. O Vinicius tem tudo
-- isso no sistema dele há anos; nós temos uma data e um técnico.
--
-- ── POR QUE UM SATÉLITE, E NÃO DUAS COLUNAS NO CHAMADO ─────────────────────
-- O argumento é CARDINALIDADE, e ele tem dois lados.
--   · 1:N — o RETORNO é 1:N por definição: foi terça, faltou peça, volta
--     quinta. Dois blocos de tempo, um chamado. Se a atividade FOSSE o chamado,
--     "retorno" viraria valor novo em `chamados.status` e encostaria em
--     STATUS_ORDEM, statusDaNatureza, chamadoEmAberto, as cores, o kanban da
--     Início, indicadores.ts e situacaoPrazo — sete lugares para representar uma
--     segunda ida. Aqui "retorno" é DERIVADO da ordem dos blocos: zero coluna.
--     E a Fase 4 (cronograma de implantação) já pede N blocos por chamado.
--   · N:0 — a "OS que veio de fora do sistema" NÃO CABE num chamado, e isto é
--     estrutura, não preferência: `chamados.cliente_id` é
--     NOT NULL REFERENCES public.clientes(id) desde a etapa 3. Serviço para quem
--     não está na base de clientes não pode existir como chamado, mas OCUPA a
--     equipe igual — e uma grade que não mostra isso mente sobre a semana.
--     `chamados.numero_externo` não serve: ele tem índice único por cliente e
--     pressupõe que o registro exista.
-- O que NÃO se copiou do Gestor OS foi o "Agendamento" dele, que é entidade
-- paralela porque a OS vinha do SIGMA, externa. Aqui o satélite é MAGRO: só o
-- tempo, a equipe de campo, e o que só existe quando não há chamado.
--
-- ── A PEÇA QUE EVITA DUAS VERDADES: O ESPELHO ──────────────────────────────
-- `chamados.data_hora_agendada` é lida em doze arquivos do app (mais dezessete
-- que falam de `visitas_tecnicas`, que esta migration não alcança e não deve
-- alcançar). Ela DEIXA de ser escrita pela programação e vira ESPELHO DERIVADO
-- do bloco, mantido por gatilho — é isso que faz o calendário,
-- serieAtividadesPorEscala, lentes.ts, indicadores.ts e o card da Início
-- continuarem lendo a mesma coluna sem mudar uma linha.
--
-- A DEFINIÇÃO, sem ambiguidade e em dois estágios:
--   1. o início do bloco PENDENTE mais antigo (não cancelado, não cumprido);
--   2. se todos já foram cumpridos, o ÚLTIMO deles.
-- O estágio 1 é o que faz o RETORNO aparecer na quinta-feira em que ele
-- acontece: sem `cumprido_em` o espelho ficaria pinado na terça para sempre, e
-- `atividadesDeHoje` (que compara só ano/mês/dia) apontaria para o dia errado
-- exatamente na tela em que o técnico vive. O estágio 2 existe porque zerar
-- faria o chamado ainda aberto perder a data no PDF (relatorio.ts imprime
-- "Agendamento") e sair do calendário por ter sido atendido.
-- O desempate final é por `id`: sem ordem TOTAL o espelho seria
-- NÃO-DETERMINÍSTICO, e um espelho que oscila entre duas escolhas reescreve
-- `updated_at` e dispara realtime a cada gravação.
-- O gêmeo puro em TypeScript é `espelhoDoChamado()` em
-- src/features/programacao/modelo.ts, coberto por asserção contra o mesmo caso.
--
-- ── QUEM PODE MEXER NUM BLOCO: A PORTA AUTORIZA OS DOIS LADOS ──────────────
-- `agenda_campo_select` é USING (true) (§4), e isso é decisão e não descuido:
-- se o técnico não enxerga um bloco, o chip de ocupação da equipe dele mostra
-- 40% onde há 90%. O preço é que TODO autenticado enumera o id de TODO bloco, e
-- que a autorização inteira passa a morar na porta de escrita — que é SECURITY
-- DEFINER e portanto passa por cima da RLS.
-- Por isso `agenda_campo_marcar` (§6.1) autoriza DUAS coisas, não uma:
--   · o chamado de DESTINO — o que o chamador está PONDO no bloco;
--   · o DONO ATUAL do bloco — o chamado que já está lá; e, quando não há
--     chamado, o papel de gestor, porque serviço fora do sistema é ato de
--     gestão (a mesma régua do §3 e do §6.2).
-- Sem a segunda, quem abriu um chamado bobo qualquer arrasta para ele o bloco
-- de um chamado alheio: o espelho reage à troca de `chamado_id`, o chamado
-- roubado perde `data_hora_agendada`, some do calendário, do card da Início e
-- do PDF, e não há sino nem linha do tempo para contar. `agenda_campo_cancelar`
-- e `agenda_campo_cumprir` sempre leram a linha antes de decidir; `marcar` era
-- a única que decidia sobre os ARGUMENTOS e nunca sobre o ESTADO, e a
-- assimetria entre as três é que denunciava o buraco.
--
-- E NULL NUM PARÂMETRO DE `marcar` É "NÃO MEXI", NUNCA "APAGUE": a função é
-- PATCH contra a linha viva, não REPLACE. Arrastar o cartão "OS-9911 · Portão
-- do condomínio vizinho" de terça para quarta sem repassar `_os_externa` e
-- `_titulo_externo` apagaria o ÚNICO registro daquele serviço — ele não cabe em
-- `public.chamados` porque `cliente_id` é NOT NULL.
--
-- ── O QUE A PORTA AINDA NÃO DECIDE (pergunta pendente para o Davi) ─────────
-- `agenda_campo_marcar` é concedida a `authenticated` inteiro e delega a
-- autorização a `pode_editar_chamado`, que é VÍNCULO com o chamado, não PAPEL.
-- Efeito declarado: um técnico que responde por um chamado pode ocupar a agenda
-- de QUALQUER equipe de campo, em qualquer dia, sem estar na escala dela — ao
-- passo que `duplas`, `duplas_escala` e `duplas_escala_semanas` (U47/U76)
-- gateiam escrita por `is_gestor` NA POLICY, e a R13 diz que coordenar e
-- programar é papel do SAC.
-- Isto é uma MUDANÇA DE FRONTEIRA DE PERMISSÃO, e ela está aqui registrada como
-- decisão consciente, não como esquecimento. O fecho, se o Davi quiser,
-- é uma linha em `agenda_campo_marcar`:
--     IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid())
--        AND public.dupla_da_pessoa(auth.uid(), v_dia) IS DISTINCT FROM v_dupla
--     THEN RAISE EXCEPTION 'Você não está na escala desta equipe nesta semana.'
--     END IF;
-- (`dupla_da_pessoa` existe desde a U76 e é concedida a authenticated.) Não foi
-- aplicada porque a resposta muda a R99/R100 antes de mudar o SQL, e migration
-- não é lugar de decidir produto sozinha.
--
-- ── A ARMADILHA: trg_chamado_apoio_dupla_upd (U76) ─────────────────────────
-- A U76 criou `AFTER UPDATE OF responsavel_id, data_hora_agendada, natureza`.
-- Se o espelho passa a escrever aquela coluna, esse gatilho dispara em cascata,
-- e o medo registrado no plano era "reagendei e tocaram trinta sinos". O medo
-- estava MAL ENDEREÇADO, e a diferença importa:
--   · `trg_notify_chamado_upd` é `OF status, responsavel_id`. O espelho escreve
--     UMA coluna e não é nenhuma das duas — ele NÃO ALCANÇA os sinos de chamado.
--     Além disso `notify_chamado` (U13) só notifica em responsável novo, em
--     `-> aguardando_aprovacao` e em `-> concluido`: `aberto -> agendado` não
--     produz sino nenhum, nem quando disparado de propósito.
--   · O risco real é `trg_chamado_apoio_dupla_upd`, porque cada INSERT em
--     `chamado_apoios` dispara `trg_notify_chamado_apoio` ("Você entrou como
--     apoio"). Ele é controlado em QUATRO camadas, em ordem de dureza:
--       (1) a lista `AFTER UPDATE OF` do gatilho do satélite é curta: só
--           `dia, inicio_min, cumprido_em, cancelado_em, chamado_id`. Corrigir a
--           duração, o deslocamento ou a equipe do bloco não CHAMA a função de
--           espelho. Isto mata metade das gravações da tela nova antes de tudo.
--       (2) `IS DISTINCT FROM` no WHERE do UPDATE. `AFTER UPDATE OF` dispara
--           pela PRESENÇA da coluna no SET, mesmo com valor igual (a U76 escreve
--           isso em letras), então sem esta cláusula cada mexida no satélite
--           reescreveria a mesma data, bombardeando `updated_at` — que
--           atividades/modelo.ts usa como `encerradoEm` — e o realtime.
--       (3) `status NOT IN ('concluido','cancelado')` no mesmo WHERE: registro é
--           registro, e é isto que fecha de vez o desvio de `encerradoEm`.
--       (4) a defesa interna da própria U76: o que passa das três e cai na mesma
--           SEMANA ISO volta cedo. Este gatilho NÃO é desligado e NÃO é alterado
--           na sua tese — a cascata "mudou a semana do trabalho, recalcula o
--           apoio" é a intenção declarada da U76, e o que se controla é a
--           FREQUÊNCIA do UPDATE, nunca o gatilho.
-- A mudança na U76 é a MESMA REGRA em DOIS lugares (§7), para o caso que o
-- espelho CRIA e que não existia: cancelar o último bloco escreve NULL, e aí
-- `dia_da_dupla` cai no COALESCE para `created_at` — outra semana — e o apoio
-- seria recalculado contra a escala da semana de ABERTURA, com sino, por um ato
-- que só disse "não sei mais quando".
--   · §7.1 — a guarda dentro de `chamado_apoio_da_dupla()` (o gatilho), mais a
--     correção da VOLTA: quando a data retorna depois de um desagendamento,
--     `v_dia_antes` cai outra vez em `created_at`, e a saída cedo herdada da U76
--     ("nem dono nem semana mudaram") estaria comparando contra o mesmo palpite
--     que a guarda de cima acabou de recusar — deixando o apoio na semana
--     antiga. Desmarcar e remarcar para a semana de abertura é a operação mais
--     banal do balcão, e sem a correção ela regride a invariante do CLAUDE.md.
--   · §7.2 — o MESMO "não sei" em `reconciliar_apoios_abertos()`. A guarda do
--     gatilho não alcança essa função: ela chama `chamado_sincronizar_apoio`
--     DIRETO, pulando o gatilho inteiro. Sem o filtro, a ferramenta oficial da
--     casa (U76 §8.4) faz, quando o Davi a roda, exatamente o dano que a guarda
--     previne.
-- NÃO se pôs a regra dentro de `chamado_sincronizar_apoio` (que seria "onde os
-- dois chamadores passam") por um motivo medido: aquela função não sabe O QUE
-- mudou. Recusando lá, um chamado SEM data que TROCA de responsável deixaria de
-- reatribuir o apoio — o apoio do responsável antigo ficaria colado num chamado
-- que agora é de outra pessoa, quebrando a promessa central da U76 ("apoio
-- segue o responsável"). A regra é sobre a DATA sumir, e só os dois chamadores
-- sabem disso.
--
-- RECURSÃO: não existe hoje, e o §9 prova isso por SUBSTRING — ele conta os
-- gatilhos de `public.chamados` cuja DEFINIÇÃO cita `agenda_campo`. Diga-se com
-- todas as letras o que essa prova não cobre: um gatilho futuro que chame uma
-- função que, no corpo dela, insira em `agenda_campo` passa liso pela
-- conferência, e aí o ciclo fecha sem aviso. Um passeio de dependência de
-- verdade não cabe numa linha de conferência; o que cabe é esta frase.
-- O sentido de escrita HOJE é único — `agenda_campo` -> `chamados` ->
-- `chamado_apoios` -> `notificacoes` e fim. A aresta de volta (a faixa
-- "agendado sem horário" com um clique para dar horário) é RPC, nunca gatilho.
--
-- ── O QUE NÃO MUDA ─────────────────────────────────────────────────────────
-- · `chamados.dupla_id` continua não existindo. A equipe de um CHAMADO continua
--   DERIVADA do responsável (U47/U76). `agenda_campo.dupla_id` responde outra
--   pergunta — "quem se comprometeu com esta janela de tempo" — e existe porque
--   não se declara `EXCLUDE (derivação_em_outra_tabela WITH =)`. A divergência
--   entre as duas é REAL, não é consertada por gatilho (escrita de cadastro não
--   reescreve registro), e quem a MOSTRA é o modelo puro (`divergenciaDeEquipe`,
--   contada no cabeçalho da semana). A consulta equivalente que esta migration
--   trazia foi CORTADA — ela confundia "sem escala" com "fora da equipe", e o
--   lugar dela é `docs/manual/`, não uma migration. Ver §2.2 para o preço da
--   coluna.
-- · A U76 inteira, e a frase da U64 ("NÃO HÁ BACKFILL, DE PROPÓSITO").
-- · O vocabulário: "equipe" sem adjetivo é DEPARTAMENTO (U71); "modalidade" é
--   `cliente_contratos.modalidade`; e "bloco" no banco é bloco de ORÇAMENTO
--   (public.blocos, blocos_itens, projeto_blocos, visita_blocos, regras_blocos,
--   src/lib/blocos.ts) — por isso a tabela se chama `agenda_campo` e "bloco" é
--   palavra de conversa e de TypeScript, nunca nome de tabela. Terceira colisão
--   evitada.
-- · `natureza='comercial'`: quem escreve `chamados.data_hora_agendada` lá é
--   `trg_sincronizar_chamado_da_visita` (U41), que a reescreve a cada UPDATE de
--   NOVE colunas da visita — título inclusive. Duas donas para uma coluna é o
--   horário do bloco sumindo por uma edição de texto, então o satélite RECUSA
--   chamado que não seja de campo, estruturalmente (§3).
--
-- ── UM FATO QUE CIRCULA ERRADO, E QUE MUDA O DESENHO DA RLS ────────────────
-- A policy `chamados_update` NÃO tem hoje a trava de concluído/cancelado. A U7
-- (:553-558) a tinha; a S1 (20260820170000, :414-424) fez DROP + CREATE com
-- `USING/WITH CHECK public.pode_editar_chamado(id)`, sem a trava, e nenhuma
-- migration posterior a repôs. Logo, a trava de encerrado do §3 NÃO é "repetir o
-- que chamados já faz" — é REPOR uma garantia que não existe mais em lugar
-- nenhum, e o espelho é a razão para repô-la aqui: o gatilho do espelho é
-- SECURITY DEFINER e passa por cima de qualquer policy de `chamados`, então a
-- autorização de mexer na data de um chamado passa a ser decidida NESTA tabela.
--
-- ── O QUE SAIU DESTE ARQUIVO ANTES DE ELE RODAR, E POR QUÊ ─────────────────
-- Três peças foram CORTADAS na revisão. Ficam registradas porque a próxima
-- pessoa vai procurar por elas nos relatórios e não achar no arquivo:
--   · A VÁLVULA `prever.lote` em `notify_chamado_apoio()`. Ela existia para o
--     cenário "mover cem blocos de sexta para segunda sem duzentos sinos" — e
--     esse cenário são N chamadas do app, cada uma sua PRÓPRIA transação, ao
--     passo que `set_config(..., is_local => true)` morre no COMMIT de UMA. Não
--     havia parâmetro de lote, não havia RPC companheira, e o cliente não emite
--     `SET`: a válvula só era acionável do SQL Editor, onde uma linha de
--     `set_config` antes da carga resolve sem reescrever função nenhuma. Ela
--     cobria só `notify_chamado_apoio` e deixava `notify_chamado` de fora, então
--     a promessa "carga em lote não enche o bolso de ninguém" era falsa para
--     qualquer carga que tocasse status ou responsável. Cortá-la remove uma
--     afirmação falsa E uma função viva reescrita à mão. Se a Fase 2 precisar de
--     lote de verdade, ele nasce como `agenda_campo_marcar_lote(jsonb)`, que é
--     UMA transação e aí tem consumidor.
--   · A SEGUNDA LISTA "quem não casou" (bloco × escala da semana). Ela usava
--     `dupla_da_pessoa(...) IS DISTINCT FROM a.dupla_id`, e `dupla_da_pessoa`
--     devolve NULL para quem não tem escala na semana — misturando "sem escala"
--     com "fora da equipe" numa lista que nasce cheia de ruído. O gêmeo puro
--     (`divergenciaDeEquipe`) separa os dois; a consulta não separava. Consulta
--     que o Davi vai querer daqui a um mês mora em `docs/manual/`, não numa
--     migration.
--   · A "ALTERNATIVA COM GATILHO" do rodapé: vinte linhas de plpgsql comentado
--     que o próprio arquivo declarava PIOR. Ninguém cola uma implementação
--     alternativa às 23h no meio de um aborto — pergunta. O PARÁGRAFO que
--     explica por que o gatilho é pior FICOU (é a justificativa do btree_gist);
--     o código foi embora.
--
-- ── ORDEM DAS SEÇÕES (é segurança, não estilo) ─────────────────────────────
--   §0 foto de antes                     ← as afirmações centrais são NEGATIVAS
--   §1 pré-voo                           ← prova que as dependências existem E
--                                          que as funções da U76 são as que eu
--                                          penso ANTES de eu reescrevê-las
--   §2 a tabela nova + índices           ← a garantia NOVA nasce primeiro
--   §3 o gatilho de validação            ← natureza e encerrado
--   §4 RLS e grants                      ← porta única de escrita
--   §5 o espelho                         ← só depois de a tabela existir
--   §6 as portas de escrita (RPC)        ← 6.0 as duas peças de frase; 6.1..6.4
--   §7 a MESMA guarda nos dois chamadores da U76 (gatilho e reconciliação)
--   §8 PORTÃO                            ← o corpo retranscrito manteve tudo? E
--                                          o md5 continua o mesmo?
--   §9 conferência                       ← UM result set, com veredito
-- Tudo em UMA transação: DDL no Postgres é transacional, então qualquer RAISE
-- (inclusive o do portão) devolve tabela, gatilhos e corpos de função ao estado
-- exato de antes. O BEGIN/COMMIT também é obrigatório porque o §7 troca o corpo
-- de duas funções vivas da U76 e o §8 é quem autoriza aquilo a valer.
--
-- ── DEPOIS DE RODAR, UM ENSAIO À MÃO (dois minutos) ────────────────────────
-- O corpo de uma função plpgsql só tem as consultas dele ANALISADAS na primeira
-- execução de verdade: o `CREATE FUNCTION` valida a sintaxe do plpgsql e NÃO
-- valida nome de coluna dentro dos SELECTs. A conferência do §9 executa de
-- propósito `agenda_campo_espelhar`, `agenda_campo_frase_do_conflito` e
-- `duracao_texto` (as três não escrevem nada), mas NÃO pode executar
-- `agenda_campo_marcar`, que escreveria. O ensaio dela está no rodapé, depois do
-- DESFAZER, pronto para colar: ele cria um bloco de mentira, confere sete
-- comportamentos e termina com um erro DE PROPÓSITO, que é o que desfaz tudo o
-- que ele criou e o que faz o relatório aparecer no editor. Rode-o assim que a
-- migration passar; ver "ENSAIO OK" no vermelho é o resultado bom.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- REPEATABLE READ E O PORTÃO DO md5 ANDAM JUNTOS, OU NENHUM DOS DOIS.
-- A afirmação central desta migration é NEGATIVA ("ninguém perdeu ou trocou
-- data_hora_agendada") e o §8 a promoveu de relatório a FREIO: se o md5 mudar,
-- a transação aborta. Sob READ COMMITTED isso seria um freio de alarme falso —
-- a foto do §0 e a conferência do §8 sairiam de SNAPSHOTS DIFERENTES, e bastaria
-- alguém reprogramar um chamado pela tela antiga (que continua no ar durante a
-- migration) para abortar uma migration que não fez nada errado. Com o snapshot
-- congelado, os dois md5 só podem diferir por escrita DESTA transação, que é
-- exatamente o que o portão existe para pegar.
-- Seguro aqui porque a U78 não faz UPDATE em nenhuma linha pré-existente: não há
-- como colher "could not serialize access". Se um dia houver, o portão sai junto
-- com esta linha, nunca sozinho.
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- `extensions` é onde o Supabase guarda as extensões; `public` é onde um
-- Postgres cru as põe. O opclass `gist` para uuid vem do btree_gist, e a
-- resolução dele acontece pelo search_path NO MOMENTO DO DDL — com os dois na
-- lista a constraint do §2 nasce dos dois jeitos, e some a divergência entre
-- "CREATE EXTENSION WITH SCHEMA extensions" e a forma nua. LOCAL: morre no
-- COMMIT e não vaza para a próxima requisição do pool do SQL Editor.
SET LOCAL search_path = public, extensions;

-- ═══════════════════════════════════════════════════════════════════════
-- §0) FOTO DE ANTES — as afirmações mais importantes daqui são NEGATIVAS
-- ═══════════════════════════════════════════════════════════════════════
-- Três promessas que só valem como número:
--   · nada em `chamado_apoios` é criado, apagado ou alterado;
--   · nenhum sino é disparado;
--   · NINGUÉM PERDE `data_hora_agendada` — e aqui não basta contar, porque
--     contagem igual esconderia valores trocados entre si. O md5 do dump
--     ordenado de (id, data_hora_agendada) prova a identidade byte a byte.
-- ON COMMIT DROP porque temp table sem isso sobrevive ao COMMIT e fica pendurada
-- na sessão do pool do SQL Editor (o padrão da casa está na U65 e na U76).
CREATE TEMP TABLE _u78_antes ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.chamado_apoios)                          AS apoios_total,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'dupla')   AS apoios_dupla,
       (SELECT count(*) FROM public.chamado_apoios WHERE origem = 'manual')  AS apoios_manual,
       (SELECT count(*) FROM public.notificacoes WHERE tipo = 'chamado_apoio') AS sinos_apoio,
       (SELECT count(*) FROM public.chamados
         WHERE natureza = 'campo' AND data_hora_agendada IS NOT NULL)        AS campo_com_data,
       (SELECT md5(COALESCE(string_agg(c.id::text || '|' || COALESCE(c.data_hora_agendada::text, '-'),
                                       E'\n' ORDER BY c.id), ''))
          FROM public.chamados c)                                            AS digest_agenda,
       -- A REEXECUÇÃO TEM DE SER VISÍVEL. O §1.3 sabe reconhecê-la (a marca da
       -- U78 já está no corpo vivo), e antes ele a anunciava por RAISE NOTICE —
       -- que este mesmo arquivo declara INVISÍVEL no editor do Supabase 900
       -- linhas abaixo. Guardado aqui, sai como linha da conferência: o Davi
       -- rodou de novo por precaução e precisa saber se o §7 reescreveu ou não.
       (SELECT COALESCE(bool_or(position('U78: DESAGENDAR NÃO É REATRIBUIR' in p.prosrc) > 0), false)
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'chamado_apoio_da_dupla')  AS reexecucao,
       now()                                                                 AS tirada_em;

-- ═══════════════════════════════════════════════════════════════════════
-- §1) PRÉ-VOO — nada foi escrito ainda, e é aqui que se aborta
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1.1 btree_gist ─────────────────────────────────────────────────────────
-- É o PRIMEIRO `CREATE EXTENSION` deste repositório, e ele é o que permite
-- `dupla_id WITH =` dentro de um EXCLUDE. Sem ele, "a equipe de campo não está
-- em dois lugares ao mesmo tempo" volta a ser um gatilho plpgsql — que tem
-- early-return, tem search_path, corre com duas escritas simultâneas e some com
-- `ALTER TABLE ... DISABLE TRIGGER` numa carga. A doutrina da U76 é explícita: a
-- regra vira ESTRUTURA. Se a extensão não puder nascer, é melhor abortar aqui do
-- que entregar a regra como promessa. O rodapé explica, em prosa, por que a
-- alternativa por gatilho é PIOR — o código dela foi removido de propósito, para
-- ninguém colar plano B às 23h no meio de um aborto. Trocar estrutura por
-- promessa é decisão do Davi, não silêncio do arquivo.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
      EXECUTE 'CREATE EXTENSION btree_gist WITH SCHEMA extensions';
    ELSE
      EXECUTE 'CREATE EXTENSION btree_gist';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  -- Contra `pg_extension`, e não contra o nome de uma função interna: a função
  -- de compressão do btree_gist para uuid chama-se `gbt_uuid_compress`
  -- (`gbt_<tipo>_<operação>`), e checar por `gist_uuid_compress` — que não
  -- existe — faria este pré-voo abortar SEMPRE, com o banco correto, dizendo
  -- que a extensão falta. Um pré-voo que acusa a si mesmo é a pior falha
  -- possível: manda o Davi caçar um problema que não existe.
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\nA extensão btree_gist não pôde ser criada nesta instância. Sem ela a regra "a equipe de campo não está em dois lugares ao mesmo tempo" não pode ser declarativa.\nO QUE FAZER: abra um chamado no suporte do Supabase pedindo btree_gist (é extensão de contrib, padrão em todo projeto) e rode esta migration de novo depois. NÃO troque o EXCLUDE por um gatilho sem falar com o Davi: o rodapé deste arquivo explica por que o gatilho é pior, e a decisão é dele.';
  END IF;
END $$;

-- ── 1.2 as peças da casa em que esta migration se apoia ────────────────────
DO $$
DECLARE v_falta text := '';
BEGIN
  IF to_regprocedure('public.is_gestor(uuid)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.is_gestor(uuid) (U6a)'; END IF;
  IF to_regprocedure('public.pode_editar_chamado(uuid)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.pode_editar_chamado(uuid) (S1)'; END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    v_falta := v_falta || E'\n  · public.set_updated_at()'; END IF;
  IF to_regprocedure('public.referencia_semanal(date)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.referencia_semanal(date) (U76)'; END IF;
  IF to_regprocedure('public.dia_da_dupla(timestamptz, timestamptz)') IS NULL THEN
    v_falta := v_falta || E'\n  · public.dia_da_dupla(timestamptz, timestamptz) (U76)'; END IF;
  IF to_regclass('public.duplas') IS NULL THEN
    v_falta := v_falta || E'\n  · public.duplas (U47)'; END IF;

  IF v_falta <> '' THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\nFaltam peças que esta migration usa:%\nRode a U76 (e as anteriores) antes desta.', v_falta;
  END IF;
END $$;

-- ── 1.3 AS FUNÇÕES QUE EU ESTOU PRESTES A REESCREVER SÃO AS QUE EU PENSO? ──
-- O §7 faz `CREATE OR REPLACE` no corpo de DUAS funções da U76, que tem UM DIA
-- de idade: `chamado_apoio_da_dupla()` (o gatilho) e `reconciliar_apoios_abertos()`
-- (a ferramenta manual). Reescrever por cima de uma versão que eu não conheço
-- apagaria em silêncio o trabalho de outra migration. Então o pré-voo exige as
-- marcas da U76 no corpo vivo — ou as marcas da própria U78, que é o caso da
-- REEXECUÇÃO, e aí passar é o certo (o sinal dela sai na conferência, §9,
-- porque RAISE NOTICE é invisível no editor do Supabase).
DO $$
DECLARE v_src text; v_rec text;
BEGIN
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'chamado_apoio_da_dupla';
  SELECT p.prosrc INTO v_rec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reconciliar_apoios_abertos';

  IF v_src IS NULL THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\npublic.chamado_apoio_da_dupla() não existe. Rode a U64 e a U76 antes desta.';
  END IF;
  IF v_rec IS NULL THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\npublic.reconciliar_apoios_abertos() não existe. Rode a U76 antes desta.';
  END IF;

  IF position('U78: DESAGENDAR NÃO É REATRIBUIR' in v_src) = 0
     AND (position('v_mudou_semana' in v_src) = 0
          OR position('referencia_semanal' in v_src) = 0) THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\npublic.chamado_apoio_da_dupla() NÃO é a versão da U76 (falta v_mudou_semana / referencia_semanal no corpo), e a U78 ia reescrevê-la por cima.\nO QUE FAZER: rode "SELECT prosrc FROM pg_proc WHERE proname = ''chamado_apoio_da_dupla''", descubra quem a trocou, e só então decida. NÃO force esta migration.';
  END IF;

  IF position('U78: DESAGENDAR NÃO É REATRIBUIR' in v_rec) = 0
     AND (position('chamado_sincronizar_apoio' in v_rec) = 0
          OR position('_desde_semana' in v_rec) = 0) THEN
    RAISE EXCEPTION E'ABORTADO NO PRÉ-VOO — nada foi alterado (ROLLBACK).\npublic.reconciliar_apoios_abertos() NÃO é a versão da U76 (falta chamado_sincronizar_apoio / _desde_semana no corpo), e a U78 ia reescrevê-la por cima.\nO QUE FAZER: rode "SELECT prosrc FROM pg_proc WHERE proname = ''reconciliar_apoios_abertos''", descubra quem a trocou, e só então decida. NÃO force esta migration.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- §2) A TABELA — o satélite MAGRO
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── 2.1 POR QUE `dia date` + `inicio_min smallint`, E NÃO UM timestamptz ───
-- A U76 já pagou por esta armadilha em letras (§3, dia_da_dupla): a sessão no
-- Supabase é UTC, e "domingo 22h em Brasília é 01h de SEGUNDA em UTC — cairia na
-- SEMANA SEGUINTE". Com timestamptz, TODA consulta da grade ("que blocos a
-- equipe tem na terça") teria de lembrar do AT TIME ZONE, e a que esquecesse
-- erraria só no bloco noturno — o pior tipo de defeito, porque é raro e
-- silencioso. Com (dia, inicio_min) o dia local é um FATO GRAVADO, não uma
-- conversão: o índice da grade é trivial, a soma da jornada é um GROUP BY, o
-- intervalo do EXCLUDE é aritmética de inteiros, e o gêmeo puro em TypeScript
-- compara inteiros e uma string 'AAAA-MM-DD' — nada de Date, nada de fuso. É o
-- que torna a asserção sem banco uma prova sobre o banco.
--
-- Existe UMA conversão de fuso no caminho inteiro, e ela está no corpo do
-- espelho (§5). O preço é que um bloco não atravessa a meia-noite — e é SÓ a
-- meia-noite: NADA neste arquivo (nem no modelo puro) recusa um bloco que
-- termine às 22h, então "a jornada de campo acaba às 17h" é hábito e teto de 8h,
-- não regra checada. Para trabalho de campo o corte na meia-noite basta como
-- garantia, e é por isso que PLANTÃO
-- — que atravessa por definição, é por PESSOA e não por equipe, e pode se
-- sobrepor — NÃO mora aqui: ele é outra tabela na Fase 3, e o que ele reusa é o
-- núcleo aritmético do modelo puro, não a linha do banco.
--
-- `inicio_min` é o início do SERVIÇO, não da saída. É a hora que o cliente
-- ouviu, é a que o espelho manda para `data_hora_agendada`, e é a que
-- DetalheCampo, o PDF e o PainelChamado já esperam encontrar lá — os três hoje
-- recebem 12:00 sintético e passam a receber hora de verdade sem uma linha de
-- mudança. O tempo de dirigir vem ANTES dela: o bloco OCUPA a equipe de
-- (inicio_min - deslocamento_min) até (inicio_min + servico_min).
CREATE TABLE IF NOT EXISTS public.agenda_campo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ou o bloco serve um chamado, ou ele é serviço que veio de fora do sistema.
  -- CASCADE porque bloco de chamado apagado não é registro, é lixo.
  chamado_id uuid REFERENCES public.chamados(id) ON DELETE CASCADE,
  -- O número que NÃO CASA COM NADA. SEM índice único, e a ausência é a
  -- definição: `chamados.numero_externo` é único por cliente porque pressupõe
  -- que o registro exista; este, por enunciado, não pressupõe nada — dois blocos
  -- podem citar a mesma OS de terceiro sem que isso queira dizer coisa alguma.
  os_externa text,
  titulo_externo text,

  -- A EQUIPE DE CAMPO É COLUNA AQUI, e a U76 continua de pé: `chamados.dupla_id`
  -- continua não existindo. O que existe aqui é a equipe DESTE BLOCO — quem se
  -- comprometeu com esta janela. Sem a coluna o EXCLUDE abaixo é inexprimível, e
  -- sem o EXCLUDE a regra volta a ser promessa. Ver §2.2 para o preço.
  dupla_id uuid NOT NULL REFERENCES public.duplas(id) ON DELETE RESTRICT,

  dia date NOT NULL,
  inicio_min smallint NOT NULL,
  servico_min smallint NOT NULL,
  -- DIGITADO À MÃO nesta fase. NOT NULL DEFAULT 0 e não NULL de propósito:
  -- "ninguém digitou" e "não tem deslocamento" precisam ser o MESMO zero, senão
  -- a soma da jornada teria de decidir o que fazer com o desconhecido — e ela
  -- decidiria errado, na direção perigosa (parece que cabe mais). A coluna já
  -- está no lugar para o cálculo de rota da Fase 2 preencher, e guardar o
  -- digitado é o que deixa a Fase 2 comparar previsto × calculado em vez de
  -- apagar o histórico.
  deslocamento_min smallint NOT NULL DEFAULT 0,

  -- "ATIVO" e "PENDENTE" são estados DIFERENTES, e o espelho precisa dos dois.
  -- Cancelar libera a agenda; cumprir NÃO — o dia mais produtivo da semana não
  -- pode aparecer como o mais vazio, que é o defeito que a tela de hoje tem ao
  -- tirar concluído da lista inteira.
  cumprido_em timestamptz,
  cancelado_em timestamptz,
  cancelado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Um bloco tem de dizer O QUÊ. Com chamado, o chamado diz; sem chamado, alguém
  -- escreve. Sem esta linha nasce o bloco anônimo, que ocupa a equipe e não
  -- explica por quê — e ele apareceria na grade como um retângulo mudo.
  CONSTRAINT agenda_campo_identificavel
    CHECK (chamado_id IS NOT NULL OR nullif(btrim(titulo_externo), '') IS NOT NULL),

  -- Duas colunas para o mesmo número é a segunda verdade nascendo: chamado que
  -- tem número externo já tem `chamados.numero_externo`.
  CONSTRAINT agenda_campo_externo_so_sem_chamado
    CHECK (chamado_id IS NULL OR (os_externa IS NULL AND titulo_externo IS NULL)),

  -- FÍSICA, não política: o dia tem 1440 minutos e a estrada acontece ANTES do
  -- serviço. A JORNADA (9h com a primeira hora reservada, 8h de campo, saída às
  -- 09h) é POLÍTICA e NÃO está aqui, de propósito — ela mora na porta de escrita
  -- (§6) e no modelo puro, porque o emergencial a viola por definição e porque
  -- política que vira CHECK faz o gestor mentir na duração para caber.
  --
  -- OS `::int` NÃO SÃO ENFEITE. `inicio_min` e `servico_min` são smallint, e no
  -- Postgres `int2 + int2` devolve `int2`: com servico_min ≈ 32 700 a SOMA
  -- estoura ANTES de o CHECK reprovar, e o que chega ao formulário é
  -- "smallint out of range" em vez da frase. A janela é estreita, mas ela é
  -- alcançável justamente pelas duas isenções da jornada do §6.1 (emergencial e
  -- bloco sem chamado), que pulam a checagem que pegaria antes. Castear ANTES de
  -- somar mantém a aritmética em int4 e a mensagem em português.
  CONSTRAINT agenda_campo_tempo
    CHECK (inicio_min BETWEEN 0 AND 1439
           AND servico_min > 0
           AND deslocamento_min >= 0
           AND inicio_min::int - deslocamento_min::int >= 0
           AND inicio_min::int + servico_min::int <= 1440)
);

-- IDEMPOTÊNCIA, DITA COM HONESTIDADE: `CREATE TABLE IF NOT EXISTS` numa segunda
-- execução não roda NADA do bloco acima — nem os CHECK. Hoje isso não custa
-- nada, porque a tabela nasce aqui e a primeira execução é a que vale. Mas se
-- algum dia um destes três CHECK mudar, a mudança NÃO pode vir editando o corpo
-- do CREATE TABLE: tem de vir como `ALTER TABLE ... DROP CONSTRAINT IF EXISTS`
-- + `ADD CONSTRAINT` numa migration nova, que é o idioma que o EXCLUDE logo
-- abaixo já usa exatamente por isso.

-- ── 2.2 A REGRA QUE VIRA ESTRUTURA ─────────────────────────────────────────
-- Mesmo movimento da U76, que transformou "uma pessoa numa equipe só por semana"
-- em CHAVE PRIMÁRIA em vez de gatilho: aqui "a equipe de campo não está em dois
-- lugares ao mesmo tempo" vira EXCLUDE. Não é um IF que alguém desliga numa
-- carga; é o banco recusando, para a RPC, para o SQL escrito à mão no editor e
-- para qualquer caminho que ainda não existe.
--
-- `int4range(a, b)` é [a, b) — MEIA-ABERTO por construção: um bloco que termina
-- às 11:00 e outro que começa às 11:00 NÃO se sobrepõem. É a mesma comparação
-- que o gêmeo em TypeScript faz (`a.de < b.ate && b.de < a.ate`), e é isso que
-- faz a asserção sem banco valer para o banco.
--
-- Só `cancelado_em IS NULL` no WHERE. NÃO existe uma coluna "sobreposicao_ok"
-- que tire a linha do índice, e a ausência é DECISÃO: um booleano que qualquer
-- escritor liga devolve a regra ao estado de promessa, que é exatamente o que o
-- btree_gist foi comprado para evitar. A equipe que se divide numa emergência
-- tem representação honesta e já construída — vira uma EQUIPE DE CAMPO PRÓPRIA
-- naquela semana, por `escala_definir`, que é a máquina que a U76 acabou de
-- entregar. GATILHO DE REVISÃO: se a operação provar que a divisão de equipe é
-- rotina e que abrir equipe por semana é caro demais, a saída não é afrouxar a
-- constraint — é `agenda_campo.dupla_id` deixar de ser a equipe e passar a ser a
-- PESSOA, e aí o EXCLUDE fica sobre quem de fato não se divide. Custo estimado
-- dessa reversão: a tabela, o espelho e o modelo puro (as três peças da U78).
ALTER TABLE public.agenda_campo DROP CONSTRAINT IF EXISTS agenda_campo_sem_sobreposicao;
ALTER TABLE public.agenda_campo ADD CONSTRAINT agenda_campo_sem_sobreposicao
  EXCLUDE USING gist (
    dupla_id WITH =,
    dia      WITH =,
    -- `inicio_min::int - deslocamento_min::int` e não `(inicio_min - deslocamento_min)::int`:
    -- o cast tem de acontecer ANTES da soma, senão a aritmética é int2 e estoura
    -- (mesmo motivo do CHECK acima). Aqui o efeito seria pior: a expressão é do
    -- ÍNDICE, e um erro de aritmética durante a reconstrução do EXCLUDE fala
    -- grego no meio de um ALTER TABLE.
    int4range(inicio_min::int - deslocamento_min::int, inicio_min::int + servico_min::int) WITH &&
  ) WHERE (cancelado_em IS NULL);

-- ── 2.3 ÍNDICES ────────────────────────────────────────────────────────────
-- O primeiro existe PARA o espelho: ele é exatamente a consulta do §5 (chamado,
-- não cancelado, ordenado por dia, hora, id, LIMIT 1), coberta ponta a ponta. O
-- espelho roda em toda gravação do satélite; um seq scan aqui seria pago por
-- cada clique da programação.
CREATE INDEX IF NOT EXISTS agenda_campo_espelho_idx
  ON public.agenda_campo (chamado_id, dia, inicio_min, id)
  WHERE chamado_id IS NOT NULL AND cancelado_em IS NULL;

-- A grade: uma semana × as equipes, numa varredura só.
CREATE INDEX IF NOT EXISTS agenda_campo_grade_idx
  ON public.agenda_campo (dia, dupla_id, inicio_min);

-- O TERCEIRO É PARA A CHAVE ESTRANGEIRA, não para consulta nenhuma da tela.
-- `chamado_id` é `ON DELETE CASCADE`, e o índice do espelho acima é PARCIAL
-- (`cancelado_em IS NULL`): apagar um chamado obriga o Postgres a achar TAMBÉM
-- os blocos cancelados dele, e sem um índice liso isso é varredura da tabela
-- inteira a cada DELETE de chamado. Custa nada parado.
CREATE INDEX IF NOT EXISTS agenda_campo_chamado_idx
  ON public.agenda_campo (chamado_id);

COMMENT ON TABLE public.agenda_campo IS
  'Os blocos de tempo da equipe de campo (U78/R99). SATÉLITE do chamado, não o '
  'chamado: um chamado tem N blocos (o RETORNO é o segundo, e "retorno" é '
  'DERIVADO da ordem, não um status novo), e um bloco pode não ter chamado '
  'nenhum — a OS que veio de fora do sistema, que não cabe em public.chamados '
  'porque cliente_id é NOT NULL. A hora é (dia, inicio_min) em HORÁRIO LOCAL de '
  'Brasília, NUNCA timestamptz. chamados.data_hora_agendada é ESPELHO DERIVADO '
  'desta tabela (R101): NÃO ESCREVA NAQUELA COLUNA para chamado de campo.';
COMMENT ON COLUMN public.agenda_campo.dupla_id IS
  'A equipe de campo DESTE BLOCO — quem se comprometeu com esta janela. NÃO é '
  '"a equipe do chamado": aquela continua DERIVADA do responsável pela escala da '
  'semana (U47/U76), e chamados.dupla_id continua não existindo. As duas podem '
  'DIVERGIR quando a escala muda depois do bloco marcado; nada reconcilia '
  'sozinho, de propósito (escrita de cadastro não reescreve registro), e quem '
  'MOSTRA a divergência é a grade (divergenciaDeEquipe no modelo puro, contada '
  'no cabeçalho da semana) — não uma reconciliação automática.';
COMMENT ON COLUMN public.agenda_campo.inicio_min IS
  'Minutos desde 00:00 LOCAL do início do SERVIÇO (540 = 09:00). O deslocamento '
  'vem ANTES: o bloco ocupa a equipe de (inicio_min - deslocamento_min) até '
  '(inicio_min + servico_min), que é o intervalo do EXCLUDE.';
COMMENT ON COLUMN public.agenda_campo.deslocamento_min IS
  'Tempo de estrada ATÉ o serviço, em minutos. DIGITADO à mão na Fase 1; a Fase '
  '2 preenche pelo cálculo de rota e a coluna já está no lugar. Conta DENTRO da '
  'jornada de 8h: técnico dirigindo é técnico ocupado.';
COMMENT ON COLUMN public.agenda_campo.cumprido_em IS
  'Quando este bloco aconteceu. É a única razão de a coluna existir: com N '
  'blocos por chamado, chamados.finalizada_em (que é um) não sabe QUAL bloco '
  'aconteceu — e sem isso o espelho fica pinado na primeira visita e o retorno '
  'da quinta some de atividadesDeHoje, que compara só ano/mês/dia.';
COMMENT ON COLUMN public.agenda_campo.cancelado_em IS
  'Desmarcado. Cancelar LIBERA a agenda (sai do EXCLUDE e da ocupação); cumprir '
  'não. Preferido ao DELETE porque "este atendimento foi desmarcado" é '
  'informação que a fila do dia seguinte precisa e que um DELETE joga fora.';

DROP TRIGGER IF EXISTS trg_agenda_campo_updated_at ON public.agenda_campo;
CREATE TRIGGER trg_agenda_campo_updated_at
  BEFORE UPDATE ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- §3) A VALIDAÇÃO QUE UM CHECK NÃO SABE FAZER — natureza e encerrado
-- ═══════════════════════════════════════════════════════════════════════
-- Um CHECK não enxerga outra tabela, então esta é a única forma. Duas regras, e
-- as duas são sobre QUEM MANDA na coluna espelhada:
--   · natureza <> 'campo' é RECUSADO. `trg_sincronizar_chamado_da_visita` (U41)
--     reescreve chamados.data_hora_agendada a cada UPDATE de NOVE colunas da
--     visita, TÍTULO INCLUSIVE. Se existisse bloco para chamado comercial,
--     editar o título de uma visita apagaria o horário do bloco em silêncio.
--     Aqui a divisão é declarada: comercial é do gatilho da visita, campo é do
--     espelho.
--   · chamado ENCERRADO só recebe bloco de gestor. Isto REPÕE a garantia que a
--     S1 removeu de `chamados_update` (ver o cabeçalho): sem ela, quem escreve
--     no satélite altera a data de um chamado concluído, e mexer no espelho de
--     um chamado encerrado MOVE O MÊS em que ele é contado no painel
--     (atividades/modelo.ts usa updated_at como encerradoEm quando faltam
--     concluida_em e fechada_em). O §5 fecha o mesmo buraco pelo outro lado.
-- auth.uid() é NULL quando isto roda pela migration ou pelo SQL Editor (sem
-- JWT) — aí o gate de papel não faz sentido e passa.
CREATE OR REPLACE FUNCTION public.agenda_campo_valida()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c record;
BEGIN
  IF NEW.chamado_id IS NULL THEN
    -- Serviço fora do sistema ocupa a equipe e não presta contas a chamado
    -- nenhum: é ato de gestão, e o único registro dele é este bloco.
    IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
      RAISE EXCEPTION 'Só quem responde pela operação marca serviço fora do sistema.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT ch.natureza, ch.status INTO c
    FROM public.chamados ch WHERE ch.id = NEW.chamado_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não existe.', NEW.chamado_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF c.natureza IS DISTINCT FROM 'campo' THEN
    RAISE EXCEPTION 'A agenda de campo só recebe chamado de natureza campo (este é "%"). A agenda comercial continua sendo a da visita técnica.',
      COALESCE(c.natureza, 'sem natureza') USING ERRCODE = '55000';
  END IF;

  IF c.status IN ('concluido','cancelado')
     AND auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Este chamado está %. Só a gestão remarca trabalho encerrado.', c.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_campo_valida ON public.agenda_campo;
CREATE TRIGGER trg_agenda_campo_valida
  BEFORE INSERT OR UPDATE OF chamado_id, dia, inicio_min ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.agenda_campo_valida();

-- ═══════════════════════════════════════════════════════════════════════
-- §4) RLS E GRANTS — leitura aberta, escrita por PORTA ÚNICA
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.agenda_campo ENABLE ROW LEVEL SECURITY;

-- SEM GRANT DE INSERT/UPDATE/DELETE a authenticated, de propósito, e por três
-- motivos que se somam:
--   · criar bloco tem de acontecer JUNTO com a transição aberto->agendado, e um
--     INSERT cru deixaria o status para trás;
--   · a violação do EXCLUDE precisa virar uma FRASE que nomeia o conflitante. Um
--     INSERT cru devolveria "conflicting key value violates exclusion
--     constraint", que não nomeia nada — e novo-campo e o PainelChamado chegam à
--     tabela por fora do formulário da grade;
--   · a JORNADA é política e mora na porta, não no CHECK.
-- Uma porta só: agenda_campo_marcar() e as três irmãs do §6.
--
-- O REVOKE VEM PRIMEIRO, E ELE É O QUE TORNA "PORTA ÚNICA" ESTRUTURA EM VEZ DE
-- HERANÇA DE CONFIGURAÇÃO. "Não escrevi um GRANT" não é o mesmo que "não há
-- GRANT": todo projeto Supabase pode trazer, do bootstrap,
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated`, e
-- com isso a tabela nasceria escrevível e o argumento inteiro desta seção
-- passaria a depender só da RLS — uma peça, não duas. (Neste projeto o
-- bootstrap parece NÃO estar ativo: a U76 faz a mesma conferência sobre
-- duplas_escala e rodou verde em produção. "Parece" não é uma garantia; esta
-- linha é.) Idempotente e barato: revogar o que não existe é no-op.
REVOKE ALL   ON public.agenda_campo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agenda_campo TO authenticated;
GRANT ALL    ON public.agenda_campo TO service_role;

DROP POLICY IF EXISTS "agenda_campo_select" ON public.agenda_campo;
-- USING (true), como duplas_escala_select (U76), e aqui o motivo é ainda mais
-- duro: se o técnico não enxerga um bloco, o chip de ocupação da equipe dele
-- mostra 40% onde há 90%. "Quem conta é quem filtra" não sobrevive a uma policy
-- que esconde linhas do DENOMINADOR. O que a linha revela é "a Equipe A tem algo
-- das 9 às 11 na quinta" mais um uuid opaco de chamado — o conteúdo continua
-- atrás de `chamados_select`, e `titulo_externo` só existe em bloco sem chamado,
-- que é ato de gestão.
CREATE POLICY "agenda_campo_select" ON public.agenda_campo
  FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- §5) O ESPELHO
-- ═══════════════════════════════════════════════════════════════════════
-- UMA COLUNA. É a decisão que torna a cascata analisável: o UPDATE toca
-- `data_hora_agendada` e mais nada, então a lista `AFTER UPDATE OF` de cada um
-- dos SETE gatilhos de public.chamados decide, sozinha, quem acorda. A tabela
-- completa está no cabeçalho; o resumo é: acordam `set_updated_at` (BEFORE, sem
-- lista) e `trg_chamado_apoio_dupla_upd`, e mais ninguém.
--
-- Os dois estágios são o gêmeo literal de `espelhoDoChamado()` em
-- src/features/programacao/modelo.ts. Se um dia divergirem, o espelho apodrece
-- em silêncio — que é o pior fim possível para uma coluna lida em doze arquivos.
CREATE OR REPLACE FUNCTION public.agenda_campo_espelhar(_chamado uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_dia date; v_min int; v_novo timestamptz; v_mexeu int;
BEGIN
  IF _chamado IS NULL THEN RETURN false; END IF;

  -- ESTÁGIO 1 — o bloco PENDENTE mais antigo.
  SELECT a.dia, a.inicio_min INTO v_dia, v_min
    FROM public.agenda_campo a
   WHERE a.chamado_id = _chamado
     AND a.cancelado_em IS NULL
     AND a.cumprido_em IS NULL
   ORDER BY a.dia, a.inicio_min, a.id
   LIMIT 1;

  -- ESTÁGIO 2 — todos cumpridos: vale o ÚLTIMO. Zerar aqui faria o chamado
  -- ainda aberto perder a data no PDF e sair do calendário por ter sido
  -- atendido.
  IF v_dia IS NULL THEN
    SELECT a.dia, a.inicio_min INTO v_dia, v_min
      FROM public.agenda_campo a
     WHERE a.chamado_id = _chamado
       AND a.cancelado_em IS NULL
     ORDER BY a.dia DESC, a.inicio_min DESC, a.id DESC
     LIMIT 1;
  END IF;

  -- A ÚNICA conversão de fuso do caminho inteiro, e ela é explícita. `date +
  -- interval` dá timestamp SEM fuso; `AT TIME ZONE` o lê como hora de Brasília e
  -- devolve o instante. Sem isso, 22h de domingo viraria segunda em UTC e a
  -- semana ISO do apoio mudaria — a armadilha que a U76 documenta.
  v_novo := CASE WHEN v_dia IS NULL THEN NULL
                 ELSE (v_dia + make_interval(mins => v_min)) AT TIME ZONE 'America/Sao_Paulo'
            END;

  UPDATE public.chamados c
     SET data_hora_agendada = v_novo
   WHERE c.id = _chamado
     -- só campo: comercial é do trg_sincronizar_chamado_da_visita (U41)
     AND c.natureza = 'campo'
     -- registro é registro: mexer no espelho de um chamado encerrado moveria o
     -- mês em que ele é contado, via updated_at -> encerradoEm
     AND c.status NOT IN ('concluido','cancelado')
     -- OBRIGATÓRIO: sem isto, mexer na duração reescreveria a MESMA data, e
     -- `AFTER UPDATE OF` dispara pela presença da coluna no SET
     AND c.data_hora_agendada IS DISTINCT FROM v_novo;
  GET DIAGNOSTICS v_mexeu = ROW_COUNT;
  RETURN v_mexeu > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agenda_campo_espelhar(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_espelhar(uuid) TO service_role;

COMMENT ON FUNCTION public.agenda_campo_espelhar(uuid) IS
  'Recalcula chamados.data_hora_agendada a partir dos blocos: o PENDENTE mais '
  'antigo; se todos foram cumpridos, o último. Devolve true se mexeu. Só toca '
  'chamado de campo NÃO encerrado, e só quando o valor muda de fato — as três '
  'cláusulas do WHERE são as três defesas contra cascata à toa.';

CREATE OR REPLACE FUNCTION public.agenda_campo_espelho()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.agenda_campo_espelhar(OLD.chamado_id);
    RETURN OLD;
  END IF;
  -- Bloco que troca de chamado deixa os DOIS desatualizados. Chamar duas vezes é
  -- inócuo: o IS DISTINCT FROM faz a segunda ser no-op.
  IF TG_OP = 'UPDATE' AND NEW.chamado_id IS DISTINCT FROM OLD.chamado_id THEN
    PERFORM public.agenda_campo_espelhar(OLD.chamado_id);
  END IF;
  PERFORM public.agenda_campo_espelhar(NEW.chamado_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_campo_espelho_ins ON public.agenda_campo;
DROP TRIGGER IF EXISTS trg_agenda_campo_espelho_upd ON public.agenda_campo;
DROP TRIGGER IF EXISTS trg_agenda_campo_espelho_del ON public.agenda_campo;

CREATE TRIGGER trg_agenda_campo_espelho_ins
  AFTER INSERT ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.agenda_campo_espelho();
-- A LISTA `OF` É A PRIMEIRA DEFESA, antes mesmo do IS DISTINCT FROM: corrigir a
-- duração, o deslocamento ou a equipe do bloco não chega nem a CHAMAR a função
-- de espelho, e portanto não pode acordar trg_chamado_apoio_dupla_upd. Isto é
-- estrutura, não um IF que alguém apaga.
CREATE TRIGGER trg_agenda_campo_espelho_upd
  AFTER UPDATE OF dia, inicio_min, cumprido_em, cancelado_em, chamado_id
  ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.agenda_campo_espelho();
CREATE TRIGGER trg_agenda_campo_espelho_del
  AFTER DELETE ON public.agenda_campo
  FOR EACH ROW EXECUTE FUNCTION public.agenda_campo_espelho();

-- ═══════════════════════════════════════════════════════════════════════
-- §6) AS PORTAS DE ESCRITA
-- ═══════════════════════════════════════════════════════════════════════
-- TODAS levam REVOKE de PUBLIC e anon. Não é zelo: o modelo de ameaça da S1 diz
-- que TODO usuário fala direto com o Postgres usando a MESMA chave pública, que
-- está versionada no .env — EXECUTE é concedido a PUBLIC por padrão e `anon`
-- herda. Uma SECURITY DEFINER sem REVOKE é um /rest/v1/rpc/<nome> aberto.

-- ── 6.0 AS DUAS PEÇAS DE FRASE ─────────────────────────────────────────────
-- Existem porque a MESMA regra tem de falar a MESMA língua nos dois lados. O
-- formulário mostra o que `erroDoAgendamento()` (modelo puro) escreve; a RPC é
-- a última linha de defesa e escrevia outra coisa — "300 min" onde o modelo
-- escreve "5h", e a jornada antes do conflito onde o modelo põe o conflito
-- antes. Uma regra com duas redações é uma regra que o usuário aprende a não
-- ler.

-- `duracao_texto` é o gêmeo literal de `duracaoTexto()` em
-- src/features/programacao/modelo.ts: 90 -> '1h30', 45 -> '45min', 480 -> '8h',
-- 0 -> '0min'. NÃO é `horasTexto()` de indicadores.ts, que vira dias acima de 24
-- e não serve para uma jornada. NÃO é `to_char(make_interval(...), 'HH24:MI')`,
-- que escreveria '5h00' e '0h45'. A conferência do §9 compara os quatro valores.
CREATE OR REPLACE FUNCTION public.duracao_texto(_min int)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
           WHEN _min IS NULL   THEN '—'
           WHEN _min < 60      THEN _min::text || 'min'
           WHEN _min % 60 = 0  THEN (_min / 60)::text || 'h'
           ELSE (_min / 60)::text || 'h' || lpad((_min % 60)::text, 2, '0')
         END;
$$;
REVOKE EXECUTE ON FUNCTION public.duracao_texto(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.duracao_texto(int) TO authenticated, service_role;

COMMENT ON FUNCTION public.duracao_texto(int) IS
  'Minutos em português de jornada (90 -> 1h30, 45 -> 45min, 480 -> 8h). Gêmeo '
  'de duracaoTexto() em src/features/programacao/modelo.ts, para a frase da RPC '
  'e a frase do formulário serem a MESMA frase.';

-- A FRASE DO CONFLITO, EM UM LUGAR SÓ — e ela é peça de SEGURANÇA, não de
-- cosmética. Dois motivos para existir como função e não como dois trechos
-- iguais dentro de agenda_campo_marcar:
--   · ela é chamada DUAS vezes (o ensaio, antes de gravar, e a rede de corrida
--     no handler do EXCLUDE). Duas cópias de uma consulta que decide o que
--     REVELAR divergem, é só questão de quando;
--   · O RÓTULO É PRIVILÉGIO; O HORÁRIO NÃO. A função roda SECURITY DEFINER e
--     passa por cima de `chamados_select` (u29:182-196), que para campo é
--     gestor ∨ responsável ∨ quem abriu ∨ sem dono ∨ apoio. Sem o gate abaixo, a
--     mensagem de erro vira um ORÁCULO DE ENUMERAÇÃO: com `agenda_campo_select`
--     USING (true) qualquer técnico lê (chamado_id, dupla_id, dia, inicio_min)
--     de tudo, marca um chamado PRÓPRIO corretiva+urgente (que pula a jornada e
--     chega direto ao EXCLUDE) em cima de cada bloco, e colhe
--     "CH-042 · Instalação de CFTV — Condomínio Vila Nova" — número, título e,
--     no título, quase sempre o cliente. Uma requisição por chamado.
--     Quem não pode saber O QUE está no caminho recebe "outro atendimento" e o
--     horário: dá para remarcar sem descobrir o parque de chamados alheio.
-- `pode_editar_chamado` é o predicado certo aqui (e não `chamados_select`):
-- quem pode REMARCAR é quem pode saber o que está no caminho.
CREATE OR REPLACE FUNCTION public.agenda_campo_frase_do_conflito(
  _id uuid, _dupla uuid, _dia date, _de int, _ate int)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v record;
BEGIN
  SELECT a.inicio_min::int AS inicio, a.deslocamento_min::int AS desloc,
         a.servico_min::int AS servico, a.chamado_id, a.titulo_externo,
         c.numero, c.titulo
    INTO v
    FROM public.agenda_campo a
    LEFT JOIN public.chamados c ON c.id = a.chamado_id
   WHERE a.dupla_id = _dupla AND a.dia = _dia
     AND a.cancelado_em IS NULL
     AND (_id IS NULL OR a.id <> _id)
     AND int4range(a.inicio_min::int - a.deslocamento_min::int,
                   a.inicio_min::int + a.servico_min::int) && int4range(_de, _ate)
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Os COALESCE dos horários não são zelo: `SELECT INTO` sem linha deixa o
  -- record inteiro NULL, `to_char(make_interval(mins => NULL), ...)` devolve
  -- NULL, e a frase sairia "das <vazio> às <vazio>". A frase existe justamente
  -- para o caso em que alguma coisa falhou de um jeito que ninguém previu.
  RETURN format('Esta equipe já está em "%s" das %s às %s nesse dia.',
    COALESCE(
      CASE WHEN v.chamado_id IS NULL THEN v.titulo_externo
           WHEN auth.uid() IS NULL OR public.pode_editar_chamado(v.chamado_id)
             THEN v.numero || ' · ' || v.titulo
      END, 'outro atendimento'),
    COALESCE(to_char(make_interval(mins => v.inicio - v.desloc), 'HH24:MI'), '—'),
    COALESCE(to_char(make_interval(mins => v.inicio + v.servico), 'HH24:MI'), '—'));
END;
$$;
-- NÃO é concedida a authenticated: as portas do §6 são SECURITY DEFINER e a
-- chamam já rodando como dono. Abrir /rest/v1/rpc/agenda_campo_frase_do_conflito
-- seria dar de graça um probe de agenda com resposta em texto.
REVOKE EXECUTE ON FUNCTION public.agenda_campo_frase_do_conflito(uuid,uuid,date,int,int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_frase_do_conflito(uuid,uuid,date,int,int) TO service_role;

COMMENT ON FUNCTION public.agenda_campo_frase_do_conflito(uuid,uuid,date,int,int) IS
  'A frase "Esta equipe já está em X das H às H nesse dia", ou NULL quando não '
  'há conflito. Um lugar só, porque ela é chamada no ensaio (antes de gravar) e '
  'na rede de corrida (handler do EXCLUDE). O RÓTULO respeita '
  'pode_editar_chamado — sem isso a mensagem de erro seria um oráculo de '
  'enumeração do parque de chamados; o HORÁRIO sai sempre, porque quem vai '
  'remarcar precisa dele.';

-- ── 6.1 MARCAR (criar ou mover) ────────────────────────────────────────────
-- A JORNADA MORA AQUI (R100), e não num CHECK, porque ela é POLÍTICA:
--   · 9h de jornada com a PRIMEIRA HORA RESERVADA (carregar o carro, pegar peça,
--     ver a ordem do dia) = 8h de campo. A base da ocupação é 480 e não 540;
--     somar a reserva faria toda equipe parecer 11% mais ociosa, para sempre.
--   · a equipe SAI às 09:00, então a primeira atividade não começa antes de
--     09:00 + deslocamento.
-- E ela tem DUAS isenções, as duas FATOS JÁ GRAVADOS NA LINHA — nunca um
-- booleano que alguém marca:
--   · corretiva + prioridade urgente. "Emergencial não é tipo novo, é corretiva
--     com prioridade urgente" (Davi, 2026-08-31). O urgente é o único que
--     estoura a jornada porque é para isso que ele existe, e é isso que faz a
--     decisão do Davi ser carregada em vez de decorativa;
--   · bloco SEM chamado. Serviço fora do sistema só gestor marca, e ele é, por
--     definição, a categoria "isto não estava no plano". Dar um segundo botão de
--     "forçar" seria criar a válvula que o §2.2 recusou.
-- São DUAS, e a R100 ainda diz "a única exceção" — o texto numerado precisa
-- ganhar a segunda por escrito, ou o SQL perdê-la. Fica aqui anotado para não
-- virar folclore: quem manda é a R100, e hoje ela e este corpo discordam.
--
-- ── A ORDEM DAS CHECAGENS É A DO FORMULÁRIO, e isso não é estilo ───────────
--   1. quem manda no BLOCO QUE JÁ ESTÁ AÍ  (autorização do dono atual)
--   2. quem manda no CHAMADO DE DESTINO    (autorização do destino)
--   3. forma e física                      (duração, meia-noite, deslocamento)
--   4. CONFLITO                            (específico: "já está em CH-001")
--   5. JORNADA                             (agregada: "já tem 5h nesse dia")
-- É a mesma ordem de `erroDoAgendamento()` no modelo puro. Antes a RPC checava a
-- jornada ANTES do conflito, então um bloco que violasse as duas recebia do
-- formulário a frase específica e do servidor a agregada: a mesma regra falando
-- duas línguas, e a de baixo é a última linha de defesa.
--
-- ── NULL NUM PARÂMETRO É "NÃO MEXI", NUNCA "APAGUE" ───────────────────────
-- Esta função era um REPLACE com metade dos parâmetros em DEFAULT NULL, e isso
-- destruía dado por omissão: arrastar o cartão "OS-9911 · Portão do condomínio
-- vizinho" de terça para quarta manda o gesto (_id, _dupla, _dia, _inicio_min,
-- _servico_min) e não manda os_externa/titulo_externo — que eram zerados,
-- apagando o ÚNICO registro daquele serviço (ele não cabe em public.chamados
-- porque cliente_id é NOT NULL). Quando vinha _chamado junto, o CHECK
-- `agenda_campo_identificavel` nem reclamava; quando não vinha, subia o
-- `check_violation` cru para dentro do formulário.
-- Agora todo parâmetro nulo COALESCE contra a linha viva. Consequência
-- declarada, para ninguém a descobrir sozinho: esta porta NÃO desliga um bloco
-- do chamado dele — `_chamado => NULL` significa "mantenha o chamado que já
-- está lá". Tirar da agenda é o ato nomeado do §6.4; virar serviço de fora é
-- cancelar e criar outro.
CREATE OR REPLACE FUNCTION public.agenda_campo_marcar(
  _id uuid,
  _chamado uuid,
  _dupla uuid,
  _dia date,
  _inicio_min int,
  _servico_min int,
  _deslocamento_min int DEFAULT 0,
  _os_externa text DEFAULT NULL,
  _titulo_externo text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  -- a linha que JÁ ESTÁ LÁ (só é lida quando _id não é nulo)
  v_a_chamado uuid; v_a_dupla uuid; v_a_dia date;
  v_a_inicio  int;  v_a_servico int; v_a_desloc int;
  v_a_os      text; v_a_titulo  text;
  -- os valores EFETIVOS, depois do COALESCE: é sobre ELES que tudo é checado e
  -- gravado. Checar o parâmetro e gravar o efetivo seria checar uma coisa e
  -- escrever outra.
  v_chamado uuid; v_dupla uuid; v_dia date;
  v_inicio  int;  v_servico int; v_desloc int;
  v_os      text; v_titulo  text;
  v_urgente boolean;
  v_ja      int;
  v_frase   text;
BEGIN
  -- ══ 1) U78: QUEM MANDA NESTE BLOCO HOJE ══════════════════════════════════
  -- O gate do passo 2 autoriza o chamado de DESTINO — o que o chamador está
  -- PONDO no bloco. Sem ESTE, mover um bloco alheio para um chamado próprio é
  -- reescrita não autorizada: `agenda_campo_select` é USING (true), então
  -- qualquer autenticado tem o id de qualquer bloco; `agenda_campo_marcar` é
  -- concedida a authenticated; e SECURITY DEFINER passa por cima da RLS. Quem
  -- abre um chamado bobo (basta `aberto_por` para `pode_editar_chamado`)
  -- arrastaria para ele o bloco de um chamado que não pode nem ler — e o
  -- espelho do §5, vendo `NEW.chamado_id IS DISTINCT FROM OLD.chamado_id`,
  -- escreveria NULL em `data_hora_agendada` do chamado roubado, que sumiria do
  -- calendário, do card da Início e do PDF sem sino nenhum.
  -- FOR UPDATE porque o gate LÊ a linha que ele está prestes a REESCREVER: sem
  -- a trava, outra transação move a linha entre a leitura e a escrita e o gate
  -- terá autorizado um estado que já não existe.
  IF _id IS NOT NULL THEN
    SELECT a.chamado_id, a.dupla_id, a.dia, a.inicio_min::int, a.servico_min::int,
           a.deslocamento_min::int, a.os_externa, a.titulo_externo
      INTO v_a_chamado, v_a_dupla, v_a_dia, v_a_inicio, v_a_servico,
           v_a_desloc, v_a_os, v_a_titulo
      FROM public.agenda_campo a
     WHERE a.id = _id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Este bloco não existe mais — recarregue a grade e refaça o gesto.'
        USING ERRCODE = '55000';
    END IF;

    IF auth.uid() IS NOT NULL THEN
      IF v_a_chamado IS NOT NULL THEN
        IF NOT public.pode_editar_chamado(v_a_chamado) THEN
          RAISE EXCEPTION 'Este horário é de um atendimento pelo qual você não responde. Peça a quem responde por ele, ou à gestão.'
            USING ERRCODE = '42501';
        END IF;
      ELSIF NOT public.is_gestor(auth.uid()) THEN
        -- mesma régua do §3 e do §6.2: serviço fora do sistema é ato de gestão,
        -- e este bloco é o único registro que ele tem.
        RAISE EXCEPTION 'Só quem responde pela operação mexe em serviço fora do sistema.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- ══ 2) OS VALORES EFETIVOS, e o gate do DESTINO ══════════════════════════
  v_chamado := COALESCE(_chamado, v_a_chamado);
  v_dupla   := COALESCE(_dupla,   v_a_dupla);
  v_dia     := COALESCE(_dia,     v_a_dia);
  v_inicio  := COALESCE(_inicio_min,  v_a_inicio);
  v_servico := COALESCE(_servico_min, v_a_servico);
  v_desloc  := COALESCE(_deslocamento_min, v_a_desloc, 0);
  -- Com chamado, quem diz o que é o trabalho é o chamado, e as duas colunas de
  -- fora TÊM de ficar nulas (CONSTRAINT agenda_campo_externo_so_sem_chamado —
  -- duas colunas para o mesmo número é a segunda verdade nascendo). Sem
  -- chamado, o que não veio no gesto continua valendo.
  v_os     := CASE WHEN v_chamado IS NOT NULL THEN NULL
                   ELSE COALESCE(nullif(btrim(_os_externa), ''), v_a_os) END;
  v_titulo := CASE WHEN v_chamado IS NOT NULL THEN NULL
                   ELSE COALESCE(nullif(btrim(_titulo_externo), ''), v_a_titulo) END;

  IF v_chamado IS NOT NULL AND auth.uid() IS NOT NULL
     AND NOT public.pode_editar_chamado(v_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.'
      USING ERRCODE = '42501';
  END IF;

  -- ══ 3) FORMA E FÍSICA, antes de qualquer política ════════════════════════
  -- Estas recusas existem para o erro CRU não chegar ao formulário. Sem elas o
  -- NOT NULL devolve "null value in column", o CHECK devolve "violates check
  -- constraint agenda_campo_tempo" e o tipo smallint devolve "smallint out of
  -- range" — três frases que não dizem ao gestor o que fazer. As mensagens são
  -- as mesmas de `erroDoAgendamento()` no modelo puro, palavra por palavra.
  IF v_dupla IS NULL OR v_dia IS NULL OR v_inicio IS NULL THEN
    RAISE EXCEPTION 'Diga a equipe, o dia e a hora do atendimento.' USING ERRCODE = '55000';
  END IF;
  IF v_servico IS NULL OR v_servico <= 0 THEN
    RAISE EXCEPTION 'Diga quanto tempo o atendimento deve durar.' USING ERRCODE = '55000';
  END IF;
  IF v_desloc < 0 THEN
    RAISE EXCEPTION 'O tempo de deslocamento não pode ser negativo.' USING ERRCODE = '55000';
  END IF;
  IF v_inicio < 0 OR v_inicio > 1439 THEN
    RAISE EXCEPTION 'A hora do atendimento tem de estar dentro do dia.' USING ERRCODE = '55000';
  END IF;
  IF v_inicio - v_desloc < 0 THEN
    RAISE EXCEPTION 'Começando % com % de deslocamento, a equipe teria de sair no dia anterior.',
      to_char(make_interval(mins => v_inicio), 'HH24:MI'), public.duracao_texto(v_desloc)
      USING ERRCODE = '55000';
  END IF;
  IF v_inicio + v_servico > 1440 THEN
    RAISE EXCEPTION 'Começando % e durando %, o atendimento passaria da meia-noite.',
      to_char(make_interval(mins => v_inicio), 'HH24:MI'), public.duracao_texto(v_servico)
      USING ERRCODE = '55000';
  END IF;
  IF v_chamado IS NULL AND v_titulo IS NULL THEN
    RAISE EXCEPTION 'Um bloco sem chamado precisa de um título — diga o que é este serviço.'
      USING ERRCODE = '55000';
  END IF;

  -- ══ 4) AS DUAS ISENÇÕES DA JORNADA, as duas fatos já gravados ════════════
  v_urgente := (v_chamado IS NULL);
  IF v_chamado IS NOT NULL THEN
    SELECT (c.tipo = 'corretiva' AND c.prioridade = 'urgente') INTO v_urgente
      FROM public.chamados c WHERE c.id = v_chamado;
    v_urgente := COALESCE(v_urgente, false);
  END IF;

  -- ══ 5) O CONFLITO, ANTES da jornada ══════════════════════════════════════
  -- Este é o ENSAIO; a garantia é o EXCLUDE. Duas transações simultâneas podem
  -- passar as duas por aqui, e só uma sobrevive à constraint — por isso o
  -- handler `WHEN exclusion_violation` continua no fim, agora como REDE DE
  -- CORRIDA e não como caminho normal. Nem o urgente pula esta: sobreposição é
  -- física, e é a única regra desta função que o banco também garante sozinho.
  v_frase := public.agenda_campo_frase_do_conflito(
               _id, v_dupla, v_dia, v_inicio - v_desloc, v_inicio + v_servico);
  IF v_frase IS NOT NULL THEN
    RAISE EXCEPTION '%', v_frase USING ERRCODE = 'exclusion_violation';
  END IF;

  -- ══ 6) A JORNADA (R100) ══════════════════════════════════════════════════
  IF NOT v_urgente THEN
    IF v_inicio - v_desloc < 540 THEN
      RAISE EXCEPTION 'A equipe só sai às 09:00 — com % de deslocamento o atendimento não pode começar antes das %.',
        public.duracao_texto(v_desloc),
        to_char(make_interval(mins => 540 + v_desloc), 'HH24:MI')
        USING ERRCODE = '55000';
    END IF;

    -- A JORNADA NÃO É ATÔMICA, E A SOBREPOSIÇÃO É — e a diferença tem de ser
    -- dita, porque o §2.2 vende o oposto para a outra. Duas chamadas
    -- simultâneas para a mesma equipe no mesmo dia leem `v_ja` no mesmo
    -- instante e cada uma conclui que cabe: sobrepor não sobrepõem (o EXCLUDE
    -- segura), mas a soma do dia pode passar das 8h. É coerente com "jornada é
    -- POLÍTICA, sobreposição é ESTRUTURA": fechar isto exigiria travar o dia
    -- inteiro da equipe a cada marcação, serializando a grade para pegar um
    -- caso que só existe com dois gestores marcando no mesmo minuto.
    SELECT COALESCE(sum(a.servico_min::int + a.deslocamento_min::int), 0) INTO v_ja
      FROM public.agenda_campo a
     WHERE a.dupla_id = v_dupla AND a.dia = v_dia
       AND a.cancelado_em IS NULL
       AND (_id IS NULL OR a.id <> _id);
    IF v_ja + v_servico + v_desloc > 480 THEN
      RAISE EXCEPTION 'A equipe já tem % marcados nesse dia; com este atendimento (% + % de deslocamento) passaria das 8h de campo.',
        public.duracao_texto(v_ja), public.duracao_texto(v_servico), public.duracao_texto(v_desloc)
        USING ERRCODE = '55000';
    END IF;
  END IF;

  -- ══ 7) GRAVA ═════════════════════════════════════════════════════════════
  -- O bloco aninhado existe para o handler cobrir SÓ a escrita. Se ele
  -- envolvesse a função inteira, a recusa do passo 5 (que usa o mesmo ERRCODE
  -- de propósito, para o cliente ver sempre a mesma classe de erro) cairia no
  -- próprio handler e a consulta seria refeita à toa.
  BEGIN
    IF _id IS NULL THEN
      INSERT INTO public.agenda_campo (chamado_id, dupla_id, dia, inicio_min, servico_min,
                                       deslocamento_min, os_externa, titulo_externo, criado_por)
      VALUES (v_chamado, v_dupla, v_dia, v_inicio, v_servico, v_desloc, v_os, v_titulo, auth.uid())
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.agenda_campo a
         SET chamado_id = v_chamado, dupla_id = v_dupla, dia = v_dia,
             inicio_min = v_inicio, servico_min = v_servico, deslocamento_min = v_desloc,
             os_externa = v_os, titulo_externo = v_titulo,
             -- Remarcar um bloco DESMARCADO o ressuscita, e é o que o gestor quer
             -- dizer quando arrasta de volta um cartão cancelado. Note que ele
             -- volta a entrar no EXCLUDE nesse instante — se o horário já estiver
             -- ocupado, a frase do handler explica com o quê.
             cancelado_em = NULL, cancelado_por = NULL
       WHERE a.id = _id
       RETURNING a.id INTO v_id;
    END IF;
  EXCEPTION
    -- A constraint GARANTE; a função TRADUZ. Sem isto o formulário mostraria
    -- "conflicting key value violates exclusion constraint", que não nomeia
    -- nada. Aqui já é caso de corrida: o passo 5 recusou o conflito que existia
    -- quando perguntou, então se a constraint estourou foi outra transação
    -- marcando no meio. Reperguntar dá a frase certa; se nem isso achar (a
    -- outra transação desmarcou logo depois), a frase diz o que fazer.
    WHEN exclusion_violation THEN
      RAISE EXCEPTION '%', COALESCE(
        public.agenda_campo_frase_do_conflito(_id, v_dupla, v_dia,
                                              v_inicio - v_desloc, v_inicio + v_servico),
        'Outra pessoa marcou este horário para esta equipe agora mesmo — recarregue a grade e refaça o gesto.')
        USING ERRCODE = 'exclusion_violation';
    -- A rede do CHECK. O passo 3 já recusa em português tudo que se sabe
    -- recusar; este braço é para o que ninguém previu, e ele existe porque
    -- "violates check constraint agenda_campo_identificavel" dentro de um
    -- formulário é pior do que nenhuma mensagem.
    WHEN check_violation THEN
      RAISE EXCEPTION 'Este bloco ficou sem o que o identifica ou com um horário impossível. Confira a equipe, o dia, a hora e a duração, e tente de novo.'
        USING ERRCODE = '55000';
    -- A equipe apagada do cadastro, ou o chamado apagado entre a tela e o clique.
    -- Sem este braço sobe "violates foreign key constraint agenda_campo_dupla_id_fkey".
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'A equipe ou o chamado deste bloco não existe mais — recarregue a grade e refaça o gesto.'
        USING ERRCODE = '55000';
  END;

  -- ══ 8) A TRANSIÇÃO DE STATUS ═════════════════════════════════════════════
  -- GANHA DONO AQUI, e é um UPDATE SEPARADO de propósito: o SET dele é `status`
  -- e o SET do espelho é `data_hora_agendada`, disjuntos. Assim este acorda
  -- trg_chamado_evento_upd (uma linha na linha do tempo) e NÃO acorda o apoio; o
  -- do espelho acorda o apoio e NÃO acorda os sinos. E notify_chamado não emite
  -- nada para aberto->agendado, então o custo em sino é ZERO. Sai de
  -- abrirChamado (features/chamados/data.ts), que derivava o status da presença
  -- da data — a derivação some junto com a escrita da coluna.
  IF v_chamado IS NOT NULL THEN
    UPDATE public.chamados SET status = 'agendado'
     WHERE id = v_chamado AND status = 'aberto';
  END IF;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text) TO authenticated, service_role;

COMMENT ON FUNCTION public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text) IS
  'A porta única de escrita da agenda de campo: cria (_id NULL) ou move um '
  'bloco. AUTORIZA OS DOIS LADOS — o chamado de DESTINO e o dono ATUAL do bloco '
  '(gestor, quando o bloco não tem chamado) — porque mover um bloco desagenda o '
  'chamado de onde ele saiu. É PATCH e não REPLACE: parâmetro NULL quer dizer '
  '"não mexi", nunca "apague", e por isso ela NÃO desliga um bloco do chamado '
  'dele (para isso existe desagendar_chamado). Checa, nesta ordem, forma e '
  'física, o CONFLITO (frase que nomeia o conflitante, com o rótulo respeitando '
  'pode_editar_chamado) e a JORNADA (8h de campo, saída às 09:00 — isentos o '
  'corretiva+urgente e o bloco sem chamado). A transição aberto->agendado é um '
  'UPDATE separado do que o espelho escreve. NÃO gateia por PAPEL: quem responde '
  'pelo chamado marca em qualquer equipe, e essa fronteira está discutida no '
  'cabeçalho do arquivo como decisão pendente do Davi.';

-- ── 6.2 CANCELAR um bloco ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_campo_cancelar(_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_chamado uuid; v_cumprido timestamptz; v_restam int;
BEGIN
  SELECT a.chamado_id, a.cumprido_em INTO v_chamado, v_cumprido
    FROM public.agenda_campo a WHERE a.id = _id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_chamado IS NOT NULL AND auth.uid() IS NOT NULL
     AND NOT public.pode_editar_chamado(v_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.'
      USING ERRCODE = '42501';
  END IF;
  IF v_chamado IS NULL AND auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Só quem responde pela operação desmarca serviço fora do sistema.'
      USING ERRCODE = '42501';
  END IF;

  -- BLOCO CUMPRIDO É REGISTRO, NÃO AGENDA, e a recusa é explícita porque aqui o
  -- clique é sobre um bloco NOMEADO. Cancelar um bloco cumprido tiraria da
  -- ocupação de uma semana PASSADA a visita que aconteceu: o chip do histórico
  -- mudaria para trás e o dia mais produtivo viraria o mais vazio — o defeito
  -- exato que `cumprido_em` foi criada para não ter (ver o COMMENT ON COLUMN).
  -- Depois de carimbado não haveria como distinguir: cancelado_em e cumprido_em
  -- ficariam os dois preenchidos e nada na grade lê essa combinação.
  IF v_cumprido IS NOT NULL THEN
    RAISE EXCEPTION 'Este atendimento já está marcado como feito — desmarcá-lo apagaria o registro de que ele aconteceu. Se ele NÃO aconteceu, tire o "feito" do bloco primeiro e desmarque depois.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.agenda_campo
     SET cancelado_em = now(), cancelado_por = auth.uid()
   WHERE id = _id AND cancelado_em IS NULL;

  -- DESMARCAR O BLOCO E DESAGENDAR O CHAMADO SÃO COISAS DIFERENTES, e cobrar
  -- essa distinção é o que impede o efeito colateral. Mas quando o ÚLTIMO bloco
  -- cai, a distinção deixa de existir: o chamado não tem mais hora nenhuma, e
  -- deixá-lo "agendado" seria o chip mentindo. O espelho já escreveu NULL pelo
  -- gatilho; aqui só o status acompanha.
  IF v_chamado IS NOT NULL THEN
    SELECT count(*) INTO v_restam FROM public.agenda_campo a
     WHERE a.chamado_id = v_chamado AND a.cancelado_em IS NULL;
    IF v_restam = 0 THEN
      UPDATE public.chamados SET status = 'aberto'
       WHERE id = v_chamado AND status = 'agendado';
    END IF;
  END IF;

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agenda_campo_cancelar(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_cancelar(uuid) TO authenticated, service_role;

-- ── 6.3 CUMPRIR — o alternador "feito" ─────────────────────────────────────
-- Sem isto `cumprido_em` é a coluna que ninguém preenche, e o espelho apodrece
-- devagar: ele fica no primeiro bloco e o RETORNO some da quinta-feira em que
-- acontece. Duas mãos vão preenchê-la — esta (um clique no card da grade) e
-- `executarChamado` no app, que ao iniciar o atendimento marca os blocos
-- abertos até hoje. A segunda é código de app, sem gatilho e sem ciclo.
CREATE OR REPLACE FUNCTION public.agenda_campo_cumprir(_id uuid, _feito boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_chamado uuid;
BEGIN
  SELECT a.chamado_id INTO v_chamado FROM public.agenda_campo a WHERE a.id = _id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_chamado IS NOT NULL AND auth.uid() IS NOT NULL
     AND NOT public.pode_editar_chamado(v_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.'
      USING ERRCODE = '42501';
  END IF;
  -- ESTA ERA A ÚNICA DAS QUATRO PORTAS SEM O BRAÇO DE GESTOR. `agenda_campo_valida`
  -- só deixa gestor CRIAR bloco sem chamado e `agenda_campo_cancelar` só deixa
  -- gestor DESMARCAR — mas qualquer autenticado ligava e desligava o "feito" de
  -- um serviço fora do sistema, escrita não autorizada numa linha cuja criação é
  -- privilegiada. O estrago é pequeno (bloco sem chamado não espelha, e
  -- cumprido_em não entra no EXCLUDE nem na ocupação), e é justamente por isso
  -- que a inconsistência sobreviveria: ninguém a veria.
  IF v_chamado IS NULL AND auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Só quem responde pela operação dá baixa em serviço fora do sistema.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.agenda_campo
     SET cumprido_em = CASE WHEN _feito THEN COALESCE(cumprido_em, now()) ELSE NULL END
   WHERE id = _id
     AND cumprido_em IS DISTINCT FROM (CASE WHEN _feito THEN COALESCE(cumprido_em, now()) ELSE NULL END);
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agenda_campo_cumprir(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agenda_campo_cumprir(uuid, boolean) TO authenticated, service_role;

-- ── 6.4 DESAGENDAR o chamado — o ATO deliberado ────────────────────────────
-- "Some com o horário deste chamado" é uma frase diferente de "desmarque este
-- bloco", e ela tem de ser dita de propósito. É esta função, e não um efeito
-- colateral, que escreve NULL no espelho de um chamado com vários blocos.
CREATE OR REPLACE FUNCTION public.desagendar_chamado(_chamado uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int; v_natureza text;
BEGIN
  SELECT c.natureza INTO v_natureza FROM public.chamados c WHERE c.id = _chamado;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este chamado não existe mais — recarregue a tela.'
      USING ERRCODE = '55000';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.pode_editar_chamado(_chamado) THEN
    RAISE EXCEPTION 'Você não responde por este chamado. Peça a quem responde por ele, ou à gestão.'
      USING ERRCODE = '42501';
  END IF;

  -- A DIVISÃO DECLARADA NO §3 VALE AQUI TAMBÉM, e este era o único caminho de
  -- escrita sem a guarda. A função é SECURITY DEFINER e passa por cima de
  -- `chamados_update`: chamada com o id de uma VISITA COMERCIAL agendada, ela
  -- devolvia agendado -> aberto por baixo do gatilho da visita (U41), que é o
  -- dono daquela agenda — e a `visitas_tecnicas` continuava marcada, até o
  -- próximo UPDATE da visita ressincronizar. A divisão comercial/campo é
  -- estrutura no §3 e passava a ser promessa aqui.
  IF v_natureza IS DISTINCT FROM 'campo' THEN
    RAISE EXCEPTION 'A agenda de campo não manda em chamado comercial (este é "%") — quem desmarca a visita é a própria visita técnica.',
      COALESCE(v_natureza, 'sem natureza') USING ERRCODE = '55000';
  END IF;

  -- SÓ O QUE AINDA VAI ACONTECER. `cumprido_em IS NULL` não é detalhe: bloco
  -- cumprido tem `cancelado_em IS NULL`, então o WHERE antigo o tratava como
  -- agenda e o carimbava cancelado. "Tira isso da agenda por enquanto" num
  -- chamado que já teve a visita de terça e tem o retorno na quinta apagava a
  -- terça junto — a ocupação de uma semana passada perdia 3h e o registro do que
  -- aconteceu ia embora sem deixar como distinguir depois.
  UPDATE public.agenda_campo
     SET cancelado_em = now(), cancelado_por = auth.uid()
   WHERE chamado_id = _chamado AND cancelado_em IS NULL AND cumprido_em IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- SEM ESTA LINHA O ATO NÃO ACONTECE NO CASO QUE É 100% DA BASE NO DIA 1.
  -- Chamado de campo com data legada e bloco NENHUM (é o que a §9 conta e chama
  -- de barra de progresso) não atualiza linha alguma acima; com zero linhas o
  -- gatilho AFTER UPDATE do §5 não dispara, `agenda_campo_espelhar` nunca é
  -- chamada, e o chamado ficava `status='aberto'` COM a data velha de pé — no
  -- calendário, em atividadesDeHoje, no card da Início e no PDF. Era a segunda
  -- verdade que esta migration existe para matar, fabricada pela função que o
  -- §6.4 batiza de "o ato deliberado".
  -- Chamar à mão é no-op quando houve bloco: o `IS DISTINCT FROM` do §5 já viu
  -- o mesmo valor pelo gatilho. E o NULL que ela escreve NÃO reatribui apoio —
  -- a guarda do §7.1 devolve cedo.
  PERFORM public.agenda_campo_espelhar(_chamado);

  -- `natureza = 'campo'` de novo, e de propósito: a recusa lá em cima é a que
  -- fala com o usuário, esta é a que sobrevive a alguém mexer nela um dia.
  UPDATE public.chamados SET status = 'aberto'
   WHERE id = _chamado AND status = 'agendado' AND natureza = 'campo';

  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.desagendar_chamado(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.desagendar_chamado(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.desagendar_chamado(uuid) IS
  'O ato de tirar um chamado de campo da agenda: cancela os blocos que ainda '
  'VÃO acontecer (nunca os cumpridos, que são registro), recalcula o espelho À '
  'MÃO — sem isso o ato não faria nada no chamado legado que tem data e não tem '
  'bloco, que é a base inteira no primeiro mês — e devolve agendado -> aberto. '
  'Recusa chamado comercial: aquela agenda é da visita técnica (U41). Devolve '
  'quantos blocos foram desmarcados (0 é resposta normal, não erro).';

-- ═══════════════════════════════════════════════════════════════════════
-- §7) A MESMA GUARDA NOS DOIS CHAMADORES DA U76
-- ═══════════════════════════════════════════════════════════════════════
-- `chamado_sincronizar_apoio()` tem DOIS chamadores: o gatilho
-- `chamado_apoio_da_dupla()` (§7.1) e a ferramenta manual
-- `reconciliar_apoios_abertos()` (§7.2). A regra nova — "não sei QUANDO não
-- autoriza reescrever quem foi ao prédio" — precisa valer nos dois, e ela NÃO
-- pode morar dentro do callee: aquela função recebe só o id do chamado e não
-- sabe O QUE mudou. Se ela recusasse por conta própria sempre que a data é NULL,
-- um chamado SEM data que TROCA de responsável deixaria de reatribuir o apoio, e
-- o apoio do responsável antigo ficaria colado num chamado que agora é de outra
-- pessoa — quebrando a promessa central da U76 para consertar um caso vizinho.
-- Os dois corpos abaixo são os da U76, LITERAIS, com as linhas novas marcadas. O
-- corpo original de cada um vai inteiro no DESFAZER, com dólar-quote diferente.

-- ── 7.1 DESAGENDAR NÃO É REATRIBUIR (o gatilho) ────────────────────────────
--
-- O CASO, que o espelho CRIA e que antes não existia: cancelar o último bloco
-- escreve NULL em data_hora_agendada. Aí `dia_da_dupla(NULL, created_at)`
-- (U76:381-388) cai no COALESCE para `created_at`, que costuma ser OUTRA semana
-- ISO. `v_mudou_semana` vira true, `chamado_sincronizar_apoio` roda contra a
-- escala da semana de ABERTURA, e o par do chamado muda sozinho — com um sino
-- por parceiro — por conta de um ato que só disse "não sei mais quando".
--
-- CONTRAFACTUAL, as duas saídas que eu recusei:
--   (a) o espelho nunca escrever NULL. Deixaria a data velha de pé sem bloco
--       nenhum, que é exatamente a segunda verdade que a U78 existe para matar.
--   (b) tirar `data_hora_agendada` da lista OF do gatilho de apoio. Reabriria o
--       buraco que a U76 comprou em :1120-1123 ("reagendei para outra semana e o
--       apoio ficou na semana antiga").
-- Sobra a guarda: quatro termos, e os quatro importam. Sem o de `natureza`, um
-- flip de natureza simultâneo ao data->NULL seria engolido. A posição é DEPOIS
-- de v_mudou_semana, e não depois de v_mudou_dono: só ali as três variáveis já
-- estão calculadas e a leitura fica linear.
--
-- E A GUARDA SOZINHA TROCAVA UM BUG POR OUTRO — a IDA estava protegida e a VOLTA
-- não. Quando a data RETORNA depois de um desagendamento, `v_dia_antes` é
-- `dia_da_dupla(NULL, OLD.created_at)`, que cai outra vez em `created_at`: o
-- mesmo palpite que a guarda acima acabou de declarar não-confiável, agora usado
-- como se fosse "a última semana conhecida". Remarcar para a semana em que o
-- chamado foi ABERTO faz `v_mudou_semana` dar false, a saída cedo herdada da U76
-- dispara, e o apoio fica na semana antiga — registro errado de quem foi ao
-- prédio, por três cliques banais do balcão (marquei p/ S37, desmarquei,
-- remarquei p/ esta semana). A correção é o termo NOT (OLD NULL AND NEW não
-- nulo) na saída cedo.
-- POR QUE ESSE TERMO E NÃO O `OLD.data_hora_agendada IS NOT NULL` mais simples:
-- com o simples, TODO update de chamado sem data (OLD NULL, NEW NULL — inclusive
-- um "salvar" que reescreve responsavel_id com o mesmo valor, o que o PostgREST
-- faz) deixaria de sair cedo e passaria a ressincronizar apoio à toa, podendo
-- inserir apoio e tocar sino num salvamento que não mudou nada. Só o caso "a
-- data VOLTOU" precisa furar a saída cedo, e é só ele que fura.
CREATE OR REPLACE FUNCTION public.chamado_apoio_da_dupla()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dia          date;
  v_dia_antes    date;
  v_mudou_dono   boolean;
  v_mudou_semana boolean;
BEGIN
  IF NEW.natureza IS DISTINCT FROM 'campo' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status IN ('concluido','cancelado') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_dia        := public.dia_da_dupla(NEW.data_hora_agendada, NEW.created_at);
    v_dia_antes  := public.dia_da_dupla(OLD.data_hora_agendada, OLD.created_at);
    v_mudou_dono := NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id;
    v_mudou_semana := public.referencia_semanal(v_dia)
                      IS DISTINCT FROM public.referencia_semanal(v_dia_antes);

    -- U78: DESAGENDAR NÃO É REATRIBUIR. Quando o espelho volta a NULL e o
    -- responsável é o mesmo, a semana de created_at é um palpite PIOR do que a
    -- última semana conhecida, e trocá-la reescreve apoio — registro de quem foi
    -- ao prédio — por um ato que só disse "não sei mais quando". É a mesma régua
    -- do §8.2 da U76: "não sei" NUNCA autoriza reescrita.
    IF NEW.data_hora_agendada IS NULL
       AND OLD.data_hora_agendada IS NOT NULL
       AND NOT v_mudou_dono
       AND NEW.natureza IS NOT DISTINCT FROM OLD.natureza THEN
      RETURN NEW;
    END IF;

    IF NOT v_mudou_dono AND NOT v_mudou_semana
       -- U78: DESAGENDAR NÃO É REATRIBUIR — a VOLTA. Quando a data reaparece
       -- depois de um desagendamento, v_dia_antes cai em created_at, que é o
       -- palpite que a guarda de cima acabou de recusar; "não mudou a semana"
       -- comparado contra um palpite não é uma afirmação, e sem este termo
       -- remarcar para a semana de abertura deixa o apoio na semana antiga.
       AND NOT (OLD.data_hora_agendada IS NULL AND NEW.data_hora_agendada IS NOT NULL)
       AND NEW.natureza IS NOT DISTINCT FROM OLD.natureza THEN
      RETURN NEW;
    END IF;

    -- encerrado: só a troca de responsável reabre o assunto
    IF NEW.status IN ('concluido','cancelado') AND NOT v_mudou_dono THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.chamado_sincronizar_apoio(NEW.id);
  RETURN NEW;
END;
$$;

-- OS GATILHOS NÃO SÃO RECRIADOS. Os nomes e a lista OF continuam os da U76:
-- `CREATE OR REPLACE FUNCTION` troca o corpo sem tocar em quem o chama, e
-- recriar seria a chance de mudar a lista OF por acidente.

COMMENT ON FUNCTION public.chamado_apoio_da_dupla() IS
  'Grava o apoio automático (origem=dupla) com a turma da SEMANA em que o '
  'chamado está programado (U76). Só reavalia quando a ATRIBUIÇÃO muda — '
  'responsável, ou a semana do trabalho. A U78 acrescentou os DOIS lados do '
  'mesmo caso: DESMARCAR a data (agendada -> NULL) sem trocar de responsável NÃO '
  'reavalia (senão a referência cairia em created_at e o par pularia para a '
  'semana de abertura, com sino); e a data que VOLTA depois disso não pode cair '
  'na saída cedo de "nem dono nem semana mudaram", porque ali a comparação seria '
  'contra o mesmo palpite de created_at — e o apoio ficaria na semana antiga.';

-- ── 7.2 A MESMA REGRA NA RECONCILIAÇÃO ─────────────────────────────────────
-- O corpo é o da U76 (:1157-1182) LITERAL, com o filtro novo no SELECT do laço.
--
-- POR QUE A GUARDA DO §7.1 NÃO BASTA: ela mora no GATILHO, e
-- `reconciliar_apoios_abertos()` chama `chamado_sincronizar_apoio(r.id)` DIRETO,
-- pulando o gatilho inteiro. O cenário é a ferramenta oficial da casa fazendo o
-- dano que a guarda previne: CH-050 aberto em julho, programado para a S36,
-- apoio gravado com a turma da S36; cancelam o último bloco, o espelho escreve
-- NULL, a guarda do §7.1 funciona e o apoio fica. Duas semanas depois o Davi
-- roda a reconciliação — que é o ato que a U76 §8.4 lhe deu para isso — e para
-- CH-050 `dia_da_dupla(NULL, created_at)` devolve JULHO, a turma de julho entra,
-- a turma da S36 é DELETADA e cada parceiro novo recebe um sino. Registro de
-- quem foi ao prédio, reescrito por um palpite.
--
-- O FILTRO É ESTREITO DE PROPÓSITO: só pula quem tem data NULA **e** já tem
-- apoio origem='dupla' gravado. Chamado sem data e SEM apoio continua passando —
-- ali não há registro a proteger, o palpite de `created_at` é o melhor que
-- existe, e ele é autocorrigível quando a data chegar (é a doutrina da própria
-- U76 §3). "Não sei" nunca autoriza REESCREVER; não impede ESCREVER a primeira
-- vez.
CREATE OR REPLACE FUNCTION public.reconciliar_apoios_abertos(_desde_semana text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; v_n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
    RAISE EXCEPTION 'Só quem responde pela operação reconcilia apoio.'
      USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT c.id
      FROM public.chamados c
     WHERE c.natureza = 'campo'
       AND c.status NOT IN ('concluido','cancelado')
       -- U78: DESAGENDAR NÃO É REATRIBUIR. Sem data, a referência cai em
       -- created_at, e reconciliar contra ela reescreveria o registro de quem
       -- foi ao prédio por um palpite — que é o que esta ferramenta existe para
       -- NÃO fazer. Chamado sem data e sem apoio ainda entra: ali não há
       -- registro a proteger.
       AND NOT (c.data_hora_agendada IS NULL
                AND EXISTS (SELECT 1 FROM public.chamado_apoios a
                             WHERE a.chamado_id = c.id AND a.origem = 'dupla'))
       AND (_desde_semana IS NULL
            OR public.referencia_semanal(
                 public.dia_da_dupla(c.data_hora_agendada, c.created_at)) >= _desde_semana)
  LOOP
    IF public.chamado_sincronizar_apoio(r.id) > 0 THEN v_n := v_n + 1; END IF;
  END LOOP;

  RETURN v_n;
END;
$$;
-- CREATE OR REPLACE preserva a ACL, mas repetir é barato e torna a linha
-- verdadeira sozinha, sem depender de o leitor conhecer essa regra.
REVOKE EXECUTE ON FUNCTION public.reconciliar_apoios_abertos(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reconciliar_apoios_abertos(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.reconciliar_apoios_abertos(text) IS
  'Refaz o apoio automático dos chamados de campo AINDA ABERTOS cujo apoio '
  'gravado diverge da escala da semana deles. Deliberada: nenhum gatilho a '
  'chama. Devolve quantos chamados mudaram. Nunca alcança concluído ou '
  'cancelado, nem apoio manual. A U78 acrescentou: nunca alcança também o '
  'chamado SEM data que JÁ TEM apoio gravado — sem data a referência cairia em '
  'created_at, e reescrever registro por um palpite é o que esta função existe '
  'para não fazer.';

-- ═══════════════════════════════════════════════════════════════════════
-- §8) PORTÃO — o corpo retranscrito manteve tudo?
-- ═══════════════════════════════════════════════════════════════════════
-- Reescrever à mão o corpo de duas funções vivas é a operação de maior variância
-- deste arquivo. O portão é o que impede uma letra a menos de virar produção: se
-- qualquer invariante da U76 sumiu na transcrição, a transação inteira volta e
-- nada foi alterado.
--
-- E ELE GANHOU UM SEGUNDO DEVER: o md5. A afirmação central desta migration é
-- NEGATIVA ("ninguém perdeu ou trocou data_hora_agendada"), e uma afirmação
-- central não pode sair só em SELECT — se divergir, a transação commita e o
-- Davi tem de reparar numa linha vermelha no meio da tela, às 23h. Aqui ela é
-- freio. O `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` lá em cima é o que
-- torna esse freio confiável em vez de histérico; os dois andam juntos.
DO $$
DECLARE
  v_apoio  text;
  v_recon  text;
  v_marcar text;
  v_desag  text;
  v_falta  text := '';
BEGIN
  SELECT p.prosrc INTO v_apoio FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='chamado_apoio_da_dupla';
  SELECT p.prosrc INTO v_recon FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='reconciliar_apoios_abertos';
  SELECT p.prosrc INTO v_marcar FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='agenda_campo_marcar';
  SELECT p.prosrc INTO v_desag FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='desagendar_chamado';

  -- ── o gatilho da U76 (§7.1) ─────────────────────────────────────────────
  IF position('NEW.natureza IS DISTINCT FROM ''campo''' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a saída cedo em natureza <> campo (U76)'; END IF;
  IF position('IF NOT v_mudou_dono AND NOT v_mudou_semana' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a saída cedo de "nem dono nem semana mudaram" (U76)'; END IF;
  IF position('NEW.status IN (''concluido'',''cancelado'') AND NOT v_mudou_dono' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a saída cedo de chamado encerrado (U76)'; END IF;
  IF position('TG_OP = ''INSERT'' AND NEW.status IN (''concluido'',''cancelado'')' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a saída cedo de chamado que NASCE encerrado (carga histórica, U76)'; END IF;
  IF position('chamado_sincronizar_apoio' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a chamada de chamado_sincronizar_apoio (U76)'; END IF;
  IF position('U78: DESAGENDAR NÃO É REATRIBUIR' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a guarda NOVA da U78 no gatilho (data -> NULL não reatribui)'; END IF;
  IF position('OLD.data_hora_agendada IS NULL AND NEW.data_hora_agendada IS NOT NULL' in v_apoio) = 0 THEN
    v_falta := v_falta || E'\n  · a correção da VOLTA (a data que retorna não pode cair na saída cedo)'; END IF;

  -- ── a reconciliação da U76 (§7.2) ───────────────────────────────────────
  IF position('Só quem responde pela operação reconcilia apoio.' in v_recon) = 0 THEN
    v_falta := v_falta || E'\n  · o gate de gestor de reconciliar_apoios_abertos (U76)'; END IF;
  IF position('c.status NOT IN (''concluido'',''cancelado'')' in v_recon) = 0 THEN
    v_falta := v_falta || E'\n  · o "só chamado aberto" de reconciliar_apoios_abertos (U76)'; END IF;
  IF position('chamado_sincronizar_apoio' in v_recon) = 0
     OR position('_desde_semana' in v_recon) = 0 THEN
    v_falta := v_falta || E'\n  · o laço de reconciliar_apoios_abertos (U76)'; END IF;
  IF position('U78: DESAGENDAR NÃO É REATRIBUIR' in v_recon) = 0 THEN
    v_falta := v_falta || E'\n  · a guarda NOVA da U78 na reconciliação (sem data + apoio gravado = não mexe)'; END IF;

  -- ── as correções de AUTORIZAÇÃO desta revisão (§6) ──────────────────────
  -- Substring de prosrc, e não teste de comportamento: no SQL Editor auth.uid()
  -- é NULL e TODOS os gates passam por desenho, então não há como exercitar uma
  -- recusa aqui dentro. O que o portão consegue garantir é que o código não
  -- voltou atrás — e é isso, e só isso, que estas quatro linhas afirmam.
  IF position('U78: QUEM MANDA NESTE BLOCO HOJE' in v_marcar) = 0
     OR position('v_a_chamado' in v_marcar) = 0 THEN
    v_falta := v_falta || E'\n  · o gate do DONO ATUAL do bloco em agenda_campo_marcar (sem ele, mover bloco alheio é reescrita não autorizada)'; END IF;
  IF position('agenda_campo_frase_do_conflito' in v_marcar) = 0 THEN
    v_falta := v_falta || E'\n  · o ensaio de conflito ANTES da jornada em agenda_campo_marcar'; END IF;
  IF position('COALESCE(_chamado, v_a_chamado)' in v_marcar) = 0 THEN
    v_falta := v_falta || E'\n  · o COALESCE contra a linha viva em agenda_campo_marcar (sem ele, parâmetro omitido APAGA dado)'; END IF;
  IF position('cumprido_em IS NULL' in v_desag) = 0
     OR position('agenda_campo_espelhar' in v_desag) = 0 THEN
    v_falta := v_falta || E'\n  · desagendar_chamado sem o filtro de bloco cumprido ou sem o espelho à mão'; END IF;

  -- ── a lista OF do gatilho da U76 ────────────────────────────────────────
  -- Tem de estar EXATAMENTE como ela nasceu: se esta migration a tivesse
  -- tocado, a defesa em quatro camadas do cabeçalho estaria descrevendo outro
  -- banco.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.chamados'::regclass
       AND t.tgname = 'trg_chamado_apoio_dupla_upd'
       AND pg_get_triggerdef(t.oid) LIKE '%OF responsavel_id, data_hora_agendada, natureza%'
  ) THEN
    v_falta := v_falta || E'\n  · a lista OF de trg_chamado_apoio_dupla_upd (U76) não é mais a original';
  END IF;

  IF v_falta <> '' THEN
    RAISE EXCEPTION E'ABORTADO NO PORTÃO, ANTES DE QUALQUER COMMIT — nada foi alterado (ROLLBACK).\nA transcrição perdeu invariantes:%\nO QUE FAZER: NÃO tente consertar no editor. O corpo original de cada função da U76 está no rodapé DESFAZER deste arquivo; compare com ele, corrija o ARQUIVO e rode de novo inteiro.', v_falta;
  END IF;

  -- ── E O md5: A U78 NÃO ESCREVE UMA LINHA EM public.chamados ─────────────
  -- Contagem não bastaria (valores trocados entre si dariam a mesma contagem); o
  -- dump ordenado prova a identidade byte a byte, para TODOS os chamados. Como
  -- freio, e não como relatório.
  IF (SELECT md5(COALESCE(string_agg(c.id::text || '|' ||
                          COALESCE(c.data_hora_agendada::text, '-'), E'\n' ORDER BY c.id), ''))
        FROM public.chamados c)
     IS DISTINCT FROM (SELECT digest_agenda FROM _u78_antes) THEN
    RAISE EXCEPTION E'ABORTADO NO PORTÃO, ANTES DE QUALQUER COMMIT — nada foi alterado (ROLLBACK).\nchamados.data_hora_agendada MUDOU no meio desta transação, e a U78 não escreve nessa coluna. Alguma coisa disparou onde nada deveria.\nO QUE FAZER: não rode de novo às cegas. Rode o SELECT do §9 (a linha do md5) com o sistema parado; se continuar divergindo, chame ajuda antes de forçar qualquer coisa.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- §9) CONFERÊNCIA — UM RESULT SET, COM VEREDITO
-- ═══════════════════════════════════════════════════════════════════════
-- DUAS coisas para ler, nesta ordem:
--   · a TABELA abaixo, em que a coluna `veredito` já fez a comparação. O que o
--     Davi tem de procurar às 23h é a palavra '>>> OLHAR <<<'. Nada mais.
--   · a LISTA depois dela ("quem não casou"), que tem de vir VAZIA.
--
-- POR QUE UM SÓ, e por que isto é correção e não estilo: RAISE NOTICE é
-- INVISÍVEL no editor do Supabase — por isso tudo que precisa ser visto sai em
-- SELECT, com valor obtido × esperado — e o editor mostra o ÚLTIMO conjunto de
-- resultados. A versão anterior desta seção tinha SETE conjuntos (contados: 9.1,
-- 9.2, 9.3, 9.4, as duas listas do 9.5 e o 9.6): a prova
-- negativa (a afirmação central do arquivo) ficava escondida no meio, e o que
-- aparecia na tela era um número de referência que nem tem "esperado". Emendar
-- tudo num UNION ALL ordenado custa uma coluna `ordem` e devolve uma tela só.
--
-- O QUE ESTA TABELA NÃO CONSEGUE PROVAR, dito antes que alguém suponha o
-- contrário: as recusas de AUTORIZAÇÃO. No SQL Editor `auth.uid()` é NULL e
-- todos os gates passam por desenho, então não há como exercitar aqui dentro um
-- "você não responde por este chamado". As linhas 201-208 são SUBSTRING do
-- corpo vivo da função: elas provam que o código não voltou atrás, e só isso.
-- Quem prova comportamento é o ensaio à mão do rodapé.
SELECT t.ordem, t.conferencia, t.valor, t.esperado,
       CASE WHEN t.esperado = '(referência)'             THEN '— referência'
            WHEN t.valor IS NOT DISTINCT FROM t.esperado THEN 'ok'
            ELSE '>>> OLHAR <<<' END AS veredito
  FROM (

-- ── 9.1 estrutura, grants e a reexecução ──────────────────────────────────
SELECT 100 AS ordem,
       'esta é a PRIMEIRA execução? (false = reexecução, e reexecutar é seguro: o §7 vira no-op)' AS conferencia,
       (SELECT (NOT reexecucao)::text FROM _u78_antes) AS valor,
       '(referência)' AS esperado
UNION ALL
SELECT 101, 'a tabela nova existe',
       (to_regclass('public.agenda_campo') IS NOT NULL)::text, 'true'
UNION ALL
SELECT 102, 'CRÍTICO: "a equipe não está em dois lugares ao mesmo tempo" é uma CONSTRAINT DE EXCLUSÃO, não um gatilho que pode ser desligado',
       (SELECT count(*)::text FROM pg_constraint
         WHERE conrelid='public.agenda_campo'::regclass
           AND conname='agenda_campo_sem_sobreposicao' AND contype='x'), '1'
UNION ALL
SELECT 103, 'a janela do EXCLUDE desconta o deslocamento e é meia-aberta — gêmea do modelo puro',
       (SELECT (pg_get_constraintdef(oid) LIKE '%int4range%'
            AND pg_get_constraintdef(oid) LIKE '%deslocamento_min%')::text
          FROM pg_constraint
         WHERE conrelid='public.agenda_campo'::regclass
           AND conname='agenda_campo_sem_sobreposicao'), 'true'
UNION ALL
SELECT 104, 'RLS ligada na tabela nova',
       (SELECT relrowsecurity::text FROM pg_class WHERE oid='public.agenda_campo'::regclass), 'true'
UNION ALL
-- has_table_privilege e NÃO information_schema.role_table_grants: aquela view
-- só enxerga concessão DIRETA, e um GRANT a PUBLIC (ou herdado por role)
-- passaria por ela imprimindo "0". A API honesta é esta, e é a mesma que a
-- linha 107 já usava duas linhas abaixo.
SELECT 105, 'CRÍTICO: authenticated NÃO escreve na tabela direto — a porta é a RPC, que é quem autoriza os dois lados, nomeia o conflito e checa a jornada',
       (has_table_privilege('authenticated','public.agenda_campo','INSERT')
     OR has_table_privilege('authenticated','public.agenda_campo','UPDATE')
     OR has_table_privilege('authenticated','public.agenda_campo','DELETE'))::text, 'false'
UNION ALL
SELECT 106, 'authenticated LÊ a tabela inteira (o denominador do chip de ocupação)',
       has_table_privilege('authenticated','public.agenda_campo','SELECT')::text, 'true'
UNION ALL
SELECT 107, 'CRÍTICO: nenhuma função nova da U78 ficou aberta a anon — a chave publishable está no .env versionado',
       (SELECT count(*)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public'
           AND p.proname IN ('agenda_campo_espelhar','agenda_campo_marcar','agenda_campo_cancelar',
                             'agenda_campo_cumprir','desagendar_chamado',
                             'agenda_campo_frase_do_conflito','duracao_texto')
           AND has_function_privilege('anon', p.oid, 'EXECUTE')), '0'
UNION ALL
SELECT 108, 'os três gatilhos do espelho nasceram',
       (SELECT count(*)::text FROM pg_trigger
         WHERE tgrelid='public.agenda_campo'::regclass AND NOT tgisinternal
           AND tgname IN ('trg_agenda_campo_espelho_ins','trg_agenda_campo_espelho_upd',
                          'trg_agenda_campo_espelho_del')), '3'
UNION ALL
SELECT 109, 'o índice liso de chamado_id existe (o CASCADE precisa achar TAMBÉM os blocos cancelados, e o índice do espelho é parcial)',
       (SELECT count(*)::text FROM pg_class
         WHERE relname='agenda_campo_chamado_idx' AND relkind='i'), '1'

-- ── 9.2 AS CORREÇÕES DE AUTORIZAÇÃO E DE PERDA DE DADO ────────────────────
-- Estas oito linhas não existiam. Elas estão aqui porque as portas do §6 são o
-- único lugar do sistema em que alguém pode destruir dado, e porque cada uma
-- delas fecha um buraco que existiu neste arquivo.
UNION ALL
SELECT 201, 'CRÍTICO: agenda_campo_marcar confere o DONO ATUAL do bloco, e não só o chamado de destino — sem isso mover bloco alheio para chamado próprio é reescrita não autorizada, e o chamado roubado perde a data sem sino',
       (SELECT (position('U78: QUEM MANDA NESTE BLOCO HOJE' in p.prosrc) > 0
            AND position('pode_editar_chamado(v_a_chamado)' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_marcar'), 'true'
UNION ALL
SELECT 202, 'CRÍTICO: agenda_campo_marcar é PATCH e não REPLACE — parâmetro omitido não apaga o número da OS de fora, que é o único registro daquele serviço',
       (SELECT (position('COALESCE(_chamado, v_a_chamado)' in p.prosrc) > 0
            AND position('COALESCE(nullif(btrim(_titulo_externo), ''''), v_a_titulo)' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_marcar'), 'true'
UNION ALL
SELECT 203, 'CRÍTICO: a frase do conflito respeita pode_editar_chamado — sem o gate ela é um oráculo de enumeração de número, título e cliente de TODO chamado de campo',
       (SELECT (position('pode_editar_chamado' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_frase_do_conflito'), 'true'
UNION ALL
SELECT 204, 'o CONFLITO é checado ANTES da jornada, como no modelo puro — o conflito é específico e acionável, a jornada é agregada',
       (SELECT (position('agenda_campo_frase_do_conflito' in p.prosrc) > 0
            AND position('IF NOT v_urgente THEN' in p.prosrc) > 0
            AND position('agenda_campo_frase_do_conflito' in p.prosrc)
              < position('IF NOT v_urgente THEN' in p.prosrc))::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_marcar'), 'true'
UNION ALL
SELECT 205, 'agenda_campo_cumprir também exige gestor para bloco sem chamado — era a única das quatro portas fora do padrão',
       (SELECT (position('is_gestor' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_cumprir'), 'true'
UNION ALL
SELECT 206, 'agenda_campo_cancelar RECUSA bloco já cumprido — desmarcar o que aconteceu tiraria da ocupação de uma semana passada a visita que houve',
       (SELECT (position('v_cumprido IS NOT NULL' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_cancelar'), 'true'
UNION ALL
SELECT 207, 'CRÍTICO: desagendar_chamado poupa o bloco cumprido E chama o espelho à mão — sem a segunda, o ato não faz nada no chamado legado com data e sem bloco, que é a base inteira no dia 1',
       (SELECT (position('cumprido_em IS NULL' in p.prosrc) > 0
            AND position('PERFORM public.agenda_campo_espelhar' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='desagendar_chamado'), 'true'
UNION ALL
SELECT 208, 'desagendar_chamado recusa chamado comercial — a agenda da visita é do gatilho da U41, e esta função é DEFINER (passaria por cima de chamados_update)',
       (SELECT (position('natureza IS DISTINCT FROM ''campo''' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='desagendar_chamado'), 'true'

-- ── 9.3 AS TRÊS QUE RODAM DE VERDADE ──────────────────────────────────────
-- O corpo de uma função plpgsql só tem as consultas dele analisadas na PRIMEIRA
-- execução: `CREATE FUNCTION` valida a sintaxe do plpgsql e não valida nome de
-- coluna dentro dos SELECTs. Estas três executam o corpo inteiro e não escrevem
-- uma linha — é o máximo de ensaio que cabe dentro da própria migration. O
-- resto (agenda_campo_marcar, que escreveria) está no rodapé, para o Davi rodar
-- à mão logo depois.
UNION ALL
SELECT 301, 'a frase do conflito RODA (o corpo dela foi analisado, e sem bloco nenhum ela devolve "não há conflito")',
       COALESCE(public.agenda_campo_frase_do_conflito(
         NULL, '00000000-0000-0000-0000-000000000000'::uuid, DATE '1900-01-01', 540, 600),
         'sem conflito'), 'sem conflito'
UNION ALL
SELECT 302, 'o espelho RODA sobre um chamado que não existe: os dois estágios e o UPDATE foram analisados, e ele não mexeu em linha nenhuma',
       public.agenda_campo_espelhar('00000000-0000-0000-0000-000000000000'::uuid)::text, 'false'
UNION ALL
SELECT 303, 'duracao_texto é o gêmeo literal de duracaoTexto() do modelo puro (90, 45, 480, 0, 300)',
       public.duracao_texto(90) || '|' || public.duracao_texto(45) || '|' ||
       public.duracao_texto(480) || '|' || public.duracao_texto(0) || '|' ||
       public.duracao_texto(300), '1h30|45min|8h|0min|5h'

-- ── 9.4 A CASCATA, provada pelas listas OF ────────────────────────────────
-- Estas linhas são o cabeçalho virando número. Se qualquer uma cair, a análise
-- de "reagendei e tocaram trinta sinos" deixou de descrever este banco.
UNION ALL
SELECT 401, 'CRÍTICO: mexer na DURAÇÃO ou no DESLOCAMENTO do bloco não chega a escrever em public.chamados (a lista OF do espelho é curta)',
       (SELECT (pg_get_triggerdef(t.oid) !~ 'servico_min|deslocamento_min|dupla_id|os_externa|titulo_externo')::text
          FROM pg_trigger t WHERE t.tgrelid='public.agenda_campo'::regclass
           AND t.tgname='trg_agenda_campo_espelho_upd'), 'true'
UNION ALL
SELECT 402, 'CRÍTICO: o espelho só grava quando o valor MUDA — sem isto updated_at e o realtime tomam pancada a cada edição',
       (SELECT (position('data_hora_agendada IS DISTINCT FROM v_novo' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='agenda_campo_espelhar'), 'true'
UNION ALL
-- Lido de pg_get_triggerdef, e não de unnest(tgattr): `tgattr` é int2vector, que
-- não é array de verdade — unnest() e ANY() sobre ele dependem de cast que pode
-- não existir, e uma conferência que ERRA de sintaxe aborta a migration inteira.
SELECT 403, 'CRÍTICO: o espelho NÃO alcança os sinos de chamado — notify_chamado_upd escuta só status e responsavel_id',
       (SELECT (pg_get_triggerdef(t.oid) LIKE '%UPDATE OF status, responsavel_id ON%')::text
          FROM pg_trigger t
         WHERE t.tgrelid='public.chamados'::regclass AND t.tgname='trg_notify_chamado_upd'), 'true'
UNION ALL
SELECT 404, 'CRÍTICO: o gatilho de apoio da U76 ficou como estava — a cascata é a intenção dela, o que se controla é a frequência',
       (SELECT (pg_get_triggerdef(t.oid) LIKE '%OF responsavel_id, data_hora_agendada, natureza%')::text
          FROM pg_trigger t WHERE t.tgrelid='public.chamados'::regclass
           AND t.tgname='trg_chamado_apoio_dupla_upd'), 'true'
UNION ALL
-- ESTA LINHA PROVA MENOS DO QUE PARECE, e o cabeçalho já diz isso: ela conta
-- gatilhos de public.chamados cuja DEFINIÇÃO cita agenda_campo. Um gatilho
-- futuro que chame uma função que, no corpo dela, insira em agenda_campo passa
-- liso — e aí o ciclo fecha sem aviso. É a melhor prova que cabe numa linha,
-- não é a prova de que não há ciclo.
SELECT 405, 'nenhum gatilho de public.chamados CITA agenda_campo (prova por substring da aresta de volta que não deve existir)',
       (SELECT count(*)::text FROM pg_trigger t
         WHERE t.tgrelid='public.chamados'::regclass AND NOT t.tgisinternal
           AND pg_get_triggerdef(t.oid) LIKE '%agenda_campo%'), '0'
UNION ALL
SELECT 406, 'a guarda da U78 está no corpo vivo do GATILHO da U76 (desagendar não reatribui)',
       (SELECT (position('U78: DESAGENDAR NÃO É REATRIBUIR' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='chamado_apoio_da_dupla'), 'true'
UNION ALL
SELECT 407, 'CRÍTICO: e a correção da VOLTA também — remarcar para a semana de abertura depois de desagendar não pode cair na saída cedo, senão o apoio fica na semana antiga',
       (SELECT (position('OLD.data_hora_agendada IS NULL AND NEW.data_hora_agendada IS NOT NULL' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='chamado_apoio_da_dupla'), 'true'
UNION ALL
SELECT 408, 'CRÍTICO: a MESMA guarda está na reconciliação — ela chama chamado_sincronizar_apoio direto, pulando o gatilho, e sem isto a ferramenta oficial da casa faz o dano que a guarda previne',
       (SELECT (position('U78: DESAGENDAR NÃO É REATRIBUIR' in p.prosrc) > 0)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='reconciliar_apoios_abertos'), 'true'

-- ── 9.5 A PROVA NEGATIVA — nada foi tocado ────────────────────────────────
-- O md5 já é FREIO no §8: se ele tivesse mudado, esta tela não existiria. Estas
-- linhas são o recibo, e a conta é fácil porque o desenho foi feito para ser
-- fácil de provar — a U78 não escreve uma linha em public.chamados nem em
-- public.chamado_apoios.
UNION ALL
SELECT 501, 'apoios no total (antes × depois)',
       (SELECT count(*) FROM public.chamado_apoios)::text,
       (SELECT apoios_total::text FROM _u78_antes)
UNION ALL
SELECT 502, 'apoios origem=dupla (antes × depois)',
       (SELECT count(*) FROM public.chamado_apoios WHERE origem='dupla')::text,
       (SELECT apoios_dupla::text FROM _u78_antes)
UNION ALL
SELECT 503, 'apoios origem=manual (antes × depois)',
       (SELECT count(*) FROM public.chamado_apoios WHERE origem='manual')::text,
       (SELECT apoios_manual::text FROM _u78_antes)
UNION ALL
SELECT 504, 'CRÍTICO: nenhum sino de apoio foi disparado por esta migration',
       (SELECT count(*) FROM public.notificacoes WHERE tipo='chamado_apoio')::text,
       (SELECT sinos_apoio::text FROM _u78_antes)
UNION ALL
SELECT 505, 'chamados de campo COM data (antes × depois)',
       (SELECT count(*) FROM public.chamados
         WHERE natureza='campo' AND data_hora_agendada IS NOT NULL)::text,
       (SELECT campo_com_data::text FROM _u78_antes)
UNION ALL
SELECT 506, 'CRÍTICO: NINGUÉM perdeu ou trocou data_hora_agendada — o dump ordenado é o MESMO (md5). Contar não bastaria: contagem igual esconderia valores trocados entre si',
       (SELECT md5(COALESCE(string_agg(c.id::text || '|' || COALESCE(c.data_hora_agendada::text, '-'),
                                       E'\n' ORDER BY c.id), '')) FROM public.chamados c),
       (SELECT digest_agenda FROM _u78_antes)

-- ── 9.6 o fuso, ida e volta ───────────────────────────────────────────────
-- A armadilha mais cara do desenho, em duas linhas: um bloco marcado às 22:00 de
-- uma terça tem de continuar sendo TERÇA quando o espelho o converte e a U76 o
-- lê de volta. Errar aqui é uma hora virando uma semana, e só em agendamento
-- noturno.
UNION ALL
SELECT 601, 'FUSO ida-e-volta: bloco das 22:00 volta no MESMO dia',
       public.dia_da_dupla(
         (DATE '2026-09-01' + make_interval(mins => 1320)) AT TIME ZONE 'America/Sao_Paulo',
         now())::text, '2026-09-01'
UNION ALL
SELECT 602, 'e a semana ISO dele também',
       public.referencia_semanal(public.dia_da_dupla(
         (DATE '2026-09-01' + make_interval(mins => 1320)) AT TIME ZONE 'America/Sao_Paulo',
         now())),
       public.referencia_semanal(DATE '2026-09-01')

-- ── 9.7 O RETRATO: a faixa "agendado sem horário" ─────────────────────────
-- NÃO HÁ BACKFILL, DE PROPÓSITO (a frase é da U64 e continua inteira). Não se
-- semeia bloco a partir de data_hora_agendada porque hoje 12:00 significa DUAS
-- coisas indistinguíveis por valor — "a tela de programação não perguntou a
-- hora" (T12:00:00 literal) e "meio-dia mesmo" (novo-campo, PainelChamado) — e
-- porque chutar uma duração envenenaria o chip de ocupação no primeiro dia, com
-- um número inventado que tem cara de medição.
-- Então todo chamado de campo aberto com data e sem bloco cai na faixa
-- "agendado sem horário", com um clique para dar horário. ESTE NÚMERO É A BARRA
-- DE PROGRESSO DA MIGRAÇÃO: ele começa igual ao total e tem de andar para baixo.
-- Sai como referência, e não como erro, porque no dia 1 ele está CERTO alto.
UNION ALL
SELECT 701, 'chamados de campo ABERTOS com data e SEM bloco (a faixa "agendado sem horário" — a barra de progresso)',
       (SELECT count(*)::text FROM public.chamados c
         WHERE c.natureza='campo'
           AND c.status NOT IN ('concluido','cancelado')
           AND c.data_hora_agendada IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.agenda_campo a
                            WHERE a.chamado_id = c.id AND a.cancelado_em IS NULL)),
       '(referência)'

  ) t
 ORDER BY t.ordem;

-- ── 9.8 QUEM NÃO CASOU: o espelho × o bloco que manda ──────────────────────
-- TEM de vir vazia, e hoje vem por um motivo trivial: não há bloco nenhum. A
-- consulta fica no arquivo porque daqui a um mês divergir é NOTÍCIA — quer dizer
-- que alguém escreveu data_hora_agendada de um chamado de campo por fora do
-- satélite (as três telas antigas ainda sabem fazer isso; ver PENDENCIAS).
-- Os DOIS estágios, escritos aqui de novo e por extenso: um `ORDER BY
-- (cumprido_em IS NULL) DESC` pareceria equivalente e NÃO é — com todos os
-- blocos cumpridos ele devolveria o mais ANTIGO, e a função devolve o ÚLTIMO. A
-- conferência tem de calcular o que o gatilho calcula, ou ela inventa
-- divergência.
--
-- A SEGUNDA LISTA que existia aqui (bloco × escala da semana) FOI CORTADA: ela
-- comparava `dupla_da_pessoa(...) IS DISTINCT FROM a.dupla_id`, e
-- `dupla_da_pessoa` devolve NULL para quem não tem escala na semana — a lista
-- nascia misturando "sem escala" com "fora da equipe", que o gêmeo puro
-- (`divergenciaDeEquipe`) separa. Consulta de acompanhamento mora em
-- `docs/manual/`, não numa migration.
SELECT c.numero,
       c.data_hora_agendada AS espelho_gravado,
       e.quando             AS espelho_calculado,
       'espelho diverge do bloco que manda' AS problema
  FROM public.chamados c
  JOIN LATERAL (
    SELECT COALESCE(
      (SELECT (x.dia + make_interval(mins => x.inicio_min)) AT TIME ZONE 'America/Sao_Paulo'
         FROM public.agenda_campo x
        WHERE x.chamado_id = c.id AND x.cancelado_em IS NULL AND x.cumprido_em IS NULL
        ORDER BY x.dia, x.inicio_min, x.id LIMIT 1),
      (SELECT (x.dia + make_interval(mins => x.inicio_min)) AT TIME ZONE 'America/Sao_Paulo'
         FROM public.agenda_campo x
        WHERE x.chamado_id = c.id AND x.cancelado_em IS NULL
        ORDER BY x.dia DESC, x.inicio_min DESC, x.id DESC LIMIT 1)
    ) AS quando) e ON true
 WHERE c.natureza='campo'
   AND c.status NOT IN ('concluido','cancelado')
   AND e.quando IS NOT NULL
   AND c.data_hora_agendada IS DISTINCT FROM e.quando;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- DESFAZER — EM DOIS NÍVEIS, porque um só seria teatro
--
-- NÍVEL 1 devolve o COMPORTAMENTO de antes da U78 sem apagar NADA: as portas de
-- escrita são FECHADAS, os três gatilhos do espelho saem, e os dois corpos da
-- U76 voltam LITERAIS. Os blocos já digitados continuam na tabela, intactos e
-- sem ninguém lendo — dá para rodar no meio de um incêndio e rodar a U78 de
-- novo depois.
-- NÍVEL 2 apaga a tabela, e é o único passo irreversível do conjunto.
--
-- POR QUE O PASSO 1.0 (fechar as portas) VEM ANTES DE TUDO, e por que ele não
-- existia: o texto antigo prometia que, tirados os gatilhos,
-- `chamados.data_hora_agendada` "volta a ser escrita só pelos caminhos de
-- sempre". Isso é verdade HOJE, com a tela nova ainda não publicada, e é FALSO
-- no dia seguinte ao deploy dela: as quatro RPCs continuariam concedidas a
-- `authenticated`, a grade continuaria gravando bloco que não espelha mais, e
-- `agenda_campo_cancelar` continuaria virando `chamados.status` para 'aberto'
-- SEM mexer na data. O nível 1 fabricaria, em silêncio, exatamente a divergência
-- que ele existe para desfazer. Falhar alto ("função não existe") é melhor do
-- que divergir baixo. Se a tela ainda não foi publicada, o passo 1.0 é inócuo —
-- rode-o do mesmo jeito.
--
-- ATENÇÃO: o nível 1 NÃO devolve `data_hora_agendada` ao que era antes de a
-- U78 rodar — o espelho terá escrito valores verdadeiros no meio tempo, e
-- desfazê-los seria apagar informação melhor do que a que havia. Se a intenção
-- for reverter também os valores, a foto está no md5 da §0 (que não sobrevive ao
-- COMMIT) e no histórico do próprio Supabase, não aqui.
--
-- TUDO ABAIXO ESTÁ COMENTADO DE PROPÓSITO: um "rodar o arquivo inteiro" por
-- descuido não pode apagar a agenda.
-- ═══════════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ NÍVEL 1 — volta o comportamento antigo. NÃO apaga bloco nenhum.      ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- BEGIN;
--
-- -- 1.0 FECHE AS PORTAS PRIMEIRO. Sem isto a grade continua gravando blocos que
-- --     não espelham e agenda_campo_cancelar continua mexendo em status sem
-- --     mexer na data. (Inócuo se a tela nova ainda não estiver no ar.)
-- REVOKE EXECUTE ON FUNCTION public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.agenda_campo_cancelar(uuid)         FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.agenda_campo_cumprir(uuid, boolean) FROM authenticated;
-- REVOKE EXECUTE ON FUNCTION public.desagendar_chamado(uuid)            FROM authenticated;
--
-- -- 1.1 o espelho para de escrever. São estas três linhas que devolvem
-- --     chamados.data_hora_agendada aos escritores de sempre.
-- DROP TRIGGER IF EXISTS trg_agenda_campo_espelho_ins ON public.agenda_campo;
-- DROP TRIGGER IF EXISTS trg_agenda_campo_espelho_upd ON public.agenda_campo;
-- DROP TRIGGER IF EXISTS trg_agenda_campo_espelho_del ON public.agenda_campo;
--
-- -- 1.2 a guarda da U78 sai do GATILHO e o corpo da U76 volta LITERAL. Só faça
-- --     isto se o nível 1 for definitivo: com o espelho desligado a guarda é
-- --     inofensiva (ninguém escreve NULL de propósito), e mexer numa função viva
-- --     à toa é risco sem retorno.
-- CREATE OR REPLACE FUNCTION public.chamado_apoio_da_dupla()
-- RETURNS trigger
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $desfaz$
-- DECLARE
--   v_dia          date;
--   v_dia_antes    date;
--   v_mudou_dono   boolean;
--   v_mudou_semana boolean;
-- BEGIN
--   IF NEW.natureza IS DISTINCT FROM 'campo' THEN RETURN NEW; END IF;
--
--   IF TG_OP = 'INSERT' AND NEW.status IN ('concluido','cancelado') THEN
--     RETURN NEW;
--   END IF;
--
--   IF TG_OP = 'UPDATE' THEN
--     v_dia        := public.dia_da_dupla(NEW.data_hora_agendada, NEW.created_at);
--     v_dia_antes  := public.dia_da_dupla(OLD.data_hora_agendada, OLD.created_at);
--     v_mudou_dono := NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id;
--     v_mudou_semana := public.referencia_semanal(v_dia)
--                       IS DISTINCT FROM public.referencia_semanal(v_dia_antes);
--
--     IF NOT v_mudou_dono AND NOT v_mudou_semana
--        AND NEW.natureza IS NOT DISTINCT FROM OLD.natureza THEN
--       RETURN NEW;
--     END IF;
--
--     IF NEW.status IN ('concluido','cancelado') AND NOT v_mudou_dono THEN
--       RETURN NEW;
--     END IF;
--   END IF;
--
--   PERFORM public.chamado_sincronizar_apoio(NEW.id);
--   RETURN NEW;
-- END;
-- $desfaz$;
--
-- -- 1.3 a mesma coisa na RECONCILIAÇÃO: o filtro da U78 sai e o corpo da U76
-- --     volta LITERAL. Mesma ressalva do 1.2 — só se o nível 1 for definitivo.
-- CREATE OR REPLACE FUNCTION public.reconciliar_apoios_abertos(_desde_semana text DEFAULT NULL)
-- RETURNS integer
-- LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
-- AS $desfaz$
-- DECLARE r record; v_n int := 0;
-- BEGIN
--   IF auth.uid() IS NOT NULL AND NOT public.is_gestor(auth.uid()) THEN
--     RAISE EXCEPTION 'Só quem responde pela operação reconcilia apoio.'
--       USING ERRCODE = '42501';
--   END IF;
--
--   FOR r IN
--     SELECT c.id
--       FROM public.chamados c
--      WHERE c.natureza = 'campo'
--        AND c.status NOT IN ('concluido','cancelado')
--        AND (_desde_semana IS NULL
--             OR public.referencia_semanal(
--                  public.dia_da_dupla(c.data_hora_agendada, c.created_at)) >= _desde_semana)
--   LOOP
--     IF public.chamado_sincronizar_apoio(r.id) > 0 THEN v_n := v_n + 1; END IF;
--   END LOOP;
--
--   RETURN v_n;
-- END;
-- $desfaz$;
--
-- COMMIT;
--
-- Neste ponto o sistema se comporta como antes da U78, e a agenda continua lá.

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ NÍVEL 2 — APAGA A AGENDA. IRREVERSÍVEL. Só depois do nível 1.        ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- BEGIN;
--
-- -- 2.1 BACKUP PRIMEIRO. Não é sugestão. Cópia sem FK, sem RLS e sem gatilho:
-- --     é papel carbono, e é o que permite reconstruir.
-- CREATE TABLE IF NOT EXISTS public.zz_backup_agenda_campo_u78 AS
--   SELECT *, now() AS copiado_em FROM public.agenda_campo;
-- SELECT count(*) AS linhas_salvas FROM public.zz_backup_agenda_campo_u78;
--
-- -- 2.2 as funções saem antes da tabela (senão ficam quebradas e invisíveis)
-- DROP FUNCTION IF EXISTS public.desagendar_chamado(uuid);
-- DROP FUNCTION IF EXISTS public.agenda_campo_cumprir(uuid, boolean);
-- DROP FUNCTION IF EXISTS public.agenda_campo_cancelar(uuid);
-- DROP FUNCTION IF EXISTS public.agenda_campo_marcar(uuid,uuid,uuid,date,int,int,int,text,text);
-- DROP FUNCTION IF EXISTS public.agenda_campo_frase_do_conflito(uuid,uuid,date,int,int);
-- DROP FUNCTION IF EXISTS public.agenda_campo_espelhar(uuid);
-- DROP FUNCTION IF EXISTS public.agenda_campo_espelho() CASCADE;
-- DROP FUNCTION IF EXISTS public.agenda_campo_valida() CASCADE;
--
-- -- 2.3 a tabela
-- DROP TABLE IF EXISTS public.agenda_campo;
--
-- COMMIT;
--
-- -- 2.4 `duracao_texto` FICA, e de propósito: ela não sabe nada sobre agenda —
-- --     é um formatador de minutos, e a tela e outras funções podem tê-la
-- --     adotado. Apagá-la seria derrubar quem não tem culpa.
-- -- 2.5 btree_gist fica. Extensão não custa nada parada, e apagá-la derrubaria
-- --     qualquer EXCLUDE futuro sem aviso.

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ O ENSAIO À MÃO — rode assim que a migration passar                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- POR QUE ELE EXISTE: o corpo de uma função plpgsql só tem as consultas dele
-- ANALISADAS na primeira execução de verdade. `CREATE FUNCTION` confere a
-- sintaxe do plpgsql e NÃO confere nome de coluna dentro dos SELECTs — então um
-- erro de digitação em `agenda_campo_marcar` (a função mais longa e mais
-- reescrita deste arquivo) só apareceria na primeira vez que a tela a chamasse.
-- A conferência do §9 executa as três funções que não escrevem; esta é a que
-- escreve, e por isso ela mora aqui.
--
-- NADA FICA GRAVADO: o bloco termina com um RAISE EXCEPTION de propósito. Um DO
-- de primeiro nível é a sua própria transação, então a exceção desfaz tudo o que
-- ele fez — e, de quebra, é assim que a mensagem aparece no editor do Supabase,
-- onde RAISE NOTICE é invisível. Ver "ENSAIO OK" no vermelho é o resultado bom.
--
-- Descomente (tire o "-- " de cada linha) e rode:
--
-- DO $ensaio$
-- DECLARE
--   v_dupla uuid; v_b1 uuid; v_erro text; v_log text := '';
-- BEGIN
--   SELECT d.id INTO v_dupla FROM public.duplas d ORDER BY d.id LIMIT 1;
--   IF v_dupla IS NULL THEN
--     RAISE EXCEPTION 'Não há equipe de campo cadastrada — não dá para ensaiar. Cadastre uma e volte.';
--   END IF;
--
--   -- (1) criar um bloco sem chamado, num dia que a operação nunca vai usar
--   v_b1 := public.agenda_campo_marcar(NULL, NULL, v_dupla, DATE '1900-01-02',
--                                      600, 60, 30, 'ENSAIO-U78', 'ENSAIO U78 — apagar');
--   v_log := v_log || E'\n(1) criou o bloco ' || v_b1;
--
--   -- (2) MOVER sem repassar o título NÃO pode apagar o título: é o PATCH
--   PERFORM public.agenda_campo_marcar(v_b1, NULL, v_dupla, DATE '1900-01-02', 780, 60, 30);
--   IF (SELECT titulo_externo FROM public.agenda_campo WHERE id = v_b1) IS NULL THEN
--     RAISE EXCEPTION 'ENSAIO FALHOU: mover o bloco apagou o titulo_externo — o COALESCE do §6.1 não está valendo.';
--   END IF;
--   v_log := v_log || E'\n(2) mover sem repassar o título preservou o título — ok';
--
--   -- (3) o CONFLITO tem de vir em português e NOMEAR o outro atendimento
--   BEGIN
--     PERFORM public.agenda_campo_marcar(NULL, NULL, v_dupla, DATE '1900-01-02',
--                                        800, 60, 0, NULL, 'ENSAIO U78 — colide');
--     RAISE EXCEPTION 'ENSAIO FALHOU: dois blocos da mesma equipe se cruzaram sem recusa.';
--   EXCEPTION WHEN exclusion_violation THEN
--     GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
--     v_log := v_log || E'\n(3) conflito recusado: ' || v_erro;
--   END;
--
--   -- (4) a FÍSICA em português (e o duracao_texto dentro da frase)
--   BEGIN
--     PERFORM public.agenda_campo_marcar(NULL, NULL, v_dupla, DATE '1900-01-03',
--                                        1380, 120, 0, NULL, 'ENSAIO U78 — meia-noite');
--     RAISE EXCEPTION 'ENSAIO FALHOU: aceitou um bloco que passa da meia-noite.';
--   EXCEPTION WHEN sqlstate '55000' THEN
--     GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
--     v_log := v_log || E'\n(4) meia-noite recusada: ' || v_erro;
--   END;
--
--   -- (5) bloco sem chamado e sem título não nasce
--   BEGIN
--     PERFORM public.agenda_campo_marcar(NULL, NULL, v_dupla, DATE '1900-01-03',
--                                        600, 60, 0, NULL, NULL);
--     RAISE EXCEPTION 'ENSAIO FALHOU: nasceu um bloco anônimo.';
--   EXCEPTION WHEN sqlstate '55000' THEN
--     GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
--     v_log := v_log || E'\n(5) bloco sem título recusado: ' || v_erro;
--   END;
--
--   -- (6) cumprir, e então cancelar tem de RECUSAR (registro não se desmarca)
--   PERFORM public.agenda_campo_cumprir(v_b1, true);
--   BEGIN
--     PERFORM public.agenda_campo_cancelar(v_b1);
--     RAISE EXCEPTION 'ENSAIO FALHOU: desmarcou um bloco já cumprido.';
--   EXCEPTION WHEN sqlstate '55000' THEN
--     GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
--     v_log := v_log || E'\n(6) cancelar bloco cumprido recusado: ' || v_erro;
--   END;
--
--   -- (7) tirado o "feito", cancelar volta a funcionar
--   PERFORM public.agenda_campo_cumprir(v_b1, false);
--   IF NOT public.agenda_campo_cancelar(v_b1) THEN
--     RAISE EXCEPTION 'ENSAIO FALHOU: agenda_campo_cancelar devolveu false para um bloco que existe.';
--   END IF;
--   v_log := v_log || E'\n(7) tirado o feito, o bloco foi desmarcado — ok';
--
--   RAISE EXCEPTION E'ENSAIO OK — as sete etapas passaram. Esta exceção é DE PROPÓSITO: ela desfaz tudo o que o ensaio criou e é o único jeito de a mensagem aparecer no editor.%', v_log;
-- END
-- $ensaio$;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ SE O PRÉ-VOO DO §1.1 ABORTAR (btree_gist não nasce)                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- A regra de sobreposição teria de virar plpgsql, e ISSO É PIOR — o arquivo diz
-- por quê em vez de fingir equivalência: gatilho tem early-return, tem
-- search_path, some com `ALTER TABLE ... DISABLE TRIGGER` numa carga, e NÃO é
-- atômico contra duas gravações simultâneas (duas transações concorrentes podem
-- cada uma não ver a outra e gravar blocos que se cruzam). É por isso que o
-- `CREATE EXTENSION btree_gist` do §1.1 existe e é por isso que ele ABORTA em vez
-- de cair para o plano B sozinho.
--
-- O CÓDIGO DO PLANO B FOI REMOVIDO DESTE RODAPÉ, de propósito: ninguém cola
-- vinte linhas de plpgsql comentado às 23h no meio de um aborto — pergunta. Se o
-- pré-voo abortar, a saída é o que a mensagem dele manda (pedir a extensão ao
-- suporte do Supabase) e, se ela for mesmo impossível nesta instância, uma
-- conversa com o Davi sobre trocar ESTRUTURA por promessa. O que se perde nessa
-- troca está escrito no parágrafo acima.
-- ═══════════════════════════════════════════════════════════════════════════
