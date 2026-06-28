import type {
  Bloco,
  BlocoItem,
  Equipamento,
  ProjetoBloco,
  ProjetoItemVar,
  ProjetoServico,
  Servico,
} from "./data";

export type BomRow = {
  modelo: string;
  nome: string;
  marca: string | null;
  un: string;
  qty: number;
  precoUnit: number;
  precoTotal: number;
  variavel: boolean;
};

export function precoVenda(eq: Equipamento | undefined): number {
  if (!eq) return 0;
  return Number(eq.custo) * Number(eq.markup);
}

export function computeBom(args: {
  blocos: Bloco[];
  blocosItens: BlocoItem[];
  equipamentos: Equipamento[];
  projetoBlocos: ProjetoBloco[];
  projetoItensVar: ProjetoItemVar[];
}): { rows: BomRow[]; subtotal: number; totalHH: number } {
  const { blocos, blocosItens, equipamentos, projetoBlocos, projetoItensVar } = args;
  const eqByModelo = new Map(equipamentos.map((e) => [e.modelo, e]));
  const acc = new Map<string, BomRow>();
  let totalHH = 0;

  const pbById = new Map(projetoBlocos.filter((p) => p.ativo).map((p) => [p.bloco_id, p]));
  for (const bloco of blocos) {
    const pb = pbById.get(bloco.id);
    if (!pb || !pb.ativo) continue;
    const qBloco = Math.max(1, pb.quantidade || 1);
    totalHH += Number(bloco.hh) * qBloco;

    const items = blocosItens.filter((bi) => bi.bloco_id === bloco.id);
    for (const it of items) {
      if (it.variavel) continue;
      const qtdItem = (it.qty || 0) * qBloco;
      if (!qtdItem) continue;
      addRow(acc, eqByModelo, it, qtdItem, false);
    }
  }

  // Itens variáveis
  const biById = new Map(blocosItens.map((b) => [b.id, b]));
  for (const piv of projetoItensVar) {
    if (!piv.quantidade) continue;
    const bi = biById.get(piv.bloco_item_id);
    if (!bi) continue;
    addRow(acc, eqByModelo, bi, piv.quantidade, true);
  }

  const rows = Array.from(acc.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  const subtotal = rows.reduce((s, r) => s + r.precoTotal, 0);
  return { rows, subtotal, totalHH };
}

function addRow(
  acc: Map<string, BomRow>,
  eqByModelo: Map<string, Equipamento>,
  it: BlocoItem,
  qty: number,
  variavel: boolean,
) {
  const eq = eqByModelo.get(it.modelo);
  const preco = precoVenda(eq);
  const prev = acc.get(it.modelo);
  if (prev) {
    prev.qty += qty;
    prev.precoTotal = prev.qty * prev.precoUnit;
    prev.variavel = prev.variavel || variavel;
  } else {
    acc.set(it.modelo, {
      modelo: it.modelo,
      nome: it.nome,
      marca: it.marca,
      un: eq?.un ?? "un",
      qty,
      precoUnit: preco,
      precoTotal: qty * preco,
      variavel,
    });
  }
}

// Auto-quantidade dos serviços a partir dos blocos ativos
export function computeServicoQty(
  servico: Servico,
  blocos: Bloco[],
  projetoBlocos: ProjetoBloco[],
): number {
  const cat = (servico.cat || "").toUpperCase();
  if (!cat) return 0;

  // Mapa prefixo de bloco
  const prefixMap: Record<string, string[]> = {
    CENT: ["CENT"],
    PED: ["PED", "INTERF"],
    VEI: ["VEI"],
    CFTV: ["CFTV"],
    ALARM: ["ALARM"],
    CERCA: ["CERCA"],
    ELEV: ["ELEV"],
  };
  const prefixes = prefixMap[cat];
  if (!prefixes) return 0;

  const blocoById = new Map(blocos.map((b) => [b.id, b]));
  let total = 0;
  for (const pb of projetoBlocos) {
    if (!pb.ativo) continue;
    const b = blocoById.get(pb.bloco_id);
    if (!b) continue;
    if (prefixes.some((p) => b.code.startsWith(p))) {
      total += Math.max(1, pb.quantidade || 1);
    }
  }
  // Para serviços de câmera somar por câmeras (heurística simples = nº de blocos CFTV * média)
  // Mantemos por bloco para o V1.
  return total;
}
