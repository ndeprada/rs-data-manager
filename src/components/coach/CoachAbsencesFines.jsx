// Pestaña «Ausencias y multas» de la ficha del entrenador (13/11/2026, pedido por Nacho: «no se trata de cada día anotar que
// el entrenador ha asistido, pero sí que los días que no asista poderlo anotar» y «llevar un registro de las sanciones que les
// ponemos… se olvida algo de material o le saca una tarjeta… tienen penalización económica»).
// Solo coordinación y dirección (también en el servidor: COACH_ADMIN_ENTITIES). Lógica pura en src/lib/coachOverview.js.
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import {
  ABSENCE_KINDS, ABSENCE_REASONS, FINE_CONCEPTS, FINE_STATUS, absenceSummary, fineSummary, cleanAbsence, cleanFine,
  absenceEventOptions, reasonInfo, kindInfo, conceptInfo,
} from "@/lib/coachOverview";
import { useMatchStatus } from "@/lib/matchStatus";
import { euro } from "@/components/coach/StaffParts";
import { useT, useFormat, msg } from "@/i18n";

const card = { background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" };
const lab = { fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: RS.muted, display: "block", marginBottom: 4 };
const input = { width: "100%", fontSize: 14, padding: "7px 9px", border: `1px solid ${RS.input}`, borderRadius: 8, background: "#fff", color: RS.ink };
const today = () => format(new Date(), "yyyy-MM-dd");
const OTHER = "__otro";

function Choice({ options, value, onChange, testPrefix }) {
  const t = useT();
  return (
    <div className="flex flex-wrap" style={{ gap: 5 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={on} data-testid={`${testPrefix}-${o.key}`}
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: `1px solid ${on ? RS.granate : RS.input}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, fontWeight: on ? 600 : 400 }}>
            {t(o.label)}
          </button>
        );
      })}
    </div>
  );
}

const Btn = ({ children, onClick, kind = "primary", disabled, testId, type = "button" }) => (
  <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className="disabled:opacity-50"
    style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: kind === "primary" ? 0 : `1px solid ${RS.input}`, background: kind === "primary" ? RS.granate : "#fff", color: kind === "primary" ? "#fff" : kind === "danger" ? "#B91C1C" : RS.ink2 }}>
    {children}
  </button>
);

export default function CoachAbsencesFines({ staffId, ids, teams = [], author }) {
  const t = useT();
  const { locale, num } = useFormat();
  const qc = useQueryClient();
  const idSet = useMemo(() => new Set(ids), [ids]);
  const { data: absences = [] } = useQuery({ queryKey: ["coachAbsences"], queryFn: () => base44.entities.CoachAbsence.list("-date") });
  const { data: fines = [] } = useQuery({ queryKey: ["coachFines"], queryFn: () => base44.entities.CoachFine.list("-date") });
  const { events } = useMatchStatus();
  const abs = absenceSummary(absences, idSet, CURRENT_SEASON);
  const fin = fineSummary(fines, idSet, CURRENT_SEASON);
  const teamIds = teams.map((x) => x.tm.id);
  const teamName = (id) => teams.find((x) => x.tm.id === id)?.tm.name || "";
  const evOptions = useMemo(() => absenceEventOptions(events, teamIds, new Date()), [events, teamIds.join("|")]);
  const long = (d) => (d ? format(new Date(`${String(d).slice(0, 10)}T12:00:00`), "EEE d MMM", { locale }) : "");
  const evText = (ev) => `${format(new Date(ev.date), "EEE d MMM · HH:mm", { locale })} · ${teamName(ev.team_id)}${ev.opponent ? ` vs ${ev.opponent}` : ""}`;

  const [absForm, setAbsForm] = useState(null);
  const [fineForm, setFineForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const stamp = (data, editing) => ({ ...data, author_id: editing?.author_id || author?.id || "", author_name: editing?.author_name || author?.name || "", season: CURRENT_SEASON });

  const saveAbs = useMutation({
    mutationFn: async (f) => {
      const ev = f.pick && f.pick !== OTHER ? events.find((e) => e.id === f.pick) : null;
      const data = cleanAbsence({ ...f, staff_id: f.staff_id || staffId, date: ev ? ev.date : f.date, team_id: ev ? ev.team_id : f.team_id, event_id: ev?.id || null, kind: ev ? (String(ev.type).startsWith("entrenamiento") ? "entreno" : "partido") : f.kind });
      if (!data) throw new Error(t("Falta la fecha"));
      return f.id ? base44.entities.CoachAbsence.update(f.id, stamp(data, f)) : base44.entities.CoachAbsence.create(stamp(data));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachAbsences"] }); setAbsForm(null); },
  });
  const delAbs = useMutation({
    mutationFn: (id) => base44.entities.CoachAbsence.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachAbsences"] }); setAbsForm(null); setConfirmDel(false); },
  });
  const saveFine = useMutation({
    mutationFn: async (f) => {
      const data = cleanFine({ ...f, staff_id: f.staff_id || staffId, paid_at: f.status === FINE_STATUS.paid ? f.paid_at || today() : null });
      if (!data) throw new Error(t("Indica la fecha y un importe válido"));
      return f.id ? base44.entities.CoachFine.update(f.id, stamp(data, f)) : base44.entities.CoachFine.create(stamp(data));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachFines"] }); setFineForm(null); },
  });
  const delFine = useMutation({
    mutationFn: (id) => base44.entities.CoachFine.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coachFines"] }); setFineForm(null); setConfirmDel(false); },
  });
  const togglePaid = useMutation({
    mutationFn: (f) => base44.entities.CoachFine.update(f.id, f.status === FINE_STATUS.paid ? { status: FINE_STATUS.pending, paid_at: null } : { status: FINE_STATUS.paid, paid_at: today() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coachFines"] }),
  });

  const newAbsence = () => { setConfirmDel(false); setAbsForm({ pick: evOptions.find((o) => new Date(o.ev.date) <= new Date())?.ev.id || OTHER, date: today(), kind: "entreno", team_id: teamIds.length === 1 ? teamIds[0] : "", reason: "", notified: true, notes: "" }); };
  const editAbsence = (a) => { setConfirmDel(false); setAbsForm({ ...a, pick: a.event_id && events.some((e) => e.id === a.event_id) ? a.event_id : OTHER }); };
  const newFine = () => { setConfirmDel(false); setFineForm({ date: today(), concept: "material", description: "", amount: "", status: FINE_STATUS.pending, team_id: teamIds.length === 1 ? teamIds[0] : "" }); };
  const editFine = (f) => { setConfirmDel(false); setFineForm({ ...f, amount: String(f.amount ?? "").replace(".", ",") }); };

  const reasonChip = (a) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap", background: a.reason === "sin_avisar" || a.notified === false ? "#FEE2E2" : RS.soft, color: a.reason === "sin_avisar" || a.notified === false ? "#991B1B" : RS.ink2 }}>
      {t(reasonInfo(a.reason).label)}{a.notified === false && a.reason !== "sin_avisar" ? ` · ${t("sin avisar")}` : ""}
    </span>
  );
  const iconBtn = (onClick, label, Icon, testId) => (
    <button type="button" onClick={onClick} title={label} aria-label={label} data-testid={testId} style={{ padding: 5, borderRadius: 6, color: RS.muted }}><Icon width={14} height={14} /></button>
  );

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 12, alignItems: "start" }} data-testid="coach-absences">
      <section style={card}>
        <Head title={t("AUSENCIAS")} right={<>
          <span style={{ color: RS.muted }}>{t("{n} esta temporada", { n: abs.season })}</span>
          <Btn onClick={newAbsence} testId="absence-new">+ {t("Anotar ausencia")}</Btn>
        </>} />
        <p style={{ fontSize: 12, color: RS.muted, padding: "8px 14px 0", margin: 0 }}>{t("Solo se anotan los días que no viene: no hace falta pasar lista al cuerpo técnico.")}</p>
        {abs.list.length ? (
          <div style={{ padding: "6px 0" }}>
            {abs.list.map((a) => (
              <div key={a.id} className="flex items-start" style={{ gap: 10, padding: "7px 14px", borderTop: `1px solid ${RS.lineSoft}` }} data-testid={`absence-${a.id}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 13 }}>
                    <b>{long(a.date)}</b>
                    <span style={{ color: RS.ink2 }}>· {t(kindInfo(a.kind).label)}{a.team_id && teamName(a.team_id) ? ` · ${teamName(a.team_id)}` : ""}</span>
                    {reasonChip(a)}
                  </div>
                  {a.notes && <p style={{ fontSize: 12, color: RS.ink2, margin: "2px 0 0" }}>{a.notes}</p>}
                </div>
                {iconBtn(() => editAbsence(a), t("Editar"), Pencil, `absence-edit-${a.id}`)}
              </div>
            ))}
          </div>
        ) : <p style={{ padding: "12px 14px 14px", fontSize: 13, color: RS.muted, margin: 0 }}>{t("Ninguna ausencia anotada esta temporada.")}</p>}
      </section>

      <section style={card}>
        <Head title={t("MULTAS")} right={<>
          <span style={{ color: fin.pendingAmount ? "#B91C1C" : RS.muted, fontWeight: fin.pendingAmount ? 700 : 400 }} data-testid="fines-pending">{t("{e} por pagar", { e: euro(num, fin.pendingAmount) })}</span>
          <Btn onClick={newFine} testId="fine-new">+ {t("Anotar multa")}</Btn>
        </>} />
        {fin.list.length ? (
          <div style={{ padding: "6px 0" }}>
            {fin.list.map((f) => {
              const paid = f.status === FINE_STATUS.paid;
              return (
                <div key={f.id} className="flex items-start" style={{ gap: 10, padding: "7px 14px", borderTop: `1px solid ${RS.lineSoft}` }} data-testid={`fine-${f.id}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 13 }}>
                      <b>{long(f.date)}</b>
                      <span style={{ color: RS.ink2 }}>· {t(conceptInfo(f.concept).label)}{f.team_id && teamName(f.team_id) ? ` · ${teamName(f.team_id)}` : ""}</span>
                    </div>
                    {f.description && <p style={{ fontSize: 12, color: RS.ink2, margin: "2px 0 0" }}>{f.description}</p>}
                  </div>
                  <b className="tabular-nums" style={{ fontSize: 14, color: paid ? RS.muted : "#B91C1C", whiteSpace: "nowrap" }}>{euro(num, Number(f.amount) || 0)}</b>
                  <button type="button" onClick={() => togglePaid.mutate(f)} data-testid={`fine-paid-${f.id}`} title={paid ? t("Marcar como pendiente") : t("Marcar como pagada")}
                    style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", border: 0, background: paid ? "#DCFCE7" : "#FEF3C7", color: paid ? "#166534" : "#92400E" }}>
                    {paid ? `✓ ${t("Pagada")}${f.paid_at ? ` ${format(new Date(`${f.paid_at}T12:00:00`), "d/M")}` : ""}` : t("Pendiente")}
                  </button>
                  {iconBtn(() => editFine(f), t("Editar"), Pencil, `fine-edit-${f.id}`)}
                </div>
              );
            })}
            <div style={{ padding: "7px 14px", borderTop: `1px solid ${RS.lineSoft}`, fontSize: 12, color: RS.muted }}>
              {t("Total temporada: {a} · pagado {b} · por pagar {c}", { a: euro(num, fin.total), b: euro(num, fin.paidAmount), c: euro(num, fin.pendingAmount) })}
            </div>
          </div>
        ) : <p style={{ padding: "12px 14px 14px", fontSize: 13, color: RS.muted, margin: 0 }}>{t("Ninguna multa esta temporada.")}</p>}
      </section>

      <Dialog open={!!absForm} onOpenChange={(o) => { if (!o) setAbsForm(null); }}>
        <DialogContent className="bg-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ color: RS.granate }}>{absForm?.id ? t("Editar ausencia") : t("Anotar ausencia")}</DialogTitle></DialogHeader>
          {absForm && (
            <div className="space-y-3" data-testid="absence-dialog">
              <div>
                <span style={lab}>{t("¿A qué faltó?")}</span>
                <select value={absForm.pick} onChange={(e) => setAbsForm({ ...absForm, pick: e.target.value })} style={input} data-testid="absence-event">
                  {evOptions.map(({ ev, kind }) => <option key={ev.id} value={ev.id}>{kind === "partido" ? "⚽ " : ""}{evText(ev)}</option>)}
                  <option value={OTHER}>{t("Otro día u otra cosa…")}</option>
                </select>
              </div>
              {absForm.pick === OTHER && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span style={lab}>{t("Fecha")}</span>
                    <input type="date" value={absForm.date || ""} onChange={(e) => setAbsForm({ ...absForm, date: e.target.value })} style={input} data-testid="absence-date" />
                  </div>
                  <div>
                    <span style={lab}>{t("Equipo")}</span>
                    <select value={absForm.team_id || ""} onChange={(e) => setAbsForm({ ...absForm, team_id: e.target.value })} style={input}>
                      <option value="">—</option>
                      {teams.map(({ tm }) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <span style={lab}>{t("Tipo")}</span>
                    <Choice options={ABSENCE_KINDS} value={absForm.kind} onChange={(k) => setAbsForm({ ...absForm, kind: k })} testPrefix="absence-kind" />
                  </div>
                </div>
              )}
              <div>
                <span style={lab}>{t("Motivo")}</span>
                <Choice options={ABSENCE_REASONS} value={absForm.reason} onChange={(k) => setAbsForm({ ...absForm, reason: k, notified: k === "sin_avisar" ? false : absForm.notified })} testPrefix="absence-reason" />
              </div>
              {absForm.reason !== "sin_avisar" && (
                <div>
                  <span style={lab}>{t("¿Avisó con tiempo?")}</span>
                  <Choice options={[{ key: "si", label: msg("Sí") }, { key: "no", label: msg("No") }]} value={absForm.notified === false ? "no" : "si"} onChange={(k) => setAbsForm({ ...absForm, notified: k === "si" })} testPrefix="absence-notified" />
                </div>
              )}
              <div>
                <span style={lab}>{t("Notas")}</span>
                <textarea value={absForm.notes || ""} onChange={(e) => setAbsForm({ ...absForm, notes: e.target.value })} rows={2} style={input} placeholder={t("Quién le sustituyó, si avisó por WhatsApp…")} />
              </div>
              {saveAbs.error && <p style={{ fontSize: 12, color: "#B91C1C" }}>{saveAbs.error.message}</p>}
              <div className="flex flex-wrap items-center" style={{ gap: 8, paddingTop: 4 }}>
                {absForm.id && (confirmDel
                  ? <Btn kind="danger" onClick={() => delAbs.mutate(absForm.id)} testId="absence-delete-confirm">{t("Sí, borrar")}</Btn>
                  : <button type="button" onClick={() => setConfirmDel(true)} style={{ color: "#B91C1C", fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }} data-testid="absence-delete"><Trash2 width={13} height={13} /> {t("Borrar")}</button>)}
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Btn kind="ghost" onClick={() => setAbsForm(null)}>{t("Cancelar")}</Btn>
                  <Btn onClick={() => saveAbs.mutate(absForm)} disabled={!absForm.reason || saveAbs.isPending} testId="absence-save">{saveAbs.isPending ? t("Guardando...") : t("Guardar")}</Btn>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!fineForm} onOpenChange={(o) => { if (!o) setFineForm(null); }}>
        <DialogContent className="bg-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ color: RS.granate }}>{fineForm?.id ? t("Editar multa") : t("Anotar multa")}</DialogTitle></DialogHeader>
          {fineForm && (
            <div className="space-y-3" data-testid="fine-dialog">
              <div>
                <span style={lab}>{t("Motivo")}</span>
                <Choice options={FINE_CONCEPTS} value={fineForm.concept} onChange={(k) => setFineForm({ ...fineForm, concept: k })} testPrefix="fine-concept" />
              </div>
              <div>
                <span style={lab}>{t("Detalle")}</span>
                <input value={fineForm.description || ""} onChange={(e) => setFineForm({ ...fineForm, description: e.target.value })} style={input} placeholder={t("Se dejó los petos, roja en el partido del sábado…")} data-testid="fine-description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span style={lab}>{t("Fecha")}</span>
                  <input type="date" value={fineForm.date || ""} onChange={(e) => setFineForm({ ...fineForm, date: e.target.value })} style={input} data-testid="fine-date" />
                </div>
                <div>
                  <span style={lab}>{t("Importe (€)")}</span>
                  <input inputMode="decimal" value={fineForm.amount} onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })} style={input} placeholder="10" data-testid="fine-amount" />
                </div>
                {teams.length > 1 && (
                  <div className="col-span-2">
                    <span style={lab}>{t("Equipo")}</span>
                    <select value={fineForm.team_id || ""} onChange={(e) => setFineForm({ ...fineForm, team_id: e.target.value })} style={input}>
                      <option value="">—</option>
                      {teams.map(({ tm }) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <span style={lab}>{t("Estado")}</span>
                <Choice options={[{ key: FINE_STATUS.pending, label: msg("Pendiente") }, { key: FINE_STATUS.paid, label: msg("Pagada") }]} value={fineForm.status} onChange={(k) => setFineForm({ ...fineForm, status: k })} testPrefix="fine-status" />
              </div>
              {saveFine.error && <p style={{ fontSize: 12, color: "#B91C1C" }}>{saveFine.error.message}</p>}
              <div className="flex flex-wrap items-center" style={{ gap: 8, paddingTop: 4 }}>
                {fineForm.id && (confirmDel
                  ? <Btn kind="danger" onClick={() => delFine.mutate(fineForm.id)} testId="fine-delete-confirm">{t("Sí, borrar")}</Btn>
                  : <button type="button" onClick={() => setConfirmDel(true)} style={{ color: "#B91C1C", fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }} data-testid="fine-delete"><Trash2 width={13} height={13} /> {t("Borrar")}</button>)}
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Btn kind="ghost" onClick={() => setFineForm(null)}>{t("Cancelar")}</Btn>
                  <Btn onClick={() => saveFine.mutate(fineForm)} disabled={saveFine.isPending} testId="fine-save">{saveFine.isPending ? t("Guardando...") : t("Guardar")}</Btn>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
