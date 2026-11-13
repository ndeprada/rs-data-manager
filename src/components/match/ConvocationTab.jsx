// Convocatoria del partido (rediseñada el 13/11/2026 con la maqueta aprobada por Nacho):
// lista por posición en un solo bloque con Va/No, motivo en un desplegable, últimos entrenos y % de minutos de cada jugador;
// a la derecha, los datos de la convocatoria (con la equipación de la Agenda) y el mensaje siempre a la vista.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Search, Plus, Copy, Bell, Check, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { matchesPlayerSearch, playerFullName } from "@/lib/playerName";
import { buildConvocationText, dorsalOf, groupPlayers } from "@/lib/convocationMessage";
import { NO_CONV_REASONS, participationOf, playerLevel } from "@/lib/participation";
import { useParticipationContext } from "@/lib/useParticipation";
import { useAutosave } from "@/lib/useAutosave";
import { agendaMeta } from "@/lib/weekendAgenda";
import { recentTrainings, trainingDots, messageKit, kitKeyOf } from "@/lib/matchSteps";
import { minPlayersOf } from "@/lib/matchFormat";
import { withMatchDorsals, dorsalClashes, freeDorsals, cleanMatchDorsals } from "@/lib/matchDorsals";
import SaveStatus from "@/components/common/SaveStatus";
import Composer from "@/components/avisos/Composer";
import { RS } from "@/components/rs2/kit";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, msg, useDateLocale } from "@/i18n";

const POS = {
  portero: msg("POR"), lateral: msg("LAT"), central: msg("CT"), libre: msg("LIB"),
  mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT"),
};
const KITS = [["primera", msg("1.ª")], ["segunda", msg("2.ª")], ["tercera", msg("3.ª")]];
const DOT = { present: "#16A34A", apart: "#D97706", absent: "#DC2626" };
const DOT_LABEL = { present: msg("Asiste"), apart: msg("Al margen"), absent: msg("No asiste") };
const GREEN = "#15803D", RED = "#B91C1C";

const label = { fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, display: "block", marginBottom: 4 };
const input = { width: "100%", fontSize: 14, padding: "7px 10px", borderRadius: 8, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink };
const box = { ...input, background: RS.head, color: RS.ink2 };

function CardTitle({ children, extra }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 10 }}>
      <div style={{ borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 8 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granateDark }}>{children}</span></div>
      {extra}
    </div>
  );
}

// Va / No de cada jugador
function VaNo({ on, onChange, testId }) {
  const t = useT();
  const b = (active, bg) => ({ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: active ? bg : "transparent", color: active ? "#fff" : RS.muted });
  return (
    <span className="inline-flex shrink-0" style={{ background: RS.soft, borderRadius: 999, padding: 2 }} data-testid={testId} data-on={on ? "1" : "0"}>
      <button type="button" style={b(on, GREEN)} onClick={() => !on && onChange(true)} aria-pressed={on}>{t("Va")}</button>
      <button type="button" style={b(!on, RED)} onClick={() => on && onChange(false)} aria-pressed={!on}>{t("No")}</button>
    </span>
  );
}

function PlayerRow({ p, on, onToggle, reason, onReason, dots, pct, level, injury, mobile, onDorsal, clash }) {
  const t = useT();
  const fmt = useDateLocale();
  const pctColor = level === "alert" ? RED : level === "warn" ? "#B45309" : RS.muted;
  const injured = !!injury || p.status === "lesionado";
  // Motivo de la no convocatoria: un desplegable en la propia fila (ocupa menos que los botones)
  const reasonPick = !on && (
    <Select value={reason || ""} onValueChange={(v) => onReason(v === "__none" ? "" : v)}>
      <SelectTrigger className="h-7 text-xs shrink-0" style={{ width: mobile ? 118 : 140, borderColor: reason ? "#FCA5A5" : RS.line, background: reason ? "#FEF2F2" : "#fff", color: reason ? RED : RS.muted }} data-testid={`conv-reason-${p.id}`}>
        <SelectValue placeholder={t("Motivo…")} />
      </SelectTrigger>
      <SelectContent>
        {reason && <SelectItem value="__none">{t("Sin motivo")}</SelectItem>}
        {NO_CONV_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.short)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  return (
    <div className="flex flex-wrap items-center" style={{ gap: mobile ? "4px 6px" : 8, padding: "5px 8px", background: on ? "transparent" : "#FBF6F5", borderBottom: `1px solid ${RS.lineSoft}` }} data-testid={`conv-row-${p.id}`}>
      {onDorsal && on ? (
        // invitado convocado: su dorsal se puede cambiar solo para este partido
        <input value={dorsalOf(p)} onChange={(e) => onDorsal(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" aria-label={t("Dorsal en este partido")}
          title={p.own_jersey_number != null ? t("Dorsal en este partido (en su ficha: {n})", { n: p.own_jersey_number || "–" }) : t("Dorsal en este partido")}
          className="rs2-display tabular-nums text-center shrink-0" data-testid={`conv-dorsal-${p.id}`}
          style={{ width: 34, fontSize: 16, padding: "1px 2px", borderRadius: 6, color: clash ? RED : RS.granate, border: `1.5px solid ${clash ? "#FCA5A5" : RS.line}`, background: clash ? "#FEF2F2" : "#fff" }} />
      ) : (
        <span className="rs2-display tabular-nums text-right shrink-0" style={{ width: 22, fontSize: 17, color: clash && on ? RED : on ? RS.granate : RS.faint }}>{dorsalOf(p) || "•"}</span>
      )}
      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13.5, color: on ? RS.ink : RS.muted }}>
        <b style={{ fontWeight: 700 }}>{playerFullName(p)}</b> <span style={{ color: RS.faint, fontSize: 12 }}>{POS[p.position] ? t(POS[p.position]) : ""}</span>
        {injured && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "#FEE2E2", color: RED }}>{t("Lesión")}</span>}
        {injury?.expected_return && !mobile && <span style={{ marginLeft: 6, fontSize: 11, color: RS.faint }}>{t("vuelve {d}", { d: format(new Date(injury.expected_return), "d MMM", { locale: fmt }) })}</span>}
        {p._guest && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "1px 6px", borderRadius: 999, background: RS.soft, color: RS.ink2 }}>{p._guest}</span>}
      </span>
      {!mobile && reasonPick}
      <span className="inline-flex shrink-0" style={{ gap: 3 }} aria-label={t("Últimos entrenos")}>
        {(dots || []).map((d, i) => (
          <span key={i} title={d ? `${t(DOT_LABEL[d.status] || "")}${d.reason ? ` · ${d.reason}` : ""}` : t("Sin lista")}
            style={{ width: 7, height: 7, borderRadius: 99, background: d ? DOT[d.status] || "#ccc" : "#E4DCDB" }} />
        ))}
      </span>
      <span className="tabular-nums text-right shrink-0" style={{ width: 36, fontSize: 12, color: pctColor, fontWeight: level === "alert" ? 700 : 400 }} title={t("% de minutos de la temporada")}>{pct == null ? "–" : `${pct}%`}</span>
      <VaNo on={on} onChange={onToggle} testId={`conv-va-${p.id}`} />
      {mobile && !on && <div className="w-full" style={{ paddingLeft: 30 }}>{reasonPick}</div>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────
export default function ConvocationTab({ eventId, teamId, event, players, team }) {
  const t = useT();
  const dfl = useDateLocale();
  const mobile = useIsMobile();
  const queryClient = useQueryClient();
  const [convocadoIds, setConvocadoIds] = useState([]);
  const [reasons, setReasons] = useState({});
  const [dorsals, setDorsals] = useState({}); // dorsal solo para este partido: { player_id: "23" }
  const [notes, setNotes] = useState("");
  const [callupTime, setCallupTime] = useState("");
  const [kit, setKit] = useState(""); // 👕 lo que deben traer (texto libre); la equipación 1.ª/2.ª/3.ª va en el partido (Agenda)
  const [observations, setObservations] = useState(""); // ℹ️ información extra
  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [waEdited, setWaEdited] = useState(null); // texto del mensaje cambiado a mano (null = el que sale solo)
  const [copied, setCopied] = useState(false);
  const msgRef = useRef(null);

  const { data: convocation, isFetched } = useQuery({
    queryKey: ["convocatoria", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0] || null),
    enabled: !!eventId,
  });
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list().catch(() => []), retry: false });
  const partCtx = useParticipationContext("liga");

  // Lo que se guarda. El motivo de cada jugador no convocado queda guardado para las estadísticas de ausencias.
  const buildForm = (ids, why, n, callup, obs, kitText, dz) => ({
    player_ids: ids,
    match_dorsals: cleanMatchDorsals(dz, ids, allPlayers),
    notes: n,
    callup_time: callup,
    observations: obs,
    kit: kitText,
    absence_reasons: Object.fromEntries(Object.entries(why).filter(([id, r]) => r && !ids.includes(id))),
  });
  const form = buildForm(convocadoIds, reasons, notes, callupTime, observations, kit, dorsals);

  // Carga de lo guardado y guardado automático (no se guarda nada hasta que lo guardado esté cargado)
  const [hydrated, setHydrated] = useState(false);
  const convIdRef = useRef(null);
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
      queryClient.invalidateQueries({ queryKey: ["convocatorias_all"] });
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
      setDorsals(convocation.match_dorsals || {});
      autosave.reset(buildForm(ids, why, convocation.notes || "", convocation.callup_time || "", convocation.observations || "", convocation.kit || "", convocation.match_dorsals || {}));
    }
    setHydrated(true);
  }, [isFetched, convocation?.id]);

  // ── Jugadores ──
  const activePlayers = players.filter(p => p.status !== "baja");
  const ownIds = new Set(activePlayers.filter((p) => p.team_id === teamId).map((p) => p.id));
  const teamName = (id) => teams.find((x) => x.id === id)?.name || t("otro equipo");
  // Invitados (de otros equipos): solo los convocados; salen al final con su equipo
  const guests = withMatchDorsals(allPlayers.filter((p) => convocadoIds.includes(p.id) && !ownIds.has(p.id)).map((p) => ({ ...p, _guest: teamName(p.team_id) })), dorsals);
  const squad = withMatchDorsals(activePlayers.filter((p) => ownIds.has(p.id)), dorsals);
  const groups = groupPlayers(squad);
  const convocadosRaw = allPlayers.filter(p => convocadoIds.includes(p.id));
  const convocados = withMatchDorsals(convocadosRaw, dorsals);
  const noConvocados = squad.filter(p => !convocadoIds.includes(p.id));
  // Dorsales repetidos entre los convocados (p. ej. un juvenil con el mismo número que uno del primer equipo)
  const clashes = dorsalClashes(convocadosRaw, dorsals, teamId);
  const clashIds = new Set(clashes.flatMap((c) => c.players.map((p) => p.id)));
  const free = freeDorsals(convocadosRaw, dorsals, 8);
  const setDorsal = (pid, v) => setDorsals((prev) => ({ ...prev, [pid]: v }));
  const minN = minPlayersOf(event, team);
  const allSelected = squad.length > 0 && squad.every(p => convocadoIds.includes(p.id));

  const setOn = (pid, on) => setConvocadoIds((prev) => on ? [...new Set([...prev, pid])] : prev.filter((id) => id !== pid));
  const toggleAll = () => {
    const ids = squad.map(p => p.id);
    setConvocadoIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };
  const guestResults = allPlayers.filter(p =>
    p.team_id !== teamId && p.status !== "baja" && !convocadoIds.includes(p.id) && (guestSearch ? matchesPlayerSearch(p, guestSearch) : false));

  // Últimos entrenos y % de minutos de cada jugador
  const trainings = useMemo(() => recentTrainings(events, teamId, { before: event?.date, n: 3 }), [events, teamId, event?.date]);
  const shownIds = [...squad, ...guests].map((p) => p.id);
  const dots = useMemo(() => trainingDots(trainings, attendance, shownIds), [trainings, attendance, shownIds.join(",")]);
  const minutes = useMemo(() => {
    const out = {};
    const ctxByTeam = new Map();
    for (const p of [...squad, ...guests]) {
      if (!p.team_id) continue;
      if (!ctxByTeam.has(p.team_id)) ctxByTeam.set(p.team_id, { ...partCtx, events: partCtx.events.filter((e) => e.team_id === p.team_id) });
      const part = participationOf(p, ctxByTeam.get(p.team_id));
      out[p.id] = { pct: part.all.availMin ? part.all.pctAvail : null, level: playerLevel(part) };
    }
    return out;
  }, [partCtx, shownIds.join(",")]);
  const injuryOf = useMemo(() => {
    const m = new Map();
    for (const i of injuries) if (i.status !== "alta" && !m.has(i.player_id)) m.set(i.player_id, i);
    return m;
  }, [injuries]);

  // ── Equipación (la misma que en la Agenda del Panel: Event.agenda_meta) ──
  const meta = agendaMeta(event);
  const kitKey = kitKeyOf(meta);
  const setKitKey = async (key) => {
    const next = { ...meta, kit: key === "primera" ? "" : key };
    queryClient.setQueryData(["event", eventId], (old) => old ? { ...old, agenda_meta: next } : old);
    await base44.entities.Event.update(eventId, { agenda_meta: next });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };
  const kitForMessage = messageKit(meta, kit);

  // ── Mensaje y aviso ──
  const waAuto = buildConvocationText({ event, team, convocados, noConvocados, reasons, callupTime, kit: kitForMessage, info: observations });
  const waMsg = waEdited ?? waAuto;
  const pushBody = buildConvocationText({ event, team, convocados, noConvocados, callupTime, kit: kitForMessage, info: observations, plain: true });
  const squadIds = [...new Set([...convocados, ...noConvocados].map(p => p.id))];
  const copyWa = async () => {
    try { await navigator.clipboard.writeText(waMsg); }
    catch { const ta = document.createElement("textarea"); ta.value = waMsg; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  const markNotified = async (value = true) => {
    await autosave.flush();
    const id = convIdRef.current || convocation?.id;
    if (!id) return;
    await base44.entities.Convocatoria.update(id, value ? { notified: true, notified_at: new Date().toISOString() } : { notified: false, notified_at: null });
    queryClient.invalidateQueries({ queryKey: ["convocatoria", eventId] });
    queryClient.invalidateQueries({ queryKey: ["convocatorias_all"] });
  };
  const openPush = async () => { await autosave.flush(); setPushOpen(true); };

  const eventDate = event?.date ? new Date(event.date) : null;
  const notified = !!convocation?.notified;
  const pill = (bg, fg) => ({ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, background: bg, color: fg, display: "inline-flex", alignItems: "center", gap: 6 });
  const smallBtn = { fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink, display: "inline-flex", alignItems: "center", gap: 5 };

  const renderGroup = ({ group, players: list }) => (
    <div key={group} style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: RS.muted, padding: "2px 8px 4px" }}>
        {t(group)} <span style={{ color: RS.ink2 }}>{t("{a} de {b}", { a: list.filter((p) => convocadoIds.includes(p.id)).length, b: list.length })}</span>
      </div>
      {list.map((p) => (
        <PlayerRow key={p.id} p={p} on={convocadoIds.includes(p.id)} onToggle={(on) => setOn(p.id, on)}
          reason={reasons[p.id] || ""} onReason={(v) => setReasons((prev) => ({ ...prev, [p.id]: v }))}
          dots={dots[p.id]} pct={minutes[p.id]?.pct ?? null} level={minutes[p.id]?.level} injury={injuryOf.get(p.id)} mobile={mobile}
          clash={clashIds.has(p.id)} onDorsal={p._guest || dorsals[p.id] != null || clashes.some((c) => c.change.some((x) => x.id === p.id)) ? (v) => setDorsal(p.id, v) : null} />
      ))}
    </div>
  );

  return (
    <div className="grid items-start" style={{ gridTemplateColumns: mobile ? "minmax(0,1fr)" : "minmax(0,1fr) 400px", gap: 12 }} data-testid="conv-tab">
      {/* ── Lista ── */}
      <section className="rs2-card" style={{ padding: mobile ? 10 : 14 }} data-testid="conv-list">
        <div className="flex flex-wrap items-center" style={{ gap: "6px 14px" }}>
          <span className="flex items-baseline" style={{ gap: 5 }}><span className="rs2-display tabular-nums" style={{ fontSize: 26, color: GREEN }} data-testid="conv-count">{convocadoIds.length}</span><span style={{ fontSize: 13, color: RS.ink2 }}>{t("convocados")}</span></span>
          <span className="flex items-baseline" style={{ gap: 5 }}><span className="rs2-display tabular-nums" style={{ fontSize: 26, color: RED }}>{noConvocados.length}</span><span style={{ fontSize: 13, color: RS.ink2 }}>{t("no convocados")}</span></span>
          <span style={{ fontSize: 11.5, color: convocadoIds.length < minN ? RED : RS.faint }}>{t("mínimo {n}", { n: minN })} · <SaveStatus state={autosave.state} onRetry={autosave.flush} className="inline" /></span>
          <span className="flex flex-wrap" style={{ gap: 6, marginLeft: "auto" }}>
            <button type="button" style={smallBtn} onClick={toggleAll} data-testid="conv-all">{allSelected ? t("Ninguno") : t("Todos van")}</button>
            <button type="button" style={smallBtn} onClick={() => setShowGuestSearch((v) => !v)} data-testid="conv-guest"><Plus className="w-3.5 h-3.5" />{t("De otro equipo")}</button>
          </span>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 11.5, color: RS.faint, margin: "6px 0 8px" }}>
          <span>{t("Junto a cada jugador:")}</span>
          <span className="inline-flex" style={{ gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: DOT.present }} /><span style={{ width: 7, height: 7, borderRadius: 99, background: DOT.apart }} /><span style={{ width: 7, height: 7, borderRadius: 99, background: DOT.absent }} /></span>
          <span>{trainings.length === 1 ? t("último entreno") : t("últimos {n} entrenos", { n: trainings.length || 3 })}</span><span>·</span><span>{t("% de minutos de la temporada")}</span>
        </div>

        {showGuestSearch && (
          <div style={{ border: `1px solid ${RS.line}`, borderRadius: 10, padding: 10, marginBottom: 10, background: RS.head }} data-testid="conv-guest-box">
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: RS.ink2 }}>{t("Buscar jugadores de otros equipos del club")}</span>
              <button type="button" onClick={() => { setShowGuestSearch(false); setGuestSearch(""); }} aria-label={t("Cerrar")}><X className="w-4 h-4" style={{ color: RS.muted }} /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: RS.faint }} />
              <input autoFocus placeholder={t("Nombre del jugador…")} value={guestSearch} onChange={e => setGuestSearch(e.target.value)} style={{ ...input, paddingLeft: 30 }} data-testid="conv-guest-search" />
            </div>
            {guestSearch && guestResults.slice(0, 8).map(p => (
              <button key={p.id} type="button" onClick={() => { setOn(p.id, true); setGuestSearch(""); }}
                className="w-full text-left flex items-center hover:bg-white" style={{ gap: 8, padding: "6px 8px", borderRadius: 6, fontSize: 13 }}>
                <span className="rs2-display" style={{ width: 22, color: RS.granate }}>{dorsalOf(p) || "•"}</span>
                <b>{playerFullName(p)}</b>
                <span style={{ marginLeft: "auto", fontSize: 12, color: RS.faint }}>{POS[p.position] ? t(POS[p.position]) : ""} · {teamName(p.team_id)}</span>
              </button>
            ))}
            {guestSearch && guestResults.length === 0 && <p style={{ fontSize: 12, color: RS.faint, textAlign: "center", padding: 6 }}>{t("Sin resultados")}</p>}
          </div>
        )}

        {clashes.length > 0 && (
          <div style={{ border: "1px solid #FCA5A5", background: "#FEF2F2", borderRadius: 10, padding: "8px 10px", marginBottom: 10 }} data-testid="conv-dorsal-clash">
            <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{clashes.length === 1 ? t("Hay un dorsal repetido entre los convocados") : t("Hay {n} dorsales repetidos entre los convocados", { n: clashes.length })}</div>
            <p style={{ fontSize: 12, color: RS.ink2, margin: "2px 0 6px" }}>{t("Ponle otro dorsal solo para este partido: su ficha no cambia. Sale así en la convocatoria, la alineación, la hoja del entrenador y el balón parado.")}</p>
            {clashes.map((c) => (
              <div key={c.dorsal} style={{ padding: "5px 0", borderTop: "1px solid #FDE2E2" }}>
                <div style={{ fontSize: 12.5 }}>
                  <b className="tabular-nums" style={{ color: RED }}>{t("Dorsal {n}", { n: c.dorsal })}</b>{": "}
                  {c.players.map((p) => `${playerFullName(p)} (${p.team_id === teamId ? (team?.name || t("este equipo")) : teamName(p.team_id)})`).join(" · ")}
                </div>
                {c.change.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: RS.ink2 }}>{t("Nuevo dorsal para {name}:", { name: playerFullName(p) })}</span>
                    <input value={dorsals[p.id] ?? ""} placeholder={c.dorsal} inputMode="numeric" aria-label={t("Nuevo dorsal para {name}:", { name: playerFullName(p) })}
                      onChange={(e) => setDorsal(p.id, e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} data-testid={`conv-clash-input-${p.id}`}
                      className="tabular-nums text-center" style={{ width: 46, fontSize: 14, fontWeight: 700, padding: "3px 4px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#fff" }} />
                    <span style={{ fontSize: 11.5, color: RS.muted }}>{t("Libres:")}</span>
                    {free.slice(0, 6).map((n) => (
                      <button key={n} type="button" onClick={() => setDorsal(p.id, n)} data-testid={`conv-clash-free-${p.id}-${n}`}
                        className="tabular-nums" style={{ fontSize: 12, fontWeight: 700, minWidth: 28, padding: "2px 6px", borderRadius: 6, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink }}>{n}</button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Toda la plantilla en un solo bloque, por posición */}
        <div>
          {groups.map(renderGroup)}
          {guests.length > 0 && renderGroup({ group: msg("De otros equipos"), players: guests })}
        </div>
      </section>

      {/* ── Datos y mensaje ── */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        <section className="rs2-card" style={{ padding: 14 }} data-testid="conv-data">
          <CardTitle>{t("Datos de la convocatoria")}</CardTitle>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label><span style={label}>{t("Hora de convocatoria")}</span>
              <input type="time" value={callupTime} onChange={e => setCallupTime(e.target.value)} style={input} data-testid="conv-callup" /></label>
            <div><span style={label}>{t("Partido")}</span><div style={box}>{eventDate ? `${format(eventDate, "HH:mm")} · ${format(eventDate, "EEE d MMM", { locale: dfl })}` : "–"}</div></div>
          </div>
          <div style={{ marginTop: 10 }}><span style={label}>{t("Campo")}</span><div style={box}>{event?.location || "–"}</div></div>
          <div style={{ marginTop: 10 }}>
            <span style={label}>👕 {t("Equipación")}</span>
            <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
              {KITS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setKitKey(k)} data-testid={`conv-kit-${k}`} aria-pressed={kitKey === k}
                  style={{ fontSize: 13, fontWeight: 700, minWidth: 44, padding: "6px 10px", borderRadius: 8, border: `1px solid ${kitKey === k ? RS.granate : RS.line}`, background: kitKey === k ? RS.granate : "#fff", color: kitKey === k ? "#fff" : RS.ink }}>{t(l)}</button>
              ))}
              <span style={{ fontSize: 11.5, color: RS.faint }}>· {t("la misma que en la Agenda del Panel")}</span>
            </div>
            <input value={kit} onChange={e => setKit(e.target.value)} style={{ ...input, marginTop: 6 }} placeholder={t("Qué más deben traer: chándal, medias…")} aria-label={t("Equipación que deben traer")} data-testid="conv-kit-text" />
          </div>
          <label className="block" style={{ marginTop: 10 }}><span style={label}>ℹ️ {t("Información extra")}</span>
            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} style={input} placeholder={t("Material, comida, desplazamiento o cualquier otra indicación…")} data-testid="conv-info" /></label>
          <label className="block" style={{ marginTop: 10 }}><span style={label}>{t("Notas internas (no se envían)")}</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={input} placeholder={t("Notas para el cuerpo técnico (no se envían a jugadores)…")} data-testid="conv-notes" /></label>
        </section>

        <section className="rs2-card" style={{ padding: 14 }} ref={msgRef} data-testid="conv-message">
          <CardTitle extra={waEdited != null && (
            <button type="button" onClick={() => setWaEdited(null)} style={{ fontSize: 11.5, color: RS.granate, display: "inline-flex", alignItems: "center", gap: 4 }} data-testid="conv-msg-reset">
              <RotateCcw className="w-3 h-3" />{t("Rehacer el mensaje")}</button>
          )}>{t("Mensaje y aviso")}</CardTitle>
          <textarea value={waMsg} onChange={(e) => setWaEdited(e.target.value)} rows={mobile ? 10 : 13} data-testid="conv-msg"
            style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.45, padding: 12, borderRadius: 10, border: "none", background: "#F1ECE6", color: RS.ink, resize: "vertical" }} />
          {waEdited != null && <p style={{ fontSize: 11, color: RS.faint, marginTop: 2 }}>{t("Cambiado a mano: ya no se actualiza solo.")}</p>}
          <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
            <button type="button" style={pill(RS.granateDark, "#fff")} onClick={copyWa} data-testid="conv-copy"><Copy className="w-3.5 h-3.5" />{copied ? t("¡Copiado!") : t("Copiar para WhatsApp")}</button>
            <button type="button" style={{ ...pill(RS.naranja, "#fff"), opacity: convocadoIds.length ? 1 : 0.5 }} disabled={!convocadoIds.length} onClick={openPush} data-testid="conv-push"><Bell className="w-3.5 h-3.5" />{t("Enviar aviso al móvil · {n}", { n: squadIds.length })}</button>
          </div>
          <div className="flex flex-wrap items-center justify-between" style={{ gap: 6, marginTop: 10, fontSize: 12.5 }} data-testid="conv-notified" data-notified={notified ? "1" : "0"}>
            {notified ? (
              <>
                <span style={{ color: GREEN, fontWeight: 700 }}><Check className="w-3.5 h-3.5 inline -mt-0.5" /> {convocation?.notified_at ? t("Avisada el {d}", { d: format(new Date(convocation.notified_at), "d MMM · HH:mm", { locale: dfl }) }) : t("Avisada")}</span>
                <button type="button" onClick={() => markNotified(false)} style={{ color: RS.muted, textDecoration: "underline" }}>{t("Quitar la marca")}</button>
              </>
            ) : (
              <>
                <span style={{ color: "#B45309" }}>● {t("Sin avisar todavía")}</span>
                <button type="button" onClick={() => markNotified(true)} disabled={!convocadoIds.length} style={{ color: RS.granate, fontWeight: 700, textDecoration: "underline" }} data-testid="conv-mark">{t("Marcar como avisada")}</button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Móvil: barra fija para ir al mensaje */}
      {mobile && (
        <div className="fixed left-0 right-0 bottom-0 flex items-center justify-between" style={{ zIndex: 30, padding: "10px 14px", background: RS.granateDark, color: "#fff", paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }} data-testid="conv-mobile-bar">
          <span style={{ fontSize: 14 }}><b className="rs2-display" style={{ fontSize: 20 }}>{convocadoIds.length}</b> {t("convocados")}</span>
          <button type="button" onClick={() => msgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} style={pill(RS.naranja, "#fff")}>{t("Mensaje y aviso")}</button>
        </div>
      )}

      {/* Aviso al móvil: el mismo contenido que el mensaje, sin el motivo de los no convocados; le llega a toda la plantilla.
          Al enviarlo, la convocatoria queda marcada como avisada. */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-black text-gray-900">{t("Aviso al móvil (app)")}</DialogTitle></DialogHeader>
          <Composer
            key={pushOpen ? "open" : "closed"}
            fixed={{ player_ids: squadIds, label: `Toda la plantilla (${squadIds.length})` }}
            defaultTitle={`Convocatoria · ${team?.name || ""}`}
            defaultBody={pushBody}
            bodyRows={12}
            onSent={() => markNotified(true)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
