// Criação rápida de chamado por IA — Etapa U20, ampliada na U71 (R80–R86).
//
// O usuário escreve um resumo em linguagem corrente ("portão do Green Village
// travando de novo, urgente, mandar o Erik com apoio do Nicholas") e o modelo
// devolve os campos que o formulário pediria — mais as MENÇÕES a pessoas,
// locais e setores que o texto trouxer.
//
// A função INTERPRETA, não cria. Quem cria é o cliente, com o abrirChamado()
// de sempre — assim a criação rápida passa pelos mesmos triggers (número,
// SLA, sprint, classificação) e pelas mesmas policies do caminho normal, e
// não existe um segundo caminho de escrita para manter.
//
// ── A divisão de trabalho com o `triagem.ts` ────────────────────────────────
// O modelo devolve MENÇÃO ("Nicholas", "Green Village"), nunca id. Quem
// transforma menção em vínculo é `features/chamados/triagem.ts`, que é código
// puro e testado pelo verificador. A razão é que as duas coisas erram de
// jeitos diferentes: o modelo é bom em ler "vai dar uma força" como apoio e
// péssimo em garantir que existe UM Nicholas com conta no app. Deixar o
// casamento de identidade com o modelo seria pendurar trabalho na pessoa
// errada com cara de acerto.
//
// ── Modelo ──────────────────────────────────────────────────────────────────
// Era claude-sonnet-5, escolhido quando a tarefa era só classificar um
// parágrafo em seis campos fechados. A U71 acrescentou extração de entidades e
// atribuição de PAPEL (quem é responsável × quem é apoio), que é justamente
// onde um modelo sem raciocínio troca os dois. Passou para claude-opus-5 com
// `effort: "low"` e o raciocínio adaptativo que ele já traz ligado — alinhando
// com os outros três server functions de IA do repo, que sempre foram Opus.

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tiposDaNatureza, type ChamadoTipo } from "@/lib/chamado-status";

// ── OS TIPOS QUE A IA PODE DEVOLVER (U83) ───────────────────────────────────
//
// Era uma lista escrita à mão, DUAS vezes: no union de `ChamadoInterpretado` e
// no `enum` do SCHEMA — a quarta cópia do domínio de tipos, e a única cujo
// resultado é GRAVADO sem uma pessoa conferir. Agora deriva de
// `tiposDaNatureza`, que é a lista de OFERTA: o que a IA pode devolver é, por
// definição, o que um humano poderia escolher no formulário.
//
// A união das duas naturezas na ordem campo→interno reproduz exatamente a
// lista que estava aqui à mão (corretiva, preventiva, operacional,
// implantacao, melhoria) — a `Set` só tira as repetidas.
const TIPOS_IA: ChamadoTipo[] = Array.from(new Set([
  ...tiposDaNatureza("campo"),
  ...tiposDaNatureza("interno"),
]));

// A prosa que o prompt usa para CADA tipo. `Record<ChamadoTipo, string>`: o
// compilador exige uma linha por tipo do union, então um tipo novo não pode
// entrar no vocabulário sem que alguém diga à IA como reconhecê-lo.
//
// AS LINHAS SÃO FILTRADAS PELA MESMA `TIPOS_IA`, e é isso que faz o commit B
// ser UMA LINHA: enquanto 'vistoria' estiver em `NAO_OFERECIDOS`
// (chamado-status.ts), nem o enum nem a descrição dela chegam ao modelo.
// Apagar aquela linha liga as duas coisas juntas, sem caçada.
const TIPO_IA_DESCRICAO: Record<ChamadoTipo, string> = {
  corretiva: "algo quebrou/parou/está travando e precisa de conserto.",
  preventiva: "revisão/manutenção programada, sem defeito relatado.",
  operacional: `rotina que não é conserto nem melhoria (entrega de controle,
  conferência, cadastro, comprar/cotar material ou equipamento).`,
  implantacao: "instalação de sistema novo ou ampliação.",
  melhoria: "melhorar algo que já funciona (processo, material, software).",
  // R112 — a descrição existe para a IA não CHUTAR entre vistoria, corretiva e
  // preventiva, que é o risco real: as três mandam alguém ao prédio. O corte é
  // pelo que a pessoa VAI FAZER lá, não pelo motivo de ir.
  vistoria: `ir ao cliente só para OLHAR e levantar — medir, conferir uma
  instalação de terceiro, avaliar o que vai ser preciso, laudo. Ninguém
  conserta nem instala nada nessa ida; se sair serviço, ele vira outro chamado.
  Se há defeito relatado esperando conserto, é corretiva, não vistoria. Se é
  roteiro de manutenção programada de um sistema que já é nosso, é preventiva.`,
  // Nunca chegam ao modelo (não estão em TIPOS_IA); as linhas existem porque o
  // Record é exaustivo, e dizem por que não estão lá.
  prospeccao: "(não oferecido) visita comercial de proposta — quem cuida dela é o fluxo comercial.",
  pedido_compra: "(não oferecido, R48) aposentado — compra e cotação são operacional.",
};

const LINHAS_DE_TIPO = TIPOS_IA.map((t) => `- ${t}: ${TIPO_IA_DESCRICAO[t]}`).join("\n");

const inputSchema = z.object({
  texto: z.string().min(8, "Descreva o chamado em pelo menos uma frase.").max(4000),
});

export interface ChamadoInterpretado {
  natureza: "campo" | "interno";
  /**
   * Um dos `TIPOS_IA` — a união das listas de OFERTA de campo e interno.
   * Era um union literal copiado à mão (R48/U41 tinha tirado "pedido_compra"
   * dele); virou `ChamadoTipo` na U83 porque manter a cópia estreita aqui
   * significava editar dois arquivos a cada tipo novo, e o compilador não
   * reclamava de nenhum dos dois.
   */
  tipo: ChamadoTipo;
  /** R86: descreve O QUE FAZER. O local NÃO entra aqui — vai na etiqueta. */
  titulo: string;
  descricao: string;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  /** A equipe do ASSUNTO (R82). As equipes das pessoas se somam no triagem.ts. */
  equipe: "ti" | "patrimonio" | "tecnica" | "comercial" | "sac" | "monitoramento" | "outras";
  /** Quem VAI FAZER — nome como aparece no texto, geralmente só o primeiro. */
  responsavel_citado: string | null;
  /** Quem vai AJUDAR quem faz (R80). */
  apoios_citados: string[];
  /** Condomínios, prédios, empresas, endereços citados (R84). */
  locais_citados: string[];
  /** Quando o texto fala do setor inteiro em vez de um prédio (R85). */
  setores_citados: Array<"portaria_remota" | "monitoramento_alarmes">;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "natureza", "tipo", "titulo", "descricao", "prioridade", "equipe",
    "responsavel_citado", "apoios_citados", "locais_citados", "setores_citados",
  ],
  properties: {
    natureza: { type: "string", enum: ["campo", "interno"] },
    tipo: { type: "string", enum: TIPOS_IA },
    titulo: { type: "string" },
    descricao: { type: "string" },
    prioridade: { type: "string", enum: ["baixa", "normal", "alta", "urgente"] },
    equipe: {
      type: "string",
      enum: ["ti", "patrimonio", "tecnica", "comercial", "sac", "monitoramento", "outras"],
    },
    responsavel_citado: { type: ["string", "null"] },
    apoios_citados: { type: "array", items: { type: "string" } },
    locais_citados: { type: "array", items: { type: "string" } },
    setores_citados: {
      type: "array",
      items: { type: "string", enum: ["portaria_remota", "monitoramento_alarmes"] },
    },
  },
} as const;

// ── Por que NÃO há limite nenhum no schema acima ────────────────────────────
//
// Os structured outputs não aceitam restrição de tamanho: nem `maxItems` em
// array, nem `maxLength` em string, nem `minimum`/`maximum` em número. E a
// recusa NÃO é silenciosa — a chamada inteira volta 400 e a triagem falha na
// cara de quem estava abrindo o chamado:
//
//   "Falha ao interpretar: 400 ... For 'array' type, property 'maxItems' is
//    not supported"  (Davi, 2026-08-26)
//
// O `maxLength` de `titulo`/`descricao` estava aqui desde a U20 e nunca deu
// erro — o que só diz que a validação da API mudou ou é parcial, não que ele
// seja seguro. Saiu junto: depender de uma palavra que a documentação lista
// como não suportada é esperar o próximo 400 em produção.
//
// Os SDKs de Python e TypeScript removem essas palavras sozinhos quando o
// schema passa por `zodOutputFormat`/`.parse()`. Este código monta o schema à
// mão e faz `as any` na request, então nada é removido por ninguém — o corte
// é aqui embaixo, na volta.
const TETO_APOIOS = 8;
const TETO_LOCAIS = 20;
const TETO_TITULO = 120;
const TETO_DESCRICAO = 2000;

const cortar = (t: string | undefined, teto: number) => (t ?? "").slice(0, teto);

const SISTEMA = `Você faz a triagem de chamados do Grupo Prever (segurança
predial: CFTV, controle de acesso, alarmes, portaria remota, interfonia).

Decida os campos do chamado a partir do resumo escrito pelo atendente.

NATUREZA:
- "campo": uma dupla técnica se DESLOCA até um condomínio/cliente — conserto,
  preventiva, entrega, instalação. Menção a ir/mandar alguém a um lugar = campo.
- "interno": trabalho de mesa — T.I., compras, marketing, melhoria de processo,
  tarefa administrativa. Sem deslocamento = interno.

TIPO:
${LINHAS_DE_TIPO}

PRIORIDADE (só faz diferença no campo):
- urgente: risco, cliente sem segurança, palavra "urgente"/"agora"/"parado".
- alta: incomoda muito ou tem data apertada.
- normal: o padrão quando nada indica pressa.
- baixa: explicitamente sem pressa.

EQUIPE — a equipe do ASSUNTO, uma só. Outras equipes podem ser acrescentadas
depois pelo sistema, a partir de quem participa; não é problema seu.
- comercial: proposta comercial, orçamento, cliente novo, e TAMBÉM tudo que é
  criação de material visual e comunicação — arte, folder, vídeo, apresentação,
  impresso, post, campanha, identidade visual.
- ti: sistemas, software, rede, acessos, câmeras off-line, integração.
- patrimonio: compras, estoque, equipamentos, patrimônio.
- tecnica: trabalho técnico de campo.
- sac: atendimento ao cliente.
- monitoramento: central, portaria remota, monitoramento de alarmes.
- outras: administrativo, RH, financeiro, jurídico, processo interno — e
  qualquer coisa que não caiba nas de cima. Não force uma equipe nomeada.

PESSOAS — o time se trata pelo PRIMEIRO NOME. Devolva o nome como está escrito;
não invente sobrenome e não corrija grafia.
- responsavel_citado: quem VAI FAZER o trabalho. "mandar o Erik", "o Davi
  resolve", "passa pra Gilleno". Se ninguém for indicado, null.
- apoios_citados: quem vai AJUDAR quem faz. Qualquer coisa que remeta a ajudar
  o outro conta: "com ajuda do Nicholas", "com apoio do Nicholas", "o Nicholas
  vai dar uma força", "junto com o Breno", "o Erik acompanha", "e o Nicholas
  ajuda". Lista vazia se não houver.
- Na dúvida entre responsável e apoio: quem é o sujeito da ação é responsável;
  quem aparece numa expressão de ajuda é apoio. A mesma pessoa nunca vai nos
  dois.

LOCAIS — o lugar onde a atividade acontece. Pode ser mais de um, e pode não ter
nenhum.
- locais_citados: nome de condomínio, prédio, empresa ou residência, como
  aparece no texto ("Green Village", "Residência Alcino Braga"). Não invente e
  não complete o nome. Atividade puramente interna costuma não ter local.
- setores_citados: use quando o texto falar do CONJUNTO de clientes de um
  serviço, e não de um prédio específico — "os clientes de portaria remota",
  "todo mundo do monitoramento". Valores: portaria_remota,
  monitoramento_alarmes. Isso NÃO substitui locais_citados quando um prédio
  também é nomeado; os dois podem vir juntos.

TÍTULO: uma breve descrição DO QUE DEVE SER FEITO, curta e específica, como um
humano escreveria na lista. O LOCAL NÃO ENTRA NO TÍTULO — ele tem etiqueta
própria. Escreva "Portão social travando", não "Portão social travando — Green
Village". Não repita a descrição.

DESCRIÇÃO: o resumo reescrito limpo, completo, sem inventar fatos.

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
        model: "claude-opus-5",
        max_tokens: 2000,
        output_config: {
          // triagem de um parágrafo não precisa de esforço alto; o que ela
          // precisa é do raciocínio existir, para não trocar responsável por
          // apoio. O Opus 5 já vem com raciocínio adaptativo ligado, então
          // `thinking` não é passado de propósito.
          effort: "low",
          format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
        },
        // O prompt é idêntico entre chamadas, então vale marcar para cache. O
        // ganho só existe se ele cruzar o mínimo cacheável (~1024 tokens) — a
        // marcação abaixo do mínimo é ignorada em silêncio. Quem quiser saber
        // se está pegando: olhe `usage.cache_read_input_tokens` na resposta.
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: data.texto }],
      } as any);

      if ((response as any).stop_reason === "refusal") {
        return { ok: false, erro: "Interpretação recusada pelo modelo" };
      }
      const bloco = (response as any).content?.find((b: any) => b.type === "text");
      if (!bloco?.text) return { ok: false, erro: "Resposta sem conteúdo" };

      const bruto = JSON.parse(bloco.text) as Partial<ChamadoInterpretado>;

      // As listas são obrigatórias no schema, mas o consumidor faz `.map()`
      // direto nelas — um `undefined` que escape derruba a Início inteira. O
      // corte de tamanho também mora aqui, porque o schema não pode declarar
      // `maxItems` (ver o comentário no SCHEMA).
      return {
        ok: true,
        chamado: {
          ...(bruto as ChamadoInterpretado),
          titulo: cortar(bruto.titulo, TETO_TITULO),
          descricao: cortar(bruto.descricao, TETO_DESCRICAO),
          apoios_citados: (bruto.apoios_citados ?? []).slice(0, TETO_APOIOS),
          locais_citados: (bruto.locais_citados ?? []).slice(0, TETO_LOCAIS),
          // dois setores é o vocabulário inteiro; o corte é só contra repetição
          setores_citados: Array.from(new Set(bruto.setores_citados ?? [])),
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, erro: `Falha ao interpretar: ${msg}` };
    }
  });
