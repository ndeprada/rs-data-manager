import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, Circle, Send, Users, AlertTriangle, Activity } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_STYLES = {
  activo:   { label: "Activo",    dot: "bg-green-400" },
  lesionado:{ label: "Lesionado", dot: "bg-orange-400" },
  baja:     { label: "Baja",      dot: "bg-red-400" },
};

const POSITIONS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MCC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

export default function ConvocatoriaDialog({ open, onOpenChange, event, teamId }) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
    enabled: open,
  });

  const { data: injuries = [] } = useQuery({
    queryKey: ["injuries_all"],
    queryFn: () => base44.entities.Injury.filter({ status: "activa" }),
    enabled: open,
  });

  const { data: convocatorias = [] } = useQuery({
    queryKey: ["convocatorias", event?.id],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: event?.id }),
    enabled: open && !!event?.id,
  });

  const existing = convocatorias[0];

  useEffect(() => {
    if (existing) {
      setSelectedIds(existing.player_ids || []);
      setNotes(existing.notes || "");
      setSent(existing.notified || false);
    } else {
      setSelectedIds([]);
      setNotes("");
      setSent(false);
    }
  }, [existing, open]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      existing
        ? base44.entities.Convocatoria.update(existing.id, data)
        : base44.entities.Convocatoria.create({ ...data, event_id: event?.id, team_id: teamId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["convocatorias", event?.id] }),
  });

  const teamPlayers = players.filter((p) => p.team_id === teamId);
  const activeInjuredIds = new Set(injuries.filter(i => i.status === "activa").map(i => i.player_id));

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const available = teamPlayers.filter((p) => p.status === "activo").map((p) => p.id);
    setSelectedIds(available);
  };

  const handleSaveAndNotify = async () => {
    setSending(true);
    const convData = {
      player_ids: selectedIds,
      notes,
      notified: true,
      notified_at: new Date().toISOString(),
    };
    await saveMutation.mutateAsync(convData);

    // Send emails to selected players with email
    const convocados = teamPlayers.filter((p) => selectedIds.includes(p.id) && p.email);
    const eventDate = event?.date ? format(new Date(event.date), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es }) : "";

    for (const player of convocados) {
      await base44.integrations.Core.SendEmail({
        to: player.email,
        subject: `📋 Convocatoria: ${event?.title}`,
        body: `Hola ${player.first_name},\n\nEstàs convocat/da per al següent partit:\n\n🏟️ ${event?.title}${event?.opponent ? ` vs ${event.opponent}` : ""}\n📅 ${eventDate}${event?.location ? `\n📍 ${event.location}` : ""}${notes ? `\n\n📝 Notes: ${notes}` : ""}\n\nConfirma la teva assistència amb el teu entrenador.\n\nRS Data Manager`,
      });
    }

    setSending(false);
    setSent(true);
    queryClient.invalidateQueries({ queryKey: ["convocatorias", event?.id] });
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({ player_ids: selectedIds, notes, notified: existing?.notified || false, notified_at: existing?.notified_at });
  };

  // Group players by position
  const posOrder = ["portero", "lateral", "central", "libre", "mediocentro", "interior", "delantero_centro", "extremo"];
  const grouped = posOrder.reduce((acc, pos) => {
    const pp = teamPlayers.filter((p) => p.position === pos);
    if (pp.length > 0) acc[pos] = pp;
    return acc;
  }, {});
  const noPos = teamPlayers.filter((p) => !p.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: "var(--granate)" }} />
            Convocatoria — {event?.title}
          </DialogTitle>
          {event?.date && (
            <p className="text-sm text-gray-500 capitalize mt-0.5">
              {format(new Date(event.date), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
              {event?.location && ` · ${event.location}`}
            </p>
          )}
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-sm">
          <span className="font-semibold text-gray-700">{selectedIds.length} convocados</span>
          <span className="text-gray-400">de {teamPlayers.length} jugadores</span>
          <button onClick={selectAll} className="ml-auto text-xs font-medium hover:underline" style={{ color: "var(--granate)" }}>
            Seleccionar disponibles
          </button>
        </div>

        {/* Player list */}
        <div className="space-y-3">
          {Object.entries(grouped).map(([pos, pp]) => (
            <div key={pos}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
                {POSITIONS[pos] || pos}
              </p>
              <div className="space-y-1">
                {pp.map((player) => {
                  const isSelected = selectedIds.includes(player.id);
                  const isInjured = activeInjuredIds.has(player.id) || player.status === "lesionado";
                  const isBaja = player.status === "baja";
                  const st = STATUS_STYLES[player.status] || STATUS_STYLES.activo;

                  return (
                    <button
                      key={player.id}
                      onClick={() => !isBaja && toggle(player.id)}
                      disabled={isBaja}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        isSelected
                          ? "border-green-300 bg-green-50"
                          : isBaja
                          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                          : isInjured
                          ? "border-orange-200 bg-orange-50 hover:bg-orange-100"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="shrink-0 text-gray-400">
                        {isSelected
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <Circle className="w-4 h-4" />}
                      </div>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: isSelected ? "#16a34a" : isInjured ? "#ea580c" : "var(--granate)" }}>
                        {player.jersey_number || player.first_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? "text-green-800" : "text-gray-800"}`}>
                          {player.first_name} {player.last_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isInjured && <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />}
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span className="text-xs text-gray-400">{st.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {noPos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Sin posición</p>
              <div className="space-y-1">
                {noPos.map((player) => {
                  const isSelected = selectedIds.includes(player.id);
                  return (
                    <button key={player.id} onClick={() => toggle(player.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${isSelected ? "border-green-300 bg-green-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                      <div className="shrink-0">
                        {isSelected ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-400" />}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{player.first_name} {player.last_name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-gray-700">Notas para los convocados</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instrucciones, hora de concentración, equipación..."
            className="border-gray-200 h-20"
          />
        </div>

        {/* Status */}
        {sent && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              Notificaciones enviadas a {teamPlayers.filter(p => selectedIds.includes(p.id) && p.email).length} jugadores
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleSave} disabled={sending}>
            Guardar
          </Button>
          <Button
            onClick={handleSaveAndNotify}
            disabled={sending || selectedIds.length === 0}
            className="text-white"
            style={{ background: "var(--granate)" }}
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Enviando..." : "Guardar y Notificar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}