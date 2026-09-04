// Campo de escolha COM BUSCA — digite "Vila" e aparecem "Vila Lagos",
// "Vila Maria", "Villa Lobos"…
//
// POR QUE ELE EXISTE: a base tem 192 clientes. Num `<select>` nativo isso é
// uma lista de 192 linhas para rolar com o mouse, ordenada alfabeticamente e
// sem nenhum atalho — achar "Vila Lagos" custa mais que digitar o nome
// inteiro. Com busca, três letras bastam.
//
// ONDE ELE NÃO ENTRA: prioridade, status, tipo, equipe, sprint. Essas listas
// têm de quatro a oito opções e cabem inteiras na tela; obrigar a digitar para
// escolher entre "Baixa, Normal, Alta, Urgente" seria trocar um clique por
// um clique mais digitação. Campo de busca é remédio para lista longa, não
// enfeite de formulário.
//
// ACESSIBILIDADE: é um combobox de verdade, não uma caixa de texto com um
// menu por cima. Setas navegam, Enter escolhe, Esc fecha, e os atributos ARIA
// dizem ao leitor de tela o que está acontecendo. A lista some no blur com um
// atraso curto — sem ele, o clique na opção nunca chega, porque o blur remove
// o elemento antes do mousedown virar click.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { normalizarTexto } from "@/lib/normalizar";

export interface OpcaoBusca {
  valor: string;
  rotulo: string;
  /** texto extra que também casa na busca (cidade, e-mail…) */
  secundario?: string;
}

interface Props {
  opcoes: OpcaoBusca[];
  valor: string | null;
  aoMudar: (v: string | null) => void;
  /** texto quando nada está escolhido */
  vazio?: string;
  /** permite limpar a escolha (o "— sem cliente —" dos selects) */
  limpavel?: boolean;
  placeholder?: string;
  /** aparência compacta, para o campo de adicionar apoio */
  compacto?: boolean;
  id?: string;
  /**
   * Ícone/avatar à esquerda, dentro do campo — representa a escolha atual
   * (2026-08-22: "nomes com ícone também", no painel de propriedades). Recebe
   * a opção escolhida (ou `null`, sem escolha) porque o ícone certo pode
   * depender de QUEM está selecionado — Responsável mostra o avatar da
   * pessoa, não um glifo genérico igual para todo mundo.
   */
  iconeEsquerda?: (escolhida: OpcaoBusca | null) => ReactNode;
}

const TETO = 60;

export function CampoComBusca({
  opcoes, valor, aoMudar, vazio = "— não definido —",
  limpavel = true, placeholder = "Digite para buscar…", compacto = false, id,
  iconeEsquerda,
}: Props) {
  const { isLight } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [marcado, setMarcado] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const escolhida = useMemo(
    () => opcoes.find((o) => o.valor === valor) ?? null,
    [opcoes, valor],
  );

  const filtradas = useMemo(() => {
    const t = normalizarTexto(termo.trim());
    if (!t) return opcoes.slice(0, TETO);
    // começa-com antes de contém: quem digita "vila" quer "Vila Lagos" no
    // topo, não "Alto da Vila" só porque veio antes no alfabeto
    const comeca: OpcaoBusca[] = [];
    const contem: OpcaoBusca[] = [];
    for (const o of opcoes) {
      const alvo = normalizarTexto(`${o.rotulo} ${o.secundario ?? ""}`);
      if (alvo.startsWith(t)) comeca.push(o);
      else if (alvo.includes(t)) contem.push(o);
    }
    return [...comeca, ...contem].slice(0, TETO);
  }, [opcoes, termo]);

  useEffect(() => { setMarcado(0); }, [termo, aberto]);

  // fecha ao clicar fora — sem isto a lista fica aberta atrás do próximo campo
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.62)";
  const campoBg = isLight ? "#ffffff" : "rgba(255,255,255,0.055)";
  const borda = isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const listaBg = isLight ? "#ffffff" : "#16161d";

  // com ícone, o texto começa depois dele — senão o avatar cobriria as
  // primeiras letras do nome. `temIcone` olha se HÁ ESCOLHA, não só se a prop
  // foi passada: sem cliente/responsável, `iconeEsquerda(null)` devolve null
  // e nada é desenhado — reservar o espaço mesmo assim deixava o placeholder
  // ("— sem cliente —") deslocado ~25px à toa (achado da revisão adversarial
  // de U40, 2026-08-21).
  const temIcone = !!iconeEsquerda && !!escolhida;
  const padEsquerda = temIcone ? (compacto ? 34 : 38) : (compacto ? 14 : 13);
  const estiloCampo: CSSProperties = {
    width: "100%", boxSizing: "border-box",
    minHeight: compacto ? 38 : 44,
    fontFamily: FONT, fontSize: compacto ? 13 : 14, fontWeight: 500,
    color: textPrimary, background: campoBg, border: borda,
    borderRadius: compacto ? 999 : 12,
    padding: `${compacto ? 8 : 11}px ${compacto ? 34 : 38}px ${compacto ? 8 : 11}px ${padEsquerda}px`,
    outline: "none", cursor: "text",
  };

  function escolher(o: OpcaoBusca) {
    aoMudar(o.valor);
    setTermo("");
    setAberto(false);
    entrada.current?.blur();
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) { setAberto(true); return; }
      setMarcado((m) => {
        const n = e.key === "ArrowDown" ? m + 1 : m - 1;
        return Math.max(0, Math.min(filtradas.length - 1, n));
      });
      return;
    }
    if (e.key === "Enter") {
      if (aberto && filtradas[marcado]) { e.preventDefault(); escolher(filtradas[marcado]); }
      return;
    }
    if (e.key === "Escape") { setAberto(false); setTermo(""); }
  }

  // fechado mostra o ESCOLHIDO; aberto mostra o que está sendo digitado
  const exibido = aberto ? termo : (escolhida?.rotulo ?? "");

  return (
    <div ref={caixa} style={{ position: "relative", minWidth: 0 }}>
      {temIcone && !aberto && (
        <span style={{
          position: "absolute", left: compacto ? 10 : 12, top: "50%",
          transform: "translateY(-50%)", pointerEvents: "none",
          display: "flex", alignItems: "center", zIndex: 1,
        }}>
          {iconeEsquerda!(escolhida)}
        </span>
      )}
      <input
        id={id}
        ref={entrada}
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-lista` : undefined}
        value={exibido}
        placeholder={escolhida ? escolhida.rotulo : (compacto ? placeholder : vazio)}
        onChange={(e) => { setTermo(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={teclado}
        style={{
          ...estiloCampo,
          color: escolhida || termo ? textPrimary : textSecondary,
        }}
      />

      {/* limpar, quando há escolha — o "— sem cliente —" dos selects antigos */}
      {limpavel && escolhida && !aberto ? (
        <button
          type="button"
          aria-label="Limpar escolha"
          onClick={() => { aoMudar(null); setTermo(""); }}
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            width: 26, height: 26, borderRadius: 8, border: "none",
            background: "transparent", color: textSecondary,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <X size={15} />
        </button>
      ) : (
        <ChevronDown
          size={16}
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            color: textSecondary, pointerEvents: "none",
          }}
        />
      )}

      {aberto && (
        <ul
          id={id ? `${id}-lista` : undefined}
          role="listbox"
          style={{
            position: "absolute", zIndex: 60, top: "calc(100% + 4px)", left: 0, right: 0,
            maxHeight: 280, overflowY: "auto", margin: 0, padding: 4,
            listStyle: "none", background: listaBg, border: borda, borderRadius: 12,
            boxShadow: isLight ? "0 8px 24px rgba(0,0,0,0.14)" : "0 12px 32px rgba(0,0,0,0.55)",
          }}
        >
          {filtradas.length === 0 && (
            <li style={{
              padding: "10px 12px", fontFamily: FONT, fontSize: 13, color: textSecondary,
            }}>
              Nada encontrado para “{termo}”.
            </li>
          )}
          {filtradas.map((o, i) => {
            const ativa = i === marcado;
            const atual = o.valor === valor;
            return (
              <li key={o.valor} role="option" aria-selected={atual}>
                <button
                  type="button"
                  // mousedown, não click: o blur do input dispararia antes do
                  // click e a lista sumiria com a escolha pelo caminho
                  onMouseDown={(e) => { e.preventDefault(); escolher(o); }}
                  onMouseEnter={() => setMarcado(i)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    border: "none", borderRadius: 9, padding: "9px 11px",
                    background: ativa
                      ? (isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.09)")
                      : "transparent",
                    color: textPrimary,
                    display: "flex", alignItems: "center", gap: 8,
                    fontFamily: FONT, fontSize: 13.5, fontWeight: atual ? 600 : 500,
                  }}
                >
                  <span style={{
                    flex: 1, minWidth: 0, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {o.rotulo}
                    {o.secundario && (
                      <span style={{ color: textSecondary, fontWeight: 400 }}>
                        {" · "}{o.secundario}
                      </span>
                    )}
                  </span>
                  {atual && <Check size={14} color={gold} style={{ flexShrink: 0 }} />}
                </button>
              </li>
            );
          })}
          {/* o teto existe para a lista não virar 192 linhas de uma vez; dizer
              que ele existe evita a conclusão de que o resto não está lá */}
          {!termo && opcoes.length > TETO && (
            <li style={{
              padding: "8px 12px", fontFamily: FONT, fontSize: 11.5, color: textSecondary,
            }}>
              Mostrando {TETO} de {opcoes.length} — digite para achar o resto.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
