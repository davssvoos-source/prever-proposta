// Regras comerciais do Grupo Prever — fonte única de verdade no app.
// Espelha a aba REGRAS_COMERCIAIS e as tabelas de mensalidade da planilha
// base_de_dados-servicos_eletronicos (v11). Mantido em código (e não no banco)
// enquanto a mecânica estabiliza — ver decisão registrada com o usuário em 2026-07-16.

// ── Venda ────────────────────────────────────────────────────────────────────
// Markup padrão único para todos os equipamentos: venda = custo × 1,5.
export const MARKUP_VENDA = 1.5;

// ── Mão de obra / implantação ────────────────────────────────────────────────
export const VALOR_HORA_HOMEM = 45; // R$ por hora/homem
// Provisório: 10 HH para todos os blocos até o usuário informar os valores
// reais por tipo de bloco (prometido para breve).
export const HH_PADRAO_BLOCO = 10;
export const IMPLANTACAO_PARCELAS = 12; // implantação da locação é parcelada em 12x

// ── Locação ──────────────────────────────────────────────────────────────────
export const LOCACAO_PRAZO_MESES = 24;
// Mensalidade da locação = valor de venda total ÷ 12 (não é o prazo do contrato).
export const LOCACAO_DIVISOR_MENSALIDADE = 12;

export function mensalidadeLocacao(vendaTotal: number): number {
  return vendaTotal / LOCACAO_DIVISOR_MENSALIDADE;
}

// ── Comodato ─────────────────────────────────────────────────────────────────
// Sem implantação. Mensalidades derivadas em cascata da mensalidade de locação:
// 60m = locação × 1,1 → 48m = 60m × 1,06 → 36m = 48m × 1,06 → 24m = 36m × 1,1.
export type PrazoComodato = 24 | 36 | 48 | 60;

export function mensalidadesComodato(locacaoMensal: number): Record<PrazoComodato, number> {
  const m60 = locacaoMensal * 1.1;
  const m48 = m60 * 1.06;
  const m36 = m48 * 1.06;
  const m24 = m36 * 1.1;
  return { 60: m60, 48: m48, 36: m36, 24: m24 };
}

// ── Monitoramento 24h (por tipo de local) ────────────────────────────────────
export const MONITORAMENTO_24H_MENSAL: Record<string, number> = {
  galpao: 450,
  residencia: 370,
};

// ── Operação de Portaria Remota (por faixa de apartamentos) ──────────────────
type FaixaApartamentos = { max: number; valor: number };

export const PORTARIA_REMOTA_24H: FaixaApartamentos[] = [
  { max: 30, valor: 3500 },
  { max: 40, valor: 3800 },
  { max: 50, valor: 4100 },
  { max: 60, valor: 4400 },
  { max: 70, valor: 4700 },
  { max: 80, valor: 5000 },
  { max: 90, valor: 5250 },
  { max: 100, valor: 5500 },
];

export const PORTARIA_REMOTA_12H: FaixaApartamentos[] = [
  { max: 30, valor: 2000 },
  { max: 40, valor: 2300 },
  { max: 50, valor: 2600 },
  { max: 60, valor: 2900 },
  { max: 70, valor: 3200 },
  { max: 80, valor: 3500 },
  { max: 90, valor: 3750 },
  { max: 100, valor: 4000 },
];

// Retorna null acima de 100 apartamentos (fora de tabela — negociação caso a caso).
export function valorPortariaRemota(qtdApartamentos: number, turno: "24h" | "12h"): number | null {
  const tabela = turno === "24h" ? PORTARIA_REMOTA_24H : PORTARIA_REMOTA_12H;
  const faixa = tabela.find((f) => qtdApartamentos <= f.max);
  return faixa ? faixa.valor : null;
}

// ── Totem de Monitoramento (mensalidade por totem) ───────────────────────────
// 1–2 câmeras: R$ 500 | 3 câmeras: R$ 550 | conectado ao Smart Sampa: +R$ 100.
export function mensalidadeTotem(qtdCameras: number, smartSampa: boolean): number {
  const base = qtdCameras >= 3 ? 550 : 500;
  return base + (smartSampa ? 100 : 0);
}

// ── Software operante ────────────────────────────────────────────────────────
export const SOFTWARE_OPERANTE_PR_MENSAL = 390; // sempre que for Portaria Remota
export const SOFTWARE_OPERANTE_PRESENCIAL_MENSAL = 350; // Controle de Acesso + Portaria Presencial

// ── Aplicativo Grupo Prever Acessos ──────────────────────────────────────────
// Portaria Remota: incluso na operação. Residência/Galpão: não fornecido.
export const APP_ACESSOS_PP_MENSAL = 500; // Portaria Presencial

// ── Link de internet ─────────────────────────────────────────────────────────
export const LINK_INTERNET_PREVER_MENSAL = 440; // quando a Prever fornece o link

// ── I.As (mensalidade por câmera; fonte em runtime = tabela servicos) ────────
export const IA_MENSALIDADES: Record<string, number> = {
  SV030: 170, // Leitura de Placas (LPR)
  SV031: 190, // Detecção de presença
  SV032: 110, // Detecção de ausência
  SV033: 190, // Detecção de movimento
};

// Smart Sampa por câmera no fluxo CFTV (código de serviço próprio).
// Valor assumido = R$ 100/mês (mesmo delta da tabela de totem) — confirmar com o usuário.
export const SMART_SAMPA_CODE = "SV034";
export const SMART_SAMPA_MENSAL = 100;
