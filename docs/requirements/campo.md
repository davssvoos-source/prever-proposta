# Campo — Requisitos

Identificador do módulo: `campo`.

Propósito: O trabalho da equipe técnica de campo: agenda por blocos, programação, equipes e escala,
retorno, plantão, viaturas e o app do técnico.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- O sistema DEVE tratar a atividade em campo como BLOCO DE AGENDA da equipe, numa jornada de 9 horas
  com a primeira reservada (R99, R100), programada por equipe e janela (R102).
- O chamado de campo NÃO DEVE ter prazo: a data agendada orienta, e a duração estimada entra ao
  abrir (R284, R287).
- QUANDO um técnico finaliza um chamado, o sistema DEVE criar a atividade de validação do gestor
  (R130, R155); a vistoria É a validação e vira atividade interna do gestor (R156, R283).
- O retorno DEVE ser a MESMA atividade, com o número de idas na etiqueta (R286).
- ENQUANTO houver escala de sobreaviso, ela DEVE ser montada por SEMANA, só com o cargo TÉCNICO
  (R253, R265), e a troca de plantonista DEVE ser atômica (RPC).
- A viatura DEVE mapear QUEM, QUANDO e ONDE por trecho, via etiqueta NFC, sem quilometragem (R266,
  R267, R276).
- O técnico DEVE ver, no celular, três telas — e toda atividade de campo da equipe (R263, R264).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/campo.md`.

| Regra | Essência |
|---|---|
| R5 | Chamado de campo tem o tipo operacional (ex.: entrega de controle remoto), além de corretiva, preventiva e … |
| R7 | O perfil do técnico tem 3 abas: Home (cards das visitas e chamados dele), Agenda e Perfil |
| R11 | o contador do topo soma tudo que é dele com data para hoje (visitas agendadas, chamados agendados, o que es… |
| R12 | no perfil do técnico, a visita técnica para proposta comercial é tratada como um chamado (mesmo card, mesma… |
| R14 | Nas duplas de campo, só o líder tem conta no app; o ajudante não |
| R56 | Duplas de campo |
| R57 | A tela de agendamento técnico agora se chama "Programação da equipe técnica de campo" e ganhou: - um "+" qu… |
| R70 | As 227 OS de manutenção fechadas entraram no sistema |
| R72 | A importação retroativa (R70) ganhou os marcos de campo |
| R75 | O apoio do chamado é preenchido pela dupla do responsável |
| R96 | A equipe de campo tem escala POR SEMANA |
| R97 | A equipe de campo tem veículo |
| R98 | O cadastro de equipe e a escala da semana são duas telas na mesma janela |
| R99 | A atividade em campo é um BLOCO DE AGENDA, não o chamado |
| R100 | A jornada é de 9 horas, e a primeira delas é reservada: sobram 8 horas de campo |
| R101 | `chamados.data_hora_agendada` deixou de ser digitada e virou ESPELHO do bloco |
| R102 | Programar é sobre a EQUIPE e a JANELA. O responsável se troca no chamado |
| R105 | A programação de um dia se compartilha em texto, e o texto esconde o que a tela esconde |
| R106 | O atendimento que teve a visita, continua aberto e não tem nada marcado à frente tem seção própria: "Retorn… |
| R107 | Marcar a visita como feita NÃO apaga mais o registro de quem a fez |
| R108 | Quem foi a um atendimento que já aconteceu continua com acesso a ele, mesmo depois de o responsável mudar |
| R109 | Quem afirma que uma visita aconteceu é gente, e afirma antes de o atendimento fechar |
| R110 | Afirmar traz o atendimento para o dia em que a afirmação acontece — e só quando o dia marcado ainda não chegou |
| R111 | Um atendimento encerrado não deixa plano pendente: o que ainda não aconteceu é desmarcado pela máquina, e a… |
| R112 | A vistoria é um tipo de chamado de campo, e ela se chama "Vistoria" — nunca "visita técnica" |
| R116 | O sobreaviso é uma grade pessoa × dias do mês, com horas por célula, e o botão que a preenche nunca é silen… |
| R117 | O atendimento de plantão é um REGISTRO próprio: hora, quem atendeu, cliente, remoto ou presencial, o que fo… |
| R120 | A implantação tem PERÍODO, e o prazo dela é o fim previsto — não o SLA de 72 horas |
| R122 | O plantão tem painel, e ele fica ao lado da escala |
| R127 | O técnico de campo tem TRÊS atividades, cada uma com fluxo próprio: manutenção corretiva, manutenção preven… |
| R130 | Quando um técnico finaliza um chamado, nasce uma atividade de VALIDAÇÃO para o gestor da equipe técnica, na… |
| R134 | Quem usa o sistema em que aparelho — e a Início do técnico é outra |
| R148 | A Implantação tem o campo "Proposta comercial aprovada" |
| R155 | A validação do executado é uma ATIVIDADE do gestor da equipe técnica, com card na Início dele — e a propost… |
| R156 | A vistoria É a validação; e a área técnica tem três tipos de demanda: corretiva, preventiva e implantação —… |
| R162 | O técnico dá baixa; o gestor valida — são dois estados |
| R163 | O técnico de campo não abre chamado sozinho — por enquanto |
| R165 | A tela "Histórico" saiu |
| R172 | A visita comercial TRAVA o horário do técnico na programação semanal |
| R247 | A tela do chamado de campo tem layout de desktop |
| R253 | O Sobreaviso é montado por SEMANA, e a tela alterna semana × mês |
| R254 | O Sobreaviso, revisado por inteiro: a barra no calendário, a troca que não acumula, e só a equipe técnica |
| R256 | As setinhas do campo de horas só existem no dia em que se clicou |
| R263 | O app do técnico de campo: três telas, e a Início é dele |
| R265 | Sobreaviso é do cargo TÉCNICO |
| R266 | O controle das viaturas: quem usou qual carro, em que dia |
| R267 | A viagem é um TRECHO |
| R268 | (revogada) O km é digitado nas duas pontas; o rodado é calculado; km fora de ordem passa com aviso, não bloqueia |
| R269 | A tela decide o estado — e "assumir" resolve o colega que esqueceu |
| R270 | A atividade é opcional na saída, e ela dá o destino |
| R271 | As viaturas se cadastram e se removem no Painel Administrativo, na aba Viaturas |
| R272 | A folha do gestor mora na mesma aba, e conta o tempo de deslocamento |
| R273 | A chegada por localização SUGERE encerrar — nunca encerra sozinha (etapa 3) |
| R274 | A chegada por localização olha TODAS as atividades do dia — e a sede |
| R276 | O km saiu: a viatura mapeia QUEM, QUANDO e ONDE — nada de odômetro |
| R283 | A vistoria sai do campo e vira atividade interna do gestor |
| R284 | O chamado de campo não tem prazo: quem orienta a data agendada é a PRIORIDADE |
| R285 | A composição da equipe vale do MOMENTO da troca em diante |
| R286 | O retorno é a MESMA atividade, com o número de idas na etiqueta |
| R287 | A duração estimada é inserida ao ABRIR o chamado |
| R288 | Técnico indisponível RECUSA o agendamento, e o deslocamento ocupa a agenda |
| R292 | A preventiva de campo é UMA atividade com o roteiro de TODOS os blocos |
| R297 | Na abertura do chamado técnico pergunta-se QUEM, não QUAL EQUIPE — e o apoio vem da LIDERANÇA |
| R313 | A manutenção corretiva de campo: os campos, e quem preenche cada um |
| R314 | Equipamento na tela: só Tipo de Categoria, Modelo e Marca — a estrutura do QAP |
| R315 | A manutenção preventiva de campo tem um checklist POR BLOCO, e cada tipo de bloco tem o seu |
| R316 | A implantação: observação, o bloco a instalar, os equipamentos sem bloco movidos para ele, a foto da instalação — um bloco por atividade, quantas atividades o bloco pedir |

## Fora de escopo

- Cobrança e conferência do atendimento: módulo `financeiro` (R104, R121).
- Quilometragem das viaturas é do QAP ERP (R276) — não volta ao app.
- O técnico de campo não abre chamado sozinho (R163) — por enquanto, e por decisão do Davi.

## Referências

- Contexto ditado: `../CONTEXTO_OPERACAO_TECNICA.md`, `../CONTEXTO_VIATURAS.md`.
- Manual: `../manual/operacao-campo.md`.
- ADRs: ADR-0002.
- Estado da implementação: `../state/campo.md`.
