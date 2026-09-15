// O BOTÃO DE AÇÕES DO CARD (R301 C) — re-agendar · desmarcar · cancelar.
//
// Davi, 15/09/2026: "Cada card de chamado técnico deverá ter um botão circular
// no canto inferior direito, onde ao clicar, abre um pop-up para re-agendar,
// cancelar, ou desmarcar. Este botão poderá ser um pouco mais discreto em
// relação à cor, e adicione o mecanismo de hover, tornando-o amarelo degradê
// com glow ao colocar o cursor em cima."
//
// TRÊS AÇÕES, CADA UMA PELA PORTA QUE JÁ EXISTE — este arquivo não inventa
// escrita nenhuma:
//   · RE-AGENDAR abre o chamado no painel lateral, na agenda dele: o bloco de
//     campo só se move pela porta da U78 (`agenda_campo`), que é quem recusa
//     conflito e jornada. Um "mover para amanhã" daqui seria uma segunda
//     porta com metade das regras.
//   · DESMARCAR é `desagendar_chamado` (U79) quando há bloco na agenda, ou
//     limpar a data seca (R168) quando o que existe é só o dia. O TEXTO da
//     confirmação é DERIVADO de `espelhoAposDesagendar` (R101): sobrando
//     bloco cumprido, a data NÃO some — e prometer "some" seria mentira
//     escrita à mão em cima de uma função que sabe a resposta.
//   · CANCELAR pede o MOTIVO numa linha, como o Detalhe faz (`cancelarChamado`
//     grava `motivo_cancelamento`): cancelar sem motivo é a discussão de três
//     meses depois.
//
// NÃO HÁ "TEM CERTEZA?". O gesto destrutivo nomeia o que se perde (a doutrina
// do Sobreaviso): desmarcar mostra onde a data vai parar; cancelar exige o
// motivo — a segunda tela É a confirmação.
//
// O MENU É DESENHADO POR PORTAL, no alvo da R243 (`closest([role="dialog"])`
// ou o <body>) — a mesma conta do SeletorDeOpcao. Fecha no clique fora, no
// Escape e quando a página rola (o card rolou; a âncora não está mais ali).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CalendarClock, CalendarX2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { atualizarChamado, cancelarChamado } from "@/features/chamados/data";
import { useBlocosDoChamado, useDesagendarChamado } from "@/features/programacao/data";
import { blocoPendente, espelhoAposDesagendar, horaTexto } from "@/features/programacao/modelo";

/** O que o pop-up precisa saber do chamado — o card já tem tudo isto. */
export interface ChamadoDasAcoes {
  id: string;
  titulo: string;
  status?: string | null;
  data_hora_agendada?: string | null;
  data_agendada?: string | null;
}

interface Props {
  chamado: ChamadoDasAcoes;
  /** O botão circular que abriu o menu — o menu nasce colado nele. */
  ancora: HTMLElement;
  aoFechar: () => void;
  /** Re-agendar: a hospedeira abre o chamado no painel lateral (a agenda mora lá). */
  aoReagendar: () => void;
}

const LARGURA = 264;
const MARGEM = 12;

export function AcoesDoCard({ chamado, ancora, aoFechar, aoReagendar }: Props) {
  const { isLight } = useTheme();
  const qc = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const motivoRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [passo, setPasso] = useState<"menu" | "desmarcar" | "cancelar">("menu");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const { data: blocos = [] } = useBlocosDoChamado(chamado.id);
  const desagendar = useDesagendarChamado();

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  const separador = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";

  // R243: dentro de um diálogo o portal vai para o diálogo, senão fica inerte
  const alvo = (ancora.closest('[role="dialog"]') as HTMLElement | null) ?? document.body;

  useLayoutEffect(() => {
    const r = ancora.getBoundingClientRect();
    const caixa = alvo === document.body ? null : alvo.getBoundingClientRect();
    const lim = caixa
      ? { esq: caixa.left, dir: caixa.right, topo: caixa.top, base: caixa.bottom }
      : { esq: 0, dir: window.innerWidth, topo: 0, base: window.innerHeight };
    // alinhado à DIREITA do botão (ele fica no canto direito do card), sem vazar
    let left = r.right - LARGURA;
    if (left < lim.esq + MARGEM) left = lim.esq + MARGEM;
    if (left + LARGURA > lim.dir - MARGEM) left = lim.dir - MARGEM - LARGURA;
    // abre para baixo; sem 240px embaixo, abre para cima ancorado pela base
    const abaixo = lim.base - r.bottom - MARGEM;
    const paraCima = abaixo < 240 && r.top - lim.topo > abaixo;
    const bordaE = alvo === document.body ? 0 : alvo.clientLeft;
    const bordaT = alvo === document.body ? 0 : alvo.clientTop;
    const x = left - (caixa?.left ?? 0) - bordaE;
    setPos(paraCima
      ? { left: x, bottom: lim.base - r.top + 6 - (caixa ? lim.base - caixa.bottom : 0) }
      : { left: x, top: r.bottom + 6 - (caixa?.top ?? 0) - bordaT });
  }, [ancora, alvo]);

  useEffect(() => {
    const fora = (e: Event) => {
      const t = e.target as Node;
      if (ancora.contains(t) || menuRef.current?.contains(t)) return;
      aoFechar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    const rolou = () => aoFechar();
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 60);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", rolou, true);
    window.addEventListener("resize", rolou);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", rolou, true);
      window.removeEventListener("resize", rolou);
    };
  }, [ancora, aoFechar]);

  useEffect(() => { if (passo === "cancelar") motivoRef.current?.focus(); }, [passo]);

  // ── o que "desmarcar" faz com ESTE chamado ────────────────────────────────
  const temBloco = blocos.some((b) => blocoPendente(b));
  const marcado = !!chamado.data_hora_agendada || !!chamado.data_agendada;
  const resto = espelhoAposDesagendar(chamado.id, blocos);
  const fraseDoDesmarcar = temBloco
    ? resto
      ? `O chamado volta para "aberto", e a data continua mostrando a última visita que ACONTECEU (${resto.dia.split("-").reverse().join("/")}, ${horaTexto(resto.inicio_min)}). Os atendimentos já feitos não são apagados.`
      : 'O chamado volta para "aberto" e fica sem data. Os atendimentos já feitos não são apagados.'
    : "O dia marcado sai do chamado; ele volta para a fila de quem espera programação.";

  async function desmarcar() {
    setOcupado(true);
    try {
      if (temBloco) {
        await desagendar.mutateAsync(chamado.id);
      } else {
        // R168/R284: a data SECA — não há bloco, então não há porta da U78 a
        // respeitar; é a mesma coluna que o arrasto da Início escreve.
        await atualizarChamado(chamado.id, { data_agendada: null } as any);
        qc.invalidateQueries({ queryKey: ["chamados"] });
        qc.invalidateQueries({ queryKey: ["chamado", chamado.id] });
      }
      toast.success("Chamado desmarcado.");
      aoFechar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desmarcar o chamado.");
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    if (!motivo.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    setOcupado(true);
    try {
      await cancelarChamado(chamado.id, motivo.trim());
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["chamado", chamado.id] });
      qc.invalidateQueries({ queryKey: ["agenda-campo"] });
      toast.success("Chamado cancelado.");
      aoFechar();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível cancelar o chamado.");
    } finally {
      setOcupado(false);
    }
  }

  const linha = (cor: string, desabilitado = false): CSSProperties => ({
    display: "flex", alignItems: "center", gap: 9, width: "100%", height: 38,
    paddingInline: 10, borderRadius: 9, border: "none", background: "transparent",
    cursor: desabilitado ? "default" : "pointer", textAlign: "left",
    fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: desabilitado ? textSecondary : cor,
    opacity: desabilitado ? 0.6 : 1,
  });
  const botaoPequeno = (primario = false): CSSProperties => ({
    height: 32, paddingInline: 12, borderRadius: 9, cursor: "pointer",
    fontFamily: FONT, fontSize: 12, fontWeight: 600,
    border: primario ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: primario ? (isLight ? "#212121" : "#ffffff") : "transparent",
    color: primario ? (isLight ? "#ffffff" : "#0E0E0E") : textPrimary,
  });

  if (!pos) return null;
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Ações de ${chamado.titulo}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        ...card(isLight), borderRadius: 12,
        position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom,
        width: LARGURA, zIndex: 200, paddingInline: 6, paddingBlock: 6,
        display: "flex", flexDirection: "column", gap: 2,
      }}
    >
      {passo === "menu" ? (
        <>
          <button type="button" role="menuitem" className="hover-suave" style={linha(textPrimary)} onClick={() => { aoReagendar(); aoFechar(); }}>
            <CalendarClock size={15} /> Re-agendar
            <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10, fontWeight: 400, color: textSecondary }}>abre a agenda</span>
          </button>
          <button
            type="button" role="menuitem" className={marcado ? "hover-suave" : undefined}
            style={linha(textPrimary, !marcado)} disabled={!marcado}
            title={marcado ? undefined : "Este chamado não está marcado"}
            onClick={() => setPasso("desmarcar")}
          >
            <CalendarX2 size={15} /> Desmarcar
            {!marcado ? <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10, fontWeight: 400 }}>sem data</span> : null}
          </button>
          <div style={{ height: 1, background: separador, marginInline: 6, marginBlock: 2 }} />
          <button type="button" role="menuitem" className="hover-suave" style={linha(vermelho)} onClick={() => setPasso("cancelar")}>
            <Ban size={15} /> Cancelar
          </button>
        </>
      ) : passo === "desmarcar" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingInline: 6, paddingBlock: 6 }}>
          <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: textPrimary }}>Tirar da agenda?</span>
          <span style={{ fontFamily: FONT, fontSize: 11.5, lineHeight: 1.45, color: textSecondary }}>{fraseDoDesmarcar}</span>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={botaoPequeno()} onClick={() => setPasso("menu")} disabled={ocupado}>Voltar</button>
            <button type="button" style={botaoPequeno(true)} onClick={desmarcar} disabled={ocupado}>
              {ocupado ? "Desmarcando…" : "Desmarcar"}
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); void cancelar(); }}
          style={{ display: "flex", flexDirection: "column", gap: 10, paddingInline: 6, paddingBlock: 6 }}
        >
          <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: vermelho }}>Cancelar o chamado</span>
          <input
            ref={motivoRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo do cancelamento"
            aria-label="Motivo do cancelamento"
            maxLength={200}
            style={{
              height: 36, paddingInline: 10, borderRadius: 9, fontFamily: FONT, fontSize: 12.5,
              border: isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.14)",
              background: isLight ? "#ffffff" : "rgba(255,255,255,0.05)", color: textPrimary, outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={botaoPequeno()} onClick={() => setPasso("menu")} disabled={ocupado}>Voltar</button>
            <button
              type="submit"
              style={{ ...botaoPequeno(true), background: vermelho, color: "#ffffff", opacity: motivo.trim() ? 1 : 0.5 }}
              disabled={ocupado || !motivo.trim()}
            >
              {ocupado ? "Cancelando…" : "Cancelar chamado"}
            </button>
          </div>
        </form>
      )}
    </div>,
    alvo,
  );
}
