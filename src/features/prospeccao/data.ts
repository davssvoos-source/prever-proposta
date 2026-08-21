// Prospecção — prédios e locais que orçamos e que NÃO são clientes (R22).
//
// A distinção que dá nome à tela: cliente vem do QAP e é leitura (R21);
// prospecção é nossa, é o funil comercial antes de existir contrato. Enquanto
// prospecto morava em `clientes` com situacao='prospecto', as duas coisas
// dividiam a mesma tabela — e o botão Sincronizar, quando existir, apagaria a
// prospecção junto. Por isso a tabela é separada (migration U27).
//
// As PROPOSTAS de cada prospecção não têm tabela própria: elas já vivem na
// visita técnica (`proposta_enviada_em`, `proposta_resultado`,
// `proposta_resultado_em`, `proposta_motivo_recusa`, colunas da U8). A tela lê
// as visitas da prospecção e mostra o histórico a partir delas.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRISMA } from "@/lib/paleta";

export type SituacaoProspeccao = "em_prospeccao" | "ganha" | "perdida";

export const SITUACAO_PROSPECCAO_LABEL: Record<SituacaoProspeccao, string> = {
  em_prospeccao: "Em prospecção",
  ganha: "Ganha",
  perdida: "Perdida",
};

/**
 * Cores do funil. "Ganha" é o amarelo principal — é o desfecho que a casa
 * persegue. "Perdida" usa o neutro, e não o vermelho: proposta recusada é
 * resultado normal do comercial, não erro nem alarme. O vermelho do sistema
 * significa "algo está errado", e aqui nada está.
 */
export const SITUACAO_PROSPECCAO_CORES: Record<SituacaoProspeccao, typeof PRISMA.amarelo> = {
  em_prospeccao: PRISMA.azulClaro,
  ganha: PRISMA.amarelo,
  perdida: PRISMA.neutro,
};

export interface Prospeccao {
  id: string;
  nome: string;
  tipo_local: string | null;
  endereco: string | null;
  complemento: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  nome_sindico: string | null;
  telefone_sindico: string | null;
  email_sindico: string | null;
  nome_zelador: string | null;
  telefone_zelador: string | null;
  email_zelador: string | null;
  foto_fachada_url: string | null;
  qtd_apartamentos: number | null;
  qtd_acessos: number | null;
  observacoes: string | null;
  situacao: SituacaoProspeccao;
  /** preenchido quando virou cliente e o cliente apareceu no QAP (de-para). */
  cliente_id: string | null;
  origem: string;
  created_at: string;
  updated_at: string;
}

/** Uma proposta gerada para a prospecção — na prática, uma visita técnica. */
export interface PropostaDaProspeccao {
  id: string;
  titulo: string;
  status: string;
  data_hora_agendada: string | null;
  proposta_enviada_em: string | null;
  proposta_resultado: string | null;
  proposta_resultado_em: string | null;
  proposta_motivo_recusa: string | null;
  created_at: string;
}

const CAMPOS =
  "id, nome, tipo_local, endereco, complemento, cidade, uf, cep, latitude, longitude, " +
  "nome_sindico, telefone_sindico, email_sindico, nome_zelador, telefone_zelador, " +
  "email_zelador, foto_fachada_url, qtd_apartamentos, qtd_acessos, observacoes, " +
  "situacao, cliente_id, origem, created_at, updated_at";

export function useProspeccoes() {
  return useQuery({
    queryKey: ["prospeccoes"],
    queryFn: async (): Promise<Prospeccao[]> => {
      const { data, error } = await supabase
        .from("prospeccoes" as any)
        .select(CAMPOS)
        .order("nome");
      if (error) throw error;
      return ((data as any[]) ?? []) as Prospeccao[];
    },
  });
}

/**
 * As propostas de TODAS as prospecções, agrupadas por prospeccao_id.
 *
 * Uma consulta só em vez de uma por linha: a tela mostra a contagem e a última
 * proposta em cada card, e N+1 consultas com ~70 prospecções deixariam a lista
 * lenta sem necessidade — são poucas linhas no total.
 */
export function usePropostasPorProspeccao() {
  return useQuery({
    queryKey: ["prospeccoes-propostas"],
    queryFn: async (): Promise<Record<string, PropostaDaProspeccao[]>> => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select(
          "id, titulo, status, data_hora_agendada, prospeccao_id, " +
          "proposta_enviada_em, proposta_resultado, proposta_resultado_em, " +
          "proposta_motivo_recusa, created_at",
        )
        .not("prospeccao_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const mapa: Record<string, PropostaDaProspeccao[]> = {};
      for (const v of ((data as any[]) ?? [])) {
        (mapa[v.prospeccao_id as string] ??= []).push(v as PropostaDaProspeccao);
      }
      return mapa;
    },
  });
}

/** O que aconteceu com a proposta, em uma frase — para o card não precisar de tabela. */
export function resumoDaProposta(p: PropostaDaProspeccao | undefined): string {
  if (!p) return "nenhuma proposta gerada";
  if (p.proposta_resultado === "aceita") return "proposta aceita";
  if (p.proposta_resultado === "recusada") {
    return p.proposta_motivo_recusa
      ? `recusada — ${p.proposta_motivo_recusa}`
      : "proposta recusada";
  }
  if (p.proposta_enviada_em) return "proposta enviada, aguardando resposta";
  return "visita registrada, proposta ainda não enviada";
}
