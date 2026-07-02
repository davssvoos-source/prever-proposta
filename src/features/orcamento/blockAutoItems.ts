import { gerarCodigoBloco, type BlocoConfig, type TipoBloco } from "@/lib/blocos";

export interface AutoBlockItem {
  cod_eq: string;
  qtd: number;
  observacao?: string | null;
}

type ComputeInput = {
  codigo: string;
  tipoBloco: TipoBloco;
  tecnologia?: string | null;
  qtdDome?: number | null;
  qtdBullet?: number | null;
  perimetro?: number | null;
  esquinas?: number | null;
};

const ceil = (value: number, divisor: number) => Math.ceil(Math.max(0, value) / divisor);

function add(acc: Map<string, AutoBlockItem>, cod_eq: string, qtd: number, observacao: string) {
  if (!cod_eq || qtd <= 0) return;
  const prev = acc.get(cod_eq);
  if (prev) {
    prev.qtd += qtd;
    if (!prev.observacao) prev.observacao = observacao;
  } else {
    acc.set(cod_eq, { cod_eq, qtd, observacao });
  }
}

function countTokens(codigo: string) {
  const counts: Record<string, number> = {};
  for (const token of codigo.toUpperCase().split("-")) counts[token] = (counts[token] || 0) + 1;
  return counts;
}

function computeAcesso(input: ComputeInput): AutoBlockItem[] {
  const acc = new Map<string, AutoBlockItem>();
  const tokens = countTokens(input.codigo);
  const tipo = input.tipoBloco;

  add(acc, "EQ010", tokens.FAC || 0, "Leitora facial selecionada no bloco");
  add(acc, "EQ011", tokens.TAG || 0, "Antena TAG selecionada no bloco");
  add(acc, "EQ012", (tokens.DIG || 0) + (tokens.BOTAPR || 0), "Leitora/acionamento por aproximação selecionado no bloco");
  add(acc, "EQ013", tokens.CTRL || 0, "Controle remoto selecionado no bloco");
  add(acc, "EQ020", tokens.MOL || 0, "Mola aérea selecionada no bloco");
  add(acc, "EQ001", tokens.LPR || 0, "Leitora de placas selecionada no bloco");

  if (tipo === "PED") {
    add(acc, "EQ014", tokens.PORP || 0, "Porta pedestre selecionada no bloco");
    add(acc, "EQ019", tokens.MOT || 0, "Motor de porta pedestre selecionado no bloco");
  }

  if (tipo === "VEI") {
    add(acc, "EQ016", tokens.BASC || 0, "Motor basculante selecionado no bloco");
    add(acc, "EQ017", tokens.DESL || 0, "Motor deslizante selecionado no bloco");
    add(acc, "EQ018", tokens.PIVO || 0, "Motor pivotante selecionado no bloco");
  }

  return Array.from(acc.values());
}

function computeCftv(input: ComputeInput): AutoBlockItem[] {
  const acc = new Map<string, AutoBlockItem>();
  const dome = Number(input.qtdDome ?? 0) || 0;
  const bullet = Number(input.qtdBullet ?? 0) || 0;
  const total = dome + bullet;
  if (total <= 0) return [];

  add(acc, "EQ002", dome, "Câmeras dome configuradas no bloco CFTV");
  add(acc, "EQ001", bullet, "Câmeras bullet configuradas no bloco CFTV");

  const gravadores = total <= 8 ? 1 : ceil(total, 16);
  add(acc, total <= 8 ? "EQ003" : "EQ004", gravadores, "Gravador dimensionado pela quantidade de câmeras");
  add(acc, "EQ005", gravadores, "HD para gravação do CFTV");

  if ((input.tecnologia ?? "").toUpperCase() === "IP") {
    add(acc, total <= 8 ? "EQ006" : "EQ007", total <= 8 ? 1 : ceil(total, 16), "Switch PoE dimensionado pelas câmeras IP");
  }

  return Array.from(acc.values());
}

function computeCerca(input: ComputeInput): AutoBlockItem[] {
  const acc = new Map<string, AutoBlockItem>();
  const perimetro = Number(input.perimetro ?? 0) || 0;
  const esquinas = Number(input.esquinas ?? 0) || 0;
  if (perimetro <= 0) return [];

  add(acc, "EQ024", ceil(perimetro, 5000) || 1, "Central de cerca dimensionada pelo perímetro");
  add(acc, "EQ025", ceil(perimetro, 100), "Kit de hastes a cada 100 m de perímetro");
  add(acc, "EQ008", Math.max(1, ceil(esquinas, 10)), "Fonte auxiliar para alimentação da cerca");
  return Array.from(acc.values());
}

function computeElevadorFromCodigo(codigo: string): AutoBlockItem[] {
  const qtdKits = Number(codigo.match(/ELV-(\d+)KIT/i)?.[1] ?? 1) || 1;
  return [
    { cod_eq: "ELV_KIT_SWITCH", qtd: qtdKits, observacao: "1× por Kit Antena" },
    { cod_eq: "ELV_KIT_ROTEADOR", qtd: qtdKits * 2, observacao: "2× por Kit Antena" },
    { cod_eq: "ELV_KIT_ANTENA", qtd: qtdKits, observacao: "1× por Kit Antena" },
    { cod_eq: "ELV_KIT_SUPORTE", qtd: qtdKits * 2, observacao: "2× por Kit Antena" },
    { cod_eq: "ELV_KIT_TELEFONE", qtd: qtdKits, observacao: "1× por Kit Antena" },
    { cod_eq: "ELV_KIT_CAMERA", qtd: qtdKits, observacao: "1× por Kit Antena" },
    { cod_eq: "ELV_KIT_FILTRO", qtd: qtdKits, observacao: "1× por Kit Antena" },
  ];
}

function computeTotemFromCodigo(codigo: string): AutoBlockItem[] {
  const match = codigo.match(/TOT-(\d+)x(\d+)CAM/i);
  const nTotens = Number(match?.[1] ?? 1) || 1;
  const cameras = Number(match?.[2] ?? nTotens * 3) || nTotens * 3;
  return [
    { cod_eq: "TOT_SWITCH", qtd: nTotens, observacao: "1× por Totem Inteligente" },
    { cod_eq: "TOT_FONTE", qtd: nTotens, observacao: "1× por Totem Inteligente" },
    { cod_eq: "TOT_CAMERA", qtd: cameras, observacao: "Quantidade total de câmeras dos totens" },
    { cod_eq: "TOT_POSTE", qtd: nTotens, observacao: "1× por Totem Inteligente" },
  ];
}

export function computeAutoItemsForBloco(input: ComputeInput): AutoBlockItem[] {
  if (input.tipoBloco === "PED" || input.tipoBloco === "VEI") return computeAcesso(input);
  if (input.tipoBloco === "CFTV") return computeCftv(input);
  if (input.tipoBloco === "CER") return computeCerca(input);
  if (input.tipoBloco === "ELV") return computeElevadorFromCodigo(input.codigo);
  if (input.tipoBloco === "TOT") return computeTotemFromCodigo(input.codigo);
  return [];
}

export function computeAutoItemsFromConfig(config: BlocoConfig): AutoBlockItem[] {
  return computeAutoItemsForBloco({
    codigo: gerarCodigoBloco(config),
    tipoBloco: config.tipoBloco,
    tecnologia: config.tecnologia,
    qtdDome: config.qtdDome,
    qtdBullet: config.qtdBullet,
    perimetro: config.perimetro,
    esquinas: config.esquinas,
  });
}