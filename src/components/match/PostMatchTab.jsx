import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Save, Check, Plus, Trash2, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { playerFullName } from "@/lib/playerName";
import { calcMinutesPlayed, getMatchMinutes } from "@/components/match/ActaTab";

const POSITION_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];
const STAR_LABELS = ["", "Mal", "Bien", "Muy bien"];
// Valoración rápida del equipo en el partido (misma escala de 3 estrellas que la de jugadores)
const TEAM_EVAL = [
  ["actitud", "Actitud y compromiso"],
  ["organizacion", "Organización sin balón"],
  ["juego", "Juego con balón"],
  ["intensidad", "Intensidad y ritmo"],
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
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/))) return { kind: "iframe", src: `https://www.youtube.com/embed/${m[1]}?rel=0` };
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
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

export default function PostMatchTab({ eventId, teamId, event, players, convocation }) {
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || !isFetched || !event) return;
    const r = {};
    stats.forEach((s) => { r[s.player_id] = { rating: s.rating || 0, notes: s.notes || "" }; });
    setRows(r);
    setTeamEval(event.team_eval || {});
    setTeamNotes(event.analysis_notes_team || "");
    setRivalNotes(event.analysis_notes_rival || "");
    setLinks(event.video_links || []);
    setSeeded(true);
  }, [seeded, isFetched, event, stats]);

  const setRow = (pid, patch) => { setSaved(false); setRows((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } })); };

  const addLink = () => {
    let url = newUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setLinks((l) => [...l, { url, title: newTitle.trim() || platformOf(url) || "Vídeo del partido", added_at: new Date().toISOString() }]);
    setNewUrl(""); setNewTitle(""); setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const matchMinutes = getMatchMinutes(event?.football_format, event?.match_duration || "2x45");
      for (const p of played) {
        const row = rows[p.id] || {};
        const existing = stats.find((s) => s.player_id === p.id);
        const rating = row.rating || null;
        const notes = (row.notes || "").trim();
        if (existing) {
          if ((existing.rating || null) === rating && (existing.notes || "") === notes) continue;
          await base44.entities.MatchStats.update(existing.id, { ...existing, rating, notes });
        } else if (rating || notes) {
          const isStarter = starterIds.includes(p.id);
          await base44.entities.MatchStats.create({
            player_id: p.id, event_id: eventId,
            date: event?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
            opponent: event?.opponent || "",
            starter: isStarter,
            minutes_played: calcMinutesPlayed(p.id, starterIds, event?.match_events || [], matchMinutes),
            goals: 0, assists: 0, yellow_cards: 0, double_yellow_card: 0, red_cards: 0,
            rating, notes,
          });
        }
      }
      await base44.entities.Event.update(eventId, {
        team_eval: Object.values(teamEval).some(Boolean) ? teamEval : null,
        analysis_notes_team: team_notes.trim() || null,
        analysis_notes_rival: rival_notes.trim() || null,
        video_links: links,
      });
      qc.invalidateQueries({ queryKey: ["matchstats-event", eventId] });
      qc.invalidateQueries({ queryKey: ["matchstats"] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const card = "bg-white border border-gray-200 rounded-xl p-4 space-y-3";
  const h = "text-sm font-bold text-gray-900";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Las valoraciones y correcciones de cada jugador quedan guardadas en su ficha, en Estadísticas → Correcciones.</p>
        <Button variant="club" onClick={save} disabled={saving} className="shrink-0">
          {saved ? <Check className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          {saving ? "Guardando…" : saved ? "Guardado" : "Guardar análisis"}
        </Button>
      </div>

      {/* Valoración rápida del equipo */}
      <div className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={h}>Cómo ha jugado el equipo</p>
          {evalAvg.n > 0 && <p className="text-[10px] text-gray-400">Entre paréntesis, la media {evalAvg.n === 1 ? "del otro partido valorado" : `de los otros ${evalAvg.n} partidos valorados`}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {TEAM_EVAL.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-700 min-w-0">{label}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {evalAvg[k] != null && <span className="text-[10px] text-gray-400 tabular-nums">({evalAvg[k].toFixed(1).replace(".", ",")})</span>}
                <Stars value={teamEval[k] || 0} onChange={(v) => { setSaved(false); setTeamEval((t) => ({ ...t, [k]: v })); }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vídeo */}
      <div className={card}>
        <p className={h}>Vídeo del partido</p>
        {playing != null && links[playing] && (() => {
          const emb = embedOf(links[playing].url);
          return emb ? (
            <div className="rounded-lg overflow-hidden bg-black aspect-video">
              {emb.kind === "iframe"
                ? <iframe src={emb.src} title="Vídeo del partido" className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                : <video src={emb.src} controls autoPlay className="w-full h-full" />}
            </div>
          ) : null;
        })()}
        {links.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {links.map((l, i) => {
              const emb = embedOf(l.url);
              const thumb = youtubeThumb(l.url);
              const open = () => { if (emb) setPlaying(playing === i ? null : i); else window.open(l.url, "_blank", "noopener"); };
              return (
                <div key={i} className={`rounded-xl overflow-hidden border ${playing === i ? "border-[#73000A]" : "border-gray-200"} bg-white`}>
                  <button type="button" onClick={open} className="relative block w-full aspect-video bg-gray-900 group" title={emb ? "Reproducir aquí" : "Abrir vídeo"}>
                    {thumb && <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110" style={{ background: "var(--granate)" }}>
                        <Play className="w-7 h-7 ml-0.5 fill-white" />
                      </span>
                    </span>
                    <span className="absolute left-2 bottom-2 text-[10px] font-bold uppercase tracking-wide text-white/90 bg-black/50 rounded px-1.5 py-0.5">
                      {playing === i ? "Reproduciendo" : emb ? "Ver partido" : `Abrir en ${platformOf(l.url) || "otra pestaña"}`}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <p className="flex-1 min-w-0 text-xs font-bold text-gray-900 truncate">{l.title}</p>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" title="Abrir en una pestaña nueva" className="p-1 text-gray-400 hover:text-gray-700"><ExternalLink className="w-3.5 h-3.5" /></a>
                    <button type="button" onClick={() => { setLinks((x) => x.filter((_, j) => j !== i)); setPlaying(null); setSaved(false); }} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="Enlace de YouTube, Vimeo, Veo…" className="h-8 text-sm border-gray-200" />
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título (opcional)" className="h-8 text-sm border-gray-200 sm:max-w-[180px]" />
          <Button size="sm" variant="outline" className="h-8" onClick={addLink} disabled={!newUrl.trim()}><Plus className="w-3.5 h-3.5 mr-1" />Añadir</Button>
        </div>
        <p className="text-[10px] text-gray-400">YouTube, Vimeo y archivos de vídeo directos se reproducen aquí. Con otras plataformas (Veo…) el botón abre el vídeo en una pestaña nueva.</p>
      </div>

      {/* Jugadores */}
      <div className={card}>
        <p className={h}>Valoración y correcciones por jugador <span className="text-gray-400 font-normal">({played.length})</span></p>
        {played.length === 0 ? (
          <p className="text-xs text-gray-400">Aún no hay jugadores convocados para este partido.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {played.map((p) => {
              const row = rows[p.id] || {};
              return (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2">
                  <div className="sm:w-48 shrink-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{playerFullName(p)}</p>
                    <p className="text-[10px] text-gray-400">{starterIds.length ? (starterIds.includes(p.id) ? "Titular" : "Suplente") : ""}</p>
                  </div>
                  <Stars value={row.rating || 0} onChange={(v) => setRow(p.id, { rating: v })} />
                  <Textarea value={row.notes || ""} onChange={(e) => setRow(p.id, { notes: e.target.value })} rows={1}
                    placeholder="Corrección o valoración…" className="text-xs border-gray-200 min-h-[32px] py-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Observaciones */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className={card}>
          <p className={h}>Observaciones del partido</p>
          <Textarea value={team_notes} onChange={(e) => { setTeamNotes(e.target.value); setSaved(false); }} rows={6}
            placeholder="Correcciones generales del equipo, qué funcionó, qué hay que mejorar…" className="text-sm border-gray-200" />
        </div>
        <div className={card}>
          <p className={h}>Sobre el rival{event?.opponent ? ` · ${event.opponent}` : ""}</p>
          <Textarea value={rival_notes} onChange={(e) => { setRivalNotes(e.target.value); setSaved(false); }} rows={6}
            placeholder="Cómo juegan, jugadores a vigilar, balón parado… para la próxima vez que nos enfrentemos." className="text-sm border-gray-200" />
        </div>
      </div>
    </div>
  );
}
