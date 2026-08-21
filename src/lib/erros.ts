// Códigos de erro — a taxonomia da casa.
//
// PARA QUE SERVE: quando algo falha, a tela mostra um CÓDIGO. O Davi lê o
// código (ou manda um print), e o código sozinho já diz ONDE quebrou, de QUE
// TIPO é o problema e QUAL o erro de origem. Sem isso, "deu erro na tela de
// clientes" custa meia hora de garimpo; com isso, custa um grep.
//
// O FORMATO:
//
//     PRV-CLI-PERM-42501
//     │   │   │    └── origem: o código REAL de quem falhou (Postgres,
//     │   │   │        PostgREST, HTTP) ou um hash curto e estável da
//     │   │   │        mensagem, quando a origem não tem código próprio
//     │   │   └── classe: que TIPO de problema é (as 7 abaixo)
//     │   └── área: em que parte do sistema (derivada da rota)
//     └── prefixo fixo, para o código ser reconhecível num print
//
// A DECISÃO CENTRAL: **não inventamos um universo paralelo de códigos.**
// Postgres e PostgREST já têm códigos ótimos e documentados (42501 =
// privilégio insuficiente, 42703 = coluna inexistente, PGRST205 = tabela fora
// do cache…). O nosso código CARREGA o deles. Um dicionário próprio nos
// obrigaria a manter tradução, e a tradução envelhece: na primeira mensagem
// nova do Supabase, o código viraria "ERRO_DESCONHECIDO_7" e não diria nada.
//
// O código é DETERMINÍSTICO: a mesma falha dá sempre o mesmo código. É o que
// permite reconhecer reincidência ("de novo o PRV-CLI-PERM-42501") em vez de
// tratar cada ocorrência como novidade.

/** As sete classes. A classe responde "que tipo de problema é". */
export type ClasseErro =
  | "REDE"   // não chegou no servidor (offline, DNS, timeout)
  | "AUTH"   // sessão caiu ou expirou
  | "PERM"   // chegou, foi identificado, e não podia (RLS/permissão)
  | "DADO"   // o dado violou uma regra do banco (FK, único, obrigatório)
  | "ESQM"   // o banco não tem o que o app espera — MIGRATION PENDENTE
  | "ROTA"   // endereço que não existe
  | "APP";   // quebrou no navegador (bug nosso)

export interface ErroClassificado {
  classe: ClasseErro;
  /** o código de origem (SQLSTATE, PostgREST, HTTP) ou hash da mensagem */
  origem: string;
  /** a mensagem crua, para o bloco de detalhe técnico */
  tecnico: string;
}

/**
 * Área do sistema, derivada do caminho. Três letras porque o código precisa
 * caber num print de celular e ainda ser lido em voz alta no telefone.
 *
 * A ordem IMPORTA: o primeiro prefixo que casar vence, então os caminhos mais
 * específicos vêm antes (senão "/painel/operacional" viraria a área do "/p").
 */
const AREAS: [string, string][] = [
  ["/painel/operacional", "POP"],
  ["/painel/administrativo", "PAD"],
  ["/painel", "PNL"],
  ["/chamados", "CHM"],
  ["/clientes", "CLI"],
  ["/gerencial/permissoes", "PER"],
  ["/gerencial/usuarios", "USU"],
  ["/gerencial", "GER"],
  ["/prospeccao", "PSP"],
  ["/visita", "VIS"],
  ["/contratos", "CTR"],
  ["/fechamentos", "FEC"],
  ["/calendario", "CAL"],
  ["/historico", "HIS"],
  ["/mapa", "MAP"],
  ["/dashboard", "INI"],
  ["/perfil", "PRF"],
  ["/admin", "ADM"],
  ["/auth", "AUT"],
];

export function areaDaRota(pathname: string | null | undefined): string {
  const p = (pathname ?? "").toLowerCase();
  for (const [prefixo, sigla] of AREAS) {
    if (p === prefixo || p.startsWith(prefixo + "/")) return sigla;
  }
  return p === "/" ? "INI" : "APP";
}

/**
 * Hash curto e estável de uma mensagem — para o erro que não traz código.
 * Não é criptografia: é identidade. Precisa ser o mesmo número na máquina do
 * Davi e na minha, hoje e no mês que vem, para "deu o mesmo erro" ser
 * verificável. Por isso djb2 escrito à mão, e não algo com semente aleatória.
 */
export function hashCurto(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).slice(0, 4).toUpperCase().padStart(4, "0");
}

/**
 * A mensagem varia no fim (id, nome de tabela, hora) mas a FALHA é a mesma.
 * Normalizar antes do hash é o que faz o código ser estável entre ocorrências
 * — sem isso, o mesmo bug daria um código diferente a cada clique e a palavra
 * "reincidência" perderia o sentido.
 */
function normalizarMensagem(m: string): string {
  return m
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+/g, "<data>")
    .replace(/\d+/g, "<n>")
    .trim()
    .slice(0, 160);
}

/** Códigos do Postgres/PostgREST que significam "o banco não tem o que o app pede". */
const ESQUEMA = new Set([
  "42703", // undefined_column
  "42P01", // undefined_table
  "42883", // undefined_function
  "PGRST200", // relacionamento não encontrado (FK que o embed pede)
  "PGRST202", // função não encontrada no cache
  "PGRST204", // coluna não encontrada no cache
  "PGRST205", // tabela não encontrada no cache
]);

/** Violações de integridade — o dado é que está errado, não o código. */
const INTEGRIDADE = /^23\d{3}$/; // 23502 not-null, 23503 FK, 23505 único, 23514 check

export function classificarErro(e: unknown): ErroClassificado {
  const qualquer = e as any;
  const msg = String(qualquer?.message ?? qualquer ?? "erro desconhecido");
  const code = String(qualquer?.code ?? "").trim();
  const status = Number(qualquer?.status ?? qualquer?.statusCode ?? 0);
  const alvo = `${msg} ${qualquer?.details ?? ""} ${qualquer?.hint ?? ""}`.toLowerCase();

  const devolver = (classe: ClasseErro, origem?: string): ErroClassificado => ({
    classe,
    origem: (origem || code || (status ? `HTTP${status}` : "") || hashCurto(normalizarMensagem(msg))).toUpperCase(),
    tecnico: msg,
  });

  // 1. Rede: nem chegou no servidor. Vem antes de tudo porque, offline, o
  //    Supabase devolve "Failed to fetch" sem código — e culpar o banco por
  //    falta de sinal mandaria a investigação para o lado errado.
  if (
    qualquer instanceof TypeError && /fetch|network/i.test(msg) ||
    /failed to fetch|networkerror|load failed|err_internet|timeout|aborted/i.test(alvo)
  ) {
    return devolver("REDE", "OFFLINE");
  }

  // 2. Esquema: o app pede algo que o banco não tem. Neste projeto isso quase
  //    sempre significa UMA COISA — tem migration escrita no repo que ainda
  //    não foi rodada no SQL Editor. A tela diz isso com todas as letras.
  if (ESQUEMA.has(code) || ESQUEMA.has(code.toUpperCase())) return devolver("ESQM");
  if (/could not find the (table|function|column)|schema cache/i.test(alvo)) {
    return devolver("ESQM", code || "PGRST205");
  }

  // 3. Sessão. 401 é sessão; 403 é permissão — a distinção decide se a saída
  //    é "entre de novo" ou "peça acesso ao Davi".
  if (status === 401 || /jwt (expired|invalid)|invalid refresh token|not authenticated|session.*(expired|missing)/i.test(alvo)) {
    return devolver("AUTH", code || "SESSAO");
  }

  // 4. Permissão: RLS negou. 42501 e a frase "row-level security" são os dois
  //    rostos do mesmo evento no Supabase.
  if (status === 403 || code === "42501" || code === "PGRST301" ||
      /row-level security|permission denied|insufficient|violates.*policy/i.test(alvo)) {
    return devolver("PERM", code || "RLS");
  }

  // 5. Integridade: o banco recusou o dado.
  if (INTEGRIDADE.test(code)) return devolver("DADO");

  // 6. Rota inexistente.
  if (status === 404 || /not ?found/i.test(msg)) return devolver("ROTA", code || "HTTP404");

  // 7. Sobrou: bug nosso no navegador.
  return devolver("APP");
}

/** O código completo, pronto para a tela. */
export function codigoDeErro(e: unknown, pathname?: string | null): string {
  const { classe, origem } = classificarErro(e);
  return `PRV-${areaDaRota(pathname)}-${classe}-${origem}`;
}

/**
 * O que a pessoa lê. Escrito para quem está com o trabalho parado: o que
 * aconteceu em uma frase, e o que fazer AGORA. Sem pedido de desculpas e sem
 * jargão — o jargão fica no bloco técnico, que é para mim.
 */
export const EXPLICACAO: Record<ClasseErro, { titulo: string; oQueHouve: string; oQueFazer: string }> = {
  REDE: {
    titulo: "Sem conexão com o servidor",
    oQueHouve: "O aplicativo não conseguiu falar com o servidor. Costuma ser sinal de internet.",
    oQueFazer: "Confira a conexão e toque em Tentar de novo. No campo, procure um ponto com sinal.",
  },
  AUTH: {
    titulo: "Sua sessão expirou",
    oQueHouve: "O login venceu ou foi encerrado em outro aparelho.",
    oQueFazer: "Entre de novo para continuar de onde parou.",
  },
  PERM: {
    titulo: "Você não tem acesso a isso",
    oQueHouve: "O servidor identificou você, mas o seu perfil não abre este dado.",
    oQueFazer: "Se precisa deste acesso, peça ao administrador para liberar em Permissões.",
  },
  DADO: {
    titulo: "Os dados não foram aceitos",
    oQueHouve: "Algum campo obrigatório ficou vazio, está duplicado ou aponta para um registro que não existe.",
    oQueFazer: "Revise o formulário e tente salvar de novo. Se insistir, mande o código abaixo.",
  },
  ESQM: {
    titulo: "O banco está desatualizado",
    oQueHouve: "O aplicativo pediu uma tabela ou coluna que o banco ainda não tem — normalmente uma migration que falta rodar.",
    oQueFazer: "Rode as migrations pendentes no SQL Editor e recarregue. Mande o código abaixo para saber qual falta.",
  },
  ROTA: {
    titulo: "Página não encontrada",
    oQueHouve: "Este endereço não existe ou foi movido.",
    oQueFazer: "Volte para a Início — a fila de trabalho está lá.",
  },
  APP: {
    titulo: "Esta página não carregou",
    oQueHouve: "Algo quebrou dentro do aplicativo ao montar a tela.",
    oQueFazer: "Tente de novo. Se repetir, mande o código abaixo — ele aponta o lugar exato.",
  },
};

/** Uma linha para toast: mensagem curta + código. */
export function mensagemDeErro(e: unknown, pathname?: string | null): string {
  const { classe } = classificarErro(e);
  return `${EXPLICACAO[classe].titulo} · ${codigoDeErro(e, pathname)}`;
}
