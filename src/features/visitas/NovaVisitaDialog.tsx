import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

async function geocode(endereco: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      endereco,
    )}`;
    const r = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    const arr = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch {
    return null;
  }
}

export function NovaVisitaDialog({ children }: { children?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    cliente_id: "",
    endereco: "",
    complemento: "",
    data: "",
    hora: "",
    descricao: "",
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const dataHora = new Date(`${form.data}T${form.hora || "09:00"}`).toISOString();
      const geo = await geocode(form.endereco);
      const { error } = await supabase.from("visitas_tecnicas").insert({
        titulo: form.titulo,
        cliente_id: form.cliente_id || null,
        endereco: form.endereco,
        complemento: form.complemento || null,
        descricao_pedido: form.descricao || null,
        data_hora_agendada: dataHora,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
        tecnico_id: u.user.id,
        created_by: u.user.id,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visita agendada");
      qc.invalidateQueries({ queryKey: ["visitas"] });
      setOpen(false);
      setForm({
        titulo: "",
        cliente_id: "",
        endereco: "",
        complemento: "",
        data: "",
        hora: "",
        descricao: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children ?? <Button>+ Agendar visita</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar visita técnica</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Título *</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Levantamento CFTV"
            />
          </div>
          <div>
            <Label>Cliente</Label>
            <Select
              value={form.cliente_id}
              onValueChange={(v) => setForm({ ...form, cliente_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
          <div>
            <Label>Endereço *</Label>
            <Input
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>
          <div>
            <Label>Complemento</Label>
            <Input
              value={form.complemento}
              onChange={(e) => setForm({ ...form, complemento: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
            <div>
              <Label>Hora *</Label>
              <Input
                type="time"
                value={form.hora}
                onChange={(e) => setForm({ ...form, hora: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Descrição do pedido</Label>
            <Textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              !form.titulo || !form.endereco || !form.data || mutation.isPending
            }
          >
            {mutation.isPending ? "Salvando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
