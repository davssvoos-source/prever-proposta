// Cadastro de um novo cliente — Etapa 1 do sistema de OS. Só gestores.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela } from "@/features/gerencial/permissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { ClienteForm } from "@/features/clientes/ClienteForm";
import { criarCliente, type ClientePatch } from "@/features/clientes/data";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    // a matriz manda, não uma lista de cargos escrita na mão: a U24 liberou
    // Clientes para o SAC e a lista hardcoded o barrava em silêncio
    const { ok } = await guardaDeTela("clientes.novo");
    if (!ok) throw redirect({ to: "/clientes" });
  },
  component: NovoClientePage,
});

function NovoClientePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";

  const criar = useMutation({
    mutationFn: (patch: ClientePatch) => criarCliente(patch),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente cadastrado!");
      navigate({ to: "/clientes/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/clientes" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18 }}>Novo cliente</div>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            Condomínio, empresa ou residência atendida
          </div>
        </div>
      </div>

      <ClienteForm
        salvando={criar.isPending}
        onSubmit={(patch) => criar.mutate(patch)}
        onCancelar={() => navigate({ to: "/clientes" })}
        rotuloAcao="Cadastrar cliente"
      />
    </div>
  );
}
