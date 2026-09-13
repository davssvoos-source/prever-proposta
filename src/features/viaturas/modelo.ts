// As VIATURAS (R266–R274) — a lógica PURA. A tela só desenha.
//
// Davi, 13/09/2026: "O objetivo é controlar quem usou qual carro em que dia";
// "Cada trecho é um trecho"; "quando o técnico fica mais de 2 minutos num raio
// próximo do cliente, o sistema entende que ele chegou no cliente, e sugere
// término da viagem". O contexto inteiro está em docs/CONTEXTO_VIATURAS.md.
//
// R276 (Davi, 13/09/2026): "Remova a inserção do KM […] Quero apenas mapear
// local e data e com quem estava a viatura." O km saiu do sistema inteiro — é
// do QAP ERP, como o abastecimento (R274). Com ele foram embora as duas
// perguntas que o técnico respondia por viagem: bipar passou a ser UM toque.
//
// O que mora aqui: o ESTADO que a tela da etiqueta decide sozinha (livre ·
// minha · de outro · inativa), a duração e a permanência, a folha do gestor
// (recorte e totais) e a CHEGADA POR LOCALIZAÇÃO — a distância, o raio, os
// dois minutos e a máquina de estados que diz "chegou". Nada aqui sabe o que
// é um pixel nem toca o banco: é isso que deixa cada função virar asserção.

// ── As linhas como vêm do banco ─────────────────────────────────────────────

export interface Viatura {
  id: string;
  /** O que vai na etiqueta: …/viatura/<codigo>. Estável, separado da placa (D2). */
  codigo: string;
  placa: string;
  apelido: string;
  ativa: boolean;
  desativada_em: string | null;
}

export type Encerramento = "aberta" | "normal" | "assumida" | "gestor";

export interface Viagem {
  id: string;
  viatura_id: string;
  tecnico_id: string;
  chamado_id: string | null;
  saida_em: string;
  chegada_em: string | null;
  encerramento: Encerramento;
  encerrada_por: string | null;
  corrigida_por: string | null;
  corrigida_em: string | null;
  observacao: string | null;
}

export interface LocalDeReferencia {
  id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
}

// ── O estado que a tela decide (R269) ───────────────────────────────────────

export type EstadoDaTela =
  | { tipo: "desconhecida" }
  | { tipo: "inativa"; viatura: Viatura }
  | { tipo: "livre"; viatura: Viatura; ultima: Devolucao | null }
  | { tipo: "minha"; viatura: Viatura; viagem: Viagem }
  | { tipo: "de_outro"; viatura: Viatura; viagem: Viagem };

/**
 * Ao abrir …/viatura/<codigo>: uma de cinco coisas. A tela não pergunta "o que
 * você quer fazer" — ela lê o carro e responde.
 */
export function estadoDaViatura(
  viatura: Viatura | null | undefined,
  aberta: Viagem | null | undefined,
  meuId: string | null,
  ultima: Devolucao | null,
): EstadoDaTela {
  if (!viatura) return { tipo: "desconhecida" };
  if (!viatura.ativa) return { tipo: "inativa", viatura };
  if (!aberta) return { tipo: "livre", viatura, ultima };
  if (meuId && aberta.tecnico_id === meuId) return { tipo: "minha", viatura, viagem: aberta };
  return { tipo: "de_outro", viatura, viagem: aberta };
}

// ── A última devolução (R276) ───────────────────────────────────────────────

/** Quem devolveu o carro e quando — o que sobrou de "último registro" sem o km. */
export interface Devolucao { quando: string; tecnicoId: string }

// ── O tempo ─────────────────────────────────────────────────────────────────

/** Minutos da viagem — até a chegada, ou até `agora` se ainda aberta. */
export function minutosDeViagem(v: Pick<Viagem, "saida_em" | "chegada_em">, agora: Date): number {
  const fim = v.chegada_em ? new Date(v.chegada_em) : agora;
  return Math.max(0, Math.round((fim.getTime() - new Date(v.saida_em).getTime()) / 60_000));
}

/** 64 → "1h04"; 23 → "23 min"; 0 → "0 min". */
export function formatarDuracao(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h${String(r).padStart(2, "0")}`;
}

/**
 * A PERMANÊNCIA (D7): o tempo no cliente é o intervalo entre a chegada de um
 * trecho e a saída do seguinte, do MESMO técnico, no MESMO dia. Derivada,
 * nunca digitada. Devolve uma entrada por par consecutivo.
 */
export function permanencias(viagens: readonly Viagem[]): { anterior: Viagem; seguinte: Viagem; minutos: number }[] {
  const porTecnico = new Map<string, Viagem[]>();
  for (const v of viagens) {
    const lista = porTecnico.get(v.tecnico_id) ?? [];
    lista.push(v);
    porTecnico.set(v.tecnico_id, lista);
  }
  const out: { anterior: Viagem; seguinte: Viagem; minutos: number }[] = [];
  for (const lista of porTecnico.values()) {
    const ordenada = [...lista].sort((a, b) => new Date(a.saida_em).getTime() - new Date(b.saida_em).getTime());
    for (let i = 1; i < ordenada.length; i++) {
      const ant = ordenada[i - 1];
      const seg = ordenada[i];
      if (!ant.chegada_em) continue;
      if (diaLocal(ant.chegada_em) !== diaLocal(seg.saida_em)) continue;
      const minutos = Math.round((new Date(seg.saida_em).getTime() - new Date(ant.chegada_em).getTime()) / 60_000);
      if (minutos < 0) continue;
      out.push({ anterior: ant, seguinte: seg, minutos });
    }
  }
  return out;
}

/** AAAA-MM-DD no fuso local — o dia em que a coisa aconteceu para quem lê. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "AAAA-MM" da saída, no fuso local — a competência da folha. */
export function competenciaDaViagem(v: Pick<Viagem, "saida_em">): string {
  return diaLocal(v.saida_em).slice(0, 7);
}

// ── A folha do gestor (R272) ────────────────────────────────────────────────

export interface RecorteDaFolha {
  competencia: string;            // "AAAA-MM"
  viaturaId: string | null;       // null = todas
  tecnicoId: string | null;       // null = todos
}

export function filtrarFolha(viagens: readonly Viagem[], r: RecorteDaFolha): Viagem[] {
  return viagens
    .filter((v) => competenciaDaViagem(v) === r.competencia)
    .filter((v) => !r.viaturaId || v.viatura_id === r.viaturaId)
    .filter((v) => !r.tecnicoId || v.tecnico_id === r.tecnicoId)
    .sort((a, b) => new Date(b.saida_em).getTime() - new Date(a.saida_em).getTime());
}

export interface ResumoDaFolha {
  viagens: number;
  abertas: number;
  minutos: number;
  /** R276: sem o km, o que ainda merece olhar é a viagem ASSUMIDA de outro */
  avisos: number;
}

/** Os totais do recorte — a folha e o número que ela mostra saem da MESMA lista. */
export function resumoDaFolha(viagens: readonly Viagem[], agora: Date): ResumoDaFolha {
  let minutos = 0, abertas = 0, avisos = 0;
  for (const v of viagens) {
    minutos += minutosDeViagem(v, agora);
    if (!v.chegada_em) abertas++;
    if (v.encerramento === "assumida") avisos++;
  }
  return { viagens: viagens.length, abertas, minutos, avisos };
}

/** Totais por chave (técnico ou viatura), do que mais rodou TEMPO para o que menos. */
export function totaisPor(
  viagens: readonly Viagem[],
  chave: "tecnico_id" | "viatura_id",
  agora: Date,
): { id: string; resumo: ResumoDaFolha }[] {
  const grupos = new Map<string, Viagem[]>();
  for (const v of viagens) {
    const lista = grupos.get(v[chave]) ?? [];
    lista.push(v);
    grupos.set(v[chave], lista);
  }
  return [...grupos.entries()]
    .map(([id, lista]) => ({ id, resumo: resumoDaFolha(lista, agora) }))
    .sort((a, b) => b.resumo.minutos - a.resumo.minutos);
}

/** A devolução mais recente da viatura: quem estava com ela e até quando (R276). */
export function ultimaDevolucao(viagens: readonly Viagem[], viaturaId: string): Devolucao | null {
  let melhor: Viagem | null = null;
  for (const v of viagens) {
    if (v.viatura_id !== viaturaId || !v.chegada_em) continue;
    if (!melhor || new Date(v.chegada_em) > new Date(melhor.chegada_em as string)) melhor = v;
  }
  return melhor ? { quando: melhor.chegada_em as string, tecnicoId: melhor.tecnico_id } : null;
}

// ── O cadastro (R271) ───────────────────────────────────────────────────────

/** "Fiorino Branca" → "fiorino-branca": o código sugerido para a etiqueta. */
export function codigoSugerido(apelido: string): string {
  return apelido
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** O gêmeo puro do CHECK do banco — as mesmas regras, para a tela avisar antes. */
export function erroDaViatura(entrada: { placa: string; apelido: string; codigo: string }): string | null {
  if (entrada.apelido.trim().length < 2) return "Dê um apelido à viatura (ex.: Fiorino branca).";
  if (entrada.apelido.trim().length > 60) return "O apelido é longo demais (até 60 letras).";
  const placa = entrada.placa.trim();
  if (placa.length < 5 || placa.length > 12) return "Informe a placa (ex.: ABC-1D23).";
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(entrada.codigo)) return "O código da etiqueta usa só letras minúsculas, números e hífen (ex.: fiorino-1).";
  return null;
}

// ── A chegada por localização (R273/R274) ───────────────────────────────────

/** Q24: 150 m — o GPS urbano erra 10–30 m e a portaria fica longe do centro do endereço. */
export const RAIO_CHEGADA_M = 150;
/** Davi: "mais de 2 minutos num raio próximo do cliente". */
export const MINUTOS_PARA_CHEGAR = 2;

export interface Ponto { latitude: number; longitude: number }

export interface Destino extends Ponto {
  id: string;
  nome: string;
  tipo: "cliente" | "sede";
}

/** Haversine em metros — o bastante para 150 m numa cidade. */
export function distanciaMetros(a: Ponto, b: Ponto): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Q24 (Davi): "deve ser para todas as atividades que existem no dia para aquele
 * usuário, pois existe a possibilidade de ele trocar a ordem dos chamados do
 * dia". Então os destinos são os clientes de TODAS as atividades de hoje dele
 * que têm coordenada — mais a sede (Q25), para o trecho de volta.
 */
export function destinosDoDia(
  atividadesDeHoje: readonly { clienteId: string | null }[],
  clientes: readonly { id: string; nome: string; latitude: number | null; longitude: number | null }[],
  sede: LocalDeReferencia | null | undefined,
): Destino[] {
  const ids = new Set(atividadesDeHoje.map((a) => a.clienteId).filter((x): x is string => !!x));
  const out: Destino[] = [];
  for (const c of clientes) {
    if (!ids.has(c.id) || c.latitude === null || c.longitude === null) continue;
    out.push({ id: c.id, nome: c.nome, tipo: "cliente", latitude: c.latitude, longitude: c.longitude });
  }
  if (sede && sede.latitude !== null && sede.longitude !== null) {
    out.push({ id: `ref:${sede.codigo}`, nome: sede.nome, tipo: "sede", latitude: sede.latitude, longitude: sede.longitude });
  }
  return out;
}

export interface EstadoDaChegada {
  /** dentro do raio de qual destino, e desde quando (ms) — null fora de todos */
  destinoId: string | null;
  desdeMs: number | null;
}

export const CHEGADA_INICIAL: EstadoDaChegada = { destinoId: null, desdeMs: null };

/**
 * A máquina de estados da chegada. A cada posição: qual o destino mais próximo
 * DENTRO do raio? Se é o mesmo de antes, o relógio continua; se mudou (ou saiu
 * de todos), o relógio reinicia. `chegou` é o destino quando a permanência
 * dentro do raio passou dos 2 minutos — e é SUGESTÃO: quem encerra é a pessoa
 * (R273). A posição não sai desta função para lugar nenhum.
 */
export function avaliarChegada(
  anterior: EstadoDaChegada,
  posicao: Ponto,
  agoraMs: number,
  destinos: readonly Destino[],
): { estado: EstadoDaChegada; chegou: Destino | null; dentroDe: Destino | null } {
  let perto: Destino | null = null;
  let menor = Infinity;
  for (const d of destinos) {
    const dist = distanciaMetros(posicao, d);
    if (dist <= RAIO_CHEGADA_M && dist < menor) { menor = dist; perto = d; }
  }
  if (!perto) return { estado: CHEGADA_INICIAL, chegou: null, dentroDe: null };
  const desde = anterior.destinoId === perto.id && anterior.desdeMs !== null ? anterior.desdeMs : agoraMs;
  const estado = { destinoId: perto.id, desdeMs: desde };
  const chegou = agoraMs - desde >= MINUTOS_PARA_CHEGAR * 60_000 ? perto : null;
  return { estado, chegou, dentroDe: perto };
}

// ── Regra 5: até a U134 rodar, as tabelas não existem ───────────────────────

/** PGRST205 (o PostgREST não acha a tabela) ou 42P01 (o Postgres não acha) — em qualquer das três. */
export function faltaMigrationDasViaturas(e: unknown): boolean {
  const c = (e as { code?: string } | null)?.code;
  const m = (e as { message?: string } | null)?.message ?? "";
  return c === "PGRST205" || c === "42P01" || c === "PGRST202"
    || /viaturas|viagens_viatura|locais_de_referencia|viatura_iniciar_viagem|viatura_encerrar_viagem/.test(m) && /Could not find|does not exist/i.test(m);
}
