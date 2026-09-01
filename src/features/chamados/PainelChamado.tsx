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

import {
  Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check, ExternalLink, Loader2, X, Building2, Send, MessageSquare,
  Bold, Italic, ListChecks, List, Layers,
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
import { useRascunhoSalvo } from "@/hooks/useRascunhoSalvo";
import {
  useChamado, usePessoas, useChamadoApoios, useChamadoLocais, useChamadoEventos,
  atualizarChamado, adicionarApoio, removerApoio,
  adicionarClienteChamado, removerClienteChamado,
  adicionarSetorChamado, removerLocalChamado,
  comentarChamado, mapaDePessoas,
  type ChamadoPatch,
} from "@/features/chamados/data";
import { useClientes, SERVICO_ORDEM, SERVICO_LABEL, SERVICO_CORES, type ServicoCliente } from "@/features/clientes/data";
import {
  PRIORIDADE_LABEL, PRIORIDADE_CORES, SPRINT_LABEL, SPRINT_ORDEM, TIPO_LABEL, TIPO_CORES,
  chamadoStatusInfo, statusDaNatureza, tiposDaNatureza,
  prazoParaData, dataParaPrazo, situacaoPrazo, sprintDoPrazo,
  type ChamadoPrioridade, type ChamadoTipo, type Natureza,
} from "@/lib/chamado-status";
import { EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import { AgendaDoChamado } from "@/features/programacao/AgendaDoChamado";

/**
 * O estado de um campo que grava sozinho.
 *
 * `codigo` ENTROU NA U79, e a ausência dele era um defeito real: o `onError`
 * fazia `codigoDeErro(err, …)` e punha o RESULTADO no lugar da mensagem —
 * `PRV-INI-PERM-42501` —, DESCARTANDO `err.message`. Com as portas da agenda,
 * quem manda a frase é o banco, e ela é o produto: "Esta equipe já está em
 * CH-0012 · Portão das 09:00 às 11:00 nesse dia." Perder isso e mostrar só um
 * código é trocar a explicação pela etiqueta. Agora a MENSAGEM é o texto e o
 * código é o complemento — e o alargamento vale para todos os campos do painel,
 * de propósito.
 */
export type EstadoCampo = "parado" | "salvando" | "salvo" | { erro: string; codigo?: string };

/**
 * A frase que o servidor mandou, quando ele mandou uma. As RPCs da agenda (U78)
 * e `GravacaoRecusada` já vêm em português e prontas para ler; o resto do mundo
 * manda inglês de driver, e aí o código é mais útil do que a frase.
 */
function mensagemDoErro(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  const texto = typeof m === "string" ? m.trim() : "";
  if (!texto) return "Não consegui salvar.";
  // heurística estreita e declarada: o que vem sem acento e sem espaço em
  // português quase sempre é mensagem de driver
  return /[ãáéíóúçâêô]| não | não$/i.test(texto) || texto.length < 90 ? texto : "Não consegui salvar.";
}

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
    // branca no escuro / quase-preta no claro (Davi, 2026-08-22: "altere para
    // cor branca os títulos de cada caixa") — é `textPrimary`, não um "#fff"
    // fixo, porque o painel abre nos dois temas (anti-padrão §8 do design
    // system: cor fixa fora de branch de tema já foi bug de produção aqui).
    rotulo: {
      fontFamily: FONT, fontWeight: 600, fontSize: 11,
      letterSpacing: "0.02em", color: textPrimary,
    } as CSSProperties,
    entrada: {
      width: "100%", boxSizing: "border-box", minHeight: 44,
      fontFamily: FONT, fontSize: 14, fontWeight: 500, color: textPrimary,
      background: campoBg, border: borda, borderRadius: 12,
      padding: "11px 13px", outline: "none",
      // sem isto o ícone de calendário dos <input type="date"/"datetime-local">
      // rende no esquema claro do UA e some sobre o campo escuro do painel.
      colorScheme: isLight ? "light" : "dark",
    } as CSSProperties,
  };
}

function Selo({ estado }: { estado?: EstadoCampo }) {
  const { textSecondary, verde, vermelho } = useEstiloCampo();
  if (estado === "salvando") return <Loader2 size={13} className="animate-spin" color={textSecondary} />;
  if (estado === "salvo") return <Check size={13} color={verde} />;
  if (estado && typeof estado === "object") {
    return (
      <span style={{ fontSize: 10, color: vermelho, minWidth: 0 }}>
        <span style={{ fontFamily: FONT, fontWeight: 500 }}>{estado.erro}</span>
        {estado.codigo && (
          <span style={{ fontFamily: "ui-monospace, Menlo, monospace", opacity: 0.8 }}>
            {" "}{estado.codigo}
          </span>
        )}
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

/**
 * `idAlvo` é só para quando `children` tem MAIS de um elemento "labelable"
 * (a barra de ferramentas da Descrição tem 4 botões antes do textarea) — sem
 * ele, o HTML associa o `<label>` implícito ao PRIMEIRO labelable da lista, e
 * clicar no rótulo focaria o botão "Negrito" em vez do campo de texto
 * (achado da revisão adversarial de U40, 2026-08-21). Com um só controle
 * (o caso comum — select, input), a associação implícita já funciona e
 * `idAlvo` fica de fora.
 */
function Campo({ titulo, estado, children, idAlvo }: {
  titulo: string; estado?: EstadoCampo; children: ReactNode; idAlvo?: string;
}) {
  const { rotulo } = useEstiloCampo();
  return (
    <label htmlFor={idAlvo} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
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
  // U72: grava sozinho depois de 700ms parado, e ainda no blur. Ver o
  // cabeçalho de useRascunhoSalvo para a corrida que a guarda de foco evita.
  const r = useRascunhoSalvo(valor, aoSalvar, chaveReset);
  const estilo = { ...entrada, ...estiloProprio };
  const campo = (
    <input
      value={r.valor}
      placeholder={placeholder}
      onChange={(e) => r.mudar(e.target.value)}
      onFocus={r.aoFocar}
      onBlur={r.aoDesfocar}
      style={estilo}
    />
  );
  // sem rótulo = é o título no cabeçalho. Mesmo assim ele PRECISA do selo:
  // com autosave não existe mais o clique que confirma que gravou, e o
  // título era o único campo do painel que salvava sem dizer nada — inclusive
  // quando falhava.
  return titulo
    ? <Campo titulo={titulo} estado={estado}>{campo}</Campo>
    : (
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{campo}</div>
        <Selo estado={estado} />
      </div>
    );
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
  // U72: autosave com guarda de foco (ver useRascunhoSalvo).
  const r0 = useRascunhoSalvo(valor, aoSalvar, chaveReset);
  const v = r0.valor;
  const setV = r0.mudar;
  const ref = useRef<HTMLTextAreaElement>(null);
  // seleção a restaurar DEPOIS do próximo render — o clique no botão muda o
  // valor controlado, e só depois de o React repintar dá para reposicionar
  // o cursor no DOM novo
  const selecaoPendente = useRef<{ inicio: number; fim: number } | null>(null);

  useEffect(() => {
    if (!selecaoPendente.current || !ref.current) return;
    const { inicio, fim } = selecaoPendente.current;
    ref.current.focus();
    ref.current.setSelectionRange(inicio, fim);
    selecaoPendente.current = null;
  }, [v]);

  // caixa que CRESCE com o texto, sem scroll interno (Davi, 2026-08-22:
  // "remova o scroll interno da caixa de texto"). `useLayoutEffect`, não
  // `useEffect`: precisa medir e aplicar a altura ANTES da pintura, senão o
  // usuário vê um flash com a caixa no tamanho antigo. Zera para "auto"
  // primeiro — sem isso, `scrollHeight` de uma caixa que ENCOLHEU (por
  // exemplo, apagou um parágrafo) ainda leria a altura antiga, porque
  // scrollHeight nunca é menor que a altura já aplicada.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [v]);

  function aplicar(f: BotaoFerramenta) {
    const el = ref.current;
    if (!el) return;
    const r = f.aplicar(v, el.selectionStart ?? v.length, el.selectionEnd ?? v.length);
    // idempotente (clicar Checklist numa linha que já é checklist, por
    // exemplo) devolve o MESMO valor — se armasse a seleção pendente mesmo
    // assim, o valor idêntico faria o React pular o re-render (bail-out), o
    // useEffect ligado a [v] nunca rodaria, e a seleção ficaria PRESA aqui
    // até a próxima tecla real — que então teria o cursor puxado de volta
    // pra este ponto velho, digitando fora de ordem sem aviso nenhum
    // (achado da revisão adversarial de U40, 2026-08-21).
    if (r.valor === v) return;
    selecaoPendente.current = { inicio: r.selecaoInicio, fim: r.selecaoFim };
    setV(r.valor);
  }

  return (
    <Campo titulo="Descrição" estado={estado} idAlvo="painel-descricao-texto">
      <div style={{
        border: est.borda, borderRadius: 12, overflow: "hidden", background: est.campoBg,
      }}>
        {/* a barra fica DENTRO da borda do campo — lê como parte dele, não
            como uma fileira de botões soltos acima. Cada botão tem chapa e
            borda de verdade agora (.ferramenta-botao, styles.css) — Davi,
            2026-08-22: "um botão de virar checklist ou lista que seja um
            botão UI com design", não um ícone flutuando sem contorno. O
            divisor separa formatação de texto (negrito/itálico) de
            formatação de linha (checklist/lista) — dois grupos, não quatro
            botões soltos. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5, padding: "7px 8px",
          borderBottom: est.borda,
        }}>
          {FERRAMENTAS.map((f, i) => (
            <Fragment key={f.titulo}>
              {i === 2 && (
                <span style={{ width: 1, height: 22, background: "var(--border-color)", flexShrink: 0 }} />
              )}
              <button
                type="button"
                title={f.titulo}
                aria-label={f.titulo}
                className="ferramenta-botao"
                // mousedown, não click: click chega DEPOIS do blur do
                // textarea, que já teria apagado selectionStart/End
                onMouseDown={(e) => { e.preventDefault(); aplicar(f); }}
                style={{
                  // 44px, não 30: o alvo de toque mínimo que o resto do painel
                  // já segue (useEstiloCampo, linha ~87) — o painel abre no
                  // celular também (achado da revisão adversarial de U40).
                  width: 44, height: 44,
                }}
              >
                <f.Icon size={16} />
              </button>
            </Fragment>
          ))}
        </div>
        <textarea
          id="painel-descricao-texto"
          ref={ref}
          value={v}
          placeholder="O que precisa ser feito, o que já se sabe…"
          onChange={(e) => setV(e.target.value)}
          onFocus={r0.aoFocar}
          onBlur={r0.aoDesfocar}
          style={{
            width: "100%", boxSizing: "border-box", display: "block",
            fontFamily: FONT, fontSize: 14, fontWeight: 500, color: est.textPrimary,
            background: "transparent", border: "none", outline: "none",
            // a caixa cresce com o texto (useLayoutEffect acima) — por isso
            // `resize: none` (arrastar bugaria contra o auto-ajuste no
            // próximo caractere) e `overflow: hidden` (sem isso o navegador
            // ainda mostra a barra de rolagem interna por 1 frame antes do
            // JS medir). minHeight seguindo o piso visual de 5 linhas que a
            // caixa sempre teve — encolher além disso pareceria um bug.
            padding: "11px 13px", lineHeight: 1.55, resize: "none",
            overflow: "hidden", minHeight: 132,
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
                {/* a foto de quem comentou — a mesma regra de sempre (hash
                    pelo ID, não pelo nome), 2026-08-21 */}
                <span style={{ marginTop: 1, flexShrink: 0 }}>
                  {c.user_id ? (
                    <AvatarCirculo
                      id={c.user_id}
                      nome={pessoasPorId[c.user_id]?.nome ?? "Alguém"}
                      pessoa={pessoasPorId[c.user_id]}
                      tamanho={24}
                    />
                  ) : (
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: est.campoBg, border: est.borda,
                    }}>
                      <MessageSquare size={12} color={est.textSecondary} />
                    </span>
                  )}
                </span>
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
                // !enviar.isPending espelha o disabled do botão (linha
                // abaixo) — sem ele, Enter duas vezes rápido (ou o repeat de
                // tecla do SO) envia o mesmo comentário duas vezes, porque
                // `texto` só é limpo no onSuccess, depois de a rede responder
                // (achado da revisão adversarial de U40, 2026-08-21).
                if (e.key === "Enter" && !e.shiftKey && texto.trim() && !enviar.isPending) {
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
  const { data: locais = [] } = useChamadoLocais(chamadoId ?? undefined);

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
      setEstados((e) => ({ ...e, [campo]: { erro: mensagemDoErro(err), codigo: codigoDeErro(err, "/dashboard") } }));
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
    onError: (err) => setEstados((e) => ({ ...e, apoio: { erro: mensagemDoErro(err), codigo: codigoDeErro(err, "/dashboard") } })),
  });

  // Cliente virou campo de MÚLTIPLOS valores (R54, Davi: "uma atividade pode
  // ser para mais de um cliente"). `cliente_id` (em `chamados`) continua o
  // principal — quem grava decide sozinho pra qual tabela escrever (ver
  // adicionarClienteChamado/removerClienteChamado em data.ts); o painel só
  // invalida as DUAS queries porque não sabe de antemão qual delas mudou.
  const mexerCliente = useMutation({
    mutationFn: async ({ id, remover }: { id: string; remover: boolean }) => {
      if (!chamadoId) throw new Error("sem chamado");
      if (remover) await removerClienteChamado(chamadoId, chamado?.cliente_id ?? null, id);
      else await adicionarClienteChamado(chamadoId, chamado?.cliente_id ?? null, id);
    },
    onMutate: () => setEstados((e) => ({ ...e, cliente_id: "salvando" })),
    onSuccess: () => {
      setEstados((e) => ({ ...e, cliente_id: "salvo" }));
      qc.invalidateQueries({ queryKey: ["chamado", chamadoId] });
      qc.invalidateQueries({ queryKey: ["chamado-locais", chamadoId] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      setTimeout(() => setEstados((e) => (e.cliente_id === "salvo" ? { ...e, cliente_id: "parado" } : e)), 1600);
    },
    onError: (err) => setEstados((e) => ({ ...e, cliente_id: { erro: mensagemDoErro(err), codigo: codigoDeErro(err, "/dashboard") } })),
  });

  // O atalho do SETOR (R85). Até a U71 isto expandia o grupo em N clientes;
  // agora grava UMA etiqueta. Davi, 2026-08-26: "quando for o setor você pode
  // usar a etiqueta 'Portaria Remota'". A etiqueta é melhor que a expansão por
  // dois motivos: o card cabe (oitenta chips não cabem em 260px) e a lista
  // reflete o cadastro de HOJE, em vez de congelar quem era do setor no dia em
  // que alguém clicou. Quem precisa dos clientes expande na leitura, por
  // `servicos_prestados`.
  const mexerSetor = useMutation({
    mutationFn: async ({ setor, remover }: { setor: ServicoCliente; remover: boolean }) => {
      if (!chamadoId) throw new Error("sem chamado");
      if (remover) {
        const linha = locais.find((l) => l.setor === setor);
        if (linha) await removerLocalChamado(linha.id);
      } else {
        await adicionarSetorChamado(chamadoId, setor);
      }
    },
    onMutate: () => setEstados((e) => ({ ...e, cliente_id: "salvando" })),
    onSuccess: () => {
      setEstados((e) => ({ ...e, cliente_id: "salvo" }));
      qc.invalidateQueries({ queryKey: ["chamado", chamadoId] });
      qc.invalidateQueries({ queryKey: ["chamado-locais", chamadoId] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      setTimeout(() => setEstados((e) => (e.cliente_id === "salvo" ? { ...e, cliente_id: "parado" } : e)), 1600);
    },
    onError: (err) => setEstados((e) => ({ ...e, cliente_id: { erro: mensagemDoErro(err), codigo: codigoDeErro(err, "/dashboard") } })),
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
  const clientesPorId = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c])) as Record<string, (typeof clientes)[number]>,
    [clientes],
  );
  const nomeClienteDe = (id: string) => clientesPorId[id]?.nome ?? "Cliente";
  // [principal, ...extras] — sempre nesta ordem, sem duplicar se por algum
  // motivo o principal também aparecer em chamado_locais
  const clientesDoChamadoIds = useMemo(() => {
    const principal = chamado?.cliente_id ?? null;
    const extras = locais
      .map((l) => l.cliente_id)
      .filter((id): id is string => !!id && id !== principal);
    return principal ? [principal, ...extras] : extras;
  }, [chamado?.cliente_id, locais]);

  /** Os setores marcados como etiqueta nesta atividade (R85). */
  const setoresDoChamado = useMemo(
    () => locais.map((l) => l.setor).filter((s): s is string => !!s),
    [locais],
  );

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
                  estado={estados.titulo}
                  aoSalvar={(v) => salvar.mutate({ campo: "titulo", patch: { titulo: v } })}
                  estiloProprio={{
                    // maior e em negrito (Davi, 2026-08-22) — 22px/700 é o
                    // "Título de página" do design system (§3), o degrau mais
                    // alto da hierarquia de peso que o sistema carrega
                    fontSize: 22, fontWeight: 700, minHeight: 0,
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
                  lado do nome escolhido.

                  3 COLUNAS FIXAS, não auto-fit/minmax: a 1ª versão usava
                  auto-fit(180px), e numa faixa comum de largura de painel
                  (~522–612px, ex. janela de ~900px) ele resolvia para 2
                  colunas — Apoio sobrava sozinho numa 2ª linha, ocupando só
                  1/3 do espaço ao lado de metade da linha vazia. Fixo nunca
                  quebra: "mesma linha" foi pedido explícito do Davi, não uma
                  sugestão que vale só em painel largo (achado da revisão
                  adversarial de U40, 2026-08-21). minmax(0,1fr), não só 1fr:
                  sem o 0, um nome de cliente comprido poderia empurrar a
                  coluna além da largura justa dela. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                {/* LOCAL, não "Cliente" (R84, Davi 2026-08-26: "a etiqueta de
                    cliente na verdade seria uma etiqueta de LOCAL, este tempo
                    todo estávamos usando a palavra errada"). Campo de MÚLTIPLOS
                    valores, sem limite (R85), no mesmo desenho de "Apoio":
                    chips + busca para adicionar. O primeiro cliente ocupa o
                    slot principal (cliente_id) por baixo dos panos; na tela é
                    só uma lista. O seletor "+ setor" pendura o SETOR INTEIRO
                    como etiqueta — uma linha, não oitenta chips. */}
                <Campo titulo="Local" estado={estados.cliente_id}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {clientesDoChamadoIds.map((id) => (
                      <span key={id} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 6px 4px 6px", borderRadius: 999,
                        background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)",
                        fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: est.textPrimary,
                      }}>
                        <span style={{
                          width: 17, height: 17, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: est.campoBg,
                        }}>
                          <Building2 size={10} color={est.textSecondary} />
                        </span>
                        {nomeClienteDe(id)}
                        <button
                          onClick={() => mexerCliente.mutate({ id, remover: true })}
                          aria-label={`Remover ${nomeClienteDe(id)} da atividade`}
                          style={{
                            border: "none", background: "transparent", cursor: "pointer",
                            color: est.textSecondary, display: "flex", padding: 2,
                          }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                    <div style={{ minWidth: 130, flex: 1 }}>
                      <CampoComBusca
                        id="painel-cliente"
                        compacto
                        limpavel={false}
                        placeholder="+ adicionar"
                        // quem já está na atividade sai da lista: oferecer de
                        // novo quem já foi adicionado só produz chave repetida
                        opcoes={opcoesClientes.filter((o) => !clientesDoChamadoIds.includes(o.valor))}
                        valor={null}
                        aoMudar={(v) => { if (v) mexerCliente.mutate({ id: v, remover: false }); }}
                      />
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) mexerSetor.mutate({ setor: e.target.value as ServicoCliente, remover: false });
                      }}
                      aria-label="Marcar um setor inteiro como local desta atividade"
                      title="Marcar o setor inteiro (todos os clientes daquele serviço)"
                      style={{
                        height: 30, borderRadius: 8, border: est.borda, background: est.campoBg,
                        color: est.textSecondary, fontFamily: FONT, fontSize: 11, fontWeight: 600,
                        padding: "0 5px", cursor: "pointer", flexShrink: 0, outline: "none",
                      }}
                    >
                      <option value="">+ setor</option>
                      {SERVICO_ORDEM.filter((s) => !setoresDoChamado.includes(s)).map((s) => (
                        <option key={s} value={s}>{SERVICO_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>

                  {/* As etiquetas de SETOR ficam numa fileira própria, e com a
                      cor do serviço (SERVICO_CORES, U36) — misturar "Portaria
                      Remota" (oitenta prédios) com "Green Village" (um prédio)
                      na mesma fileira cinza faria os dois parecerem a mesma
                      coisa, e eles não são. */}
                  {setoresDoChamado.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6 }}>
                      {setoresDoChamado.map((s) => {
                        const cor = SERVICO_CORES[s as ServicoCliente];
                        return (
                          <span key={s} style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "4px 6px", borderRadius: 999,
                            background: cor?.bg ?? est.campoBg,
                            color: isLight ? cor?.light : cor?.dark,
                            fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
                          }}>
                            <Layers size={11} style={{ flexShrink: 0 }} />
                            {SERVICO_LABEL[s as ServicoCliente] ?? s}
                            <button
                              onClick={() => mexerSetor.mutate({ setor: s as ServicoCliente, remover: true })}
                              aria-label={`Remover o setor ${SERVICO_LABEL[s as ServicoCliente] ?? s} da atividade`}
                              style={{
                                border: "none", background: "transparent", cursor: "pointer",
                                color: "inherit", display: "flex", padding: 2, opacity: 0.75,
                              }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* o nome que veio do Notion, quando não há vínculo (U31):
                      sem isto o campo pareceria vazio numa atividade que TEM
                      cliente. Só aparece sem NENHUM cliente ainda escolhido —
                      assim que o primeiro é adicionado (deste aviso ou da
                      busca), ele some: a atividade já tem cliente de verdade. */}
                  {clientesDoChamadoIds.length === 0 && chamado.cliente_origem_nome && (
                    <div style={{ fontFamily: FONT, fontSize: 11.5, color: est.textSecondary, lineHeight: 1.5, marginTop: 6 }}>
                      No Notion:{" "}
                      <strong style={{ color: est.gold }}>{chamado.cliente_origem_nome}</strong>
                      {" "}— escolha acima para vincular ao QAP.
                    </div>
                  )}
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

              <DescricaoComFerramentas
                estado={estados.descricao_problema}
                chaveReset={chamadoId}
                valor={chamado.descricao_problema ?? ""}
                aoSalvar={(v) => salvar.mutate({
                  campo: "descricao_problema", patch: { descricao_problema: v || null },
                })}
              />

              <Secao titulo="Classificação" />

              {/* Os 4 itens NA MESMA LINHA (2026-08-22, Davi).
                  4 COLUNAS FIXAS, não auto-fit/minmax(150px): o piso de
                  150px só garantia 4-numa-linha no TETO de 880px do painel —
                  numa faixa comum abaixo disso (~522–686px de painel, ex.
                  janela de ~900px) o auto-fit resolvia 3 colunas, e Equipe
                  sobrava sozinho numa 2ª linha com 2/3 do espaço vazio ao
                  lado — pior que a quebra 2+2 balanceada de antes da
                  mudança (achado da revisão adversarial de U40, 2026-08-21).
                  Fixo nunca quebra — fica estreito em painel pequeno, mas
                  continua "mesma linha", que foi o pedido. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
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
                  // U72: a equipe era o único seletor sem cor, mesmo com
                  // EQUIPE_CORES pronto desde sempre — ficava cinza ao lado de
                  // status, tipo e prioridade coloridos, como se não fosse da
                  // mesma família de escolha.
                  cor={chamado.equipe
                    ? (isLight ? equipeCores(chamado.equipe).light : equipeCores(chamado.equipe).dark)
                    : undefined}
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
                    sair. No chamado interno o que organiza é a sprint.
                    U79: o `datetime-local` que escrevia `data_hora_agendada`
                    direto virou LEITURA DOS BLOCOS + gestos nomeados. A coluna
                    é espelho derivado (R101), e um campo só não sabe
                    representar N blocos — ver o cabeçalho de
                    features/programacao/AgendaDoChamado.tsx. */}
                {natureza === "campo" && (
                  <AgendaDoChamado chamado={chamado as any} />
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

// `paraEntradaLocal` MORREU AQUI (U79), junto com o `datetime-local` que era a
// única razão de ela existir. Ela convertia o instante gravado para a hora do
// NAVEGADOR; quem faz essa ponte agora é `parDoInstante`
// (features/programacao/modelo.ts), que resolve em `America/Sao_Paulo`
// explícito e é a única função daquele arquivo que conhece fuso.
