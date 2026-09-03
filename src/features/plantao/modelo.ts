// Atendimento de plantão — a lógica PURA (R117, U87).
//
// A TELA NÃO CALCULA. Aqui moram: a recusa (o gêmeo puro das recusas da porta,
// com AS MESMAS PALAVRAS), a montagem do corpo da RPC, a conversão entre o
// relógio de parede do `<input type="datetime-local">` e o instante ISO, e a
// leitura da resposta da porta sobre a escala.
//
// ── O QUE ESTA ENTREGA GUARDA, E O QUE JÁ TINHA CASA ───────────────────────
// O fato é `às 02:30 de 30/08 o Igor atendeu a Padaria X, remoto, e isto foi o
// que ele fez`. Nada no repositório guardava isso: a ESCALA (`sobreaviso`,
// U86) guarda o PLANO — quem *deveria* estar —, e nos dias de virada nem isso
// (a segunda de troca tem dois nomes e nada no dado diz quem cobre qual
// metade); o CHAMADO, quando existe, guarda O QUÊ, nunca a que horas se
// atendeu nem que aquilo foi plantão.
//
// ── PLANTONISTA É GRAVADO, NÃO DERIVADO ───────────────────────────────────
// Mesma doutrina de "apoio é GRAVADO, dupla é DERIVADA" (U47 × U64, e a U81
// passou três entregas a firmando): a escala responde QUEM DEVERIA; o
// atendimento responde QUEM ESTEVE. Os dois divergem — troca de última hora, o
// colega que pegou porque o outro não acordou —, e derivar da escala
// transformaria a divergência em falsificação silenciosa.
//
// CUSTO DECLARADO: escala e registro podem divergir e NÃO há tela que avise.
// O único aviso é o que a porta devolve no ato da gravação (`avisoDaEscala`),
// e mais nada. Sem tela de divergência, sem selo de divergência, sem tabela de
// reconciliação — regra 8 da casa: prefira apagar a acrescentar.
//
// ── O `dia` NÃO É CALCULADO AQUI, E A AUSÊNCIA É A DECISÃO ─────────────────
// Um plantão atravessa a meia-noite: 02:30 de domingo é o plantão de DOMINGO
// (a madrugada pertence ao próprio dia de calendário — `coberturaDoDia` em
// `sobreaviso/modelo.ts:68` desconta o expediente do dia, e `semanaPadrao`
// diz por extenso que "a madrugada (00:00–08:00) desta segunda é do
// plantonista que SAI"). Quem projeta o instante no dia é o GATILHO do banco,
// em `America/Sao_Paulo`, incondicionalmente. Se este módulo também
// projetasse, haveria DUAS respostas para "de que dia foi esse plantão" — a do
// fuso do aparelho e a do fuso da empresa —, e elas divergiriam justamente na
// madrugada, que é quando o plantão acontece. A tela só mostra o dia DEPOIS de
// gravar, e o que ela mostra é o que voltou do servidor.
//
// O que sobra de dependência do aparelho está declarado e é irredutível:
// `<input type="datetime-local">` significa RELÓGIO DE PAREDE do aparelho.
// Digitar "02:30" num celular configurado para Brasília é 02:30 de Brasília. É
// o contrato do controle, e o preço de não ter um seletor de fuso na tela.

/** Remoto ou presencial — e é SÓ isto que a marca muda. Ver `TIPO_NOTA`. */
export type TipoDoAtendimento = "remoto" | "presencial";

export const TIPOS_DO_ATENDIMENTO: TipoDoAtendimento[] = ["remoto", "presencial"];

export const TIPO_LABEL: Record<TipoDoAtendimento, string> = {
  remoto: "Remoto",
  presencial: "Presencial",
};

/**
 * A NOTA QUE VAI NA TELA, e ela é a regra por extenso.
 *
 * `remoto` × `presencial` NÃO muda deslocamento (que mora em
 * `agenda_campo.deslocamento_min` e é digitado à mão), NÃO muda cobrança (não
 * há cobrança nesta entrega), NÃO muda gate, policy nem selo. Muda o rótulo e
 * o filtro, e mais nada — está escrito aqui, no `COMMENT ON COLUMN` da coluna
 * e na R117.
 */
export const TIPO_NOTA: Record<TipoDoAtendimento, string> = {
  remoto: "resolvido por telefone, acesso remoto ou aplicativo",
  presencial: "alguém foi até o local",
};

// ═══════════════════════════════════════════════════════════════════════════
// O RASCUNHO E A RECUSA
// ═══════════════════════════════════════════════════════════════════════════

export interface RascunhoDoAtendimento {
  /** O valor CRU do `<input type="datetime-local">`: "AAAA-MM-DDTHH:mm". */
  hora: string;
  plantonistaId: string | null;
  tipo: TipoDoAtendimento | "";
  descricao: string;
  /** Forma 1 do cliente: a linha de `clientes`. */
  clienteId: string | null;
  /** Forma 2: o nome digitado, para o cliente que o plantonista não enxerga. */
  clienteInformado: string;
  chamadoId: string | null;
}

export const RASCUNHO_VAZIO: RascunhoDoAtendimento = {
  hora: "",
  plantonistaId: null,
  tipo: "",
  descricao: "",
  clienteId: null,
  clienteInformado: "",
  chamadoId: null,
};

/** "AAAA-MM-DDTHH:mm" (o `datetime-local` também aceita segundos: "…:ss"). */
const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * O GÊMEO PURO DAS RECUSAS DA PORTA — as MESMAS palavras, na mesma ordem.
 *
 * O idioma é o de `erroDoLancamento` (`programacao/modelo.ts`): a porta é a
 * fronteira de verdade (SECURITY DEFINER, e a policy é a única fronteira real
 * porque todo mundo fala com o Postgres com a mesma chave publicável), e esta
 * função existe para o botão poder ficar desabilitado com uma frase em vez de
 * mandar uma requisição para receber um 22023.
 *
 * As frases são medidas contra os literais da migration pelo verificador —
 * copiar uma delas e mudar só de um lado fica VERMELHO.
 */
export function erroDoAtendimento(r: RascunhoDoAtendimento): string | null {
  if (!LOCAL_RE.test(r.hora.trim())) return "Informe a hora do atendimento.";
  if (!r.plantonistaId) return "Informe quem atendeu.";
  if (r.tipo !== "remoto" && r.tipo !== "presencial") {
    return "Diga se o atendimento foi remoto ou presencial.";
  }
  if (!r.descricao.trim()) return "Descreva o que foi feito no atendimento.";
  const temId = !!r.clienteId;
  const temTexto = !!r.clienteInformado.trim();
  if (temId && temTexto) return "Escolha o cliente da lista OU escreva o nome, não os dois.";
  if (!temId && !temTexto) return "Informe o cliente — escolha da lista ou escreva o nome.";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// O RELÓGIO DE PAREDE E O INSTANTE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "2026-08-30T02:30" (relógio do aparelho) → instante ISO com fuso.
 *
 * `new Date("AAAA-MM-DDTHH:mm")` SEM `Z` e sem offset é interpretado no fuso
 * LOCAL pelo ECMAScript — é exatamente o que o `datetime-local` quer dizer.
 * Devolve `null` para entrada que não é hora, em vez de `Invalid Date`, porque
 * um `Invalid Date` chegaria ao `.toISOString()` como exceção lá na frente,
 * longe de onde o erro nasceu.
 */
export function instanteDoLocal(local: string): string | null {
  const s = local.trim();
  if (!LOCAL_RE.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** O caminho de volta — para reabrir um atendimento no formulário. */
export function localDoInstante(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
    + `T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// O CORPO DA RPC
// ═══════════════════════════════════════════════════════════════════════════

export interface CorpoDoAtendimento {
  _id: string | null;
  _hora: string;
  _plantonista: string;
  _tipo: TipoDoAtendimento;
  _descricao: string;
  _cliente: string | null;
  _cliente_informado: string | null;
  _chamado: string | null;
}

/**
 * O rascunho vira os argumentos da porta — e `null` quando o rascunho não
 * passa. Um corpo montado a partir de rascunho inválido seria uma requisição
 * que já se sabe que vai voltar 22023.
 *
 * O `btrim` é feito NOS DOIS LADOS de propósito, e não é redundância barata: a
 * porta grava `btrim(_descricao)` porque ela é a fronteira, e aqui se apara
 * para que o índice de duplo-toque (que é `md5(lower(btrim(descricao)))`)
 * receba do cliente o mesmo texto que o servidor vai normalizar. `""` vira
 * `null` no cliente informado — é o que faz o `num_nonnulls(...) = 1` do CHECK
 * ver UMA forma e não duas.
 */
export function corpoDoAtendimento(
  r: RascunhoDoAtendimento,
  id: string | null = null,
): CorpoDoAtendimento | null {
  if (erroDoAtendimento(r) !== null) return null;
  const iso = instanteDoLocal(r.hora);
  if (iso === null) return null;
  const informado = r.clienteInformado.trim();
  return {
    _id: id,
    _hora: iso,
    _plantonista: r.plantonistaId as string,
    _tipo: r.tipo as TipoDoAtendimento,
    _descricao: r.descricao.trim(),
    _cliente: r.clienteId,
    _cliente_informado: informado === "" ? null : informado,
    _chamado: r.chamadoId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// A RESPOSTA DA PORTA: A DIVERGÊNCIA APARECE NA HORA DE GRAVAR
// ═══════════════════════════════════════════════════════════════════════════

/** O que `plantao_salvar` devolve. Uma linha. */
export interface RespostaDoPlantao {
  atendimento_id: string;
  /** A projeção que o GATILHO escreveu, em America/Sao_Paulo. */
  dia_do_plantao: string;
  /** O instante já truncado ao minuto pelo gatilho. */
  hora_gravada: string;
  /** Horas de sobreaviso DESTA pessoa naquele dia. 0 = ela não está na escala. */
  horas_escaladas: number;
  /** Horas de sobreaviso de TODO MUNDO naquele dia. 0 = não há escala lançada. */
  horas_do_dia: number;
}

export type TomDoAviso = "ok" | "fora" | "sem_escala";

export interface AvisoDaEscala {
  tom: TomDoAviso;
  texto: string;
}

/** "2026-08-30" → "30/08". Só formatação, e por isso é curta e fica aqui. */
export function diaCurto(dia: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : dia;
}

/**
 * A DIVERGÊNCIA ENTRE ESCALA E REGISTRO, DITA NO ATO — e três estados, não
 * dois.
 *
 * É o enxerto que responde ao custo da decisão 1: como o plantonista é
 * GRAVADO, escala e registro podem discordar, e sem isto ninguém saberia. Com
 * isto, quem pode consertar (a pessoa que acabou de registrar) vê a
 * discordância no segundo em que ela nasce — sem tabela de reconciliação, sem
 * tela de divergência e sem gate nenhum.
 *
 * OS TRÊS ESTADOS SÃO A DOUTRINA DO "VAZIO NÃO É FALHOU" aplicada à escala:
 *   · `ok`         — esta pessoa TEM horas naquele dia;
 *   · `fora`       — o dia TEM escala, e não é dela;
 *   · `sem_escala` — o dia não tem escala nenhuma lançada.
 * Colapsar os dois últimos em "fora da escala" acusaria o plantonista de furar
 * uma escala que ninguém lançou, que é acusação sobre o trabalho de outro.
 */
export function avisoDaEscala(r: RespostaDoPlantao): AvisoDaEscala {
  const quando = diaCurto(r.dia_do_plantao);
  if (r.horas_escaladas > 0) {
    return { tom: "ok", texto: `Plantão de ${quando} — na escala (${r.horas_escaladas}h).` };
  }
  if (r.horas_do_dia > 0) {
    return {
      tom: "fora",
      texto: `Plantão de ${quando} — FORA da escala: o dia tem ${r.horas_do_dia}h lançadas para outra pessoa.`,
    };
  }
  return { tom: "sem_escala", texto: `Plantão de ${quando} — não há escala lançada para este dia.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// A LISTA DO DIA
// ═══════════════════════════════════════════════════════════════════════════

export interface AtendimentoDePlantao {
  id: string;
  hora: string;
  dia: string;
  plantonista_id: string;
  tipo: string;
  descricao: string;
  cliente_id: string | null;
  cliente_informado: string | null;
  chamado_id: string | null;
}

/**
 * O NOME DO CLIENTE, das duas formas — e o `nomeDoCliente` é INJETADO.
 *
 * Mesmo contrato de `ContextoDoTexto` na programação: este módulo não conhece
 * nomes. E quando o id existe mas o nome não veio, a resposta é a MARCA do
 * desconhecido e não uma string vazia: `pode_ver_cliente` (u71:333) pode
 * simplesmente não deixar aquele plantonista ler aquele cliente, e um vazio ali
 * seria "sem cliente" — que é outra coisa, e é a coisa que o CHECK proíbe.
 */
export function clienteDoAtendimento(
  a: Pick<AtendimentoDePlantao, "cliente_id" | "cliente_informado">,
  nomeDoCliente: (id: string) => string | null,
): string {
  if (a.cliente_id) return nomeDoCliente(a.cliente_id) ?? "(cliente sem acesso)";
  return a.cliente_informado ?? "(sem cliente)";
}

/**
 * "02:30" a partir do instante — a hora COMO O APARELHO a mostra.
 *
 * A lista é lida pelo próprio plantonista, no mesmo aparelho em que ele
 * digitou. Formatar por `Intl` com fuso fixo faria a lista mostrar uma hora e
 * o campo de edição outra, no mesmo cartão.
 */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** Mais recente primeiro — a lista de quem acabou de registrar. */
export function ordenarAtendimentos(linhas: AtendimentoDePlantao[]): AtendimentoDePlantao[] {
  return [...linhas].sort((a, b) => (a.hora < b.hora ? 1 : a.hora > b.hora ? -1 : a.id.localeCompare(b.id)));
}
