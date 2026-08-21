// O mapa da ÁREA ATENDIDA em São Paulo, por distritos — U24.
//
// COMO CHEGOU AQUI (2026-08-20). Quatro versões:
//   1. silhueta vazia do município — não era um mapa: sem nada dentro, os
//      pontos flutuavam sem referência e ninguém reconhecia onde era o quê;
//   2. Leaflet com tiles — virava mapa de verdade, mas trazia o desenho de
//      outra casa para dentro do painel;
//   3. os 94 distritos com o traço do sistema — deu a referência que faltava;
//   4. esta: 67 distritos, a área que o Davi contornou na tela.
//
// O RECORTE saiu de um contorno que ele desenhou por cima do print, e foi
// conferido contra os dados antes de aplicar: nenhum dos 29 distritos
// removidos tem um único cliente — os 151 da capital continuam todos no mapa.
// Saíram a ponta norte, a "asa" leste (um terço da largura, vazia) e o extremo
// sul rural. O quadro foi reenquadrado nos distritos que ficaram, senão o
// vazio deles continuaria ocupando espaço e o recorte não teria adiantado.
//
// Consequência aceita: cliente que venha a existir numa área removida conta
// numa linha própria do rodapé — "em bairro fora da área do mapa", não
// "fora de São Paulo", que seria falso para quem mora na cidade.
//
// Cada cliente é um ponto na cor que o degradê dá a ele (corDoCliente) — a
// MESMA cor do ponto dele no card da lista ao lado, que é como o olho liga as
// duas metades da tela. Os distritos ficam em tom neutro de propósito: se
// tivessem cor própria, disputariam com os clientes, que são o assunto.

import {
  useEffect, useMemo, useRef, useState,
  type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { DISTRITOS, MAPA_SP, projetar, dentroDaCidade, centroide } from "@/features/clientes/mapa-sp";
import { corDoCliente } from "@/features/clientes/cores";
import {
  IDENTIDADE, ZOOM_MIN, ZOOM_MAX, zoomEm, deslocar, limitarTransform,
  distancia, pontoMedio, fatorDaRoda, paraPercentual, type Transform,
} from "@/features/clientes/mapa-zoom";
import type { Cliente } from "@/features/clientes/data";

// margem do viewBox (o -6/+6 de sempre, pro traço das bordas não cortar) —
// nomeada porque zoom/pan e o tooltip precisam do MESMO número
const MARGEM = 6;
const VB_LARGURA = MAPA_SP.largura + 2 * MARGEM;
const VB_ALTURA = MAPA_SP.altura + 2 * MARGEM;

// além de qual distância (em px de TELA) um pointerdown->pointerup vira
// "arrastou o mapa" em vez de "clicou num cliente" — pequeno o bastante pra
// não atrapalhar um clique de verdade, grande o bastante pra não confundir
// o tremor natural da mão/dedo com intenção de arrastar
const LIMIAR_ARRASTO = 6;

// Um rótulo por distrito, no centro geométrico do polígono — calculado uma
// vez (DISTRITOS é constante, não depende de props/state, então não precisa
// de useMemo por render).
const ROTULOS_DISTRITOS = DISTRITOS.map(([nome, d]) => ({ nome, ...centroide(d) }));

interface Props {
  clientes: Cliente[];
}

interface Ponto {
  id: string;
  nome: string;
  x: number;
  y: number;
  cor: string;
}

/** Botão dos controles de zoom — de módulo (não função interna) pela mesma
 * razão de sempre: função declarada dentro do pai ganharia identidade nova a
 * cada render e o React desmontaria/remontaria à toa. */
function BotaoMapa({ Icon, rotulo, isLight, desabilitado, aoClicar }: {
  Icon: typeof Plus; rotulo: string; isLight: boolean; desabilitado: boolean; aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      // 44x44: o alvo de toque mínimo do resto do app — o mapa é usado no
      // celular também
      style={{
        width: 44, height: 44, border: "none", background: "transparent",
        color: desabilitado
          ? (isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.22)")
          : (isLight ? "#0a0b0e" : "#ffffff"),
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: desabilitado ? "default" : "pointer",
      }}
    >
      <Icon size={17} />
    </button>
  );
}

interface PonteiroAtivo {
  /** coordenadas de TELA (client) — a régua do limiar de arrasto é em px
      de tela, não de conteúdo, senão o mesmo gesto físico "sentiria" mais
      sensível com zoom alto e menos com zoom baixo */
  x: number;
  y: number;
  /** as MESMAS coordenadas, convertidas pro espaço OUTER (viewBox) — é
      nesse espaço que a matemática de pan/zoom em mapa-zoom.ts trabalha */
  ox: number;
  oy: number;
}

export function MapaClientes({ clientes }: Props) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const [alvo, setAlvo] = useState<Ponto | null>(null);

  // ── zoom/pan (2026-08-21, Davi: "mecanismo de zoom... movimentar o mapa
  //    com zoom, algo sistemicamente completo") ───────────────────────────
  //
  // `transform` (state) é o que a JSX renderiza. `transformRef` é o valor
  // AO VIVO, sempre atualizado de imediato — os handlers de ponteiro/roda
  // disparam a taxas altas (até 120/s), e ler `transform` (state) de dentro
  // deles pegaria um valor de até um frame atrás (closure velha), fazendo a
  // matemática de zoom-no-cursor errar por um frame a cada gesto. As
  // atualizações de estado são agendadas por `requestAnimationFrame`, então
  // o React não repinta mais vezes do que o navegador consegue mostrar.
  const [transform, setTransform] = useState<Transform>(IDENTIDADE);
  const transformRef = useRef<Transform>(IDENTIDADE);
  const rafRef = useRef<number | null>(null);
  const [emArrasto, setEmArrasto] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const ponteirosRef = useRef<Map<number, PonteiroAtivo>>(new Map());
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  // ref, não state: o onClick do ponto (que dispara a navegação) roda
  // LOGO depois do pointerup, e precisa ler um valor síncrono — um state
  // ainda não teria repintado a essa altura
  const arrastouRef = useRef(false);
  const movimentoRef = useRef(0);
  // cacheada UMA VEZ por gesto (achado da revisão adversarial, 2026-08-21):
  // a CTM do <svg> só depende da posição/tamanho do próprio elemento na
  // página, que não muda DURANTE um arrasto — recalculá-la a cada
  // pointermove (até ~120/s) é uma chamada de geometria SVG redundante que
  // pode forçar layout do navegador à toa.
  const ctmRef = useRef<DOMMatrix | null>(null);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  function aplicarTransform(novo: Transform) {
    transformRef.current = novo;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setTransform(transformRef.current);
    });
  }

  function limitar(t: Transform): Transform {
    return limitarTransform(t, -MARGEM, MAPA_SP.largura + MARGEM, -MARGEM, MAPA_SP.altura + MARGEM);
  }

  /** clientX/clientY (do evento) → espaço OUTER (o do viewBox, fixo). Usa a
   * CTM cacheada do gesto em curso quando existe; senão pega uma nova (roda
   * do mouse e os botões não têm gesto — cada chamada é isolada). */
  function paraOuter(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = ctmRef.current ?? svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /** recalcula pinchRef a partir do par de ponteiros ATUALMENTE ativo — usada
   * tanto quando um 2º dedo desce quanto quando o Map volta a ter
   * exatamente 2 depois de alguém soltar (um 3º dedo que entrou e saiu, ou
   * um dos dois originais trocado). Sem isto, pinchRef ficava com o par
   * ERRADO nesses casos e o próximo movimento produzia um salto de
   * zoom/pan (achado da revisão adversarial, 2026-08-21). */
  function recalcularPinch() {
    if (ponteirosRef.current.size !== 2) { pinchRef.current = null; return; }
    const [a, b] = [...ponteirosRef.current.values()];
    pinchRef.current = { dist: distancia(a.ox, a.oy, b.ox, b.oy), mid: pontoMedio(a.ox, a.oy, b.ox, b.oy) };
  }

  // roda do mouse / pinça de trackpad — precisa de listener NATIVO (não o
  // onWheel do React) com `{ passive: false }` pra `preventDefault()`
  // funcionar de verdade quando FOR zoom. EXIGE Ctrl/Cmd (achado da revisão
  // adversarial, 2026-08-21): o mapa fica numa coluna larga e (a partir de
  // 1024px) fixa (position:sticky) ao lado da lista de clientes — sem essa
  // exigência, rolar a LISTA com a roda do mouse vira zoom no mapa sempre
  // que o cursor passa por cima dele, que é a maior parte da tela. Ctrl/Cmd
  // + roda é o padrão de qualquer mapa/editor sério, e é exatamente o que o
  // navegador já sintetiza sozinho pro pinça de trackpad — nenhum gesto de
  // verdade se perde.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const aoRolar = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // deixa a página/lista rolar normalmente
      e.preventDefault();
      const p = paraOuter(e.clientX, e.clientY);
      if (!p) return;
      aplicarTransform(limitar(zoomEm(transformRef.current, fatorDaRoda(e.deltaY), p.x, p.y)));
    };
    svg.addEventListener("wheel", aoRolar, { passive: false });
    return () => svg.removeEventListener("wheel", aoRolar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoPressionarPonteiro(e: ReactPointerEvent<SVGSVGElement>) {
    if (ponteirosRef.current.size === 0) {
      ctmRef.current = svgRef.current?.getScreenCTM() ?? null;
      arrastouRef.current = false;
      movimentoRef.current = 0;
    }
    const outer = paraOuter(e.clientX, e.clientY);
    if (!outer) return;
    ponteirosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: outer.x, oy: outer.y });
    // NÃO captura o ponteiro aqui pra um toque/clique parado (achado
    // CRÍTICO da revisão adversarial, 2026-08-21): a partir do Chrome 135,
    // um ponteiro CAPTURADO faz o navegador despachar o evento `click` no
    // elemento que capturou (o <svg>) em vez do alvo original (o <g> do
    // marcador) — clicar num cliente parava de navegar. A captura só
    // acontece quando o gesto vira arrasto de verdade (aoMoverPonteiro,
    // abaixo) ou quando um 2º dedo confirma que é um gesto de pinça (nunca
    // um clique — 2 dedos simultâneos não têm ambiguidade).
    if (ponteirosRef.current.size >= 2) {
      for (const id of ponteirosRef.current.keys()) e.currentTarget.setPointerCapture(id);
      recalcularPinch();
    }
  }

  function aoMoverPonteiro(e: ReactPointerEvent<SVGSVGElement>) {
    const anterior = ponteirosRef.current.get(e.pointerId);
    if (!anterior) return; // move sem down correspondente — não deveria, mas defensivo
    const outer = paraOuter(e.clientX, e.clientY);
    if (!outer) return;

    // distância acumulada em px de TELA desde o início do gesto — é o que
    // decide se isto foi um ARRASTO (mapa se move) ou um CLIQUE (navega
    // pro cliente). Some por trecho, não a distância direta entre o
    // início e o fim: sem isso, um arrasto "ida e volta" que termina perto
    // de onde começou passaria por clique.
    movimentoRef.current += Math.hypot(e.clientX - anterior.x, e.clientY - anterior.y);
    if (movimentoRef.current > LIMIAR_ARRASTO && !arrastouRef.current) {
      arrastouRef.current = true;
      setEmArrasto(true);
      setAlvo(null); // balão de dica não faz sentido durante o arrasto
      // só agora captura — um clique parado nunca chega até aqui, então o
      // <click> nativo dele continua acertando o marcador normalmente
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const novo: PonteiroAtivo = { x: e.clientX, y: e.clientY, ox: outer.x, oy: outer.y };
    ponteirosRef.current.set(e.pointerId, novo);

    if (ponteirosRef.current.size === 1) {
      aplicarTransform(limitar(deslocar(transformRef.current, outer.x - anterior.ox, outer.y - anterior.oy)));
    } else if (ponteirosRef.current.size === 2) {
      const [a, b] = [...ponteirosRef.current.values()];
      const distNova = distancia(a.ox, a.oy, b.ox, b.oy);
      const midNovo = pontoMedio(a.ox, a.oy, b.ox, b.oy);
      const p = pinchRef.current;
      if (p && p.dist > 0) {
        // 1) acompanha o deslocamento do centro do gesto (pan)…
        const pos1 = deslocar(transformRef.current, midNovo.x - p.mid.x, midNovo.y - p.mid.y);
        // …2) …escala pela variação de distância, centrado no centro ATUAL
        //    (o "pinça" — mantém o ponto entre os dois dedos parado na tela)
        const pos2 = zoomEm(pos1, distNova / p.dist, midNovo.x, midNovo.y);
        aplicarTransform(limitar(pos2));
      }
      pinchRef.current = { dist: distNova, mid: midNovo };
    }
    // com 3+ ponteiros ativos, nenhum ramo acima roda — a transformação
    // simplesmente pausa até voltar a 1 ou 2, o que é seguro
  }

  function aoSoltarPonteiro(e: ReactPointerEvent<SVGSVGElement>) {
    ponteirosRef.current.delete(e.pointerId);
    // recalcula (não só invalida) quando sobram exatamente 2 — cobre tanto
    // "um 3º dedo que tinha entrado saiu" quanto "um dos dois originais da
    // pinça soltou e ainda restam outros dois" (achado da revisão
    // adversarial, 2026-08-21)
    if (ponteirosRef.current.size === 2) recalcularPinch();
    else if (ponteirosRef.current.size < 2) pinchRef.current = null;
    if (ponteirosRef.current.size === 0) {
      setEmArrasto(false);
      ctmRef.current = null;
      // adiado pro próximo macrotask (achado da revisão adversarial,
      // 2026-08-21): o `click` sintético do navegador, quando o gesto
      // termina em cima de um marcador, dispara SINCRONAMENTE logo depois
      // deste pointerup — o onClick do ponto ainda precisa ver
      // arrastouRef=true nesse instante pra suprimir a navegação indevida.
      // Zerar synchronous aqui faria isso funcionar, mas também faria um
      // arrasto que termina em ÁREA VAZIA deixar a flag PRESA em true pra
      // sempre (nada mais zera ela) — o balão de dica pararia de reabrir
      // em qualquer hover seguinte. Adiar resolve os dois: o clique (se
      // houver) já rodou antes do timeout, e o hover volta a funcionar.
      setTimeout(() => { arrastouRef.current = false; }, 0);
    }
  }

  function aoTeclar(e: ReactKeyboardEvent<SVGSVGElement>) {
    // pan por teclado (achado de acessibilidade da revisão adversarial,
    // 2026-08-21): os botões cobrem zoom, mas sem isto não havia NENHUM
    // jeito de mover o mapa sem ponteiro/toque.
    const PASSO = 60;
    const deltas: Record<string, [number, number]> = {
      ArrowUp: [0, PASSO], ArrowDown: [0, -PASSO],
      ArrowLeft: [PASSO, 0], ArrowRight: [-PASSO, 0],
    };
    const d = deltas[e.key];
    if (!d) return;
    e.preventDefault();
    aplicarTransform(limitar(deslocar(transformRef.current, d[0], d[1])));
  }

  function zoomBotao(fator: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    // zoom pelo botão centra no meio do que está visível AGORA — não no
    // meio do mapa inteiro, que poderia estar fora de vista
    const centro = paraOuter(r.left + r.width / 2, r.top + r.height / 2);
    if (!centro) return;
    aplicarTransform(limitar(zoomEm(transformRef.current, fator, centro.x, centro.y)));
  }

  function resetarView() {
    transformRef.current = IDENTIDADE;
    setTransform(IDENTIDADE);
  }

  const noZoomMinimo = transform.k <= ZOOM_MIN + 1e-6;
  const noZoomMaximo = transform.k >= ZOOM_MAX - 1e-6;
  const semAlteracao = noZoomMinimo && transform.x === 0 && transform.y === 0;

  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  // Três buckets, não dois. O contador antigo somava num só tudo que não
  // entra no mapa, e o rótulo dizia "fora de São Paulo" — o que era MENTIRA
  // para quem mora num bairro que o recorte tirou: BSGA (Penha) e Maria
  // Domitila (Casa Verde) estão em São Paulo, só não estão no desenho.
  // A cidade do cadastro é quem decide o rótulo, não a geometria do mapa.
  const { pontos, foraDaCidade, foraDoRecorte, semCoordenada } = useMemo(() => {
    const pts: Ponto[] = [];
    let outraCidade = 0;
    let recortados = 0;
    let sem = 0;
    for (const c of clientes) {
      if (c.latitude == null || c.longitude == null) { sem++; continue; }
      if (!dentroDaCidade(c.latitude, c.longitude)) {
        if (c.cidade && c.cidade !== "São Paulo") outraCidade++;
        else recortados++;
        continue;
      }
      const { x, y } = projetar(c.latitude, c.longitude);
      pts.push({ id: c.id, nome: c.nome, x, y, cor: corDoCliente(c.id, isLight) });
    }
    return {
      pontos: pts,
      foraDaCidade: outraCidade,
      foraDoRecorte: recortados,
      semCoordenada: sem,
    };
  }, [clientes, isLight]);

  // o mapa é o fundo: cinza que não briga com o ponto colorido por cima
  const preenchimento = isLight ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.055)";
  const divisa = isLight ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.17)";

  return (
    <div className="elevavel" style={{
      ...card(isLight),
      padding: "14px 16px 12px",
      display: "flex", flexDirection: "column",
      boxSizing: "border-box",
      position: "relative",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
          letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
        }}>
          Mapa · Cidade de São Paulo
        </span>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
          {pontos.length} na área do mapa
        </span>
      </div>

      {/* Altura EXPLÍCITA — o card não tem altura própria (o grid o alinha com
          `align-items: start`), então pedir altura por `flex: 1` colapsa para
          zero. Foi o que deixou o mapa invisível numa versão anterior. */}
      <div style={{
        height: "min(78vh, 900px)",
        marginTop: 10,
        display: "flex", justifyContent: "center",
        position: "relative",
      }}>
        {/* wrapper do tamanho exato do svg: o tooltip é posicionado em % e,
            ancorado no card, descolaria do ponto quando o svg fosse mais
            estreito que a coluna */}
        <div style={{ position: "relative", height: "100%", display: "flex" }}>
          {/* height manda e a largura sai da proporção do viewBox: assim o
              mapa cabe inteiro na altura reservada, em qualquer coluna.

              O VIEWBOX NÃO MUDA com o zoom — quem se move é o <g> de dentro,
              via transform="translate(...) scale(...)". Isso mantém a
              matemática de ponteiro simples (getScreenCTM do próprio <svg>
              é uma referência ESTÁVEL, que não muda a cada zoom) — ver o
              cabeçalho de mapa-zoom.ts. */}
          <svg
            ref={svgRef}
            viewBox={`-${MARGEM} -${MARGEM} ${VB_LARGURA} ${VB_ALTURA}`}
            style={{
              height: "100%", width: "auto", maxWidth: "100%",
              // "none" só a partir do zoom mínimo pra cima: em k=1 (o
              // padrão) arrastar o mapa não move NADA — limitarTransform
              // trava x=y=0 sem folga — então travar o toque ali só
              // atrapalharia quem quer rolar a PÁGINA no celular, onde o
              // mapa aparece primeiro na coluna única (achado da revisão
              // adversarial, 2026-08-21). "pan-y" deixa o navegador rolar a
              // página verticalmente com 1 dedo E já desliga o pinça nativo
              // de zoom (a especificação do touch-action já exclui
              // pinch-zoom quando algum pan-* é dado sozinho), então o
              // gesto de 2 dedos ainda chega inteiro nos handlers abaixo.
              touchAction: noZoomMinimo ? "pan-y" : "none",
              cursor: emArrasto ? "grabbing" : "grab",
            }}
            tabIndex={0}
            onMouseLeave={() => setAlvo(null)}
            onPointerDown={aoPressionarPonteiro}
            onPointerMove={aoMoverPonteiro}
            onPointerUp={aoSoltarPonteiro}
            onPointerCancel={aoSoltarPonteiro}
            onKeyDown={aoTeclar}
            role="img"
            aria-label={`Mapa da cidade de São Paulo com ${pontos.length} clientes — arraste para mover, use as setas do teclado para navegar, Ctrl e role o mouse para dar zoom`}
          >
            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
              <g>
                {DISTRITOS.map(([nome, d]) => (
                  <path
                    key={nome}
                    d={d}
                    fill={preenchimento}
                    stroke={divisa}
                    strokeWidth={1}
                    // mantém o traço com a MESMA espessura na TELA em
                    // qualquer zoom, sem precisar recalcular `1/k` a cada
                    // frame (que reescrevia o atributo em ~47 elementos por
                    // frame de zoom à toa — achado de performance da
                    // revisão adversarial, 2026-08-21)
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  >
                    {/* o nome do bairro no hover: dá referência sem poluir */}
                    <title>{nome}</title>
                  </path>
                ))}
              </g>

              {/* nome do bairro dentro do próprio bairro (2026-08-21, Davi) —
                  branco fixo (não segue o tema): é rótulo do MAPA, não texto da
                  interface, e continua legível sobre qualquer distrito, claro
                  ou escuro. O contorno escuro por baixo (paintOrder=stroke) é
                  o halo que dá contraste no tema claro, onde o preenchimento
                  do distrito é quase branco — sem ele o nome sumiria ali. */}
              <g style={{ pointerEvents: "none" }}>
                {ROTULOS_DISTRITOS.map(({ nome, x, y }) => (
                  <text
                    key={nome}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.55)"
                    strokeWidth={2.4}
                    vectorEffect="non-scaling-stroke"
                    paintOrder="stroke"
                    style={{
                      fontFamily: "Montserrat, var(--fonte)",
                      fontWeight: 400,
                      fontSize: 8.2,
                    }}
                  >
                    {nome}
                  </text>
                ))}
              </g>

              {pontos.map((p) => (
                <g
                  key={p.id}
                  // não reabre o balão se o cursor passar por cima de um
                  // ponto NO MEIO de um arrasto — mouseenter é uma família
                  // de evento separada do pointer capture, então continua
                  // disparando durante o arrasto mesmo com o ponteiro "preso"
                  onMouseEnter={() => { if (!arrastouRef.current) setAlvo(p); }}
                  onClick={() => {
                    // um clique que terminou um ARRASTO não navega — só
                    // "solta" a bandeira aqui: o próximo clique de verdade
                    // (sem arrasto) precisa voltar a navegar normalmente
                    if (arrastouRef.current) { arrastouRef.current = false; return; }
                    navigate({ to: "/clientes/$id", params: { id: p.id } });
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={p.x} cy={p.y} r={13} fill={p.cor} opacity={0.22} />
                  <circle
                    cx={p.x} cy={p.y} r={5.5}
                    fill={p.cor}
                    stroke={isLight ? "#ffffff" : "#141416"}
                    strokeWidth={2}
                  />
                  {/* alvo de clique generoso e invisível */}
                  <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
                </g>
              ))}
            </g>
          </svg>

          {alvo && (() => {
            const pos = paraPercentual(transform, alvo.x, alvo.y, MAPA_SP.largura, MAPA_SP.altura, MARGEM);
            return (
              <div style={{
                position: "absolute",
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                transform: "translate(-50%, -140%)",
                padding: "5px 10px",
                borderRadius: 10,
                background: isLight ? "rgba(255,255,255,0.96)" : "rgba(20,20,26,0.96)",
                border: `1px solid ${alvo.cor}`,
                boxShadow: `0 4px 14px ${alvo.cor}40`,
                fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
                color: isLight ? "#0a0b0e" : "#ffffff",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 3,
              }}>
                {alvo.nome}
              </div>
            );
          })()}

          {/* controles de zoom — canto inferior direito, o lugar de sempre
              em mapa (Google Maps, etc.). Ficam fora do <svg> (HTML comum)
              pra não herdar o transform/scale do conteúdo. */}
          <div style={{
            position: "absolute", right: 10, bottom: 10, zIndex: 4,
            display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end",
          }}>
            <div style={{
              display: "flex", flexDirection: "column",
              borderRadius: 10, overflow: "hidden",
              border: isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)",
              background: isLight ? "rgba(255,255,255,0.96)" : "rgba(20,20,26,0.92)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            }}>
              <BotaoMapa
                Icon={Plus} rotulo="Aumentar zoom" isLight={isLight}
                desabilitado={noZoomMaximo}
                aoClicar={() => zoomBotao(1.4)}
              />
              <div style={{
                height: 1,
                background: isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)",
              }} />
              <BotaoMapa
                Icon={Minus} rotulo="Diminuir zoom" isLight={isLight}
                desabilitado={noZoomMinimo}
                aoClicar={() => zoomBotao(1 / 1.4)}
              />
            </div>
            <div style={{
              borderRadius: 10, overflow: "hidden",
              border: isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)",
              background: isLight ? "rgba(255,255,255,0.96)" : "rgba(20,20,26,0.92)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            }}>
              <BotaoMapa
                Icon={Maximize2} rotulo="Restaurar a visão inteira" isLight={isLight}
                desabilitado={semAlteracao}
                aoClicar={resetarView}
              />
            </div>
          </div>

          <span style={{
            position: "absolute", left: 10, bottom: 10, zIndex: 4,
            fontFamily: FONT, fontWeight: 500, fontSize: 10.5,
            color: isLight ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.38)",
            pointerEvents: "none", userSelect: "none",
          }}>
            Arraste para mover · Ctrl + role para dar zoom
          </span>
        </div>
      </div>

      {(foraDaCidade > 0 || foraDoRecorte > 0 || semCoordenada > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 11 }}>
          {foraDaCidade > 0 && (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
              Quantidade de clientes fora de São Paulo:{" "}
              <strong style={{ fontWeight: 700, color: isLight ? "#0a0b0e" : "#ffffff" }}>
                {foraDaCidade}
              </strong>
            </span>
          )}
          {/* Linha própria: estes ESTÃO em São Paulo. Somá-los à linha de cima
              faria o painel afirmar algo falso sobre onde o cliente fica. */}
          {foraDoRecorte > 0 && (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
              {foraDoRecorte} em bairro fora da área do mapa
            </span>
          )}
          {semCoordenada > 0 && (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
              {semCoordenada} sem endereço cadastrado — não entram no mapa
            </span>
          )}
        </div>
      )}
    </div>
  );
}
