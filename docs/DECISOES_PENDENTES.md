# O que depende do Davi — a lista única

> **Para que serve.** Tudo o que está parado esperando uma decisão, um gesto ou
> um dado do Davi, num lugar só. Antes deste arquivo (22/09/2026) a lista estava
> espalhada por quatro documentos — `ESTADO_ATUAL.md` §6 e §7, a seção da revisão
> sistêmica, `PENDENCIAS_TECNICAS.md` e `PLANO_V0.1.md` §4 —, e ninguém conseguia
> responder "o que falta de mim?" sem ler os quatro.
>
> **Como funciona.** Cada item diz o que é, **o que acontece enquanto ele não
> decide** (porque quase tudo tem um custo silencioso de esperar) e onde está o
> detalhe. Quando um item fecha, ele sai daqui e vira regra em `PRODUTO.md`.
> Os detalhes técnicos continuam em `PENDENCIAS_TECNICAS.md`; aqui fica só o que
> precisa da cabeça do Davi.

---

## 1. Gestos rápidos — minutos, e destravam gente parada

| # | O quê | Enquanto não fizer |
|---|---|---|
| **G1** | **Rodar a migration U155** no SQL Editor (`20261012090000_u155_o_operacional_le_a_base_de_clientes.sql`) | O **Erik e o Nicholas** continuam sem ver a maior parte dos clientes: o seletor de cliente da atividade nova vem podado (foi o defeito do Paineiras) e a tela Clientes também. Nenhuma tela muda com ela; muda o que o banco devolve. |
| **G2** | **Trocar o cargo do Vinicius** de Admin para **Gestor** em Administrativo → Usuários → editar | O cargo existe no banco desde a U154 e ninguém o usa. Sem a troca, a R304 está no ar sem efeito. **Atenção ao fazer:** no dia da troca ele deixa de receber os avisos automáticos (ver D6). |
| **G3** | **Conferir a variável `SITE_URL`** no serviço do servidor Windows (com o T.I.) | O e-mail de convite e o de "Reenviar convite" levam o convidado para o endereço da **Lovable**, não para o servidor da empresa. Some no dia em que a Lovable sair do ar. Detalhe: P76. |
| **G4** | **Instalar a v1.0.2 no servidor** (`dist-windows/Prever-1.0.2.zip`, já gerado) | O servidor continua na **v0.0.7**, de 08/09. Tudo o que foi feito de 08/09 a 17/09 só existe na Lovable. O comando está no manual: `.\atualizar.ps1 -Pacote "…\Prever-1.0.2"`. |

---

## 2. Decisões de produto — eu implemento depois que você decidir

### D1 · Ticket médio no Painel Comercial *(R302)*

O dashboard do Comercial tem quatro KPIs. O quinto que você pediu, **ticket
médio**, não entrou porque **o valor da proposta não é gravado em lugar nenhum**:
ele nasce na hora de gerar o PDF e morre ali.

**A decisão é: qual valor é o ticket?** Mensal recorrente, valor de implantação,
ou o total por forma de pagamento? A resposta define a coluna que eu crio e o
momento em que ela é gravada.

*Enquanto não decide:* o dashboard fica com quatro KPIs e o Comercial não tem
como responder "quanto vale a proposta média".

### D2 · Atividade com técnico de campo e operacional juntos

Sua pergunta de 17/09, antes das férias. Dois fatos que levantei então:

- O layout **nunca seguiu o cargo**. Segue a natureza da atividade: interna abre
  o editor de texto com checklist; campo abre fotos, assinatura, peças e cobrança.
- Hoje essa atividade mista **não é montável**: o seletor de pessoas do campo só
  oferece cargo técnico e admin. O Erik não aparece nem como apoio.

**Minha proposta:** o critério é *houve deslocamento ao prédio?* Se houve, é
campo e o T.I. entra como apoio. Se não, é interna e o técnico entra como apoio.
Não trocar layout por causa de quem está na atividade, porque a natureza liga e
desliga agenda, duplas, painel do Vinicius e **cobrança** — seguir sempre o
fluxo do operacional faria a atividade sair da agenda e não gerar dinheiro.

**A pergunta que é sua:** quando o Erik vai junto, ele está *apoiando o trabalho
do técnico* (uma atividade só) ou *fazendo o trabalho dele no mesmo local* (duas
atividades ligadas)? No CFTV, o técnico passa cabo e o T.I. configura o gravador:
provas diferentes, prazos diferentes. Eu me inclino por **duas atividades com
ligação visível**, mas é a sua operação.

*Enquanto não decide:* ninguém consegue pôr o T.I. numa atividade de campo.

### D3 · A revisão de tipografia — aplicar ou não *(R303, frente V)*

A auditoria está pronta: **66 desvios** de gravidade alta ou média nas oito
páginas da coluna esquerda, cada um com o trecho exato e o efeito. Está em
`docs/REVISAO_TIPOGRAFIA_2026-09-15.md`.

Não apliquei nada porque muda a aparência de chips, títulos e etiquetas em todas
as telas de uma vez, e mexe em dezenas de travas do verificador.

**Três caminhos, escolha um:**

1. **Só o mecânico** (recomendo começar aqui): pesos 300 e 500 que a fonte nem
   carrega, cores fora da paleta, tamanhos quebrados. Ninguém percebe, e some a
   sujeira que gera o próximo bug.
2. **Página por página**, você aprovando cada uma.
3. **Tudo de uma vez**, numa leva própria.

### D4 · Convites que já foram aceitos *(P75)*

Nada no sistema marca um convite como aceito quando a pessoa cria a senha. A
lista de "Convites Pendentes" acumula para sempre, inclusive gente que já usa o
sistema há semanas.

**A decisão:** quando o servidor de login responder que a pessoa já existe,
marco o convite como aceito e a lista se limpa sozinha? É o que eu faria.

### D5 · Q8 — o texto padrão da cobrança

Adiada por você em 04/09: *"preciso do Vinicius para entender melhor isso"*.
Qual o padrão do texto sugerido ("Manutenção corretiva — fornecimento de 1×
peça, fora de contrato"?) e o tipo de serviço padrão. **Agora dá para resolver
com o Vinicius**, já que ele passou a ter mesa própria na Gestão Técnica.

### D6 · Quem recebe os avisos automáticos *(P73)*

As funções do banco que decidem quem é notificado — chamado sem dono, prazo
estourando — listam admin, comercial e SAC **escritos à mão**, desde agosto. O
cargo **Gestor** não está nelas.

**Importa no dia em que você fizer o G2.** Enquanto o Vinicius for Admin, ele
recebe tudo. Assim que virar Gestor, para de receber. O conserto é uma leva
própria que reescreve essas listas; me avise quando fizer a troca.

### D7 · Q13 — três telas legadas

`/projeto/$id`, `/visita/$id/pendente` e `/gerencial/visita/$id/editar`. Você
quis ver antes de decidir se ficam ou saem. Os endereços estão anotados na Q13
de `REVISAO_2026-09-03.md`.

---

## 3. O que você disse que vai mandar

| # | O quê | O que destrava |
|---|---|---|
| **M1** | **Os fluxos de cada tipo de demanda técnica** — corretiva, preventiva, implantação: os campos de cada um e o caminho | **É o maior bloqueio hoje.** Destrava a validação do gestor (Fase C), o mini-calendário, a tela da data agendada e a proposta em duas atividades. Parte já foi ditada (R282, R284, R286, R292); falta os campos de cada tipo e a **implantação inteira**. |
| **M2** | **Tipo de atividade → impacto operacional** | Hoje quem cria escolhe o impacto à mão. Com a relação, o sistema preenche. |
| **M3** | **Os documentos do ERP com equipamentos por cliente** | Fase H.5. Depois vem a API do QAP (contato: Lopes), que você deixou para quando o sistema estiver redondo. |
| **M4** | **Os dados do passado das propostas** *(R302)* | Você disse que passaria à mão. Entram por migration, e o dashboard do Comercial passa a mostrar histórico de verdade em vez de começar do zero. |

---

## 4. Infraestrutura — para validar com o T.I.

### I1 · Sair da Lovable

**É fácil e está documentado** (`ONBOARDING.md` §6). O passo zero é confirmar,
em supabase.com, que o projeto Supabase está na conta da **empresa** e não numa
conta pessoal ou da Lovable. São dois minutos e é o único ponto que pode
surpreender.

### I2 · Sair do Supabase — cuidado com a expectativa

Não é "trocar de hospedagem". O app depende do Supabase em seis frentes: login
em 38 arquivos, 31 funções de banco, 2 áreas de arquivos, atualização em tempo
real em 6 telas, 3 funções de servidor e 9 tarefas agendadas.

**O caminho que preserva o código é auto-hospedar o Supabase** no servidor da
empresa, via Docker. Reescrever para um Postgres comum são meses de trabalho.

### I3 · Backup — o assunto que você chamou de emergencial

Hoje o backup é o que o Supabase dá no plano atual. As duas opções:

- **Supabase gerido**, plano Pro: recuperação para qualquer ponto no tempo.
- **Auto-hospedado**: cópia diária mais o registro contínuo, feitos pelo T.I.

**Os dois exigem teste de restauração, não só de cópia.** Backup que nunca foi
restaurado é uma pasta grande, não um backup.

---

## 5. Onde cada coisa mora

| Documento | O que tem |
|---|---|
| **Este arquivo** | tudo o que depende de você |
| `ESTADO_ATUAL.md` | o retrato: onde estamos, o que está no ar, o que falta rodar |
| `PRODUTO.md` | todas as regras (R1 a R305), com as suas frases |
| `PENDENCIAS_TECNICAS.md` | dívida técnica (P1 a P77) — não precisa de você |
| `REVISAO_TIPOGRAFIA_2026-09-15.md` | os 66 desvios da frente V |
| `VERSOES.md` | o que entrou em cada versão instalada |
| `PLANO_UNIFICACAO.md` | o diário: o porquê de cada decisão técnica |

---

> **Versão em Word, para ler e circular.** `docs/Decisoes-Pendentes-Prever.docx`
> tem este mesmo conteúdo **reescrito sem jargão** — passo a passo nos gestos,
> recomendação em cada decisão e glossário no fim. *(Davi, 22/09/2026:
> "considere que eu não tenho conhecimento prévio de programação".)* Não é uma
> conversão automática: quando esta lista mudar, refaça o Word com
> `node scripts/gerar-docx-decisoes.cjs` (a biblioteca `docx` se instala fora do
> repo — ela não é dependência do app).
