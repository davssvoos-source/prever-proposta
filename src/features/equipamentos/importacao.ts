// A IMPORTAÇÃO DO PATRIMÔNIO DO QAP — a decisão pura (R196–R199, U109).
//
// O QAP ERP (Patrimônio > Local/Uso) é onde a Prever controla o patrimônio
// hoje. O Davi ditou a estrutura dele em 04/09/2026 e disse quais campos
// entram no nosso sistema:
//
//   Almoxarifado · Tipo de Categoria · Modelo · Fabricante · Identificação ·
//   Local/Pessoa · Data de envio
//
// A "Categoria" do QAP (Automação, no exemplo dele) SAI de propósito — Davi:
// "Quero que você ignore a 'Categoria'". A bolinha amarela da tela do QAP
// também: ela conta por quantos clientes o item já passou, e Davi: "ignore
// isso… não vamos usar essa informação para nada no nosso sistema".
//
// ── POR QUE ESTE MÓDULO EXISTE (e não é um script de uma vez) ───────────────
//
// A importação não é "copiar linhas": ela DECIDE três coisas, e cada uma pode
// errar em silêncio se ninguém a testar.
//
//   1. Qual VARIAÇÃO de catálogo cada item é (R198). Duas linhas com o mesmo
//      almoxarifado, nome, modelo e fabricante são o MESMO item de catálogo,
//      escrito de formas diferentes ("Intelbras" e "INTELBRAS ").
//   2. A que LOCAL o item pertence (R199). Casar pelo nome é o caminho fácil
//      para pôr equipamento no prédio errado; aqui só casa quem bate EXATO
//      depois de normalizar, e o resto vai para o relatório do Davi — com
//      sugestões que ninguém aplica sozinho.
//   3. Qual é a CHAVE de cada item, para reimportar sem duplicar e sem perder.
//      É o ponto mais fácil de errar: sem identificação (R197), dez botões de
//      emergência iguais, no mesmo cliente, no mesmo dia, são dez linhas
//      indistinguíveis — e uma chave "natural" ingênua colapsaria os dez num.
//      Ver `chaveDeImportacao`.
//
// Nada aqui fala com o banco nem com a tela: é função pura, testada em
// `scripts/verificar-logica.cjs`. Quem gera o SQL é
// `scripts/gerar-migration-equipamentos.cjs`, a partir do retrato cru em
// `docs/importacao/qap-equipamentos.json`.

import { normalizarTexto } from "@/lib/normalizar";

/** Uma linha da tela Patrimônio > Local/Uso do QAP, como ela é lida. */
export interface LinhaQap {
  almoxarifado: string;
  /** o "Tipo de Categoria" do QAP — R196: é o NOME do equipamento no nosso formato */
  tipo: string;
  modelo: string | null;
  fabricante: string | null;
  /** pode faltar (R197): nem todo equipamento tem — ou ninguém preencheu */
  identificacao: string | null;
  /** "Local / Pessoa", o texto cru do QAP — guardado SEMPRE (R199) */
  local: string;
  /** "Data de envio", como o QAP mostra: dd/mm/aaaa */
  enviadoEm: string | null;
  /** o id interno do QAP, quando a origem dos dados o traz */
  qapId?: string | null;
}

/** Uma variação de catálogo — a tela "Equipamentos cadastrados" (R198). */
export interface VariacaoCatalogo {
  chave: string;
  almoxarifado: string;
  nome: string;
  modelo: string | null;
  fabricante: string | null;
  /** quantos itens de patrimônio caíram nesta variação */
  quantidade: number;
}

/** Um item físico, pronto para virar linha de `equipamentos_patrimonio`. */
export interface ItemImportado {
  chaveImportacao: string;
  chaveVariacao: string;
  identificacao: string | null;
  /** o texto cru do QAP, sempre */
  localQap: string;
  /** casou com um cliente da nossa base */
  clienteId: string | null;
  /** casou com uma pessoa nossa (o equipamento está COM alguém) */
  pessoaId: string | null;
  /** dd/mm/aaaa convertido para ISO (aaaa-mm-dd), ou null se não deu */
  enviadoEm: string | null;
}

/** Um local do QAP que não existe na nossa base — o relatório do item 3 do Davi. */
export interface LocalDesconhecido {
  local: string;
  quantidade: number;
  /** nomes PARECIDOS da nossa base, para o Davi decidir — nunca aplicados sozinhos */
  sugestoes: string[];
}

export interface ResumoDaImportacao {
  catalogo: VariacaoCatalogo[];
  itens: ItemImportado[];
  desconhecidos: LocalDesconhecido[];
  /** identificações que aparecem em mais de um item (número de série repetido no QAP) */
  identificacoesRepetidas: { identificacao: string; quantidade: number }[];
  /** linhas que o QAP trouxe com o mesmo id interno — defeito de origem, não nosso */
  qapIdsRepetidos: string[];
  /** datas que não deram para ler (ficam nulas no banco, o item entra) */
  datasIlegiveis: number;
  totais: { linhas: number; variacoes: number; comCliente: number; comPessoa: number; semVinculo: number; semIdentificacao: number };
}

export interface ClienteParaCasar {
  id: string;
  nome: string | null;
  nome_predio?: string | null;
}

export interface PessoaParaCasar {
  id: string;
  nome: string | null;
}

/** Texto do QAP → texto nosso: sem espaço sobrando; vazio vira ausente. */
export function limpar(t: string | null | undefined): string | null {
  const v = (t ?? "").replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

/**
 * "01/09/2026" → "2026-09-01".
 *
 * Devolve `null` para qualquer coisa que não seja uma data dd/mm/aaaa VÁLIDA —
 * e o item entra assim mesmo, com a data nula. Inventar uma data (hoje, ou
 * 01/01) seria afirmar quando o equipamento foi para o local, que é
 * exatamente o que ninguém poderia conferir depois.
 */
export function dataQapParaISO(t: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((t ?? "").trim());
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  const d = Number(dd), mes = Number(mm), ano = Number(aaaa);
  if (mes < 1 || mes > 12 || d < 1) return null;
  // o dia tem de existir no mês (31/02 não é data)
  const ultimo = new Date(ano, mes, 0).getDate();
  if (d > ultimo) return null;
  return `${aaaa}-${mm}-${dd}`;
}

/**
 * A chave da VARIAÇÃO de catálogo (R198): almoxarifado + nome + modelo +
 * fabricante, normalizados. Modelo e fabricante ausentes entram como vazio —
 * "sem modelo" é uma variação legítima, não um item a descartar.
 */
export function chaveDaVariacao(l: LinhaQap): string {
  return [
    normalizarTexto(l.almoxarifado),
    normalizarTexto(l.tipo),
    normalizarTexto(l.modelo ?? ""),
    normalizarTexto(l.fabricante ?? ""),
  ].join("|");
}

/**
 * A chave de IMPORTAÇÃO de um item — o que faz reimportar não duplicar.
 *
 * Com o id interno do QAP, é ele: é o único identificador que a origem
 * garante. Sem ele, a chave é a linha inteira normalizada MAIS UM ORDINAL
 * (`#1`, `#2`, …) entre as linhas idênticas.
 *
 * O ORDINAL É O PONTO. Sem identificação (R197), dez botões de emergência
 * iguais, no mesmo cliente, no mesmo dia, produzem dez chaves IDÊNTICAS — e o
 * `ON CONFLICT DO NOTHING` da migration gravaria UM, jogando nove no lixo sem
 * erro nenhum. Com o ordinal, cada um tem chave própria; reimportar o mesmo
 * conjunto reencontra as mesmas chaves (idempotente), e um item novo idêntico
 * entra como `#11` em vez de sumir.
 */
export function chaveDeImportacao(l: LinhaQap, ordinal: number): string {
  const id = limpar(l.qapId ?? null);
  if (id) return `qap:${id}`;
  const base = [
    chaveDaVariacao(l),
    normalizarTexto(l.identificacao ?? ""),
    normalizarTexto(l.local),
    dataQapParaISO(l.enviadoEm) ?? "",
  ].join("|");
  return `linha:${base}#${ordinal}`;
}

/**
 * A que a linha "Local / Pessoa" se refere.
 *
 * Casa EXATO depois de normalizar, contra o nome e o nome do prédio do
 * cliente, e contra o nome das nossas pessoas (o QAP mistura os dois na mesma
 * coluna: "Soma Perdizes Offices" é cliente, "Giovanni Pascoli" é gente).
 * Não há casamento aproximado: pôr um equipamento no prédio errado é pior que
 * deixá-lo sem vínculo, e o Davi pediu justamente a relação do que não casar.
 */
export function casarLocal(
  local: string,
  clientes: ClienteParaCasar[],
  pessoas: PessoaParaCasar[],
): { tipo: "cliente" | "pessoa" | "desconhecido"; id: string | null } {
  const alvo = normalizarTexto(local);
  if (!alvo) return { tipo: "desconhecido", id: null };
  const c = clientes.find((x) => normalizarTexto(x.nome) === alvo || normalizarTexto(x.nome_predio ?? "") === alvo);
  if (c) return { tipo: "cliente", id: c.id };
  const p = pessoas.find((x) => normalizarTexto(x.nome) === alvo);
  if (p) return { tipo: "pessoa", id: p.id };
  return { tipo: "desconhecido", id: null };
}

/**
 * Nomes da nossa base PARECIDOS com o texto do QAP — só para o relatório.
 *
 * "Parecido" aqui é conter ou estar contido, depois de normalizar: é o que
 * pega "Soma Perdizes Offices" × "Soma Perdizes". Sugestão não vincula nada;
 * quem decide é o Davi.
 */
export function sugestoesDeLocal(local: string, clientes: ClienteParaCasar[], limite = 3): string[] {
  const alvo = normalizarTexto(local);
  if (alvo.length < 3) return [];
  const achados: string[] = [];
  for (const c of clientes) {
    const nome = c.nome_predio || c.nome || "";
    const n = normalizarTexto(nome);
    if (!n) continue;
    if (n.includes(alvo) || alvo.includes(n)) achados.push(nome);
    if (achados.length >= limite) break;
  }
  return achados;
}

/**
 * O trabalho inteiro: das linhas cruas do QAP para catálogo + itens +
 * relatório. Determinístico — mesma entrada, mesma saída, mesmas chaves.
 */
export function prepararImportacao(
  linhas: LinhaQap[],
  clientes: ClienteParaCasar[],
  pessoas: PessoaParaCasar[],
): ResumoDaImportacao {
  const catalogo = new Map<string, VariacaoCatalogo>();
  const itens: ItemImportado[] = [];
  const ordinais = new Map<string, number>();
  const idsQap = new Map<string, number>();
  const desconhecidos = new Map<string, number>();
  const identificacoes = new Map<string, number>();
  let datasIlegiveis = 0;

  for (const bruta of linhas) {
    const l: LinhaQap = {
      almoxarifado: limpar(bruta.almoxarifado) ?? "Sem almoxarifado",
      tipo: limpar(bruta.tipo) ?? "Sem nome",
      modelo: limpar(bruta.modelo),
      fabricante: limpar(bruta.fabricante),
      identificacao: limpar(bruta.identificacao),
      local: limpar(bruta.local) ?? "",
      enviadoEm: limpar(bruta.enviadoEm),
      qapId: limpar(bruta.qapId ?? null),
    };

    const chaveVariacao = chaveDaVariacao(l);
    const jaTem = catalogo.get(chaveVariacao);
    if (jaTem) jaTem.quantidade += 1;
    else {
      // a PRIMEIRA grafia vista é a que fica: a normalização serve para casar,
      // não para reescrever o que o QAP diz
      catalogo.set(chaveVariacao, {
        chave: chaveVariacao,
        almoxarifado: l.almoxarifado,
        nome: l.tipo,
        modelo: l.modelo,
        fabricante: l.fabricante,
        quantidade: 1,
      });
    }

    const base = chaveDeImportacao(l, 1);
    const semOrdinal = base.replace(/#\d+$/, "");
    const n = (ordinais.get(semOrdinal) ?? 0) + 1;
    ordinais.set(semOrdinal, n);
    const chaveImportacao = chaveDeImportacao(l, n);
    if (l.qapId) idsQap.set(l.qapId, (idsQap.get(l.qapId) ?? 0) + 1);

    const casado = casarLocal(l.local, clientes, pessoas);
    if (casado.tipo === "desconhecido" && l.local) {
      desconhecidos.set(l.local, (desconhecidos.get(l.local) ?? 0) + 1);
    }
    if (l.identificacao) {
      identificacoes.set(l.identificacao, (identificacoes.get(l.identificacao) ?? 0) + 1);
    }
    const iso = dataQapParaISO(l.enviadoEm);
    if (l.enviadoEm && !iso) datasIlegiveis += 1;

    itens.push({
      chaveImportacao,
      chaveVariacao,
      identificacao: l.identificacao,
      localQap: l.local,
      clienteId: casado.tipo === "cliente" ? casado.id : null,
      pessoaId: casado.tipo === "pessoa" ? casado.id : null,
      enviadoEm: iso,
    });
  }

  const lista = [...catalogo.values()].sort((a, b) =>
    (a.almoxarifado + a.nome + (a.modelo ?? "")).localeCompare(b.almoxarifado + b.nome + (b.modelo ?? ""), "pt-BR"),
  );

  return {
    catalogo: lista,
    itens,
    desconhecidos: [...desconhecidos.entries()]
      .map(([local, quantidade]) => ({ local, quantidade, sugestoes: sugestoesDeLocal(local, clientes) }))
      .sort((a, b) => b.quantidade - a.quantidade || a.local.localeCompare(b.local, "pt-BR")),
    identificacoesRepetidas: [...identificacoes.entries()]
      .filter(([, q]) => q > 1)
      .map(([identificacao, quantidade]) => ({ identificacao, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    qapIdsRepetidos: [...idsQap.entries()].filter(([, q]) => q > 1).map(([id]) => id),
    datasIlegiveis,
    totais: {
      linhas: linhas.length,
      variacoes: lista.length,
      comCliente: itens.filter((i) => i.clienteId).length,
      comPessoa: itens.filter((i) => i.pessoaId).length,
      semVinculo: itens.filter((i) => !i.clienteId && !i.pessoaId).length,
      semIdentificacao: itens.filter((i) => !i.identificacao).length,
    },
  };
}
