import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s === value ? null : s)}
          className={`w-6 h-6 rounded text-xs font-bold transition-colors ${(value||0)>=s?"text-yellow-400":"text-gray-200"}`}>
          <Star className={`w-5 h-5 ${(value||0)>=s?"fill-yellow-400 text-yellow-400":"text-gray-200"}`} />
        </button>
      ))}
    </div>
  );
}

export default function CoachMatchNotesSection({ staffId, teamId, isCoordinator }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ positives: "", corrections: "", tactical_notes: "", general_notes: "", rating: null });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 200),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["coachMatchNotes", staffId],
    queryFn: () => base44.entities.CoachMatchNote.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.CoachMatchNote.update(editing.id, data)
      : base44.entities.CoachMatchNote.create({
          ...data,
          staff_id: staffId,
          event_id: selectedEventId,
          date: matchEvents.find(e => e.id === selectedEventId)?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
        }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachMatchNotes", staffId] }); setOpen(false); setEditing(null); },
  });

  const matchEvents = events.filter(e => e.team_id === teamId && MATCH_TYPES.includes(e.type));

  const openCreate = () => {
    setForm({ positives: "", corrections: "", tactical_notes: "", general_notes: "", rating: null });
    setSelectedEventId("");
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (note) => {
    setForm({ positives: note.positives || "", corrections: note.corrections || "", tactical_notes: note.tactical_notes || "", general_notes: note.general_notes || "", rating: note.rating || null });
    setSelectedEventId(note.event_id);
    setEditing(note);
    setOpen(true);
  };

  const getEvent = (eventId) => matchEvents.find(e => e.id === eventId);

  // Matches with existing notes
  const notesWithEvents = notes
    .map(n => ({ ...n, event: getEvent(n.event_id) }))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Matches without notes yet
  const eventsWithoutNotes = matchEvents.filter(e => !notes.find(n => n.event_id === e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Observaciones de partido</h2>
        {isCoordinator && (
          <Button size="sm" onClick={openCreate} className="text-white text-xs" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir nota
          </Button>
        )}
      </div>

      {notesWithEvents.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-400 text-sm">Sin observaciones de partido registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notesWithEvents.map(note => {
            const ev = note.event;
            const expanded = expandedId === note.id;
            return (
              <div key={note.id} className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
                <div className="px-5 py-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : note.id)}>
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
                      {note.date ? format(new Date(note.date), "d") : "—"}
                    </p>
                    <p className="text-[10px] uppercase text-gray-400">{note.date ? format(new Date(note.date), "MMM", { locale: es }) : ""}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-sm truncate" style={{ fontFamily: "var(--font-display)" }}>
                      {ev ? (ev.opponent ? `vs ${ev.opponent}` : ev.title) : "Partido"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {note.rating && (
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${(note.rating||0)>=s?"fill-yellow-400 text-yellow-400":"text-gray-200"}`} />
                          ))}
                        </div>
                      )}
                      {ev?.location && <span className="text-xs text-gray-400">{ev.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCoordinator && (
                      <button onClick={e => { e.stopPropagation(); openEdit(note); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                    {note.positives && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-display)", color: "#16a34a" }}>✓ Aspectos positivos</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.positives}</p>
                      </div>
                    )}
                    {note.corrections && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--naranja)" }}>⚠ Correcciones</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.corrections}</p>
                      </div>
                    )}
                    {note.tactical_notes && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>⚽ Notas tácticas</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.tactical_notes}</p>
                      </div>
                    )}
                    {note.general_notes && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-display)", color: "#64748b" }}>📋 Observaciones generales</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.general_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar observaciones" : "Nueva observación de partido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">Partido *</p>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar partido…" /></SelectTrigger>
                  <SelectContent>
                    {matchEvents.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.opponent ? `vs ${e.opponent}` : e.title} — {e.date ? format(new Date(e.date), "dd/MM/yyyy") : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Valoración gestión del partido</p>
              <StarRating value={form.rating} onChange={v => setForm({ ...form, rating: v })} />
            </div>
            {[
              { key: "positives", label: "✓ Aspectos positivos", placeholder: "Qué hizo bien el entrenador en este partido..." },
              { key: "corrections", label: "⚠ Correcciones a realizar", placeholder: "Errores o aspectos a mejorar..." },
              { key: "tactical_notes", label: "⚽ Notas tácticas", placeholder: "Decisiones tácticas, cambios, sistemas..." },
              { key: "general_notes", label: "📋 Observaciones generales", placeholder: "Cualquier otra observación..." },
            ].map(f => (
              <div key={f.key}>
                <p className="text-xs text-gray-500 mb-1 font-medium">{f.label}</p>
                <Textarea placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="border-gray-200 text-sm" rows={3} />
              </div>
            ))}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || (!editing && !selectedEventId)}
                className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}