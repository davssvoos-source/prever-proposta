// Mensalidades de serviços do projeto — função pura compartilhada entre a
// página Formas de Pagamento e o gerador da proposta comercial (.docx),
// para que os dois mostrem exatamente os mesmos valores.

import {
  MONITORAMENTO_24H_MENSAL,
  valorPortariaRemota,
  mensalidadeTotem,
  SOFTWARE_OPERANTE_PR_MENSAL,
  SOFTWARE_OPERANTE_PRESENCIAL_MENSAL,
  APP_ACESSOS_PP_MENSAL,
  LINK_INTERNET_PREVER_MENSAL,
  IA_MENSALIDADES,
} from "@/features/comercial/regrasComerciais";

export type LinhaMensal = { label: string; valor: number | null; obs?: string };

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface MensalidadesInput {
  /** Blocos da visita (linhas de visita_blocos). */
  blocos: any[];
  /** Itens SV agregados: { SV030: 3, ... } (não removidos). */
  svAgg: Record<string, number>;
  /** Metadados dos serviços: { SV030: { nome, preco } }. */
  svInfo: Record<string, { nome: string; preco: number }>;
  tipoLocal: string; // normalizado (trim+lower)
  sistemaProposto: string | null;
  qtdApartamentos: number;
  servicosOfertados: string[];
  linkPrever: boolean;
  appAcessos: boolean;
}

export function computeLinhasMensais(input: MensalidadesInput): LinhaMensal[] {
  const {
    blocos, svAgg, svInfo, tipoLocal, sistemaProposto,
    qtdApartamentos, servicosOfertados, linkPrever, appAcessos,
  } = input;
  const isResidencia = tipoLocal === "residencia";
  const isGalpao = tipoLocal === "empresa";
  const linhas: LinhaMensal[] = [];

  // I.As / Smart Sampa por câmera (itens SV dos blocos)
  for (const [code, qtd] of Object.entries(svAgg)) {
    if (qtd <= 0) continue;
    const sv = svInfo[code];
    const preco = sv?.preco ?? IA_MENSALIDADES[code] ?? 0;
    linhas.push({ label: `${qtd}× ${sv?.nome ?? code}`, valor: preco * qtd });
  }

  // Totens (mensalidade por totem, Smart Sampa por totem)
  for (const bloco of blocos) {
    if (bloco.tipo_bloco !== "TOT") continue;
    const cfg = (bloco.alarme_config as any)?.totem_totens as
      | { cameras: number; smart_sampa: boolean }[]
      | undefined;
    let valor = 0;
    let obs: string | undefined;
    if (Array.isArray(cfg) && cfg.length > 0) {
      valor = cfg.reduce((s, t) => s + mensalidadeTotem(Number(t.cameras || 0), !!t.smart_sampa), 0);
      obs = cfg.map((t, i) => `T${i + 1}: ${t.cameras}cam${t.smart_sampa ? "+SS" : ""}`).join(" · ");
    } else {
      const m = String(bloco.codigo_bloco || "").match(/TOT-(\d+)x(\d+)CAM/i);
      const n = m ? Number(m[1]) : Number(bloco.quantidade || 1);
      const cams = m ? Number(m[2]) : 3 * n;
      const camPorTotem = n > 0 ? cams / n : 3;
      valor = n * mensalidadeTotem(camPorTotem, false);
      obs = "estimado (bloco salvo antes da config detalhada)";
    }
    // Totem é SEMPRE locação com contrato próprio de 24 meses (sem comodato/compra)
    const obs24 = "locação — contrato fixo de 24 meses";
    linhas.push({
      label: "Totem de Monitoramento",
      valor,
      obs: obs ? `${obs} · ${obs24}` : obs24,
    });
  }

  // Operação de Portaria Remota (por faixa de apartamentos)
  if (sistemaProposto === "PR") {
    const v24 = valorPortariaRemota(qtdApartamentos, "24h");
    const v12 = valorPortariaRemota(qtdApartamentos, "12h");
    linhas.push({
      label: `Operação Portaria Remota 24H (${qtdApartamentos} aptos)`,
      valor: v24,
      obs: v24 === null
        ? "acima de 100 aptos — sob negociação"
        : v12 !== null
          ? `opção 12H: ${fmtBRL(v12)}`
          : undefined,
    });
    linhas.push({ label: "Software operante (Portaria Remota)", valor: SOFTWARE_OPERANTE_PR_MENSAL });
    if (appAcessos) {
      linhas.push({ label: "App Grupo Prever Acessos", valor: 0, obs: "incluso na operação de Portaria Remota" });
    }
  }

  // Portaria Presencial: software operante (se há controle de acesso) + app
  const temControleAcesso = blocos.some((b) => b.tipo_bloco === "PED" || b.tipo_bloco === "VEI");
  if (sistemaProposto === "PP") {
    if (temControleAcesso) {
      linhas.push({ label: "Software operante (Acesso c/ Portaria Presencial)", valor: SOFTWARE_OPERANTE_PRESENCIAL_MENSAL });
    }
    if (appAcessos && !isResidencia && !isGalpao) {
      linhas.push({ label: "App Grupo Prever Acessos", valor: APP_ACESSOS_PP_MENSAL });
    }
  }

  // Monitoramento 24H (Residência / Galpão)
  if ((isResidencia || isGalpao) && servicosOfertados.includes("monitoramento_24h")) {
    linhas.push({
      label: `Monitoramento 24H (${isGalpao ? "Galpão" : "Residência"})`,
      valor: MONITORAMENTO_24H_MENSAL[isGalpao ? "galpao" : "residencia"],
    });
  }

  // Link de internet fornecido pela Prever
  if (linkPrever) {
    linhas.push({ label: "Link de internet (fornecido pela Prever)", valor: LINK_INTERNET_PREVER_MENSAL });
  }

  return linhas;
}

export function totalMensalServicos(linhas: LinhaMensal[]): number {
  return linhas.reduce((s, l) => s + (l.valor ?? 0), 0);
}
