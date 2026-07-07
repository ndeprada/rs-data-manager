import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Send, Check, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import GuestPlayerSelector from "@/components/common/GuestPlayerSelector";

const POSITION_LABELS = {
  portero: "Portero",
  lateral: "Lateral",
  central: "Central",
  libre: "Libre",
  mediocentro: "Mediocentro",
  interior: "Interior",
  delantero_centro: "Del. Centro",
  extremo: "Extremo"
};

export default function ConvocationSection({ eventId, teamId, players, event }) {
  const queryClient = useQueryClient();
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [guestPlayers, setGuestPlayers] = useState([]);
  const [notes, setNotes] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch existing convocation
  const { data: convocation } = useQuery({
    queryKey: ["convocation", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(data => data[0] || null),
    enabled: !!eventId
  });

  // Fetch attendance records
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["attendance", eventId],
    queryFn: () => base44.entities.TrainingAttendance.filter({ event_id: eventId }),
    enabled: !!eventId
  });

  // Initialize selected players when convocation loads
  useEffect(() => {
    if (convocation?.player_ids) {
      setSelectedPlayers(convocation.player_ids);
      setNotes(convocation.notes || "");
      // Separar jugadores invitados de los del equipo
      const allPlayers = players.concat(guestPlayers);
      const guestIds = convocation.player_ids.filter(id => !players.find(p => p.id === id));
      if (guestIds.length > 0) {
        setGuestPlayers(allPlayers.filter(p => guestIds.includes(p.id)));
      }
    }
  }, [convocation]);

  // Save convocation
  const saveConvocationMutation = useMutation({
    mutationFn: (data) => {
      if (convocation) {
        return base44.entities.Convocatoria.update(convocation.id, data);
      } else {
        return base44.entities.Convocatoria.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocation", eventId] });
      setShowDialog(false);
    }
  });

  // Send notifications
  const sendNotificationsMutation = useMutation({
    mutationFn: async () => {
      const convocatedPlayers = players.filter(p => selectedPlayers.includes(p.id));
      
      for (const player of convocatedPlayers) {
        if (player.email) {
          await base44.integrations.Core.SendEmail({
            to: player.email,
            subject: `Convocatoria: ${event.title}`,
            body: `
Hola ${player.first_name},

Has sido convocado para el partido:

${event.title}
Fecha: ${format(new Date(event.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
Hora: ${format(new Date(event.date), "HH:mm")}
${event.location ? `Lugar: ${event.location}` : ''}
${event.opponent ? `Rival: ${event.opponent}` : ''}

${notes ? `Notas: ${notes}` : ''}

Por favor, confirma tu asistencia en la plataforma.

Saludos,
El cuerpo técnico
            `
          });
        }
      }
    },
    onSuccess: () => {
      if (convocation) {
        base44.entities.Convocatoria.update(convocation.id, { notified: true, notified_at: new Date().toISOString() });
      }
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["convocation", eventId] });
    }
  });

  const handleSaveConvocation = () => {
    saveConvocationMutation.mutate({
      event_id: eventId,
      team_id: teamId,
      player_ids: selectedPlayers,
      notes: notes
    });
  };

  const togglePlayer = (playerId) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  // Get attendance status for convocated players
  const getAttendanceStatus = (playerId) => {
    const record = attendanceRecords.find(r => r.player_id === playerId);
    if (!record) return "pending";
    return record.status === "present" ? "confirmed" : "not_confirmed";
  };

  // Todos los jugadores (equipo + invitados)
  const allPlayers = [...players, ...guestPlayers.filter(p => !players.find(pl => pl.id === p.id))];
  const convocatedPlayers = allPlayers.filter(p => selectedPlayers.includes(p.id));
  const confirmedCount = convocatedPlayers.filter(p => getAttendanceStatus(p.id) === "confirmed").length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">Total convocados</p>
          <p className="text-2xl font-bold text-blue-900">{selectedPlayers.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium mb-1">Confirmados</p>
          <p className="text-2xl font-bold text-green-900">{confirmedCount}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700 font-medium mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-900">{selectedPlayers.length - confirmedCount}</p>
        </div>
      </div>

      {/* Convocated Players List */}
      {selectedPlayers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              Jugadores convocados ({selectedPlayers.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Jugadores del equipo */}
            {convocatedPlayers.filter(p => p.team_id === teamId).map(player => {
              const status = getAttendanceStatus(player.id);
              return (
                <div key={player.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-700">
                      {player.jersey_number || "—"}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {player.first_name} {player.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {POSITION_LABELS[player.position] || player.position}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === "confirmed" && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100">
                        <Check className="w-4 h-4 text-green-700" />
                        <span className="text-xs font-medium text-green-700">Confirmado</span>
                      </div>
                    )}
                    {status === "pending" && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100">
                        <Clock className="w-4 h-4 text-yellow-700" />
                        <span className="text-xs font-medium text-yellow-700">Pendiente</span>
                      </div>
                    )}
                    {status === "not_confirmed" && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-100">
                        <AlertCircle className="w-4 h-4 text-red-700" />
                        <span className="text-xs font-medium text-red-700">No confirmado</span>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}

              {/* Jugadores de otros equipos */}
              {convocatedPlayers.filter(p => p.team_id !== teamId).length > 0 && (
              <>
               <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
                 <p className="text-xs font-semibold text-blue-700 uppercase">Jugadores invitados de otros equipos</p>
               </div>
               {convocatedPlayers.filter(p => p.team_id !== teamId).map(player => {
                 const status = getAttendanceStatus(player.id);
                 return (
                   <div key={player.id} className="p-4 flex items-center justify-between hover:bg-blue-50/50 bg-blue-50/30">
                     <div className="flex items-center gap-3 flex-1">
                       <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-semibold text-blue-700">
                         {player.jersey_number || "—"}
                       </div>
                       <div>
                         <p className="font-medium text-gray-900">
                           {player.first_name} {player.last_name}
                           <span className="ml-2 text-xs text-blue-600 font-normal">(Invitado)</span>
                         </p>
                         <p className="text-xs text-gray-500">
                           {POSITION_LABELS[player.position] || player.position}
                         </p>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                       {status === "confirmed" && (
                         <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100">
                           <Check className="w-4 h-4 text-green-700" />
                           <span className="text-xs font-medium text-green-700">Confirmado</span>
                         </div>
                       )}
                       {status === "pending" && (
                         <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100">
                           <Clock className="w-4 h-4 text-yellow-700" />
                           <span className="text-xs font-medium text-yellow-700">Pendiente</span>
                         </div>
                       )}
                       {status === "not_confirmed" && (
                         <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-100">
                           <AlertCircle className="w-4 h-4 text-red-700" />
                           <span className="text-xs font-medium text-red-700">No confirmado</span>
                         </div>
                       )}
                     </div>
                   </div>
                 );
               })}
              </>
              )}
              </div>
              </div>
              )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => setShowDialog(true)}
          variant="outline"
          className="border-gray-200"
        >
          <Users className="w-4 h-4 mr-2" />
          {selectedPlayers.length > 0 ? "Modificar convocatoria" : "Crear convocatoria"}
        </Button>
        {selectedPlayers.length > 0 && (
          <Button
            onClick={() => setShowConfirm(true)}
            className="text-white"
            style={{ background: "var(--granate)" }}
            disabled={convocation?.notified}
          >
            <Send className="w-4 h-4 mr-2" />
            {convocation?.notified ? "Notificaciones enviadas" : "Notificar jugadores"}
          </Button>
        )}
      </div>

      {/* Selection Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Seleccionar convocados</DialogTitle>
            <DialogDescription className="text-gray-500">
              Elige los jugadores que quieres convocar para este partido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Players by Position */}
            {Object.entries(
              allPlayers.reduce((acc, player) => {
                const pos = player.position || "otro";
                if (!acc[pos]) acc[pos] = [];
                acc[pos].push(player);
                return acc;
              }, {})
            ).map(([position, posPlayers]) => (
              <div key={position} className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm uppercase">
                  {POSITION_LABELS[position] || position}
                </h4>
                <div className="space-y-2">
                  {posPlayers.map(player => (
                    <label
                      key={player.id}
                      className={`flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                        player.team_id !== teamId ? "bg-blue-50/30 border border-blue-100 rounded" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedPlayers.includes(player.id)}
                        onCheckedChange={() => togglePlayer(player.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {player.first_name} {player.last_name}
                          {player.team_id !== teamId && <span className="ml-2 text-xs text-blue-600 font-normal">(Invitado)</span>}
                        </p>
                        {player.status === "lesionado" && (
                          <p className="text-xs text-red-600">Lesionado</p>
                        )}
                        {player.status === "baja" && (
                          <p className="text-xs text-gray-400">De baja</p>
                        )}
                      </div>
                      {player.jersey_number && (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          #{player.jersey_number}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Selector de jugadores de otros equipos */}
            <div className="pt-4 border-t border-gray-200">
              <GuestPlayerSelector
                teamId={teamId}
                selectedPlayers={selectedPlayers}
                onAdd={(player) => {
                  if (!selectedPlayers.includes(player.id)) {
                    togglePlayer(player.id);
                    if (!guestPlayers.find(p => p.id === player.id)) {
                      setGuestPlayers(prev => [...prev, player]);
                    }
                  }
                }}
                onRemove={(playerId) => {
                  if (selectedPlayers.includes(playerId)) {
                    togglePlayer(playerId);
                  }
                  setGuestPlayers(prev => prev.filter(p => p.id !== playerId));
                }}
                type="match"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones, avisos importantes..."
                className="border-gray-200"
                rows={3}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveConvocation}
                className="flex-1 text-white"
                style={{ background: "var(--granate)" }}
              >
                Guardar convocatoria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Notification Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Enviar notificaciones</DialogTitle>
            <DialogDescription className="text-gray-500">
              Se enviarán notificaciones por email a los {selectedPlayers.length} jugadores convocados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Los jugadores recibirán un email con los detalles del partido y podrán confirmar su asistencia en la plataforma.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => sendNotificationsMutation.mutate()}
                className="flex-1 text-white"
                style={{ background: "var(--granate)" }}
                disabled={sendNotificationsMutation.isPending}
              >
                {sendNotificationsMutation.isPending ? "Enviando..." : "Enviar notificaciones"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}