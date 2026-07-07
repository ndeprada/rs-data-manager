import React, { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

const EVENT_TYPE_COLORS = {
  partido_amistoso: "#6b1f28",   // granate
  partido_liga: "#6b1f28",       // granate
  torneo: "#6b1f28",             // granate
  entrenamiento_fisico: "#e67e22", // naranja
  entrenamiento: "#e67e22",        // naranja
  sesion_teorica: "#e67e22",       // naranja
  sesion_video: "#e67e22",         // naranja
  reunion_equipo: "#64748b",       // slate
  reunion_jugador: "#64748b",      // slate
  reunion_capitanes: "#64748b",    // slate
  stage: "#e67e22",              // naranja
  concentracion: "#64748b",       // slate
  cena_equipo: "#64748b",         // slate
  comida_equipo: "#64748b",       // slate
};

export default function WeeklyCalendar({ events = [], teams = [], filterTeam = "all", onEventClick, selectedDay, onSelectDay }) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filteredEvents = filterTeam === "all" ? events : events.filter(e => e.team_id === filterTeam);

  const getEventsForDay = (day) => {
    return filteredEvents.filter(e => {
      const start = new Date(e.date);
      const end = e.end_date ? new Date(e.end_date) : start;
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return start <= dayEnd && end >= dayStart;
    });
  };

  const getEventColor = (eventType) => EVENT_TYPE_COLORS[eventType] || "#64748b";

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
      {/* Week nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-bold text-gray-800" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
          {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
        </p>
        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvts = getEventsForDay(day);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              className={`border-r border-gray-100 last:border-r-0 cursor-pointer transition-colors min-h-[160px] p-2`}
              style={{ background: isSelected ? "#fff0d9" : i >= 5 ? "#fff8f0" : "white" }}
            >
              {/* Day header */}
              <div className="mb-2 pb-2 border-b border-gray-100">
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
                  {format(day, "EEE", { locale: es })}
                </p>
                <p className={`text-lg font-black inline-flex items-center justify-center w-7 h-7 rounded-full mt-1 ${isToday ? "text-white" : "text-gray-600"}`}
                  style={isToday ? { background: "var(--granate)" } : {}}>
                  {format(day, "d")}
                </p>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvts.length === 0 ? (
                  <p className="text-[9px] text-gray-300 text-center py-4">Sin eventos</p>
                ) : (
                  dayEvts.map(evt => (
                    <div
                      key={evt.id}
                      onClick={e => { e.stopPropagation(); onEventClick(evt); }}
                      className="text-[9px] px-1.5 py-1 rounded font-bold text-white truncate hover:opacity-75 transition-opacity cursor-pointer leading-tight whitespace-normal"
                      style={{ background: getEventColor(evt.type), minHeight: "20px" }}
                      title={evt.title}
                    >
                      {evt.title}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-100 grid grid-cols-3 gap-3 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#6b1f28" }} />
          <span className="text-[10px] text-gray-400">Partido oficial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#e67e22" }} />
          <span className="text-[10px] text-gray-400">Entrenamiento</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#64748b" }} />
          <span className="text-[10px] text-gray-400">Otros eventos</span>
        </div>
      </div>
    </div>
  );
}