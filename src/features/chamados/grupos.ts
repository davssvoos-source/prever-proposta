// Grupos de clientes numa atividade — a parte PURA (R143, U96).
//
// Davi, 2026-09-03: "Sempre que o usuário selecionar um grupo de clientes, ao
// invés de um CLIENTE, ele selecionar 'CLIENTES DE PORTARIA REMOTA' ou
// 'CLIENTES DE MONITORAMENTO' o sistema contabiliza uma atividade para cada
// cliente daquele grupo. […] isso deverá aparecer individualmente no relatório
// de atividades executadas em cada cliente, mas não deverá criar um card para
// cada cliente nas atividades. Além disso, sempre que o usuário selecionar a
// opção de grupo de cliente, deverá automaticamente ter um checklist no campo
// DESCRIÇÃO da página de configuração da atividade contendo todos os clientes
// daquele grupo no checklist."
//
// O GRUPO é a etiqueta de setor que já existia (`chamado_locais.setor`, R85):
// um card só, e a lista de quem é do grupo vem de `clientes.servicos_prestados`
// na leitura — o cadastro de hoje, não uma foto do dia do clique. O que esta
// entrega acrescenta é o CHECKLIST na descrição: ele é a foto do dia, de
// propósito — é a lista de trabalho ("quais já fiz"), e trabalho se risca.
//
// O checklist é Markdown puro (`- [ ] Nome`), o mesmo que o editor de blocos
// pinta como caixa de marcar (R135, lib/texto-rico.ts).

import { SERVICO_LABEL, temServico, type ServicoCliente } from "@/features/clientes/data";

export interface ClienteDoGrupo {
  nome: string;
  servicos_prestados?: string[] | null;
}

/** O rótulo do grupo como opção de "Cliente" — "Clientes de Portaria Remota". */
export function rotuloDoGrupo(setor: ServicoCliente): string {
  return `Clientes de ${SERVICO_LABEL[setor]}`;
}

/** O prefixo que distingue um grupo de um cliente na mesma lista de opções. */
export const PREFIXO_GRUPO = "setor:";

export function valorDoGrupo(setor: ServicoCliente): string {
  return `${PREFIXO_GRUPO}${setor}`;
}

/** Devolve o setor quando o valor escolhido é um grupo; null quando é um cliente. */
export function setorDoValor(valor: string | null | undefined): ServicoCliente | null {
  if (!valor || !valor.startsWith(PREFIXO_GRUPO)) return null;
  const s = valor.slice(PREFIXO_GRUPO.length);
  return s in SERVICO_LABEL ? (s as ServicoCliente) : null;
}

/**
 * Os clientes do grupo, em ordem alfabética, cada um numa linha de checklist.
 * Vazio quando ninguém presta o serviço — sem inventar uma linha "nenhum".
 */
export function checklistDoGrupo(clientes: readonly ClienteDoGrupo[], setor: ServicoCliente): string {
  const nomes = clientes
    .filter((c) => temServico(c, setor))
    .map((c) => c.nome.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return nomes.map((n) => `- [ ] ${n}`).join("\n");
}

/**
 * Acrescenta o checklist à descrição SEM repetir: linha já presente (marcada
 * ou não) não entra de novo — escolher o grupo duas vezes, ou o mesmo cliente
 * estar nos dois grupos, não pode dobrar a lista. Quando a descrição tem
 * texto, o checklist entra depois de uma linha em branco e de um título.
 */
export function acrescentarChecklist(descricao: string | null | undefined, checklist: string, titulo?: string): string {
  const atual = (descricao ?? "").replace(/\s+$/, "");
  const linhasAtuais = new Set(
    atual.split("\n").map((l) => l.replace(/^- \[[ xX]\] /, "").trim()).filter(Boolean),
  );
  const novas = checklist
    .split("\n")
    .filter((l) => l.trim() && !linhasAtuais.has(l.replace(/^- \[[ xX]\] /, "").trim()));
  if (!novas.length) return atual;
  const bloco = (titulo ? `${titulo}\n` : "") + novas.join("\n");
  return atual ? `${atual}\n\n${bloco}` : bloco;
}
