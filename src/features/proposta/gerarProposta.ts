// Geração da proposta comercial (.docx) a partir do template em
// public/templates/proposta_comercial.docx (docxtemplater, delimitadores {{ }}).
// Busca os dados da visita, calcula os valores conforme a forma de pagamento
// escolhida, pede os resumos por I.A ao servidor (com fallback determinístico)
// e baixa o arquivo preenchido.

import { supabase } from "@/integrations/supabase/client";
import { isServicoCode } from "@/features/orcamento/blockAutoItems";
import {
  MARKUP_VENDA,
  VALOR_HORA_HOMEM,
  HH_PADRAO_BLOCO,
  IMPLANTACAO_PARCELAS,
  LOCACAO_PRAZO_MESES,
  mensalidadeLocacao,
  mensalidadesComodato,
  type PrazoComodato,
} from "@/features/comercial/regrasComerciais";
import {
  computeLinhasMensais,
  totalMensalServicos,
  type LinhaMensal,
} from "@/features/comercial/mensalidadesProjeto";
import { gerarResumosProposta, type ResumosProposta } from "@/lib/proposta.functions";

export type FormaPagamentoOpcao =
  | "locacao_24"
  | "comodato_24"
  | "comodato_36"
  | "comodato_48"
  | "comodato_60"
  | "compra_vista";

export const FORMAS_PAGAMENTO: { valor: FormaPagamentoOpcao; label: string }[] = [
  { valor: "locacao_24", label: `Locação — ${LOCACAO_PRAZO_MESES} meses` },
  { valor: "comodato_60", label: "Comodato — 60 meses" },
  { valor: "comodato_48", label: "Comodato — 48 meses" },
  { valor: "comodato_36", label: "Comodato — 36 meses" },
  { valor: "comodato_24", label: "Comodato — 24 meses" },
  { valor: "compra_vista", label: "Compra dos equipamentos (à vista ou parcelada)" },
];

/** Título curto da proposta (subtítulo do nº e linha "Ass." do documento) —
 *  as propostas reais usam o produto principal ("Portaria Remota", "Controle
 *  de Acesso Eletrônico"), nunca a lista de todas as áreas. Editável no popup. */
export function tituloPadraoProposta(
  sistemaProposto: string | null | undefined,
  servicosPropostos: string[] | null | undefined,
  tipoLocal?: string | null,
): string {
  if (sistemaProposto === "PR") return "Portaria Remota";
  const t = (tipoLocal ?? "").trim().toLowerCase();
  if (t === "residencia" || t === "empresa") return "Sistema de Segurança Eletrônica";
  const areas = (servicosPropostos ?? []).map((k) => AREA_SERVICO[k]).filter(Boolean);
  if (areas.includes("Controle de Acesso Eletrônico")) return "Controle de Acesso Eletrônico";
  return areas[0] ?? "Segurança Eletrônica";
}

/** Remove acentos e troca separadores por "_" — padrão dos nomes de arquivo
 *  das propostas reais (ex.: "Mansoes_do_Lago"). */
const slugArquivo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const PRAZO_EXTENSO: Record<number, string> = {
  24: "24 (Vinte e quatro) meses",
  36: "36 (Trinta e seis) meses",
  48: "48 (Quarenta e oito) meses",
  60: "60 (Sessenta) meses",
};

const SUBCATS_INSUMO = new Set(["cabeamento", "tubulacao"]);

const TIPOS_NOMES: Record<string, string> = {
  PED: "Eclusa de Pedestres",
  VEI: "Eclusa Veicular",
  CFTV: "CFTV",
  AL: "Alarme",
  CER: "Cerca Elétrica",
  CENT: "Central de Portaria Remota",
  ELV: "Elevadores",
  TOT: "Totem Inteligente",
};
const TIPOS_UNICOS = new Set(["CENT"]);

// Área curta por serviço proposto — {{Servicos_ofertados}} não deve conter os
// termos "Implantação"/"Manutenção" (regra do usuário). Inclui as 7 chaves
// atuais e as legadas (visitas antigas).
const AREA_SERVICO: Record<string, string> = {
  // chaves atuais (lista de 7)
  controle_acesso: "Controle de Acesso Eletrônico",
  portaria_remota: "Portaria Remota",
  monitoramento_24h: "Monitoramento 24h",
  cftv: "CFTV",
  alarmes: "Alarmes",
  totem_monitoramento: "Totem de Monitoramento",
  cerca_eletrica: "Cerca Elétrica",
  // legadas
  implantacao_controle_acesso: "Controle de Acesso Eletrônico",
  manutencao_controle_acesso: "Controle de Acesso Eletrônico",
  implantacao_cftv: "CFTV",
  manutencao_cftv: "CFTV",
  implantacao_alarmes: "Alarmes",
  manutencao_alarmes: "Alarmes",
  implantacao_cerca_eletrica: "Cerca Elétrica",
  manutencao_cerca_eletrica: "Cerca Elétrica",
  monitoramento_alarmes: "Monitoramento 24h",
  gestao_portaria_presencial: "Controle de Acesso Eletrônico",
  // fluxo Residência/Galpão (servicos_ofertados do orçamento)
  implantacao_sistema: "Sistema de Segurança Eletrônica",
};

const SERVICO_LABEL_COMPLETO: Record<string, string> = {
  controle_acesso: "Controle de Acesso Eletrônico",
  portaria_remota: "Operação de Portaria Remota",
  monitoramento_24h: "Monitoramento 24h",
  cftv: "CFTV",
  alarmes: "Alarmes",
  totem_monitoramento: "Totem de Monitoramento",
  cerca_eletrica: "Cerca Elétrica",
  // legadas
  implantacao_controle_acesso: "Implantação de Controle de Acesso Eletrônico",
  manutencao_controle_acesso: "Manutenção de Controle de Acesso Eletrônico",
  implantacao_cftv: "Implantação de CFTV",
  manutencao_cftv: "Manutenção de CFTV",
  implantacao_alarmes: "Implantação de Alarme",
  manutencao_alarmes: "Manutenção de Alarme",
  implantacao_cerca_eletrica: "Implantação de Cerca Elétrica",
  manutencao_cerca_eletrica: "Manutenção de Cerca Elétrica",
  monitoramento_alarmes: "Monitoramento de Alarmes",
  gestao_portaria_presencial: "Gestão de Controle de Acesso — Portaria Presencial",
  implantacao_sistema: "Implantação de Sistema de Segurança Eletrônica",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// PNG transparente 1×1 — usado quando a visita não tem foto de fachada
const PNG_VAZIO = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
).buffer;

async function carregarFachada(
  rawUrl: string | null,
): Promise<{ data: ArrayBuffer; w: number; h: number } | null> {
  if (!rawUrl) return null;
  try {
    let url = rawUrl;
    const m = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
    if (m) {
      const [, bucket, path] = m;
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (data?.signedUrl) url = data.signedUrl;
    }
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const maxW = 440;
    const escala = bmp.width > maxW ? maxW / bmp.width : 1;
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    bmp.close();
    return { data: await blob.arrayBuffer(), w, h };
  } catch {
    return null;
  }
}

export interface GerarPropostaOpts {
  visitaId: string;
  forma: FormaPagamentoOpcao;
  /** Aceita "5204_08_26" ou "5204.08.26" — o documento usa pontos, o arquivo usa underscores. */
  numeroProposta: string;
  /** Título curto da proposta (ex.: "Portaria Remota"); ausente → derivado dos dados. */
  titulo?: string;
  /** Turno da operação de Portaria Remota (padrão 24h). */
  turnoPortaria?: "24h" | "12h";
  /** Nº de parcelas da compra (1 = à vista). Só usado quando forma = compra_vista. */
  parcelasCompra?: number;
  /** Comodato: apresenta os valores numa linha única consolidada (estilo da
   *  proposta 5171), em vez de detalhar linha a linha. */
  consolidarValores?: boolean;
}

export async function gerarPropostaDocx({
  visitaId,
  forma,
  numeroProposta,
  titulo,
  turnoPortaria = "24h",
  parcelasCompra = 1,
  consolidarValores = false,
}: GerarPropostaOpts): Promise<void> {
  // ── 1) Dados ────────────────────────────────────────────────────────────────
  const [{ data: visita }, { data: orcamento }, { data: blocosRaw }] = await Promise.all([
    supabase
      .from("visitas_tecnicas")
      .select("nome_predio, titulo, endereco, complemento, nome_sindico, tipo_local, servicos_propostos, foto_fachada_url, notas_visita")
      .eq("id", visitaId)
      .maybeSingle(),
    supabase.from("visita_orcamentos").select("*").eq("visita_id", visitaId).maybeSingle(),
    supabase.from("visita_blocos" as any).select("*").eq("visita_id", visitaId).order("ordem"),
  ]);
  if (!visita) throw new Error("Visita não encontrada");
  const blocos = ((blocosRaw as any[]) ?? []);
  const blocoIds = blocos.map((b) => b.id);

  const { data: itensRaw } = blocoIds.length
    ? await supabase
        .from("visita_bloco_itens" as any)
        .select("visita_bloco_id, cod_eq, qtd, removido")
        .in("visita_bloco_id", blocoIds)
    : { data: [] as any[] };
  const itens = ((itensRaw as any[]) ?? []).filter((r) => !r.removido);
  const itensEq = itens.filter((r) => !isServicoCode(r.cod_eq));
  const itensSv = itens.filter((r) => isServicoCode(r.cod_eq));

  const codes = Array.from(new Set(itensEq.map((i) => i.cod_eq)));
  const svCodes = Array.from(new Set(itensSv.map((i) => i.cod_eq)));
  const [{ data: eqRows }, { data: svRows }] = await Promise.all([
    codes.length
      ? supabase.from("equipamentos").select("code,nome,marca,modelo,custo,subcat").in("code", codes)
      : Promise.resolve({ data: [] as any[] }),
    svCodes.length
      ? supabase.from("servicos").select("code,nome,preco_unitario_mensal").in("code", svCodes)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const eqInfo: Record<string, { nome: string; marca: string | null; modelo: string | null; custo: number; subcat: string | null }> = {};
  for (const e of (eqRows as any[]) ?? []) {
    eqInfo[e.code] = { nome: e.nome, marca: e.marca, modelo: e.modelo, custo: Number(e.custo || 0), subcat: e.subcat ?? null };
  }
  const svInfo: Record<string, { nome: string; preco: number }> = {};
  for (const s of (svRows as any[]) ?? []) {
    svInfo[s.code] = { nome: s.nome, preco: Number(s.preco_unitario_mensal || 0) };
  }

  // ── 2) Financeiro (mesmas regras da página Formas de Pagamento) ─────────────
  // Blocos TOT ficam fora da base de venda/locação/comodato — o totem é sempre
  // locação própria de 24 meses (mensalidade tabelada que embute o hardware).
  const totIds = new Set(blocos.filter((b) => b.tipo_bloco === "TOT").map((b) => b.id));
  let custoTotal = 0;
  let custoInsumos = 0;
  const qtdPorCode: Record<string, number> = {};
  for (const it of itensEq) {
    const info = eqInfo[it.cod_eq];
    const qtd = Number(it.qtd || 0);
    qtdPorCode[it.cod_eq] = (qtdPorCode[it.cod_eq] ?? 0) + qtd; // tabela lista TUDO (inclusive totem)
    if (totIds.has(it.visita_bloco_id)) continue;
    const linha = (info?.custo ?? 0) * qtd;
    custoTotal += linha;
    if (info?.subcat && SUBCATS_INSUMO.has(info.subcat)) custoInsumos += linha;
  }
  const vendaTotal = custoTotal * MARKUP_VENDA;
  const vendaInsumos = custoInsumos * MARKUP_VENDA;
  const vendaEquipSemInsumos = vendaTotal - vendaInsumos;
  const locacaoMensal = mensalidadeLocacao(vendaEquipSemInsumos);
  const maoDeObra = blocos.length * HH_PADRAO_BLOCO * VALOR_HORA_HOMEM;
  const implantacaoTotal = vendaInsumos + maoDeObra;
  const comodato = mensalidadesComodato(locacaoMensal);

  const tipoLocal = ((visita as any).tipo_local as string | null)?.trim().toLowerCase() ?? "";
  const sistemaProposto = (orcamento as any)?.sistema_proposto as string | null;
  const svAgg: Record<string, number> = {};
  for (const it of itensSv) svAgg[it.cod_eq] = (svAgg[it.cod_eq] ?? 0) + Number(it.qtd || 0);
  const linhasMensais = computeLinhasMensais({
    blocos,
    svAgg,
    svInfo,
    tipoLocal,
    sistemaProposto,
    qtdApartamentos: Number((orcamento as any)?.qtd_apartamentos || 0),
    servicosOfertados: ((orcamento as any)?.servicos_ofertados as string[]) ?? [],
    linkPrever: (orcamento as any)?.link_internet_fornecimento === "prever",
    appAcessos: (orcamento as any)?.app_prever_acessos === true,
    turnoPortaria,
  });
  const totalServicos = totalMensalServicos(linhasMensais);

  // ── 3) Textos determinísticos ───────────────────────────────────────────────
  const servicosKeys: string[] = [
    ...(((visita as any).servicos_propostos as string[]) ?? []),
    ...((((orcamento as any)?.servicos_ofertados as string[]) ?? [])),
  ];
  const isPR = sistemaProposto === "PR";
  // Título curto da proposta — subtítulo do nº e linha "Ass." (padrão das
  // propostas reais: o produto principal, nunca a lista de todas as áreas).
  const tituloProposta =
    titulo?.trim() ||
    tituloPadraoProposta(sistemaProposto, servicosKeys, tipoLocal);

  const temCftv = blocos.some((b) => b.tipo_bloco === "CFTV" || b.tipo_bloco === "TOT");
  const temElevador =
    blocos.some((b) => b.tipo_bloco === "ELV") ||
    blocos.some((b) => b.b1_tipo === "ELEV" || b.b2_tipo === "ELEV");
  const linkPrever = (orcamento as any)?.link_internet_fornecimento === "prever";
  const temRedundancia = (orcamento as any)?.redundancia_energetica === true;

  const respContratada = [
    "• Fornecer, instalar e configurar todos os equipamentos descritos no escopo deste projeto;",
    "• Prestar suporte técnico ao sistema durante toda a vigência do contrato;",
    ...(isPR
      ? [
          "• Fornecer manuais físicos e virtuais para melhor usabilidade do sistema aos moradores;",
          "• Monitorar e agir conforme procedimentos previamente estabelecidos com a CONTRATANTE em caso de eventualidades;",
        ]
      : []),
    ...(linkPrever ? ["• Fornecer e manter o link de internet dedicado ao funcionamento do sistema;"] : []),
    ...(temCftv
      ? ["• Armazenar as imagens das câmeras por 7 (sete) dias no servidor de imagens da Prever;"]
      : isPR
        ? ["• Armazenar as imagens dos acessos controlados do condomínio por 7 (sete) dias corridos;"]
        : []),
  ].join("\n");

  // Portaria Remota exige DOIS links de internet (padrão das propostas reais);
  // nos demais sistemas, um link.
  const respContratante = [
    "• Disponibilizar acesso ao local do serviço para a equipe técnica da Contratada;",
    ...(!linkPrever
      ? [
          isPR
            ? "• Fornecer os dois links de internet necessários ao funcionamento do sistema;"
            : "• Fornecer o link de internet necessário ao funcionamento do sistema;",
        ]
      : []),
    ...(temElevador
      ? ["• Agendar com a empresa responsável pelos elevadores o acompanhamento das intervenções necessárias;"]
      : []),
  ].join("\n");

  // Nomes dos blocos (mesma convenção do restante do app)
  const counters: Record<string, number> = {};
  const nomesBlocos = blocos.map((bloco) => {
    const tipo = bloco.tipo_bloco;
    counters[tipo] = (counters[tipo] || 0) + 1;
    const base = TIPOS_NOMES[tipo] || tipo;
    const nomeUsuario = (bloco.nome_acesso as string | null)?.trim();
    return nomeUsuario
      ? nomeUsuario
      : TIPOS_UNICOS.has(tipo)
        ? base
        : `${base} ${String(counters[tipo]).padStart(2, "0")}`;
  });

  // Tabela de equipamentos (agregada por código)
  const equipamentosTabela = Object.entries(qtdPorCode)
    .map(([code, qtd]) => ({
      nome: eqInfo[code]?.nome ?? code,
      marca: eqInfo[code]?.marca ?? "—",
      modelo: eqInfo[code]?.modelo ?? "—",
      qtd,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Tabela de preços + condicionais do bloco de prazo, conforme a forma.
  // O totem já vem em linhasMensais com a marcação de locação fixa de 24 meses.
  // As propostas reais NÃO têm parágrafo introdutório antes da tabela.
  const temTotem = blocos.some((b) => b.tipo_bloco === "TOT");
  const precos: { descricao: string; valor: string }[] = [];
  let prazoContratual = "";
  let rotuloTotal = "";
  let totalMensal = totalServicos;
  // Bloco "Prazo contratual mínimo…" só existe para locação/comodato; na compra
  // entra apenas o aviso de alvenaria/infraestrutura (padrão da proposta 5195).
  const temPrazoContratual = forma !== "compra_vista";
  let temTotalMensal = true;
  let artigoRegime = "o";
  let regimePalavra = "comodato";

  if (forma === "locacao_24") {
    precos.push({ descricao: "Locação dos equipamentos / Mão de obra para manutenção preventiva e corretiva", valor: fmtBRL(locacaoMensal) });
    precos.push({
      descricao: `Implantação — materiais, insumos e mão de obra (cobrada à parte, somente nas ${IMPLANTACAO_PARCELAS} primeiras mensalidades)`,
      valor: fmtBRL(implantacaoTotal / IMPLANTACAO_PARCELAS),
    });
    totalMensal += locacaoMensal;
    prazoContratual = PRAZO_EXTENSO[LOCACAO_PRAZO_MESES];
    rotuloTotal = `TOTAL MENSAL DURANTE O PRAZO CONTRATUAL DE ${LOCACAO_PRAZO_MESES} MESES (implantação à parte)`;
    artigoRegime = "a";
    regimePalavra = "locação";
  } else if (forma === "compra_vista") {
    // Compra inclui mão de obra de implantação (padrão da proposta 5195);
    // os insumos já estão no valor de venda. Pode ser parcelada (ex.: 6x).
    const compraTotal = vendaTotal + maoDeObra;
    const parcelas = Math.max(1, Math.round(parcelasCompra));
    precos.push({
      descricao: "Aquisição dos equipamentos do projeto / Mão de obra técnica para implantação do projeto / Materiais e Insumos",
      valor: parcelas > 1 ? `${parcelas}x ${fmtBRL(compraTotal / parcelas)}` : fmtBRL(compraTotal),
    });
    rotuloTotal = "TOTAL MENSAL DOS SERVIÇOS RECORRENTES";
    temTotalMensal = linhasMensais.length > 0; // sem serviços mensais → sem linha de total
  } else {
    const prazo = Number(forma.replace("comodato_", "")) as PrazoComodato;
    precos.push({
      descricao: "Equipamentos em comodato / Mão de obra para implantação / Materiais e Insumos / Mão de obra para manutenção preventiva e corretiva",
      valor: fmtBRL(comodato[prazo]),
    });
    totalMensal += comodato[prazo];
    prazoContratual = PRAZO_EXTENSO[prazo];
    rotuloTotal = `TOTAL MENSAL DURANTE O PRAZO CONTRATUAL DE ${prazo} MESES`;
  }

  // Serviços mensais (inclui o totem, que é sempre locação de 24 meses).
  // No documento usam-se labelDoc/obsDoc — as observações internas da página
  // ("opção 12H", "estimado…", nº de aptos) não vão para o cliente.
  const linhasParaDoc = linhasMensais as LinhaMensal[];

  if (consolidarValores && forma !== "compra_vista" && forma !== "locacao_24") {
    // Linha única consolidada (estilo da proposta 5171): comodato + serviços
    // mensais somados numa única linha. O totem (contrato próprio de 24 meses)
    // e linhas "sob consulta" permanecem separados.
    const mescladas = linhasParaDoc.filter((l) => l.valor !== null && l.labelDoc !== "Totem de Monitoramento");
    const separadas = linhasParaDoc.filter((l) => !mescladas.includes(l));
    const valorConsolidado =
      comodato[Number(forma.replace("comodato_", "")) as PrazoComodato] +
      mescladas.reduce((s, l) => s + (l.valor ?? 0), 0);
    const partes = [
      ...(isPR ? [`Operação ${turnoPortaria === "12h" ? "12H" : "24H"} da Portaria Remota`] : []),
      "Equipamentos em comodato",
      "Materiais e insumos",
      "Mão de obra técnica para implantação",
      "Manutenção do sistema",
      ...(isPR ? [`Suporte ${turnoPortaria === "12h" ? "aos moradores" : "24H"}`, "Gestão dos cadastros dos usuários do sistema"] : []),
      ...(mescladas.some((l) => l.label.startsWith("Software operante") ) && !isPR ? ["Software operante"] : []),
      ...(mescladas.some((l) => l.label.startsWith("Monitoramento 24H")) ? ["Monitoramento 24H"] : []),
      ...(mescladas.some((l) => l.label.startsWith("Link de internet")) ? ["Link de internet"] : []),
    ];
    precos.length = 0;
    precos.push({ descricao: partes.join(" / "), valor: fmtBRL(valorConsolidado) });
    for (const l of separadas) {
      const label = l.labelDoc ?? l.label;
      precos.push({
        descricao: l.obsDoc ? `${label} (${l.obsDoc})` : label,
        valor: l.valor === null ? "Sob consulta" : l.valor === 0 ? "Incluso" : fmtBRL(l.valor),
      });
    }
    temTotalMensal = false; // estilo 5171: sem linha de TOTAL
  } else {
    for (const l of linhasParaDoc) {
      const label = l.labelDoc ?? l.label;
      precos.push({
        descricao: l.obsDoc ? `${label} (${l.obsDoc})` : label,
        valor: l.valor === null ? "Sob consulta" : l.valor === 0 ? "Incluso" : fmtBRL(l.valor),
      });
    }
  }

  // Totem tem prazo próprio (24 meses de locação) — anota no prazo contratual.
  // Na compra o bloco de prazo nem é renderizado (a linha do totem já carrega
  // "locação — contrato fixo de 24 meses"), então só anota quando o bloco existe.
  if (temPrazoContratual && temTotem && forma !== "locacao_24") {
    prazoContratual += ` · Totem de Monitoramento: ${PRAZO_EXTENSO[24]} (locação)`;
  }

  // ── 4) Resumos por I.A (com fallback determinístico) ────────────────────────
  const iasResumo = Object.entries(svAgg)
    .filter(([, q]) => q > 0)
    .map(([code, q]) => `${q}× ${svInfo[code]?.nome ?? code}`);
  const notasVisita = ((visita as any).notas_visita as string | null)?.trim();
  const contexto = [
    `Local: ${(visita as any).nome_predio ?? (visita as any).titulo ?? "—"} (tipo: ${tipoLocal || "condomínio"})`,
    `Título da proposta: ${tituloProposta}`,
    `Sistema de portaria proposto: ${sistemaProposto ?? "—"}${isPR ? ` (operação ${turnoPortaria === "12h" ? "12H — meio período" : "24H"})` : ""}`,
    `Serviços propostos: ${servicosKeys.map((k) => SERVICO_LABEL_COMPLETO[k] ?? k).join("; ") || "—"}`,
    `Blocos do escopo (lista completa de equipamentos por bloco):`,
    ...blocos.map((b, i) => {
      const itensDoBloco = itensEq
        .filter((it) => it.visita_bloco_id === b.id)
        .map((it) => `${it.qtd}× ${eqInfo[it.cod_eq]?.nome ?? it.cod_eq}`);
      const obsTecnico = ((b as any).observacao as string | null)?.trim();
      return (
        `- ${nomesBlocos[i]}: ${itensDoBloco.join(", ") || "sem equipamentos"}` +
        (obsTecnico ? `\n  OBSERVAÇÃO DO TÉCNICO (${nomesBlocos[i]}): ${obsTecnico}` : "")
      );
    }),
    ...(notasVisita ? [`OBSERVAÇÕES GERAIS DO TÉCNICO (visita): ${notasVisita}`] : []),
    temRedundancia ? "Redundância energética: SIM (nobreak + baterias dimensionados no escopo)" : "Redundância energética: NÃO",
    iasResumo.length ? `I.As de vídeo (mensais): ${iasResumo.join(", ")}` : "I.As de vídeo: nenhuma",
    linkPrever ? "Link de internet fornecido pela Prever" : "Link de internet por conta do cliente",
  ].join("\n");

  let resumos: ResumosProposta;
  try {
    const r = await gerarResumosProposta({
      data: { contexto, temRedundancia, temIas: iasResumo.length > 0 },
    });
    if (r.ok && r.resumos) {
      resumos = r.resumos;
    } else {
      throw new Error(r.erro ?? "sem resumos");
    }
  } catch {
    // Fallback determinístico — garante que a geração nunca trava por causa da I.A
    resumos = {
      visao_geral:
        `Este projeto contempla o fornecimento e a implantação da solução de ${tituloProposta} ` +
        `para ${(visita as any).nome_predio ?? "o local"}, dimensionada a partir da visita técnica realizada pela equipe Prever. ` +
        `O escopo abrange ${blocos.length} bloco(s) de instalação com equipamentos, infraestrutura e serviços descritos nesta proposta.`,
      escopo:
        `O objetivo da implantação é fornecer, instalar e configurar o sistema de ${tituloProposta} descrito nesta proposta.\n` +
        blocos
          .map((b, i) => {
            const top = itensEq
              .filter((it) => it.visita_bloco_id === b.id)
              .map((it) => eqInfo[it.cod_eq]?.nome ?? it.cod_eq)
              .slice(0, 3);
            return `• ${nomesBlocos[i]} — ${top.length ? `instalação de ${top.join(", ")} e demais equipamentos do bloco;` : "conforme escopo detalhado;"}`;
          })
          .join("\n")
          .replace(/;$/, "."),
      redundancia: temRedundancia
        ? "O projeto contempla sistema de redundância energética composto por nobreak e baterias estacionárias dimensionados para o consumo dos equipamentos, mantendo o sistema operante em caso de interrupção no fornecimento de energia."
        : "",
      inteligencia_artificial: iasResumo.length
        ? `O projeto inclui recursos de inteligência artificial aplicados às câmeras: ${iasResumo.join(", ")}. As análises operam em tempo real e são cobradas como serviço mensal por câmera.`
        : "",
      // Sem I.A não há como interpretar as observações do técnico com segurança
      responsabilidades_extras_contratada: "",
      responsabilidades_extras_contratante: "",
    };
  }

  // ── 5) Render do DOCX ───────────────────────────────────────────────────────
  const [{ default: PizZip }, { default: Docxtemplater }, { default: ImageModule }, templateResp, fachada] =
    await Promise.all([
      import("pizzip"),
      import("docxtemplater"),
      import("docxtemplater-image-module-free"),
      fetch("/templates/proposta_comercial.docx"),
      carregarFachada((visita as any).foto_fachada_url ?? null),
    ]);
  if (!templateResp.ok) throw new Error("Template da proposta não encontrado (public/templates)");
  const templateBuf = await templateResp.arrayBuffer();

  const imageModule = new ImageModule({
    centered: true,
    getImage: () => (fachada ? fachada.data : PNG_VAZIO),
    getSize: () => (fachada ? [fachada.w, fachada.h] : [1, 1]),
  });

  const zip = new PizZip(templateBuf);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    modules: [imageModule],
  });

  // Nº da proposta: documento usa pontos (N° 5204.08.26), arquivo usa underscores.
  const numDoc = numeroProposta.trim().replace(/_/g, ".");
  const numArquivo = numeroProposta.trim().replace(/\./g, "_");

  doc.render({
    Data_atual: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    Numero_da_proposta: numDoc,
    Servicos_ofertados: tituloProposta,
    Imagem_fachada: "fachada",
    Nome_do_local: (visita as any).nome_predio ?? (visita as any).titulo ?? "",
    Endereco_do_local: [((visita as any).endereco ?? "").trim(), ((visita as any).complemento ?? "").trim()]
      .filter(Boolean)
      .join(" — "),
    Nome_do_sindico: (visita as any).nome_sindico ?? "",
    Visao_geral_do_projeto: resumos.visao_geral,
    Escopo_do_projeto: resumos.escopo,
    // Bullets extras vêm das observações do técnico, interpretadas pela I.A
    Responsabilidades_da_contratada: [respContratada, resumos.responsabilidades_extras_contratada?.trim()]
      .filter(Boolean)
      .join("\n"),
    Responsabilidades_da_contratante: [respContratante, resumos.responsabilidades_extras_contratante?.trim()]
      .filter(Boolean)
      .join("\n"),
    equipamentos: equipamentosTabela,
    // Seções condicionais — cabeçalhos só aparecem quando há conteúdo
    Tem_redundancia: Boolean(resumos.redundancia?.trim()),
    Sistema_de_redundancia: resumos.redundancia,
    Tem_ias: Boolean(resumos.inteligencia_artificial?.trim()),
    Sistema_de_inteligencia_artificial: resumos.inteligencia_artificial,
    precos,
    Tem_total_mensal: temTotalMensal,
    Rotulo_total_mensal: rotuloTotal,
    Total_mensal: fmtBRL(totalMensal),
    Tem_prazo_contratual: temPrazoContratual,
    Sem_prazo_contratual: !temPrazoContratual,
    Prazo_contratual: prazoContratual,
    Artigo_regime: artigoRegime,
    Regime_palavra: regimePalavra,
  });

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
  // Padrão dos arquivos reais: 5204_08_26-Mansoes_do_Lago-Portaria_Remota.docx
  const nomeArquivo = `${numArquivo}-${slugArquivo((visita as any).nome_predio ?? "Prever")}-${slugArquivo(tituloProposta)}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
