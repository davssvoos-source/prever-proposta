import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Copy,
  ExternalLink,
  ImagePlus,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  Square,
  X,
  Check,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useUserRoles } from "@/lib/auth";
import {
  fetchFotosVisita,
  fetchProfile,
  fetchVisita,
  getSignedPhotoUrl,
} from "@/features/visitas/data";
import {
  formatDataHoraLong,
  formatDuracao,
  formatRelativeFuture,
  STATUS_VISITA,
  type VisitaStatus,
} from "@/features/visitas/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id")({
  component: VisitaDetail,
});

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function VisitaDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const roles = useUserRoles(user?.id);
  const isAdmin = roles.includes("admin");

  const { data: visita, isLoading } = useQuery({
    queryKey: ["visita", id],
    queryFn: () => fetchVisita(id),
  });
  const { data: tec } = useQuery({
    queryKey: ["profile", visita?.tecnico_id],
    queryFn: () => fetchProfile(visita!.tecnico_id!),
    enabled: !!visita?.tecnico_id,
  });
  const { data: aprov } = useQuery({
    queryKey: ["profile", visita?.aprovado_por],
    queryFn: () => fetchProfile(visita!.aprovado_por!),
    enabled: !!visita?.aprovado_por,
  });
  const { data: fotos } = useQuery({
    queryKey: ["fotos", id],
    queryFn: () => fetchFotosVisita(id),
  });

  // signed urls for photos
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    (fotos ?? []).forEach(async (f) => {
      if (photoUrls[f.id]) return;
      if (f.storage_path) {
        const url = await getSignedPhotoUrl(f.storage_path);
        setPhotoUrls((p) => ({ ...p, [f.id]: url || f.url }));
      } else {
        setPhotoUrls((p) => ({ ...p, [f.id]: f.url }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos]);

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<{
      status: VisitaStatus;
      data_hora_inicio: string;
      data_hora_fim: string;
      aprovado_por: string;
      aprovado_em: string;
      motivo_reprovacao: string;
      notas_visita: string;
      equipamentos_vistos: string;
    }>) => {
      const { error } = await supabase.from("visitas_tecnicas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["visitas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (visita?.status === "pendente") {
      const t = setInterval(() => setTick((x) => x + 1), 60_000);
      return () => clearInterval(t);
    }
  }, [visita?.status]);

  const status = visita?.status as VisitaStatus | undefined;
  const sInfo = status ? STATUS_VISITA[status] : null;
  const isFuture = status === "pendente" && !visita?.data_hora_inicio;
  const canEdit = status !== "aprovado";

  const [notas, setNotas] = useState("");
  const [equip, setEquip] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  useEffect(() => {
    if (visita) {
      setNotas(visita.notas_visita ?? "");
      setEquip(visita.equipamentos_vistos ?? "");
    }
  }, [visita]);

  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("fotos-visitas")
        .upload(path, file, { cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("fotos-visitas")
        .createSignedUrl(path, 3600);
      const { error } = await supabase.from("fotos_visita").insert({
        visita_id: id,
        url: signed?.signedUrl ?? "",
        storage_path: path,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto enviada");
      qc.invalidateQueries({ queryKey: ["fotos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mapUrl = useMemo(() => {
    if (visita?.latitude && visita?.longitude) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=${visita.longitude - 0.01}%2C${visita.latitude - 0.01}%2C${visita.longitude + 0.01}%2C${visita.latitude + 0.01}&layer=mapnik&marker=${visita.latitude}%2C${visita.longitude}`;
    }
    return null;
  }, [visita]);

  if (isLoading || !visita) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold">Visita Técnica</h1>
        {sInfo && (
          <Badge style={{ background: sInfo.bg, color: sInfo.color, border: `1px solid ${sInfo.color}55` }}>
            {sInfo.label}
          </Badge>
        )}
        {!isFuture && canEdit && (
          <Button size="icon" variant="ghost">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Data e Horário */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Data e horário
        </div>
        <div className="text-sm font-medium capitalize">
          {formatDataHoraLong(visita.data_hora_agendada)}
        </div>
        {isFuture && (
          <div className="mt-1 text-xs font-medium text-primary" key={tick}>
            {formatRelativeFuture(visita.data_hora_agendada)}
          </div>
        )}
        {!isFuture && visita.data_hora_inicio && (
          <div className="mt-2 text-xs text-muted-foreground">
            Início: {new Date(visita.data_hora_inicio).toLocaleString("pt-BR")}
            {visita.data_hora_fim && (
              <>
                {" "}· Fim: {new Date(visita.data_hora_fim).toLocaleString("pt-BR")}
              </>
            )}
            <div>Duração: {formatDuracao(visita.data_hora_inicio, visita.data_hora_fim)}</div>
          </div>
        )}
      </Card>

      {/* Local */}
      <Card className="overflow-hidden">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-4 w-4" /> Local
          </div>
          <div className="text-sm">{visita.endereco}</div>
          {visita.complemento && (
            <div className="text-xs text-muted-foreground">{visita.complemento}</div>
          )}
        </div>
        {mapUrl && (
          <iframe
            title="Mapa"
            src={mapUrl}
            className="h-48 w-full border-y"
            loading="lazy"
          />
        )}
        <div className="flex gap-2 p-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              navigator.clipboard.writeText(visita.endereco);
              toast.success("Endereço copiado");
            }}
          >
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            asChild
          >
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visita.endereco)}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" /> Maps
            </a>
          </Button>
        </div>
      </Card>

      {/* Cliente */}
      {visita.cliente && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente
          </div>
          <div className="text-sm font-semibold">{visita.cliente.nome}</div>
          {visita.cliente.tipo_empreendimento && (
            <div className="text-xs text-muted-foreground capitalize">
              {visita.cliente.tipo_empreendimento}
            </div>
          )}
          {visita.cliente.telefone && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" asChild>
                <a href={`tel:${visita.cliente.telefone}`}>
                  <Phone className="h-4 w-4" /> Ligar
                </a>
              </Button>
              <Button size="sm" variant="outline" className="flex-1" asChild>
                <a
                  href={`https://wa.me/${visita.cliente.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Descrição */}
      {visita.descricao_pedido && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Descrição do pedido
          </div>
          <p className="whitespace-pre-wrap text-sm">{visita.descricao_pedido}</p>
        </Card>
      )}

      {/* Técnico */}
      {tec && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Técnico responsável
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials(tec.nome ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-semibold">{tec.nome}</div>
              <div className="text-xs text-muted-foreground capitalize">{tec.cargo ?? "—"}</div>
            </div>
          </div>
          {user?.id === visita.tecnico_id && (
            <p className="mt-2 text-xs font-medium text-primary">
              Você é o responsável por esta visita
            </p>
          )}
        </Card>
      )}

      {/* Aprovação */}
      {(visita.status === "aguardando_aprovacao" || visita.status === "aprovado") && (
        <Card className="p-4">
          {visita.status === "aprovado" && (
            <div className="rounded-md bg-success/10 p-3 text-sm text-success">
              ✅ Aprovada {aprov?.nome ? `por ${aprov.nome}` : ""}
              {visita.aprovado_em
                ? ` em ${new Date(visita.aprovado_em).toLocaleDateString("pt-BR")}`
                : ""}
            </div>
          )}
          {visita.status === "aguardando_aprovacao" && (
            <div className="rounded-md bg-accent/30 p-3 text-sm">
              🕐 Visita concluída — aguardando aprovação do gerente
            </div>
          )}
          {isAdmin && visita.status === "aguardando_aprovacao" && (
            <div className="mt-3">
              <Button
                size="sm"
                className="w-full"
                onClick={() =>
                  updateMutation.mutate({
                    status: "aprovado",
                    aprovado_por: user?.id,
                    aprovado_em: new Date().toISOString(),
                  })
                }
              >
                <Check className="h-4 w-4" /> Aprovar Visita
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Notas */}
      {!isFuture && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notas da visita
            </div>
            {canEdit && !editingNotes && (
              <Button size="sm" variant="ghost" onClick={() => setEditingNotes(true)}>
                Editar
              </Button>
            )}
          </div>
          {editingNotes ? (
            <>
              <Textarea
                rows={4}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Anotações da visita..."
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await updateMutation.mutateAsync({ notas_visita: notas });
                    setEditingNotes(false);
                    toast.success("Notas atualizadas");
                  }}
                >
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {visita.notas_visita || "Nenhuma nota registrada."}
            </p>
          )}
        </Card>
      )}

      {/* Equipamentos */}
      {!isFuture && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Equipamentos observados
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateMutation.mutate({ equipamentos_vistos: equip })}
              >
                Salvar
              </Button>
            )}
          </div>
          <Textarea
            rows={3}
            value={equip}
            onChange={(e) => setEquip(e.target.value)}
            disabled={!canEdit}
            placeholder="Equipamentos identificados..."
          />
        </Card>
      )}

      {/* Fotos */}
      {!isFuture && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fotos registradas
            </div>
            {canEdit && (
              <>
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto.mutate(f);
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> Adicionar
                </Button>
              </>
            )}
          </div>
          {(fotos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma foto registrada.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(fotos ?? []).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLightbox(photoUrls[f.id] || f.url)}
                  className="aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  {photoUrls[f.id] ? (
                    <img
                      src={photoUrls[f.id]}
                      alt={f.legenda ?? "Foto"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Skeleton className="h-full w-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* CTAs fixos no rodapé */}
      {visita.status === "pendente" && user?.id === visita.tecnico_id && !visita.data_hora_inicio && (
        <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-background p-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="h-12 w-full text-base font-semibold btn-pulse-gold"
              >
                <Play className="h-5 w-5" /> Iniciar Visita
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Iniciar visita?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso registra o início da visita técnica neste momento.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await updateMutation.mutateAsync({
                      data_hora_inicio: new Date().toISOString(),
                    });
                    navigate({ to: "/visita/$id/orcamento", params: { id } });
                  }}
                >
                  Iniciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      {visita.status === "pendente" && user?.id === visita.tecnico_id && visita.data_hora_inicio && (
        <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-background p-3">
          <Button
            className="h-12 w-full text-base font-semibold"
            style={{ backgroundColor: "rgba(96,165,250,0.10)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.30)" }}
            onClick={() =>
              updateMutation.mutate({
                status: "aguardando_aprovacao",
                data_hora_fim: new Date().toISOString(),
              })
            }
          >
            <Square className="h-5 w-5" /> Finalizar Visita
          </Button>
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightbox && <img src={lightbox} alt="Foto" className="h-auto w-full rounded" />}
        </DialogContent>
      </Dialog>

      <div className="text-center">
        <Link to="/dashboard" className="text-xs text-muted-foreground">
          ← Voltar para o início
        </Link>
      </div>
    </div>
  );
}
