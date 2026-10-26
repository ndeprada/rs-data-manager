// Pestaña «Evaluación 360» de la ficha del entrenador: cinco áreas, cada una con la media de sus observaciones del trimestre,
// la opción de evaluar esa área y, debajo, el feedback del día a día de esa misma área (sale solo, según el área elegida al anotarlo).
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Lock, Send, Undo2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, useFormat, msg } from "@/i18n";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { COACH_AREAS, areaInfo, feedbackArea, hasLegacySections, isShared } from "@/lib/coachAreas";
import { avgColor } from "@/lib/coachMethod";
import { obsAreaOf, aggregateArea } from "@/lib/coachAreaCriteria";
import { quarterRange, inRange } from "@/lib/coachQuarters";
import { isStageF7 } from "@/lib/coachStage";
import { ALL_TEAMS, NO_TEAM, matchesTeamView, teamViewOptions, isMultiTeam, resolveTeamView, defaultTeamFor, teamAverages } from "@/lib/coachTeamView";
import { ObsView, SummaryView, AreaObsDialog } from "@/components/coach/CoachObsParts";
import SessionData from "@/components/coach/CoachSessionData";
import CoachEval360Section from "@/components/coach/CoachEval360Section";
import { FEEDBACK_SECTIONS } from "@/components/coach/CoachFeedbackSection";
import {
  FEEDBACK_PROGRESS, progressOf, progressInfo, countByProgress, periodsOf, openPeriodRange, validatePeriod, isPublished, unpublishedObs, carriedFeedback, progressVisibleToCoach, CLOSE_STATUS,
} from "@/lib/coachPeriods";

const FONT = { fontFamily: "var(--font-display)" };
const SUMMARY = "summary";
const OPEN = "open";
const ALL = "all";
const CLOSE_ERRORS = {
  missing: msg("Indica las dos fechas"),
  order: msg("La fecha «Hasta» no puede ser anterior a «Desde»"),
  future: msg("No se puede cerrar con fechas futuras"),
  season: msg("La fecha «Desde» es anterior a esta temporada"),
  overlap: msg("Estas fechas se pisan con otro periodo ya cerrado"),
};
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");

export default function CoachEval360Areas({ staffId, ownerUserId, teamIds = [], canEvaluate, canSeeData, isOwnProfile, author }) {
  const t = useT();
  const { locale, num } = useFormat();
  const qc = useQueryClient();
  const [periodPick, setPeriodPick] = useState(null);
  const [teamPick, setTeamPick] = useState(null); // equipo (etapa) que se está viendo; sin elegir = todos
  const [areaPick, setAreaPick] = useState(null);
  const [obsPick, setObsPick] = useState(SUMMARY);
  const [dlg, setDlg] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closeForm, setCloseForm] = useState({ label: "", from: "", to: "" });

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
  // Formato de juego del equipo (fútbol 7 hasta el S12, fútbol 11 desde el S13), para proponerlo al evaluar el modelo de juego
  const teamFormat = (id) => { const tm = teams.find((x) => x.id === id); return tm ? (isStageF7(tm) ? "f7" : "f11") : null; };
  // Si lleva más de un equipo (p. ej. uno de fútbol 7 y otro de fútbol 11) la 360 se ve y se hace equipo por equipo
  const multi = isMultiTeam(teamIds);
  const seasonItems = useMemo(() => [
    ...allObs.filter((o) => (canEvaluate || o.status === "publicada") && inRange(o.date, quarterRange(CURRENT_SEASON, "all"))),
    ...allFb.filter((f) => (canEvaluate || isShared(f)) && inRange(f.date, quarterRange(CURRENT_SEASON, "all"))),
  ], [allObs, allFb, canEvaluate]);
  const knownTeams = teams.length ? teams.map((x) => x.id) : null;
  const { teamList, untagged } = teamViewOptions({ teamIds, items: seasonItems, known: knownTeams });
  const teamView = resolveTeamView(teamPick, { multi, teamList, untagged });
  const viewTeam = defaultTeamFor(teamView, teamIds); // equipo concreto de la vista (si la hay)
  const avgText = (n) => (n == null ? "—" : num(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const shortDate = (d) => (d ? format(new Date(`${String(d).slice(0, 10)}T12:00:00`), "d MMM", { locale }) : "");

  // Periodos: el abierto (todo lo que aún no está en un periodo cerrado) y los cerrados, con las fechas que eligió quien evaluó.
  // El entrenador solo ve los periodos publicados y, en «Toda la temporada», lo publicado y lo compartido.
  const today = todayStr();
  const seasonRange = quarterRange(CURRENT_SEASON, "all");
  const periods = useMemo(() => periodsOf(closes, CURRENT_SEASON).filter((p) => canEvaluate || isPublished(p)), [closes, canEvaluate]);
  const openRange = useMemo(() => openPeriodRange(closes, CURRENT_SEASON), [closes]);
  // Compartir el periodo abierto: el entrenador ve las observaciones a medida que se hacen (el feedback compartido ya lo ve siempre)
  const liveDoc = closes.find((c) => c.season === CURRENT_SEASON && c.status === "abierto") || null;
  const shareLive = !!liveDoc?.share_live;
  const period = periodPick || OPEN;
  const closeOfPeriod = periods.find((p) => p.id === period) || null;
  const range = period === OPEN ? openRange : closeOfPeriod ? closeOfPeriod.range : period === ALL ? seasonRange : openRange;
  const state = period === OPEN ? "abierto" : isPublished(closeOfPeriod) ? "publicado" : closeOfPeriod ? "cerrado" : "abierto";
  // `view`: equipo (etapa) del que se cuentan las observaciones y el feedback; por defecto, el que se está viendo
  const statsFor = (r, carriedFrom, view = teamView) => Object.fromEntries(COACH_AREAS.map((a) => {
    const obs = allObs.filter((o) => (canEvaluate || o.status === "publicada") && obsAreaOf(o) === a.key && inRange(o.date, r) && matchesTeamView(o, view)).sort(byDateDesc);
    const fb = allFb.filter((f) => (canEvaluate || isShared(f)) && feedbackArea(f) === a.key && inRange(f.date, r) && matchesTeamView(f, view)).sort(byDateDesc);
    const carried = carriedFrom ? carriedFeedback(allFb, CURRENT_SEASON, carriedFrom).filter((f) => (canEvaluate || isShared(f)) && feedbackArea(f) === a.key && matchesTeamView(f, view)).sort(byDateDesc) : [];
    return [a.key, { obs, fb, carried, agg: aggregateArea(obs, a.key) }];
  }));
  const perArea = useMemo(() => statsFor(range, period === ALL ? null : range), [allObs, allFb, canEvaluate, period, range.from, range.to, teamView]); // eslint-disable-line react-hooks/exhaustive-deps
  const periodLabel = (p) => p.label || `${shortDate(p.range.from)} – ${shortDate(p.range.to)}`;

  const areaKey = areaPick || COACH_AREAS.find((a) => perArea[a.key].obs.length || perArea[a.key].fb.length)?.key || COACH_AREAS[0].key;
  const area = areaInfo(areaKey);
  const data = perArea[areaKey];
  const current = obsPick !== SUMMARY ? data.obs.find((o) => o.id === obsPick) || null : null;

  const pickArea = (key) => { setAreaPick(key); setObsPick(SUMMARY); };
  const pickPeriod = (id) => { setPeriodPick(id); setObsPick(SUMMARY); };
  const pickTeamView = (id) => { setTeamPick(id); setObsPick(SUMMARY); };

  const refreshClose = () => { qc.invalidateQueries({ queryKey: ["coachSessionObs", staffId] }); qc.invalidateQueries({ queryKey: ["coachQuarterClose", staffId] }); };
  const progressMutation = useMutation({
    mutationFn: ({ f, key }) => base44.entities.CoachFeedback.update(f.id, { progress: key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coachFeedback", staffId] }),
  });

  // Cierre del periodo: quien evalúa indica a qué fechas corresponde; queda cerrado y, si decide, se publica al entrenador
  const pendingObs = state === "publicado" ? unpublishedObs(allObs, range) : [];
  const saveClose = async (existing, status, extra = {}) => {
    const now = new Date().toISOString();
    const data = { status, closed_at: existing?.closed_at || now, published_at: status === CLOSE_STATUS.published ? now : null, author_id: author?.id || null, author_name: author?.name || "", ...extra };
    if (existing) return base44.entities.CoachQuarterClose.update(existing.id, data);
    return base44.entities.CoachQuarterClose.create({ staff_id: staffId, season: CURRENT_SEASON, ...data });
  };
  const closeMutation = useMutation({
    mutationFn: async ({ action, form }) => {
      const now = new Date().toISOString();
      if (action === "close" || action === "closePublish") {
        const r = { from: form.from, to: form.to };
        const created = await saveClose(null, action === "close" ? CLOSE_STATUS.closed : CLOSE_STATUS.published, { from: form.from, to: form.to, label: form.label.trim() });
        if (action === "closePublish") await Promise.all(unpublishedObs(allObs, r).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "publicada", published_at: now })));
        return created?.id || null;
      }
      if (action === "publish" && closeOfPeriod) {
        await Promise.all(unpublishedObs(allObs, range).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "publicada", published_at: now })));
        await saveClose(closeOfPeriod, CLOSE_STATUS.published, { from: closeOfPeriod.range.from, to: closeOfPeriod.range.to });
      }
      if (action === "retract" && closeOfPeriod) {
        await Promise.all(allObs.filter((o) => o.status === "publicada" && inRange(o.date, range)).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "borrador", published_at: null })));
        await saveClose(closeOfPeriod, CLOSE_STATUS.closed, { from: closeOfPeriod.range.from, to: closeOfPeriod.range.to });
      }
      if (action === "reopen" && closeOfPeriod) await base44.entities.CoachQuarterClose.delete(closeOfPeriod.id);
      return null;
    },
    onSuccess: (newId, { action }) => {
      refreshClose(); setClosing(false);
      if (action === "close" || action === "closePublish") setPeriodPick(newId || OPEN);
      if (action === "reopen") setPeriodPick(OPEN);
    },
  });
  const liveMutation = useMutation({
    mutationFn: async (on) => {
      const now = new Date().toISOString();
      const data = { status: "abierto", share_live: on, author_id: author?.id || null, author_name: author?.name || "" };
      if (liveDoc) await base44.entities.CoachQuarterClose.update(liveDoc.id, data);
      else await base44.entities.CoachQuarterClose.create({ staff_id: staffId, season: CURRENT_SEASON, ...data });
      if (on) await Promise.all(unpublishedObs(allObs, openRange).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "publicada", published_at: now })));
      else await Promise.all(allObs.filter((o) => o.status === "publicada" && inRange(o.date, openRange)).map((o) => base44.entities.CoachSessionObs.update(o.id, { status: "borrador", published_at: null })));
    },
    onSuccess: refreshClose,
  });
  const openClosing = () => { setCloseForm({ label: "", from: openRange.from, to: today < openRange.from ? openRange.from : today }); setClosing(true); };
  const closeError = closing ? validatePeriod({ from: closeForm.from, to: closeForm.to, closes, season: CURRENT_SEASON, today }) : null;
  const closeStats = useMemo(() => (closing && !closeError ? statsFor({ from: closeForm.from, to: closeForm.to }, null, ALL_TEAMS) : null), [closing, closeError, closeForm.from, closeForm.to, allObs, allFb]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {multi && teamView === ALL_TEAMS && f.team_id && teamName(f.team_id) && <span className="text-xs font-semibold text-gray-500">{teamName(f.team_id)}</span>}
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Evaluación 360")}</h2>
          <p className="text-xs text-gray-400">{t("Cinco áreas: lo que se observa en el campo y el feedback del día a día.")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Periodo")}>
          {[
            { id: OPEN, text: canEvaluate ? t("Periodo abierto") : t("Periodo en curso") },
            ...periods.map((p) => ({ id: p.id, text: periodLabel(p) + (canEvaluate && !isPublished(p) ? " · " + t("sin publicar") : "") })),
            { id: ALL, text: t("Toda la temporada") },
          ].map((q) => (
            <button key={q.id} type="button" onClick={() => pickPeriod(q.id)} aria-pressed={period === q.id}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${period === q.id ? "text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`}
              style={period === q.id ? { background: "var(--granate)" } : undefined}>
              {q.text}
            </button>
          ))}
        </div>
      </div>

      {multi && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="team-view">
          <span className="text-xs font-semibold text-gray-500">{t("Equipo")}</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Equipo")}>
            {[
              { id: ALL_TEAMS, text: t("Todos") },
              ...teamList.map((id) => ({ id, text: teamName(id) || t("Otro equipo"), fmt: teamFormat(id) })),
              ...(untagged > 0 ? [{ id: NO_TEAM, text: `${t("Sin equipo")} (${untagged})` }] : []),
            ].map((q) => (
              <button key={q.id} type="button" onClick={() => pickTeamView(q.id)} aria-pressed={teamView === q.id} data-testid={`team-view-${q.id}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${teamView === q.id ? "bg-gray-800 text-white border-transparent" : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"}`}>
                {q.text}
                {q.fmt && <span className={`ml-1.5 text-[10px] font-black ${teamView === q.id ? "text-white/70" : "text-gray-400"}`}>{q.fmt === "f7" ? "F7" : "F11"}</span>}
              </button>
            ))}
          </div>
          {teamView === ALL_TEAMS && <span className="text-xs text-gray-400">{t("Vista de conjunto: elige un equipo para ver su etapa por separado.")}</span>}
        </div>
      )}

      {canEvaluate && period !== ALL && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${state === "publicado" ? "bg-green-100 text-green-700 border-green-200" : state === "cerrado" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
              {state === "publicado" ? t("Publicado al entrenador") : state === "cerrado" ? t("Cerrado, sin publicar") : t("Periodo abierto")}
            </span>
            {state === "abierto"
              ? <span className="text-gray-400">{t("Desde el {date}", { date: shortDate(openRange.from) })}</span>
              : <span className="text-gray-400">{closeOfPeriod?.label ? `${closeOfPeriod.label} · ` : ""}{shortDate(range.from)} – {shortDate(range.to)}{state === "publicado" && closeOfPeriod?.published_at ? ` · ${t("publicado el {date}", { date: shortDate(closeOfPeriod.published_at) })}` : ""}</span>}
            {state === "publicado" && pendingObs.length > 0 && <span className="text-amber-700 font-semibold">{t("Observaciones sin publicar: {n}", { n: pendingObs.length })}</span>}
            {multi && <span className="text-gray-400">{t("Periodo y publicación comunes a todos sus equipos")}</span>}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {state === "abierto" && (
              <>
                <button type="button" role="switch" aria-checked={shareLive} disabled={liveMutation.isPending} onClick={() => liveMutation.mutate(!shareLive)}
                  title={t("Si lo activas, el entrenador ve cada observación en cuanto la guardas. Si no, la verá cuando publiques el periodo al cerrarlo.")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-colors ${shareLive ? "bg-green-50 border-green-200 text-green-700" : "bg-white border-gray-200 text-gray-500"}`}>
                  <span className={`w-7 h-4 rounded-full relative transition-colors ${shareLive ? "bg-green-500" : "bg-gray-300"}`}><span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${shareLive ? "left-3.5" : "left-0.5"}`} /></span>
                  {t("Compartir con el entrenador mientras está abierto")}
                </button>
                <Button size="sm" variant="outline" className="text-xs bg-white" onClick={openClosing}><Lock className="w-3.5 h-3.5 mr-1" /> {t("Cerrar periodo")}</Button>
              </>
            )}
            {state === "cerrado" && (
              <>
                <Button size="sm" variant="outline" className="text-xs bg-white" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate({ action: "reopen" })}><Undo2 className="w-3.5 h-3.5 mr-1" /> {t("Reabrir")}</Button>
                <Button size="sm" variant="club" className="text-xs" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate({ action: "publish" })}><Send className="w-3.5 h-3.5 mr-1" /> {t("Publicar al entrenador")}</Button>
              </>
            )}
            {state === "publicado" && (
              <>
                {pendingObs.length > 0 && <Button size="sm" variant="club" className="text-xs" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate({ action: "publish" })}><Send className="w-3.5 h-3.5 mr-1" /> {t("Publicar novedades")}</Button>}
                <Button size="sm" variant="outline" className="text-xs bg-white" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate({ action: "retract" })}><Undo2 className="w-3.5 h-3.5 mr-1" /> {t("Retirar publicación")}</Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {COACH_AREAS.map((a) => {
          const d = perArea[a.key];
          const active = a.key === areaKey;
          const byTeam = multi && teamView === ALL_TEAMS ? teamAverages(d.obs, a.key, teamList) : [];
          return (
            <div key={a.key} className="bg-white rounded-lg overflow-hidden border last:col-span-2 sm:last:col-span-1"
              style={{ borderColor: active ? a.color : "#e5e7eb", boxShadow: active ? `0 0 0 1px ${a.color}` : undefined }}>
              <button type="button" onClick={() => pickArea(a.key)} aria-pressed={active} className="w-full text-left">
                <div className="h-1" style={{ background: a.color }} />
                <div className="px-3 pt-2 pb-2">
                  <p className="text-[11px] font-black uppercase leading-tight" style={{ ...FONT, color: a.color }}>{t(a.label)}</p>
                  <p className="text-3xl font-black leading-tight tabular-nums" style={{ ...FONT, color: avgColor(d.agg.overall) }}>{avgText(d.agg.overall)}</p>
                  <p className="text-[10px] text-gray-400 leading-snug">{t("Observaciones: {n}", { n: d.obs.length })}<br />{t("Feedback: {n}", { n: d.fb.length })}</p>
                  {byTeam.length > 0 && (
                    <p className="text-[10px] text-gray-500 leading-snug mt-1" data-testid={`card-teams-${a.key}`}>
                      {byTeam.map((x) => <span key={x.id} className="inline-block mr-2"><b className="tabular-nums" style={{ color: avgColor(x.avg) }}>{avgText(x.avg)}</b> {teamName(x.id)}</span>)}
                    </p>
                  )}
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
                    {o.id !== SUMMARY && o.team_id && multi && teamView === ALL_TEAMS ? ` · ${teamName(o.team_id)}` : ""}
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

        {areaKey === "metodologia" && canSeeData && <SessionData ownerUserId={ownerUserId} teamIds={viewTeam ? [viewTeam] : teamIds} />}

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
                <li className="pt-1 text-[11px] font-bold uppercase text-amber-700 flex items-center gap-1"><CornerDownRight className="w-3 h-3" /> {t("Sigue en seguimiento de periodos anteriores")}</li>
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
            <DialogHeader><DialogTitle>{t("Cerrar periodo")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-gray-500">{t("Indica a qué fechas corresponde esta evaluación. Quedará guardada como historial y podrás publicarla al entrenador.")}</p>
              <div>
                <label className="text-xs font-semibold text-gray-600">{t("Nombre (opcional)")}</label>
                <Input value={closeForm.label} onChange={(e) => setCloseForm((f) => ({ ...f, label: e.target.value }))} placeholder={t("Ej.: Hasta Navidad")} className="mt-1 h-9 border-gray-200" maxLength={60} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t("Desde")}</label>
                  <Input type="date" value={closeForm.from} min={seasonRange.from} max={today} onChange={(e) => setCloseForm((f) => ({ ...f, from: e.target.value }))} className="mt-1 h-9 border-gray-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t("Hasta")}</label>
                  <Input type="date" value={closeForm.to} min={closeForm.from || seasonRange.from} max={today} onChange={(e) => setCloseForm((f) => ({ ...f, to: e.target.value }))} className="mt-1 h-9 border-gray-200" />
                </div>
              </div>
              {closeError && <p className="text-xs font-semibold text-red-600">{t(CLOSE_ERRORS[closeError])}</p>}
              {closeStats && (
                <ul className="divide-y divide-gray-100 border border-gray-200 rounded">
                  {COACH_AREAS.map((a) => {
                    const d = closeStats[a.key];
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
              )}
              <p className="text-xs text-gray-500">{t("Al publicar, el entrenador verá las observaciones de este periodo y el estado de su feedback compartido. El feedback interno y las notas privadas no se publican nunca. Lo que quede en «Seguir trabajando» pasa a los periodos siguientes.")}</p>
              <div className="flex justify-end gap-2 flex-wrap pt-1">
                <Button variant="outline" onClick={() => setClosing(false)}>{t("Cancelar")}</Button>
                {!shareLive && <Button variant="outline" disabled={!!closeError || closeMutation.isPending} onClick={() => closeMutation.mutate({ action: "close", form: closeForm })}>{t("Solo cerrar")}</Button>}
                <Button variant="club" disabled={!!closeError || closeMutation.isPending} onClick={() => closeMutation.mutate({ action: "closePublish", form: closeForm })}>{t("Cerrar y publicar al entrenador")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {dlg && (
        <AreaObsDialog key={`${dlg.area}-${dlg.editing?.id || "new"}`} area={dlg.area} editing={dlg.editing} staffId={staffId} teamIds={teamIds} teamName={teamName} teamFormat={teamFormat} defaultTeam={viewTeam}
          author={author} autoPublishFrom={shareLive ? openRange.from : null} onClose={() => setDlg(null)} onSaved={(id) => setObsPick(id || SUMMARY)} />
      )}
    </div>
  );
}
