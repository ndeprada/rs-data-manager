import React, { useState } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin, Clock, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

const EVENT_META = {
  entrenamiento:     { label: "Entreno",    color: "orange" },
  entrenamiento_fisico: { label: "Físico",  color: "orange" },
  sesion_teorica:    { label: "Táctica",    color: "orange" },
  sesion_video:      { label: "Vídeo",      color: "orange" },
  partido_amistoso:  { label: "Amistoso",   color: "granate" },
  partido_liga:      { label: "Liga",       color: "granate" },
  torneo:            { label: "Torneo",     color: "granate" },
  reunion_equipo:    { label: "Reunión",    color: "slate" },
  reunion_jugador:   { label: "Reunión",    color: "slate" },
  reunion_capitanes: { label: "Capitanes",  color: "slate" },
  stage:             { label: "Stage",      color: "slate" },
  concentracion:     { label: "Concentr.",  color: "slate" },
  cena_equipo:       { label: "Cena",       color: "slate" },
  comida_equipo:     { label: "Comida",     color: "slate" },
};

// Color styles per category
const COLOR_STYLES = {
  orange: {
    bar: "var(--naranja)",
    bg: "#fffbf5",
    pill: "#fff0d9",
    pillText: "var(--naranja)",
    accent: "var(--naranja)",
    border: "#fcd49a",
  },
  granate: {
    bar: "var(--granate)",
    bg: "#fdf5f6",
    pill: "#fce8ea",
    pillText: "var(--granate)",
    accent: "var(--granate)",
    border: "#f5c2c7",
  },
  slate: {
    bar: "#334155",
    bg: "#f8fafc",
    pill: "#e2e8f0",
    pillText: "#334155",
    accent: "#334155",
    border: "#cbd5e1",
  },
};

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function EventCard({ event, navigate, onEventClick }) {
  const meta = EVENT_META[event.type] || { label: event.type, color: "slate" };
  const styles = COLOR_STYLES[meta.color];
  const isMatch = MATCH_TYPES.includes(event.type);

  const onClick = () => {
    if (isMatch) {
      navigate(`/MatchDetail?id=${event.id}&teamId=${event.team_id}`);
      return;
    }
    if (onEventClick) {
      onEventClick(event);
    } else {
      navigate(`/MyTeam/Attendance?eventId=${event.id}`);
    }
  };

  const timeStr = event.date ? format(new Date(event.date), "HH:mm") : null;
  const endTimeStr = event.end_date ? format(new Date(event.end_date), "HH:mm") : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group transition-all duration-150 hover:scale-[1.02] hover:shadow-md rounded-lg overflow-hidden"
      style={{ border: `1px solid ${styles.border}`, background: styles.bg }}
    >
      {/* Colored accent bar */}
      <div className="h-1 w-full" style={{ background: styles.bar }} />

      <div className="px-2 py-2">
        {/* Label pill */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ background: styles.pill, color: styles.pillText, fontFamily: "var(--font-display)" }}
          >
            {meta.label}
          </span>
          {isMatch && (
            <span className="text-[9px]">⚽</span>
          )}
        </div>

        {/* Title */}
        <p
          className="text-[11px] font-black leading-tight line-clamp-2 text-gray-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isMatch && event.opponent ? `vs ${event.opponent}` : event.title}
        </p>

        {/* Time */}
        {timeStr && (
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-2.5 h-2.5 shrink-0" style={{ color: styles.accent }} />
            <span className="text-[9px] font-semibold" style={{ color: styles.accent }}>
              {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ""}
            </span>
          </div>
        )}

        {/* Location (only for matches) */}
        {isMatch && event.location && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0 text-gray-400" />
            <span className="text-[9px] text-gray-400 truncate">{event.location}</span>
          </div>
        )}
      </div>
    </button>
  );
}

const DAYS_ES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

export default function WeeklyCalendar({ events = [], teamId, onDayClick, onEventClick }) {
  const navigate = useNavigate();
  const [weekBase, setWeekBase] = useState(new Date());

  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekBase, { weekStartsOn: 1 });
  const weekNum = getWeekNumber(weekStart);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsInWeek = events.filter(e => {
    const start = new Date(e.date);
    const end = e.end_date ? new Date(e.end_date) : start;
    return start <= weekEnd && end >= weekStart;
  });

  const getEventsForDay = (day) =>
    eventsInWeek
      .filter(e => {
        const start = new Date(e.date);
        const end = e.end_date ? new Date(e.end_date) : start;
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        return start <= dayEnd && end >= dayStart;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Days with events for mobile list view
  const daysWithEvents = days.filter(day => getEventsForDay(day).length > 0);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3.5"
        style={{ background: "var(--granate)" }}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60" style={{ fontFamily: "var(--font-display)" }}>
            Previsión semanal
          </p>
          <p className="text-sm font-black text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Sem. {weekNum} · {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekBase(w => subWeeks(w, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors text-white/70 hover:text-white hover:bg-white/20">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekBase(new Date())}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-colors text-white/70 hover:text-white hover:bg-white/20"
            style={{ fontFamily: "var(--font-display)" }}>
            Hoy
          </button>
          <button onClick={() => setWeekBase(w => addWeeks(w, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors text-white/70 hover:text-white hover:bg-white/20">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MOBILE LIST VIEW (hidden on md+) ── */}
      <div className="block md:hidden bg-white">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const todayDay = isToday(day);
          const isWeekend = i >= 5;
          const hasEvents = dayEvents.length > 0;

          return (
            <div key={i} className="border-b border-gray-100 last:border-b-0">
              {/* Day row */}
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ background: todayDay ? "#fff8f8" : isWeekend ? "#fff8f0" : "white" }}
              >
                {/* Date badge */}
                <div className="shrink-0 text-center w-10">
                  <p className="text-[9px] font-black uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-display)", color: todayDay ? "var(--naranja)" : "#9ca3af" }}>
                    {DAYS_ES[i]}
                  </p>
                  <div className="mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-black"
                    style={{
                      fontFamily: "var(--font-display)",
                      background: todayDay ? "var(--granate)" : "transparent",
                      color: todayDay ? "white" : isWeekend ? "#64748b" : "#111827",
                    }}>
                    {format(day, "d")}
                  </div>
                </div>

                {/* Events or empty */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {!hasEvents ? (
                    <p className="text-[11px] text-gray-300">Sin eventos</p>
                  ) : (
                    dayEvents.map(ev => {
                      const meta = EVENT_META[ev.type] || { label: ev.type, color: "slate" };
                      const styles = COLOR_STYLES[meta.color];
                      const isMatch = MATCH_TYPES.includes(ev.type);
                      const timeStr = ev.date ? format(new Date(ev.date), "HH:mm") : null;
                      return (
                        <button key={ev.id}
                          onClick={() => {
                            if (isMatch) navigate(`/MatchDetail?id=${ev.id}&teamId=${ev.team_id}`);
                            else if (onEventClick) onEventClick(ev);
                            else navigate(`/MyTeam/Attendance?eventId=${ev.id}`);
                          }}
                          className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg"
                          style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
                        >
                          <div className="w-1.5 h-full min-h-[20px] rounded-full shrink-0" style={{ background: styles.bar }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black truncate text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                              {isMatch && ev.opponent ? `vs ${ev.opponent}` : ev.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-bold uppercase" style={{ color: styles.pillText }}>{meta.label}</span>
                              {timeStr && <span className="text-[9px] text-gray-400">{timeStr}</span>}
                              {ev.location && <span className="text-[9px] text-gray-400 truncate max-w-[120px]">{ev.location}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Add button */}
                {onDayClick && (
                  <button onClick={() => onDayClick(day)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP GRID VIEW (hidden on mobile) ── */}
      <div className="hidden md:grid grid-cols-7 bg-white" style={{ borderTop: "1px solid #f3f4f6" }}>
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const todayDay = isToday(day);
          const isWeekend = i >= 5;
          const hasMatch = dayEvents.some(e => MATCH_TYPES.includes(e.type));

          return (
            <div
             key={i}
             className="flex flex-col"
             style={{
               borderRight: i < 6 ? "1px solid #f3f4f6" : "none",
               background: isWeekend ? "#fff8f0" : "white",
               minHeight: 140,
             }}
            >
              <div
                className="px-2 pt-3 pb-2 text-center"
                style={{ borderBottom: hasMatch ? `2px solid var(--granate)` : "1px solid #f3f4f6" }}
              >
                <p className="text-[9px] font-black uppercase tracking-widest mb-1"
                  style={{ fontFamily: "var(--font-display)", color: todayDay ? "var(--naranja)" : isWeekend ? "#94a3b8" : "#9ca3af" }}>
                  {DAYS_ES[i]}
                </p>
                <div className="mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-black transition-all"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: todayDay ? "var(--granate)" : "transparent",
                    color: todayDay ? "white" : isWeekend ? "#64748b" : "#111827",
                    boxShadow: todayDay ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
                  }}>
                  {format(day, "d")}
                </div>
              </div>
              <div className="flex flex-col gap-2 p-2.5 flex-1">
                {dayEvents.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-4 h-px bg-gray-200" />
                  </div>
                ) : (
                  dayEvents.map(ev => (
                    <EventCard key={ev.id} event={ev} navigate={navigate} onEventClick={onEventClick} />
                  ))
                )}
              </div>
              {onDayClick && (
                <div className="px-1.5 pb-1.5">
                  <button onClick={() => onDayClick(day)}
                    className="w-full flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    title={`Añadir evento el ${format(day, "d MMM", { locale: es })}`}>
                    <Plus className="w-2.5 h-2.5" />
                    Añadir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── LEGEND ── */}
      <div className="px-4 py-2.5 flex items-center gap-4 bg-gray-50 border-t border-gray-100">
        {[
          { color: "var(--naranja)", label: "Entrenamiento" },
          { color: "var(--granate)", label: "Partido" },
          { color: "#334155",        label: "Otro" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}