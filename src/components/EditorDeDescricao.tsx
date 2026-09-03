// O EDITOR DA DESCRIÇÃO — blocos com UI própria, menções e autosave (R135, U95).
//
// Davi, 03/09/2026: "a maior caixa deverá ser um espaço grande para texto,
// neste lugar reservado para texto, quero que você crie ferramentas que não
// sejam ferramentas de texto, mas sim ferramentas com UI personalizado que ao
// adicionar por exemplo uma lista de seleção, não fique os ícones '[ ]' e sim
// uma caixa personalizada de acordo com o nosso design System. Além disso, no
// espaço do texto deve poder mencionar outros usuários."
//
// ── COMO ELE FUNCIONA, EM UMA FRASE ────────────────────────────────────────
// O texto continua sendo Markdown puro no banco (ver lib/texto-rico.ts); o
// editor o quebra em BLOCOS (uma linha = um bloco: parágrafo, item de lista ou
// item de checklist) e desenha cada bloco com a UI certa — a caixa de marcar
// do design system em vez de "[ ]", o ponto em vez de "- ". Só a linha EM
// EDIÇÃO é um <textarea> cru; as outras são pintadas ricas (negrito, itálico,
// menção como chip), e clicar numa delas a põe em edição. Grava pelo mesmo
// `useRascunhoSalvo` de sempre (R90): 700 ms parado, e no blur.
//
// ── A MENÇÃO ───────────────────────────────────────────────────────────────
// Digitar "@" abre a lista de pessoas embaixo da linha; escolher insere o token
// `@[Nome](user:id)`. Quem AVISA a pessoa é o banco (gatilho da U95, que
// compara as menções de antes e de depois — o autosave grava dezenas de vezes
// e a pessoa recebe UM sino). Aqui só se escreve o token.
//
// ── O QUE ELE NÃO É ────────────────────────────────────────────────────────
// Não é um editor rico de HTML/JSON: isso quebraria as telas que leem o texto
// cru e trocaria um formato que qualquer pessoa reconhece por um que só o
// editor lê (a decisão está no cabeçalho de lib/edicao-texto.ts e continua).

import {
  Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent,
} from "react";
import { AtSign, Bold, Italic, List, ListChecks } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { envolverSelecao } from "@/lib/edicao-texto";
import {
  textoParaBlocos, blocosParaTexto, alternarTipo, dividirBloco,
  mencaoEmCurso, completarMencao, filtrarPessoasParaMencao,
  type Bloco, type TipoDeBloco,
} from "@/lib/texto-rico";
import { useRascunhoSalvo } from "@/hooks/useRascunhoSalvo";
import { LinhaRica } from "@/components/TextoComChecklist";
import { AvatarCirculo } from "@/components/PessoaComFoto";

export interface PessoaParaMencao {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

// ── A lista de sugestões do "@" — compartilhada com a caixa de comentário ────

export function SugestoesDeMencao({ pessoas, marcada, aoEscolher, aoMarcar }: {
  pessoas: PessoaParaMencao[];
  marcada: number;
  aoEscolher: (p: PessoaParaMencao) => void;
  aoMarcar: (i: number) => void;
}) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  if (pessoas.length === 0) {
    return (
      <div className="mencao-lista" style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, padding: "8px 10px" }}>
        Ninguém com esse nome.
      </div>
    );
  }
  return (
    <div className="mencao-lista" role="listbox" aria-label="Pessoas para mencionar">
      {pessoas.map((p, i) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={i === marcada}
          // mousedown, não click: o click chega depois do blur do textarea,
          // e o blur fecharia a lista antes de a escolha acontecer
          onMouseDown={(e) => { e.preventDefault(); aoEscolher(p); }}
          onMouseEnter={() => aoMarcar(i)}
          className="hover-suave"
          style={{
            width: "100%", minHeight: 38, padding: "5px 9px", borderRadius: 9,
            display: "flex", alignItems: "center", gap: 8, textAlign: "left",
            background: i === marcada ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)") : "transparent",
            border: "none", cursor: "pointer", color: textPrimary,
            fontFamily: FONT, fontWeight: i === marcada ? 600 : 500, fontSize: 13,
          }}
        >
          <AvatarCirculo id={p.id} nome={p.nome} pessoa={{ nome: p.nome, avatar_url: p.avatar_url ?? null }} tamanho={20} />
          {p.nome}
        </button>
      ))}
    </div>
  );
}

/**
 * O estado do "@" numa caixa de texto qualquer: o que foi digitado depois do
 * arroba, as pessoas que casam, qual está marcada. Usado pelo editor (por
 * linha) e pela caixa de comentário (uma só).
 */
export function useMencao(pessoas: PessoaParaMencao[]) {
  const [consulta, setConsulta] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(0);
  const sugestoes = useMemo(
    () => (consulta === null ? [] : filtrarPessoasParaMencao(pessoas, consulta)),
    [pessoas, consulta],
  );
  useEffect(() => { setMarcada(0); }, [consulta]);
  /** Chame a cada mudança de texto/cursor: abre, atualiza ou fecha a lista. */
  function observar(texto: string, cursor: number) {
    const em = mencaoEmCurso(texto, cursor);
    setConsulta(em ? em.consulta : null);
  }
  const aberta = consulta !== null;
  /**
   * Teclado enquanto a lista está aberta. Devolve a pessoa escolhida no Enter,
   * `true` se a tecla foi consumida, `false` se não era da lista.
   */
  function teclado(e: KeyboardEvent): PessoaParaMencao | boolean {
    if (!aberta) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setMarcada((m) => Math.min(sugestoes.length - 1, m + 1)); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setMarcada((m) => Math.max(0, m - 1)); return true; }
    if (e.key === "Escape") { e.preventDefault(); setConsulta(null); return true; }
    if ((e.key === "Enter" || e.key === "Tab") && sugestoes[marcada]) { e.preventDefault(); return sugestoes[marcada]; }
    return false;
  }
  return { aberta, sugestoes, marcada, setMarcada, observar, fechar: () => setConsulta(null), teclado };
}

// ── A caixa de comentário com "@" ───────────────────────────────────────────

export function TextareaComMencoes({ valor, aoMudar, pessoas, placeholder, estilo, rows = 2, onKeyDown, onFocus, onBlur, id }: {
  valor: string;
  aoMudar: (v: string) => void;
  pessoas: PessoaParaMencao[];
  placeholder?: string;
  estilo?: CSSProperties;
  rows?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const men = useMencao(pessoas);
  const cursorPendente = useRef<number | null>(null);

  useEffect(() => {
    if (cursorPendente.current === null || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(cursorPendente.current, cursorPendente.current);
    cursorPendente.current = null;
  }, [valor]);

  function escolher(p: PessoaParaMencao) {
    const el = ref.current;
    const cursor = el?.selectionStart ?? valor.length;
    const r = completarMencao(valor, cursor, p.nome, p.id);
    cursorPendente.current = r.cursor;
    aoMudar(r.texto);
    men.fechar();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <textarea
        id={id}
        ref={ref}
        value={valor}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => { aoMudar(e.target.value); men.observar(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onKeyUp={(e) => { const el = e.currentTarget; men.observar(el.value, el.selectionStart ?? el.value.length); }}
        onKeyDown={(e) => {
          const r = men.teclado(e);
          if (r === true) return;
          if (r && typeof r === "object") { escolher(r); return; }
          onKeyDown?.(e);
        }}
        onFocus={onFocus}
        onBlur={() => { men.fechar(); onBlur?.(); }}
        style={estilo}
      />
      {men.aberta && (
        <SugestoesDeMencao pessoas={men.sugestoes} marcada={men.marcada} aoEscolher={escolher} aoMarcar={men.setMarcada} />
      )}
    </div>
  );
}

// ── A barra de ferramentas ───────────────────────────────────────────────────

interface Ferramenta {
  Icon: typeof Bold;
  titulo: string;
  /** formatação DENTRO da linha (negrito, itálico): recebe o texto e a seleção */
  aplicar?: (valor: string, ini: number, fim: number) => { valor: string; selecaoInicio: number; selecaoFim: number };
  /** formatação DA LINHA: troca o tipo do bloco */
  tipo?: TipoDeBloco;
  /** a menção: insere o "@" e abre a lista */
  mencao?: boolean;
}

const FERRAMENTAS: Ferramenta[] = [
  { Icon: Bold, titulo: "Negrito", aplicar: (v, i, f) => envolverSelecao(v, i, f, "**", "negrito") },
  { Icon: Italic, titulo: "Itálico", aplicar: (v, i, f) => envolverSelecao(v, i, f, "*", "itálico") },
  { Icon: ListChecks, titulo: "Checklist", tipo: "checklist" },
  { Icon: List, titulo: "Lista", tipo: "lista" },
  { Icon: AtSign, titulo: "Mencionar alguém", mencao: true },
];

// ── O editor ─────────────────────────────────────────────────────────────────

interface Props {
  /** o texto do servidor (Markdown puro) */
  valor: string;
  aoSalvar: (v: string) => void;
  /** muda quando o REGISTRO muda (id do chamado): descarta o rascunho */
  chaveReset?: string | null;
  pessoas: PessoaParaMencao[];
  placeholder?: string;
  /** id do primeiro textarea, para o <label htmlFor> do campo */
  idAlvo?: string;
  minAltura?: number;
  somenteLeitura?: boolean;
}

export function EditorDeDescricao({
  valor, aoSalvar, chaveReset, pessoas, placeholder, idAlvo, minAltura = 220, somenteLeitura = false,
}: Props) {
  const { isLight } = useTheme();
  const r0 = useRascunhoSalvo(valor, aoSalvar, chaveReset);
  const blocos = useMemo(() => textoParaBlocos(r0.valor), [r0.valor]);
  const [focado, setFocado] = useState<number | null>(null);
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);
  // foco a aplicar DEPOIS do próximo render: a linha que vai receber o cursor
  // pode ainda não ser um <textarea> (era uma linha pintada)
  const pendente = useRef<{ i: number; cursor: number; fim?: number } | null>(null);
  const men = useMencao(pessoas);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.62)";
  const campoBg = isLight ? "#ffffff" : "rgba(255,255,255,0.055)";
  const borda = isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)";

  // aplica o foco pendente e a seleção — no DOM novo, depois de pintar
  useLayoutEffect(() => {
    const p = pendente.current;
    if (!p) return;
    const el = areas.current[p.i];
    if (!el) return;
    el.focus();
    const fim = p.fim ?? p.cursor;
    el.setSelectionRange(Math.min(p.cursor, el.value.length), Math.min(fim, el.value.length));
    pendente.current = null;
  });

  // a linha em edição cresce com o texto, sem rolagem interna (o mesmo
  // contrato da caixa antiga: "remova o scroll interno da caixa de texto")
  useLayoutEffect(() => {
    const el = focado === null ? null : areas.current[focado];
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [focado, r0.valor]);

  function escrever(novos: Bloco[]) {
    r0.mudar(blocosParaTexto(novos));
  }
  function focar(i: number, cursor: number, fim?: number) {
    pendente.current = { i, cursor, fim };
    setFocado(i);
  }
  function mudarTexto(i: number, texto: string, cursor: number) {
    const novos = blocos.map((b, k) => (k === i ? { ...b, texto } : b));
    escrever(novos);
    men.observar(texto, cursor);
  }
  function alternarMarcado(i: number) {
    if (somenteLeitura) return;
    escrever(blocos.map((b, k) => (k === i ? { ...b, marcado: !b.marcado } : b)));
  }
  function definirTipo(i: number, tipo: TipoDeBloco) {
    const b = blocos[i];
    if (!b) return;
    const novo = alternarTipo(b, tipo);
    escrever(blocos.map((x, k) => (k === i ? novo : x)));
    focar(i, areas.current[i]?.selectionStart ?? novo.texto.length);
  }

  function aplicar(f: Ferramenta) {
    if (somenteLeitura) return;
    const i = focado ?? 0;
    const b = blocos[i];
    if (!b) return;
    if (f.tipo) { definirTipo(i, f.tipo); return; }
    const el = areas.current[i];
    const ini = el?.selectionStart ?? b.texto.length;
    const fim = el?.selectionEnd ?? b.texto.length;
    if (f.mencao) {
      const antes = b.texto.slice(0, ini);
      const precisaEspaco = antes.length > 0 && !/\s$/.test(antes);
      const texto = antes + (precisaEspaco ? " @" : "@") + b.texto.slice(fim);
      const cursor = ini + (precisaEspaco ? 2 : 1);
      mudarTexto(i, texto, cursor);
      focar(i, cursor);
      return;
    }
    if (!f.aplicar) return;
    const v = b.texto;
    const r = f.aplicar(v, ini, fim);
    // idempotente (nada mudou) → nada a fazer, e nada de seleção presa
    if (r.valor === v) return;
    escrever(blocos.map((x, k) => (k === i ? { ...x, texto: r.valor } : x)));
    focar(i, r.selecaoInicio, r.selecaoFim);
  }

  function escolherMencao(i: number, p: PessoaParaMencao) {
    const b = blocos[i];
    const el = areas.current[i];
    const cursor = el?.selectionStart ?? b.texto.length;
    const r = completarMencao(b.texto, cursor, p.nome, p.id);
    escrever(blocos.map((x, k) => (k === i ? { ...x, texto: r.texto } : x)));
    men.fechar();
    focar(i, r.cursor);
  }

  function teclado(i: number, e: KeyboardEvent<HTMLTextAreaElement>) {
    const b = blocos[i];
    const el = e.currentTarget;
    const cursor = el.selectionStart ?? b.texto.length;

    // a lista do "@" tem prioridade sobre a navegação entre linhas
    const rm = men.teclado(e);
    if (rm === true) return;
    if (rm && typeof rm === "object") { escolherMencao(i, rm); return; }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const { antes, depois } = dividirBloco(b, cursor);
      const novos = [...blocos.slice(0, i), antes, depois, ...blocos.slice(i + 1)];
      escrever(novos);
      focar(i + 1, 0);
      return;
    }
    if (e.key === "Backspace" && cursor === 0 && el.selectionEnd === 0) {
      if (b.tipo !== "paragrafo") {
        // apagar no começo de um item tira o marcador — é o gesto de todo editor
        e.preventDefault();
        escrever(blocos.map((x, k) => (k === i ? { tipo: "paragrafo", texto: x.texto, marcado: false } : x)));
        focar(i, 0);
        return;
      }
      if (i > 0) {
        // junta com a linha de cima: o texto desta vai para o fim da anterior
        e.preventDefault();
        const acima = blocos[i - 1];
        const junto = { ...acima, texto: acima.texto + b.texto };
        escrever([...blocos.slice(0, i - 1), junto, ...blocos.slice(i + 1)]);
        focar(i - 1, acima.texto.length);
        return;
      }
    }
    if (e.key === "ArrowUp" && cursor === 0 && i > 0) {
      e.preventDefault();
      focar(i - 1, blocos[i - 1].texto.length);
      return;
    }
    if (e.key === "ArrowDown" && cursor === b.texto.length && i < blocos.length - 1) {
      e.preventDefault();
      focar(i + 1, 0);
    }
  }

  const estiloTexto: CSSProperties = {
    fontFamily: FONT, fontSize: 14, fontWeight: 500, color: textPrimary, lineHeight: 1.55,
  };

  return (
    <div style={{ border: borda, borderRadius: 12, overflow: "hidden", background: campoBg }}>
      {/* A barra fica DENTRO da borda do campo — lê como parte dele. Cada
          botão tem chapa e borda (.ferramenta-botao). Os divisores separam
          formatação de texto, formatação de linha e a menção. */}
      {!somenteLeitura && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 8px", borderBottom: borda }}>
          {FERRAMENTAS.map((f, i) => (
            <Fragment key={f.titulo}>
              {(i === 2 || i === 4) && (
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
                style={{ width: 44, height: 44, flexShrink: 0 }}
              >
                <f.Icon size={16} />
              </button>
            </Fragment>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10.5, color: textSecondary, paddingRight: 4 }}>
            @ menciona · Enter nova linha
          </span>
        </div>
      )}

      <div
        style={{ padding: "10px 13px 12px", minHeight: minAltura, display: "flex", flexDirection: "column", gap: 2 }}
        // clicar no vazio abaixo da última linha edita a última linha
        onClick={(e) => {
          if (e.target !== e.currentTarget || somenteLeitura) return;
          const ultimo = blocos.length - 1;
          focar(ultimo, blocos[ultimo].texto.length);
        }}
      >
        {blocos.map((b, i) => {
          const emEdicao = focado === i && !somenteLeitura;
          const vazioTotal = blocos.length === 1 && b.texto === "" && b.tipo === "paragrafo";
          return (
            <div key={i} className="editor-linha">
              {/* o MARCADOR da linha, em UI própria — nunca "[ ]" nem "- " */}
              {b.tipo === "checklist" && (
                <label style={{ display: "flex", alignItems: "center", cursor: somenteLeitura ? "default" : "pointer", marginTop: 3 }}>
                  <input
                    type="checkbox"
                    className="checklist-input"
                    checked={b.marcado}
                    disabled={somenteLeitura}
                    onChange={() => alternarMarcado(i)}
                    style={{ display: "none" }}
                  />
                  <span className="checklist-check">
                    <svg width="19" height="19" viewBox="0 0 18 18">
                      <path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z" />
                      <polyline points="1 9 7 14 15 4" />
                    </svg>
                  </span>
                </label>
              )}
              {b.tipo === "lista" && <span className="lista-ponto" aria-hidden="true" style={{ marginTop: 11 }} />}

              <div style={{ flex: 1, minWidth: 0 }}>
                {emEdicao ? (
                  <textarea
                    id={i === 0 ? idAlvo : undefined}
                    ref={(el) => { areas.current[i] = el; }}
                    value={b.texto}
                    rows={1}
                    placeholder={vazioTotal ? placeholder : undefined}
                    onChange={(e) => mudarTexto(i, e.target.value, e.target.selectionStart ?? e.target.value.length)}
                    onKeyDown={(e) => teclado(i, e)}
                    onKeyUp={(e) => { const el = e.currentTarget; men.observar(el.value, el.selectionStart ?? el.value.length); }}
                    onFocus={r0.aoFocar}
                    onBlur={() => { men.fechar(); r0.aoDesfocar(); setFocado((f) => (f === i ? null : f)); }}
                    style={{
                      ...estiloTexto, width: "100%", boxSizing: "border-box", display: "block",
                      background: "transparent", border: "none", outline: "none",
                      padding: "4px 0", resize: "none", overflow: "hidden",
                      textDecoration: b.tipo === "checklist" && b.marcado ? "line-through" : "none",
                      opacity: b.tipo === "checklist" && b.marcado ? 0.7 : 1,
                    }}
                  />
                ) : (
                  <div
                    className="editor-linha-vista"
                    onClick={() => { if (!somenteLeitura) focar(i, b.texto.length); }}
                    style={{
                      ...estiloTexto, padding: "4px 0",
                      color: vazioTotal ? textSecondary : textPrimary,
                      textDecoration: b.tipo === "checklist" && b.marcado ? "line-through" : "none",
                      opacity: b.tipo === "checklist" && b.marcado ? 0.7 : 1,
                    }}
                  >
                    {b.texto === ""
                      ? (vazioTotal ? (placeholder ?? "") : " ")
                      : <LinhaRica texto={b.texto} tamanhoChip={12} />}
                  </div>
                )}
                {emEdicao && men.aberta && (
                  <SugestoesDeMencao
                    pessoas={men.sugestoes}
                    marcada={men.marcada}
                    aoEscolher={(p) => escolherMencao(i, p)}
                    aoMarcar={men.setMarcada}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
