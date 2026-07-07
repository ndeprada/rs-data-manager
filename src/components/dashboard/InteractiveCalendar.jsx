import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];

export default function InteractiveCalendar({ events = [], teams = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const navigate = useNavigate();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date) => {
    return events.filter((e) => isSameDay(parseISO(e.date), date));
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const getTeamName = (teamId) => {
    return teams.find((t) => t.id === teamId)?.name || "—";
  };

  const isPartido = (type) => MATCH_TYPES.includes(type);

  const handleEventClick = (event) => {
    if (isPartido(event.type)) {
      navigate(`/MatchDetail?id=${event.id}&teamId=${event.team_id}`);
    } else {
      navigate(`/Calendar`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-gray-900">Calendario</h3>
          <div className="flex gap-1 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="h-8 w-8 border-gray-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 text-sm font-semibold text-gray-900">
              {format(currentDate, "MMM yyyy", { locale: es }).toUpperCase()}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="h-8 w-8 border-gray-200"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-12" />
          ))}

          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const hasPartido = dayEvents.some((e) => isPartido(e.type));
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`h-12 rounded text-sm font-medium transition-all flex flex-col items-center justify-center relative ${
                  isSelected
                    ? "bg-gray-900 text-white"
                    : dayEvents.length > 0
                    ? "bg-orange-50 text-gray-900 border border-orange-200"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span>{format(day, "d")}</span>
                {hasPartido && (
                  <div className="w-1 h-1 rounded-full" style={{ background: isSelected ? "white" : "var(--granate)" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events detail panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-fit">
        <h3 className="font-bold text-lg text-gray-900 mb-4">
          {selectedDate ? format(selectedDate, "d MMMM", { locale: es }) : "Selecciona una fecha"}
        </h3>

        {selectedDateEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">
              {selectedDate ? "Sin eventos este día" : "Haz clic en una fecha para ver detalles"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDateEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="w-full text-left border border-gray-100 rounded-xl p-3 hover:shadow-sm hover:border-gray-300 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{
                      background: isPartido(event.type) ? "var(--granate)" : "var(--naranja)",
                    }}
                  >
                    {isPartido(event.type) ? "P" : "E"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{event.title}</p>
                    <p className="text-xs text-gray-500 truncate">{getTeamName(event.team_id)}</p>
                    {event.opponent && (
                      <p className="text-xs text-gray-500">vs {event.opponent}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {format(parseISO(event.date), "HH:mm")}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </div>
                </div>
              </button>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}