// Resumos por I.A para a proposta comercial (.docx).
// Roda no servidor (Nitro) — precisa da env ANTHROPIC_API_KEY configurada na
// Lovable. O cliente tem fallback determinístico caso a chamada falhe, então
// a geração do documento nunca fica bloqueada pela I.A.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  /** Ficha de fatos do projeto montada pelo cliente (texto compacto). */
  contexto: z.string().min(1).max(20000),
  temRedundancia: z.boolean(),
  temIas: z.boolean(),
});

export interface ResumosProposta {
  visao_geral: string;
  escopo: string;
  redundancia: string;
  inteligencia_artificial: string;
}

export const gerarResumosProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; resumos?: ResumosProposta; erro?: string }> => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, erro: "ANTHROPIC_API_KEY não configurada no servidor" };
    }
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();

      const schema = {
        type: "object",
        properties: {
          visao_geral: {
            type: "string",
            description:
              "VISÃO GERAL: 2 parágrafos curtos separados por quebra de linha. 1º parágrafo: contexto do local e o que motivou a proposta. 2º parágrafo: 'A solução contempla ...' listando as frentes (controle de acesso, CFTV, interfonia, operação etc.) e o resultado para o cliente. Sem bullets.",
          },
          escopo: {
            type: "string",
            description:
              "ESCOPO DO PROJETO no padrão das propostas Prever: 1ª linha com o objetivo da implantação ('O objetivo da implantação é ...'). Depois uma lista de itens, um por linha, cada linha começando com '• ' em letra minúscula e terminando com ';' (último item termina com '.'). Itens concretos com quantidades reais dos blocos (ex.: '• fornecimento de 9 interfones IP distribuídos nos acessos;'). Quando for Portaria Remota, incluir também os itens operacionais padrão: fornecimento do aplicativo Grupo Prever Acessos; suporte contínuo aos moradores para uso do aplicativo, cadastros faciais e liberações; substituição dos equipamentos fornecidos em caso de falhas técnicas; até 3 dias de cadastros presenciais de moradores; fornecimento de manuais e orientações de uso; gestão da conectividade com balanceamento de carga e firewall.",
          },
          redundancia: {
            type: "string",
            description:
              "Resumo (2-3 frases) do sistema de redundância energética citando nobreak e baterias estacionárias dimensionados no escopo e o benefício (sistema operante em queda de energia). String vazia se o projeto não tiver redundância.",
          },
          inteligencia_artificial: {
            type: "string",
            description:
              "Resumo (2-4 frases) das I.As de análise de vídeo do projeto (citar quais e quantas câmeras), aplicadas para detecção e acionamentos automáticos. String vazia se não houver I.As.",
          },
        },
        required: ["visao_geral", "escopo", "redundancia", "inteligencia_artificial"],
        additionalProperties: false,
      } as const;

      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 6000,
        thinking: { type: "adaptive" },
        // Texto vai direto para documento de cliente — esforço médio
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: schema as Record<string, unknown> },
        },
        system:
          "Você redige trechos de propostas comerciais do Grupo Prever, empresa de controle de acesso e segurança eletrônica que atua desde 1994. " +
          "Escreva em português do Brasil, tom institucional, profissional e direto, na voz da empresa ('a proposta contempla', 'será fornecido', 'a Prever realizará'). " +
          "Siga o padrão das propostas reais da Prever: Visão Geral em 2 parágrafos corridos; Escopo com objetivo + lista de itens iniciados por '• ' em minúscula e terminados em ';'. " +
          "Use SOMENTE os fatos fornecidos — não invente equipamentos, quantidades ou serviços; cite quantidades reais quando existirem. " +
          "Não use markdown nem títulos — apenas o texto de cada campo.",
        messages: [
          {
            role: "user",
            content:
              `Ficha de fatos do projeto:\n\n${data.contexto}\n\n` +
              `Gere os campos pedidos. ${data.temRedundancia ? "O projeto TEM redundância energética." : "O projeto NÃO tem redundância energética — retorne redundancia como string vazia."} ` +
              `${data.temIas ? "O projeto TEM I.As de vídeo." : "O projeto NÃO tem I.As — retorne inteligencia_artificial como string vazia."}`,
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        return { ok: false, erro: "Geração recusada pelo modelo" };
      }
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return { ok: false, erro: "Resposta sem texto" };
      }
      const resumos = JSON.parse(textBlock.text) as ResumosProposta;
      return { ok: true, resumos };
    } catch (e: any) {
      return { ok: false, erro: e?.message ?? "Erro ao gerar resumos" };
    }
  });
