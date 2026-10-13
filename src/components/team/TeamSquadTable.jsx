import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, ChevronUp, ChevronDown, ChevronsUpDown, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { birthYearOf } from "@/lib/birthYear";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];

const matchMinutes = (ev) => {
  const d = ev.match_duration;
  if (!d) return 90;
  if (d === "4x15") return 60;
  if (d === "4x12") return 48;
  return parseInt(d) || 90;
};

const pctColor = (p) => (p == null ? "#9ca3af" : p >= 80 ? "#16a34a" : p >= 60 ? "#ea580c" : "#dc2626");

function Th({ label, k, sort, setSort, className = "" }) {
  const active = sort.key === k;
  return (
    <th className={`px-2 py-2 font-bold whitespace-nowrap cursor-pointer hover:text-gray-700 select-none ${className}`} onClick={() => setSort({ key: k, dir: active && sort.dir === "asc" ? "desc" : "asc" })}>
      {label}
      {active ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : <ChevronsUpDown className="w-3 h-3 inline ml-0.5 opacity-30" />}
    </th>
  );
}

// Tabla única de plantilla: datos del jugador + estadísticas de partidos + entrenos + lesiones.
export default function TeamSquadTable({ teamId, onAddPlayer }) {
  const [sort, setSort] = useState({ key: "pos", dir: "asc" });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allStats = [] } = useQuery({ queryKey: ["matchstats_all"], queryFn: () => base44.entities.MatchStats.list() });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance_all"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: injuries = [] } = useQuery({ queryKey: ["injuries_all"], queryFn: () => base44.entities.Injury.list() });

  const { rows, guests } = useMemo(() => {
    const now = new Date();
    const played = events.filter((e) => e.team_id === teamId && MATCH_TYPES.includes(e.type) && new Date(e.date) < now);
    const playedIds = new Set(played.map((e) => e.id));
    const totalMin = played.reduce((a, e) => a + matchMinutes(e), 0);
    const statsOf = (pid) => allStats.filter((s) => s.player_id === pid && playedIds.has(s.event_id));
    const agg = (pid) => {
      const st = statsOf(pid);
      const rated = st.filter((s) => s.rating);
      const mins = st.reduce((a, s) => a + (s.minutes_played || 0), 0);
      return {
        pj: st.length,
        goals: st.reduce((a, s) => a + (s.goals || 0), 0),
        assists: st.reduce((a, s) => a + (s.assists || 0), 0),
        mins,
        minPJ: st.length ? Math.round(mins / st.length) : null,
        pctMin: totalMin ? Math.round((mins / totalMin) * 100) : null,
        rating: rated.length ? rated.reduce((a, s) => a + s.rating, 0) / rated.length : null,
        ta: st.reduce((a, s) => a + (s.yellow_cards || 0), 0),
        tr: st.reduce((a, s) => a + (s.red_cards || 0), 0),
      };
    };
    const rows = players.filter((p) => p.team_id === teamId && p.status !== "baja").map((p) => {
      const att = attendance.filter((a) => a.player_id === p.id && a.status);
      const ok = att.filter((a) => a.status === "present" || a.status === "apart").length;
      const active = injuries.filter((i) => i.player_id === p.id && i.status !== "alta");
      return { p, ...agg(p.id), attPct: att.length ? Math.round((ok / att.length) * 100) : null, attN: att.length, injury: active[0] || null, year: birthYearOf(p) };
    });
    // Jugadores de otros equipos con minutos/estadísticas en partidos de este equipo
    const ids = new Set(rows.map((r) => r.p.id));
    const guestIds = [...new Set(allStats.filter((s) => playedIds.has(s.event_id) && !ids.has(s.player_id)).map((s) => s.player_id))];
    const guests = guestIds.map((id) => players.find((p) => p.id === id)).filter(Boolean).map((p) => ({ p, ...agg(p.id), year: birthYearOf(p), team: teams.find((t) => t.id === p.team_id) }));
    return { rows, guests };
  }, [players, teams, events, allStats, attendance, injuries, teamId]);

  const sorted = useMemo(() => {
    const val = (r) => {
      switch (sort.key) {
        case "name": return `${r.p.last_name || ""} ${r.p.first_name || ""}`.toLowerCase();
        case "num": return r.p.jersey_number ?? 999;
        case "year": return r.year ?? 0;
        case "pos": { const i = POS_ORDER.indexOf(r.p.position); return (i < 0 ? 99 : i) * 1000 + (r.p.jersey_number ?? 999); }
        default: return r[sort.key] ?? -1;
      }
    };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [rows, sort]);

  const num = "text-center px-2 py-1.5";
  const hdr = { sort, setSort };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Plantilla <span className="text-gray-400 font-bold">({rows.length})</span></h2>
          {onAddPlayer && (
            <button onClick={onAddPlayer} className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1.5 rounded" style={{ background: "var(--granate)" }}><Plus className="w-3.5 h-3.5" /> Jugador</button>
          )}
        </div>
        {rows.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">No hay jugadores en este equipo</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <Th label="#" k="num" {...hdr} className="text-left" />
                  <Th label="Jugador" k="name" {...hdr} className="text-left" />
                  <Th label="Año" k="year" {...hdr} />
                  <Th label="Pos" k="pos" {...hdr} />
                  <Th label="PJ" k="pj" {...hdr} />
                  <Th label="Goles" k="goals" {...hdr} />
                  <Th label="Asist" k="assists" {...hdr} />
                  <Th label="Min" k="mins" {...hdr} />
                  <Th label="Min/PJ" k="minPJ" {...hdr} />
                  <Th label="% min" k="pctMin" {...hdr} />
                  <Th label="Val." k="rating" {...hdr} />
                  <Th label="TA" k="ta" {...hdr} />
                  <Th label="TR" k="tr" {...hdr} />
                  <Th label="Entr." k="attPct" {...hdr} />
                  <th className="px-2 py-2 font-bold">Estado</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((r) => (
                  <tr key={r.p.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-black text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{r.p.jersey_number ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <Link to={`/PlayerProfile?id=${r.p.id}`} className="flex items-center gap-2 group">
                        <span className="w-6 h-6 rounded overflow-hidden border border-gray-200 flex items-center justify-center shrink-0" style={{ background: "var(--granate-pale)" }}>
                          {r.p.photo_url ? <img src={r.p.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <User className="w-3.5 h-3.5 text-gray-400" />}
                        </span>
                        <span className="font-bold text-gray-900 group-hover:underline whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>{r.p.first_name} {r.p.last_name}</span>
                      </Link>
                    </td>
                    <td className={`${num} text-gray-600`}>{r.year ?? "—"}</td>
                    <td className={num}><span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)" }}>{POS_LABEL[r.p.position] || "—"}</span></td>
                    <td className={`${num} font-black`}>{r.pj}</td>
                    <td className={`${num} font-black`} style={{ color: r.goals > 0 ? "var(--granate)" : undefined }}>{r.goals}</td>
                    <td className={`${num} font-bold text-gray-600`}>{r.assists}</td>
                    <td className={`${num} text-gray-700`}>{r.mins > 0 ? `${r.mins}'` : "—"}</td>
                    <td className={`${num} text-gray-600`}>{r.minPJ ? `${r.minPJ}'` : "—"}</td>
                    <td className={`${num} font-bold`} style={{ color: "var(--granate)" }}>{r.pctMin != null && r.mins > 0 ? `${r.pctMin}%` : "—"}</td>
                    <td className={`${num} font-bold`}>{r.rating != null ? r.rating.toFixed(1) : "—"}</td>
                    <td className={num}>{r.ta > 0 ? <span className="inline-block min-w-4 px-1 rounded-sm bg-yellow-400 text-[10px] font-bold text-yellow-900">{r.ta}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className={num}>{r.tr > 0 ? <span className="inline-block min-w-4 px-1 rounded-sm bg-red-500 text-[10px] font-bold text-white">{r.tr}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className={`${num} font-bold`} style={{ color: pctColor(r.attPct) }} title={r.attN ? `${r.attN} entrenos registrados` : ""}>{r.attPct != null ? `${r.attPct}%` : "—"}</td>
                    <td className="px-2 py-1.5">
                      {r.injury ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200 whitespace-nowrap" title={r.injury.diagnosis || ""}>Lesión{r.injury.body_part ? ` · ${r.injury.body_part}` : ""}</span>
                      ) : r.p.status === "lesionado" ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200">Lesionado</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-green-50 text-green-700 border-green-200">Activo</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Link to={`/PlayerProfile?id=${r.p.id}&edit=1`} title="Editar jugador" className="inline-flex p-1 rounded text-gray-300 hover:text-gray-700 hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {guests.length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-4 py-2.5 border-b border-gray-100">
            <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Jugadores de otros equipos con este equipo <span className="text-gray-400 font-bold">({guests.length})</span></h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <th className="px-2 py-2 text-left font-bold">Jugador</th><th className="px-2 py-2 font-bold">Año</th><th className="px-2 py-2 text-left font-bold">Equipo</th>
                  <th className="px-2 py-2 font-bold">PJ</th><th className="px-2 py-2 font-bold">Goles</th><th className="px-2 py-2 font-bold">Asist</th><th className="px-2 py-2 font-bold">Min</th><th className="px-2 py-2 font-bold">Val.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {guests.map((g) => (
                  <tr key={g.p.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5"><Link to={`/PlayerProfile?id=${g.p.id}`} className="font-bold text-gray-900 hover:underline" style={{ fontFamily: "var(--font-display)" }}>{g.p.first_name} {g.p.last_name}</Link></td>
                    <td className={`${num} text-gray-600`}>{g.year ?? "—"}</td>
                    <td className="px-2 py-1.5 text-gray-500">{g.team?.name || "—"}</td>
                    <td className={`${num} font-black`}>{g.pj}</td>
                    <td className={`${num} font-black`} style={{ color: g.goals > 0 ? "var(--granate)" : undefined }}>{g.goals}</td>
                    <td className={`${num} text-gray-600`}>{g.assists}</td>
                    <td className={`${num} text-gray-700`}>{g.mins}'</td>
                    <td className={`${num} font-bold`}>{g.rating != null ? g.rating.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
