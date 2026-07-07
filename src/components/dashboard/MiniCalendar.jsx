import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export default function MiniCalendar({ events = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  const getEventsForDate = (date) => events.filter((e) => isSameDay(new Date(e.date), date));

  return (
    <div className="bg-white border border-gray-200 shadow-sm" style={{ borderRadius: "4px" }}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700" style={{ fontFamily: "var(--font-display)" }}>
            {format(currentDate, "MMM yyyy", { locale: es })}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <Link to="/Calendar" className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--granate)", fontFamily: "var(--font-display)" }}>
          Ver todo →
        </Link>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 mb-1">
          {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
            <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isToday = isSameDay(day, today);
            const hasMatch = dayEvents.some((e) => MATCH_TYPES.includes(e.type));
            const hasTraining = dayEvents.some((e) => !MATCH_TYPES.includes(e.type));
            const inMonth = day.getMonth() === currentDate.getMonth();

            return (
              <button
                key={day.toISOString()}
                onClick={() => navigate("/Calendar")}
                className={`flex flex-col items-center py-1 rounded transition-colors ${inMonth ? "hover:bg-gray-50" : "opacity-30"}`}
              >
                <span className={`text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "text-white" : "text-gray-700"}`}
                  style={isToday ? { background: "var(--granate)" } : {}}>
                  {format(day, "d")}
                </span>
                <div className="flex gap-0.5 mt-0.5 h-1">
                  {hasMatch && <div className="w-1 h-1 rounded-full" style={{ background: "var(--granate)" }} />}
                  {hasTraining && <div className="w-1 h-1 rounded-full" style={{ background: "var(--naranja)" }} />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--granate)" }} />
            <span className="text-[10px] text-gray-500">Partido</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--naranja)" }} />
            <span className="text-[10px] text-gray-500">Entrenamiento</span>
          </div>
        </div>
      </div>
    </div>
  );
}