import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Star, AlertTriangle, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFullName } from "@/lib/playerName";
import { matchFormat, teamPlaysF7 } from "@/lib/matchFormat";
import { calcMinutesPlayed, actaMinutes, totalMinutes, defaultDuration, teamDefaultDuration, durationLabel, DURATIONS } from "@/lib/matchDuration";
import LineupSummary from "@/components/match/LineupSummary";
import GoalClassifier from "@/components/match/GoalClassifier";
import SaveStatus from "@/components/common/SaveStatus";
import { toStored, fromStored, goalLabel } from "@/lib/goalTypes";
import { useT, msg } from "@/i18n";

// ── Formatos de partido ──────────────────────────────────
const FOOTBALL_FORMATS = [
  { value: "f11", label: msg("Fútbol 11") },
  { value: "f7", label: msg("Fútbol 7") },
];
export function getMatchMinutes(format, duration, team) {
  return totalMinutes(duration || defaultDuration(format, team));
}

export { calcMinutesPlayed };

// ── Tipos de evento ──────────────────────────────────────
const GOAL_TYPES = [
  { value: "dentro_area", label: msg("Dentro del área") },
  { value: "fuera_area", label: msg("Fuera del área") },
  { value: "penalti", label: msg("Penalti") },
  { value: "balon_parado", label: msg("Balón parado") },
  { value: "esquina", label: msg("Córner") },
  { value: "contraataque", label: msg("Contraataque") },
  { value: "centro_lateral", label: msg("Centro lateral") },
  { value: "perdida_salida", label: msg("Pérdida en salida") },
  { value: "gol_propio", label: msg("Gol en propia") },
];
const CARD_COLORS = [
  { value: "yellow", label: msg("🟨 Amarilla") },
  { value: "yellow2", label: msg("🟨🟨 2ª Amarilla") },
  { value: "red", label: msg("🟥 Roja directa") },
];

// ── Star rating (3 estrellas) ────────────────────────────
function StarRating({ value, onChange }) {
  const t = useT();
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(s => (
        <button key={s} type="button" onClick={() => onChange(s === value ? 0 : s)} className="focus:outline-none" title={s === value ? t("Quitar valoración") : ""}>
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
  const t = useT();
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
      const scorer = player ? `${playerFullName(player)}` : (ev.fcfName ? ev.fcfName + (ev.goalType === "gol_propio" ? ` ${t("(p.p.)")}` : "") : ev.team === "away" ? (opponent || t("Rival")) : "—");
      const assist = players.find(p => p.id === ev.assistId);
      return scorer + (assist ? ` (${t("as.")} ${playerFullName(assist)})` : "");
    }
    if (ev.type === "sub") return `${playerIn ? playerFullName(playerIn) : "—"} ↑ / ${playerOut ? playerFullName(playerOut) : "—"} ↓`;
    if (ev.type === "card") {
      const who = player ? `${playerFullName(player)}` : (ev.team === "away" ? (opponent || t("Rival")) : "—");
      return `${who} (${ev.cardColor === "yellow" ? t("amarilla") : ev.cardColor === "yellow2" ? t("2ª amarilla") : t("roja")})`;
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
            {ev.type === "goal" && <span className="text-[9px] text-gray-400 shrink-0">{goalLabel(ev.goalDetail || fromStored({ goal_type: ev.goalType }), t) || t(GOAL_TYPES.find(g => g.value === ev.goalType)?.label || "")}</span>}
            {String(ev.id).startsWith("fcf_") && !ev.edited && <span className="text-[8px] font-bold text-blue-500 bg-blue-50 rounded px-1 shrink-0">{t("FCF")}</span>}
            {ev.edited && <span className="text-[8px] font-bold text-green-600 bg-green-50 rounded px-1 shrink-0">{t("editado")}</span>}
          </div>
          <button onClick={() => onEdit(ev)} title={t("Editar")} className="sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-gray-700 transition-opacity shrink-0">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onRemove(ev.id)} title={t("Eliminar")} className="sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────
export default function ActaTab({ eventId, teamId, event, players, team }) {
  const t = useT();
  const queryClient = useQueryClient();

  // Formato: el de la etapa del equipo (S12 hacia abajo = fútbol 7) y, si no, el del partido
  const teamF7 = teamPlaysF7(team);
  const [format, setFormat] = useState(matchFormat(event, team));
  const [duration, setDuration] = useState(event?.match_duration || defaultDuration(matchFormat(event, team), team));
  const [durationTouched, setDurationTouched] = useState(false); // el entrenador ya ha elegido: no se le cambia sola
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [scoreHome, setScoreHome] = useState(event?.score_home ?? "");
  const [scoreAway, setScoreAway] = useState(event?.score_away ?? "");
  const [matchEvents, setMatchEvents] = useState([]); // goals, subs, cards
  const [ratings, setRatings] = useState({}); // playerId -> {stars, notes}
  const [openNotes, setOpenNotes] = useState({}); // playerId -> bool
  const [savingStats, setSavingStats] = useState(false);
  // Guardado automático: idle (nada que guardar) · pending (esperando a que deje de teclear) · saving · saved · error
  const [saveState, setSaveState] = useState("idle");

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

  const POSITION_SORT_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];
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

  // Si el equipo llega después de abrir el acta, un partido sin duración propia toma la del equipo, y un equipo de fútbol 7 pasa a F7
  useEffect(() => {
    const f = matchFormat({ football_format: format }, team);
    if (f !== format) setFormat(f);
    if (!durationTouched && !event?.match_duration) setDuration(defaultDuration(f, team));
  }, [team?.default_match_duration, team?.category, team?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Duración habitual del equipo: la que haya guardado el entrenador o, si no, la de su categoría
  const teamDuration = teamDefaultDuration(team);
  const pickDuration = (v) => { setDuration(v); setDurationTouched(true); setDefaultSaved(false); queueSave({ match_duration: v }); };
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
        warning = t("⚠ El jugador seleccionado no estaba en el campo en el minuto {minute}. Se registra igualmente.", { minute });
      }
    }
    if (newEvType === "card" && newEvTeam === "home" && newEvPlayerId) {
      if (!isOnField(newEvPlayerId, minute, starterIds, matchEvents)) {
        warning = t("⚠ El jugador seleccionado no estaba en el campo en el minuto {minute}. Se registra igualmente.", { minute });
      }
    }

    const ev = { id: Date.now().toString(), type: newEvType, team: newEvTeam, minute };
    if (newEvType === "goal") { ev.playerId = newEvPlayerId; ev.assistId = newEvAssistId; ev.goalDetail = newEvGoal; ev.goalType = toStored(newEvGoal).goal_type; }
    if (newEvType === "sub") { ev.playerIn = newEvPlayerIn; ev.playerOut = newEvPlayerOut; }
    if (newEvType === "card") { ev.playerId = newEvPlayerId; ev.cardColor = newEvCardColor; }

    commitEvents([...matchEventsRef.current, ev]);
    setEventWarning(warning);
    setNewEvGoal({}); setNewEvMinute(""); setNewEvPlayerId(""); setNewEvAssistId(""); setNewEvPlayerIn(""); setNewEvPlayerOut("");
  };

  // Campos del partido que se guardan con los eventos (el marcador solo si cambia el número de goles)
  const eventFields = (evs) => ({
    match_events: evs,
    goal_events_source: "manual",
    goal_events: evs.filter(e => e.type === "goal").map(e => ({
      id: e.id, team: e.team, minute: e.minute,
      player_id: e.playerId, assist_player_id: e.assistId, goal_type: e.goalType, ...toStored(e.goalDetail || fromStored({ goal_type: e.goalType })),
    })),
  });
  const refreshEvent = () => {
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  // Todo lo que se guarda va en cola, de uno en uno y en orden, para que dos cambios seguidos no se pisen
  const chainRef = useRef(Promise.resolve());
  const inflightRef = useRef(0);
  const failedRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);
  const pendingRef = useRef({}); // campos del partido (marcador, formato, duración) esperando a guardarse
  const matchEventsRef = useRef([]);
  const saveStatsRef = useRef(null);
  matchEventsRef.current = matchEvents;

  const runSave = (job) => {
    inflightRef.current += 1;
    if (mountedRef.current) setSaveState("saving");
    chainRef.current = chainRef.current.then(job).then(
      () => {},
      (err) => { failedRef.current = true; console.error("Autoguardado del acta:", err); },
    ).then(() => {
      inflightRef.current -= 1;
      if (inflightRef.current > 0 || !mountedRef.current) return;
      if (Object.keys(pendingRef.current).length) { setSaveState("pending"); return; }
      setSaveState(failedRef.current ? "error" : "saved");
      failedRef.current = false;
    });
    return chainRef.current;
  };

  // Marcador, formato y duración: se guardan solos 0,7 s después del último cambio (y al salir de la pestaña)
  const flushPending = () => {
    clearTimeout(timerRef.current);
    const fields = pendingRef.current;
    if (!Object.keys(fields).length) return Promise.resolve();
    pendingRef.current = {};
    return runSave(async () => {
      try {
        await base44.entities.Event.update(eventId, fields);
      } catch (err) {
        pendingRef.current = { ...fields, ...pendingRef.current }; // se conserva para reintentar
        throw err;
      }
      refreshEvent();
      // Si cambia el formato o la duración, los minutos de los jugadores se recalculan con ella
      if ("match_duration" in fields || "football_format" in fields) await saveStatsRef.current(matchEventsRef.current, true);
    });
  };
  function queueSave(fields) {
    pendingRef.current = { ...pendingRef.current, ...fields };
    setSaveState("pending");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushPending, 700);
  }
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; flushPending(); };
  }, []);

  const goalCount = (evs, side) => evs.filter(e => e.type === "goal" && e.team === side).length;

  // Añadir, quitar o editar un evento: se guarda al momento. Si cambian los goles de un equipo, su marcador se actualiza
  // y se guarda con ellos (el del otro equipo no se toca, salvo que aún estuviera vacío).
  const commitEvents = (next) => {
    const prev = matchEventsRef.current;
    matchEventsRef.current = next;
    setMatchEvents(next);
    const fields = eventFields(next);
    for (const [side, key, current, set] of [["home", "score_home", scoreHome, setScoreHome], ["away", "score_away", scoreAway, setScoreAway]]) {
      if (goalCount(prev, side) !== goalCount(next, side) || current === "" || current == null) {
        fields[key] = goalCount(next, side);
        set(fields[key]);
        delete pendingRef.current[key]; // ya va en este guardado
      }
    }
    return runSave(async () => {
      await base44.entities.Event.update(eventId, fields);
      refreshEvent();
      await saveStatsRef.current(next, true);
    });
  };

  // Escribir a mano el marcador (no se guarda mientras falte uno de los dos números)
  const changeScore = (side, raw) => {
    const home = side === "us" ? raw : scoreHome;
    const away = side === "rival" ? raw : scoreAway;
    (side === "us" ? setScoreHome : setScoreAway)(raw);
    if (home === "" || away === "") return;
    const n = (v) => Math.max(0, Math.floor(Number(v)) || 0);
    queueSave({ score_home: n(home), score_away: n(away) });
  };
  const changeFormat = (v) => {
    setFormat(v);
    if (!durationTouched && !event?.match_duration) setDuration(defaultDuration(v, team));
    queueSave({ football_format: v });
  };

  // Reintento manual tras un error: se guarda todo el acta de nuevo
  const saveAll = () => {
    clearTimeout(timerRef.current);
    pendingRef.current = {};
    const n = (v) => Math.max(0, Math.floor(Number(v)) || 0);
    return runSave(async () => {
      await base44.entities.Event.update(eventId, {
        ...(scoreHome !== "" && scoreAway !== "" ? { score_home: n(scoreHome), score_away: n(scoreAway) } : {}),
        football_format: format,
        ...(durationTouched || event?.match_duration ? { match_duration: duration } : {}),
        ...eventFields(matchEventsRef.current),
      });
      refreshEvent();
      await saveStatsRef.current(matchEventsRef.current, true);
    });
  };

  const [editEv, setEditEv] = useState(null);
  const [savingEv, setSavingEv] = useState(false);
  const saveEdit = async () => {
    setSavingEv(true);
    try { await commitEvents(matchEventsRef.current.map(e => e.id === editEv.id ? { ...editEv, edited: true } : e)); }
    finally { setSavingEv(false); setEditEv(null); }
  };
  const deleteEdit = async () => {
    await commitEvents(matchEventsRef.current.filter(e => e.id !== editEv.id));
    setEditEv(null);
  };
  const removeEvent = (id) => { commitEvents(matchEventsRef.current.filter(e => e.id !== id)); };
  const playerOptions = convocados.length > 0 ? convocados : [...players].sort(sortByPosition);
  const setE = (k, v) => setEditEv(prev => ({ ...prev, [k]: v }));
  const PlayerSelect = ({ value, onChange, placeholder, allowNone }) => (
    <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? "" : v)}>
      <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">{t("— Ninguno —")}</SelectItem>}
        {!allowNone && <SelectItem value="none">{t("— Sin asignar —")}</SelectItem>}
        {playerOptions.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}
      </SelectContent>
    </Select>
  );

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

  saveStatsRef.current = saveStats;

  // Partido con goles apuntados pero sin marcador guardado: el marcador sale de los goles y se guarda (solo esta vez)
  const healedRef = useRef(false);
  useEffect(() => {
    if (healedRef.current || !event?.id || (event.score_home ?? null) !== null || (event.score_away ?? null) !== null) return;
    const goals = event.match_events?.length ? event.match_events.filter(e => e.type === "goal") : (event.goal_events || []);
    const home = goals.filter(e => e.team === "home").length, away = goals.filter(e => e.team === "away").length;
    if (home + away === 0) return;
    healedRef.current = true;
    setScoreHome(home); setScoreAway(away);
    queueSave({ score_home: home, score_away: away });
  }, [event?.id, event?.score_home, event?.score_away]);

  return (
    <div className="space-y-5">

      {/* ── Formato y resultado ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t("Formato")}</p>
            <Select value={format} onValueChange={changeFormat} disabled={teamF7}>
              <SelectTrigger className="w-36 border-gray-200 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FOOTBALL_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{t(f.label)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t("Duración")}</p>
            <Select value={duration} onValueChange={pickDuration}>
              <SelectTrigger className="w-44 border-gray-200 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {durationOptions.map(d => <SelectItem key={d.value} value={d.value}>{t(d.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {team?.id && (duration !== teamDuration || defaultSaved) && (
            <button type="button" onClick={saveTeamDefault} disabled={savingDefault || defaultSaved}
              className={`h-8 text-xs rounded-md border px-2.5 ${defaultSaved ? "border-green-200 bg-green-50 text-green-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              title={t("Los próximos partidos de este equipo empezarán con esta duración")}>
              {defaultSaved ? t("✓ Habitual del equipo") : savingDefault ? t("Guardando…") : t("Guardar como habitual de {name}", { name: team.name })}
            </button>
          )}
          <SaveStatus state={saveState} onRetry={saveAll} className="ml-auto" />
        </div>

        {/* Mismo orden que la cabecera del partido: el equipo local a la izquierda (el marcador guardado sigue siendo nuestros goles / goles del rival) */}
        {(() => {
          const us = { key: "us", label: t("Nuestro equipo"), value: scoreHome, set: setScoreHome };
          const rival = { key: "rival", label: event?.opponent || t("Rival"), value: scoreAway, set: setScoreAway };
          const [left, right] = event?.is_home === false ? [rival, us] : [us, rival];
          return (
            <div className="flex items-end gap-2 sm:gap-4">
              {[left, right].map((tm, i) => (
                <React.Fragment key={tm.key}>
                  {i === 1 && <span className="text-3xl font-black text-gray-300 pb-3">–</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1 h-8 flex items-end leading-tight line-clamp-2">{tm.label}</p>
                    <Input type="number" min="0" inputMode="numeric" value={tm.value} onChange={e => changeScore(tm.key, e.target.value)}
                      className="text-2xl font-black text-center h-14 border-gray-200" />
                  </div>
                </React.Fragment>
              ))}
            </div>
          );
        })()}
        {matchEvents.length > 0 && (
          <p className="text-[10px] text-gray-400 text-center">{t("Marcador actualizado según eventos · editable manualmente")}</p>
        )}
      </div>

      {/* ── Añadir evento de partido ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-bold text-gray-900">{t("Añadir evento al partido")}</p>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <p className="text-[10px] text-gray-400 mb-1">{t("Tipo")}</p>
            <Select value={newEvType} onValueChange={setNewEvType}>
              <SelectTrigger className="h-8 w-32 text-xs border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="goal">{t("⚽ Gol")}</SelectItem>
                <SelectItem value="sub">{t("🔄 Cambio")}</SelectItem>
                <SelectItem value="card">{t("🟨 Tarjeta")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">{t("Equipo")}</p>
            <Select value={newEvTeam} onValueChange={setNewEvTeam}>
              <SelectTrigger className="h-8 w-36 text-xs border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">{t("Nuestro equipo")}</SelectItem>
                <SelectItem value="away">{event?.opponent || t("Rival")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">{t("Minuto")}</p>
            <Input type="number" min="1" max={matchMinutes + 15} value={newEvMinute} onChange={e => setNewEvMinute(e.target.value)}
              className="h-8 w-16 text-xs border-gray-200" placeholder="1'" />
          </div>

          {/* Campos específicos por tipo */}
          {newEvType === "goal" && newEvTeam === "home" && (
            <>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{t("Goleador")}</p>
                <Select value={newEvPlayerId} onValueChange={setNewEvPlayerId}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder={t("Jugador…")} /></SelectTrigger>
                  <SelectContent>
                    {convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{t("Asistente")}</p>
                <Select value={newEvAssistId} onValueChange={setNewEvAssistId}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder={t("Asistente…")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>{t("Sin asistencia")}</SelectItem>
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
                <p className="text-[10px] text-gray-400 mb-1">{t("Entra")}</p>
                <Select value={newEvPlayerIn} onValueChange={setNewEvPlayerIn}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder={t("Jugador…")} /></SelectTrigger>
                  <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">{t("Sale")}</p>
                <Select value={newEvPlayerOut} onValueChange={setNewEvPlayerOut}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder={t("Jugador…")} /></SelectTrigger>
                  <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {newEvType === "card" && newEvTeam === "home" && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">{t("Jugador")}</p>
              <Select value={newEvPlayerId} onValueChange={setNewEvPlayerId}>
                <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue placeholder={t("Jugador…")} /></SelectTrigger>
                <SelectContent>{convocados.map(p => <SelectItem key={p.id} value={p.id}>{playerFullName(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {newEvType === "card" && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">{t("Tipo")}</p>
              <Select value={newEvCardColor} onValueChange={setNewEvCardColor}>
                <SelectTrigger className="h-8 w-40 text-xs border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent>{CARD_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{t(c.label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <Button variant="club" onClick={addEvent} size="sm" className="h-8 mt-auto">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("Añadir")}
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
          <p className="text-sm font-bold text-gray-900">{t("📋 Línea del tiempo")}</p>
          <Timeline events={matchEvents} players={players} opponent={event?.opponent} onRemove={removeEvent} onEdit={ev => setEditEv({ ...ev })} />
          <p className="text-[10px] text-gray-400">{t("Pulsa el lápiz para completar o corregir un evento (asistente, tipo de gol, jugador…). Los datos vienen de la FCF y tus cambios se mantienen al volver a sincronizar.")}</p>
        </div>
      )}

      {/* ── Alineación y resumen por jugador ── */}
      <LineupSummary eventId={eventId} event={event} convocation={convocation} convocados={convocados} starterIds={starterIds}
        matchEvents={matchEvents} matchMinutes={matchMinutes} onRecompute={() => saveStats(matchEvents, true)} />

      {/* ── Editar evento ── */}
      <Dialog open={!!editEv} onOpenChange={o => { if (!o) setEditEv(null); }}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle>{editEv?.type === "goal" ? t("⚽ Editar gol") : editEv?.type === "card" ? t("🟨 Editar tarjeta") : t("🔄 Editar cambio")}</DialogTitle>
          </DialogHeader>
          {editEv && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-24">
                  <p className="text-xs text-gray-500 mb-1">{t("Minuto")}</p>
                  <Input type="number" min="0" value={editEv.minute} onChange={e => setE("minute", e.target.value)} className="h-9 border-gray-200" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">{t("Equipo")}</p>
                  <Select value={editEv.team} onValueChange={v => setE("team", v)}>
                    <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">{t("Nuestro equipo")}</SelectItem>
                      <SelectItem value="away">{event?.opponent || t("Rival")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editEv.type === "goal" && (
                <>
                  {editEv.team === "home" ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("Goleador")} {editEv.fcfName ? <span className="text-gray-400">{t("· FCF: {fcfName}", { fcfName: editEv.fcfName })}</span> : null}</p>
                        {PlayerSelect({ value: editEv.playerId, onChange: v => setE("playerId", v), placeholder: t("Jugador…") })}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("Asistente")}</p>
                        {PlayerSelect({ value: editEv.assistId, onChange: v => setE("assistId", v), placeholder: t("Sin asistencia"), allowNone: true })}
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t("Goleador rival")}</p>
                      <Input value={editEv.fcfName || ""} onChange={e => setE("fcfName", e.target.value)} className="h-9 border-gray-200" placeholder={t("Nombre (opcional)")} />
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
                      <p className="text-xs text-gray-500 mb-1">{t("Jugador")}</p>
                      {PlayerSelect({ value: editEv.playerId, onChange: v => setE("playerId", v), placeholder: t("Jugador…") })}
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t("Tarjeta")}</p>
                    <Select value={editEv.cardColor} onValueChange={v => setE("cardColor", v)}>
                      <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                      <SelectContent>{CARD_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{t(c.label)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {editEv.type === "sub" && editEv.team === "home" && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t("Entra")}</p>
                    {PlayerSelect({ value: editEv.playerIn, onChange: v => setE("playerIn", v), placeholder: t("Jugador…") })}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t("Sale")}</p>
                    {PlayerSelect({ value: editEv.playerOut, onChange: v => setE("playerOut", v), placeholder: t("Jugador…") })}
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button variant="outline" size="icon" onClick={deleteEdit} title={t("Eliminar evento")}><Trash2 className="w-4 h-4 text-gray-400" /></Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setEditEv(null)}>{t("Cancelar")}</Button>
                <Button variant="club" onClick={saveEdit} disabled={savingEv}>
                  {savingEv ? t("Guardando…") : t("Guardar")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}