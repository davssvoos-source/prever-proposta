# Os quatro rituais — passo a passo, com os comandos

---

## 1. Início de sessão

O Davi abre dizendo "inicie a sessão" (ou "vamos iniciar a sessão"). A
resposta certa é um **retrato em dez linhas**, não um relatório.

```bash
cd sistema
sed -n 1,60p docs/ESTADO_ATUAL.md          # o cabeçalho e a ordem de leitura
grep -n "^## \|Pendente\|pendente" docs/ESTADO_ATUAL.md
git status --short && git fetch -q && git status -sb | head -1
git log --oneline -3
```

Leia o ESTADO inteiro (são ~170 linhas). Depois responda com:

1. estado do repo (limpo? sincronizado? último commit);
2. migrations pendentes — e o que depende delas (listas `NAO_OFERECIDOS`);
3. os itens que o Davi disse que vai mandar (§7), um por linha — **cobre**;
4. perguntas em aberto (§6);
5. "o que você quer atacar agora?".

Não rode verificador nem build só para dizer que rodou: o ESTADO já traz os
números da última entrega. Rode quando for mexer.

## 2. Ao receber um pedido ou uma revisão do Davi

### 2.1 Separe os itens

Uma revisão dele costuma vir assim: cinco telas, duas regras, uma decisão que
revê outra, um "me lembre depois" e um "a seguir vou te mandar…". Antes de
qualquer coisa, escreva no scratchpad (ou na resposta) a lista numerada, cada
item com a **classificação**:

| Classe | Como reconhecer | Destino |
|---|---|---|
| **R** regra | "deve", "sempre", "nunca", um comportamento do produto | PRODUTO, com a frase |
| **D revista** | contradiz uma decisão D ou uma regra anterior | nota na D/R antiga + regra nova que revisa |
| **Q** pergunta | ele não decidiu; você precisa dele | PLANO_V0.1 §4 (ou onde a Q nasceu) |
| **lembrete** | "me lembre depois", "vou te mandar" | ESTADO_ATUAL §7 |
| **P** dívida | defeito que não vai consertar agora | PENDENCIAS |
| **tarefa** | só fazer | pacote de commit |

### 2.2 Procure contradição antes de escrever

```bash
grep -n "<palavra-chave>" docs/PRODUTO.md | head
grep -n "D[0-9] —" docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md
```

Se a regra nova contradiz uma antiga: a nova diz "Revisa a Rnnn" e a antiga
ganha uma nota `**Revisto em DD/MM pela Rmmm: …**`. Nunca duas regras vivas
dizendo o contrário.

### 2.3 Divida em pacotes

Um pacote = um commit coerente = verificador verde + build + tsc no baseline.
Critérios de corte: uma tela; uma regra e a sua asserção; uma migration e o
que a libera; uma skill. Pedido com oito frentes = oito commits (ou perto
disso), **cada um empurrado**. Se algo quebrar no sexto, os cinco primeiros
já estão salvos.

Ordem dos pacotes: o que os outros dependem primeiro (skill, helper, token);
depois as telas; por fim a varredura global (cores, tipografia), que toca
muitos arquivos e se conflita com tudo.

### 2.4 O que perguntar

Pergunte quando leituras diferentes mudariam o que você faria — e pergunte
já dizendo a sua leitura preferida: "Vou entender X; se for Y, me diga."
Não pergunte o que já está anotado (as Q-série respondidas) nem o que uma
escolha razoável resolve — escolha, registre como decisão, siga.

## 3. Durante a entrega

Mantenha a **lista viva** do pacote (scratchpad):

```
Pacote 3 — PainelChamado reestruturado
  código: PainelChamado.tsx
  regra:  R180 (cabeçalho compacto), R181 (Problema/Diagnóstico)
  docs:   manual/operacao-campo (painel), DESIGN_SYSTEM §6.x (barra de progresso)
  assert: bloco U103 — cabeçalho, barra, ordem das seções
  repontar: U40 "3 colunas fixas", U72 "…", U95 "…"
  estado:  ESTADO_ATUAL §3 (linha U103), §5 se mudar rumo
```

Regras que não se negociam durante:

- **Regra 5.** Valor ou coluna que dependa de migration nasce em
  `NAO_OFERECIDOS` (chamado-status, inventario, clientes/data) até o Davi
  rodar. A migration segue o `banco` (skill própria) e vem com **aviso ao
  Davi** no resumo: arquivo, ordem, linhas de conferência esperadas.
- **Asserção junto.** Ao fechar a regra, a asserção. Ao reapontar uma
  antiga, o motivo escrito ao lado dela.
- **Achado vira P na hora.** Com arquivo, caminho de quebra e correção
  mínima.
- **Prévia descartável** para o que é visual (skill `designer` §7) — e
  apague-a.

## 4. Fim de entrega

Os sete passos do `CLAUDE.md`, mais o oitavo:

```bash
node scripts/verificar-logica.cjs | tail -1     # "0 falharam"
npx vite build                                  # completa
npx tsc --noEmit | grep -c "error TS"           # baseline (57)
node scripts/sumario.cjs                        # regenera os sumários
node scripts/sumario.cjs --check                # confere
git add -A && git commit -F - <<'EOF' … EOF && git push
```

Antes do commit, a lista de conferência:

- [ ] Regras novas no PRODUTO, com a frase do Davi, revisando o que revisam;
      linha "Última atualização" apontando para a última.
- [ ] Asserções novas; as reapontadas com o motivo.
- [ ] Diário: o pedido, o porquê, o que se recusou, o que a verificação
      pegou, os números.
- [ ] Manual do segmento, se o comportamento mudou.
- [ ] DESIGN_SYSTEM, se token ou receita mudou.
- [ ] PENDENCIAS: P novas; P fechadas marcadas.
- [ ] ESTADO_ATUAL: cabeçalho (regra, diário, números, migrations), tabela
      de entregas, §5 se o rumo mudou, §6/§7 se pergunta ou lembrete mudou.
- [ ] Sumários regenerados.
- [ ] Memória local atualizada, se existe (o ESTADO é a que viaja).

E o **resumo para o Davi**, nesta ordem: o que foi feito (item a item do
pedido dele); o que mudou de rumo e por quê (com os números, se mediu); o
que ficou de fora e por quê; o que depende dele. Curto. Ele lê no celular.
