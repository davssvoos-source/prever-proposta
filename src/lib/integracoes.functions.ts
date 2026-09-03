// AS INTEGRAÇÕES COM TERCEIROS — o que está ligado, o que falta, o que é plano.
// R129/R131, U94.
//
// ── O QUE ESTA FUNÇÃO DEVOLVE, E O QUE ELA NUNCA DEVOLVE ──────────────────
// Devolve, para cada integração que o sistema usa ou vai usar, SE a credencial
// está configurada no servidor — um booleano. Nunca a credencial: o segredo
// mora em variável de ambiente do servidor (`ANTHROPIC_API_KEY`, `SITE_URL`),
// como a `geocodificarEndereco` e a `enviarConvite` já fazem, e a aba APIs do
// Administrativo só precisa saber "está ligado?" para o admin não descobrir a
// chave que falta pelo erro de produção.
//
// É uma server function POR ISSO: `process.env` não existe no navegador, e
// mesmo que existisse, expor a presença/ausência de uma chave é o máximo que se
// pode mostrar a quem está logado — e só a quem está logado (`requireSupabaseAuth`).
//
// ── O QAP ENTRA COMO PLANEJADO, NÃO COMO CONFIGURADO ──────────────────────
// O conector do QAP ERP é a Fase E do `docs/PLANO_V0.1.md` e ainda não existe.
// Listá-lo aqui como "planejado", com o que falta (documentação e credenciais —
// Q7), é o que faz a aba APIs dizer a verdade hoje e ser o lugar certo amanhã.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SituacaoIntegracao = "configurada" | "sem_chave" | "planejada";

export interface StatusIntegracao {
  chave: string;
  nome: string;
  /** para que o sistema a usa, em uma frase */
  uso: string;
  /** de onde para onde o dado vai — o sentido importa para o QAP (R129) */
  sentido: string;
  situacao: SituacaoIntegracao;
  /** o que falta, ou onde a chave mora — nunca o valor */
  nota: string;
}

export const statusDasIntegracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<StatusIntegracao[]> => {
    const temAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const temSiteUrl = !!process.env.SITE_URL;
    return [
      {
        chave: "anthropic",
        nome: "Claude (Anthropic)",
        uso: "Leitura de contratos em PDF, triagem do chamado rápido e resumos da proposta.",
        sentido: "O app envia o texto e recebe a interpretação; nada é gravado sem uma pessoa conferir.",
        situacao: temAnthropic ? "configurada" : "sem_chave",
        nota: temAnthropic
          ? "Chave ANTHROPIC_API_KEY presente no servidor."
          : "Falta a variável ANTHROPIC_API_KEY no servidor — a leitura de contrato e a triagem por I.A. falham até ela existir.",
      },
      {
        chave: "qap",
        nome: "QAP ERP",
        uso: "Clientes (CNPJ, razão social, nome fantasia, endereço) e equipamentos instalados em cada cliente.",
        sentido: "SÓ RECEBE: o app puxa do QAP e nunca escreve nele (R129).",
        situacao: "planejada",
        nota: "Fase E do plano da v0.1 — aguarda a documentação e as credenciais da API do QAP (Q7). Até lá a base vem por planilha.",
      },
      {
        chave: "nominatim",
        nome: "OpenStreetMap Nominatim",
        uso: "Geocodificação do endereço do cliente, um gesto humano por vez (R114).",
        sentido: "O app envia o endereço e recebe a coordenada para alguém conferir.",
        situacao: "configurada",
        nota: "Serviço público, sem chave — identificado pelo User-Agent com o e-mail de contato.",
      },
      {
        chave: "convites",
        nome: "E-mail de convite (Supabase Auth)",
        uso: "Convite e primeiro acesso de usuário novo.",
        sentido: "O app pede ao Supabase que envie o e-mail com o link de entrada.",
        situacao: temSiteUrl ? "configurada" : "sem_chave",
        nota: temSiteUrl
          ? "SITE_URL presente — o link do convite aponta para o endereço certo."
          : "Falta SITE_URL no servidor — o link do convite pode apontar para o endereço errado.",
      },
    ];
  });
