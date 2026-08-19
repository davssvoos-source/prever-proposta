// Análise de cobertura de um atendimento — Etapa U4 da unificação.
// Porta o PROMPT_ANALISE do gestor-os (~/Documents/gestor-os/src/lib/ia.ts).
//
// A ordem importa e é deliberada:
//   1. casamento DETERMINÍSTICO do item com o equipamento do contrato
//      (src/lib/matching.ts — série, TAG, modelo, e só então descrição)
//   2. regra de cobertura que dá para decidir sem interpretar texto
//   3. valoração com precedência estrita (informado > contrato > catálogo)
//   4. só o que sobrou em dúvida vai para a I.A
//
// A I.A NUNCA cria cobrança: ela classifica, e a cobrança nasce só na
// aprovação humana (RPC aprovar_os_financeiro). Se a chamada falhar ou não
// houver chave configurada, a análise entrega o resultado determinístico e
// manda o resto para revisão — nunca trava a operação.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  casarEquipamento, coberturaDeterministica, valorarItem, franquiaEstourada,
  arredondar, type ResultadoItem, type TabelaPreco,
} from "@/lib/matching";
import { competencia } from "@/lib/periodos";

const inputSchema = z.object({ chamadoId: z.string().uuid() });

interface VereditoItem {
  peca_id: string;
  resultado: ResultadoItem;
  valor_calculado: number | null;
  confianca: number;
  justificativa: string;
  cobertura_item_id: string | null;
}

export interface ResumoAnalise {
  total: number;
  cobertos: number;
  faturaveis: number;
  revisar: number;
  valorFaturavel: number;
  usouIa: boolean;
  aviso?: string;
}

const SISTEMA =
  "Você decide, item a item, se o que foi feito num atendimento técnico está COBERTO pelo contrato do cliente " +
  "ou é FATURÁVEL. Trabalha para o Grupo Prever, empresa de segurança eletrônica.\n" +
  "REGRAS INEGOCIÁVEIS: (1) na dúvida, responda 'revisar' — cobrança indevida custa muito mais caro do que uma " +
  "conferência humana; (2) NUNCA invente equipamento, valor ou cláusula; (3) só aceite casar um item do " +
  "atendimento com um equipamento do contrato se os identificadores baterem — descrição parecida, sozinha, não " +
  "é prova; (4) explique cada decisão em uma frase curta, em português do Brasil, citando o que na cobertura " +
  "sustenta a resposta.";

const SCHEMA = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          indice: { type: "integer", description: "Índice do item, exatamente como veio na entrada." },
          resultado: { type: "string", enum: ["coberto", "faturavel", "nao_identificado", "revisar"] },
          equipamento_contrato_id: {
            type: ["string", "null"],
            description: "Id do equipamento coberto que corresponde a este item, ou null.",
          },
          confianca: { type: "number", description: "0 a 1." },
          justificativa: { type: "string", description: "Uma frase curta explicando a decisão." },
        },
        required: ["indice", "resultado", "equipamento_contrato_id", "confianca", "justificativa"],
        additionalProperties: false,
      },
    },
  },
  required: ["itens"],
  additionalProperties: false,
} as const;

export const analisarCobrancaChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; resumo?: ResumoAnalise; erro?: string }> => {
    // cliente do próprio usuário: a RLS garante que só quem responde pelo
    // financeiro lê contrato e escreve veredito
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;

    const { data: os, error: erroOs } = await sb
      .from("chamados")
      .select("id, cliente_id, contrato_id, tipo_servico, finalizada_em, created_at, titulo")
      .eq("id", data.chamadoId)
      .maybeSingle();
    if (erroOs || !os) return { ok: false, erro: "Chamado não encontrado." };

    const { data: pecas, error: erroPecas } = await sb
      .from("chamado_pecas")
      .select("id, descricao, marca, modelo, numero_serie, tag_patrimonio, quantidade, tipo, valor_unitario_informado")
      .eq("chamado_id", data.chamadoId)
      .order("created_at");
    if (erroPecas) return { ok: false, erro: erroPecas.message };
    if (!pecas || pecas.length === 0) {
      return { ok: false, erro: "Nada foi registrado neste atendimento — não há o que analisar." };
    }

    // ajuste manual trava o item: reanálise não pode desfazer decisão humana
    const { data: analiseAtual } = await sb
      .from("chamado_pecas_analise")
      .select("peca_id, ajustado_manualmente")
      .eq("chamado_id", data.chamadoId);
    const travados = new Set(
      ((analiseAtual as any[]) ?? []).filter((a) => a.ajustado_manualmente).map((a) => a.peca_id as string),
    );

    // ── contrato e cobertura ────────────────────────────────────────────────
    let contrato: any = null;
    let cobertura: any[] = [];
    let precosContrato: TabelaPreco[] = [];
    if (os.contrato_id) {
      const [{ data: c }, { data: cob }, { data: pc }] = await Promise.all([
        sb.from("cliente_contratos")
          .select("id, modalidade, inclui_pecas, inclui_mao_de_obra, inclui_deslocamento, franquia_visitas_mes")
          .eq("id", os.contrato_id).maybeSingle(),
        sb.from("contrato_cobertura_itens")
          .select("id, descricao, marca, modelo, numero_serie, tag_patrimonio, local, cobertura, inclui_pecas, inclui_mao_de_obra")
          .eq("contrato_id", os.contrato_id),
        sb.from("contrato_precos")
          .select("descricao, valor_unitario, chave_busca")
          .eq("contrato_id", os.contrato_id),
      ]);
      contrato = c ?? null;
      cobertura = (cob as any[]) ?? [];
      precosContrato = ((pc as any[]) ?? []) as TabelaPreco[];
    }

    // catálogo comercial como tabela de preço padrão (decisão do §11.2)
    const { data: catalogo } = await sb.from("equipamentos").select("nome, marca, modelo, custo, markup");
    const precosCatalogo: TabelaPreco[] = ((catalogo as any[]) ?? []).map((e) => ({
      descricao: [e.marca, e.modelo, e.nome].filter(Boolean).join(" "),
      valor_unitario: arredondar(Number(e.custo ?? 0) * Number(e.markup ?? 1)),
    }));

    // franquia: a visita N+1 do mês deixa de ter a mão de obra coberta
    const dataRef = new Date(os.finalizada_em ?? os.created_at);
    let estourouFranquia = false;
    if (contrato?.franquia_visitas_mes) {
      const { data: n } = await sb.rpc("visitas_na_competencia", {
        _cliente_id: os.cliente_id,
        _competencia: competencia(dataRef),
      });
      estourouFranquia = franquiaEstourada(contrato.franquia_visitas_mes, Number(n ?? 0));
    }

    // ── 1) passada determinística ───────────────────────────────────────────
    const veredito: Record<string, VereditoItem> = {};
    const indefinidos: { indice: number; peca: any; casado: any }[] = [];

    pecas.forEach((p: any, i: number) => {
      if (travados.has(p.id)) return;

      const casamento = casarEquipamento(p, cobertura as any[]);
      const itemContrato = casamento?.candidato ?? null;
      const valor = valorarItem(p, precosContrato, precosCatalogo);

      let regra = coberturaDeterministica(p.tipo, contrato, itemContrato as any);

      // franquia estourada derruba a cobertura da mão de obra
      if (regra?.resultado === "coberto" && p.tipo === "mao_de_obra" && estourouFranquia) {
        regra = { resultado: "faturavel", motivo: "franquia de visitas do mês já foi consumida" };
      }

      if (!regra) {
        indefinidos.push({ indice: i, peca: p, casado: itemContrato });
        return;
      }

      // faturável sem preço NÃO vira R$ 0: vira revisão (invariante 2)
      if (regra.resultado === "faturavel" && valor.valor_unitario == null) {
        veredito[p.id] = {
          peca_id: p.id,
          resultado: "revisar",
          valor_calculado: null,
          confianca: 0.5,
          justificativa: `${regra.motivo}, mas não há preço cadastrado para "${p.descricao}".`,
          cobertura_item_id: itemContrato?.id ?? null,
        };
        return;
      }

      veredito[p.id] = {
        peca_id: p.id,
        resultado: regra.resultado,
        valor_calculado: regra.resultado === "faturavel" ? valor.valor_unitario : null,
        confianca: casamento ? casamento.score : 0.9,
        justificativa:
          regra.motivo +
          (casamento ? ` (casou por ${casamento.motivo})` : "") +
          (regra.resultado === "faturavel" && valor.origem !== "informado"
            ? ` · preço do ${valor.origem === "contrato" ? "contrato" : "catálogo"}`
            : ""),
        cobertura_item_id: itemContrato?.id ?? null,
      };
    });

    // ── 2) o que sobrou vai para a I.A ──────────────────────────────────────
    let usouIa = false;
    let aviso: string | undefined;

    if (indefinidos.length > 0) {
      if (!process.env.ANTHROPIC_API_KEY) {
        aviso = "ANTHROPIC_API_KEY não configurada: itens ambíguos foram para revisão manual.";
      } else {
        try {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const client = new Anthropic();
          const contexto = {
            contrato: contrato
              ? {
                  modalidade: contrato.modalidade,
                  inclui_pecas: contrato.inclui_pecas,
                  inclui_mao_de_obra: contrato.inclui_mao_de_obra,
                  inclui_deslocamento: contrato.inclui_deslocamento,
                }
              : null,
            equipamentos_cobertos: cobertura.map((c) => ({
              id: c.id, descricao: c.descricao, marca: c.marca, modelo: c.modelo,
              numero_serie: c.numero_serie, tag: c.tag_patrimonio, local: c.local,
              cobertura: c.cobertura,
            })),
            itens: indefinidos.map((d) => ({
              indice: d.indice,
              descricao: d.peca.descricao,
              tipo: d.peca.tipo,
              marca: d.peca.marca,
              modelo: d.peca.modelo,
              numero_serie: d.peca.numero_serie,
              quantidade: d.peca.quantidade,
              sugestao_equipamento_id: d.casado?.id ?? null,
            })),
          };

          const resposta = await client.messages.create({
            model: "claude-opus-4-8",
            max_tokens: 8000,
            thinking: { type: "adaptive" },
            output_config: {
              effort: "high",
              format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
            },
            system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
            messages: [
              {
                role: "user",
                content:
                  `<contrato>${JSON.stringify(contexto.contrato)}</contrato>\n` +
                  `<equipamentos_cobertos>${JSON.stringify(contexto.equipamentos_cobertos)}</equipamentos_cobertos>\n` +
                  `<itens_da_os>${JSON.stringify(contexto.itens)}</itens_da_os>\n\n` +
                  "Classifique CADA item pelo índice. Use 'nao_identificado' quando não der para dizer a que " +
                  "equipamento o item se refere, e 'revisar' quando a cobertura depender de algo que não está claro.",
              },
            ],
          } as any);

          const bloco = (resposta as any).content?.find((b: any) => b.type === "text");
          const saida = bloco?.text ? (JSON.parse(bloco.text) as { itens: any[] }) : { itens: [] };
          usouIa = true;

          for (const r of saida.itens ?? []) {
            const alvo = indefinidos.find((d) => d.indice === r.indice);
            if (!alvo) continue;
            // invariante 4: id devolvido pela I.A é validado contra o contrato
            const idValido = cobertura.some((c) => c.id === r.equipamento_contrato_id)
              ? (r.equipamento_contrato_id as string)
              : null;
            const valor = valorarItem(alvo.peca, precosContrato, precosCatalogo);
            const semPreco = r.resultado === "faturavel" && valor.valor_unitario == null;
            veredito[alvo.peca.id] = {
              peca_id: alvo.peca.id,
              resultado: semPreco ? "revisar" : (r.resultado as ResultadoItem),
              valor_calculado: r.resultado === "faturavel" && !semPreco ? valor.valor_unitario : null,
              confianca: Number(r.confianca ?? 0.5),
              justificativa: semPreco
                ? `${r.justificativa} (sem preço cadastrado — precisa de valor)`
                : String(r.justificativa ?? ""),
              cobertura_item_id: idValido,
            };
          }
        } catch (e) {
          aviso = `A leitura por I.A falhou (${e instanceof Error ? e.message : String(e)}); os itens ambíguos foram para revisão.`;
        }
      }

      // o que a I.A não cobriu (falha, chave ausente ou índice perdido)
      for (const d of indefinidos) {
        if (veredito[d.peca.id]) continue;
        veredito[d.peca.id] = {
          peca_id: d.peca.id,
          resultado: "revisar",
          valor_calculado: null,
          confianca: 0.3,
          justificativa: "A cobertura deste item depende de leitura do contrato — confira manualmente.",
          cobertura_item_id: d.casado?.id ?? null,
        };
      }
    }

    // ── 3) grava ────────────────────────────────────────────────────────────
    const linhas = Object.values(veredito).map((v) => ({
      peca_id: v.peca_id,
      chamado_id: data.chamadoId,
      resultado: v.resultado,
      cobertura_item_id: v.cobertura_item_id,
      valor_calculado: v.valor_calculado,
      confianca: Math.min(1, Math.max(0, v.confianca)),
      justificativa: v.justificativa,
      ajustado_manualmente: false,
      ajustado_por: null as string | null,
      analisado_em: new Date().toISOString(),
    }));

    if (linhas.length > 0) {
      const { error } = await sb.from("chamado_pecas_analise").upsert(linhas, { onConflict: "peca_id" });
      if (error) return { ok: false, erro: error.message };
    }

    await sb.from("chamados").update({ faturamento_status: "em_conferencia" }).eq("id", data.chamadoId);

    // resumo considera TODOS os itens, inclusive os travados por ajuste manual
    const { data: final } = await sb
      .from("chamado_pecas_analise")
      .select("resultado, valor_calculado, peca_id")
      .eq("chamado_id", data.chamadoId);
    const linhasFinais = ((final as any[]) ?? []);
    const qtdPorPeca = new Map(pecas.map((p: any) => [p.id as string, Number(p.quantidade) || 1]));

    const resumo: ResumoAnalise = {
      total: linhasFinais.length,
      cobertos: linhasFinais.filter((l) => l.resultado === "coberto").length,
      faturaveis: linhasFinais.filter((l) => l.resultado === "faturavel").length,
      revisar: linhasFinais.filter((l) => l.resultado === "revisar" || l.resultado === "nao_identificado").length,
      valorFaturavel: arredondar(
        linhasFinais
          .filter((l) => l.resultado === "faturavel")
          .reduce((s, l) => s + Number(l.valor_calculado ?? 0) * (qtdPorPeca.get(l.peca_id) ?? 1), 0),
      ),
      usouIa,
      aviso,
    };
    // userId entra no log para rastrear quem disparou a análise
    console.info(`[cobranca] análise do chamado ${data.chamadoId} por ${userId}:`, resumo);
    return { ok: true, resumo };
  });
