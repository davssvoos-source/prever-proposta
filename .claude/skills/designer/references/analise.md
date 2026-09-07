# Análise crítica de uma tela existente

> Use quando o Davi disser "melhore essa tela", "está feio", "deixe mais
> profissional", "não gostei do layout" — ou quando for auditar uma tela por
> conta própria. **A análise vem antes de qualquer edição.**
>
> A tela já funciona e tem asserções em cima dela. O objetivo é achar o
> defeito, não recomeçar.

---

## 1. Como olhar

Antes de escrever a análise, junte a evidência:

1. **Leia o código da tela** e das partes que ela usa. Que componentes já
   estão ali? Que estilo é inline, que estilo é classe?
2. **Veja nos dois temas.** Metade dos defeitos deste sistema apareceu ao
   trocar o tema (os nove anti-padrões do `DESIGN_SYSTEM.md` §8 foram todos
   bug de produção).
3. **Veja em 375px.** O que reorganiza? O que só encolheu?
4. **Meça o que dá para medir.** Contraste, escala de espaçamentos usada,
   quantos pesos de fonte, quantos raios diferentes, quantas cores. Número
   substitui opinião.
5. **Pergunte quem usa.** Técnico no celular com pressa e Vinicius no
   desktop coordenando não querem a mesma densidade.
6. **Ache a regra.** Se a tela obedece a uma R-série (`docs/PRODUTO.md`), o
   que parece defeito pode ser decisão do Davi — cite a regra em vez de
   "melhorar" por cima dela.

## 2. O formato da resposta

Cinco blocos, nesta ordem, curtos. Cada achado com **onde** (arquivo:linha) e
**por que importa** — não uma lista de gostos.

```
## Problemas identificados
O que está objetivamente errado: cor fora do tema, contraste abaixo do piso,
componente duplicado, estado que não existe, token sem par no claro.
Cada linha: o quê · onde · o efeito prático.

## Problemas de UX
O que dificulta o uso: ação principal escondida, caminho com passos demais,
informação que a pessoa precisa e não está na tela, ausência de feedback,
gesto que não existe no aparelho de quem usa aquela tela.

## Problemas visuais
Hierarquia achatada, espaçamento inconsistente, alinhamento quebrado,
densidade errada, excesso de bordas/sombras/cards, tipografia com escalas
demais, cor decorativa sem função.

## Oportunidades
O que tornaria a experiência melhor e não foi pedido — separado dos
problemas, para o Davi decidir se entra agora.

## Recomendação
A solução proposta, em ordem de impacto, dizendo o que é incremental e o que
exigiria redesenho. Diga o que você NÃO faria, e por quê.
```

Depois disso: **implemente só se o Davi pedir** — ou, em trabalho autônomo,
implemente a recomendação incremental e deixe o redesenho como proposta.

## 3. Ordem de suspeita quando ouvir "está feio"

Quase sempre é uma destas oito, nesta ordem de frequência. Percorra na ordem
e pare no que explicar o incômodo:

1. **Espaçamento** — valores arbitrários (13, 17, 22) em vez de uma escala; o
   respiro dentro do card diferente do respiro entre cards; nada colado à
   mesma margem.
2. **Hierarquia achatada** — três informações com o mesmo tamanho e peso, e
   nenhuma dominante. O olho não sabe onde começar.
3. **Alinhamento** — colunas que não compartilham a mesma margem; largura
   arbitrária; rótulo e valor em eixos diferentes.
4. **Densidade** — informação demais por linha (o card do calendário antes da
   R153) ou de menos, deixando a tela vazia e infantil.
5. **Molduras** — card dentro de card dentro de card, borda + sombra + fundo
   fazendo o mesmo trabalho de separação três vezes.
6. **Tipografia** — cinco tamanhos e quatro pesos numa tela; texto de 11px
   fazendo trabalho de corpo; maiúsculas espaçadas em frase longa.
7. **Cor sem função** — cor decorativa competindo com a cor que carrega
   informação (status, prazo, impacto). Neste sistema a cor é semântica: se
   ela não diz nada, ela atrapalha.
8. **Contraste** — texto secundário abaixo do piso; no tema claro, dourado
   vivo como texto.

## 4. "Deixe mais profissional" = subtração

Não acrescente. Avalie, nesta ordem:

- **Espaçamento** numa escala coerente (4/8/12/16/24) e respiro generoso onde
  o conteúdo termina.
- **Uma família de raios** e **uma sombra por nível** — não três sombras
  disputando profundidade.
- **Dois pesos de fonte** por tela (600 para título e ênfase, 400 para
  corpo), com 700 reservado a número.
- **Alinhamento** à mesma coluna, do título ao último chip.
- **Densidade** decidida pelo uso: quem varre o mês quer pouco por dia; quem
  gere o dia quer detalhe (é a diferença entre a visão mensal e a semanal do
  calendário).
- **Cor** guardada para o que precisa de atenção; o resto neutro. A R136 é a
  lição desta casa: o card ficou melhor quando a cor saiu do fundo e ficou só
  na borda.
- **Microinteração** discreta: o hover **move**; a barra do gráfico escorre
  para o novo valor em vez de saltar.
- **Contexto do produto** — este é um sistema de trabalho interno, usado
  todo dia, muitas horas. Ele deve parecer calmo, não impressionante.

O que **não** é profissional aqui, e o sistema já rejeitou: gradiente
exagerado, glassmorphism sem função (o vidro ficou nos painéis, saiu do
conteúdo), sombra forte no tema claro, cards demais, glow forte (foi reduzido
duas vezes por pedido do Davi), ícone decorativo, texto redundante.

## 5. O gosto do Davi, do que ele já disse

Cite a regra ao aplicar — e confirme com ele quando a leitura for nova.

- **Cor hierárquica só na borda do card**, fundo neutro do tema, glow
  levíssimo (R136, revisto para mais fraco ainda em 2026-09-04).
- **"Mais nenhuma informação deve aparecer no card"** — o card da semana no
  calendário tem quatro coisas: quem toca, título, cliente e tipo (R153).
- **Modo claro:** fundo "um branco mais escuro", cards "um branco mais
  claro", textos "um cinza bem escuro", menos glow, bordas mais claras
  (R154).
- **Botão de seleção pintado pela COISA**, não de dourado: quando toda opção
  escolhida fica dourada, a cor deixa de dizer QUAL opção foi escolhida
  (R87).
- **Hover move, não acende** — "o brilho de hover é o brilho correto
  permanente".
- **Etiqueta em vez de expansão:** o grupo de clientes é um chip, não oitenta
  chips (R143) — oitenta não cabem em 260px, e a lista congelaria o cadastro
  de hoje.
- **Regra de cor por prazo:** vermelho = atrasado · amarelo = vence nesta
  semana · azul = depois · verde = concluído. Ele já a relembrou uma vez;
  não invente outra.
- Ele pede **resumo do que foi feito** ao final, e confia na execução —
  entregue completo, com o que ficou de fora declarado.

## 6. Antes de entregar a melhoria

- A tela continua obedecendo às R-séries que valiam para ela.
- Nenhuma asserção do verificador virou vermelha por descuido — e se uma
  mudou de propósito, ela foi **reapontada com o motivo escrito ao lado**.
- A melhoria é incremental onde podia ser. Redesenho se justifica por
  escrito.
- Se a mudança é de token ou de receita de componente, o `DESIGN_SYSTEM.md`
  foi atualizado com os **valores resolvidos** (o Davi exporta esse arquivo).
- O resumo final diz: o que estava errado, o que mudou, o que ficou de fora.
