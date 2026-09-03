# Plano de ação — rumo à versão 0.1

Escrito em 2026-09-03, a partir do contexto ditado pelo Davi
(`docs/CONTEXTO_OPERACAO_TECNICA.md`) e do que já está construído
(`docs/PLANO_UNIFICACAO.md`, U0–U92). É a ordem em que o sistema chega a um
ponto em que **o Vinicius opera só nele**, e o Gestor OS pode ser desligado.

Este plano substitui o "plano em sete fases" da absorção do Gestor OS (U75),
que ficou fora do repo. O que dele já foi entregue está contado na §2; o que
sobrou entrou aqui, reordenado pela prioridade do Davi. Toda fase segue o
ciclo obrigatório do `CLAUDE.md` (regra → lógica pura → asserção → build →
diário → commit), e nenhuma migration é aplicada pelo repo — o Davi roda à mão.

---

## 1. O que é a v0.1 — a definição de pronto

A v0.1 está pronta quando **um mês inteiro da equipe técnica passa só pelo
app**, do começo ao fim:

1. O Vinicius **programa a semana** das equipes de campo na grade
   (`/chamados/programacao`) — *já existe (U78/U79)*.
2. **Abre chamados técnicos** pela Operacional Técnica, com equipe/técnico,
   cliente, problema ou sistema, e agendamento — *Fase B*.
3. **Acompanha as implantações** em andamento pela barra de progresso, e vê
   **quanto vai cobrar no mês** e **o que ainda tem de conferir** — *Fase A*.
4. Quando um técnico conclui, **a validação aparece na Início dele**; ele
   confere o que foi registrado e decide **cobrar (com parcelas e descrição
   sugerida) ou não cobrar** — *Fase C*.
5. As cobranças extras aparecem **na ficha do cliente** e no painel, e entram
   no **fechamento** do mês (CSV/PDF) — *Fase C + D; fechamento já existe (U5/U88/U90)*.
6. Todo cliente tem **sistemas cadastrados**, **contrato carregado**, e os
   **equipamentos vindos do QAP** — *Fase D + E*.
7. A **preventiva** nasce dos sistemas cadastrados — *Fase F*.
8. O histórico do Gestor OS foi **migrado na data de corte** e ele foi
   **desligado** — *Fase G*.

O que **não** é v0.1: motor de mensalidade recorrente (decisão da R121),
escrita no QAP (decisão da R129), IA no WhatsApp do SAC (§9 do
`PLANO_UNIFICACAO.md`), cálculo de rota por API (Fase 2 antiga — fica opcional).

## 2. Inventário — o que já existe e o que falta

| Domínio | Já existe (onde) | Falta |
|---|---|---|
| Chamado técnico (corretiva/preventiva/implantação) | `chamados` com `natureza='campo'`, SLA por prioridade, fotos, peças com direção, assinatura, checklist (etapas 0–6, U3, U7) | o "+" na Operacional Técnica (B); "sistema a implantar" criando o sistema do cliente (B) |
| Programação semanal | grade, blocos, jornada, bloqueio, retorno, OS externa (U78/U79) | — |
| Equipes de campo | escala por semana com herança, veículo (U76/U77) | — |
| Implantação | período, prazo espelhado, quatro fases, PDF do cronograma (U89) | progresso no dashboard (A); sistema do cliente nasce "em implantação" (B/D) |
| Conferência e cobrança | `concluir_chamado_com_cobranca`, parcelas, análise item a item, caixa "Conferência" no detalhe, cartão da grade (U4, U80, U90) | a ATIVIDADE de validação na Início do gestor, a vista única do executado, a descrição sugerida, o aviso (C) |
| Fechamentos | semanal/mensal, CSV, PDF, reabrir (U5, U88, U90) | "A cobrar este mês" no painel (A) |
| Cliente | ficha com contratos, chamados, visitas, plantão, inventário de sistemas e equipamentos (etapas 1–2, U92) | cobranças na ficha (D); catálogo de tipos de sistema ampliado (D); equipamentos como espelho do QAP (E) |
| Contrato | upload de PDF + extração por IA, cobertura por item, preços (U2) | regime por equipamento (comodato **com doação**) e "o que está incluso" legível na ficha (D — Q4) |
| QAP | `qap_cliente_id`, `qap_unidade_id` já existem nas tabelas; import por planilha (U24) | aba **APIs** no Administrativo + conector de leitura (E) |
| Plantão / sobreaviso | escala, atendimento, painel (U85–U87, U91) | — |
| Operacional Técnica | recorte por equipe técnica, KPIs, rosca, gráfico por equipe, abertos por cliente, lista e quadro (R66–R69, R95, R123) | a reorganização da R125 (A) |

## 3. As fases

### Fase A — O dashboard da Operacional Técnica (R124/R125) — *esta sessão*

**Entregas.** Saem "Fluxo e ritmo" e "Em aberto por técnico". "Atividades por
equipe" de 12 para 8 semanas. Rosca mais estreita. "Abertos por cliente" à
esquerda. Entram: "A cobrar este mês" (só para quem vê valores), "Aguardando
conferência" (clicável, filtra a lista) e "Implantações em andamento" (uma
barra por obra: real = fases concluídas, plano = dias úteis decorridos).

**Arquivos.** `features/paineis/indicadores.ts` (lógica pura nova),
`features/implantacao/modelo.ts` (`progressoDaObra`),
`features/implantacao/data.ts` (consulta das obras),
`features/chamados/cobranca.ts` (cobranças da competência),
`routes/_authenticated/painel.operacional.tsx`, `scripts/verificar-logica.cjs`.
**Sem migration.**

**Aceite.** A lista continua abrindo acima da metade da tela; a soma das
barras de "Abertos por cliente" é o KPI "em aberto"; o número de "Aguardando
conferência" é o tamanho da lista que o clique abre; "A cobrar" não aparece
para o SAC.

### Fase B — O "+" da Operacional Técnica (R126) — *esta sessão*

**Entregas.** Botão "+" ao lado do alternador lista/quadro. Abre um pop-up com
o formulário de chamado de campo — o MESMO de `/chamados/novo-campo`,
extraído para componente (`features/chamados/FormularioChamadoTecnico.tsx`),
não copiado. Melhorias pedidas pelo Davi: escolher a **equipe de campo** sem
técnico propõe o líder da escala como responsável; na **implantação** o
sistema é "sistema a implantar" e pode ser criado ali; sem título, o sistema
sugere um. Ao criar, o chamado abre no painel lateral (R33).
**Sem migration.**

**Aceite.** `/chamados/novo-campo` continua funcionando igual (é o mesmo
componente); um chamado aberto pelo "+" com equipe e horário aparece na grade
da programação e no gráfico por equipe.

### Fase C — A atividade de validação do gestor (R130) — *2 sessões*

**Entregas.**
1. **A atividade na Início.** Proposta (Q1): um card **derivado** — todo
   chamado técnico `concluido` com decisão pendente (`a_analisar` /
   `em_conferencia`) vira um card "Validar atendimento" na Início de quem
   gere a equipe técnica. Não é um segundo chamado: não infla `chamados`, não
   duplica indicador, e a decisão já tem onde ser gravada
   (`faturamento_status`). Precisa de: a lente em `features/home/lentes.ts` /
   `atividades/modelo.ts`, e a regra de **quem recebe** (Q1: gestor da equipe
   técnica).
2. **A vista única do executado** (`features/chamados/PainelValidacao.tsx`):
   cliente · técnico(s) e apoio · início e fim · diagnóstico · serviço
   executado · **equipamentos fornecidos e retirados** (as peças com direção)
   · fotos antes/depois · assinatura · visitas afirmadas.
3. **A decisão**: valor, parcelas (a MESMA `parcelar()` da grade),
   **descrição sugerida pelo sistema** (função pura a partir do tipo e das
   peças: "Manutenção corretiva — fornecimento de 1× fechadura eletroímã (fora
   de contrato)"), e os dois botões: **Concluir e lançar cobrança** /
   **Concluir sem cobrar** — pela porta `concluir_chamado_com_cobranca` que
   já existe. SAC não vê a parte de valor (R13).
4. **O aviso**: notificação ao gestor quando o técnico conclui (gatilho —
   **migration**), e o card some quando a decisão é tomada.
5. **Quem decidiu, quando**: conferir se a porta já grava autor/instante da
   decisão; se não, colunas `conferido_por`/`conferido_em` na mesma migration.

**Depende de.** Q1 respondida. **Migration:** sim (aviso + autoria).

### Fase D — A ficha do cliente como centro (R128) — *2 sessões*

1. **Cobranças na ficha** — seção "Cobranças" (fechada por quem vê valores),
   com competência, valor, status e o chamado de origem. Hoje ausente.
2. **Sistemas**: catálogo de tipos ampliado ("Porta de vidro com acesso ao
   hall" não cabe em nenhum dos oito; Q6 traz a lista completa) — **migration**
   no CHECK de `cliente_sistemas.tipo`. Situação do sistema: `em_implantacao`
   → `ativo` → `removido` (hoje é só `ativo` booleano) — para a preventiva não
   revisar o que ainda não foi instalado.
3. **Contrato**: atalho de upload a partir da ficha (o fluxo `/contratos/novo`
   já existe) e o **regime por equipamento** — comodato com doação, locação,
   venda — legível na ficha e usado pela análise de cobertura (Q4 decide a
   modelagem; hoje é `modalidade` por contrato + cobertura por item).
4. **Equipamentos**: a seção passa a se declarar **espelho do QAP** — enquanto
   o conector não existe, mostra o que veio da planilha e diz a data.

**Depende de.** Q4, Q6. **Migration:** sim.

### Fase E — Administrativo → APIs, e o conector do QAP (R129) — *2–3 sessões + dependência externa*

1. **A aba APIs** no Painel Administrativo: tabela `integracoes` (nome, tipo,
   endereço base, situação, última sincronização, último erro). A credencial
   **nunca** vai para o banco em texto: fica em segredo da Edge Function (como
   a `ANTHROPIC_API_KEY` hoje).
2. **O conector QAP — só leitura**: Edge Function `sincronizar-qap` que puxa
   **clientes** (casa por CNPJ → `clientes.documento`/`qap_cliente_id`;
   preenche razão social, nome fantasia, endereço) e **equipamentos por
   cliente** (→ `cliente_equipamentos` + `cliente_equipamento_unidades` com
   `qap_unidade_id`). Botão "Sincronizar agora" e agendamento diário. Log por
   execução.
3. **Fallback declarado**: se a API do QAP não estiver disponível a tempo, a
   mesma função aceita o **export em arquivo** com a mesma estrutura — o
   caminho da U24, agora pela aba APIs.

**Depende de.** Q7 (documentação e credenciais da API do QAP). **Migration:** sim.

### Fase F — Preventiva por sistema (R127) — *1–2 sessões*

Periodicidade por sistema cadastrado (mensal, trimestral, semestral, anual);
tela "Preventivas do mês" gerando os chamados a partir dos sistemas vencidos
(gesto do gestor, nunca automático em silêncio); checklist por tipo de sistema
já existe (`montarChecklistPreventiva`) — passa a ser por **sistema
cadastrado**, não por tipo. **Depende de** D.2. **Migration:** sim
(periodicidade e última preventiva por sistema).

### Fase G — O corte do Gestor OS — *1 sessão + a data*

Script de migração a partir do export do Vinicius: clientes (casamento
**assistido** por CNPJ, sem fusão automática), contratos e cobertura,
cobranças e fechamentos históricos preservando referência e status, com
`legacy_id`. Importação em lote **desliga as notificações**. Data de corte
combinada com o Vinicius; a partir dela, nada novo lá. **Depende de** A–D
prontas e do export.

### Transversal

- Manual (`docs/manual/operacao-campo.md`, `financeiro.md`, `clientes-qap.md`)
  atualizado em cada fase, na mesma leva.
- Onboarding do Vinicius: ele já é admin; a primeira semana com o app aberto
  ao lado do Gestor OS é a rodada de correção de cada fase.

## 4. Perguntas em aberto — para o Davi responder

- **Q1 — A forma da atividade de validação.** Card **derivado** do estado do
  chamado (recomendado) ou chamado interno criado por gatilho? E **quem
  recebe**: todo admin/gestor com `equipe = tecnica`, ou uma configuração
  "gestor responsável pela equipe técnica"?
- **Q2 — Vistoria.** A R112 a descreveu como "ir ao cliente só para olhar"; o
  Davi a descreveu como o Vinicius **validando o trabalho dos técnicos**. É a
  mesma coisa vista de dois lados (a validação pode ser em loco), ou a
  vistoria deve nascer **da** atividade de validação ("validar em loco")?
- **Q3 — `operacional`.** Entrega de controle remoto, cadastro, tarefa miúda
  de campo: continua sendo tipo de chamado da equipe técnica e contando nos
  indicadores dela?
- **Q4 — O regime do equipamento no contrato.** "Comodato com doação",
  locação, venda, e "manutenção inclusa" — modelar como **regime por
  equipamento coberto** (em `contrato_cobertura_itens`), mantendo a
  `modalidade` do contrato como resumo? A extração por IA já lê o PDF inteiro;
  o que muda é o que ela devolve.
- **Q5 — Rubia.** Papel e equipe (ela está na lista de quem tem demandas
  gerais, mas não está em "quem é quem").
- **Q6 — Os sistemas que a Prever instala.** Lista completa para o catálogo
  (hoje: eclusa de pedestres, eclusa veicular, CFTV, alarme, cerca elétrica,
  central de portaria remota, elevadores, totem, outro). "Porta de vidro com
  acesso ao hall" pede um tipo de **controle de acesso de porta**.
- **Q7 — A API do QAP.** Há documentação e credencial? Qual chave casa o
  cliente (CNPJ)? Frequência de sincronização (diária basta?).
- **Q8 — A descrição sugerida da cobrança.** Padrão do texto: "Manutenção
  corretiva — fornecimento de 1× <peça> (fora de contrato)"? E o
  `tipo_servico` padrão: instalação para implantação, manutenção para o resto?
- **Q9 — "A cobrar este mês".** Fase A assume: **competência do mês corrente,
  todas as cobranças não canceladas**, com o detalhe de quantas ainda estão
  em aberto. É isso, ou só as ainda não faturadas?
- **Q10 — Progresso da implantação.** Fase A assume: o preenchimento é
  **fases concluídas** (marcadas pelo gestor, R120) e a marca é o **plano**
  (dias úteis decorridos). O técnico deve poder marcar fase concluída?

## 5. Riscos

- **Ordem de deploy** (regra 6 do diário): toda fase com migration roda a
  migration ANTES do push, ou a tela nomeia objeto que não existe.
- **A API do QAP** é a única dependência externa; por isso a Fase E tem
  fallback por arquivo e não bloqueia a v0.1.
- **O verificador** hoje trava o layout do painel (R67–R69) em asserções
  literais; a Fase A as substitui pelas da R125 — e as igualdades
  "quem conta é quem filtra" continuam CRÍTICO.
- **Vocabulário**: seis colisões já aconteceram (equipe, modalidade, visita
  técnica, operacional, etapa, bloco). Toda palavra nova passa pelo glossário
  do `CONTEXTO_OPERACAO_TECNICA.md` §7 antes de virar coluna.

## 6. Acompanhamento

- [x] Fase A — dashboard (U93)
- [x] Fase B — o "+" (U93)
- [ ] Fase C — validação do gestor
- [ ] Fase D — ficha do cliente
- [ ] Fase E — APIs e QAP
- [ ] Fase F — preventiva por sistema
- [ ] Fase G — corte do Gestor OS

## 7. A revisão de telas (03/09, à tarde)

A revisão completa está em `REVISAO_2026-09-03.md`: veredito por rota, oito
achados transversais e as perguntas **Q11–Q17** (a triagem e o técnico, valores
na visita, legado a matar, o nome de "Histórico", a guarda do Catálogo, blocos
editáveis, o importador do Notion). O que o Davi já decidiu virou **R131–R133**
e foi entregue na U94: Administrativo com abas, contratos na ficha, calendário
semanal. As respostas às Q11–Q17 entram como passos curtos da Fase D ou como
limpeza antes da Fase G.
