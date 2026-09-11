// O item do Painel Comercial — UM componente, dois formatos.
//
// R252 (Davi, 10/09/2026): "Crie o modo de visualização Kanban e lista no
// painel Comercial de acordo com o status da visita técnica e proposta
// comercial." Duas visões da mesma coisa pedem UM desenho: se a linha da lista
// e o card do quadro fossem dois trechos de JSX, a primeira mudança de regra
// (um campo novo, outro rótulo, outro botão) valeria só para um dos dois — foi
// exatamente o que aconteceu com o card do chamado até a U17, e a saída foi
// esta: `CardAtividade` com `mostrarStatus`.
//
// `formato="linha"` é o que a lista sempre teve (título à esquerda, etapa e
// ações à direita, tudo numa faixa). `formato="cartao"` é o mesmo conteúdo
// empilhado para caber numa coluna estreita — e ali a ETIQUETA DE ETAPA SOME,
// porque a coluna já diz a etapa (a mesma regra do `mostrarStatus={false}` no
// quadro da Início: repetir o status dentro da coluna dele é ruído).

import type { CSSProperties } from "react";
import { CalendarDays, MapPin, Send, Trash2, User } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import {
  etapaDaVisita, tituloDaVisita, ETAPA_LABEL, ETAPA_CORES,
} from "@/features/comercial/etapas";
import { ETAPA_ICONE } from "@/features/comercial/icones";

/** O que o painel lê de uma visita. A consulta traz mais campos; estes bastam. */
export interface VisitaDoPainel {
  id: string;
  status: string | null;
  proposta_enviada_em: string | null;
  titulo?: string | null;
  nome_predio?: string | null;
  nome_sindico?: string | null;
  tipo_local?: string | null;
  endereco?: string | null;
  data_hora_agendada?: string | null;
  tecnico_id?: string | null;
  clientes?: { nome?: string | null } | null;
}

interface Props {
  v: VisitaDoPainel;
  /** o nome do técnico responsável, já resolvido pelo de-para da página */
  tecnicoNome?: string | null;
  /** "linha" = a lista de sempre · "cartao" = a coluna do quadro (R252) */
  formato?: "linha" | "cartao";
  isAdmin?: boolean;
  /** a RPC de "proposta enviada" está em voo (desabilita o botão) */
  marcando?: boolean;
  onAbrir: () => void;
  onMarcarEnviada: () => void;
  onExcluir: () => void;
}

export function CartaoDaVisita({
  v, tecnicoNome, formato = "linha", isAdmin = false, marcando = false,
  onAbrir, onMarcarEnviada, onExcluir,
}: Props) {
  const { isLight } = useTheme();
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const cartao = formato === "cartao";

  const et = etapaDaVisita(v);
  const cor = ETAPA_CORES[et];
  const Icone = ETAPA_ICONE[et];
  const dataVisita = v.data_hora_agendada
    ? new Date(v.data_hora_agendada).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "Sem data";
  // R78: o nome do lugar, com "Residência" na frente quando é casa de pessoa
  // física — a regra mora em etapas.ts
  const clienteNome = tituloDaVisita({
    tipo_local: v.tipo_local,
    cliente_nome: v.clientes?.nome,
    nome_predio: v.nome_predio,
    nome_sindico: v.nome_sindico,
    titulo: v.titulo,
  });
  const enviadaEm = v.proposta_enviada_em
    ? new Date(v.proposta_enviada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  // R78 — marcar como enviada, direto do card. Só na etapa "falta_proposta":
  // antes dela não há proposta aprovada para enviar, e depois o ciclo já
  // encerrou (R64). Chama a MESMA RPC que a tela da visita — um segundo
  // caminho de escrita divergiria dela na primeira mudança de regra.
  const podeMarcar = et === "falta_proposta";

  const chipEtapa = (
    // chip de etapa — véu 12% + borda 30% + ícone (§2.4)
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
      padding: "5px 11px", borderRadius: 999,
      background: cor.bg, border: `1px solid ${cor.border}`,
      color: isLight ? cor.light : cor.dark,
      fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
      letterSpacing: "0.05em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      <Icone size={13} />
      {ETAPA_LABEL[et]}
    </span>
  );

  const botaoEnviada = (
    <button
      onClick={(e) => { e.stopPropagation(); onMarcarEnviada(); }}
      disabled={marcando}
      title="Marcar a proposta como enviada — encerra o ciclo"
      style={{
        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
        height: 34, padding: "0 13px", borderRadius: 17, border: "none",
        background: GOLD_GRAD, color: "#0E0E0E",
        fontFamily: FONT, fontWeight: 700, fontSize: 11.5,
        letterSpacing: "0.03em", whiteSpace: "nowrap",
        cursor: marcando ? "default" : "pointer",
        opacity: marcando ? 0.6 : 1,
      }}
    >
      <Send size={13} />
      Proposta enviada
    </button>
  );

  const botaoExcluir = (
    <button
      onClick={(e) => { e.stopPropagation(); onExcluir(); }}
      aria-label="Excluir proposta"
      style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 10, border: "none",
        background: "rgba(230,77,88,0.10)", cursor: "pointer",
      }}
    >
      <Trash2 size={15} color={isLight ? "#B1242E" : "#F17881"} />
    </button>
  );

  const meta = (
    <div style={{
      fontFamily: FONT, fontSize: cartao ? 11 : 12, fontWeight: 400, color: textSecondary,
      lineHeight: 1.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
    }}>
      <CalendarDays size={12} style={{ opacity: 0.7 }} />
      <span>{dataVisita}</span>
      {v.endereco ? (<><span style={{ opacity: 0.4 }}>·</span><MapPin size={12} style={{ opacity: 0.7 }} /><span>{v.endereco}</span></>) : null}
      {tecnicoNome ? (<><span style={{ opacity: 0.4 }}>·</span><User size={12} style={{ opacity: 0.7 }} /><span>{tecnicoNome}</span></>) : null}
      {/* o carimbo que encerra o ciclo merece a linha de meta */}
      {enviadaEm ? (<><span style={{ opacity: 0.4 }}>·</span><Send size={12} style={{ opacity: 0.7 }} /><span>Enviada em {enviadaEm}</span></>) : null}
    </div>
  );

  const CAIXA: CSSProperties = cartao
    ? {
        ...card(isLight), borderRadius: 16, padding: "12px 14px", minHeight: 76,
        cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
      }
    : {
        ...card(isLight), borderRadius: 16, padding: "14px 18px",
        cursor: "pointer", display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 14,
      };

  return (
    <div className="elevavel" onClick={onAbrir} style={CAIXA}>
      <div style={{ minWidth: 0, flex: cartao ? undefined : 1 }}>
        <div style={{
          fontFamily: FONT, fontWeight: 600, fontSize: 14, marginBottom: 5,
          ...(cartao
            // na coluna estreita o nome do prédio QUEBRA em vez de virar "…":
            // "Condomínio Edifício Enei…" não identifica prédio nenhum
            ? { lineHeight: 1.35, textWrap: "pretty" as any }
            : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
        }}>
          {clienteNome}
        </div>
        {meta}
      </div>

      {/* No cartão a etapa não se repete — ela é a COLUNA. Sobram as ações, e
          só quando existem: sem elas o rodapé nem nasce. */}
      {cartao
        ? ((podeMarcar || isAdmin) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {podeMarcar && botaoEnviada}
              {isAdmin && botaoExcluir}
            </div>
          ))
        : (
          <>
            {chipEtapa}
            {podeMarcar && botaoEnviada}
            {isAdmin && botaoExcluir}
          </>
        )}
    </div>
  );
}
