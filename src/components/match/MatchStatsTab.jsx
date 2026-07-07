import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, Star, Users, Plus, Trash2 } from "lucide-react";
import MatchScoreboard from "./MatchScoreboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const POSITION_LABELS = {
  portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB",
  mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT",
};

const GOAL_TYPES = {
  dentro_area: "Dentro del área",
  fuera_area: "Fuera del área",
  centro_lateral: "Centro lateral",
  contraataque: "Contraataque",
  perdida_salida: "Pérdida en salida",
  ataque_posicional: "Ataque posicional",
  saque_centro: "Saque de centro",
  saque_porteria: "Saque de portería",
  balon_parado: "Balón parado (falta)",
  penalti: "Penalti",
  esquina: "Córner",
  gol_propio: "Gol en propia",
};

const NO_CONVOC_REASONS = {
  lesion: "Lesión", decision_tecnica: "Dec. técnica", estudios: "Estudios",
  viaje: "Viaje", familiar: "Familiar", sancion: "Sanción", otro: "Otro",
};


function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4].map(star => (
        <button key={star} type="button"
          onClick={() => onChange(star === value ? null : star)}
          onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
          className="p-0.5">
          <Star className={`w-3.5 h-3.5 ${(hover||value)>=star?"fill-yellow-400 text-yellow-400":"text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function NumCell({ value, onChange, max=99 }) {
  const [local, setLocal] = useState(value ?? 0);
  useEffect(() => setLocal(value ?? 0), [value]);
  return (
    <input type="number" min={0} max={max} value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => onChange(parseInt(local)||0)}
      className="w-12 h-7 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white" />
  );
}

function CardCell({ value, color, onChange }) {
  const active = (value||0)>0;
  return (
    <button onClick={() => onChange(active?0:1)}
      className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${active?"text-white border-transparent":"bg-white border-gray-200 text-gray-300 hover:border-gray-400"}`}
      style={active?{background:color}:{}}>
      {active?"1":"—"}
    </button>
  );
}

function NotesCell({ value, onSave }) {
  const [local, setLocal] = useState(value||"");
  useEffect(() => setLocal(value||""), [value]);
  return (
    <input type="text" value={local} onChange={e=>setLocal(e.target.value)} onBlur={()=>onSave(local)}
      placeholder="Obs…"
      className="w-full h-7 text-xs border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white" />
  );
}

// Franja de 15' analysis
function GoalTimeline({ goalEvents, totalMinutes }) {
  const slots = Math.ceil(totalMinutes / 15);
  const ranges = Array.from({length: slots}, (_,i) => ({
    from: i*15+1, to: Math.min((i+1)*15, totalMinutes), label: `${i*15+1}'–${Math.min((i+1)*15, totalMinutes)}'`
  }));

  const homeGoals = goalEvents.filter(g=>g.team==="home");
  const awayGoals = goalEvents.filter(g=>g.team==="away");

  const countInRange = (goals, from, to) => goals.filter(g=>g.minute>=from && g.minute<=to).length;
  const maxCount = Math.max(1, ...ranges.map(r=>Math.max(countInRange(homeGoals,r.from,r.to), countInRange(awayGoals,r.from,r.to))));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Análisis por franja de 15'</p>
      <div className="flex gap-3 text-xs text-gray-500 mb-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{background:"var(--granate)"}}></span> Nuestro equipo</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-400 inline-block"></span> {" Rival"}</span>
      </div>
      <div className="grid gap-2" style={{gridTemplateColumns:`repeat(${slots}, minmax(0,1fr))`}}>
        {ranges.map(r => {
          const h = countInRange(homeGoals, r.from, r.to);
          const a = countInRange(awayGoals, r.from, r.to);
          return (
            <div key={r.label} className="text-center">
              <div className="flex gap-0.5 justify-center items-end h-12 mb-1">
                <div className="w-4 rounded-t transition-all" style={{background:"var(--granate)", height:`${Math.max(4,h/maxCount*100)}%`, minHeight: h>0?'8px':'4px', opacity: h>0?1:0.15}}></div>
                <div className="w-4 rounded-t bg-gray-400 transition-all" style={{height:`${Math.max(4,a/maxCount*100)}%`, minHeight: a>0?'8px':'4px', opacity: a>0?1:0.15}}></div>
              </div>
              <div className="flex justify-center gap-1 text-[10px] font-bold mb-0.5">
                <span style={{color:"var(--granate)"}}>{h>0?h:""}</span>
                <span className="text-gray-400">{a>0?a:""}</span>
              </div>
              <p className="text-[9px] text-gray-400">{r.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchStatsTab({ eventId, teamId, players, event, matchData, setMatchData, onSave, team }) {
  const queryClient = useQueryClient();
  const [showConvocDialog, setShowConvocDialog] = useState(false);
  const [showNotifDialog, setShowNotifDialog] = useState(false);
  const [convocNotes, setConvocNotes] = useState("");
  const [pendingConvocIds, setPendingConvocIds] = useState([]);
  const [noConvocReasons, setNoConvocReasons] = useState({});
  const [newGoal, setNewGoal] = useState({ team: "home", minute: "", player_id: "", assist_player_id: "", goal_type: "" });

  const { data: convocation } = useQuery({
    queryKey: ["convocation", eventId],
    queryFn: () => base44.entities.Convocatoria.filter({ event_id: eventId }).then(d => d[0]||null),
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
      queryClient.invalidateQueries({queryKey:["convocation",eventId]});
      setShowConvocDialog(false);
    },
  });

  const upsertStatsMutation = useMutation({
    mutationFn: async ({ playerId, field, value }) => {
      const existing = matchStats.find(s=>s.player_id===playerId);
      const base = existing || { player_id: playerId, event_id: eventId, date: event?.date?.split?.("T")[0]||new Date().toISOString().split("T")[0] };
      const data = { ...base, [field]: value };
      return existing ? base44.entities.MatchStats.update(existing.id, data) : base44.entities.MatchStats.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({queryKey:["matchStats",eventId]}),
  });

  const sendNotifMutation = useMutation({
    mutationFn: async () => {
      const convocPlayers = players.filter(p=>(convocation?.player_ids||[]).includes(p.id));
      await Promise.all(convocPlayers.filter(p=>p.email).map(p=>
        base44.integrations.Core.SendEmail({
          to: p.email,
          subject: `Convocatoria: ${event?.title}`,
          body: `Hola ${p.first_name},\n\nHas sido convocado para el partido:\n\n${event?.title}\nFecha: ${event?.date?format(new Date(event.date),"dd 'de' MMMM 'de' yyyy",{locale:es}):""}\nHora: ${event?.date?format(new Date(event.date),"HH:mm"):""}${event?.location?`\nLugar: ${event.location}`:""}${event?.opponent?`\nRival: ${event.opponent}`:""}\n${convocNotes?`\nNotas: ${convocNotes}`:""}\n\nSaludos,\nEl cuerpo técnico`,
        })
      ));
      if (convocation) await base44.entities.Convocatoria.update(convocation.id,{notified:true,notified_at:new Date().toISOString()});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:["convocation",eventId]});
      setShowNotifDialog(false);
    },
  });

  // Derived goal counts from goal_events
  // "home" = nuestro equipo, "away" = rival (independiente de local/visitante)
  const goalEvents = event?.goal_events || [];
  const ourGoalsFromEvents = goalEvents.filter(g=>g.team==="home").length;
  const rivalGoalsFromEvents = goalEvents.filter(g=>g.team==="away").length;

  const homeGoals = goalEvents.length > 0 ? ourGoalsFromEvents : (matchData.team_goals ?? event?.score_home ?? 0);
  const awayGoals = goalEvents.length > 0 ? rivalGoalsFromEvents : (matchData.opponent_goals ?? event?.score_away ?? 0);
  const diff = homeGoals - awayGoals;
  const resultLabel = diff>0?"VICTORIA":diff<0?"DERROTA":"EMPATE";
  const resultColor = diff>0?"text-green-400":diff<0?"text-red-400":"text-yellow-400";

  const isConvocado = (pid) => (convocation?.player_ids||[]).includes(pid);
  const getStats = (pid) => matchStats.find(s=>s.player_id===pid);
  const handleStat = (playerId, field, value) => upsertStatsMutation.mutate({playerId,field,value});

  const handleConvocToggle = (pid) => {
    const wasConvocado = isConvocado(pid);
    const newIds = wasConvocado
      ? (convocation?.player_ids||[]).filter(id=>id!==pid)
      : [...(convocation?.player_ids||[]),pid];
    saveConvocMutation.mutate({event_id:eventId,team_id:teamId,player_ids:newIds,notes:convocNotes});
  };

  const handleSaveConvocDialog = () => {
    saveConvocMutation.mutate({event_id:eventId,team_id:teamId,player_ids:pendingConvocIds,notes:convocNotes});
  };

  const addGoalEvent = () => {
    if (!newGoal.minute) return;
    const events = [...goalEvents, {
      id: Date.now().toString(),
      team: newGoal.team,
      minute: parseInt(newGoal.minute),
      player_id: newGoal.player_id||null,
      assist_player_id: newGoal.assist_player_id||null,
      goal_type: newGoal.goal_type||null,
    }].sort((a,b)=>a.minute-b.minute);
    const newHome = events.filter(g=>g.team==="home").length;
    const newAway = events.filter(g=>g.team==="away").length;
    base44.entities.Event.update(eventId,{
      goal_events: events,
      score_home: newHome,
      score_away: newAway,
    }).then(()=>{
      queryClient.invalidateQueries({queryKey:["event",eventId]});
      setMatchData(prev=>({...prev, team_goals: newHome, opponent_goals: newAway}));
    });
    setNewGoal({team:"home",minute:"",player_id:"",assist_player_id:"",goal_type:""});
  };

  const removeGoalEvent = (id) => {
    const events = goalEvents.filter(g=>g.id!==id);
    const newHome = events.filter(g=>g.team==="home").length;
    const newAway = events.filter(g=>g.team==="away").length;
    base44.entities.Event.update(eventId,{
      goal_events: events,
      score_home: newHome,
      score_away: newAway,
    }).then(()=>{
      queryClient.invalidateQueries({queryKey:["event",eventId]});
      setMatchData(prev=>({...prev, team_goals: newHome, opponent_goals: newAway}));
    });
  };

  const POSITION_ORDER = ["portero","central","lateral","libre","mediocentro","interior","extremo","delantero_centro"];
  const sortByPosition = (a, b) => {
    const ai = POSITION_ORDER.indexOf(a.position ?? "");
    const bi = POSITION_ORDER.indexOf(b.position ?? "");
    const posSort = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (posSort !== 0) return posSort;
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
  };

  const activePlayers = players.filter(p=>p.status!=="baja").sort((a,b)=>{
    const aConv = isConvocado(a.id);
    const bConv = isConvocado(b.id);
    if (aConv && !bConv) return -1;
    if (!aConv && bConv) return 1;
    if (aConv && bConv) return sortByPosition(a, b);
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
  });
  const convocadosCount = activePlayers.filter(p=>isConvocado(p.id)).length;
  const titularesCount = activePlayers.filter(p=>getStats(p.id)?.starter===true).length;
  const suplentesCount = activePlayers.filter(p=>{const s=getStats(p.id);return s&&s.starter===false&&(s.minutes_played||0)>0;}).length;

  const totalMinutes = parseInt(matchData.match_duration||event?.match_duration||"90")||90;
  const convocadoPlayers = activePlayers.filter(p=>isConvocado(p.id));

  return (
    <div className="space-y-6">
      {/* ── MARCADOR ── */}
      <MatchScoreboard
        event={event}
        team={team}
        homeGoals={homeGoals}
        awayGoals={awayGoals}
        resultLabel={resultLabel}
        resultColor={resultColor}
        eventId={eventId}
        matchData={matchData}
        setMatchData={setMatchData}
      />

      {/* ── EVENTOS DE GOL ── */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">⚽ Eventos de gol</p>

        {/* Añadir gol */}
        <div className="flex flex-wrap gap-2 items-end bg-gray-50 rounded p-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Equipo</p>
            <Select value={newGoal.team} onValueChange={v=>setNewGoal(g=>({...g,team:v}))}>
              <SelectTrigger className="h-8 w-36 text-xs border-gray-200 bg-white">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Nuestro equipo</SelectItem>
                <SelectItem value="away">{event?.opponent||"Rival"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Minuto</p>
            <input type="number" min={1} max={totalMinutes} value={newGoal.minute} onChange={e=>setNewGoal(g=>({...g,minute:e.target.value}))}
              placeholder="Min…"
              className="h-8 w-20 text-center text-sm border border-gray-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"/>
          </div>
          {newGoal.team==="home" && (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-1">Goleador</p>
                <Select value={newGoal.player_id} onValueChange={v=>setNewGoal(g=>({...g,player_id:v}))}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200 bg-white"><SelectValue placeholder="Jugador…"/></SelectTrigger>
                  <SelectContent>
                    {convocadoPlayers.map(p=><SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Asistencia</p>
                <Select value={newGoal.assist_player_id} onValueChange={v=>setNewGoal(g=>({...g,assist_player_id:v}))}>
                  <SelectTrigger className="h-8 w-40 text-xs border-gray-200 bg-white"><SelectValue placeholder="Asistente…"/></SelectTrigger>
                  <SelectContent>
                    {convocadoPlayers.map(p=><SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Tipo de gol</p>
            <Select value={newGoal.goal_type} onValueChange={v=>setNewGoal(g=>({...g,goal_type:v}))}>
              <SelectTrigger className="h-8 w-44 text-xs border-gray-200 bg-white"><SelectValue placeholder="Tipo…"/></SelectTrigger>
              <SelectContent>
                {Object.entries(GOAL_TYPES).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={addGoalEvent} disabled={!newGoal.minute} className="text-white h-8" style={{background:"var(--granate)"}}>
            <Plus className="w-3.5 h-3.5 mr-1"/>Añadir gol
          </Button>
        </div>

        {/* Lista de goles */}
        {goalEvents.length>0 ? (
          <div className="space-y-1">
            {[...goalEvents].sort((a,b)=>a.minute-b.minute).map(g=>{
              const scorer = players.find(p=>p.id===g.player_id);
              const assister = players.find(p=>p.id===g.assist_player_id);
              return (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded text-sm border border-gray-100">
                  <span className="font-bold text-gray-500 w-10 shrink-0">{g.minute}'</span>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0`} style={{background:g.team==="home"?"var(--granate)":"#6b7280"}}></span>
                  <span className="flex-1 text-gray-700">
                    {g.team==="home"?(
                      <>
                        <span className="font-semibold">{scorer?`${scorer.first_name} ${scorer.last_name}`:"Gol propio"}</span>
                        {assister&&<span className="text-gray-400 text-xs"> (asist. {assister.first_name} {assister.last_name})</span>}
                      </>
                    ):(
                      <span className="text-gray-500 italic">{event?.opponent||"Rival"}</span>
                    )}
                    {g.goal_type&&<span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{GOAL_TYPES[g.goal_type]||g.goal_type}</span>}
                  </span>
                  <button onClick={()=>removeGoalEvent(g.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">Sin goles registrados</p>
        )}

        {/* Análisis por franja */}
        {goalEvents.length>0 && (
          <GoalTimeline goalEvents={goalEvents} totalMinutes={totalMinutes}/>
        )}
      </div>

      {/* ── TARJETAS RIVAL ── */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">🟨🟥 Tarjetas del rival</p>
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-3">
            <span className="w-5 h-7 rounded bg-yellow-400 inline-block shadow-sm"></span>
            <span className="text-sm text-gray-600 font-medium">Amarillas</span>
            <input type="number" min={0} max={99}
              value={matchData.opponent_yellow_cards ?? event?.opponent_yellow_cards ?? 0}
              onChange={e => setMatchData({...matchData, opponent_yellow_cards: parseInt(e.target.value)||0})}
              className="w-14 h-8 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"/>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              <span className="w-4 h-6 rounded bg-yellow-400 inline-block shadow-sm"></span>
              <span className="w-4 h-6 rounded bg-yellow-400 inline-block shadow-sm"></span>
            </div>
            <span className="text-sm text-gray-600 font-medium">Dobles amarillas</span>
            <input type="number" min={0} max={99}
              value={matchData.opponent_double_yellow_cards ?? event?.opponent_double_yellow_cards ?? 0}
              onChange={e => setMatchData({...matchData, opponent_double_yellow_cards: parseInt(e.target.value)||0})}
              className="w-14 h-8 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"/>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-5 h-7 rounded bg-red-600 inline-block shadow-sm"></span>
            <span className="text-sm text-gray-600 font-medium">Rojas directas</span>
            <input type="number" min={0} max={99}
              value={matchData.opponent_red_cards ?? event?.opponent_red_cards ?? 0}
              onChange={e => setMatchData({...matchData, opponent_red_cards: parseInt(e.target.value)||0})}
              className="w-14 h-8 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"/>
          </div>
        </div>
      </div>

      {/* ── NOTAS ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Notas del partido</p>
        <Textarea value={matchData.notes||""} onChange={e=>setMatchData({...matchData,notes:e.target.value})}
          rows={3} className="border-gray-200" placeholder="Observaciones, incidencias…"/>
      </div>

      {/* ── JUGADORES ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold" style={{color:"var(--granate)"}}>{convocadosCount} convocados</span>
            <span className="text-gray-500">{activePlayers.length-convocadosCount} no convocados</span>
            <span className="text-gray-500">{titularesCount} titulares · {suplentesCount} suplentes</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={()=>{setPendingConvocIds(convocation?.player_ids||[]);setShowConvocDialog(true);}} className="text-xs border-gray-200">
              <Users className="w-3.5 h-3.5 mr-1"/>Gestionar convocatoria
            </Button>
            <Button size="sm" onClick={onSave} className="text-white text-xs" style={{background:"var(--granate)"}}>
              Guardar partido
            </Button>
          </div>
        </div>

        {/* Tabla jugadores */}
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wide">
                <th className="text-left px-2 py-2 font-semibold min-w-[130px]">Jugador</th>
                <th className="px-1.5 py-2 font-semibold">Conv.</th>
                <th className="px-1.5 py-2 font-semibold whitespace-nowrap">Particip.</th>
                <th className="px-1.5 py-2 font-semibold">Min</th>
                <th className="px-1.5 py-2 font-semibold">Gol</th>
                <th className="px-1.5 py-2 font-semibold">Asi</th>
                <th className="px-1.5 py-2 font-semibold">🟨</th>
                <th className="px-1.5 py-2 font-semibold">🟥</th>
                <th className="px-1.5 py-2 font-semibold">Val.</th>
                <th className="px-1.5 py-2 font-semibold text-left min-w-[110px]">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {activePlayers.map(player=>{
                const convocado = isConvocado(player.id);
                const s = getStats(player.id);
                const isPortero = player.position==="portero";
                return (
                  <tr key={player.id} className={`border-b border-gray-100 last:border-0 ${convocado?"bg-white":"bg-gray-50/50"} hover:bg-gray-50 transition-colors`}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{background:convocado?"var(--granate)":"#d1d5db"}}>
                          {player.first_name?.[0]}{player.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium leading-tight truncate ${convocado?"text-gray-900":"text-gray-400"}`}>{player.last_name}, {player.first_name}</p>
                          <p className="text-[9px] text-gray-400">{POSITION_LABELS[player.position]||"—"}{player.jersey_number?` #${player.jersey_number}`:""}{player.status==="lesionado"?" ⚠️":""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      <button onClick={()=>handleConvocToggle(player.id)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${convocado?"text-white border-transparent":"bg-white border-gray-300 text-gray-400 hover:border-gray-400"}`}
                        style={convocado?{background:"var(--granate)"}:{}}>
                        {convocado?"✓":"—"}
                      </button>
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      {convocado?(
                        <div className="flex gap-0.5 justify-center">
                          {[{label:"TIT",val:true},{label:"SUP",val:false}].map(opt=>(
                            <button key={String(opt.val)} onClick={()=>handleStat(player.id,"starter",opt.val)}
                              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors ${s?.starter===opt.val?"text-white border-transparent":"bg-white border-gray-200 text-gray-400 hover:bg-gray-100"}`}
                              style={s?.starter===opt.val?{background: opt.val===true ? "var(--granate)" : "var(--naranja)"}:{}}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ):(
                        <Select value={noConvocReasons[player.id]||""} onValueChange={v=>setNoConvocReasons(prev=>({...prev,[player.id]:v}))}>
                          <SelectTrigger className="h-6 w-24 text-[10px] border-gray-200 bg-white text-gray-400"><SelectValue placeholder="Motivo…"/></SelectTrigger>
                          <SelectContent>{Object.entries(NO_CONVOC_REASONS).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-center">{convocado&&<NumCell value={s?.minutes_played} onChange={v=>handleStat(player.id,"minutes_played",v)} max={120}/>}</td>
                    <td className="px-1.5 py-1.5 text-center">{convocado&&<NumCell value={isPortero?s?.goals_conceded:s?.goals} onChange={v=>handleStat(player.id,isPortero?"goals_conceded":"goals",v)}/>}</td>
                    <td className="px-1.5 py-1.5 text-center">{convocado&&!isPortero&&<NumCell value={s?.assists} onChange={v=>handleStat(player.id,"assists",v)}/>}</td>
                    <td className="px-1.5 py-1.5 text-center">
                      {convocado&&(
                        <div className="flex gap-0.5 justify-center">
                          <CardCell value={s?.yellow_cards} color="#ca8a04" onChange={v=>handleStat(player.id,"yellow_cards",v)}/>
                          <CardCell value={s?.double_yellow_card} color="#b45309" onChange={v=>handleStat(player.id,"double_yellow_card",v)}/>
                        </div>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-center">{convocado&&<CardCell value={s?.red_cards} color="#dc2626" onChange={v=>handleStat(player.id,"red_cards",v)}/>}</td>
                    <td className="px-1.5 py-1.5 text-center">{convocado&&<StarRating value={s?.rating} onChange={v=>handleStat(player.id,"rating",v)}/>}</td>
                    <td className="px-1.5 py-1.5">{convocado&&<NotesCell value={s?.notes} onSave={v=>handleStat(player.id,"notes",v)}/>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {activePlayers.length===0&&<p className="text-sm text-gray-400 text-center py-8">No hay jugadores en este equipo</p>}
        </div>
        <p className="text-xs text-gray-400">Gol = Goles (portero: goles encajados) · Asi = Asistencias · 🟨 = Amarilla / Doble amarilla · 🟥 = Roja directa</p>
      </div>

      {/* Convoc dialog */}
      <Dialog open={showConvocDialog} onOpenChange={setShowConvocDialog}>
        <DialogContent className="bg-white border-gray-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Seleccionar convocados</DialogTitle>
            <DialogDescription className="text-gray-500">Elige los jugadores convocados para este partido</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={()=>setPendingConvocIds(activePlayers.map(p=>p.id))} className="text-xs text-blue-600 hover:underline">Todos</button>
              <span className="text-gray-300">|</span>
              <button onClick={()=>setPendingConvocIds([])} className="text-xs text-gray-500 hover:underline">Ninguno</button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {activePlayers.map(player=>(
                <label key={player.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                  <Checkbox checked={pendingConvocIds.includes(player.id)} onCheckedChange={()=>setPendingConvocIds(prev=>prev.includes(player.id)?prev.filter(id=>id!==player.id):[...prev,player.id])}/>
                  <span className="text-sm font-medium text-gray-900 flex-1">{player.first_name} {player.last_name}</span>
                  <span className="text-xs text-gray-400">{POSITION_LABELS[player.position]||"—"}{player.jersey_number?` · #${player.jersey_number}`:""}</span>
                  {player.status==="lesionado"&&<span className="text-xs text-red-500">Lesionado</span>}
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Notas para los convocados</p>
              <Textarea value={convocNotes} onChange={e=>setConvocNotes(e.target.value)} placeholder="Instrucciones, avisos…" className="border-gray-200" rows={3}/>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100 flex-wrap">
              <Button variant="outline" onClick={()=>setShowConvocDialog(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSaveConvocDialog} className="flex-1 text-white" style={{background:"var(--granate)"}}>
                Guardar ({pendingConvocIds.length} convocados)
              </Button>
              {convocadosCount>0&&(
                <Button onClick={()=>{setShowConvocDialog(false);setShowNotifDialog(true);}} disabled={convocation?.notified} variant="outline" className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50">
                  <Send className="w-3.5 h-3.5 mr-1"/>{convocation?.notified?"Ya notificado":"Notificar convocados"}
                </Button>
              )}
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
            <Button variant="outline" onClick={()=>setShowNotifDialog(false)} className="flex-1">Cancelar</Button>
            <Button onClick={()=>sendNotifMutation.mutate()} disabled={sendNotifMutation.isPending} className="flex-1 text-white" style={{background:"var(--granate)"}}>
              {sendNotifMutation.isPending?"Enviando…":"Enviar notificaciones"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}