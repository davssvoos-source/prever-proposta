// O EDITOR DE TEXTO — uma área só, blocos com UI própria, menção como chip,
// seleção de várias linhas e autosave (R135, U95; R224, U119).
//
// Davi, 03/09/2026: "a maior caixa deverá ser um espaço grande para texto,
// neste lugar reservado para texto, quero que você crie ferramentas que não
// sejam ferramentas de texto, mas sim ferramentas com UI personalizado que ao
// adicionar por exemplo uma lista de seleção, não fique os ícones '[ ]' e sim
// uma caixa personalizada de acordo com o nosso design System. Além disso, no
// espaço do texto deve poder mencionar outros usuários."
//
// Davi, 08/09/2026 (v0.0.2): "os campos 'Problema Detectado', 'Solução
// Aplicada' e 'Solução' devem ter um sistema de edição de texto bem elaborado
// no design system, com botões inteligentes (selecionar várias linhas e clicar
// em checklist → um item por linha), sem os bugs atuais (o negrito perde a
// seleção, a checklist é difícil de usar) […] ao mencionar alguém o campo
// mostra @[Breno Goes](user:hash) — deve mostrar só o nome."
//
// ── COMO ELE FUNCIONA, EM UMA FRASE ────────────────────────────────────────
// O texto continua sendo Markdown puro no banco (ver lib/texto-rico.ts); o
// editor é UMA área `contentEditable` em que cada linha é um BLOCO
// (`<div data-bloco>`: parágrafo, item de lista ou item de checklist) com o
// marcador em UI própria — a caixa de marcar do design system em vez de
// "[ ]", o ponto em vez de "- " — e a MENÇÃO é um chip atômico
// (`contenteditable=false`) que mostra só o nome: o token `@[Nome](user:id)`
// só existe no texto gravado. A cada tecla o DOM é LIDO de volta para Markdown
// (`lerBlocos`) e gravado pelo mesmo `useRascunhoSalvo` de sempre (R90).
//
// ── POR QUE UMA ÁREA, E NÃO UM <textarea> POR LINHA (a v1, U95) ────────────
// Com um textarea por linha não existe seleção que atravesse linhas — e
// "selecionar várias linhas e virar checklist" era o pedido; o negrito perdia
// a seleção na troca de foco entre a barra e a linha; e a linha em edição
// mostrava o token cru da menção. Os três defeitos eram a arquitetura, não
// detalhes. Aqui a seleção é a do navegador (atravessa blocos), o negrito é o
// `execCommand` nativo (não mexe na seleção) e a menção nunca é texto.
//
// ── O QUE ELE NÃO É ────────────────────────────────────────────────────────
// Não é um editor rico de HTML/JSON: isso quebraria as telas que leem o texto
// cru e trocaria um formato que qualquer pessoa reconhece por um que só o
// editor lê (a decisão está no cabeçalho de lib/edicao-texto.ts e continua).
// O DOM é só a superfície; a verdade é a string.

import {
  Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ClipboardEvent, type CSSProperties, type KeyboardEvent, type MouseEvent,
} from "react";
import { AtSign, Bold, Italic, List, ListChecks } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import {
  textoParaBlocos, blocosParaTexto, linhaParaBloco, segmentar, tokenDeMencao,
  mencaoEmCurso, filtrarPessoasParaMencao,
  type Bloco, type TipoDeBloco,
  hashtagEmCurso,
} from "@/lib/texto-rico";
import { useRascunhoSalvo } from "@/hooks/useRascunhoSalvo";
import { AvatarCirculo } from "@/components/PessoaComFoto";

export interface PessoaParaMencao {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// A PONTE COM O DOM — Markdown → blocos no DOM, e o DOM lido de volta
// ═══════════════════════════════════════════════════════════════════════════
// Tudo aqui é função de DOM pura (recebe nós, devolve nós ou string); nada
// sabe de React. É o que permite ao componente ser pequeno.

const ATR_BLOCO = "data-bloco";
const ATR_MARCADO = "data-marcado";
const CLASSE_MARCADOR = "editor-marcador";
const SVG_CAIXA =
  '<svg width="19" height="19" viewBox="0 0 18 18"><path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z" /><polyline points="1 9 7 14 15 4" /></svg>';

// booleanos, não type guards: um guard `n is HTMLElement` aplicado a um nó
// que JÁ é HTMLElement estreita o ramo falso a `never` (o tsc acusou 9 vezes)
function ehMarcador(n: Node | null): boolean {
  return n instanceof HTMLElement && n.classList.contains(CLASSE_MARCADOR);
}
function ehChip(n: Node | null): boolean {
  return n instanceof HTMLElement && n.dataset.mencao !== undefined;
}
function ehBloco(n: Node | null): n is HTMLElement {
  return n instanceof HTMLElement && n.hasAttribute(ATR_BLOCO);
}

/** O MARCADOR da linha, em UI própria — nunca "[ ]" nem "- ". */
function criarMarcador(tipo: TipoDeBloco): HTMLElement | null {
  if (tipo === "paragrafo") return null;
  const m = document.createElement("span");
  m.className = CLASSE_MARCADOR;
  m.contentEditable = "false";
  m.setAttribute("aria-hidden", "true");
  const miolo = document.createElement("span");
  if (tipo === "checklist") {
    miolo.className = "checklist-check";
    miolo.innerHTML = SVG_CAIXA;
  } else {
    miolo.className = "lista-ponto";
  }
  m.appendChild(miolo);
  return m;
}

/** O chip da menção: mostra "@Nome"; carrega o id para o texto gravado. */
function criarChip(nome: string, userId: string): HTMLElement {
  const s = document.createElement("span");
  s.className = "mencao-chip";
  s.contentEditable = "false";
  s.dataset.mencao = userId;
  s.dataset.nome = nome;
  s.title = `Menção a ${nome}`;
  s.textContent = `@${nome}`;
  return s;
}

function definirTipo(bloco: HTMLElement, tipo: TipoDeBloco, marcado = false) {
  bloco.setAttribute(ATR_BLOCO, tipo);
  if (tipo === "checklist") bloco.setAttribute(ATR_MARCADO, marcado ? "1" : "0");
  else bloco.removeAttribute(ATR_MARCADO);
  for (const n of Array.from(bloco.childNodes)) if (ehMarcador(n)) n.remove();
  const m = criarMarcador(tipo);
  if (m) bloco.insertBefore(m, bloco.firstChild);
}

/**
 * Um bloco precisa de algo em que o cursor entre depois do marcador: texto, ou
 * um <br>. Sem isso, a linha vazia (ou a que termina num chip) não recebe o
 * cursor — é a regra nº 1 de contentEditable.
 */
function garantirConteudo(bloco: HTMLElement) {
  const filhos = Array.from(bloco.childNodes).filter((n) => !ehMarcador(n));
  const temTexto = filhos.some((n) => n.nodeType === Node.TEXT_NODE ? (n.textContent ?? "").length > 0 : !(n instanceof HTMLElement && n.tagName === "BR"));
  const ultimo = filhos[filhos.length - 1] ?? null;
  const temBr = filhos.some((n) => n instanceof HTMLElement && n.tagName === "BR");
  if ((!temTexto || ehChip(ultimo)) && !temBr) bloco.appendChild(document.createElement("br"));
}

function montarInline(el: HTMLElement, texto: string) {
  for (const s of segmentar(texto)) {
    if (s.tipo === "texto") { el.appendChild(document.createTextNode(s.texto)); continue; }
    if (s.tipo === "mencao") { el.appendChild(criarChip(s.texto, s.userId)); continue; }
    const tag = document.createElement(s.tipo === "negrito" ? "b" : "i");
    tag.textContent = s.texto;
    el.appendChild(tag);
  }
}

function criarBloco(b: Bloco): HTMLElement {
  const div = document.createElement("div");
  definirTipo(div, b.tipo, b.marcado);
  montarInline(div, b.texto);
  garantirConteudo(div);
  return div;
}

/** Markdown → DOM (o texto inteiro). */
function montarBlocos(raiz: HTMLElement, texto: string) {
  raiz.replaceChildren(...textoParaBlocos(texto).map(criarBloco));
}

/** O conteúdo de UMA linha, lido do DOM: negrito, itálico e chip viram a sintaxe gravada. */
function lerInline(el: Node): string {
  let s = "";
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      s += (n.textContent ?? "").replace(/ /g, " ").replace(/​/g, "");
      continue;
    }
    if (!(n instanceof HTMLElement)) continue;
    if (ehMarcador(n) || n.tagName === "BR") continue;
    if (ehChip(n)) { s += tokenDeMencao(n.dataset.nome ?? "alguém", n.dataset.mencao ?? ""); continue; }
    const dentro = lerInline(n);
    if (!dentro) continue;
    const negrito = n.tagName === "B" || n.tagName === "STRONG" || /^(bold|[6-9]00)$/.test(n.style.fontWeight);
    const italico = n.tagName === "I" || n.tagName === "EM" || n.style.fontStyle === "italic";
    // a sintaxe não sobrevive a espaço colado no asterisco: o espaço sai para fora
    const apara = (marca: string) => {
      const m = dentro.match(/^(\s*)(.*?)(\s*)$/s);
      const meio = m ? m[2] : dentro;
      return meio ? `${m ? m[1] : ""}${marca}${meio}${marca}${m ? m[3] : ""}` : dentro;
    };
    if (negrito && !dentro.includes("*")) s += apara("**");
    else if (italico && !dentro.includes("*")) s += apara("*");
    else s += dentro;
  }
  return s;
}

/** DOM → Markdown (o texto inteiro). Nó solto na raiz (o navegador apagou o último bloco) vira parágrafo. */
function lerBlocos(raiz: HTMLElement): string {
  const blocos: Bloco[] = [];
  for (const n of Array.from(raiz.childNodes)) {
    if (ehBloco(n)) {
      const tipo = (n.getAttribute(ATR_BLOCO) as TipoDeBloco) || "paragrafo";
      blocos.push({ tipo, texto: lerInline(n), marcado: n.getAttribute(ATR_MARCADO) === "1" });
      continue;
    }
    const t = n.nodeType === Node.TEXT_NODE
      ? (n.textContent ?? "").replace(/ /g, " ")
      : (n instanceof HTMLElement && n.tagName !== "BR" ? lerInline(n) : "");
    if (t) blocos.push({ tipo: "paragrafo", texto: t, marcado: false });
  }
  return blocos.length === 0 ? "" : blocosParaTexto(blocos);
}

/**
 * Depois de o navegador mexer: todo filho da raiz é bloco, todo bloco tem
 * onde o cursor entrar, nenhum marcador ficou no meio de uma linha (o Delete
 * no fim de uma linha puxa a de baixo inteira, marcador junto).
 */
function normalizar(raiz: HTMLElement) {
  for (const n of Array.from(raiz.childNodes)) {
    if (ehBloco(n)) continue;
    if (n instanceof HTMLElement && n.tagName === "BR") { n.remove(); continue; }
    const div = document.createElement("div");
    definirTipo(div, "paragrafo");
    raiz.insertBefore(div, n);
    div.appendChild(n);
  }
  if (raiz.childNodes.length === 0) raiz.appendChild(criarBloco({ tipo: "paragrafo", texto: "", marcado: false }));
  for (const b of Array.from(raiz.children)) {
    if (!(b instanceof HTMLElement)) continue;
    let primeiro = true;
    for (const n of Array.from(b.childNodes)) {
      if (ehMarcador(n)) { if (!primeiro || n.parentElement !== b) n.remove(); }
      primeiro = false;
    }
    for (const m of Array.from(b.querySelectorAll(`.${CLASSE_MARCADOR}`))) if (m.parentElement !== b) m.remove();
    garantirConteudo(b);
  }
}

// ── seleção ────────────────────────────────────────────────────────────────

function selecaoAtual(): Selection | null {
  return typeof window === "undefined" ? null : window.getSelection();
}
function blocoDoNo(raiz: HTMLElement, no: Node | null): HTMLElement | null {
  let n: Node | null = no;
  while (n && n !== raiz) {
    if (ehBloco(n) && n.parentElement === raiz) return n;
    n = n.parentNode;
  }
  return null;
}
function blocoAtual(raiz: HTMLElement): HTMLElement | null {
  const sel = selecaoAtual();
  if (!sel || sel.rangeCount === 0) return null;
  return blocoDoNo(raiz, sel.getRangeAt(0).startContainer);
}
/** Os blocos que a seleção toca — é o que faz "selecionar várias linhas e virar checklist". */
function blocosNaSelecao(raiz: HTMLElement): HTMLElement[] {
  const sel = selecaoAtual();
  if (!sel || sel.rangeCount === 0) return [];
  const r = sel.getRangeAt(0);
  return Array.from(raiz.children).filter((el): el is HTMLElement => ehBloco(el) && r.intersectsNode(el));
}
function colocarCursor(no: Node, offset: number) {
  const sel = selecaoAtual();
  if (!sel) return;
  const r = document.createRange();
  r.setStart(no, Math.max(0, Math.min(offset, no.nodeType === Node.TEXT_NODE ? (no.textContent ?? "").length : no.childNodes.length)));
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}
function cursorNoInicioDoBloco(bloco: HTMLElement) {
  const filhos = Array.from(bloco.childNodes);
  const alvo = filhos.find((n) => !ehMarcador(n));
  if (!alvo) { colocarCursor(bloco, filhos.length); return; }
  if (alvo.nodeType === Node.TEXT_NODE) colocarCursor(alvo, 0);
  else colocarCursor(bloco, filhos.indexOf(alvo));
}
function cursorNoFimDoBloco(bloco: HTMLElement) {
  const filhos = Array.from(bloco.childNodes).filter((n) => !(n instanceof HTMLElement && n.tagName === "BR"));
  const ultimo = filhos[filhos.length - 1] ?? null;
  if (ultimo && ultimo.nodeType === Node.TEXT_NODE) colocarCursor(ultimo, (ultimo.textContent ?? "").length);
  else if (ultimo) colocarCursor(bloco, Array.from(bloco.childNodes).indexOf(ultimo) + 1);
  else cursorNoInicioDoBloco(bloco);
}
/** O texto do bloco ANTES do cursor, sem os chips (para o "@" em curso). */
function textoAntesDoCursor(bloco: HTMLElement): string {
  const sel = selecaoAtual();
  if (!sel || sel.rangeCount === 0) return "";
  const r = sel.getRangeAt(0);
  const ate = document.createRange();
  ate.setStart(bloco, 0);
  ate.setEnd(r.startContainer, r.startOffset);
  const copia = ate.cloneContents();
  for (const c of Array.from(copia.querySelectorAll("[data-mencao]"))) c.remove();
  return (copia.textContent ?? "").replace(/ /g, " ");
}
/** O cursor está no começo (nada editável antes dele — chip conta como conteúdo)? */
function cursorNoComecoDoBloco(bloco: HTMLElement): boolean {
  const sel = selecaoAtual();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  const ate = document.createRange();
  ate.setStart(bloco, 0);
  ate.setEnd(r.startContainer, r.startOffset);
  return (ate.cloneContents().textContent ?? "").length === 0;
}

/**
 * ENTER no meio de um bloco: o que está antes do cursor fica, o que está
 * depois vai para um bloco novo do MESMO tipo — exceto quando o bloco estava
 * vazio: Enter numa linha de lista vazia é o gesto universal de "sair da
 * lista", e vira parágrafo. (É `dividirBloco` de texto-rico.ts, no DOM.)
 */
function dividirNoCursor(bloco: HTMLElement): HTMLElement {
  const sel = selecaoAtual();
  if (!sel || sel.rangeCount === 0) return bloco;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) r.deleteContents();
  const tipo = (bloco.getAttribute(ATR_BLOCO) as TipoDeBloco) || "paragrafo";
  if (tipo !== "paragrafo" && lerInline(bloco).trim() === "") {
    definirTipo(bloco, "paragrafo");
    garantirConteudo(bloco);
    cursorNoInicioDoBloco(bloco);
    return bloco;
  }
  const resto = document.createRange();
  resto.selectNodeContents(bloco);
  resto.setStart(r.startContainer, r.startOffset);
  const pedaco = resto.extractContents();
  const novo = document.createElement("div");
  definirTipo(novo, tipo, false);
  novo.appendChild(pedaco);
  for (const n of Array.from(novo.querySelectorAll(`.${CLASSE_MARCADOR}`))) if (n.parentElement !== novo || n !== novo.firstChild) n.remove();
  garantirConteudo(novo);
  garantirConteudo(bloco);
  bloco.after(novo);
  cursorNoInicioDoBloco(novo);
  return novo;
}

/** BACKSPACE no começo: junta com a linha de cima — o texto desta vai para o fim da anterior. */
function juntarComAnterior(bloco: HTMLElement, anterior: HTMLElement) {
  for (const n of Array.from(anterior.childNodes)) if (n instanceof HTMLElement && n.tagName === "BR") n.remove();
  const juncao = anterior.lastChild;
  const offset = juncao && juncao.nodeType === Node.TEXT_NODE ? (juncao.textContent ?? "").length : anterior.childNodes.length;
  for (const n of Array.from(bloco.childNodes)) {
    if (ehMarcador(n) || (n instanceof HTMLElement && n.tagName === "BR")) continue;
    anterior.appendChild(n);
  }
  bloco.remove();
  garantirConteudo(anterior);
  if (juncao && juncao.nodeType === Node.TEXT_NODE) colocarCursor(juncao, offset);
  else colocarCursor(anterior, offset);
}

function inserirTexto(texto: string) {
  document.execCommand("insertText", false, texto);
}

// ═══════════════════════════════════════════════════════════════════════════
// A lista de sugestões do "@" — compartilhada com a caixa de comentário
// ═══════════════════════════════════════════════════════════════════════════

export function SugestoesDeMencao({ pessoas, marcada, aoEscolher, aoMarcar }: {
  pessoas: PessoaParaMencao[];
  marcada: number;
  aoEscolher: (p: PessoaParaMencao) => void;
  aoMarcar: (i: number) => void;
}) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
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
          // mousedown, não click: o click chega depois do blur da área,
          // e o blur fecharia a lista antes de a escolha acontecer
          onMouseDown={(e) => { e.preventDefault(); aoEscolher(p); }}
          onMouseEnter={() => aoMarcar(i)}
          className="hover-suave"
          style={{
            width: "100%", minHeight: 38, padding: "5px 9px", borderRadius: 9,
            display: "flex", alignItems: "center", gap: 8, textAlign: "left",
            background: i === marcada ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)") : "transparent",
            border: "none", cursor: "pointer", color: textPrimary,
            fontFamily: FONT, fontWeight: i === marcada ? 600 : 400, fontSize: 13,
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
 * O "#" (R245): uma atividade que a caixa de texto pode oferecer. Só o que a
 * LISTA precisa — o título (Davi: "somente o nome da atividade em cada item")
 * e um id para quem chamou saber qual foi. O número entra só no filtro.
 */
export interface AtividadeParaHashtag {
  id: string;
  titulo: string;
  numero?: string | null;
}

/** A lista do "#": só o nome da atividade em cada item. */
export function SugestoesDeAtividade({ atividades, marcada, aoEscolher, aoMarcar }: {
  atividades: AtividadeParaHashtag[];
  marcada: number;
  aoEscolher: (a: AtividadeParaHashtag) => void;
  aoMarcar: (i: number) => void;
}) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  if (atividades.length === 0) {
    return (
      <div className="mencao-lista" style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, padding: "8px 10px" }}>
        Nenhuma atividade recente com esse nome.
      </div>
    );
  }
  return (
    <div className="mencao-lista" role="listbox" aria-label="Atividades recentes">
      {atividades.map((a, i) => (
        <button
          key={a.id}
          type="button"
          role="option"
          aria-selected={i === marcada}
          onMouseDown={(e) => { e.preventDefault(); aoEscolher(a); }}
          onMouseEnter={() => aoMarcar(i)}
          className="hover-suave"
          style={{
            width: "100%", minHeight: 36, padding: "5px 9px", borderRadius: 9,
            display: "flex", alignItems: "center", textAlign: "left",
            background: i === marcada ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)") : "transparent",
            border: "none", cursor: "pointer", color: textPrimary,
            fontFamily: FONT, fontWeight: i === marcada ? 600 : 400, fontSize: 13,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {a.titulo}
        </button>
      ))}
    </div>
  );
}

/** O estado do "#": o que foi digitado depois da cerquilha e as atividades que casam. */
export function useHashtag(atividades: AtividadeParaHashtag[]) {
  const [consulta, setConsulta] = useState<string | null>(null);
  const [marcada, setMarcada] = useState(0);
  const sugestoes = useMemo(() => {
    if (consulta === null) return [];
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(consulta.trim());
    const l = q ? atividades.filter((a) => norm(a.titulo).includes(q) || norm(a.numero ?? "").includes(q)) : atividades;
    return l.slice(0, 6);
  }, [atividades, consulta]);
  useEffect(() => { setMarcada(0); }, [consulta]);
  function observar(texto: string, cursor: number) {
    const em = hashtagEmCurso(texto, cursor);
    setConsulta(em ? em.consulta : null);
  }
  const aberta = consulta !== null && atividades.length > 0;
  function teclado(e: KeyboardEvent): AtividadeParaHashtag | boolean {
    if (!aberta) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setMarcada((m) => Math.min(sugestoes.length - 1, m + 1)); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setMarcada((m) => Math.max(0, m - 1)); return true; }
    if (e.key === "Escape") { e.preventDefault(); setConsulta(null); return true; }
    if ((e.key === "Enter" || e.key === "Tab") && sugestoes[marcada]) { e.preventDefault(); return sugestoes[marcada]; }
    return false;
  }
  return { aberta, sugestoes, marcada, setMarcada, observar, fechar: () => setConsulta(null), teclado };
}

/**
 * O estado do "@" numa caixa de texto qualquer: o que foi digitado depois do
 * arroba, as pessoas que casam, qual está marcada.
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

// ═══════════════════════════════════════════════════════════════════════════
// A barra de ferramentas
// ═══════════════════════════════════════════════════════════════════════════

interface Ferramenta {
  Icon: typeof Bold;
  titulo: string;
  /** formatação DENTRO da linha: o comando nativo, que respeita a seleção */
  comando?: "bold" | "italic";
  /** formatação DA LINHA: troca o tipo de TODOS os blocos na seleção */
  tipo?: TipoDeBloco;
  /** a menção: insere o "@" e abre a lista */
  mencao?: boolean;
  atalho?: string;
}

const FERRAMENTAS: Ferramenta[] = [
  { Icon: Bold, titulo: "Negrito", comando: "bold", atalho: "Ctrl+B" },
  { Icon: Italic, titulo: "Itálico", comando: "italic", atalho: "Ctrl+I" },
  { Icon: ListChecks, titulo: "Checklist", tipo: "checklist" },
  { Icon: List, titulo: "Lista", tipo: "lista" },
  { Icon: AtSign, titulo: "Mencionar alguém", mencao: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// O NÚCLEO — a área editável (usada pelo editor e pela caixa de comentário)
// ═══════════════════════════════════════════════════════════════════════════

export interface EditorRicoProps {
  /** o texto (Markdown puro) */
  valor: string;
  aoMudar: (v: string) => void;
  pessoas: PessoaParaMencao[];
  placeholder?: string;
  id?: string;
  minAltura?: number;
  somenteLeitura?: boolean;
  /** mostra a barra de ferramentas (o editor); a caixa de comentário não mostra */
  barra?: boolean;
  /** estilo da área (a caixa de comentário passa o seu) */
  estilo?: CSSProperties;
  /** o pai decide o Enter (a caixa de comentário envia) — se ele prevenir, o editor não quebra a linha */
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** R245: as atividades que o "#" oferece (o chat passa as recentes); sem lista, "#" é texto */
  atividades?: AtividadeParaHashtag[];
  /** R245: escolhida uma atividade, o "#consulta" sai do texto e quem chamou decide o que fazer */
  aoEscolherAtividade?: (a: AtividadeParaHashtag) => void;
  /** classe extra da área (a caixa do chat esconde a barra de rolagem) */
  classe?: string;
  /**
   * R249: um PEDIDO de foco vindo de fora — o chat bate este contador quando
   * a pessoa clica em "Responder aqui", e o cursor aparece na caixa.
   */
  focarEm?: number;
}

export function EditorRico({
  valor, aoMudar, pessoas, placeholder, id, minAltura, somenteLeitura = false, barra = false, estilo, onKeyDown, onFocus, onBlur,
  atividades, aoEscolherAtividade, classe, focarEm,
}: EditorRicoProps) {
  const { isLight } = useTheme();
  const areaRef = useRef<HTMLDivElement>(null);
  const ultimoEmitido = useRef<string | null>(null);
  const men = useMencao(pessoas);
  const hash = useHashtag(atividades ?? []);

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.62)";

  // ── o valor de fora entra no DOM — mas nunca por cima de quem está digitando ──
  useLayoutEffect(() => {
    const raiz = areaRef.current;
    if (!raiz) return;
    if (valor === ultimoEmitido.current) return;
    const focado = typeof document !== "undefined" && (document.activeElement === raiz || raiz.contains(document.activeElement));
    // enquanto o campo tem foco, o servidor nunca escreve nele (R90) — só o
    // "limpar" entra, porque é o próprio envio pedindo
    if (focado && valor !== "") return;
    montarBlocos(raiz, valor);
    ultimoEmitido.current = valor;
    raiz.dataset.vazio = valor === "" ? "1" : "0";
    if (focado) cursorNoInicioDoBloco(raiz.firstElementChild as HTMLElement);
  }, [valor]);

/**
   * R249 (Davi, 10/09/2026): "Quando o usuário clica no botão de 'Responder
   * aqui' em um card dentro do CHAT, adicione o mecanismo de ativar o cursor de
   * texto na caixa de texto do chat automaticamente."
   *
   * É um CONTADOR, não um booleano: responder numa mensagem e logo depois
   * noutra são dois pedidos, e um `true` que já era `true` não dispara efeito
   * nenhum. `preventScroll` porque a lista de mensagens está logo acima — sem
   * ele o navegador rola o chat inteiro para "mostrar" um campo que já está
   * visível. O cursor vai para o FIM do que já estava escrito, nunca por cima.
   */
  useEffect(() => {
    if (!focarEm || somenteLeitura) return;
    const raiz = areaRef.current;
    if (!raiz) return;
    raiz.focus({ preventScroll: true });
    const ultimo = raiz.lastElementChild as HTMLElement | null;
    if (ultimo) cursorNoFimDoBloco(ultimo);
  }, [focarEm, somenteLeitura]);

  function emitir() {
    const raiz = areaRef.current;
    if (!raiz) return;
    normalizar(raiz);
    const v = lerBlocos(raiz);
    raiz.dataset.vazio = v === "" ? "1" : "0";
    if (v === ultimoEmitido.current) return;
    ultimoEmitido.current = v;
    aoMudar(v);
  }
  function observarMencao() {
    const raiz = areaRef.current;
    const bloco = raiz ? blocoAtual(raiz) : null;
    const antes = bloco ? textoAntesDoCursor(bloco) : "";
    men.observar(antes, antes.length);
    hash.observar(antes, antes.length);   // R245: o "#" anda junto do "@"
  }
  /** R245: escolhida uma atividade, o "#consulta" sai do texto — a resposta é do pai. */
  function escolherAtividade(a: AtividadeParaHashtag) {
    const raiz = areaRef.current;
    const sel = selecaoAtual();
    if (raiz && sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      const no = r.startContainer;
      if (no.nodeType === Node.TEXT_NODE) {
        const texto = (no.textContent ?? "").slice(0, r.startOffset);
        const em = hashtagEmCurso(texto, texto.length);
        if (em) {
          const del = document.createRange();
          del.setStart(no, em.inicio);
          del.setEnd(no, r.startOffset);
          del.deleteContents();
        }
      }
    }
    hash.fechar();
    emitir();
    aoEscolherAtividade?.(a);
  }
  function focarSePreciso(raiz: HTMLElement) {
    const sel = selecaoAtual();
    const dentro = !!sel && sel.rangeCount > 0 && raiz.contains(sel.getRangeAt(0).startContainer);
    if (dentro) return;
    raiz.focus();
    const ultimo = raiz.lastElementChild as HTMLElement | null;
    if (ultimo) cursorNoFimDoBloco(ultimo);
  }

  // ── a barra ────────────────────────────────────────────────────────────────
  function aplicar(f: Ferramenta) {
    if (somenteLeitura) return;
    const raiz = areaRef.current;
    if (!raiz) return;
    focarSePreciso(raiz);
    const v = lerBlocos(raiz);
    if (f.tipo) {
      const alvo = blocosNaSelecao(raiz);
      if (alvo.length === 0) return;
      // pedir o tipo que TODOS já têm devolve ao parágrafo — é o comportamento
      // de todo botão de formatação de linha (clicar "lista" numa lista desfaz)
      const todosJa = alvo.every((b) => b.getAttribute(ATR_BLOCO) === f.tipo);
      for (const b of alvo) { definirTipo(b, todosJa ? "paragrafo" : f.tipo, false); garantirConteudo(b); }
    } else if (f.mencao) {
      const bloco = blocoAtual(raiz);
      const antes = bloco ? textoAntesDoCursor(bloco) : "";
      const precisaEspaco = antes.length > 0 && !/\s$/.test(antes);
      inserirTexto(precisaEspaco ? " @" : "@");
    } else if (f.comando) {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand(f.comando);
    }
    const r = { valor: lerBlocos(raiz) };
    // idempotente (nada mudou) → nada a fazer, e nada de seleção presa
    if (r.valor === v) return;
    emitir();
    observarMencao();
  }

  // ── a menção ──────────────────────────────────────────────────────────────
  function escolherMencao(p: PessoaParaMencao) {
    const raiz = areaRef.current;
    const sel = selecaoAtual();
    if (!raiz || !sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const no = r.startContainer;
    const chip = criarChip(p.nome, p.id);
    const espaco = document.createTextNode(" ");
    if (no.nodeType === Node.TEXT_NODE) {
      const texto = (no.textContent ?? "").slice(0, r.startOffset);
      const em = mencaoEmCurso(texto, texto.length);
      const del = document.createRange();
      del.setStart(no, em ? em.inicio : r.startOffset);
      del.setEnd(no, r.startOffset);
      del.deleteContents();
      del.insertNode(espaco);
      del.insertNode(chip);
    } else {
      r.insertNode(espaco);
      r.insertNode(chip);
    }
    colocarCursor(espaco, 1);
    men.fechar();
    emitir();
  }

  // ── teclado ───────────────────────────────────────────────────────────────
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const raiz = areaRef.current;
    if (!raiz || somenteLeitura) return;

    // as listas do "@" e do "#" têm prioridade sobre tudo
    const rm = men.teclado(e);
    if (rm === true) return;
    if (rm && typeof rm === "object") { escolherMencao(rm); return; }
    const rh = hash.teclado(e);
    if (rh === true) return;
    if (rh && typeof rh === "object") { escolherAtividade(rh); return; }

    // o pai decide primeiro (a caixa de comentário envia no Enter)
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "b" || e.key === "B")) { e.preventDefault(); aplicar(FERRAMENTAS[0]); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "i" || e.key === "I")) { e.preventDefault(); aplicar(FERRAMENTAS[1]); return; }

    if (e.key === "Enter") {
      e.preventDefault();
      const bloco = blocoAtual(raiz);
      if (bloco) dividirNoCursor(bloco);
      emitir();
      men.fechar();
      return;
    }
    if (e.key === "Backspace") {
      const bloco = blocoAtual(raiz);
      if (!bloco || !cursorNoComecoDoBloco(bloco)) return;
      const tipo = bloco.getAttribute(ATR_BLOCO);
      if (tipo && tipo !== "paragrafo") {
        // apagar no começo de um item tira o marcador — é o gesto de todo editor
        e.preventDefault();
        definirTipo(bloco, "paragrafo");
        garantirConteudo(bloco);
        cursorNoInicioDoBloco(bloco);
        emitir();
        return;
      }
      const anterior = bloco.previousElementSibling;
      if (ehBloco(anterior)) {
        e.preventDefault();
        juntarComAnterior(bloco, anterior);
        emitir();
        return;
      }
      // R245 (Davi: "se o usuário clicar no botão do teclado de apagar quando
      // não houver texto, ela buga"): no começo do PRIMEIRO bloco não há o que
      // apagar — mas o navegador apagava o próprio <div> do bloco, e a área
      // ficava sem estrutura (placeholder preso, cursor perdido, texto novo
      // nascendo fora de bloco). Não há nada antes: a tecla não faz nada.
      e.preventDefault();
    }
  }

  function colar(e: ClipboardEvent<HTMLDivElement>) {
    if (somenteLeitura) return;
    const raiz = areaRef.current;
    if (!raiz) return;
    e.preventDefault();
    const bruto = e.clipboardData.getData("text/plain");
    if (!bruto) return;
    const linhas = bruto.replace(/\r/g, "").split("\n");
    inserirTexto(linhas[0]);
    for (let i = 1; i < linhas.length; i++) {
      const bloco = blocoAtual(raiz);
      const novo = bloco ? dividirNoCursor(bloco) : null;
      // linha colada com a sintaxe da casa ("- [ ] x", "- x") vira o bloco certo
      const b = linhaParaBloco(linhas[i]);
      if (novo && b.tipo !== "paragrafo") { definirTipo(novo, b.tipo, b.marcado); garantirConteudo(novo); cursorNoInicioDoBloco(novo); }
      if (b.texto) inserirTexto(b.texto);
    }
    emitir();
  }

  // clicar na caixa de marcar alterna o item — sem mover o cursor para lá
  function mouseDown(e: MouseEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    const marcador = alvo.closest?.(`.${CLASSE_MARCADOR}`);
    if (!marcador) return;
    e.preventDefault();
    if (somenteLeitura) return;
    const bloco = marcador.parentElement;
    if (!bloco || bloco.getAttribute(ATR_BLOCO) !== "checklist") return;
    bloco.setAttribute(ATR_MARCADO, bloco.getAttribute(ATR_MARCADO) === "1" ? "0" : "1");
    emitir();
  }

  const estiloTexto: CSSProperties = {
    fontFamily: FONT, fontSize: 14, fontWeight: 400, color: textPrimary, lineHeight: 1.55,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {barra && !somenteLeitura && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 8px", borderBottom: isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)" }}>
          {FERRAMENTAS.map((f, i) => (
            <Fragment key={f.titulo}>
              {(i === 2 || i === 4) && (
                <span style={{ width: 1, height: 22, background: "var(--border-color)", flexShrink: 0 }} />
              )}
              <button
                type="button"
                title={f.atalho ? `${f.titulo} (${f.atalho})` : f.titulo}
                aria-label={f.titulo}
                className="ferramenta-botao"
                // mousedown, não click: click chega DEPOIS do blur da área,
                // que já teria desfeito a seleção
                onMouseDown={(e) => { e.preventDefault(); aplicar(f); }}
                style={{ width: 44, height: 44, flexShrink: 0 }}
              >
                <f.Icon size={16} />
              </button>
            </Fragment>
          ))}
          {/* R243: a legenda "@ menciona · Enter nova linha · selecione várias
              linhas e clique em Checklist" SAIU (Davi, 10/09/2026). Ela ocupava
              metade da barra em toda caixa de texto do sistema, e o que ela
              ensina cada botão já diz no `title`/`aria-label` dele. */}
        </div>
      )}
      <div
        id={id}
        ref={areaRef}
        className={classe ? `editor-rico-area ${classe}` : "editor-rico-area"}
        role="textbox"
        aria-multiline="true"
        aria-readonly={somenteLeitura || undefined}
        contentEditable={!somenteLeitura}
        suppressContentEditableWarning
        data-placeholder={placeholder ?? ""}
        spellCheck
        onInput={() => { emitir(); observarMencao(); }}
        onKeyDown={teclado}
        onKeyUp={observarMencao}
        onClick={observarMencao}
        onPaste={colar}
        onMouseDown={mouseDown}
        onFocus={() => { document.execCommand("styleWithCSS", false, "false"); onFocus?.(); }}
        onBlur={() => { men.fechar(); hash.fechar(); onBlur?.(); }}
        style={{
          ...estiloTexto,
          minHeight: minAltura,
          padding: "10px 13px 12px",
          cursor: somenteLeitura ? "default" : "text",
          ...estilo,
        }}
      />
      {men.aberta && !somenteLeitura && (
        <div style={{ padding: "0 8px 8px" }}>
          <SugestoesDeMencao pessoas={men.sugestoes} marcada={men.marcada} aoEscolher={escolherMencao} aoMarcar={men.setMarcada} />
        </div>
      )}
      {hash.aberta && !men.aberta && !somenteLeitura && (
        <div style={{ padding: "0 8px 8px" }}>
          <SugestoesDeAtividade atividades={hash.sugestoes} marcada={hash.marcada} aoEscolher={escolherAtividade} aoMarcar={hash.setMarcada} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// A caixa de comentário com "@" — a mesma área, sem barra, o Enter é do pai
// ═══════════════════════════════════════════════════════════════════════════

export function TextareaComMencoes({ valor, aoMudar, pessoas, placeholder, estilo, onKeyDown, onFocus, onBlur, id, atividades, aoEscolherAtividade, focarEm }: {
  valor: string;
  aoMudar: (v: string) => void;
  pessoas: PessoaParaMencao[];
  placeholder?: string;
  estilo?: CSSProperties;
  /** mantido por compatibilidade: a área cresce com o texto, não tem linhas fixas */
  rows?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  id?: string;
  /** R245: as atividades que o "#" oferece */
  atividades?: AtividadeParaHashtag[];
  aoEscolherAtividade?: (a: AtividadeParaHashtag) => void;
  /** R249: contador de pedidos de foco (o "Responder aqui" do chat) */
  focarEm?: number;
}) {
  return (
    <EditorRico
      id={id}
      valor={valor}
      aoMudar={aoMudar}
      pessoas={pessoas}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      atividades={atividades}
      aoEscolherAtividade={aoEscolherAtividade}
      focarEm={focarEm}
      // R245: com teto de altura a área rola — mas sem MOSTRAR a barra
      classe={estilo?.maxHeight ? "rolagem-oculta" : undefined}
      estilo={{ ...estilo, overflowY: estilo?.maxHeight ? "auto" : undefined }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// O editor — a área com barra, dentro da borda do campo, gravando sozinho
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  /** o texto do servidor (Markdown puro) */
  valor: string;
  aoSalvar: (v: string) => void;
  /** muda quando o REGISTRO muda (id do chamado): descarta o rascunho */
  chaveReset?: string | null;
  pessoas: PessoaParaMencao[];
  placeholder?: string;
  /** id da área, para o <label htmlFor> do campo */
  idAlvo?: string;
  minAltura?: number;
  somenteLeitura?: boolean;
}

export function EditorDeDescricao({
  valor, aoSalvar, chaveReset, pessoas, placeholder, idAlvo, minAltura = 220, somenteLeitura = false,
}: Props) {
  const { isLight } = useTheme();
  const r0 = useRascunhoSalvo(valor, aoSalvar, chaveReset);
  const campoBg = isLight ? "#ffffff" : "rgba(255,255,255,0.055)";
  const borda = isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)";

  return (
    <div style={{ border: borda, borderRadius: 12, overflow: "hidden", background: campoBg }}>
      {/* A barra fica DENTRO da borda do campo — lê como parte dele. Cada
          botão tem chapa e borda (.ferramenta-botao). Os divisores separam
          formatação de texto, formatação de linha e a menção. */}
      <EditorRico
        id={idAlvo}
        valor={r0.valor}
        aoMudar={r0.mudar}
        onFocus={r0.aoFocar}
        onBlur={r0.aoDesfocar}
        pessoas={pessoas}
        placeholder={placeholder}
        minAltura={minAltura}
        somenteLeitura={somenteLeitura}
        barra
      />
    </div>
  );
}
