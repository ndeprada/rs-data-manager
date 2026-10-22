// Pestaña «Evaluación 360» de la ficha del entrenador: cinco áreas, cada una con la media de sus observaciones del trimestre,
// la opción de evaluar esa área y, debajo, el feedback del día a día de esa misma área (sale solo, según el área elegida al anotarlo).
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Lock, Send, Undo2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, useFormat } from "@/i18n";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { COACH_AREAS, areaInfo, feedbackArea, hasLegacySections, isShared } from "@/lib/coachAreas";
import { avgColor } from "@/lib/coachMethod";
import { obsAreaOf, aggregateArea } from "@/lib/coachAreaCriteria";
import { QUARTERS, WHOLE_SEASON, quarterRange, quarterOf, inRange } from "@/lib/coachQuarters";
import { ObsView, SummaryView, AreaObsDialog } from "@/components/coach/CoachObsParts";
import SessionData from "@/components/coach/CoachSessionData";
import CoachEval360Section from "@/components/coach/CoachEval360Section";
import { FEEDBACK_SECTIONS } from "@/components/coach/CoachFeedbackSection";
import {
  FEEDBACK_PROGRESS, progressOf, progressInfo, countByProgress, closeOf, quarterState, unpublishedObs, carriedFeedback, progressVisibleToCoach, CLOSE_STATUS,
} from "@/lib/coachQuarterClose";

const FONT = { fontFamily: "var(--font-display)" };
const SUMMARY = "summary";
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");

export default function CoachEval360Areas({ staffId, ownerUserId, teamIds = [], canEvaluate, canSeeData, isOwnProfile, author }) {
  const t = useT();
  const { locale, num } = useFormat();
  const qc = useQueryClient();
  const [quarter, setQuarter] = useState(() => quarterOf(todayStr()));
  const [areaPick, setAreaPick] = useState(null);
  const [obsPick, setObsPick] = useState(SUMMARY);
  const [dlg, setDlg] = useState(null);
  const [closing, setClosing] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: allObs = [] } = useQuery({
    queryKey: ["coachSessionObs", staffId],
    queryFn: () => base44.entities.CoachSessionObs.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });
  const { data: allFb = [] } = useQuery({
    queryKey: ["coachFeedback", staffId],
    queryFn: () => base44.entities.CoachFeedback.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });
  const { data: closes = [] } = useQuery({
    queryKey: ["coachQuarterClose", staffId],
    queryFn: () => base44.entities.CoachQuarterClose.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });
  const teamName = (id) => teams.find((x) => x.id === id)?.name || "";
  const avgText = (n) => (n == null ? "—" : num(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const shortDate = (d) => (d ? format(new Date(`${String(d).slice(0, 10)}T12:00:00`), "d MMM", { locale }) : "");

  // El entrenador solo ve lo publicado y lo compartido; coordinación lo ve todo
  const range = quarterRange(CURRENT_SEASON, quarter);
  const perArea = useMemo(() => Object.fromEntries(COACH_AREAS.map((a) => {
    const obs = allObs.filter((o) => (canEvaluate || o.status === "publicada") && obsAreaOf(o) === a.key && inRange(o.date, range)).sort(byDateDesc);
    const fb = allFb.filter((f) => (canEvaluate || isShared(f)) && feedbackArea(f) === a.key && inRange(f.date, range)).sort(byDateDesc);
    const carried = carriedFeedback(allFb, CURRENT_SEASON, quarter).filter((f) => (canEvaluate || isShared(f)) && feedbackArea(f) === a.key).sort(byDateDesc);
    return [a.key, { obs, fb, carried, agg: aggregateArea(obs, a.key) }];
  })), [allObs, allFb, canEvaluate, quarter, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const areaKey = areaPick || COACH_AREAS.find((a) => perArea[a.key].obs.length || perArea[a.key].fb.length)?.key || COACH_AREAS[0].key;
  const area = areaInfo(areaKey);
  const data = perArea[areaKey];
  const current = obsPick !== SUMMARY ? data.obs.find((o) => o.id === obsPick) || null : null;

  const pickArea = (key) => { setAreaPick(key); setObsPick(SUMMARY); };
  const pickQuarter = (id) => { setQuarter(id); setObsPick(SUMMARY); };

  const refreshClose = () => { qc.invalidateQueries({ queryKey: ["coachSessionObs", staffId] }); qc.invalidateQueries({ queryKey: ["coachQuarterClose", staffId] }); };
  const progressMutation = useMutation({
    mutationFn: ({ f, key }) => base44.entities.CoachFeedback.update(f.id, { progress: key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coachFeedback", staffId] }),
  });

  // Cierre del trimestre: queda anotado (cerrado) y, si se decide, se publica al entrenador lo observado en ese periodo
  const close = closeOf(closes, CURRENT_SEASON, quarter);
  const state = quarterState(close);
  const pendingObs = unpublishedObs(allObs, range);
  const saveClose = async (status) => {
    const now = new Date().toISOString();
    const data = { status, closed_at: close?.closed_at || now, published_at: status === CLOSE_STATUS.published ? now : null, author_id: author?.id || null, author_name: author?.name || "" };
    if (close) await base44.entities.CoachQuarterClose.update(close.id, data);
    else await base44.entities.CoachQuarterClose.create({ staff_id: staffId, season: CURRENT_SEASON, quarter, ...data });
  };
  const closeMutation = useMutation({
    mutationFn: async (action) => {
      const now = new Date().toISOString();
      if (action === "close") await saveClose(CLOSE_STATUS.closed);
      if (action === "publish") {
        await Promise.all(unpublishedObs(allObs, range).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "publicada", published_at: now })));
        await saveClose(CLOSE_STATUS.published);
      }
      if (action === "retract") {
        await Promise.all(allObs.filter((o) => o.status === "publicada" && inRange(o.date, range)).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "borrador", published_at: null })));
        await saveClose(CLOSE_STATUS.closed);
      }
      if (action === "reopen" && close) await base44.entities.CoachQuarterClose.delete(close.id);
    },
    onSuccess: () => { refreshClose(); setClosing(false); },
  });

  // Estado de una anotación: quien evalúa lo cambia; el entrenador lo ve cuando se ha publicado el trimestre de esa anotación
  const progressControl = (f) => {
    const cur = progressOf(f);
    if (canEvaluate) {
      return (
        <div className="flex gap-1 flex-wrap mt-1.5" role="group" aria-label={t("Estado")}>
          {FEEDBACK_PROGRESS.map((p) => (
            <button key={p.key} type="button" onClick={() => cur !== p.key && progressMutation.mutate({ f, key: p.key })} aria-pressed={cur === p.key}
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border transition-colors ${cur === p.key ? p.chip : "bg-white text-gray-300 border-gray-200 hover:text-gray-500"}`}>
              {t(p.label)}
            </button>
          ))}
        </div>
      );
    }
    if (!progressVisibleToCoach(f, closes, CURRENT_SEASON)) return null;
    return <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${progressInfo(cur).chip}`}>{t(progressInfo(cur).label)}</span>;
  };

  const renderFb = (f, carried) => (
    <li key={f.id} className={`bg-white border border-gray-200 rounded px-3 py-2 flex gap-3 ${carried ? "opacity-90" : ""}`} style={{ borderLeft: `3px solid ${area.color}` }}>
      <div className="w-10 text-center shrink-0">
        <p className="text-base font-black leading-none" style={{ ...FONT, color: "var(--granate)" }}>{f.date ? format(new Date(`${f.date}T12:00:00`), "d", { locale }) : "—"}</p>
        <p className="text-[10px] uppercase text-gray-400">{f.date ? format(new Date(`${f.date}T12:00:00`), "MMM", { locale }) : ""}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          {f.tone === "positivo" && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t("Positivo")}</span>}
          {canEvaluate && (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isShared(f) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{isShared(f) ? t("Compartida") : t("Interna")}</span>
          )}
          {f.author_name && <span className="text-xs text-gray-400">{t("Por {author_name}", { author_name: f.author_name })}</span>}
        </div>
        {hasLegacySections(f) ? (
          <div className="space-y-1">
            {FEEDBACK_SECTIONS.filter((s) => f[s.key]).map((s) => (
              <p key={s.key} className="text-sm text-gray-700 leading-snug whitespace-pre-wrap"><span className="text-[10px] font-black uppercase mr-1.5" style={{ ...FONT, color: s.color }}>{t(s.label)}</span>{f[s.key]}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-800 leading-snug whitespace-pre-wrap">{f.text}</p>
        )}
        {progressControl(f)}
      </div>
    </li>
  );

  const evaluate = (key) => { setAreaPick(key); setObsPick(SUMMARY); setDlg({ area: key, editing: null }); };
  const quarterOptions = [...QUARTERS, WHOLE_SEASON];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Evaluación 360")}</h2>
          <p className="text-xs text-gray-400">{t("Cinco áreas: lo que se observa en el campo y el feedback del día a día.")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Periodo")}>
          {quarterOptions.map((q) => (
            <button key={q.id} type="button" onClick={() => pickQuarter(q.id)} aria-pressed={quarter === q.id}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${quarter === q.id ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`}
              style={quarter === q.id ? { background: "var(--granate)" } : undefined}>
              {t(q.label)}
            </button>
          ))}
        </div>
      </div>

      {canEvaluate && quarter !== WHOLE_SEASON.id && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${state === "publicado" ? "bg-green-100 text-green-700 border-green-200" : state === "cerrado" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
              {state === "publicado" ? t("Publicado al entrenador") : state === "cerrado" ? t("Cerrado, sin publicar") : t("Trimestre abierto")}
            </span>
            {state === "publicado" && close?.published_at && <span className="text-gray-400">{shortDate(close.published_at)}</span>}
            {state === "publicado" && pendingObs.length > 0 && <span className="text-amber-700 font-semibold">{t("Observaciones sin publicar: {n}", { n: pendingObs.length })}</span>}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {state === "abierto" && <Button size="sm" variant="outline" className="text-xs bg-white" onClick={() => setClosing(true)}><Lock className="w-3.5 h-3.5 mr-1" /> {t("Cerrar trimestre")}</Button>}
            {state === "cerrado" && (
              <>
                <Button size="sm" variant="outline" className="text-xs bg-white" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate("reopen")}><Undo2 className="w-3.5 h-3.5 mr-1" /> {t("Reabrir")}</Button>
                <Button size="sm" variant="club" className="text-xs" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate("publish")}><Send className="w-3.5 h-3.5 mr-1" /> {t("Publicar al entrenador")}</Button>
              </>
            )}
            {state === "publicado" && (
              <>
                {pendingObs.length > 0 && <Button size="sm" variant="club" className="text-xs" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate("publish")}><Send className="w-3.5 h-3.5 mr-1" /> {t("Publicar novedades")}</Button>}
                <Button size="sm" variant="outline" className="text-xs bg-white" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate("retract")}><Undo2 className="w-3.5 h-3.5 mr-1" /> {t("Retirar publicación")}</Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {COACH_AREAS.map((a) => {
          const d = perArea[a.key];
          const active = a.key === areaKey;
          return (
            <div key={a.key} className="bg-white rounded-lg overflow-hidden border last:col-span-2 sm:last:col-span-1"
              style={{ borderColor: active ? a.color : "#e5e7eb", boxShadow: active ? `0 0 0 1px ${a.color}` : undefined }}>
              <button type="button" onClick={() => pickArea(a.key)} aria-pressed={active} className="w-full text-left">
                <div className="h-1" style={{ background: a.color }} />
                <div className="px-3 pt-2 pb-2">
                  <p className="text-[11px] font-black uppercase leading-tight" style={{ ...FONT, color: a.color }}>{t(a.label)}</p>
                  <p className="text-3xl font-black leading-tight tabular-nums" style={{ ...FONT, color: avgColor(d.agg.overall) }}>{avgText(d.agg.overall)}</p>
                  <p className="text-[10px] text-gray-400 leading-snug">{t("Observaciones: {n}", { n: d.obs.length })}<br />{t("Feedback: {n}", { n: d.fb.length })}</p>
                </div>
              </button>
              {canEvaluate && (
                <button type="button" onClick={() => evaluate(a.key)}
                  className="w-full flex items-center justify-center gap-1 text-xs font-semibold py-1.5 border-t border-gray-100 hover:bg-gray-50" style={{ color: a.color }}>
                  <Plus className="w-3.5 h-3.5" /> {t("Evaluar")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4" style={{ borderTop: `3px solid ${area.color}` }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-base font-black uppercase" style={{ ...FONT, color: area.color }}>{t(area.label)}</h3>
            <p className="text-xs text-gray-400">{t(area.hint)}</p>
          </div>
          {canEvaluate && (
            <Button variant="club" size="sm" onClick={() => evaluate(areaKey)} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> {t("Evaluar esta área")}
            </Button>
          )}
        </div>

        {data.obs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded p-6 text-center">
            <p className="text-gray-400 text-sm">{t("No hay observaciones de esta área en este periodo")}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[{ id: SUMMARY }, ...data.obs].map((o) => {
                const active = o.id === SUMMARY ? !current : current?.id === o.id;
                const avg = o.id === SUMMARY ? null : aggregateArea([o], areaKey).overall;
                return (
                  <button key={o.id} onClick={() => setObsPick(o.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`}
                    style={active ? { background: area.color } : undefined}>
                    {o.id === SUMMARY ? t("Resumen") : shortDate(o.date) || t("Observación")}
                    {o.id !== SUMMARY && o.team_id && teamIds.length > 1 ? ` · ${teamName(o.team_id)}` : ""}
                    {avg != null && <b className="ml-1.5">{avgText(avg)}</b>}
                    {o.id !== SUMMARY && canEvaluate && o.status !== "publicada" && " " + t("· borrador")}
                  </button>
                );
              })}
            </div>
            {current ? (
              <>
                {canEvaluate && (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setDlg({ area: areaKey, editing: current })} className="text-xs bg-white"><Pencil className="w-3.5 h-3.5 mr-1" /> {t("Editar")}</Button>
                  </div>
                )}
                <ObsView obs={current} area={areaKey} teamName={teamName(current.team_id)} />
              </>
            ) : (
              <SummaryView observations={data.obs} area={areaKey} agg={data.agg} />
            )}
          </>
        )}

        {areaKey === "metodologia" && canSeeData && <SessionData ownerUserId={ownerUserId} teamIds={teamIds} />}

        <div className="space-y-2">
          <h4 className="text-sm font-black uppercase flex items-center gap-2 flex-wrap" style={{ ...FONT, color: area.color }}>
            {t("Feedback del área")} <span className="text-xs font-normal text-gray-400">{data.fb.length}</span>
            {canEvaluate && data.fb.length > 0 && (() => {
              const c = countByProgress(data.fb);
              return <span className="text-[11px] font-normal text-gray-400">{FEEDBACK_PROGRESS.map((p) => `${t(p.label)}: ${c[p.key]}`).join(" · ")}</span>;
            })()}
          </h4>
          {data.fb.length === 0 && data.carried.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded p-4 text-center">{t("No hay feedback de esta área en este periodo")}</p>
          ) : (
            <ul className="space-y-1.5">
              {data.fb.map((f) => renderFb(f, false))}
              {data.carried.length > 0 && (
                <li className="pt-1 text-[11px] font-bold uppercase text-amber-700 flex items-center gap-1"><CornerDownRight className="w-3 h-3" /> {t("Sigue en seguimiento de trimestres anteriores")}</li>
              )}
              {data.carried.map((f) => renderFb(f, true))}
            </ul>
          )}
        </div>
      </section>

      <CoachEval360Section readOnly staffId={staffId} teamIds={teamIds} canEvaluate={canEvaluate} isOwnProfile={isOwnProfile} author={author} />

      {closing && (
        <Dialog open onOpenChange={(v) => { if (!v) setClosing(false); }}>
          <DialogContent className="bg-white border-gray-200 max-w-lg max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("Cerrar trimestre")} · {t(QUARTERS.find((q) => q.id === quarter)?.label || "")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
                {COACH_AREAS.map((a) => {
                  const d = perArea[a.key];
                  const c = countByProgress(d.fb);
                  return (
                    <li key={a.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-bold" style={{ color: a.color }}>{t(a.label)}</span>
                      <span className="text-xs text-gray-500 text-right">
                        <b className="text-gray-800 tabular-nums">{avgText(d.agg.overall)}</b> · {t("Observaciones: {n}", { n: d.obs.length })} · {t("Feedback: {n}", { n: d.fb.length })}
                        {d.fb.length > 0 && <><br />{FEEDBACK_PROGRESS.map((p) => `${t(p.label)}: ${c[p.key]}`).join(" · ")}</>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-gray-500">{t("Al publicar, el entrenador verá las observaciones de este trimestre y el estado de su feedback compartido. El feedback interno y las notas privadas no se publican nunca. Lo que quede en «Seguir trabajando» pasa al trimestre siguiente.")}</p>
              <div className="flex justify-end gap-2 flex-wrap pt-1">
                <Button variant="outline" onClick={() => setClosing(false)}>{t("Cancelar")}</Button>
                <Button variant="outline" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate("close")}>{t("Solo cerrar")}</Button>
                <Button variant="club" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate("publish")}>{t("Cerrar y publicar al entrenador")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {dlg && (
        <AreaObsDialog key={`${dlg.area}-${dlg.editing?.id || "new"}`} area={dlg.area} editing={dlg.editing} staffId={staffId} teamIds={teamIds} teamName={teamName}
          author={author} onClose={() => setDlg(null)} onSaved={(id) => setObsPick(id || SUMMARY)} />
      )}
    </div>
  );
}
