import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, ChevronDown, ChevronUp, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const FONT = { fontFamily: "var(--font-display)" };

export const FEEDBACK_SECTIONS = [
  { key: "lectura", label: "Lectura del partido", color: "var(--granate)", placeholder: "Cómo leyó el partido, cambios, momentos clave…" },
  { key: "sistema", label: "Sistema de juego", color: "var(--granate)", placeholder: "Si el equipo aplica bien el sistema y qué ajustar…" },
  { key: "jugadores", label: "Jugadores (correcciones individuales)", color: "var(--naranja)", placeholder: "Nombre del jugador: qué corregir…" },
  { key: "direccion", label: "Dirección de campo", color: "var(--naranja)", placeholder: "Comunicación, gestión del banquillo, instrucciones…" },
  { key: "positivo", label: "Lo positivo", color: "#16a34a", placeholder: "Qué hizo bien…" },
  { key: "otros", label: "Otros", color: "#64748b", placeholder: "Cualquier otra cosa…" },
];

const EMPTY = { event_id: "", lectura: "", sistema: "", jugadores: "", direccion: "", positivo: "", otros: "" };

export default function CoachFeedbackSection({ staffId, teamIds = [], canWrite, isOwnProfile, author }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: items = [] } = useQuery({
    queryKey: ["coachFeedback", staffId],
    queryFn: () => base44.entities.CoachFeedback.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });

  const matchEvents = useMemo(
    () => events.filter((e) => teamIds.includes(e.team_id) && MATCH_TYPES.includes(e.type))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [events, teamIds]
  );
  const eventById = (id) => events.find((e) => e.id === id);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || "";
  const matchLabel = (e) => `${e.opponent ? `vs ${e.opponent}` : e.title || "Partido"} · ${e.date ? format(new Date(e.date), "dd/MM/yyyy") : ""}${teamIds.length > 1 ? ` · ${teamName(e.team_id)}` : ""}`;

  const visible = items
    .filter((i) => canWrite || i.status === "enviado")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["coachFeedback", staffId] });
    qc.invalidateQueries({ queryKey: ["coachFeedbackUnread"] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ send }) => {
      const ev = eventById(form.event_id);
      const data = {
        ...form,
        staff_id: staffId,
        team_id: ev?.team_id || editing?.team_id || null,
        date: ev?.date?.split("T")[0] || editing?.date || new Date().toISOString().split("T")[0],
        author_name: editing?.author_name || author?.name || "",
        author_id: editing?.author_id || author?.id || "",
      };
      if (send) {
        data.status = "enviado";
        data.sent_at = new Date().toISOString();
        data.read_at = null;
      } else if (!editing) data.status = "borrador";
      return editing ? base44.entities.CoachFeedback.update(editing.id, data) : base44.entities.CoachFeedback.create(data);
    },
    onSuccess: () => { invalidate(); setOpen(false); setEditing(null); },
  });

  const sendMutation = useMutation({
    mutationFn: (i) => base44.entities.CoachFeedback.update(i.id, { status: "enviado", sent_at: new Date().toISOString(), read_at: null }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (i) => base44.entities.CoachFeedback.delete(i.id),
    onSuccess: () => { invalidate(); setOpen(false); setEditing(null); setConfirmDelete(false); },
  });

  const markRead = useMutation({
    mutationFn: (i) => base44.entities.CoachFeedback.update(i.id, { read_at: new Date().toISOString() }),
    onSuccess: invalidate,
  });

  const toggle = (i) => {
    const next = expandedId === i.id ? null : i.id;
    setExpandedId(next);
    if (next && isOwnProfile && !canWrite && i.status === "enviado" && !i.read_at) markRead.mutate(i);
  };

  const openCreate = () => { setForm(EMPTY); setEditing(null); setConfirmDelete(false); setOpen(true); };
  const openEdit = (i) => {
    setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, i[k] || ""])) });
    setEditing(i); setConfirmDelete(false); setOpen(true);
  };

  useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  const hasContent = FEEDBACK_SECTIONS.some((s) => (form[s.key] || "").trim());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>Feedback y correcciones</h2>
        {canWrite && (
          <Button size="sm" onClick={openCreate} className="text-white text-xs" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo feedback
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-400 text-sm">{canWrite ? "Aún no hay feedback para este entrenador" : "Todavía no tienes feedback enviado"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((i) => {
            const ev = eventById(i.event_id);
            const expanded = expandedId === i.id;
            const isNew = isOwnProfile && !canWrite && i.status === "enviado" && !i.read_at;
            return (
              <div key={i.id} className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
                <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => toggle(i)}>
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ ...FONT, color: "var(--granate)" }}>{i.date ? format(new Date(i.date), "d") : "—"}</p>
                    <p className="text-[10px] uppercase text-gray-400">{i.date ? format(new Date(i.date), "MMM", { locale: es }) : ""}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-sm truncate" style={FONT}>
                      {ev ? (ev.opponent ? `vs ${ev.opponent}` : ev.title) : "Feedback general"}
                      {i.team_id && <span className="text-gray-400 font-normal"> · {teamName(i.team_id)}</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {i.author_name ? `Por ${i.author_name}` : ""}
                      {canWrite && i.status === "enviado" && i.read_at ? " · Leído" : ""}
                      {canWrite && i.status === "enviado" && !i.read_at ? " · Sin leer" : ""}
                    </p>
                  </div>
                  {isNew && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500 text-white">Nuevo</span>}
                  {canWrite && (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${i.status === "enviado" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {i.status === "enviado" ? "Enviado" : "Borrador"}
                    </span>
                  )}
                  {canWrite && (
                    <>
                      {i.status !== "enviado" && (
                        <button title="Enviar al entrenador" onClick={(e) => { e.stopPropagation(); sendMutation.mutate(i); }} className="p-1.5 rounded hover:bg-gray-100" style={{ color: "var(--granate)" }}>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button title="Editar" onClick={(e) => { e.stopPropagation(); openEdit(i); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                {expanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {FEEDBACK_SECTIONS.filter((s) => i[s.key]).map((s) => (
                      <div key={s.key}>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ ...FONT, color: s.color }}>{s.label}</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{i[s.key]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Editar feedback" : "Nuevo feedback"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Partido</p>
              <Select value={form.event_id || "none"} onValueChange={(v) => setForm({ ...form, event_id: v === "none" ? "" : v })}>
                <SelectTrigger className="border-gray-200"><SelectValue placeholder="Seleccionar partido…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin partido concreto</SelectItem>
                  {matchEvents.map((e) => <SelectItem key={e.id} value={e.id}>{matchLabel(e)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {FEEDBACK_SECTIONS.map((s) => (
              <div key={s.key}>
                <p className="text-xs text-gray-500 mb-1 font-medium">{s.label}</p>
                <Textarea placeholder={s.placeholder} value={form[s.key]} rows={2}
                  onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} className="border-gray-200 text-sm" />
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {editing && (
                confirmDelete ? (
                  <Button variant="outline" onClick={() => deleteMutation.mutate(editing)} className="text-red-600 border-red-200">Confirmar borrado</Button>
                ) : (
                  <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} title="Borrar"><Trash2 className="w-4 h-4 text-gray-400" /></Button>
                )
              )}
              <div className="flex-1" />
              {(!editing || editing.status !== "enviado") && (
                <Button variant="outline" disabled={!hasContent || saveMutation.isPending} onClick={() => saveMutation.mutate({ send: false })}>
                  Guardar borrador
                </Button>
              )}
              <Button disabled={!hasContent || saveMutation.isPending} onClick={() => saveMutation.mutate({ send: true })}
                className="text-white" style={{ background: "var(--granate)" }}>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {editing?.status === "enviado" ? "Guardar y reenviar" : "Guardar y enviar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
