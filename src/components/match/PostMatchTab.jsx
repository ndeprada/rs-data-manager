import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Save, Check, Plus, Trash2, ExternalLink, Play, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { playerFullName } from "@/lib/playerName";
import { calcMinutesPlayed, getMatchMinutes } from "@/components/match/ActaTab";

const POSITION_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];
const STAR_LABELS = ["", "Muy mal", "Mal", "Aceptable", "Bien", "Excelente"];

function Stars({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0" title={STAR_LABELS[value || 0]}>
      {[1, 2, 3, 4, 5].map((s) => (
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
    let list = players.filter((p) => ids.has(p.id));
    if (!list.length) list = players.filter((p) => convocadoIds.includes(p.id)); // acta aún sin rellenar
    return list.sort((a, b) => {
      const ai = POSITION_ORDER.indexOf(a.position ?? ""), bi = POSITION_ORDER.indexOf(b.position ?? "");
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || (a.last_name || "").localeCompare(b.last_name || "");
    });
  }, [players, starterIds, convocadoIds, stats, event?.match_events]);

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
        analysis_notes_team: team_notes.trim() || undefined,
        analysis_notes_rival: rival_notes.trim() || undefined,
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
        <Button onClick={save} disabled={saving} className="text-white shrink-0" style={{ background: "var(--granate)" }}>
          {saved ? <Check className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          {saving ? "Guardando…" : saved ? "Guardado" : "Guardar análisis"}
        </Button>
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
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {links.map((l, i) => {
              const emb = embedOf(l.url);
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <LinkIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{l.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">{platformOf(l.url)}</p>
                  </div>
                  {emb ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPlaying(playing === i ? null : i)}>
                      <Play className="w-3 h-3 mr-1" />{playing === i ? "Cerrar" : "Ver aquí"}
                    </Button>
                  ) : null}
                  <a href={l.url} target="_blank" rel="noopener noreferrer" title="Abrir en una pestaña nueva"
                    className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    <ExternalLink className="w-3 h-3" />{emb ? "" : "Abrir vídeo"}
                  </a>
                  <button type="button" onClick={() => { setLinks((x) => x.filter((_, j) => j !== i)); setPlaying(null); setSaved(false); }} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                    <p className="text-[10px] text-gray-400">{starterIds.includes(p.id) ? "Titular" : "Suplente"}</p>
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
