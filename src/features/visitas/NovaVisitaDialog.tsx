import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { geocode } from "@/features/gerencial/data";
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

// A CÓPIA INLINE DE `geocode` FOI APAGADA AQUI (U84) — era a segunda de quatro,
// byte a byte igual à de features/gerencial/data.ts. Agora importa a única.
//
// ── E A CHAMADA SILENCIOSA DENTRO DO SAVE TAMBÉM SAIU ─────────────────────
// Esta tela geocodificava DENTRO da mutação de gravar: a pessoa digitava o
// endereço, clicava em "Agendar visita", e uma coordenada que NINGUÉM VIU era
// escrita em `visitas_tecnicas.latitude/longitude` — que vira
// `clientes.latitude/longitude` por `consolidarGrupo`, ou seja, entra no
// CADASTRO MESTRE e passa a ser o lugar do cliente no mapa de clientes. O campo
// é uma linha de texto livre, e texto livre é como se erra de cidade: a rua
// homônima de outro município entrava no cadastro sem que existisse um instante
// em que alguém pudesse dizer "não é esse lugar". O diálogo fecha no sucesso —
// não havia nem onde mostrar.
//
// Agora é o mesmo gesto das outras três telas: um botão "Localizar", o
// endereço RESOLVIDO impresso para conferência, e a gravação usa o que foi
// conferido. Sem o clique, a visita nasce SEM coordenada — que é o estado
// visível (o mapa da ficha não desenha), e não o estado plausível e errado.
export function NovaVisitaDialog({ children }: { children?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvido, setResolvido] = useState<string | null>(null);
  const [localizando, setLocalizando] = useState(false);
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
    queryKey: ["clientes-min"],
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
      // NADA DE GEOCODIFICAR AQUI. Ver o comentário no topo: a coordenada é a
      // que o botão "Localizar" trouxe e a pessoa conferiu, ou nenhuma.
      const geo = coords;
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
      setCoords(null);
      setResolvido(null);
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
            <div className="flex gap-2">
              {/* TRAVADO ENQUANTO A BUSCA ESTÁ NO AR: editar o texto durante a
                  requisição deixaria a resposta do endereço ANTIGO chegar
                  depois e reescrever `resolvido`/`coords` por cima do NOVO — a
                  mesma coordenada errada de sempre, agora por CORRIDA. */}
              <Input
                value={form.endereco}
                disabled={localizando}
                onChange={(e) => {
                  setForm({ ...form, endereco: e.target.value });
                  // Mexeu no endereço, a conferência anterior deixou de valer.
                  setCoords(null);
                  setResolvido(null);
                }}
                placeholder="Rua, número, bairro, cidade"
              />
              <Button
                type="button"
                variant="outline"
                disabled={localizando || !form.endereco.trim()}
                onClick={async () => {
                  setLocalizando(true);
                  const g = await geocode(form.endereco.trim());
                  setLocalizando(false);
                  if (g) {
                    setCoords({ lat: g.lat, lng: g.lng });
                    setResolvido(
                      g.display_name || [g.bairro, g.cidade, g.uf].filter(Boolean).join(", ") || null,
                    );
                  } else {
                    setResolvido(null);
                    toast.error(
                      // A CASCA `geocode()` COLAPSA "não achei" e "o serviço recusou" no
                      // mesmo `null` — o SERVIDOR distingue os dois (`nao_encontrado` ×
                      // `servico_falhou`) e a casca de gerencial/data.ts apaga a diferença.
                      // Enquanto ela apagar, esta frase NÃO PODE afirmar que o endereço não
                      // existe: o bloqueio do Nominatim é por IP e cai sobre a operação
                      // inteira, e "este endereço não existe" é a única frase do sistema que
                      // instrui a pessoa a martelar o serviço que acabou de bloqueá-la.
                      "Não achei este endereço. Confira o texto (bairro e cidade ajudam) — e, se ele está certo, o serviço de mapas pode ter recusado agora: repetir na mesma hora não adianta.",
                    );
                  }
                }}
              >
                Localizar
              </Button>
            </div>
            {/* O NOME DO LUGAR, NÃO A COORDENADA. É a única rede contra "o mapa
                achou a rua homônima em outra cidade" — e sem ela a coordenada
                errada ficava PERMANENTE, porque nada mais no sistema a
                reconfere. */}
            {resolvido && (
              <p className="mt-1 text-xs text-muted-foreground">
                O mapa entendeu: <b>{resolvido}</b> — se não é este o lugar, corrija o endereço
                (inclua bairro e cidade) e localize de novo.
              </p>
            )}
            {!resolvido && (
              <p className="mt-1 text-xs text-muted-foreground">
                Sem “Localizar”, a visita nasce sem coordenada — o endereço fica gravado, e o mapa
                da ficha só aparece depois que alguém conferir o lugar.
              </p>
            )}
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
