// Programação da equipe de campo (R99/R100/R101/R102 — U79) — a camada de
// dados: o que se lê, o que se escreve, e o que se invalida depois.
//
// A LÓGICA PURA MORA EM ./modelo.ts E NÃO SE REPETE AQUI. Este arquivo não
// classifica chamado, não soma jornada, não decide conflito e não escolhe
// frase de erro: ele busca linhas, monta o corpo da RPC e invalida cache.
//
// ── AS QUATRO PORTAS SÓ EXISTEM DEPOIS DA U79 ──────────────────────────────
// `PORTAS_DA_AGENDA` (modelo puro) lista as quatro RPCs de escrita. Até a U78
// elas eram concedidas SÓ a `service_role`, e todo `supabase.rpc(...)` daqui
// voltaria 42501 — de propósito, porque não havia tela. A migration
// `20260902090000_u79_a_tela_da_grade.sql` é quem as abre a `authenticated`, e
// é por isso que ESTE arquivo não podia nascer antes dela.
//
// ── A FRASE VEM PRONTA DO BANCO, E ESTA CAMADA NÃO A REESCREVE ─────────────
// As RPCs do §6 da U78 devolvem a mensagem em PORTUGUÊS, palavra por palavra
// igual à do modelo puro (é o argumento inteiro do §6.0), mais o SQLSTATE em
// `error.code` — 42501 permissão, 55000 regra, 23P01 conflito. Um `onError`
// que trocasse `e.message` por um texto genérico apagaria a única coisa que o
// usuário podia usar. Por isso as mutações rejeitam com o erro CRU, e quem
// escolhe o rosto é a tela, por `classeDoErro(error.code)`.
//
// `as any` nas consultas pela mesma razão do resto do app: o
// src/integrations/supabase/types.ts está desatualizado (baseline do tsc).

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dataIso, inicioSemana } from "@/lib/periodos";
import {
  apoioValeComoVinculo,
  chamadosTocadosPeloGesto,
  dataDoDia,
  montarAutorizacao,
  patchImpossivel,
  type AutorizacaoDaAgenda,
  type BlocoDeAgenda,
  type BlocoEditavel,
  type ChamadoParaAutorizacao,
} from "./modelo";

/**
 * As onze colunas de `BlocoDeAgenda`, em snake_case. Escritas à mão e não `*`
 * pelo mesmo motivo de `duplas/data.ts`: nomear as colunas é o que faz uma
 * coluna nova só chegar ao cliente quando alguém decide.
 *
 * Este é o contrato do modelo puro (`BlocoDeAgenda`, modelo.ts:147) — e é por
 * isso que ele é snake_case dos dois lados: quem lê do Supabase entrega a linha
 * e pronto, sem camada de tradução para divergir.
 */
export const CAMPOS_BLOCO =
  "id, chamado_id, dupla_id, dia, inicio_min, servico_min, deslocamento_min, " +
  "cumprido_em, cancelado_em, os_externa, titulo_externo";

/**
 * O teto de ids por requisição. O `.in()` do PostgREST vira querystring, e uma
 * URL com 600 uuids passa de 22 KB — proxies começam a recusar por volta de 8.
 * 150 uuids são ~5,5 KB com a sintaxe do PostgREST, e mantêm QUALQUER uma
 * destas consultas em 1 a 4 idas, nunca em N.
 */
const FATIA = 150;

function emFatias<T>(itens: T[], tamanho = FATIA): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/** Chave de cache estável para uma lista de ids (ordem não importa). */
function chaveDeIds(ids: string[]): string {
  return [...ids].sort().join(",");
}

function ordenarPorId(blocos: BlocoDeAgenda[]): BlocoDeAgenda[] {
  const m = new Map<string, BlocoDeAgenda>();
  for (const b of blocos) m.set(b.id, b);
  return [...m.values()];
}

// ── LEITURA ─────────────────────────────────────────────────────────────────

/**
 * Os blocos de UMA semana, de todas as equipes.
 *
 * POR QUE NÃO A TABELA INTEIRA, se `useEscala` traz tudo. A escala é ~520
 * linhas por ANO e é limitada pelo CADASTRO (uma linha por pessoa por semana
 * decidida) — a justificativa dela está escrita em `duplas/data.ts:33-46` e
 * continua verdadeira. `agenda_campo` é limitada pela OPERAÇÃO: ~4 blocos por
 * equipe por dia × 4 equipes × 5 dias ≈ 80 por semana ≈ 4 mil por ano, e cresce
 * sem teto. Três anos são 12 mil linhas em toda abertura da grade, num celular,
 * no campo. A mesma resposta não serve para as duas curvas.
 *
 * É exatamente a consulta para a qual o índice `agenda_campo_grade_idx
 * (dia, dupla_id, inicio_min)` foi criado (U78 §2.3).
 *
 * `staleTime` de 30s e não 60s: a grade é um quadro COMPARTILHADO e não tem
 * canal de realtime (ver o comentário de `useProgramacaoViva` no fim do
 * arquivo). O foco de janela é o que resta, e ele só ajuda se o dado envelhecer
 * rápido o bastante para o refetch acontecer.
 */
export function useBlocosDaSemana(dia: string) {
  const base = dataDoDia(dia);
  const segunda = base ? inicioSemana(base) : null;
  const domingo = segunda
    ? new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6)
    : null;
  const de = segunda ? dataIso(segunda) : "";
  const ate = domingo ? dataIso(domingo) : "";

  return useQuery({
    queryKey: ["agenda-campo", "semana", de],
    enabled: !!segunda,
    staleTime: 30_000,
    queryFn: async (): Promise<BlocoDeAgenda[]> => {
      const { data, error } = await supabase
        .from("agenda_campo" as any)
        .select(CAMPOS_BLOCO)
        .gte("dia", de)
        .lte("dia", ate);
      if (error) throw error;
      return ((data as any[]) ?? []) as BlocoDeAgenda[];
    },
  });
}

/**
 * OS IRMÃOS: todos os blocos dos chamados que aparecem na janela.
 *
 * ESTA CONSULTA EVITA UM DEFEITO SILENCIOSO, e é a razão de ela existir.
 * `celulaDaGrade` chama `ordinalDoBloco(b, blocos)` (modelo.ts:1731), e o
 * ordinal precisa dos irmãos do CHAMADO INTEIRO — não dos blocos da semana. Com
 * a janela sozinha, um retorno cuja primeira visita foi na semana passada
 * responde `1`, e o chip "retorno" — que é a manchete da R99 — some sem avisar.
 * `espelhoDoChamado` e `blocoEhRetorno` teriam o mesmo problema.
 *
 * NÃO É N+1. Os ids saem da consulta da semana e viram UMA requisição com N
 * ids, não N requisições. Acima de `FATIA` ids ela vira 2 ou 3 idas — função da
 * VISTA, nunca da quantidade de linhas desenhadas.
 *
 * O SUPERSET É SEGURO POR DESENHO DO MODELO, não por sorte: toda função que
 * precisa de uma semana FILTRA ELA MESMA (`ocupacaoDaSemana`,
 * `blocosDaEquipeNoDia`, `diasDaGrade`, o `daSemana` de `linhasDaGrade`), e
 * `blocosForaDaGrade` é o guarda permanente que prova que continuou verdade.
 */
export function useBlocosDosChamados(ids: string[]) {
  const chave = chaveDeIds(ids);
  return useQuery({
    queryKey: ["agenda-campo", "irmaos", chave],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<BlocoDeAgenda[]> => {
      const partes = await Promise.all(
        emFatias(ids).map(async (fatia) => {
          const { data, error } = await supabase
            .from("agenda_campo" as any)
            .select(CAMPOS_BLOCO)
            .in("chamado_id", fatia);
          if (error) throw error;
          return ((data as any[]) ?? []) as BlocoDeAgenda[];
        }),
      );
      return partes.flat();
    },
  });
}

/**
 * QUEM JÁ TEM BLOCO — em qualquer tempo, não na janela. É o denominador da
 * faixa "agendado sem horário" e o predicado de `classificarChamado`.
 *
 * SEM ELA, O DEFEITO QUE ESTA ENTREGA EXISTE PARA MATAR VOLTA PELA JANELA: um
 * chamado cujo único bloco está a três meses não tem bloco na semana aberta,
 * logo não entra em `useBlocosDosChamados`, logo `classificarChamado` o devolve
 * como `sem_horario` — e o botão "Dar horário" chama `agenda_campo_marcar` com
 * `_id: null`, criando um SEGUNDO bloco. Um retorno que ninguém pediu. A regra
 * "um bloco é sempre editado a partir do CARTÃO" não protege aqui, porque a
 * faixa é gesto de nível-CHAMADO.
 *
 * O universo da pergunta é pequeno de propósito: só os chamados de campo ainda
 * ABERTOS e COM data (`naProgramacao` + `data_hora_agendada`), que hoje são
 * centenas. `select("chamado_id")` e nada mais — é a coluna, não a linha.
 *
 * O TETO, DECLARADO PARA NINGUÉM O DESCOBRIR SOZINHO: quando "abertos com data"
 * passar de ~600, são 4 fatias e vale janelar por `dia >= hoje − 1 ano`. O
 * custo dessa janela é que um chamado aberto há mais de um ano, com bloco
 * antigo, REENTRA na faixa — visível e explicável, não silencioso.
 */
export function useChamadosComBloco(ids: string[]) {
  const chave = chaveDeIds(ids);
  return useQuery({
    queryKey: ["agenda-campo", "com-bloco", chave],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<{ ativos: Set<string>; pendentes: Set<string> }> => {
      const ativos = new Set<string>();
      const pendentes = new Set<string>();
      const partes = await Promise.all(
        emFatias(ids).map(async (fatia) => {
          // `cumprido_em` VEIO JUNTO, e a coluna a mais custa ZERO requisição.
          // Com ela a MESMA resposta produz os DOIS Sets, e é isso que torna
          // "retorno pendente" (R106) exprimível sem uma segunda consulta:
          //   · `ativos`    = o Set de antes, byte por byte (o `.is(cancelado_em,
          //     null)` já garante que toda linha que volta é ativa) — é o
          //     denominador da faixa e o predicado de `classificarChamado`;
          //   · `pendentes` = as que ainda VÃO acontecer.
          // O chamado que está em `ativos` e NÃO está em `pendentes` tem visita
          // cumprida, continua aberto e não tem nada marcado à frente. Ele é
          // invisível hoje: `classificarChamado` o põe em `com_bloco` de
          // propósito (para a barra de progresso não andar para trás), e nenhuma
          // faixa, fila ou célula o desenha.
          //
          // E o predicado precisa vir DAQUI, e não de `temCompromisso(id,
          // blocos)`: aquele recebe os blocos DA SEMANA e responderia "nada à
          // frente" para um retorno marcado daqui a três semanas — que é
          // exatamente o defeito descrito no docblock desta função.
          const { data, error } = await supabase
            .from("agenda_campo" as any)
            .select("chamado_id, cumprido_em")
            .is("cancelado_em", null)
            .in("chamado_id", fatia);
          if (error) throw error;
          return ((data as any[]) ?? []) as { chamado_id: string | null; cumprido_em: string | null }[];
        }),
      );
      for (const linha of partes.flat()) {
        if (!linha.chamado_id) continue;
        ativos.add(linha.chamado_id);
        if (linha.cumprido_em === null) pendentes.add(linha.chamado_id);
      }
      return { ativos, pendentes };
    },
  });
}

/**
 * O BIT DO CICLO FINANCEIRO, UMA CHAMADA POR SEMANA CARREGADA — irmão de
 * `useChamadosComBloco`, e de propósito: mesmo `emFatias`, mesmo `chaveDeIds`,
 * mesmo `staleTime`. Nada de N+1, nada por cartão.
 *
 * ── POR QUE UMA RPC E NÃO UM SELECT ───────────────────────────────────────
 * `cobrancas_select` é `USING (pode_ver_financeiro(auth.uid()))` (U4:293) e o
 * SAC está FORA dessa régua (R13) — mas ELE ABRE ESTA TELA (`telas.ts`). Uma
 * policy de SELECT filtra linhas e NÃO levanta erro: um SELECT direto devolveria
 * HTTP 200 com `[]`, e `[]` seria indistinguível de "não há cobrança". Num
 * cartão, que é obrigado a dizer alguma coisa, isso vira um número que mente por
 * omissão — multiplicado por cartão. `SECURITY DEFINER` é a única construção
 * que sabe separar "zero" de "não te deixam contar".
 *
 * ── `Map` VAZIO É O "NÃO SEI", E NUNCA UM `Map` DE `false` ────────────────
 * A RPC devolve um ROWSET: chamado ausente da resposta é chamado sobre o qual
 * ela não respondeu (quem não é gestor recebe ZERO LINHAS). Preencher os que
 * faltaram com `false` seria a mesma mentira, inventada aqui em vez de lá — e é
 * por isso que o erro também devolve `Map` vazio em vez de `throw`: a grade não
 * pode virar tela de erro porque o selo não veio. Sem selo ela é exatamente a
 * grade de ontem.
 */
export function useLancamentosDosChamados(ids: string[]) {
  const chave = chaveDeIds(ids);
  return useQuery({
    queryKey: ["ciclo-financeiro", "lancamentos", chave],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, boolean>> => {
      const mapa = new Map<string, boolean>();
      const partes = await Promise.all(
        emFatias(ids).map(async (fatia) => {
          const { data, error } = await supabase.rpc(
            "chamados_com_lancamento" as any,
            { _chamados: fatia } as any,
          );
          if (error) return [] as { chamado_id: string; tem_lancamento: boolean }[];
          return ((data as any[]) ?? []) as { chamado_id: string; tem_lancamento: boolean }[];
        }),
      );
      for (const l of partes.flat()) mapa.set(l.chamado_id, Boolean(l.tem_lancamento));
      return mapa;
    },
  });
}

/** Os blocos de UM chamado — o painel, e os gestos de nível-chamado. */
export function useBlocosDoChamado(chamadoId: string | null | undefined) {
  return useQuery({
    queryKey: ["agenda-campo", "chamado", chamadoId],
    enabled: !!chamadoId,
    staleTime: 30_000,
    queryFn: async (): Promise<BlocoDeAgenda[]> => {
      const { data, error } = await supabase
        .from("agenda_campo" as any)
        .select(CAMPOS_BLOCO)
        .eq("chamado_id", chamadoId as string);
      if (error) throw error;
      return ((data as any[]) ?? []) as BlocoDeAgenda[];
    },
  });
}

/**
 * A SEMANA + OS IRMÃOS, numa lista só. O merge é aqui e nunca na tela — juntar
 * duas listas por id é tradução de dados, e tradução de dados não mora em
 * componente (regra da casa).
 */
export function useBlocosDaGrade(dia: string) {
  const semana = useBlocosDaSemana(dia);
  const daSemana = semana.data ?? [];
  const idsDeChamado = [
    ...new Set(daSemana.map((b) => b.chamado_id).filter((id): id is string => !!id)),
  ];
  const irmaos = useBlocosDosChamados(idsDeChamado);
  return {
    blocos: ordenarPorId([...daSemana, ...(irmaos.data ?? [])]),
    /**
     * OS IDS DA SEMANA, DEVOLVIDOS — e devolvê-los é o que impede um defeito
     * silencioso na próxima pergunta que alguém fizer por chamado.
     *
     * `blocos` (acima) é o SUPERSET: semana + os IRMÃOS de outras semanas, que
     * `ordinalDoBloco` precisa. Quem derivasse a lista de ids dali para
     * perguntar algo por chamado — como o ciclo financeiro faz — inflaria a
     * pergunta com chamados que não têm um cartão sequer na tela. Esta é a
     * lista dos que a semana REALMENTE mostra.
     */
    idsDeChamado,
    isPending: semana.isPending,
    erro: (semana.error ?? irmaos.error) as Error | null,
  };
}

// ── QUEM ESTÁ OLHANDO ───────────────────────────────────────────────────────

/**
 * `public.is_gestor(auth.uid())`, pela RPC e NÃO por `cargo`.
 *
 * O atalho por `cargo` no cliente NÃO serve aqui: `is_gestor` lê `user_roles`
 * E `profiles.cargo`, e as duas listas podem discordar de uma linha. Derivar
 * aqui o oposto do que a porta decide seria criar a segunda verdade sobre quem
 * manda, numa camada acima daquela que esta entrega existe para consertar.
 *
 * ── CORREÇÃO DE UM COMENTÁRIO QUE ESTAVA ERRADO (U80) ─────────────────────
 * Este docblock afirmava, com todas as letras, que "o **sac NÃO é gestor** para
 * a porta", e transcrevia `is_gestor` como
 * `∈ (admin, comercial)`. É FALSO desde a U6a:51-66, que inclui `'sac'`
 * explicitamente — a U6a separou DUAS réguas de propósito: `is_gestor` (admin,
 * comercial, SAC) e `pode_ver_financeiro` (admin, comercial), porque a R13 diz
 * que o SAC é gestor que NÃO vê valores. Quem escrevesse um selo ou um gate
 * lendo o comentário velho erraria a régua na primeira linha, e é exatamente o
 * tipo de coisa que esta entrega existe para não deixar acontecer.
 *
 * Uma chamada, cacheada por cinco minutos.
 */
export function useEhGestor(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["autz", "gestor", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_gestor" as any, { _user_id: userId } as any);
      if (error) throw error;
      return data === true;
    },
  });
}

/**
 * Os chamados em que EU sou apoio VÁLIDO — a terceira perna de
 * `pode_editar_chamado` depois da S2.
 *
 * O PREDICADO NÃO MORA AQUI: ele é `apoioValeComoVinculo`, no modelo puro. E a
 * mudança é conserto de um buraco que o teste de mutação achou — enquanto a
 * condição era uma cláusula `.filter()` dentro da consulta, trocá-la inteira por
 * `true` deixava o verificador VERDE. Regra de autorização escondida numa
 * consulta é regra que ninguém consegue exercitar sem banco.
 *
 * O filtro é feito em MEMÓRIA e não no PostgREST de propósito: `neq` não casa
 * NULL, então a condição do banco (`IS DISTINCT FROM`) precisaria de um `or(…)`
 * com três ramos — uma terceira redação da mesma regra, com sintaxe própria,
 * para divergir das outras duas.
 *
 * UMA consulta, com `profile_id = eu`. A tabela é pequena e a leitura é aberta
 * (é o mesmo raciocínio de `useApoiosDeTodos`, home/data.ts:110-113).
 */
export function useMeusApoiosValidos(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["autz", "apoios-meus", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("chamado_apoios" as any)
        .select("chamado_id, origem, criado_por, profile_id")
        .eq("profile_id", userId as string);
      if (error) throw error;
      return ((data as any[]) ?? [])
        .filter(apoioValeComoVinculo)
        .map((a) => a.chamado_id as string);
    },
  });
}

/**
 * O `AutorizacaoDaAgenda` que o modelo puro pede, montado das três pernas.
 *
 * `montarAutorizacao` mora no modelo puro de propósito: a interface já morava
 * lá (modelo.ts:638) e o construtor não, então todo chamador o escreveria à
 * mão — três cópias de um predicado de autorização é como nasce a quarta.
 */
export function useAutorizacaoDaAgenda(
  usuarioId: string | null,
  chamados: ChamadoParaAutorizacao[],
): AutorizacaoDaAgenda {
  const { data: ehGestor = false } = useEhGestor(usuarioId);
  const { data: apoios = [] } = useMeusApoiosValidos(usuarioId);
  return montarAutorizacao(usuarioId, ehGestor, chamados, apoios);
}

// ── ESCRITA: as quatro portas ───────────────────────────────────────────────

/**
 * O CORPO DE `agenda_campo_marcar`, como função PURA e EXPORTADA — e a
 * exportação é o que permite ao `carregar()` do verificador prendê-la.
 *
 * A REGRA É ASSIMÉTRICA, E A ASSIMETRIA É DA ASSINATURA DA PORTA (U78:1134):
 *
 *   _id, _chamado, _dupla, _dia, _inicio_min, _servico_min   ← SEM DEFAULT
 *   _deslocamento_min, _os_externa, _titulo_externo          ← DEFAULT NULL
 *
 * OS SEIS PRIMEIROS VÃO SEMPRE, com `null` explícito onde o gesto não mexeu. O
 * PostgREST resolve a função pelo CONJUNTO de argumentos nomeados que chegam no
 * corpo: omitir um parâmetro que não tem DEFAULT faz ele não achar candidato e
 * responder **PGRST202 antes de a função rodar**. Um PATCH de arrasto (que muda
 * só `dia`) mandaria `{_id, _dia}` e falharia inteiro — em toda gravação da
 * tela, com uma mensagem que não fala de agenda nenhuma. O `null` é lido pelo
 * passo 1b como "não mexi" (`COALESCE(_dia, v_a_dia)`), que é exatamente o que
 * se quer dizer.
 *
 * OS TRÊS ÚLTIMOS SÓ ENTRAM QUANDO `patchDoBloco` OS PRODUZIU. `_deslocamento_min`
 * é `DEFAULT NULL` desde a revisão da U78 (:1126-1133) porque num PATCH um
 * default que não é NULL é um apagador disfarçado: o PostgREST preenche o
 * default de todo parâmetro AUSENTE, então mandar `?? 0` por comodidade zera os
 * 45 minutos de estrada digitados — encolhendo a janela do EXCLUDE (o bloco
 * passa a ocupar menos do que ocupa) e inventando 45 minutos de capacidade no
 * dia. A CHAVE TEM DE ESTAR AUSENTE, não valer zero. O zero de "não tem
 * deslocamento" continua existindo: ele se escreve quando `patchDoBloco` viu
 * 45 → 0, que é uma MUDANÇA e entra.
 *
 * CRIAR (`_id === null`) MANDA TUDO, porque não há linha viva contra a qual
 * fazer COALESCE: um campo ausente cairia no default da coluna e não no que o
 * formulário mostrou.
 */
export function paramsDeMarcar(
  id: string | null,
  patch: Partial<BlocoEditavel>,
  valores: BlocoEditavel,
): Record<string, unknown> {
  const criando = id === null;
  const mexeu = (k: keyof BlocoEditavel) => criando || k in patch;
  const p: Record<string, unknown> = {
    _id: id,
    _chamado: mexeu("chamado_id") ? valores.chamado_id : null,
    _dupla: mexeu("dupla_id") ? valores.dupla_id : null,
    _dia: mexeu("dia") ? valores.dia : null,
    _inicio_min: mexeu("inicio_min") ? valores.inicio_min : null,
    _servico_min: mexeu("servico_min") ? valores.servico_min : null,
  };
  if (mexeu("deslocamento_min")) p._deslocamento_min = valores.deslocamento_min;
  if (mexeu("os_externa")) p._os_externa = valores.os_externa;
  if (mexeu("titulo_externo")) p._titulo_externo = valores.titulo_externo;
  return p;
}

/**
 * A recusa que o modelo puro antecipou, com o SQLSTATE que a porta usaria.
 * Existe para `classeDoErro` funcionar igual dos dois lados: um erro nascido
 * aqui e um nascido no Postgres têm de pintar o mesmo rosto no formulário.
 */
export class RecusaDaAgenda extends Error {
  code: string;
  constructor(mensagem: string, code = "55000") {
    super(mensagem);
    this.name = "RecusaDaAgenda";
    this.code = code;
  }
}

/** O SQLSTATE de um erro do PostgREST, da RPC ou de `RecusaDaAgenda`. */
export function sqlstateDoErro(e: unknown): string | null {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : null;
}

/**
 * A INVALIDAÇÃO DAS QUATRO PORTAS, num lugar só — porque as quatro mexem nas
 * mesmas coisas: o bloco, o ESPELHO (`chamados.data_hora_agendada`, escrito por
 * gatilho) e o STATUS do chamado (passo 8 do §6.1, a metade de baixo do §6.2, o
 * §6.4).
 *
 * As quatro chaves de baixo são copiadas de `PainelChamado.salvar`
 * (:590-595): a Home, `atividadesDeHoje`, o calendário e o PDF leem
 * `data_hora_agendada`, e o espelho acabou de movê-la. `home-apoios-todos`
 * entra porque o espelho pode cascatear em `chamado_apoios` pelo gatilho da U76
 * (mudou a semana ISO do trabalho → o apoio é reavaliado), mudando a pilha de
 * avatares. `duplas-escala` NÃO entra: bloco não mexe em escala.
 *
 * Quem diz QUAIS chamados recarregar é `chamadosTocadosPeloGesto`, e são DOIS
 * quando o bloco troca de chamado — a função existe exatamente para isso
 * (modelo.ts:1448): refazer a busca só do destino deixa o cartão de origem com
 * o chip e a data velhos, que é a segunda verdade renascendo na tela.
 */
function invalidar(qc: QueryClient, chamados: string[]) {
  qc.invalidateQueries({ queryKey: ["agenda-campo"] }); // semana + irmãos + com-bloco + chamado
  qc.invalidateQueries({ queryKey: ["chamados"] }); // pega ["chamados","campo"] por prefixo
  for (const id of chamados) qc.invalidateQueries({ queryKey: ["chamado", id] });
  for (const k of [["home"], ["home-chamados"], ["home-historico"], ["calendario"], ["home-apoios-todos"]]) {
    qc.invalidateQueries({ queryKey: k });
  }
}

export interface GestoDeMarcar {
  /** null = criar. Não-null = PATCH sobre esta linha. */
  id: string | null;
  /** o que MUDOU (saída de `patchDoBloco`); no criar, ignorado */
  patch: Partial<BlocoEditavel>;
  /** os valores EFETIVOS que o formulário mostra */
  valores: BlocoEditavel;
  /** a linha viva, para saber quais chamados recarregar */
  atual: BlocoDeAgenda | null;
}

/**
 * Criar ou mover um bloco. `patchImpossivel` é checado ANTES da ida ao banco —
 * são as três coisas que a porta deixou de saber fazer quando virou PATCH, e
 * sem esta guarda o usuário clica, nada acontece e ninguém explica.
 *
 * SEM UPDATE OTIMISTA, de propósito. `classeDoErro('23P01')` é `conflito`, e o
 * modelo diz o que fazer com ele: "recarregar a grade é o certo, porque o
 * estado que a tela mostra já está velho". Um cartão que pousa e volta ensina o
 * usuário a desconfiar do arrasto — pior do que esperar 300 ms.
 */
export function useMarcarBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: GestoDeMarcar): Promise<string> => {
      const impossivel = patchImpossivel(g.patch);
      if (impossivel) throw new RecusaDaAgenda(impossivel);
      const { data, error } = await supabase.rpc(
        "agenda_campo_marcar" as any,
        paramsDeMarcar(g.id, g.patch, g.valores) as any,
      );
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (_d, g) => invalidar(qc, chamadosTocadosPeloGesto(g.atual, g.valores)),
  });
}

/** Desmarcar UM bloco. Libera a agenda; não mexe no chamado além do status. */
export function useCancelarBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: Pick<BlocoDeAgenda, "id" | "chamado_id">) => {
      const { error } = await supabase.rpc("agenda_campo_cancelar" as any, { _id: b.id } as any);
      if (error) throw error;
    },
    onSuccess: (_d, b) => invalidar(qc, b.chamado_id ? [b.chamado_id] : []),
  });
}

/**
 * O alternador "feito". `_feito` é mandado SEMPRE e explicitamente: o parâmetro
 * tem `DEFAULT true` no banco, e `baixaPedida` (modelo puro) é o gêmeo do
 * `COALESCE(_feito, true)` que impede um `null` de virar "desmarque" em
 * silêncio.
 */
export function useCumprirBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { bloco: Pick<BlocoDeAgenda, "id" | "chamado_id">; feito: boolean }) => {
      const { error } = await supabase.rpc(
        "agenda_campo_cumprir" as any,
        { _id: v.bloco.id, _feito: v.feito } as any,
      );
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidar(qc, v.bloco.chamado_id ? [v.bloco.chamado_id] : []),
  });
}

// ── A PORTA DO CICLO FINANCEIRO (U80 §4) ───────────────────────────────────

/** As três decisões que a porta aceita — gêmeo do `NOT IN` do passo 2 da RPC. */
export type DecisaoDoCiclo = "conferir_depois" | "nada_a_cobrar" | "lancar";

export interface GestoDoCiclo {
  chamadoId: string;
  decisao: DecisaoDoCiclo;
  /** só quando `lancar`: a descrição, o total e as parcelas já divididas */
  descricao?: string;
  valorTotal?: number;
  parcelas?: number[];
  tipoServico?: "instalacao" | "manutencao";
}

/**
 * CONCLUIR E DECIDIR A COBRANÇA, NA MESMA TRANSAÇÃO.
 *
 * Duas chamadas (concluir, depois lançar) teriam um estado intermediário
 * OBSERVÁVEL: chamado concluído, dinheiro não lançado, ninguém sabendo. E o
 * caminho antigo — `lancarCobrancaAvulsa` (financeiro/fechamentos.ts) — é um
 * INSERT direto do navegador que NÃO grava `chamado_id`, não grava
 * `contrato_id` e não mexe em `faturamento_status`: usada como está, ela cria
 * uma cobrança que o selo nunca encontra e que a trava não trava.
 *
 * ── AS PARCELAS VÃO DIVIDIDAS, E O SERVIDOR CONFERE A SOMA ────────────────
 * `parcelar()` (lib/periodos.ts) divide em CENTAVOS com o resto na primeira —
 * 3 × 33,33 em float dá 99,99, e o cliente paga a menos para sempre.
 * Reimplementar aquela divisão em PL/pgSQL criaria a SEGUNDA resposta para a
 * mesma conta. Então o array vai no corpo e a RPC confere que a soma bate com o
 * total: a divisão tem um dono só, a invariante é conferida dos dois lados.
 *
 * Rejeita com o erro CRU, como as quatro portas da agenda: quem escolhe o rosto
 * é a tela, por `classeDoErro(error.code)`.
 */
export function useConcluirComCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: GestoDoCiclo): Promise<{ itens: number; status: string }> => {
      const { data, error } = await supabase.rpc(
        "concluir_chamado_com_cobranca" as any,
        {
          _chamado: g.chamadoId,
          _decisao: g.decisao,
          _descricao: g.descricao ?? null,
          _valor_total: g.valorTotal ?? null,
          _parcelas: g.parcelas ?? null,
          _tipo_servico: g.tipoServico ?? null,
        } as any,
      );
      if (error) throw error;
      const linha = Array.isArray(data) ? data[0] : data;
      return {
        itens: Number((linha as any)?.itens ?? 0),
        status: String((linha as any)?.status_final ?? ""),
      };
    },
    onSuccess: (_d, g) => {
      invalidar(qc, [g.chamadoId]);
      // O ciclo é uma chave própria: `invalidar` cobre agenda e chamado, e o
      // selo vive de outra pergunta.
      qc.invalidateQueries({ queryKey: ["ciclo-financeiro"] });
      qc.invalidateQueries({ queryKey: ["chamado-lancamento", g.chamadoId] });
      qc.invalidateQueries({ queryKey: ["cobrancas-chamado", g.chamadoId] });
      qc.invalidateQueries({ queryKey: ["cobrancas-abertas"] });
    },
  });
}

/**
 * TIRAR O CHAMADO DA AGENDA — o ato deliberado do §6.4, que é diferente de
 * desmarcar um bloco. Cancela só o que ainda VAI acontecer (bloco cumprido é
 * registro) e recalcula o espelho à mão.
 *
 * O TEXTO da confirmação NÃO se escreve à mão: quem responde onde a data vai
 * parar é `espelhoAposDesagendar` (modelo puro). Sobrando bloco cumprido, a
 * data fica no último atendimento que ACONTECEU, e "o horário some" é mentira.
 */
export function useDesagendarChamado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chamadoId: string): Promise<number> => {
      const { data, error } = await supabase.rpc(
        "desagendar_chamado" as any,
        { _chamado: chamadoId } as any,
      );
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    onSuccess: (_d, chamadoId) => invalidar(qc, [chamadoId]),
  });
}
