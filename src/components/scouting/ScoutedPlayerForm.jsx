import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";

const POSITIONS = [
  { value: "portero", label: "Portero" },
  { value: "central", label: "Central" },
  { value: "lateral", label: "Lateral" },
  { value: "extremo", label: "Extremo" },
  { value: "mediapunta", label: "Mediapunta" },
  { value: "libre", label: "Libre" },
  { value: "mediocentro", label: "Medio centro" },
  { value: "interior", label: "Interior" },
  { value: "delantero_centro", label: "Delantero centro" },
];

function StarPicker({ value, onChange, max = 5 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} className="focus:outline-none">
          <Star className={`w-5 h-5 transition-colors ${i <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function SkillSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-gray-600">{label}</label>
        <span className="text-xs font-bold" style={{ color: "var(--granate)" }}>{value || 0}/10</span>
      </div>
      <input type="range" min="0" max="10" step="1"
        value={value || 0}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "var(--granate)" }}
      />
    </div>
  );
}

const EMPTY_FORM = {
  first_name: "", last_name: "", birth_date: "", nationality: "", modality: "",
  position: "", secondary_position: "", laterality: "", current_club: "",
  height_cm: "", weight_kg: "", phone: "", parent_name: "", parent_phone: "",
  contact_status: "no_contactado", contact_notes: "", rating: 0,
  skill_technical: 0, skill_physical: 0, skill_tactical: 0,
  skill_mental: 0, skill_attack: 0, skill_defense: 0,
  key_points: "", observations: "", match_observed: "", observation_date: "",
  photo_url: "", futbolbase_url: "", tags: [], decision: "seguir_viendo",
  category: "", league_group: "",
};

export default function ScoutedPlayerForm({ open, onOpenChange, player, onSave, isLoading }) {
  const [form, setForm] = React.useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (player) {
        setForm({
          first_name: player.first_name || "",
          last_name: player.last_name || "",
          birth_date: player.birth_date || "",
          nationality: player.nationality || "",
          modality: player.modality || "",
          position: player.position || "",
          secondary_position: player.secondary_position || "",
          laterality: player.laterality || "",
          current_club: player.current_club || "",
          height_cm: player.height_cm || "",
          weight_kg: player.weight_kg || "",
          phone: player.phone || "",
          parent_name: player.parent_name || "",
          parent_phone: player.parent_phone || "",
          contact_status: player.contact_status || "no_contactado",
          contact_notes: player.contact_notes || "",
          rating: player.rating || 0,
          skill_technical: player.skill_technical || 0,
          skill_physical: player.skill_physical || 0,
          skill_tactical: player.skill_tactical || 0,
          skill_mental: player.skill_mental || 0,
          skill_attack: player.skill_attack || 0,
          skill_defense: player.skill_defense || 0,
          key_points: player.key_points || "",
          observations: player.observations || "",
          match_observed: player.match_observed || "",
          observation_date: player.observation_date || "",
          photo_url: player.photo_url || "",
          futbolbase_url: player.futbolbase_url || "",
          tags: player.tags || [],
          decision: player.decision || "seguir_viendo",
          category: player.category || "",
          league_group: player.league_group || "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, player]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
            {player ? "Editar jugador observado" : "Nuevo jugador observado"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Datos personales */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>Datos personales</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nombre *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} required /></div>
              <div><Label className="text-xs">Apellidos *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} required /></div>
              <div><Label className="text-xs">Fecha de nacimiento</Label><Input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} /></div>
              <div><Label className="text-xs">Nacionalidad</Label><Input value={form.nationality} onChange={e => set("nationality", e.target.value)} /></div>
              <div><Label className="text-xs">Altura (cm)</Label><Input type="number" value={form.height_cm} onChange={e => set("height_cm", e.target.value)} /></div>
              <div><Label className="text-xs">Peso (kg)</Label><Input type="number" value={form.weight_kg} onChange={e => set("weight_kg", e.target.value)} /></div>
              <div><Label className="text-xs">Teléfono jugador</Label><Input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
              <div>
                <Label className="text-xs">Modalidad</Label>
                <Select value={form.modality} onValueChange={v => set("modality", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="futbol_7">Fútbol 7</SelectItem>
                    <SelectItem value="futbol_11">Fútbol 11</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Datos futbolísticos */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>Datos futbolísticos</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Posición principal</Label>
                <Select value={form.position} onValueChange={v => set("position", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Posición secundaria</Label>
                <Select value={form.secondary_position} onValueChange={v => set("secondary_position", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lateralidad</Label>
                <Select value={form.laterality} onValueChange={v => set("laterality", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diestro">Diestro</SelectItem>
                    <SelectItem value="zurdo">Zurdo</SelectItem>
                    <SelectItem value="ambidiestro">Ambidiestro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Club actual</Label><Input value={form.current_club} onChange={e => set("current_club", e.target.value)} /></div>
              <div><Label className="text-xs">Categoría</Label><Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Ej: Cadete" /></div>
              <div><Label className="text-xs">Liga y grupo</Label><Input value={form.league_group} onChange={e => set("league_group", e.target.value)} /></div>
            </div>
          </div>

          {/* Contacto familia */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>Contacto familia</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nombre padre/madre</Label><Input value={form.parent_name} onChange={e => set("parent_name", e.target.value)} /></div>
              <div><Label className="text-xs">Teléfono padre/madre</Label><Input type="tel" value={form.parent_phone} onChange={e => set("parent_phone", e.target.value)} /></div>
              <div>
                <Label className="text-xs">Estado contacto</Label>
                <Select value={form.contact_status} onValueChange={v => set("contact_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_contactado">No contactado</SelectItem>
                    <SelectItem value="interesado">Interesado</SelectItem>
                    <SelectItem value="no_interesado">No interesado</SelectItem>
                    <SelectItem value="valorando">Valorando</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Notas de contacto</Label><Input value={form.contact_notes} onChange={e => set("contact_notes", e.target.value)} /></div>
            </div>
          </div>

          {/* Habilidades */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3" style={{ fontFamily: "var(--font-display)" }}>Habilidades (1-10)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SkillSlider label="Técnica" value={form.skill_technical} onChange={v => set("skill_technical", v)} />
              <SkillSlider label="Física" value={form.skill_physical} onChange={v => set("skill_physical", v)} />
              <SkillSlider label="Táctica" value={form.skill_tactical} onChange={v => set("skill_tactical", v)} />
              <SkillSlider label="Mental" value={form.skill_mental} onChange={v => set("skill_mental", v)} />
              <SkillSlider label="Juego en ataque" value={form.skill_attack} onChange={v => set("skill_attack", v)} />
              <SkillSlider label="Juego en defensa" value={form.skill_defense} onChange={v => set("skill_defense", v)} />
            </div>
          </div>

          {/* Valoración y observaciones */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>Valoración y observaciones</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Valoración global</Label>
                <div className="mt-1"><StarPicker value={form.rating} onChange={v => set("rating", v)} /></div>
              </div>
              <div>
                <Label className="text-xs">Decisión</Label>
                <Select value={form.decision} onValueChange={v => set("decision", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seguir_viendo">Seguir viendo</SelectItem>
                    <SelectItem value="fichar">Fichar</SelectItem>
                    <SelectItem value="descartar">Descartar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Partido observado</Label><Input value={form.match_observed} onChange={e => set("match_observed", e.target.value)} /></div>
              <div><Label className="text-xs">Fecha de observación</Label><Input type="date" value={form.observation_date} onChange={e => set("observation_date", e.target.value)} /></div>
              <div><Label className="text-xs">Puntos clave (por qué ficharlo)</Label><Textarea rows={2} value={form.key_points} onChange={e => set("key_points", e.target.value)} /></div>
              <div><Label className="text-xs">Observaciones generales</Label><Textarea rows={3} value={form.observations} onChange={e => set("observations", e.target.value)} /></div>
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>Links</p>
            <div className="grid grid-cols-1 gap-3">
              <div><Label className="text-xs">URL foto</Label><Input value={form.photo_url} onChange={e => set("photo_url", e.target.value)} placeholder="https://..." /></div>
              <div><Label className="text-xs">Perfil Futbolbase</Label><Input value={form.futbolbase_url} onChange={e => set("futbolbase_url", e.target.value)} placeholder="https://futbolbase.org/..." /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading} className="text-white" style={{ background: "var(--granate)" }}>
              {isLoading ? "Guardando..." : player ? "Guardar cambios" : "Añadir jugador"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}