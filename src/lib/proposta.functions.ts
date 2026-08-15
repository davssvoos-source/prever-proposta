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
  /** Bullets extras derivados das observações do técnico (podem ser ""). */
  responsabilidades_extras_contratada: string;
  responsabilidades_extras_contratante: string;
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
              "VISÃO GERAL: 1 a 2 parágrafos curtos (separados por quebra de linha quando forem 2). Contexto do local e o que motivou a proposta ('O Condomínio X busca modernizar ...'); quando houver 2º parágrafo: 'A solução contempla ...' listando as frentes (controle de acesso, CFTV, interfonia, operação etc.) e o resultado para o cliente. Sem bullets.",
          },
          escopo: {
            type: "string",
            description:
              "ESCOPO DO PROJETO no padrão das propostas Prever: 1ª linha com o objetivo da implantação ('O objetivo da implantação é ...'). Depois uma lista de itens, um por linha, cada linha começando com '• ' e inicial MAIÚSCULA, terminando com ';' (último item termina com '.'). Itens no padrão real: agrupados por acesso/bloco com as quantidades reais ('• Implantação dos equipamentos de controle de acesso na eclusa de pedestres, contemplando 3 leitoras faciais, 2 interfones IP, 2 fechaduras magnéticas, 2 molas aéreas;' ou '• Fornecimento, instalação e configuração de 16 câmeras em pontos estratégicos do condomínio;'). Quando for Portaria Remota, incluir também os itens operacionais padrão: '• Implantação de todos os equipamentos contemplados na central de portaria remota;', '• Fornecimento do aplicativo Grupo Prever Acessos para uso dos moradores;', '• Suporte contínuo aos moradores para uso do aplicativo, cadastros faciais e liberações;', '• Substituição dos equipamentos fornecidos em caso de falhas técnicas;', '• Até 3 dias de cadastros presenciais de moradores;', '• Fornecimento de manuais e orientações de uso aos moradores;', '• Gestão da conectividade com balanceamento de carga e firewall, sendo o link de internet de responsabilidade do cliente.'",
          },
          redundancia: {
            type: "string",
            description:
              "Resumo (2-3 frases) do sistema de redundância energética citando ESPECIFICAMENTE o nobreak e as baterias presentes na lista de equipamentos da ficha (modelo/porte e quantidade, ex.: 'um nobreak de 3KVA e duas baterias estacionárias de 115Ah') e o benefício (sistema operante em queda de energia). String vazia se o projeto não tiver redundância.",
          },
          inteligencia_artificial: {
            type: "string",
            description:
              "Resumo (2-4 frases) das I.As de análise de vídeo do projeto (citar quais e quantas câmeras), aplicadas para detecção e acionamentos automáticos. String vazia se não houver I.As.",
          },
          responsabilidades_extras_contratada: {
            type: "string",
            description:
              "Bullets EXTRAS de responsabilidade da CONTRATADA (Prever) derivados EXCLUSIVAMENTE das observações do técnico na ficha — compromissos que a Prever assumiu explicitamente ali. Um por linha, começando com '• ' e terminando com ';'. String vazia se as observações não trouxerem nenhum. NUNCA invente nem repita os bullets padrão (fornecer/instalar equipamentos, suporte, armazenar imagens).",
          },
          responsabilidades_extras_contratante: {
            type: "string",
            description:
              "Bullets EXTRAS de responsabilidade da CONTRATANTE (cliente) derivados EXCLUSIVAMENTE das observações do técnico — condições do local que dependem do cliente (ex.: fornecer portão/porta, compartilhar senhas do CFTV atual, serviços de serralheria, intervenções estruturais). Um por linha, começando com '• ' e terminando com ';'. String vazia se não houver. NUNCA invente nem repita os bullets padrão (acesso ao local, links de internet, agendar elevadores).",
          },
        },
        required: [
          "visao_geral",
          "escopo",
          "redundancia",
          "inteligencia_artificial",
          "responsabilidades_extras_contratada",
          "responsabilidades_extras_contratante",
        ],
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
          "Siga o padrão das propostas reais da Prever: Visão Geral em 1 a 2 parágrafos corridos; Escopo com objetivo + lista de itens iniciados por '• ' com inicial maiúscula e terminados em ';'. " +
          "Use SOMENTE os fatos fornecidos — não invente equipamentos, quantidades ou serviços; cite quantidades reais quando existirem. " +
          "Quando a ficha trouxer OBSERVAÇÕES DO TÉCNICO (por bloco ou gerais), interprete-as e reflita-as nos textos: nuances de instalação e condições do local entram na visão geral/escopo com redação institucional, e condições que dependem do cliente ou compromissos extras da Prever viram bullets nos campos de responsabilidades extras. " +
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
