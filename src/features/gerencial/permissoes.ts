// Permissões de tela — leitura, gravação e a guarda de rota. Etapa U11.
//
// A matriz é pequena (21 telas × 3 papéis) e muda quase nunca, então vale a
// pena carregá-la inteira e decidir no cliente. O que NÃO se decide no cliente
// é o dado: a RLS continua sendo quem protege registro. Permissão de tela é
// navegação — impede de abrir, não substitui policy.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { podeAbrir, TELAS, type PapelPermissao } from "@/lib/telas";

/** tela → cargo → permitido */
export type Matriz = Record<string, Record<string, boolean>>;

export const CHAVE_MATRIZ = ["permissoes-tela"];

export function useMatrizPermissoes() {
  return useQuery({
    queryKey: CHAVE_MATRIZ,
    // muda quase nunca; recarregar a cada foco seria desperdício numa tela
    // que já dispara meia dúzia de consultas
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Matriz> => {
      const { data, error } = await supabase
        .from("permissoes_tela" as any)
        .select("tela, cargo, permitido");
      // erro devolve matriz vazia de propósito: aí valem os padrões do
      // catálogo, e o app se comporta como antes da U11 em vez de trancar
      // todo mundo para fora por causa de uma consulta que falhou
      if (error) return {};
      const m: Matriz = {};
      for (const r of ((data as any[]) ?? [])) {
        (m[r.tela as string] ??= {})[r.cargo as string] = !!r.permitido;
      }
      return m;
    },
  });
}

/** Meu cargo, para cruzar com a matriz. Compartilha chave com o resto do app. */
export function useMeuCargo() {
  return useQuery({
    queryKey: ["meu-cargo"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
      return ((data as any)?.cargo as string | null) ?? null;
    },
  });
}

/**
 * `podeVer("contratos")` na tela. Enquanto carrega devolve `undefined` —
 * quem chama decide se esconde ou espera. Devolver `false` durante o
 * carregamento faria o rodapé piscar itens sumindo.
 */
export function usePermissoes() {
  const { data: matriz, isLoading: l1 } = useMatrizPermissoes();
  const { data: cargo, isLoading: l2 } = useMeuCargo();
  const carregando = l1 || l2;
  return {
    cargo: cargo ?? null,
    carregando,
    podeVer: (chave: string): boolean | undefined =>
      carregando ? undefined : podeAbrir(chave, cargo, matriz),
  };
}

export interface LinhaPermissao {
  tela: string;
  cargo: PapelPermissao;
  permitido: boolean;
}

/** Grava a matriz inteira de uma vez — ver o comentário da RPC na migration. */
export async function salvarPermissoes(linhas: LinhaPermissao[]): Promise<number> {
  const { data, error } = await supabase.rpc("salvar_permissoes" as any, {
    _linhas: linhas,
  } as any);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export function useInvalidarPermissoes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: CHAVE_MATRIZ });
}

/**
 * A guarda de rota, num lugar só. Substitui os doze `beforeLoad` que repetiam
 * a mesma consulta e listavam cargos na mão.
 *
 * Consulta direta em vez de cache do React Query porque `beforeLoad` roda fora
 * do React — e é justamente onde não pode haver dúvida.
 */
export async function guardaDeTela(chave: string): Promise<{ ok: boolean; cargo: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, cargo: null };

  const { data: perfil } = await supabase
    .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
  const cargo = ((perfil as any)?.cargo as string | null) ?? null;
  if (cargo === "admin") return { ok: true, cargo };

  const { data, error } = await supabase
    .from("permissoes_tela" as any)
    .select("permitido")
    .eq("tela", chave)
    .eq("cargo", cargo ?? "")
    .maybeSingle();

  // sem linha, ou consulta falhou: vale o padrão do catálogo
  if (error || !data) return { ok: podeAbrir(chave, cargo, undefined), cargo };
  return { ok: !!(data as any).permitido, cargo };
}

/** Para onde mandar quem não pode entrar. */
export function destinoNegado(chave: string): string {
  // R31: a lista /chamados morreu — negado cai na Início, onde a fila mora.
  return "/dashboard";
}

/** Usado pela tela de permissões para montar o estado inicial. */
export function matrizCompleta(matriz: Matriz | undefined): Matriz {
  const m: Matriz = {};
  for (const t of TELAS) {
    m[t.chave] = {
      tecnico:   matriz?.[t.chave]?.tecnico   ?? t.padrao.tecnico,
      comercial: matriz?.[t.chave]?.comercial ?? t.padrao.comercial,
      sac:       matriz?.[t.chave]?.sac       ?? t.padrao.sac,
    };
  }
  return m;
}
