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
// no nível do CEP). Cliente sem coordenada não aparece no mapa — aparece na
// lista, e o rodapé diz quantos ficaram de fora. Clientes fora do município
// (Osasco, Cotia, Campinas…) não têm como aparecer num contorno da capital:
// viram os chips de "fora da capital" no rodapé, com a contagem por cidade.
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

  const { pontos, foraDaCapital, semCoordenada } = useMemo(() => {
    const pts: Ponto[] = [];
    const fora: Record<string, number> = {};
    let sem = 0;
    for (const c of clientes) {
      if (c.latitude == null || c.longitude == null) { sem++; continue; }
      if (!dentroDoMapa(c.latitude, c.longitude)) {
        // fora do contorno da capital — cidade do cadastro, ou "Outra"
        const cidade = c.cidade || "Outra cidade";
        fora[cidade] = (fora[cidade] ?? 0) + 1;
        continue;
      }
      const { x, y } = projetar(c.latitude, c.longitude);
      pts.push({ id: c.id, nome: c.nome, x, y, cor: corDoCliente(c.id, isLight) });
    }
    return {
      pontos: pts,
      foraDaCapital: Object.entries(fora).sort((a, b) => b[1] - a[1]),
      semCoordenada: sem,
    };
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

      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", paddingTop: 8 }}>
        {/* wrapper do TAMANHO EXATO do svg: o tooltip é posicionado em % e,
            ancorado no card, descolava do ponto quando o svg era mais estreito
            que a coluna (medido em até 99px). Aqui os dois falam a mesma caixa. */}
        <div style={{ position: "relative", height: "100%", display: "flex" }}>
        <svg
          viewBox={`-8 -8 ${MAPA_SP.largura + 16} ${MAPA_SP.altura + 16}`}
          style={{ height: "100%", maxHeight: 520, maxWidth: "100%" }}
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

      {(foraDaCapital.length > 0 || semCoordenada > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 10 }}>
          {foraDaCapital.map(([cidade, n]) => (
            <span key={cidade} style={{
              padding: "3px 9px", borderRadius: 999,
              background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
              fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
              color: textSecondary, whiteSpace: "nowrap",
            }}>
              {cidade} · {n}
            </span>
          ))}
          {semCoordenada > 0 && (
            <span style={{
              padding: "3px 9px", borderRadius: 999,
              background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
              fontFamily: FONT, fontWeight: 400, fontSize: 10.5, color: textSecondary,
            }}>
              {semCoordenada} sem coordenada
            </span>
          )}
        </div>
      )}
    </div>
  );
}
