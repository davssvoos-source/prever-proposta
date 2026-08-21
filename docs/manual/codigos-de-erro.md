# Códigos de erro — como ler e como usar

> Manual Prever Proposta — segmento: códigos de erro. Gerado em 2026-08-21.
> Fonte de verdade: `src/lib/erros.ts`; se este documento discordar dele, ele
> ganha.

## Para que serve

Quando uma página não carrega ou uma ação falha, a tela mostra um **código**.
O código sozinho diz **onde** quebrou, **que tipo** de problema é e **qual** o
erro de origem — o suficiente para começar a investigar sem reproduzir.

## Como ler o código

```
PRV-CLI-PERM-42501
│   │   │    └── ORIGEM — o código real de quem falhou (Postgres, PostgREST,
│   │   │        HTTP) ou um hash curto e estável da mensagem
│   │   └── CLASSE — que tipo de problema é (as 7 abaixo)
│   └── ÁREA — que parte do sistema (vem da rota)
└── prefixo fixo, para reconhecer o código num print
```

Leitura do exemplo: **Clientes · permissão negada · Postgres 42501
(privilégio insuficiente)** → é RLS, não bug de tela.

### As 7 classes

| Classe | Significa | Quem resolve |
|---|---|---|
| **REDE** | não chegou no servidor (sem sinal, timeout) | a pessoa (conexão) |
| **AUTH** | sessão expirou | a pessoa (entrar de novo) |
| **PERM** | identificado, mas sem acesso (RLS) | admin, em Permissões |
| **DADO** | o banco recusou o dado (obrigatório, duplicado, FK) | quem preencheu |
| **ESQM** | **o banco não tem o que o app pede — migration pendente** | rodar a migration |
| **ROTA** | endereço não existe | link errado/antigo |
| **APP** | quebrou no navegador | é bug nosso |

**ESQM é a classe mais valiosa neste projeto.** Como as migrations são
rodadas à mão no SQL Editor, "esqueci de rodar" é uma falha real e frequente
— e ela agora se anuncia com todas as letras ("O banco está desatualizado")
em vez de virar tela branca.

### As siglas de área

`INI` Início · `CHM` Chamados · `CLI` Clientes · `GER` Comercial (/gerencial)
· `PSP` Prospecção · `POP` Painel Operacional · `PAD` Painel Administrativo ·
`PNL` outros painéis · `VIS` Visita/orçamento · `CTR` Contratos · `FEC`
Fechamentos · `CAL` Calendário · `HIS` Histórico · `MAP` Mapa · `PER`
Permissões · `USU` Usuários · `PRF` Perfil · `ADM` Admin · `AUT` Login ·
`APP` rota desconhecida.

## O que a pessoa vê

Uma tela com, nesta ordem: **o que houve** em linguagem de gente, **o que
fazer agora**, e então o **código** com botão de copiar. O botão copia um
pacote pronto para o WhatsApp (código + título + mensagem crua + rota +
data/hora). O detalhe técnico fica num bloco fechado — à mão, mas fora do
caminho.

A faixa colorida no topo do card é semântica: azul = passageiro (rede,
sessão), amarelo = "não é aqui" (permissão, rota), vermelho = defeito a
corrigir (esquema, dado, app).

## Onde os erros são capturados

1. **Rota que não carrega** → `errorComponent` em `src/routes/__root.tsx`.
2. **Endereço inexistente** → `notFoundComponent` (fabrica um erro com
   `status: 404` para sair com código também).
3. **Toda consulta e toda gravação** → `QueryCache`/`MutationCache` em
   `src/router.tsx`. É um funil único: sem ele, dar código às ~133 chamadas de
   `toast.error` exigiria editar 133 arquivos e esquecer o 134º.

Em todos os casos **o console recebe o mesmo código que a tela mostra**
(`[PRV-...]`), então print do usuário e log do navegador se cruzam.

## Procedimento: quando chegar um código

1. Leia a **classe** — ela já decide o caminho (PERM → matriz de permissões;
   ESQM → migration; APP → código).
2. Leia a **origem** — se for SQLSTATE (5 dígitos) ou PGRST*, procure o
   significado; ele nomeia o objeto exato que faltou/recusou.
3. Leia a **área** — `grep` na rota correspondente.
4. Peça o pacote copiado se precisar da mensagem crua.

## Práticas

- **Erro novo com classe própria?** Adicione a classe em `ClasseErro`, o texto
  em `EXPLICACAO` (título + o que houve + o que fazer) e a asserção. Há
  asserção exigindo que TODA classe tenha os três textos — classe sem texto
  renderiza tela vazia.
- **Não invente códigos nossos** para o que Postgres/PostgREST já codifica: a
  origem é carregada, não traduzida. Dicionário próprio envelhece e vira
  "ERRO_7".
- **Mensagem nova não pode mudar o código de uma falha conhecida**: ids, datas
  e números são normalizados antes do hash, justamente para o código ser
  estável entre ocorrências (há asserção).
- Em mutação com `onError` próprio, deixe a mensagem específica da ação — o
  código já vai para o console; dois toasts para a mesma falha viram ruído.

## Referências

- `src/lib/erros.ts` — taxonomia, classificação, hash estável
- `src/components/TelaDeErro.tsx` — a tela
- `src/router.tsx` — o funil de consultas e gravações
- `scripts/verificar-logica.cjs` — a seção U31 (classificação testada com os
  erros reais do Supabase)
