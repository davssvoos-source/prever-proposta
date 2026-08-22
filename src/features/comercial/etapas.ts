// As etapas do ciclo comercial (R64) — a lógica pura, testável sem React.
//
// O CICLO, como o Davi o descreveu (2026-08-22): visita técnica pendente →
// visita feita (aguardando aprovação interna → aprovada, proposta em preparo)
// → PROPOSTA ENVIADA a quem a solicitou — e aí o ciclo ENCERRA.
//
// O QUE ESTE SISTEMA NÃO MAPEIA, DE PROPÓSITO: se o cliente aceitou ou
// recusou a proposta. "Enviar a proposta ao responsável por solicitá-la
// significa encerrar o ciclo" — o funil desta tela termina em "Enviadas", e
// qualquer estágio de aceite/recusa aqui seria o sistema fingindo saber o
// que ninguém registra nele (era o que o funil antigo fazia: mostrava
// "Aceitas 0 · Recusadas 0" para sempre, porque a coluna existe no banco
// mas nenhum fluxo a preenche desde a R38).
//
// APROVAÇÃO É INTERNA (R4, e a memória insiste): "aprovada" é o comercial
// dizendo "o orçamento está bom, pode virar proposta" — nunca "negócio
// fechado". O rótulo da etapa seguinte deixa isso físico: "Falta enviar
// proposta", que é a única coisa que a aprovação interna de fato autoriza.

export type EtapaComercial =
  | "visita_pendente"       // pendente / em_andamento — o técnico ainda não foi
  | "aguardando_aprovacao"  // concluida / aguardando_aprovacao — visita feita, orçamento em análise interna
  | "falta_proposta"        // aprovada, sem proposta_enviada_em — aprovado, falta gerar/enviar
  | "enviada"               // proposta_enviada_em preenchido — CICLO ENCERRADO
  | "cancelada";            // cancelada / reprovada — saiu do funil

/** Ordem de exibição — a ordem do próprio ciclo, com o terminal por último. */
export const ETAPA_ORDEM: EtapaComercial[] = [
  "visita_pendente", "aguardando_aprovacao", "falta_proposta", "enviada", "cancelada",
];

export const ETAPA_LABEL: Record<EtapaComercial, string> = {
  visita_pendente: "Visita pendente",
  aguardando_aprovacao: "Aguardando aprovação",
  falta_proposta: "Falta enviar proposta",
  enviada: "Proposta enviada",
  cancelada: "Cancelada",
};

/**
 * Cores por etapa — pares claro/escuro + véu 12% / borda 30% (§2.4 do design
 * system). O STATUS_CONFIG antigo usava UMA cor por status ("#F8C811" como
 * texto nos dois temas) — dourado 400 sobre branco dá ~2:1 de contraste, o
 * anti-padrão nº 3 do design system, em produção.
 */
export const ETAPA_CORES: Record<EtapaComercial, { dark: string; light: string; bg: string; border: string }> = {
  // amarelo = pendente/aviso: é o que espera ação nossa
  visita_pendente:      { dark: "#F8C811", light: "#A06108", bg: "rgba(248,200,17,0.12)",  border: "rgba(248,200,17,0.30)" },
  // azul = info/em análise
  aguardando_aprovacao: { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
  // violeta = em andamento (matiz informativo fora das escalas, §2.1)
  falta_proposta:       { dark: "#9085e9", light: "#4a3aa7", bg: "rgba(144,133,233,0.12)", border: "rgba(144,133,233,0.30)" },
  // verde = sucesso: o ciclo encerrou do jeito que devia
  enviada:              { dark: "#2DD2A5", light: "#047862", bg: "rgba(45,210,165,0.12)",  border: "rgba(45,210,165,0.30)" },
  cancelada:            { dark: "#F17881", light: "#B1242E", bg: "rgba(241,120,129,0.12)", border: "rgba(241,120,129,0.25)" },
};

interface VisitaParaEtapa {
  status: string | null;
  proposta_enviada_em: string | null;
}

/**
 * A etapa de uma visita/proposta, derivada do que o banco JÁ guarda.
 *
 * `proposta_enviada_em` vence o status: depois do envio o status continua
 * "aprovada" no banco (nenhum fluxo o troca), e é o carimbo de envio que diz
 * que o ciclo acabou. Sem essa precedência, toda proposta enviada apareceria
 * eternamente como "falta enviar" — o oposto exato da verdade.
 *
 * Status desconhecido cai em "visita_pendente": o comportamento de sempre
 * do app (ver colunaDaVisita) — um status novo no banco nunca pode fazer a
 * linha SUMIR da lista.
 */
export function etapaDaVisita(v: VisitaParaEtapa): EtapaComercial {
  if (v.proposta_enviada_em) return "enviada";
  const st = v.status ?? "";
  if (st === "cancelada" || st === "reprovada") return "cancelada";
  if (st === "concluida" || st === "aguardando_aprovacao") return "aguardando_aprovacao";
  if (st === "aprovada") return "falta_proposta";
  return "visita_pendente";
}

/** Contagem por etapa — alimenta os chips de filtro (mesmo padrão de Clientes). */
export function contagemPorEtapa(visitas: VisitaParaEtapa[]): Record<EtapaComercial, number> {
  const zero = Object.fromEntries(ETAPA_ORDEM.map((e) => [e, 0])) as Record<EtapaComercial, number>;
  for (const v of visitas) zero[etapaDaVisita(v)]++;
  return zero;
}

/**
 * O funil — TRÊS estágios, cumulativos, e termina no envio (R64).
 *
 * "Aprovadas" conta também as já enviadas: funil é régua de progresso, não
 * fotografia de estado — uma proposta enviada PASSOU pela aprovação, e um
 * funil onde o estágio 2 pode ser menor que o 3 lê como erro de conta.
 */
export function funilComercial(visitas: VisitaParaEtapa[]): { visitas: number; aprovadas: number; enviadas: number } {
  const enviadas = visitas.filter((v) => !!v.proposta_enviada_em).length;
  const aprovadas = visitas.filter((v) => v.status === "aprovada" || !!v.proposta_enviada_em).length;
  return { visitas: visitas.length, aprovadas, enviadas };
}
