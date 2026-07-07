import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Clock, Pencil, Trash2, Users, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const EVENT_TYPES = [
  { value: "partido_amistoso", label: "Partido amistoso", isMatch: true },
  { value: "partido_liga", label: "Partido de liga", isMatch: true },
  { value: "torneo", label: "Torneo", isMatch: true },
  { value: "entrenamiento_fisico", label: "Entrenamiento físico", isMatch: false },
  { value: "entrenamiento", label: "Entrenamiento", isMatch: false },
  { value: "sesion_teorica", label: "Sesión teórica", isMatch: false },
  { value: "sesion_video", label: "Sesión de vídeo", isMatch: false },
  { value: "reunion_equipo", label: "Reunión de equipo", isMatch: false },
  { value: "reunion_jugador", label: "Reunión jugador", isMatch: false },
  { value: "reunion_capitanes", label: "Reunión de capitanes", isMatch: false },
  { value: "stage", label: "Stage", isMatch: false },
  { value: "concentracion", label: "Concentración", isMatch: false },
  { value: "cena_equipo", label: "Cena de equipo", isMatch: false },
  { value: "comida_equipo", label: "Comida de equipo", isMatch: false },
];

const isMatchType = (type) => EVENT_TYPES.find(t => t.value === type)?.isMatch;
const getEventLabel = (type) => EVENT_TYPES.find(t => t.value === type)?.label || type;

export default function EventListWithDragDrop({
  events,
  teams,
  onDragEnd,
  onEdit,
  onDelete,
  onOpenAttendance,
  onOpenSession,
  onOpenConvocation,
  onNavigateMatch,
  onDeleteSeries,
  filterTeam
}) {
  const filteredEvents = filterTeam === "all" ? events : events.filter((e) => e.team_id === filterTeam);
  
  // Group events by date
  const eventsByDate = {};
  filteredEvents.forEach(event => {
    const dateKey = format(new Date(event.date), "yyyy-MM-dd");
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-400">No hay eventos programados</p>
          </div>
        ) : (
          sortedDates.map((dateKey) => {
            const dateEvents = eventsByDate[dateKey];
            const dateObj = new Date(dateKey);
            const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

            return (
              <div key={dateKey} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Date Header */}
                <div className={`px-5 py-3 border-b border-gray-100 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <h3 className="font-semibold text-gray-900 capitalize flex items-center gap-2">
                    {format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                    {isToday && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        Hoy
                      </span>
                    )}
                  </h3>
                </div>

                {/* Events List */}
                <Droppable droppableId={dateKey}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`divide-y divide-gray-100 ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
                    >
                      {dateEvents.map((event, index) => {
                        const team = teams.find((t) => t.id === event.team_id);
                        const isMatch = isMatchType(event.type);

                        return (
                          <Draggable
                            key={event.id}
                            draggableId={event.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`px-5 py-4 transition-colors ${
                                  snapshot.isDragging
                                    ? 'bg-blue-100 shadow-lg'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start gap-4">
                                  {/* Icon */}
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                                    style={{ background: isMatch ? "var(--granate)" : "var(--naranja)" }}
                                  >
                                    {getEventLabel(event.type).slice(0, 2).toUpperCase()}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="cursor-pointer group"
                                      onClick={() => {
                                        if (isMatch) {
                                          onNavigateMatch(event.id, event.team_id);
                                        }
                                      }}
                                    >
                                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                        {event.title}
                                      </p>
                                      <p className="text-sm text-gray-500 mt-1">
                                        {getEventLabel(event.type)}
                                      </p>
                                    </div>

                                    {/* Details */}
                                    <div className="flex flex-wrap items-center gap-3 mt-2.5 text-sm text-gray-600">
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        {format(new Date(event.date), "HH:mm")}
                                      </div>
                                      {team && (
                                        <div className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                                          {team.name}
                                        </div>
                                      )}
                                      {event.opponent && (
                                        <div className="flex items-center gap-1">
                                          vs <span className="font-medium">{event.opponent}</span>
                                        </div>
                                      )}
                                      {event.location && (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="w-4 h-4 text-gray-400" />
                                          {event.location}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex gap-1 shrink-0 mt-0.5">
                                    <button
                                      onClick={() => onOpenAttendance(event)}
                                      className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                                      title="Control de asistencia"
                                    >
                                      <ClipboardList className="w-4 h-4" />
                                    </button>
                                    {!isMatch && (
                                      <button
                                        onClick={() => onOpenSession(event)}
                                        className="p-1.5 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
                                        title="Informe de sesión"
                                      >
                                        <FileText className="w-4 h-4" />
                                      </button>
                                    )}
                                    {isMatch && (
                                      <button
                                        onClick={() => onOpenConvocation(event)}
                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Gestionar convocatoria"
                                      >
                                        <Users className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => onEdit(event)}
                                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                      title="Editar"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                     onClick={() => onDelete(event.id)}
                                     className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                     title="Eliminar este evento"
                                    >
                                     <Trash2 className="w-4 h-4" />
                                    </button>
                                    {event.series_id && onDeleteSeries && (
                                      <button
                                        onClick={() => onDeleteSeries(event.series_id)}
                                        className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors text-[9px] font-bold leading-none"
                                        title="Eliminar toda la serie recurrente"
                                        style={{ fontFamily: "var(--font-display)" }}
                                      >
                                        SERIE
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })
        )}
      </div>
    </DragDropContext>
  );
}