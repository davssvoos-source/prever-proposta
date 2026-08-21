// O mapa do município de São Paulo — U24, pedido do Davi: "um mapa do
// município no design que criamos, com mini ícones na localização de cada
// cliente".
//
// É SVG nosso, não Leaflet: o /mapa de visitas usa tile do OpenStreetMap, e
// tile traz o design de outro lugar. Aqui o contorno é a malha do IBGE
// desenhada com o traço do sistema, e cada cliente é um ponto na cor que o
// degradê dá a ele (corDoCliente) — a MESMA cor do ponto dele na lista ao
// lado, que é como o olho liga as duas metades da tela.
//
// Coordenada vem do banco (latitude/longitude, preenchidas pela migration U24
// no nível do CEP).
//
// O mapa é da CIDADE de São Paulo, e o rodapé resolve os dois casos que não
// cabem nele, com uma linha cada:
//   · fora do município (Osasco, Cotia, Campinas…) → só a CONTAGEM. A lista de
//     cidades que existia aqui saiu a pedido do Davi: num painel que existe
//     para mostrar a capital, enumerar municípios era ruído.
//   · sem endereço cadastrado → contagem à parte, porque é outra coisa. Não é
//     estar fora: é não sabermos onde é. Sem essa linha, a soma do mapa não
//     bateria com a da lista e a diferença ficaria sem explicação.
// Os dois continuam na LISTA ao lado — deixar de aparecer no mapa não os tira
// da base.
//
// O tooltip é HTML posicionado por estado (não <title> SVG): o nativo demora
// um segundo para abrir e não segue o tema.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, espectro } from "@/lib/paleta";
import { MAPA_SP, projetar, dentroDoMapa } from "@/features/clientes/mapa-sp";
import { corDoCliente } from "@/features/clientes/cores";
import type { Cliente } from "@/features/clientes/data";

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

export function MapaClientes({ clientes }: Props) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const [alvo, setAlvo] = useState<Ponto | null>(null);

  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const { pontos, foraDeSaoPaulo, semCoordenada } = useMemo(() => {
    const pts: Ponto[] = [];
    let fora = 0;
    let sem = 0;
    for (const c of clientes) {
      if (c.latitude == null || c.longitude == null) { sem++; continue; }
      // fora do contorno do município: só conta. A cidade de cada um saiu do
      // rodapé a pedido do Davi — a lista de cidades era ruído num painel que
      // existe para mostrar a capital.
      if (!dentroDoMapa(c.latitude, c.longitude)) { fora++; continue; }
      const { x, y } = projetar(c.latitude, c.longitude);
      pts.push({ id: c.id, nome: c.nome, x, y, cor: corDoCliente(c.id, isLight) });
    }
    return { pontos: pts, foraDeSaoPaulo: fora, semCoordenada: sem };
  }, [clientes, isLight]);

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
          Mapa · São Paulo
        </span>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
          {pontos.length} no município
        </span>
      </div>

      {/* ALTURA EXPLÍCITA — e não `flex: 1`.
          O card do mapa não tem altura própria e o grid o alinha com
          `align-items: start`, então ele encolhe até o conteúdo. Com
          `flex: 1; min-height: 0` esta faixa colapsava para ZERO, e o
          `height: 100%` do svg virava 100% de nada: o mapa existia no DOM,
          com os pontos certos, e não ocupava um pixel.
          A altura vem do viewport porque o mapa é o índice visual da lista e
          precisa caber junto dela na tela; o teto de 620px evita que ele
          estique demais num monitor alto. */}
      <div style={{
        height: "min(62vh, 620px)",
        display: "flex", justifyContent: "center", paddingTop: 8,
      }}>
        {/* wrapper do TAMANHO EXATO do svg: o tooltip é posicionado em % e,
            ancorado no card, descolava do ponto quando o svg era mais estreito
            que a coluna (medido em até 99px). Aqui os dois falam a mesma caixa. */}
        <div style={{ position: "relative", height: "100%", display: "flex" }}>
        {/* height manda e a largura sai da proporção do viewBox: o contorno
            de São Paulo é bem mais alto que largo (1000×1544), então caber
            pela ALTURA é o que o mantém inteiro na tela. */}
        <svg
          viewBox={`-8 -8 ${MAPA_SP.largura + 16} ${MAPA_SP.altura + 16}`}
          style={{ height: "100%", width: "auto", maxWidth: "100%" }}
          onMouseLeave={() => setAlvo(null)}
          role="img"
          aria-label={`Mapa do município de São Paulo com ${pontos.length} clientes`}
        >
          <defs>
            {/* o traço do contorno percorre o degradê da casa, de leve */}
            <linearGradient id="borda-sp" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={espectro(0, isLight)} />
              <stop offset="50%" stopColor={espectro(4, isLight)} />
              <stop offset="100%" stopColor={espectro(8, isLight)} />
            </linearGradient>
          </defs>

          <path
            d={MAPA_SP.d}
            fill={isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)"}
            stroke="url(#borda-sp)"
            strokeWidth={3}
            strokeOpacity={0.55}
            strokeLinejoin="round"
          />

          {pontos.map((p) => (
            <g
              key={p.id}
              onMouseEnter={() => setAlvo(p)}
              onClick={() => navigate({ to: "/clientes/$id", params: { id: p.id } })}
              style={{ cursor: "pointer" }}
            >
              {/* halo na própria cor — o "glow fraco" do padrão do sistema */}
              <circle cx={p.x} cy={p.y} r={16} fill={p.cor} opacity={0.22} />
              <circle
                cx={p.x} cy={p.y} r={7}
                fill={p.cor}
                stroke={isLight ? "#ffffff" : "#141416"}
                strokeWidth={2.5}
              />
              {/* alvo de clique generoso e invisível */}
              <circle cx={p.x} cy={p.y} r={22} fill="transparent" />
            </g>
          ))}
        </svg>

        {alvo && (
          <div style={{
            position: "absolute",
            // o tooltip acompanha o ponto em % do viewBox — simples e estável
            left: `${(alvo.x / MAPA_SP.largura) * 100}%`,
            top: `${(alvo.y / MAPA_SP.altura) * 100}%`,
            transform: "translate(-50%, -135%)",
            padding: "5px 10px",
            borderRadius: 10,
            background: isLight ? "rgba(255,255,255,0.95)" : "rgba(20,20,26,0.95)",
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
        )}
        </div>
      </div>

      {/* Uma linha, não uma lista de cidades: o mapa é da capital, e quem está
          fora dela interessa como NÚMERO — não como enumeração de municípios.
          "sem coordenada" fica porque é outra coisa: não é estar fora, é não
          termos o endereço. Sem ele, a soma do mapa não bateria com a lista e
          a diferença ficaria sem explicação. */}
      {(foraDeSaoPaulo > 0 || semCoordenada > 0) && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 3,
          paddingTop: 12, marginTop: "auto",
          borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.07)",
        }}>
          {foraDeSaoPaulo > 0 && (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
              Quantidade de clientes fora de São Paulo:{" "}
              <strong style={{ fontWeight: 700, color: isLight ? "#0a0b0e" : "#ffffff" }}>
                {foraDeSaoPaulo}
              </strong>
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
