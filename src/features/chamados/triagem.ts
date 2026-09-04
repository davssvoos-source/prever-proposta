// Triagem da abertura rápida — a parte PURA (R80–R85, U71).
//
// A IA lê o texto livre e devolve MENÇÕES: "Nicholas", "Green Village",
// "clientes de portaria remota". Este arquivo transforma menção em VÍNCULO —
// id de pessoa, id de cliente, etiqueta de setor — sem tocar em rede, banco
// ou React, para o verificador poder exercitar cada regra de verdade.
//
// A divisão não é estética. A IA é boa em entender "o Nicholas vai dar uma
// força" como apoio, e ruim em garantir que existe exatamente um Nicholas com
// conta no app. A decisão semântica é dela; a decisão de identidade é daqui.

import { normalizarTexto } from "@/lib/normalizar";
import { equipesDePessoas, type Equipe } from "@/lib/equipes";
import type { ServicoCliente } from "@/features/clientes/data";
import { SERVICO_ORDEM } from "@/features/clientes/data";

// ── Pessoas ─────────────────────────────────────────────────────────────────

export interface PessoaTriagem {
  id: string;
  nome: string;
  /** A equipe do cadastro. É ela que entra na atividade quando a pessoa entra. */
  equipe?: string | null;
}

/**
 * Índice de primeiro nome → id.
 *
 * Davi: "Geralmente vamos nos referir com o primeiro nome de cada usuário."
 *
 * O `indicePessoas()` do importador do Notion resolve o mesmo problema, mas com
 * uma regra que aqui seria perigosa: em colisão de primeiro nome, ele fica com
 * o PRIMEIRO que indexou (`if (primeiro && !m.has(primeiro))`). Numa importação
 * em lote, revisada em prévia pelo Davi, um palpite é aceitável. Aqui não: o
 * texto vira atividade na hora, e pendurar trabalho na pessoa errada é pior do
 * que não pendurar em ninguém.
 *
 * Por isso primeiro nome AMBÍGUO mapeia para `null` — a mesma escolha que o
 * `casarCliente()` faz na contenção com dois candidatos. Nome completo sempre
 * resolve, então "Nicholas Matos" continua funcionando mesmo com dois Nicholas.
 */
export function indicePrimeiroNome(pessoas: PessoaTriagem[]): Map<string, string | null> {
  const completo = new Map<string, string>();
  const primeiro = new Map<string, string | null>();

  for (const p of pessoas) {
    const n = normalizarTexto(p.nome ?? "");
    if (!n) continue;
    completo.set(n, p.id);

    const pn = n.split(" ")[0];
    if (!pn) continue;
    if (!primeiro.has(pn)) primeiro.set(pn, p.id);
    else if (primeiro.get(pn) !== p.id) primeiro.set(pn, null); // ambíguo: cala
  }

  // nome completo vence o primeiro nome — é mais específico
  const m = new Map<string, string | null>(primeiro);
  for (const [k, v] of completo) m.set(k, v);
  return m;
}

/**
 * Quem é a pessoa citada, ou null quando não dá para saber com segurança.
 *
 * Três tentativas, da mais específica para a menos:
 *   1. o texto inteiro ("Erik Freitas")
 *   2. o primeiro token ("Erik")
 *   3. QUALQUER token, desde que só um deles case
 *
 * A terceira existe porque o texto vem de gente escrevendo depressa, e o
 * modelo devolve o trecho como está: "o Erik", "com o Nicholas", "pro Davi".
 * O artigo na frente derrubava as duas primeiras tentativas e a atribuição se
 * perdia em silêncio — que é o pior desfecho possível aqui, porque o chamado
 * nasce sem dono e ninguém é avisado.
 *
 * Ela só vale com UM token casando: "Erik e Nicholas" num campo que deveria
 * ter uma pessoa é ambíguo, e ambiguidade cala — mesma regra do índice.
 */
export function resolverPessoa(
  citado: string | null | undefined,
  indice: Map<string, string | null>,
): string | null {
  const n = normalizarTexto(citado ?? "");
  if (!n) return null;
  if (indice.has(n)) return indice.get(n) ?? null;

  const tokens = n.split(" ").filter(Boolean);
  const primeiro = tokens[0];
  if (primeiro && indice.has(primeiro)) return indice.get(primeiro) ?? null;

  const achados: string[] = [];
  for (const t of tokens) {
    const id = indice.get(t);
    if (id && !achados.includes(id)) achados.push(id);
  }
  return achados.length === 1 ? achados[0] : null;
}

/** Resolve uma lista de menções, descartando o que não casou e repetições. */
export function resolverPessoas(
  citados: string[] | null | undefined,
  indice: Map<string, string | null>,
): string[] {
  const ids: string[] = [];
  for (const c of citados ?? []) {
    const id = resolverPessoa(c, indice);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ── Equipes ─────────────────────────────────────────────────────────────────

/**
 * As equipes de uma atividade — as das PESSOAS que estão nela (R139, U96).
 *
 * Até a U96 somavam-se duas fontes: o ASSUNTO que a IA classificava (R82) e
 * quem participa (R83). Davi, 2026-09-03: "vamos associar a equipe diretamente
 * ao(s) usuário(s) envolvido(s) na atividade". Sobrou uma fonte só — e é a
 * mesma regra que `atividades/modelo.ts` aplica ao ler: a equipe de quem
 * entra na atividade entra junto, e sai quando a pessoa sai. Isto NÃO está
 * escrito como `if (nome === "Nicholas")` de propósito — vale para o próximo
 * contratado sem tocar em código, e a manutenção acontece no cadastro.
 *
 * A PRIMEIRA da lista é a do responsável (vai para `chamados.equipe`, a coluna
 * que ainda existe para quem a lê). Sem nenhuma pessoa com equipe, a lista sai
 * VAZIA — "Outras" era o balde de quando a equipe se escolhia à mão (R81).
 */
export function equipesDaAtividade(args: {
  participantes?: string[] | null;
  pessoas?: PessoaTriagem[] | null;
}): Equipe[] {
  const porId = new Map((args.pessoas ?? []).map((p) => [p.id, p]));
  return equipesDePessoas(args.participantes ?? [], (id) => porId.get(id)?.equipe);
}

// ── Locais ──────────────────────────────────────────────────────────────────

/**
 * O LOCAL, nas três formas que ele pode ter (R84).
 *
 * Davi: "A etiqueta de cliente na verdade seria uma etiqueta de LOCAL, este
 * tempo todo estávamos usando a palavra errada. Então o Local pode SER OU NÃO
 * SER nosso cliente."
 */
export type LocalResolvido =
  /** casou com a base do QAP */
  | { forma: "cliente"; clienteId: string; nome: string }
  /** não casou — é prédio que estamos prospectando (R22), a criar */
  | { forma: "prospeccao"; nome: string }
  /** um setor de serviço inteiro, como etiqueta e não como 80 chips */
  | { forma: "setor"; setor: ServicoCliente };

export interface ClienteTriagem { id: string; nome: string; nome_predio?: string | null }

/** Índice de nome (e nome do prédio) → id de cliente. */
export function indiceClientes(clientes: ClienteTriagem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of clientes) {
    for (const bruto of [c.nome, c.nome_predio]) {
      const n = normalizarTexto(bruto ?? "");
      if (n && !m.has(n)) m.set(n, c.id);
    }
  }
  return m;
}

/**
 * Casa o nome de um local com a base de clientes.
 *
 * Mesma escada de confiança do `casarCliente()` do importador — exato, depois
 * contenção sem ambiguidade — e pela mesma razão: "Mirant" está contido em
 * "Mirant Vila Madalena Residencial" E em "Mirant Vila Madalena Studios", e
 * escolher um dos dois é pendurar trabalho no prédio errado. Com dois
 * candidatos, desiste — e desistir aqui não perde o local, só muda a forma
 * dele para prospecção, que é a resposta honesta: não sabemos que é este
 * cliente.
 */
export function casarLocal(nome: string, indice: Map<string, string>): string | null {
  const n = normalizarTexto(nome ?? "");
  if (!n) return null;

  const exato = indice.get(n);
  if (exato) return exato;

  if (n.length < 5) return null; // "SP" casaria com meio mundo
  const candidatos: string[] = [];
  for (const [chave, id] of indice) {
    if (chave.length < 5) continue;
    if (chave.includes(n) || n.includes(chave)) {
      if (!candidatos.includes(id)) candidatos.push(id);
    }
  }
  return candidatos.length === 1 ? candidatos[0] : null;
}

function ehSetor(v: string | null | undefined): v is ServicoCliente {
  return !!v && (SERVICO_ORDEM as string[]).includes(v);
}

/**
 * A lista de locais da atividade, sem limite de quantidade (R85) e sem
 * repetição.
 *
 * Setor e local nominal convivem: "enviar o relatório de acessos da Portaria
 * Remota, e o do Green Village junto" é um setor mais um prédio.
 */
export function resolverLocais(args: {
  nomes?: string[] | null;
  setores?: string[] | null;
  indiceClientes: Map<string, string>;
}): LocalResolvido[] {
  const fora: LocalResolvido[] = [];

  for (const s of args.setores ?? []) {
    if (ehSetor(s) && !fora.some((l) => l.forma === "setor" && l.setor === s)) {
      fora.push({ forma: "setor", setor: s });
    }
  }

  for (const bruto of args.nomes ?? []) {
    const nome = (bruto ?? "").trim();
    if (!nome) continue;

    const clienteId = casarLocal(nome, args.indiceClientes);
    if (clienteId) {
      if (!fora.some((l) => l.forma === "cliente" && l.clienteId === clienteId)) {
        fora.push({ forma: "cliente", clienteId, nome });
      }
      continue;
    }

    const n = normalizarTexto(nome);
    if (!fora.some((l) => l.forma === "prospeccao" && normalizarTexto(l.nome) === n)) {
      fora.push({ forma: "prospeccao", nome });
    }
  }

  return fora;
}

// ── Título ──────────────────────────────────────────────────────────────────

/** Separadores que a IA usa quando gruda o local no fim do título. */
const SEPARADORES = ["—", "–", "-", "·", "|", ":", ","];

/**
 * Tira o local do título (R86).
 *
 * Davi: "O local não deve ficar no título - o título deve ser SEMPRE UMA BREVE
 * DESCRIÇÃO DO QUE DEVE SER FEITO. E o LOCAL deve ser inserido na etiqueta de
 * LOCAL."
 *
 * O prompt já pede isso, mas pedir não é garantir: o exemplo que estava no
 * prompt antigo era literalmente "Portão social travando — Green Village", ou
 * seja, o modelo foi ENSINADO a grudar o prédio no fim. Esta função é a rede
 * embaixo, e é deliberadamente conservadora — só corta quando o que sobra
 * ainda descreve um trabalho. Título vazio ou reduzido a uma palavra solta é
 * pior do que título com o prédio no fim.
 */
export function tituloSemLocal(titulo: string, nomesDeLocal: string[]): string {
  let t = (titulo ?? "").trim();
  if (!t) return titulo;

  // Nome curto não entra: "Sol" cortaria "painel Sol" de um título legítimo.
  const locais = nomesDeLocal
    .map((n) => normalizarTexto(n ?? ""))
    .filter((n) => n.length >= 4);
  if (!locais.length) return t;

  // O corte compara SEGMENTOS INTEIROS entre separadores, nunca índices —
  // `normalizarTexto` colapsa espaços e muda o comprimento, então posição
  // achada no texto normalizado não vale no texto original.
  for (let i = 0; i < 3; i++) {
    const corte = cortarLocalNoSufixo(t, locais);
    if (corte === null) break;
    t = corte;
  }

  const semPrefixo = cortarLocalNoPrefixo(t, locais);
  if (semPrefixo !== null) t = semPrefixo;

  return t.replace(/[\s—–\-·|:,]+$/, "").trim() || titulo;
}

/** "Portão social travando — Green Village" → "Portão social travando" */
function cortarLocalNoSufixo(t: string, locais: string[]): string | null {
  for (const sep of SEPARADORES) {
    const i = t.lastIndexOf(sep);
    if (i <= 0) continue;
    const cauda = normalizarTexto(t.slice(i + sep.length));
    if (!cauda || !locais.includes(cauda)) continue;
    const cabeca = t.slice(0, i).trim();
    if (aindaDescreveTrabalho(cabeca)) return cabeca;
  }
  return null;
}

/** "Green Village: portão travando" → "Portão travando" */
function cortarLocalNoPrefixo(t: string, locais: string[]): string | null {
  for (const sep of SEPARADORES) {
    const i = t.indexOf(sep);
    if (i <= 0) continue;
    const cabeca = normalizarTexto(t.slice(0, i));
    if (!cabeca || !locais.includes(cabeca)) continue;
    const resto = t.slice(i + sep.length).trim();
    if (aindaDescreveTrabalho(resto)) return resto[0].toUpperCase() + resto.slice(1);
  }
  return null;
}

/** Sobrou frase de trabalho, ou só um caco? */
function aindaDescreveTrabalho(s: string): boolean {
  const limpo = s.replace(/[\s—–\-·|:,]+$/, "").trim();
  return limpo.length >= 8 && limpo.split(/\s+/).filter(Boolean).length >= 2;
}
