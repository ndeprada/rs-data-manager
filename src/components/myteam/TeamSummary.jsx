import React from "react";
import { isCancelled } from "@/lib/eventCancel";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { playerFullName } from "@/lib/playerName";

const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
const FORM = { G: ["V", "#16a34a"], E: ["E", "#ea580c"], P: ["D", "#dc2626"] };
const display = { fontFamily: "var(--font-display)" };
const box = "bg-white border border-gray-200 shadow-sm px-4 py-3";
const boxStyle = { borderRadius: "6px" };
const Label = ({ children }) => <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{children}</p>;

export default function TeamSummary({ team, events, players, matchStats }) {
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list() });
  const { data: standing } = useQuery({
    queryKey: ["fcf-standing", team.id],
    queryFn: async () => {
      const r = await fetch(`/api/sync-fcf?standings=${team.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("error");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const now = new Date();
  const matches = events.filter((e) => MATCH_TYPES.includes(e.type));
  const next = matches.filter((e) => new Date(e.date) >= now && !isCancelled(e)).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const played = matches.filter((e) => e.score_home != null && e.score_away != null);
  const w = played.filter((m) => m.score_home > m.score_away).length;
  const d = played.filter((m) => m.score_home === m.score_away).length;
  const l = played.length - w - d;
  const gf = played.reduce((a, m) => a + Number(m.score_home || 0), 0);
  const gc = played.reduce((a, m) => a + Number(m.score_away || 0), 0);

  const evIds = new Set(events.map((e) => e.id));
  const att = attendance.filter((a) => evIds.has(a.event_id));
  const rate = att.length ? Math.round((att.filter((a) => a.status !== "absent").length / att.length) * 100) : null;
  const rateColor = rate >= 80 ? "#16a34a" : rate >= 60 ? "var(--naranja)" : "#dc2626";

  const acc = new Map();
  matchStats.filter((s) => evIds.has(s.event_id)).forEach((s) => {
    const a = acc.get(s.player_id) || { g: 0, a: 0 };
    a.g += s.goals || 0; a.a += s.assists || 0; acc.set(s.player_id, a);
  });
  const top = (k) => {
    const [id, v] = [...acc.entries()].sort((x, y) => y[1][k] - x[1][k])[0] || [];
    const p = players.find((pl) => pl.id === id);
    return p && v[k] > 0 ? { p, n: v[k] } : null;
  };
  const sc = top("g"), as = top("a");

  const rows = standing?.rows || [];
  const me = rows.find((r) => r.teamId === standing?.ourTeamId);
  const form = (me?.form || []).slice().reverse().slice(-5);
  const base = next ? `/MatchDetail?id=${next.id}&teamId=${next.team_id}` : "";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <div className={`${box} col-span-2 flex items-center gap-4`} style={{ ...boxStyle, borderLeft: "4px solid var(--naranja)" }}>
        <div className="min-w-0 flex-1">
          <Label>Próximo partido</Label>
          {next ? (
            <>
              <p className="font-black text-gray-900 text-sm leading-tight truncate" style={display}>{next.opponent ? `vs ${next.opponent}` : next.title}</p>
              <p className="text-[11px] font-bold capitalize" style={{ color: "var(--granate)" }}>{format(new Date(next.date), "EEE d MMM · HH:mm", { locale: es })}</p>
            </>
          ) : <p className="text-sm text-gray-300">Sin partidos</p>}
        </div>
        {next && (
          <div className="flex flex-col gap-1 shrink-0">
            <Link to={`${base}&tab=tactica`} className="text-[11px] font-bold px-2.5 py-1 rounded text-white text-center" style={{ background: "var(--granate)" }}>Preparar</Link>
            <Link to={`${base}&tab=convocatoria`} className="text-[11px] font-semibold px-2.5 py-1 rounded border border-gray-200 text-gray-800 text-center">Convocatoria</Link>
          </div>
        )}
      </div>

      <div className={box} style={boxStyle}>
        <Label>Clasificación FCF</Label>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black leading-none" style={{ ...display, color: "var(--granate)" }}>{me ? `${me.pos}º` : "—"}</span>
          <span className="text-[11px] text-gray-500 mb-0.5">{me ? `${me.pts} pts` : ""}</span>
        </div>
        <div className="flex gap-0.5 mt-1.5 h-4">
          {form.map((f, i) => <span key={i} className="w-4 h-4 rounded-[3px] text-[9px] font-black text-white flex items-center justify-center" style={{ background: (FORM[f] || ["?", "#9ca3af"])[1] }}>{(FORM[f] || ["?"])[0]}</span>)}
        </div>
      </div>

      <div className={box} style={boxStyle}>
        <Label>Temporada</Label>
        <div className="flex items-end gap-1.5" style={display}>
          <span className="text-2xl font-black text-green-600 leading-none">{w}</span><span className="text-[9px] text-gray-400 mb-0.5">V</span>
          <span className="text-2xl font-black text-gray-500 leading-none">{d}</span><span className="text-[9px] text-gray-400 mb-0.5">E</span>
          <span className="text-2xl font-black text-red-600 leading-none">{l}</span><span className="text-[9px] text-gray-400 mb-0.5">D</span>
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Goles {gf} – {gc}</p>
      </div>

      <div className={box} style={boxStyle}>
        <Label>Asistencia</Label>
        <p className="text-2xl font-black leading-none" style={{ ...display, color: rate == null ? "#9ca3af" : rateColor }}>{rate == null ? "—" : `${rate}%`}</p>
        <div className="h-1.5 rounded-full bg-gray-100 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${rate || 0}%`, background: rateColor }} /></div>
      </div>

      <div className={box} style={boxStyle}>
        <Label>Goleador · Asistente</Label>
        <p className="text-[12px] font-semibold text-gray-900 truncate">{sc ? `${playerFullName(sc.p)} · ${sc.n}` : "—"}</p>
        <p className="text-[12px] font-semibold text-gray-500 truncate">{as ? `${playerFullName(as.p)} · ${as.n}` : "—"}</p>
      </div>
    </div>
  );
}
