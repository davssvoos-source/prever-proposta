// O mapa da CIDADE de São Paulo, por DISTRITOS — U24.
//
// COMO CHEGOU AQUI (2026-08-20). Três versões:
//   1. silhueta vazia do município — não era um mapa: sem nada dentro, os
//      pontos flutuavam sem referência e ninguém reconhecia onde era o quê;
//   2. Leaflet com tiles — virava mapa de verdade, mas trazia o desenho de
//      outra casa para dentro do painel;
//   3. esta: os 94 distritos desenhados com o traço do sistema. O Davi mandou
//      o exemplo (mapa eleitoral por distrito) dizendo "os bairros de São
//      Paulo" — é o que dá referência SEM importar design de fora.
//
// PARELHEIROS E MARSILAC FICARAM DE FORA. São a área rural do extremo sul:
// quase metade do território do município, nenhum cliente, e tão altos que
// espremiam a cidade real num terço do quadro. Sem eles o mapa tem a forma que
// as pessoas reconhecem — do Grajaú a Santana, de Perus a Itaquera. Quem
// estiver lá conta como "fora de São Paulo" no rodapé; é consequência aceita.
//
// Cada cliente é um ponto na cor que o degradê dá a ele (corDoCliente) — a
// MESMA cor do ponto dele no card da lista ao lado, que é como o olho liga as
// duas metades da tela. Os distritos ficam em tom neutro de propósito: se
// tivessem cor própria, disputariam com os clientes, que são o assunto.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { DISTRITOS, MAPA_SP, projetar, dentroDaCidade } from "@/features/clientes/mapa-sp";
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
      if (!dentroDaCidade(c.latitude, c.longitude)) { fora++; continue; }
      const { x, y } = projetar(c.latitude, c.longitude);
      pts.push({ id: c.id, nome: c.nome, x, y, cor: corDoCliente(c.id, isLight) });
    }
    return { pontos: pts, foraDeSaoPaulo: fora, semCoordenada: sem };
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
          {pontos.length} na cidade
        </span>
      </div>

      {/* Altura EXPLÍCITA — o card não tem altura própria (o grid o alinha com
          `align-items: start`), então pedir altura por `flex: 1` colapsa para
          zero. Foi o que deixou o mapa invisível numa versão anterior. */}
      <div style={{
        height: "min(58vh, 560px)",
        marginTop: 10,
        display: "flex", justifyContent: "center",
        position: "relative",
      }}>
        {/* wrapper do tamanho exato do svg: o tooltip é posicionado em % e,
            ancorado no card, descolaria do ponto quando o svg fosse mais
            estreito que a coluna */}
        <div style={{ position: "relative", height: "100%", display: "flex" }}>
          {/* height manda e a largura sai da proporção do viewBox: assim o
              mapa cabe inteiro na altura reservada, em qualquer coluna */}
          <svg
            viewBox={`-6 -6 ${MAPA_SP.largura + 12} ${MAPA_SP.altura + 12}`}
            style={{ height: "100%", width: "auto", maxWidth: "100%" }}
            onMouseLeave={() => setAlvo(null)}
            role="img"
            aria-label={`Mapa da cidade de São Paulo com ${pontos.length} clientes`}
          >
            <g>
              {DISTRITOS.map(([nome, d]) => (
                <path
                  key={nome}
                  d={d}
                  fill={preenchimento}
                  stroke={divisa}
                  strokeWidth={1}
                  strokeLinejoin="round"
                >
                  {/* o nome do bairro no hover: dá referência sem poluir */}
                  <title>{nome}</title>
                </path>
              ))}
            </g>

            {pontos.map((p) => (
              <g
                key={p.id}
                onMouseEnter={() => setAlvo(p)}
                onClick={() => navigate({ to: "/clientes/$id", params: { id: p.id } })}
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
          </svg>

          {alvo && (
            <div style={{
              position: "absolute",
              left: `${(alvo.x / MAPA_SP.largura) * 100}%`,
              top: `${(alvo.y / MAPA_SP.altura) * 100}%`,
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
          )}
        </div>
      </div>

      {(foraDeSaoPaulo > 0 || semCoordenada > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 11 }}>
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
