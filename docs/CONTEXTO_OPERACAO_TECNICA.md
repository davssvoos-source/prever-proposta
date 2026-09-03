# Operação Técnica — o contexto, ditado pelo Davi

Documento de contexto do domínio **Operação Técnica** (a equipe de campo do
Grupo Prever e quem a gere). Escrito em 2026-09-03 a partir das palavras do
Davi, para corrigir a interpretação que veio de fora: o documento mestre do
Gestor OS foi escrito pelo Claude do Vinicius, e trouxe **a leitura dele** do
sistema — não a do Davi. Este arquivo é a leitura do Davi, e é a que vale.

Divisão de papéis entre os documentos:
- **Este** — o que a operação técnica É: pessoas, atividades, fluxos, onde
  cada coisa mora. Narrativa e glossário. Sem número de regra.
- **`PRODUTO.md`** — as regras numeradas (R124–R130 saem daqui).
- **`PLANO_V0.1.md`** — a ordem em que isto vira código.
- **`PLANO_UNIFICACAO.md`** — o diário do que já foi construído (U-série).

Se algo aqui discordar do código, o código ganha e este documento tem de ser
corrigido — mas se o código discordar do que o Davi ditou, é o código que
está errado.

---

## 1. Quem é quem

| Pessoa | O que faz | Papel no app | Equipe |
|---|---|---|---|
| **Davi** | dita as regras de produto; admin do sistema | Admin | — |
| **Vinicius** | **gestor da equipe técnica de campo**: programa, acompanha, faz vistorias validando o trabalho dos técnicos, decide cobrança extra | Admin | Técnica (coordenação) |
| **Erik, Nicholas** | T.I. | Técnico | T.I. |
| **Gilleno** | Controle Patrimonial (opera o QAP ERP) | Técnico | Controle Patrimonial |
| **Rubia** | citada pelo Davi entre quem tem demandas gerais; papel e equipe **a confirmar** | ? | ? |
| **Breno e os líderes das duplas** | técnicos de campo | Técnico | Técnica |

Dois fatos que estruturam tudo:

1. **O Vinicius não é só técnico, é GESTOR.** As atividades dele fazem parte
   das demandas gerais que a Início já reúne (as de Davi, Erik, Gilleno,
   Nicholas, Rubia). Ele usa a **Início** como todo gestor — e é lá que a
   atividade de validação (§5) tem de aparecer para ele.
2. **A Operacional Técnica é a tela DELE**, e ela centraliza tudo o que se
   refere aos trabalhos dos técnicos **de campo da EQUIPE TÉCNICA**. O T.I.
   também pode fazer atividade em campo, mas **não entra nessa conta**: o
   recorte é por **equipe = técnica**, não por "natureza = campo". (Foi assim
   que a R95 já recortou; o Davi confirmou o critério em 03/09.)

> Davi, 03/09/2026: *"na tela Operacional Técnica estará centralizado tudo o
> que se refere aos trabalhos dos técnicos DE CAMPO. Isso precisa estar bem
> claro para você. Ou seja, o T.I também pode fazer atividade EM CAMPO, porém
> não entra nesta conta, no Operacional Técnica são EQUIP. TECNICA."*

## 1b. Em que aparelho cada um trabalha (R134)

Quem **não** é da área técnica — T.I., Controle Patrimonial, SAC, comercial,
gestão — usa o sistema **no computador**. Os **técnicos de campo** usam **no
celular** (e depois no aplicativo). O técnico tem três telas: **Perfil**,
**Calendário** e uma **Início própria**, sem dashboard: "Bom dia, você tem X
chamados hoje" e os cards dos chamados em que ele participa (responsável ou
apoio). Clicar no card abre o **fluxo** daquele chamado. Toda tela tem de saber
para qual dos dois aparelhos nasceu — a tela da atividade interna (R135), por
exemplo, é do computador.

> Davi, 03/09/2026: *"Todos que são do T.I, Controle Patrimonial, SAC, qualquer
> setor que não seja a área técnica, irão utilizar o sistema no computador. A
> área técnica, ou seja, os técnicos de campo, irão utilizar o sistema no
> celular. Posteriormente vamos lançar o aplicativo para celular."*

## 2. As três atividades do técnico de campo

Cada técnico tem **três possíveis atividades**, e **cada uma tem fluxo
próprio**:

| Atividade | O que é | O que o sistema precisa saber antes | Fluxo próprio |
|---|---|---|---|
| **Manutenção corretiva** | algo quebrou; alguém vai consertar | cliente, **problema relatado**, prioridade (SLA) | abre → programa → executa (diagnóstico, peças, fotos, assinatura) → **validação do gestor** (§5) → cobrança ou não |
| **Manutenção preventiva** | rotina de revisão | **os sistemas cadastrados no cliente** — a preventiva é sobre eles | abre → programa → checklist por sistema → executa → validação |
| **Implantação** | obra: instalar um sistema novo | cliente, **sistema a implantar**, **período** (início ↔ fim) e cronograma em quatro fases | abre → período → fases → programa dia a dia → conclui → cobrança (parcelada) |

O que o código já chama de `tipo` de chamado tem dois valores a mais —
`operacional` (entrega de controle remoto, tarefa miúda de campo; R5) e
`vistoria` (R112). Eles **não são a quarta e a quinta atividade do técnico**:
`operacional` é a tarefa pequena que não é conserto nem rotina, e a
**vistoria é atividade do GESTOR** (é o Vinicius indo validar o trabalho dos
técnicos). Isso está registrado como pergunta em aberto no plano (Q2), porque
o R112 a descreveu como "ir ao cliente só para olhar" e o Davi a descreveu
como ato de validação — as duas leituras precisam ser reconciliadas por ele.

> Davi, 03/09/2026: *"Cada técnico tem 3 possíveis atividades. Manutenção
> Corretiva, manutenção preventiva e implantação. Cada item tem um fluxo
> próprio."*

## 3. A página do cliente é o centro

**Tudo o que se refere ao cliente em si é feito pela página do cliente.** Ela
reúne quatro coisas de origens diferentes, e a origem de cada uma é regra:

| O que | De onde vem | Quem escreve |
|---|---|---|
| **Cadastro** (CNPJ, endereço, razão social, nome fantasia) | **QAP ERP** | ninguém no app — vem da API (R21 já dizia: o app não cria cliente) |
| **Sistemas instalados** (Eclusa de pedestres, Porta de vidro com acesso ao hall, CFTV, Alarme…) | **imputados manualmente no app** | a equipe, cliente a cliente |
| **Equipamentos** (o patrimônio instalado ali) | **QAP ERP** — o nosso sistema **só recebe, não envia** | ninguém no app |
| **Contrato** (PDF) | **upload no app** | gestor; o sistema lê e extrai o que está em regime de **comodato com doação**, o que é **locação**, quais **manutenções estão inclusas** |
| **Cobranças extras** lançadas pelo Vinicius | o app (nascem da validação, §5) | o Vinicius; aparecem **também** na Operacional Técnica |

**Sistemas ≠ equipamentos.** Sistema é o conjunto funcional que o cliente
contratou ("CFTV", "Eclusa de pedestres"); equipamento é a peça física com
número de série que o QAP controla. Os sistemas são a base da **preventiva**
(§2); os equipamentos são a base da **cobrança** (§5: o que foi fornecido e o
que foi retirado). O código já tem os dois (`cliente_sistemas` e
`cliente_equipamentos` + `cliente_equipamento_unidades`), e a regra que muda é
a de origem: **equipamento passa a vir do QAP**, não do técnico em campo.

> Davi, 03/09/2026: *"na página de cada cliente terão os sistemas instalados
> (imputados manualmente dentro do app), os equipamentos (vinculado com o QAP
> ERP (Nosso sistema só recebe, não envia)), além do cliente também vir do QAP
> ERP (CNPJ, Endereço, Razão Social e Nome fantasia). Cada cliente nós faremos
> o upload do contrato, o sistema utilizará o contrato para saber quais
> equipamentos estão sob regime de comodato com doação, quais estão sob
> locação, quais manutenções estão inclusas, etc.. Tudo isso que se refere ao
> cliente em si deverá ser feito através da página do cliente."*

## 4. As integrações moram no Administrativo

A janela **Administrativo** ganha uma aba de **APIs**: é onde se conecta com
terceiros. O primeiro conector é o **QAP ERP**, e o sentido é único: **o app
puxa** (clientes e equipamentos por cliente); **o app não escreve no QAP**.

Isso corrige o §6 do `PRODUTO.md`, que previa "movimentação física registrada
no app → lançada no QAP via API". A escrita via API **sai do plano**. A ponte
para o Gilleno lançar movimentação no QAP continua sendo humana (o relatório
que o app gera), e isso é decisão, não pendência.

> Davi, 03/09/2026: *"teremos uma aba dentro da janela 'Administrativo' que
> terá as APIs para conectarmos com terceiros. E aí eu vou conectar com a API
> do QAP ERP, onde o nosso software vai puxar todos os equipamentos registrados
> em cada cliente."*

## 5. A validação do gestor — o fluxo que fecha cada chamado

**Toda vez que um técnico finaliza um chamado, nasce uma atividade para o
Vinicius: a validação.** Ela aparece na **Início** dele (ele é gestor, não
técnico), e segue um fluxo diferente do chamado:

1. **Tudo já está escrito** quando ela abre — foi o técnico que escreveu:
   equipamentos **fornecidos**, equipamentos **retirados**, **diagnóstico** do
   problema, **fotos** do executado, **data de início e de fim** do
   atendimento, **técnico(s) responsável(is)**, **cliente**.
2. O Vinicius **valida** tudo isso.
3. E **decide a cobrança**: há um campo para **lançar cobrança**, opção de
   **parcelar**, uma **descrição** que **vem sugerida pelo sistema**, e duas
   saídas — **CONCLUIR E LANÇAR COBRANÇA** ou **CONCLUIR SEM COBRAR**.

É o Vinicius quem cuida das **cobranças extras**: manutenção que não faz
parte do contrato, equipamento novo que não estava incluso.

**O que já existe disto no código, e o que não existe.** A porta que conclui e
decide na mesma transação já está construída (`concluir_chamado_com_cobranca`,
R104/R121), com parcelamento em centavos e a régua do SAC que não vê valores
(R13). A caixa "Conferência" no detalhe do chamado já mostra diagnóstico,
fotos e assinatura e oferece as três saídas. **O que NÃO existe é a
ATIVIDADE**: hoje o chamado concluído fica na fila `a_analisar` e ninguém é
avisado; não há card na Início do Vinicius; e a tela de validação não reúne
numa vista só o que o técnico registrou (as peças com direção
instalado/retirado vivem num card, as fotos em outro, o período em outro). O
plano (Fase C) constrói exatamente essa peça — e a decisão de desenho
(atividade derivada × chamado interno criado por gatilho) está na Q1.

> Davi, 03/09/2026: *"toda vez que um técnico finaliza determinado chamado, o
> sistema deverá criar uma atividade para o Vinicius, que será uma atividade
> de validação. Essa atividade estará disponível na tela INICIO — pois
> lembre-se, o Vinicius não é só um técnico, ele é Gestor. […] Ele irá
> validar tudo isso, e registrar se haverá cobrança ou não. Então deverá ter
> um campo para Lançar cobrança, opção de parcelar, Descrição da cobrança (Vem
> com sugestão do sistema), e aí terão as opções: CONCLUIR E LANÇAR COBRANÇA
> ou então CONCLUIR SEM COBRAR."*

## 6. A tela Operacional Técnica — o que o Vinicius precisa ver em cinco segundos

Três perguntas, na ordem em que ele as faz:

1. **O que cada equipe de campo faz hoje e amanhã?** — a grade da programação
   (`/chamados/programacao`, R99–R102) e o gráfico "Atividades por equipe".
2. **Como está cada implantação?** — uma **barra de progresso por obra em
   andamento**, no dashboard.
3. **Quanto vai ser cobrado este mês?** — "A cobrar este mês", no dashboard,
   ao lado de "aguardando conferência" (o que ele ainda tem de validar).

E um **botão "+"** para abrir chamado técnico sem sair da tela: responsável
(**equipe de campo ou técnico solo**), cliente, **problema** se for
manutenção, **sistema** se for implantação, data do agendamento.

O que saiu do dashboard, por decisão do Davi em 03/09: "Fluxo e ritmo" e "Em
aberto por técnico". O gráfico por equipe encolheu de 12 para 8 semanas; a
rosca estreitou; "Abertos por cliente" foi para a esquerda. A regra está na
R125; a receita de dashboard continua sendo `docs/DASHBOARD.md`.

## 7. Glossário — as palavras que já colidiram, e como se fala aqui

| Palavra | Significa | Não confundir com |
|---|---|---|
| **equipe** (sem adjetivo) | departamento: técnica, T.I., comercial, controle patrimonial, SAC, monitoramento, outras | — |
| **equipe de campo** | a turma que sai no mesmo carro (tabela `duplas`, escala por semana) | "equipe" |
| **tipo** (do chamado) | corretiva · preventiva · implantação · operacional · vistoria | **modalidade**, que é do contrato (locação/manutenção/comodato/venda) |
| **sistema** (do cliente) | conjunto funcional instalado — CFTV, alarme, eclusa | **equipamento** (peça física, série, QAP) |
| **fase** (da implantação) | infraestrutura · instalação · configuração · acabamento | **etapa**, que é o momento da foto (antes/depois) |
| **vistoria** | o gestor indo ver o trabalho feito | **visita técnica**, que é comercial (levantamento para proposta) |
| **validação** / **conferência** | o gestor confirma o executado e decide a cobrança | o "concluir" do técnico, que só registra a execução |
| **cobrança extra** | o que não está no contrato: manutenção fora de cobertura, equipamento novo | mensalidade do contrato (não é gerada pelo app) |

## 8. O que a leitura de fora errou, e este documento corrige

| Onde | A leitura que veio | A leitura do Davi |
|---|---|---|
| QAP | app lê **e escreve** (movimentação via API) | app **só recebe**; escrita não existe |
| Equipamentos por cliente | registrados pelos técnicos em campo, aos poucos | vêm do **QAP**; no app entram os **sistemas**, à mão |
| Vistoria | atividade de campo genérica ("ir só para olhar") | ato de **gestão**: validar o trabalho dos técnicos (a reconciliar — Q2) |
| Validação do executado | um botão "Conferir e fechar" dentro do detalhe | uma **atividade** na Início do gestor, com tudo que o técnico registrou e as duas saídas |
| Cobrança da obra | acréscimo na mensalidade | **parcelas** reais, que entram no fechamento (já corrigido na R121) |
| Dashboard da técnica | rankings de carga e ritmo | **implantações em andamento**, **a cobrar no mês**, **aguardando conferência** |
| Contrato | modalidade em quatro valores | regime por **equipamento**: comodato **com doação**, locação, e o que está incluso em manutenção (a modelar — Q4) |
