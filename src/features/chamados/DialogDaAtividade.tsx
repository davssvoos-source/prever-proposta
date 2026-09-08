// A ATIVIDADE NUM DIÁLOGO — a mesma tela da página, no meio da Início (R238, U121).
//
// Davi, 08/09/2026, sobre a estrutura aprovada da tela da atividade: "Faça a
// adaptação na tela do pop-up também." Clicar num card da Início (ou numa
// menção no chat) abre ESTA janela: a tela inteira da atividade — documento à
// esquerda, ficha à direita (R234) — dentro de um diálogo largo, sem trocar de
// página. É um só layout em dois lugares, não dois layouts.
//
// O diálogo é largo de propósito (até 1600px): a tela foi desenhada para o
// desktop, e num miolo de 1120px a ficha de 340px deixaria o texto com 750px.
// Em 1600 o texto fica com ~1200px — a mesma experiência da página.
//
// A natureza decide o corpo, como na rota /chamados/$id: interno → o
// DetalheInterno embutido (sem a casca da página, com o botão "abrir em página
// inteira" no lugar do "voltar"); campo → o DetalheCampo, que continua sendo a
// tela do técnico e não foi redesenhado nesta leva (P66).

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { cinzas } from "@/lib/paleta";
import { useChamado } from "@/features/chamados/data";
import { DetalheInterno } from "@/features/chamados/DetalheInterno";
import { DetalheCampo } from "@/features/chamados/DetalheCampo";

export function DialogDaAtividade({ chamadoId, aoFechar, aoAbrirPagina }: {
  chamadoId: string | null;
  aoFechar: () => void;
  /** leva para /chamados/$id e fecha o diálogo */
  aoAbrirPagina: (id: string) => void;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const { data: chamado, isLoading } = useChamado(chamadoId ?? undefined);

  return (
    <Dialog open={!!chamadoId} onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent
        className="p-0"
        aria-describedby={undefined}
        style={{
          width: "min(1600px, 96vw)", maxWidth: "96vw", height: "min(94vh, 1040px)", maxHeight: "94vh",
          overflow: "hidden", borderRadius: 18, background: c.pagina, border: `1px solid ${c.divisoria}`,
          display: "flex", flexDirection: "column",
        }}
      >
        <DialogTitle className="sr-only">{chamado?.titulo ?? "Atividade"}</DialogTitle>
        {/* a tela rola por dentro do diálogo; a ficha não fica sticky aqui (a casca .atividade-embutida cuida) */}
        <div className="rolagem-fina" style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
          {!chamadoId ? null : isLoading ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: FONT, fontSize: 13, color: c.textoSecundario }}>Carregando…</div>
          ) : !chamado ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: FONT, fontSize: 13, color: c.textoSecundario }}>Atividade não encontrada.</div>
          ) : chamado.natureza === "interno" ? (
            <DetalheInterno id={chamadoId} embutido aoAbrirPagina={aoAbrirPagina} />
          ) : (
            <DetalheCampo id={chamadoId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
