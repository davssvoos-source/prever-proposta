// Criação rápida de chamado por IA — Etapa U20.
//
// O usuário escreve um resumo em linguagem corrente ("portão do Green Village
// travando de novo, urgente, mandar o Erik") e o modelo devolve os campos que
// o formulário pediria: natureza, tipo, título, descrição, prioridade, equipe.
//
// A função INTERPRETA, não cria. Quem cria é o cliente, com o abrirChamado()
// de sempre — assim a criação rápida passa pelos mesmos triggers (número,
// SLA, sprint, classificação) e pelas mesmas policies do caminho normal, e
// não existe um segundo caminho de escrita para manter.
//
// Espelha o padrão de contrato.functions.ts: createServerFn + auth +
// output_config com json_schema. Modelo: claude-sonnet-5 — a tarefa é triagem
// de um parágrafo, não leitura de contrato de 40 páginas; o rápido basta.

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  texto: z.string().min(8, "Descreva o chamado em pelo menos uma frase.").max(4000),
});

export interface ChamadoInterpretado {
  natureza: "campo" | "interno";
  tipo: "corretiva" | "preventiva" | "operacional" | "implantacao" | "melhoria" | "pedido_compra";
  titulo: string;
  descricao: string;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  equipe: "ti" | "patrimonio" | "audiovisual" | "business_ops" | "tecnica" | "comercial" | "sac" | "monitoramento";
  /** Nome de cliente citado no texto, se houver — o app tenta casar depois. */
  cliente_citado: string | null;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["natureza", "tipo", "titulo", "descricao", "prioridade", "equipe", "cliente_citado"],
  properties: {
    natureza: { type: "string", enum: ["campo", "interno"] },
    tipo: { type: "string", enum: ["corretiva", "preventiva", "operacional", "implantacao", "melhoria", "pedido_compra"] },
    titulo: { type: "string", maxLength: 120 },
    descricao: { type: "string", maxLength: 2000 },
    prioridade: { type: "string", enum: ["baixa", "normal", "alta", "urgente"] },
    equipe: { type: "string", enum: ["ti", "patrimonio", "audiovisual", "business_ops", "tecnica", "comercial", "sac", "monitoramento"] },
    cliente_citado: { type: ["string", "null"] },
  },
} as const;

const SISTEMA = `Você triagem chamados do Grupo Prever (segurança predial: CFTV,
controle de acesso, alarmes, portaria remota, interfonia).

Decida os campos do chamado a partir do resumo escrito pelo atendente.

NATUREZA:
- "campo": uma dupla técnica se DESLOCA até um condomínio/cliente — conserto,
  preventiva, entrega, instalação. Menção a ir/mandar alguém a um lugar = campo.
- "interno": trabalho de mesa — T.I., compras, marketing, melhoria de processo,
  tarefa administrativa. Sem deslocamento = interno.

TIPO:
- corretiva: algo quebrou/parou/está travando e precisa de conserto.
- preventiva: revisão/manutenção programada, sem defeito relatado.
- operacional: rotina que não é conserto nem melhoria (entrega de controle,
  conferência, cadastro).
- implantacao: instalação de sistema novo ou ampliação.
- melhoria: melhorar algo que já funciona (processo, material, software).
- pedido_compra: comprar/cotar material ou equipamento.

PRIORIDADE (só faz diferença no campo):
- urgente: risco, cliente sem segurança, palavra "urgente"/"agora"/"parado".
- alta: incomoda muito ou tem data apertada.
- normal: o padrão quando nada indica pressa.
- baixa: explicitamente sem pressa.

EQUIPE (para natureza interna; no campo use "tecnica"):
ti (sistemas, câmeras off-line, acessos, rede) · patrimonio (compras, estoque,
equipamentos) · audiovisual (vídeo, arte, folder) · business_ops
(administrativo, RH, processos) · comercial (proposta, cliente novo) · sac
(atendimento) · monitoramento (central, portaria remota).

TÍTULO: curto e específico, como um humano escreveria na lista (ex.: "Portão
social travando — Green Village"). Não repita a descrição.

DESCRIÇÃO: o resumo reescrito limpo, completo, sem inventar fatos.

CLIENTE_CITADO: o nome do condomínio/cliente exatamente como aparece no texto,
ou null se nenhum for citado.

Responda somente com o JSON pedido.`;

export const interpretarChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; chamado?: ChamadoInterpretado; erro?: string }> => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, erro: "ANTHROPIC_API_KEY não configurada no servidor" };
    }
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();

      const response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        output_config: {
          format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
        },
        // o prompt não muda entre chamados: cache o system inteiro
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: data.texto }],
      } as any);

      if ((response as any).stop_reason === "refusal") {
        return { ok: false, erro: "Interpretação recusada pelo modelo" };
      }
      const bloco = (response as any).content?.find((b: any) => b.type === "text");
      if (!bloco?.text) return { ok: false, erro: "Resposta sem conteúdo" };

      return { ok: true, chamado: JSON.parse(bloco.text) as ChamadoInterpretado };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, erro: `Falha ao interpretar: ${msg}` };
    }
  });
