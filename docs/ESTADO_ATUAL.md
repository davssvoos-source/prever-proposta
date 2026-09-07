# Estado atual do projeto — leia isto primeiro

> **Para que serve.** Este arquivo é a memória do projeto que viaja com o
> repositório. Numa máquina nova (ou numa sessão nova do assistente, que
> começa sem memória local) ele responde em cinco minutos: onde estamos, o
> que está pendente, o que o Davi já decidiu e o que ele ainda vai mandar.
> **Atualize-o no fim de cada entrega** — é o passo 7 do ciclo de trabalho em
> `CLAUDE.md`. Se ele discordar do código ou de `docs/PRODUTO.md`, eles
> ganham — e isto aqui se corrige.

Última atualização: **2026-09-04** · última regra: **R173** · último diário:
**U100b** · verificador: **2.890+ asserções, 0 falharam** · `tsc`: baseline
**57** · migrations rodadas até a **U100**; **nenhuma pendente**.

---

## 1. O sistema em um parágrafo

**Prever Proposta** é o sistema interno do Grupo Prever (segurança
eletrônica: portaria remota, monitoramento, controle de acesso). Nasceu como
ferramenta de orçamento/proposta comercial e virou o sistema de **atividades**
da empresa: chamados técnicos de campo (a dupla vai ao cliente), atividades
internas das outras equipes (T.I., controle patrimonial, comercial),
propostas comerciais, clientes e seus equipamentos, contratos, cobrança e
painéis. Substitui o Notion e o Gestor OS. React + TypeScript + TanStack
Start, Supabase (Postgres com RLS), deploy automático pela Lovable a cada push
em `main`. O usuário que dita as regras é o **Davi**; o gestor da equipe
técnica de campo é o **Vinicius**.

## 2. A ordem de leitura

1. `CLAUDE.md` — o método (ciclo de trabalho, migrations, invariantes,
   armadilhas). Cinco minutos.
2. **Este arquivo** — onde estamos.
3. `docs/CONTEXTO_OPERACAO_TECNICA.md` — a operação técnica ditada pelo Davi:
   quem é quem, as três atividades da técnica, a validação do gestor.
4. `docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md` — a estrutura das atividades
   ditada pelo Davi: os tipos de demanda, a matriz de campos, as decisões
   D1–D9 (várias já revistas — ler as notas).
5. `docs/PLANO_V0.1.md` — o plano por fases e as perguntas Q1–Q23 com as
   respostas anotadas.
6. `docs/PRODUTO.md` — TODAS as regras (R1–R173). Não se lê de ponta a ponta:
   consulta-se pela regra citada no código.
7. `docs/manual/README.md` — o manual por segmento; ler o do segmento em que
   se vai trabalhar.
8. `docs/PLANO_UNIFICACAO.md` — o diário (U1–U100). É onde está o PORQUÊ de
   cada decisão técnica; ler a entrada citada quando um trecho de código
   parecer estranho.

## 3. Onde estamos (04/09/2026)

**Fases do plano** (`PLANO_V0.1.md` §6): A (dashboard da Operacional
Técnica) e B (o "+") entregues na U93; o núcleo da H (a estrutura das
atividades, R137–R150) na U96. Pendentes: **B2** (a Início do técnico no
celular), **C** (a validação do gestor — agora com a forma decidida, R155),
**D** (a ficha do cliente como centro), **E** (APIs e QAP), **F** (preventiva
por sistema), **G** (o corte do Gestor OS), **H.1–H.6**.

**O que foi entregue em 03–04/09/2026**, uma linha por leva:

| Leva | O quê |
|---|---|
| U93 | dashboard da Operacional Técnica (R125) e o "+" (R126) |
| U94 | Administrativo com abas (R131), contratos na ficha (R132), calendário mensal/semanal (R133) |
| U95 | mapa de aparelhos (R134), tela da atividade com seletores e editor (R135) |
| U96 | cards da Início com a cor só na borda (R136); a estrutura das atividades (R137–R150); migration U96 |
| U97 | mais de um cliente por atividade (R151), arrastar no calendário muda o prazo (R152), card da semana enxuto (R153), tema claro v10 (R154) |
| U97b–U99 | as respostas do Davi às Q1–Q22 viram R155–R172; migration U99 (limpeza, catálogo, `data_agendada`) |
| U100 | portaria autônoma e presencial como grupos de clientes (R173); migration U100; este arquivo |
| U100b | a U100 rodou: os quatro grupos liberados (P58); o fallback da ordem de deploy da U96 saiu (P60); `data_agendada` já é lida; revisão do dia |

## 4. Banco: migrations

O repo **nunca aplica** migration: o Davi roda à mão no SQL Editor do
Supabase, na ordem dos nomes de arquivo (`supabase/migrations/`). Cada uma é
idempotente e termina com uma conferência obtido × esperado × veredito.

- **Rodadas até a U100** (confirmado pelo Davi em 04/09/2026). **Nenhuma
  migration pendente.**
- **O mecanismo da regra 5** (o push publica antes da migration rodar): uma
  coluna ou valor novo que dependa de CHECK nasce em duas listas — a que o app
  RENDERIZA e a que ele OFERECE para gravar (`TIPOS_SISTEMA_NAO_OFERECIDOS`
  em `inventario.ts`, `SERVICOS_NAO_OFERECIDOS` em `clientes/data.ts`,
  `NAO_OFERECIDOS` em `chamado-status.ts`). Hoje as três estão vazias; a
  próxima migration que trouxer um valor novo usa uma delas até o Davi rodar.
- A próxima migration provável é a **limpeza de schema** (P56: a coluna morta
  `chamados.sprint` e o gatilho que a preenche — exige reescrever o gatilho da
  linha do tempo, por isso não entrou de carona) e o que os fluxos da área
  técnica pedirem.

## 5. Decisões recentes que mudam o rumo (04/09/2026)

Todas em `PRODUTO.md`, com a frase do Davi. As que reorganizam o trabalho:

- **R155** — a validação do executado é uma **atividade do Vinicius**, com
  card na Início dele; a proposta comercial passa do técnico para o Davi
  depois da visita (card na Início dele).
- **R156** — a área técnica tem só **corretiva, preventiva e implantação**;
  "Operacional" é das outras equipes; **vistoria = validação** (a R112 será
  reescrita com os fluxos).
- **R157** — regime de equipamento é o do **contrato do condomínio**; exceções
  no contrato; nada por equipamento.
- **R161** — "A cobrar este mês" é só o que **falta faturar**.
- **R162** — o técnico dá baixa; o gestor **valida** — dois estados.
- **R163** — o técnico de campo **não abre chamado** (por enquanto); o "+" dele
  é a porta do plantão.
- **R168** — a atividade interna tem **data agendada** além do prazo e o
  quadro ganha a coluna **"Agendados"** (coluna do banco pronta na U99; a tela
  vem com os fluxos).
- **R169** — a **preventiva TEM impacto operacional** (D1 revista).
- **R170** — Visita Técnica e Proposta Comercial são **duas atividades** no
  mesmo fluxo (D5 revista): a visita feita gera a proposta para o Davi.
- **R172** — a visita comercial **trava a agenda** do técnico (Fase H.1).
- **R173** — **Portaria Autônoma** e **Portaria Presencial** são grupos de
  clientes, ao lado de Portaria Remota e Monitoramento.

## 6. Perguntas em aberto

Das 23 perguntas do plano, ficam duas:

- **Q8** — o texto padrão da cobrança sugerida e o `tipo_servico` padrão.
  Adiada pelo Davi: "preciso do Vinicius para entender melhor isso".
- **Q13** — as três telas legadas (`/projeto/$id`, `/visita/$id/pendente`,
  `/gerencial/visita/$id/editar`): o Davi quer vê-las antes de decidir. Os
  endereços estão anotados na Q13 de `REVISAO_2026-09-03.md`.

## 7. O que o Davi disse que vai mandar (cobrar dele)

1. **A estrutura dos fluxos de cada tipo de demanda da área técnica** —
   corretiva, preventiva, implantação: campos de cada um e o caminho. **É o
   próximo passo**: destrava B2 (Início do técnico), C (validação, R155/R162),
   H.1 (mini-calendário e a visita que trava a agenda, R172), a tela da data
   agendada (R168), a proposta em duas atividades (R170) e a revisão da lista
   de tipos do chamado de campo (`TIPOS_DA_NATUREZA.campo`, R156).
2. **A relação tipo de atividade → impacto operacional**, para automatizar
   (hoje é escolha de quem cria, R142/R169).
3. **Os documentos exportados do ERP com os equipamentos por cliente** (Fase
   H.5) — depois vem a API do QAP (R160: diária + botão Sincronizar; contato:
   Lopes, desenvolvedor do QAP ERP; só quando o sistema estiver redondo).
4. **A leitura da proposta aprovada (PDF) pela IA** para criar as atividades
   da implantação (R148, H.6).

## 8. Quem é quem (resumo — o completo está em `CONTEXTO_OPERACAO_TECNICA.md` §1)

| Pessoa | Papel | Cargo no app |
|---|---|---|
| Davi | dono do produto; dita as regras; aprova e envia propostas | admin |
| Vinicius | gestor da equipe técnica de campo; valida o executado e lança cobrança | admin |
| Rubia | supervisora do atendimento da Portaria Remota; abre e gerencia chamados (R158) | sac |
| Erik, Nicholas | T.I. | tecnico (equipe T.I.) |
| Gilleno | Controle Patrimonial (opera o QAP ERP) | tecnico (equipe Controle Patrimonial) |
| Breno e os líderes das duplas | técnicos de campo | tecnico |
| Lopes | desenvolvedor do QAP ERP (externo) — a integração, quando chegar a hora | — |

## 9. Como começar uma sessão

```bash
node scripts/verificar-logica.cjs        # tem de terminar "0 falharam"
npx vite build                           # tem de completar
npx tsc --noEmit | grep -c "error TS"    # baseline 57; não crie novos
```

Depois: `git status` limpo e `main` igual a `origin/main`; ler a §4 (há
migration pendente?) e a §7 (o que cobrar do Davi). Quando o Davi disser
"inicie a sessão", a resposta é o resumo destas seções, não um relatório.
