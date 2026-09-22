# Atividades — Requisitos

Identificador do módulo: `atividades`.

Propósito: A atividade (chamado) como unidade única de trabalho: naturezas, tipos, estrutura,
criação, registro e chat.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- O sistema DEVE tratar chamado e demanda como um registro só, `chamados`, com natureza campo ou
  interna (R16, R24).
- QUANDO alguém cria uma atividade, o sistema DEVE começar por duas perguntas — tipo de demanda e
  natureza — e derivar equipe e campos do tipo (R138, R139, R137).
- ENQUANTO a atividade é interna, a tela DEVE abrir o editor de uma área com blocos e chips,
  checklist que conta o progresso em rosca (R224, R235, R281); ENQUANTO é de campo, o layout DEVE
  seguir a natureza, nunca o cargo.
- O sistema DEVE gravar recebimento, início e conclusão de toda atividade (R144) e permitir corrigir
  a conclusão com a correção visível (R262).
- O chat da Início DEVE ser uma conversa: menção vira comentário, `#Código` arma a resposta, nenhuma
  mensagem se perde (R215, R216, R223, R245).
- SE a atividade é corretiva, ENTÃO o registro DEVE ter dois textos — problema e solução (R282,
  R213).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/atividades.md`.

| Regra | Essência |
|---|---|
| R9 | Chamados entram por todos os lados no SAC e podem ser: técnicos (campo), para o T.I, pedido de compra para … |
| R16 | Chamado e demanda são a mesma coisa: chamado |
| R19 | "Executado" e "concluído" são a mesma coisa |
| R24 | O chamado tem quatro fluxos, e os tipos existentes continuam |
| R25 | O chamado entra por três portas |
| R30 | O WhatsApp identifica o remetente pelo NOME DO CONTATO |
| R33 | O chamado abre num PAINEL, não em outra página |
| R40 | O SPRINT SAI DO PRAZO |
| R47 | O painel de propriedades do chamado (R33) foi reorganizado: De quem é (Cliente, Responsável e Apoio na mesm… |
| R48 | O vocabulário definitivo de tipos de chamado |
| R49 | Manutenção Corretiva e Manutenção Preventiva vão ganhar fluxo próprio |
| R50 | Na Descrição do chamado, os itens de checklist (`- [ ] item`, escritos pela barra de ferramentas do R47) ap… |
| R53 | 2ª revisão da Descrição do chamado no painel ("a caixa de descrição não me agradou"), substituindo parte do… |
| R54 | Uma atividade pode ser de mais de um cliente |
| R80 | A abertura rápida por I.A. atribui gente |
| R82 | A I.A. escolhe a equipe pelo assunto |
| R83 | Mais de uma equipe por atividade |
| R84 | É LOCAL, não "cliente" — e o local pode não ser cliente |
| R85 | Locais sem limite, e atalho por setor |
| R86 | O local nunca fica no título |
| R90 | Tudo salva sozinho |
| R113 | Quando o sistema adivinha o tipo, a tela e o registro dizem a mesma coisa |
| R135 | A tela da atividade, no computador: cada propriedade é UM seletor que abre a lista; o texto é a maior caixa… |
| R137 | Fora da área técnica, uma atividade é de um de SEIS tipos de demanda, e cada tipo tem os seus campos |
| R138 | A criação começa com DUAS perguntas — qual o tipo de demanda e quem é o responsável — e são elas que decide… |
| R139 | Equipe não é campo: as equipes de uma atividade são as das PESSOAS nela |
| R140 | O pedido de compra saiu do sistema |
| R141 | Sprint deixou de ser campo |
| R142 | Impacto operacional é a régua de urgência fora da área técnica: Sem impacto · Baixo · Moderado · Crítico |
| R143 | O Cliente de uma atividade é um cliente, um GRUPO de clientes ou interno (Prever) |
| R144 | Toda atividade mapeia recebimento, início e conclusão |
| R149 | A Manutenção Corretiva tem dois textos: o problema detectado e a solução aplicada |
| R150 | Toda atividade interna aceita fotos de registro e arquivos |
| R151 | Uma atividade pode ter mais de um cliente — e isso se faz no pop-up de criação e na página, não só no paine… |
| R168 | A atividade interna tem DATA AGENDADA, além do prazo — e o quadro ganha a coluna "Agendados" |
| R169 | A Manutenção Preventiva TEM impacto operacional |
| R171 | A tabela do pedido de compra é apagada |
| R183 | O Configurador rápido concentra TODA a informação da atividade no cabeçalho, em botões discretos e pequenos |
| R184 | A área principal do painel é o REGISTRO do trabalho: PROBLEMA e DIAGNÓSTICO, com a barra de progresso 1→2 |
| R185 | Abaixo do registro vêm os comentários e, por último, a linha do tempo |
| R213 | Problema e Diagnóstico, com a barra 1→2, são só da manutenção CORRETIVA |
| R215 | A Início tem um CHAT DE MENÇÕES: um botão circular fixo no canto inferior direito abre a lista de tudo em q… |
| R216 | "Responder aqui", no chat, vira um COMENTÁRIO na atividade, mencionando quem mencionou |
| R217 | Comentário aceita REAÇÃO (emoji) — no chat e na própria atividade, e é a mesma reação |
| R222 | O chat da Início é uma conversa de celular |
| R223 | Recado para todos, e a resposta vai pelo #Código |
| R224 | O editor de texto é uma área só, com blocos e chips |
| R225 | Toda atividade pode ser agendada — e a agendada não tem prazo |
| R226 | Equipamentos removidos e instalados pela atividade — só com cliente único |
| R228 | A tela da atividade ocupa a largura do desktop |
| R231 | A tela de abrir chamado não oferece mais o plantão |
| R232 | Prazo e dia agendado são um OU outro, num controle só |
| R234 | A tela da atividade é um posto de trabalho de desktop |
| R235 | O progresso da atividade é uma rosca de 0% a 100%, contada pelo checklist |
| R236 | Os equipamentos da atividade se movem por arrasto |
| R238 | O pop-up da Início mostra a mesma tela da atividade |
| R240 | No chat, o título mora dentro do campo colorido, e a resposta enviada fica no chat — junto da mensagem que … |
| R243 | A tela da atividade fala menos e mostra maior |
| R245 | O chat não perde mensagem, e a caixa dele funciona |
| R249 | Responder põe o cursor na caixa |
| R255 | Quem não edita a atividade pode, ainda assim, dizer que trabalhou nela |
| R258 | A caixa do chat: o convite na linha certa, e o cursor já nela |
| R262 | A data de conclusão é corrigível à mão, e a correção fica na linha do tempo |
| R281 | O item de checklist vale a própria caixa, e nada além dela |
| R282 | A corretiva tem DOIS textos: o problema e a solução |

## Fora de escopo

- Agenda, programação e execução em campo: módulo `campo`.
- Pedido de compra e sprint saíram do sistema (R140, R141, R171) — não voltam por atalho.
- Atividade mista campo + operacional: não é montável hoje; decisão D2 em `../DECISOES_PENDENTES.md`.

## Referências

- Contexto ditado: `../CONTEXTO_ESTRUTURA_ATIVIDADES.md` (os sete tipos, a matriz de campos).
- ADRs: ADR-0002 (o catálogo é a fonte).
- Manual: `../manual/visao-geral.md`, `../manual/operacao-campo.md`.
- Estado da implementação: `../state/atividades.md`.
