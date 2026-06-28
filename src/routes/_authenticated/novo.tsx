import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { TIPO_EMP_LABEL, CONTRATO_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/novo")({
  component: NovaProposta,
});

type ClienteForm = {
  modo: "novo" | "existente";
  cliente_id?: string;
  nome: string;
  tipo_empreendimento: string;
  email: string;
  telefone: string;
};

function NovaProposta() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [userId, setUserId] = useState<string>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const [cliente, setCliente] = useState<ClienteForm>({
    modo: "novo",
    nome: "",
    tipo_empreendimento: "condominio",
    email: "",
    telefone: "",
  });

  const [projeto, setProjeto] = useState({
    nome: "",
    data_visita: new Date().toISOString().slice(0, 10),
    tipo_contrato: "implantacao",
    valor_hora_hh: 120,
  });

  const [saving, setSaving] = useState(false);

  async function handleCriar() {
    if (!userId) return;
    setSaving(true);
    try {
      let clienteId = cliente.cliente_id;
      if (cliente.modo === "novo") {
        const { data: novo, error: ec } = await supabase
          .from("clientes")
          .insert({
            owner_id: userId,
            nome: cliente.nome,
            tipo_empreendimento: cliente.tipo_empreendimento,
            email: cliente.email || null,
            telefone: cliente.telefone || null,
          })
          .select("id")
          .single();
        if (ec) throw ec;
        clienteId = novo.id;
      }
      const { data: p, error: ep } = await supabase
        .from("projetos")
        .insert({
          owner_id: userId,
          cliente_id: clienteId,
          nome: projeto.nome,
          data_visita: projeto.data_visita,
          tipo_contrato: projeto.tipo_contrato,
          fornecimento: projeto.tipo_contrato !== "aproveitamento",
          valor_hora_hh: projeto.valor_hora_hh,
        })
        .select("id")
        .single();
      if (ep) throw ep;

      // Seed serviços padrão
      const { data: svcs } = await supabase.from("servicos").select("id, ativo_padrao");
      if (svcs && svcs.length) {
        await supabase.from("projeto_servicos").insert(
          svcs.map((s) => ({
            projeto_id: p.id,
            servico_id: s.id,
            ativo: !!s.ativo_padrao,
            quantidade: 0,
          })),
        );
      }
      toast.success("Proposta criada!");
      navigate({ to: "/projeto/$id", params: { id: p.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar proposta");
    } finally {
      setSaving(false);
    }
  }

  const canNext1 =
    cliente.modo === "existente" ? !!cliente.cliente_id : cliente.nome.trim().length > 1;
  const canCriar = projeto.nome.trim().length > 1 && projeto.valor_hora_hh > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nova Proposta</h1>
        <p className="text-sm text-muted-foreground">
          Etapa {step} de 2 — {step === 1 ? "Dados do cliente" : "Dados do projeto"}
        </p>
      </div>

      <div className="flex gap-1">
        <div className="h-1.5 flex-1 rounded-full bg-primary" />
        <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? "bg-primary" : "bg-muted"}`} />
      </div>

      {step === 1 ? (
        <Card className="space-y-4 p-5">
          <div className="flex gap-1 rounded-md bg-muted p-1">
            <button
              type="button"
              onClick={() => setCliente({ ...cliente, modo: "novo" })}
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
                cliente.modo === "novo" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              Novo cliente
            </button>
            <button
              type="button"
              onClick={() => setCliente({ ...cliente, modo: "existente" })}
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
                cliente.modo === "existente" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              Cliente existente
            </button>
          </div>

          {cliente.modo === "existente" ? (
            <div className="space-y-1.5">
              <Label>Selecione um cliente</Label>
              <Select
                value={cliente.cliente_id}
                onValueChange={(v) => setCliente({ ...cliente, cliente_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha..." />
                </SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Nome do cliente *</Label>
                <Input
                  value={cliente.nome}
                  onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                  placeholder="Ex.: Condomínio Jardim das Flores"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de empreendimento</Label>
                <Select
                  value={cliente.tipo_empreendimento}
                  onValueChange={(v) => setCliente({ ...cliente, tipo_empreendimento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_EMP_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={cliente.email}
                    onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={cliente.telefone}
                    onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              Cancelar
            </Button>
            <Button disabled={!canNext1} onClick={() => setStep(2)}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Nome do projeto *</Label>
            <Input
              value={projeto.nome}
              onChange={(e) => setProjeto({ ...projeto, nome: e.target.value })}
              placeholder="Ex.: Modernização Portaria + CFTV"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data da visita</Label>
              <Input
                type="date"
                value={projeto.data_visita}
                onChange={(e) => setProjeto({ ...projeto, data_visita: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor hora-homem (R$)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={projeto.valor_hora_hh}
                onChange={(e) =>
                  setProjeto({
                    ...projeto,
                    valor_hora_hh: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de contrato</Label>
            <Select
              value={projeto.tipo_contrato}
              onValueChange={(v) => setProjeto({ ...projeto, tipo_contrato: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTRATO_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {projeto.tipo_contrato === "implantacao"
                ? "Equipamentos + instalação + (opcional) manutenção."
                : projeto.tipo_contrato === "aproveitamento"
                  ? "Cliente já possui equipamentos — apenas instalação e manutenção."
                  : "Apenas contrato de manutenção mensal."}
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleCriar} disabled={!canCriar || saving}>
              {saving ? "Criando..." : "Criar proposta"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
