# Domínio comercial — da prospecção à resposta do cliente

> Manual Prever Proposta — segmento: comercial. Gerado em 2026-08-21 a partir
> de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md; se este
> documento discordar deles, eles ganham.

## Para que serve este documento

Descreve o funil comercial inteiro — visita, orçamento, aprovação, proposta,
resposta — e as regras que impedem os enganos clássicos do segmento (achar que
visita aprovada é venda; achar que proposta cria cliente).

## O funil, na ordem em que acontece

1. **Visita técnica é agendada** — pelo comercial ou pelo SAC (R24/R26: o SAC
   agenda a visita de proposta pela triagem). Nasce em `/gerencial/nova`.
2. **O técnico faz a visita** — fotos, levantamento. A visita é um chamado
   para ele (R12): aparece na Início dele como qualquer trabalho.
3. **Orçamento por blocos** — wizard em `/visita/$id/orcamento/*`
   (categorias → blocos por categoria → complementos → pré-envio →
   pagamento). Regras de negócio do orçamento: **cabos por bloco**, **7
   serviços propostos**, **totem é sempre locação 24 meses**.
4. **Aprovação INTERNA** — o comercial/gestor aprova a visita
   (`status = aprovada`). Isso é decisão NOSSA (R4).
5. **Proposta gerada e enviada** — .docx montado por
   `src/features/proposta/gerarProposta.ts` (+ `src/lib/proposta.functions.ts`),
   na página de Formas de Pagamento. `proposta_enviada_em` marca o envio.
6. **O CLIENTE responde** — `proposta_resultado` = `aceita` | `recusada`.
   Só aqui o negócio fecha ou não.
7. **Aceita?** O cliente é criado **no QAP**, nunca no app (R21). O que a U8
   faz é promover a *situação* de um cliente já existente — não há INSERT.

## As regras que não se pode violar

- **R4 — aprovada ≠ ganho.** Nenhuma lógica de "negócio fechado" pode olhar
  `status = 'aprovada'`. O desfecho é `proposta_resultado`.
- **R21 — cliente nasce no QAP.** O app não tem criação nem consolidação de
  cliente (as telas `/clientes/novo` e `/clientes/migrar` estão desativadas
  no catálogo de telas de propósito).
- **R22 — prospecto não é cliente.** Prédio orçado que ainda não aceitou vive
  na janela **Prospecção** (`/prospeccao`, dados em
  `src/features/prospeccao/data.ts`, colunas `proposta_*` da U8).
- **R23 — proposta também se faz para cliente existente.** Nesse caso o
  chamado da proposta é **vinculado** ao cliente da base.
- **R29 — a proposta É um chamado** (natureza `comercial`, tipo
  `proposta_comercial`, número CH-). Ver "Arquitetura" abaixo.
- **R32 — `/gerencial` é o Painel Comercial.** Funil em cima, lista embaixo,
  botões só do domínio (Prospecção, Mapa, Histórico, Clientes). Contratos/
  Fechamentos/Usuários/Permissões são do Painel Administrativo.

## Arquitetura: visita como satélite do chamado (U29)

A tabela `visitas_tecnicas` **não foi desmontada** quando a proposta virou
chamado. Ela é satélite 1:1: o chamado-capa tem **o mesmo id** da visita
(técnica da U7/U9), então os nove satélites do fluxo (blocos, orçamentos,
fotos…) não precisaram de rewrite de FK.

- A capa (`chamados`) dá número, prioridade, presença no Kanban.
- O corpo (`visitas_tecnicas`) continua dono do fluxo: `/visita/$id`, wizard,
  geração da proposta — nada disso mudou na U29.
- Um **trigger** (`trg_sincronizar_chamado_da_visita`, migration U29) mantém a
  capa em dia com o funil. A tradução status→coluna do trigger espelha
  `colunaDaVisita()` do app — **se mudar uma, mude a outra**, senão o card
  muda de coluna ao recarregar a página.
- **Permissão:** o chamado comercial NÃO herda "sem responsável é de todos" —
  a capa não pode ser mais frouxa que o corpo (a visita sempre foi restrita a
  dono/gestor). A policy trata `natureza = 'comercial'` à parte.

Vocabulário do funil: `src/lib/visita-status.ts` (status crus → buckets
`pendente`/`aguardando_aprovacao`/etc.) e `src/lib/visita-route.ts` (que tela
abre cada status). A lista em `/gerencial` usa `visitaRouteFor(status, id)`.

## O formato real da proposta (.docx)

Convenções extraídas dos 5 PDFs finais de referência (decisões de 2026-08-15,
memória do projeto `proposta_formato_real`):

- Número da proposta **com pontos** (ex.: 2.026.xxx).
- **Título curto** do serviço.
- Compra **parcelada** como forma padrão apresentada.
- PR 12H com **2 links** (o padrão dos serviços de portaria remota).
- Totem: **sempre locação 24 meses** — nunca venda.

Se for mexer na geração: `src/features/proposta/gerarProposta.ts`. Compare o
resultado com um dos PDFs reais antes de dar por pronto.

## Procedimentos

**Criar uma visita/proposta:** `/gerencial` → FAB "+" (ou "Nova visita" no
menu do painel) → preencher → ela aparece na lista, no funil e na Início do
técnico designado.

**Acompanhar o funil:** `/gerencial` mostra Visitas → Aprovadas → Enviadas →
Aceitas / Recusadas. A frase no rodapé do funil existe por causa da R4 e deve
permanecer: *"Visita aprovada é aprovação interna. Cliente de verdade é o que
aceitou a proposta."*

**Excluir visita:** só admin (botão de lixeira na lista). A exclusão hoje
apaga na ordem: itens de bloco → blocos → fotos → orçamentos → visita (o
`ON DELETE CASCADE` da capa U29 cobre o chamado).

## Anti-práticas

- Ligar qualquer métrica de receita/vitória a `status = 'aprovada'` (R4).
- Criar cliente a partir de proposta aceita (R21 — não existe e não deve
  existir INSERT em `clientes` no app).
- Duplicar a tradução status→coluna fora de `colunaDaVisita()`/trigger U29.
- Recolocar botões de domínio administrativo no `/gerencial` (foi a
  reclamação que gerou a R32).

## Referências

- `docs/PRODUTO.md` — R4, R21–R25, R29, R32
- `src/routes/_authenticated/gerencial.tsx` — a página do domínio
- `src/features/prospeccao/` · `src/features/proposta/` · `src/features/orcamento/`
- `supabase/migrations/20260821160000_u29_proposta_e_chamado.sql`
