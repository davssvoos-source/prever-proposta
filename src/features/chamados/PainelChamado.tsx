// O painel de propriedades do chamado — entra pela direita, sobre a tela.
//
// POR QUE PAINEL E NÃO PÁGINA: quem varre a fila (ou o calendário) está
// comparando cartões. Sair da tela e voltar perde o filtro, a rolagem e a
// coluna onde a pessoa estava — e depois de três cartões conferidos, ela
// desiste de conferir o quarto. O painel mantém o que está atrás vivo: fecha
// e o lugar ainda está lá.
//
// SALVA CAMPO A CAMPO, sem botão de salvar. É o comportamento que a pessoa já
// conhece do Notion, de onde estas atividades vieram, e evita o pior desfecho
// de um formulário longo: preencher seis campos e perder tudo porque a sessão
// caiu no sétimo. Cada campo carrega o próprio estado — salvando, salvo, ou o
// erro com o código (PRV-...) para o defeito ser rastreável.
//
// ── O DESENHO (2ª revisão, 2026-08-22) ──────────────────────────────────────
//
// A ORDEM DAS SEÇÕES é a ordem em que se lê um chamado, não a ordem em que o
// banco guarda as colunas: De quem é (quem toca isto) → Descrição (o que é)
// → Classificação (como se organiza) → Quando (o relógio) → Comentários (a
// conversa). "De quem é" primeiro porque é a primeira coisa que se procura
// varrendo uma fila; comentários por último porque é discussão SOBRE o
// chamado, não uma propriedade dele.
//
// DE QUEM É — Cliente, Responsável e Apoio na MESMA LINHA, cada um com
// ícone/foto ao lado do nome: são três respostas para a mesma pergunta
// ("de quem é isto?"), e lado a lado é como se lê uma resposta composta —
// separadas em três linhas empilhadas, pareciam três perguntas diferentes.
//
// DESCRIÇÃO ganhou uma barra de ferramentas (negrito, itálico, checklist,
// lista) — ver o cabeçalho de src/lib/edicao-texto.ts para por que é
// Markdown em texto puro, e não um editor rico de verdade.
//
// COMENTÁRIOS reaproveita a MESMA tabela (`chamado_eventos`) e as MESMAS
// funções (`useChamadoEventos`, `comentarChamado`) que a página de detalhe
// interna já usa — a infraestrutura já existia; faltava expor no painel.
//
// A DATA DE CRIAÇÃO não é editável, por pedido do Davi e por bom senso: ela é
// o registro de quando a demanda chegou. Reescrevê-la apagaria a única âncora
// temporal confiável do chamado — a que a idade do backlog e a reincidência
// usam para contar. O NÚMERO (CH-...) saiu da vista do cabeçalho — mesma
// lógica da R43 na tabela da Início: continua acessível pelo tooltip do
// título, porque é assim que se pede o chamado por telefone.
//
// OS SUBCOMPONENTES SÃO DE MÓDULO, não funções internas. Declarados dentro do
// pai, ganhariam identidade nova a cada render: o React trataria como outro
// componente, desmontaria e remontaria — e o texto sendo digitado sumiria no
// meio da frase quando qualquer consulta de fundo voltasse.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check, ExternalLink, Loader2, X, Building2, Send, MessageSquare,
  Bold, Italic, ListChecks, List,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CampoComBusca, type OpcaoBusca } from "@/components/CampoComBusca";
import { AvatarCirculo } from "@/components/PessoaComFoto";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { codigoDeErro } from "@/lib/erros";
import { envolverSelecao, prefixarLinhas } from "@/lib/edicao-texto";
import { tempoRelativo } from "@/hooks/useNotificacoes";
import {
  useChamado, usePessoas, useChamadoApoios, useChamadoEventos,
  atualizarChamado, adicionarApoio, removerApoio, comentarChamado, mapaDePessoas,
  type ChamadoPatch,
} from "@/features/chamados/data";
import { useClientes } from "@/features/clientes/data";
import {
  PRIORIDADE_LABEL, PRIORIDADE_CORES, SPRINT_LABEL, SPRINT_ORDEM, TIPO_LABEL, TIPO_CORES,
  chamadoStatusInfo, statusDaNatureza, tiposDaNatureza,
  prazoParaData, dataParaPrazo, situacaoPrazo, sprintDoPrazo,
  type ChamadoPrioridade, type ChamadoTipo, type Natureza,
} from "@/lib/chamado-status";
import { EQUIPE_LABEL, type Equipe } from "@/lib/equipes";

export type EstadoCampo = "parado" | "salvando" | "salvo" | { erro: string };

// ── Peças de formulário ─────────────────────────────────────────────────────

/**
 * Paleta e medidas compartilhadas.
 *
 * As medidas são o assunto do redesenho, então ficam nomeadas: 11px de rótulo
 * e 14px de valor são o piso confortável do design system, e 44px de altura é
 * o alvo de toque mínimo — o painel abre no celular também.
 */
function useEstiloCampo() {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.62)";
  const campoBg = isLight ? "#ffffff" : "rgba(255,255,255,0.055)";
  const borda = isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)";
  return {
    isLight, textPrimary, textSecondary, campoBg, borda,
    gold: isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
    verde: isLight ? "#047862" : "#2DD2A5",
    vermelho: isLight ? "#B1242E" : "#F17881",
    rotulo: {
      fontFamily: FONT, fontWeight: 600, fontSize: 11,
      letterSpacing: "0.02em", color: textSecondary,
    } as CSSProperties,
    entrada: {
      width: "100%", boxSizing: "border-box", minHeight: 44,
      fontFamily: FONT, fontSize: 14, fontWeight: 500, color: textPrimary,
      background: campoBg, border: borda, borderRadius: 12,
      padding: "11px 13px", outline: "none",
    } as CSSProperties,
  };
}

function Selo({ estado }: { estado?: EstadoCampo }) {
  const { textSecondary, verde, vermelho } = useEstiloCampo();
  if (estado === "salvando") return <Loader2 size={13} className="animate-spin" color={textSecondary} />;
  if (estado === "salvo") return <Check size={13} color={verde} />;
  if (estado && typeof estado === "object") {
    return (
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: vermelho }}>
        {estado.erro}
      </span>
    );
  }
  return null;
}

/** Título de seção — o que transforma dez campos soltos em grupos legíveis. */
function Secao({ titulo }: { titulo: string }) {
  const { gold } = useEstiloCampo();
  return (
    <div style={{
      fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
      letterSpacing: "0.12em", textTransform: "uppercase", color: gold,
      marginTop: 6,
    }}>
      {titulo}
    </div>
  );
}

function Campo({ titulo, estado, children }: {
  titulo: string; estado?: EstadoCampo; children: ReactNode;
}) {
  const { rotulo } = useEstiloCampo();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 15 }}>
        <span style={rotulo}>{titulo}</span>
        <Selo estado={estado} />
      </span>
      {children}
    </label>
  );
}

/**
 * Select que grava ao mudar.
 *
 * `cor` pinta o TEXTO do valor escolhido quando a propriedade tem cor no
 * sistema (tipo, prioridade). O fundo continua neutro de propósito: caixas
 * coloridas lado a lado brigariam entre si e com as etiquetas do cabeçalho,
 * que são as que devem ser vistas primeiro.
 */
function Escolha({ titulo, estado, valor, opcoes, aoMudar, vazio, cor }: {
  titulo: string; estado?: EstadoCampo; valor: string | null;
  opcoes: { v: string; t: string }[];
  aoMudar: (v: string | null) => void;
  vazio?: string;
  cor?: string;
}) {
  const { entrada, textPrimary } = useEstiloCampo();
  return (
    <Campo titulo={titulo} estado={estado}>
      <select
        value={valor ?? ""}
        onChange={(ev) => aoMudar(ev.target.value || null)}
        style={{
          ...entrada, cursor: "pointer",
          color: cor && valor ? cor : textPrimary,
          fontWeight: cor && valor ? 600 : 500,
        }}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </Campo>
  );
}

/**
 * Texto que grava ao SAIR do campo. Gravar a cada tecla seria uma requisição
 * por letra e um cursor que pula quando a resposta chega.
 *
 * `chaveReset` (o id do chamado) sincroniza o rascunho quando o painel troca
 * de registro — sem isso, abrir outro cartão mostraria o texto do anterior.
 */
function Texto({ titulo, estado, valor, aoSalvar, chaveReset, estiloProprio, placeholder }: {
  titulo?: string; estado?: EstadoCampo; valor: string;
  aoSalvar: (v: string) => void; chaveReset?: string | null;
  estiloProprio?: CSSProperties; placeholder?: string;
}) {
  const { entrada } = useEstiloCampo();
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor, chaveReset]);
  const estilo = { ...entrada, ...estiloProprio };
  const campo = (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== valor) aoSalvar(v); }}
      style={estilo}
    />
  );
  // sem rótulo = é o título no cabeçalho, que se explica sozinho
  return titulo ? <Campo titulo={titulo} estado={estado}>{campo}</Campo> : campo;
}

/** Etiqueta colorida — o mesmo vocabulário dos cards do quadro. */
function Etiqueta({ texto, cor, forte }: { texto: string; cor: { dark: string; light: string; bg: string }; forte?: boolean }) {
  const { isLight } = useEstiloCampo();
  return (
    <span style={{
      padding: "5px 12px", borderRadius: 999,
      fontFamily: FONT, fontWeight: forte ? 700 : 600, fontSize: 12,
      color: isLight ? cor.light : cor.dark,
      background: cor.bg, whiteSpace: "nowrap",
    }}>
      {texto}
    </span>
  );
}

// ── Descrição, com ferramentas básicas de texto ─────────────────────────────

interface BotaoFerramenta {
  Icon: typeof Bold;
  titulo: string;
  aplicar: (valor: string, ini: number, fim: number) => { valor: string; selecaoInicio: number; selecaoFim: number };
}

const FERRAMENTAS: BotaoFerramenta[] = [
  { Icon: Bold, titulo: "Negrito",
    aplicar: (v, i, f) => envolverSelecao(v, i, f, "**", "negrito") },
  { Icon: Italic, titulo: "Itálico",
    aplicar: (v, i, f) => envolverSelecao(v, i, f, "*", "itálico") },
  { Icon: ListChecks, titulo: "Checklist",
    aplicar: (v, i, f) => prefixarLinhas(v, i, f, "- [ ] ") },
  { Icon: List, titulo: "Lista",
    aplicar: (v, i, f) => prefixarLinhas(v, i, f, "- ") },
];

/**
 * A descrição com barra de ferramentas — negrito, itálico, checklist, lista
 * (2026-08-22, Davi: "edições básicas de texto").
 *
 * MARKDOWN EM TEXTO PURO, não um editor rico: ver o cabeçalho de
 * lib/edicao-texto.ts. Os botões escrevem `**assim**`/`- [ ] assim` dentro do
 * `<textarea>` de sempre — é sintaxe que qualquer pessoa já reconhece
 * (GitHub, WhatsApp, Notion), e continua sendo texto puro em toda tela que já
 * lê `descricao_problema` hoje.
 */
function DescricaoComFerramentas({ estado, valor, aoSalvar, chaveReset }: {
  estado?: EstadoCampo; valor: string; aoSalvar: (v: string) => void; chaveReset?: string | null;
}) {
  const est = useEstiloCampo();
  const [v, setV] = useState(valor);
  const ref = useRef<HTMLTextAreaElement>(null);
  // seleção a restaurar DEPOIS do próximo render — o clique no botão muda o
  // valor controlado, e só depois de o React repintar dá para reposicionar
  // o cursor no DOM novo
  const selecaoPendente = useRef<{ inicio: number; fim: number } | null>(null);

  useEffect(() => { setV(valor); }, [valor, chaveReset]);

  useEffect(() => {
    if (!selecaoPendente.current || !ref.current) return;
    const { inicio, fim } = selecaoPendente.current;
    ref.current.focus();
    ref.current.setSelectionRange(inicio, fim);
    selecaoPendente.current = null;
  }, [v]);

  function aplicar(f: BotaoFerramenta) {
    const el = ref.current;
    if (!el) return;
    const r = f.aplicar(v, el.selectionStart ?? v.length, el.selectionEnd ?? v.length);
    selecaoPendente.current = { inicio: r.selecaoInicio, fim: r.selecaoFim };
    setV(r.valor);
  }

  return (
    <Campo titulo="Descrição" estado={estado}>
      <div style={{
        border: est.borda, borderRadius: 12, overflow: "hidden", background: est.campoBg,
      }}>
        {/* a barra fica DENTRO da borda do campo — lê como parte dele, não
            como uma fileira de botões soltos acima */}
        <div style={{
          display: "flex", alignItems: "center", gap: 2, padding: "6px 7px",
          borderBottom: est.borda,
        }}>
          {FERRAMENTAS.map((f) => (
            <button
              key={f.titulo}
              type="button"
              title={f.titulo}
              aria-label={f.titulo}
              // mousedown, não click: click chega DEPOIS do blur do
              // textarea, que já teria apagado selectionStart/End
              onMouseDown={(e) => { e.preventDefault(); aplicar(f); }}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none",
                background: "transparent", color: est.textSecondary,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <f.Icon size={15} />
            </button>
          ))}
        </div>
        <textarea
          ref={ref}
          value={v}
          rows={5}
          placeholder="O que precisa ser feito, o que já se sabe…"
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { if (v !== valor) aoSalvar(v); }}
          style={{
            width: "100%", boxSizing: "border-box", display: "block",
            fontFamily: FONT, fontSize: 14, fontWeight: 500, color: est.textPrimary,
            background: "transparent", border: "none", outline: "none",
            padding: "11px 13px", resize: "vertical", lineHeight: 1.55,
          }}
        />
      </div>
    </Campo>
  );
}

// ── Comentários ──────────────────────────────────────────────────────────────

/**
 * O feed de comentários — reaproveita `chamado_eventos` (a MESMA tabela e as
 * MESMAS funções que DetalheInterno.tsx já usa). Não é uma feature nova do
 * zero: faltava só o painel expor o que já existia.
 *
 * Ordem ANTIGO → NOVO, com o campo de escrever no FIM — é como se lê uma
 * conversa, e é o padrão que a própria tela de detalhe já usava.
 */
function Comentarios({ chamadoId, pessoasPorId }: {
  chamadoId: string; pessoasPorId: Record<string, { nome: string; avatar_url: string | null }>;
}) {
  const est = useEstiloCampo();
  const qc = useQueryClient();
  const { data: eventos = [] } = useChamadoEventos(chamadoId, "asc");
  const comentarios = useMemo(() => eventos.filter((e) => e.tipo === "comentario"), [eventos]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: async () => {
      const t = texto.trim();
      if (!t) throw new Error("Escreva alguma coisa antes de enviar.");
      await comentarChamado(chamadoId, t);
    },
    onSuccess: () => {
      setTexto("");
      setErro(null);
      qc.invalidateQueries({ queryKey: ["chamado-eventos", chamadoId] });
    },
    onError: (e: Error) => setErro(codigoDeErro(e, "/dashboard")),
  });

  return (
    <>
      <Secao titulo="Comentários" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {comentarios.length === 0 ? (
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: est.textSecondary }}>
            Ninguém comentou ainda.
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {comentarios.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 9 }}>
                <MessageSquare size={14} color={est.gold} style={{ marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11.5, color: est.textPrimary }}>
                    {c.user_id ? pessoasPorId[c.user_id]?.nome ?? "Alguém" : "Alguém"}
                    <span style={{ fontWeight: 400, color: est.textSecondary }}>
                      {" · "}{tempoRelativo(c.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: FONT, fontWeight: 400, fontSize: 13.5, color: est.textPrimary,
                    lineHeight: 1.55, whiteSpace: "pre-wrap", marginTop: 2,
                  }}>
                    {c.descricao}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", gap: 8, alignItems: "start" }}>
          <div>
            <textarea
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setErro(null); }}
              onKeyDown={(e) => {
                // Enter envia, Shift+Enter quebra linha — o padrão de
                // qualquer campo de comentário/chat
                if (e.key === "Enter" && !e.shiftKey && texto.trim()) {
                  e.preventDefault();
                  enviar.mutate();
                }
              }}
              placeholder="Escrever um comentário… (Enter envia)"
              rows={2}
              style={{ ...est.entrada, resize: "vertical", lineHeight: 1.5, minHeight: 44 }}
            />
            {erro && (
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: est.vermelho }}>
                {erro}
              </span>
            )}
          </div>
          <button
            onClick={() => enviar.mutate()}
            disabled={!texto.trim() || enviar.isPending}
            aria-label="Enviar comentário"
            style={{
              height: 44, borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
              color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: texto.trim() ? "pointer" : "default", opacity: texto.trim() ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            {enviar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}

// ── O painel ────────────────────────────────────────────────────────────────

interface Props {
  chamadoId: string | null;
  aoFechar: () => void;
  /** leva para a página completa — onde ficam execução, fotos e assinatura */
  aoAbrirPagina: (id: string) => void;
}

export function PainelChamado({ chamadoId, aoFechar, aoAbrirPagina }: Props) {
  const est = useEstiloCampo();
  const { isLight } = useTheme();
  const qc = useQueryClient();
  const { data: chamado, isLoading } = useChamado(chamadoId ?? undefined);
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();
  const { data: apoios = [] } = useChamadoApoios(chamadoId ?? undefined);

  const [estados, setEstados] = useState<Record<string, EstadoCampo>>({});

  // troca de chamado zera os avisos: um "salvo" verde herdado do cartão
  // anterior diria que algo foi gravado neste, que não foi
  useEffect(() => { setEstados({}); }, [chamadoId]);

  const superficie = isLight ? "#ffffff" : "#0f0f15";
  const cabecalhoBg = isLight ? "#f7f7f5" : "#16161d";

  const salvar = useMutation({
    mutationFn: async ({ patch }: { campo: string; patch: ChamadoPatch }) => {
      if (!chamadoId) throw new Error("sem chamado");
      await atualizarChamado(chamadoId, patch);
    },
    onMutate: ({ campo }) => setEstados((e) => ({ ...e, [campo]: "salvando" })),
    onSuccess: (_d, { campo }) => {
      setEstados((e) => ({ ...e, [campo]: "salvo" }));
      // o que está atrás precisa refletir na hora: mudar o responsável e ver o
      // cartão no lugar antigo faz duvidar de que salvou
      qc.invalidateQueries({ queryKey: ["chamado", chamadoId] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
      qc.invalidateQueries({ queryKey: ["home-historico"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      setTimeout(() => setEstados((e) => (e[campo] === "salvo" ? { ...e, [campo]: "parado" } : e)), 1600);
    },
    onError: (err, { campo }) => {
      // o código do erro na tela: RLS negando aparece como PRV-INI-PERM-42501
      // e a pessoa sabe que é permissão, não campo mal preenchido
      setEstados((e) => ({ ...e, [campo]: { erro: codigoDeErro(err, "/dashboard") } }));
    },
  });

  const mexerApoio = useMutation({
    mutationFn: async ({ id, remover }: { id: string; remover: boolean }) => {
      if (!chamadoId) throw new Error("sem chamado");
      if (remover) await removerApoio(chamadoId, id);
      else await adicionarApoio(chamadoId, id);
    },
    onMutate: () => setEstados((e) => ({ ...e, apoio: "salvando" })),
    onSuccess: () => {
      setEstados((e) => ({ ...e, apoio: "salvo" }));
      qc.invalidateQueries({ queryKey: ["chamado-apoios", chamadoId] });
      qc.invalidateQueries({ queryKey: ["home-apoios-todos"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      setTimeout(() => setEstados((e) => (e.apoio === "salvo" ? { ...e, apoio: "parado" } : e)), 1600);
    },
    onError: (err) => setEstados((e) => ({ ...e, apoio: { erro: codigoDeErro(err, "/dashboard") } })),
  });

  const natureza = (chamado?.natureza ?? "campo") as Natureza;

  const pessoasOrdenadas = useMemo(
    () => [...(pessoas as any[])].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [pessoas],
  );
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas as any[]), [pessoas]);
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [clientes],
  );
  const nomeDe = (id: string) => pessoasPorId[id]?.nome ?? "Alguém";

  const info = chamado ? chamadoStatusInfo(chamado.status) : null;
  const tipo = (chamado?.tipo ?? null) as ChamadoTipo | null;
  const prio = (chamado?.prioridade ?? null) as ChamadoPrioridade | null;
  const atrasado = chamado
    ? situacaoPrazo(chamado.prazo_limite, chamado.status) === "estourado"
    : false;

  // opções de cliente/pessoa no formato que CampoComBusca espera
  const opcoesClientes: OpcaoBusca[] = useMemo(
    () => clientesOrdenados.map((c) => ({
      valor: c.id, rotulo: c.nome, secundario: (c as any).posto_servico ?? undefined,
    })),
    [clientesOrdenados],
  );
  const opcoesPessoas: OpcaoBusca[] = useMemo(
    () => pessoasOrdenadas.map((p) => ({
      valor: p.id, rotulo: p.nome, secundario: p.equipe ? EQUIPE_LABEL[p.equipe as Equipe] : undefined,
    })),
    [pessoasOrdenadas],
  );

  return (
    <Sheet open={!!chamadoId} onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <SheetContent
        side="right"
        className="p-0"
        style={{
          // Mais largo a pedido do Davi, mantendo o teto de 60% da tela: o
          // painel informa sobre um item do quadro que continua atrás — cobrir
          // tudo transformaria a consulta rápida em troca de página. O piso de
          // 380px é o mínimo em que os campos ainda cabem no celular.
          width: "min(60vw, 880px)",
          maxWidth: "60vw",
          minWidth: "min(380px, 100vw)",
          background: superficie,
          borderLeft: est.borda,
        }}
      >
        {isLoading || !chamado ? (
          <div style={{ padding: 28, fontFamily: FONT, fontSize: 14, color: est.textSecondary }}>
            {isLoading ? "Carregando…" : "Chamado não encontrado."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

            {/* ── CABEÇALHO: identidade e estado ───────────────────────── */}
            <div style={{
              padding: "20px 22px 16px", borderBottom: est.borda,
              background: cabecalhoBg, flexShrink: 0,
            }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => aoAbrirPagina(chamado.id)}
                  title="Abrir a página completa"
                  style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 11,
                    border: est.borda, background: est.campoBg, color: est.textSecondary,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    marginRight: 28, // o X de fechar do Sheet mora no canto
                    marginTop: -6,
                  }}
                >
                  <ExternalLink size={16} />
                </button>
              </div>

              {/* O TÍTULO É O CABEÇALHO — grande, editável no lugar. A sigla
                  CH-... SAIU DA VISTA de vez (2026-08-22, Davi: "remova a
                  sigla do título") — não sobra em linha nenhuma perto dele.
                  Continua acessível só pelo TOOLTIP ao passar o mouse, porque
                  é assim que o chamado se pede por telefone — o mesmo padrão
                  da R43 na tabela da Início. */}
              <div title={chamado.numero ?? undefined}>
                <Texto
                  valor={chamado.titulo ?? ""}
                  chaveReset={chamadoId}
                  placeholder="Sem título"
                  aoSalvar={(v) => salvar.mutate({ campo: "titulo", patch: { titulo: v } })}
                  estiloProprio={{
                    fontSize: 19, fontWeight: 600, minHeight: 0,
                    padding: "6px 8px", marginLeft: -8, marginTop: -4,
                    background: "transparent", border: "1px solid transparent",
                    borderRadius: 10, letterSpacing: "-0.01em",
                  }}
                />
              </div>

              {/* ETIQUETAS — a leitura de estado, nas cores dos cards */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", marginTop: 10 }}>
                {info && (
                  <Etiqueta
                    forte
                    texto={info.label}
                    cor={{ dark: info.color, light: info.colorLight, bg: info.bg }}
                  />
                )}
                {tipo && TIPO_CORES[tipo] && (
                  <Etiqueta texto={TIPO_LABEL[tipo]} cor={TIPO_CORES[tipo]} />
                )}
                {prio && PRIORIDADE_CORES[prio] && (
                  <Etiqueta texto={PRIORIDADE_LABEL[prio]} cor={PRIORIDADE_CORES[prio]} />
                )}
                {atrasado && (
                  <Etiqueta texto="Atrasado" cor={PRISMA.vermelho} forte />
                )}
                <span style={{ flex: 1 }} />
                {/* a data de criação é INFORMAÇÃO, não campo (ver cabeçalho) */}
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: est.textSecondary }}>
                  Recebido em{" "}
                  {new Date(chamado.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {/* ── CAMPOS ───────────────────────────────────────────────── */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              padding: "6px 22px 32px", display: "flex", flexDirection: "column", gap: 14,
            }}>
              <Secao titulo="De quem é" />

              {/* Cliente, Responsável e Apoio NA MESMA LINHA (2026-08-22,
                  Davi): são três respostas para "de quem é isto?", e lado a
                  lado é como se lê uma resposta composta. Os três usam campo
                  COM BUSCA — são as listas longas (192 clientes) onde rolar
                  custa mais que digitar — e os três mostram um ícone/foto ao
                  lado do nome escolhido. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <Campo titulo="Cliente" estado={estados.cliente_id}>
                  <CampoComBusca
                    id="painel-cliente"
                    opcoes={opcoesClientes}
                    valor={chamado.cliente_id ?? null}
                    vazio="— sem cliente —"
                    aoMudar={(v) => salvar.mutate({ campo: "cliente_id", patch: { cliente_id: v } })}
                    iconeEsquerda={(esc) => esc ? <Building2 size={15} color={est.textSecondary} /> : null}
                  />
                </Campo>

                <Campo titulo="Responsável" estado={estados.responsavel_id}>
                  <CampoComBusca
                    id="painel-responsavel"
                    opcoes={opcoesPessoas}
                    valor={chamado.responsavel_id ?? null}
                    vazio="— sem responsável —"
                    aoMudar={(v) => salvar.mutate({ campo: "responsavel_id", patch: { responsavel_id: v } })}
                    iconeEsquerda={(esc) => esc
                      ? <AvatarCirculo id={esc.valor} nome={esc.rotulo} pessoa={pessoasPorId[esc.valor]} tamanho={18} />
                      : null}
                  />
                </Campo>

                <Campo titulo="Apoio" estado={estados.apoio}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {apoios.map((id) => (
                      <span key={id} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 6px 4px 6px", borderRadius: 999,
                        background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)",
                        fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: est.textPrimary,
                      }}>
                        <AvatarCirculo id={id} nome={nomeDe(id)} pessoa={pessoasPorId[id]} tamanho={17} />
                        {nomeDe(id)}
                        <button
                          onClick={() => mexerApoio.mutate({ id, remover: true })}
                          aria-label={`Remover ${nomeDe(id)} do apoio`}
                          style={{
                            border: "none", background: "transparent", cursor: "pointer",
                            color: est.textSecondary, display: "flex", padding: 2,
                          }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                    <div style={{ minWidth: 150, flex: 1 }}>
                      <CampoComBusca
                        id="painel-apoio"
                        compacto
                        limpavel={false}
                        placeholder="+ adicionar"
                        // quem já está na atividade sai da lista: oferecer de
                        // novo quem já é apoio só produz chave repetida
                        opcoes={opcoesPessoas.filter(
                          (o) => o.valor !== chamado.responsavel_id && !apoios.includes(o.valor),
                        )}
                        valor={null}
                        aoMudar={(v) => { if (v) mexerApoio.mutate({ id: v, remover: false }); }}
                      />
                    </div>
                  </div>
                </Campo>
              </div>
              {/* o nome que veio do Notion, quando não há vínculo (U31): sem
                  isto o campo pareceria vazio numa atividade que TEM cliente */}
              {!chamado.cliente_id && chamado.cliente_origem_nome && (
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: est.textSecondary, marginTop: -8, lineHeight: 1.5 }}>
                  No Notion estava como{" "}
                  <strong style={{ color: est.gold }}>{chamado.cliente_origem_nome}</strong>
                  {" "}— escolha Cliente acima para vincular ao cadastro do QAP.
                </div>
              )}

              <DescricaoComFerramentas
                estado={estados.descricao_problema}
                chaveReset={chamadoId}
                valor={chamado.descricao_problema ?? ""}
                aoSalvar={(v) => salvar.mutate({
                  campo: "descricao_problema", patch: { descricao_problema: v || null },
                })}
              />

              <Secao titulo="Classificação" />

              {/* Os 4 itens NA MESMA LINHA (2026-08-22, Davi) — 150px de piso
                  por coluna, não 210: com 4 colunas em vez de 2, o piso maior
                  faria a grade quebrar em duas linhas no próprio painel de
                  880px, e é exatamente essa quebra que ela pediu para acabar. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
                <Escolha
                  titulo="Tipo de demanda" estado={estados.tipo} valor={chamado.tipo ?? null}
                  vazio="— sem tipo —"
                  // os tipos seguem a natureza: oferecer "corretiva" num chamado
                  // interno criaria um registro que nenhuma tela sabe ler
                  opcoes={tiposDaNatureza(natureza).map((t) => ({ v: t, t: TIPO_LABEL[t] }))}
                  cor={tipo && TIPO_CORES[tipo] ? (isLight ? TIPO_CORES[tipo].light : TIPO_CORES[tipo].dark) : undefined}
                  aoMudar={(v) => salvar.mutate({ campo: "tipo", patch: { tipo: v as any } })}
                />
                <Escolha
                  titulo="Status" estado={estados.status} valor={chamado.status ?? null}
                  opcoes={statusDaNatureza(natureza).map((s) => ({ v: s, t: chamadoStatusInfo(s).label }))}
                  cor={info ? (isLight ? info.colorLight : info.color) : undefined}
                  aoMudar={(v) => salvar.mutate({ campo: "status", patch: { status: v as any } })}
                />
                <Escolha
                  titulo="Prioridade" estado={estados.prioridade} valor={chamado.prioridade ?? null}
                  vazio="— sem prioridade —"
                  opcoes={(["baixa", "normal", "alta", "urgente"] as ChamadoPrioridade[])
                    .map((p) => ({ v: p, t: PRIORIDADE_LABEL[p] }))}
                  cor={prio && PRIORIDADE_CORES[prio] ? (isLight ? PRIORIDADE_CORES[prio].light : PRIORIDADE_CORES[prio].dark) : undefined}
                  aoMudar={(v) => salvar.mutate({ campo: "prioridade", patch: { prioridade: v as any } })}
                />
                <Escolha
                  titulo="Equipe" estado={estados.equipe} valor={chamado.equipe ?? null}
                  vazio="— sem equipe —"
                  opcoes={(Object.keys(EQUIPE_LABEL) as Equipe[])
                    .map((e) => ({ v: e, t: EQUIPE_LABEL[e] }))}
                  aoMudar={(v) => salvar.mutate({ campo: "equipe", patch: { equipe: v as any } })}
                />
              </div>

              <Secao titulo="Quando" />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
                <Campo titulo="Prazo" estado={estados.prazo_limite}>
                  <input
                    type="date"
                    value={prazoParaData(chamado.prazo_limite)}
                    onChange={(e) => {
                      const prazo = dataParaPrazo(e.target.value || null);
                      // R40: o sprint SAI do prazo. Vai no MESMO patch, não em
                      // dois — duas gravações poderiam deixar o prazo novo com
                      // o sprint velho se a segunda falhasse, que é justamente
                      // a divergência que esta regra existe para acabar.
                      const sprint = sprintDoPrazo(prazo);
                      salvar.mutate({
                        campo: "prazo_limite",
                        patch: sprint ? { prazo_limite: prazo, sprint } : { prazo_limite: prazo },
                      });
                    }}
                    style={{
                      ...est.entrada,
                      // atrasado se anuncia no próprio campo: é a informação que
                      // decide se este chamado é o próximo a ser tocado
                      color: atrasado ? est.vermelho : est.textPrimary,
                      fontWeight: atrasado ? 700 : 500,
                      borderColor: atrasado ? est.vermelho : undefined,
                    }}
                  />
                </Campo>
                {/* O sprint continua editável à mão: a derivação cobre o caso
                    comum, e ainda existe o planejamento que não sai da data
                    (algo sem prazo que se quer puxar para esta semana). */}
                <Escolha
                  titulo="Sprint" estado={estados.sprint} valor={chamado.sprint ?? null}
                  vazio="— sem sprint —"
                  opcoes={SPRINT_ORDEM.map((s) => ({ v: s, t: SPRINT_LABEL[s] }))}
                  aoMudar={(v) => salvar.mutate({ campo: "sprint", patch: { sprint: v as any } })}
                />
                {/* Agendamento só faz sentido em campo: é a hora de a dupla
                    sair. No chamado interno o que organiza é a sprint. */}
                {natureza === "campo" && (
                  <Campo titulo="Agendado para" estado={estados.data_hora_agendada}>
                    <input
                      type="datetime-local"
                      value={chamado.data_hora_agendada
                        ? paraEntradaLocal(chamado.data_hora_agendada) : ""}
                      onChange={(e) => salvar.mutate({
                        campo: "data_hora_agendada",
                        patch: {
                          data_hora_agendada: e.target.value
                            ? new Date(e.target.value).toISOString() : null,
                        },
                      })}
                      style={est.entrada}
                    />
                  </Campo>
                )}
              </div>

              {/* A proposta tem fluxo próprio (visita → orçamento → envio) e
                  este painel não o substitui: mexer no funil pelo atalho das
                  propriedades deixaria a visita e a capa contando histórias
                  diferentes. O caminho é a página da visita. */}
              {natureza === "comercial" && (
                <button
                  onClick={() => aoAbrirPagina(chamado.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "13px 18px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                    color: "#08090E", cursor: "pointer",
                    fontFamily: FONT, fontWeight: 700, fontSize: 13,
                  }}
                >
                  <ExternalLink size={15} /> Abrir o fluxo da proposta
                </button>
              )}

              {/* COMENTÁRIOS — depois do último campo (2026-08-22, Davi):
                  discussão SOBRE o chamado, não uma propriedade dele. */}
              <Comentarios chamadoId={chamado.id} pessoasPorId={pessoasPorId} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * ISO → "AAAA-MM-DDTHH:MM" na hora LOCAL, que é o que o input espera.
 * `toISOString().slice(0,16)` devolveria UTC e mostraria a visita das 9h como
 * 12h — três horas de diferença que ninguém repara até alguém perder a hora.
 */
function paraEntradaLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
