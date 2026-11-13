// Postpartido (rediseño del 13/11/2026 con el diseño rs2, maqueta «Maqueta Postpartido · RS Manager» aprobada por Nacho
// con sus siete propuestas). Valoración por jugador con minutos y acciones del acta, media de la temporada y jugador del
// partido; cómo ha jugado el equipo con los últimos partidos; observaciones en tres apartados («Para el próximo entreno»
// sale también en la hoja de la siguiente sesión del equipo); vídeo; notas del rival, que vuelven a salir en Preparación
// la próxima vez que se juegue contra él. Cálculos puros en src/lib/postMatch.js.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Star, Plus, Trash2, ExternalLink, Play, X } from "lucide-react";
import { RS } from "@/components/rs2/kit";
import { playerFullName } from "@/lib/playerName";
import { calcMinutesPlayed, getMatchMinutes } from "@/components/match/ActaTab";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/common/SaveStatus";
import { useT, useDateLocale, msg } from "@/i18n";
import { matchFormat } from "@/lib/matchFormat";
import { withMatchDorsals } from "@/lib/matchDorsals";
import { squadGroups } from "@/lib/myTeamStats";
import { cleanPostNotes, ratingAverages, ratingTrend, evalHistory, nextVsRival, POST_SECTIONS } from "@/lib/postMatch";
import { useIsMobile } from "@/hooks/use-mobile";

const STAR_LABELS = ["", msg("Mal"), msg("Bien"), msg("Muy bien")];
const STAR_ON = "#F59E0B";
// Valoración rápida del equipo en el partido (misma escala de 3 estrellas que la de jugadores)
const TEAM_EVAL = [
  ["actitud", msg("Actitud y compromiso")],
  ["organizacion", msg("Organización sin balón")],
  ["juego", msg("Juego con balón")],
  ["intensidad", msg("Intensidad y ritmo")],
];
const SECTIONS = {
  good: { title: msg("Lo que ha funcionado"), color: "#15803D" },
  improve: { title: msg("A mejorar"), color: "#B91C1C" },
  training: { title: msg("Para el próximo entreno"), color: "#2563EB" },
};
const POS_SHORT = { portero: "POR", central: "CT", libre: "LIB", lateral: "LAT", mediocentro: "MC", interior: "INT", mediapunta: "MP", extremo: "EXT", delantero_centro: "DC" };
const SORTS = [["pos", msg("Por posición")], ["min", msg("Más minutos")], ["sin", msg("Sin valorar")]];
const EVAL_DOT = ["#E3D9D8", "#FCA5A5", "#FCD34D", "#86EFAC"];

function Stars({ value, onChange, size = 17, testId }) {
  const t = useT();
  return (
    <div className="flex items-center shrink-0" style={{ gap: 1 }} title={t(STAR_LABELS[value || 0])} data-testid={testId} data-value={value || 0}>
      {[1, 2, 3].map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)} style={{ padding: 1 }} aria-label={t(STAR_LABELS[s])}>
          <Star style={{ width: size, height: size }} fill={s <= (value || 0) ? STAR_ON : "none"} color={s <= (value || 0) ? STAR_ON : "#D6CDCE"} />
        </button>
      ))}
    </div>
  );
}

function Title({ children, extra }) {
  return (
    <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
      <div style={{ borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 8 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granateDark }}>{children}</span></div>
      {extra}
    </div>
  );
}

// Enlace de vídeo → reproductor incrustado cuando la plataforma lo permite
function embedOf(url) {
  const u = String(url || "");
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/))) return { kind: "iframe", src: `https://www.youtube.com/embed/${m[1]}?rel=0&autoplay=1` };
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}?autoplay=1` };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return { kind: "file", src: u };
  return null;
}
const youtubeThumb = (url) => {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
};
const platformOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// Una lista de observaciones: puntos que se escriben uno a uno
function NoteList({ k, items, onChange, mobile }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const sec = SECTIONS[k];
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...items, v]); setDraft(""); };
  return (
    <div style={{ flex: "1 1 200px", minWidth: 0, border: `1px solid ${RS.line}`, borderTop: `3px solid ${sec.color}`, borderRadius: 10, padding: "8px 10px" }} data-testid={`post-notes-${k}`}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: sec.color, textTransform: "uppercase", marginBottom: 4 }}>{t(sec.title)}</div>
      {items.map((it, i) => (
        <div key={i} className="flex items-start group" style={{ gap: 6, fontSize: 12.5, color: RS.ink, padding: "3px 0" }}>
          <span style={{ color: sec.color }}>•</span>
          <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: mobile ? 16 : 12.5 }} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t("Quitar")} className="opacity-40 hover:opacity-100" style={{ color: RS.muted }}><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add}
        placeholder={t("+ añadir…")} data-testid={`post-add-${k}`} className="w-full bg-transparent outline-none" style={{ fontSize: mobile ? 16 : 12.5, padding: "3px 0", color: RS.ink }} />
    </div>
  );
}

export default function PostMatchTab({ eventId, teamId, event, players, convocation, team }) {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const mobile = useIsMobile();
  const starterIds = convocation?.starters || [];
  const convocadoIds = convocation?.player_ids || [];
  const roster = useMemo(() => withMatchDorsals(players, convocation?.match_dorsals), [players, convocation?.match_dorsals]);

  const { data: stats = [], isFetched } = useQuery({
    queryKey: ["matchstats-event", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });
  const { data: allStats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const statOf = useMemo(() => new Map(stats.map((s) => [s.player_id, s])), [stats]);
  const avgs = useMemo(() => ratingAverages(allStats, eventId), [allStats, eventId]);

  // Jugadores que han jugado: titulares, entradas por cambio y los que ya tienen minutos en el acta
  const played = useMemo(() => {
    const ids = new Set(starterIds);
    (event?.match_events || []).forEach((e) => { if (e.type === "sub" && e.playerIn) ids.add(e.playerIn); });
    stats.forEach((s) => { if ((s.minutes_played || 0) > 0) ids.add(s.player_id); });
    (event?.match_events || []).forEach((e) => { if (e.team === "home" && e.playerId) ids.add(e.playerId); });
    let list = roster.filter((p) => ids.has(p.id));
    // Sin once titular marcado (o acta sin rellenar): se muestran todos los convocados
    if (!starterIds.length || !list.length) list = roster.filter((p) => convocadoIds.includes(p.id) || ids.has(p.id));
    return list;
  }, [roster, starterIds, convocadoIds, stats, event?.match_events]);
  const notPlayed = useMemo(() => roster.filter((p) => convocadoIds.includes(p.id) && !played.some((x) => x.id === p.id)), [roster, convocadoIds, played]);

  // Partidos del equipo: media del equipo, evolución y próximo contra este rival
  const tid = teamId || event?.team_id;
  const { data: allEvents = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date"), enabled: !!tid });
  const evalAvg = useMemo(() => {
    const prev = allEvents.filter((e) => e.team_id === tid && e.id !== eventId && e.team_eval);
    const out = { n: prev.length };
    for (const [k] of TEAM_EVAL) {
      const vals = prev.map((e) => e.team_eval[k]).filter((v) => v > 0);
      out[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    return out;
  }, [allEvents, tid, eventId]);
  const history = useMemo(() => evalHistory(allEvents, event, TEAM_EVAL.map(([k]) => k)), [allEvents, event]);
  const nextRival = useMemo(() => nextVsRival(allEvents, event), [allEvents, event]);

  const [teamEval, setTeamEval] = useState({});
  const [rows, setRows] = useState({}); // playerId -> { rating, notes }
  const [team_notes, setTeamNotes] = useState("");
  const [rival_notes, setRivalNotes] = useState("");
  const [notes, setNotes] = useState({ good: [], improve: [], training: [] });
  const [mvp, setMvp] = useState(null);
  const [links, setLinks] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [playing, setPlaying] = useState(null);
  const [seeded, setSeeded] = useState(false);
  const [sort, setSort] = useState("pos");

  // MatchStats ya conocidos por jugador: así un guardado nuevo no vuelve a crear uno que acaba de crearse
  const known = useRef(new Map());
  useEffect(() => { stats.forEach((s) => known.current.set(s.player_id, s)); }, [stats]);

  const form = { rows, teamEval, team_notes, rival_notes, links, notes, mvp };
  const autosave = useAutosave({
    value: form,
    enabled: seeded,
    save: async (v) => {
      const matchMinutes = getMatchMinutes(matchFormat(event, team), event?.match_duration, team);
      for (const p of played) {
        const row = v.rows[p.id] || {};
        const existing = known.current.get(p.id);
        const rating = row.rating || null;
        const note = (row.notes || "").trim();
        if (existing) {
          if ((existing.rating || null) === rating && (existing.notes || "") === note) continue;
          const updated = { ...existing, rating, notes: note };
          await base44.entities.MatchStats.update(existing.id, updated);
          known.current.set(p.id, updated);
        } else if (rating || note) {
          const isStarter = starterIds.includes(p.id);
          const created = await base44.entities.MatchStats.create({
            player_id: p.id, event_id: eventId,
            date: event?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
            opponent: event?.opponent || "",
            starter: isStarter,
            minutes_played: calcMinutesPlayed(p.id, starterIds, event?.match_events || [], matchMinutes),
            goals: 0, assists: 0, yellow_cards: 0, double_yellow_card: 0, red_cards: 0,
            rating, notes: note,
          });
          if (created?.id) known.current.set(p.id, created);
        }
      }
      await base44.entities.Event.update(eventId, {
        team_eval: Object.values(v.teamEval).some(Boolean) ? v.teamEval : null,
        analysis_notes_team: v.team_notes.trim() || null,
        analysis_notes_rival: v.rival_notes.trim() || null,
        post_notes: cleanPostNotes(v.notes),
        mvp_player_id: v.mvp || null,
        video_links: v.links,
      });
      qc.invalidateQueries({ queryKey: ["matchstats-event", eventId] });
      qc.invalidateQueries({ queryKey: ["matchstats"] });
      qc.invalidateQueries({ queryKey: ["matchstats_all"] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  useEffect(() => {
    if (seeded || !isFetched || !event) return;
    const r = {};
    stats.forEach((s) => { r[s.player_id] = { rating: s.rating || 0, notes: s.notes || "" }; });
    const loaded = {
      rows: r, teamEval: event.team_eval || {}, team_notes: event.analysis_notes_team || "", rival_notes: event.analysis_notes_rival || "",
      links: event.video_links || [], notes: cleanPostNotes(event.post_notes), mvp: event.mvp_player_id || null,
    };
    setRows(loaded.rows); setTeamEval(loaded.teamEval); setTeamNotes(loaded.team_notes); setRivalNotes(loaded.rival_notes);
    setLinks(loaded.links); setNotes(loaded.notes); setMvp(loaded.mvp);
    autosave.reset(loaded);
    setSeeded(true);
  }, [seeded, isFetched, event, stats]);

  const setRow = (pid, patch) => { setRows((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } })); };

  const addLink = () => {
    let url = newUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setLinks((l) => [...l, { url, title: platformOf(url) || t("Vídeo del partido"), added_at: new Date().toISOString() }]);
    setNewUrl("");
  };

  // ── Filas de jugadores ──
  const items = useMemo(() => played.map((p) => {
    const s = statOf.get(p.id) || {};
    return { p, mins: s.minutes_played || 0, starter: starterIds.includes(p.id), goals: s.goals || 0, assists: s.assists || 0, yellow: (s.yellow_cards || 0) + (s.double_yellow_card ? 1 : 0), red: (s.red_cards || 0) + (s.double_yellow_card ? 1 : 0), avg: avgs.get(p.id) };
  }), [played, statOf, starterIds, avgs]);
  const rated = items.filter((x) => rows[x.p.id]?.rating).length;
  const groups = useMemo(() => {
    if (sort === "pos") return squadGroups(items);
    const list = [...items];
    if (sort === "min") list.sort((a, b) => b.mins - a.mins);
    else list.sort((a, b) => (rows[a.p.id]?.rating ? 1 : 0) - (rows[b.p.id]?.rating ? 1 : 0) || b.mins - a.mins);
    return [{ key: "all", label: "", rows: list }];
  }, [items, sort, rows]);

  const actions = (x) => (
    <span className="inline-flex items-center" style={{ gap: 3, fontSize: 12, flexWrap: "nowrap" }}>
      {x.goals > 0 && <span title={t("Goles")} style={{ whiteSpace: "nowrap" }}>⚽{x.goals > 1 ? <b style={{ fontSize: 10.5 }}>{x.goals}</b> : ""}</span>}
      {x.assists > 0 && <span title={t("Asistencias")} style={{ fontSize: 10.5, fontWeight: 800, color: RS.granate, border: `1px solid ${RS.granate}`, borderRadius: 3, padding: "0 3px" }}>A{x.assists > 1 ? x.assists : ""}</span>}
      {x.yellow > 0 && <span title={t("Amarilla")} style={{ width: 8, height: 11, background: "#FACC15", borderRadius: 1.5, display: "inline-block" }} />}
      {x.red > 0 && <span title={t("Roja")} style={{ width: 8, height: 11, background: "#DC2626", borderRadius: 1.5, display: "inline-block" }} />}
    </span>
  );
  const trendEl = (x) => {
    const v = rows[x.p.id]?.rating || 0;
    if (!x.avg) return <span style={{ width: 70 }} />;
    const tr = ratingTrend(v, x.avg.avg);
    const [arr, col] = tr === "up" ? ["▲", "#15803D"] : tr === "down" ? ["▼", "#B91C1C"] : tr === "eq" ? ["=", RS.muted] : ["", RS.muted];
    return <span title={t("Su media de la temporada ({n} partidos valorados)", { n: x.avg.n })} style={{ width: 70, textAlign: "right", fontSize: 11, color: RS.muted, whiteSpace: "nowrap" }}>{t("media {v}", { v: String(x.avg.avg).replace(".", ",") })} <b style={{ color: col }}>{arr}</b></span>;
  };
  const mvpBtn = (x) => (
    <button type="button" onClick={() => setMvp(mvp === x.p.id ? null : x.p.id)} title={mvp === x.p.id ? t("Jugador del partido (quitar)") : t("Marcar como jugador del partido")}
      data-testid={`post-mvp-${x.p.id}`} data-on={mvp === x.p.id ? "1" : "0"}
      style={{ fontSize: 15, lineHeight: 1, padding: 0, background: "none", border: 0, opacity: mvp === x.p.id ? 1 : 0.2, filter: mvp === x.p.id ? "none" : "grayscale(1)" }}>🏅</button>
  );
  const row = (x) => {
    const r = rows[x.p.id] || {};
    const minLine = `${x.mins}’${x.starter ? "" : " ↑"}`;
    if (mobile) {
      return (
        <div key={x.p.id} style={{ padding: "8px 0", borderTop: "1px solid #F3EEEE" }} data-testid={`post-row-${x.p.id}`}>
          <div className="flex items-center" style={{ gap: 8, fontSize: 13 }}>
            <span className="rs2-display tabular-nums" style={{ fontSize: 17, color: RS.granate, width: 22, textAlign: "right" }}>{x.p.jersey_number ?? "·"}</span>
            <span className="flex-1 min-w-0"><b>{playerFullName(x.p)}</b> <span style={{ fontSize: 11, color: RS.muted }}>{POS_SHORT[x.p.position] || ""} · {minLine}</span> {actions(x)}</span>
            {mvpBtn(x)}
            <Stars value={r.rating || 0} onChange={(v) => setRow(x.p.id, { rating: v })} size={22} testId={`post-stars-${x.p.id}`} />
          </div>
          <input value={r.notes || ""} onChange={(e) => setRow(x.p.id, { notes: e.target.value })} placeholder={t("+ corrección")}
            className="bg-transparent outline-none" style={{ marginLeft: 30, width: "calc(100% - 30px)", fontSize: 16, color: RS.ink2, padding: "3px 0" }} />
        </div>
      );
    }
    return (
      <div key={x.p.id} className="flex items-center" style={{ gap: 8, padding: "4px 6px", borderTop: "1px solid #F3EEEE", fontSize: 12, background: r.rating ? undefined : "#FFFBF5" }} data-testid={`post-row-${x.p.id}`}>
        <span className="rs2-display tabular-nums" style={{ fontSize: 16, color: RS.granate, width: 24, textAlign: "right" }}>{x.p.jersey_number ?? "·"}</span>
        <Link to={`/PlayerProfile?id=${x.p.id}`} className="truncate" style={{ width: 160, minWidth: 0 }}><b style={{ color: RS.ink }}>{playerFullName(x.p)}</b> <span style={{ color: RS.muted }}>{POS_SHORT[x.p.position] || ""}</span></Link>
        <span className="tabular-nums" style={{ width: 44, fontSize: 11, color: RS.muted, whiteSpace: "nowrap" }} title={x.starter ? t("Titular") : t("Entró desde el banquillo")}>{minLine}</span>
        <span style={{ width: 54, whiteSpace: "nowrap" }}>{actions(x)}</span>
        {mvpBtn(x)}
        <Stars value={r.rating || 0} onChange={(v) => setRow(x.p.id, { rating: v })} testId={`post-stars-${x.p.id}`} />
        {trendEl(x)}
        <input value={r.notes || ""} onChange={(e) => setRow(x.p.id, { notes: e.target.value })} placeholder={t("Corrección o valoración…")} title={r.notes || undefined}
          data-testid={`post-note-${x.p.id}`} className="flex-1 min-w-0 outline-none focus:border-[#B9AEAF]"
          style={{ fontSize: 12, color: RS.ink2, padding: "4px 8px", border: `1px ${r.notes ? "solid" : "dashed"} ${RS.line}`, borderRadius: 7, background: "#fff" }} />
      </div>
    );
  };

  const groupHead = (g) => (
    <div className="flex items-center" style={{ gap: 8, margin: "8px 0 2px", padding: "4px 8px", background: RS.soft, borderLeft: `3px solid ${RS.naranja}`, borderRadius: "0 6px 6px 0" }}>
      <span className="rs2-display" style={{ fontSize: 14, textTransform: "uppercase", color: RS.granateDark }}>{t(g.label)}</span>
      <span style={{ marginLeft: "auto", fontSize: 11, color: RS.muted }}>{t("{a} de {b} valorados", { a: g.rows.filter((x) => rows[x.p.id]?.rating).length, b: g.rows.length })}</span>
    </div>
  );

  const seg = (opts, value, onChange) => (
    <div className="inline-flex" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {opts.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} data-testid={`post-sort-${k}`}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, fontWeight: value === k ? 700 : 500, background: value === k ? "#fff" : "transparent", color: value === k ? RS.granate : RS.ink2, boxShadow: value === k ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{t(l)}</button>
      ))}
    </div>
  );

  const card = { background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, padding: mobile ? 10 : "12px 14px" };

  const playersCard = (
    <section style={card} data-testid="post-players">
      <Title extra={<>
        <span className="rs2-display tabular-nums" style={{ fontSize: 22, color: RS.granate, marginLeft: 4 }}>{rated}</span>
        <span style={{ fontSize: 12, color: RS.ink2 }}>{t("de {n} valorados", { n: items.length })}</span>
        {!mobile && items.length > 0 && <span style={{ width: 90, height: 6, borderRadius: 9, background: "#F1ECEC", overflow: "hidden", display: "inline-block" }}><span style={{ display: "block", height: "100%", width: `${Math.round((rated / items.length) * 100)}%`, background: RS.naranja }} /></span>}
        {!mobile && <span style={{ marginLeft: "auto" }}>{seg(SORTS, sort, setSort)}</span>}
      </>}>{t("Valoración por jugador")}</Title>
      {!mobile && (
        <div className="flex flex-wrap" style={{ gap: 10, fontSize: 11, color: RS.muted, marginBottom: 2 }}>
          <span>{t("1 estrella Mal · 2 Bien · 3 Muy bien")}</span><span>· {t("minutos y acciones del acta")}</span><span>· 🏅 {t("jugador del partido")}</span><span>· {t("media de la temporada: ▲ hoy por encima, ▼ por debajo")}</span>
        </div>
      )}
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: RS.faint, padding: "8px 0" }}>{t("Aún no hay jugadores convocados para este partido.")}</p>
      ) : groups.map((g) => (
        <div key={g.key}>
          {g.label && groupHead(g)}
          {g.rows.map(row)}
        </div>
      ))}
      <p style={{ fontSize: 11, color: RS.muted, marginTop: 8 }}>
        {notPlayed.length > 0 && <>{t("No jugaron:")} {notPlayed.map((p) => `${p.jersey_number ?? ""} ${playerFullName(p)}`.trim()).join(" · ")}. </>}
        {t("Las valoraciones y correcciones quedan en la ficha de cada jugador.")}
      </p>
    </section>
  );

  const notesCard = (
    <section style={card} data-testid="post-observations">
      <Title>{t("Observaciones del partido")}</Title>
      <div className="flex flex-wrap" style={{ gap: 10 }}>
        {POST_SECTIONS.map((k) => <NoteList key={k} k={k} items={notes[k] || []} mobile={mobile} onChange={(v) => setNotes((n) => ({ ...n, [k]: v }))} />)}
      </div>
      <p style={{ fontSize: 11, color: RS.muted, marginTop: 6 }}>{t("«Para el próximo entreno» sale también en la hoja de la siguiente sesión del equipo.")}</p>
      {team_notes.trim() && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: RS.muted, textTransform: "uppercase", marginBottom: 3 }}>{t("Otras observaciones")}</div>
          <textarea value={team_notes} onChange={(e) => setTeamNotes(e.target.value)} rows={3} className="w-full outline-none"
            style={{ fontSize: mobile ? 16 : 12.5, border: `1px solid ${RS.line}`, borderRadius: 8, padding: "6px 9px", color: RS.ink }} />
        </div>
      )}
    </section>
  );

  const teamCard = (
    <section style={card} data-testid="post-team-eval">
      <Title>{t("Cómo ha jugado el equipo")}</Title>
      <p style={{ fontSize: 11, color: RS.muted, margin: "-4px 0 4px" }}>
        {t("Cuadritos: los últimos partidos")}{evalAvg.n > 0 ? ` · ${evalAvg.n === 1 ? t("media del otro partido valorado") : t("media de los {n} valorados", { n: evalAvg.n })}` : ""}
      </p>
      {TEAM_EVAL.map(([k, label]) => (
        <div key={k} className="flex items-center" style={{ gap: 8, padding: "5px 0", borderTop: "1px solid #F3EEEE", fontSize: 12.5 }}>
          <span className="flex-1 min-w-0">{t(label)}</span>
          <span className="inline-flex" style={{ gap: 2 }} title={t("Últimos partidos")}>
            {(history[k] || []).map((v, i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 3, background: EVAL_DOT[v] || EVAL_DOT[0] }} />)}
          </span>
          {evalAvg[k] != null && <span className="tabular-nums" style={{ fontSize: 11, color: RS.muted, width: 56, textAlign: "right" }}>{t("media {v}", { v: evalAvg[k].toFixed(1).replace(".", ",") })}</span>}
          <Stars value={teamEval[k] || 0} onChange={(v) => setTeamEval((x) => ({ ...x, [k]: v }))} size={16} testId={`post-team-${k}`} />
        </div>
      ))}
    </section>
  );

  const videoCard = (
    <section style={card} data-testid="post-video">
      <Title>{t("Vídeo del partido")}</Title>
      {links.map((l, i) => {
        const emb = embedOf(l.url);
        const thumb = youtubeThumb(l.url);
        const isPlaying = playing === i && !!emb;
        const open = () => { if (emb) setPlaying(isPlaying ? null : i); else window.open(l.url, "_blank", "noopener"); };
        return (
          <div key={i} style={{ padding: "6px 0", borderTop: "1px solid #F3EEEE" }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <button type="button" onClick={open} className="relative shrink-0 rounded-lg overflow-hidden group" style={{ width: 76, aspectRatio: "16/9", background: "linear-gradient(135deg,#1f3d22,#2f6b35)" }} title={emb ? (isPlaying ? t("Cerrar el reproductor") : t("Reproducir aquí")) : t("Abrir vídeo")}>
                {thumb && <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110" style={{ background: RS.granate }}>
                    {isPlaying ? <X className="w-3.5 h-3.5" /> : <Play className="w-3 h-3 ml-0.5 fill-white" />}
                  </span>
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <input value={l.title || ""} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} className="w-full bg-transparent outline-none font-bold" style={{ fontSize: 12.5, color: RS.ink }} />
                <p style={{ fontSize: 11, color: RS.muted }} className="truncate">{isPlaying ? t("Reproduciendo") : emb ? t("Se ve aquí") : t("Se abre en {site}", { site: platformOf(l.url) || t("otra pestaña") })}</p>
              </div>
              <a href={l.url} target="_blank" rel="noopener noreferrer" title={t("Abrir en una pestaña nueva")} style={{ color: RS.faint }}><ExternalLink className="w-3.5 h-3.5" /></a>
              <button type="button" title={t("Quitar el vídeo")} onClick={() => { setLinks((x) => x.filter((_, j) => j !== i)); setPlaying(null); }} style={{ color: RS.faint }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            {isPlaying && (
              <div className="rounded-lg overflow-hidden bg-black aspect-video w-full" style={{ marginTop: 6 }}>
                {emb.kind === "iframe"
                  ? <iframe src={emb.src} title={l.title || t("Vídeo del partido")} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                  : <video src={emb.src} controls autoPlay className="w-full h-full" />}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex" style={{ gap: 6, marginTop: 8 }}>
        <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder={t("Enlace de YouTube, Vimeo, Veo…")}
          data-testid="post-video-url" className="flex-1 min-w-0 outline-none" style={{ fontSize: mobile ? 16 : 12.5, padding: "6px 9px", border: `1px solid ${RS.line}`, borderRadius: 8 }} />
        <button type="button" onClick={addLink} disabled={!newUrl.trim()} className="inline-flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 700, padding: "6px 11px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, opacity: newUrl.trim() ? 1 : 0.5 }}><Plus className="w-3.5 h-3.5" />{t("Añadir")}</button>
      </div>
      <Link to="/Video" data-testid="post-video-tool" style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 700, color: RS.granate }}>{t("Analizar el vídeo en Herramientas → Vídeo ›")}</Link>
    </section>
  );

  const rivalCard = (
    <section style={card} data-testid="post-rival">
      <Title>{event?.opponent ? t("Sobre el rival · {rival}", { rival: event.opponent }) : t("Sobre el rival")}</Title>
      <textarea value={rival_notes} onChange={(e) => setRivalNotes(e.target.value)} rows={mobile ? 4 : 5} data-testid="post-rival-notes"
        placeholder={t("Cómo juegan, jugadores a vigilar, balón parado… para la próxima vez que nos enfrentemos.")}
        className="w-full outline-none" style={{ fontSize: mobile ? 16 : 12.5, lineHeight: 1.45, border: `1px solid ${RS.line}`, borderRadius: 8, padding: "7px 10px", color: RS.ink }} />
      {event?.opponent && (
        <div className="flex items-start" style={{ gap: 8, marginTop: 8, padding: "7px 9px", borderRadius: 9, background: "#EFF6FF", fontSize: 11.5, color: "#1E40AF" }}>
          <span aria-hidden="true">ℹ️</span>
          <span>{nextRival
            ? t("Saldrá en Preparación → Rival cuando volvamos a jugar contra el {rival} ({d}).", { rival: event.opponent, d: format(new Date(nextRival.date), "d MMM", { locale: dfl }) })
            : t("Saldrá en Preparación → Rival la próxima vez que juguemos contra el {rival}.", { rival: event.opponent })}</span>
        </div>
      )}
    </section>
  );

  return (
    <div className="flex flex-col" style={{ gap: 12 }} data-testid="post-match">
      <div className="flex items-center justify-end">
        <SaveStatus state={autosave.state} onRetry={autosave.flush} className="shrink-0" />
      </div>
      {mobile ? (
        <>{playersCard}{teamCard}{notesCard}{videoCard}{rivalCard}</>
      ) : (
        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <div className="flex flex-col" style={{ flex: "2 1 640px", minWidth: 0, gap: 12 }}>{playersCard}{notesCard}</div>
          <div className="flex flex-col" style={{ flex: "1 1 340px", maxWidth: 460, minWidth: 0, gap: 12 }}>{teamCard}{videoCard}{rivalCard}</div>
        </div>
      )}
    </div>
  );
}
