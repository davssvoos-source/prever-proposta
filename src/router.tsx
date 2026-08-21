import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { codigoDeErro, mensagemDeErro } from "./lib/erros";

/**
 * Erro de consulta e de gravação passa por AQUI antes de qualquer tela.
 *
 * É um lugar só para 133 chamadas de `toast.error` espalhadas: sem isto, dar
 * código de erro a cada uma seria editar 133 arquivos e esquecer o 134º. O
 * cache do React Query já vê todas as falhas — é o funil natural.
 *
 * O console recebe o MESMO código que a tela mostra. Quando o Davi manda o
 * print do código, o console do navegador dele tem a linha correspondente:
 * um código, os dois lados.
 */
function avisar(erro: unknown, contexto: string) {
  const caminho = typeof window !== "undefined" ? window.location.pathname : null;
  const codigo = codigoDeErro(erro, caminho);
  console.error(`[${codigo}] ${contexto}`, erro);
  // no servidor (SSR) não há toast: avisar ali gritaria numa sala vazia
  if (typeof window !== "undefined") {
    toast.error(mensagemDeErro(erro, caminho));
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (erro) => avisar(erro, "consulta"),
    }),
    mutationCache: new MutationCache({
      // Só o console: a mutação quase sempre tem `onError` próprio com uma
      // mensagem específica da ação ("não foi possível excluir a visita"), e
      // dois toasts para a mesma falha viram ruído. O código fica registrado
      // do mesmo jeito, que é o que importa depois.
      onError: (erro) => {
        const caminho = typeof window !== "undefined" ? window.location.pathname : null;
        console.error(`[${codigoDeErro(erro, caminho)}] gravação`, erro);
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
