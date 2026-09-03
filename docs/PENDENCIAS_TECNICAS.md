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

## P18 — ~~CRÍTICO · A linha do tempo entrega o valor em reais a TODO autenticado~~ FECHADA (S4, 2026-09-03)

**FECHADA pela `20260903180000_s4_auditoria_de_valor.sql`, pelas DUAS saídas, e
não por uma delas.** A migration está no repo aguardando o Davi rodar (depois da
U80 — o §0 dela aborta se a U80 ainda não tiver rodado).

- **Saída (b):** `aprovar_chamado_financeiro` perde o `to_char`. O evento passa a
  ser `'Cobrança aprovada: N item(ns).'` — o FATO e a CONTAGEM. Nada de
  informação legítima se perde: o dinheiro mora em `cobrancas`, atrás de
  `cobrancas_select = pode_ver_financeiro` (u4:293).
- **Saída (a):** `chamado_eventos_select` passa a `pode_acessar_chamado(chamado_id)`,
  a mesma régua de `chamado_fotos_select` (u7:579) e `chamado_checklist_select`
  (u7:594). **A condição que este item deixou aberta — "precisa ser medida contra
  quem hoje depende de ler evento de chamado alheio" — foi medida:** existe um
  único SELECT de `chamado_eventos` no `src/` (`data.ts:337-341`), sempre
  `.eq("chamado_id", …)`, com três chamadores que partem de um chamado já aberto.
  Nenhuma tela quebra.
- **De brinde:** o `WITH CHECK` do INSERT ganhou o vínculo. Antes, qualquer
  autenticado comentava em qualquer chamado, inclusive num que não conseguia ver.

**Correções ao texto original deste item, para o histórico não mentir:**

1. A citação `DetalheCampo.tsx:1205-1207` está **errada** (ela se propagou para
   `u80:511` e para o diário). O card da linha do tempo é
   **`DetalheCampo.tsx:1252-1278`, e a pintura é a 1267**; a 1207 hoje é o bloco
   `isGerente && os.status === "concluido"`.
2. A saída (a) foi proposta aqui como `pode_acessar_chamado` puro, e duas
   leituras da auditoria pediram uma função nova com uma perna
   `OR natureza = 'interno'`, citando `chamados_select` de u7:545. **Essa policy
   está morta desde `u29:181-196`**, e o ramo não-comercial da versão viva não
   tem essa perna: a função nova teria AFROUXADO a régua. `pode_acessar_chamado`
   é superconjunto da `chamados_select` viva no ramo não-comercial.
3. Resíduo declarado: para `natureza = 'comercial'`, `chamados_select` é mais
   estrita que `pode_acessar_chamado`. Quem abriu um comercial que não é seu lê o
   evento sem abrir a capa. É o mesmo desvio que fotos e checklist têm desde
   19/08, e está escrito em comentário na S4.

**O que NÃO foi fechado, e vira decisão do Davi:** a S4 conserta o FUTURO e
estreita QUEM, mas **não reescreve `descricao` de linha antiga** — isso destruiria
registro de auditoria. Uma linha histórica com cifra continua legível pelo
técnico responsável daquele chamado. O §3 da migration MEDE esse resíduo (linhas
300-302 da conferência). Se voltar zero — a U69:57 fez `DELETE FROM
public.chamados`, e `chamado_eventos` sai por CASCADE — não há nada a fazer. Se
voltar linha, a coluna `chamado_eventos.financeiro` (`DEFAULT true` invertido,
para que um escritor futuro nasça escondido) vira a S5 e é obrigatória.

<details><summary>Texto original do P18, preservado</summary>

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

</details>

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

**CORREÇÃO DE PROVENIÊNCIA (2026-09-09, U87).** Este parágrafo dizia, até hoje,
que *"a linha 107 da conferência da U80 conta as cobranças presas a chamado que
NÃO vieram de peça; hoje é 0"*. **É falso, e a frase foi copiada daqui para dois
desenhos de entrega antes de alguém conferir** — a regra 9 acontecendo em cima
da regra 9. O que existe de verdade:

- `20260903090000_u80_ciclo_financeiro_no_card.sql:105-108` é o **PRÉ-VOO**, não
  uma conferência, e ele conta **duplicatas** (`GROUP BY 1,2,3 HAVING count(*) >
  1`), não a população;
- a **conferência 107** está em `u80:694` e diz *"nenhuma duplicata viva
  sobrou"*;
- **nenhuma conferência da U80 mede o total de avulso vinculado.** A mais
  próxima é a **111** (`u80:731`), e ela conta **outra coisa**: cobranças vivas
  em chamado marcado `sem_cobranca`.

**O arame que existe, então, é a 111 — e ele mede outra coisa.** Ele é um
indicador *lateral* deste defeito (uma cobrança viva presa a um chamado que o
sistema declara sem cobrança é um dos rastros que o DELETE + `sem_cobranca`
deixaria), e não a população de risco. **A conferência que faltaria** — e que
nenhuma migration tem — é `count(*) FROM cobrancas WHERE chamado_id IS NOT NULL
AND chamado_peca_id IS NULL AND status <> 'cancelada'`. Ela não foi acrescentada
aqui porque a U80 já rodou e o repo não edita migration aplicada; fica escrita,
com a consulta pronta, para a próxima migration que tocar no financeiro.

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

**Correção da S4 (2026-09-03): a linha acima é INSUFICIENTE, e a S4 recusou
incluí-la por isso.** A S4 recria `aprovar_chamado_financeiro` inteira, então a
tentação de acrescentar o predicado ali era grande. Só que estreitar o `DELETE`
salva a cobrança avulsa e **não conserta o resto do caminho**: como o chamado não
tem peça faturável, `v_itens = 0` continua e o `UPDATE` continua cravando
`sem_cobranca`. Trocaria-se "o dinheiro some e a linha do tempo confirma que não
havia dinheiro" por **"o dinheiro fica e o `faturamento_status` mente"** — que é
pior de diagnosticar, porque a inconsistência passa a ser silenciosa em vez de
uma linha faltando. O conserto de verdade mexe na decisão de
`faturamento_status` (contar as cobranças vivas, e não só as que este INSERT
acabou de criar), e isso é motor, não auditoria de valor.

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

## P22 — ALTO · O catálogo de preço é público, e isto é R12 CONTRA R13 (2026-09-03, S4)

**Não é policy errada. São duas regras de produto que se contradizem, e o código
escolheu sozinho.** Por isso a S4 não consertou: não há conserto sem decisão.

Três policies, todas `FOR SELECT TO authenticated USING (true)`, vivas desde a
primeira migration (`20260628044253_c73bdb7f-…`):

| tabela | linha | o que carrega |
|---|---|---|
| `equipamentos` | :84 | **`custo`** e **`markup`** (:67-68) |
| `servicos` | :118 | **`preco_unitario_mensal`** (:106) |
| `blocos` | :63 | `hh` (homem-hora — insumo de preço) |

`pode_ver_financeiro()` nunca encostou nelas. E o preço da proposta não é uma
coluna: é uma conta feita no navegador sobre esse catálogo —
`gerarProposta.ts:227` busca `custo`, `:254-262` faz `custoTotal × MARKUP_VENDA`
mais `blocos × HH_PADRAO_BLOCO × VALOR_HORA_HOMEM`, e as três constantes estão em
`comercial/regrasComerciais.ts:7,11,14` (`1.5`, `R$ 45`, `10`), dentro do bundle.

**O que um `curl` consegue hoje:** `GET /rest/v1/equipamentos?select=*` devolve a
tabela de preço da Prever e a margem, para qualquer autenticado. É a informação
comercialmente mais sensível do sistema, e está mais aberta que o telefone do
zelador (que a S1 fechou).

**Mas fechar quebra a R12, e o custo está medido.** A R12 (`PRODUTO.md:260-261`)
manda o técnico montar o orçamento na visita. `BlocoItensEditor.tsx:169` busca
`code,nome,marca,modelo,custo,markup`, `:178` calcula `preco = custo × markup` e
`:625`/`:489` imprimem `R$`. Ele é montado em **quatro telas do fluxo do técnico**
(`visita.$id.tsx:1266`, `.orcamento.blocos.$cat.tsx:1898`, `.categorias.tsx:314`,
`.pre-envio.tsx:502`). **A tela do técnico já mostra o preço de venda, hoje.**

Varredura por COLUNA, para o conserto não passar do ponto:

| lê só identidade (`code,nome,marca,modelo`) — não sentiria nada | lê o dinheiro (`custo`, `markup`) |
|---|---|
| `checklist.ts:140` · `inventario.ts:243,382` · `visita.$id.orcamento.blocos.$cat.tsx:578,629` | `BlocoItensEditor.tsx:169` · `visita.$id.pagamento.tsx:132` · `gerarProposta.ts:227` · `projeto/data.ts:78` (`select("*")`) · `admin.tsx:60` · `lib/cobranca.functions.ts:138` |

**O caminho de coluna está fechado, e já foi tentado.** `REVOKE` de coluna atinge
o role `authenticated` inteiro — admin junto — e derruba `select *` (S1 §5,
revertida pela `s1b`; ver P-histórico e `s1b:6-17`). O que sobra é **view
`equipamentos_publico`** (sem `custo`/`markup`) para o fluxo do técnico, com a
tabela crua em `pode_ver_financeiro`. Não existe view nenhuma no banco hoje
(`grep "CREATE …VIEW" supabase/migrations` = 0): é máquina nova.

**A decisão é do Davi, e é uma pergunta de uma frase:**

> O técnico monta orçamento na visita e vê preço de venda (implementado, quatro
> telas), ou o técnico não vê valores (escrito na R13)?

- **Se vale a R13:** view + fechar a tabela crua, e a R12 precisa dizer como o
  técnico monta orçamento sem ver preço.
- **Se vale a R12:** a **R13 precisa ser reescrita** para dizer *o que* o técnico
  e o SAC não veem (o que se COBRA do cliente: cobrança, contrato, fechamento)
  em vez de "valores", que hoje é literalmente falso. O furo passa a ser "o
  catálogo é público", que é decisão consciente e não buraco.

Enquanto a resposta não vier, isto fica aberto e **declarado** — que é diferente
de esquecido. Precedente de leitura na mesma direção: a S1 já decidiu que custo
de fornecedor não é R13 (`s1:148-151`, *"a R13 trata do que COBRAMOS do cliente,
não do que pagamos ao fornecedor"*); se a mesma leitura valer para o catálogo
interno, isto é deliberado por analogia — mas nunca foi escrito, e a S4 se
recusou a presumir.

## P23 — MÉDIO · O SAC lê o orçamento da visita, por deriva silenciosa da U6a (2026-09-03, S4)

`pode_acessar_visita` nasce em `etapa0:61` com o comentário *"(técnico responsável
ou gestor)"*, e a seção que a usa declara em `etapa0:313`: **"Regra: técnico
responsável pela visita OU gestor (admin/comercial)"**. Ela delega para
`is_gestor` (`etapa0:67`). Três dias depois a **U6a ampliou `is_gestor` para
incluir o SAC** (`u6a:51-66`), e `orcamentos_escopo_visita`,
`blocos_escopo_visita` e `itens_escopo_visita` (`etapa0:321,329,337`) herdaram o
papel novo sem ninguém revisitar. **A policy discorda do comentário que está três
linhas acima dela.**

É palavra por palavra o diagnóstico que a S1 §7 (`s1:278-297`) fez para
`clientes` — *"a etapa1 escreveu `is_gestor` pensando em admin+comercial… a U6a
AMPLIOU… ninguém revisitou"*. A S1 varreu clientes e inventário. **Não varreu as
visitas.**

**Em tela:** `visita.$id.pagamento.tsx` (custo, valor de venda, mensalidade de
locação, escada de comodato 24/36/48/60) **não tem `beforeLoad`** (`:34-36`: só
`component`). A UI esconde o botão (`visita.$id.tsx:1481-1484`, atrás de
`canApprove`), e essa parte está certa — mas a rota é digitável, e as quatro
consultas da página passam para um SAC: `:100` `visita_blocos` e `:114`
`visita_bloco_itens` por `pode_acessar_visita`→`is_gestor`, `:131` `equipamentos`
e `:147` `servicos` por `USING (true)`.

**Por que a S4 NÃO consertou, e é o achado que muda o veredito:** as três tabelas
do trio **não têm coluna de dinheiro**. `visita_blocos` (`…6ca84953:1-25`) e
`visita_bloco_itens` (`…23c3a006:44-54`) são `tipo_bloco`, `hh_padrao`, `cod_eq`,
`qtd`; a única coluna de valor é `visita_orcamentos.valor_hora_hh`
(`…fe914b42:12`), uma *taxa*. **O R$ daquela tela é calculado no navegador a
partir de `equipamentos.custo × markup` — ou seja, de P22.**

E trocar `pode_acessar_visita` por `pode_ver_financeiro OR tecnico_id` nas três
policies **quebraria o SAC**, medido:

- `inventario.ts:298-310` e `derivarInventarioDaVisita` (`:347-375`) — derivar o
  inventário do cliente a partir da visita aprovada. `/clientes` é
  `[tec:false, com:true, sac:true]`: **o SAC tem a tela.** A lista voltaria vazia
  e o botão diria "nada a importar";
- `checklist.ts:119-135` — semear o checklist do chamado a partir dos blocos da
  visita.

**Fechar P23 sozinho quebra o SAC e não esconde um real.** Ele sai junto com P22
ou não sai. O conserto, quando vier, tem a forma que a S1 já validou: uma função
com o papel no nome (`pode_ver_orcamento_da_visita`), lendo `pode_ver_financeiro
OR v.tecnico_id = auth.uid()`, em vez de `is_gestor` — cujo significado, nas
palavras da própria S1 (`:290`), *"já mudou uma vez e pode mudar de novo"*.

## P24 — MÉDIO · A S1 §2.3 está morta desde que nasceu: `unidades_select` sobreviveu (2026-09-03, S4)

`cliente_equipamento_unidades` tem **duas** policies de SELECT vivas, e policies
permissivas somam com OR:

| policy | onde | USING |
|---|---|---|
| `unidades_select` | `u3:276-280` | **`true`** |
| `cliente_equipamento_unidades_select` | `s1:124` | cadeia `pode_ver_cliente` |

A S1 §2.3 (`s1:123-132`) dá `DROP POLICY IF EXISTS
"cliente_equipamento_unidades_select"` — **um nome que ainda não existia** — e
nunca derruba `unidades_select`. Grep completo: as únicas quatro menções são
u3:276, u3:278, s1:123, s1:124. **O gate da S1 nunca valeu.**

**E a própria conferência da S1 teria dito isso em 20/08.** A linha
`'inventário: nenhuma policy aberta sobrou (esperado 0)'` (`s1:494-498`) conta
`qual = 'true'` nas três tabelas — ela teria retornado **1**. Ou a conferência
passou batida, ou alguém dropou a policy à mão e o repo não sabe. **Não sei qual;
só o `pg_policies` responde.** Antes de escrever migration, rodar:

```sql
SELECT policyname, qual FROM pg_policies
 WHERE schemaname='public' AND tablename='cliente_equipamento_unidades';
```

**Escopo, para não confundir com R13:** a tabela **não tem coluna de dinheiro** —
é `numero_serie`, `tag_patrimonio`, `imei`, `codigo_barras`, `estado` (u3:30-33),
o que a S1 §2 chama de "informação de segurança física" (`s1:91-93`). Não é
vazamento de valor; é uma promessa de migration de segurança que não foi
cumprida, e isso não pode ficar sem dono.

**E fechar MUDA COMPORTAMENTO, o que provavelmente explica por que ninguém
notou:** `acharUnidadePorSerie` (`pecas.ts:154-164`) é um lookup **global por
número de série, sem filtro de cliente** — "o lookup do técnico em campo".
Aplicar a S1 §2.3 de verdade o escopa por `pode_ver_cliente`, e uma peça de outro
cliente passa a voltar `null`. É o que a S1 quis; é a mudança que a S1 achou que
já tinha feito. Vale conferir com o Davi se o lookup global é intencional antes
de fechar.

## P25 — ~~ALTO · O congelamento da U81 pende de um clique OPCIONAL, e degrada em silêncio~~ FECHADA EM PARTE (U82, 2026-09-05)

**A segunda mão existe desde a U82**, e ela não é a que a U78 prometeu (o app
carimbando sozinho "os blocos abertos até hoje" — isso seria afirmar sem
evidência). São duas peças que não se sobrepõem: `agenda_campo_afirmar`, uma
PERGUNTA por bloco que o app faz ANTES de escrever o status, e
`chamado_solta_agenda`, um gatilho que **não afirma nada** — só desmarca o que
ainda era plano futuro.

**A U82 NÃO MEXE NO PASSADO.** A carga retroativa que afirmaria o passado dos
chamados já concluídos e destravaria os blocos presos foi **cortada** da
entrega: era onde estavam os quatro defeitos fatais das duas primeiras rodadas
de refutação, e ela precisa de números que ninguém mediu ainda. Ver o **P40** e
o arquivo de medição `supabase/migrations/_medir_antes_da_carga_u82.sql`.
Portanto o passivo que a U81 herdou continua inteiro: o que a U82 muda é só o
trabalho **daqui para frente**.

**O que NÃO foi fechado, e virou o P34:** cinco caminhos encerram um chamado sem
passar por uma linha de tela. Para eles a defesa é o chip
(`visitasNaoAfirmadas`), que só age quando alguém abre o chamado. O número que
diz se isso bastou é o lado **ENCERRADO** da conferência 130 da U82.

O texto original fica abaixo, porque ele é o diagnóstico que produziu a U82.

---

A U81 protege o registro de quem foi ao prédio **no instante em que alguém marca
o atendimento como feito**. Fora desse instante ela não faz nada — e há **um
único gesto no sistema inteiro** que o produz: `FormularioDoBloco.tsx:616` →
`useCumprirBloco` → `agenda_campo_cumprir`.

A U78:1566-1568 afirma que existem duas mãos: *"esta e `executarChamado` no app,
que ao iniciar o atendimento marca os blocos abertos até hoje"*. **A segunda não
existe.** `executarChamado` (`src/features/chamados/data.ts:281-293`) chama
`atualizarChamado` com status e carimbos de `chamados`, e nada mais; um grep por
`cumprido_em` em `src/` devolve leituras (`programacao/data.ts`, `modelo.ts`,
`AgendaDoChamado.tsx`) e **uma** escrita. A U80 já mediu o rombo pelo outro lado
— conferência 112: blocos pendentes com dia passado há mais de 7 dias.

**Por que é ALTO e não MÉDIO:** para o bloco nunca carimbado, o defeito da U81
continua **100% vivo**, inclusive na variante muda (responsável sem turma na
semana nova → o DELETE varre todas as linhas `origem='dupla'`, sem sino e sem
rastro). E nada na tela diz que a proteção não se aplicou àquele chamado: ela não
tem alarme próprio, herda o da U80, que é um número numa conferência que só roda
quando alguém a roda. **Quanto mais a operação relaxar no carimbo, mais a U81 é
decoração — e ninguém vê isso acontecer.**

**A correção é estrutural e não está nesta entrega:** dar uma segunda mão ao
carimbo. É a próxima entrega da linha, antes de qualquer tabela nova — o portão
está escrito na U81 (conferência 110) e no §U81 do `PLANO_UNIFICACAO.md`.

**Consulta-canário:**

```sql
SELECT count(*) FROM public.agenda_campo
 WHERE cancelado_em IS NULL AND cumprido_em IS NULL AND dia < (current_date - 7);
```

## P26 — MÉDIO · A U81 congela o que estiver lá, inclusive um palpite de escala HERDADA (2026-09-04, U81)

No instante do carimbo, as linhas `origem='dupla'` podem ser a turma de uma
escala **herdada** — `escala_da_semana` devolve um `herdada boolean` (U76:437-446)
justamente porque ninguém confirmou aquela semana. A U76 §8.4 (:1139-1156)
descreve o buraco palavra por palavra: o apoio nasce com escala herdada, o gestor
abre a semana depois e muda a composição.

Antes da U81 esse palpite era sobrescrito depois por outro palpite. Agora ele é
**carimbado como registro e fica**.

**O agravante é a saída.** Não existe `GRANT UPDATE` em `chamado_apoios` e nunca
existiu (`s3:89-91`): não há como *corrigir* uma linha congelada, só apagá-la e
pôr outra. E a linha nova entra por `adicionarApoio`, com `origem='manual'` e
`criado_por = auth.uid()` — o que **muda o significado de autorização da linha**
sob a S2 (`origem='dupla' OR criado_por IS DISTINCT FROM profile_id`). Corrigir
um congelamento errado degrada a proveniência do registro, e o sistema não avisa
disso em lugar nenhum.

**Considerei recusar o congelamento quando a escala da semana é herdada, e
recusei a recusa:** sem congelar, as linhas ficam desprotegidas e são apagadas —
troca de um problema pelo problema original. A escolha é esta, por extenso:
*prefiro guardar um palpite a apagar um registro*. Fica registrado para o dia em
que alguém achar uma linha congelada errada e quiser saber de onde ela veio.

## P27 — MÉDIO · A cardinalidade do apoio continua errada, e agora ela ACUMULA (2026-09-04, U81)

`chamado_apoios` é `PRIMARY KEY (chamado_id, profile_id)` desde `u1:219`. *"O
Luan foi na terça e o Luan foi na quinta"* é **inexprimível** — não por falta de
coluna, por chave. `congelado_em` diz *que* a linha virou registro e *em qual
ida* (pelo instante da transação), jamais *de qual bloco*. Três consequências
concretas, e a terceira tem prazo:

1. **`TabelaAtividades.tsx:78,222-230`** tem UMA coluna "Apoio" por atividade.
   Ela passa a imprimir mais rostos, sem agrupamento e sem forma para tê-lo.
   Ninguém vai notar que os dois primeiros são de outra semana.
2. **`useApoiosDeTodos` (`home/data.ts:114-133`) tem `.limit(2000)` com
   `if (error) return m`** — teto **silencioso**, nem erro dá. A U81 torna o
   conjunto **monotonicamente crescente** onde antes ele girava em torno de si
   mesmo: linha congelada nunca mais sai por máquina. **O dia de bater o teto
   passou de hipótese a questão de tempo**, e quando ele chegar as pilhas de
   avatar dos cards esvaziam sem uma mensagem.
3. **"Computado POR VISITA" (a 2ª metade da frase do Davi de 02/09) continua sem
   resposta** — ver R107. Nenhuma consulta responde "quantas visitas o Luan fez
   em setembro".

**A saída conhecida** é pendurar o apoio no BLOCO (`u78:171` já a nomeia), e ela
está adiada de propósito atrás do P25: sem disciplina de carimbo, apoio-por-bloco
conta intenções agendadas, não visitas. Quando chegar a hora, `congelado_em` diz
quais linhas são história a carregar.

## P28 — BAIXO · O sino "Você entrou como apoio" não tem ícone (2026-09-04, achado na U81)

`u7:497` grava `tipo = 'chamado_apoio'`; `src/components/NotificationPanel.tsx:36`
só conhece `'demanda_apoio'` — o nome de antes da U7. A notificação cai no
`default` (`:52-54`) e sai com o ícone genérico de Info. Defeito vivo hoje,
independente da U81; achado ao mapear todos os caminhos que tocam o sino.

## P29 — BAIXO · Duas cópias desatualizadas de `pode_editar_chamado` (2026-09-04, achado na U81)

Duas, e as duas ficaram para trás em momentos diferentes:

- **`chamados_select` (`u29:193-194`)** lê apoio **cru**, sem o filtro da S2
  (`origem='dupla' OR criado_por IS DISTINCT FROM profile_id`). Estar em
  `chamado_apoios` te faz VER o chamado. Não é buraco — a S2 matou a
  auto-inscrição na porta de INSERT —, mas é a única cópia da regra que ficou
  para trás. Assimetria viva: **ver ≠ editar**.
- **`DetalheInterno.tsx:205`** é um terceiro gêmeo do predicado, e o único sem
  `apoioValeComoVinculo` (`programacao/modelo.ts:724`), que foi extraído
  justamente porque um teste de mutação provou que regra escondida num
  `.filter()` fica verde. A U81 tocou essa linha (a lista virou objetos) e
  **deliberadamente não a alargou**: mudar autorização de carona numa entrega que
  prometeu não tocar em nenhuma é como se instala um buraco sem querer.

## P30 — BAIXO · O relatório de atendimento imprime UMA pessoa quando a turma foi de duas (2026-09-04, achado na U81)

`src/features/chamados/relatorio.ts` **não lê `chamado_apoios`** — nenhuma linha.
O PDF imprime `linhaCampo("Técnico responsável", tecnicoNome ?? "—")`
(`relatorio.ts:222`), alimentado por `DetalheCampo.tsx:336`
(`tecnicos.find(t => t.id === os.responsavel_id)?.nome`). E quem assina não é
ninguém da Prever: `relatorio.ts:307-335` imprime `os.assinatura_nome` sob
*"Assinatura de quem acompanhou o atendimento"* — é o síndico/cliente.

**Ou seja: o documento que sai para o cliente diz que o atendimento foi de UMA
pessoa quando a turma foi de duas.** Já estava errado antes da U81 e continua
errado depois — ela não regride nem melhora isso sozinha. É o único leitor da
cadeia onde "por visita" seria uma melhora óbvia, e mudar um documento que sai
para o cliente é decisão de produto, não refatoração.

## P31 — MÉDIO · Quem foi na ida aparece na agenda do RETORNO (2026-09-04, U81)

O chamado tem **uma data só** — `data_hora_agendada`, o espelho — e o carimbo da
ida a move para o retorno. Como a linha de apoio agora fica, quem foi na terça
continua aparecendo naquele chamado no calendário (`calendario.tsx:274-277,298`)
e no "Meu dia" (`dashboard.tsx:260` via `useMeusApoios`, `home/data.ts:219-233`)
— mas **na data do retorno**, que não é a dele. E não aparece na terça em que
esteve. Antes da U81 a linha era apagada: ele não via nada, errado de outro jeito.

**Uma lente adversarial propôs filtrar as linhas congeladas fora dessas duas
consultas, e isso foi RECUSADO** — o registro está no diário da U81. O motivo:
no caso COMUM (uma visita só, sem retorno) a linha também fica congelada e a
data do chamado É a data em que a pessoa foi. O filtro apagaria da tela de
histórico exatamente o registro que a U81 existe para guardar, para ganhar
precisão num caso raro. Trocaria um fantasma estreito por um apagamento largo.

**O que resolve de verdade:** o apoio pendurado no bloco. Aí cada linha tem a
data da SUA visita e a agenda deixa de depender do espelho. Enquanto isso não
existe, o defeito é o preço declarado em R107.

## P32 — MÉDIO · `useApoiosDeTodos` tem teto silencioso de 2000, e agora o conjunto só cresce (2026-09-04, U81)

`src/features/home/data.ts:114` traz `chamado_apoios` com `.limit(2000)` e
`if (error) return m` — passado o teto, a pilha de avatares simplesmente para de
mostrar gente, sem aviso. Já era assim antes.

**O que a U81 muda é a inclinação da curva.** Linha congelada nunca mais sai:
o DELETE não a alcança, e não há caminho de descongelamento. O conjunto passa a
crescer de forma **monotônica** — bater no teto deixou de ser hipótese e virou
questão de quando. Duas saídas: paginar, ou trazer só os apoios dos chamados
visíveis na tela (que é o que a consulta realmente precisa).

## P33 — MÉDIO · A reconciliação devolve "corrigido" sem corrigir (2026-09-04, U81)

`reconciliar_apoios_abertos` (U76 §8.4) existe para um caso: o apoio nasceu de
escala **herdada** e o gestor lançou a semana depois, com outra composição. Se o
bloco daquela semana já foi carimbado, a linha errada está congelada — o DELETE
não a alcança, o INSERT acrescenta a pessoa certa, `GET DIAGNOSTICS` conta 1 e a
função devolve **1 chamado corrigido**. O gestor lê sucesso e vai embora com o
nome errado ainda na lista, e essa pessoa mantém acesso ao chamado, ao cliente,
às fotos, ao checklist e ao pedido de compra.

Está declarado em R108 e **medido pela conferência 115** da U81 — o número da
primeira rodada é que diz o tamanho disto. Se for grande, a saída provável não é
desfazer o congelamento (isso reabre o defeito) mas dar ao gestor uma ação
explícita de "esta pessoa não esteve aqui", que hoje só existe como o X do chip,
sem nada na tela dizendo que é preciso usá-lo.

## P34 — ALTO · Cinco caminhos encerram um chamado sem perguntar nada (2026-09-05, U82)

A U82 pôs a pergunta ("estes atendimentos aconteceram?") em três lugares:
`DetalheCampo` (concluir, fechar, cancelar), `PainelDoCiclo` (as três decisões do
ciclo) e o chip da `AgendaDoChamado`. **Não são todos os caminhos.** Encerram um
chamado de campo, hoje, sem passar por nenhum deles:

1. **O arrasto do quadro** — `dashboard.tsx:343-345`, `atualizarChamado(id,
   { status })`. É o encerramento mais barato do app: um gesto de arrumação de
   kanban vira um chamado concluído.
2. **O seletor de status do painel** — `PainelChamado.tsx:1116-1119`. Dois
   cliques, sem laudo, sem pergunta.
3. **Os chips do chamado interno** — `DetalheInterno.tsx`, mesmo caminho.
4. **`decidir_pedido_compra`** (`u9:139-151`) — recusar um pedido de compra
   cancela o chamado por RPC. Nenhuma linha de TypeScript no caminho.
5. **`sincronizar_chamado_da_visita`** (`u38:68-86`) — o gatilho da visita
   comercial. Idem.

Para os cinco, o gatilho `chamado_solta_agenda` faz a parte dele (desmarca o
plano futuro, e o evento `agenda_solta` aparece na linha do tempo), mas
**ninguém afirma nada** — e afirmar é de gente, por desenho (R109). A defesa é o
chip: a `AgendaDoChamado` mostra *"encerrado com N atendimentos que ninguém
afirmou"* com o botão de responder ali mesmo, e ele só some quando alguém
responde. Mas **exige que alguém abra o chamado.**

**O número que decide:** o lado ENCERRADO da conferência 130 da U82. Se ele não
cair em três semanas, o chip não bastou — e a resposta **não é** voltar ao
gatilho que afirma (ele continua mecanicamente impossível de fazer com
honestidade; ver o teorema no §U82 do `PLANO_UNIFICACAO.md`), é **levar a
pergunta ao arrasto do quadro e ao seletor de status**, que é onde ela falta.

**Consulta-canário** (o lado que importa):

```sql
SELECT count(*) AS encerrados_sem_resposta
  FROM public.agenda_campo a JOIN public.chamados c ON c.id = a.chamado_id
 WHERE a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND c.status IN ('concluido','cancelado');
```

## P35 — MÉDIO · O espelho de um chamado encerrado fica na PRIMEIRA visita, e a auditoria não o enxerga (2026-09-05, U82)

`agenda_campo_espelhar` recusa mexer em chamado encerrado (`u78:895`, e a razão é
boa: mexer no espelho de um encerrado MOVE o mês em que ele é contado no painel).
Consequência: num chamado que foi encerrado antes de as visitas serem afirmadas,
`chamados.data_hora_agendada` fica pinada no **primeiro bloco pendente** para
sempre — mesmo depois de o chip afirmar todas.

E a auditoria §9.0 da U78 (`u78:2097`) **filtra chamados encerrados para fora**,
então ela nunca acusa esse desencontro. É uma discordância silenciosa entre a
coluna espelho e os blocos que a produzem.

**Por que não foi corrigido aqui:** recalcular o espelho de um encerrado exigiria
afrouxar `u78:895`, e isso reabre o defeito que aquela cláusula fecha. O SQL de
uma correção pontual (por chamado, à mão) é uma consulta simples; o que não
existe é uma razão para automatizá-la.

### O caso NOVO que a U82 acrescenta a esta dívida: o espelho depois de REABRIR

Quando o soltador desmarca um bloco de plano futuro no encerramento,
`agenda_campo_espelhar` é chamada (`cancelado_em` está na lista `OF`,
`u78:948-951`) e **recusa mexer**, porque naquele instante a linha já é terminal.
O espelho fica apontando para um bloco que não existe mais. Reabrir devolve o
chamado a um status não-terminal — e é o único instante em que aquele `WHERE`
voltaria a passar.

**Uma rodada da U82 chegou a pôr um `PERFORM agenda_campo_espelhar(NEW.id)` no
soltador para consertar isso na reabertura. Ele foi RETIRADO, e a retirada é a
decisão.** A cadeia que ele abria:

1. `agenda_campo_espelhar` escreve `chamados.data_hora_agendada` (`u78:891-898`);
2. essa coluna **está** na lista `OF` de `trg_chamado_apoio_dupla_upd`
   (`u76:1129`);
3. com o chamado **já reaberto** o status não é mais terminal, então
   `chamado_apoio_da_dupla` não volta cedo (`u78:1825`): se a semana do espelho
   mudar, ele chama `chamado_sincronizar_apoio`;
4. lá dentro, o `DELETE` (`u81:417-434`) apaga as linhas `origem='dupla'` não
   congeladas — **a lista inteira** quando `responsavel_id` está vazio, porque
   `v_alvo = '{}'` faz o `NOT` limpar tudo (`u81:409-416`) — e o `INSERT`
   (`u81:461-469`) grava a turma nova **JÁ CONGELADA**, porque a semana do
   espelho novo é a da última visita afirmada e o `max(cumprido_em)` não é NULL;
5. cada linha inserida toca um sino (`trg_notify_chamado_apoio`, `u7:502`).

Ou seja: o gatilho que o cabeçalho da U82 jura que "não afirma nada" passava a
**congelar, apagar e tocar sino** — por efeito colateral de um clique em
"Reabrir", sem ninguém decidir, e congelar concede **acesso permanente** de
edição ao chamado, ao cliente, às fotos e ao pedido de compra (R108).

**O espelho podre depois de reabrir é PRÉ-EXISTENTE**: encerrar um chamado com
bloco futuro já deixa o espelho pinado hoje, sem a U82. Fechar aquele ramo só
para o caso perigoso exigiria reconstruir dentro do soltador os dois estágios de
`agenda_campo_espelhar`, como gêmeo, para saber de antemão se a semana muda — ou
seja, **maquinaria nova para consertar um defeito que já existia**. Ficou dívida.

**A saída que já existe:** rearrastar o bloco na grade. `agenda_campo_marcar`
(`u78:1399`) escreve `dia`/`inicio_min`, o espelho é recalculado pelo caminho
normal, e o chamado reaberto não é mais terminal — logo aquele `WHERE` passa.

## P36 — MÉDIO · Os blocos PRESOS continuam presos: a carga que os destravaria foi adiada (2026-09-05, U82)

Antes da R110, dar "feito" hoje num bloco de dia FUTURO gravava um dia falso **e
prendia o bloco**: imóvel (`modelo.ts`), não-desmarcável (`u78:1522`) e ocupando
a janela futura da equipe para sempre, porque o `EXCLUDE` é
`WHERE (cancelado_em IS NULL)` sem `cumprido_em` (`u78:653-664`). A porta nova
fecha a torneira; **o estoque continua lá**.

A U82 chegou a ter uma terceira passada de carga que movia `dia` desses blocos
para `(cumprido_em AT TIME ZONE 'America/Sao_Paulo')::date` — o único dia que o
banco **prova**. **Ela foi cortada junto com o resto da carga (ver P40)**, e por
duas razões que não são sobre este defeito: a carga era onde moravam todos os
FATAIS das rodadas de refutação, e ela não tinha número.

**A conferência 127 da U82 conta quantos são**, e é o mesmo número da linha 3 de
`supabase/migrations/_medir_antes_da_carga_u82.sql`. Enquanto a carga não vier, o
conserto é por bloco, à mão: abrir na grade, tirar o "feito", mover, recarimbar
— três passos que ninguém descobre sozinho.

```sql
SELECT a.id, a.dia, a.cumprido_em, a.dupla_id, a.inicio_min
  FROM public.agenda_campo a
 WHERE a.cumprido_em IS NOT NULL AND a.cancelado_em IS NULL
   AND a.dia > (a.cumprido_em AT TIME ZONE 'America/Sao_Paulo')::date;
```

## P37 — MÉDIO · A semana ERRADA que já foi congelada não é desfeita (2026-09-05, U82)

Antes da U82, carimbar hoje um bloco de dia futuro fazia o congelamento da U81
comparar `referencia_semanal(NEW.dia)` — a semana **do plano**, não a da visita
— e gravar a turma daquela semana como registro (`u81:330-333`). Desfazer isso
exigiria **apagar linha de `chamado_apoios`**, e a U81 existe justamente para não
apagar. A saída é humana e já existe: o X no chip de apoio remove a pessoa, e
adicionar a certa é um clique. **Não existe "corrigir" um apoio: só remover e pôr
outro** (R108).

**Enquanto a carga do P40 não rodar, esta população é LISTÁVEL**, e é a mesma da
conferência 127: `a.dia > (a.cumprido_em AT TIME ZONE 'America/Sao_Paulo')::date`.
Este é, aliás, um argumento a favor de rodar a carga só depois de olhar o P37 —
ela é a última coisa que apaga esse identificador, e no dia em que rodar precisa
gravar a identidade das linhas antes de mover, ou a lista some.

A conferência 131 da U82 diz quantos desses chamados estão sobre escala
**herdada** (o P26 outra vez).

## P38 — MÉDIO · Afirmar num chamado JÁ ENCERRADO não guarda a turma das OUTRAS semanas (2026-09-05, U82)

**É limitação irredutível, não bug**, e está aqui para que a tela nunca volte a
prometer o contrário.

A U82 divide o trabalho assim: quem afirma é gente, e afirma **antes** do
status. Só nessa ordem o espelho (`chamados.data_hora_agendada`) anda bloco a
bloco e o congelamento da U81 pega a turma de **cada** semana ISO. Dos quatro
pontos em que o app chama a porta, **um** cumpre essa premissa:

| ponto de chamada | status quando a porta é chamada | o espelho anda? |
|---|---|---|
| `DetalheCampo` → *Concluir atendimento* | aberto / agendado / em andamento | **sim** |
| `DetalheCampo` → *Conferir e fechar* | já `concluido` | não |
| `PainelDoCiclo` → o disparo do ciclo | já `concluido` | não |
| o **chip** "encerrado com N atendimentos que ninguém afirmou" | já encerrado | não |

Nos três de baixo, `agenda_campo_espelhar` casa zero linhas (`u78:895`) e
`chamado_apoio_da_dupla` volta cedo em chamado encerrado sem troca de dono
(`u78:1825`). O único congelamento possível ali é o do gatilho BEFORE da U81, e
só para o bloco que cai na semana em que o espelho ficou parado. **Para um bloco
de outra semana, a turma daquela semana nunca foi sequer escrita em
`chamado_apoios`** — não há o que congelar.

**Por que não se conserta:** reconstruir aquela turma exigiria mover o espelho
de um chamado encerrado (o que a U78 recusa por escrito, porque mexeria no mês
em que o chamado é contado) e chamar `chamado_sincronizar_apoio`, cujo `DELETE`
reabriria o defeito que a U81 existe para fechar. A alternativa — inserir as
pessoas direto — é **inventar registro**, que a U64 e a U81 recusaram por
escrito. É a mesma cardinalidade que o R107 já declara: apoio é por **chamado**,
não por visita.

**O que foi feito:** o cabeçalho da migration deixou de afirmar o contrário, e o
texto do chip deixou de prometer que responder guarda o registro de quem esteve
no prédio. Ele agora diz que responder guarda o registro **do atendimento**, e
manda conferir o chip de apoio quando a visita é de outra semana.

**Canário — quantos chamados estão nesse estado:**

```sql
SELECT count(*) FROM public.agenda_campo a JOIN public.chamados c ON c.id=a.chamado_id
 WHERE c.natureza='campo' AND c.status IN ('concluido','cancelado')
   AND a.cancelado_em IS NULL AND a.cumprido_em IS NOT NULL
   AND c.data_hora_agendada IS NOT NULL
   AND public.referencia_semanal(a.dia)
     IS DISTINCT FROM public.referencia_semanal(public.dia_da_dupla(c.data_hora_agendada, c.created_at));
```

Se esse número crescer, a saída não é inventar a turma: é levar a pergunta para
**antes** do encerramento nos cinco caminhos que não perguntam (P34), que é onde
ela falta.

## P39 — BAIXO · Duas decisões de produto da U82 que ficaram por confirmar (2026-09-05)

Duas coisas que a refutação da U82 apontou e que **não são bug**: são escolhas
que continuam de pé e que precisam do Davi para mudar.

**(a) Cancelar um chamado desmarca também os atendimentos de dia PASSADO.** No
chamado *concluído* o bloco de dia passado fica **pendente**, porque "aconteceu
de manhã" e "não vai acontecer" não se distinguem. No *cancelado*, todos são
desmarcados. O argumento a favor da assimetria é que cancelar libera a grade; o
argumento contra é que o bloco de dia passado não ocupa capacidade futura
nenhuma, e desmarcá-lo faz a pergunta **desaparecer** — `visitasNaoAfirmadas`
filtra por bloco pendente, então o chip fica cego exatamente sobre o caso que
ele existe para pegar. Ressuscitar exige gestor (`u78:774-778`).

O que já foi corrigido: **o texto do evento**, que afirmava que os atendimentos
"ainda não tinham acontecido" — a máquina deduzia isso de "estava pendente" e
gravava como fato na linha do tempo. Agora ele diz só o que é verdade.

Canário, para decidir com número na mão:

```sql
SELECT count(*) FROM public.agenda_campo a JOIN public.chamados c ON c.id=a.chamado_id
 WHERE c.natureza='campo' AND c.status='cancelado'
   AND a.cancelado_em IS NULL AND a.cumprido_em IS NULL
   AND a.dia <= (now() AT TIME ZONE 'America/Sao_Paulo')::date;
```

**(b) O botão "Aconteceu no dia marcado" num bloco de dia FUTURO continua
existindo** — e ele produz exatamente o estado PRESO do P36: bloco com
`cumprido_em` e `dia` no futuro, imóvel, não-desmarcável, ocupando a janela da
equipe e com a turma congelada da semana do plano. A carga que limparia o estoque
foi adiada (P40), então esta torneira alimenta uma pilha que ninguém está
esvaziando — é o que torna a decisão (b) mais cara do que parecia.

**Ele fica porque é a única saída de uma colisão de agenda que não impede o
técnico de encerrar o chamado.** A afirmação vem antes do status; se ela for
recusada, o chamado não fecha — e a alternativa seria mandar o técnico ajustar a
grade com a assinatura na mão, que é o pior caso que o desenho existe para
evitar. O aviso da tela passou a citar os **quatro** efeitos, e não um. A porta
aceita **exatamente duas** datas — o dia do próprio bloco e HOJE, que são as duas
que a tela sabe produzir —, então a torneira é estreita e visível. A conferência
127 mede o resíduo.

## P40 — ALTO · A CARGA RETROATIVA da U82 foi adiada, e espera número (2026-09-05, U82)

A U82 foi entregue como **caminho vivo apenas**: a porta (`agenda_campo_afirmar`)
e o soltador (`trg_chamado_agenda_solta`). A carga retroativa — três passadas —
**foi cortada do arquivo** e vira entrega separada.

**O que ela faria, e continua por fazer:**

| passada | o que faz | dívida que drena |
|---|---|---|
| afirmar | carimba o passado dos chamados JÁ CONCLUÍDOS COM LAUDO (diagnóstico **e** serviço executado preenchidos), com **um** pendente e **nenhum** bloco já cumprido | P34 (o estoque de encerrados sem resposta) |
| soltar | desmarca o plano pendente dos chamados já encerrados — a mesma régua do gatilho, para trás | a grade ocupada por plano que não vai acontecer |
| destravar | move `dia` dos blocos PRESOS para o dia do carimbo | P36 / P37 |

**POR QUE FOI CORTADA — e não é preguiça, são duas razões independentes:**

1. **É onde moravam TODOS os defeitos.** Três rodadas de refutação acharam quatro
   FATAIS na U82; os quatro estavam na carga (ou no ramo de reabertura que uma
   rodada acrescentou ao soltador — ver P35). O caminho vivo passou limpo nas
   três rodadas.
2. **Ela não tinha NÚMERO.** Escrever uma carga contra `public.chamados` e
   `public.chamado_apoios` — as duas tabelas mais quentes do sistema — sem saber
   quantas linhas ela alcança é escrever às cegas. Medir antes de escrever é o
   método da casa.

**OS NÚMEROS ESTÃO AQUI:**

```
supabase/migrations/_medir_antes_da_carga_u82.sql
```

Seis SELECTs, **leitura pura** (nenhum `UPDATE`, `INSERT`, `DELETE`, `ALTER`,
`BEGIN` ou `COMMIT`), que rodam a qualquer hora. A **linha 4** é a que decide o
tamanho do problema: *"blocos presos de chamado ABERTO"* — se ela der `0`, a
carga não chega perto de `chamado_apoios` por caminho nenhum e fica muito mais
barata.

**AS TRÊS RECUSAS QUE JÁ ESTÃO TOMADAS, para a carga futura não as re-litigar:**

- **`ALTER TABLE ... DISABLE TRIGGER` não volta.** A U81 declarou por escrito que
  gatilho desligado que alguém esquece de religar é cicatriz da casa (U59/U61); e
  pedir `ShareRowExclusive` sobre `public.chamados` numa transação que já segura
  `RowExclusive` (a cascata do espelho abre a relação para `UPDATE` mesmo casando
  zero linhas) é **escalada de lock** — é como nasce deadlock, com toda escrita de
  chamado do app pendurada atrás. Se a carga precisar impedir uma cascata, ela
  impede pelo **predicado**.
- **O corte de atribuição é DUPLO.** `p.n = 1` pergunta *"há um único pendente?"*;
  a pergunta certa é *"o laudo ainda não tem dono?"*. Ida carimbada à mão pela
  grade + retorno pendente dá **um** pendente, e afirmar o retorno é promover
  "provavelmente" a "aconteceu" — em massa, e **congelando** (R108). O SELECT 1 do
  arquivo de medição já traz as duas cláusulas.
- **A conferência que prova "nada foi apagado" tem de medir IDENTIDADE, não
  contagem.** `chamado_sincronizar_apoio` não apaga, ele **troca** (`DELETE` por
  `v_alvo` seguido de `INSERT` de `unnest(v_alvo)`, no mesmo corpo,
  `u81:417-471`). Turma é par: duas saem, duas entram, e o delta de contagem é
  **zero** — o freio dizia "ok" no exato caso que ele existia para pegar. Com a
  carga, aquela linha precisa de uma foto TEMP por `(chamado_id, profile_id)`.

**Enquanto ela não roda:** nada quebra e nada piora. O caminho vivo já impede que
o estoque cresça (a porta pergunta, o soltador solta), e o chip da
`AgendaDoChamado` é quem drena o passado, um chamado por vez. **O número que diz
se isso basta é o lado ENCERRADO da conferência 130** — o mesmo que decide o P34.

## P41 — MÉDIO · Turma vazia na semana em que o espelho repousa apaga a lista de apoio (2026-09-05, U82)

Quando `parceiros_da_dupla(responsável, semana)` devolve conjunto vazio — o
responsável não está na escala daquela semana, a turma é de uma pessoa só, ou o
chamado ficou sem responsável — `chamado_sincronizar_apoio` roda com `v_alvo`
vazio: o `DELETE` da U81 limpa toda linha `origem='dupla'` **não congelada** e o
`INSERT` é pulado (`u81:437`). A lista de quem esteve no prédio some, sem sino,
sem evento e sem DESFAZER.

**Não é regressão da U82** — é o comportamento que o caminho de dois passos da
grade (arrastar, depois carimbar) sempre teve, porque o arrasto move o espelho
do mesmo jeito. A U82 não piora; ela apenas não conserta.

**Duas versões de uma "pré-trava" foram escritas para isto e as duas foram
apagadas**, e o registro fica aqui para a terceira pessoa não reescrevê-la:
`v_alvo` fica vazio por dois caminhos, e a pré-trava só alcançava
`responsavel_id IS NULL` — que é o caminho quase morto, porque tirar o
responsável já dispara o sincronizar e já apaga as linhas naquele instante. O
caminho comum (responsável presente, turma vazia) exigiria saber **em que semana
o espelho vai repousar**, e a pré-trava roda ANTES do movimento: com outro bloco
pendente o espelho não vai para o dia efetivo, vai para o próximo pendente.
Acertar o predicado seria reconstruir os dois estágios de `agenda_campo_espelhar`
dentro da porta — a mesma maquinaria pela qual o ramo de reabertura foi cortado
do §3. **Mecanismo cuja condição de disparo ninguém consegue avaliar no instante
em que ela roda é pior do que a ausência dele.**

**A saída é humana:** repor pelo chip de apoio. **O canário** é a conferência 132
da U82 (chamados com visita afirmada e nenhuma linha de apoio congelada) — se ela
SUBIR depois que a porta entrar em uso, ou a trava não está fechando, ou é este
resíduo aparecendo.

## P42 — MÉDIO · A janela de carregamento continua cega, e a grade anda junto (2026-09-08, U84)

**O que foi consertado.** `FormularioDoBloco` recebe `blocos` de uma consulta de
UMA SEMANA (`useBlocosDaSemana` / `useBlocosDaGrade`) e tem um `<input
type="date">` LIVRE. Até esta rodada a consulta era fixada na ABERTURA e **não
seguia o campo**: trocar a data para outra semana deixava a lista sem um único
bloco daquele dia, e `blocosDoDia` — que alimenta `erroDoAgendamento` — passava a
ver zero. O formulário deixava de enxergar o conflito e de somar a jornada
daquele dia, ou seja, ficava **mais permissivo que a porta**: a tela dizia que
podia e o EXCLUDE recusava depois, com 23P01. É a pior direção possível para uma
divergência entre a tela e o banco, e o defeito é **PRÉ-EXISTENTE**.

A correção levantou o dia para o invólucro que faz a consulta (`aoTrocarDia`),
nas três portas: `AgendaDoChamado` (estado local `diaConsultado`),
`/chamados/programacao` (o `setDia` que a página já tinha) e o
`abrirDarHorario`, que abre o formulário no dia do chamado — que pelos "irmãos"
pode ser de outra semana, sem ninguém ter trocado nada.

**O que NÃO foi consertado, e fica declarado:**

1. **A janela de carregamento.** Entre trocar o dia e a consulta nova voltar, a
   query key muda, `data` volta a `undefined` e `blocos` fica `[]` (nenhuma das
   duas consultas usa `placeholderData`; a palavra não aparece uma vez em
   `src/`). Nesse instante `erroDoAgendamento` vê zero blocos e não recusa nada.
   Fazê-lo recusar exigiria um estado de carregamento atravessando o modelo puro,
   e um formulário que se trava sozinho enquanto carrega é pior que a janela de
   menos de um segundo que ele fecha. **O banco continua sendo a porta** — o
   EXCLUDE e a RPC não têm janela nenhuma.
2. **`useBlocosDaGrade` devolve `erro` e a página o DESCARTA**
   (`chamados.programacao.tsx`: `const { blocos, idsDeChamado } = ...`). Uma
   consulta de semana que FALHA deixa `blocos = []` indefinidamente, e aí a
   cegueira do item 1 deixa de ser uma janela de um segundo. Vale uma linha, mas
   é decisão de desenho (o que a tela faz com o erro), não conserto mecânico.
3. **A grade anda junto.** Em `/chamados/programacao` o invólucro que consulta é
   a própria página, então trocar o dia no formulário para outra SEMANA navega a
   grade. É deliberado (ao fechar, a pessoa cai na semana em que acabou de
   marcar), está no manual, e é mudança de comportamento visível. Dentro da
   mesma semana o formulário **não** avisa — a consulta devolveria a mesma lista,
   e sem essa guarda cada tecla no campo de data seria uma navegação.
4. **A guarda de semana NÃO cobre o ano digitado dígito a dígito, e isso é
   escolha, não descuido.** Teclar `2026` num `<input type="date">` produz as
   datas dos anos `0002`, `0020`, `0202` e `2026`. São **quatro semanas
   distintas**: a guarda aprova as quatro, e são quatro navegações de página
   inteira (quatro chaves de `useBlocosDaSemana`, a grade piscando em séculos
   passados, `equipesDaSemana` esvaziando o `<select>` a cada uma). Antes desta
   rodada eram zero, porque não havia aviso nenhum — é custo introduzido aqui.
   **Por que não se pôs um piso** (`v >= "2000-01-01"`): o campo continuaria
   ACEITANDO o ano parcial, só que sem avisar o invólucro — e aí `blocos` volta
   a não conter o dia escolhido, que é exatamente a cegueira PRÉ-EXISTENTE que
   esta prop veio consertar. Trocaríamos três navegações desperdiçadas e
   **visíveis** por uma checagem de conflito **cega**, que é a direção errada
   pela doutrina da casa. Os três textos que sugeriam que a guarda cobria isso
   (o comentário do `FormularioDoBloco`, o do `verificar-logica.cjs` e este item)
   foram corrigidos nesta rodada — a asserção CRÍTICA justificava-se por um
   buraco que ela não fecha.

## P43 — MÉDIO · A casca `geocode()` colapsa "não achei" e "o serviço recusou" (2026-09-08, U84)

`geocodificarEndereco` (servidor) **distingue** `nao_encontrado` de
`servico_falhou`. A casca de `src/features/gerencial/data.ts` faz
`return r.ok ? r.endereco : null` e apaga a diferença; as quatro telas dizem a
mesma coisa.

**Por que importa.** O bloqueio do Nominatim é **por IP** e cai sobre a operação
inteira, e ele manda 429 antes de bloquear. Uma frase que diz "este endereço não
existe" nesse momento é a única do sistema que **instrui a pessoa a martelar** o
serviço que acabou de recusá-la: ela corrige o endereço, clica de novo, corrige
de novo, clica de novo.

**O que foi feito nesta rodada, e o que não foi.** A frase parou de mentir: as
quatro telas passaram a dizer que pode ser o texto **ou** o serviço, e que
repetir na mesma hora não adianta. O que **não** foi feito é levar o motivo até
a tela — isso muda o contrato de `geocode()` e as quatro chamadas. Enquanto não
for feito, o servidor também não tem o ramo 401/403/429 que devolveria
`sem_provedor`: pô-lo agora seria código sem leitor.

**A assinatura do caso grave, para quem for diagnosticar.** Se o Nominatim banir
a identidade (o bloqueio é por IP e vale para a operação inteira), o sintoma em
produção é **idêntico** ao de um blip de rede — e permanente. O que separa os
dois é o alcance: *"o Localizar parou de funcionar em todas as telas ao mesmo
tempo, e continua parado"* é banimento, não falha passageira, e a resposta é
escrever à OSM — não trocar o texto do endereço. Nada no sistema diz isso hoje;
está dito aqui.

## P44 — ~~ALTO~~ **CONSERTADO** · `'prospecto'` tinha DOIS escritores, e os dois saíram (2026-09-08, U84)

**Isto não é mais uma pendência. Fica escrito porque a lição vale, e porque a
conferência 7 da migration da U84 nasceu daqui.**

A U27 (u27:213-218) derrubou `'prospecto'` do CHECK assim que nenhum prospecto
sobrou: `CHECK (situacao IN ('ativo','inativo'))`. O app já não conhecia o valor
— `SituacaoCliente` é `"ativo" | "inativo"` — e ainda assim **dois** caminhos o
gravavam:

1. **`gerencial.nova.tsx`** — `criarCliente({ ...dadosDoCliente, situacao:
   "prospecto" })` quando a visita não tem cliente vinculado e nenhum
   equivalente é achado. Todo prédio novo cadastrado por aquela tela batia em
   `23514`, e como é a **mesma mutação**, a criação da VISITA inteira caía junto.
2. **`consolidarGrupo`** (`src/features/clientes/data.ts`) — `situacaoSugerida`
   entrava no `patch`, e no ramo de `UPDATE` ela ficava **fora do `preservar`**.
   Com o CHECK apertado vivo, `/clientes/migrar` morria; com o frouxo, um
   cliente **oficial e ativo** era rebaixado a `'prospecto'` porque a visita dele
   não tinha `proposta_resultado = 'aceita'`.

O segundo era o pior e era o que **não estava declarado** — a versão anterior
desta pendência nomeava só o primeiro, e o comentário da conferência 7 também:
um censo que declarava um recorte que ele não tinha (regra 3).

**Correção: deleção pura.** Os dois escritores foram apagados e
`situacaoSugerida` foi deletada. Não era escolha de produto entre duas saídas: a
U27 já fechou `'prospecto'` **com argumento**, e `SITUACAO_LABEL['prospecto']` é
`undefined` em toda tela que renderize o valor. O `INSERT` cai no `DEFAULT
'ativo'`, aceito pelas duas versões do CHECK. Há asserção com **par negativo**
nos dois caminhos (o de `consolidarGrupo` recorta o objeto `patch` e pergunta se
ele NOMEIA a coluna, e não se contém um literal).

### A LIÇÃO, E ELA É A MELHOR DESTA RODADA: baseline de erro de tipo é onde defeito de PRODUÇÃO se esconde

O `tsc` acusava os **dois**, o tempo todo:

```
src/features/clientes/data.ts(267,13):            error TS2322: Type '"prospecto"' …
src/routes/_authenticated/gerencial.nova.tsx(350,68): error TS2322: Type '"prospecto"' …
```

Eles estavam dentro do baseline de **83** erros — o número que a casa vinha
carregando como "pré-existente, do `types.ts` desatualizado do Supabase" e que
ninguém lia linha a linha. A conta da queda, com as duas causas separadas:

| de | para | por quê |
|---|---|---|
| 83 | 78 | a consolidação das quatro cópias de Nominatim tirou 5 erros de `visita.$id.tsx` |
| 78 | **59** | os DOIS escritores de `'prospecto'` saíram |

Dezenove erros — quase um quarto do baseline — eram consequência de **dois**
defeitos de produção, e a máquina apontava o dedo desde sempre.

O critério "não criar erro novo" é barato de verificar e por isso sobreviveu;
o que ele não faz é **olhar para os que já estão lá**. Um baseline de erro de
tipo não é ruído de fundo: é uma lista de coisas que o compilador considera
erradas e que ninguém conferiu. Quando um número desses cai sozinho depois de um
conserto, é sinal de que havia mais defeito escondido ali — e vale reler a lista
inteira depois de cada queda. (Baseline vivo: **59**, medido nesta rodada.)

## P45 — BAIXO · O que a U84 mediu e deixou como está (2026-09-08)

- **O Nominatim não tem cache nenhum.** Clicar "Localizar" duas vezes no mesmo
  texto são duas requisições, serializadas a 1,1 s pelo freio.
- **O freio é por ISOLATE** (`src/lib/ritmo.ts`): o alvo de deploy é Cloudflare
  (`vite.config.ts`), e em Workers o isolate é a unidade normal de escala. Dois
  isolates são dois freios. A defesa distribuída seria reivindicação atômica no
  Postgres, e ela não se compra para um botão.
- **`geocodificar.functions.ts` manda `davi@grupoprever.com.br`** no User-Agent.
  É o que a política do Nominatim pede e está certo; fica dito que é um endereço
  pessoal indo para um terceiro, e que um `contato@grupoprever.com.br` faria o
  mesmo trabalho.
- **A frase de reserva do `ClienteForm`** (*"Coordenada já cadastrada — ninguém
  conferiu nesta sessão"*) também aparece logo depois de um "Localizar" que
  FALHOU, porque a falha limpa `resolvido` e deixa `lat/lng` do cadastro. Naquele
  instante a verdade é "a busca acabou de falhar".
- **`/gerencial/nova` é a única das quatro telas que não diz nada sobre
  coordenada NÃO conferida.** Depois de `aplicarCliente` o estado é
  `geoStatus="ok"` com `resolvido=null`, então o bloco da frase não renderiza e
  a tela imprime **zero** texto sobre uma coordenada que vai ser gravada.
  `ClienteForm` tem a frase de reserva para exatamente esse estado
  (*"Coordenada já cadastrada — ninguém conferiu nesta sessão"*). Uma cópia dela
  fecharia a assimetria; é acréscimo de tela, e esta rodada foi de limpeza.
- **A hora proposta é calculada sobre a lista VAZIA e trava lá.**
  `FormularioDoBloco`: no primeiro render depois de `abrirDarHorario` com
  `setDia` para outra semana, `blocos = []`, `primeiroInicioPossivel` devolve
  09:00 + deslocamento, o efeito grava e `jaPropos.current = true` — e nunca
  recalcula quando a semana chega. O campo abre com uma hora que pode colidir.
  É **visível** (`erroDoAgendamento` acusa em seguida) e equivalente ao que já
  acontecia antes desta rodada.
- **`duplaId` sobrevive à troca de semana sem ninguém recusar.** Trocar o dia
  para uma semana onde a equipe escolhida não tem composição faz a lista perder
  a `<option>`; o `<select>` fica em branco e o estado continua com o uuid.
  `erroDoAgendamento` confere conflito de PESSOA e nunca se a equipe **existe**
  naquela semana. Esta rodada melhorou (a lista agora acompanha a semana) e com
  isso tornou a falha visível.
- **`consolidarGrupo` pode disparar o gatilho da U84** (`clientes/data.ts`):
  `preservar` mantém a latitude existente e escreve o endereço da visita quando o
  cliente estava sem endereço — cliente com coordenada e sem `endereco` (existem;
  `useClientesOrfaos` filtra por `!c.endereco`) perde a coordenada ao ser
  consolidado. Consistente com a política do gatilho, e está no manual.

## P46 — A ESTIMATIVA DE DESLOCAMENTO: entrega adiada, com o desenho e os defeitos já apurados (2026-09-08, U84)

Esta era a Fase 2. Ela foi **construída, refutada três vezes e retirada inteira
do repositório** — não deixada dormente, porque código inerte com defeito
conhecido acorda no dia em que alguém liga a chave, semanas depois, quando
ninguém lembra dos defeitos. O que se aprendeu fica aqui.

### O que ela precisa ANTES de existir: `ORS_API_KEY`

Ela lê `process.env.ORS_API_KEY` numa função de servidor. Essa variável **nunca
existiu** neste ambiente: não está no `.env`, não estava na documentação, e
ninguém pediu ao Davi que a criasse. A entrega roda permanentemente degradada
sem ela, com uma frase cinza como único sintoma.

**O gesto, quando for a hora:** ler os termos da camada gratuita do
OpenRouteService (**ninguém deste repositório os conferiu**), gerar a chave, e
colá-la no painel da **Lovable** como `ORS_API_KEY` — **sem** prefixo `VITE_`,
porque `VITE_` publica a variável no bundle do navegador e a chave é da empresa.

### O desenho que vale a pena reaproveitar

- **A estimativa NUNCA entra no campo.** O digitado mora numa CAIXA com borda e
  cursor; a estimativa mora num TEXTO cinza prefixado por `≈`, onde é impossível
  digitar. A distinção é física, não uma frase que se lê ou não se lê — e por
  isso as cinco peças de um desenho "escreve no campo e o digitado vence"
  (`tocou`, `jaTratou`, `origemDoValor`, despertador, prazo de validade) não
  precisam existir.
- **Um motivo por caso, com frase própria.** "Não foi possível calcular" é
  inútil: não diz se falta cadastrar a coordenada de um cliente (conserto de 30
  segundos), se a sede não foi conferida (conserto de uma vez) ou se o serviço
  caiu (não é conserto de ninguém). Eram onze motivos e onze frases distintas,
  com censo exigindo que fossem distintas.
- **A CHAVE DO PAR.** A resposta guardada carrega a chave do par ordenado de
  coordenadas que a produziu, e a tela só pinta um número cuja chave é
  exatamente a do trecho de agora. É o que impede "35 min calculados a partir de
  ⟨origem nova⟩" sem despertador e sem prazo de validade.
- **Nunca trava e nunca inventa.** Nenhum caminho de falha devolve minutos. Não
  há fallback de linha reta — a geodésica é sempre ≤ à rodoviária, logo
  subestima **sempre**, e o deslocamento é aditivo na jornada e negativo no
  EXCLUDE: um erro que aponta sempre para "cabe mais" ACUMULA. Não há fator de
  pico: não existe uma única medição de deslocamento real na operação contra a
  qual calibrá-lo.
- **A SEDE NASCE SEM COORDENADA.** O endereço dado foi *"Rua Conde De Linhares,
  243"*, sem cidade. Existe uma em **São Paulo** e outra em **Belo Horizonte**, a
  507 km. Adivinhar produziria um número plausível no primeiro atendimento de
  todos os dias, para sempre, em silêncio. O gesto humano é: geocodificar com
  `Rua Conde de Linhares, 243 / Interlagos / São Paulo / SP / 04802-130`, **LER o
  bairro/cidade/UF que voltaram** (não o que foi mandado), e só então colar a
  coordenada — conferida contra a linha da própria empresa na base da U24
  (u24:80), num raio de 3 km.
- **Dois clientes no mesmo ponto ⇒ "não sei", nunca zero.** 46 clientes da base
  dividem 20 coordenadas (a U24 geocodificou por CEP, e um CEP cobre a quadra).
  Zero seria afirmar "coladinhos" sobre algo que o mapa não sabe — e não custa
  nada devolver nada, porque `deslocamento_min` é `NOT NULL DEFAULT 0`.

### OS DEFEITOS JÁ ENCONTRADOS — para não serem redescobertos

Os quatro primeiros passaram **por dentro** de um portão verde de 2406 asserções.

1. **O PISO DA ADOÇÃO USAVA O FIM DO DIA.** A adoção recebia
   `jornadaDoDia(blocosDaEquipeNoDia(...)).ultimoFimMin` — o `Math.max` de TODOS
   os blocos do dia, inclusive os que começam DEPOIS do candidato. A origem, ao
   contrário, era escolhida entre os que começam ANTES. Os dois lados usavam
   recortes diferentes do mesmo dia. Medido: dia com 09:00–10:00 e 14:00–15:00,
   candidato às 11:00 que **cabe** (o `erroDoAgendamento` real devolve `null`) —
   o chip oferecia *"adotar 25 min e mover o início para 15:25"*, habilitado, com
   o número medido a partir de um cliente que às 15:25 não é mais o anterior. No
   isento é pior: uma corretiva urgente às 06:00 ia para 15:30.
   **O conserto certo é deleção:** tentar EM PÉ primeiro e só mover quando o
   candidato em pé for recusado.
2. **`diaCarregado` COMPARAVA O DIA PEDIDO COM ELE MESMO.** A guarda derivava de
   `diaDosBlocos`, que era o dia que a consulta **pediu**, não o que a lista
   **cobre**. Os dois andavam juntos no mesmo render, então a guarda nunca
   fechava — e é justamente na janela de carregamento (`blocos = []`) que a
   origem cai para a SEDE. **O conserto é o invólucro dizer o dia que a resposta
   EM MÃO cobre** (`diaDosBlocos={isPending ? "" : dia}`), reusando o motivo
   `dados_incompletos` que já existe.
3. **Toda abertura pelo PainelChamado media a estrada desde a sede** pela duração
   de um round-trip do Supabase, e o cache do par tornava isso determinístico:
   o chip aparecia habilitado, com o endereço da sede por extenso, antes de os
   blocos chegarem.
4. **Trocar a data disparava DUAS requisições ao ORS por troca**, e uma era
   sabidamente errada (a da janela de carregamento). Some com o conserto de (2).
5. **Um único 429 desligava a estimativa pela sessão inteira**, sem volta e sem
   frase que dissesse isso (o latch `SEM_PROVEDOR` é de módulo e só um F5 o
   zera). Não travar está certo; ficar mudo o dia inteiro sem avisar não.
6. **R54 — a atividade pode ter VÁRIOS locais.** `chamados.cliente_id` é só o
   local principal; os demais moram em `chamado_locais`. Para uma atividade de
   três prédios a estimativa media a estrada até UM deles, e o rótulo nomeava um
   local que **é** um dos locais — a frase lê como verdadeira e o número está
   errado **para menos**, na direção que enche a grade. Recusar exigiria ler
   `chamado_locais` por chamado dentro do modal (N+1).
7. **Adotar apaga a procedência.** Depois do clique o número mora no mesmo
   `agenda_campo.deslocamento_min` de um valor digitado, e nada distingue os dois.
   Um bloco encaixado depois deixa o valor obsoleto, somando na jornada e no
   EXCLUDE, sem lugar onde a discrepância apareça (`bloco_existente` recusa
   recalcular, por desenho). `deslocamento_calc_min` **não existe**: u78:565-574 a
   nomeia como decisão da Fase 2.
8. **A medição "previsto × calculado"** (tabela `trecho_estimado` com
   reivindicação atômica) é a melhor ideia que apareceu no desenho, e é uma
   pergunta de MEDIÇÃO, não de agendamento. Ela nasce junto com
   `deslocamento_calc_min`, quando houver consumidor.

### O que a operação vai sentir quando isto existir

Os minutos de estrada sempre foram reais e nunca foram contados. Quando o
deslocamento passar a ser preenchido de verdade, um dia de três atendimentos
deixa de ocupar 300 minutos e passa a ocupar ~390 — e o quarto atendimento de 90
min **deixa de caber**. A grade não quebrou: ela parou de mentir. Isso precisa
ser dito à operação **antes** do deploy, não depois da primeira recusa.

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


## P47 — MÉDIO · O calendário está conferido só de 2025 a 2026, e ele NÃO avisa quando a lei muda (2026-09-08, U85)

`src/lib/feriados.ts` responde para qualquer ano entre 1583 e 2400, mas a faixa
**conferida** é `ANO_CONFERIDO_DESDE = 2025` a `ANO_CONFERIDO_ATE = 2026`. Fora
dela as datas são **derivadas** (o computus mais as leis já conhecidas), não
conferidas contra o decreto.

**O piso desceu de 2007 para 2025, e isso é conserto e não regressão.** O 2007
era o ano da **Lei municipal 14.485**, e `conferido()` não pergunta "a norma
existe?": pergunta "**alguém olhou?**". Com o piso na lei, a faixa avalizava
vinte anos dos quais treze ninguém conferiu — **2021 entre eles**, e 2021 teve
antecipação municipal de feriados em São Paulo (a mesma classe de ato da Lei
17.341/2020) que **não está** na tabela `EXCECOES`. Abrir março de 2021 na grade
dava a barra de aviso escondida, o PDF dizendo "conferido", e quatro dias
pedindo 14h onde a cidade pediu 24. O piso agora é o primeiro ano cujas datas
estão presas, ano a ano, contra o decreto publicado, em asserção nomeada do
verificador — e o verificador **recusa** um piso que avalize ano sem asserção.

**Para subir o piso (ou baixá-lo):** abra o decreto do ano, acrescente a
asserção com as datas dele em `scripts/verificar-logica.cjs`, ponha o ano em
`ANOS_PRESOS_CONTRA_DECRETO` e só então mexa na constante. Na ordem inversa, o
verificador acende.

**O que é impossível:** avisar. Uma lei nova não emite sinal para dentro de um
arquivo `.ts`. Se a Prefeitura criar, mover ou extinguir um feriado, o módulo
continua respondendo com convicção a resposta antiga.

**O que existe no lugar:** a divergência é **barata** de consertar (abrir o
decreto anual, colar as datas na tabela `EXCECOES` e subir a constante) e
**visível** de fora — `conferido(ano)` devolve falso, a barra do mês do
sobreaviso escreve o aviso, e o **PDF imprime o aviso no cabeçalho**, porque a
folha circula por e-mail e sobrevive à tela.

**Consequência se ninguém fizer:** um feriado novo não conhecido faz o
sobreaviso pedir **14h** onde deveria pedir **24h**, e fará o cronograma de dia
útil da Fase 4 contar um dia a mais. Nenhum dos dois erra alto o bastante para
alguém notar por acaso.

**As pontes NÃO estão na tabela**, e é decisão: ponte é ponto facultativo,
facultativo conta como dia útil para empresa privada, então incluí-las não
mudaria **nenhuma** resposta do módulo — só acrescentaria um nome no tooltip, ao
preço de citar um decreto que ninguém tinha na mão.

## P48 — BAIXO · O escalar do sobreaviso não sabe a HORA do handover (2026-09-08, U86)

`public.sobreaviso.horas` é um `smallint` por (dia, pessoa). Ele responde
"quantas horas" e não "de que hora a que hora". É o preço assumido de recusar o
intervalo `(dia, inicio_min, fim_min)`, que a U78 já havia recusado por ser
fatal para plantão que atravessa a meia-noite
(`docs/PLANO_UNIFICACAO.md:5033`).

Na prática o horário é convenção — o handover é sempre às 08:00 de segunda, e o
expediente vai das 08:00 às 18:00 —, e é dela que sai a cobertura 14/24. Se um
dia a operação passar a ter troca em horário variável, **o conserto é pequeno e
preserva o histórico**: `ALTER TABLE ... RENAME horas TO minutos`, um
`UPDATE ... SET minutos = minutos * 60`, e trocar o CHECK por
`> 0 AND <= 1440`. Três linhas, uma vez.

## P49 — MÉDIO · Editar o sobreaviso de um mês já fechado NÃO avisa o fechamento (2026-09-08, U86)

O sobreaviso é **plano que vira registro por decurso**, e editar o mês passado é
**correção**, não falsificação — proibir empurraria a correção para uma planilha
fora do sistema, onde a folha e a tela discordam e ninguém sabe qual está certa.

**O custo:** um mês que o financeiro já fechou pode ser reaberto e alterado sem
que o fechamento saiba. Não existe coluna `travado`, de propósito: um booleano
que qualquer escritor liga devolve a regra ao estado de promessa, que é o que a
U78 recusou no `sobreposicao_ok`
(`20260901090000_u78...sql:641`).

**O que existe:** `alterada_em` e `alterada_por` em cada célula, o que torna
a alteração pós-fechamento **encontrável**. Se um dia a trava dura for
necessária, o lugar dela é o **fechamento**, que já existe e já sabe travar.

## P50 — ALTO · `montar_fechamento` usa `fechamento_id` NU e levanta 42702 (2026-09-08, achado pela U86)

**Achado pelo detector de classe que nasceu na U86**, não por relato de uso.

`public.montar_fechamento(text, date)` (migration U5,
`20260818220000_u5_fechamentos.sql:89`) declara `fechamento_id` como coluna
do `RETURNS TABLE`. No corpo, ela usa esse nome **NU duas vezes** contra
`public.cobrancas`, que tem uma coluna com exatamente esse nome:

- `u5:134` — `AND fechamento_id IS NULL`
- `u5:139` — `WHERE fechamento_id = v_id AND status <> 'cancelada'`

Em PL/pgSQL, com o `plpgsql.variable_conflict = error` padrão, um nome que é ao
mesmo tempo parâmetro OUT e coluna de tabela em escopo levanta
**42702 — `column reference "fechamento_id" is ambiguous`**, e isso acontece
**em execução**, não na leitura. Quem chama é
`src/features/financeiro/fechamentos.ts:88`, ou seja, o botão de **montar
fechamento**.

**Por que NÃO foi consertado na U86.** Três razões, nesta ordem: a U5 **já
rodou** e o repositório nunca edita migration aplicada; o conserto é uma
migration nova sobre a função mais cara do financeiro; e ela **não podia ser
exercitada** na rodada do sobreaviso — escrever DDL não testada sobre o
fechamento como prato de acompanhamento de outra entrega é exatamente o
mecanismo que já foi fatal duas vezes aqui.

**O remédio, quando for a hora:** `CREATE OR REPLACE FUNCTION
public.montar_fechamento` com a tabela aliasada nos dois pontos —
`UPDATE public.cobrancas c SET fechamento_id = v_id WHERE c.status = 'aberta'
AND c.fechamento_id IS NULL AND c.data_referencia BETWEEN ...` e
`... FROM public.cobrancas c WHERE c.fechamento_id = v_id AND c.status <>
'cancelada'`. O alvo de `SET` **não** precisa (nem pode) ser qualificado.
Antes de subir, **exercite o botão** de montar fechamento num período de teste:
se hoje ele já devolve 42702, o conserto é visível na primeira tentativa.

**A guarda permanente:** o censo em `scripts/verificar-logica.cjs` declara esta
ocorrência (`fechamento_id x2`) e **conta** as ocorrências, não a primeira —
uma nova acende, e consertar só metade das duas também acende.

---

## P51 — ALTO · `is_gestor()` não olha `ativo`: um ex-funcionário com login vivo é gestor do sistema INTEIRO (2026-09-08, achado pela U86)

`public.is_gestor(uuid)` (`supabase/migrations/20260818230000_u6a_papel_sac.sql:51-66`)
decide por **papel** (`user_roles.role IN ('admin','comercial','sac')`) e por
**cargo** (`profiles.cargo IN ('admin','comercial','sac')`). Ela **não consulta
`profiles.ativo`** — conferido, zero ocorrências no corpo. Quem sai da empresa e
mantém o login continua sendo gestor para tudo o que essa função guarda.

**O ALCANCE, MEDIDO** (recorte declarado: ocorrências fora de linha de
comentário, em `supabase/migrations/*.sql`):

| medida | valor |
|---|---|
| arquivos de migration que a mencionam | **28** |
| ocorrências vivas | **121** |
| *statements* `CREATE POLICY` que a usam (replays de DROP/CREATE incluídos) | **41** |

*(Era 27 / 110 / 40 na U86. A U87 acrescentou um arquivo, onze ocorrências e uma
policy — o gate de procuração das duas portas do plantão e a policy de leitura
de `atendimentos_plantao`. **O número sobe a cada entrega, e é essa a questão:**
enquanto a decisão não é tomada, a superfície que o conserto vai ter de
atravessar cresce. Cada uma das onze vem com o teste de vínculo escrito ao lado,
justamente porque `is_gestor` sozinha não segura.)*

Trocar a função é trocar o comportamento de **dezenas de policies de uma vez**,
em telas que ninguém exercitou nesta rodada. Por isso **não foi consertada de
passagem** — é decisão do Davi, e ela precisa do número na frente.

**O que a U86 fez em vez disso:** pôs o teste de vínculo *ao lado* de
`is_gestor()` na própria fronteira do sobreaviso — na policy de escrita e nos
gates das duas RPCs (`AND EXISTS (… p.ativo AND p.status <> 'pendente_aprovacao')`).
O ex-funcionário fica de fora **aqui**, e só aqui.

**As duas saídas, quando for a hora.** (a) Acrescentar `AND EXISTS (… p.ativo)`
dentro de `is_gestor()`, o que conserta as 40 policies de uma vez e é a mudança
mais arriscada do repositório até hoje — exige rodar o sistema inteiro depois.
(b) Revogar o login de quem sai (o que hoje **nada** faz), tratando `ativo =
false` como o gesto de desligamento de verdade. A (b) é mais barata e é a que
resolve o problema que o `ativo` já promete resolver.

**A guarda permanente:** o verificador mede o corpo de `is_gestor` (que ele
decide por cargo e **não** por `ativo`) e o censo das três medidas acima. Se
alguém consertar a função, a asserção acende — e o que ela pede é que o número
seja atualizado junto com a decisão.

---

## P52 — MÉDIO · Os PDFs perdem em silêncio todo caractere acima de U+00FF (2026-09-08, achado pela U86)

`jsPDF` com a fonte padrão (helvetica) codifica em **WinAnsi**, um byte por
caractere, e **descarta calado** tudo o que não couber. Medido nos bytes de um
PDF gerado com o mesmo par de bibliotecas que o app importa:

```
"-" U+002D  -> "([-]) Tj"   OK        "–" U+2013 -> "([]) Tj"   SUMIU
"·" U+00B7  -> "([·]) Tj"   OK        "—" U+2014 -> "([]) Tj"   SUMIU
"ç ã ê á"                   OK        "•" U+2022 -> "([]) Tj"   SUMIU
                                      "…" U+2026 -> "([]) Tj"   SUMIU
```

Os acentos passam. A **meia-risca, o bullet e as reticências, não** — e nenhum
dos quatro PDFs do sistema embute fonte (`grep addFont/addFileToVFS` = 0 no
repositório inteiro).

**Consertado na U86:** `src/features/sobreaviso/pdf.ts`. O `—` era o marcador do
**pior caso** ("sem ninguém"): a legenda do rodapé explicava um símbolo que a
página nunca imprimia, e a célula do dia descoberto saía em branco. Trocado por
`-` e `·`, que são WinAnsi. Há asserção varrendo o arquivo por qualquer ponto de
código acima de `0xFF` fora de comentário.

**VIVO HOJE, e não foi consertado** (é outro PDF, que já circula por e-mail, e
mexer nele de passagem é a classe de risco que esta casa já pagou duas vezes):

- `src/features/chamados/relatorio.ts` — `doc.text(os.numero ?? "—", …)`: OS sem
  número imprime **em branco**; todos os placeholders `—`; `• ${…}` na lista de
  peças, que perde **todas** as marcas; "Registro fotográfico — antes/depois",
  que sai "Registro fotográfico  antes".
- `src/features/projeto/ExportarTab.tsx` — mesmos placeholders.

**O remédio, quando for a hora:** trocar os caracteres (é o conserto barato) ou
embutir uma fonte UTF-8 via `addFileToVFS` + `addFont` — o que muda o tamanho de
todos os PDFs e é decisão, não reflexo. A asserção da U86 já mede que o defeito
**existe** em `relatorio.ts`, para o dia em que alguém o consertar não ficar sem
saber que ele existia.

## P53 — BAIXO · Atendimento de plantão apagado não deixa lápide (2026-09-09, U87)

`plantao_apagar` faz `DELETE` e não escreve nada em lugar nenhum. Um atendimento
de plantão registrado e depois apagado **some sem rastro**: não há coluna
`apagado_em`, não há tabela de eventos, e `chamado_eventos` não é tocado (o
atendimento não é chamado, e pendurar um evento na linha do tempo de um chamado
alheio seria pior).

**Por que ficou assim, e não é descuido.** Hoje o atendimento não carrega
dinheiro nenhum, não alimenta fechamento, não alimenta folha e não é lido por
objeto nenhum do banco — a tabela é folha. O único dano de um apagar indevido é
perder o registro de que alguém trabalhou de madrugada, e quem pode apagar é o
próprio plantonista ou quem responde pela operação. Uma lápide (coluna
`apagado_em` + filtro em toda leitura, ou uma tabela `atendimentos_plantao_lixo`)
é **mecanismo novo para consertar menor** — e mecanismo novo para consertar menor
já virou fatal duas vezes neste projeto (regra 8). O carimbo que existe é
`alterado_por`/`alterado_em`, e ele cobre a CORREÇÃO, não a remoção.

**A CONDIÇÃO PARA REABRIR, escrita para não virar discussão depois:** no dia em
que o plantão passar a ser **cobrável**. A partir daí, apagar um atendimento
passa a ser apagar a origem de um valor, e a assimetria da U80 vale aqui também
— *"cancelar é UPDATE status, NUNCA DELETE: um fechamento pode já ter recolhido
a linha, e apagá-la deixaria um período com total que não bate"*
(`u80:110`, mensagem do pré-voo). Quando isso acontecer, o desenho certo é o
mesmo da cobrança: **status**, e não DELETE.

**Alcançabilidade hoje: total pela UI** (o botão de lixeira na lista do painel),
e **dano hoje: nenhum além da perda do próprio registro.**

## P54 — BAIXO · O plantão não tem leitura fora do painel que o registra (2026-09-09, U87)

`atendimentos_plantao` só é lida num lugar: a lista dos últimos 20, dentro do
próprio painel do "+" da Início. Não há **tela de listagem**, não há **filtro por
período ou por pessoa**, não há **relatório mensal de plantão** e o vínculo com
chamado **não aparece na página do chamado** — a pergunta reversa tem índice
(`atendimentos_plantao_chamado_idx`) e não tem tela.

**Por que ficou assim.** Esta entrega respondeu *"que fato não tem casa hoje?"*.
O fato ganhou casa, porta, gate e portão. As telas de LEITURA são outra entrega,
com outras perguntas de produto — quem precisa ver o quê, por que recorte, e com
qual gate (o SAC é gestor e **não** vê valores, R13; aqui não há valores, então a
régua pode ser outra). Adivinhá-las agora seria construir a superfície antes de
saber a pergunta.

**A lista que existe é por RECÊNCIA e não por dia**, e a escolha é técnica: o
cliente **não sabe** o `dia`, que é projetado pelo gatilho em `America/Sao_Paulo`.
Filtrar por um dia calculado no aparelho criaria a segunda verdade que a decisão
5 da R117 existe para não ter — e ela divergiria justamente na madrugada.

**A condição para reabrir:** quando o Davi pedir o fechamento mensal de plantão,
ou quando o vínculo com chamado precisar aparecer na página do chamado. As duas
são leitura pura sobre uma tabela que já existe, já tem índice nos dois eixos
(dia e pessoa) e já tem policy.
