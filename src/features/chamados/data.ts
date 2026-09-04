// Chamados — dados e mutações. Etapa U7 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §12 e docs/PRODUTO.md §9.
//
// Este arquivo substitui features/os/data.ts e features/demandas/data.ts:
// depois da fusão existe uma tabela só (`chamados`), com `natureza` decidindo
// se o registro é de campo (técnico se desloca, assina, gera cobrança) ou
// interno (o antigo quadro de demandas — sprint, equipe, apoio).
//
// As consultas usam `as any` porque src/integrations/supabase/types.ts está
// desatualizado desde a Etapa 1 do sistema de OS (ver PLANO_UNIFICACAO §12).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  ChamadoPrioridade,
  ChamadoStatus,
  ChamadoTipo,
  ImpactoOperacional,
  Natureza,
} from "@/lib/chamado-status";
import { EQUIPES, type Equipe } from "@/lib/equipes";

export interface Chamado {
  id: string;
  numero: string | null;
  /** Número que circulou antes da fusão (OS-… / DEM-…) — só para busca. */
  numero_legado: string | null;
  natureza: Natureza;
  /**
   * R139 (U96): a coluna continua existindo e continua sendo ESCRITA — é a
   * equipe do responsável, para quem ainda a lê (Operacional Técnica, RLS). Mas
   * ela não é mais escolhida por ninguém: a etiqueta da tela vem das pessoas.
   */
  equipe: Equipe;
  tipo: ChamadoTipo;
  status: ChamadoStatus;
  /** Só faz sentido no CAMPO (SLA, R112). No interno o que vale é o impacto. */
  prioridade: ChamadoPrioridade;
  /** R142 (U96) — interno, e só nos tipos que têm (corretiva, operacional). */
  impacto_operacional: ImpactoOperacional | null;
  /** R148 (U96) — a proposta comercial aprovada que origina a implantação. */
  proposta_id: string | null;

  titulo: string;
  descricao_problema: string | null;
  cliente_id: string | null;
  /** U31: nome do cliente como veio do Notion, quando não casou com o QAP */
  cliente_origem_nome?: string | null;
  cliente_sistema_id: string | null;
  visita_id: string | null;

  responsavel_id: string | null;
  prazo_limite: string | null;
  data_hora_agendada: string | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  concluida_em: string | null;

  diagnostico: string | null;
  servico_executado: string | null;
  pecas_texto: string | null;
  assinatura_nome: string | null;
  assinatura_url: string | null;

  aberto_por: string | null;
  fechado_por: string | null;
  fechada_em: string | null;
  motivo_cancelamento: string | null;

  origem: string;
  origem_id: string | null;
  /** Contrato congelado na abertura — decide cobertura na análise financeira. */
  contrato_id: string | null;
  numero_externo: string | null;
  tipo_servico: "instalacao" | "manutencao" | null;
  faturamento_status: string;
  created_at: string;
  updated_at: string | null;

  cliente?: { id: string; nome: string; endereco: string | null; telefone_sindico: string | null } | null;
  sistema?: { nome: string; tipo: string } | null;
}

/**
 * AS COLUNAS QUE NASCEM NA U96 — e a ordem de deploy (regra 5 do método).
 *
 * O push publica na hora; a migration o Davi roda depois, à mão. Pedir uma
 * coluna que ainda não existe é 42703 e a consulta INTEIRA volta vazia — a
 * tela de chamados ficaria em branco entre o push e a rodada da migration, por
 * dois campos que só pintam um seletor. Então toda leitura de `chamados` passa
 * por `comFallbackDaU96`: tenta com as colunas novas e, se o banco responder
 * 42703, repete sem elas. Depois da migration o primeiro SELECT passa e o
 * segundo caminho nunca mais roda. (O mesmo desenho que a U81 fez com `*` em
 * `chamado_apoios` — aqui com lista explícita, porque a Início não pode
 * carregar a descrição de 700 chamados só para ler um impacto.)
 */
export const COLUNAS_DA_U96 = "impacto_operacional, proposta_id";

export async function comFallbackDaU96<T>(
  consulta: (comU96: boolean) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>,
): Promise<T | null> {
  let r = await consulta(true);
  if (r.error && r.error.code === "42703") r = await consulta(false);
  if (r.error) throw r.error;
  return r.data;
}

const CAMPOS_BASE =
  "id, numero, numero_legado, natureza, equipe, tipo, status, prioridade, " +
  "titulo, descricao_problema, cliente_id, cliente_sistema_id, visita_id, " +
  "responsavel_id, prazo_limite, data_hora_agendada, iniciada_em, finalizada_em, concluida_em, " +
  "diagnostico, servico_executado, pecas_texto, assinatura_nome, assinatura_url, " +
  "aberto_por, fechado_por, fechada_em, motivo_cancelamento, " +
  "origem, origem_id, contrato_id, numero_externo, tipo_servico, faturamento_status, cliente_origem_nome, " +
  "created_at, updated_at";
const EMBEDS =
  // `!cliente_id`: desambigua o embed do cliente PRINCIPAL — ver o comentário
  // longo em features/home/data.ts. Sem a dica, o PostgREST vê dois caminhos
  // (a FK direta e o N:N por `chamado_clientes`, da U45) e devolve PGRST201.
  "cliente:clientes!cliente_id(id, nome, endereco, telefone_sindico), " +
  "sistema:cliente_sistemas(nome, tipo)";

/** A lista de colunas de um chamado, com ou sem as que nascem na U96. */
export function camposDeChamado(comU96: boolean): string {
  return CAMPOS_BASE + (comU96 ? ", " + COLUNAS_DA_U96 : "") + ", " + EMBEDS;
}

/** Lista completa — a RLS já limita o técnico aos chamados dele. */
export function useChamados() {
  return useQuery({
    queryKey: ["chamados"],
    queryFn: async (): Promise<Chamado[]> => {
      const data = await comFallbackDaU96<any[]>((u96) => supabase
        .from("chamados" as any)
        .select(camposDeChamado(u96))
        .order("created_at", { ascending: false }));
      return (data ?? []) as Chamado[];
    },
  });
}

/** Só os de campo ou só os internos — para as telas que ainda separam. */
export function useChamadosPorNatureza(natureza: Natureza) {
  return useQuery({
    queryKey: ["chamados", natureza],
    queryFn: async (): Promise<Chamado[]> => {
      const data = await comFallbackDaU96<any[]>((u96) => supabase
        .from("chamados" as any)
        .select(camposDeChamado(u96))
        .eq("natureza", natureza)
        .order("created_at", { ascending: false }));
      return (data ?? []) as Chamado[];
    },
  });
}

export function useChamado(id: string | undefined) {
  return useQuery({
    queryKey: ["chamado", id],
    enabled: !!id,
    queryFn: async (): Promise<Chamado | null> => {
      const data = await comFallbackDaU96<any>((u96) => supabase
        .from("chamados" as any)
        .select(camposDeChamado(u96))
        .eq("id", id as string)
        .maybeSingle());
      return (data as any) ?? null;
    },
  });
}

/**
 * Histórico do cliente — campo e interno na mesma lista, e AGORA COMPLETO
 * (R143, U96). Três caminhos levam uma atividade ao cliente:
 *
 *   1. ele é o local principal (`chamados.cliente_id`);
 *   2. ele é um local extra (`chamado_locais.cliente_id`, R84);
 *   3. a atividade é de um GRUPO a que ele pertence (`chamado_locais.setor`
 *      casa com `clientes.servicos_prestados`). Davi, 2026-09-03: "Sempre que
 *      o usuário selecionar um grupo de clientes […] o sistema contabiliza uma
 *      atividade para cada cliente daquele grupo […] deverá aparecer
 *      individualmente no relatório de atividades executadas em cada cliente."
 *
 * Até a U96 só o caminho 1 existia — um chamado onde o cliente era secundário,
 * ou de "Clientes de Portaria Remota", não aparecia na ficha dele. São duas
 * consultas porque o PostgREST não faz subquery; os ids do passo 2/3 entram no
 * `or` do passo 1. Um grupo com centenas de atividades gera uma URL longa —
 * ainda dentro do que o PostgREST aceita, e é melhor que uma lista mentindo.
 */
export function useChamadosDoCliente(clienteId: string | undefined, servicosPrestados?: string[] | null) {
  const setores = (servicosPrestados ?? []).filter(Boolean);
  return useQuery({
    queryKey: ["chamados-cliente", clienteId, setores.join(",")],
    enabled: !!clienteId,
    queryFn: async (): Promise<Chamado[]> => {
      const cid = clienteId as string;
      const filtroLocais = setores.length
        ? `cliente_id.eq.${cid},setor.in.(${setores.join(",")})`
        : `cliente_id.eq.${cid}`;
      const { data: locais } = await supabase
        .from("chamado_locais" as any)
        .select("chamado_id")
        .or(filtroLocais);
      const ids = Array.from(new Set(((locais as any[]) ?? []).map((r) => r.chamado_id as string)));
      const filtro = ids.length ? `cliente_id.eq.${cid},id.in.(${ids.join(",")})` : `cliente_id.eq.${cid}`;
      const data = await comFallbackDaU96<any[]>((u96) => supabase
        .from("chamados" as any)
        .select(camposDeChamado(u96))
        .or(filtro)
        .order("created_at", { ascending: false }));
      return (data ?? []) as Chamado[];
    },
  });
}

/**
 * As propostas comerciais JÁ ENVIADAS — para a implantação apontar a que a
 * originou (R148, U96). Davi: "Ao criar uma atividade e colocar o tipo de
 * demanda implantação, deverá ter um campo para inserir a proposta comercial
 * aprovada — futuramente […] o sistema cria automaticamente as atividades".
 * Por enquanto é o vínculo; a leitura da proposta pela IA vem depois.
 */
export interface PropostaEnviada {
  id: string;
  nome_predio: string | null;
  titulo: string | null;
  proposta_enviada_em: string;
  cliente_id: string | null;
  cliente_nome: string | null;
}

export function usePropostasEnviadas() {
  return useQuery({
    queryKey: ["propostas-enviadas"],
    staleTime: 60_000,
    queryFn: async (): Promise<PropostaEnviada[]> => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, nome_predio, titulo, proposta_enviada_em, cliente_id, clientes(nome)")
        .not("proposta_enviada_em", "is", null)
        .order("proposta_enviada_em", { ascending: false })
        .limit(300);
      if (error) throw error;
      return ((data as any[]) ?? []).map((v) => ({
        id: v.id, nome_predio: v.nome_predio ?? null, titulo: v.titulo ?? null,
        proposta_enviada_em: v.proposta_enviada_em, cliente_id: v.cliente_id ?? null,
        cliente_nome: v.clientes?.nome ?? null,
      }));
    },
  });
}

// ── Escrita ────────────────────────────────────────────────────────────────

export interface NovoChamadoInput {
  natureza: Natureza;
  titulo: string;
  /** Vazio = deixa o banco classificar (trigger chamado_preencher). */
  tipo?: ChamadoTipo | null;
  descricao_problema?: string | null;
  cliente_id?: string | null;
  cliente_sistema_id?: string | null;
  visita_id?: string | null;
  /**
   * R139: ninguém ESCOLHE a equipe. Quem chama passa a do responsável
   * (`equipeDaPessoa`), e sem responsável vale o default do banco. A coluna
   * continua NOT NULL e continua sendo lida pela Operacional Técnica.
   */
  equipe?: Equipe;
  prioridade?: ChamadoPrioridade;
  /** R142 — só interno, só corretiva/operacional. */
  impacto_operacional?: ImpactoOperacional | null;
  /** R148 — a proposta comercial aprovada, na implantação. */
  proposta_id?: string | null;
  responsavel_id?: string | null;
  // `data_hora_agendada` SAIU DAQUI (U79), e a ausência é a regra virando
  // compilador. Ela é ESPELHO derivado do bloco de agenda desde a R101: quem
  // marca hora de chamado de CAMPO é `agenda_campo_marcar`, e quem tira é
  // `desagendar_chamado`. Enquanto esta chave existiu, qualquer tela futura
  // reintroduzia a segunda verdade com UMA linha — e o religamento era
  // convenção. Fechada, ele é `tsc`.
  // (A agenda COMERCIAL não passa por aqui: ela é da visita técnica, escrita em
  // `visitas_tecnicas` e sincronizada pelo gatilho da U41.)
  // `sprint` SAIU DAQUI também (R141, U96): o sprint é cálculo sobre o prazo.
  /** Sobrescreve o prazo calculado pelo SLA (campo) ou a data combinada (interno). */
  prazo_limite?: string | null;
}

/**
 * Abre o chamado. Número, prazo pelo SLA e classificação sugerida ficam a
 * cargo do banco (trigger chamado_preencher). A policy de insert exige que
 * quem registra assine em aberto_por.
 *
 * O STATUS NASCE SEMPRE `aberto` (U79). Aqui havia uma derivação — "campo com
 * responsável e com data nasce agendado" — e ela SAIU junto com a escrita da
 * coluna: o §6.1 da U78 diz isso com todas as letras no passo 8, que é quem faz
 * `aberto → agendado` no destino de `agenda_campo_marcar` (e `agendado →
 * aberto` na origem que ficou sem bloco pendente). A derivação não sumiu, ela
 * MUDOU DE LADO — e agora existe num lugar só, o que é o ponto.
 */
export async function abrirChamado(input: NovoChamadoInput): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const status: ChamadoStatus = "aberto";
  const linha: Record<string, unknown> = {
    prioridade: "normal",
    equipe: input.natureza === "campo" ? "tecnica" : undefined,
    ...input,
    status,
    aberto_por: u.user?.id ?? null,
  };
  const inserir = () => supabase.from("chamados" as any).insert(linha as any).select("id").single();
  let r = await inserir();
  // regra 5 (ordem de deploy): sem a migration U96, as duas colunas novas não
  // existem e o INSERT inteiro cairia. O chamado nasce sem elas — e a tela
  // avisa quando alguém tentar gravá-las (ver atualizarChamado).
  if (r.error && r.error.code === "42703" && ("impacto_operacional" in linha || "proposta_id" in linha)) {
    delete linha.impacto_operacional;
    delete linha.proposta_id;
    r = await inserir();
  }
  if (r.error) throw r.error;
  return (r.data as any).id as string;
}

/** A equipe de uma pessoa, pelo cadastro — o que vai em `chamados.equipe` (R139). */
export function equipeDaPessoa(
  pessoas: readonly { id: string; equipe?: string | null }[] | undefined,
  pessoaId: string | null | undefined,
): Equipe | null {
  if (!pessoaId) return null;
  const e = pessoas?.find((p) => p.id === pessoaId)?.equipe ?? null;
  return e && (EQUIPES as string[]).includes(e) ? (e as Equipe) : null;
}

export type ChamadoPatch = Partial<
  Pick<
    Chamado,
    // A SEGUNDA PORTA DE TIPO FECHADA PELA U79: `data_hora_agendada` não é
    // mais escrevível por patch. Ela é ESPELHO (R101) — mantido por gatilho a
    // partir de `public.agenda_campo` — e as três telas que a escreviam direto
    // (programação, novo-campo, PainelChamado) passaram a falar com as quatro
    // portas da U78. Reabrir esta linha é reabrir as duas verdades.
    | "titulo" | "descricao_problema" | "prioridade" | "prazo_limite" | "status"
    | "responsavel_id" | "iniciada_em" | "finalizada_em"
    | "concluida_em" | "diagnostico" | "servico_executado" | "pecas_texto"
    | "assinatura_nome" | "assinatura_url" | "fechado_por" | "fechada_em"
    | "motivo_cancelamento" | "cliente_id" | "cliente_sistema_id"
    // `sprint` SAIU (R141): sprint é cálculo. `equipe` fica porque a coluna
    // acompanha o responsável (R139) — quem troca o responsável troca a equipe.
    | "equipe" | "tipo" | "impacto_operacional" | "proposta_id"
  >
>;

/**
 * Erro de gravação recusada pela RLS. Existe para a tela distinguir "o banco
 * disse não" de "a rede caiu" — as duas merecem mensagens diferentes.
 */
export class GravacaoRecusada extends Error {
  constructor(msg = "Você não tem permissão para alterar esta atividade.") {
    super(msg);
    this.name = "GravacaoRecusada";
  }
}

/**
 * Atualiza o chamado. O `.select("id")` NÃO é enfeite (U72).
 *
 * Quando a policy de UPDATE recusa pelo `USING`, o PostgREST **não devolve
 * erro**: a linha simplesmente não é encontrada, o UPDATE afeta zero linhas e
 * a resposta é 204 com `error === null`. Sem o `.select()`, todo chamador
 * concluía que tinha salvado — e no arrastar do quadro isso aparecia como o
 * pior sintoma possível: o card voltava para a coluna de origem depois do
 * refetch, sem erro, sem aviso, sem nada. "Arrastei e não aconteceu nada."
 *
 * Com o `.select("id")` a resposta traz as linhas afetadas, e lista vazia
 * passa a ser o que sempre foi: recusa.
 */
export async function atualizarChamado(id: string, patch: ChamadoPatch): Promise<void> {
  const { data, error } = await supabase
    .from("chamados" as any)
    .update(patch as any)
    .eq("id", id)
    .select("id");
  if (error) {
    // regra 5: a coluna da U96 ainda não existe no banco. A frase diz o que
    // fazer em vez do "column does not exist" do driver.
    if (error.code === "42703" && ("impacto_operacional" in patch || "proposta_id" in patch)) {
      throw new Error("Este campo ainda não existe no banco — a migration U96 precisa ser rodada.");
    }
    throw error;
  }
  if (!data || (data as any[]).length === 0) throw new GravacaoRecusada();
}

export async function excluirChamado(id: string): Promise<void> {
  const { error } = await supabase.from("chamados" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Começa a trabalhar — vale para os dois modos. */
export async function iniciarChamado(id: string): Promise<void> {
  await atualizarChamado(id, { status: "em_andamento", iniciada_em: new Date().toISOString() });
}

/**
 * Campo: o técnico encerra o atendimento e o chamado JÁ FICA CONCLUÍDO (U13 —
 * "executado e concluído é a mesma coisa"). Não existe mais um estado em que o
 * trabalho está feito e o registro está aberto.
 *
 * `finalizada_em` continua sendo o carimbo de quando o técnico entregou, que é
 * o que o motor de cobrança e os alertas leem; `concluida_em` é o do
 * encerramento. Aqui os dois coincidem, e é isso mesmo.
 */
export async function executarChamado(
  id: string,
  dados: { diagnostico: string; servico_executado: string; pecas_texto?: string | null },
): Promise<void> {
  const agora = new Date().toISOString();
  await atualizarChamado(id, {
    ...dados,
    status: "concluido",
    finalizada_em: agora,
    concluida_em: agora,
    fechada_em: agora,
  });
}

/** Conferência do gestor (campo) ou conclusão direta (interno). */
export async function concluirChamado(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const agora = new Date().toISOString();
  await atualizarChamado(id, {
    status: "concluido",
    concluida_em: agora,
    fechada_em: agora,
    fechado_por: u.user?.id ?? null,
  });
}

/** Volta um chamado concluído/executado para atendimento. */
export async function reabrirChamado(id: string): Promise<void> {
  await atualizarChamado(id, {
    status: "em_andamento",
    concluida_em: null,
    fechada_em: null,
    fechado_por: null,
  });
}

export async function cancelarChamado(id: string, motivo: string): Promise<void> {
  await atualizarChamado(id, { status: "cancelado", motivo_cancelamento: motivo });
}

// ── Feed / linha do tempo ───────────────────────────────────────────────────

export interface ChamadoEvento {
  id: string;
  chamado_id: string;
  tipo: string;
  descricao: string | null;
  user_id: string | null;
  created_at: string;
}

export function useChamadoEventos(chamadoId: string | undefined, ordem: "asc" | "desc" = "desc") {
  return useQuery({
    queryKey: ["chamado-eventos", chamadoId, ordem],
    enabled: !!chamadoId,
    queryFn: async (): Promise<ChamadoEvento[]> => {
      const { data, error } = await supabase
        .from("chamado_eventos" as any)
        .select("id, chamado_id, tipo, descricao, user_id, created_at")
        .eq("chamado_id", chamadoId as string)
        .order("created_at", { ascending: ordem === "asc" });
      if (error) throw error;
      return ((data as any[]) ?? []) as ChamadoEvento[];
    },
  });
}

/**
 * Comentário do feed. A policy só aceita tipo 'comentario' com user_id do
 * próprio autor — os outros eventos da linha do tempo nascem de trigger.
 */
export async function comentarChamado(chamadoId: string, texto: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("chamado_eventos" as any).insert({
    chamado_id: chamadoId,
    tipo: "comentario",
    descricao: texto,
    user_id: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

/**
 * Apagar um comentário — só o AUTOR (R135, U95). A policy
 * `chamado_eventos_delete_autor` é quem decide: `tipo = 'comentario' AND
 * user_id = auth.uid()`. Sem a migration U95 rodada, o DELETE não apaga linha
 * nenhuma — e isto vira erro na tela em vez de um "apaguei" falso, porque zero
 * linhas afetadas NÃO é sucesso.
 */
export async function excluirComentario(eventoId: string): Promise<void> {
  const { data, error } = await supabase
    .from("chamado_eventos" as any)
    .delete()
    .eq("id", eventoId)
    .eq("tipo", "comentario")
    .select("id");
  if (error) throw error;
  if (!data || (data as any[]).length === 0) {
    throw new Error("Só quem escreveu o comentário pode apagá-lo.");
  }
}

// ── Apoio ───────────────────────────────────────────────────────────────────

/**
 * Uma linha de apoio, e não só o id da pessoa (U81).
 *
 * `congelado_em` é o que separa REGISTRO de ATRIBUIÇÃO DE HOJE: preenchida quer
 * dizer que alguém carimbou "feito" no bloco daquela semana e o automatismo da
 * escala soltou a linha para sempre. Quem interpreta é `especieDoApoio` /
 * `idasDoApoio` em `features/programacao/modelo.ts` — aqui só se transporta.
 *
 * `origem` vem junto porque é o que `apoioValeComoVinculo` lê, e ter os dois na
 * mesma linha evita a segunda consulta no dia em que a tela precisar do par.
 */
export interface LinhaDeApoio {
  profile_id: string;
  origem: string | null;
  congelado_em: string | null;
}

export function useChamadoApoios(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-apoios", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<LinhaDeApoio[]> => {
      // `*` E NÃO A LISTA DE COLUNAS, DE PROPÓSITO. `congelado_em` nasce na U81
      // e migration neste repo é rodada À MÃO pelo Davi, DEPOIS do push — que
      // publica na hora. Nomear a coluna aqui faria o PostgREST devolver 42703
      // até ela existir, e o `throw` abaixo apagaria a lista de apoio de TODO
      // chamado, além de derrubar a perna de apoio do `podeEditar` em
      // DetalheInterno. Por uma coluna que só pinta uma borda. Vale igual no
      // sentido inverso: o DESFAZER da U81 derruba a coluna com o app publicado
      // ainda pedindo-a. Com `*` vem o que existir, e o `?? null` do mapa lê a
      // ausência como "atual" — que é exatamente o que o banco sabe responder
      // enquanto a U81 não rodou. A S3 manteve o SELECT de TABELA justamente
      // para que `*` continuasse sendo caminho suportado.
      const { data, error } = await supabase
        .from("chamado_apoios" as any)
        .select("*")
        .eq("chamado_id", chamadoId as string);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({
        profile_id: r.profile_id as string,
        origem: (r.origem ?? null) as string | null,
        congelado_em: (r.congelado_em ?? null) as string | null,
      }));
    },
  });
}

export async function adicionarApoio(chamadoId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("chamado_apoios" as any)
    .insert({ chamado_id: chamadoId, profile_id: profileId } as any);
  if (error) throw error;
}

export async function removerApoio(chamadoId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("chamado_apoios" as any)
    .delete()
    .eq("chamado_id", chamadoId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

// ── Locais da atividade (R54 → R84/R85, U45 → U71) ──────────────────────────
//
// Davi, 2026-08-26: "A etiqueta de cliente na verdade seria uma etiqueta de
// LOCAL, este tempo todo estávamos usando a palavra errada. Então o Local pode
// SER OU NÃO SER nosso cliente."
//
// `chamado_locais` substituiu `chamado_clientes` na U71. Cada linha é uma das
// três formas, e só uma (o banco garante com num_nonnulls = 1):
//
//   cliente_id     → cliente da base do QAP
//   prospeccao_id  → prédio que NÃO é nosso cliente (R22)
//   setor          → um serviço inteiro, como ETIQUETA
//
// O setor é etiqueta e não expansão: "Enviar relatórios dos clientes de
// Portaria Remota" é UMA atividade com UM rótulo, não uma atividade com
// oitenta chips. Quem precisar da lista expande na leitura, por
// `clientes.servicos_prestados` — e aí ela reflete o cadastro de HOJE, em vez
// de congelar quem era do setor no dia em que alguém clicou.
//
// `chamados.cliente_id` continua sendo o local PRINCIPAL quando ele é cliente:
// cobrança, matching e relatório seguem lendo só ele, sem saber que isto
// existe. A lista canônica é sempre `[cliente_id, ...locais]`.

export type FormaLocal = "cliente" | "prospeccao" | "setor";

export interface LocalDoChamado {
  id: string;
  cliente_id: string | null;
  prospeccao_id: string | null;
  setor: string | null;
}

export function useChamadoLocais(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-locais", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<LocalDoChamado[]> => {
      const { data, error } = await supabase
        .from("chamado_locais" as any)
        .select("id, cliente_id, prospeccao_id, setor")
        .eq("chamado_id", chamadoId as string);
      if (error) throw error;
      return (data as any[] as LocalDoChamado[]) ?? [];
    },
  });
}

/**
 * Adiciona um CLIENTE como local. Se o slot principal (`cliente_id`) está
 * livre, ele vira o principal — é uma gravação a menos, e mantém quem só lê
 * `cliente_id` funcionando sem precisar saber que a lista existe.
 */
export async function adicionarClienteChamado(
  chamadoId: string, clienteIdAtual: string | null, clienteId: string,
): Promise<void> {
  if (!clienteIdAtual) {
    await atualizarChamado(chamadoId, { cliente_id: clienteId });
    return;
  }
  const { error } = await supabase
    .from("chamado_locais" as any)
    .insert({ chamado_id: chamadoId, cliente_id: clienteId } as any);
  if (error) throw error;
}

/**
 * Remove um cliente. Remover o PRINCIPAL só limpa o slot (não promove um
 * extra — ver o cabeçalho da U45: ficar com extras e sem principal é estado
 * válido, e a promoção automática seria uma decisão silenciosa sobre QUAL
 * extra vira principal, que ninguém pediu).
 */
export async function removerClienteChamado(
  chamadoId: string, clienteIdAtual: string | null, clienteId: string,
): Promise<void> {
  if (clienteId === clienteIdAtual) {
    await atualizarChamado(chamadoId, { cliente_id: null });
    return;
  }
  const { error } = await supabase
    .from("chamado_locais" as any)
    .delete()
    .eq("chamado_id", chamadoId)
    .eq("cliente_id", clienteId);
  if (error) throw error;
}

/** Pendura uma PROSPECÇÃO (local que não é cliente) na atividade. */
export async function adicionarProspeccaoChamado(
  chamadoId: string, prospeccaoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("chamado_locais" as any)
    .insert({ chamado_id: chamadoId, prospeccao_id: prospeccaoId } as any);
  if (error) throw error;
}

/** O atalho do setor inteiro (R85). Uma linha, uma etiqueta. */
export async function adicionarSetorChamado(
  chamadoId: string, setor: string,
): Promise<void> {
  const { error } = await supabase
    .from("chamado_locais" as any)
    .insert({ chamado_id: chamadoId, setor } as any);
  if (error) throw error;
}

export async function removerLocalChamado(localId: string): Promise<void> {
  const { error } = await supabase
    .from("chamado_locais" as any)
    .delete()
    .eq("id", localId);
  if (error) throw error;
}

// ── Equipes da atividade (R83, U71) ─────────────────────────────────────────
//
// Davi: "Vamos considerar que mais de uma equipe pode fazer parte da mesma
// atividade." Mesmo desenho aditivo dos locais: `chamados.equipe` continua
// sendo a PRINCIPAL e não muda de semântica; `chamado_equipes` guarda só as
// extras. Atividade de uma equipe só não ganha linha nenhuma aqui.

export function useChamadoEquipesExtra(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-equipes-extra", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("chamado_equipes" as any)
        .select("equipe")
        .eq("chamado_id", chamadoId as string);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => r.equipe as string);
    },
  });
}

export async function adicionarEquipeChamado(
  chamadoId: string, equipePrincipal: string | null, equipe: string,
): Promise<void> {
  if (equipe === equipePrincipal) return;
  const { error } = await supabase
    .from("chamado_equipes" as any)
    .insert({ chamado_id: chamadoId, equipe } as any);
  if (error) throw error;
}

export async function removerEquipeChamado(
  chamadoId: string, equipe: string,
): Promise<void> {
  const { error } = await supabase
    .from("chamado_equipes" as any)
    .delete()
    .eq("chamado_id", chamadoId)
    .eq("equipe", equipe);
  if (error) throw error;
}

// ── Equipamentos envolvidos ─────────────────────────────────────────────────

export interface ChamadoEquipamento {
  id: string;
  chamado_id: string;
  cliente_equipamento_id: string | null;
  equipamento_id: string | null;
  descricao: string | null;
  numero_serie: string | null;
  tag_patrimonio: string | null;
  quantidade: number;
  observacao: string | null;
}

export function useChamadoEquipamentos(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-equipamentos", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<ChamadoEquipamento[]> => {
      const { data, error } = await supabase
        .from("chamado_equipamentos" as any)
        .select(
          "id, chamado_id, cliente_equipamento_id, equipamento_id, descricao, numero_serie, " +
            "tag_patrimonio, quantidade, observacao",
        )
        .eq("chamado_id", chamadoId as string)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) ?? []) as ChamadoEquipamento[];
    },
  });
}

export async function adicionarEquipamentoChamado(
  chamadoId: string,
  item: Partial<Omit<ChamadoEquipamento, "id" | "chamado_id">>,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("chamado_equipamentos" as any).insert({
    chamado_id: chamadoId,
    ...item,
    created_by: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export async function removerEquipamentoChamado(id: string): Promise<void> {
  const { error } = await supabase.from("chamado_equipamentos" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Fotos e assinatura (chamado de campo) ──────────────────────────────────

export interface ChamadoFoto {
  id: string;
  etapa: "antes" | "depois" | "outra";
  url: string;
  storage_path: string | null;
  legenda: string | null;
  created_at: string;
}

export function useChamadoFotos(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-fotos", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<(ChamadoFoto & { signedUrl: string | null })[]> => {
      const { data, error } = await supabase
        .from("chamado_fotos" as any)
        .select("id, etapa, url, storage_path, legenda, created_at")
        .eq("chamado_id", chamadoId as string)
        .order("created_at");
      if (error) throw error;
      const fotos = ((data as any[]) ?? []) as ChamadoFoto[];
      // bucket é privado: precisa de URL assinada para exibir
      return Promise.all(
        fotos.map(async (f) => {
          if (!f.storage_path) return { ...f, signedUrl: f.url };
          const { data: s } = await supabase.storage.from("fotos-os").createSignedUrl(f.storage_path, 3600);
          return { ...f, signedUrl: s?.signedUrl ?? null };
        }),
      );
    },
  });
}

async function subirArquivo(chamadoId: string, arquivo: Blob, nome: string): Promise<string> {
  const path = `${chamadoId}/${Date.now()}-${nome}`;
  const { error } = await supabase.storage.from("fotos-os").upload(path, arquivo, { upsert: false });
  if (error) throw error;
  return path;
}

export async function anexarFoto(
  chamadoId: string,
  arquivo: File,
  etapa: "antes" | "depois" | "outra",
  legenda?: string | null,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const ext = arquivo.name.split(".").pop() || "jpg";
  const path = await subirArquivo(chamadoId, arquivo, `${etapa}.${ext}`);
  const { error } = await supabase.from("chamado_fotos" as any).insert({
    chamado_id: chamadoId,
    etapa,
    url: path,          // bucket privado: a URL de exibição é assinada na leitura
    storage_path: path,
    legenda: legenda ?? null,
    created_by: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export async function excluirFoto(id: string, storagePath: string | null): Promise<void> {
  if (storagePath) {
    await supabase.storage.from("fotos-os").remove([storagePath]);
  }
  const { error } = await supabase.from("chamado_fotos" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Salva a assinatura (dataURL do canvas) e guarda o caminho no storage. */
export async function salvarAssinatura(chamadoId: string, dataUrl: string, nome: string): Promise<void> {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const path = await subirArquivo(chamadoId, blob, "assinatura.png");
  await atualizarChamado(chamadoId, { assinatura_url: path, assinatura_nome: nome });
}

/** URL assinada da imagem da assinatura, para exibir/imprimir. */
export function useAssinaturaUrl(storagePath: string | null | undefined) {
  return useQuery({
    queryKey: ["chamado-assinatura", storagePath],
    enabled: !!storagePath,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.storage
        .from("fotos-os")
        .createSignedUrl(storagePath as string, 3600);
      return data?.signedUrl ?? null;
    },
  });
}

/** Prazos de SLA por prioridade (tabela de configuração). */
export function useSla() {
  return useQuery({
    queryKey: ["chamado-sla"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number | null>> => {
      const { data, error } = await supabase.from("chamado_sla" as any).select("prioridade, horas_prazo");
      if (error) throw error;
      const mapa: Record<string, number | null> = {};
      for (const r of ((data as any[]) ?? [])) mapa[r.prioridade as string] = r.horas_prazo ?? null;
      return mapa;
    },
  });
}

// ── Pessoas (responsável, apoio) ────────────────────────────────────────────

export interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  equipe: string | null;
  avatar_url: string | null;
}

/**
 * Todos os perfis ativos — responsável e apoio saem daqui. Não dá para usar
 * join do PostgREST: responsavel_id aponta para auth.users, não para profiles.
 */
export function usePessoas() {
  return useQuery({
    queryKey: ["pessoas-ativas"],
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, cargo, equipe, avatar_url")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return ((data as any[]) ?? []) as Pessoa[];
    },
    staleTime: 60_000,
  });
}

export function mapaDePessoas(pessoas: Pessoa[] | undefined): Record<string, Pessoa> {
  const m: Record<string, Pessoa> = {};
  for (const p of pessoas ?? []) m[p.id] = p;
  return m;
}

// ── Realtime ────────────────────────────────────────────────────────────────

/**
 * O ÚNICO canal de realtime de chamados do app. Antes desta versão ele existia
 * e não era usado por ninguém: /chamados tinha escrito um canal inline próprio,
 * e a Home estava prestes a abrir um terceiro na mesma tabela.
 *
 * Dois cuidados que não são opcionais:
 *
 * 1. DEBOUNCE. A policy `chamados_select` entrega TODO chamado com
 *    natureza='interno' a qualquer autenticado — são os 537 vindos do Notion
 *    mais o fluxo diário de todas as equipes. Sem agrupar, o técnico em campo
 *    refaz as consultas a cada edição de qualquer demanda da empresa.
 *
 * 2. SÓ `public.chamados` está na publicação do realtime (desde a U7). Uma
 *    inscrição em tabela fora da publicação não dá erro — ela conecta, fica
 *    viva e nunca dispara, que é pior do que não existir. (Até a U96 este
 *    comentário explicava por que `chamado_compra` não entrava aqui; a compra
 *    saiu do sistema — R140.)
 */
export function useChamadosRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const invalidar = () => {
      if (pendente) clearTimeout(pendente);
      pendente = setTimeout(() => {
        for (const k of [["chamados"], ["home-chamados"]]) {
          qc.invalidateQueries({ queryKey: k });
        }
      }, 1200);
    };
    const canal = supabase
      .channel("chamados-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, invalidar)
      .subscribe();
    return () => {
      if (pendente) clearTimeout(pendente);
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}
