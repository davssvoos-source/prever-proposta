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
