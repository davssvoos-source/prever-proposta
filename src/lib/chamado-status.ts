/**
 * Fonte única da verdade do CHAMADO — Etapa U7 da unificação.
 * Substitui os-status.ts (campo) e demanda-status.ts (interno): depois da
 * fusão existe um conceito só, com dois modos de execução.
 *
 * Ciclo do campo:   aguardando início → agendado → em andamento → concluído
 * Ciclo do interno: aguardando início → em andamento → (stand-by | aguardando aprovação) → concluído
 * Cancelado sai de qualquer ponto, com motivo.
 *
 * "Executado" NÃO existe mais (U13): era um concluído que esperava conferência,
 * e conferência nunca dependeu do status — quem manda nela é
 * `faturamento_status`, que a U0 deixou de fora do ciclo justamente para isso.
 * "Stand-by" vale para os dois lados: chamado de campo parado esperando
 * material é exatamente esse estado.
 */

export type ChamadoStatus =
  | "aberto"
  | "agendado"
  | "em_andamento"
  | "stand_by"
  | "aguardando_aprovacao"
  | "concluido"
  | "cancelado";

/**
 * Como o chamado é executado — define ciclo, telas e regras.
 *
 * `comercial` entrou na U29: o ciclo da proposta não é campo nem interno.
 * Campo tem deslocamento e assinatura; interno tem sprint. A proposta tem
 * aprovação interna e resposta do cliente — um terceiro modo de execução.
 */
export type Natureza = "campo" | "interno" | "comercial";

export type ChamadoTipo =
  | "corretiva"
  | "preventiva"
  | "operacional"
  | "implantacao"
  | "melhoria"
  // R48/U41 (2026-08-21, Davi): renomeado de "proposta_comercial" — o mesmo
  // tipo, agora com o nome do fluxo em vez do resultado dele. Continua sendo
  // um chamado como os outros: o fluxo dela continua em visitas_tecnicas, que
  // virou satélite, mas na fila, no quadro e nos indicadores ela entra igual,
  // com número CH- e tudo.
  | "prospeccao"
  // R112/U83 (2026-09-02, Davi): a atividade de campo que o Vinicius chama de
  // "visita técnica" na programação dele — ir ao cliente só para OLHAR.
  //
  // O NOME NÃO É "visita_tecnica" POR ESCOLHA EXPLÍCITA DO DAVI, e a razão é
  // que essas duas palavras JÁ SIGNIFICAM outra coisa aqui: a visita comercial
  // de proposta (tabela `visitas_tecnicas`, tela `/gerencial`, tipo
  // `prospeccao`). Reusá-las seria a quarta colisão de vocabulário do projeto
  // — e a pior das quatro, porque as outras três (equipe, modalidade, bloco)
  // pelo menos moram em telas diferentes; estas duas dividiriam a MESMA lista
  // de tipos de chamado.
  | "vistoria"
  // R48/U41: aposentado da SELEÇÃO (não do vocabulário) — ver o comentário
  // de `tiposDaNatureza`. Fica no union e em todo o resto do arquivo para os
  // chamados antigos continuarem legíveis.
  | "pedido_compra";

export type ChamadoPrioridade = "baixa" | "normal" | "alta" | "urgente";
export type ChamadoSprint =
  | "essa_semana" | "semana_que_vem"
  | "este_mes" | "mes_que_vem" | "mes_passado" | "backlog";

import { PRISMA, type CorPrisma } from "@/lib/paleta";

export interface StatusInfo {
  label: string;
  labelUpper: string;
  color: string;
  colorLight: string;
  bg: string;
  border: string;
}

// A cor de cada estado sai do PRISMA — a paleta do degradê (paleta.ts). Duas
// amarrações foram pedidas de nome: EM ANDAMENTO é o azul, MELHORIA é o rosa.
// O resto segue a lógica da rampa, do quente ao frio: o que espera você é
// amarelo (a principal), o que trava é laranja, o que já rodou é azul.
// ═══════════════════════════════════════════════════════════════════════════
// A PALETA DE STATUS (retificada em 2026-08-22, Davi):
//   AGUARDANDO INÍCIO → azul · EM ANDAMENTO → amarelo · STAND-BY → laranja ·
//   AGUARDANDO APROVAÇÃO → azul claro · CONCLUÍDO → verde.
//
// Antes disto, três dos cinco estavam nos tons TROCADOS: "aguardando início"
// pintava de amarelo (a cor de EM ANDAMENTO), "em andamento" pintava de azul
// (a cor de AGUARDANDO INÍCIO), e "aguardando aprovação" usava pêssego — uma
// cor que não corresponde a nenhum dos cinco nomes que o Davi definiu.
// "Concluído" usava um azul escuro, quando a casa inteira (cobrança, compra,
// contratos, inventário, checklist de campo) já tratava #2DD2A5/#047862 como
// O verde de sucesso — só esta tabela não usava.
const STATUS: Record<ChamadoStatus, StatusInfo> = {
  aberto: {
    // O valor gravado continua 'aberto' (está no CHECK chamados_status_check,
    // em triggers e em policies). Só o que a pessoa lê mudou.
    label: "Aguardando início", labelUpper: "AGUARDANDO INÍCIO",
    color: PRISMA.azul.dark, colorLight: PRISMA.azul.light,
    bg: PRISMA.azul.bg, border: PRISMA.azul.border,
  },
  agendado: {
    // Mesma família de "Aguardando início" — agendado também não começou
    // ainda, só já tem hora marcada. O azul claro ficou exclusivo de
    // "Aguardando aprovação", senão as duas ficariam com a mesma cor.
    label: "Agendado", labelUpper: "AGENDADO",
    color: PRISMA.azul.dark, colorLight: PRISMA.azul.light,
    bg: PRISMA.azul.bg, border: PRISMA.azul.border,
  },
  em_andamento: {
    // Amarelo porque é o principal: o que está sendo tocado agora é o que a
    // tela existe para destacar.
    label: "Em andamento", labelUpper: "EM ANDAMENTO",
    color: PRISMA.amarelo.dark, colorLight: PRISMA.amarelo.light,
    bg: PRISMA.amarelo.bg, border: PRISMA.amarelo.border,
  },
  stand_by: {
    label: "Stand-by", labelUpper: "STAND-BY",
    color: PRISMA.laranja.dark, colorLight: PRISMA.laranja.light,
    bg: PRISMA.laranja.bg, border: PRISMA.laranja.border,
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação", labelUpper: "AGUARDANDO APROVAÇÃO",
    color: PRISMA.azulClaro.dark, colorLight: PRISMA.azulClaro.light,
    bg: PRISMA.azulClaro.bg, border: PRISMA.azulClaro.border,
  },
  concluido: {
    label: "Concluído", labelUpper: "CONCLUÍDO",
    color: PRISMA.verde.dark, colorLight: PRISMA.verde.light,
    bg: PRISMA.verde.bg, border: PRISMA.verde.border,
  },
  cancelado: {
    // cinza, não vermelho: o vermelho do prisma agora é ATRASO, e um chip
    // vermelho num quadro onde vermelho já quer dizer outra coisa mente.
    // Cancelado fica fora dos cinco nomeados de propósito — não é um estágio
    // do fluxo, é a saída dele.
    label: "Cancelado", labelUpper: "CANCELADO",
    color: PRISMA.neutro.dark, colorLight: PRISMA.neutro.light,
    bg: PRISMA.neutro.bg, border: PRISMA.neutro.border,
  },
};

const FALLBACK: StatusInfo = {
  label: "—", labelUpper: "—",
  color: "#9ca3af", colorLight: "#6b7280",
  bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
};

export function chamadoStatusInfo(status: string | null | undefined): StatusInfo {
  return STATUS[(status ?? "") as ChamadoStatus] ?? FALLBACK;
}

export const STATUS_ORDEM: ChamadoStatus[] = [
  "aberto", "agendado", "em_andamento", "stand_by",
  "aguardando_aprovacao", "concluido", "cancelado",
];

/** Status que ainda pedem ação de alguém. */
export function chamadoEmAberto(status: string | null | undefined): boolean {
  return ["aberto", "agendado", "em_andamento", "stand_by", "aguardando_aprovacao"]
    .includes(status ?? "");
}

/**
 * Quais status fazem sentido em cada natureza. "Agendado" pressupõe
 * deslocamento com hora marcada — não cabe no chamado interno.
 */
export function statusDaNatureza(natureza: Natureza): ChamadoStatus[] {
  // O ciclo da proposta é o do funil: marca-se a visita, ela acontece, o
  // comercial aprova, a proposta vai ao cliente e ele responde. Quem move
  // esses estados é o fluxo comercial (/visita/$id), não um seletor de status.
  if (natureza === "comercial")
    return ["aberto", "agendado", "em_andamento", "aguardando_aprovacao", "concluido", "cancelado"];
  return natureza === "campo"
    ? ["aberto", "agendado", "em_andamento", "stand_by", "concluido", "cancelado"]
    : ["aberto", "em_andamento", "stand_by", "aguardando_aprovacao", "concluido", "cancelado"];
}

export const NATUREZA_LABEL: Record<Natureza, string> = {
  campo: "Campo",
  interno: "Interno",
  comercial: "Comercial",
};

// ── Tipos ───────────────────────────────────────────────────────────────────

export const TIPO_LABEL: Record<ChamadoTipo, string> = {
  prospeccao: "Prospecção",
  // R48: rótulo só, o valor gravado continua "corretiva"/"preventiva" — Davi
  // só quis mais explícito no texto, não um tipo novo.
  corretiva: "Manutenção Corretiva",
  preventiva: "Manutenção Preventiva",
  operacional: "Operacional",
  implantacao: "Implantação",
  // R112: uma palavra só, de propósito. "Visita técnica" é o nome do OUTRO
  // fluxo (o comercial) e não pode voltar a aparecer numa lista de tipos.
  vistoria: "Vistoria",
  melhoria: "Melhoria",
  pedido_compra: "Pedido de compra",
};

// ── A FONTE ÚNICA DE "QUE TIPOS EXISTEM EM CADA NATUREZA" ───────────────────
//
// Isto nasceu na U83, e nasceu de um censo: os tipos de chamado de CAMPO
// estavam copiados À MÃO em quatro lugares fora deste arquivo, todos com
// `as ChamadoTipo[]` — que desliga o compilador. Acrescentar 'vistoria' só em
// `tiposDaNatureza` não alcançaria nenhum deles, e o tipo novo ficaria
// invisível no gráfico e no filtro do painel SEM UM ÚNICO ERRO. Os quatro
// eram: chamados.novo-campo.tsx:319, chamados.painel.tsx:172 e :212, e o
// union + o enum do schema da IA em chamado-rapido.functions.ts:42/:68.
//
// A regra que fica: NINGUÉM MAIS ESCREVE UMA LISTA DE TIPOS DE CAMPO À MÃO.
// Uma asserção de CENSO no verificador varre `src/` atrás de qualquer lista
// literal com dois ou mais tipos de campo e falha se achar — este arquivo é o
// único endereço autorizado.
//
// A LISTA É O QUE O SISTEMA SABE RENDERIZAR. O que ele OFERECE para escrita é
// `tiposDaNatureza()`, que é esta mesma lista menos `NAO_OFERECIDOS`. Os dois
// conceitos eram um só até a U83, e a diferença entre eles é o que torna
// possível soltar um tipo novo em dois passos sem janela de 23514.
export const TIPOS_DA_NATUREZA: Record<Natureza, ChamadoTipo[]> = {
  campo: ["corretiva", "preventiva", "operacional", "implantacao", "vistoria"],
  interno: ["melhoria", "corretiva", "preventiva", "operacional", "implantacao"],
  // a prospecção tem um tipo só, e ele não aparece nas outras naturezas: quem
  // abre chamado de campo não escolhe "prospecção" num seletor
  comercial: ["prospeccao"],
};

/**
 * O que o vocabulário CONHECE mas NÃO oferece para escrita. Uma lista só, e
 * cada linha diz por quê — é aqui que se liga e se desliga um tipo.
 */
const NAO_OFERECIDOS: ChamadoTipo[] = [
  // R48/U41 (2026-08-21, Davi): "na prática, vou usar o Operacional no lugar".
  // Não sai do union nem de TIPO_LABEL/TIPO_CORES/TIPOS/CHECK: os pedidos de
  // compra já abertos continuam com ficha própria (chamado_compra), filtro no
  // painel e tudo mais funcionando — só não é opção para um chamado NOVO.
  "pedido_compra",
  // ═════════════════════════════════════════════════════════════════════════
  // AQUI ESTAVA `"vistoria"`, E ELA SAIU NO COMMIT B (a U83 rodou em 02/09).
  // O registro do mecanismo fica, porque ele vale para o PRÓXIMO tipo:
  //
  // Enquanto ela estiver aqui, 'vistoria' é RENDERIZÁVEL (rótulo, cor, filtro,
  // série do gráfico, PDF) e NÃO É OFERECIDA em lugar nenhum que grave. A
  // ordem de deploy INVERTEU em relação aos casos anteriores: o perigo de
  // sempre era o código LER coluna que ainda não existe; aqui o código
  // ESCREVERIA um valor que o CHECK ainda recusa — 23514 na cara de quem abre
  // o chamado, na janela entre o push e a rodada da migration.
  //
  // Apagar esta linha liga, de uma vez e sem caçada: o seletor de novo chamado
  // de campo, o seletor de tipo do PainelChamado, o diálogo de nova atividade,
  // o enum do schema da IA de criação rápida E a linha "vistoria: …" do prompt
  // dela (as duas derivam desta função — ver chamado-rapido.functions.ts).
  //
  // O MECANISMO EM UMA FRASE, para quem for soltar o próximo tipo: renderizar é
  // aditivo e inofensivo (faz um valor existente ficar legível); OFERECER é o
  // que grava. Migration + renderização sobem juntas; a entrada nesta lista sai
  // depois, sozinha, quando o CHECK já aceita o valor. É o que fecha a janela
  // de 23514 entre o push (que publica na hora) e a migration (rodada à mão).
  // ═════════════════════════════════════════════════════════════════════════
];

/** Tipos que o seletor OFERECE em cada natureza — o que pode ser GRAVADO. */
export function tiposDaNatureza(natureza: Natureza): ChamadoTipo[] {
  return TIPOS_DA_NATUREZA[natureza].filter((t) => !NAO_OFERECIDOS.includes(t));
}

/**
 * O que um TÉCNICO DE CAMPO pode ter como tipo de demanda (R57, Davi
 * 2026-08-22: "são as únicas possibilidades que um técnico de campo pode ter
 * com tipo de demanda").
 *
 * É mais estrito que os tipos de campo porque exclui 'operacional', e a
 * diferença é proposital: 'operacional' existe na natureza campo para o
 * trabalho que não é manutenção nem instalação (levar equipamento, buscar
 * peça), mas não é uma demanda que se PROGRAMA para uma dupla. O filtro da
 * programação usa esta lista; o seletor de "novo chamado de campo" continua
 * usando `tiposDaNatureza`.
 *
 * DERIVADA POR EXCLUSÃO desde a U83, e a escolha tem consequência: o padrão
 * para um tipo de campo NOVO passa a ser "sim, é programável", e quem
 * acrescentar a exceção seguinte tem de dizê-la aqui, por nome. É o padrão
 * certo — 'operacional' é o caso raro, não a regra.
 *
 * R112 (2026-09-02, Davi): 'vistoria' ENTRA. O critério do R57 nunca foi "é
 * manutenção?", foi "é demanda que se AGENDA numa equipe?" — e a vistoria do
 * Vinicius é exatamente isso: ela ocupa uma janela de uma dupla num dia. É
 * também por isso que ela NÃO é 'operacional': operacional é o serviço que se
 * encaixa entre duas coisas, a vistoria é o compromisso.
 *
 * Esta lista alimenta um FILTRO (`<option>` da programação), não um seletor de
 * escrita — por isso 'vistoria' pode entrar já no commit A.
 */
export const TIPOS_DEMANDA_CAMPO: ChamadoTipo[] =
  TIPOS_DA_NATUREZA.campo.filter((t) => t !== "operacional");

/**
 * TODO o vocabulário, na ordem de leitura. Derivado das chaves de TIPO_LABEL
 * (que é `Record<ChamadoTipo, …>`, logo o compilador garante que nenhum tipo
 * do union fica de fora) — antes da U83 era uma oitava lista escrita à mão,
 * capaz de divergir do union em silêncio.
 */
export const TIPOS: ChamadoTipo[] = Object.keys(TIPO_LABEL) as ChamadoTipo[];

export const TIPO_CORES: Record<ChamadoTipo, CorPrisma> = {
  // o azul claro do degradê: negócio em formação, ainda sem serviço no chão
  prospeccao:    PRISMA.azulClaro,
  corretiva:     PRISMA.vermelho,   // o que quebrou
  preventiva:    PRISMA.amarelo,    // o que se antecipa
  operacional:   PRISMA.neutro,     // o dia a dia, sem tensão
  implantacao:   PRISMA.azulEscuro, // obra nova, de fôlego longo
  // R112 — laranja, e a escolha foi MEDIDA contra as outras duas livres.
  // Semântica: a rampa vai do que se antecipa (amarelo) ao que quebrou
  // (vermelho), e o laranja é literalmente o passo entre os dois — que é o que
  // uma vistoria é: ir olhar porque ainda NÃO SE SABE se quebrou.
  // Colisão em uso: laranja também é STATUS stand_by e PRIORIDADE alta, e as
  // três aparecem lado a lado no cabeçalho do PainelChamado. Sobrou por
  // eliminação medida — das três cores livres do PRISMA:
  //   · `verde` é o "terminado com sucesso" da casa inteira (cobrança, compra,
  //     contratos, inventário, checklist) — um tipo verde ao lado de um status
  //     verde diria que o chamado acabou;
  //   · `azul` é STATUS aberto E agendado E PRIORIDADE normal — ou seja, o
  //     ESTADO DE REPOUSO de uma vistoria (agendada, normal). Seriam três
  //     chips azuis em fila no caso mais comum, que é o pior lugar possível;
  //   · `laranja` colide com stand_by (esperar material não é o que trava uma
  //     vistoria) e com prioridade alta (não é o padrão). Colide fora do
  //     repouso, e não dentro dele.
  vistoria:      PRISMA.laranja,
  melhoria:      PRISMA.rosa,       // amarração pedida pelo Davi
  pedido_compra: PRISMA.pessego,    // dinheiro, mas sem urgência própria — legado
};

// ── Prioridade ──────────────────────────────────────────────────────────────

export const PRIORIDADE_LABEL: Record<ChamadoPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

// Prioridade sobe a rampa do frio ao quente — é a única escala do sistema em
// que a ordem das cores carrega ordem de verdade, então ela percorre o
// espectro em linha reta: azul, azul claro, laranja, vermelho.
export const PRIORIDADE_CORES: Record<ChamadoPrioridade, CorPrisma> = {
  baixa:   PRISMA.neutro,
  normal:  PRISMA.azul,
  alta:    PRISMA.laranja,
  urgente: PRISMA.vermelho,
};

// ── Sprint (organiza a fila do trabalho interno) ────────────────────────────

// do mais perto ao mais longe, e o retrospectivo por último: é a ordem em que
// se lê um planejamento, e a ordem em que os menus devem oferecer
export const SPRINT_ORDEM: ChamadoSprint[] = [
  "essa_semana", "semana_que_vem", "este_mes", "mes_que_vem", "mes_passado", "backlog",
];

export const SPRINT_LABEL: Record<ChamadoSprint, string> = {
  essa_semana: "Essa semana",
  semana_que_vem: "Semana que vem",
  este_mes: "Este mês",
  mes_que_vem: "Mês que vem",
  mes_passado: "Mês passado",
  backlog: "Backlog",
};

/**
 * Os baldes que significam "é trabalho deste mês".
 *
 * Existe porque a R40 partiu "este mês" em três: uma tarefa para depois de
 * amanhã agora é `essa_semana`, e quem contasse só `este_mes` a perderia da
 * meta mensal — o número cairia sem nada ter mudado no trabalho.
 *
 * "Semana que vem" pode atravessar a virada do mês. Fica aqui mesmo assim:
 * uma semana não vale partir um mês ao meio, e o alternativo (checar a data de
 * cada uma) daria à meta uma precisão que o planejamento não tem.
 */
export const SPRINTS_DO_MES: ChamadoSprint[] = ["essa_semana", "semana_que_vem", "este_mes"];

/**
 * O SPRINT SAI DO PRAZO (R40).
 *
 * O Davi pediu que o sistema interprete a data e escolha o balde sozinho — e
 * é a decisão certa: sprint e prazo são duas respostas para "quando?", e
 * mantidos à mão eles divergem. Uma tarefa com prazo para amanhã marcada
 * "mês que vem" não é uma escolha de planejamento, é um esquecimento; e o
 * quadro por sprint passa a mentir sobre a semana.
 *
 * O BALDE MAIS ESTREITO GANHA. Uma data desta semana também está neste mês —
 * e a resposta útil é "essa semana", porque é a que muda o que se faz hoje.
 * Por isso a ordem dos testes é semana → semana seguinte → mês → mês seguinte.
 *
 * PRAZO VENCIDO cai em "essa semana", não em "mês passado". O balde
 * retrospectivo serve para o que já foi; o que venceu e continua aberto é
 * trabalho para agora, e mandá-lo para o passado o esconderia justamente de
 * quem precisa vê-lo.
 *
 * Devolve `null` quando não há prazo — sem data não há o que interpretar, e
 * chutar um balde apagaria a escolha que a pessoa fez à mão.
 */
export function sprintDoPrazo(
  prazoLimite: string | null | undefined,
  agora: Date = new Date(),
): ChamadoSprint | null {
  if (!prazoLimite) return null;
  const prazo = new Date(prazoLimite);
  if (Number.isNaN(prazo.getTime())) return null;

  // comparação por DIA: o prazo é gravado às 23:59 e a hora atual varia; sem
  // normalizar, o mesmo dia daria respostas diferentes de manhã e à noite
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hoje = dia(agora);
  const alvo = dia(prazo);

  const seg = (d: Date) => {                    // segunda-feira da semana de d
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const s = r.getDay();                       // 0 = domingo
    r.setDate(r.getDate() + (s === 0 ? -6 : 1 - s));
    return r;
  };
  const estaSemana = seg(agora);
  const proximaSemana = new Date(estaSemana); proximaSemana.setDate(estaSemana.getDate() + 7);
  const daiAduas = new Date(estaSemana); daiAduas.setDate(estaSemana.getDate() + 14);

  if (alvo < hoje) return "essa_semana";                       // vencido: é para agora
  if (alvo < dia(proximaSemana)) return "essa_semana";
  if (alvo < dia(daiAduas)) return "semana_que_vem";

  const mesmoMes = prazo.getFullYear() === agora.getFullYear()
    && prazo.getMonth() === agora.getMonth();
  if (mesmoMes) return "este_mes";

  const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  if (prazo.getFullYear() === proximoMes.getFullYear()
      && prazo.getMonth() === proximoMes.getMonth()) return "mes_que_vem";

  return "backlog";
}

// ── Prazo ───────────────────────────────────────────────────────────────────
// Depois da fusão existe um campo só: prazo_limite (timestamptz). No campo ele
// nasce do SLA da prioridade; no interno é a data combinada, gravada às 23:59.

export type SituacaoPrazo = "sem_prazo" | "no_prazo" | "proximo" | "estourado" | "encerrado";

export function situacaoPrazo(
  prazoLimite: string | null | undefined,
  status: string | null | undefined,
  agora: Date = new Date(),
): SituacaoPrazo {
  if (!chamadoEmAberto(status)) return "encerrado";
  if (!prazoLimite) return "sem_prazo";
  const restanteMs = new Date(prazoLimite).getTime() - agora.getTime();
  if (restanteMs < 0) return "estourado";
  if (restanteMs < 24 * 60 * 60 * 1000) return "proximo";
  return "no_prazo";
}

export const PRAZO_LABEL: Record<SituacaoPrazo, string> = {
  sem_prazo: "sem prazo",
  no_prazo: "no prazo",
  proximo: "prazo próximo",
  estourado: "prazo estourado",
  encerrado: "",
};

/** Texto curto de quanto falta (ou passou) do prazo. */
export function textoPrazo(prazoLimite: string | null | undefined, agora: Date = new Date()): string {
  if (!prazoLimite) return "sem prazo";
  const ms = new Date(prazoLimite).getTime() - agora.getTime();
  const abs = Math.abs(ms);
  const horas = Math.floor(abs / 3_600_000);
  const dias = Math.floor(horas / 24);
  const parte = dias >= 1 ? `${dias}d` : `${Math.max(1, horas)}h`;
  return ms >= 0 ? `faltam ${parte}` : `${parte} em atraso`;
}

/** `prazo_limite` (timestamptz) → `AAAA-MM-DD` local, para o input de data. */
export function prazoParaData(prazoLimite: string | null | undefined): string {
  if (!prazoLimite) return "";
  const d = new Date(prazoLimite);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `AAAA-MM-DD` do input → fim daquele dia, que é como o banco guarda. */
export function dataParaPrazo(data: string | null | undefined): string | null {
  if (!data) return null;
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1, 23, 59, 59).toISOString();
}

// ── Classificação sugerida ──────────────────────────────────────────────────

/**
 * Espelho em TS de public.sugerir_tipo_demanda() — pré-visualiza a
 * classificação enquanto a pessoa digita. Quem decide é o banco, no trigger:
 * os dois PRECISAM concordar, inclusive no colapso de espaços (senão uma
 * quebra de linha no texto faz a tela prometer um tipo e o registro nascer
 * com outro).
 *
 * ── DÍVIDA DECLARADA NA U83, e ela é uma PALAVRA ────────────────────────────
 * "vistoria" já é palavra-chave aqui — e devolve `preventiva`. Depois do R112
 * isso passou a ser uma resposta errada em português, e MESMO ASSIM ela fica.
 * Três razões, nesta ordem:
 *
 *   1. Mexer aqui é ESCRITA. `importar-notion.ts:364` grava direto o que esta
 *      função devolve; devolver 'vistoria' antes de a U83 rodar é 23514. É a
 *      regra 5 (ordem de deploy), e é o mesmo motivo de `NAO_OFERECIDOS`.
 *   2. O gêmeo no banco (`public.sugerir_tipo_chamado`) teria de mudar na MESMA
 *      migration, e uma função de classificação nova não é o que a U83 entrega.
 *      Divergir os dois é a cicatriz que o manual de banco chama de "trigger
 *      espelha função do app".
 *   3. O ESTRAGO É PEQUENO E ESTÁ MEDIDO: esta cascata só é consultada em
 *      caminho INTERNO — `chamados.novo-interno.tsx` (como sugestão visível,
 *      que a pessoa pode trocar) e a importação do Notion. No banco,
 *      `chamado_preencher` (u7:296-298) só a chama quando `natureza <> 'campo'`;
 *      no campo o default é 'corretiva', fixo. A vistoria do Vinicius é
 *      atividade de CAMPO — ela nunca passa por aqui.
 *
 * Fica para depois da U83, junto com o commit B, e vale para os DOIS lados de
 * uma vez. Enquanto isso, um chamado interno intitulado "vistoria" nasce
 * preventiva, como sempre nasceu.
 */
export function sugerirTipoChamado(titulo: string, descricao?: string | null): ChamadoTipo {
  const t = `${titulo ?? ""} ${descricao ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // R48/U41: compra vira "operacional" — "pedido_compra" saiu da seleção,
  // então o classificador do Notion/IA precisa acompanhar, ou continuaria
  // sugerindo um tipo que o seletor nem oferece mais.
  if (/(compra|comprar|cotacao|cotar|aquisicao|adquirir|fornecedor|pedido de material)/.test(t))
    return "operacional";
  if (/(nao funciona|nao esta funcionando|parou|caiu|travand|travou|quebrad|defeito|falha|falhou|erro|bug|corrig|conserto|reparo|urgente|sem sinal|sem acesso|offline)/.test(t))
    return "corretiva";
  if (/(preventiv|revisao|inspec|limpeza|checagem|vistoria|rotina de manutencao|manutencao programada)/.test(t))
    return "preventiva";
  if (/(implanta|instala|nova unidade|novo sistema|migra|migracao|deploy|homologa|ativacao|start)/.test(t))
    return "implantacao";
  if (/(melhor|otimiz|aprimor|refator|upgrade|atualiz|padroniz|automatiz|redesenh|nova funcionalidade|criar tela)/.test(t))
    return "melhoria";
  return "operacional";
}
