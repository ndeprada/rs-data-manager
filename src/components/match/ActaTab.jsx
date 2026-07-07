import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Star, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ── Formatos de partido ──────────────────────────────────
const FOOTBALL_FORMATS = [
  { value: "f11", label: "Fútbol 11" },
  { value: "f7", label: "Fútbol 7" },
];
const DURATIONS_F11 = [
  { value: "2x45", label: "2 partes de 45'" },
  { value: "2x40", label: "2 partes de 40'" },
  { value: "2x35", label: "2 partes de 35'" },
];
const DURATIONS_F7 = [
  { value: "4x15", label: "4 cuartos de 15'" },
  { value: "4x12", label: "4 cuartos de 12'" },
  { value: "4x10", label: "4 cuartos de 10'" },
];

function getMatchMinutes(format, duration) {
  if (!format || !duration) return 90;
  const parts = duration.split("x");
  return Number(parts[0]) * Number(parts[1]);
}

// ── Tipos de evento ──────────────────────────────────────
const GOAL_TYPES = [
  { value: "dentro_area", label: "Dentro del área" },
  { value: "fuera_area", label: "Fuera del área" },
  { value: "penalti", label: "Penalti" },
  { value: "balon_parado", label: "Balón parado" },
  { value: "esquina", label: "Córner" },
  { value: "contraataque", label: "Contraataque" },
  { value: "centro_lateral", label: "Centro lateral" },
  { value: "perdida_salida", label: "Pérdida en salida" },
  { value: "gol_propio", label: "Gol en propia" },
];
const CARD_COLORS = [
  { value: "yellow", label: "🟨 Amarilla" },
  { value: "yellow2", label: "🟨🟨 2ª Amarilla" },
  { value: "red", label: "🟥 Roja directa" },
];

// ── Star rating (3 estrellas) ────────────────────────────
function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(s => (
        <button key={s} onClick={() => onChange(s)} className="focus:outline-none">
          <Star className={`w-4 h-4 ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

// ── Calcular minutos jugados ─────────────────────────────
function calcMinutesPlayed(playerId, starterIds, events, matchMinutes) {
  // Registramos intervalos de tiempo jugado: [{in: X, out: Y}]
  const intervals = [];
  const isStarter = starterIds.includes(playerId);
  let currentIn = isStarter ? 0 : null;

  // Ordenar subs por minuto
  const subs = events.filter(e => e.type === "sub" && (e.playerIn === playerId || e.playerOut === playerId))
    .sort((a, b) => Number(a.minute) - Number(b.minute));

  subs.forEach(sub => {
    if (sub.playerIn === playerId) {
      if (currentIn === null) currentIn = Number(sub.minute);
    }
    if (sub.playerOut === playerId) {
      if (currentIn !== null) {
        intervals.push({ in: currentIn, out: Number(sub.minute) });
        currentIn = null;
      }
    }
  });

  // Si sigue en campo al final
  if (currentIn !== null) intervals.push({ in: currentIn, out: matchMinutes });

  return intervals.reduce((acc, { in: i, out: o }) => acc + (o - i), 0);
}

// ── Verificar si un jugador está en campo en un minuto ───
function isOnField(playerId, minute, starterIds, matchEvents) {
  const mins = calcMinutesPlayed(playerId, starterIds, matchEvents.filter(e => e.minute <= minute), minute);
  return mins > 0;
}

// ── Timeline visual (con botón eliminar integrado) ───────
function Timeline({ events, players, opponent, onRemove }) {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => Number(a.minute) - Number(b.minute));

  const getIcon = (ev) => {
    if (ev.type === "goal") return ev.team === "home" ? "⚽" : "🔵";
    if (ev.type === "sub") return "🔄";
    if (ev.type === "card") return ev.cardColor === "red" || ev.cardColor === "yellow2" ? "🟥" : "🟨";
    return "•";
  };
  const getDesc = (ev) => {
    const player = players.find(p => p.id === ev.playerId);
    const playerIn = players.find(p => p.id === ev.playerIn);
    const playerOut = players.find(p => p.id === ev.playerOut);
    if (ev.type === "goal") {
      const scorer = player ? `${player.first_name} ${player.last_name}` : (ev.team === "away" ? (opponent || "Rival") : "—");
      const assist = players.find(p => p.id === ev.assistId);
      return scorer + (assist ? ` (as. ${assist.first_name} ${assist.last_name})` : "");
    }
    if (ev.type === "sub") return `${playerIn ? playerIn.last_name : "—"} ↑ / ${playerOut ? playerOut.last_name : "—"} ↓`;
    if (ev.type === "card") {
      const who = player ? `${player.first_name} ${player.last_name}` : (ev.team === "away" ? (opponent || "Rival") : "—");
      return `${who} (${ev.cardColor === "yellow" ? "amarilla" : ev.cardColor === "yellow2" ? "2ª amarilla" : "roja"})`;
    }
    return "";
  };

  return (
    <div className="relative pl-8 space-y-1">
      <div className="absolute left-3.5 top-1 bottom-1 w-px bg-gray-200" />
      {sorted.map((ev) => (
        <div key={ev.id} className="relative flex items-center gap-2 group">
          <div className="absolute -left-5 w-5 text-center text-sm leading-none">{getIcon(ev)}</div>
          <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
            <span className="text-xs font-black text-gray-500 w-7 shrink-0" style={{ fontFamily: "var(--font-display)" }}>{ev.minute}'</span>
            <span className="text-xs text-gray-700 truncate">{getDesc(ev)}</span>
            {ev.type === "goal" && <span className="text-[9px] text-gray-400 shrink-0">{GOAL_TYPES.find(g => g.value === ev.goalType)?.label}</span>}
          </div>
          <button onClick={() => onRemove(ev.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────
export default function ActaTab({ eventId, teamId, event, players }) {
  const queryClient = useQueryClient();

  const [format, setFormat] = useState(event?.football_format || "f11");
  const [duration, setDuration] = useState(event?.match_duration || "2x45");
  const [scoreHome, setScoreHome] = useState(event?.score_home ?? "");
  const [scoreAway, setScoreAway] = useState(event?.score_away ?? "");
  const [matchEvents, setMatchEvents] = useState([]); // goals, subs, cards
  const [ratings, setRatings] = useState({}); // playerId -> {stars, notes}
  const [openNotes, setOpenNotes] = useState({}); // playerId -> bool
  const [savingScore, setSavingScore] = useState(false);
  const [savingStats, setSavingStats] = useState(false);

  // New event form state
  const [newEvType, setNewEvType] = useState("goal");
  const [newEvTeam, setNewEvTeam] = useState("home");
  const [newEvMinute, setNewEvMinute] = useState("");
  const [newEvPlayerId, setNewEvPlayerId] = useState("");
  const [newEvAssistId, setNewEvAssistId] = useState("");
  const [newEvGoalType, setNewEvGoalType] = useState("dentro_area");
  const [newEvPlayerIn, setNewEvPlayerIn] = useState("");
  const [newEvPlayerOut, setNewEvPlayerOut] = useState("");
  const [newEvCardColor, setNewEvCardColor] = useState("yellow");
  const [eventWarning, setEventWarning] = useState("");

  const { data: convocation } = useQuery({
    queryKey: ["convocatoria", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });

  const convocadoIds = convocation?.player_ids || [];
  const starterIds = convocation?.starters || [];

  const POSITION_SORT_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];
  const sortByPosition = (a, b) => {
    const ai = POSITION_SORT_ORDER.indexOf(a.position ?? "");
    const bi = POSITION_SORT_ORDER.indexOf(b.position ?? "");
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.last_name.localeCompare(b.last_name);
  };

  const convocados = players.filter(p => convocadoIds.includes(p.id)).sort(sortByPosition);
  const starters = players.filter(p => starterIds.includes(p.id)).sort(sortByPosition);
  const suplentes = convocados.filter(p => !starterIds.includes(p.id));

  const matchMinutes = getMatchMinutes(format, duration);

  // Cargar eventos guardados desde Event.goal_events si existen
  useEffect(() => {
    if (event?.goal_events?.length > 0 && matchEvents.length === 0) {
      const loaded = event.goal_events.map((g, i) => ({
        id: `loaded_${i}`,
        type: "goal",
        team: g.team,
        minute: g.minute,
        playerId: g.player_id,
        assistId: g.assist_player_id,
        goalType: g.goal_type,
      }));
      setMatchEvents(loaded);
    }
  }, [event?.id]);

  const addEvent = () => {
    if (!newEvMinute) return;
    const minute = Number(newEvMinute);
    let warning = "";

    if (newEvType === "goal" && newEvTeam === "home" && newEvPlayerId) {
      if (!isOnField(newEvPlayerId, minute, starterIds, matchEvents)) {
        warning = `⚠ El jugador seleccionado no estaba en el campo en el minuto ${minute}. Se registra igualmente.`;
      }
    }
    if (newEvType === "card" && newEvTeam === "home" && newEvPlayerId) {
      if (!isOnField(newEvPlayerId, minute, starterIds, matchEvents)) {
        warning = `⚠ El jugador seleccionado no estaba en el campo en el minuto ${minute}. Se registra igualmente.`;
      }
    }

    const ev = { id: Date.now().toString(), type: newEvType, team: newEvTeam, minute };
    if (newEvType === "goal") { ev.playerId = newEvPlayerId; ev.assistId = newEvAssistId; ev.goalType = newEvGoalType; }
    if (newEvType === "sub") { ev.playerIn = newEvPlayerIn; ev.playerOut = newEvPlayerOut; }
    if (newEvType === "card") { ev.playerId = newEvPlayerId; ev.cardColor = newEvCardColor; }

    setMatchEvents(prev => [...prev, ev]);
    setEventWarning(warning);
    setNewEvMinute(""); setNewEvPlayerId(""); setNewEvAssistId(""); setNewEvPlayerIn(""); setNewEvPlayerOut("");
  };

  const removeEvent = (id) => setMatchEvents(prev => prev.filter(e => e.id !== id));

  const saveScore = async () => {
    setSavingScore(true);
    await base44.entities.Event.update(eventId, {
      score_home: Number(scoreHome),
      score_away: Number(scoreAway),
      football_format: format,
      match_duration: duration,
      goal_events: matchEvents.filter(e => e.type === "goal").map(e => ({
        id: e.id, team: e.team, minute: e.minute,
        player_id: e.playerId, assist_player_id: e.assistId, goal_type: e.goalType,
      })),
    });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    setSavingScore(false);
  };

  const saveStats = async () => {
    setSavingStats(true);
    for (const p of convocados) {
      const mins = calcMinutesPlayed(p.id, starterIds, matchEvents, matchMinutes);
      const isStarter = starterIds.includes(p.id);
      const goals = matchEvents.filter(e => e.type === "goal" && e.team === "home" && e.playerId === p.id).length;
      const assists = matchEvents.filter(e => e.type === "goal" && e.team === "home" && e.assistId === p.id).length;
      const yellows = matchEvents.filter(e => e.type === "card" && e.team === "home" && e.playerId === p.id && e.cardColor === "yellow").length;
      const yellow2 = matchEvents.filter(e => e.type === "card" && e.team === "home" && e.playerId === p.id && e.cardColor === "yellow2").length;
      const red = matchEvents.filter(e => e.type === "card" && e.team === "home" && e.playerId === p.id && e.cardColor === "red").length;
      const rating = ratings[p.id]?.stars || null;
      const notes = ratings[p.id]?.notes || "";

      const existing = await base44.entities.MatchStats.filter({ event_id: eventId, player_id: p.id }).then(r => r[0] || null);
      const payload = {
        player_id: p.id, event_id: eventId,
        date: event?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
        opponent: event?.opponent || "",
        starter: isStarter, minutes_played: mins,
        goals, assists, yellow_cards: yellows, double_yellow_card: yellow2, red_cards: red,
        rating, notes,
      };
      if (existing) await base44.entities.MatchStats.update(existing.id, payload);
      else if (mins > 0 || goals > 0 || assists > 0 || rating) await base44.entities.MatchStats.create(payload);
    }
    setSavingStats(false);
  };

  // Score from events — sync marcador automáticamente
  const homeGoals = matchEvents.filter(e => e.type === "goal" && e.team === "home").length;
  const awayGoals = matchEvents.filter(e => e.type === "goal" && e.team === "away").length;

  useEffect(() => {
    if (matchEvents.length > 0) {
      setScoreHome(homeGoals);
      setScoreAway(awayGoals);
    }
  }, [homeGoals, awayGoals]);

  return (
    <div className="space-y-5">

      {/* ── Formato y resultado ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Formato</p>
            <Select value={format} onValueChange={v => { setFormat(v); setDuration(v === "f11" ? "2x45" : "4x15"); }}>
              <SelectTrigger className="w-36 border-gray-200 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FOOTBALL_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Duración</p>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-44 border-gray-200 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(format === "f11" ? DURATIONS_F11 : DURATIONS_F7).map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">{event?.is_home !== false ? "Nuestro equipo" : (event?.opponent || "Visitante")}</p>
            <Input type="number" min="0" value={scoreHome} onChange={e => setScoreHome(e.target.value)}
              className="text-2xl font-black text-center h-14 border-gray-200" />
          </div>
          <span className="text-3xl font-black text-gray-300 mt-4">–</span>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">{event?.opponent || "Rival"}</p>
            <Input type="number" min="0" value={scoreAway} onChange={e => setScoreAway(e.target.value)}
              className="text-2xl font-black text-center h-14 border-gray-200" />
          </div>
          <Button onClick={saveScore} disabled={savingScore} className="text-white mt-4" style={{ background: "var(--granate)" }}>
            <Save className="w-4 h-4" />
          </Button>
        </div>
        {matchEvents.length > 0 && (
          <p className="text-[10px] text-gray-400 text-center">Marcador actualizado según eventos · editable manualmente</p>
        )}
      </div>

      {/* ── Añadir evento de partido ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-bold text-gray-900">Añadir evento al partido</p>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <p className="text-[10px] text-gray-400 mb-1">Tipo</p>
            <Select value={newEvType} onValueChange={setNewEvType}>
              <SelectTrigger className="h-8 w-32 text-xs border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="goal">⚽ Gol</SelectItem>
                <SelectItem value="sub">🔄 Cambio</SelectItem>
                <SelectItem value="card">🟨 Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">Equipo</p>
            <Select value={newEvTeam} onValueChange={setNewEvTeam}>
              <SelectTrigger className="h-8 w-36 text-xs border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Nuestro equipo</SelectItem>
                <SelectItem value="away">{event?.opponent || "Rival"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">Minuto</p>
            <Input type="number" min="1" max={matchMinutes + 15} value={newEvMinute} onChange={e => setNewEvMinute(e.target.value)}
              className="h-8 w-16 text-xs border-gray-200" placeholder="1'" />
          </div>

          {/* Campos específicos por tipo */}
          {newEvType === "goal" && newEvTeam === "home" && (
            <>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Goleador</p>
                <Select value={newEvPlayerId} onValueChange={setNewEvPlayerId}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                  <SelectContent>
                    {convocados.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Asistente</p>
                <Select value={newEvAssistId} onValueChange={setNewEvAssistId}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Asistente…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin asistencia</SelectItem>
                    {convocados.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Tipo de gol</p>
                <Select value={newEvGoalType} onValueChange={setNewEvGoalType}>
                  <SelectTrigger className="h-8 w-44 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{GOAL_TYPES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {newEvType === "goal" && newEvTeam === "away" && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">Tipo de gol encajado</p>
              <Select value={newEvGoalType} onValueChange={setNewEvGoalType}>
                <SelectTrigger className="h-8 w-44 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_TYPES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {newEvType === "sub" && (
            <>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Entra</p>
                <Select value={newEvPlayerIn} onValueChange={setNewEvPlayerIn}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                  <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Sale</p>
                <Select value={newEvPlayerOut} onValueChange={setNewEvPlayerOut}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                  <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {newEvType === "card" && newEvTeam === "home" && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">Jugador</p>
              <Select value={newEvPlayerId} onValueChange={setNewEvPlayerId}>
                <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {newEvType === "card" && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">Tipo</p>
              <Select value={newEvCardColor} onValueChange={setNewEvCardColor}>
                <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>{CARD_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={addEvent} size="sm" className="text-white h-8 mt-auto" style={{ background: "var(--granate)" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
          </Button>
        </div>

        {eventWarning && (
          <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {eventWarning}
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      {matchEvents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-sm font-bold text-gray-900">📋 Línea del tiempo</p>
          <Timeline events={matchEvents} players={players} opponent={event?.opponent} onRemove={removeEvent} />
        </div>
      )}

      {/* ── Jugadores: minutos + valoración ── */}
      {convocados.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Rendimiento individual</p>
            <Button size="sm" onClick={saveStats} disabled={savingStats} className="text-white text-xs h-7" style={{ background: "var(--granate)" }}>
              <Save className="w-3.5 h-3.5 mr-1" />{savingStats ? "Guardando…" : "Guardar estadísticas"}
            </Button>
          </div>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {convocados.map(p => {
              const mins = calcMinutesPlayed(p.id, starterIds, matchEvents, matchMinutes);
              const isStarter = starterIds.includes(p.id);
              const goals = matchEvents.filter(e => e.type === "goal" && e.team === "home" && e.playerId === p.id).length;
              const assists = matchEvents.filter(e => e.type === "goal" && e.team === "home" && e.assistId === p.id).length;
              const showNotes = openNotes[p.id];
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white hover:bg-gray-50/50 transition-colors">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: "var(--granate)" }}>
                      {p.first_name?.[0]}{p.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate leading-tight">{p.first_name} {p.last_name}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {isStarter ? "TIT" : "SUP"} · {mins}'
                        {goals > 0 && ` · ${goals}⚽`}
                        {assists > 0 && ` · ${assists}🅰️`}
                      </p>
                    </div>
                    <StarRating value={ratings[p.id]?.stars || 0} onChange={v => setRatings(prev => ({ ...prev, [p.id]: { ...prev[p.id], stars: v } }))} />
                    <button onClick={() => setOpenNotes(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className="text-gray-400 hover:text-gray-600">
                      {showNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {showNotes && (
                    <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/30">
                      <Textarea
                        value={ratings[p.id]?.notes || ""}
                        onChange={e => setRatings(prev => ({ ...prev, [p.id]: { ...prev[p.id], notes: e.target.value } }))}
                        rows={2} className="text-xs border-gray-200" placeholder="Observaciones del partido…" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}