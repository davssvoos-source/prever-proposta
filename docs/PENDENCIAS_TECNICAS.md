# Pendências técnicas — registro dos defeitos da revisão

Registro formal do que a revisão adversarial encontrou.

**Situação em 2026-08-20 (fim do dia):** dos 12 itens, 9 foram corrigidos e
3 (P2, P6, P9) ficaram **sem objeto** — o handler de roda do quadro, origem dos
três, foi removido quando o kanban virou página única (U17). Pendente de
verdade resta só o **P7**. O histórico dos resolvidos fica aqui de
propósito: quando um deles voltar, o caminho de quebra já está escrito.

Este documento existe para que nada aqui vire descoberta futura. Cada item traz
o arquivo, como quebra, e a correção mínima — para que consertar seja executar,
não investigar de novo.

## Como ler o status de verificação

A revisão foi **encerrada antes da fase de refutação**, em que cada achado é
atacado por um cético antes de virar conclusão. Por isso os itens estão
separados:

- **CONFIRMADO** — eu li o código e verifiquei o caminho de quebra. É defeito.
- **A CONFIRMAR** — veio da revisão e é plausível, mas não passou pelo cético
  nem pela minha verificação. Pode ser falso positivo. Verificar antes de mexer.

Origem: `wf_1a7b7d3f-316` (revisão do desktop, U12), interrompida com 17 dos
achados já produzidos e a fase de refutação incompleta.

---

## P1 · CRÍTICO · O menu de filtro é pintado atrás da barra inferior

**Status:** **RESOLVIDO** (2026-08-20) — popover em `createPortal` para o `body`, com posição calculada do retângulo do botão.
**Arquivo:** `src/features/home/MenuFiltro.tsx` (o popover) +
`src/styles.css:366` + `src/routes/_authenticated/route.tsx:232-240`

**Como quebra.** `#root, main, header, nav { position: relative; z-index: 1 }`
faz do `<main>` um **contexto de empilhamento**. O popover do filtro vive dentro
dele com `z-index: 60`, mas esse 60 só compete com irmãos dentro do `<main>` —
para o resto da página, o menu inteiro vale `z-index: 1`. A `BottomNav` é
`position: fixed; z-index: 50` e é **irmã** do `<main>`, então pinta por cima.

Na prática, no celular: abrir o menu "Padrão" e tocar na última opção acerta a
BottomNav e **navega para outra tela** em vez de escolher o filtro.

**Correção mínima.** Renderizar o popover em portal para `document.body`
(`createPortal`), com `position: fixed` e coordenadas calculadas do
`getBoundingClientRect()` do botão. Sair do `<main>` é o que resolve; subir o
z-index não resolve, porque o problema não é o valor.

**Aproveitar a mesma mudança para P3.**

---

## P2 · ALTO · A roda do mouse anda 3px por clique no Firefox

**Status:** **SEM OBJETO** desde a U17 — o handler de roda foi removido inteiro: o quadro virou página única e a roda rola a página, como o Davi pediu.
**Arquivo:** `src/features/home/Quadro.tsx`, handler `naRoda`

**Como quebra.** O handler usa `e.deltaY` cru. O Firefox entrega
`deltaMode = 1` (LINHAS), com `deltaY ≈ 3` por clique da roda — o Chrome
entrega `deltaMode = 0` (PIXELS), com `deltaY ≈ 100`. Resultado: no Firefox o
quadro anda 3px por clique e parece travado.

**Correção mínima.** Normalizar antes de usar:

```ts
const passo =
  e.deltaMode === 1 ? e.deltaY * 16 :          // linhas
  e.deltaMode === 2 ? e.deltaY * el.clientWidth : // páginas
  e.deltaY;                                     // pixels
```

---

## P3 · ALTO · O menu abre sempre para baixo, sem olhar o fim da tela

**Status:** **RESOLVIDO** (2026-08-20) — junto com o P1: vira para cima quando não cabe e limita a altura ao espaço da janela.
**Arquivo:** `src/features/home/MenuFiltro.tsx`

**Como quebra.** O popover é `top: calc(100% + 6px)` incondicional. O menu
"Pessoa" pode ter dezenas de opções (`maxHeight: 320`). Com o botão na metade
de baixo da tela, metade das opções nasce fora da janela — e como o `<main>`
rola, a pessoa precisa rolar a página com o menu aberto, o que em alguns
navegadores fecha o menu.

Só o eixo horizontal foi tratado (`aDireita`).

**Correção mínima.** Junto com o portal do P1: medir o espaço abaixo do botão e
abrir para cima quando não couber; limitar `maxHeight` ao espaço disponível.

---

## P4 · ALTO · `prefers-reduced-motion` congela os indicadores de carregamento

**Status:** **RESOLVIDO** (2026-08-20) — a regra passa a excluir `.animate-spin`, que gira mais devagar em vez de parar.
**Arquivo:** `src/styles.css`, bloco `@media (prefers-reduced-motion: reduce)`

**Como quebra.** A regra aplica `animation-iteration-count: 1 !important` a
tudo. Quem tem "reduzir movimento" ligado no sistema — comum em quem sofre com
enjoo de movimento — vê o `Loader2 animate-spin` de
`features/projeto/{ResumoTab,ServicosTab,VariaveisTab,ExportarTab}.tsx` dar
**um quarto de volta e parar**. Um spinner parado lê como "travou", não como
"carregando".

**Correção mínima.** Excluir o que precisa girar para comunicar estado:

```css
@media (prefers-reduced-motion: reduce) {
  *:not(.animate-spin):not(.animate-spin *) { /* … */ }
}
```

Ou preferir trocar o spinner por uma barra de progresso indeterminada sem
rotação. A regra ainda deve matar `btn-pulse-gold` e `gold-shimmer`, que são
decorativos.

---

## P5 · MÉDIO · "Em aberto" nunca aparece marcada no menu Situação

**Status:** **RESOLVIDO** (2026-08-20) — passa sempre `[filtros.situacao]`.
**Arquivo:** `src/routes/_authenticated/dashboard.tsx`, `<MenuFiltro rotulo="Situação">`

**Como quebra.** A prop é
`selecionados={filtros.situacao === "abertos" ? [] : [filtros.situacao]}`. Como
"abertos" é o padrão, o menu abre com **nenhuma** opção marcada, e tocar em "Em
aberto" não muda nada visível. A pessoa fica sem saber qual filtro está valendo
— justamente o problema que os menus vieram resolver.

**Correção mínima.** Passar sempre `[filtros.situacao]`; usar `vazio` só para o
texto do botão fechado quando o valor é o padrão.

---

## P6 · MÉDIO · Roda sobre o cabeçalho da coluna arrasta o quadro

**Status:** **SEM OBJETO** desde a U17 — o handler de roda foi removido inteiro (quadro de página única).
**Arquivo:** `src/features/home/Quadro.tsx`, `naRoda`

**Como quebra.** A delegação usa `closest("[data-corpo-coluna]")`. O cabeçalho
da coluna é **irmão** do corpo rolante, não ancestral — então `closest` devolve
`null` e a roda vira movimento lateral. Com o cursor sobre o título da coluna
(alvo grande, e onde o olho está ao procurar uma coluna) a roda faz a coisa
errada.

**Correção mínima.** Marcar a coluna inteira (`data-coluna`) e, a partir dela,
buscar o corpo: `closest("[data-coluna]")?.querySelector("[data-corpo-coluna]")`.

---

## P7 · MÉDIO · O botão "Meu vínculo" não mostra o vínculo que está valendo

**Status:** PENDENTE · a confirmar
**Arquivo:** `src/features/home/lentes.ts` (`Preset.vinculo`) + `dashboard.tsx`

**Como quebra (alegado).** Presets como "Meu dia" e "Tudo meu" trazem um
`vinculo` implícito, aplicado em `aplicarLentes` quando o usuário não escolheu
nenhum. O botão "Vínculo", porém, reflete só a escolha manual — então o filtro
está aplicado e o botão diz que não há filtro.

**Correção sugerida.** Tirar o `vinculo` implícito do preset e mover a regra de
propriedade para dentro do `aplica` de cada preset. Aí o botão passa a refletir
exatamente o que é manual, sem estado escondido.

---

## P8 · MÉDIO · A barra de filtros quebra em três fileiras a 375px

**Status:** **RESOLVIDO** (2026-08-20) — trilho no celular, `flex-wrap` a partir de 1024px.
**Arquivo:** `src/routes/_authenticated/dashboard.tsx`, barra de controle

**Como quebra (alegado).** São cinco menus mais dois botões de ícone num
`flexWrap: "wrap"`. Em 375px isso empilha em três fileiras — e como o rótulo do
botão muda de largura conforme a seleção ("Padrão" → "Padrão: Sprint deste
mês"), os botões se rearranjam entre fileiras a cada escolha, deslocando a lista
abaixo.

**Correção sugerida.** Trilho horizontal (`.trilho-x`) no celular, mantendo
`flex-wrap` só a partir de 1024px. Altura da barra fica estável e a lista para
de pular.

---

## P9 · MÉDIO · Inércia do trackpad vaza para o quadro

**Status:** **SEM OBJETO** desde a U17 — a inércia do trackpad só vazava por causa do handler de roda, que não existe mais.
**Arquivo:** `src/features/home/Quadro.tsx`, `naRoda`

**Como quebra (alegado).** No macOS, terminar uma rolagem vertical dentro da
coluna deixa eventos de inércia chegando. Quando a coluna acaba, esses eventos
residuais viram movimento lateral e o quadro "escorrega" sozinho para o lado.

**Correção sugerida.** Ignorar eventos de roda por ~150ms depois que a coluna
esgota, ou exigir que o gesto comece com o quadro já no limite.

---

## P10 · BAIXO · "Mostrando 60 de N" vira uma célula da grade

**Status:** **RESOLVIDO** (2026-08-20) — `gridColumn: 1 / -1`.
**Arquivo:** `src/routes/_authenticated/dashboard.tsx`, fim da visão de lista

**Como quebra.** O aviso é filho direto de `.lista-atividades`, que virou grade
no desktop. Ele ocupa uma célula, ao lado do último card, em vez de ficar
centralizado embaixo.

**Correção mínima.** `style={{ gridColumn: "1 / -1" }}`.

---

## P11 · BAIXO · A regra de foco deforma botões arredondados

**Status:** **RESOLVIDO** (2026-08-20) — `border-radius` saiu da regra de foco.
**Arquivo:** `src/styles.css`, bloco `:focus-visible`

**Como quebra.** A regra inclui `border-radius: 8px`, que **sobrescreve** o raio
real do elemento enquanto ele está focado. Um chip de `border-radius: 999px`
vira retângulo de cantos suaves ao receber foco por teclado.

**Correção mínima.** Tirar `border-radius` da regra — `outline` já acompanha o
raio do elemento.

---

## P12 · BAIXO · `Esc` fecha o menu e larga o foco no `body`

**Status:** **RESOLVIDO** (2026-08-20) — `Esc` devolve o foco ao botão.
**Arquivo:** `src/features/home/MenuFiltro.tsx`

**Como quebra.** Quem navega por teclado abre o menu, aperta `Esc`, e perde a
posição: o próximo `Tab` recomeça do topo da página.

**Correção mínima.** Devolver o foco ao botão (`botaoRef.current?.focus()`) ao
fechar por `Esc`.

---

## Fora desta lista, mas registrado em outro lugar

- **Valor da compra legível demais** — `chamado_compra_select` usa
  `pode_acessar_chamado()`, que é verdadeiro quando `responsavel_id IS NULL`.
  É decisão de produto (S2/S3 do documento de decisões), não defeito de código.
  Ver `docs/PLANO_UNIFICACAO.md` §U9.
- **O rótulo "Aguardando início"** fica ao lado de "Aguardando aprovação". Não é
  defeito; é escolha a validar no uso.

## P14 — ~~Três telas ainda escrevem `chamados.data_hora_agendada` direto~~ FECHADA (U79, 2026-09-01)

**Fechada pela U79.** As três telas foram religadas às quatro portas da U78, e o
freio que este item pedia acabou sendo **melhor do que o gatilho proposto**:
em vez de um `BEFORE UPDATE OF data_hora_agendada ON public.chamados` (que
recusaria em tempo de execução, com o usuário na frente), fecharam-se as **duas
portas de TIPO** em `src/features/chamados/data.ts` —
`NovoChamadoInput.data_hora_agendada` e o membro `"data_hora_agendada"` do
`Pick<>` de `ChamadoPatch`. A regressão passou a ser **erro de compilação**, e o
verificador ganhou um **censo por varredura**: a lista de arquivos que escrevem a
coluna, derivada do `src/` inteiro, contra a lista escrita à mão dos **cinco
escritores comerciais** (que gravam `visitas_tecnicas` e são do gatilho da U41).

O gatilho no banco continua **não existindo**, e a decisão fica registrada: com o
`tsc` e o censo fechando o caminho no cliente, o gatilho pegaria só um escritor
vindo de fora do app (SQL Editor, carga) — e ali quem escreve é `service_role`,
que é justamente quem precisa poder consertar dado à mão. O custo de errar nessa
direção é alto (uma carga legítima recusada às 23h) e o benefício é pequeno.

O texto original fica abaixo, porque o GATILHO DE REVISÃO dele foi o que
disparou esta entrega.

---

A U78 fez daquela coluna um **espelho** do bloco de agenda (R101): quem escreve
é o gatilho, e a promessa de "um escritor só" está no `COMMENT ON TABLE` da
tabela nova. Só que ela é **promessa**, não estrutura — três telas antigas
continuam sabendo escrever a coluna à mão, e nenhuma recalcula o espelho depois:

- `src/routes/chamados.programacao.tsx:253` — a programação de hoje, que grava
  `T12:00:00` literal por não perguntar a hora;
- `src/routes/chamados.novo-campo.tsx:144`;
- `src/components/chamados/PainelChamado.tsx:1139`.

**Hoje isto é inofensivo**, e é por isso que não foi corrigido junto: enquanto
não existir bloco nenhum em produção, não há espelho para divergir, e a U78 é
aditiva de propósito (nenhuma tela mudou). O freio tem de nascer com a tela nova,
não antes — pôr agora um `BEFORE UPDATE OF data_hora_agendada ON public.chamados`
tiraria o único caminho que existe hoje para dar hora a um chamado.

**GATILHO DE REVISÃO, explícito:** no dia em que existir o **primeiro bloco em
produção**, estas três telas viram fonte de segunda verdade — elas mexem na
coluna e o §9.0 da U78 (a lista "quem não casou") passa a acusar. A migration que
levar a grade tem de trazer junto o gatilho que recusa a escrita direta, e a
asserção que hoje pina "não nasce gatilho nenhum em `public.chamados`" tem de ser
reescrita no mesmo commit (o que importa é a ausência de gatilho que escreve em
`agenda_campo`, não a ausência de qualquer gatilho).

## P15 — A grade da programação não tem realtime (2026-09-01, U79)

`public.agenda_campo` **não foi adicionada à publicação do realtime** pela U78, e
a U79 não a adicionou: uma inscrição em tabela fora da publicação **conecta, fica
viva e nunca dispara** — o repo já registrou essa armadilha em
`features/chamados/data.ts:746-751`, e ela é pior do que não existir.

O que existe hoje na tela: `useChamadosRealtime()` (o canal de `public.chamados`,
que acorda quando o **espelho** escreve), `staleTime` de 30s e o refetch por foco
de janela. **O que isso NÃO cobre**, dito para ninguém supor o contrário: mover
um bloco sem mudar o valor espelhado — corrigir uma duração, mexer num bloco que
não é o pendente mais antigo — não dispara evento nenhum.

**Consequência observável:** num quadro compartilhado, o `exclusion_violation`
("Outra pessoa marcou este horário agora mesmo") deixa de ser corrida rara e vira
rotina. A rede está no banco e a frase é boa, mas o usuário paga com um gesto
perdido.

**O conserto** é uma linha (`ALTER PUBLICATION supabase_realtime ADD TABLE
public.agenda_campo;`) mais um canal com debounce, no molde de
`useChamadosRealtime`. Não entrou aqui porque a U79 se anuncia **cirúrgica** — só
os quatro GRANT — e acrescentar publicação é mudar o que o banco emite para todo
mundo. Fica para a primeira migration que tiver outro motivo para existir.

## P16 — `_servico_min` não tem número inicial honesto (2026-09-01, U79)

O campo "duração do serviço" abre **vazio** e é obrigatório para marcar hora.
Varredura do repositório: **não existe duração de serviço em lugar nenhum**.
`useSla()` devolve **prazo de atendimento** ("até quando alguém tem de ir"), que é
pergunta semanticamente outra — usá-lo faria uma corretiva urgente de 4h de SLA
ocupar 4h de agenda.

**O risco não é lixo, é uniformidade:** sob pressão, no celular, no campo, todo
mundo toca o primeiro atalho, e em um mês `agenda_campo.servico_min` é 80% o
mesmo valor — com cara de medição. Aí o chip de ocupação, a recusa da jornada, o
selo "disponível" e (Fase 2) o cálculo de rota assentam num chute.

**O que a tela já faz:** atalhos em ordem **crescente** e **nenhum**
pré-selecionado (se alguém chutar, que chute para baixo, o que faz o dia parecer
mais cheio — errar para o lado de recusar sobrecarga, nunca para o lado de
inventar capacidade), e o "dar horário em série" herda a **última coisa que ESTA
pessoa digitou**, visível e editável, que é o único lugar em que um número
inicial é honesto.

**O que falta é uma frase do Davi:** quanto dura, tipicamente, uma preventiva,
uma corretiva, uma implantação e uma operacional. Os quatro números entram em
`programacao/modelo.ts` ao lado de `JORNADA_MIN`, com asserção contra os
LITERAIS, e o campo passa a vir preenchido **com etiqueta** ("padrão da
preventiva") — default sem etiqueta é indistinguível de medição.

**Enquanto isso, a defesa é de DADO e não de código** (o verificador não a vê): a
consulta-canário em `docs/manual/operacao-campo.md`, com o limiar escrito ao
lado — se um único valor passar de 70% do total, a duração está sendo chutada.

## P17 — O técnico não abre a tela da grade, e o gate dele nunca rodou (2026-09-01, U79)

`src/lib/telas.ts:67` dá `chamados.programacao` como
`[tecnico: false, comercial: true, sac: true]`. Logo, **todo o ramo não-gestor de
`erroDeAutorizacao`** (modelo.ts) é inalcançável por esta rota, e a peça de
autorização mais delicada da entrega — o gêmeo local de `pode_editar_chamado`, a
afordância "só-leitura fora da minha linha", a linha colapsada — sobe **sem ser
exercitada por uso**.

Ela **é** exercitada por asserção (fixtures das três pernas + censo contra o
corpo de `pode_editar_chamado` na S2), e o caminho por onde um técnico realmente
chega até a fronteira que a U78 desenhou continua vivo: a edição do **bloco
único** dentro do PainelChamado. Mas código que só roda depois de alguém virar
uma chave na tela de permissões é código que roda pela primeira vez em produção.

**Não é decisão minha:** ligar `tecnico: true` aqui é decisão de permissão, e é do
Davi. Fica registrado com o fato ao lado, para a decisão ser tomada sabendo o que
ela liga. Se ela for tomada, vale antes um segundo olhar em duas coisas: a grade
do técnico é majoritariamente "Outro atendimento" (`chamados_select` não é aberta
enquanto `agenda_campo_select` é `USING (true)`, e isso é decisão declarada da
U78), e `podeEditarChamado` passa a ser consultado por cartão — hoje resolvido
por um gêmeo local síncrono, e não por RPC, justamente para não virar um N+1 de
HTTP.

## P18 — CRÍTICO · A linha do tempo entrega o valor em reais a TODO autenticado (2026-09-01, U80)

**É o vazamento que a R13 e a U6a existem para impedir, e ele está aberto hoje.**

`chamado_eventos_select` é `USING (true)` —
`supabase/migrations/20260819120000_u7_fusao_chamados.sql:586-587`. Não é
`pode_acessar_chamado`, é `true`. E `aprovar_chamado_financeiro` grava na linha
do tempo (`20260820100000_u13_executado_vira_concluido.sql:116-120`):

```sql
INSERT INTO public.chamado_eventos (chamado_id, tipo, descricao, user_id)
VALUES (_chamado_id, 'cobranca_aprovada',
        CASE WHEN v_itens = 0 THEN 'Conferência concluída: nada a cobrar.'
             ELSE 'Cobrança aprovada: ' || v_itens || ' item(ns), total ' ||
                  to_char(v_total,'FM999G999G990D00') END, auth.uid());
```

`useChamadoEventos` (`src/features/chamados/data.ts`) busca **sem filtro de
tipo**, e `DetalheCampo.tsx:1205-1207` pinta `{ev.descricao ?? ev.tipo}` **fora
de qualquer gate de papel**. Resultado: hoje, **qualquer autenticado — o SAC, e o
técnico que abre o próprio chamado — lê "Cobrança aprovada: 3 item(ns), total
1.842,50"**. É o valor exato, em reais, que a R13 ("o SAC é gestor que NÃO vê
valores") e a separação de réguas da U6a existem para esconder. `'cobranca_faturada'`
(U7:758) e `'compra'` com a situação do pedido (U9:154) vazam junto, esses sem cifra.

**Por que não foi consertado na U80:** é policy do MOTOR, e a Fase 1 Passo 1.3
lê o motor financeiro sem reescrevê-lo. A U80 **não repete o erro** — o evento
dela (`cobranca_decidida`) grava o FATO e a CONTAGEM, nunca o dinheiro, e há
asserção pinando que `FM999G999G990D00` não aparece no INSERT dela.

**Mas isto muda o cálculo da entrega inteira, e é preciso dizer:** não dá para
argumentar que o selo "existe cobrança" é seguro *por ser menos que o valor*
quando o valor já está aberto ao lado. O argumento do selo tem de se sustentar
sozinho, e ele se sustenta (`aprovada ⇒ EXISTS(cobrancas)`, e o SAC já lê
`aprovada` na mesma linha da mesma tabela). Só que **a ordem de prioridade
provavelmente deveria mudar**: uma função meticulosamente mínima ao lado de um
vazamento de valor é teatro enquanto o vazamento estiver lá.

**As duas saídas, e são independentes:** fechar a policy
(`chamado_eventos_select` passa a `pode_acessar_chamado(chamado_id)`) ou tirar a
cifra do evento (o `to_char` sai, e a contagem fica). A segunda é uma linha e não
mexe em permissão nenhuma; a primeira é a régua certa e precisa ser medida contra
quem hoje depende de ler evento de chamado alheio.

## P19 — ALTO · O DELETE de `aprovar_chamado_financeiro` come o avulso vinculado (2026-09-01, U80)

`aprovar_chamado_financeiro` faz, incondicionalmente
(`20260820100000_u13_executado_vira_concluido.sql:95`):

```sql
DELETE FROM public.cobrancas WHERE chamado_id = _chamado_id AND status = 'aberta';
```

Ele **não discrimina `chamado_peca_id`**. Uma cobrança avulsa VINCULADA — que só
passa a existir depois de `concluir_chamado_com_cobranca` (U80 §4) — seria
apagada por ele. E como o chamado não tem peça faturável, `v_itens = 0` e o
UPDATE crava `sem_cobranca`; o evento gravado diz *"Conferência concluída: nada a
cobrar."* **O dinheiro some e a linha do tempo confirma que não havia dinheiro.**

**Alcançabilidade hoje: nenhuma pela UI.** A porta da U80 recusa `lancar` num
chamado que tem `chamado_pecas_analise`, e deixa o chamado em `aprovada` —
estado em que o botão "Aprovar cobrança" (`DetalheCampo.tsx:1095`) não renderiza.
Sobra um POST direto à RPC com papel financeiro, ou um ponto de entrada futuro
que alguém escreva sem ler isto.

**A linha 107 da conferência da U80 é o arame:** ela conta as cobranças presas a
chamado que NÃO vieram de peça (`chamado_id IS NOT NULL AND chamado_peca_id IS
NULL`). Hoje é 0. No dia em que deixar de ser, este defeito passa a ter alcance.

**O conserto é uma linha, e é mexer no motor** — que este passo declarou não
fazer:

```sql
-- em U13:95
DELETE FROM public.cobrancas
 WHERE chamado_id = _chamado_id AND status = 'aberta'
   AND chamado_peca_id IS NOT NULL;   -- ← a linha
```

Se o Davi autorizar, é a única migration que eu recomendaria acrescentar em
seguida à U80.

## P20 — MÉDIO · `em_conferencia` é um buraco negro: o chamado sai de toda fila sem ninguém aprovar (2026-09-01, U80)

`src/lib/cobranca.functions.ts:327` grava `faturamento_status = 'em_conferencia'`
ao fim da análise, sob a RLS do próprio usuário — e passa, porque
`chamados_update` é `pode_editar_chamado`, que começa por `is_gestor`. A tela
invalida `["chamado", id]` e refaz o fetch com o valor novo. Aí, em cadeia:

- `DetalheCampo.tsx:965` — o botão "Ajustar" de cada item exige `a_analisar` → **some**;
- `DetalheCampo.tsx:1095` — "Aprovar cobrança" exige `a_analisar` → **some, exatamente depois da análise que existe para habilitá-lo**;
- `DetalheCampo.tsx:1120` — o card de Conferência exige `a_analisar` → **some**;
- `src/features/atividades/modelo.ts:485-486` e o alerta diário (U13:139) filtram `a_analisar` → o chamado **sai da fila** e **para de gerar aviso**.

Sobra "Reanalisar", que reescreve `em_conferencia` de novo. **Nenhum caminho no
repo devolve o chamado a `a_analisar`.** Um chamado analisado e não aprovado fica
invisível para toda a operação, com a cobrança nunca gerada. É dinheiro que some
da fila em silêncio.

**O que a U80 fez:** o selo do cartão trata `em_conferencia` como **A conferir**,
junto com `a_analisar` — o cartão é a primeira superfície que volta a mostrá-los,
e a linha 113 da conferência da migration conta quantos estão parados assim hoje.
Isso **não conserta** o defeito: os três botões continuam sumindo, e o motor
aceitaria a aprovação (`aprovar_chamado_financeiro` não checa `faturamento_status`
— só `status = 'concluido'`). É só a visibilidade dos botões que está errada.

**O conserto de verdade** é decidir se `em_conferencia` deve existir: ou os três
gates passam a aceitar `a_analisar` **ou** `em_conferencia`, ou a análise para de
escrever o valor (e a coluna volta a ter quatro estados). A segunda é mais limpa;
nenhum consumidor lê `em_conferencia` para nada.

## P21 — MÉDIO · Duas telas discordam sobre a data da parcela: `setMonth` pula fevereiro (2026-09-01, U80)

`lancarCobrancaAvulsa` (`src/features/financeiro/fechamentos.ts:137`) avança a
competência com `d.setMonth(d.getMonth() + i)`. Em JavaScript, **31/01 + 1 mês é
02/03**: a parcela 2 pula fevereiro e cai em março, e a competência de fevereiro
fica sem linha. `date + interval` no Postgres GRAMPEIA para 28/02, que é o certo.

A porta da U80 (`concluir_chamado_com_cobranca`) usa `make_interval(months => …)`
e portanto está certa. **As duas telas passam a discordar sobre a mesma conta** —
a de fechamentos pula, a do cartão não.

**Não foi consertado aqui** porque aquela tela é de outro dono e não é objeto
deste passo. É uma troca de `setMonth` por uma soma de mês grampeada (ou pela
mesma RPC), com asserção sobre 31/01, 31/03 e 29/02 de ano bissexto.

**E o avulso SEM chamado continua sem dedup algum**: dois cliques em "Lançar"
criam dois jogos de parcelas. Nenhum dos dois índices da U80 o alcança — os dois
predicados exigem `chamado_peca_id IS NOT NULL` ou `chamado_id IS NOT NULL`. A
afirmação da U80 é **"lançar pelo cartão não duplica"**, e não "ninguém com papel
financeiro duplica nada em lugar nenhum".

## P13 — Amarelos fora da paleta em telas legadas (2026-08-20)

A auditoria da v7 varreu o sistema e achou amarelos de fora da paleta em telas
que a reforma de design ainda não alcançou:

- `visita.$id.pendente.tsx:444` — degradês avulsos terminando em `#FFA500`,
  `#FFB300`, `#FFD84D`, `#d49a00`, `#d4a800`, `#FFA000`;
- `gerencial.usuarios.tsx:496` — véu claro em `#fef3c7`/`#fde68a` (Tailwind
  amber) com o escuro já em `rgba(248,200,17,…)`;
- `chamados.indicadores.tsx:28` — cartelas categóricas com `#eda100`/`#E2791D`.

Não corrigidos porque estas telas estão fora do escopo da Início e serão
redesenhadas por inteiro na reforma v7 delas. Quando forem, os amarelos viram
`PRISMA.amarelo`/`SUPERNOVA` — e nada além.

## S — Segurança: achados aceitos, não corrigidos (2026-08-20)

Da auditoria de cibersegurança (5 frentes, 23 achados confirmados). Estes
ficaram de fora da migration S1 por decisão, não por esquecimento:

- **S4 — `profiles` SELECT é `USING(true)`**: e-mail E TELEFONE de todos os
  funcionários legíveis por qualquer autenticado. O app depende da linha (pilha
  de avatares, seletor de responsável). Tentei fechar o telefone com REVOKE de
  coluna na S1 e **revertí na S1b**: no Supabase todo logado é o mesmo role
  `authenticated`, então o REVOKE tira do admin junto — e derruba qualquer
  `select *` (o app faz um em `fetchProfile`, no início da sessão). O caminho
  certo é uma **view** com as colunas públicas + RLS, trocando os consumidores
  para ela. Risco: dado de colega, não de cliente, e exige conta válida.
- **S5 — `permissoes_tela` usa `profiles.cargo` e não `user_roles`**: duas
  fontes de verdade para papel. Hoje o trigger `trg_sync_user_role` mantém as
  duas em sincronia, então não é explorável; vira dívida no dia em que alguém
  escrever numa sem a outra.
- **S6 — `SET search_path = public` (e não `= ''`) nas 77 funções DEFINER**:
  defesa em profundidade incompleta. Não explorável hoje — exigiria que um
  usuário pudesse criar objeto em `public`, o que ele não pode.
- **S7 — sessão no `localStorage`**: um XSS vira roubo de sessão. Mitigado pelo
  escape do popup do mapa (S1). A CSP **não** mitiga hoje — ver S10. A correção
  real (cookie httpOnly) exige trocar o fluxo de auth do Supabase.
- **S11 — o `.env` é versionado DE PROPÓSITO** (2026-08-20): o Lovable builda a
  partir do repositório, então sem o `.env` no repo o Vite não encontra
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` e
  `integrations/supabase/client.ts` **lança** ao criar o cliente — o app inteiro
  cai. Tirei do versionamento por higiene e derrubei tudo; está de volta, com
  o motivo escrito no próprio `.gitignore`.

  É seguro porque só há ali a URL e a *publishable* key, ambas públicas por
  design (vão para o bundle do navegador de qualquer forma). O contrapeso está
  travado por asserção: **segredo de verdade nunca entra nesse arquivo** —
  `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY` moram no painel de
  variáveis da hospedagem e jamais levam prefixo `VITE_`, que publicaria o
  valor no bundle.

- **S8 — `blocos-fotos`/`fotos-visitas` sem amarração por caminho**: a S1 fechou
  o apagar (só dono ou gestor) e tornou os buckets privados, mas qualquer
  autenticado ainda LÊ qualquer foto. Amarrar por dono exigiria convenção de
  caminho que hoje não existe nos uploads antigos.

- **S9 — a sincronização com o QAP precisa rodar como `service_role`**: o Davi
  informou (2026-08-20) que clientes e equipamentos virão do QAP por um botão
  de sincronizar; a planilha importada na U24 é provisória. As policies da S1
  amarram escrita de inventário ao acesso ao cliente — se o importador rodar
  com a sessão de um usuário comum, o sync falha **parcialmente e em silêncio**,
  cliente a cliente. Está anotado dentro da própria migration (§8), onde quem
  for escrever o importador vai ler.

- **S10 — os cabeçalhos de segurança HTTP foram REVERTIDOS** (2026-08-20):
  não há CSP, HSTS, `nosniff` nem `Referrer-Policy` no app hoje.

  Tentei duas vezes e derrubei o app duas vezes. A primeira versão usava
  `script-src 'self'`, que bloqueia o `<script>` inline com o estado de
  hidratação do TanStack Start (`<Scripts />` no `__root.tsx`) — tela preta. A
  segunda, em `Report-Only`, também coincidiu com o app fora do ar, e eu não
  cheguei a provar a causa antes de reverter.

  **A raiz do problema é de método, não de política:** `src/server.ts` é o
  entry do worker e só executa em produção — `vite dev` não o carrega e
  `vite preview` não roda neste projeto (procura `dist/server/server.js`,
  enquanto o build gera `.output/`). Ou seja, não existe forma de exercitar
  esse arquivo antes de publicar, e cada tentativa vira um teste em produção.

  **Pré-requisito para tentar de novo** — nesta ordem:
  1. arrumar um jeito de rodar o build localmente (`npx nitro dev` sobre
     `.output/`, ou um teste que importe `src/server.ts` e chame `fetch()` com
     uma Request sintética, cobrindo 200, 304 e 500);
  2. só então introduzir os cabeçalhos, começando pelos que não dependem do
     conteúdo (`nosniff`, `Referrer-Policy`, `Permissions-Policy`), que são
     baratos e quase não têm como quebrar;
  3. a CSP por último, em `Report-Only`, e com nonce por request antes de
     virar bloqueio.

  Enquanto isso, o que protege contra XSS é o escape na origem — o do popup do
  mapa, feito na S1 e que continua valendo.

  bloqueio, olhando o que ela quebraria. Eu inverti a ordem e o app caiu.
