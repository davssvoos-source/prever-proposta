# Estados, formulários, responsividade e acessibilidade

> A parte da interface que não aparece no print e é onde mora quase todo
> defeito de uso. Uma tela "pronta" que só tem o estado cheio e feliz não
> está pronta.

---

## 1. A matriz de estados

Para cada elemento interativo e para cada tela, decida os nove. O que não se
aplica, se declara como não aplicável — não se esquece.

| Estado | O que a interface faz aqui |
|---|---|
| **Default** | o repouso; já é o desenho correto (o brilho de hover não é "acender") |
| **Hover** | **move, não clareia** (`.elevavel`) — decisão do Davi. Só em `(hover: hover) and (pointer: fine)` |
| **Focus** | anel visível que **não deforma** o botão arredondado (defeito P11: a regra de foco global deformava) |
| **Active** | resposta imediata ao clique — nunca só depois da rede |
| **Disabled** | e **por quê**: um botão apagado sem explicação é um beco. `title` diz o motivo |
| **Loading** | do BOTÃO quando é a ação ("Criando…"), da TELA quando é a primeira carga (skeleton ou frase), do CAMPO quando é autosave ("salvando" → "salvo", que apaga sozinho) |
| **Success** | confirmação curta e específica: *"Prazo movido para 10/09."* Não "Sucesso!" |
| **Error** | frase em português com o que fazer, nunca a mensagem do driver. Erro que a pessoa pode consertar fica ao lado do campo; erro de sistema usa `TelaDeErro` com o código `PRV-ÁREA-CLASSE-ORIGEM` |
| **Empty** | diz **por que está vazio** e qual é a primeira ação. "Nada marcado" no dia do calendário; "Sem prioridades no sprint deste mês" na rosca |

### A regra dos três estados

**Erro, carregando e vazio são três telas diferentes.** Devolver lista vazia
quando a consulta falhou faz a tela dizer "R$ 0,00 a cobrar" para quem tem
cobrança — a pior mentira que um painel pode contar (lição da U86, e o painel
operacional já traz o padrão certo: `isError ? "—" : isLoading ? "…" : valor`,
com o erro em primeiro lugar e a mensagem no `title`).

### Escrita otimista (quando a ação move algo na tela)

Padrão do arrasto do calendário (R152) e das mutações da casa:

1. `onMutate` guarda o estado anterior e aplica a mudança no cache
2. `onError` restaura o anterior **e** mostra a frase
3. `onSuccess` confirma com o dado que voltou do servidor
4. `onSettled` invalida todas as chaves que leem aquele dado

Sem o passo 2, a tela mente. Sem o 4, duas telas discordam.

---

## 2. Formulários

O padrão desta casa (ver `NovaAtividadeDialog`, `DetalheInterno`,
`FormularioChamadoTecnico`):

- **Comece pela pergunta que decide o resto.** O pop-up de nova atividade
  pergunta duas coisas — tipo de demanda e responsável — e só então abre o
  corpo certo (R138). Formulário que mostra todos os campos de todos os casos
  é formulário que faz a pessoa escolher o que ignorar.
- **Rótulo sempre** (micro-label maiúsculo espaçado, 10px/600). Placeholder
  não é rótulo: ele desaparece quando mais se precisa dele.
- **Opcional se marca no rótulo** — `Prazo (opcional)`. O obrigatório é o
  padrão silencioso; marcar os dois polui.
- **Dica onde a dúvida nasce**, não num rodapé de ajuda: *"O local vai na
  etiqueta, não no título."*
- **Erro junto do campo**, no envio ou ao sair do campo — nunca só um toast
  genérico que não diz qual campo.
- **Nada se perde:** o que já foi gravado permanece se um passo aditivo
  falhar. O padrão é criar o registro e depois pendurar as partes, cada uma
  falhando sozinha, avisando o que não entrou (*"Atividade criada, mas não
  entrou: apoio."*).
- **Autosave em texto longo** com estado no próprio campo; botão explícito em
  ação que muda o mundo (criar, concluir, cobrar).
- **Chips para conjunto** (apoio, clientes, grupos): cada chip remove com X e
  o campo de busca não oferece quem já está.
- `colorScheme` acompanhando o tema em input nativo (`date`,
  `datetime-local`) — senão o calendário abre escuro sobre página clara
  (anti-padrão nº 5).

---

## 3. Responsividade

**Reorganizar, não encolher.** O breakpoint é **1024px**, um só.

| | < 1024px (celular) | ≥ 1024px (desktop) |
|---|---|---|
| Navegação | barra inferior flutuante, `env(safe-area-inset-bottom)` | sidebar 232px (recolhível a 72), `--rail` |
| Colunas | uma; o que era coluna vira lista (`.cal-semana`, `.detalhe-grid`) | duas ou sete |
| Vidro | `--vidro-blur: none` — blur é caro na GPU | `blur(22px)` |
| Busca | abre pela lupa | mora na faixa superior |
| Densidade | alvo de toque ≥ 40px, menos por linha | mais informação por linha |

Regras:

- A troca é por **CSS** (`.so-desktop` / `.so-celular`), nunca por JS — media
  query não pisca no primeiro render.
- **Quem tem qual aparelho** (R28): o técnico trabalha no celular; Davi,
  Vinicius, SAC e comercial no desktop. Uma tela do técnico que só funciona
  bem em 1440px está errada, mesmo que fique bonita.
- Rolagem **da página**, uma vez só. O calendário já teve 42 áreas de rolagem
  independentes e um item escondido dentro de uma delas era um item que
  ninguém via.
- Tabela/gráfico/código largos rolam **dentro do próprio contêiner**
  (`overflow-x: auto`); a página nunca rola de lado.
- **Gesto que não existe no toque precisa de alternativa.** O arrasto do
  calendário (R152) não dispara no celular — lá o prazo muda pelo painel, e
  isso está escrito na regra.

---

## 4. Acessibilidade

Os números que este projeto cobra **por asserção** (não por opinião):

| O quê | Piso |
|---|---|
| Texto sobre a superfície | **4,5:1** |
| Não-texto (borda, ícone, barra, arco) | **3:1** |
| Preenchimento de gráfico no tema **claro** | **2,5:1** — piso declarado da R154, porque o número ao lado é a rampa de TEXTO, que segue em 4,5:1 |
| Tinta sobre o degradê dourado | 4,5:1 → é `#0E0E0E`, nunca branco (anti-padrão nº 2) |

Práticas:

- **Contraste se mede, não se estima.** Calcule antes de escolher o hex (o
  script de prévia da §7 do SKILL.md resolve; o verificador cobra depois).
- **Status nunca só por cor:** cor + ícone, ou cor + rótulo. Vale para
  daltonismo e vale para quem imprime.
- **Foco visível** em tudo que se alcança pelo teclado, sem deformar a forma
  do botão. `Esc` fecha o que abriu **e devolve o foco** para quem abriu
  (defeito P12: largava o foco no `body`).
- **Ícone sozinho** precisa de `aria-label` **e** `title` (o `title` é a
  única ajuda de quem usa mouse).
- **Botão é `<button>`**, com `aria-pressed` quando alterna. Div clicável não
  recebe foco nem responde a Enter.
- **Alvo de toque ≥ 40px** no celular. Quando o alvo real é fino (a barra de
  3px do gráfico), o **contêiner inteiro** é o botão — foi assim que a coluna
  do gráfico de demanda virou o alvo, e não a barra.
- **Movimento:** respeite `prefers-reduced-motion` — e cuidado com o defeito
  P4, em que a regra global de "sem movimento" congelava os indicadores de
  carregamento (parar a animação de um spinner é esconder que algo acontece).
- **Texto em imagem** não existe aqui; a fachada do cliente é decorativa e
  vem com máscara para não competir com o texto.
