# Painéis — Requisitos

Identificador do módulo: `paineis`.

Propósito: As mesas de trabalho: Início, Calendário, Operacional Técnica, Gestão Técnica e os
indicadores.

## Síntese (EARS)

<!-- A síntese é a leitura executiva do módulo; a autoridade é a regra citada, em ../PRODUTO.md. -->

- A Início DEVE mostrar TODAS as atividades que envolvem a pessoa, em quadro e em lista, com o
  concluído em ordem fixa (R17, R36, R246) e "A seguir" como primeiro card da coluna Agendado
  (R248).
- O número num KPI e a lista que o clique abre DEVEM sair da MESMA função pura ("quem conta é quem
  filtra", R65).
- A Operacional Técnica DEVE ser a fila de TODOS os chamados da equipe, em quadro por estado e por
  dia (R124, R295, R301), com a barra da Início (R296).
- A Gestão Técnica DEVE ser a mesa do Vinicius: o que ele olha todo dia no topo, fila de decisão,
  plantão (R299, R300).
- O Calendário DEVE mostrar toda atividade com data, em visão mensal e semanal, pintada pela cor do
  status (R34, R46, R133, R187), sem botão "Hoje" (R191).
- O quadro DEVE aceitar arrasto de card para coluna inteira, gravando o status (R89, R233).

## As regras que governam o módulo

As regras são ditadas pelo Davi e vivem em `../PRODUTO.md` — o catálogo, com `R#` único no sistema
(ADR-0001, ADR-0002). Esta tabela é a VISTA do módulo: número e essência, extraída do catálogo.
Fora deste arquivo, cite `produto:R#` ou simplesmente `R#`. Regra nova entra no catálogo primeiro e
depois nesta tabela; a cobertura de cada uma está em `../state/paineis.md`.

| Regra | Essência |
|---|---|
| R8 | O SAC tem 3 abas de trabalho: Painel (dashboards com filtros por técnico/tipo/cliente e gráfico de manutenç… |
| R17 | A Início mostra TODAS as atividades que envolvem a pessoa |
| R20 | O quadro é a fila de trabalho, não o espelho do vocabulário |
| R26 | O calendário do SAC e dos gestores mostra tudo de todos |
| R27 | "Gerencial" vira três painéis |
| R31 | A lista `/chamados` MORREU |
| R34 | O calendário mostra TODA atividade com data, não só a agendada |
| R35 | O painel do topo da Início responde aos MESMOS filtros do quadro |
| R36 | A visão de lista da Início é uma TABELA |
| R37 | No calendário, a célula do dia mostra só o TÍTULO e o rosto de quem toca |
| R42 | Botão "Ordenar" na Início |
| R43 | A tabela da Início ocupa a tela inteira (mesma sangria do quadro) |
| R44 | Os filtros do Calendário usam o mesmo componente de filtro do resto do app (`MenuFiltro`), não `<select>` n… |
| R46 | O calendário pinta cada atividade pela regra de cor do R45, com duas exceções que vencem o status: atrasado… |
| R58 | No Painel Operacional: - os 4 atalhos "Ir para" (Calendário, Programação, Painel de chamados, Clientes) saí… |
| R60 | Revisão da barra de filtros e dos indicadores da Início: - O botão de busca, no desktop, não fazia nada vis… |
| R65 | O dashboard da Início é 100% dinâmico, e sua estrutura virou documento |
| R66 | O Painel Operacional virou um dashboard de verdade, seguindo a receita do `docs/DASHBOARD.md` (R65) |
| R67 | O Painel Operacional tem duas partes, e só duas: o dashboard inteiro em cima, a lista no resto da tela |
| R68 | Três acertos no Painel Operacional |
| R69 | "Abertos por cliente" ocupa as duas linhas do dashboard |
| R73 | A lista do Painel Operacional ganhou três lentes: Em aberto (o padrão), Concluídos e Todos, cada uma com a … |
| R76 | O Painel Operacional ganhou modo Quadro (kanban) para os chamados da área técnica, ao lado do modo Lista |
| R88 | Ordenar com direção |
| R89 | Arrastar o card grava o status, e o card anda junto |
| R91 | Botão "+" na Início, ao lado do alternador quadro/lista |
| R93 | O calendário filtra por setor e por tipo de demanda |
| R94 | O seletor "Padrão" saiu da Início |
| R95 | A aba "Operacional" virou "Operacional Técnica" |
| R115 | Feriado e ponto facultativo não são a mesma coisa, e o calendário guarda os dois separados |
| R123 | A fila em aberto tem dois cortes, e o histórico do cliente inclui o plantão |
| R124 | A Operacional Técnica centraliza os trabalhos dos técnicos DE CAMPO da EQUIPE TÉCNICA — e só deles |
| R125 | O dashboard da Operacional Técnica responde às três perguntas do Vinicius: o que cada equipe faz, como está… |
| R126 | A Operacional Técnica tem um botão "+", e ele abre um chamado técnico sem sair da tela |
| R133 | O Calendário tem duas visões, Mensal e Semanal, e a escolha fica |
| R145 | No calendário, a atividade concluída fica no dia da CONCLUSÃO; a em aberto fica na hora agendada quando há,… |
| R152 | Arrastar a atividade no calendário para outro dia muda o prazo |
| R153 | O card da semana no calendário tem quatro coisas, e só |
| R175 | O painel de cima da Início recolhe, e a escolha fica |
| R178 | A Início começa mais perto do topo |
| R179 | As colunas do quadro dividem a largura da tela |
| R180 | A atividade concluída fica na Início enquanto nenhum filtro a excluir |
| R181 | A ordem das colunas do quadro é de quem olha: segurar o cabeçalho e arrastar reordena, e fica salvo naquele… |
| R182 | A ordenação em vigor fica escrita ao lado do botão de ordenar |
| R187 | No calendário, o fundo do card é a cor do status, esmaecida |
| R188 | No calendário, os rostos vão sem contorno |
| R189 | Na mensal, os meses seguintes aparecem embaixo conforme se rola — até três além do escolhido |
| R190 | Passar o mouse (ou focar) numa atividade da mensal expande uma dica com Título, Cliente/Local, Tipo de dema… |
| R191 | O calendário não tem botão "Hoje" |
| R227 | As etiquetas do card ficam empilhadas: Cliente → Tipo de demanda → Risco Operacional |
| R233 | No quadro, a coluna inteira é alvo do arrasto |
| R246 | A Início mostra tudo, inclusive o concluído — e a coluna Concluído tem ordem própria |
| R248 | "A seguir" é o primeiro card da coluna Agendado |
| R250 | A busca da Início acha pelo nome do prédio |
| R251 | Filtro por Tipo de Demanda na Início |
| R257 | No card da Início, o prazo é o ícone e o número |
| R261 | A Demanda no tempo conta a semana inteira: o que foi concluído nela e o que vence nela |
| R289 | O mapa de calor é por EQUIPE; por TÉCNICO, só quem não está em equipe |
| R295 | O quadro do Painel Operacional separa as colunas por ESTADO, STATUS, EQUIPE ou DIA DA SEMANA — e o card diz… |
| R296 | A barra do Painel Operacional é a barra da Início: os indicadores recolhem, e a lista tem ordem |
| R299 | "Sobreaviso" vira "Gestão Técnica", e é a mesa do Vinicius: para lá vão o dashboard e os KPIs da Operaciona… |
| R300 | Na Gestão Técnica, o que o Vinicius olha TODO DIA ocupa o centro; o que ele monta duas vezes por mês fica s… |
| R301 | A Operacional Técnica mostra TODOS os chamados da equipe de campo, abre no quadro por DIA DA SEMANA, lembra… |

## Fora de escopo

- Painel Comercial e seu dashboard: módulo `comercial` (R64, R302).
- Painel Administrativo: módulo `acessos` (R298).
- Chat da Início: módulo `atividades` (R215).

## Referências

- Receita obrigatória de painel: `../DASHBOARD.md` (faixas, PRISMA × ESPECTRO, §7.2).
- Manual: `../manual/visao-geral.md`.
- ADRs: ADR-0002.
- Estado da implementação: `../state/paineis.md`.
