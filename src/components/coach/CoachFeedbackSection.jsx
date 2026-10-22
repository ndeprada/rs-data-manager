import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, ChevronDown, ChevronUp, Send, EyeOff, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, msg, useDateLocale } from "@/i18n";
import { COACH_AREAS, FEEDBACK_TONES, areaInfo, feedbackArea, hasLegacySections, isShared, countByArea } from "@/lib/coachAreas";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const FONT = { fontFamily: "var(--font-display)" };

// Apartados del feedback antiguo por partido (se siguen mostrando y se pueden editar)
export const FEEDBACK_SECTIONS = [
  { key: "lectura", label: msg("Lectura del partido"), color: "var(--granate)", placeholder: msg("Cómo leyó el partido, cambios, momentos clave…") },
  { key: "sistema", label: msg("Sistema de juego"), color: "var(--granate)", placeholder: msg("Si el equipo aplica bien el sistema y qué ajustar…") },
  { key: "jugadores", label: msg("Jugadores (correcciones individuales)"), color: "var(--naranja)", placeholder: msg("Nombre del jugador: qué corregir…") },
  { key: "direccion", label: msg("Dirección de campo"), color: "var(--naranja)", placeholder: msg("Comunicación, gestión del banquillo, instrucciones…") },
  { key: "positivo", label: msg("Lo positivo"), color: "#16a34a", placeholder: msg("Qué hizo bien…") },
  { key: "otros", label: msg("Otros"), color: "#64748b", placeholder: msg("Cualquier otra cosa…") },
];

const notifyCoach = (id) => {
  if (!id) return;
  try {
    fetch("/api/notify-feedback", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_id: id }),
    }).catch(() => {});
  } catch (_) { /* el aviso por email es opcional */ }
};

const emptyForm = (teamId = "") => ({
  area: "", text: "", tone: "mejorar", date: format(new Date(), "yyyy-MM-dd"), event_id: "", team_id: teamId, share: false,
  lectura: "", sistema: "", jugadores: "", direccion: "", positivo: "", otros: "",
});

export default function CoachFeedbackSection({ staffId, teamIds = [], canWrite, isOwnProfile, author }) {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [areaFilter, setAreaFilter] = useState("all");

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
  const teamName = (id) => teams.find((x) => x.id === id)?.name || "";
  const matchLabel = (e) => `${e.opponent ? t("vs {opponent}", { opponent: e.opponent }) : e.title || t("Partido")} · ${e.date ? format(new Date(e.date), "dd/MM/yyyy") : ""}${teamIds.length > 1 ? ` · ${teamName(e.team_id)}` : ""}`;

  // El entrenador solo ve lo compartido; coordinación lo ve todo
  const visible = useMemo(
    () => items
      .filter((i) => canWrite || isShared(i))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.created_date || "").localeCompare(a.created_date || "")),
    [items, canWrite]
  );
  const counts = useMemo(() => countByArea(visible), [visible]);
  const shown = areaFilter === "all" ? visible : visible.filter((i) => feedbackArea(i) === areaFilter);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["coachFeedback", staffId] });
    qc.invalidateQueries({ queryKey: ["coachFeedbackUnread"] });
  };

  const legacyForm = !!editing && hasLegacySections(editing);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ev = eventById(form.event_id);
      const wasShared = isShared(editing);
      const data = {
        staff_id: staffId,
        area: form.area,
        tone: form.tone,
        event_id: form.event_id || "",
        team_id: ev?.team_id || form.team_id || editing?.team_id || null,
        date: form.date || ev?.date?.split("T")[0] || editing?.date || format(new Date(), "yyyy-MM-dd"),
        author_name: editing?.author_name || author?.name || "",
        author_id: editing?.author_id || author?.id || "",
      };
      if (legacyForm) for (const s of FEEDBACK_SECTIONS) data[s.key] = form[s.key];
      else data.text = form.text.trim();
      if (form.share && !wasShared) {
        data.status = "enviado";
        data.sent_at = new Date().toISOString();
        data.read_at = null;
      } else if (!form.share) data.status = "borrador";
      const res = editing ? await base44.entities.CoachFeedback.update(editing.id, data) : await base44.entities.CoachFeedback.create(data);
      return { res, notify: form.share && !wasShared };
    },
    onSuccess: ({ res, notify }) => {
      if (notify) notifyCoach(res?.id || editing?.id);
      invalidate(); setOpen(false); setEditing(null);
    },
  });

  const shareMutation = useMutation({
    mutationFn: (i) => base44.entities.CoachFeedback.update(i.id, isShared(i)
      ? { status: "borrador" }
      : { status: "enviado", sent_at: new Date().toISOString(), read_at: null }),
    onSuccess: (_, i) => { if (!isShared(i)) notifyCoach(i.id); invalidate(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (i) => base44.entities.CoachFeedback.delete(i.id),
    onSuccess: () => { invalidate(); setOpen(false); setEditing(null); setConfirmDelete(false); },
  });

  const markRead = useMutation({
    mutationFn: (i) => base44.entities.CoachFeedback.update(i.id, { read_at: new Date().toISOString() }),
    onSuccess: invalidate,
  });

  const [replyText, setReplyText] = useState({});
  const replyMutation = useMutation({
    mutationFn: ({ i, text }) => base44.entities.CoachFeedback.update(i.id, {
      replies: [...(i.replies || []), { by_id: author?.id || "", by_name: author?.name || "", text, at: new Date().toISOString(), from_coach: !!(isOwnProfile && !canWrite) }],
    }),
    onSuccess: (_, { i }) => { setReplyText((p) => ({ ...p, [i.id]: "" })); invalidate(); },
  });

  const toggle = (i) => {
    const next = expandedId === i.id ? null : i.id;
    setExpandedId(next);
    if (next && isOwnProfile && !canWrite && isShared(i) && !i.read_at) markRead.mutate(i);
  };

  const openCreate = () => {
    setForm(emptyForm(teamIds.length === 1 ? teamIds[0] : ""));
    setEditing(null); setConfirmDelete(false); setOpen(true);
  };
  const openEdit = (i) => {
    setForm({
      ...emptyForm(i.team_id || ""),
      area: feedbackArea(i), text: i.text || "", tone: i.tone === "positivo" ? "positivo" : "mejorar",
      date: i.date || format(new Date(), "yyyy-MM-dd"), event_id: i.event_id || "", share: isShared(i),
      ...Object.fromEntries(FEEDBACK_SECTIONS.map((s) => [s.key, i[s.key] || ""])),
    });
    setEditing(i); setConfirmDelete(false); setOpen(true);
  };

  useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  const hasContent = legacyForm ? FEEDBACK_SECTIONS.some((s) => (form[s.key] || "").trim()) : !!form.text.trim();
  const canSave = !!form.area && hasContent && !saveMutation.isPending;
  const showMatchPicker = legacyForm || form.area === "partidos";
  const alreadyShared = isShared(editing);

  const pickEvent = (v) => {
    const ev = v === "none" ? null : eventById(v);
    setForm((f) => ({ ...f, event_id: ev ? ev.id : "", date: ev?.date ? ev.date.split("T")[0] : f.date, team_id: ev?.team_id || f.team_id }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Feedback y correcciones")}</h2>
          {canWrite && <p className="text-xs text-gray-500 mt-0.5">{t("Anotaciones del día a día. El entrenador solo ve las que compartes.")}</p>}
        </div>
        {canWrite && (
          <Button variant="club" size="sm" onClick={openCreate} className="text-xs shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("Nuevo feedback")}
          </Button>
        )}
      </div>

      {visible.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[{ key: "all", label: msg("Todas"), color: "var(--granate)" }, ...COACH_AREAS.filter((a) => counts[a.key] > 0 || areaFilter === a.key)].map((a) => {
            const active = areaFilter === a.key;
            return (
              <button key={a.key} type="button" onClick={() => setAreaFilter(a.key)}
                className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${active ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white"}`}
                style={active ? { background: a.color } : undefined}>
                {t(a.label)} <span className={active ? "opacity-80" : "text-gray-400"}>{counts[a.key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-400 text-sm">{canWrite ? t("Aún no hay feedback para este entrenador") : t("Todavía no tienes feedback enviado")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((i) => {
            const ev = eventById(i.event_id);
            const expanded = expandedId === i.id;
            const shared = isShared(i);
            const isNew = isOwnProfile && !canWrite && shared && !i.read_at;
            const legacy = hasLegacySections(i);
            const area = areaInfo(feedbackArea(i));
            const context = [
              ev ? (ev.opponent ? t("vs {opponent}", { opponent: ev.opponent }) : ev.title) : "",
              i.team_id && (teamIds.length > 1 || ev) ? teamName(i.team_id) : "",
            ].filter(Boolean).join(" · ");
            const showConversation = shared || (i.replies || []).length > 0;
            return (
              <div key={i.id} className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px", borderLeft: `3px solid ${area.color}` }}>
                <div className="px-3 py-3 flex items-start gap-3 cursor-pointer" onClick={() => toggle(i)}>
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-black leading-none" style={{ ...FONT, color: "var(--granate)" }}>{i.date ? format(new Date(i.date), "d") : "—"}</p>
                    <p className="text-[10px] uppercase text-gray-400">{i.date ? format(new Date(i.date), "MMM", { locale: dfl }) : ""}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white" style={{ background: area.color }}>{t(area.label)}</span>
                        {i.tone === "positivo" && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t("Positivo")}</span>}
                        {context && <span className="text-xs text-gray-400">{context}</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isNew && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500 text-white">{t("Nuevo")}</span>}
                        {canWrite && (
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${shared ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {shared ? t("Compartida") : t("Interna")}
                          </span>
                        )}
                        {canWrite && (
                          <>
                            <button title={shared ? t("Dejar de compartir") : t("Compartir con el entrenador")} disabled={shareMutation.isPending}
                              onClick={(e) => { e.stopPropagation(); shareMutation.mutate(i); }} className="p-1.5 rounded hover:bg-gray-100"
                              style={{ color: shared ? "#9ca3af" : "var(--granate)" }}>
                              {shared ? <EyeOff className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                            <button title={t("Editar")} onClick={(e) => { e.stopPropagation(); openEdit(i); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {legacy ? (
                      <p className="font-black text-gray-900 text-sm mt-1 truncate" style={FONT}>{ev ? (ev.opponent ? t("vs {opponent}", { opponent: ev.opponent }) : ev.title) : t("Feedback general")}</p>
                    ) : (
                      <p className={`text-sm text-gray-800 mt-1 whitespace-pre-wrap ${expanded ? "" : "line-clamp-2"}`}>{i.text}</p>
                    )}
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {i.author_name ? t("Por {author_name}", { author_name: i.author_name }) : ""}
                      {canWrite && shared && i.read_at ? " " + t("· Leído") : ""}
                      {canWrite && shared && !i.read_at ? " " + t("· Sin leer") : ""}
                    </p>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1.5" />}
                </div>
                {expanded && (legacy || showConversation) && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {legacy && FEEDBACK_SECTIONS.filter((s) => i[s.key]).map((s) => (
                      <div key={s.key}>
                        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ ...FONT, color: s.color }}>{t(s.label)}</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{i[s.key]}</p>
                      </div>
                    ))}
                    {showConversation && (
                      <div className={`space-y-2 ${legacy ? "border-t border-gray-100 pt-3" : ""}`}>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1" style={FONT}>
                          <MessageSquare className="w-3 h-3" /> {t("Conversación")}
                        </p>
                        {(i.replies || []).map((r, k) => (
                          <div key={k} className={`rounded p-2 text-sm ${r.from_coach ? "bg-orange-50" : "bg-gray-50"}`}>
                            <p className="text-[10px] text-gray-400">{r.by_name || (r.from_coach ? t("Entrenador") : t("Coordinación"))} · {r.at ? format(new Date(r.at), "d MMM HH:mm", { locale: dfl }) : ""}</p>
                            <p className="text-gray-700 whitespace-pre-wrap">{r.text}</p>
                          </div>
                        ))}
                        {shared && (
                          <div className="flex gap-2">
                            <Textarea rows={1} placeholder={t("Escribe una respuesta…")} value={replyText[i.id] || ""}
                              onChange={(e) => setReplyText((p) => ({ ...p, [i.id]: e.target.value }))} className="border-gray-200 text-sm" />
                            <Button variant="club" size="sm" disabled={!(replyText[i.id] || "").trim() || replyMutation.isPending}
                              onClick={() => replyMutation.mutate({ i, text: replyText[i.id].trim() })}
                              className="self-end">{t("Responder")}</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto max-w-xl">
          <DialogHeader><DialogTitle>{editing ? t("Editar feedback") : t("Nuevo feedback")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">{t("Área")}</p>
              <div className="flex flex-wrap gap-1.5">
                {COACH_AREAS.map((a) => {
                  const active = form.area === a.key;
                  return (
                    <button key={a.key} type="button" onClick={() => setForm({ ...form, area: a.key })}
                      className={`text-xs px-2.5 py-1.5 rounded-full border ${active ? "text-white border-transparent" : "text-gray-600 border-gray-200"}`}
                      style={active ? { background: a.color } : undefined}>
                      {t(a.label)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{form.area ? t(areaInfo(form.area).hint) : t("Elige un área")}</p>
            </div>

            {legacyForm ? (
              FEEDBACK_SECTIONS.map((s) => (
                <div key={s.key}>
                  <p className="text-xs text-gray-500 mb-1 font-medium">{t(s.label)}</p>
                  <Textarea placeholder={t(s.placeholder)} value={form[s.key]} rows={2}
                    onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} className="border-gray-200 text-sm" />
                </div>
              ))
            ) : (
              <>
                <div className="flex gap-1.5">
                  {FEEDBACK_TONES.map((tn) => (
                    <button key={tn.key} type="button" onClick={() => setForm({ ...form, tone: tn.key })}
                      className={`text-xs px-2.5 py-1 rounded-full border ${form.tone === tn.key ? "text-white border-transparent" : "text-gray-600 border-gray-200"}`}
                      style={form.tone === tn.key ? { background: tn.key === "positivo" ? "#16a34a" : "var(--granate)" } : undefined}>
                      {t(tn.label)}
                    </button>
                  ))}
                </div>
                <Textarea autoFocus rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder={form.tone === "positivo" ? t("Qué hizo bien…") : t("Qué has visto y qué convendría mejorar…")} className="border-gray-200 text-sm" />
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">{t("Fecha")}</p>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-gray-200 h-9" />
              </div>
              {teamIds.length > 1 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium">{t("Equipo")}</p>
                  <Select value={form.team_id || "none"} onValueChange={(v) => setForm({ ...form, team_id: v === "none" ? "" : v })}>
                    <SelectTrigger className="border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {teamIds.map((id) => <SelectItem key={id} value={id}>{teamName(id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {showMatchPicker && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">{t("Partido")}</p>
                <Select value={form.event_id || "none"} onValueChange={pickEvent}>
                  <SelectTrigger className="border-gray-200"><SelectValue placeholder={t("Seleccionar partido…")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("Sin partido concreto")}</SelectItem>
                    {matchEvents.map((e) => <SelectItem key={e.id} value={e.id}>{matchLabel(e)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <label className="flex items-start gap-3 rounded border border-gray-200 bg-gray-50 p-3 cursor-pointer">
              <Switch checked={form.share} onCheckedChange={(v) => setForm({ ...form, share: v })} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-gray-800">{t("Compartir con el entrenador")}</span>
                <span className="block text-xs text-gray-500">{form.share ? t("El entrenador la verá y podrá responder.") : t("Solo la ve coordinación.")}</span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {editing && (
                confirmDelete ? (
                  <Button variant="outline" onClick={() => deleteMutation.mutate(editing)} className="text-red-600 border-red-200">{t("Confirmar borrado")}</Button>
                ) : (
                  <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} title={t("Borrar")}><Trash2 className="w-4 h-4 text-gray-400" /></Button>
                )
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setOpen(false)}>{t("Cancelar")}</Button>
              <Button variant="club" disabled={!canSave} onClick={() => saveMutation.mutate()}>
                {form.share && !alreadyShared ? <><Send className="w-3.5 h-3.5 mr-1.5" /> {t("Guardar y compartir")}</> : t("Guardar")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
