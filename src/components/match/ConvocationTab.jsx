import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Search, Plus, Check, Send, Eye, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CT", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

// Orden exacto dentro de cada grupo
const POSITION_ORDER = {
  Porteros:        ["portero"],
  Defensas:        ["central", "libre", "lateral"],
  Centrocampistas: ["mediocentro", "interior"],
  Delanteros:      ["extremo", "delantero_centro"],
};

const POSITION_GROUP = {
  portero: "Porteros",
  central: "Defensas", libre: "Defensas", lateral: "Defensas",
  mediocentro: "Centrocampistas", interior: "Centrocampistas",
  extremo: "Delanteros", delantero_centro: "Delanteros",
};

const GROUP_ORDER = ["Porteros", "Defensas", "Centrocampistas", "Delanteros", "Sin posición"];

const GROUP_COLORS = {
  Porteros:        { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800" },
  Defensas:        { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800" },
  Centrocampistas: { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800" },
  Delanteros:      { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-800" },
  "Sin posición":  { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-700" },
};

const NO_CONV_REASONS = [
  { value: "lesion",           label: "Lesión" },
  { value: "sancion",          label: "Sanción" },
  { value: "descanso",         label: "Descanso" },
  { value: "decision_tecnica", label: "Dec. técnica" },
  { value: "viaje",            label: "Viaje" },
  { value: "estudios",         label: "Estudios" },
  { value: "otro",             label: "Otro" },
];

function buildEmailHtml({ player, event, team, convocados, noConvocados, callupTime, observations }) {
  const eventDate = event?.date ? format(new Date(event.date), "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) : "";
  const matchTime = event?.date ? format(new Date(event.date), "HH:mm") : "";
  const convList = convocados.map(p => `• ${p.first_name} ${p.last_name}`).join("\n");
  const noConvList = noConvocados.map(p => `• ${p.first_name} ${p.last_name}`).join("\n");

  return `Hola ${player.first_name},

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONVOCATORIA OFICIAL
  ${team?.name || ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 ${event?.title || (event?.opponent ? `vs ${event.opponent}` : "Partido")}

📅 Fecha:     ${eventDate}
⏰ Partido:   ${matchTime}${callupTime ? `\n🕐 Convocatoria: ${callupTime}` : ""}${event?.location ? `\n📍 Campo:     ${event.location}` : ""}${event?.opponent ? `\n🆚 Rival:     ${event.opponent}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  JUGADORES CONVOCADOS (${convocados.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${convList || "—"}

${noConvocados.length > 0 ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NO CONVOCADOS (${noConvocados.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${noConvList}

` : ""}${observations ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OBSERVACIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${observations}

` : ""}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El cuerpo técnico · ${team?.name || ""}`;
}

// ── Preview / Notify Modal ───────────────────────────────
function NotifyModal({ open, onClose, event, team, convocados, noConvocados, callupTime, observations, onSend, sending }) {
  const defaultMsg = buildEmailHtml({ player: { first_name: "[Jugador]" }, event, team, convocados, noConvocados, callupTime, observations });
  const [editableMsg, setEditableMsg] = useState(defaultMsg);

  useEffect(() => {
    if (open) setEditableMsg(buildEmailHtml({ player: { first_name: "[Jugador]" }, event, team, convocados, noConvocados, callupTime, observations }));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black text-gray-900">Previsualización y envío</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Convocados / No convocados */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-green-700 mb-2">Convocados ({convocados.length})</p>
              <div className="space-y-0.5">
                {convocados.map(p => (
                  <p key={p.id} className="text-xs text-green-800">✓ {p.first_name} {p.last_name}</p>
                ))}
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-red-700 mb-2">No convocados ({noConvocados.length})</p>
              <div className="space-y-0.5">
                {noConvocados.map(p => (
                  <p key={p.id} className="text-xs text-red-800">✗ {p.first_name} {p.last_name}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Mensaje editable */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Mensaje que se enviará <span className="font-normal text-gray-400">(editable)</span></p>
            <Textarea
              value={editableMsg}
              onChange={e => setEditableMsg(e.target.value)}
              rows={18}
              className="border-gray-200 text-xs font-mono leading-relaxed"
            />
            <p className="text-[10px] text-gray-400 mt-1">El saludo "Hola [nombre]," se personalizará automáticamente para cada jugador.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button
              onClick={() => onSend(editableMsg)}
              disabled={sending}
              className="flex-1 text-white"
              style={{ background: "var(--granate)" }}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {sending ? "Enviando…" : `Enviar a ${convocados.filter(p => p.email).length} jugadores`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ───────────────────────────────────────
export default function ConvocationTab({ eventId, teamId, event, players, team }) {
  const queryClient = useQueryClient();
  const [convocadoIds, setConvocadoIds] = useState([]);
  const [reasons, setReasons] = useState({});
  const [notes, setNotes] = useState("");
  const [callupTime, setCallupTime] = useState("");
  const [observations, setObservations] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: convocation } = useQuery({
    queryKey: ["convocatoria", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  useEffect(() => {
    if (convocation) {
      setConvocadoIds(convocation.player_ids || []);
      setNotes(convocation.notes || "");
      setCallupTime(convocation.callup_time || "");
      setObservations(convocation.observations || "");
    }
  }, [convocation?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => convocation
      ? base44.entities.Convocatoria.update(convocation.id, data)
      : base44.entities.Convocatoria.create({ event_id: eventId, team_id: teamId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatoria", eventId] });
      queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ player_ids: convocadoIds, notes, callup_time: callupTime, observations });
  };

  const handleSaveAndNotify = async () => {
    // First save, then show modal
    await saveMutation.mutateAsync({ player_ids: convocadoIds, notes, callup_time: callupTime, observations });
    setShowNotifyModal(true);
  };

  const handleSend = async (message) => {
    setSending(true);
    const convPlayers = allPlayers.filter(p => convocadoIds.includes(p.id) && p.email);
    await Promise.all(convPlayers.map(p => {
      const personalizedMsg = message.replace("[Jugador]", p.first_name);
      return base44.integrations.Core.SendEmail({
        to: p.email,
        subject: `Convocatoria: ${event?.opponent ? `vs ${event.opponent}` : event?.title || "Partido"}`,
        body: personalizedMsg,
      });
    }));
    if (convocation) {
      await base44.entities.Convocatoria.update(convocation.id, { notified: true, notified_at: new Date().toISOString() });
    }
    queryClient.invalidateQueries({ queryKey: ["convocatoria", eventId] });
    setSending(false);
    setShowNotifyModal(false);
  };

  const toggleConvocado = (pid) => {
    setConvocadoIds(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  // Group and sort players
  const activePlayers = players.filter(p => p.status !== "baja");
  const playersByGroup = {};
  activePlayers.forEach(p => {
    const group = POSITION_GROUP[p.position] || "Sin posición";
    if (!playersByGroup[group]) playersByGroup[group] = [];
    playersByGroup[group].push(p);
  });

  // Sort within each group by position order, then last_name
  Object.keys(playersByGroup).forEach(group => {
    const posOrder = POSITION_ORDER[group] || [];
    playersByGroup[group].sort((a, b) => {
      const ai = posOrder.indexOf(a.position);
      const bi = posOrder.indexOf(b.position);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.last_name.localeCompare(b.last_name);
    });
  });

  const guestPlayers = allPlayers.filter(p =>
    p.team_id !== teamId &&
    !activePlayers.find(sp => sp.id === p.id) &&
    (guestSearch ? `${p.first_name} ${p.last_name}`.toLowerCase().includes(guestSearch.toLowerCase()) : false)
  );

  const convocados = allPlayers.filter(p => convocadoIds.includes(p.id));
  const noConvocados = activePlayers.filter(p => !convocadoIds.includes(p.id));
  const convocadosCount = convocadoIds.length;

  const eventDate = event?.date ? new Date(event.date) : null;

  return (
    <div className="space-y-4">

      {/* ── Info del partido ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Información del partido
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {eventDate && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 min-w-0">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-none">Hora partido</span>
                <span className="font-semibold text-xs">{format(eventDate, "HH:mm")} · {format(eventDate, "EEE d MMM", { locale: es })}</span>
              </div>
            </div>
          )}
          {event?.location && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-none">Campo</span>
                <span className="font-semibold text-xs truncate">{event.location}</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 block leading-none mb-0.5">Convocatoria</span>
              <Input
                type="time"
                value={callupTime}
                onChange={e => setCallupTime(e.target.value)}
                className="h-7 text-xs border-gray-200 w-28"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Header stats + actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 text-sm items-center">
          <span className="font-bold" style={{ color: "var(--granate)" }}>{convocadosCount} convocados</span>
          {convocation?.notified && (
            <span className="text-[10px] text-green-600 font-bold border border-green-200 bg-green-50 px-2 py-0.5 rounded-full">✓ Notificado</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowGuestSearch(!showGuestSearch)} className="text-xs border-gray-200">
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir de otro equipo
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="text-white text-xs" style={{ background: "var(--granate)" }}>
            <Check className="w-3.5 h-3.5 mr-1" /> {saveMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleSaveAndNotify} disabled={saveMutation.isPending || convocadosCount === 0}
            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
            <Eye className="w-3.5 h-3.5 mr-1" /> Vista previa y enviar
          </Button>
        </div>
      </div>

      {/* Guest search */}
      {showGuestSearch && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-700">Buscar jugadores de otros equipos del club</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input placeholder="Nombre del jugador…" value={guestSearch} onChange={e => setGuestSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-blue-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          {guestSearch && guestPlayers.slice(0, 8).map(p => (
            <button key={p.id} onClick={() => { if (!convocadoIds.includes(p.id)) setConvocadoIds(prev => [...prev, p.id]); setGuestSearch(""); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-100 text-sm">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: "var(--granate)" }}>
                {p.first_name?.[0]}{p.last_name?.[0]}
              </div>
              <span className="font-medium">{p.first_name} {p.last_name}</span>
              <span className="text-xs text-gray-400 ml-auto">{POSITION_LABELS[p.position] || "—"}</span>
            </button>
          ))}
          {guestSearch && guestPlayers.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Sin resultados</p>}
        </div>
      )}

      {/* ── Player list by group ── */}
      <div className="space-y-3">
        {GROUP_ORDER.filter(g => playersByGroup[g]).map(group => {
          const colors = GROUP_COLORS[group];
          return (
            <div key={group}>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-t-lg border ${colors.bg} ${colors.border}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`} style={{ fontFamily: "var(--font-display)" }}>
                  {group}
                </span>
                <span className="text-[10px] text-gray-400">({playersByGroup[group].length})</span>
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden divide-y divide-gray-100">
                {playersByGroup[group].map(player => {
                  const isConv = convocadoIds.includes(player.id);
                  return (
                    <div key={player.id}
                      className={`flex items-center gap-2.5 px-3 py-1.5 transition-all ${isConv ? "bg-white" : "bg-gray-50/50"}`}>
                      <input type="checkbox" checked={isConv} onChange={() => toggleConvocado(player.id)}
                        className="w-4 h-4 rounded border-gray-300 shrink-0" style={{ accentColor: "var(--granate)" }} />

                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ background: isConv ? "var(--granate)" : "#d1d5db" }}>
                        {player.first_name?.[0]}{player.last_name?.[0]}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isConv ? "text-gray-900" : "text-gray-400"}`}>
                          {player.last_name}, {player.first_name}
                          {player.status === "lesionado" && <span className="ml-1 text-[10px] text-orange-500">⚠</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 leading-none">
                          {POSITION_LABELS[player.position] || "—"}{player.jersey_number ? ` · #${player.jersey_number}` : ""}
                        </p>
                      </div>

                      {!isConv && (
                        <Select value={reasons[player.id] || ""} onValueChange={v => setReasons(prev => ({ ...prev, [player.id]: v }))}>
                          <SelectTrigger className="h-6 w-28 text-[10px] border-gray-200 bg-white text-gray-400 shrink-0">
                            <SelectValue placeholder="Motivo…" />
                          </SelectTrigger>
                          <SelectContent>
                            {NO_CONV_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Observations ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
          Observaciones
        </p>
        <Textarea
          value={observations}
          onChange={e => setObservations(e.target.value)}
          rows={3}
          className="border-gray-200 text-sm"
          placeholder="Uniforme, material necesario, indicaciones especiales…"
        />
        <div className="pt-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notas internas</p>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="border-gray-200 text-sm"
            placeholder="Notas para el cuerpo técnico (no se envían a jugadores)…"
          />
        </div>
      </div>

      {/* ── Notify modal ── */}
      <NotifyModal
        open={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        event={event}
        team={team}
        convocados={convocados}
        noConvocados={noConvocados}
        callupTime={callupTime}
        observations={observations}
        onSend={handleSend}
        sending={sending}
      />
    </div>
  );
}