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
              "Dissertação resumida (1 parágrafo, 3-5 frases) da visão geral dos serviços propostos no projeto.",
          },
          escopo: {
            type: "string",
            description:
              "Escopo do projeto: para cada bloco, uma linha começando com o nome do bloco seguido de dois pontos e um resumo de 1-2 frases. Separar blocos com quebra de linha.",
          },
          redundancia: {
            type: "string",
            description:
              "Resumo (2-3 frases) do sistema de redundância energética (nobreaks/baterias), ou string vazia se o projeto não tiver redundância.",
          },
          inteligencia_artificial: {
            type: "string",
            description:
              "Resumo (2-4 frases) das I.As de análise de vídeo oferecidas no projeto, ou string vazia se não houver I.As.",
          },
        },
        required: ["visao_geral", "escopo", "redundancia", "inteligencia_artificial"],
        additionalProperties: false,
      } as const;

      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        // Resumos curtos e formulaicos — esforço baixo mantém o botão responsivo
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: schema as Record<string, unknown> },
        },
        system:
          "Você redige trechos de propostas comerciais do Grupo Prever, empresa de controle de acesso e segurança eletrônica. " +
          "Escreva em português do Brasil, tom profissional e direto, voz da empresa ('forneceremos', 'será instalado'). " +
          "Use SOMENTE os fatos fornecidos — não invente equipamentos, quantidades ou serviços. " +
          "Não use markdown, títulos nem bullets; apenas texto corrido (o escopo usa uma linha por bloco).",
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
