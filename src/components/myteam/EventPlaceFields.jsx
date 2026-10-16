import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink } from "lucide-react";

const LABEL = "text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";

// Instalación (texto libre), campo registrado y enlace de ubicación (Google Maps).
// Lo usan el formulario de crear y el de editar evento, para que sean idénticos.
export default function EventPlaceFields({ form, set }) {
  const { data: fields = [] } = useQuery({ queryKey: ["fields"], queryFn: () => base44.entities.Field.list() });
  const url = (form.location_url || "").trim();
  const href = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={LABEL}>Instalación</p>
          <Input value={form.location || ""} onChange={(e) => set("location", e.target.value)} placeholder="Ej.: Camp Municipal de Sarrià" className="border-gray-200" />
        </div>
        <div>
          <p className={LABEL}>Campo</p>
          <Select value={form.field_id || "none"} onValueChange={(v) => set("field_id", v === "none" ? "" : v)}>
            <SelectTrigger className="border-gray-200"><SelectValue placeholder="Sin campo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin campo asignado</SelectItem>
              {fields.filter((f) => f.available !== false).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <p className={LABEL}>Ubicación <span className="font-normal normal-case tracking-normal text-gray-400">(enlace de Google Maps)</span></p>
        <div className="flex items-center gap-2">
          <Input value={form.location_url || ""} onChange={(e) => set("location_url", e.target.value)} placeholder="https://maps.app.goo.gl/…" className="border-gray-200" />
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" title="Abrir en el mapa"
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
