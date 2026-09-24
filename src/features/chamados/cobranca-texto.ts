// O TEXTO PADRÃO DA COBRANÇA E O TIPO DE SERVIÇO PADRÃO (R311, U160).
//
// Davi, 23/09/2026, fechando a Q8: "O exemplo 'Manutenção corretiva,
// fornecimento de 1 unidade de fechadura, fora de contrato' ficou ótimo, siga
// este padrão. E o tipo de serviço padrão: instalação quando for implantação,
// e manutenção para o resto!"
//
// Tudo puro: a tela de campo chama `textoPadraoDaCobranca` para preencher a
// descrição do lançamento (que continua editável), e `abrirChamado` grava
// `tipoDeServicoPadrao(tipo)` quando ninguém escolheu. Sem estas duas funções
// a descrição nascia vazia e o tipo caía em "manutencao" por um `??` na tela.

export type TipoDeServico = "instalacao" | "manutencao";

/** Instalação na implantação; manutenção no resto (inclusive tipo desconhecido). */
export function tipoDeServicoPadrao(tipo: string | null | undefined): TipoDeServico {
  return tipo === "implantacao" ? "instalacao" : "manutencao";
}

/** Como cada tipo de demanda abre a frase — a primeira palavra maiúscula, o resto minúsculo, como no exemplo do Davi. */
export const ABERTURA_POR_TIPO: Record<string, string> = {
  corretiva: "Manutenção corretiva",
  preventiva: "Manutenção preventiva",
  implantacao: "Implantação",
  vistoria: "Vistoria",
  operacional: "Atendimento operacional",
};

export interface PecaFornecida {
  descricao: string;
  quantidade: number | null | undefined;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/**
 * "fornecimento de 1 unidade de fechadura" · "fornecimento de 2 unidades de
 * câmera e 1 unidade de fonte" · null quando não houve peça (o atendimento
 * foi só mão de obra). Descrição vazia é ignorada; quantidade inválida vale 1.
 */
export function fornecimentoDasPecas(pecas: readonly PecaFornecida[]): string | null {
  const partes = pecas
    .filter((p) => p.descricao && p.descricao.trim().length > 0)
    .map((p) => {
      const q = Number(p.quantidade);
      const n = Number.isFinite(q) && q > 0 ? q : 1;
      return `${n} ${plural(n, "unidade", "unidades")} de ${p.descricao.trim()}`;
    });
  if (partes.length === 0) return null;
  const lista = partes.length === 1
    ? partes[0]
    : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  return `fornecimento de ${lista}`;
}

/**
 * A frase inteira, no padrão do Davi:
 *   "Manutenção corretiva, fornecimento de 1 unidade de fechadura, fora de contrato"
 * Sem peça: "Manutenção corretiva, atendimento técnico, fora de contrato".
 */
export function textoPadraoDaCobranca(
  tipo: string | null | undefined,
  pecas: readonly PecaFornecida[],
  foraDeContrato = true,
): string {
  const abertura = ABERTURA_POR_TIPO[tipo ?? ""] ?? "Atendimento técnico";
  const meio = fornecimentoDasPecas(pecas) ?? "atendimento técnico";
  return foraDeContrato ? `${abertura}, ${meio}, fora de contrato` : `${abertura}, ${meio}`;
}
