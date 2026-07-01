// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TipoBloco = "PED" | "VEI" | "CFTV" | "AL" | "CER" | "CENT";

export interface BarreiraConfig {
  tipo: string;
  entrada: string;
  saida: string;
  material?: string;
  motor?: boolean;
  abertura?: string;
  folhas?: string;
}

export interface BlocoConfig {
  tipoBloco: TipoBloco;
  eclusa: boolean;
  b1?: BarreiraConfig;
  b2?: BarreiraConfig;
  tecnologia?: string;
}

// ─── Labels legíveis ─────────────────────────────────────────────────────────

export const LABELS: Record<string, string> = {
  FAC: "Leitora Facial",
  DIG: "Biometria Digital",
  CTRL: "Controle Remoto",
  TAG: "Antena TAG",
  LAC: "Laço Indutivo",
  FOT: "Fotocélula (saída livre)",
  PORTAR: "Portaria",
  BOTANA: "Botoeira Analógica",
  BOTAPR: "Botoeira por Aproximação",
  CAT: "Catraca",
  PORP: "Porta",
  CAN: "Cancela",
  PORV: "Portão Veicular",
  MET: "Metal",
  VID: "Vidro",
  MOT: "Motorizada",
  MOL: "Mola Aérea",
  NAD: "Sem motor e sem mola",
  BASC: "Basculante",
  DESL: "Deslizante",
  PIVO: "Pivotante",
  "1F": "1 Folha",
  "2F": "2 Folhas",
  IP: "IP (câmeras de rede)",
  ANAL: "Analógico (cabo coaxial)",
  CAB: "Cabeado",
  SF: "Sem Fio",
};

// ─── Opções por contexto ──────────────────────────────────────────────────────

export const OPCOES = {
  entradaCat: ["FAC", "PORTAR"] as const,
  saidaCat: ["FAC", "PORTAR"] as const,
  entradaPorp: ["FAC", "DIG", "PORTAR"] as const,
  saidaPorp: ["FAC", "DIG", "BOTANA", "BOTAPR", "PORTAR"] as const,
  entradaCan: ["TAG", "FAC", "LAC", "PORTAR"] as const,
  saidaCan: ["TAG", "FAC", "LAC", "FOT", "PORTAR"] as const,
  entradaPorv: ["CTRL", "TAG", "FAC", "LAC", "PORTAR"] as const,
  saidaPorv: ["CTRL", "TAG", "FAC", "LAC", "FOT", "PORTAR"] as const,
  materialPorp: ["MET", "VID"] as const,
  aberturaSemMotor: ["MOL", "NAD"] as const,
  aberturaVei: ["BASC", "DESL", "PIVO"] as const,
  folhasPivo: ["1F", "2F"] as const,
  tecCftv: ["IP", "ANAL"] as const,
  tecAl: ["CAB", "SF"] as const,
};

// ─── Gerador de código de bloco ───────────────────────────────────────────────

export function gerarCodigoBloco(config: BlocoConfig): string {
  const { tipoBloco, eclusa, b1, b2, tecnologia } = config;

  if (tipoBloco === "CFTV") return `CFTV-${tecnologia}`;
  if (tipoBloco === "AL") return `AL-${tecnologia}`;
  if (tipoBloco === "CER") return "CER";
  if (tipoBloco === "CENT") return "CENT-PR";

  const barreiras = eclusa ? "2B" : "1B";

  function seg(b: BarreiraConfig): string {
    let s = `${b.tipo}-${b.entrada}-${b.saida}`;
    if (b.tipo === "PORP" && b.abertura) s += `-${b.material}-${b.abertura}`;
    if (b.tipo === "PORV" && b.abertura) s += `-${b.abertura}-${b.folhas}`;
    return s;
  }

  let code = `${tipoBloco}-${barreiras}-${seg(b1!)}`;
  if (eclusa && b2) code += `-${seg(b2)}`;
  return code;
}

// ─── Gerador de descrição legível ─────────────────────────────────────────────

export function gerarDescricaoBloco(config: BlocoConfig): string {
  const { tipoBloco, eclusa, b1, b2, tecnologia } = config;

  if (tipoBloco === "CFTV") return `CFTV — ${LABELS[tecnologia!] ?? tecnologia}`;
  if (tipoBloco === "AL") return `Alarme — ${LABELS[tecnologia!] ?? tecnologia}`;
  if (tipoBloco === "CER") return "Cerca Elétrica";
  if (tipoBloco === "CENT") return "Central de Portaria Remota";

  const tipoNome = tipoBloco === "PED" ? "Pedestre" : "Veicular";
  const barrNome = eclusa ? "2 Barreiras (Eclusa)" : "1 Barreira";

  function descrB(b: BarreiraConfig, idx: number): string {
    let d = `B${idx}: ${LABELS[b.tipo] ?? b.tipo}`;
    d += ` | E: ${LABELS[b.entrada] ?? b.entrada} | S: ${LABELS[b.saida] ?? b.saida}`;
    if (b.tipo === "PORP" && b.abertura) {
      d += ` | ${LABELS[b.material!] ?? b.material} — ${LABELS[b.abertura] ?? b.abertura}`;
    }
    if (b.tipo === "PORV") {
      d += b.abertura
        ? ` | ${LABELS[b.abertura] ?? b.abertura}${b.folhas ? " " + b.folhas : ""}`
        : " | Sem motor";
    }
    return d;
  }

  let desc = `${tipoNome} ${barrNome} — ${descrB(b1!, 1)}`;
  if (eclusa && b2) desc += ` | ${descrB(b2, 2)}`;
  return desc;
}

// ─── Mapa de URL slug ↔ código interno ──────────────────────────────────────

export const CAT_SLUG_TO_TIPO: Record<string, TipoBloco> = {
  pedestres: "PED",
  veiculos: "VEI",
  cftv: "CFTV",
  alarme: "AL",
  cerca: "CER",
};

export const CAT_NOMES: Record<string, string> = {
  PED: "Acesso de Pedestres",
  VEI: "Acesso de Veículos",
  CFTV: "CFTV",
  AL: "Alarme",
  CER: "Cerca Elétrica",
  CENT: "Central",
};
