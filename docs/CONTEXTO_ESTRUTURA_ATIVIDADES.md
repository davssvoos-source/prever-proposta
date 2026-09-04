# A estrutura das atividades — ditada pelo Davi em 03/09/2026

Este documento existe para quem chega de fora entender **o que é uma
atividade neste sistema** sem precisar de arqueologia. É a segunda fonte de
contexto ditada pelo Davi (a primeira é `CONTEXTO_OPERACAO_TECNICA.md`, sobre a
operação técnica). O texto dele está transcrito na íntegra na seção 1; o resto
é a leitura estruturada que o sistema segue, as decisões que o assistente
tomou onde o texto admitia duas leituras, e o que ainda está em aberto.

As regras de produto que saíram daqui são a **R137 a R150** em
`docs/PRODUTO.md`. A implementação é a **U96** em `docs/PLANO_UNIFICACAO.md`.
O plano de continuação é a **Fase H** em `docs/PLANO_V0.1.md`.

> **Uma frase para guardar:** uma atividade nasce de DUAS perguntas — *qual o
> tipo de demanda?* e *quem é o responsável?* — e é a resposta a elas que decide
> quais campos existem. Equipe, sprint e pedido de compra deixaram de ser
> campos. Fora da área técnica, a urgência chama-se **impacto operacional**.

---

## 1. O documento do Davi, na íntegra

> **Documento IMPORTANTE sobre a estrutura das atividades**
>
> Você irá protagonizar o desenvolvimento da estrutura das atividades no
> sistema de acordo com este documento. Atualize todos os documentos que forem
> necessários para manter o contexto do nosso projeto o mais claro possível
> para quem de fora ler este documento. Todas as regras devem sempre ser
> registradas - evite contradições entre regras, me pergunte o que for
> necessário.
>
> Na tela de configuração de cada cliente, deverá ter um campo para preencher o
> nome, WhatsApp e e-mail do síndico e do zelador; deverá ter também o tipo de
> local (Cond. Vertical, Cond. Horizontal, Galpão ou Residência). Faça uma
> reestruturação na tela de configuração do cliente, lembre-se que ela será
> acessada sempre por computador, então adapte a tela para um layout otimizado
> para desktop/notebook. Também vamos adicionar a foto da fachada de cada
> cliente, crie o botão para adicionar a foto da fachada na página de
> configuração do cliente, e ela deve ficar visível no card, sobrepondo-o com
> transição suave da opacidade, na lista de clientes da página "Clientes".
> Após este prompt, faremos a importação de todos os equipamentos instalados
> em cada cliente. No futuro vamos conectar a API e importar tudo de maneira
> automática, mas enquanto não temos a API do ERP, vou te enviar os dados em
> documentos exportados diretamente do ERP e você pode ler estes documentos,
> atualizar o catálogo e vincular os equipamentos aos clientes conforme
> estiver no ERP.
>
> **Tipos de demanda e suas características (NÃO SE APLICA PARA A ÁREA
> TÉCNICA):**
>
> **1. Manutenção Corretiva** — A. Título do problema apresentado; a.
> Responsável; b. Apoio (opcional); c. Prazo (opcional); d. Data Agendada
> (opcional); e. Cliente (pode ser um cliente, pode ser uma manutenção interna
> na Prever, e também pode ser um grupo de clientes - por exemplo Portaria
> Remota, seria uma atividade de manutenção corretiva que impacta todos os
> clientes de Portaria Remota); f. Status; g. Impacto operacional; h. Espaço
> para comentários; i. Campo de descrição do problema detectado; j. Campo de
> descrição da solução aplicada; k. Campo para fotografias de registro ou
> arquivos (Opcional); l. timeline; m. Natureza (Recebimento) - De onde surgiu
> essa demanda (Quem criou ela) e a data e horário em que criou a atividade.
>
> **2. Manutenção preventiva** — a. Título da atividade de preventiva; a.
> Responsável; b. Apoio (opcional); c. Prazo (opcional); d. Data Agendada
> (opcional); e. Cliente (pode ser um cliente, pode ser uma manutenção interna
> na Prever, e também pode ser um grupo de clientes - por exemplo Portaria
> Remota, seria uma atividade de manutenção preventiva que impacta todos os
> clientes de Portaria Remota); f. Status; g. Impacto operacional; h. Espaço
> para comentários; i. Campo de descrição (Opcional); j. Campo para fotografias
> de registros ou arquivos (Opcional); k. timeline; l. Natureza (Recebimento) -
> De onde surgiu essa demanda (Quem criou ela) e a data e horário em que criou
> a atividade; m. Campo de comentários.
>
> **3. Operacional** — a. Título da atividade; a. Responsável; b. Apoio
> (opcional); c. Prazo (opcional); d. Data Agendada (opcional); e. Cliente
> (pode ser um cliente, pode ser uma manutenção interna na Prever, e também pode
> ser um grupo de clientes - por exemplo Portaria Remota, seria uma atividade
> que impacta todos os clientes de Portaria Remota); f. Status; g. Impacto
> operacional; h. Espaço para comentários; i. Campo de descrição (Opcional); j.
> Campo para fotografias de registros ou arquivos (Opcional); k. timeline; l.
> Natureza (Recebimento) - De onde surgiu essa demanda (Quem criou ela) e a data
> e horário em que criou a atividade; m. Campo de comentários.
>
> **4. Proposta Comercial** — a. Local (Pode ser um cliente ou um
> empreendimento que ainda não é cliente e estamos prospectando, por isso o
> nome do campo é LOCAL e não CLIENTE); b. Tipo de local (Cond. Vertical, Cond.
> Horizontal, Galpão, Residência) (Deverá preencher automaticamente caso o
> campo LOCAL seja um CLIENTE); c. Nome, WhatsApp e e-mail do síndico Quando foi
> Condomínio Vertical ou Horizontal / Quando for galpão ou residência deverá
> ser DO PROPRIETÁRIO ao envés de ser do síndico; d. O Campo nome, WhatsApp e
> e-mail do zelador deverá aparecer somente quando for condomínio vertical ou
> horizontal. (Se o campo LOCAL for um CLIENTE, o nome, WhatsApp e e-mail do
> zelador e do síndico deverá ser preenchido automaticamente caso esteja
> cadastrado no sistema); e. Serviços propostos; f. Endereço (Se o campo LOCAL
> for um CLIENTE, o endereço deverá ser preenchido automaticamente); g. Foto da
> fachada (Deverá ser preenchida automaticamente caso seja um cliente atual);
> h. Técnico responsável (Técnico responsável pela visita no cliente para
> realizar o fluxo de configuração do orçamento (Um dos primeiros itens
> criados aqui no nosso sistema.); i. Data e horário do agendamento; j.
> Descrição do pedido; k. Mini calendário semanal do técnico responsável
> selecionado, para conseguir agendar a data e horário de acordo com a
> disponibilidade do técnico (OBS. Se a visita técnica comercial for realizada
> por um técnico de campo, a agenda dele é de acordo com a programação de
> agendamento técnico que o Vinicius faz); l. Campo de comentários; m. Status -
> não é um campo para alterar, é uma etiqueta que atualiza sozinho, tendo as
> opções: i. Visita técnica pendente; ii. Aguardando revisão; iii. Visita
> técnica aprovada; IV. Proposta comercial enviada - nós já havíamos
> estruturado essas 4 opções de status anteriormente, mas caso tenha dúvidas
> pode me perguntar. ***O Título da atividade no painel de atividades da tela
> INICIO deverá ser sempre "Proposta Comercial". E o título da atividade de uma
> visita técnica para fluxo de montagem de orçamentos, o título da atividade
> deverá ser "Visita Técnica" - eu me refiro aos cards da página INICIO
> (lembrando que é onde é possível visualizar todas as atividades de todos os
> setores da empresa).
>
> **5. Implantação** — ***Ao criar uma atividade e colocar o tipo de demanda
> implantação, deverá ter um campo para inserir a proposta comercial aprovada -
> futuramente discutiremos as atividades de acordo com a leitura de uma
> proposta comercial aprovada para implantação, e o sistema cria
> automaticamente as atividades, por enquanto crie somente o campo para já
> deixarmos no sistema, depois vamos configurar esta interpretação de leitura
> da I.A para criar as atividades de acordo com o documento PDF da proposta
> comercial. Guarde isso na sua memória e me lembre depois. a. Cliente; b.
> Título da atividade; c. Descrição da atividade (Opcional); d. Prazo
> (Opcional); e. Data para agendar (Opcional); f. Responsável; g. Apoio
> (Opcional); h. Status; i. Espaço para comentários; j. Anexar arquivos/fotos
> (opcional); k. Timeline.
>
> **6. Melhoria** — a. Cliente; b. Título da atividade; c. Descrição da
> atividade (Opcional); d. Prazo (Opcional); e. Data para agendar (Opcional); f.
> Responsável; g. Apoio (Opcional); h. Status; i. Espaço para comentários; j.
> Anexar arquivos/fotos (opcional); k. Timeline.
>
> Então quando o usuário cria uma nova atividade, o campo que surge em pop up
> no meio da tela deve começar com duas perguntas iniciais: QUAL O TIPO DE
> DEMANDA? Com as opções listadas acima, e também QUEM É O RESPONSÁVEL? Pois é
> a partir dessas 2 perguntas que nós vamos saber duas coisas: Qual dos 6 tipos
> de demanda acima será selecionado e consequentemente os campos mudam, e
> também vamos saber se o responsável é da equipe TÉCNICA ou se é do TI,
> Controle Patrimonial, Comercial, Gestor, SAC - pois criar um chamado para um
> usuário da equipe TÉCNICA, ou seja um técnico de campo, leva a outros
> critérios que nós vamos estruturar melhor em breve - me lembre depois deste
> prompt de te passar a estrutura dos tipos de demanda da área TECNICA. Então
> entenda que para cada opção, o campo se expande para tela inteira porém com
> os campos da maneira condizente com o que foi passado aqui.
>
> Note que eu não mencionei o campo "Equipe" em nenhum item, houve uma
> alteração neste ponto, remova o campo de inserção da equipe, pois vamos
> associar a equipe diretamente ao(s) usuário(s) envolvido na atividade. E aí
> conforme for adicionando o responsável e o(s) apoio(s), adicione a etiqueta
> da(s) equipe(s) envolvida(s). Note também que eu não mencionei o tipo de
> demanda "Pedido de compra", remova isso do nosso sistema.
>
> ***Me lembre também de te trazer uma relação de diversos tipos de atividades
> e seus respectivos impactos operacionais, e isso será algo automatizado, mas
> por enquanto o usuário deverá escolher entre "Sem impacto, Baixo, moderado ou
> Crítico, que será o maior grau de urgência. Uma implantação, manutenção
> preventiva e uma proposta comercial não têm grau de urgência, por isso não
> têm o campo de impacto operacional.
>
> O Calendário deverá ter as atividades na data de CONCLUSÃO para as
> atividades que já foram concluídas, bem como deverão estar na data do PRAZO
> caso ainda não tenham sido concluídas.
>
> Lembre-se que a prioridade aqui é que você entenda toda a estrutura que
> expliquei, revise e aplique as regras mencionadas acima ao sistema que
> estamos desenvolvendo. Os documentos devem estar organizados de maneira
> eficiente, quando possível também quero que você escreva pra mim o local dos
> documentos de contexto do nosso sistema, irei avaliá-los.
>
> Sempre que o usuário selecionar um grupo de clientes, ao invés de um
> CLIENTE, ele selecionar "CLIENTES DE PORTARIA REMOTA" ou "CLIENTES DE
> MONITORAMENTO" o sistema contabiliza uma atividade para cada cliente daquele
> grupo. Adicione as opções mencionadas na lista de clientes que expande no
> campo de seleção CLIENTE. Quando eu falo que contabiliza uma atividade para
> cada cliente, eu quero dizer que isso deverá aparecer individualmente no
> relatório de atividades executadas em cada cliente, mas não deverá criar um
> card para cada cliente nas atividades. Além disso, sempre que o usuário
> selecionar a opção de grupo de cliente, deverá automaticamente ter um
> checklist no campo DESCRICAO da página de configuração da atividade contendo
> todos os clientes daquele grupo no checklist.
>
> Note também que eu não mencionei o Sprint, então vamos esquecer a abordagem
> de colocar um sprint, pois na verdade, o prazo ou a data de agendamento
> dirão se a atividade deverá ser concluída este mês, esta semana, ou qualquer
> outro sprint. Por isso, delete o campo para selecionar o SPRINT no sistema -
> o sistema já entende isso por conta e não precisa do usuário selecionar.
>
> O sistema deve mapear sempre data de recebimento da demanda, data de inicio
> (Para os outros setores sem ser a área técnica, a data de inicio será mapeada
> a partir do momento em que uma atividade é movida para "em andamento", isso
> significa que o usuário iniciou a execução da task; também deverá mapear a
> data de conclusão, quando o usuário altera o status para Concluído.), para o
> setor TÉCNICA, o sistema entende a data de inicio a partir do momento em que
> ele apertar o botão INICIAR ATENDIMENTO no fluxo de atendimento do chamado
> que iremos desenvolver posteriormente para a área técnica (Contexto: será
> uma ideia semelhante ao fluxo que montamos para a área TECNICA para executar
> montagem de orçamento, onde será usado pelo celular).

Na sequência, o Davi acrescentou, sobre o pop-up: *"Estruture e protagonize
tudo. […] Caso não restem dúvidas, pode fazer o push, eu confio no seu
trabalho."* — foi o que autorizou as decisões da seção 4.

---

## 2. A leitura estruturada

### 2.1 Os seis tipos de demanda e a matriz de campos (R137)

Fora da área técnica, uma atividade é de um destes seis tipos, nesta ordem
(é a ordem da pergunta no pop-up):

| # | Tipo de demanda | valor no banco (`chamados.tipo`) | natureza |
|---|---|---|---|
| 1 | Manutenção Corretiva | `corretiva` | interno |
| 2 | Manutenção Preventiva | `preventiva` | interno |
| 3 | Operacional | `operacional` | interno |
| 4 | Proposta Comercial | `prospeccao` (valor histórico; o rótulo é "Proposta Comercial") | comercial — fluxo da visita |
| 5 | Implantação | `implantacao` | interno |
| 6 | Melhoria | `melhoria` | interno |

A matriz de campos, como o Davi a ditou (✓ tem · ○ opcional · — não tem):

| Campo | Corretiva | Preventiva | Operacional | Proposta | Implantação | Melhoria |
|---|---|---|---|---|---|---|
| Título | ✓ (do problema) | ✓ | ✓ | fixo: "Proposta Comercial" | ✓ | ✓ |
| Responsável | ✓ | ✓ | ✓ | técnico responsável pela visita | ✓ | ✓ |
| Apoio | ○ | ○ | ○ | — | ○ | ○ |
| Prazo | ○ | ○ | ○ | — | ○ | ○ |
| Data agendada | ○ | ○ | ○ | ✓ (data e hora da visita) | ○ | ○ |
| Cliente | cliente · interno · grupo | idem | idem | **Local** (cliente ou prospecção) | cliente | cliente |
| Status | ✓ | ✓ | ✓ | etiqueta automática (4 etapas) | ✓ | ✓ |
| Impacto operacional | ✓ | — (ver D2) | ✓ | — | — | — |
| Descrição | problema detectado | ○ | ○ | descrição do pedido | ○ | ○ |
| Solução aplicada | ✓ | — | — | — | — | — |
| Fotos / arquivos | ○ | ○ | ○ | foto da fachada | ○ | ○ |
| Comentários | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Timeline | ✓ | ✓ | ✓ | (fluxo próprio) | ✓ | ✓ |
| Recebimento (quem/quando) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Proposta comercial aprovada | — | — | — | — | ✓ | — |
| Tipo de local · síndico/proprietário · zelador · serviços · endereço · mini-calendário | — | — | — | ✓ | — | — |

O que **não** existe mais em nenhum tipo: **Equipe** (R139), **Sprint**
(R141), **Prioridade** fora da técnica (R142) e o tipo **Pedido de compra**
(R140).

### 2.2 O que NÃO se aplica à área técnica

O Davi foi explícito: a estrutura acima é de quem trabalha no computador
(R134). Para o **técnico de campo** a estrutura ainda vai ser ditada ("me
lembre depois deste prompt de te passar a estrutura dos tipos de demanda da
área TÉCNICA"). Até lá:

- o chamado de campo continua com o fluxo de sempre (`DetalheCampo`,
  `FormularioChamadoTecnico`, agenda por blocos, prioridade e SLA — R112);
- o que decide "é da técnica?" é a **equipe do responsável** no cadastro
  (`profiles.equipe = 'tecnica'`), na segunda pergunta do pop-up (R138);
- o "INICIAR ATENDIMENTO" do técnico (R144) é fluxo futuro, do celular.

### 2.3 A criação: duas perguntas, três corpos (R138)

O pop-up de nova atividade da Início começa pequeno, com duas perguntas —
**Qual o tipo de demanda?** (os seis) e **Quem é o responsável?** — e cresce
quando as duas estão respondidas. O corpo que abre:

1. tipo **Proposta Comercial** → o fluxo da visita (`/gerencial/nova`), que já
   tem local, tipo de local, síndico/proprietário, técnico e data;
2. responsável da equipe **Técnica** → o formulário de campo (R126), com tipo
   e técnico já preenchidos;
3. qualquer outro → a estrutura da seção 2.1 para aquele tipo.

Todos criam pela mesma porta de escrita (`abrirChamado`). O atendimento de
**plantão** (R117) continua sendo um modo à parte do mesmo pop-up.

### 2.4 Cliente: um cliente, um grupo, ou interno (R143)

O campo Cliente de uma atividade interna aceita três respostas:

- **um cliente** da base (o local principal, `chamados.cliente_id`);
- **um grupo de clientes** — "Clientes de Portaria Remota", "Clientes de
  Monitoramento de Alarmes" — que aparece na MESMA lista do cliente, no topo.
  Um grupo é **uma atividade e um card só**; grava-se como etiqueta de setor
  (`chamado_locais.setor`, o mecanismo da R85) e a lista de quem é do grupo
  sai de `clientes.servicos_prestados` na leitura. Escolher o grupo põe
  automaticamente na **descrição** um checklist com todos os clientes dele
  (linhas `- [ ] Nome`, que o editor de blocos mostra como caixas de marcar);
- **interno — Prever**: sem cliente (manutenção interna).

**Onde o grupo conta:** no histórico de cada cliente. A ficha do cliente lista
as atividades em que ele é o principal, em que é local extra E as do grupo a
que pertence — marcadas como "pelo grupo de clientes ou como local extra".

### 2.5 O que saiu: Equipe, Pedido de compra, Sprint

- **Equipe não é campo (R139).** As equipes de uma atividade são as das
  pessoas nela — a do responsável primeiro, depois a de cada apoio, pelo
  cadastro (`profiles.equipe`). Aparecem como etiquetas e alimentam o filtro
  "Equipe" da Início, em qualquer natureza. A coluna `chamados.equipe` continua
  existindo e recebe a equipe do responsável (para a Operacional Técnica, que a
  lê); `chamado_equipes` deixou de ser lida e escrita.
- **Pedido de compra saiu (R140).** O tipo saiu do vocabulário, do CHECK do
  banco e das telas; os chamados que eram pedido de compra viraram
  `operacional` (é o que a R48 já mandava abrir no lugar dele). A ficha
  (`chamado_compra`) fica no banco como arquivo. Demanda do Controle
  Patrimonial é uma atividade Operacional.
- **Sprint saiu (R141).** O campo e o seletor não existem mais; o sistema
  entende semana e mês pelo prazo (`sprintDoPrazo`, R40 — o cálculo ficou, o
  campo não). A coluna `chamados.sprint` não é mais escrita.

### 2.6 Impacto operacional (R142)

A régua de urgência fora da área técnica: **Sem impacto · Baixo · Moderado ·
Crítico**. Só **Manutenção Corretiva** e **Operacional** a têm; Implantação,
Preventiva, Melhoria e Proposta não. No campo continua valendo a
**prioridade** (o SLA é indexado por ela, R112). O Davi vai mandar a relação
"tipo de atividade → impacto" para o valor virar automático; até lá é escolha
de quem cria.

### 2.7 Recebimento, início e conclusão (R144)

Toda atividade mapeia três instantes: **recebimento** (quem criou —
`aberto_por` — e quando — `created_at`; a tela mostra "Recebido de X em …"),
**início** (`iniciada_em`, carimbado pelo banco quando o status vai a "em
andamento") e **conclusão** (`concluida_em`, quando vai a "concluído"). Para a
área técnica o início virá do botão "INICIAR ATENDIMENTO", no fluxo futuro do
celular. (O que o Davi chamou de "Natureza (Recebimento)" é isto; no código a
palavra `natureza` já significa campo/interno/comercial — ver o glossário.)

### 2.8 O calendário (R145)

Uma atividade **concluída** aparece no dia da **conclusão**. Uma em aberto
aparece na **hora agendada** quando tem (é quando a dupla sai) e, senão, no
**prazo**. A célula diz qual dos três é: hora, "prazo" ou "concluído".

### 2.9 A Proposta Comercial (R147)

É o fluxo da visita técnica, que já existia; o que mudou de vocabulário:

- a etiqueta de etapa (automática) chama-se **Visita técnica pendente →
  Aguardando revisão → Visita técnica aprovada → Proposta comercial enviada**
  (mais "Cancelada", a saída do funil);
- o card na Início chama-se sempre **"Proposta Comercial"** — e, para o
  **técnico responsável pela visita**, **"Visita Técnica"** (é o trabalho
  dele); é UM registro com dois papéis (decisão D5);
- ao escolher um cliente como Local, o formulário herda tipo de local,
  endereço, síndico/proprietário, zelador **e a foto da fachada**;
- residência e galpão usam "Proprietário" e "Encarregado(a)"; o zelador só
  aparece em condomínio.

O **mini-calendário semanal do técnico** para agendar a visita ainda não foi
construído (é o item da Fase H que depende da escala de duplas — ver a seção
5).

### 2.10 Implantação e a proposta aprovada (R148)

A implantação tem o campo **"Proposta comercial aprovada"**: aponta para uma
proposta já enviada (`chamados.proposta_id → visitas_tecnicas`). Por enquanto
é só o vínculo; a leitura do PDF da proposta pela IA para criar as atividades
automaticamente é pendência registrada (seção 5).

### 2.11 A ficha do cliente (R146)

Acessada sempre por computador: duas colunas — a larga com o histórico
(inventário, contratos, atividades, plantão, visitas), a estreita com a
identidade (foto da fachada, tipo de local, endereço, serviços prestados,
síndico e zelador com **WhatsApp** clicável, observações). A **foto da
fachada** sobe por um botão da ficha para o bucket privado `clientes-fachadas`
e aparece no card da lista de clientes, sobreposta pela direita com transição
de opacidade.

---

## 3. Glossário — as palavras que colidem, e como se fala aqui

| A palavra | No documento do Davi | No código |
|---|---|---|
| **Natureza** | "Natureza (Recebimento)": quem criou e quando | `chamados.natureza` = campo · interno · comercial (como o trabalho é executado). O "Recebimento" do Davi é `aberto_por` + `created_at` — a tela chama de **Recebimento**, nunca de natureza |
| **Proposta Comercial** | o tipo de demanda 4 | `tipo = 'prospeccao'` (valor histórico da U41); o **rótulo** voltou a ser "Proposta Comercial" (a R48 o chamava "Prospecção") |
| **Visita Técnica** | o card do técnico na proposta | NÃO é o tipo `vistoria` (R112: ir ao cliente só para olhar). "Visita técnica" é sempre a visita comercial de orçamento |
| **Equipe** | a etiqueta das equipes envolvidas | `profiles.equipe` (a equipe da pessoa). NÃO é a **dupla** de campo (`duplas`, a equipe que sai junto) |
| **Grupo de clientes** | "Clientes de Portaria Remota" | `chamado_locais.setor` ∈ `servicos_prestados` — uma etiqueta; a lista de clientes vem do cadastro |
| **Impacto operacional** | a urgência fora da técnica | `chamados.impacto_operacional`; no campo a urgência é `prioridade` |
| **Data agendada** | opcional em toda atividade | `chamados.data_hora_agendada` é ESPELHO da agenda de campo (R101) e só existe para campo; para o interno ver a pergunta Q18 |

---

## 4. Decisões que o assistente tomou (o Davi confirma ou corrige)

Onde o texto admitia duas leituras, escolhi uma e a marquei. Todas são
reversíveis; nenhuma esconde a alternativa.

- **D1 — Preventiva NÃO tem impacto operacional.** A lista de campos da
  preventiva cita "Impacto operacional", mas a frase de fechamento diz que
  "manutenção preventiva […] não tem grau de urgência, por isso não tem o
  campo". A frase tem a razão junto e venceu a lista (que repete a da
  Operacional item a item, inclusive "comentários" duas vezes — sinal de
  cópia). É a **Q19**.
- **D2 — Corretiva e Operacional têm impacto; Implantação, Melhoria e
  Proposta não.** Segue o texto: Melhoria não lista o campo, e a frase de
  fechamento exclui as outras três.
- **D3 — O pedido de compra saiu por completo, mas sem destruir dado.** O tipo
  saiu do vocabulário, do CHECK e das telas; os chamados viraram
  `operacional`; a tabela `chamado_compra` ficou no banco como arquivo, com a
  RPC de decidir revogada. Apagar a tabela pede pedido explícito.
- **D4 — A coluna `chamados.equipe` continua sendo escrita.** Com a equipe do
  responsável. Não é para a tela (que deriva das pessoas) — é para a
  Operacional Técnica e as policies que ainda a leem. Nada muda para quem a
  lia; o que mudou é que ninguém a escolhe.
- **D5 — "Visita Técnica" é o título que o TÉCNICO RESPONSÁVEL vê; todo o
  resto vê "Proposta Comercial".** Um registro, dois papéis, decidido por quem
  olha. A alternativa seria criar um segundo registro (uma atividade para o
  comercial e outra para o técnico) — mais cards para a mesma coisa. Se o Davi
  preferir dois registros, é a **Q20**.
- **D6 — O calendário coloca o em-aberto na hora agendada quando há, senão no
  prazo.** O Davi disse "na data do PRAZO caso ainda não tenham sido
  concluídas"; a hora agendada é o compromisso da dupla e some se o prazo
  mandar. Para o interno, que hoje não tem hora agendada, o efeito é
  exatamente o pedido.
- **D7 — A "Data agendada" das atividades internas NÃO foi criada.** A coluna
  `data_hora_agendada` é espelho derivado da agenda de campo (R101), e
  reabri-la para o interno reabriria as duas verdades que a U78 fechou. É a
  **Q18** — a resposta define se nasce uma coluna própria.
- **D8 — O rótulo do tipo voltou a "Proposta Comercial".** A R48 o tinha
  chamado "Prospecção"; o documento do Davi usa "Proposta Comercial" como nome
  do tipo de demanda. O valor gravado não mudou.
- **D9 — O impacto vindo da IA de criação rápida sai da prioridade.** A IA fala
  em prioridade; no interno ela vira impacto um-para-um (urgente → crítico,
  alta → moderado, normal → baixo, baixa → sem impacto), só nos tipos que têm.

---

## 5. O que o Davi disse que ainda vai mandar (pendências dele)

Lembretes pedidos com todas as letras — o assistente os guarda na memória e
aqui:

1. **A estrutura dos tipos de demanda da área TÉCNICA** ("me lembre depois
   deste prompt"). Até ela chegar, o chamado de campo é o de sempre.
2. **A relação "tipo de atividade → impacto operacional"**, para o impacto
   virar automático ("me lembre também de te trazer").
3. **Os documentos exportados do ERP** com os equipamentos instalados por
   cliente, para atualizar o catálogo e vincular ao cliente ("após este
   prompt, faremos a importação"). Depois, a API do ERP.
4. **A leitura da proposta comercial aprovada (PDF) pela IA** para criar as
   atividades da implantação automaticamente ("guarde isso na sua memória e
   me lembre depois").

E o que ficou para a **Fase H** do plano por depender de desenho próprio: o
**mini-calendário semanal do técnico** no formulário da proposta (lê a agenda
por dupla e a escala da semana), e a **Início do técnico no celular** (Fase
B2, R134).

---

## 6. Perguntas abertas (Q18–Q22)

- **Q18 — "Data agendada" nas atividades internas.** A coluna
  `data_hora_agendada` é da agenda de campo (R101). Quer uma data agendada
  própria para o interno (coluna nova, sem hora?), ou o prazo basta?
- **Q19 — Preventiva tem impacto operacional?** A lista diz sim, a frase de
  fechamento diz não. Segui a frase (D1).
- **Q20 — "Visita Técnica" × "Proposta Comercial".** Um registro com o título
  dependendo de quem olha (D5), ou dois registros — um do comercial e um do
  técnico?
- **Q21 — A tabela `chamado_compra`.** Ficou arquivada. Pode ser apagada de
  vez, ou fica?
- **Q22 — O mini-calendário semanal do técnico na proposta.** Lê a agenda da
  dupla do técnico na semana (`agenda_campo`) e a escala; a visita comercial
  deve virar um bloco na programação do Vinicius (ocupando a janela), ou só se
  desenha sobre ela?

---

## 7. Onde está o quê (o mapa desta estrutura no código)

| O quê | Onde |
|---|---|
| Os seis tipos, o impacto, o vocabulário | `src/lib/chamado-status.ts` (`TIPOS_DE_DEMANDA`, `ImpactoOperacional`, `TIPOS_COM_IMPACTO`, `temImpacto`) |
| Equipes das pessoas | `src/lib/equipes.ts` (`equipesDePessoas`), `src/features/atividades/modelo.ts` (`equipesDaAtividade`) |
| Grupos de clientes e o checklist | `src/features/chamados/grupos.ts` |
| O pop-up das duas perguntas | `src/features/home/NovaAtividadeDialog.tsx` |
| A página da atividade (computador) | `src/features/chamados/DetalheInterno.tsx` |
| O painel lateral | `src/features/chamados/PainelChamado.tsx` |
| A ficha do cliente e a foto da fachada | `src/routes/_authenticated/clientes.$id.tsx`, `src/routes/_authenticated/clientes.tsx`, `src/features/clientes/data.ts` |
| O calendário (conclusão · agendada · prazo) | `src/routes/_authenticated/calendario.tsx` |
| As etapas da proposta | `src/features/comercial/etapas.ts` |
| O banco | `supabase/migrations/20260914090000_u96_estrutura_das_atividades.sql` |
| As regras | `docs/PRODUTO.md` R137–R150 |
| O diário da entrega | `docs/PLANO_UNIFICACAO.md` U96 |
