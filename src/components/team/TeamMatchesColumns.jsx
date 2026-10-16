import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { resultOf, HomeAwayIcon } from "@/components/match/MatchesTimeline";
import { useMatchStatus } from "@/lib/matchStatus";
import { usePlayerMode } from "@/lib/playerMode";

const CHIP = { victoria: ["V", "#16a34a"], empate: ["E", "#ea580c"], derrota: ["D", "#dc2626"] };

function Row({ m, onOpen, reasons, soft }) {
  const r = resultOf(m);
  return (
    <button type="button" onClick={() => onOpen?.(m)} className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 text-left group">
      <div className="w-12 shrink-0 text-xs font-bold text-gray-500 leading-tight">
        {format(new Date(m.date), "d MMM", { locale: es })}
        <span className="block text-[10px] font-normal text-gray-400">{format(new Date(m.date), "HH:mm")}</span>
      </div>
      <HomeAwayIcon match={m} className="w-4 h-4 shrink-0" />
      {m.opponent_logo_url ? <img src={m.opponent_logo_url} alt="" loading="lazy" className="w-5 h-5 object-contain shrink-0" /> : <span className="w-5 shrink-0" />}
      <span className="flex-1 min-w-0 truncate text-sm font-normal text-gray-900">{m.opponent || m.title || "Rival"}</span>
      {reasons && <span title={reasons.join(" · ")} className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Pendiente</span>}
      {!reasons && soft && <span title={soft.join(" · ")} className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-200">Pendiente</span>}
      {r ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-black" style={{ fontFamily: "var(--font-display)" }}>{m.score_home}-{m.score_away}</span>
          <span className="w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center" style={{ background: CHIP[r][1] }}>{CHIP[r][0]}</span>
        </span>
      ) : (
        <span className="text-[11px] text-gray-400 shrink-0">{m.location ? m.location.slice(0, 18) : ""}</span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
    </button>
  );
}

function Column({ title, rows, empty, onOpen, pending, soft }) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="font-black text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{title}</h3>
      </div>
      {rows.length === 0 ? <p className="px-3 py-3 text-sm text-gray-400">{empty}</p> : <div className="divide-y divide-gray-50">{rows.map((m) => <Row key={m.id} m={m} onOpen={onOpen} reasons={pending?.get(m.id)} soft={soft?.get(m.id)} />)}</div>}
    </div>
  );
}

// Últimos partidos jugados (izquierda) y próximos (derecha), 3 y 3.
export default function TeamMatchesColumns({ matches, onOpen, count = 3 }) {
  const { pending: allPending, soft: allSoft } = useMatchStatus();
  const pending = usePlayerMode() ? undefined : allPending;
  const soft = usePlayerMode() ? undefined : allSoft;
  const now = new Date();
  const last = matches.filter((m) => new Date(m.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, count);
  const next = matches.filter((m) => new Date(m.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, count);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Column title="Últimos partidos" rows={last} empty="Sin partidos jugados" onOpen={onOpen} pending={pending} soft={soft} />
      <Column title="Próximos partidos" rows={next} empty="Sin partidos programados" onOpen={onOpen} />
    </div>
  );
}
