import React, { useState, useEffect, useRef } from "react";
import PlayerName from "@/components/common/PlayerName";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Search, Plus, Check, Eye, Clock, MapPin, MessageCircle, Copy, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { matchesPlayerSearch } from "@/lib/playerName";
import { buildConvocationText, dorsalOf, groupPlayers, reasonText } from "@/lib/convocationMessage";
import { NO_CONV_REASONS, reasonShort } from "@/lib/participation";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/common/SaveStatus";

const POSITION_LABELS = {
  portero: msg("POR"), lateral: msg("LAT"), central: msg("CT"), libre: msg("LIB"),
  mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT"),
};

// El orden por posición (porteros, defensas, medios, delanteros) y el mensaje de WhatsApp están en @/lib/convocationMessage
const GROUP_COLORS = {
  Porteros:        { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800" },
  Defensas:        { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800" },
  Medios:          { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800" },
  Delanteros:      { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-800" },
  "Sin posición":  { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-700" },
};

import Composer from "@/components/avisos/Composer";
import { useT, msg, useDateLocale } from "@/i18n";

// Los jugadores de una lista (convocados o no) por posición y con el dorsal al lado; con `reasons`, el motivo de cada uno (los no convocados)
function PlayerColumn({ players, mark, markClass, numClass, reasons }) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      {groupPlayers(players).map(({ group, players: list }) => (
        <div key={group} className="space-y-0.5">
          {list.map(p => (
            <p key={p.id} className={`text-xs flex items-baseline gap-1 ${markClass}`}>
              <span aria-hidden="true">{mark}</span>
              <span className={`w-5 text-right tabular-nums font-bold shrink-0 ${numClass}`}>{dorsalOf(p)}</span>
              <span className="min-w-0"><PlayerName player={p} />{reasons && reasonText(reasons[p.id]) && <span className="ml-1 text-[10px] opacity-70">({t(reasonShort(reasons[p.id]))})</span>}</span>
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Preview / Notify Modal ───────────────────────────────
function NotifyModal({ open, onClose, event, team, convocados, noConvocados, reasons, callupTime, kit, observations, onMarkNotified, sending }) {
  const t = useT();
  // Mensaje para el grupo de WhatsApp (siempre en español): convocados y no convocados por posición, con dorsal y observaciones
  const buildWa = () => buildConvocationText({ event, team, convocados, noConvocados, reasons, callupTime, kit, info: observations });
  const waDefault = buildWa();
  // Aviso al móvil: el mismo contenido que el mensaje de WhatsApp (convocados y no convocados con dorsal, casa/fuera, 👕 y ℹ️), sin marcas de WhatsApp
  // y SIN el motivo de la no convocatoria (decisión de Nacho, 23/10: por ahora el motivo solo va en el mensaje de WhatsApp, que se edita a mano).
  // Le llega a toda la plantilla (convocados y no convocados) para que cada uno vea si está en la lista.
  const pushBody = buildConvocationText({ event, team, convocados, noConvocados, callupTime, kit, info: observations, plain: true });
  const squadIds = [...new Set([...convocados, ...noConvocados].map(p => p.id))];
  const [waMsg, setWaMsg] = useState(waDefault);
  const [copied, setCopied] = useState(false);
  const copyWa = async () => {
    try { await navigator.clipboard.writeText(waMsg); }
    catch { const t = document.createElement("textarea"); t.value = waMsg; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  useEffect(() => {
    if (open) setWaMsg(buildWa());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white border-gray-200 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black text-gray-900">{t("Avisar de la convocatoria")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Convocados / No convocados */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-green-700 mb-2">{t("Convocados ({length})", { length: convocados.length })}</p>
              <PlayerColumn players={convocados} mark="✓" markClass="text-green-800" numClass="text-green-600" />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-red-700 mb-2">{t("No convocados ({length})", { length: noConvocados.length })}</p>
              <PlayerColumn players={noConvocados} mark="✗" markClass="text-red-800" numClass="text-red-500" reasons={reasons} />
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50/60 p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-green-800 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> {t("Para el grupo de WhatsApp")}</p>
            <Textarea value={waMsg} onChange={e => setWaMsg(e.target.value)} rows={10} className="border-green-200 bg-white text-xs leading-relaxed" />
            <Button type="button" onClick={copyWa} className="w-full text-white bg-green-600 hover:bg-green-700">
              <Copy className="w-3.5 h-3.5 mr-1.5" />{copied ? t("¡Copiado! Pégalo en WhatsApp") : t("Copiar mensaje")}
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> {t("Aviso al móvil (app)")}</p>
            <Composer
              key={open ? "open" : "closed"}
              fixed={{ player_ids: squadIds, label: `Toda la plantilla (${squadIds.length})` }}
              defaultTitle={`Convocatoria · ${team?.name || ""}`}
              defaultBody={pushBody}
              bodyRows={12}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">{t("Cerrar")}</Button>
            <Button variant="club" onClick={onMarkNotified} disabled={sending} className="flex-1">
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {sending ? t("Guardando…") : t("Marcar como notificada")}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 -mt-2">{t("Copia el mensaje al grupo de WhatsApp y/o envía el aviso al móvil; después márcala como notificada para que quede constancia.")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ───────────────────────────────────────
export default function ConvocationTab({ eventId, teamId, event, players, team }) {
  const t = useT();
  const dfl = useDateLocale();
  const queryClient = useQueryClient();
  const [convocadoIds, setConvocadoIds] = useState([]);
  const [reasons, setReasons] = useState({});
  const [notes, setNotes] = useState("");
  const [callupTime, setCallupTime] = useState("");
  const [kit, setKit] = useState(""); // 👕 equipación que deben traer
  const [observations, setObservations] = useState(""); // ℹ️ información extra (las observaciones de antes pasan a ser esta)
  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: convocation, isFetched } = useQuery({
    queryKey: ["convocatoria", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  // Lo que se guarda. El motivo de cada jugador no convocado queda guardado para las estadísticas de ausencias.
  const buildForm = (ids, why, n, callup, obs, kitText) => ({
    player_ids: ids,
    notes: n,
    callup_time: callup,
    observations: obs,
    kit: kitText,
    absence_reasons: Object.fromEntries(Object.entries(why).filter(([id, r]) => r && !ids.includes(id))),
  });
  const form = buildForm(convocadoIds, reasons, notes, callupTime, observations, kit);

  // Carga de lo guardado y guardado automático (no se guarda nada hasta que lo guardado esté cargado)
  const [hydrated, setHydrated] = useState(false);
  const convIdRef = useRef(null); // id de la convocatoria (también cuando la crea este mismo guardado)
  const autosave = useAutosave({
    value: form,
    enabled: hydrated,
    save: async (data) => {
      if (convIdRef.current) await base44.entities.Convocatoria.update(convIdRef.current, data);
      else {
        const created = await base44.entities.Convocatoria.create({ event_id: eventId, team_id: teamId, ...data });
        convIdRef.current = created.id;
      }
      queryClient.invalidateQueries({ queryKey: ["convocatoria", eventId] });
      queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
    },
  });
  useEffect(() => {
    if (!isFetched) return;
    if (convocation && convIdRef.current !== convocation.id) {
      convIdRef.current = convocation.id;
      const ids = convocation.player_ids || [];
      const why = convocation.absence_reasons || {};
      setConvocadoIds(ids);
      setNotes(convocation.notes || "");
      setCallupTime(convocation.callup_time || "");
      setObservations(convocation.observations || "");
      setKit(convocation.kit || "");
      setReasons(why);
      autosave.reset(buildForm(ids, why, convocation.notes || "", convocation.callup_time || "", convocation.observations || "", convocation.kit || ""));
    }
    setHydrated(true);
  }, [isFetched, convocation?.id]);

  // «Avisar convocatoria»: primero se guarda lo pendiente y luego se abre el aviso
  const handleSaveAndNotify = async () => {
    await autosave.flush();
    setShowNotifyModal(true);
  };

  // Deja constancia de que el entrenador ya ha avisado (WhatsApp y/o aviso al móvil)
  const handleMarkNotified = async () => {
    setSending(true);
    try {
      const id = convIdRef.current || convocation?.id;
      if (id) {
        await base44.entities.Convocatoria.update(id, { notified: true, notified_at: new Date().toISOString() });
      }
      queryClient.invalidateQueries({ queryKey: ["convocatoria", eventId] });
      setShowNotifyModal(false);
    } finally {
      setSending(false);
    }
  };

  const toggleConvocado = (pid) => {
    setConvocadoIds(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  // Jugadores por grupo de posición (porteros, defensas, centrocampistas, delanteros) y, dentro de cada grupo, por posición y apellido
  const activePlayers = players.filter(p => p.status !== "baja");
  const playerGroups = groupPlayers(activePlayers);

  const guestPlayers = allPlayers.filter(p =>
    p.team_id !== teamId &&
    !activePlayers.find(sp => sp.id === p.id) &&
    (guestSearch ? matchesPlayerSearch(p, guestSearch) : false)
  );

  // Seleccionar / quitar a todos los jugadores del equipo de golpe (luego se ajusta uno a uno)
  const allSelected = activePlayers.length > 0 && activePlayers.every(p => convocadoIds.includes(p.id));
  const toggleAll = () => {
    const teamIds = activePlayers.map(p => p.id);
    setConvocadoIds(prev => allSelected
      ? prev.filter(id => !teamIds.includes(id))
      : [...new Set([...prev, ...teamIds])]);
  };

  const convocados = allPlayers.filter(p => convocadoIds.includes(p.id));
  const noConvocados = activePlayers.filter(p => !convocadoIds.includes(p.id));
  const convocadosCount = convocadoIds.length;

  const eventDate = event?.date ? new Date(event.date) : null;

  return (
    <div className="space-y-4">

      {/* ── Info del partido ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {t("Información del partido")}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {eventDate && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 min-w-0">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-none">{t("Hora partido")}</span>
                <span className="font-semibold text-xs">{format(eventDate, "HH:mm")} · {format(eventDate, "EEE d MMM", { locale: dfl })}</span>
              </div>
            </div>
          )}
          {event?.location && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-none">{t("Campo")}</span>
                <span className="font-semibold text-xs truncate">{event.location}</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 block leading-none mb-0.5">{t("Convocatoria")}</span>
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
          <span className="font-bold" style={{ color: "var(--granate)" }}>{t("{convocadosCount} convocados", { convocadosCount })}</span>
          {convocation?.notified && (
            <span className="text-[10px] text-green-600 font-bold border border-green-200 bg-green-50 px-2 py-0.5 rounded-full">{t("✓ Notificado")}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <SaveStatus state={autosave.state} onRetry={autosave.flush} />
          <Button size="sm" variant="outline" onClick={toggleAll} className="text-xs border-gray-200">
            <Check className="w-3.5 h-3.5 mr-1" /> {allSelected ? t("Quitar todos") : t("Seleccionar todos")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowGuestSearch(!showGuestSearch)} className="text-xs border-gray-200">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("Añadir de otro equipo")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleSaveAndNotify} disabled={autosave.state === "saving" || convocadosCount === 0}
            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
            <Eye className="w-3.5 h-3.5 mr-1" /> {t("Avisar convocatoria")}
          </Button>
        </div>
      </div>

      {/* Guest search */}
      {showGuestSearch && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-700">{t("Buscar jugadores de otros equipos del club")}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input placeholder={t("Nombre del jugador…")} value={guestSearch} onChange={e => setGuestSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-blue-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          {guestSearch && guestPlayers.slice(0, 8).map(p => (
            <button key={p.id} onClick={() => { if (!convocadoIds.includes(p.id)) setConvocadoIds(prev => [...prev, p.id]); setGuestSearch(""); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-100 text-sm">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: "var(--granate)" }}>
                {p.first_name?.[0]}{p.last_name?.[0]}
              </div>
              <span className="font-medium"><PlayerName player={p} /></span>
              <span className="text-xs text-gray-400 ml-auto">{POSITION_LABELS[p.position] ? t(POSITION_LABELS[p.position]) : "—"}</span>
            </button>
          ))}
          {guestSearch && guestPlayers.length === 0 && <p className="text-xs text-gray-500 text-center py-2">{t("Sin resultados")}</p>}
        </div>
      )}

      {/* ── Player list by group ── */}
      <div className="space-y-3">
        {playerGroups.map(({ group, players: groupList }) => {
          const colors = GROUP_COLORS[group];
          return (
            <div key={group}>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-t-lg border ${colors.bg} ${colors.border}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`} style={{ fontFamily: "var(--font-display)" }}>
                  {t(group)}
                </span>
                <span className="text-[10px] text-gray-400">({groupList.length})</span>
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden divide-y divide-gray-100">
                {groupList.map(player => {
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
                          <PlayerName player={player} format="last" />
                          {player.status === "lesionado" && <span className="ml-1 text-[10px] text-orange-500">⚠</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 leading-none">
                          {POSITION_LABELS[player.position] ? t(POSITION_LABELS[player.position]) : "—"}{player.jersey_number ? ` · #${player.jersey_number}` : ""}
                        </p>
                      </div>

                      {!isConv && (
                        <Select value={reasons[player.id] || ""} onValueChange={v => setReasons(prev => ({ ...prev, [player.id]: v }))}>
                          <SelectTrigger className="h-6 w-28 text-[10px] border-gray-200 bg-white text-gray-400 shrink-0">
                            <SelectValue placeholder={t("Motivo…")} />
                          </SelectTrigger>
                          <SelectContent>
                            {NO_CONV_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>)}
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
          {t("Observaciones")}
        </p>
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-8 shrink-0" aria-hidden="true">👕</span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-gray-400 block leading-none mb-1">{t("Equipación que deben traer")}</span>
            <Input
              value={kit}
              onChange={e => setKit(e.target.value)}
              className="border-gray-200 text-sm"
              placeholder={t("Camiseta, pantalón, medias, chándal…")}
              aria-label={t("Equipación que deben traer")}
            />
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-8 shrink-0" aria-hidden="true">ℹ️</span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-gray-400 block leading-none mb-1">{t("Información extra")}</span>
            <Textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={2}
              className="border-gray-200 text-sm"
              placeholder={t("Material, comida, desplazamiento o cualquier otra indicación…")}
              aria-label={t("Información extra")}
            />
          </div>
        </div>
        <div className="pt-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t("Notas internas")}</p>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="border-gray-200 text-sm"
            placeholder={t("Notas para el cuerpo técnico (no se envían a jugadores)…")}
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
        reasons={reasons}
        callupTime={callupTime}
        kit={kit}
        observations={observations}
        onMarkNotified={handleMarkNotified}
        sending={sending}
      />
    </div>
  );
}