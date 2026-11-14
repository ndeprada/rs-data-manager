// Pestaña «Preparación de partido» (clave `tactica`). Rediseño del 13/11/2026 con la maqueta «Maqueta Preparación · RS Manager»
// aprobada por Nacho: a la izquierda el once con las camisetas reales del club (foto de la espalda con el dorsal estampado y
// el nombre y primer apellido debajo en blanco, con la letra del club), avisos de la alineación, «Como el último partido»,
// banquillo, capitán y equipación (la misma de la convocatoria y la Agenda: Event.agenda_meta.kit); a la derecha la hoja del
// entrenador, el resumen del rival y el plan de partido en tres bloques plegables; abajo la franja de balón parado, que abre
// el editor de jugadas de siempre. Lógica pura en src/lib/matchPrep.js; camisetas en src/lib/clubKits.js.
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { withMatchDorsals } from "@/lib/matchDorsals";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Eraser, Wand2, Search, FileDown, Eye, History, ChevronDown, ChevronUp, X } from "lucide-react";
import { downloadMatchSheetPDF } from "@/lib/matchSheetPdf";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SetPieceBoard from "./SetPieceBoard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextBox from "./RichTextBox";
import RivalReport from "./RivalReport";
import { KitShirt, KitIcon } from "./KitShirt";
import { playerFullName, matchesPlayerSearch } from "@/lib/playerName";
import { f7Markings } from "@/lib/pitchGeometry";
import { isF7Team } from "@/lib/teamOrder";
import { FORMATION_POSITIONS, formationsFor, isFormationOf, formationOptions, formationLabel, normalizeFormation, tacticsFormat } from "@/lib/matchFormations";
import { KITS, GK_KITS, kitFor, matchKit, agendaKitOf } from "@/lib/clubKits";
import { lineupAlerts, previousLineup, plainSummary, rivalSummary, shirtName } from "@/lib/matchPrep";
import { participationOf, playerLevel, matchMinimum, isPerformanceTeam } from "@/lib/participation";
import { defaultDuration, totalMinutes } from "@/lib/matchDuration";
import { useParticipationContext } from "@/lib/useParticipation";
import { agendaMeta } from "@/lib/weekendAgenda";
import { rivalNotesBefore } from "@/lib/postMatch";
import { pieceSetup, SP_KINDS, setupLabel } from "@/lib/setPieceBoard";
import { reasonText } from "@/lib/convocationMessage";
import { isPrimerEquipo } from "@/lib/primerEquipo";
import { RS } from "@/components/rs2/kit";
import { FormChips } from "@/components/rs2/dashParts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, msg, useDateLocale } from "@/i18n";
import { format } from "date-fns";
import { F as clubFont } from "@/lib/brand";

const POS_LABEL = { portero: msg("POR"), lateral: msg("LAT"), central: msg("CT"), libre: msg("LIB"), mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT") };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];
const GROUP = { portero: 0, central: 1, libre: 1, lateral: 1, mediocentro: 2, interior: 2, mediapunta: 2, extremo: 3, delantero_centro: 3 };
const KIND_LABEL = Object.fromEntries(SP_KINDS.map((k) => [k.id, msg(k.label)]));
const LOSS = "#B91C1C", AMB = "#B45309";

function CardTitle({ children, extra, count }) {
  return (
    <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
      <div style={{ borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 8 }}>
        <span className="rs2-display" style={{ fontSize: 17, color: RS.granateDark }}>{children}</span>
        {count && <span style={{ fontSize: 12, color: RS.faint, marginLeft: 6 }}>{count}</span>}
      </div>
      {extra}
    </div>
  );
}
const lab = { fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: RS.muted, marginBottom: 5 };
const ghostBtn = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 8, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2 };
const iconBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: `1px solid ${RS.input}`, background: "#fff", color: RS.muted };

// ── Campo con las camisetas ─────────────────────────────
function LineupField({ kit, gkKit, captainId, slots, positions, onPositionsChange, onSlotClick, selectedIdx = null, isF7 = false, alertSlots, minutesOf, compact = false }) {
  const t = useT();
  const svgRef = useRef(null);
  const draggingIdx = useRef(null);
  const W = 300, H = 420;
  const M = 12;
  const f7 = isF7 ? f7Markings(M, M, W - 2 * M, H - 2 * M) : null;
  const SH = isF7 ? 46 : 38; // alto de la camiseta

  const getSVGPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(14, Math.min(W - 14, (clientX - rect.left) * (W / rect.width))),
      y: Math.max(20, Math.min(H - 30, (clientY - rect.top) * (H / rect.height))),
    };
  }, []);
  const downAt = useRef(null);
  const onDown = (e, idx) => {
    e.preventDefault();
    draggingIdx.current = idx;
    downAt.current = { x: e.clientX, y: e.clientY, idx };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (draggingIdx.current === null) return;
    const pt = getSVGPoint(e.clientX, e.clientY);
    if (!pt) return;
    const next = [...positions];
    next[draggingIdx.current] = [pt.x / W * 100, pt.y / H * 100];
    onPositionsChange(next);
  };
  const onUp = (e) => {
    const d = downAt.current;
    if (d && e && e.type === "pointerup" && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) {
      const idx = d.idx;
      setTimeout(() => onSlotClick?.(idx), 120);
    }
    downAt.current = null;
    draggingIdx.current = null;
  };
  const L = { stroke: "rgba(255,255,255,0.75)", strokeWidth: 1.4, fill: "none" };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full touch-none select-none" style={{ borderRadius: 10, display: "block" }}
      onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} data-testid="prep-field">
      <defs>
        <filter id="prepNameShadow" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="0.8" stdDeviation="0.9" floodColor="#000" floodOpacity=".45" /></filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#2E7D3A" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => i % 2 ? <rect key={i} x="0" y={i * H / 8} width={W} height={H / 8} fill="#2A7536" /> : null)}
      <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} {...L} />
      <line x1={M} y1={H / 2} x2={W - M} y2={H / 2} {...L} />
      <circle cx={W / 2} cy={H / 2} r={f7 ? f7.centre.r : 38} {...L} />
      {f7 ? (
        <>
          <rect x={f7.area.x} y={M} width={f7.area.w} height={f7.area.d} {...L} />
          <rect x={f7.goalArea.x} y={M} width={f7.goalArea.w} height={f7.goalArea.d} {...L} />
          <rect x={f7.area.x} y={H - M - f7.area.d} width={f7.area.w} height={f7.area.d} {...L} />
          <rect x={f7.goalArea.x} y={H - M - f7.goalArea.d} width={f7.goalArea.w} height={f7.goalArea.d} {...L} />
          <g data-testid="f7-offside" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" strokeDasharray="6 4">
            <line x1={M} y1={M + f7.offside} x2={W - M} y2={M + f7.offside} />
            <line x1={M} y1={H - M - f7.offside} x2={W - M} y2={H - M - f7.offside} />
          </g>
        </>
      ) : (
        <>
          <rect x={W * 0.2} y={M} width={W * 0.6} height="66" {...L} />
          <rect x={W * 0.36} y={M} width={W * 0.28} height="24" {...L} />
          <rect x={W * 0.2} y={H - M - 66} width={W * 0.6} height="66" {...L} />
          <rect x={W * 0.36} y={H - M - 24} width={W * 0.28} height="24" {...L} />
        </>
      )}

      {positions.map((pos, i) => {
        const player = slots[i];
        if (!pos) return null;
        const cx = pos[0] / 100 * W;
        const cy = pos[1] / 100 * H;
        const k = kitFor(player, kit, gkKit);
        const warn = alertSlots?.has(i);
        const m = player ? minutesOf?.(player.id) : null;
        const sub = player && !compact ? [POS_LABEL[player.position] ? t(POS_LABEL[player.position]) : "", m?.pct != null ? t("{pct}% min", { pct: m.pct }) : ""].filter(Boolean).join(" · ") : "";
        return (
          <g key={i} onPointerDown={e => onDown(e, i)} style={{ cursor: "grab" }} data-testid={`prep-slot-${i}`}>
            <rect x={cx - SH * 0.6} y={cy - SH * 0.55} width={SH * 1.2} height={SH * 1.55} fill="transparent" />
            {selectedIdx === i && <ellipse cx={cx} cy={cy + 2} rx={SH * 0.62} ry={SH * 0.62} fill="rgba(252,221,9,0.2)" stroke="#FCDD09" strokeWidth="2.2" />}
            {player ? (
              <KitShirt x={cx} y={cy} h={SH} kit={k} number={player.jersey_number ?? ""} />
            ) : (
              <>
                <circle cx={cx} cy={cy} r={SH * 0.34} fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.6" strokeDasharray="4 3" />
                <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="white" style={{ fontFamily: clubFont.title }}>+</text>
              </>
            )}
            {player && captainId && player.id === captainId && (
              <g transform={`translate(${cx + SH * 0.28}, ${cy - SH * 0.56})`}>
                <rect x="-0.8" y="-0.8" width="15.6" height="11.6" rx="2" fill="#1f2937" opacity="0.55" />
                <rect x="0" y="0" width="14" height="10" rx="1.5" fill="#FCDD09" />
                {[1.4, 4.4, 7.4, 10.4].map(x => <rect key={x} x={x} y="0" width="1.7" height="10" fill="#DA121A" />)}
                <text x="7" y="8.4" textAnchor="middle" fontSize="9" style={{ fontFamily: clubFont.title }} fill="white" stroke="rgba(0,0,0,0.8)" strokeWidth="1.8" paintOrder="stroke" strokeLinejoin="round">{t("C")}</text>
              </g>
            )}
            {warn && (
              <g transform={`translate(${cx - SH * 0.42}, ${cy - SH * 0.42})`} data-testid={`prep-warn-${i}`}>
                <circle r="6" fill={LOSS} stroke="#fff" strokeWidth="1" />
                <text y="3.2" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">!</text>
              </g>
            )}
            {player && (
              <g filter="url(#prepNameShadow)">
                <text x={cx} y={cy + SH * 0.5 + 9} textAnchor="middle" fontSize={(isF7 ? 11 : 9.5) * (compact ? 1.25 : 1)} letterSpacing="0.2" fill="#fff" style={{ fontFamily: clubFont.title }} data-testid={`prep-name-${i}`}>
                  {shirtName(player).toUpperCase()}
                </text>
                {sub && <text x={cx} y={cy + SH * 0.5 + 17} textAnchor="middle" fontSize="6.4" fill={m?.level === "alert" ? "#FECACA" : "rgba(255,255,255,0.85)"}>{sub}</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Selector de jugador para un hueco ──
function PlayerPicker({ open, onClose, teamPlayers, taken, onPick, onClear, current }) {
  const t = useT();
  const [q, setQ] = useState("");
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list(), enabled: open });
  useEffect(() => { if (open) setQ(""); }, [open]);
  const pool = q.trim()
    ? allPlayers.filter(p => p.status !== "baja" && matchesPlayerSearch(p, q)).slice(0, 30)
    : teamPlayers;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white border-gray-200 max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("Elegir jugador")}</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Buscar (incluye otros equipos)…")} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        <div className="space-y-1">
          {current && <button onClick={onClear} className="w-full text-left text-xs px-3 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50">{t("Dejar el hueco vacío")}</button>}
          {pool.map(p => {
            const used = taken.has(p.id) && p.id !== current?.id;
            return (
              <button key={p.id} disabled={used} onClick={() => onPick(p)} className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded text-sm ${used ? "opacity-40" : "hover:bg-gray-50"}`}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0" style={{ background: "var(--granate)" }}>{p.jersey_number || p.first_name?.[0]}</span>
                <span className="font-medium truncate">{playerFullName(p)}</span>
                <span className="ml-auto text-[10px] text-gray-400">{POS_LABEL[p.position] ? t(POS_LABEL[p.position]) : ""}</span>
              </button>
            );
          })}
          {pool.length === 0 && <p className="text-xs text-gray-400 text-center py-4">{t("Sin resultados")}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Botón de equipación (camiseta pequeña) ──
function KitButton({ kit, on, label, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} aria-pressed={on}
      className="flex flex-col items-center" style={{ gap: 2, padding: "5px 6px", borderRadius: 8, border: on ? `2px solid ${RS.granate}` : `1px solid ${RS.line}`, background: "#fff", fontSize: 11, fontWeight: 700, color: on ? RS.granate : RS.muted, minWidth: 46 }}>
      <KitIcon kit={kit} size={28} />{label}
    </button>
  );
}

// ── Bloque plegable del plan ──
function PlanBlock({ id, icon, title, hint, value, onChange, placeholder, summary, open, onToggle, minHeight = 120 }) {
  const t = useT();
  return (
    <div style={{ border: `1px solid ${RS.line}`, borderRadius: 10, overflow: "hidden" }} data-testid={`plan-${id}`} data-open={open ? "1" : "0"}>
      <button type="button" onClick={onToggle} className="w-full flex items-center text-left" style={{ gap: 6, padding: "8px 10px", fontSize: 13 }} data-testid={`plan-${id}-toggle`}>
        <b className="shrink-0">{icon} {title}</b>
        {!open && <span className="flex-1 min-w-0 truncate" style={{ color: summary ? RS.muted : RS.faint, fontSize: 12, marginLeft: 4 }}>{summary || t("Sin escribir")}</span>}
        {open && <span className="flex-1" />}
        {open ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: RS.muted }} /> : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: RS.muted }} />}
      </button>
      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          <p style={{ fontSize: 11, color: RS.muted, margin: "0 0 6px" }}>{hint}</p>
          <RichTextBox value={value} onChange={onChange} placeholder={placeholder} minHeight={minHeight} />
        </div>
      )}
    </div>
  );
}

// ── Pestaña ─────────────────────────────────────────────
export default function TacticaTab({ event, players, convocadoIds, matchDorsals, starterIds, footballFormat, team, sheetRequest = 0, onSheetHandled }) {
  const t = useT();
  const locale = useDateLocale();
  const qc = useQueryClient();
  const mobile = useIsMobile();
  const { data: plan, isFetched } = useQuery({
    queryKey: ["matchplan", event?.id],
    queryFn: () => base44.entities.MatchPlan.filter({ event_id: event.id }).then(d => d[0] || null),
    enabled: !!event?.id,
  });
  const isF7 = tacticsFormat({ planFormation: plan?.formation, eventFormat: footballFormat, teamIsF7: team ? isF7Team(team) : false }) === "f7";
  const formations = formationsFor(isF7);
  const validDefault = formations[0];
  const teamPlayers = [...players.filter(p => p.status !== "baja")].sort((a, b) => (POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)) || (a.last_name || "").localeCompare(b.last_name || ""));

  const { data: allPlayersRaw = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  // con el dorsal de este partido (si la convocatoria le ha puesto otro)
  const allPlayers = useMemo(() => withMatchDorsals(allPlayersRaw, matchDorsals), [allPlayersRaw, matchDorsals]);
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries"], queryFn: () => base44.entities.Injury.list().catch(() => []), retry: false });
  const partCtx = useParticipationContext("liga");
  const rivalOn = event?.type === "partido_liga" && !!event?.opponent;
  // Lo que se apuntó del rival en el postpartido de los partidos anteriores contra él (13/11/2026)
  const { data: allEvents = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date"), enabled: !!event?.opponent });
  const pastRivalNotes = useMemo(() => rivalNotesBefore(allEvents, event), [allEvents, event]);
  const { data: report } = useQuery({
    queryKey: ["rival_report", event?.id],
    queryFn: () => base44.club.rivalReport(event.id),
    enabled: !!event?.id && rivalOn,
    staleTime: 15 * 60 * 1000,
  });

  const [formation, setFormation] = useState(validDefault);
  const [positions, setPositions] = useState(null);
  const [lineup, setLineup] = useState([]);
  const [planAttack, setPlanAttack] = useState("");
  const [planDefense, setPlanDefense] = useState("");
  const [planSet, setPlanSet] = useState("");
  const [rival, setRival] = useState({ strengths: "", weaknesses: "", keys: "", notes: "" });
  const [pieces, setPieces] = useState([]);
  const [captain, setCaptain] = useState("");
  const [planKit, setPlanKit] = useState("1");
  const [gkKit, setGkKit] = useState("naranja");
  const [gkKit2, setGkKit2] = useState("");
  const [pickSlot, setPickSlot] = useState(null);
  const [status, setStatus] = useState("");
  const [openBlock, setOpenBlock] = useState({ attack: true, defense: false, set: false });
  const [showRival, setShowRival] = useState(() => typeof window !== "undefined" && window.location.hash === "#rival-report");
  const [showAbp, setShowAbp] = useState(false);
  const [note, setNote] = useState("");
  const loaded = useRef(false);
  const [ready, setReady] = useState(false); // lo guardado ya está puesto en pantalla
  const planId = useRef(null);
  const chain = useRef(Promise.resolve());

  useEffect(() => {
    if (!isFetched || loaded.current) return;
    loaded.current = true;
    setReady(true);
    if (plan) {
      planId.current = plan.id;
      if (isFormationOf(isF7, normalizeFormation(plan.formation))) setFormation(normalizeFormation(plan.formation));
      setPositions(plan.positions || null);
      setLineup(plan.lineup || []);
      setPlanAttack(plan.plan_attack || "");
      setPlanDefense(plan.plan_defense || "");
      setPlanSet(plan.plan_setpieces || "");
      setRival({ strengths: "", weaknesses: "", keys: "", notes: "", ...(plan.rival || {}) });
      setPieces(plan.set_pieces || []);
      setCaptain(plan.captain_id || "");
      if (KITS[plan.kit]) setPlanKit(plan.kit);
      if (GK_KITS[plan.gk_kit]) setGkKit(plan.gk_kit);
      setGkKit2(GK_KITS[plan.gk_kit2] ? plan.gk_kit2 : "");
      if (!plan.plan_attack && (plan.plan_defense || plan.plan_setpieces)) setOpenBlock({ attack: false, defense: !!plan.plan_defense, set: !plan.plan_defense });
    } else {
      try {
        const old = JSON.parse(localStorage.getItem(`tactica_${event?.id}`) || "null");
        if (old) {
          if (isFormationOf(isF7, normalizeFormation(old.formation))) setFormation(normalizeFormation(old.formation));
          setPlanAttack(old.planPropio || "");
          setRival(r => ({ ...r, notes: old.planRival || "" }));
        }
      } catch (_) {}
    }
  }, [isFetched]);

  // Equipación del partido: la de la convocatoria y la Agenda (si está indicada); si no, la guardada en el plan
  const meta = agendaMeta(event);
  const kit = matchKit(meta, planKit);
  const setKit = async (k) => {
    setPlanKit(k);
    const next = { ...meta, kit: agendaKitOf(k) };
    qc.setQueryData(["event", event.id], (old) => old ? { ...old, agenda_meta: next } : old);
    try {
      await base44.entities.Event.update(event.id, { agenda_meta: next });
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch (_) { setStatus(t("Error al guardar")); }
  };

  const validFormation = isFormationOf(isF7, formation) ? formation : validDefault;
  const defaultPositions = FORMATION_POSITIONS[validFormation] || [];
  const currentPositions = positions || defaultPositions;
  const nSlots = defaultPositions.length;
  const slotIds = Array.from({ length: nSlots }, (_, i) => lineup[i] || null);
  const findPlayer = (id) => players.find(p => p.id === id) || allPlayers.find(p => p.id === id) || null;
  const slots = slotIds.map(id => (id ? findPlayer(id) : null));
  const taken = new Set(slotIds.filter(Boolean));

  // Autoguardado (1,2 s después del último cambio)
  const payload = { formation: validFormation, positions, lineup: slotIds, plan_attack: planAttack, plan_defense: planDefense, plan_setpieces: planSet, rival, set_pieces: pieces, kit, gk_kit: gkKit, gk_kit2: gkKit2, captain_id: slotIds.includes(captain) ? captain : "" };
  const payloadKey = JSON.stringify(payload);
  const firstRun = useRef(true);
  useEffect(() => {
    if (!loaded.current) return;
    if (firstRun.current) { firstRun.current = false; return; }
    setStatus(t("Guardando…"));
    const timer = setTimeout(() => {
      chain.current = chain.current.then(async () => {
        try {
          if (planId.current) await base44.entities.MatchPlan.update(planId.current, payload);
          else { const c = await base44.entities.MatchPlan.create({ event_id: event.id, team_id: event.team_id, ...payload }); planId.current = c.id; }
          qc.invalidateQueries({ queryKey: ["matchplan", event.id] });
          setStatus(t("Guardado ✓"));
        } catch (_) { setStatus(t("Error al guardar")); }
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [payloadKey]);

  const handleFormationChange = (f) => {
    if (!f) return;
    setFormation(f);
    setPositions(null);
    setLineup(l => l.slice(0, (FORMATION_POSITIONS[f] || []).length));
  };
  const setSlot = (i, id) => setLineup(() => { const n = [...slotIds]; n[i] = id; return n; });
  const benchPlayers = [...new Set(convocadoIds || [])]
    .filter(id => !taken.has(id))
    .map(findPlayer)
    .filter(Boolean)
    .sort((a, b) => ((GROUP[a.position] ?? 9) - (GROUP[b.position] ?? 9)) || ((Number(a.jersey_number) || 999) - (Number(b.jersey_number) || 999)) || (a.last_name || "").localeCompare(b.last_name || ""));
  const [sel, setSel] = useState(null);
  const selPlayer = sel?.kind === "slot" ? slots[sel.i] : sel?.kind === "bench" ? benchPlayers.find(p => p.id === sel.id) : null;
  const onSlotTap = (i) => {
    if (!sel) { if (slots[i]) setSel({ kind: "slot", i }); else setPickSlot(i); return; }
    if (sel.kind === "bench") { setSlot(i, sel.id); setSel(null); return; }
    if (sel.i === i) { setSel(null); return; }
    const n = [...slotIds]; [n[i], n[sel.i]] = [n[sel.i], n[i]];
    setLineup(n); setSel(null);
  };
  const onBenchTap = (p) => {
    if (!sel || sel.kind === "bench") { setSel(sel?.id === p.id ? null : { kind: "bench", id: p.id }); return; }
    setSlot(sel.i, p.id); setSel(null);
  };
  const fillFromActa = () => {
    const ids = players.filter(p => starterIds.includes(p.id)).sort((a, b) => POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)).map(p => p.id);
    setLineup(Array.from({ length: nSlots }, (_, i) => ids[i] || null));
  };

  // «Como el último partido»: sistema, posiciones y alineación del último partido del equipo con once puesto
  const [prevBusy, setPrevBusy] = useState(false);
  const copyLastMatch = async () => {
    setPrevBusy(true);
    try {
      const [plans, events] = await Promise.all([
        base44.entities.MatchPlan.filter({ team_id: event.team_id }),
        qc.fetchQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") }),
      ]);
      const prev = previousLineup({ plans, events, eventId: event.id, eventDate: event.date });
      if (!prev) { setNote(t("No hay ningún partido anterior con la alineación puesta.")); return; }
      const f = normalizeFormation(prev.plan.formation);
      const sameFormat = isFormationOf(isF7, f);
      const fNow = sameFormat ? f : validFormation;
      const n = (FORMATION_POSITIONS[fNow] || []).length;
      setFormation(fNow);
      setPositions(sameFormat ? (prev.plan.positions || null) : null);
      setLineup(Array.from({ length: n }, (_, i) => prev.plan.lineup?.[i] || null));
      if (prev.plan.captain_id) setCaptain(prev.plan.captain_id);
      const when = prev.event?.date ? format(new Date(prev.event.date), "d MMM", { locale }) : "";
      setNote(t("Alineación copiada del partido contra {rival} ({fecha}). Revisa los avisos.", { rival: prev.event?.opponent || "—", fecha: when }));
    } catch (_) {
      setNote(t("No se pudo copiar la alineación."));
    } finally { setPrevBusy(false); }
  };
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(""), 7000); return () => clearTimeout(id); }, [note]);

  // Minutos de cada jugador (los mismos que en la convocatoria) y lesiones sin alta
  const minuteIds = [...slotIds.filter(Boolean), ...benchPlayers.map(p => p.id)];
  const minutes = useMemo(() => {
    const out = {};
    const ctxByTeam = new Map();
    for (const id of minuteIds) {
      const p = findPlayer(id);
      if (!p?.team_id) continue;
      if (!ctxByTeam.has(p.team_id)) ctxByTeam.set(p.team_id, { ...partCtx, events: partCtx.events.filter((e) => e.team_id === p.team_id) });
      const part = participationOf(p, ctxByTeam.get(p.team_id));
      out[p.id] = { pct: part.all.availMin ? part.all.pctAvail : null, level: playerLevel(part) };
    }
    return out;
  }, [partCtx, minuteIds.join(","), allPlayers.length]);
  const minutesOf = (id) => minutes[id] || null;
  const injuryOf = useMemo(() => {
    const m = new Map();
    for (const i of injuries) if (i.status !== "alta" && !m.has(i.player_id)) m.set(i.player_id, i);
    return m;
  }, [injuries]);
  const alerts = lineupAlerts({ slots, injuryOf, convocadoIds, bench: benchPlayers, minutesOf });
  // Mínimo de minutos por partido para cada convocado (14/11/2026): 25' en F11, la mitad del partido en F7
  const matchMin = matchMinimum(isF7 ? "f7" : "f11", totalMinutes(event?.match_duration || defaultDuration(isF7 ? "f7" : "f11", team)));
  const perfTeam = isPerformanceTeam(team);
  const alertSlots = new Set(alerts.filter(a => a.slot != null).map(a => a.slot));
  const dorsal = (p) => (p.jersey_number ? ` (${p.jersey_number})` : "");
  const alertText = (a) => {
    const name = `${shirtName(a.player)}${dorsal(a.player)}`;
    if (a.kind === "injured") return a.back ? t("{name} está lesionado y sigue en la alineación · vuelve el {fecha}", { name, fecha: format(new Date(a.back), "d MMM", { locale }) }) : t("{name} está lesionado y sigue en la alineación", { name });
    if (a.kind === "notCalled") return t("{name} está en la alineación pero no está convocado", { name });
    return t("{name} lleva el {pct} % de minutos: está en el banquillo", { name, pct: a.pct });
  };

  // Hoja del entrenador
  const [pdfBusy, setPdfBusy] = useState("");
  // Página 2 de la hoja («Durante el partido», para el banquillo): se recuerda en el navegador
  const [benchPage, setBenchPage] = useState(() => { try { return localStorage.getItem("rs_sheet_bench") !== "0"; } catch { return true; } });
  const toggleBenchPage = () => setBenchPage((v) => { try { localStorage.setItem("rs_sheet_bench", v ? "0" : "1"); } catch { /* sin almacenamiento */ } return !v; });
  const { data: sheetConv } = useQuery({
    queryKey: ["convocatoria", event?.id],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: event.id }).then((d) => d[0] || null),
    enabled: !!event?.id,
  });
  const sheetExtras = () => {
    const convIds = new Set(sheetConv?.player_ids || convocadoIds || []);
    const why = sheetConv?.absence_reasons || {};
    const absent = sheetConv ? players.filter((p) => p.status !== "baja" && !convIds.has(p.id))
      .sort((a, b) => (POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position)) || ((Number(a.jersey_number) || 99) - (Number(b.jersey_number) || 99)))
      .map((p) => ({ dorsal: p.jersey_number ?? "", name: `${p.first_name || ""} ${p.last_name || ""}`.trim(), reason: reasonText(why[p.id]) })) : [];
    const r = rivalSummary(report);
    const rival = r ? {
      pos: r.pos, pts: r.pts, gf: r.gf, gc: r.gc, form: r.form,
      awayText: event?.is_home === false ? (report?.home?.pj ? `En casa: ${report.home.g}V ${report.home.e}E ${report.home.p}D` : "") : (r.away ? `Fuera: ${r.away.split("-").map((n, i) => `${n}${"VED"[i]}`).join(" ")}` : ""),
      h2hText: r.h2h ? `Último: ${r.h2h.away ? `${event?.opponent} ${r.h2h.rival}-${r.h2h.our}` : `${r.h2h.our}-${r.h2h.rival}`}` : "",
      scorer: r.scorers?.[0] ? `Goleador: ${r.scorers[0].name} (${r.scorers[0].goals})` : "",
    } : null;
    const rivalNotes = pastRivalNotes.slice(0, 2).flatMap((e) => String(e.analysis_notes_rival || "").replace(/<\/(p|li|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").split("\n").map((x) => x.trim()).filter(Boolean));
    const sheetPieces = pieces.map((pc) => { const st = pieceSetup(pc); return { kind: setupLabel(st).split(" · ")[0], name: pc.name || "", signal: pc.signal || "" }; });
    const kitInfo = KITS[kit] ? `${String(KITS[kit].label).replace("ª", ".ª")} equipación${meta?.kit_color ? ` · ${meta.kit_color}` : ""}` : "";
    return { callupTime: sheetConv?.callup_time || "", kitText: kitInfo, absent, rival, rivalNotes, pieces: sheetPieces, benchPage, amateur: isPrimerEquipo(team) };
  };
  const makePdf = async (preview = false) => {
    setPdfBusy(preview ? "preview" : "pdf");
    const win = preview ? window.open("", "_blank") : null;
    try {
      const url = await downloadMatchSheetPDF({
        event, team, isF7, formation: formationLabel(validFormation), positions: currentPositions, slots, captainId: slotIds.includes(captain) ? captain : "",
        kit, gkKit, gkKitBench: gkKit2 || gkKit, kits: KITS, gkKits: GK_KITS, benchPlayers, planAttack, planDefense, planSet,
        ourLogoUrl: team?.logo_url || CLUB_LOGO_URL, opponentLogoUrl: event?.opponent_logo_url, preview, ...sheetExtras(),
      });
      if (win && url) win.location.href = url;
    } catch (_) {
      if (win) win.close();
      setNote(t("No se pudo generar la hoja."));
    } finally { setPdfBusy(""); }
  };

  // Botón «Hoja del entrenador» de la cabecera del partido: descarga la hoja en cuanto el plan está cargado
  const playersReady = allPlayers.length > 0 || players.length > 0;
  useEffect(() => {
    if (!sheetRequest || !ready || !playersReady || pdfBusy) return;
    onSheetHandled?.();
    makePdf(false);
  }, [sheetRequest, ready, playersReady, pdfBusy]);

  const filled = slotIds.filter(Boolean).length;
  const rs = rivalSummary(report);
  const fmtH2H = (h) => {
    const ours = team?.name || t("Nosotros"), opp = event?.opponent || "";
    return h.away ? `${opp} ${h.rival}-${h.our} ${ours}` : `${ours} ${h.our}-${h.rival} ${opp}`;
  };
  const setSummary = plainSummary(planSet, 90) || (pieces.length
    ? [t("{n} jugadas", { n: pieces.length }), pieces.map(p => p.signal).filter(Boolean).length ? `${t("señales")}: ${pieces.map(p => p.signal).filter(Boolean).join(", ")}` : ""].filter(Boolean).join(" · ")
    : "");
  const pieceText = (p) => {
    const st = pieceSetup(p);
    const k = st.kind === "otro" ? (st.other || t("Otra jugada")) : t(KIND_LABEL[st.kind] || "Córner");
    return `${k} · ${st.attack ? t("a favor") : t("en contra")}${p.signal ? ` · ${p.signal}` : ""}`;
  };

  // ── Piezas de la pantalla ──
  const onceCard = (
    <section className="rs2-card" style={{ padding: mobile ? 10 : 14 }} data-testid="prep-once">
      <CardTitle count={`${filled}/${nSlots}`} extra={
        <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
          <span style={{ fontSize: 11, color: RS.faint }} data-testid="prep-status">{status}</span>
          <button type="button" onClick={copyLastMatch} disabled={prevBusy} style={{ ...ghostBtn, background: RS.soft, border: "none", color: RS.granate }} data-testid="prep-last">
            <History className="w-3.5 h-3.5" /> {mobile ? t("Último partido") : t("Como el último partido")}
          </button>
          {!mobile && filled > 0 && <button type="button" onClick={() => setLineup([])} style={ghostBtn} data-testid="prep-clear"><Eraser className="w-3.5 h-3.5" /> {t("Vaciar")}</button>}
        </div>
      }>
        {isF7 ? t("Siete inicial") : t("Once inicial")}
      </CardTitle>
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
        <Select value={validFormation} onValueChange={handleFormationChange}>
          <SelectTrigger className={`${isF7 ? "w-52" : "w-32"} h-8 text-sm border-gray-200 font-bold`} data-testid="prep-formation"><SelectValue>{t(formationLabel(validFormation))}</SelectValue></SelectTrigger>
          <SelectContent>{formationOptions(isF7, validFormation).map(f => <SelectItem key={f} value={f}>{t(formationLabel(f))}</SelectItem>)}</SelectContent>
        </Select>
        <button type="button" onClick={() => setPositions(null)} title={t("Restablecer posiciones")} style={iconBtn}><RotateCcw className="w-3.5 h-3.5" /></button>
        {starterIds?.length > 0 && <button type="button" onClick={fillFromActa} title={t("Rellenar con los titulares del acta")} style={iconBtn}><Wand2 className="w-3.5 h-3.5" /></button>}
        {mobile && filled > 0 && <button type="button" onClick={() => setLineup([])} title={isF7 ? t("Vaciar la alineación") : t("Vaciar el once")} style={iconBtn}><Eraser className="w-3.5 h-3.5" /></button>}
      </div>
      {note && <div style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: RS.head, color: RS.ink2, marginBottom: 8 }} data-testid="prep-note">{note}</div>}
      {alerts.length > 0 && (
        <div className="flex flex-col" style={{ gap: 5, marginBottom: 10 }} data-testid="prep-alerts">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center" style={{ gap: 8, padding: "6px 10px", borderRadius: 8, fontSize: 12, background: a.kind === "lowMinutes" ? "#FFF7ED" : "#FEF2F2", color: a.kind === "lowMinutes" ? AMB : LOSS }} data-testid={`prep-alert-${a.kind}`}>
              <b>!</b><span className="flex-1 min-w-0">{alertText(a)}</span>
              {a.slot != null && <button type="button" onClick={() => setPickSlot(a.slot)} style={{ fontWeight: 700, color: RS.granate, textDecoration: "underline" }}>{t("Cambiar")}</button>}
            </div>
          ))}
        </div>
      )}
      <div className={mobile ? "flex flex-col" : "flex items-start"} style={{ gap: 14 }}>
        <div className="flex-1 min-w-0 w-full" style={{ maxWidth: mobile ? "none" : 470 }}>
          <div style={{ aspectRatio: "300/420" }}>
            <LineupField kit={kit} gkKit={gkKit} captainId={slotIds.includes(captain) ? captain : ""} slots={slots} positions={currentPositions}
              onPositionsChange={setPositions} onSlotClick={onSlotTap} selectedIdx={sel?.kind === "slot" ? sel.i : null} isF7={isF7}
              alertSlots={alertSlots} minutesOf={minutesOf} compact={mobile} />
          </div>
        </div>
        <div className="flex flex-col w-full" style={{ gap: 12, width: mobile ? "100%" : 210, flexShrink: 0 }}>
          <div data-testid="prep-bench">
            <p style={lab}>{t("Banquillo")} · {benchPlayers.length}</p>
            {benchPlayers.length === 0 ? (
              <p style={{ fontSize: 11.5, color: RS.faint }}>{(convocadoIds || []).length === 0 ? t("Aún no hay convocatoria.") : (isF7 ? t("Todos los convocados están en la alineación.") : t("Todos los convocados están en el once."))}</p>
            ) : (
              <div className={mobile ? "flex flex-wrap" : "flex flex-col items-start"} style={{ gap: 5 }}>
                {benchPlayers.map((p) => {
                  const on = sel?.kind === "bench" && sel.id === p.id;
                  const low = minutes[p.id]?.level === "alert";
                  return (
                    <button key={p.id} type="button" onClick={() => onBenchTap(p)} data-testid={`prep-bench-${p.id}`}
                      className="inline-flex items-center" style={{ gap: 6, padding: "3px 9px 3px 3px", borderRadius: 999, fontSize: 12, background: on ? "#FEF9C3" : "#fff", border: `1px solid ${on ? "#FACC15" : low ? "#FED7AA" : RS.line}`, maxWidth: "100%" }}>
                      <span className="rs2-display" style={{ width: 22, height: 22, borderRadius: 99, background: RS.soft, color: RS.granate, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.jersey_number || p.first_name?.[0]}</span>
                      <b className="truncate">{shirtName(p)}</b>
                      <span style={{ color: low ? AMB : RS.muted }}>{POS_LABEL[p.position] ? t(POS_LABEL[p.position]) : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {(convocadoIds || []).length > 0 && (
              <p style={{ fontSize: 10.5, color: RS.muted, marginTop: 6, lineHeight: 1.3 }} data-testid="prep-match-min">
                {perfTeam
                  ? t("Mínimo por partido: {m}’ a cada convocado (orientativo en esta etapa)", { m: matchMin })
                  : t("Mínimo por partido: {m}’ a cada convocado", { m: matchMin })}
              </p>
            )}
          </div>
          {filled > 0 && (
            <div>
              <p style={lab}>{t("Capitán")}</p>
              <Select value={slotIds.includes(captain) ? captain : "none"} onValueChange={v => setCaptain(v === "none" ? "" : v)}>
                <SelectTrigger className="w-full h-8 text-sm border-gray-200" data-testid="prep-captain"><SelectValue placeholder={t("Elegir…")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Sin capitán")}</SelectItem>
                  {slots.filter(Boolean).map(p => <SelectItem key={p.id} value={p.id}>{p.jersey_number ? `${p.jersey_number} · ` : ""}{shirtName(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={mobile ? "grid grid-cols-2" : "flex flex-col"} style={{ gap: 12 }}>
          <div data-testid="prep-kit">
            <p style={lab}>{t("Equipación")}</p>
            <div className="flex flex-wrap" style={{ gap: 4 }}>
              {Object.entries(KITS).map(([k, v]) => <KitButton key={k} kit={v} on={kit === k} label={t(v.label)} onClick={() => setKit(k)} testId={`prep-kit-${k}`} />)}
            </div>
            <p style={{ fontSize: 11, color: RS.muted, marginTop: 4 }}>{t("La misma que en la convocatoria y la Agenda")}</p>
          </div>
          <div>
            <p style={lab}>{t("Portero")}</p>
            <div className="flex flex-wrap" style={{ gap: 4 }}>
              {Object.entries(GK_KITS).map(([k, v]) => <KitButton key={k} kit={v} on={gkKit === k} label={t(k === "azul" ? "Azul" : v.label)} onClick={() => setGkKit(k)} testId={`prep-gk-${k}`} />)}
            </div>
            <p style={{ ...lab, marginTop: 8 }}>{t("Portero suplente")}</p>
            <div className="flex flex-wrap" style={{ gap: 4 }}>
              {Object.entries(GK_KITS).map(([k, v]) => <KitButton key={k} kit={v} on={(gkKit2 || gkKit) === k} label={t(k === "azul" ? "Azul" : v.label)} onClick={() => setGkKit2(k)} testId={`prep-gk2-${k}`} />)}
            </div>
          </div>
          </div>
          {!mobile && <p style={{ fontSize: 11, color: RS.muted, lineHeight: 1.4 }}>{t("Toca un jugador y luego otro (del campo o del banquillo) para intercambiarlos · toca un hueco vacío para elegir · arrastra para reposicionar")}</p>}
        </div>
      </div>
      {sel && selPlayer && (
        <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginTop: 10, fontSize: 12, background: "#FEFCE8", border: "1px solid #FDE047", borderRadius: 8, padding: "7px 10px" }}>
          <span style={{ color: RS.ink2 }}><b>{playerFullName(selPlayer)}</b> · {sel.kind === "bench" ? (isF7 ? t("toca un hueco de la alineación para meterlo") : t("toca un hueco del once para meterlo")) : t("toca otro jugador para intercambiarlo")}</span>
          <span className="flex items-center" style={{ gap: 6 }}>
            {sel.kind === "slot" && <button onClick={() => setPickSlot(sel.i)} style={ghostBtn}>{t("Elegir otro jugador")}</button>}
            {sel.kind === "slot" && <button onClick={() => { setSlot(sel.i, null); setSel(null); }} style={{ ...ghostBtn, color: LOSS, borderColor: "#FECACA" }}>{t("Vaciar hueco")}</button>}
            <button onClick={() => setSel(null)} style={ghostBtn}>{t("Cancelar")}</button>
          </span>
        </div>
      )}
    </section>
  );

  const sheetCard = mobile ? (
    <button type="button" onClick={() => makePdf(false)} disabled={!!pdfBusy} data-testid="prep-pdf"
      className="w-full inline-flex items-center justify-center" style={{ gap: 6, padding: "11px 14px", borderRadius: 10, background: RS.granate, color: "#fff", fontWeight: 700, fontSize: 14 }}>
      <FileDown className="w-4 h-4" /> {pdfBusy ? t("Generando…") : t("Hoja del entrenador (PDF)")}
    </button>
  ) : (
    <section className="rs2-card flex items-center" style={{ padding: 14, gap: 14 }} data-testid="prep-sheet">
      <div aria-hidden="true" style={{ width: 84, height: 110, border: `1px solid ${RS.line}`, borderRadius: 4, padding: 6, background: "#fff", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
        <div style={{ height: 5, background: RS.granate, borderRadius: 1, marginBottom: 5 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 34, height: 48, background: "#E6F2E7", borderRadius: 2 }} />
          <div style={{ flex: 1 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ height: 3, background: RS.line, borderRadius: 1, marginBottom: 4 }} />)}</div>
        </div>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 3, width: `${90 - i * 20}%`, background: RS.line, borderRadius: 1, marginTop: 5 }} />)}
      </div>
      <div className="min-w-0">
        <div style={{ borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 8, marginBottom: 4 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granateDark }}>{t("Hoja del entrenador")}</span></div>
        <p style={{ fontSize: 12.5, color: RS.muted, margin: "0 0 6px" }}>{t("Once, banquillo, rival y plan de partido en una hoja A4")}</p>
        <label className="flex items-center" style={{ gap: 6, fontSize: 12, color: RS.ink2, margin: "0 0 8px", cursor: "pointer" }}>
          <input type="checkbox" checked={benchPage} onChange={toggleBenchPage} data-testid="prep-bench-page" />
          {t("Añadir la hoja para el banquillo (minutos, cambios y tarjetas del rival)")}
        </label>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          <button type="button" onClick={() => makePdf(false)} disabled={!!pdfBusy} data-testid="prep-pdf"
            className="inline-flex items-center" style={{ gap: 6, padding: "7px 12px", borderRadius: 8, background: RS.granate, color: "#fff", fontWeight: 700, fontSize: 13 }}>
            <FileDown className="w-3.5 h-3.5" /> {pdfBusy === "pdf" ? t("Generando…") : t("Descargar PDF")}
          </button>
          <button type="button" onClick={() => makePdf(true)} disabled={!!pdfBusy} style={ghostBtn} data-testid="prep-preview">
            <Eye className="w-3.5 h-3.5" /> {pdfBusy === "preview" ? t("Generando…") : t("Vista previa")}
          </button>
        </div>
      </div>
    </section>
  );

  const rivalCard = event?.opponent ? (
    <section className="rs2-card" style={{ padding: mobile ? 10 : 14 }} data-testid="prep-rival">
      <CardTitle extra={
        <button type="button" onClick={() => setShowRival(v => !v)} style={{ fontSize: 12.5, fontWeight: 700, color: RS.granate, textDecoration: "underline" }} data-testid="prep-rival-more">
          {showRival ? t("Ocultar informe") : t("Informe completo ›")}
        </button>
      }>{t("Rival · {rival}", { rival: event.opponent })}</CardTitle>
      {rs ? (
        <>
          {!mobile && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, marginBottom: 10 }}>
              {[
                [t("{pos}º", { pos: rs.pos }), t("{pts} pts · {pj} PJ", { pts: rs.pts, pj: rs.pj })],
                [rs.gf, t("goles a favor")],
                [rs.gc, t("goles en contra")],
                [(event.is_home === false ? (report?.home?.pj ? `${report.home.g}-${report.home.e}-${report.home.p}` : "–") : (rs.away || "–")), event.is_home === false ? t("en casa") : t("fuera de casa")],
              ].map(([v, l], i) => (
                <div key={i} style={{ background: RS.head, borderRadius: 9, padding: "7px 9px" }}>
                  <div className="rs2-display" style={{ fontSize: 22, color: RS.granate, lineHeight: 1.1 }}>{v}</div>
                  <div style={{ fontSize: 11, color: RS.muted }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center flex-wrap" style={{ gap: 6, fontSize: 12, color: RS.ink2 }}>
            {mobile && <span style={{ fontWeight: 700 }}>{t("{pos}º · {pts} pts", { pos: rs.pos, pts: rs.pts })}</span>}
            {rs.form.length > 0 && <>{!mobile && <span>{t("Racha:")}</span>}<FormChips form={rs.form} size={17} /></>}
            {rs.h2h && <span style={{ marginLeft: "auto", color: RS.muted }}>{t("Último:")} {fmtH2H(rs.h2h)}</span>}
          </div>
          {!mobile && rs.scorers.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={lab}>{t("Goleadores")}</p>
              {rs.scorers.map((s) => (
                <div key={s.name} className="flex" style={{ fontSize: 12, padding: "3px 0", borderTop: `1px solid ${RS.lineSoft}` }}>
                  <b className="flex-1 min-w-0 truncate">{s.name}</b><span>{s.goals} ⚽</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 12, color: RS.faint }}>{rivalOn ? t("Sin datos de la FCF de este rival.") : t("Puedes escribir tu análisis del rival en el informe.")}</p>
      )}
      {pastRivalNotes.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 9, background: "#FFF7ED", border: "1px solid #FED7AA" }} data-testid="prep-rival-notes">
          <p style={{ ...lab, color: "#9A3412" }}>{t("Lo que apuntamos de ellos")}</p>
          {pastRivalNotes.slice(0, 2).map((e) => (
            <div key={e.id} style={{ fontSize: 12, color: RS.ink, padding: "3px 0" }}>
              <b style={{ fontSize: 11, color: "#9A3412" }}>{format(new Date(e.date), "d MMM yyyy", { locale })}{e.score_home != null && e.score_away != null ? ` · ${e.score_home}-${e.score_away}` : ""}</b>
              <p style={{ whiteSpace: "pre-line", margin: "2px 0 0" }}>{e.analysis_notes_rival}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  ) : null;

  const planCard = (
    <section className="rs2-card" style={{ padding: mobile ? 10 : 14 }} data-testid="prep-plan">
      <CardTitle>{t("Plan de partido")}</CardTitle>
      <div className="flex flex-col" style={{ gap: 6 }}>
        <PlanBlock id="attack" icon="⚔️" title={t("Ataque")} open={openBlock.attack} onToggle={() => setOpenBlock(o => ({ ...o, attack: !o.attack }))}
          hint={t("Salida de balón, progresión, zonas de ataque, movimientos clave, finalización…")} value={planAttack} onChange={setPlanAttack} summary={plainSummary(planAttack, 90)}
          placeholder={t("Ej: Salida 3+1 con el mediocentro, progresar por banda derecha, extremos cerrando para el desmarque del 9…")} />
        <PlanBlock id="defense" icon="🛡️" title={t("Defensa")} open={openBlock.defense} onToggle={() => setOpenBlock(o => ({ ...o, defense: !o.defense }))}
          hint={t("Bloque, altura de presión, referencias de marcaje, transiciones defensivas…")} value={planDefense} onChange={setPlanDefense} summary={plainSummary(planDefense, 90)}
          placeholder={t("Ej: Bloque medio 4-4-2, presión tras pase atrás, vigilar al 10 rival en el rechace, repliegue rápido…")} />
        <PlanBlock id="set" icon="⚑" title={t("Balón parado")} open={openBlock.set} onToggle={() => setOpenBlock(o => ({ ...o, set: !o.set }))} minHeight={70}
          hint={t("Córners, faltas, saques de banda: referencias y aspectos a tener en cuenta.")} value={planSet} onChange={setPlanSet} summary={setSummary}
          placeholder={t("Ej: Córner a favor: 2 al primer palo; en contra: marcaje mixto, 9 rival vigilado…")} />
      </div>
    </section>
  );

  const abpStrip = (
    <section className="rs2-card flex items-center flex-wrap" style={{ padding: mobile ? 10 : "10px 14px", gap: 8 }} data-testid="prep-abp">
      <div style={{ borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 8 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granateDark }}>{t("Balón parado")}</span></div>
      <div className="flex flex-wrap items-center flex-1 min-w-0" style={{ gap: 6 }}>
        {pieces.length === 0 && <span style={{ fontSize: 12, color: RS.faint }}>{t("Aún no hay jugadas para este partido.")}</span>}
        {pieces.slice(0, mobile ? 3 : 6).map((p) => (
          <button key={p.id} type="button" onClick={() => setShowAbp(true)} className="inline-flex items-center" style={{ gap: 6, padding: "4px 10px", borderRadius: 999, border: `1px solid ${RS.line}`, background: "#fff", fontSize: 12, maxWidth: 260 }}>
            <b className="truncate">{p.name}</b><span className="truncate" style={{ color: RS.muted }}>{pieceText(p)}</span>
          </button>
        ))}
        {pieces.length > (mobile ? 3 : 6) && <span style={{ fontSize: 12, color: RS.muted }}>+{pieces.length - (mobile ? 3 : 6)}</span>}
      </div>
      <button type="button" onClick={() => setShowAbp(v => !v)} data-testid="prep-abp-toggle"
        className="inline-flex items-center" style={{ gap: 5, padding: "6px 12px", borderRadius: 8, background: RS.soft, color: RS.granate, fontWeight: 700, fontSize: 12.5, marginLeft: "auto" }}>
        {showAbp ? <><X className="w-3.5 h-3.5" /> {t("Cerrar editor")}</> : t("Abrir editor de jugadas ›")}
      </button>
    </section>
  );

  const rivalFull = showRival && (
    <div className="space-y-3" id="rival-full" data-testid="prep-rival-full">
      <RivalReport eventId={event?.id} enabled={rivalOn} />
      <section className="rs2-card" style={{ padding: 14 }}>
        <CardTitle>{t("🔍 Análisis del rival{v}", { v: event?.opponent ? ` · ${event.opponent}` : "" })}</CardTitle>
        <div className="grid md:grid-cols-3 gap-3">
          {[["strengths", msg("Puntos fuertes"), msg("Qué hacen bien, cómo atacan…")], ["weaknesses", msg("Puntos débiles"), msg("Dónde les podemos hacer daño…")], ["keys", msg("Jugadores clave"), msg("Dorsal, perfil, cómo frenarlo…")]].map(([k, label, ph]) => (
            <div key={k} className="space-y-1">
              <p style={lab}>{t(label)}</p>
              <RichTextBox value={rival[k]} onChange={v => setRival(r => ({ ...r, [k]: v }))} placeholder={t(ph)} minHeight={110} />
            </div>
          ))}
        </div>
        <div className="space-y-1" style={{ marginTop: 10 }}>
          <p style={lab}>{t("Comentarios")}</p>
          <RichTextBox value={rival.notes} onChange={v => setRival(r => ({ ...r, notes: v }))} placeholder={t("Sistema habitual, estilo, balón parado, resultados recientes…")} minHeight={70} />
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-4">
      {mobile ? (
        <div className="space-y-3">
          {onceCard}
          {rivalCard}
          {rivalFull}
          {planCard}
          {sheetCard}
        </div>
      ) : (
        <>
          <div className="grid items-start" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(330px,420px)", gap: 16 }}>
            {onceCard}
            <div className="space-y-4">
              {sheetCard}
              {rivalCard}
              {planCard}
            </div>
          </div>
          {rivalFull}
        </>
      )}
      {abpStrip}
      {showAbp && (
        <SetPieceBoard allPlayers={allPlayers} pieces={pieces} onChange={setPieces} shirtKit={{ field: kit, gk: gkKit }} teamId={team?.id || event?.team_id} teamName={team?.name} eventId={event?.id} eventDate={event?.date}
          candidates={[...new Set([...(convocadoIds || [])])].map(findPlayer).filter(Boolean).sort((a, b) => ((Number(a.jersey_number) || 999) - (Number(b.jersey_number) || 999)))} />
      )}
      <PlayerPicker
        open={pickSlot !== null}
        onClose={() => setPickSlot(null)}
        teamPlayers={teamPlayers}
        taken={taken}
        current={pickSlot !== null ? slots[pickSlot] : null}
        onPick={(p) => { setSlot(pickSlot, p.id); setSel(null); setPickSlot(null); }}
        onClear={() => { setSlot(pickSlot, null); setSel(null); setPickSlot(null); }}
      />
    </div>
  );
}
