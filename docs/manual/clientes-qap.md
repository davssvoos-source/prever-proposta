# Clientes e QAP — a base que vem de fora

> Manual Prever Proposta — segmento: clientes e QAP. Gerado em 2026-08-21 a
> partir de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md;
> se este documento discordar deles, eles ganham.

## Para que serve este documento

Explica de onde a base de clientes vem (e de onde ela NÃO pode vir), como o
inventário de equipamentos se estrutura e como o mapa de São Paulo funciona.

## LOCAL × cliente — a palavra certa (R84, U71)

**Nem todo local é cliente.** Desde 2026-08-26 o sistema chama de **LOCAL** o
lugar onde a atividade acontece, e ele tem três formas:

| Forma | Onde vive | Quem cria |
|---|---|---|
| **Cliente** | `clientes` | só o QAP (R21) |
| **Prospecção** | `prospeccoes` | o app pode (R22/R84) |
| **Setor** | etiqueta em `chamado_locais.setor` | o app |

A tabela de vínculo é `chamado_locais` (U71), que substituiu a
`chamado_clientes` da U45. Cada linha aponta para **exatamente uma** das três
formas — o banco garante com `num_nonnulls(...) = 1`, não a aplicação.

`chamados.cliente_id` **continua sendo o local principal** quando ele é
cliente: cobrança, matching, relatório e o trigger do contrato seguem lendo só
ele. A lista canônica é `[cliente_id, ...chamado_locais]`.

**O setor é etiqueta, não expansão.** "Enviar relatórios dos clientes de
Portaria Remota" grava UMA linha com `setor = 'portaria_remota'`, não oitenta
linhas de cliente. Quem precisa da lista expande na leitura, por
`servicos_prestados` — e aí ela reflete o cadastro de hoje.

**Os grupos são quatro desde a R173 (04/09/2026):** Portaria Remota,
Monitoramento de Alarmes, Portaria Autônoma e Portaria Presencial — a lista
única é `SERVICO_ORDEM` (`features/clientes/data.ts`), e os dois CHECKs do
banco (`clientes.servicos_prestados`, `chamado_locais.setor`) mudam juntos na
migration U100 (rodada em 04/09/2026 — os quatro se gravam; a lista
`SERVICOS_NAO_OFERECIDOS` que os segurava está vazia).

**Por que isto NÃO afrouxa a R21.** A R21 tranca `clientes` porque a tabela é
espelho do QAP e um sync futuro faz upsert (e algum dia delete) nela.
`prospeccoes` é o oposto: nasceu na U27 para guardar o que é nosso e o ERP não
conhece. A U71 abriu INSERT em `prospeccoes` para `authenticated` justamente
por isso — e deixou `clientes` sem policy de INSERT, como sempre esteve.

**Duas funções novas que valem conhecer:**

- `achar_ou_criar_prospeccao(nome)` — `SECURITY DEFINER`. A leitura de
  prospecção é restrita (ver abaixo), então uma busca de duplicata feita pelo
  cliente responderia "não existe" para um prédio que existe, e cada chamado
  criaria outro registro do mesmo lugar. A função enxerga a tabela inteira para
  decidir e devolve só um uuid.
- `pode_ver_prospeccao(id)` — gestor vê tudo; os demais veem a prospecção
  pendurada num chamado ou visita que já podem ver. Mesma forma de
  `pode_ver_cliente`, que a U71 também corrigiu para enxergar
  `chamado_locais` (era um furo desde a U45: técnico em chamado com cliente
  extra não via o cliente, e o card nascia com o local em branco).

## A regra que governa tudo: R21

**O cliente é do QAP, não nosso.** O ERP (QAP) é a fonte única de clientes e
equipamentos (R10). Consequências no código:

- Não existe INSERT em `clientes` no app. As telas `/clientes/novo` e
  `/clientes/migrar` estão **desativadas** no catálogo de telas (negadas para
  todos os papéis) — de propósito, com asserção cobrindo.
- Proposta aceita **não cria cliente** — a U8 apenas promove a *situação* de
  um cliente já existente (não há INSERT; já corrigimos comunicação errada
  sobre isso uma vez).
- Prospecto (prédio orçado que não é cliente) vive em **Prospecção** (R22).

## O estado atual da base

- **192 clientes** importados de uma planilha exportada do QAP (U24) — é um
  retrato **provisório**; a base está congelada nele.
- O futuro é o **botão Sincronizar** com a API do QAP. Bloqueado até a API
  existir. Quando for construído: o importador precisa rodar como
  **service_role** (S9 em PENDENCIAS_TECNICAS) — o RLS de escrita em
  `clientes` não abre para usuário comum.
- Coordenadas: na importação, a validação por BrasilAPI se mostrou inválida
  (ela devolve o centroide do município — 131 "desvios" eram o mesmo ponto).
  A validação que valeu foi por **agrupamento de prefixo de CEP**; 4 outliers
  reais foram corrigidos. Se reimportar, repita essa técnica, não a primeira.

## O inventário: 3 níveis

```
clientes
  └─ cliente_sistemas          (cliente_id)
       └─ cliente_equipamentos       (cliente_sistema_id)
            └─ cliente_equipamento_unidades  (cliente_equipamento_id)
```

O nível do meio **não tem** `cliente_id` direto — qualquer policy/consulta
que precise chegar ao cliente tem que atravessar a cadeia (foi exatamente o
erro que abortou a primeira versão da S1). RLS da cadeia inteira: migration
`20260820170000_s1_blindagem_rls.sql`.

## O mapa de São Paulo

`src/features/clientes/mapa-sp.ts` + `MapaClientes.tsx`:

- **47 distritos** da cidade desenhados como paths SVG — o recorte foi
  decidido pelo Davi em iterações (contorno rosa + lista de remoções). Não
  redesenhar sem pedido dele.
- `dentroDaCidade(lat, lng)` — ray-casting com bounding box por distrito.
  Asserções geográficas existem (Santana ao norte da Sé; Osasco fora) — mexeu
  no mapa, rode o verificador.
- Distritos em cinza neutro; **os pontos dos clientes** é que levam cor, por
  `corDoCliente()` (o degradê da casa).
- O rodapé tem **3 baldes** e a distinção importa (o rótulo já mentiu uma
  vez): `outraCidade` (cidade ≠ São Paulo), `recortados` (São Paulo, mas fora
  dos 47 distritos mantidos), e os plotados. Cliente de bairro removido do
  mapa **soma no contador**, não some da conta.

## Quem vê a base

Admin, comercial e SAC (decisão U24). O técnico chega no cliente **pelo
chamado dele** (o detalhe do cliente não é gateado), não pela lista. A leitura
da lista para usuário sem gestão é limitada pela policy da S1; o pedido sem
responsável tem leitura mais larga documentada como risco aceito (ver
`compra_valor_legivel_demais` / PENDENCIAS).

## Procedimentos

**Atualizar a base hoje (sem API):** exportar planilha do QAP → gerar
migration idempotente de upsert (modelo: U24) → Davi roda no SQL Editor →
conferir o SELECT de verificação (contagem esperada).

**Quando a API do QAP existir:** construir o Sincronizar como função
server-side com `service_role`; jamais abrir INSERT/UPDATE de `clientes` no
RLS para `authenticated`.

## Anti-práticas

- Criar cliente no app, por qualquer caminho (R21).
- Validar coordenada por geocoding de município (centroide engana).
- Policy no inventário assumindo `cliente_id` em todos os níveis.
- "Limpar" clientes fora do mapa — eles são contados, não descartados.

## Referências

- `docs/PRODUTO.md` — R10, R21, R22 · `docs/PENDENCIAS_TECNICAS.md` — S9
- `src/features/clientes/` · `supabase/migrations/20260820150000_u24_base_clientes.sql`

## A ficha em duas colunas, a fachada e o WhatsApp (R146, U96)

A ficha do cliente (`/clientes/$id`) é tela de computador: a coluna larga tem o
histórico (inventário, contratos, atividades, plantão, visitas) e a estreita a
identidade — a **foto da fachada** no topo, o **tipo de local** (Cond. Vertical,
Cond. Horizontal, Galpão, Residência), endereço, serviços prestados e os
contatos. Síndico e zelador têm nome, **WhatsApp** (abre o WhatsApp ao clicar)
e e-mail; residência e galpão chamam-nos de proprietário e encarregado(a).

A foto sobe pelo botão da própria ficha (gestor), para o bucket privado
`clientes-fachadas` (migration U96); a coluna `clientes.foto_fachada_url`
guarda o caminho (valores antigos com `http` continuam valendo como URL). Na
lista de clientes ela aparece sobreposta ao card pela direita, com transição de
opacidade. Ao escolher o cliente numa proposta comercial, a foto é herdada.

A seção **Atividades** da ficha passou a incluir as atividades de **grupo**
("Clientes de Portaria Remota") a que o cliente pertence e as em que ele é
local extra (R143) — marcadas como tal —, com teto declarado e "ver todas".

Desde a U112 (R203) a ficha é **uma página só**: não há tela nem modo de
configuração. Os cards **O local**, **Contatos** e **Estrutura** têm um lápis
(só para quem pode editar); a edição abre dentro do card, com Salvar e
Cancelar, e grava só os campos daquele card. As etiquetas de serviço prestado,
no cabeçalho, continuam sendo o próprio controle.

Na U114 a ficha passou a **preencher a largura da janela** (R205) — a coluna dos
sistemas cresce com o monitor, a da identidade tem teto — e os contatos
ganharam botões de ação (R207): **Enviar mensagem no WhatsApp** ao lado de cada
WhatsApp, **Copiar e-mail** ao lado de cada e-mail, e **Copiar endereço** no
card O local (copia endereço, complemento e cidade - UF numa linha).

## Patrimônio do QAP (R196–R199, U109)

O controle patrimonial da Prever é o **QAP ERP**, em *Patrimônio > Local/Uso*.
De lá vêm sete campos, e só eles: **almoxarifado, tipo de categoria (que é o
nome do equipamento no nosso formato), modelo, fabricante, identificação,
local/pessoa e data de envio**. A "Categoria" do QAP e a bolinha amarela
(quantos clientes o item já passou) ficam de fora por decisão do Davi.

**Onde cada coisa mora.** Os quatro campos que descrevem o MODELO viram uma
linha de `catalogo_equipamentos` — a tela **Equipamentos cadastrados**
(`/equipamentos`), o catálogo do sistema, onde os valores entram no passo
seguinte. Os três que descrevem o ITEM (identificação, local, data de envio)
viram uma linha de `equipamentos_patrimonio`, que aparece na **ficha do
cliente**, no bloco "Equipamentos no local".

**Identificação pode faltar** (R197) e o campo existe de qualquer jeito. Por
isso a chave que torna a importação repetível leva um **ordinal**: dez itens
iguais sem identificação, no mesmo prédio e no mesmo dia, são dez itens, e uma
chave "natural" os colapsaria num só.

**Local casa exato ou não casa** (R199). O texto do QAP fica sempre guardado;
quando ele bate com um cliente (nome ou nome do prédio) ou com uma pessoa
nossa, o item ganha o vínculo. Quando não bate, o item entra **sem** vínculo e
o local vai para `docs/importacao/locais-desconhecidos.md`, com sugestões
parecidas que ninguém aplica sozinho — pôr equipamento no prédio errado é pior
que deixá-lo sem prédio.

**Como a extração é feita.** A tela do QAP pagina de 50 em 50 (85 páginas para
4.241 itens), mas a página consome `GET /Material/Uso/Listar?page=N&buscar[acesso]=true&buscar[status]=300`,
que devolve o HTML já filtrado — é de lá que se lê, não do mouse. O parser sai
da ESTRUTURA da célula (cada uma empilha dois ou três valores), e o checkbox de
cada linha carrega o **id interno do item** (`value="28981"`), que vira a
chave `qap:<id>` da importação.

**Como refazer a importação.** O retrato cru do QAP fica em
`docs/importacao/qap-equipamentos.json`; `node
scripts/gerar-migration-equipamentos.cjs` regera a migration dos itens e a
prévia da relação de locais desconhecidos. As decisões com asserção em cima
(variação de catálogo, chave de importação, leitura de data) são do módulo puro
`src/features/equipamentos/importacao.ts`. O **vínculo com o cliente** é a
exceção e mora no SQL da migration: o UUID do cliente só existe no banco, e
casar contra a base VIVA no momento de rodar é melhor que casar contra um
retrato que já nasce velho. O casamento do SQL é mais estrito que o do módulo
(não ignora acento), então ele erra para o lado de "não vinculou".

## Sistemas instalados e o vínculo com os equipamentos (R200–R202 e R206, U111–U114)

Na ficha do cliente, **Sistemas instalados** é a lista de **blocos** do local —
a portaria social, o CFTV da garagem, a central de alarme. O bloco se cria no
app (**+ Bloco**: tipo, nome, descrição) ou vem do escopo da proposta aprovada
(**Importar do escopo**). O bloco é só **tipo e nome**: em cliente que já é
nosso não se responde às perguntas de estrutura do orçamento — "a estrutura
pula etapas, nós indicamos direto os equipamentos de cada bloco" (R202). Os
nomes que o Davi usou no Paineiras (eclusa de pedestres, porta de
carga/descarga, porta do armário de encomendas, eclusa veicular, CFTV, cerca
elétrica, totem de monitoramento, central de portaria remota) aparecem no
modal como sugestão de um clique. O código de bloco de quem veio do escopo
aprovado fica visível como informação.

Os **equipamentos** vêm do QAP (U110) e aparecem no painel **Sem bloco**, à
direita dos **Blocos** (R206). Para vincular, **arraste** o equipamento para o
bloco: o vínculo grava na hora. Marque vários (caixinha) e arraste um deles para
levar todos. Para mover, arraste de um bloco para outro; para desvincular,
arraste de volta para "Sem bloco" ou use o botão de desvincular na linha. Quem
não arrasta (teclado, celular) marca os equipamentos e escolhe o bloco no
seletor que aparece na barra. Excluir um bloco devolve os equipamentos dele a
"Sem bloco". O banco recusa vincular a um sistema de outro cliente.

O que foi **dimensionado na proposta** (o "previsto no orçamento") continua
visível dentro do bloco, ao lado do que está lá de verdade. O cadastro manual
de equipamento pela ficha saiu: equipamento é o do QAP.

**Quem pode vincular:** hoje, gestor com vínculo ativo (a policy de escrita do
patrimônio, U109). Um técnico que atende o cliente vê os equipamentos mas não
vincula — se o Vinicius for cadastrado como técnico, isso precisa mudar.
