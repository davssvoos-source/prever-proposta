// A lógica pura da ficha do cliente (R207, U114): o que os botões de ação
// copiam. Tela só pinta; o texto que vai para a área de transferência nasce
// aqui, onde o verificador consegue conferir letra por letra.

export interface EnderecoDoCliente {
  endereco?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

/**
 * O endereço numa linha só, como se cola no WhatsApp ou no mapa:
 * "Rua das Paineiras, 250, Torre B, São Paulo - SP". Parte vazia não deixa
 * vírgula sobrando; cidade e UF vão juntas com hífen, o formato dos Correios.
 */
export function enderecoParaCopiar(c: EnderecoDoCliente): string {
  const cidadeUf = [c.cidade?.trim(), c.uf?.trim()].filter((p) => p && p.length > 0).join(" - ");
  return [c.endereco?.trim(), c.complemento?.trim(), cidadeUf]
    .filter((p): p is string => !!p && p.length > 0)
    .join(", ");
}

// ── R212 (U117): as atividades da ficha passam pelo MESMO montador da Início ──
//
// Davi, 2026-09-08: "O campo Atividades deve seguir a regra de cores nos cards
// das atividades." A regra (R136) mora inteira em `CardAtividade` — cor
// estratégica só na borda, pela faixa de prazo; chip de status preenchido — e
// ela lê um `Atividade`, não um `Chamado` cru. Então a ficha traduz pelo mesmo
// adaptador que a Início e o painel operacional usam (`atividadeDoChamado`),
// em vez de replicar a regra de cor num card local.
//
// A capa da PROPOSTA (natureza comercial) fica de fora: a visita já está no
// "Histórico de visitas" da mesma ficha, e a Início também não a lista como
// chamado. `indireta` = a atividade não é DESTE cliente (veio pelo grupo de
// clientes ou como local extra, R143) — a ficha avisa embaixo do card.

import { atividadeDoChamado, type Atividade, type ContextoMontagem } from "@/features/atividades/modelo";
import type { Chamado } from "@/features/chamados/data";

export interface AtividadeDaFicha {
  a: Atividade;
  /** veio pelo grupo de clientes ou como local extra — não é deste cliente */
  indireta: boolean;
}

export function atividadesDaFicha(ordens: readonly Chamado[], clienteId: string, ctx: ContextoMontagem): AtividadeDaFicha[] {
  return ordens
    .filter((c) => c.natureza !== "comercial")
    .map((c) => ({ a: atividadeDoChamado(c as any, ctx), indireta: c.cliente_id !== clienteId }));
}
