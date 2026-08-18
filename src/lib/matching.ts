// Casamento e valoração de itens — Etapa U4 da unificação.
// Portado de ~/Documents/gestor-os/src/lib/matching.ts, que já rodava em
// produção. Funções PURAS de propósito: são a espinha dorsal da decisão de
// cobrança e precisam ser testáveis sem banco, sem rede e sem I.A.
//
// A ordem da cascata não é estética — é a ordem de CONFIANÇA. Número de série
// é identidade; descrição parecida é palpite. A I.A entra depois, e só para
// decidir cobertura; quem casa equipamento é este arquivo.

import { normalizarChave, normalizarTexto } from "./normalizar";

/** Duas casas, para não arrastar dízima de float até o boleto. */
export function arredondar(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Semelhança de Jaccard entre dois textos, por palavra.
 * Usada como último recurso: descrição livre erra muito, e por isso o score
 * dela é multiplicado por 0,75 e tem piso de aceitação.
 */
export function semelhanca(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(normalizarChave(a).split(" ").filter(Boolean));
  const tb = new Set(normalizarChave(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuns = 0;
  for (const t of ta) if (tb.has(t)) comuns++;
  const uniao = ta.size + tb.size - comuns;
  return uniao === 0 ? 0 : comuns / uniao;
}

export interface ItemParaCasar {
  descricao?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numero_serie?: string | null;
  tag_patrimonio?: string | null;
}

export interface CandidatoEquipamento extends ItemParaCasar {
  id: string;
}

export interface Casamento<T extends CandidatoEquipamento = CandidatoEquipamento> {
  candidato: T;
  score: number;
  /** Por que casou — vira justificativa na tela de conferência. */
  motivo: string;
}

/** Abaixo disto não é casamento, é chute. */
export const SCORE_MINIMO = 0.45;

/**
 * Procura, entre os equipamentos cobertos por um contrato, qual corresponde ao
 * item registrado no atendimento. Devolve null quando nada passa do piso —
 * "não identificado" é resposta legítima e melhor do que casar errado.
 */
export function casarEquipamento<T extends CandidatoEquipamento>(
  item: ItemParaCasar,
  candidatos: T[],
): Casamento<T> | null {
  if (candidatos.length === 0) return null;

  const serie = normalizarTexto(item.numero_serie);
  const tag = normalizarTexto(item.tag_patrimonio);
  const modelo = normalizarTexto(item.modelo);
  const marca = normalizarTexto(item.marca);

  // 1) número de série é identidade, não semelhança
  if (serie) {
    const achado = candidatos.find((c) => normalizarTexto(c.numero_serie) === serie);
    if (achado) return { candidato: achado, score: 1, motivo: "número de série idêntico" };
  }

  // 2) TAG de patrimônio: identidade dentro da casa (pode ser reetiquetada)
  if (tag) {
    const achado = candidatos.find((c) => normalizarTexto(c.tag_patrimonio) === tag);
    if (achado) return { candidato: achado, score: 0.95, motivo: "TAG de patrimônio idêntica" };
  }

  // 3) modelo que aparece UMA vez só no contrato — sem ambiguidade possível
  if (modelo) {
    const mesmos = candidatos.filter((c) => normalizarTexto(c.modelo) === modelo);
    if (mesmos.length === 1) {
      return { candidato: mesmos[0], score: 0.85, motivo: "modelo único no contrato" };
    }
    // 4) marca + modelo desempatam quando o modelo se repete
    if (mesmos.length > 1 && marca) {
      const comMarca = mesmos.filter((c) => normalizarTexto(c.marca) === marca);
      if (comMarca.length === 1) {
        return { candidato: comMarca[0], score: 0.8, motivo: "marca e modelo conferem" };
      }
    }
  }

  // 5) último recurso: parecença de descrição, com desconto e piso
  let melhor: Casamento<T> | null = null;
  for (const c of candidatos) {
    const alvo = [c.marca, c.modelo, c.descricao].filter(Boolean).join(" ");
    const base = [item.marca, item.modelo, item.descricao].filter(Boolean).join(" ");
    const score = arredondar(semelhanca(base, alvo) * 0.75);
    if (score >= SCORE_MINIMO && (!melhor || score > melhor.score)) {
      melhor = { candidato: c, score, motivo: "descrição parecida" };
    }
  }
  return melhor;
}

// ── Valoração ───────────────────────────────────────────────────────────────

export interface TabelaPreco {
  chave_busca?: string | null;
  descricao: string;
  valor_unitario: number;
}

export interface ResultadoValor {
  valor_unitario: number | null;
  origem: "informado" | "contrato" | "catalogo" | "sem_preco";
}

function acharPreco(descricao: string, tabela: TabelaPreco[]): number | null {
  const chave = normalizarTexto(descricao);
  if (!chave) return null;
  const exato = tabela.find((p) => (p.chave_busca ?? normalizarTexto(p.descricao)) === chave);
  if (exato) return exato.valor_unitario;
  // parcial só quando é inequívoco: dois preços parecidos viram REVISAR
  const parciais = tabela.filter((p) => {
    const c = p.chave_busca ?? normalizarTexto(p.descricao);
    return c.length > 3 && (chave.includes(c) || c.includes(chave));
  });
  return parciais.length === 1 ? parciais[0].valor_unitario : null;
}

/**
 * Precedência ESTRITA, na ordem em que a informação é mais específica:
 *   1. o que o técnico anotou na OS
 *   2. o preço combinado naquele contrato
 *   3. o preço padrão do catálogo comercial
 *   4. nada — e "nada" NUNCA vira zero.
 *
 * Item sem preço volta como `sem_preco` para ir a REVISAR. Cobrar R$ 0 é a
 * forma silenciosa de perder dinheiro; pedir conferência é barato.
 */
export function valorarItem(
  item: { descricao: string; valor_unitario_informado?: number | null },
  precosContrato: TabelaPreco[],
  precosCatalogo: TabelaPreco[],
): ResultadoValor {
  const informado = item.valor_unitario_informado;
  if (informado != null && Number.isFinite(informado) && informado > 0) {
    return { valor_unitario: arredondar(informado), origem: "informado" };
  }
  const doContrato = acharPreco(item.descricao, precosContrato);
  if (doContrato != null && doContrato > 0) {
    return { valor_unitario: arredondar(doContrato), origem: "contrato" };
  }
  const doCatalogo = acharPreco(item.descricao, precosCatalogo);
  if (doCatalogo != null && doCatalogo > 0) {
    return { valor_unitario: arredondar(doCatalogo), origem: "catalogo" };
  }
  return { valor_unitario: null, origem: "sem_preco" };
}

// ── Cobertura ───────────────────────────────────────────────────────────────

export type ResultadoItem = "coberto" | "faturavel" | "nao_identificado" | "revisar";

export interface RegraContrato {
  modalidade: "locacao" | "manutencao" | "comodato" | "venda";
  inclui_pecas: boolean;
  inclui_mao_de_obra: boolean;
  inclui_deslocamento: boolean;
}

export interface ItemCobertura {
  cobertura: "integral" | "parcial" | "nao_coberto";
  inclui_pecas: boolean | null;
  inclui_mao_de_obra: boolean | null;
}

/**
 * Decisão determinística de cobertura — o que dá para responder sem I.A.
 * Devolve null quando a resposta depende de interpretação (aí a I.A entra).
 *
 * Regras do Vinicius, escritas: locação não cobra equipamento; manutenção
 * cobre mão de obra e cobra peça; sem contrato vigente, cobra tudo.
 */
export function coberturaDeterministica(
  tipo: "peca" | "mao_de_obra" | "deslocamento" | "servico" | "outro",
  contrato: RegraContrato | null,
  itemContrato: ItemCobertura | null,
): { resultado: ResultadoItem; motivo: string } | null {
  if (!contrato) {
    return { resultado: "faturavel", motivo: "cliente sem contrato vigente na data do atendimento" };
  }
  if (itemContrato?.cobertura === "nao_coberto") {
    return { resultado: "faturavel", motivo: "equipamento listado no contrato como não coberto" };
  }

  // override do item vence a regra geral do contrato
  const incluiPecas = itemContrato?.inclui_pecas ?? contrato.inclui_pecas;
  const incluiMo = itemContrato?.inclui_mao_de_obra ?? contrato.inclui_mao_de_obra;

  if (tipo === "mao_de_obra") {
    return incluiMo
      ? { resultado: "coberto", motivo: "mão de obra incluída no contrato" }
      : { resultado: "faturavel", motivo: "mão de obra não incluída no contrato" };
  }
  if (tipo === "deslocamento") {
    return contrato.inclui_deslocamento
      ? { resultado: "coberto", motivo: "deslocamento incluído no contrato" }
      : { resultado: "faturavel", motivo: "deslocamento não incluído no contrato" };
  }
  if (tipo === "peca") {
    // locação: o equipamento é da Prever, trocar não é serviço vendido
    if (contrato.modalidade === "locacao") {
      return { resultado: "coberto", motivo: "contrato de locação: equipamento é da contratada" };
    }
    if (incluiPecas) return { resultado: "coberto", motivo: "peças incluídas no contrato" };
    return { resultado: "faturavel", motivo: "peças cobradas à parte neste contrato" };
  }
  // serviço/outro dependem do texto do contrato — quem lê é a I.A
  return null;
}

/**
 * Franquia de visitas: a partir da N+1ª visita fechada na competência, a mão de
 * obra deixa de estar coberta. Contrato sem franquia (null) nunca estoura.
 */
export function franquiaEstourada(
  franquia: number | null | undefined,
  visitasNaCompetencia: number,
): boolean {
  if (franquia == null || franquia <= 0) return false;
  return visitasNaCompetencia > franquia;
}
