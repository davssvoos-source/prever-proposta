// As regras de leitura do export do Notion — separadas da tela para poder
// ser testadas com o arquivo real.
//
// Este módulo existia dentro de chamados.importar.tsx e cresceu junto com o
// export de 2026-08-21, que trouxe três novidades que a versão anterior lia
// errado em silêncio:
//
//   1. DATAS EM PORTUGUÊS. "28 de abril de 2025 10:05" — o `new Date()` do
//      JavaScript devolve Invalid Date para isso. O importador antigo então
//      gravava prazo nulo, e a atividade entrava no quadro sem prazo: sem cor
//      de faixa, sem urgência, no fim de qualquer ordenação.
//
//   2. STATUS QUE NÃO EXISTIAM. "Aguardando terceiros", "Aguardando material"
//      e "Planejado". Sem mapa, os três caíam no padrão "aberto" — e as 15
//      tarefas que estão PARADAS esperando alguém de fora apareceriam como
//      trabalho disponível para pegar hoje.
//
//   3. CÉLULAS COM VÁRIOS VALORES. "Gilleno Nascimento, Erik Freitas" no
//      responsável e "Califórnia, Pateo Klabin" no cliente.
//
// A regra que atravessa tudo: **na dúvida, não invente**. Cliente que não
// casa com certeza fica sem vínculo (mas guarda o nome escrito); pessoa que
// não tem conta faz a linha ser pulada, não virar "sem responsável".

import { normalizarTexto } from "@/lib/normalizar";
import {
  sugerirTipoChamado, sprintDoPrazo,
  type ChamadoSprint, type ChamadoStatus, type ChamadoTipo,
} from "@/lib/chamado-status";
import type { Equipe } from "@/lib/equipes";

// ── Datas ───────────────────────────────────────────────────────────────────

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

/**
 * Lê os quatro formatos que o export mistura, na ordem de confiança:
 * "2026-03-12", "12/03/2026", "28 de abril de 2025 10:05" e o que o
 * JavaScript entender sozinho.
 *
 * O `new Date(s)` fica por ÚLTIMO de propósito: ele aceita "12/03/2026" e
 * interpreta como 3 de dezembro (padrão americano). Deixá-lo antes do formato
 * brasileiro trocaria dia por mês em silêncio — o pior tipo de defeito de
 * importação, porque o dado fica plausível.
 */
export function lerData(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;

  // "28 de abril de 2025 10:05" e variações sem o "de"
  const pt = normalizarTexto(s).match(/^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (pt && MESES[pt[2]]) return `${pt[3]}-${MESES[pt[2]]}-${pt[1].padStart(2, "0")}`;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Data COM hora, para a chave de reimportação. "28 de abril de 2025 10:05"
 * vira "2025-04-28 10:05".
 *
 * A hora é o que dá identidade à linha: duas tarefas criadas no mesmo minuto,
 * com o mesmo título, não existem na prática. Sem ela a chave colapsa e a
 * importação descarta trabalho real achando que é repetido.
 */
export function lerDataHora(v: string | null | undefined): string {
  const dia = lerData(v);
  const hora = (v ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!dia) return normalizarTexto(v ?? "");
  return hora ? `${dia} ${hora[1].padStart(2, "0")}:${hora[2]}` : dia;
}

// ── Vocabulário do Notion ───────────────────────────────────────────────────

export const STATUS_NOTION: Record<string, ChamadoStatus> = {
  "nao iniciada": "aberto",
  "nao iniciado": "aberto",
  "a fazer": "aberto",
  "planejado": "aberto",
  "em andamento": "em_andamento",
  "fazendo": "em_andamento",
  // "esperando alguém de fora" é parada, não fila: quem varre o quadro
  // procurando o que pegar não deve tropeçar nelas
  "aguardando terceiros": "stand_by",
  "aguardando material": "stand_by",
  "stand by": "stand_by",
  "standby": "stand_by",
  "pausada": "stand_by",
  "aguardando aprovacao": "aguardando_aprovacao",
  "aguardando": "aguardando_aprovacao",
  "concluido": "concluido",
  "concluida": "concluido",
  "feito": "concluido",
  "cancelado": "cancelado",
  "cancelada": "cancelado",
};

export const SPRINT_NOTION: Record<string, ChamadoSprint> = {
  "este mes": "este_mes",
  "esse mes": "este_mes",
  // R40 deu balde próprio à semana; antes isto virava "este mês" por falta
  // de opção, e a única linha do export com "Essa Semana" perdia a urgência
  "essa semana": "essa_semana",
  "semana que vem": "semana_que_vem",
  "proxima semana": "semana_que_vem",
  "mes que vem": "mes_que_vem",
  "proximo mes": "mes_que_vem",
  "mes passado": "mes_passado",
  "backlog": "backlog",
};

export const EQUIPE_NOTION: Record<string, Equipe> = {
  "t.i / tecnica": "ti",
  "t.i": "ti",
  "ti": "ti",
  "tecnologia": "ti",
  "dados": "ti",
  "controle patrimonial": "patrimonio",
  "patrimonio": "patrimonio",
  "marketing / comercial": "comercial",
  "comercial": "comercial",
  "sac": "sac",
  "monitoramento / portaria": "monitoramento",
  "monitoramento": "monitoramento",
  "audiovisual": "audiovisual",
  "business ops": "business_ops",
  "businessops": "business_ops",
  "tecnica": "tecnica",
};

/**
 * Apelidos do Notion que são outro nome no QAP.
 *
 * "Prever" é a própria casa — no QAP ela é o cliente "Especializados"
 * (confirmado pelo Davi em 2026-08-21). São 1143 atividades: sem este
 * apelido, mais da metade do export ficaria sem vínculo de cliente.
 *
 * Cada linha aqui é uma decisão HUMANA, não um palpite do algoritmo. É por
 * isso que elas moram numa tabela explícita: dá para ler, conferir e discutir.
 */
export const APELIDOS_CLIENTE: Record<string, string> = {
  "prever": "Especializados",
  "prever 2": "Especializados",
};

/**
 * O sprint da linha importada.
 *
 * 1. O que o Notion diz vale primeiro: foi uma escolha humana de planejamento.
 * 2. Sem etiqueta, DERIVA do prazo (R40) — 1827 das 2347 linhas do export vêm
 *    com sprint vazio, e todas cairiam em "backlog" só por falta de rótulo.
 * 3. Mas só para o que está EM ABERTO. Derivar num chamado concluído em 2025
 *    o jogaria em "essa semana", porque a regra manda o prazo vencido para
 *    agora — verdadeiro para trabalho vivo, absurdo para arquivo.
 */
export function sprintDaLinha(
  bruto: string,
  status: ChamadoStatus,
  prazo: string | null,
  agora: Date = new Date(),
): ChamadoSprint {
  const doNotion = SPRINT_NOTION[normalizarTexto(bruto)];
  if (doNotion) return doNotion;
  const encerrado = status === "concluido" || status === "cancelado";
  if (encerrado) return "backlog";
  return sprintDoPrazo(prazo, agora) ?? "backlog";
}

// ── Casamento de cliente ────────────────────────────────────────────────────

export interface CasamentoCliente {
  clienteId: string | null;
  /** o nome como veio do Notion — vai para cliente_origem_nome */
  nomeOrigem: string | null;
  /** como casou, para a prévia poder mostrar e o Davi conferir */
  via: "exato" | "apelido" | "contido" | "nenhum";
}

/**
 * Casa o nome do Notion com um cliente do QAP.
 *
 * Três tentativas, da mais segura para a menos: nome igual, apelido da tabela
 * acima, e por fim CONTENÇÃO — "Eurico Gaspar Dutra" contém "Gaspar Dutra".
 *
 * A contenção só vale quando há **um único** candidato. "Mirant" está contido
 * em "Mirant Vila Madalena Residencial" E em "Mirant Vila Madalena Studios";
 * escolher um dos dois seria pendurar trabalho no prédio errado. Com dois
 * candidatos a função desiste e deixa o texto — que é uma resposta honesta,
 * enquanto o palpite seria uma resposta errada com cara de certa.
 */
export function casarCliente(
  bruto: string,
  porNome: Map<string, string>,
): CasamentoCliente {
  // célula multivalorada ("Califórnia, Pateo Klabin") — vale o primeiro, como
  // já se faz com equipe. O Notion lista por relevância, e o primeiro é o dono.
  const nome = (bruto ?? "").split(",")[0].trim();
  if (!nome) return { clienteId: null, nomeOrigem: null, via: "nenhum" };

  const n = normalizarTexto(nome);

  const exato = porNome.get(n);
  if (exato) return { clienteId: exato, nomeOrigem: nome, via: "exato" };

  const apelido = APELIDOS_CLIENTE[n];
  if (apelido) {
    const id = porNome.get(normalizarTexto(apelido));
    if (id) return { clienteId: id, nomeOrigem: nome, via: "apelido" };
  }

  // contenção — só se for sem ambiguidade
  const candidatos: string[] = [];
  for (const [chave, id] of porNome) {
    // nomes curtos demais casariam com meio mundo ("SP" em "Sunnyvale SP")
    if (chave.length < 5 || n.length < 5) continue;
    if (chave.includes(n) || n.includes(chave)) {
      if (!candidatos.includes(id)) candidatos.push(id);
    }
  }
  if (candidatos.length === 1) {
    return { clienteId: candidatos[0], nomeOrigem: nome, via: "contido" };
  }

  return { clienteId: null, nomeOrigem: nome, via: "nenhum" };
}

// ── Casamento de pessoa ─────────────────────────────────────────────────────

export interface PessoaConhecida { id: string; nome: string; email?: string | null }

/**
 * Quem é o responsável, entre os nomes da célula.
 *
 * Devolve o PRIMEIRO que tem conta no app — e não simplesmente o primeiro da
 * lista. Em "Maria Souza, Erik Freitas", o primeiro não tem conta; ficar com
 * ele jogaria a tarefa do Erik para o limbo. Ficar com o Erik mantém a
 * tarefa com quem, aqui dentro, pode tocá-la.
 */
export function casarPessoa(
  bruto: string,
  porNome: Map<string, string>,
): { id: string | null; nomeUsado: string | null; havia: boolean } {
  const nomes = (bruto ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const nome of nomes) {
    const n = normalizarTexto(nome);
    const id = porNome.get(n) ?? porNome.get(n.split(" ")[0]);
    if (id) return { id, nomeUsado: nome, havia: true };
  }
  return { id: null, nomeUsado: nomes[0] ?? null, havia: nomes.length > 0 };
}

/** Índice de pessoas: nome completo e primeiro nome, mais o e-mail. */
export function indicePessoas(pessoas: PessoaConhecida[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of pessoas) {
    const n = normalizarTexto(p.nome ?? "");
    if (n) m.set(n, p.id);
    // o Notion às vezes tem sobrenome diferente do cadastro (o "Nicholas
    // Kafka" de lá é o "Nicholas Matos" daqui) — o primeiro nome reconcilia
    const primeiro = n.split(" ")[0];
    if (primeiro && !m.has(primeiro)) m.set(primeiro, p.id);
    if (p.email) m.set(normalizarTexto(p.email), p.id);
  }
  return m;
}

// ── A linha pronta ──────────────────────────────────────────────────────────

export interface LinhaImport {
  titulo: string;
  descricao: string | null;
  responsavelNome: string | null;
  responsavelId: string | null;
  clienteNome: string | null;
  clienteId: string | null;
  clienteVia: CasamentoCliente["via"];
  equipe: Equipe;
  sprint: ChamadoSprint;
  status: ChamadoStatus;
  tipo: ChamadoTipo;
  prazo_limite: string | null;
  concluida_em: string | null;
  origemId: string;
}

export interface ResultadoLeitura {
  linhas: LinhaImport[];
  /** linhas puladas porque o responsável não tem conta no app */
  semConta: { titulo: string; nome: string }[];
  /** linhas sem título — não dá para importar o que não tem nome */
  semTitulo: number;
}

/**
 * Converte as linhas cruas do CSV no que vai para o banco.
 *
 * PULA quem não tem conta no app, e isso é decisão de produto, não economia:
 * "chamado sem responsável é de todos" é regra viva aqui. Importar as 245
 * tarefas da Maria Souza sem responsável as despejaria na fila de todo mundo
 * — 245 cartões que ninguém pediu, na Início de cinco pessoas. Elas voltam
 * na hora em que ela tiver conta.
 */
export function lerLinhas(
  registros: Record<string, string>[],
  colunas: {
    titulo: string; descricao?: string; responsavel: string; cliente: string;
    equipe: string; sprint: string; status: string; prazo: string;
    conclusao?: string; criacao: string;
  },
  pessoasPorNome: Map<string, string>,
  clientesPorNome: Map<string, string>,
): ResultadoLeitura {
  const linhas: LinhaImport[] = [];
  const semConta: { titulo: string; nome: string }[] = [];
  let semTitulo = 0;

  for (const r of registros) {
    const titulo = (r[colunas.titulo] ?? "").trim();
    if (!titulo) { semTitulo++; continue; }

    const pessoa = casarPessoa(r[colunas.responsavel] ?? "", pessoasPorNome);
    if (!pessoa.id) {
      if (pessoa.havia) semConta.push({ titulo, nome: pessoa.nomeUsado ?? "?" });
      continue;
    }

    const cliente = casarCliente(r[colunas.cliente] ?? "", clientesPorNome);
    const descricao = (colunas.descricao ? r[colunas.descricao] : "")?.trim() || null;
    const prazo_limite = lerData(r[colunas.prazo]);
    const status = STATUS_NOTION[normalizarTexto(r[colunas.status] ?? "")] ?? "aberto";
    const concluida_em = status === "concluido"
      ? lerData(colunas.conclusao ? r[colunas.conclusao] : null)
      : null;

    linhas.push({
      titulo,
      descricao,
      responsavelNome: pessoa.nomeUsado,
      responsavelId: pessoa.id,
      clienteNome: cliente.nomeOrigem,
      clienteId: cliente.clienteId,
      clienteVia: cliente.via,
      equipe: EQUIPE_NOTION[normalizarTexto((r[colunas.equipe] ?? "").split(",")[0])] ?? "ti",
      sprint: sprintDaLinha(r[colunas.sprint] ?? "", status, prazo_limite),
      status,
      tipo: sugerirTipoChamado(titulo, descricao),
      prazo_limite,
      concluida_em,
      // Chave de reimportação: DATA DE CRIAÇÃO + título.
      //
      // A primeira versão usava título+prazo e engolia 216 das 2099 linhas
      // como falsas duplicatas — o quadro repete títulos de propósito
      // ("Verificar zonas" existe para vários prédios) e a maioria não tem
      // prazo, então a chave colapsava. Medido no arquivo real, não suposto.
      //
      // A criação tem hora e minuto e NÃO muda entre exports, que é a outra
      // metade do requisito: chave que muda faz a reimportação duplicar tudo.
      // Título + criação dá 2345 chaves para 2347 linhas do arquivo inteiro.
      origemId: `${lerDataHora(r[colunas.criacao] ?? "")}|${normalizarTexto(titulo)}`,
    });
  }

  return { linhas, semConta, semTitulo };
}
