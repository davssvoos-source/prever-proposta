-- ═══════════════════════════════════════════════════════════════════════════
-- MEDIR ANTES DA CARGA — os números que decidem a carga retroativa da U82
--
-- >>> ISTO NÃO É UMA MIGRATION. NÃO ESCREVE NADA. São seis SELECTs, e só.   <<<
-- >>> Não tem BEGIN, não tem COMMIT, não tem UPDATE, não tem INSERT, não    <<<
-- >>> tem DELETE, não tem ALTER. Rode no SQL Editor a qualquer hora.        <<<
--
-- POR QUE ELE EXISTE. A U82 foi entregue como CAMINHO VIVO apenas: a porta
-- (agenda_campo_afirmar) e o soltador (trg_chamado_agenda_solta). A CARGA
-- RETROATIVA — afirmar o passado dos chamados já concluídos com laudo, soltar o
-- plano dos encerrados, destravar os blocos presos — foi CORTADA da U82 e vira
-- entrega separada.
--
-- O MOTIVO DO CORTE É ESTE ARQUIVO. Escrever uma carga contra as duas tabelas
-- mais quentes do sistema (public.chamados e public.chamado_apoios) sem saber
-- quantas linhas ela alcança é escrever às cegas — e a carga é onde moram todos
-- os defeitos que três rodadas de refutação acharam na U82. Medir antes de
-- escrever é o método da casa. Estes números dimensionam:
--   · se a carga vale a pena (linha 1 e 2 pequenas ⇒ o chip resolve à mão);
--   · quanto tempo ela segura lock (linha 3 e 4);
--   · se ela chega perto de chamado_apoios (linha 4 — se der 0, nenhuma linha
--     de apoio é tocada por caminho nenhum, e a carga fica MUITO mais barata);
--   · quanto o corte de evidência e o corte de atribuição deixam de fora
--     (linhas 5 e 6), que é o que decide se uma segunda passada à mão vale.
--
-- A CARGA NÃO SERÁ ESCRITA SEM ESTES NÚMEROS. Está declarado em
-- docs/PENDENCIAS_TECNICAS.md, na dívida "carga retroativa da U82, adiada".
--
-- E UMA RECUSA QUE JÁ ESTÁ TOMADA, para que a carga futura não a re-litigue:
-- `ALTER TABLE ... DISABLE TRIGGER` NÃO VOLTA. A U81 declarou por escrito que
-- gatilho desligado que alguém esquece de religar é cicatriz da casa (U59/U61),
-- e a lente de produção mostrou que pedir ShareRowExclusive em public.chamados
-- no meio de uma carga que já segura RowExclusive é ESCALADA DE LOCK — risco de
-- deadlock, com toda escrita de chamado do app pendurada atrás. Se a carga
-- futura precisar impedir uma cascata, ela impede pelo PREDICADO, não desligando
-- gatilho.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT '1. AFIRMAR: chamado concluído COM laudo, UM pendente e NENHUM bloco já cumprido (congela apoio — é a parte que só o DESFAZER solta)' AS medida,
       count(*) AS linhas
  FROM public.agenda_campo a
  JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.natureza = 'campo' AND c.status = 'concluido'
   AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND btrim(COALESCE(c.diagnostico, '')) <> ''
   AND btrim(COALESCE(c.servico_executado, '')) <> ''
   AND a.dia <= (COALESCE(c.finalizada_em, c.concluida_em, c.fechada_em)
                   AT TIME ZONE 'America/Sao_Paulo')::date
   AND (SELECT count(*) FROM public.agenda_campo b
         WHERE b.chamado_id = a.chamado_id
           AND b.cancelado_em IS NULL AND b.cumprido_em IS NULL) = 1
   -- O SEGUNDO CORTE DE ATRIBUIÇÃO, e sem ele o primeiro não fecha nada.
   -- "Há um único pendente?" não é a pergunta certa; a certa é "o laudo ainda
   -- não tem dono?". Ida carimbada à mão pela grade + retorno pendente dá UM
   -- pendente, e afirmar o retorno é promover "provavelmente" a "aconteceu" —
   -- em massa, e CONGELANDO (acesso permanente de edição, R108).
   AND NOT EXISTS (SELECT 1 FROM public.agenda_campo b
                    WHERE b.chamado_id = a.chamado_id
                      AND b.cancelado_em IS NULL
                      AND b.cumprido_em IS NOT NULL)
UNION ALL
SELECT '2. SOLTAR: plano pendente em chamado já encerrado (reversível por agenda_campo_marcar)', count(*)
  FROM public.agenda_campo a
  JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.natureza = 'campo'
   AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND ( c.status = 'cancelado'
      OR (c.status = 'concluido'
          AND a.dia > (now() AT TIME ZONE 'America/Sao_Paulo')::date))
UNION ALL
SELECT '3. DESTRAVAR: blocos PRESOS (cumpridos num dia POSTERIOR ao carimbo) — é a gêmea da conferência 127 da U82', count(*)
  FROM public.agenda_campo a
 WHERE a.cumprido_em IS NOT NULL AND a.cancelado_em IS NULL
   AND a.dia > (a.cumprido_em AT TIME ZONE 'America/Sao_Paulo')::date
UNION ALL
SELECT '4. DESTES, os de chamado ABERTO — SÓ ESTES acionam a cascata do apoio. SE DER 0, a carga não chega perto de chamado_apoios por caminho nenhum', count(*)
  FROM public.agenda_campo a
  JOIN public.chamados c ON c.id = a.chamado_id
 WHERE a.cumprido_em IS NOT NULL AND a.cancelado_em IS NULL
   AND a.dia > (a.cumprido_em AT TIME ZONE 'America/Sao_Paulo')::date
   AND c.natureza = 'campo' AND c.status NOT IN ('concluido', 'cancelado')
UNION ALL
SELECT '5. FORA pelo CORTE DE EVIDÊNCIA: chamado concluído SEM diagnóstico ou SEM serviço executado (a assinatura do arrasto no quadro — ali "concluído" é arrumação de kanban, não afirmação sobre um prédio)', count(*)
  FROM public.agenda_campo a
  JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.natureza = 'campo' AND c.status = 'concluido'
   AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND (btrim(COALESCE(c.diagnostico, '')) = ''
     OR btrim(COALESCE(c.servico_executado, '')) = '')
UNION ALL
SELECT '6. FORA pelo CORTE DE ATRIBUIÇÃO: chamado concluído COM laudo e MAIS DE UM pendente — o laudo não diz QUAL aconteceu, e estes são a fila do CHIP e não da carga', count(*)
  FROM public.agenda_campo a
  JOIN public.chamados c ON c.id = a.chamado_id
 WHERE c.natureza = 'campo' AND c.status = 'concluido'
   AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND btrim(COALESCE(c.diagnostico, '')) <> ''
   AND btrim(COALESCE(c.servico_executado, '')) <> ''
   AND (SELECT count(*) FROM public.agenda_campo b
         WHERE b.chamado_id = a.chamado_id
           AND b.cancelado_em IS NULL AND b.cumprido_em IS NULL) > 1;
