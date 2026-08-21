// Matemática pura do zoom/pan do mapa de Clientes (2026-08-21, Davi:
// "mecanismo de zoom... movimentar o mapa com zoom, algo sistemicamente
// completo"). Separado do componente de propósito: é a mesma regra do resto
// do projeto — o que pode ser testado sem DOM vira função pura, o componente
// só liga a matemática ao ponteiro/roda/toque.
//
// ESPAÇO DE COORDENADAS: o SVG tem um viewBox FIXO — ele nunca muda. O que
// se move é um `<g transform="translate(x,y) scale(k)">` por dentro dele.
// "outer" = o espaço do viewBox (fixo, o que `getScreenCTM()` do próprio
// `<svg>` devolve — não muda com o zoom). "conteúdo" = o espaço onde os
// distritos/pontos são desenhados (os mesmos números de sempre). A relação
// entre os dois é exatamente a transformação: outer = k·conteúdo + (x,y).

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;

export const IDENTIDADE: Transform = { x: 0, y: 0, k: 1 };

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Aplica um fator de escala centrado no ponto (ox,oy) — em espaço OUTER —
 * mantendo esse ponto fixo na tela. É a matemática de "zoom no cursor": sem
 * ela, zoom sempre cresceria a partir do canto/centro, e o ponto que a
 * pessoa está mirando com o mouse "escaparia" a cada scroll.
 */
export function zoomEm(t: Transform, fator: number, ox: number, oy: number): Transform {
  const k2 = clamp(t.k * fator, ZOOM_MIN, ZOOM_MAX);
  if (k2 === t.k) return t; // já no limite — nova referência só se algo mudou
  // (ox,oy) em espaço de conteúdo, pela transformação ATUAL
  const px = (ox - t.x) / t.k;
  const py = (oy - t.y) / t.k;
  return { k: k2, x: ox - k2 * px, y: oy - k2 * py };
}

/** Desloca a transformação por um delta em espaço OUTER (arrastar). */
export function deslocar(t: Transform, dx: number, dy: number): Transform {
  return { ...t, x: t.x + dx, y: t.y + dy };
}

function limitarEixo(pos: number, k: number, a: number, b: number): number {
  // a "janela" (o viewBox) e o "conteúdo" são o MESMO retângulo em k=1 (o
  // viewBox foi enquadrado exatamente no conteúdo) — então a faixa válida de
  // deslocamento, em cada eixo, é onde o retângulo escalado ainda cobre o
  // retângulo original [a,b] por inteiro.
  const lim1 = b * (1 - k);
  const lim2 = a * (1 - k);
  return clamp(pos, Math.min(lim1, lim2), Math.max(lim1, lim2));
}

/**
 * Não deixa o mapa sair inteiramente de vista. `[a0,b0]` e `[a1,b1]` são os
 * limites do viewBox em x e em y — em k=1 (zoom mínimo) o resultado é sempre
 * x=0,y=0 (não há folga nenhuma pra arrastar quando o conteúdo já enche a
 * janela exatamente).
 */
export function limitarTransform(t: Transform, a0: number, b0: number, a1: number, b1: number): Transform {
  return { k: t.k, x: limitarEixo(t.x, t.k, a0, b0), y: limitarEixo(t.y, t.k, a1, b1) };
}

/** Distância euclidiana — usada pra medir o "pinça" de dois dedos. */
export function distancia(x0: number, y0: number, x1: number, y1: number): number {
  return Math.hypot(x1 - x0, y1 - y0);
}

/** Ponto médio — o centro do gesto de pinça, onde o zoom deve ficar fixo. */
export function pontoMedio(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/**
 * O fator de zoom de uma roda de mouse/trackpad. Exponencial, não linear —
 * cresce suave com o deltaY em vez de um degrau fixo por evento, o que é o
 * que faz o pinça-de-trackpad (que o navegador expõe como `wheel` com
 * `ctrlKey`) parecer contínuo em vez de picotado.
 */
export function fatorDaRoda(deltaY: number): number {
  return Math.exp(-deltaY * 0.0018);
}

/**
 * Converte um ponto em espaço de CONTEÚDO para uma posição percentual dentro
 * do viewBox — o que o CSS `left/top: %` do balão de dica (fora do SVG,
 * ancorado no wrapper) precisa pra continuar colado no ponto certo mesmo com
 * zoom/pan ativos. `margem` é a folga do viewBox (o -6/+6 de sempre).
 */
export function paraPercentual(
  t: Transform, x: number, y: number, largura: number, altura: number, margem: number,
): { left: number; top: number } {
  const ox = t.k * x + t.x;
  const oy = t.k * y + t.y;
  return {
    left: ((ox + margem) / (largura + 2 * margem)) * 100,
    top: ((oy + margem) / (altura + 2 * margem)) * 100,
  };
}
