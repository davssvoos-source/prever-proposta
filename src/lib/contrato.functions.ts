// Leitura do contrato por I.A — Etapa U2 da unificação.
// Porta o PROMPT_CONTRATO do gestor-os (~/Documents/gestor-os/src/lib/ia.ts)
// para o padrão de server function já usado em proposta.functions.ts.
//
// Roda no servidor (Nitro) — precisa da env ANTHROPIC_API_KEY configurada na
// Lovable. Nunca cria nem ativa contrato sozinha: devolve os campos extraídos
// com um nível de confiança e a conferência é humana, exatamente como a
// conferência de OS do gestor-os ("cobrança indevida custa mais caro que uma
// conferência").
//
// DIFERENÇA em relação ao gestor-os: lá o PDF era lido com `unpdf` e só virava
// leitura visual quando não tinha camada textual. Aqui o PDF vai sempre como
// documento para o modelo — o app não tem `unpdf` e adicionar dependência é
// tarefa da Lovable. Custa mais tokens; funciona igual para PDF escaneado, que
// é a maioria dos contratos assinados. Ver PLANO_UNIFICACAO §12 (U2).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  /** Caminho do arquivo já enviado ao bucket privado `contratos`. */
  storagePath: z.string().min(1).max(500),
});

export interface EquipamentoCobertoExtraido {
  descricao: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  tag_patrimonio: string;
  local: string;
  quantidade: number;
  cobertura: "integral" | "parcial" | "nao_coberto";
}

export interface PrecoExtraido {
  descricao: string;
  unidade: string;
  valor_unitario: number;
}

export interface ContratoExtraido {
  numero: string;
  titulo: string;
  cliente_nome: string;
  cliente_documento: string;
  modalidade: "locacao" | "manutencao" | "comodato" | "venda";
  tipo_cobranca: "mensal_fixo" | "por_chamado" | "misto";
  vigencia_inicio: string;
  vigencia_fim: string;
  valor_mensal: number | null;
  dia_vencimento: number | null;
  franquia_visitas_mes: number | null;
  inclui_pecas: boolean;
  inclui_mao_de_obra: boolean;
  inclui_deslocamento: boolean;
  equipamentos: EquipamentoCobertoExtraido[];
  precos: PrecoExtraido[];
  confianca: number;
  alertas: string[];
}

/**
 * REGRA GERAL do gestor-os, preservada: nunca inventar, datas em ISO,
 * confiança honesta e alertas para o humano. Campo ausente vira vazio/null —
 * nunca um chute.
 */
const SISTEMA =
  "Você lê contratos de prestação de serviço de segurança eletrônica do Grupo Prever e extrai os dados estruturados. " +
  "REGRAS INEGOCIÁVEIS: (1) NUNCA invente informação — o que não estiver escrito no documento volta como string vazia, null ou lista vazia; " +
  "(2) datas sempre no formato AAAA-MM-DD; (3) valores em número, sem símbolo de moeda, usando ponto decimal; " +
  "(4) a confiança deve ser honesta: documento ilegível, cortado ou ambíguo pede confiança baixa; " +
  "(5) tudo que ficou em dúvida vira uma frase curta em 'alertas', para a pessoa conferir. " +
  "Uma extração errada gera cobrança indevida — na dúvida, deixe em branco e alerte.";

const INSTRUCAO =
  "Extraia os dados do contrato em anexo.\n\n" +
  "modalidade: 'locacao' quando os equipamentos continuam sendo da contratada e o cliente paga mensalidade pelo uso; " +
  "'manutencao' quando o contrato cobre manutenção/assistência de equipamentos do cliente; " +
  "'comodato' quando há cessão de uso sem cobrança pelo equipamento; 'venda' quando os equipamentos foram vendidos ao cliente.\n\n" +
  "tipo_cobranca: 'mensal_fixo' (mensalidade), 'por_chamado' (paga por atendimento) ou 'misto'.\n\n" +
  "inclui_pecas / inclui_mao_de_obra / inclui_deslocamento: o que a mensalidade JÁ cobre. " +
  "Se o contrato diz que peças são cobradas à parte, inclui_pecas = false.\n\n" +
  "equipamentos: a relação de equipamentos cobertos, com número de série e TAG de patrimônio quando o contrato listar. " +
  "cobertura = 'integral' (tudo coberto), 'parcial' (parte por conta do cliente) ou 'nao_coberto' (listado mas fora da cobertura).\n\n" +
  "precos: a tabela de preços de serviços/itens que o contrato fixar (hora técnica, visita, deslocamento por km etc.).\n\n" +
  "franquia_visitas_mes: quantas visitas por mês já estão inclusas; null se o contrato não limitar.";

const SCHEMA = {
  type: "object",
  properties: {
    numero: { type: "string", description: "Número do contrato. Vazio se não houver." },
    titulo: { type: "string", description: "Título/objeto do contrato, em uma linha." },
    cliente_nome: { type: "string", description: "Razão social ou nome do contratante." },
    cliente_documento: { type: "string", description: "CNPJ ou CPF do contratante, só dígitos. Vazio se não houver." },
    modalidade: { type: "string", enum: ["locacao", "manutencao", "comodato", "venda"] },
    tipo_cobranca: { type: "string", enum: ["mensal_fixo", "por_chamado", "misto"] },
    vigencia_inicio: { type: "string", description: "AAAA-MM-DD. Vazio se não constar." },
    vigencia_fim: { type: "string", description: "AAAA-MM-DD. Vazio quando a vigência for indeterminada." },
    valor_mensal: { type: ["number", "null"], description: "Mensalidade. null se não houver valor fixo." },
    dia_vencimento: { type: ["integer", "null"], description: "Dia do mês de vencimento (1 a 31). null se não constar." },
    franquia_visitas_mes: { type: ["integer", "null"], description: "Visitas inclusas por mês. null se ilimitado ou não citado." },
    inclui_pecas: { type: "boolean" },
    inclui_mao_de_obra: { type: "boolean" },
    inclui_deslocamento: { type: "boolean" },
    equipamentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          marca: { type: "string" },
          modelo: { type: "string" },
          numero_serie: { type: "string" },
          tag_patrimonio: { type: "string" },
          local: { type: "string", description: "Onde o equipamento está instalado, se o contrato disser." },
          quantidade: { type: "number" },
          cobertura: { type: "string", enum: ["integral", "parcial", "nao_coberto"] },
        },
        required: ["descricao", "marca", "modelo", "numero_serie", "tag_patrimonio", "local", "quantidade", "cobertura"],
        additionalProperties: false,
      },
    },
    precos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          unidade: { type: "string", description: "hora, visita, km, unidade…" },
          valor_unitario: { type: "number" },
        },
        required: ["descricao", "unidade", "valor_unitario"],
        additionalProperties: false,
      },
    },
    confianca: { type: "number", description: "0 a 1. Quão confiável está a extração como um todo." },
    alertas: {
      type: "array",
      items: { type: "string" },
      description: "Pontos que a pessoa precisa conferir. Lista vazia se não houver dúvida.",
    },
  },
  required: [
    "numero", "titulo", "cliente_nome", "cliente_documento", "modalidade", "tipo_cobranca",
    "vigencia_inicio", "vigencia_fim", "valor_mensal", "dia_vencimento", "franquia_visitas_mes",
    "inclui_pecas", "inclui_mao_de_obra", "inclui_deslocamento",
    "equipamentos", "precos", "confianca", "alertas",
  ],
  additionalProperties: false,
} as const;

export const extrairContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; contrato?: ContratoExtraido; erro?: string }> => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, erro: "ANTHROPIC_API_KEY não configurada no servidor" };
    }
    try {
      // O arquivo já está no bucket privado; baixar aqui evita mandar megabytes
      // de base64 pelo corpo da requisição do navegador.
      const { data: arquivo, error: erroDownload } = await supabaseAdmin.storage
        .from("contratos")
        .download(data.storagePath);
      if (erroDownload || !arquivo) {
        return { ok: false, erro: `Não consegui ler o arquivo enviado (${erroDownload?.message ?? "arquivo vazio"})` };
      }
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      if (bytes.byteLength > 24 * 1024 * 1024) {
        return { ok: false, erro: "PDF acima de 24 MB — envie uma versão menor ou só as páginas do contrato." };
      }
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const base64 = btoa(bin);

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();

      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
        },
        // o prompt não muda entre importações: cache o system inteiro
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: INSTRUCAO },
            ],
          },
        ],
      } as any);

      if ((response as any).stop_reason === "refusal") {
        return { ok: false, erro: "Leitura recusada pelo modelo" };
      }
      const bloco = (response as any).content?.find((b: any) => b.type === "text");
      if (!bloco?.text) return { ok: false, erro: "Resposta sem conteúdo" };

      const contrato = JSON.parse(bloco.text) as ContratoExtraido;
      return { ok: true, contrato };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, erro: `Falha ao ler o contrato: ${msg}` };
    }
  });
