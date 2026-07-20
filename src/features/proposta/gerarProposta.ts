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
  { valor: "compra_vista", label: "Compra dos equipamentos à vista" },
];

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
  numeroProposta: string;
}

export async function gerarPropostaDocx({ visitaId, forma, numeroProposta }: GerarPropostaOpts): Promise<void> {
  // ── 1) Dados ────────────────────────────────────────────────────────────────
  const [{ data: visita }, { data: orcamento }, { data: blocosRaw }] = await Promise.all([
    supabase
      .from("visitas_tecnicas")
      .select("nome_predio, titulo, endereco, complemento, nome_sindico, tipo_local, servicos_propostos, foto_fachada_url")
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
  });
  const totalServicos = totalMensalServicos(linhasMensais);

  // ── 3) Textos determinísticos ───────────────────────────────────────────────
  const servicosKeys: string[] = [
    ...(((visita as any).servicos_propostos as string[]) ?? []),
    ...((((orcamento as any)?.servicos_ofertados as string[]) ?? [])),
  ];
  const areas = Array.from(new Set(servicosKeys.map((k) => AREA_SERVICO[k]).filter(Boolean)));
  const servicosOfertadosTxt = areas.join(" · ") || "Segurança Eletrônica";

  const dosServicos = Array.from(
    new Set(servicosKeys.map((k) => SERVICO_LABEL_COMPLETO[k]).filter(Boolean)),
  )
    .map((l) => `• ${l}`)
    .join("\n");

  const temCftv = blocos.some((b) => b.tipo_bloco === "CFTV" || b.tipo_bloco === "TOT");
  const temElevador =
    blocos.some((b) => b.tipo_bloco === "ELV") ||
    blocos.some((b) => b.b1_tipo === "ELEV" || b.b2_tipo === "ELEV");
  const linkPrever = (orcamento as any)?.link_internet_fornecimento === "prever";
  const temRedundancia = (orcamento as any)?.redundancia_energetica === true;

  const respContratada = [
    "• Fornecer, instalar e configurar todos os equipamentos descritos no escopo deste projeto;",
    "• Prestar suporte técnico ao sistema durante toda a vigência do contrato;",
    ...(linkPrever ? ["• Fornecer e manter o link de internet dedicado ao funcionamento do sistema;"] : []),
    ...(temCftv ? ["• Armazenar as imagens das câmeras por 7 (sete) dias no servidor de imagens da Prever;"] : []),
  ].join("\n");

  const respContratante = [
    "• Disponibilizar acesso ao local do serviço para a equipe técnica da Contratada;",
    ...(!linkPrever ? ["• Fornecer o link de internet necessário ao funcionamento do sistema;"] : []),
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

  // Tabela de preços (template novo) + intro e prazo conforme a forma escolhida.
  // O totem já vem em linhasMensais com a marcação de locação fixa de 24 meses.
  const temTotem = blocos.some((b) => b.tipo_bloco === "TOT");
  const precos: { descricao: string; valor: string }[] = [];
  let valoresIntro = "";
  let prazoContratual = "";
  let rotuloTotal = "";
  let totalMensal = totalServicos;

  if (forma === "locacao_24") {
    valoresIntro = "Fornecimento dos equipamentos sob regime de LOCAÇÃO, com manutenção preventiva e corretiva inclusa durante o contrato.";
    precos.push({ descricao: "Locação dos equipamentos / Mão de obra para manutenção preventiva e corretiva", valor: fmtBRL(locacaoMensal) });
    precos.push({
      descricao: `Implantação — materiais, insumos e mão de obra (cobrada à parte, somente nas ${IMPLANTACAO_PARCELAS} primeiras mensalidades)`,
      valor: fmtBRL(implantacaoTotal / IMPLANTACAO_PARCELAS),
    });
    totalMensal += locacaoMensal;
    prazoContratual = PRAZO_EXTENSO[LOCACAO_PRAZO_MESES];
    rotuloTotal = `TOTAL MENSAL DURANTE O PRAZO CONTRATUAL DE ${LOCACAO_PRAZO_MESES} MESES (implantação à parte)`;
  } else if (forma === "compra_vista") {
    valoresIntro = "Aquisição dos equipamentos com pagamento à vista; os serviços recorrentes são contratados mensalmente.";
    precos.push({ descricao: "Aquisição dos equipamentos do projeto (pagamento à vista)", valor: fmtBRL(vendaTotal) });
    prazoContratual = "Não se aplica (compra à vista)";
    rotuloTotal = "TOTAL MENSAL DOS SERVIÇOS RECORRENTES";
  } else {
    const prazo = Number(forma.replace("comodato_", "")) as PrazoComodato;
    valoresIntro = `Fornecimento dos equipamentos sob regime de COMODATO, sem cobrança de implantação, com manutenção preventiva e corretiva inclusa durante o contrato.`;
    precos.push({
      descricao: "Equipamentos em comodato / Mão de obra para implantação / Materiais e Insumos / Mão de obra para manutenção preventiva e corretiva",
      valor: fmtBRL(comodato[prazo]),
    });
    totalMensal += comodato[prazo];
    prazoContratual = PRAZO_EXTENSO[prazo];
    rotuloTotal = `TOTAL MENSAL DURANTE O PRAZO CONTRATUAL DE ${prazo} MESES`;
  }

  // Serviços mensais (inclui o totem, que é sempre locação de 24 meses)
  for (const l of linhasMensais as LinhaMensal[]) {
    precos.push({
      descricao: l.obs ? `${l.label} (${l.obs})` : l.label,
      valor: l.valor === null ? "Sob consulta" : l.valor === 0 ? "Incluso" : fmtBRL(l.valor),
    });
  }

  // Totem tem prazo próprio (24 meses de locação) — anota no prazo contratual
  if (temTotem && forma !== "locacao_24") {
    prazoContratual += ` · Totem de Monitoramento: ${PRAZO_EXTENSO[24]} (locação)`;
  }

  // ── 4) Resumos por I.A (com fallback determinístico) ────────────────────────
  const iasResumo = Object.entries(svAgg)
    .filter(([, q]) => q > 0)
    .map(([code, q]) => `${q}× ${svInfo[code]?.nome ?? code}`);
  const contexto = [
    `Local: ${(visita as any).nome_predio ?? (visita as any).titulo ?? "—"} (tipo: ${tipoLocal || "condomínio"})`,
    `Sistema de portaria proposto: ${sistemaProposto ?? "—"}`,
    `Serviços propostos: ${servicosKeys.map((k) => SERVICO_LABEL_COMPLETO[k] ?? k).join("; ") || "—"}`,
    `Blocos do escopo:`,
    ...blocos.map((b, i) => {
      const itensDoBloco = itensEq
        .filter((it) => it.visita_bloco_id === b.id)
        .map((it) => `${it.qtd}× ${eqInfo[it.cod_eq]?.nome ?? it.cod_eq}`)
        .slice(0, 8);
      return `- ${nomesBlocos[i]}: ${itensDoBloco.join(", ") || "sem equipamentos"}`;
    }),
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
        `Este projeto contempla o fornecimento e a implantação de soluções de ${servicosOfertadosTxt} ` +
        `para ${(visita as any).nome_predio ?? "o local"}, dimensionadas a partir da visita técnica realizada pela equipe Prever. ` +
        `O escopo abrange ${blocos.length} bloco(s) de instalação com equipamentos, infraestrutura e serviços descritos nesta proposta.`,
      escopo:
        `O objetivo da implantação é fornecer, instalar e configurar os sistemas de ${servicosOfertadosTxt} descritos nesta proposta.\n` +
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

  doc.render({
    Data_atual: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    Numero_da_proposta: numeroProposta,
    Servicos_ofertados: servicosOfertadosTxt,
    Imagem_fachada: "fachada",
    Nome_do_local: (visita as any).nome_predio ?? (visita as any).titulo ?? "",
    Endereco_do_local: [((visita as any).endereco ?? "").trim(), ((visita as any).complemento ?? "").trim()]
      .filter(Boolean)
      .join(" — "),
    Nome_do_sindico: (visita as any).nome_sindico ?? "",
    Visao_geral_do_projeto: resumos.visao_geral,
    Escopo_do_projeto: resumos.escopo,
    Responsabilidades_da_contratada: respContratada,
    Responsabilidades_da_contratante: respContratante,
    Dos_servicos_propostos: dosServicos,
    Equipamentos_do_projeto: "",
    equipamentos: equipamentosTabela,
    Sistema_de_redundancia: resumos.redundancia,
    Sistema_de_inteligencia_artificial: resumos.inteligencia_artificial,
    Valores_propostos: valoresIntro,
    precos,
    Rotulo_total_mensal: rotuloTotal,
    Total_mensal: fmtBRL(totalMensal),
    Prazo_contratual: prazoContratual,
  });

  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
  const nomeArquivo = `Proposta_${numeroProposta}_${((visita as any).nome_predio ?? "Prever").replace(/[^\p{L}\p{N}]+/gu, "_")}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
