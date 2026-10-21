import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Archive, Users, Shield, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useT, useDateLocale, useLocaleTag, useFormat, msg } from "@/i18n";

const nextOf = (s) => { const y = Number(s.slice(0, 4)) + 1; return `${y}-${y + 1}`; };
const lbl = (s) => s.replace("-", "–");

// Lee la clasificación final de cada equipo en la FCF (solo lectura) para guardarla en el historial.
async function collectStandings(teams, onProgress) {
  const withFcf = teams.filter((t) => t.fcf_team_code);
  const out = {};
  const queue = [...withFcf];
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      try {
        const r = await fetch(`/api/sync-fcf?standings=${t.id}`, { credentials: "include" });
        const j = await r.json();
        if (j.available) {
          const me = (j.rows || []).find((x) => x.teamId === j.ourTeamId);
          if (me) out[t.id] = { competition: j.competition, group: j.group, pos: me.pos, pts: me.pts, pj: me.pj, g: me.g, e: me.e, p: me.p, gf: me.gf, gc: me.gc };
        }
      } catch { /* sin clasificación */ }
      onProgress(++done, withFcf.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}

export default function CloseTab({ season }) {
  const t = useT();
  const dfl = useDateLocale();
  const tag = useLocaleTag();
  const { longDate } = useFormat();
  const N = (n) => Number(n || 0).toLocaleString(tag);
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: status, isLoading, refetch } = useQuery({ queryKey: ["season_status", season], queryFn: () => base44.club.seasonStatus(season) });
  const closed = status?.closes?.find((c) => c.season === season && c.status === "closed");

  const [phase, setPhase] = useState("idle"); // idle | reviewing | reviewed | closing | done
  const [progress, setProgress] = useState("");
  const [review, setReview] = useState(null);
  const [standings, setStandings] = useState({});
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const word = `CERRAR ${season}`;

  const refreshAll = async () => { await qc.invalidateQueries(); await refetch(); };

  const doReview = async () => {
    setError(""); setPhase("reviewing"); setProgress(t("Leyendo la clasificación de la FCF…"));
    try {
      const st = await collectStandings(teams, (d, total) => setProgress(t("Leyendo la clasificación de la FCF… {d}/{total}", { d, total })));
      setStandings(st);
      setProgress(t("Calculando el resumen…"));
      const r = await base44.club.seasonClose(season, st, true);
      setReview(r); setPhase("reviewed"); setText("");
    } catch (e) {
      setError(e.data?.message || e.message || t("No se pudo preparar el resumen.")); setPhase("idle");
    }
  };

  const doClose = async () => {
    setError(""); setPhase("closing");
    try {
      const r = await base44.club.seasonClose(season, standings, false);
      setReview(r); setPhase("done");
      await refreshAll();
    } catch (e) {
      setError(e.data?.message || e.message || t("No se pudo cerrar la temporada. No se ha cambiado nada.")); setPhase("reviewed");
    }
  };

  const doReopen = async () => {
    setReopening(true); setError("");
    try { await base44.club.seasonReopen(season); setPhase("idle"); setReview(null); await refreshAll(); }
    catch (e) { setError(e.data?.message || e.message || t("No se pudo reabrir.")); }
    finally { setReopening(false); setConfirmReopen(false); }
  };

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-400">{t("Cargando…")}</p>;

  const card = "bg-white border border-gray-200 shadow-sm";
  const s = review?.summary;
  const a = review?.archive || review?.archived;
  const endYear = Number(season.slice(5));
  const early = new Date() < new Date(endYear, 5, 1); // antes del 1 de junio
  const noTable = teams.filter((tm) => !standings[tm.id]);

  return (
    <div className="space-y-3 max-w-3xl">
      {error && <p className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200" style={{ borderRadius: "6px" }}>{error}</p>}

      {closed ? (
        <div className={`${card} p-5 space-y-3`} style={{ borderRadius: "4px", borderLeft: "4px solid #16a34a" }}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-black text-lg uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Temporada {lbl} cerrada", { lbl: lbl(season) })}</p>
              <p className="text-sm text-gray-600">
                {closed.closed_at ? `${longDate(closed.closed_at)}, ${format(new Date(closed.closed_at), "HH:mm")}` : ""}{closed.closed_by ? ` · ${closed.closed_by}` : ""}
              </p>
              {closed.summary && (
                <p className="text-sm text-gray-600 mt-1">
                  {t("Historial guardado: {N} equipos y {N2} jugadores · {N3} cambian de equipo, {N4} bajas.", { N: N(closed.summary.teams), N2: N(closed.summary.player_history), N3: N(closed.summary.moved), N4: N(closed.summary.bajas) })}
                </p>
              )}
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
            <p className="font-bold text-xs uppercase tracking-wider text-gray-500">{t("Para empezar la nueva temporada")}</p>
            <p>{t("1. Actualiza en")} <Link to="/Teams" className="font-semibold underline">{t("Equipos")}</Link> {t("el grupo de la FCF de cada equipo (la competición puede haber cambiado).")}</p>
            <p>{t("2. Revisa en")} <Link to="/Coaches" className="font-semibold underline">{t("Personal")}</Link> {t("los cuerpos técnicos.")}</p>
            <p>{t("3. Los jugadores nuevos se añaden desde la ficha del equipo; los que dejaste de baja siguen en el")} <Link to="/Players" className="font-semibold underline">{t("histórico de jugadores")}</Link> {t("por si vuelven.")}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmReopen(true)}><RotateCcw className="w-3.5 h-3.5" /> {t("Reabrir la temporada (deshacer el cierre)")}</Button>
        </div>
      ) : (
        <>
          <div className={`${card} p-5 space-y-3`} style={{ borderRadius: "4px" }}>
            <p className="font-black text-lg uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Cerrar {lbl} y empezar {lbl2}", { lbl: lbl(season), lbl2: lbl(nextOf(season)) })}</p>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li className="flex gap-2"><Archive className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" /> <span>{t("Los partidos, entrenos, convocatorias, estadísticas y asistencia pasan al historial.")} <b>{t("No se borra nada")}</b> {t("y se puede deshacer.")}</span></li>
              <li className="flex gap-2"><Shield className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" /> {t("De cada equipo se guarda la clasificación, los resultados, la plantilla y el cuerpo técnico.")}</li>
              <li className="flex gap-2"><Users className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" /> {t("De cada jugador se guardan partidos, minutos, goles, asistencias, tarjetas y asistencia a entrenos. Se aplican los traspasos que has decidido; las bajas salen de las listas pero se conservan.")}</li>
            </ul>
            <p className="text-xs text-gray-500">{t("Hazlo")} <b>{t("antes")}</b> {t("de cambiar el grupo de la FCF de los equipos, para guardar la clasificación final de esta temporada.")}</p>
            {phase === "idle" || phase === "reviewing" ? (
              <Button variant="club" onClick={doReview} disabled={phase === "reviewing"} className="gap-2">
                {phase === "reviewing" ? <><Loader2 className="w-4 h-4 animate-spin" /> {progress}</> : t("Revisar antes de cerrar")}
              </Button>
            ) : null}
          </div>

          {(phase === "reviewed" || phase === "closing") && s && a && (
            <div className={`${card} p-5 space-y-3`} style={{ borderRadius: "4px" }}>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("Resumen: esto es lo que va a pasar")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  [msg("Equipos al historial"), s.teams], [msg("Fichas de jugador"), s.player_history],
                  [msg("Cambian de equipo"), s.moved], [msg("Bajas"), s.bajas],
                  [msg("Eventos archivados"), a.Event], [msg("Estadísticas"), a.MatchStats], [msg("Asistencias a entrenos"), a.TrainingAttendance], [msg("Convocatorias"), a.Convocatoria],
                ].map(([k, v]) => (
                  <div key={k} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{N(v)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{t(k)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {s.undecided > 0 && <Warn>{t("{N} jugadores sin destino decidido: se quedarán en su equipo actual.", { N: N(s.undecided) })} <b>{t("Mejor revísalos en \"Traspasos\".")}</b></Warn>}
                {early && <Warn>{t("La temporada aún no ha terminado (hoy es {format}). Puedes cerrarla igualmente y reabrirla si hace falta.", { format: format(new Date(), "d MMM yyyy", { locale: dfl }) })}</Warn>}
                {noTable.length > 0 && <Warn>{(noTable.length === 1 ? t("Sin clasificación de la FCF para {n} equipo ({names}): su historial se guardará sin posición.", { n: 1, names: noTable.slice(0, 6).map((tm) => tm.name).join(", ") + (noTable.length > 6 ? "…" : "") }) : t("Sin clasificación de la FCF para {n} equipos ({names}): su historial se guardará sin posición.", { n: noTable.length, names: noTable.slice(0, 6).map((tm) => tm.name).join(", ") + (noTable.length > 6 ? "…" : "") }))}</Warn>}
              </div>
              <div className="pt-1 space-y-2">
                <p className="text-xs text-gray-500">{t("Al cerrar, se guarda antes una copia de seguridad completa de los datos (la encuentras en la pestaña Copias).")}</p>
                <p className="text-sm text-gray-700">{t("Para confirmar, escribe")} <b className="font-mono">{word}</b></p>
                <div className="flex flex-wrap gap-2">
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={word} className="w-56" disabled={phase === "closing"} />
                  <Button variant="club" disabled={text.trim().toUpperCase() !== word || phase === "closing"} onClick={doClose} className="gap-2">
                    {phase === "closing" ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Cerrando…")}</> : <>{t("Nueva temporada")} <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                  <Button variant="ghost" disabled={phase === "closing"} onClick={() => { setPhase("idle"); setReview(null); }}>{t("Cancelar")}</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Reabrir la temporada {lbl}?", { lbl: lbl(season) })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Todo vuelve a como estaba antes de cerrar: partidos, estadísticas, asistencia, jugadores y equipos. Se borra el historial que se guardó en el cierre. Lo que hayas creado después (jugadores nuevos, eventos de la nueva temporada) se mantiene.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doReopen(); }} disabled={reopening} className="bg-[var(--granate)] hover:bg-[var(--granate-dark)] text-white">
              {reopening ? t("Reabriendo…") : t("Sí, reabrir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Warn({ children }) {
  return (
    <div className="flex gap-2 items-start text-xs px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900" style={{ borderRadius: "6px" }}>
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" /> <p>{children}</p>
    </div>
  );
}
