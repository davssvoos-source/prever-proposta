// Gera o Word de docs/DECISOES_PENDENTES.md reescrito para quem NÃO programa.
//
// Davi, 22/09/2026: "Considere que eu não tenho conhecimento prévio de
// programação atualmente - escreva de maneira que eu possa entender."
//
// NÃO é uma conversão do .md: é uma reescrita. O .md é a lista de trabalho (e
// usa o vocabulário da casa); este Word é o mesmo conteúdo em linguagem de
// negócio, com passo a passo, recomendação em cada decisão e glossário no fim.
// Quando a lista mudar, os dois mudam — este script é o que refaz o Word.
//
//   npm install docx   (fora do repo; a biblioteca não é dependência do app)
//   node scripts/gerar-docx-decisoes.cjs
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, PageBreak, convertInchesToTwip,
} = require('docx');
const fs = require('fs');

const OURO = 'A06108';
const OURO_FUNDO = 'FDF6E0';
const CINZA_FUNDO = 'F2F2F2';
const TEXTO = '212121';
const SECUNDARIO = '5A5A5A';
const VERMELHO = 'B1242E';
const LARGURA = 9026;

// ── peças ────────────────────────────────────────────────────────────────────
const p = (texto, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, line: 276 },
  alignment: o.align,
  indent: o.indent,
  children: [new TextRun({
    text: texto, size: o.size ?? 21, color: o.color ?? TEXTO,
    bold: o.bold, italics: o.italics, font: 'Calibri',
  })],
});

/** parágrafo com pedaços em negrito: ricos(['normal ', ['negrito', true], ' fim']) */
const ricos = (partes, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, line: 276 },
  indent: o.indent,
  children: partes.map((x) => Array.isArray(x)
    ? new TextRun({ text: x[0], bold: true, size: o.size ?? 21, color: o.color ?? TEXTO, font: 'Calibri' })
    : new TextRun({ text: x, size: o.size ?? 21, color: o.color ?? TEXTO, font: 'Calibri' })),
});

const h1 = (texto) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 180 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: OURO, space: 6 } },
  children: [new TextRun({ text: texto, size: 30, bold: true, color: OURO, font: 'Calibri' })],
});

const h2 = (texto) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 120 },
  children: [new TextRun({ text: texto, size: 25, bold: true, color: TEXTO, font: 'Calibri' })],
});

const rotulo = (texto) => new Paragraph({
  spacing: { before: 140, after: 60 },
  children: [new TextRun({ text: texto.toUpperCase(), size: 17, bold: true, color: OURO, font: 'Calibri', characterSpacing: 20 })],
});

const bullet = (texto, nivel = 0) => new Paragraph({
  numbering: { reference: 'pontos', level: nivel },
  spacing: { after: 90, line: 276 },
  children: [new TextRun({ text: texto, size: 21, color: TEXTO, font: 'Calibri' })],
});

const passo = (texto) => new Paragraph({
  numbering: { reference: 'passos', level: 0 },
  spacing: { after: 90, line: 276 },
  children: [new TextRun({ text: texto, size: 21, color: TEXTO, font: 'Calibri' })],
});

/** caixa de destaque: fundo claro, uma linha dourada à esquerda */
const caixa = (titulo, linhas, cor = OURO, fundo = OURO_FUNDO) => new Table({
  width: { size: LARGURA, type: WidthType.DXA },
  columnWidths: [LARGURA],
  borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
    left: { style: BorderStyle.SINGLE, size: 18, color: cor },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: LARGURA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: fundo, color: 'auto' },
      margins: { top: 160, bottom: 160, left: 220, right: 220 },
      children: [
        ...(titulo ? [new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: titulo, size: 21, bold: true, color: cor, font: 'Calibri' })],
        })] : []),
        ...linhas.map((l, i) => new Paragraph({
          spacing: { after: i === linhas.length - 1 ? 0 : 90, line: 276 },
          children: [new TextRun({ text: l, size: 20, color: TEXTO, font: 'Calibri' })],
        })),
      ],
    })],
  })],
});

/** tabela com cabeçalho dourado */
const tabela = (cabecalhos, linhas, larguras) => new Table({
  width: { size: LARGURA, type: WidthType.DXA },
  columnWidths: larguras,
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E5E5' },
    insideVertical: { style: BorderStyle.NONE },
  },
  rows: [
    new TableRow({
      tableHeader: true,
      children: cabecalhos.map((c, i) => new TableCell({
        width: { size: larguras[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: OURO_FUNDO, color: 'auto' },
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
        children: [new Paragraph({
          children: [new TextRun({ text: c, size: 19, bold: true, color: OURO, font: 'Calibri' })],
        })],
      })),
    }),
    ...linhas.map((linha) => new TableRow({
      children: linha.map((celula, i) => new TableCell({
        width: { size: larguras[i], type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
        children: (Array.isArray(celula) ? celula : [celula]).map((t, j) => new Paragraph({
          spacing: { after: 0, line: 264 },
          children: [new TextRun({ text: t, size: 19, color: j === 0 ? TEXTO : SECUNDARIO, bold: i === 0 && j === 0, font: 'Calibri' })],
        })),
      })),
    })),
  ],
});

// ── o documento ──────────────────────────────────────────────────────────────
const corpo = [];

// CAPA
corpo.push(new Paragraph({ spacing: { before: 1200, after: 0 }, children: [
  new TextRun({ text: 'PREVER OS', size: 22, bold: true, color: OURO, font: 'Calibri', characterSpacing: 60 }),
] }));
corpo.push(new Paragraph({ spacing: { before: 200, after: 0 }, children: [
  new TextRun({ text: 'Decisões pendentes', size: 56, bold: true, color: TEXTO, font: 'Calibri' }),
] }));
corpo.push(new Paragraph({ spacing: { before: 120, after: 400 }, children: [
  new TextRun({ text: 'O que depende de você para o sistema seguir em frente', size: 26, color: SECUNDARIO, font: 'Calibri' }),
] }));
corpo.push(caixa(null, [
  'Este documento reúne, num lugar só, tudo o que está parado esperando uma decisão sua, um gesto seu ou um dado que você ficou de mandar.',
  'Está escrito sem termos técnicos. Onde uma palavra do mundo da programação for inevitável, ela aparece explicada ali mesmo, e o significado se repete no glossário do final.',
  'Cada item diz três coisas: o que é, o que você precisa decidir, e o que acontece enquanto a decisão não vem. Esse último ponto é o mais importante: quase tudo aqui tem um custo silencioso de continuar esperando.',
]));
corpo.push(new Paragraph({ spacing: { before: 400 }, children: [
  new TextRun({ text: 'Versão do sistema: 1.0.2   ·   22 de setembro de 2026', size: 19, color: SECUNDARIO, font: 'Calibri' }),
] }));
corpo.push(new Paragraph({ children: [new PageBreak()] }));

// ── RESUMO ───────────────────────────────────────────────────────────────────
corpo.push(h1('O quadro geral'));
corpo.push(p('São dezoito itens, divididos em quatro grupos. A tabela abaixo mostra onde eles estão e quanto tempo cada grupo costuma consumir.'));
corpo.push(tabela(
  ['Grupo', 'Quantos', 'O que é'],
  [
    ['1. Para fazer agora', '4', 'Gestos de poucos minutos que destravam gente que está trabalhando com o sistema pela metade.'],
    ['2. Decisões de produto', '7', 'Perguntas que só você pode responder. Depois da resposta, eu implemento.'],
    ['3. O que você vai mandar', '4', 'Informações e documentos que ficaram de vir de você.'],
    ['4. Infraestrutura', '3', 'Assuntos para conversar com o pessoal de T.I.'],
  ],
  [2400, 1100, 5526],
));

corpo.push(new Paragraph({ spacing: { before: 300 } }));
corpo.push(caixa('Se você só tiver tempo para três coisas hoje', [
  '1. Rodar a atualização do banco chamada U155. Sem ela, o Erik e o Nicholas continuam sem enxergar a maior parte dos clientes.',
  '2. Instalar a versão 1.0.2 no servidor da empresa. O servidor está cinco versões atrás.',
  '3. Me mandar os fluxos dos tipos de demanda técnica. É o que mais trava trabalho novo.',
], VERMELHO, 'FDF0F0'));

corpo.push(new Paragraph({ children: [new PageBreak()] }));

// ── PARTE 1 ──────────────────────────────────────────────────────────────────
corpo.push(h1('Parte 1 · Para fazer agora'));
corpo.push(p('Quatro tarefas curtas. Nenhuma delas exige conhecimento técnico, mas duas precisam que você abra o painel do Supabase e uma precisa do pessoal de T.I. junto.'));

corpo.push(h2('1.1 · Rodar a atualização U155 do banco de dados'));
corpo.push(rotulo('O que é'));
corpo.push(ricos([
  'O sistema guarda as informações num banco de dados. De vez em quando é preciso mudar a estrutura desse banco, e isso é feito colando um texto de comando num painel e clicando em executar. No nosso vocabulário isso se chama ',
  ['rodar uma migration', true],
  '. Você já fez isso várias vezes.',
]));
corpo.push(rotulo('Por que esta é urgente'));
corpo.push(p('Lembra do problema que o Erik relatou, do cliente Paineiras que não aparecia? Descobri a causa: o sistema estava tratando o cargo Operacional como se fosse um técnico de campo, e técnicos só enxergam os clientes em que já trabalharam. Por isso vários clientes sumiam da lista dele.'));
corpo.push(p('A correção está pronta e publicada. Ela só entra em vigor quando você rodar esta atualização, porque a mudança é nas regras do banco, não na tela.'));
corpo.push(rotulo('Como fazer'));
corpo.push(passo('Abra o painel do Supabase e entre no SQL Editor, que é onde você já rodou as anteriores.'));
corpo.push(passo('Abra o arquivo que está em D:\\Prever\\sistema\\supabase\\migrations e tem o nome terminado em u155_o_operacional_le_a_base_de_clientes.'));
corpo.push(passo('Copie o conteúdo inteiro, cole no painel e execute.'));
corpo.push(passo('O próprio comando mostra uma tabela no final, com uma coluna chamada veredito. Todas as linhas devem dizer "ok". Se alguma disser "olhar", me avise antes de continuar.'));
corpo.push(caixa('Enquanto não rodar', [
  'O Erik e o Nicholas continuam vendo apenas uma parte dos clientes. Isso aparece em dois lugares: na tela Clientes, que vem incompleta, e na criação de uma atividade nova, onde o cliente que eles procuram pode simplesmente não estar na lista.',
]));

corpo.push(h2('1.2 · Trocar o cargo do Vinicius para Gestor'));
corpo.push(rotulo('O que é'));
corpo.push(p('Criamos o cargo Gestor porque o Vinicius fazia esse papel sem ter um cargo que o descrevesse. Ele era Administrador, que é o cargo de quem administra o sistema inteiro, inclusive pessoas e acessos. O cargo Gestor diz o que ele realmente é: quem manda na equipe técnica de campo, enxerga valores e cobranças, mas não mexe em usuários nem em permissões.'));
corpo.push(rotulo('Como fazer'));
corpo.push(passo('No sistema, abra Administrativo.'));
corpo.push(passo('Vá na aba Usuários e encontre o Vinicius na lista.'));
corpo.push(passo('Clique em editar e escolha o cargo Gestor.'));
corpo.push(caixa('Um aviso importante antes de fazer', [
  'No dia em que você fizer essa troca, o Vinicius deixa de receber os avisos automáticos do sistema, como o de chamado sem responsável e o de prazo estourando.',
  'O motivo: essas mensagens automáticas foram escritas em agosto, com uma lista de cargos fixa que ainda não conhece o cargo Gestor.',
  'Não é grave e o conserto é simples, mas precisa ser feito. Me avise quando trocar, que eu faço na sequência.',
], VERMELHO, 'FDF0F0'));

corpo.push(h2('1.3 · Conferir uma configuração no servidor com o T.I.'));
corpo.push(rotulo('O que é'));
corpo.push(p('Quando você convida alguém para usar o sistema, a pessoa recebe um e-mail com um link para criar a senha. Esse link precisa apontar para o endereço certo.'));
corpo.push(p('Hoje, se uma configuração específica não estiver preenchida no servidor da empresa, o link aponta para o endereço antigo do sistema na internet, o da Lovable. A pessoa clica e vai parar no lugar errado.'));
corpo.push(rotulo('O que pedir ao T.I.'));
corpo.push(ricos([
  'Peça para conferirem se existe, na configuração do serviço do Prever no servidor, uma variável chamada ',
  ['SITE_URL', true],
  ', e se ela aponta para o endereço de vocês. O arquivo de configuração fica na pasta onde o sistema foi instalado e se chama config.env.',
]));
corpo.push(caixa('Por que isso vira urgente em breve', [
  'Enquanto a Lovable continuar no ar, o link errado ainda funciona e ninguém percebe o problema. No dia em que ela sair, todo convite passa a levar para uma página que não existe mais.',
]));

corpo.push(h2('1.4 · Instalar a versão 1.0.2 no servidor da empresa'));
corpo.push(rotulo('O que é'));
corpo.push(p('O sistema roda em dois lugares. Na internet, pelo endereço da Lovable, que atualiza sozinho toda vez que eu publico. E no servidor da empresa, que só atualiza quando alguém instala o pacote à mão.'));
corpo.push(ricos([
  'O servidor está na versão ',
  ['0.0.7', true],
  ', de 8 de setembro. A versão atual é a ',
  ['1.0.2', true],
  '. São cinco versões de diferença: tudo o que fizemos nas últimas semanas só existe na Lovable.',
]));
corpo.push(rotulo('Como fazer'));
corpo.push(passo('O pacote já está pronto em D:\\Prever\\sistema\\dist-windows\\Prever-1.0.2.zip. Eu já te enviei esse arquivo por aqui também.'));
corpo.push(passo('Copie para o servidor e descompacte.'));
corpo.push(passo('Na pasta onde o sistema está instalado, execute o comando de atualização apontando para a pasta nova. O passo a passo detalhado está no manual, em docs\\manual\\hospedagem-windows.md, na seção Atualizar.'));
corpo.push(passo('Ao terminar, confira no rodapé do menu do sistema se aparece a versão 1.0.2.'));
corpo.push(caixa('O que a atualização preserva', [
  'O processo troca apenas o programa. As configurações e as chaves de acesso que estão no servidor são preservadas, e o banco de dados não é tocado.',
]));

corpo.push(new Paragraph({ children: [new PageBreak()] }));

// ── PARTE 2 ──────────────────────────────────────────────────────────────────
corpo.push(h1('Parte 2 · Decisões que preciso de você'));
corpo.push(p('Sete perguntas. Em cada uma eu explico a situação, faço a pergunta de forma direta, mostro as opções e digo o que eu faria. Você decide, e eu implemento.'));

// D1
corpo.push(h2('2.1 · Qual valor é o "ticket médio" de uma proposta?'));
corpo.push(rotulo('A situação'));
corpo.push(p('Você pediu um painel no Comercial com quatro indicadores, e um deles era o ticket médio, ou seja, quanto vale a proposta média que a empresa envia.'));
corpo.push(p('Descobri que o sistema não guarda esse valor em lugar nenhum. O valor da proposta é calculado na hora de gerar o documento em PDF e desaparece depois. Não existe onde buscá-lo.'));
corpo.push(rotulo('A pergunta'));
corpo.push(caixa('Quando a empresa fala em "valor da proposta", está falando de qual número?', [
  'Opção A: o valor mensal recorrente, ou seja, quanto o cliente paga por mês.',
  'Opção B: o valor da implantação, que é o investimento inicial de equipamentos e instalação.',
  'Opção C: os dois, guardados separadamente.',
]));
corpo.push(rotulo('Minha recomendação'));
corpo.push(p('A opção C. Guardar os dois custa o mesmo trabalho de guardar um, e permite responder duas perguntas diferentes: quanto entra de receita recorrente por proposta, e quanto a empresa investe para começar cada contrato. Se eu guardar só um agora, daqui a três meses vamos querer o outro e o histórico não existirá.'));
corpo.push(rotulo('O que acontece depois da sua resposta'));
corpo.push(p('Eu crio o campo no banco, faço o sistema gravar o valor no momento em que a proposta é gerada, e o indicador aparece no painel. Vale a partir dali para a frente. O passado entra junto com o item 3.4 deste documento.'));
corpo.push(rotulo('Enquanto não decide'));
corpo.push(p('O painel do Comercial fica com quatro indicadores em vez de cinco, e a empresa não consegue responder quanto vale a proposta média.'));

// D2
corpo.push(h2('2.2 · Como funciona uma atividade com técnico de campo e T.I. juntos'));
corpo.push(rotulo('A situação'));
corpo.push(p('Você levantou esse caso antes das férias e perguntou qual layout o sistema deveria seguir quando a mesma atividade tem um técnico de campo e alguém do T.I., que tem cargo Operacional.'));
corpo.push(p('Fui olhar o código e encontrei duas coisas que mudam a pergunta.'));
corpo.push(bullet('O layout nunca seguiu o cargo de ninguém. Ele segue o tipo da atividade. Atividade interna abre uma tela de documento, com editor de texto, lista de tarefas e marcações de pessoas. Atividade de campo abre uma tela de execução, com fotos antes e depois, diagnóstico, peças usadas, assinatura do cliente e cobrança.'));
corpo.push(bullet('Essa atividade mista hoje nem é possível de montar. Na atividade de campo, a lista de pessoas que podem ser escolhidas só oferece cargo Técnico e Administrador. O Erik não aparece nem como apoio.'));
corpo.push(rotulo('Por que eu não recomendo seguir sempre o fluxo do Operacional'));
corpo.push(p('Você comentou que o fluxo do Operacional parecia mais completo. Ele é mais completo em texto, mas é bem mais pobre no resto, e a escolha do tipo não muda só a aparência da tela.'));
corpo.push(p('O tipo da atividade liga e desliga mecanismos inteiros do sistema. Atividade de campo entra na agenda com controle de conflito de horário e de jornada, conta para as duplas, aparece no painel do Vinicius e gera a cobrança do mês. Atividade interna não faz nada disso.'));
corpo.push(caixa('O risco concreto', [
  'Se uma atividade em que a equipe se deslocou até o prédio for classificada como interna para acomodar o T.I., ela sai da agenda, some do painel do Vinicius, perde a assinatura do cliente e não vira cobrança.',
  'Ou seja: seguir sempre o fluxo do Operacional pode fazer a empresa deixar de faturar um serviço que foi prestado.',
], VERMELHO, 'FDF0F0'));
corpo.push(rotulo('Minha proposta de critério'));
corpo.push(ricos([['Alguém se deslocou até o prédio do cliente?', true]]));
corpo.push(bullet('Se sim, é atividade de campo, e o T.I. entra como apoio.'));
corpo.push(bullet('Se não, é atividade interna, e o técnico entra como apoio.'));
corpo.push(p('Esse critério é estável: ele não muda quando alguém entra ou sai da equipe da atividade. Um layout que mudasse conforme as pessoas entram seria uma tela que troca de forma no meio do preenchimento, e pode engolir o que a pessoa estava escrevendo.'));
corpo.push(rotulo('A pergunta que é sua'));
corpo.push(caixa('Quando o Erik vai ao prédio junto com o técnico, o que ele está fazendo?', [
  'Opção A: apoiando o trabalho do técnico. Nesse caso é uma atividade só, do tipo campo, com ele como apoio.',
  'Opção B: fazendo o trabalho dele no mesmo local. Nesse caso são duas atividades, ligadas pelo cliente e pela data.',
]));
corpo.push(p('Pense na instalação de um CFTV. O técnico passa o cabo e fixa a câmera, e a prova desse trabalho é a foto e a assinatura do síndico. O T.I. configura o gravador e a rede, e a prova desse trabalho é uma lista de conferência e um print da configuração. São dois serviços com provas diferentes e prazos diferentes.'));
corpo.push(rotulo('Minha recomendação'));
corpo.push(p('A opção B, com uma ligação visível entre as duas atividades, para que quem olhar uma consiga chegar à outra. Se virarem uma atividade só, a assinatura do síndico passa a cobrir os dois serviços e o registro do T.I. vira um comentário solto no meio da conversa.'));
corpo.push(rotulo('Enquanto não decide'));
corpo.push(p('Ninguém consegue colocar alguém do T.I. numa atividade de campo, nem como apoio.'));

// D3
corpo.push(h2('2.3 · A revisão de tipografia: aplicar tudo, por partes, ou só o essencial?'));
corpo.push(rotulo('A situação'));
corpo.push(p('Você pediu uma revisão de todos os títulos, tamanhos, cores e tipos de fonte das páginas principais. A revisão está pronta e encontrou sessenta e seis problemas de gravidade alta ou média, espalhados pelas oito páginas.'));
corpo.push(p('Não apliquei nada ainda, e o motivo é prático: as mudanças alteram a aparência de etiquetas, títulos e cores em todas as telas ao mesmo tempo. É o tipo de coisa que precisa da sua aprovação visual.'));
corpo.push(rotulo('A pergunta'));
corpo.push(caixa('Como você quer que eu aplique?', [
  'Opção A, só o invisível: pesos de fonte que o navegador nem consegue carregar, cores que não estão na paleta oficial e tamanhos fora da escala. Ninguém percebe a mudança, mas some a bagunça que gera os próximos problemas.',
  'Opção B, página por página: eu aplico numa página, você olha e aprova, e seguimos para a próxima.',
  'Opção C, tudo de uma vez, numa entrega só.',
]));
corpo.push(rotulo('Minha recomendação'));
corpo.push(p('Começar pela opção A, que é segura e rápida, e depois fazer a opção B nas páginas que você mais usa. A opção C tem o risco de você abrir o sistema e estranhar oito telas ao mesmo tempo, sem saber por onde começar a dar retorno.'));

// D4
corpo.push(h2('2.4 · Convites que já foram aceitos continuam aparecendo como pendentes'));
corpo.push(rotulo('A situação'));
corpo.push(p('Quando você convida alguém, o convite entra numa lista de pendentes. Hoje nada no sistema marca esse convite como aceito quando a pessoa cria a senha e começa a usar. A lista acumula para sempre, inclusive pessoas que já usam o sistema há semanas.'));
corpo.push(rotulo('A pergunta'));
corpo.push(caixa('Posso fazer o sistema limpar isso sozinho?', [
  'A ideia: quando alguém clicar em "Reenviar convite" e o servidor responder que aquela pessoa já existe, o sistema marca o convite como aceito e ele sai da lista.',
  'Com o tempo a lista se limpa naturalmente, sem ninguém precisar fazer faxina.',
]));
corpo.push(rotulo('Minha recomendação'));
corpo.push(p('Sim. É uma mudança pequena e não apaga nada: o convite continua registrado, apenas deixa de aparecer como pendente.'));

// D5
corpo.push(h2('2.5 · O texto padrão da cobrança'));
corpo.push(rotulo('A situação'));
corpo.push(p('Quando um serviço gera cobrança, o sistema sugere um texto descrevendo o que foi feito. Em setembro do ano passado você adiou essa definição dizendo que precisava do Vinicius para entender melhor.'));
corpo.push(rotulo('A pergunta'));
corpo.push(caixa('Qual deve ser o padrão do texto sugerido?', [
  'Por exemplo: "Manutenção corretiva, fornecimento de 1 unidade de fechadura, fora de contrato".',
  'E qual o tipo de serviço padrão: instalação quando for implantação, e manutenção para o resto?',
]));
corpo.push(rotulo('Observação'));
corpo.push(p('Agora ficou mais fácil resolver isso. O Vinicius passou a ter uma tela própria, a Gestão Técnica, onde ele vê exatamente as atividades que estão esperando decisão de cobrança. Dá para sentar com ele em frente a essa tela e definir o padrão olhando casos reais.'));

// D6
corpo.push(h2('2.6 · Quem recebe os avisos automáticos do sistema'));
corpo.push(rotulo('A situação'));
corpo.push(p('O sistema manda avisos automáticos em algumas situações, como um chamado que ficou sem responsável ou um prazo que está estourando. A lista de quem recebe esses avisos foi escrita em agosto, com os cargos daquela época: Administrador, Comercial e SAC.'));
corpo.push(p('O cargo Gestor é novo e não está nessa lista.'));
corpo.push(rotulo('Por que isso está aqui'));
corpo.push(p('Não é exatamente uma decisão, é um aviso ligado ao item 1.2. Enquanto o Vinicius for Administrador, ele recebe tudo normalmente. No minuto em que virar Gestor, para de receber.'));
corpo.push(rotulo('O que eu preciso de você'));
corpo.push(p('Apenas que me avise quando fizer a troca de cargo. O conserto é rápido e eu faço na sequência, para que ele não passe nem um dia sem os avisos.'));

// D7
corpo.push(h2('2.7 · Três telas antigas: ficam ou saem?'));
corpo.push(rotulo('A situação'));
corpo.push(p('Existem três telas antigas no sistema, herdadas de antes da reorganização. Você pediu para vê-las antes de decidir se elas ficam ou saem.'));
corpo.push(p('São elas: a tela de projeto, a tela de visita pendente e a tela de edição de visita pelo Gerencial. Os endereços exatos estão anotados no documento de revisão de setembro do ano passado.'));
corpo.push(rotulo('A pergunta'));
corpo.push(p('Quer que eu abra as três no seu navegador para você olhar, e depois decidimos? É a forma mais rápida de resolver: são cinco minutos olhando, e ou elas ganham um lugar no menu, ou saem do sistema.'));

corpo.push(new Paragraph({ children: [new PageBreak()] }));

// ── PARTE 3 ──────────────────────────────────────────────────────────────────
corpo.push(h1('Parte 3 · O que você disse que vai mandar'));
corpo.push(p('Quatro coisas que ficaram de vir de você. A primeira é, de longe, a que mais trava trabalho novo.'));

corpo.push(h2('3.1 · Os fluxos de cada tipo de demanda técnica'));
corpo.push(caixa('Este é o maior bloqueio hoje', [
  'É o item que, sozinho, destrava mais coisas na fila.',
], VERMELHO, 'FDF0F0'));
corpo.push(rotulo('O que eu preciso'));
corpo.push(p('A área técnica trabalha com três tipos de demanda: corretiva, preventiva e implantação. Para cada uma delas eu preciso saber quais informações o sistema deve pedir e em que ordem o trabalho acontece, do começo ao fim.'));
corpo.push(p('Na prática: quando abre uma corretiva, o que precisa ser preenchido? Quando o técnico chega no prédio, o que ele registra? O que precisa estar preenchido para que o trabalho possa ser considerado terminado? E depois de terminado, quem confere o quê?'));
corpo.push(rotulo('O que já está definido'));
corpo.push(bullet('A lista de tipos já foi revista e fechada: corretiva, preventiva e implantação. A vistoria virou atividade interna do gestor.'));
corpo.push(bullet('A corretiva tem dois campos de texto, um para o problema e outro para a solução.'));
corpo.push(bullet('Atividade de campo não tem prazo automático: a prioridade orienta a data.'));
corpo.push(bullet('Quando a equipe precisa voltar ao prédio, isso é um retorno na mesma atividade, e não uma atividade nova.'));
corpo.push(bullet('A preventiva é uma atividade só, com um roteiro de todos os blocos do prédio.'));
corpo.push(rotulo('O que falta'));
corpo.push(p('Os campos de cada tipo, e a implantação inteira, que você disse que conversaríamos em breve.'));
corpo.push(rotulo('O que isso destrava'));
corpo.push(bullet('A validação do gestor: hoje o técnico marca o trabalho como concluído e ele já entra como concluído de verdade. O desenho aprovado é ficar "concluído, aguardando validação" até o Vinicius confirmar.'));
corpo.push(bullet('O mini-calendário que mostra a agenda enquanto a pessoa escolhe a data.'));
corpo.push(bullet('A tela de trabalho da data agendada.'));
corpo.push(bullet('A proposta comercial em duas atividades, separando a visita da elaboração.'));

corpo.push(h2('3.2 · A relação entre tipo de atividade e impacto na operação'));
corpo.push(p('Hoje, quem cria uma atividade escolhe à mão qual o impacto dela na operação do cliente. Se você me disser qual impacto corresponde a cada tipo de atividade, o sistema passa a preencher sozinho e a pessoa só ajusta quando for exceção.'));

corpo.push(h2('3.3 · Os equipamentos por cliente, exportados do ERP'));
corpo.push(p('Os documentos do sistema QAP com a lista de equipamentos instalados em cada cliente. Depois desses arquivos, o passo seguinte é a integração automática com o QAP, que você preferiu deixar para quando o sistema estiver mais maduro. O contato é o Lopes, desenvolvedor do QAP.'));

corpo.push(h2('3.4 · O histórico de propostas enviadas'));
corpo.push(p('Você comentou que tem o histórico das propostas anteriores e que passaria à mão. Assim que vierem, eu carrego no sistema e o painel do Comercial passa a mostrar a evolução real dos últimos doze meses, em vez de começar do zero a partir de agora.'));
corpo.push(ricos([
  'De cada proposta antiga eu preciso de três informações: ',
  ['a data em que foi enviada', true],
  ', ',
  ['o cliente ou prédio', true],
  ' e ',
  ['quais serviços foram propostos', true],
  ' entre portaria remota, monitoramento, controle de acesso, CFTV, alarmes, totem e cerca elétrica. Uma planilha simples resolve.',
]));

corpo.push(new Paragraph({ children: [new PageBreak()] }));

// ── PARTE 4 ──────────────────────────────────────────────────────────────────
corpo.push(h1('Parte 4 · Para conversar com o T.I.'));
corpo.push(p('Três assuntos de infraestrutura. Você me disse que backup e segurança virariam prioridade, e é aqui que eles entram.'));

corpo.push(h2('4.1 · Sair da Lovable'));
corpo.push(rotulo('O que é a Lovable'));
corpo.push(p('É o serviço onde o sistema fica hospedado na internet hoje. Toda vez que eu publico uma mudança, ela aparece lá automaticamente. Você usa esse endereço para ver as alterações rápido, sem esperar a instalação no servidor.'));
corpo.push(rotulo('A situação'));
corpo.push(p('Sair dela é simples e o passo a passo já está escrito no repositório. O sistema não depende da Lovable para funcionar: ele já roda no servidor de vocês.'));
corpo.push(caixa('O único ponto que pode surpreender', [
  'Antes de qualquer coisa, entre em supabase.com e confirme que o projeto do banco de dados está numa conta da empresa, e não numa conta pessoal ou vinculada à Lovable.',
  'São dois minutos e é a verificação mais importante de todo este documento. Se o banco estiver numa conta que não é de vocês, isso precisa ser resolvido antes de qualquer desligamento.',
], VERMELHO, 'FDF0F0'));

corpo.push(h2('4.2 · Sair do Supabase: cuidado com a expectativa'));
corpo.push(rotulo('O que é o Supabase'));
corpo.push(p('É onde moram os dados do sistema e várias funções essenciais. Não é apenas um lugar que guarda informação: ele também cuida do login das pessoas, das regras de quem enxerga o quê, dos arquivos como fotos e contratos, das atualizações em tempo real nas telas e de tarefas que rodam sozinhas em horários programados.'));
corpo.push(rotulo('Por que não é uma troca simples'));
corpo.push(p('Você comentou que talvez não fosse necessário estar no Supabase. Eu medi o quanto o sistema depende dele, e o resultado é este:'));
corpo.push(tabela(
  ['O que o Supabase faz hoje', 'Tamanho da dependência'],
  [
    ['Login e controle de acesso', 'usado em 38 arquivos do sistema'],
    ['Funções de banco de dados', '31 funções diferentes'],
    ['Armazenamento de arquivos', '2 áreas: contratos e fotos de serviço'],
    ['Atualização das telas em tempo real', '6 telas'],
    ['Funções que rodam no servidor', '3 funções'],
    ['Tarefas automáticas em horário programado', '9 tarefas'],
  ],
  [5200, 3826],
));
corpo.push(new Paragraph({ spacing: { before: 200 } }));
corpo.push(rotulo('As duas saídas possíveis'));
corpo.push(ricos([
  ['Caminho A, instalar o Supabase no servidor de vocês.', true],
  ' O Supabase é um programa que pode ser instalado em qualquer servidor. Nesse caminho, tudo o que existe hoje continua funcionando igual, porque o sistema não percebe a diferença. É trabalho de configuração para o T.I., não de reprogramação.',
]));
corpo.push(ricos([
  ['Caminho B, reescrever para um banco de dados comum.', true],
  ' Aqui seria preciso refazer login, permissões, arquivos, tempo real e tarefas automáticas, uma a uma. São meses de trabalho e o sistema ficaria instável durante a transição.',
]));
corpo.push(rotulo('Minha recomendação'));
corpo.push(p('O caminho A, se a decisão for realmente sair. E vale perguntar antes: o que exatamente incomoda no Supabase hoje? Se for custo, dependência de terceiros ou exigência de manter os dados dentro da empresa, cada uma dessas preocupações tem uma resposta diferente, e nem todas exigem sair.'));

corpo.push(h2('4.3 · Backup: o assunto que você chamou de emergencial'));
corpo.push(rotulo('A situação'));
corpo.push(p('Hoje o backup é o que o plano atual do Supabase oferece, e ninguém testou uma restauração.'));
corpo.push(rotulo('As duas opções'));
corpo.push(ricos([
  ['Se continuar no Supabase:', true],
  ' o plano pago tem um recurso que permite voltar o banco para exatamente como ele estava em qualquer minuto do passado, dentro de um período. É o mais simples de operar, porque não depende de ninguém lembrar de fazer nada.',
]));
corpo.push(ricos([
  ['Se instalar no servidor de vocês:', true],
  ' o T.I. configura uma cópia completa diária mais um registro contínuo de cada alteração. Dá o mesmo resultado, com mais controle e mais responsabilidade de manutenção.',
]));
corpo.push(caixa('A regra que vale nos dois casos', [
  'Backup que nunca foi restaurado não é backup, é uma pasta grande.',
  'Escolha um dia, peça ao T.I. para restaurar o backup num ambiente de teste e confirme que o sistema sobe com os dados corretos. Enquanto esse teste não acontecer, ninguém sabe de verdade se há backup.',
], VERMELHO, 'FDF0F0'));

corpo.push(new Paragraph({ children: [new PageBreak()] }));

// ── GLOSSÁRIO ────────────────────────────────────────────────────────────────
corpo.push(h1('Glossário'));
corpo.push(p('As palavras técnicas que aparecem neste documento e no dia a dia com o sistema, explicadas sem rodeio.'));
corpo.push(tabela(
  ['Palavra', 'O que significa'],
  [
    ['Banco de dados', 'O lugar onde o sistema guarda todas as informações: clientes, atividades, fotos, cobranças. Se o sistema fosse um escritório, o banco de dados seria o arquivo físico.'],
    ['Migration', 'Uma mudança na estrutura do banco de dados, feita colando um texto de comando num painel e executando. É o que você faz no SQL Editor do Supabase. Cada uma tem um número, como U155.'],
    ['Supabase', 'O serviço que hospeda nosso banco de dados e cuida de login, permissões, arquivos e tarefas automáticas.'],
    ['Lovable', 'O serviço onde o sistema fica disponível na internet hoje, e que atualiza sozinho quando eu publico uma mudança.'],
    ['Servidor', 'O computador da empresa, em 192.168.10.182, onde o sistema também roda. Ele só atualiza quando alguém instala o pacote à mão.'],
    ['Versão', 'Um número que identifica o estado do sistema, como 1.0.2. Serve para saber se o servidor está com as mudanças recentes ou atrasado.'],
    ['Pacote', 'O arquivo compactado que leva uma versão nova para o servidor. No nosso caso, Prever-1.0.2.zip.'],
    ['Cargo', 'O papel de cada pessoa no sistema: Administrador, Gestor, Comercial, SAC, Operacional ou Técnico. O cargo decide quais telas a pessoa abre e o que ela pode fazer.'],
    ['Permissões', 'A tabela em Administrativo que define quais telas cada cargo consegue abrir. Ela controla a navegação, mas não substitui as regras de dados.'],
    ['Regras de dados', 'Regras que ficam no banco e decidem quais informações cada pessoa enxerga, independente da tela. Foi uma dessas regras que escondia os clientes do Erik.'],
    ['Campo', 'Um espaço onde o sistema guarda uma informação específica, como a data de envio de uma proposta. Quando eu digo que "não existe campo para o valor", significa que não há onde guardar esse número.'],
    ['Repositório', 'A pasta em D:\\Prever\\sistema onde vive todo o código do sistema, com o histórico completo de cada mudança.'],
    ['Publicar', 'Enviar as mudanças que eu fiz para o repositório na internet. É o que faz a Lovable atualizar.'],
  ],
  [2100, 6926],
));

corpo.push(new Paragraph({ spacing: { before: 400 } }));
corpo.push(caixa('Onde este documento vive', [
  'A versão original, em texto simples, fica em D:\\Prever\\sistema\\docs\\DECISOES_PENDENTES.md e acompanha o histórico do sistema.',
  'Este Word é uma adaptação dela para leitura e para circular com outras pessoas. Quando um item for resolvido, ele sai da lista e vira uma regra registrada do sistema.',
], '999999', CINZA_FUNDO));

// ── monta ────────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Prever OS',
  title: 'Prever OS — Decisões pendentes',
  description: 'O que depende do Davi para o sistema seguir em frente',
  numbering: {
    config: [
      {
        reference: 'pontos',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.18) } } } },
        ],
      },
      {
        reference: 'passos',
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: convertInchesToTwip(0.32), hanging: convertInchesToTwip(0.2) } } } },
        ],
      },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
    children: corpo,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const destino = 'D:/Prever/sistema/docs/Decisoes-Pendentes-Prever.docx';
  fs.writeFileSync(destino, buf);
  console.log('✓', destino, (buf.length / 1024).toFixed(0) + ' KB');
});
