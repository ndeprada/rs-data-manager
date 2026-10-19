import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Star, AlertTriangle, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFullName } from "@/lib/playerName";
import { calcMinutesPlayed, actaMinutes, totalMinutes, defaultDuration, teamDefaultDuration, durationLabel, DURATIONS } from "@/lib/matchDuration";
import LineupSummary from "@/components/match/LineupSummary";
import GoalClassifier from "@/components/match/GoalClassifier";
import { toStored, fromStored, goalLabel } from "@/lib/goalTypes";

// ── Formatos de partido ──────────────────────────────────
const FOOTBALL_FORMATS = [
  { value: "f11", label: "Fútbol 11" },
  { value: "f7", label: "Fútbol 7" },
];
export function getMatchMinutes(format, duration, team) {
  return totalMinutes(duration || defaultDuration(format, team));
}

export { calcMinutesPlayed };

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
        <button key={s} type="button" onClick={() => onChange(s === value ? 0 : s)} className="focus:outline-none" title={s === value ? "Quitar valoración" : ""}>
          <Star className={`w-4 h-4 ${s <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

// ── Verificar si un jugador está en campo en un minuto ───
function isOnField(playerId, minute, starterIds, matchEvents) {
  const mins = calcMinutesPlayed(playerId, starterIds, matchEvents.filter(e => e.minute <= minute), minute);
  return mins > 0;
}

// ── Timeline visual (con botón eliminar integrado) ───────
function Timeline({ events, players, opponent, onRemove, onEdit }) {
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
      const scorer = player ? `${playerFullName(player)}` : (ev.fcfName ? ev.fcfName + (ev.goalType === "gol_propio" ? " (p.p.)" : "") : ev.team === "away" ? (opponent || "Rival") : "—");
      const assist = players.find(p => p.id === ev.assistId);
      return scorer + (assist ? ` (as. ${playerFullName(assist)})` : "");
    }
    if (ev.type === "sub") return `${playerIn ? playerFullName(playerIn) : "—"} ↑ / ${playerOut ? playerFullName(playerOut) : "—"} ↓`;
    if (ev.type === "card") {
      const who = player ? `${playerFullName(player)}` : (ev.team === "away" ? (opponent || "Rival") : "—");
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
            {ev.type === "goal" && <span className="text-[9px] text-gray-400 shrink-0">{goalLabel(ev.goalDetail || fromStored({ goal_type: ev.goalType })) || GOAL_TYPES.find(g => g.value === ev.goalType)?.label}</span>}
            {String(ev.id).startsWith("fcf_") && !ev.edited && <span className="text-[8px] font-bold text-blue-500 bg-blue-50 rounded px-1 shrink-0">FCF</span>}
            {ev.edited && <span className="text-[8px] font-bold text-green-600 bg-green-50 rounded px-1 shrink-0">editado</span>}
          </div>
          <button onClick={() => onEdit(ev)} title="Editar" className="sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition-opacity shrink-0">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onRemove(ev.id)} title="Eliminar" className="sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────
export default function ActaTab({ eventId, teamId, event, players, team }) {
  const queryClient = useQueryClient();

  const [format, setFormat] = useState(event?.football_format || "f11");
  const [duration, setDuration] = useState(event?.match_duration || defaultDuration(event?.football_format, team));
  const [durationTouched, setDurationTouched] = useState(false); // el entrenador ya ha elegido: no se le cambia sola
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
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
  const [newEvGoal, setNewEvGoal] = useState({});
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

  const matchMinutes = getMatchMinutes(format, duration, team);

  // Si el equipo llega después de abrir el acta, un partido sin duración propia toma la del equipo
  useEffect(() => {
    if (!durationTouched && !event?.match_duration) setDuration(defaultDuration(format, team));
  }, [team?.default_match_duration, team?.category, team?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Duración habitual del equipo: la que haya guardado el entrenador o, si no, la de su categoría
  const teamDuration = teamDefaultDuration(team);
  const pickDuration = (v) => { setDuration(v); setDurationTouched(true); setDefaultSaved(false); };
  const saveTeamDefault = async () => {
    if (!team?.id) return;
    setSavingDefault(true);
    try {
      await base44.entities.Team.update(team.id, { default_match_duration: duration });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      setDefaultSaved(true);
    } finally { setSavingDefault(false); }
  };
  // Duraciones que se ofrecen; si el partido trae un valor antiguo se añade para no perderlo
  const durationOptions = DURATIONS.some((d) => d.value === duration) ? DURATIONS : [...DURATIONS, { value: duration, label: durationLabel(duration) }];

  // Cargar eventos guardados desde Event.goal_events si existen
  useEffect(() => {
    if (event?.match_events?.length > 0 && matchEvents.length === 0) {
      setMatchEvents(event.match_events);
    } else if (event?.goal_events?.length > 0 && matchEvents.length === 0) {
      const loaded = event.goal_events.map((g, i) => ({
        id: `loaded_${i}`,
        type: "goal",
        team: g.team,
        minute: g.minute,
        playerId: g.player_id,
        assistId: g.assist_player_id,
        goalType: g.goal_type,
        goalDetail: fromStored(g),
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
    if (newEvType === "goal") { ev.playerId = newEvPlayerId; ev.assistId = newEvAssistId; ev.goalDetail = newEvGoal; ev.goalType = toStored(newEvGoal).goal_type; }
    if (newEvType === "sub") { ev.playerIn = newEvPlayerIn; ev.playerOut = newEvPlayerOut; }
    if (newEvType === "card") { ev.playerId = newEvPlayerId; ev.cardColor = newEvCardColor; }

    const next = [...matchEvents, ev];
    setMatchEvents(next);
    persistEvents(next).then(() => saveStats(next, true));
    setEventWarning(warning);
    setNewEvGoal({}); setNewEvMinute(""); setNewEvPlayerId(""); setNewEvAssistId(""); setNewEvPlayerIn(""); setNewEvPlayerOut("");
  };

  const persistEvents = async (next) => {
    await base44.entities.Event.update(eventId, {
      match_events: next,
      goal_events_source: "manual",
      goal_events: next.filter(e => e.type === "goal").map(e => ({
        id: e.id, team: e.team, minute: e.minute,
        player_id: e.playerId, assist_player_id: e.assistId, goal_type: e.goalType, ...toStored(e.goalDetail || fromStored({ goal_type: e.goalType })),
      })),
    });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
  };

  const removeEvent = (id) => {
    const next = matchEvents.filter(e => e.id !== id);
    setMatchEvents(next);
    persistEvents(next).then(() => saveStats(next, true));
  };

  const [editEv, setEditEv] = useState(null);
  const [savingEv, setSavingEv] = useState(false);
  const saveEdit = async () => {
    setSavingEv(true);
    const next = matchEvents.map(e => e.id === editEv.id ? { ...editEv, edited: true } : e);
    setMatchEvents(next);
    try { await persistEvents(next); await saveStats(next, true); } finally { setSavingEv(false); setEditEv(null); }
  };
  const deleteEdit = async () => {
    const next = matchEvents.filter(e => e.id !== editEv.id);
    setMatchEvents(next);
    await persistEvents(next);
    await saveStats(next, true);
    setEditEv(null);
  };
  const playerOptions = convocados.length > 0 ? convocados : [...players].sort(sortByPosition);
  const setE = (k, v) => setEditEv(prev => ({ ...prev, [k]: v }));
  const PlayerSelect = ({ value, onChange, placeholder, allowNone }) => (
    <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">— Ninguno —</SelectItem>}
        {!allowNone && <SelectItem value="none">— Sin asignar —</SelectItem>}
        {playerOptions.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const saveScore = async () => {
    setSavingScore(true);
    await base44.entities.Event.update(eventId, {
      score_home: Number(scoreHome),
      score_away: Number(scoreAway),
      football_format: format,
      match_duration: duration,
      match_events: matchEvents,
      goal_events_source: "manual",
      goal_events: matchEvents.filter(e => e.type === "goal").map(e => ({
        id: e.id, team: e.team, minute: e.minute,
        player_id: e.playerId, assist_player_id: e.assistId, goal_type: e.goalType, ...toStored(e.goalDetail || fromStored({ goal_type: e.goalType })),
      })),
    });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    // La duración puede haber cambiado: los minutos de los jugadores se recalculan con ella
    await saveStats(matchEvents, true);
    setSavingScore(false);
  };

  // Guarda en MatchStats lo que sale de los eventos. Los jugadores corregidos a mano (manual) no se tocan.
  const saveStats = async (evs = matchEvents, silent = false) => {
    if (!silent) setSavingStats(true);
    try {
      const all = await base44.entities.MatchStats.filter({ event_id: eventId });
      for (const p of convocados) {
        const existing = all.find(r => r.player_id === p.id) || null;
        if (existing?.manual) continue;
        const mine = evs.filter(e => e.team === "home");
        const isStarter = starterIds.includes(p.id);
        const goals = mine.filter(e => e.type === "goal" && e.playerId === p.id).length;
        const assistsFromEvents = mine.filter(e => e.type === "goal" && e.assistId === p.id).length;
        const yellows = mine.filter(e => e.type === "card" && e.playerId === p.id && e.cardColor === "yellow").length;
        const yellow2 = mine.filter(e => e.type === "card" && e.playerId === p.id && e.cardColor === "yellow2").length;
        const red = mine.filter(e => e.type === "card" && e.playerId === p.id && e.cardColor === "red").length;
        // Titular sin cambios = partido completo; suplente sin cambios = 0 (si aún no hay titulares marcados, se conserva lo apuntado)
        const minutes = actaMinutes(p.id, starterIds, evs, matchMinutes, existing?.minutes_played || 0);
        const assists = assistsFromEvents || existing?.assists || 0;
        const payload = {
          player_id: p.id, event_id: eventId,
          date: event?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
          opponent: event?.opponent || "",
          starter: isStarter, minutes_played: minutes,
          goals, assists, yellow_cards: yellows, double_yellow_card: yellow2, red_cards: red,
          // La valoración y las correcciones se hacen en la pestaña Post-partido: aquí se conservan
          rating: existing?.rating ?? null, notes: existing?.notes || "",
        };
        if (existing) await base44.entities.MatchStats.update(existing.id, { ...existing, ...payload });
        else if (minutes > 0 || goals > 0 || assists > 0 || yellows + yellow2 + red > 0 || isStarter) await base44.entities.MatchStats.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["matchstats-event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["matchstats"] });
    } finally { if (!silent) setSavingStats(false); }
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
            <Select value={format} onValueChange={v => { setFormat(v); if (!durationTouched && !event?.match_duration) setDuration(defaultDuration(v, team)); }}>
              <SelectTrigger className="w-36 border-gray-200 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FOOTBALL_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Duración</p>
            <Select value={duration} onValueChange={pickDuration}>
              <SelectTrigger className="w-44 border-gray-200 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {durationOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {team?.id && (duration !== teamDuration || defaultSaved) && (
            <button type="button" onClick={saveTeamDefault} disabled={savingDefault || defaultSaved}
              className={`h-8 text-xs rounded-md border px-2.5 ${defaultSaved ? "border-green-200 bg-green-50 text-green-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              title="Los próximos partidos de este equipo empezarán con esta duración">
              {defaultSaved ? "✓ Habitual del equipo" : savingDefault ? "Guardando…" : `Guardar como habitual de ${team.name}`}
            </button>
          )}
        </div>

        {/* Mismo orden que la cabecera del partido: el equipo local a la izquierda (el marcador guardado sigue siendo nuestros goles / goles del rival) */}
        {(() => {
          const us = { key: "us", label: "Nuestro equipo", value: scoreHome, set: setScoreHome };
          const rival = { key: "rival", label: event?.opponent || "Rival", value: scoreAway, set: setScoreAway };
          const [left, right] = event?.is_home === false ? [rival, us] : [us, rival];
          return (
            <div className="flex items-end gap-2 sm:gap-4">
              {[left, right].map((t, i) => (
                <React.Fragment key={t.key}>
                  {i === 1 && <span className="text-3xl font-black text-gray-300 pb-3">–</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1 h-8 flex items-end leading-tight line-clamp-2">{t.label}</p>
                    <Input type="number" min="0" inputMode="numeric" value={t.value} onChange={e => t.set(e.target.value)}
                      className="text-2xl font-black text-center h-14 border-gray-200" />
                  </div>
                </React.Fragment>
              ))}
              <Button variant="club" onClick={saveScore} disabled={savingScore} className="h-14 px-4" title="Guardar marcador">
                <Save className="w-4 h-4" />
              </Button>
            </div>
          );
        })()}
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
                    {convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Asistente</p>
                <Select value={newEvAssistId} onValueChange={setNewEvAssistId}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Asistente…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin asistencia</SelectItem>
                    {convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <GoalClassifier value={newEvGoal} onChange={setNewEvGoal} />
            </>
          )}
          {newEvType === "goal" && newEvTeam === "away" && <GoalClassifier value={newEvGoal} onChange={setNewEvGoal} />}
          {newEvType === "sub" && (
            <>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Entra</p>
                <Select value={newEvPlayerIn} onValueChange={setNewEvPlayerIn}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                  <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Sale</p>
                <Select value={newEvPlayerOut} onValueChange={setNewEvPlayerOut}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                  <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {newEvType === "card" && newEvTeam === "home" && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">Jugador</p>
              <Select value={newEvPlayerId} onValueChange={setNewEvPlayerId}>
                <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder="Jugador…" /></SelectTrigger>
                <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}</SelectContent>
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

          <Button variant="club" onClick={addEvent} size="sm" className="h-8 mt-auto">
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
          <Timeline events={matchEvents} players={players} opponent={event?.opponent} onRemove={removeEvent} onEdit={ev => setEditEv({ ...ev })} />
          <p className="text-[10px] text-gray-400">Pulsa el lápiz para completar o corregir un evento (asistente, tipo de gol, jugador…). Los datos vienen de la FCF y tus cambios se mantienen al volver a sincronizar.</p>
        </div>
      )}

      {/* ── Alineación y resumen por jugador ── */}
      <LineupSummary eventId={eventId} event={event} convocation={convocation} convocados={convocados} starterIds={starterIds}
        matchEvents={matchEvents} matchMinutes={matchMinutes} onRecompute={() => saveStats(matchEvents, true)} />

      {/* ── Editar evento ── */}
      <Dialog open={!!editEv} onOpenChange={o => { if (!o) setEditEv(null); }}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle>{editEv?.type === "goal" ? "⚽ Editar gol" : editEv?.type === "card" ? "🟨 Editar tarjeta" : "🔄 Editar cambio"}</DialogTitle>
          </DialogHeader>
          {editEv && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-24">
                  <p className="text-xs text-gray-500 mb-1">Minuto</p>
                  <Input type="number" min="0" value={editEv.minute} onChange={e => setE("minute", e.target.value)} className="h-9 border-gray-200" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Equipo</p>
                  <Select value={editEv.team} onValueChange={v => setE("team", v)}>
                    <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Nuestro equipo</SelectItem>
                      <SelectItem value="away">{event?.opponent || "Rival"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editEv.type === "goal" && (
                <>
                  {editEv.team === "home" ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Goleador {editEv.fcfName ? <span className="text-gray-400">· FCF: {editEv.fcfName}</span> : null}</p>
                        {PlayerSelect({ value: editEv.playerId, onChange: v => setE("playerId", v), placeholder: "Jugador…" })}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Asistente</p>
                        {PlayerSelect({ value: editEv.assistId, onChange: v => setE("assistId", v), placeholder: "Sin asistencia", allowNone: true })}
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Goleador rival</p>
                      <Input value={editEv.fcfName || ""} onChange={e => setE("fcfName", e.target.value)} className="h-9 border-gray-200" placeholder="Nombre (opcional)" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <GoalClassifier value={editEv.goalDetail || fromStored({ goal_type: editEv.goalType })} onChange={d => setEditEv(prev => ({ ...prev, goalDetail: d, goalType: toStored(d).goal_type }))} />
                  </div>
                </>
              )}
              {editEv.type === "card" && (
                <>
                  {editEv.team === "home" && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Jugador</p>
                      {PlayerSelect({ value: editEv.playerId, onChange: v => setE("playerId", v), placeholder: "Jugador…" })}
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tarjeta</p>
                    <Select value={editEv.cardColor} onValueChange={v => setE("cardColor", v)}>
                      <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                      <SelectContent>{CARD_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {editEv.type === "sub" && editEv.team === "home" && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Entra</p>
                    {PlayerSelect({ value: editEv.playerIn, onChange: v => setE("playerIn", v), placeholder: "Jugador…" })}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Sale</p>
                    {PlayerSelect({ value: editEv.playerOut, onChange: v => setE("playerOut", v), placeholder: "Jugador…" })}
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button variant="outline" size="icon" onClick={deleteEdit} title="Eliminar evento"><Trash2 className="w-4 h-4 text-gray-400" /></Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setEditEv(null)}>Cancelar</Button>
                <Button variant="club" onClick={saveEdit} disabled={savingEv}>
                  {savingEv ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}