import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Star, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

const NO_CONVOC_REASONS = {
  lesion: "Lesión", decision_tecnica: "Dec. técnica", estudios: "Estudios",
  viaje: "Viaje", familiar: "Familiar", sancion: "Sanción", otro: "Otro",
};

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((star) => (
        <button key={star} type="button"
          onClick={() => onChange(star === value ? null : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
        >
          <Star className={`w-3.5 h-3.5 ${(hover || value) >= star ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function NumCell({ value, onChange, max = 99 }) {
  const [local, setLocal] = useState(value ?? 0);
  useEffect(() => setLocal(value ?? 0), [value]);
  return (
    <input
      type="number" min={0} max={max}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onChange(parseInt(local) || 0)}
      className="w-12 h-7 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
    />
  );
}

function CardCell({ value, color, onChange }) {
  const active = (value || 0) > 0;
  return (
    <button
      onClick={() => onChange(active ? 0 : 1)}
      className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${active ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-300 hover:border-gray-400"}`}
      style={active ? { background: color } : {}}
    >
      {active ? "1" : "—"}
    </button>
  );
}

export default function MatchPlayersPanel({ eventId, teamId, players, event }) {
  const queryClient = useQueryClient();
  const [showConvocDialog, setShowConvocDialog] = useState(false);
  const [showNotifDialog, setShowNotifDialog] = useState(false);
  const [convocNotes, setConvocNotes] = useState("");
  const [pendingConvocIds, setPendingConvocIds] = useState([]);
  const [noConvocReasons, setNoConvocReasons] = useState({});

  const { data: convocation } = useQuery({
    queryKey: ["convocation", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });

  const { data: matchStats = [] } = useQuery({
    queryKey: ["matchStats", eventId],
    queryFn: () => base44.entities.MatchStats.filter({ event_id: eventId }),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (convocation) {
      setPendingConvocIds(convocation.player_ids || []);
      setConvocNotes(convocation.notes || "");
    }
  }, [convocation]);

  const saveConvocMutation = useMutation({
    mutationFn: (data) => convocation
      ? base44.entities.Convocatoria.update(convocation.id, data)
      : base44.entities.Convocatoria.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocation", eventId] });
      setShowConvocDialog(false);
    },
  });

  const upsertStatsMutation = useMutation({
    mutationFn: async ({ playerId, field, value }) => {
      const existing = matchStats.find(s => s.player_id === playerId);
      const base = existing || { player_id: playerId, event_id: eventId, date: event?.date?.split?.("T")[0] || new Date().toISOString().split("T")[0] };
      const data = { ...base, [field]: value };
      return existing ? base44.entities.MatchStats.update(existing.id, data) : base44.entities.MatchStats.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["matchStats", eventId] }),
  });

  const sendNotifMutation = useMutation({
    mutationFn: async () => {
      const convocPlayers = players.filter(p => (convocation?.player_ids || []).includes(p.id));
      await Promise.all(convocPlayers.filter(p => p.email).map(p =>
        base44.integrations.Core.SendEmail({
          to: p.email,
          subject: `Convocatoria: ${event?.title}`,
          body: `Hola ${p.first_name},\n\nHas sido convocado para el partido:\n\n${event?.title}\nFecha: ${event?.date ? format(new Date(event.date), "dd 'de' MMMM 'de' yyyy", { locale: es }) : ""}\nHora: ${event?.date ? format(new Date(event.date), "HH:mm") : ""}${event?.location ? `\nLugar: ${event.location}` : ""}${event?.opponent ? `\nRival: ${event.opponent}` : ""}\n${convocNotes ? `\nNotas: ${convocNotes}` : ""}\n\nSaludos,\nEl cuerpo técnico`,
        })
      ));
      if (convocation) {
        await base44.entities.Convocatoria.update(convocation.id, { notified: true, notified_at: new Date().toISOString() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocation", eventId] });
      setShowNotifDialog(false);
    },
  });

  const isConvocado = (pid) => (convocation?.player_ids || []).includes(pid);
  const getStats = (pid) => matchStats.find(s => s.player_id === pid);
  const stat = (pid, field) => upsertStatsMutation.mutate({ playerId: pid, field, value: arguments[2] });

  const handleStat = (playerId, field, value) => upsertStatsMutation.mutate({ playerId, field, value });

  const handleConvocToggle = async (pid) => {
    const wasConvocado = isConvocado(pid);
    const newIds = wasConvocado
      ? (convocation?.player_ids || []).filter(id => id !== pid)
      : [...(convocation?.player_ids || []), pid];
    saveConvocMutation.mutate({ event_id: eventId, team_id: teamId, player_ids: newIds, notes: convocNotes });
  };

  const handleSaveConvocDialog = () => {
    saveConvocMutation.mutate({ event_id: eventId, team_id: teamId, player_ids: pendingConvocIds, notes: convocNotes });
  };

  const activePlayers = players.filter(p => p.status !== "baja").sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  );

  const convocadosCount = activePlayers.filter(p => isConvocado(p.id)).length;
  const titularesCount = activePlayers.filter(p => getStats(p.id)?.starter === true).length;
  const suplentesCount = activePlayers.filter(p => { const s = getStats(p.id); return s && s.starter === false && (s.minutes_played || 0) > 0; }).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="font-semibold" style={{ color: "var(--granate)" }}>{convocadosCount} convocados</span>
          <span className="text-gray-500">{activePlayers.length - convocadosCount} no convocados</span>
          <span className="text-gray-500">{titularesCount} titulares · {suplentesCount} suplentes</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setPendingConvocIds(convocation?.player_ids || []); setShowConvocDialog(true); }} className="text-xs border-gray-200">
            <Users className="w-3.5 h-3.5 mr-1" />Gestionar convocatoria
          </Button>
          {convocadosCount > 0 && (
            <Button size="sm" onClick={() => setShowNotifDialog(true)} disabled={convocation?.notified} className="text-white text-xs" style={{ background: "var(--granate)" }}>
              <Send className="w-3.5 h-3.5 mr-1" />{convocation?.notified ? "Notificado" : "Notificar"}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-semibold min-w-[160px]">Jugador</th>
              <th className="px-2 py-2 font-semibold whitespace-nowrap">Conv.</th>
              <th className="px-2 py-2 font-semibold whitespace-nowrap">Participación</th>
              <th className="px-2 py-2 font-semibold">Min</th>
              <th className="px-2 py-2 font-semibold">Gol</th>
              <th className="px-2 py-2 font-semibold">Asi</th>
              <th className="px-2 py-2 font-semibold">🟨</th>
              <th className="px-2 py-2 font-semibold">🟥</th>
              <th className="px-2 py-2 font-semibold whitespace-nowrap">Val.</th>
              <th className="px-2 py-2 font-semibold text-left min-w-[140px]">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((player, idx) => {
              const convocado = isConvocado(player.id);
              const s = getStats(player.id);
              const isPortero = player.position === "portero";
              const rowBg = convocado ? "bg-white" : "bg-gray-50/50";

              return (
                <tr key={player.id} className={`border-b border-gray-100 last:border-0 ${rowBg} hover:bg-gray-50 transition-colors`}>
                  {/* Jugador */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: convocado ? "var(--granate)" : "#d1d5db" }}>
                        {player.first_name?.[0]}{player.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-medium leading-tight truncate ${convocado ? "text-gray-900" : "text-gray-400"}`}>
                          {player.last_name}, {player.first_name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {POSITION_LABELS[player.position] || "—"}
                          {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                          {player.status === "lesionado" ? " ⚠️" : ""}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Convocado */}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleConvocToggle(player.id)}
                      className={`px-2 py-1 rounded text-xs font-semibold border transition-colors whitespace-nowrap ${
                        convocado ? "text-white border-transparent" : "bg-white border-gray-300 text-gray-400 hover:border-gray-400"
                      }`}
                      style={convocado ? { background: "var(--granate)" } : {}}
                    >
                      {convocado ? "✓" : "—"}
                    </button>
                  </td>

                  {/* Participación */}
                  <td className="px-2 py-2 text-center">
                    {convocado ? (
                      <div className="flex gap-1 justify-center">
                        {[{ label: "TIT", val: true }, { label: "SUP", val: false }].map(opt => (
                          <button key={String(opt.val)}
                            onClick={() => handleStat(player.id, "starter", opt.val)}
                            className={`px-2 py-1 text-xs font-semibold rounded border transition-colors ${s?.starter === opt.val ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-100"}`}
                            style={s?.starter === opt.val ? { background: "var(--granate)" } : {}}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Select value={noConvocReasons[player.id] || ""} onValueChange={v => setNoConvocReasons(prev => ({ ...prev, [player.id]: v }))}>
                        <SelectTrigger className="h-7 w-28 text-xs border-gray-200 bg-white text-gray-400">
                          <SelectValue placeholder="Motivo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NO_CONVOC_REASONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </td>

                  {/* Minutos */}
                  <td className="px-2 py-2 text-center">
                    {convocado && <NumCell value={s?.minutes_played} onChange={v => handleStat(player.id, "minutes_played", v)} max={120} />}
                  </td>

                  {/* Goles / G. Encajados */}
                  <td className="px-2 py-2 text-center">
                    {convocado && <NumCell value={isPortero ? s?.goals_conceded : s?.goals} onChange={v => handleStat(player.id, isPortero ? "goals_conceded" : "goals", v)} />}
                  </td>

                  {/* Asistencias */}
                  <td className="px-2 py-2 text-center">
                    {convocado && !isPortero && <NumCell value={s?.assists} onChange={v => handleStat(player.id, "assists", v)} />}
                  </td>

                  {/* Amarilla */}
                  <td className="px-2 py-2 text-center">
                    {convocado && (
                      <div className="flex gap-1 justify-center">
                        <CardCell value={s?.yellow_cards} color="#ca8a04" onChange={v => handleStat(player.id, "yellow_cards", v)} />
                        <CardCell value={s?.double_yellow_card} color="#b45309" onChange={v => handleStat(player.id, "double_yellow_card", v)} />
                      </div>
                    )}
                  </td>

                  {/* Roja */}
                  <td className="px-2 py-2 text-center">
                    {convocado && <CardCell value={s?.red_cards} color="#dc2626" onChange={v => handleStat(player.id, "red_cards", v)} />}
                  </td>

                  {/* Valoración */}
                  <td className="px-2 py-2 text-center">
                    {convocado && <StarRating value={s?.rating} onChange={v => handleStat(player.id, "rating", v)} />}
                  </td>

                  {/* Observaciones */}
                  <td className="px-2 py-2">
                    {convocado && <NotesCell value={s?.notes} onSave={v => handleStat(player.id, "notes", v)} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {activePlayers.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No hay jugadores en este equipo</p>
        )}
      </div>

      {/* Leyenda columnas */}
      <p className="text-xs text-gray-400">Gol = Goles (portero: goles encajados) · Asi = Asistencias · 🟨 = Amarilla / Doble amarilla · 🟥 = Roja directa</p>

      {/* Convocation dialog */}
      <Dialog open={showConvocDialog} onOpenChange={setShowConvocDialog}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Seleccionar convocados</DialogTitle>
            <DialogDescription className="text-gray-500">Elige los jugadores convocados para este partido</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setPendingConvocIds(activePlayers.map(p => p.id))} className="text-xs text-blue-600 hover:underline">Todos</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setPendingConvocIds([])} className="text-xs text-gray-500 hover:underline">Ninguno</button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {activePlayers.map(player => (
                <label key={player.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                  <Checkbox checked={pendingConvocIds.includes(player.id)} onCheckedChange={() => setPendingConvocIds(prev => prev.includes(player.id) ? prev.filter(id => id !== player.id) : [...prev, player.id])} />
                  <span className="text-sm font-medium text-gray-900 flex-1">{player.first_name} {player.last_name}</span>
                  <span className="text-xs text-gray-400">{POSITION_LABELS[player.position] || "—"}{player.jersey_number ? ` · #${player.jersey_number}` : ""}</span>
                  {player.status === "lesionado" && <span className="text-xs text-red-500">Lesionado</span>}
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Notas para los convocados</p>
              <Textarea value={convocNotes} onChange={e => setConvocNotes(e.target.value)} placeholder="Instrucciones, avisos…" className="border-gray-200" rows={3} />
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => setShowConvocDialog(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSaveConvocDialog} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
                Guardar ({pendingConvocIds.length} convocados)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={showNotifDialog} onOpenChange={setShowNotifDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Enviar notificaciones</DialogTitle>
            <DialogDescription className="text-gray-500">Se enviará un email a los {convocadosCount} jugadores convocados</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowNotifDialog(false)} className="flex-1">Cancelar</Button>
            <Button onClick={() => sendNotifMutation.mutate()} disabled={sendNotifMutation.isPending} className="flex-1 text-white" style={{ background: "var(--granate)" }}>
              {sendNotifMutation.isPending ? "Enviando…" : "Enviar notificaciones"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesCell({ value, onSave }) {
  const [local, setLocal] = useState(value || "");
  useEffect(() => setLocal(value || ""), [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onSave(local)}
      placeholder="Obs…"
      className="w-full h-7 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
    />
  );
}