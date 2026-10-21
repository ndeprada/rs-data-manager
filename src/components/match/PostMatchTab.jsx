import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Plus, Trash2, ExternalLink, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { playerFullName } from "@/lib/playerName";
import { calcMinutesPlayed, getMatchMinutes } from "@/components/match/ActaTab";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/common/SaveStatus";
import { useT, msg } from "@/i18n";

const POSITION_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];
const STAR_LABELS = ["", msg("Mal"), msg("Bien"), msg("Muy bien")];
// Valoración rápida del equipo en el partido (misma escala de 3 estrellas que la de jugadores)
const TEAM_EVAL = [
  ["actitud", msg("Actitud y compromiso")],
  ["organizacion", msg("Organización sin balón")],
  ["juego", msg("Juego con balón")],
  ["intensidad", msg("Intensidad y ritmo")],
];

function Stars({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0" title={STAR_LABELS[value || 0]}>
      {[1, 2, 3].map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? 0 : s)} className="p-0.5">
          <Star className={`w-4 h-4 ${s <= (value || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
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

export default function PostMatchTab({ eventId, teamId, event, players, convocation, team }) {
  const t = useT();
  const qc = useQueryClient();
  const starterIds = convocation?.starters || [];
  const convocadoIds = convocation?.player_ids || [];

  const { data: stats = [], isFetched } = useQuery({
    queryKey: ["matchstats-event", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  // Jugadores que han jugado: titulares, entradas por cambio y los que ya tienen minutos en el acta
  const played = useMemo(() => {
    const ids = new Set(starterIds);
    (event?.match_events || []).forEach((e) => { if (e.type === "sub" && e.playerIn) ids.add(e.playerIn); });
    stats.forEach((s) => { if ((s.minutes_played || 0) > 0) ids.add(s.player_id); });
    (event?.match_events || []).forEach((e) => { if (e.team === "home" && e.playerId) ids.add(e.playerId); });
    let list = players.filter((p) => ids.has(p.id));
    // Sin once titular marcado (o acta sin rellenar): se muestran todos los convocados
    if (!starterIds.length || !list.length) list = players.filter((p) => convocadoIds.includes(p.id) || ids.has(p.id));
    return list.sort((a, b) => {
      const ai = POSITION_ORDER.indexOf(a.position ?? ""), bi = POSITION_ORDER.indexOf(b.position ?? "");
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || (a.last_name || "").localeCompare(b.last_name || "");
    });
  }, [players, starterIds, convocadoIds, stats, event?.match_events]);

  // Valoraciones del equipo en los demás partidos, para comparar con la media
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

  const [teamEval, setTeamEval] = useState({});
  const [rows, setRows] = useState({}); // playerId -> { rating, notes }
  const [team_notes, setTeamNotes] = useState("");
  const [rival_notes, setRivalNotes] = useState("");
  const [links, setLinks] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [playing, setPlaying] = useState(null);
  const [seeded, setSeeded] = useState(false);

  // MatchStats ya conocidos por jugador: así un guardado nuevo no vuelve a crear uno que acaba de crearse
  const known = useRef(new Map());
  useEffect(() => { stats.forEach((s) => known.current.set(s.player_id, s)); }, [stats]);

  const form = { rows, teamEval, team_notes, rival_notes, links };
  const autosave = useAutosave({
    value: form,
    enabled: seeded,
    save: async (v) => {
      const matchMinutes = getMatchMinutes(event?.football_format, event?.match_duration, team);
      for (const p of played) {
        const row = v.rows[p.id] || {};
        const existing = known.current.get(p.id);
        const rating = row.rating || null;
        const notes = (row.notes || "").trim();
        if (existing) {
          if ((existing.rating || null) === rating && (existing.notes || "") === notes) continue;
          const updated = { ...existing, rating, notes };
          await base44.entities.MatchStats.update(existing.id, updated);
          known.current.set(p.id, updated);
        } else if (rating || notes) {
          const isStarter = starterIds.includes(p.id);
          const created = await base44.entities.MatchStats.create({
            player_id: p.id, event_id: eventId,
            date: event?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
            opponent: event?.opponent || "",
            starter: isStarter,
            minutes_played: calcMinutesPlayed(p.id, starterIds, event?.match_events || [], matchMinutes),
            goals: 0, assists: 0, yellow_cards: 0, double_yellow_card: 0, red_cards: 0,
            rating, notes,
          });
          if (created?.id) known.current.set(p.id, created);
        }
      }
      await base44.entities.Event.update(eventId, {
        team_eval: Object.values(v.teamEval).some(Boolean) ? v.teamEval : null,
        analysis_notes_team: v.team_notes.trim() || null,
        analysis_notes_rival: v.rival_notes.trim() || null,
        video_links: v.links,
      });
      qc.invalidateQueries({ queryKey: ["matchstats-event", eventId] });
      qc.invalidateQueries({ queryKey: ["matchstats"] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  useEffect(() => {
    if (seeded || !isFetched || !event) return;
    const r = {};
    stats.forEach((s) => { r[s.player_id] = { rating: s.rating || 0, notes: s.notes || "" }; });
    const loaded = { rows: r, teamEval: event.team_eval || {}, team_notes: event.analysis_notes_team || "", rival_notes: event.analysis_notes_rival || "", links: event.video_links || [] };
    setRows(loaded.rows);
    setTeamEval(loaded.teamEval);
    setTeamNotes(loaded.team_notes);
    setRivalNotes(loaded.rival_notes);
    setLinks(loaded.links);
    autosave.reset(loaded);
    setSeeded(true);
  }, [seeded, isFetched, event, stats]);

  const setRow = (pid, patch) => { setRows((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } })); };

  const addLink = () => {
    let url = newUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setLinks((l) => [...l, { url, title: newTitle.trim() || platformOf(url) || t("Vídeo del partido"), added_at: new Date().toISOString() }]);
    setNewUrl(""); setNewTitle("");
  };

  const card = "bg-white border border-gray-200 rounded-xl p-4 space-y-3";
  const h = "text-sm font-bold text-gray-900";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{t("Las valoraciones y correcciones de cada jugador quedan guardadas en su ficha, en Estadísticas → Correcciones.")}</p>
        <SaveStatus state={autosave.state} onRetry={autosave.flush} className="shrink-0" />
      </div>

      {/* Valoración rápida del equipo */}
      <div className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={h}>{t("Cómo ha jugado el equipo")}</p>
          {evalAvg.n > 0 && <p className="text-[10px] text-gray-400">{t("Entre paréntesis, la media {v}", { v: evalAvg.n === 1 ? t("del otro partido valorado") : t("de los otros {n} partidos valorados", { n: evalAvg.n }) })}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {TEAM_EVAL.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-700 min-w-0">{t(label)}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {evalAvg[k] != null && <span className="text-[10px] text-gray-400 tabular-nums">({evalAvg[k].toFixed(1).replace(".", ",")})</span>}
                <Stars value={teamEval[k] || 0} onChange={(v) => setTeamEval((t) => ({ ...t, [k]: v }))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vídeo: miniatura compacta; al pulsar play la tarjeta se ensancha y aparece el reproductor grande */}
      <div className={card}>
        <p className={h}>{t("Vídeo del partido")}</p>
        {links.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {links.map((l, i) => {
              const emb = embedOf(l.url);
              const thumb = youtubeThumb(l.url);
              const isPlaying = playing === i && !!emb;
              const open = () => { if (emb) setPlaying(isPlaying ? null : i); else window.open(l.url, "_blank", "noopener"); };
              return (
                <div key={i} className={`rounded-xl border bg-white overflow-hidden ${isPlaying ? "sm:col-span-2 border-[#73000A]" : "border-gray-200"}`}>
                  <div className="flex items-center gap-3 p-2">
                    <button type="button" onClick={open} className="relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden bg-gray-900 group" title={emb ? (isPlaying ? t("Cerrar el reproductor") : t("Reproducir aquí")) : t("Abrir vídeo")}>
                      {thumb && <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow transition-transform group-hover:scale-110" style={{ background: "var(--granate)" }}>
                          {isPlaying ? <X className="w-4 h-4" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-white" />}
                        </span>
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{l.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {isPlaying ? t("Reproduciendo") : emb ? t("Pulsa play para verlo aquí") : t("Se abre en {site}", { site: platformOf(l.url) || t("otra pestaña") })}
                      </p>
                    </div>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" title={t("Abrir en una pestaña nueva")} className="p-1 text-gray-400 hover:text-gray-700"><ExternalLink className="w-3.5 h-3.5" /></a>
                    <button type="button" title={t("Quitar el vídeo")} onClick={() => { setLinks((x) => x.filter((_, j) => j !== i)); setPlaying(null); }} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isPlaying && (
                    <div className="px-2 pb-2">
                      <div className="rounded-lg overflow-hidden bg-black aspect-video w-full max-w-4xl mx-auto">
                        {emb.kind === "iframe"
                          ? <iframe src={emb.src} title={l.title || t("Vídeo del partido")} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                          : <video src={emb.src} controls autoPlay className="w-full h-full" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder={t("Enlace de YouTube, Vimeo, Veo…")} className="h-8 text-sm border-gray-200" />
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("Título (opcional)")} className="h-8 text-sm border-gray-200 sm:max-w-[180px]" />
          <Button size="sm" variant="outline" className="h-8" onClick={addLink} disabled={!newUrl.trim()}><Plus className="w-3.5 h-3.5 mr-1" />{t("Añadir")}</Button>
        </div>
        <p className="text-[10px] text-gray-400">{t("YouTube, Vimeo y archivos de vídeo directos se reproducen aquí. Con otras plataformas (Veo…) el botón abre el vídeo en una pestaña nueva.")}</p>
      </div>

      {/* Jugadores */}
      <div className={card}>
        <p className={h}>{t("Valoración y correcciones por jugador")} <span className="text-gray-400 font-normal">({played.length})</span></p>
        {played.length === 0 ? (
          <p className="text-xs text-gray-400">{t("Aún no hay jugadores convocados para este partido.")}</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {played.map((p) => {
              const row = rows[p.id] || {};
              return (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2">
                  <div className="sm:w-48 shrink-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{playerFullName(p)}</p>
                    <p className="text-[10px] text-gray-400">{starterIds.length ? (starterIds.includes(p.id) ? t("Titular") : t("Suplente")) : ""}</p>
                  </div>
                  <Stars value={row.rating || 0} onChange={(v) => setRow(p.id, { rating: v })} />
                  <Textarea value={row.notes || ""} onChange={(e) => setRow(p.id, { notes: e.target.value })} rows={1}
                    placeholder={t("Corrección o valoración…")} className="text-xs border-gray-200 min-h-[32px] py-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Observaciones */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className={card}>
          <p className={h}>{t("Observaciones del partido")}</p>
          <Textarea value={team_notes} onChange={(e) => setTeamNotes(e.target.value)} rows={6}
            placeholder={t("Correcciones generales del equipo, qué funcionó, qué hay que mejorar…")} className="text-sm border-gray-200" />
        </div>
        <div className={card}>
          <p className={h}>{t("Sobre el rival{v}", { v: event?.opponent ? ` · ${event.opponent}` : "" })}</p>
          <Textarea value={rival_notes} onChange={(e) => setRivalNotes(e.target.value)} rows={6}
            placeholder={t("Cómo juegan, jugadores a vigilar, balón parado… para la próxima vez que nos enfrentemos.")} className="text-sm border-gray-200" />
        </div>
      </div>
    </div>
  );
}
