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
  // R31: a LISTA /chamados morreu — a Início entrega a fila. E os indicadores
  // de campo foram absorvidos pelo Painel Operacional. As duas chaves saíram
  // do catálogo; a U30 apaga as linhas delas no banco.
  T("chamados.novo", "Abrir chamado", "/chamados/novo", "Chamados", [false, true, true]),
  T("chamados.painel", "Painel de chamados", "/chamados/painel", "Chamados", [false, true, true]),
  T("chamados.programacao", "Programação das duplas", "/chamados/programacao", "Chamados", [false, true, true]),
  T("chamados.importar", "Importar do Notion", "/chamados/importar", "Chamados", [false, true, true]),

  // ── Painéis (R27) ─────────────────────────────────────────────────────────
  // "Gerencial" virou três. Os painéis são a PORTA de cada domínio: números do
  // estado + atalhos. As telas de trabalho continuam onde estavam.
  // U75/R95: virou "Operacional Técnica". A CHAVE e a ROTA não mudaram de
  // propósito — a chave é o que está gravado em `permissoes_tela`, e renomeá-la
  // invalidaria a linha de permissão de todo mundo (ver o comentário do tipo
  // `Tela`, acima). Só o rótulo mudou, e o painel passou a mostrar só a equipe
  // técnica: é o painel do Vinicius, não a fila de campo de todas as equipes.
  T("painel.operacional", "Painel Operacional Técnica", "/painel/operacional", "Painéis", [false, true, true], {
    nota: "fila da equipe TÉCNICA — quem coordena entra por aqui (R26/R95)",
  }),
  // "painel.comercial" não é mais uma tela: o Painel Comercial FUNDIU com a
  // lista de visitas e propostas (R32) — a chave viva é "gerencial", abaixo.
  // /painel/comercial só redireciona; a U30 apaga a linha órfã no banco.
  T("painel.administrativo", "Painel Administrativo", "/painel/administrativo", "Painéis", [false, false, false], {
    nota: "gente, permissão e financeiro — na prática, só o admin",
  }),

  // ── Comercial ─────────────────────────────────────────────────────────────
  // R32: a lista de visitas É o Painel Comercial — não há porta e sala
  // separadas. O SAC entra porque agenda a visita de proposta (R24 tipo 1);
  // o acesso que ele tinha ao painel seguiu o painel para cá (U30).
  T("gerencial", "Painel Comercial", "/gerencial", "Comercial", [false, true, true], {
    nota: "visitas e propostas + funil — a página do domínio comercial",
  }),
  T("gerencial.nova", "Nova visita", "/gerencial/nova", "Comercial", [false, true, true], {
    nota: "o SAC chega aqui pelo trilho de proposta da triagem",
  }),
  // R38: "prospeccao" não é mais uma tela — virou ABA de /gerencial, que já
  // tem exatamente a mesma permissão ([false, true, true]). /prospeccao só
  // redireciona; a U34 apaga a linha órfã no banco.
  T("historico", "Histórico", "/historico", "Comercial", [true, true, true]),
  T("mapa", "Mapa", "/mapa", "Comercial", [true, true, true]),

  // ── Clientes ──────────────────────────────────────────────────────────────
  // U24: o Davi definiu quem vê a base — admin, comercial e SAC. O técnico
  // chega no cliente pelo chamado dele (detalhe não é gateado), não pela base.
  T("clientes", "Clientes", "/clientes", "Clientes", [false, true, true]),
  // R21: o app não cria nem consolida cliente. As chaves ficam no catálogo
  // (a semente do banco as tem, e o verificador compara os dois) mas negadas
  // para todos; as rotas redirecionam para /clientes.
  T("clientes.novo", "Novo cliente (desativado)", "/clientes/novo", "Clientes", [false, false, false], {
    nota: "R21 — cliente vem do QAP; criar à mão saiu do app",
  }),
  T("clientes.migrar", "Consolidar cadastros (desativado)", "/clientes/migrar", "Clientes", [false, false, false], {
    nota: "R21 — consolidar criava e apagava cliente; duplicata resolve-se no QAP",
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
