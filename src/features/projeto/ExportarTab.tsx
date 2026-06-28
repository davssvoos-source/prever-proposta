import { useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, formatDate, CONTRATO_LABEL } from "@/lib/format";
import {
  useCatalogos,
  useProjetoBlocos,
  useProjetoItensVar,
  useProjetoServicos,
} from "./data";
import { computeBom, computeServicoQty } from "./calc";
import { toast } from "sonner";

type Projeto = {
  id: string;
  nome: string;
  data_visita: string | null;
  fornecimento: boolean;
  valor_hora_hh: number;
  tipo_contrato: string;
  cliente?: { nome: string; tipo_empreendimento?: string | null; email?: string | null; telefone?: string | null } | null;
};

export function ExportarTab({ projeto }: { projeto: Projeto }) {
  const cat = useCatalogos();
  const pb = useProjetoBlocos(projeto.id);
  const piv = useProjetoItensVar(projeto.id);
  const ps = useProjetoServicos(projeto.id);
  const [busy, setBusy] = useState(false);

  const isManut = projeto.tipo_contrato === "manutencao";

  const data = useMemo(() => {
    if (!cat.data || !pb.data) return null;
    const bom = computeBom({
      blocos: cat.data.blocos,
      blocosItens: cat.data.blocos_itens,
      equipamentos: cat.data.equipamentos,
      projetoBlocos: pb.data,
      projetoItensVar: piv.data ?? [],
    });
    const subtotalEquip = projeto.fornecimento && !isManut ? bom.subtotal : 0;
    const subtotalInst = isManut ? 0 : bom.totalHH * Number(projeto.valor_hora_hh);

    const servicosAtivos: Array<{ nome: string; qty: number; preco: number; total: number }> = [];
    let totalMensal = 0;
    for (const psRow of ps.data ?? []) {
      if (!psRow.ativo) continue;
      const sv = cat.data.servicos.find((s) => s.id === psRow.servico_id);
      if (!sv) continue;
      const qty = psRow.quantidade || computeServicoQty(sv, cat.data.blocos, pb.data);
      const total = Number(sv.preco_unitario_mensal) * qty;
      totalMensal += total;
      servicosAtivos.push({
        nome: `${sv.code} · ${sv.nome}`,
        qty,
        preco: Number(sv.preco_unitario_mensal),
        total,
      });
    }
    return { bom, subtotalEquip, subtotalInst, servicosAtivos, totalMensal };
  }, [cat.data, pb.data, piv.data, ps.data, projeto, isManut]);

  async function gerarPdf() {
    if (!data) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const PRIMARY: [number, number, number] = [31, 56, 100];
      const ACCENT: [number, number, number] = [255, 192, 0];

      // Header
      doc.setFillColor(...PRIMARY);
      doc.rect(0, 0, 595, 80, "F");
      doc.setFillColor(...ACCENT);
      doc.rect(40, 24, 36, 36, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text("GRUPO PREVER", 90, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Segurança Eletrônica", 90, 58);
      doc.setFontSize(9);
      doc.text(`Proposta · ${formatDate(new Date().toISOString())}`, 555, 42, { align: "right" });

      let y = 110;
      doc.setTextColor(31, 56, 100);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(projeto.nome, 40, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Cliente: ${projeto.cliente?.nome ?? "—"}`, 40, y);
      y += 14;
      doc.text(
        `Tipo: ${CONTRATO_LABEL[projeto.tipo_contrato]}  ·  Visita: ${formatDate(projeto.data_visita)}`,
        40,
        y,
      );
      y += 14;
      doc.text(
        `Fornecimento: ${projeto.fornecimento && !isManut ? "SIM" : "NÃO"}  ·  HH: ${data.bom.totalHH.toFixed(1)} × ${brl(projeto.valor_hora_hh)}`,
        40,
        y,
      );
      y += 16;

      // Equipamentos
      if (!isManut && data.bom.rows.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Equipamento", "Modelo", "Qtd", "Preço unit.", "Total"]],
          body: data.bom.rows.map((r) => [
            r.nome,
            r.modelo,
            `${r.qty} ${r.un}`,
            brl(r.precoUnit),
            projeto.fornecimento ? brl(r.precoTotal) : "—",
          ]),
          headStyles: { fillColor: PRIMARY, textColor: 255 },
          styles: { fontSize: 9 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 14;
      }

      // Totais
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 56, 100);
      doc.setFontSize(11);
      doc.text("Resumo Financeiro", 40, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      const lines = [
        ["Subtotal equipamentos", brl(data.subtotalEquip)],
        ["Instalação / Mão de obra", brl(data.subtotalInst)],
      ];
      for (const [l, v] of lines) {
        doc.text(l, 40, y);
        doc.text(v, 555, y, { align: "right" });
        y += 13;
      }
      doc.setDrawColor(200);
      doc.line(40, y, 555, y);
      y += 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 56, 100);
      doc.text("TOTAL IMPLANTAÇÃO", 40, y);
      doc.text(brl(data.subtotalEquip + data.subtotalInst), 555, y, { align: "right" });
      y += 24;

      // Manutenção
      if (data.servicosAtivos.length > 0) {
        doc.setFontSize(11);
        doc.text("Contrato de Manutenção Mensal", 40, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [["Serviço", "Qtd", "Preço unit./mês", "Total/mês"]],
          body: data.servicosAtivos.map((s) => [
            s.nome,
            String(s.qty),
            brl(s.preco),
            brl(s.total),
          ]),
          headStyles: { fillColor: PRIMARY, textColor: 255 },
          styles: { fontSize: 9 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 56, 100);
        doc.setFontSize(12);
        doc.text("TOTAL MENSAL", 40, y);
        doc.text(brl(data.totalMensal), 555, y, { align: "right" });
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Grupo Prever Segurança Eletrônica · Proposta válida por 30 dias",
        297.5,
        820,
        { align: "center" },
      );

      doc.save(`Proposta-${projeto.nome.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-base font-semibold">Resumo da Proposta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {projeto.cliente?.nome ?? "—"} · {CONTRATO_LABEL[projeto.tipo_contrato]}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Equipamentos</dt>
            <dd className="font-semibold tabular-nums">{brl(data.subtotalEquip)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Instalação</dt>
            <dd className="font-semibold tabular-nums">{brl(data.subtotalInst)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total Implantação</dt>
            <dd className="text-lg font-bold tabular-nums text-primary">
              {brl(data.subtotalEquip + data.subtotalInst)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Manutenção mensal</dt>
            <dd className="text-lg font-bold tabular-nums text-primary">
              {brl(data.totalMensal)}
            </dd>
          </div>
        </dl>
      </Card>

      <Button onClick={gerarPdf} disabled={busy} size="lg" className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        Gerar PDF da proposta
      </Button>
    </div>
  );
}
