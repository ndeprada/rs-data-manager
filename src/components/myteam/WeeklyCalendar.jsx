import React, { useState } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Clock, Plus, Home, Plane, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { scoreText, scoreTitle, playedResult } from "@/lib/matchScore";
import EventWeather from "@/components/EventWeather";
import { useT, useDateLocale, msg } from "@/i18n";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

const EVENT_META = {
  entrenamiento:     { label: msg("Entreno"),    color: "orange" },
  entrenamiento_fisico: { label: msg("Físico"),  color: "orange" },
  sesion_teorica:    { label: msg("Táctica"),    color: "orange" },
  sesion_video:      { label: msg("Vídeo"),      color: "orange" },
  partido_amistoso:  { label: msg("Amistoso"),   color: "granate" },
  partido_liga:      { label: msg("Liga"),       color: "granate" },
  torneo:            { label: msg("Torneo"),     color: "granate" },
  reunion_equipo:    { label: msg("Reunión"),    color: "slate" },
  reunion_jugador:   { label: msg("Reunión"),    color: "slate" },
  reunion_capitanes: { label: msg("Capitanes"),  color: "slate" },
  stage:             { label: msg("Stage"),      color: "slate" },
  concentracion:     { label: msg("Concentr."),  color: "slate" },
  cena_equipo:       { label: msg("Cena"),       color: "slate" },
  comida_equipo:     { label: msg("Comida"),     color: "slate" },
  evento_club:       { label: msg("Club"),       color: "granate" },
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

// Cancelado o suspendido: gris, texto tachado y el motivo debajo
const OFF_STYLES = { bar: "#9ca3af", bg: "#f9fafb", pill: "#e5e7eb", pillText: "#6b7280", accent: "#6b7280", border: "#e5e7eb" };

// Partido ya jugado: la tarjeta toma el color del resultado (verde victoria, rojo derrota, ámbar empate) y enseña el marcador
const RESULT_STYLES = {
  victoria: { solid: "#16a34a", bg: "#f0fdf4", pill: "#dcfce7", border: "#86efac", text: "#166534", word: msg("Victoria") },
  derrota:  { solid: "#dc2626", bg: "#fef2f2", pill: "#fee2e2", border: "#fca5a5", text: "#991b1b", word: msg("Derrota") },
  empate:   { solid: "#d97706", bg: "#fffbeb", pill: "#fef3c7", border: "#fcd34d", text: "#92400e", word: msg("Empate") },
};

// Colores de la tarjeta: suspendido (gris) > resultado (verde/rojo/ámbar) > tipo de evento
function cardStyles(meta, off, rs) {
  if (off) return OFF_STYLES;
  if (rs) return { bar: rs.solid, bg: rs.bg, pill: rs.pill, pillText: rs.text, accent: rs.text, border: rs.border };
  return COLOR_STYLES[meta.color];
}

function EventCard({ event, navigate, onEventClick }) {
  const t = useT();
  const meta = EVENT_META[event.type] || { label: event.type, color: "slate" };
  const off = isCancelled(event);
  const result = playedResult(event);
  const rs = result ? RESULT_STYLES[result] : null;
  const styles = cardStyles(meta, off, rs);
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
            {t(meta.label)}
          </span>
          {isMatch && (
            event.is_home === false
              ? <span title={t("Fuera")} className="inline-flex"><Plane className="w-3.5 h-3.5 text-sky-600" /></span>
              : <span title={t("Casa")} className="inline-flex"><Home className="w-3.5 h-3.5 text-emerald-600" /></span>
          )}
        </div>

        {/* Title */}
        <div className="flex items-center gap-1.5">
          {isMatch && event.opponent_logo_url && (
            <img src={event.opponent_logo_url} alt="" loading="lazy" className="w-6 h-6 object-contain shrink-0" />
          )}
          <p
            className={`text-[11px] font-black leading-tight line-clamp-2 ${off ? "text-gray-500 line-through" : "text-gray-900"}`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {isMatch && event.opponent ? `vs ${event.opponent}` : event.title}
          </p>
        </div>

        {/* Resultado (partido ya jugado) */}
        {rs && (
          <div className="mt-1.5 rounded-md px-2 py-1 text-center text-white" style={{ background: rs.solid }}
            title={`${t(rs.word)} · ${scoreTitle(event, undefined, t)}`} data-testid="match-result" data-result={result}>
            <p className="text-lg font-black leading-none tabular-nums" style={{ fontFamily: "var(--font-display)" }}>{scoreText(event)}</p>
            <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest leading-none">{t(rs.word)}</p>
          </div>
        )}

        {/* Time */}
        {timeStr && (
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-2.5 h-2.5 shrink-0" style={{ color: styles.accent }} />
            <span className={`text-[9px] font-semibold ${off ? "line-through" : ""}`} style={{ color: styles.accent }}>
              {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ""}
            </span>
            <EventWeather event={event} rain size="sm" className="ml-auto" />
          </div>
        )}

        {off && (
          <p className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-gray-500" title={cancelText(event, t)}>
            <Ban className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{cancelText(event, t)}</span>
          </p>
        )}

        {/* Location (only for matches) */}
        {(isMatch ? event.location : (event.location || event.location_url)) && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0 text-gray-400" />
            {event.location_url ? (
              <span role="link" onClick={(e) => { e.stopPropagation(); window.open(/^https?:\/\//i.test(event.location_url) ? event.location_url : `https://${event.location_url}`, "_blank", "noopener"); }}
                className="text-[9px] text-sky-600 underline truncate cursor-pointer">{event.location || t("Ver mapa")}</span>
            ) : (
              <span className="text-[9px] text-gray-400 truncate">{event.location}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export default function WeeklyCalendar({ events = [], teamId, onDayClick, onEventClick, title, selectedEventId, forceGrid = false }) {
  const t = useT();
  const dfl = useDateLocale();
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
            {title || t("Previsión semanal")}
          </p>
          <p className="text-sm font-black text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {t("Sem. {weekNum} · {format} – {format2}", { weekNum, format: format(weekStart, "d MMM", { locale: dfl }), format2: format(weekEnd, "d MMM", { locale: dfl }) })}
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
            {t("Hoy")}
          </button>
          <button onClick={() => setWeekBase(w => addWeeks(w, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors text-white/70 hover:text-white hover:bg-white/20">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MOBILE LIST VIEW (hidden on md+) ── */}
      <div className={`${forceGrid ? "hidden" : "block md:hidden"} bg-white`}>
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
                    {format(days[i], "EEE", { locale: dfl }).replace(/\.$/, "").toUpperCase()}
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
                    <p className="text-[11px] text-gray-300">{t("Sin eventos")}</p>
                  ) : (
                    dayEvents.map(ev => {
                      const meta = EVENT_META[ev.type] || { label: ev.type, color: "slate" };
                      const off = isCancelled(ev);
                      const result = playedResult(ev);
                      const rs = result ? RESULT_STYLES[result] : null;
                      const styles = cardStyles(meta, off, rs);
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
                          {isMatch && (ev.is_home === false ? <Plane className="w-4 h-4 text-sky-600 shrink-0" /> : <Home className="w-4 h-4 text-emerald-600 shrink-0" />)}
                          {isMatch && ev.opponent_logo_url && <img src={ev.opponent_logo_url} alt="" loading="lazy" className="w-6 h-6 object-contain shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-black truncate ${off ? "text-gray-500 line-through" : "text-gray-900"}`} style={{ fontFamily: "var(--font-display)" }}>
                              {isMatch && ev.opponent ? `vs ${ev.opponent}` : ev.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-bold uppercase" style={{ color: styles.pillText }}>{off ? cancelText(ev, t) : rs ? `${t(meta.label)} · ${t(rs.word)}` : t(meta.label)}</span>
                              {timeStr && <span className={`text-[9px] text-gray-400 ${off ? "line-through" : ""}`}>{timeStr}</span>}
                              <EventWeather event={ev} rain size="sm" />
                              {ev.location && <span className="text-[9px] text-gray-400 truncate max-w-[120px]">{ev.location}</span>}
                            </div>
                          </div>
                          {rs && (
                            <span className="shrink-0 rounded-md px-2 py-1 text-sm font-black leading-none tabular-nums text-white" style={{ background: rs.solid, fontFamily: "var(--font-display)" }}
                              title={`${t(rs.word)} · ${scoreTitle(ev, undefined, t)}`} data-testid="match-result" data-result={result}>
                              {scoreText(ev)}
                            </span>
                          )}
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
      <div className={forceGrid ? "overflow-x-auto" : "hidden md:block"}>
      <div className="grid grid-cols-7 bg-white" style={{ borderTop: "1px solid #f3f4f6", minWidth: forceGrid ? 760 : undefined }}>
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
                  {format(days[i], "EEE", { locale: dfl }).replace(/\.$/, "").toUpperCase()}
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
                    title={t("Añadir evento el {format}", { format: format(day, "d MMM", { locale: dfl }) })}>
                    <Plus className="w-2.5 h-2.5" />
                    {t("Añadir")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      </div>

      {/* ── LEGEND ── */}
      <div className="px-4 py-2.5 flex items-center gap-4 bg-gray-50 border-t border-gray-100">
        {[
          { color: "var(--naranja)", label: t("Entrenamiento") },
          { color: "var(--granate)", label: t("Partido") },
          { color: "#334155",        label: t("Otro") },
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