# O controle das viaturas — ditado pelo Davi em 13/09/2026

<!-- sumario:inicio -->
> **Sumário** — 7 seções. Gerado por `node scripts/sumario.cjs`; não edite à mão. Para ir a uma seção: `grep -n "^## <título>"` no arquivo.

- [1. O documento do Davi, na íntegra](#1-o-documento-do-davi-na-íntegra)
- [2. A leitura estruturada](#2-a-leitura-estruturada)
- [3. Glossário — as palavras que colidem, e como se fala aqui](#3-glossário-as-palavras-que-colidem-e-como-se-fala-aqui)
- [4. Decisões que o assistente tomou (o Davi confirma ou corrige)](#4-decisões-que-o-assistente-tomou-o-davi-confirma-ou-corrige)
- [5. O que o Davi disse que ainda vai mandar (pendências dele)](#5-o-que-o-davi-disse-que-ainda-vai-mandar-pendências-dele)
- [6. Perguntas abertas (Q24–Q27)](#6-perguntas-abertas-q24q27)
- [7. Onde está o quê (o mapa desta estrutura no código — U134)](#7-onde-está-o-quê-o-mapa-desta-estrutura-no-código-u134)
<!-- sumario:fim -->

Este documento existe para quem chega de fora entender **o que é o controle
de viaturas neste sistema** sem precisar de arqueologia. É a terceira fonte
de contexto ditada pelo Davi (as outras são `CONTEXTO_OPERACAO_TECNICA.md`,
sobre a operação técnica, e `CONTEXTO_ESTRUTURA_ATIVIDADES.md`, sobre as
atividades). O texto dele está transcrito na íntegra na seção 1; o resto é a
leitura estruturada que o sistema segue, as decisões que o assistente tomou
onde o texto admitia duas leituras, e o que ainda está em aberto.

As regras de produto que saíram daqui são a **R266 a R274** em
`docs/PRODUTO.md`. Este documento e as regras são a **U133** em
`docs/PLANO_UNIFICACAO.md`; a implementação (banco, tela do técnico, aba do
Administrativo, a chegada por localização) é a **U134** — construída em
13/09/2026, depois de o Davi responder as Q24–Q27 (§6). O mockup aprovado antes do código está em
`https://claude.ai/code/artifact/7a301e0f-95f1-4d88-a9fa-fcd2daed1ec4`.

> **Uma frase para guardar:** a etiqueta NFC no carro guarda um **endereço**;
> bipar abre a tela já sabendo de que carro se trata, e a tela decide sozinha
> se é hora de **iniciar** ou de **encerrar** um trecho — só pede o que falta,
> que é o km do painel. Cada deslocamento é **um trecho**; km rodado e tempo
> de deslocamento são **calculados**, nunca digitados.

---

## 1. O documento do Davi, na íntegra

Primeira mensagem (13/09/2026):

> Vamos criar um sistema onde faremos o controle da viatura utilizada pelo
> técnico
>
> O objetivo é controlar quem usou qual carro em que dia.
>
> Vou comprar NFC para colocar em um suporte que vou colocar em cada carro
>
> A minha ideia é a pessoa bipar para iniciar a viagem de ida a um cliente e
> bipar para encerrar, e ao iniciar inserir a kilometragem inicial e ao
> finalizar inserir a kilometragem final
>
> Quem utiliza isso são os técnicos de campo, que são os usuários que tem o
> cargo Técnico.
>
> Vamos desenvolver bem essa ideia e aplicá-la no aplicativo.

O assistente respondeu com um mockup e cinco perguntas — (1) a lista dos
carros; (2) se a viagem é um trecho ou o dia inteiro; (3) o que fazer quando o
km digitado é menor que o último registrado; (4) quem dirige além do técnico;
(5) se a atividade vinculada é opcional. As respostas, na íntegra:

> 1. Ok eu passo mas quero um espaço dentro do sistema, na tela do Painel
>    Administrativo para cadastrar viaturas e remover viaturas do sistema.
> 2. Cada trecho é um trecho, da sede ao cliente x, do cliente x ao cliente y,
>    do cliente y ao cliente z, do cliente z a sede...
> 3. Deixa passar com aviso
> 4. Por enquanto somente o técnico
> 5. Opcional, na verdade vamos até criar um sistema onde a partir do
>    endereço de cada cliente, quando o técnico fica mais de 2 minutos num
>    raio próximo do cliente, o sistema entende que ele chegou no cliente, e
>    sugere término da viagem.
>
> A ideia também é contar o tempo de ida entre clientes, o tempo de
> transporte em cada trecho.
>
> Gere o documento mestre com todas as regras, altere os atuais documentos
> que for necessário.

---

## 2. A leitura estruturada

### 2.1 O objetivo, em uma linha

**Quem usou qual carro, em que dia — e quanto rodou, e quanto tempo levou em
cada deslocamento.** O dado nasce no gesto do técnico (bipar, digitar o km)
e é lido pelo gestor numa folha. Nada é digitado duas vezes: km rodado e
tempo de deslocamento são calculados a partir do que foi registrado na saída
e na chegada.

### 2.2 Quem usa

- **Registra:** só quem tem **cargo TÉCNICO** (R263 — é quem trabalha na rua,
  pelo celular). "Por enquanto somente o técnico": o gestor não inicia
  viagem; se um dia o Vinicius ou um operacional dirigir, a regra muda com
  uma frase.
- **Lê a folha e cadastra os carros:** o **admin**, no Painel Administrativo
  — o Davi e o Vinicius.

### 2.3 A etiqueta e o gesto

Cada carro tem um **suporte com uma etiqueta NFC**. A etiqueta guarda um
**endereço** — `…/viatura/<código>` — e o código identifica a viatura no
cadastro (ex.: `fiorino-1`). O Android lê etiqueta NFC com endereço **sem
precisar de aplicativo**: com a tela desbloqueada, aproximar o celular abre
o endereço — no app Prever, quando o APK registrar o link (etapa 2), ou no
Chrome, já logado, hoje.

O gesto é o mesmo nas duas pontas: **bipar**. A tela que abre já sabe de que
carro se trata e **decide sozinha o estado** (§2.5): livre → pede o km e
inicia; em viagem sua → pede o km e encerra. O técnico digita **uma coisa**:
o km que o painel mostra.

A etiqueta é um **atalho, não uma exigência**: a mesma tela abre pela Início
do técnico (a faixa "Você está com a Fiorino…" enquanto há viagem aberta; um
atalho "Registrar viatura" quando não há) — para etiqueta descolada, celular
sem NFC, ou quando a pessoa esqueceu de bipar ao sair.

### 2.4 A viagem é um TRECHO

> "Cada trecho é um trecho, da sede ao cliente x, do cliente x ao cliente y,
> do cliente y ao cliente z, do cliente z a sede..."

Cada deslocamento é **uma viagem** com saída (instante, km, quem, qual carro)
e chegada (instante, km). A ida e a volta são trechos diferentes; três
clientes num dia são quatro trechos. A cadeia dos trechos do dia reconstrói
a rota, e o intervalo **entre** a chegada de um trecho e a saída do seguinte
é o tempo em que o técnico esteve no cliente (a **permanência**, derivada —
§4 D7).

O que a viagem registra:

| Campo | Quem preenche | Quando |
|---|---|---|
| viatura | a etiqueta (ou a escolha na lista) | na saída |
| técnico | a sessão | na saída |
| km de saída | o técnico digita | na saída |
| saída em | o relógio do servidor | na saída |
| atividade (opcional) | o técnico escolhe entre as dele de hoje | na saída |
| km de chegada | o técnico digita | na chegada |
| chegada em | o relógio do servidor | na chegada |
| **km rodados** | **calculado**: chegada − saída | — |
| **duração** | **calculado**: chegada − saída | — |
| aviso de km | o sistema marca (§2.6) | na saída |
| encerramento | normal · assumida por outro · corrigida pelo gestor | — |

### 2.5 A tela decide o estado

Ao abrir `…/viatura/<código>`, uma de três coisas:

1. **Livre** — nenhuma viagem aberta nesse carro. A tela mostra o carro, o
   último km registrado (e quem devolveu, quando), pede o **km no painel**,
   oferece a **atividade** (opcional) e tem um botão: **Iniciar viagem**.
2. **Em viagem — sua** — há uma viagem aberta nesse carro e é do técnico que
   bipou. A tela mostra a saída (hora, km, atividade), pede o **km no
   painel** — e enquanto ele digita mostra **"+N km nesta viagem"** — e tem um
   botão: **Encerrar viagem**.
3. **Em uso por um colega** — há uma viagem aberta nesse carro e é de outra
   pessoa. É o caso real de quem esqueceu de encerrar. A tela diz com quem e
   desde quando, e oferece **Assumir e iniciar viagem**: a viagem do colega é
   encerrada com o km que o técnico digitar, marcada **"assumida por Fulano
   às HH:MM"**, e a dele começa dali. Ninguém fica com o dia travado por
   causa do esquecimento de outro; a folha mostra quem assumiu de quem.

Duas invariantes sustentam isso, e o banco as garante: **um carro tem no
máximo uma viagem aberta**, e **um técnico tem no máximo uma viagem aberta**
(não se dirige dois carros ao mesmo tempo).

### 2.6 O km — e o aviso, não o bloqueio

> "Deixa passar com aviso"

O km de saída deveria ser maior ou igual ao último km de chegada registrado
para aquele carro — o odômetro só anda para a frente. Quando não é, o
sistema **não bloqueia**: a tela avisa ("O último registro desta viatura foi
100.500 km — confira o painel"), a viagem é gravada, e a folha do gestor a
marca com **"km abaixo do anterior — conferir"**. O km de chegada menor que
o de saída da mesma viagem também passa com o mesmo aviso e a mesma marca.

O **gestor corrige na folha**: quem corrigiu e quando ficam registrados na
própria viagem. É a mesma decisão da R262 (a data de conclusão corrigível,
com rastro): o dado errado é corrigido por quem tem a caneta, e a correção
não apaga o que foi digitado antes.

### 2.7 A atividade e o destino

A atividade é **opcional** na saída: a tela oferece as atividades do técnico
para hoje (as mesmas da Início dele) e "Sem atividade". Quando ele escolhe,
o **cliente da atividade é o destino do trecho** — é o que faz a folha
responder "para onde foi" e é o que a chegada por localização (§2.10) vai
usar para sugerir o encerramento.

### 2.8 O cadastro das viaturas — no Painel Administrativo

> "quero um espaço dentro do sistema, na tela do Painel Administrativo para
> cadastrar viaturas e remover viaturas do sistema."

O Painel Administrativo ganha a aba **Viaturas**, ao lado de Usuários ·
Permissões · APIs. Nela: **cadastrar** (placa, apelido — "Fiorino branca" —
e o **código da etiqueta**), **remover** e a **folha** (§2.9). Remover uma
viatura que já rodou **desativa**: ela sai da lista do técnico e da tela da
etiqueta, e as viagens dela continuam na folha — histórico não se apaga
(§4 D5). Apagar de verdade só quem nunca teve viagem.

### 2.9 A folha do gestor

Na mesma aba, a folha responde a pergunta do objetivo: **quem usou qual
carro em que dia**. Uma linha por trecho — dia, viatura, técnico, saída →
chegada, km de saída, km de chegada, **km rodados**, **duração**, atividade
(destino) —, com recorte por mês, por viatura e por técnico, os totais do
recorte (viagens, km rodados, tempo de deslocamento) e os totais **por
técnico** e **por viatura**. A viagem em aberto aparece destacada; a
"assumida" e a "km abaixo do anterior" vêm com a etiqueta delas. O gestor
corrige km ali (§2.6).

### 2.10 O tempo de deslocamento — e a chegada por localização

> "A ideia também é contar o tempo de ida entre clientes, o tempo de
> transporte em cada trecho."

A **duração do trecho** (chegada − saída) é o tempo de transporte, e a folha
a soma por dia e por técnico. Isso já nasce na etapa 1.

> "vamos até criar um sistema onde a partir do endereço de cada cliente,
> quando o técnico fica mais de 2 minutos num raio próximo do cliente, o
> sistema entende que ele chegou no cliente, e sugere término da viagem."

É a **etapa 3**, e o desenho já a prevê: enquanto o técnico tem uma viagem
aberta e o app está na frente, o celular informa a posição; se ele fica
**mais de 2 minutos** dentro de um **raio** do endereço do cliente da
atividade (ou de qualquer cliente com coordenada, quando não há atividade),
o sistema entende que ele **chegou** e **sugere** encerrar — "Você chegou ao
Cond. Eneide? Encerrar a viagem" —, nunca encerra sozinho, e o km continua
sendo digitado. A posição **não é gravada**: o que fica é a viagem, com a
chegada no instante em que a pessoa confirmou. Os clientes já têm
coordenada (`clientes.lat/lng`, geocodificadas pelo endereço); o que falta é
a sede como ponto (Q25) e o raio (Q24).

---

## 3. Glossário — as palavras que colidem, e como se fala aqui

| Palavra | Aqui significa | Não confundir com |
|---|---|---|
| **viatura** | o carro da empresa, cadastrado no Administrativo | a "dupla" (as pessoas), a "agenda" (o compromisso) |
| **etiqueta** | a etiqueta NFC no suporte do carro, com o endereço da viatura | o "código" da etiqueta (`fiorino-1`), que é o que identifica a viatura no cadastro |
| **viagem** / **trecho** | UM deslocamento, com saída e chegada — sede → cliente x é uma; x → y é outra | o dia de trabalho; a atividade |
| **km de saída / de chegada** | o que o painel mostra, digitado pelo técnico nas duas pontas | "km rodados", que é calculado |
| **km rodados** | chegada − saída, calculado | qualquer coisa digitada |
| **duração** / **tempo de deslocamento** | chegada − saída do trecho, calculado | a **permanência** (o tempo no cliente, entre trechos) |
| **assumir** | encerrar a viagem aberta de um colega com o km que eu digito, e começar a minha | "encerrar por ele" sem começar a minha (não existe) |
| **aviso de km** | a marca de "km abaixo do anterior — conferir" | um bloqueio (não bloqueia) |
| **folha** | o relatório do gestor na aba Viaturas | a "folha de plantão" do sobreaviso (outra coisa) |

---

## 4. Decisões que o assistente tomou (o Davi confirma ou corrige)

- **D1 — A etiqueta guarda um ENDEREÇO, não um número que o app lê.** O
  Android abre etiqueta NFC com URL sem aplicativo; ler NFC de dentro da
  página só funciona no Chrome (não na casca do APK) e exigiria um plugin
  nativo. Com o endereço, funciona hoje pelo Chrome logado e, na etapa 2,
  uma linha no manifesto do APK (App Link) faz abrir direto no app. Etiqueta
  **NTAG213** (144 bytes cabem no endereço) gravada com um app gratuito (NFC
  Tools). O suporte é de quem monta o carro.
- **D2 — O código da etiqueta é um nome estável escolhido no cadastro**
  (`fiorino-1`), separado da placa: a etiqueta está colada no carro e a
  placa pode ser digitada errada e corrigida sem regravar nada. Etiqueta
  perdida = gravar outra com o mesmo código.
- **D3 — Um carro tem no máximo uma viagem aberta; um técnico também.** São
  restrições no banco, não só na tela. "Assumir" é a única forma de abrir a
  minha quando a do colega está aberta no mesmo carro — e ela fecha a dele
  com marca e autoria.
- **D4 — Km fora de ordem passa e marca.** Pedido literal do Davi ("deixa
  passar com aviso"). A marca fica na viagem (`aviso_km`) e aparece na folha;
  o gestor corrige, e a correção registra quem e quando. A tela avisa antes
  de gravar, mas não impede.
- **D5 — "Remover viatura" é desativar quando ela já rodou.** A viagem
  aponta para a viatura; apagar a viatura apagaria a folha. Desativada, ela
  some das listas do técnico e da tela da etiqueta (bipar uma etiqueta de
  carro desativado diz isso), e continua na folha do passado. Apagar de
  verdade só quem nunca teve viagem — o botão muda de nome conforme o caso.
- **D6 — O destino do trecho é o cliente da atividade escolhida.** Sem
  atividade, o trecho fica "sem destino informado", e a chegada por
  localização (etapa 3) considera qualquer cliente com coordenada.
- **D7 — A permanência é derivada, não registrada.** O tempo no cliente é o
  intervalo entre a chegada de um trecho e a saída do seguinte do mesmo
  técnico no mesmo dia. A folha o mostra como informação; ninguém digita
  "cheguei" e "saí" duas vezes.
- **D8 — A chegada por localização SUGERE, nunca encerra.** Só com viagem
  aberta e o app em primeiro plano (na casca atual); raio proposto **150 m**
  (Q24); mais de **2 minutos** dentro dele; a sugestão é uma faixa na tela e
  um aviso; a posição não é gravada. Em segundo plano, com o app fechado, só
  com plugin nativo no APK — etapa própria, depois do App Link.
- **D9 — A folha mora na aba Viaturas do Administrativo, junto com o
  cadastro.** Uma casa só; o Vinicius é admin. A Operacional Técnica ganha um
  atalho para lá quando fizer sentido.
- **D10 — Todo logado LÊ viaturas e viagens; só as portas ESCREVEM.** É
  metadado operacional (não é dinheiro), e o técnico precisa ler a viagem
  do colega para a tela dizer "em uso por Nicholas". Iniciar/encerrar/assumir
  passam por funções do banco que exigem cargo técnico (R4: "por enquanto
  somente o técnico"); corrigir e cadastrar exigem admin.
- **D11 — Quem não é técnico e bipa a etiqueta** vê o estado do carro (livre
  / com quem) e um atalho para a folha — não inicia viagem.

---

## 5. O que o Davi disse que ainda vai mandar (pendências dele)

1. **A lista dos carros**: placa e apelido de cada um ("Ok eu passo"). Entram
   pelo cadastro da aba Viaturas — e ele grava as etiquetas com o código que
   o cadastro mostrar.

---

## 6. Perguntas abertas (Q24–Q27)

- **Q24 — O raio da chegada.** Proposta: 150 m do endereço do cliente (GPS
  urbano erra 10–30 m; condomínio grande tem portaria longe do centro do
  endereço). E conta só o cliente da atividade vinculada, ou qualquer
  cliente cadastrado?
  **Respondida (13/09/2026):** *"Serve, deve ser para todas as atividades que
  existem no dia para aquele usuário, pois existe a possibilidade de ele trocar
  a ordem dos chamados do dia."* → 150 m, e os destinos são TODAS as atividades
  do dia (R274, `destinosDoDia`).
- **Q25 — A sede como ponto.** "do cliente z à sede": para a chegada por
  localização sugerir encerrar na volta, a sede precisa de endereço e
  coordenada no cadastro. Qual é o endereço da sede?
  **Respondida (13/09/2026):** *"O endereço da sede é Rua Conde de Linhares,
  243 - Interlagos, São Paulo"* → semeada em `locais_de_referencia` (código
  `sede`) com o centro da rua no OSM; o ajuste fino é na aba Viaturas.
- **Q26 — Abastecimento.** Fica fora por enquanto (o Davi não pediu)? Se
  entrar um dia, é outro registro no carro (litros, valor, km), não um campo
  da viagem.
  **Respondida (13/09/2026):** *"Abastecimento é controlado no QAP ERP, não será
  inserido neste sistema que estamos desenvolvendo."* → fora.
- **Q27 — Localização sempre ligada nos celulares da empresa.** A etapa 3
  depende de o técnico permitir a localização no aparelho que a empresa vai
  entregar. É política a combinar antes de construir.
  **Respondida (13/09/2026):** *"Sim, vamos fornecer um celular para cada técnico,
  que terá a localização ligada do inicio do expediente ao término."* → a
  chegada por localização nasceu junto com a U134 (em primeiro plano; o segundo
  plano é plugin nativo, depois).

---

## 7. Onde está o quê (o mapa desta estrutura no código — U134)

| O quê | Onde (U134, construída em 13/09/2026) |
|---|---|
| as viaturas, as viagens e a sede | `viaturas`, `viagens_viatura`, `locais_de_referencia` (`supabase/migrations/20260930090000_u134_viaturas.sql`); os índices únicos parciais `viagens_uma_aberta_por_viatura` e `viagens_uma_aberta_por_tecnico` |
| iniciar / encerrar / assumir / corrigir | funções `viatura_iniciar_viagem`, `viatura_encerrar_viagem`, `viatura_corrigir_viagem` (SECURITY DEFINER, gate por cargo) |
| a lógica pura (estado da tela, km rodados, duração, permanência, aviso) | `src/features/viaturas/modelo.ts`, com asserção no verificador |
| a tela da etiqueta | rota `/viatura/$codigo` (`routes/_authenticated/viatura.$codigo.tsx`) → `src/features/viaturas/TelaDaViatura.tsx` (celular); `/viatura` é a lista para quando a etiqueta falha |
| a faixa e o atalho na Início do técnico | `src/features/viaturas/FaixaDaViatura.tsx`, dentro de `InicioDoTecnico.tsx` |
| o cadastro, a sede e a folha | Painel Administrativo › aba **Viaturas** — `src/features/viaturas/PainelDeViaturas.tsx` (a chave `painel.administrativo` já existia na matriz) |
| o endereço da etiqueta | `https://<app>/viatura/<código>` — o App Link no APK é a etapa 2 |
| a chegada por localização | `src/features/viaturas/useChegada.ts` (`watchPosition` só com viagem aberta e a página visível) + `destinosDoDia`/`avaliarChegada` em `modelo.ts` (150 m, 2 minutos) |

### As etapas

1. **U134 — banco + tela do técnico + faixa na Início + aba Viaturas + chegada por localização em primeiro plano.** ENTREGUE em 13/09/2026. Sem etiqueta funciona pela Início.
2. **App Link no APK** — a etiqueta passa a abrir direto no app Prever. Depende do APK (SDK nesta máquina, ou gerar em outra) e do arquivo `assetlinks.json` servido pelo endereço do app.
3. **Chegada por localização em SEGUNDO PLANO** (app fechado) — plugin nativo de geolocalização no APK. A de primeiro plano já está na U134.
