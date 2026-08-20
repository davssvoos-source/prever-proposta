// Catálogo de telas — o que o admin pode liberar ou bloquear por papel.
//
// Vive no código, não no banco, porque É o mapa de rotas: uma tela existe
// quando existe rota, e isso é fato de deploy. O banco guarda só a chave e o
// sim/não (tabela `permissoes_tela`, migration U11).
//
// O que NÃO entra aqui:
// · páginas de detalhe (`/chamados/$id`, `/clientes/$id`, `/visita/$id`…) —
//   herdam de quem lista. Bloquear a lista e liberar o detalhe, ou o contrário,
//   produziria estados sem sentido, e o técnico chega no chamado dele pelos
//   cards da Início mesmo sem ver a lista;
// · `/chamados/novo-campo` e `/chamados/novo-interno` — são o segundo passo da
//   triagem `/chamados/novo`, não destinos próprios;
// · `/novo`, que só redireciona.
//
// `sempre: true` marca o que não pode ser desmarcado. Perfil é o caso claro:
// bloquear tiraria o botão de sair do app.

export type PapelPermissao = "tecnico" | "comercial" | "sac";

/** Os três que aparecem na matriz. O admin tem tudo por regra de sistema. */
export const PAPEIS: { chave: PapelPermissao; label: string }[] = [
  { chave: "tecnico", label: "Técnico" },
  { chave: "comercial", label: "Comercial" },
  { chave: "sac", label: "SAC" },
];

export interface Tela {
  /** Chave gravada no banco. Estável — renomear invalida a linha. */
  chave: string;
  label: string;
  rota: string;
  grupo: string;
  sempre?: boolean;
  /** O que vale enquanto não existe linha no banco (banco fora do ar, tela nova). */
  padrao: Record<PapelPermissao, boolean>;
  /** Explica uma escolha não óbvia, direto na tela. */
  nota?: string;
}

const T = (
  chave: string, label: string, rota: string, grupo: string,
  padrao: [boolean, boolean, boolean],
  extra: Partial<Tela> = {},
): Tela => ({
  chave, label, rota, grupo,
  padrao: { tecnico: padrao[0], comercial: padrao[1], sac: padrao[2] },
  ...extra,
});

// Os padrões abaixo são o retrato do código ANTES da U11 — os mesmos da
// semente da migration. Se o banco não responder, o app se comporta como
// sempre se comportou, em vez de trancar todo mundo para fora.
export const TELAS: Tela[] = [
  // ── Trabalho ──────────────────────────────────────────────────────────────
  T("dashboard", "Início", "/dashboard", "Trabalho", [true, true, true], { sempre: true }),
  T("calendario", "Calendário", "/calendario", "Trabalho", [true, true, true], {
    nota: "o técnico vê só o que é dele, por RLS",
  }),

  // ── Chamados ──────────────────────────────────────────────────────────────
  T("chamados", "Chamados (lista)", "/chamados", "Chamados", [false, true, true], {
    nota: "o técnico chega nos dele pelos cards da Início",
  }),
  T("chamados.novo", "Abrir chamado", "/chamados/novo", "Chamados", [false, true, true]),
  T("chamados.painel", "Painel de chamados", "/chamados/painel", "Chamados", [false, true, true]),
  T("chamados.indicadores", "Indicadores de campo", "/chamados/indicadores", "Chamados", [false, true, true], {
    nota: "SLA, carga por técnico, tempo médio",
  }),
  T("chamados.programacao", "Programação das duplas", "/chamados/programacao", "Chamados", [false, true, true]),
  T("chamados.importar", "Importar do Notion", "/chamados/importar", "Chamados", [false, true, true]),

  // ── Comercial ─────────────────────────────────────────────────────────────
  T("gerencial", "Painel comercial", "/gerencial", "Comercial", [false, true, false], {
    nota: "visitas, propostas e o funil",
  }),
  T("gerencial.nova", "Nova visita", "/gerencial/nova", "Comercial", [false, true, true], {
    nota: "o SAC chega aqui pelo trilho de proposta da triagem",
  }),
  T("historico", "Histórico", "/historico", "Comercial", [true, true, true]),
  T("mapa", "Mapa", "/mapa", "Comercial", [true, true, true]),

  // ── Clientes ──────────────────────────────────────────────────────────────
  T("clientes", "Clientes", "/clientes", "Clientes", [true, true, true]),
  T("clientes.novo", "Novo cliente", "/clientes/novo", "Clientes", [true, true, true]),
  T("clientes.migrar", "Consolidar cadastros", "/clientes/migrar", "Clientes", [true, true, true], {
    nota: "funde clientes duplicados — operação pesada e difícil de desfazer",
  }),

  // ── Financeiro ────────────────────────────────────────────────────────────
  T("contratos", "Contratos", "/contratos", "Financeiro", [false, true, false], {
    nota: "R13: o SAC não vê valores",
  }),
  T("fechamentos", "Fechamentos", "/fechamentos", "Financeiro", [false, true, false], {
    nota: "R13: o SAC não vê valores",
  }),

  // ── Conta ─────────────────────────────────────────────────────────────────
  T("perfil", "Perfil", "/perfil", "Conta", [true, true, true], {
    sempre: true,
    nota: "é por onde se sai do app",
  }),

  // ── Administração ─────────────────────────────────────────────────────────
  T("gerencial.usuarios", "Usuários", "/gerencial/usuarios", "Administração", [false, false, false]),
  T("gerencial.permissoes", "Permissões", "/gerencial/permissoes", "Administração", [false, false, false]),
  T("admin", "Painel admin", "/admin", "Administração", [false, false, false]),
];

export const GRUPOS: string[] = Array.from(new Set(TELAS.map((t) => t.grupo)));

const PORCHAVE = new Map(TELAS.map((t) => [t.chave, t]));

export function telaPorChave(chave: string): Tela | undefined {
  return PORCHAVE.get(chave);
}

/**
 * A régua, num lugar só.
 *
 * `admin` sempre passa: é regra de sistema, não linha de tabela. Se estivesse
 * na matriz, um clique errado trancaria o admin fora da tela de permissões e
 * só o SQL Editor destrancaria.
 *
 * Sem linha no banco vale o padrão do catálogo — banco fora do ar ou tela
 * recém-criada não podem trancar ninguém para fora.
 */
export function podeAbrir(
  chave: string,
  cargo: string | null | undefined,
  matriz: Record<string, Record<string, boolean>> | undefined,
): boolean {
  if (cargo === "admin") return true;
  if (!cargo) return false;
  const tela = PORCHAVE.get(chave);
  if (!tela) return true;              // tela fora do catálogo não é bloqueada
  if (tela.sempre) return true;
  const doBanco = matriz?.[chave]?.[cargo];
  if (typeof doBanco === "boolean") return doBanco;
  return tela.padrao[cargo as PapelPermissao] ?? false;
}
