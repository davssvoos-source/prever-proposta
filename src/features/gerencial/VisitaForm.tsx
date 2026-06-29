import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, MessageCircle, AlertTriangle, Phone, Calendar, HardHat, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORIDADES,
  PRIORIDADE_BORDER,
  PRIORIDADE_COLOR,
  PRIORIDADE_LABEL,
  SERVICOS,
  SERVICO_ICON,
  SERVICO_LABEL,
  TIPOS_LOCAL,
  TIPO_ICON,
  TIPO_LABEL,
  formatPhoneBR,
  whatsappLink,
} from "./constants";
import { geocode, useTecnicos, useVisitasGerencial } from "./data";

export type VisitaFormInitial = {
  id?: string;
  nome_predio?: string | null;
  tipo_local?: string | null;
  nome_sindico?: string | null;
  contato_sindico?: string | null;
  servico_solicitado?: string | null;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  obs_agendamento?: string | null;
  data_hora_agendada?: string | null;
  tecnico_id?: string | null;
  prioridade?: string | null;
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function toDateTimeFields(iso?: string | null): { data: string; hora: string } {
  if (!iso) return { data: "", hora: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function VisitaForm({ initial }: { initial?: VisitaFormInitial }) {
  const editing = !!initial?.id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: tecnicos } = useTecnicos();
  const { data: visitasAll } = useVisitasGerencial();

  const initialDT = toDateTimeFields(initial?.data_hora_agendada);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    nome_predio: initial?.nome_predio ?? "",
    tipo_local: initial?.tipo_local ?? "",
    nome_sindico: initial?.nome_sindico ?? "",
    contato_sindico: initial?.contato_sindico ?? "",
    servico_solicitado: initial?.servico_solicitado ?? "",
    endereco: initial?.endereco ?? "",
    obs_agendamento: initial?.obs_agendamento ?? "",
    data: initialDT.data,
    hora: initialDT.hora,
    tecnico_id: initial?.tecnico_id ?? "",
    prioridade: (initial?.prioridade ?? "normal") as string,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.latitude && initial?.longitude
      ? { lat: initial.latitude, lng: initial.longitude }
      : null,
  );
  const [geocoding, setGeocoding] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleGeocode() {
    if (!form.endereco.trim()) return;
    setGeocoding(true);
    const g = await geocode(form.endereco);
    setGeocoding(false);
    if (g) setCoords(g);
    else toast.error("Endereço não localizado");
  }

  const step1Valid =
    form.nome_predio.trim() &&
    form.tipo_local &&
    form.nome_sindico.trim() &&
    form.contato_sindico.replace(/\D/g, "").length >= 10 &&
    form.servico_solicitado &&
    form.endereco.trim();

  const step2Valid = form.data && form.hora;

  const dataHoraISO = useMemo(() => {
    if (!form.data || !form.hora) return null;
    return new Date(`${form.data}T${form.hora}`).toISOString();
  }, [form.data, form.hora]);

  const isPast = dataHoraISO ? new Date(dataHoraISO).getTime() < Date.now() : false;

  // Agenda da semana do técnico selecionado
  const tecnicoAgendaSemana = useMemo(() => {
    if (!form.tecnico_id || !visitasAll) return [];
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return visitasAll
      .filter(
        (v) =>
          v.tecnico_id === form.tecnico_id &&
          v.id !== initial?.id &&
          new Date(v.data_hora_agendada) >= now &&
          new Date(v.data_hora_agendada) <= weekEnd,
      )
      .sort(
        (a, b) =>
          new Date(a.data_hora_agendada).getTime() - new Date(b.data_hora_agendada).getTime(),
      );
  }, [form.tecnico_id, visitasAll, initial?.id]);

  const conflito = useMemo(() => {
    if (!dataHoraISO) return false;
    const t = new Date(dataHoraISO).getTime();
    return tecnicoAgendaSemana.some(
      (v) => Math.abs(new Date(v.data_hora_agendada).getTime() - t) < 60 * 60 * 1000,
    );
  }, [dataHoraISO, tecnicoAgendaSemana]);

  const visitasPorTecnico = useMemo(() => {
    const m = new Map<string, number>();
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    (visitasAll ?? []).forEach((v) => {
      if (!v.tecnico_id) return;
      const d = new Date(v.data_hora_agendada);
      if (d >= now && d <= weekEnd) m.set(v.tecnico_id, (m.get(v.tecnico_id) ?? 0) + 1);
    });
    return m;
  }, [visitasAll]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      if (!dataHoraISO) throw new Error("Data inválida");

      let geo = coords;
      if (!geo && form.endereco) geo = await geocode(form.endereco);

      const payload = {
        titulo: `${SERVICO_LABEL[form.servico_solicitado] ?? "Visita"} — ${form.nome_predio}`,
        nome_predio: form.nome_predio,
        tipo_local: form.tipo_local,
        nome_sindico: form.nome_sindico,
        contato_sindico: form.contato_sindico,
        servico_solicitado: form.servico_solicitado,
        endereco: form.endereco,
        obs_agendamento: form.obs_agendamento || null,
        descricao_pedido: form.obs_agendamento || null,
        data_hora_agendada: dataHoraISO,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
        tecnico_id: form.tecnico_id || null,
        prioridade: form.prioridade,
      };

      if (editing && initial?.id) {
        const { error } = await supabase
          .from("visitas_tecnicas")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
        return initial.id;
      }
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .insert({ ...payload, created_by: u.user.id, status: "pendente" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      const tecNome = tecnicos?.find((t) => t.id === form.tecnico_id)?.nome ?? "sem técnico";
      toast.success(
        editing
          ? "✅ Visita atualizada"
          : `✅ Visita agendada! ${form.tecnico_id ? `${tecNome} será notificado.` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["visitas-gerencial"] });
      qc.invalidateQueries({ queryKey: ["visitas"] });
      navigate({ to: "/gerencial" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!form.endereco || coords) return;
  }, [form.endereco, coords]);

  const tecnicoSel = tecnicos?.find((t) => t.id === form.tecnico_id);

  return (
    <div className="space-y-5">
      <Stepper step={step} />

      {step === 1 && (
        <Card className="p-5 space-y-5">
          <div>
            <Label>Nome do Prédio / Empresa *</Label>
            <Input
              value={form.nome_predio}
              onChange={(e) => set("nome_predio", e.target.value)}
              placeholder="Ex: Edifício Jardins, Empresa XYZ"
            />
          </div>

          <div>
            <Label>Tipo de Local *</Label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {TIPOS_LOCAL.map((t) => {
                const active = form.tipo_local === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("tipo_local", t)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition-all"
                    style={{
                      background: active ? "rgba(255,192,0,0.10)" : "rgba(255,255,255,0.02)",
                      border: active
                        ? "1px solid rgba(255,192,0,0.6)"
                        : "1px solid rgba(255,255,255,0.06)",
                      minHeight: 92,
                    }}
                  >
                    <span className="text-2xl">{TIPO_ICON[t]}</span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: active ? "#FFC000" : "#F5F5F5" }}
                    >
                      {TIPO_LABEL[t]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Nome do Síndico / Responsável *</Label>
            <Input
              value={form.nome_sindico}
              onChange={(e) => set("nome_sindico", e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div>
            <Label>Contato *</Label>
            <div className="flex gap-2">
              <Input
                value={form.contato_sindico}
                onChange={(e) => set("contato_sindico", formatPhoneBR(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
              <Button
                type="button"
                variant="outline"
                disabled={form.contato_sindico.replace(/\D/g, "").length < 10}
                onClick={() => window.open(whatsappLink(form.contato_sindico), "_blank")}
                aria-label="Abrir WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Serviço Solicitado *</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICOS.map((s) => {
                const active = form.servico_solicitado === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("servico_solicitado", s)}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background: active ? "rgba(255,192,0,0.15)" : "rgba(255,255,255,0.04)",
                      border: active
                        ? "1px solid rgba(255,192,0,0.7)"
                        : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#FFC000" : "#F5F5F5",
                    }}
                  >
                    <span>{SERVICO_ICON[s]}</span>
                    <span>{SERVICO_LABEL[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Endereço *</Label>
            <Input
              value={form.endereco}
              onChange={(e) => set("endereco", e.target.value)}
              onBlur={handleGeocode}
              placeholder="Rua, número, bairro, cidade"
            />
            {geocoding && (
              <p className="mt-1 text-xs text-muted-foreground">Localizando endereço…</p>
            )}
            {coords && (
              <div className="mt-2 overflow-hidden rounded-lg border border-[rgba(255,192,0,0.2)]">
                <iframe
                  title="Mini mapa"
                  className="h-40 w-full"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.003}%2C${coords.lat - 0.002}%2C${coords.lng + 0.003}%2C${coords.lat + 0.002}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                />
              </div>
            )}
          </div>

          <div>
            <Label>Observações do Agendamento</Label>
            <Textarea
              rows={3}
              value={form.obs_agendamento}
              onChange={(e) => set("obs_agendamento", e.target.value)}
              placeholder="Informações adicionais para o técnico..."
            />
          </div>

          <div className="flex justify-end">
            <Button disabled={!step1Valid} onClick={() => setStep(2)}>
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5 space-y-5">
          <div>
            <Label>Data e Horário *</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
              <Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <QuickDate
                label="Amanhã manhã (09:00)"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  set("data", d.toISOString().slice(0, 10));
                  set("hora", "09:00");
                }}
              />
              <QuickDate
                label="Amanhã tarde (14:00)"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  set("data", d.toISOString().slice(0, 10));
                  set("hora", "14:00");
                }}
              />
              <QuickDate
                label="Próxima semana"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  set("data", d.toISOString().slice(0, 10));
                  set("hora", "09:00");
                }}
              />
            </div>
            {isPast && (
              <p className="mt-2 text-xs font-medium text-red-400">
                ⚠ Data/hora no passado
              </p>
            )}
          </div>

          <div>
            <Label>Técnico Responsável *</Label>
            <Select value={form.tecnico_id || "none"} onValueChange={(v) => set("tecnico_id", v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem técnico definido —</SelectItem>
                {(tecnicos ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} · {visitasPorTecnico.get(t.id) ?? 0} visitas/semana
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {tecnicoSel && (
              <div className="mt-3 rounded-lg border border-[rgba(255,192,0,0.12)] bg-black/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-[#FFC000] text-[10px] text-black">
                      {initials(tecnicoSel.nome ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-xs font-semibold">{tecnicoSel.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    · {tecnicoAgendaSemana.length} agendadas
                  </div>
                </div>
                {tecnicoAgendaSemana.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Semana livre</p>
                ) : (
                  <ul className="space-y-1">
                    {tecnicoAgendaSemana.slice(0, 5).map((v) => {
                      const t = new Date(v.data_hora_agendada);
                      const isConflito =
                        dataHoraISO &&
                        Math.abs(t.getTime() - new Date(dataHoraISO).getTime()) < 60 * 60 * 1000;
                      return (
                        <li
                          key={v.id}
                          className="flex justify-between rounded px-2 py-1 text-[11px]"
                          style={{
                            background: isConflito ? "rgba(239,68,68,0.15)" : "transparent",
                            color: isConflito ? "#fca5a5" : "#cbd5e1",
                          }}
                        >
                          <span>
                            {t.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                            {" "}
                            {t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="truncate pl-2">{v.nome_predio ?? v.titulo}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {conflito && (
                  <p className="mt-2 text-[11px] font-medium text-red-400">
                    ⚠ Possível conflito de horário
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Prioridade</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORIDADES.map((p) => {
                const active = form.prioridade === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("prioridade", p)}
                    className="rounded-full px-4 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background: active ? PRIORIDADE_COLOR[p] : "rgba(255,255,255,0.04)",
                      border: active
                        ? `1px solid ${PRIORIDADE_BORDER[p]}`
                        : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#fff" : "#cbd5e1",
                    }}
                  >
                    {PRIORIDADE_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumo */}
          <Card className="p-4 space-y-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-[#FFC000]">Resumo</div>
            <div><strong>{form.nome_predio}</strong> · {TIPO_LABEL[form.tipo_local]}</div>
            <div>{SERVICO_ICON[form.servico_solicitado]} {SERVICO_LABEL[form.servico_solicitado]}</div>
            <div className="text-muted-foreground">{form.endereco}</div>
            <div>📞 {form.nome_sindico} · {form.contato_sindico}</div>
            {dataHoraISO && (
              <div>
                📅{" "}
                {new Date(dataHoraISO).toLocaleString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
            <div>👷 {tecnicoSel?.nome ?? "Sem técnico definido"}</div>
            <div>⚑ Prioridade: {PRIORIDADE_LABEL[form.prioridade]}</div>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              disabled={!step1Valid || !step2Valid || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="px-6"
            >
              {mutation.isPending ? (
                "Salvando…"
              ) : (
                <>
                  <Check className="h-4 w-4" /> {editing ? "Salvar alterações" : "Agendar Visita"}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function QuickDate({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[rgba(255,192,0,0.25)] bg-[rgba(255,192,0,0.06)] px-3 py-1 text-[11px] font-medium text-[#FFC000] transition hover:bg-[rgba(255,192,0,0.12)]"
    >
      {label}
    </button>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const Item = ({ n, label, active }: { n: number; label: string; active: boolean }) => (
    <div className="flex items-center gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
        style={{
          background: active ? "#FFC000" : "rgba(255,255,255,0.08)",
          color: active ? "#0A0A0A" : "#9ca3af",
        }}
      >
        {n}
      </div>
      <span
        className="text-xs font-medium"
        style={{ color: active ? "#FFC000" : "#9ca3af" }}
      >
        {label}
      </span>
    </div>
  );
  return (
    <div className="flex items-center gap-3">
      <Item n={1} label="Local e Cliente" active={step >= 1} />
      <div
        className="h-px flex-1"
        style={{
          background:
            step >= 2 ? "linear-gradient(90deg,#FFC000,#FFC000)" : "rgba(255,255,255,0.08)",
        }}
      />
      <Item n={2} label="Agendamento" active={step >= 2} />
    </div>
  );
}
