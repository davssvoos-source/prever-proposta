// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TipoBloco = "PED" | "VEI" | "CFTV" | "AL" | "CER" | "CENT" | "ELV";

export interface BarreiraConfig {
  tipo: string;
  entrada: string;
  saida: string;
  material?: string;
  motor?: boolean;
  abertura?: string;
  folhas?: string;
  tamanho?: string; // 200CM/350CM/450CM (PIVO) ou 15M/2M/25M/3M (BASC)
  peso?: string;    // 800KG/1300KG/1500KG (DESL)
}

export interface BlocoConfig {
  tipoBloco: TipoBloco;
  eclusa: boolean;
  b1?: BarreiraConfig;
  b2?: BarreiraConfig;
  tecnologia?: string;
  qtdDome?: number;
  qtdBullet?: number;
  perimetro?: number;
  esquinas?: number;
  /** 'PR' (Portaria Remota) | 'PP' (Portaria Presencial). Default: 'PR'.
   *  Origem: campo `sistema_proposto` da visita — quando ausente assume PR. */
  portaria?: "PR" | "PP";
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
  LPR: "Leitora de Placas",
  CAT: "Catraca",
  PORP: "Porta",
  CAN: "Cancela",
  PORV: "Portão Veicular",
  MOL: "Mola Aérea",
  MOT: "Motor",
  NAD: "Manual (sem motor)",
  BASC: "Basculante",
  DESL: "Deslizante",
  PIVO: "Pivotante",
  "1F": "1 Folha",
  "2F": "2 Folhas",
  "200CM": "Até 2,0 m",
  "350CM": "Até 3,5 m",
  "450CM": "Até 4,5 m",
  "15M": "1,5 m",
  "2M": "2,0 m",
  "25M": "2,5 m",
  "3M": "3,0 m",
  "800KG": "Até 800 kg",
  "1300KG": "Até 1.300 kg",
  "1500KG": "Até 1.500 kg",
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
  entradaCan: ["TAG", "FAC", "LAC", "PORTAR", "LPR"] as const,
  saidaCan: ["TAG", "FAC", "LAC", "FOT", "PORTAR", "LPR"] as const,
  entradaPorv: ["CTRL", "TAG", "FAC", "LAC", "PORTAR", "LPR"] as const,
  saidaPorv: ["CTRL", "TAG", "FAC", "LAC", "FOT", "PORTAR", "LPR"] as const,
  aberturaPed: ["MOL", "MOT", "NAD"] as const,
  aberturaVei: ["BASC", "DESL", "PIVO"] as const,
  folhasPivo: ["1F", "2F"] as const,
  tamanhoPivo: ["200CM", "350CM", "450CM"] as const,
  tamanhoBasc: ["15M", "2M", "25M", "3M"] as const,
  pesoDesl: ["800KG", "1300KG", "1500KG"] as const,
  tecCftv: ["IP", "ANAL"] as const,
  tecAl: ["CAB", "SF"] as const,
};

// ─── Gerador de código de bloco ───────────────────────────────────────────────

export function gerarCodigoBloco(config: BlocoConfig): string {
  const { tipoBloco, eclusa, b1, b2, tecnologia } = config;
  const suf = config.portaria === "PP" ? "PP" : "PR";

  if (tipoBloco === "CFTV") return `CFTV-${tecnologia}`;
  if (tipoBloco === "AL") return `AL-${tecnologia}`;
  if (tipoBloco === "CER") return "CER";
  if (tipoBloco === "CENT") return `CENT-${suf}`;

  const barreiras = eclusa ? "2B" : "1B";

  function seg(b: BarreiraConfig): string {
    let s = `${b.tipo}-${b.entrada}-${b.saida}`;
    if (b.tipo === "PORP" && b.abertura) {
      s += `-${b.abertura}`;
    }
    if (b.tipo === "PORV" && b.abertura) {
      s += `-${b.abertura}`;
      if (b.abertura === "PIVO") {
        if (b.tamanho) s += `-${b.tamanho}`;
        if (b.folhas) s += `-${b.folhas}`;
      } else if (b.abertura === "DESL") {
        if (b.peso) s += `-${b.peso}`;
      } else if (b.abertura === "BASC") {
        if (b.tamanho) s += `-${b.tamanho}`;
      }
    }
    return s;
  }

  let code = `${tipoBloco}-${barreiras}-${seg(b1!)}`;
  if (eclusa && b2) code += `-${seg(b2)}`;
  return `${code}-${suf}`;
}

// ─── Regeneração de código a partir de uma linha do banco ────────────────────
/** Regenera o `codigo_bloco` a partir de uma linha de `visita_blocos` aplicando
 *  a portaria (PR/PP) atual do projeto. */
export function codigoFromDbRow(row: any, portaria: "PR" | "PP"): string {
  const cfg: BlocoConfig = {
    tipoBloco: row.tipo_bloco as TipoBloco,
    eclusa: !!row.eclusa,
    b1: row.b1_tipo
      ? {
          tipo: row.b1_tipo,
          entrada: row.b1_entrada,
          saida: row.b1_saida,
          abertura: row.b1_abertura ?? undefined,
          folhas: row.b1_folhas ?? undefined,
          tamanho: row.b1_tamanho ?? undefined,
          peso: row.b1_peso ?? undefined,
        }
      : undefined,
    b2: row.b2_tipo
      ? {
          tipo: row.b2_tipo,
          entrada: row.b2_entrada,
          saida: row.b2_saida,
          abertura: row.b2_abertura ?? undefined,
          folhas: row.b2_folhas ?? undefined,
          tamanho: row.b2_tamanho ?? undefined,
          peso: row.b2_peso ?? undefined,
        }
      : undefined,
    tecnologia: row.tecnologia ?? undefined,
    qtdDome: row.qtd_dome ?? undefined,
    qtdBullet: row.qtd_bullet ?? undefined,
    portaria,
  };
  return gerarCodigoBloco(cfg);
}


// ─── Gerador de descrição legível ─────────────────────────────────────────────

export function gerarDescricaoBloco(config: BlocoConfig): string {
  const { tipoBloco, eclusa, b1, b2, tecnologia, qtdDome, qtdBullet } = config;

  if (tipoBloco === "CFTV") {
    const dome = qtdDome ?? 0;
    const bullet = qtdBullet ?? 0;
    const total = dome + bullet;
    return `CFTV — ${LABELS[tecnologia!] ?? tecnologia} · ${total} câmera(s) (${dome} dome / ${bullet} bullet)`;
  }
  if (tipoBloco === "AL") return `Alarme — ${LABELS[tecnologia!] ?? tecnologia}`;
  if (tipoBloco === "CER") return "Cerca Elétrica";
  if (tipoBloco === "CENT") return "Central de Portaria Remota";

  const tipoNome = tipoBloco === "PED" ? "Pedestre" : "Veicular";
  const barrNome = eclusa ? "2 Barreiras (Eclusa)" : "1 Barreira";

  function descrB(b: BarreiraConfig, idx: number): string {
    let d = `B${idx}: ${LABELS[b.tipo] ?? b.tipo}`;
    d += ` | E: ${LABELS[b.entrada] ?? b.entrada} | S: ${LABELS[b.saida] ?? b.saida}`;
    if (b.tipo === "PORP" && b.abertura) {
      d += ` | ${LABELS[b.abertura] ?? b.abertura}`;
    }
    if (b.tipo === "PORV" && b.abertura) {
      d += ` | ${LABELS[b.abertura] ?? b.abertura}`;
      if (b.abertura === "PIVO") {
        if (b.tamanho) d += ` ${LABELS[b.tamanho] ?? b.tamanho}`;
        if (b.folhas) d += ` — ${LABELS[b.folhas] ?? b.folhas}`;
      } else if (b.abertura === "DESL" && b.peso) {
        d += ` — ${LABELS[b.peso] ?? b.peso}`;
      } else if (b.abertura === "BASC" && b.tamanho) {
        d += ` — ${LABELS[b.tamanho] ?? b.tamanho}`;
      }
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
