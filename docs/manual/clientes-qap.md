# Clientes e QAP — a base que vem de fora

> Manual Prever Proposta — segmento: clientes e QAP. Gerado em 2026-08-21 a
> partir de revisão do código. Fonte de verdade: o código e docs/PRODUTO.md;
> se este documento discordar deles, eles ganham.

## Para que serve este documento

Explica de onde a base de clientes vem (e de onde ela NÃO pode vir), como o
inventário de equipamentos se estrutura e como o mapa de São Paulo funciona.

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
