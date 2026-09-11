// O quadro do Painel Comercial — uma coluna por ETAPA do ciclo (R252).
//
// Davi, 10/09/2026: "Crie o modo de visualização Kanban e lista no painel
// Comercial de acordo com o status da visita técnica e proposta comercial."
//
// O eixo é a etapa derivada (`etapaDaVisita`) — a MESMA função que pinta o chip
// da lista, conta os chips de filtro e monta o funil. Um quadro que decidisse a
// coluna por conta própria discordaria dos números logo acima dele na primeira
// mudança de regra.
//
// O que ele NÃO faz, de propósito: **arrastar para mudar de coluna**. No quadro
// da Início soltar um card muda o `status` do chamado, que é um campo escrito à
// mão. Aqui a etapa é DERIVADA de dois fatos (o status da visita e o carimbo
// `proposta_enviada_em`), e cada transição tem porta própria — aprovar é na
// tela da visita, enviar é o botão "Proposta enviada" (a RPC `registrar_envio_
// proposta`, R78). Arrastar teria de adivinhar qual das duas escritas fazer, e
// "cancelada" nem porta tem. Card que se move sem regra é promessa falsa.
//
// A casca é a mesma do quadro da Início: trilho que rola de lado com a barra
// escondida (`trilho-x sangra-x`), colunas que dividem a largura com piso de
// 200px (o nome de prédio é mais longo que o título de um chamado), cabeçalho
// com bolinha da cor da etapa, rótulo e contagem, cards com gap 9.

import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import {
  etapaDaVisita, ETAPA_LABEL, ETAPA_CORES, type EtapaComercial,
} from "@/features/comercial/etapas";
import { CartaoDaVisita, type VisitaDoPainel } from "./CartaoDaVisita";

/** Piso da coluna: abaixo disto o nome do prédio quebra em quatro linhas. */
const LARGURA_MINIMA_COLUNA = 200;

interface Props {
  visitas: VisitaDoPainel[];
  /** quais colunas mostrar (o chip de etapa escolhe uma; "todas" traz o ciclo) */
  colunas: EtapaComercial[];
  tecMap: Map<string, string | null>;
  isAdmin?: boolean;
  marcando?: boolean;
  onAbrir: (v: VisitaDoPainel) => void;
  onMarcarEnviada: (id: string) => void;
  onExcluir: (id: string) => void;
}

export function QuadroComercial({
  visitas, colunas, tecMap, isAdmin = false, marcando = false,
  onAbrir, onMarcarEnviada, onExcluir,
}: Props) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";

  const porEtapa = new Map<EtapaComercial, VisitaDoPainel[]>();
  for (const v of visitas) {
    const e = etapaDaVisita(v);
    porEtapa.set(e, [...(porEtapa.get(e) ?? []), v]);
  }

  return (
    <div className="trilho-x sangra-x">
      {/* `stretch`: todas as colunas com a altura da mais alta, para a coluna
          curta não "sumir" ao lado de uma cheia (a lição da R233 no quadro da
          Início — aqui vale para a leitura, já que não há arrasto). */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 10, paddingBottom: 4 }}>
        {colunas.map((e) => {
          const itens = porEtapa.get(e) ?? [];
          const cor = ETAPA_CORES[e];
          return (
            <div
              key={e}
              style={{
                flex: "1 1 0", minWidth: LARGURA_MINIMA_COLUNA,
                display: "flex", flexDirection: "column", borderRadius: 16,
              }}
            >
              <div style={{
                flexShrink: 0, padding: "4px 6px 10px",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                  background: isLight ? cor.light : cor.dark,
                }} />
                <span style={{
                  fontFamily: FONT, fontWeight: 700, fontSize: 11,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: textPrimary, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {ETAPA_LABEL[e]}
                </span>
                <span style={{
                  marginLeft: "auto", flexShrink: 0,
                  fontFamily: FONT, fontWeight: 600, fontSize: 11,
                  color: textSecondary, fontVariantNumeric: "tabular-nums",
                }}>
                  {itens.length}
                </span>
              </div>

              <div style={{
                padding: "0 0 8px", display: "flex", flexDirection: "column", gap: 9,
                flex: "1 1 auto", minHeight: 140,
              }}>
                {itens.length === 0 ? (
                  <span style={{
                    fontFamily: FONT, fontWeight: 400, fontSize: 11,
                    color: textSecondary, textAlign: "center", padding: "18px 0",
                  }}>
                    vazia
                  </span>
                ) : itens.map((v) => (
                  <CartaoDaVisita
                    key={v.id}
                    v={v}
                    formato="cartao"
                    tecnicoNome={v.tecnico_id ? tecMap.get(v.tecnico_id) : null}
                    isAdmin={isAdmin}
                    marcando={marcando}
                    onAbrir={() => onAbrir(v)}
                    onMarcarEnviada={() => onMarcarEnviada(v.id)}
                    onExcluir={() => onExcluir(v.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
