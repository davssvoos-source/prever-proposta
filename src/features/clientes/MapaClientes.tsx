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

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { DISTRITOS, MAPA_SP, projetar, dentroDaCidade, centroide } from "@/features/clientes/mapa-sp";
import { corDoCliente } from "@/features/clientes/cores";
import type { Cliente } from "@/features/clientes/data";

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

export function MapaClientes({ clientes }: Props) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const [alvo, setAlvo] = useState<Ponto | null>(null);

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
