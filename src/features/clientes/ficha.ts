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

// ── R212/R218 (U117/U118): as atividades da ficha passam pelo MESMO montador da Início ──
//
// Davi, 2026-09-08: "O campo Atividades deve seguir a regra de cores nos cards
// das atividades." A regra (R136) mora inteira em `CardAtividade` — cor
// estratégica só na borda, pela faixa de prazo; chip de status preenchido — e
// ela lê um `Atividade`, não um `Chamado` cru. Então a ficha traduz pelo mesmo
// adaptador que a Início e o painel operacional usam (`atividadeDoChamado`),
// em vez de replicar a regra de cor num card local.
//
// E, no mesmo dia (R218): "visitas técnicas, chamados, atividades devem estar
// tudo listado no mesmo campo." A visita entra na MESMA lista pelo montador
// dela (`atividadeDaVisita`, o da Início) — a capa da PROPOSTA (chamado de
// natureza comercial) fica de fora para a visita não aparecer duas vezes.
// `indireta` = a atividade não é DESTE cliente (veio pelo grupo de clientes
// ou como local extra, R143) — a ficha avisa embaixo do card. A lista sai da
// mais recente para a mais antiga.

import { atividadeDoChamado, atividadeDaVisita, type Atividade, type BrutoVisita, type ContextoMontagem } from "@/features/atividades/modelo";
import type { Chamado } from "@/features/chamados/data";

export interface AtividadeDaFicha {
  a: Atividade;
  /** veio pelo grupo de clientes ou como local extra — não é deste cliente */
  indireta: boolean;
  /** o status da visita (fonte "visita") — decide a rota ao clicar (visitaRouteFor) */
  visitaStatus: string | null;
}

export function atividadesDaFicha(
  ordens: readonly Chamado[],
  visitas: readonly BrutoVisita[],
  clienteId: string,
  ctx: ContextoMontagem,
): AtividadeDaFicha[] {
  const dosChamados: AtividadeDaFicha[] = ordens
    .filter((c) => c.natureza !== "comercial")
    .map((c) => ({ a: atividadeDoChamado(c as any, ctx), indireta: c.cliente_id !== clienteId, visitaStatus: null }));
  const dasVisitas: AtividadeDaFicha[] = visitas
    .map((v) => ({ a: atividadeDaVisita(v, ctx), indireta: false, visitaStatus: v.status ?? null }));
  return [...dosChamados, ...dasVisitas]
    .sort((x, y) => (y.a.criadoEm ?? "").localeCompare(x.a.criadoEm ?? ""));
}
