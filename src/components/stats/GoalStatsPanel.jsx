import React, { useMemo } from "react";
import { fromStored, matchTotal, GOAL_PHASES, GOAL_AREAS, GOAL_SECTORS, SP_TYPES, SP_HOW } from "@/lib/goalTypes";

const BUCKETS = ["1-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90'", "+90'"];

function DualBars({ rows }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.f, r.a]));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] gap-2 items-center">
          <span className="text-xs text-gray-600 truncate">{r.label}</span>
          <div className="space-y-0.5">
            {[["f", "var(--granate)", r.f], ["a", "#9ca3af", r.a]].map(([k, color, v]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="h-2.5 rounded-sm" style={{ width: `${(v / max) * 100}%`, minWidth: v ? 3 : 0, background: color }} />
                <span className="text-[11px] font-bold text-gray-700 tabular-nums">{v || ""}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      {sub && <p className="text-[10px] text-gray-400 mb-3">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );
}

// Estadísticas de goles marcados y encajados: minutos (tramos de 15' y partes), tipo, zona/sector y balón parado
export default function GoalStatsPanel({ events = [] }) {
  const d = useMemo(() => {
    const goals = [];
    let matches = 0;
    for (const e of events) {
      if (!e.goal_events?.length) continue;
      matches++;
      const total = matchTotal(e.match_duration);
      for (const g of e.goal_events) goals.push({ f: g.team === "home", minute: Number(g.minute) || 0, total, c: fromStored(g) });
    }
    const count = (keyFn, list) => list.map((l) => ({ label: l.label, f: goals.filter((g) => g.f && keyFn(g) === l.value).length, a: goals.filter((g) => !g.f && keyFn(g) === l.value).length }));
    const bucket = (g) => Math.min(6, Math.max(0, Math.ceil(g.minute / 15) - 1));
    const lastB = Math.max(3, ...goals.map(bucket));
    const minutes = BUCKETS.slice(0, lastB + 1).map((label, i) => ({ label, f: goals.filter((g) => g.f && bucket(g) === i).length, a: goals.filter((g) => !g.f && bucket(g) === i).length }));
    const half = (g) => (g.minute <= g.total / 2 ? "1" : "2");
    const parts = count(half, [{ value: "1", label: "1ª parte" }, { value: "2", label: "2ª parte" }]);
    const phase = count((g) => g.c.phase || "", [...GOAL_PHASES, { value: "", label: "Sin clasificar" }]).filter((r) => r.f || r.a || r.label !== "Sin clasificar");
    const open = goals.filter((g) => g.c.phase !== "balon_parado" && g.c.phase !== "gol_propio");
    const cnt2 = (list, field, items) => items.map((it) => ({ label: it.label, f: list.filter((g) => g.f && g.c[field] === it.value).length, a: list.filter((g) => !g.f && g.c[field] === it.value).length }));
    const area = cnt2(open, "area", GOAL_AREAS);
    const sector = cnt2(open, "sector", GOAL_SECTORS);
    const bp = goals.filter((g) => g.c.phase === "balon_parado");
    return { goals, matches, minutes, parts, phase, area, sector, bp: { type: cnt2(bp, "sp", SP_TYPES).filter((r) => r.f || r.a), how: cnt2(bp, "how", SP_HOW), side: cnt2(bp, "sector", GOAL_SECTORS) }, total: { f: goals.filter((g) => g.f).length, a: goals.filter((g) => !g.f).length }, unclassified: goals.filter((g) => !g.c.phase).length };
  }, [events]);

  if (!d.goals.length) return <p className="text-sm text-gray-400 text-center py-10">Aún no hay goles registrados con minuto. Se rellenan en cada partido (Acta o Estadísticas).</p>;
  const hasBp = d.bp.type.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span><b style={{ color: "var(--granate)" }} className="text-xl">{d.total.f}</b> marcados</span>
        <span><b className="text-xl text-gray-500">{d.total.a}</b> encajados</span>
        <span className="text-xs text-gray-400">en {d.matches} {d.matches === 1 ? "partido" : "partidos"} con goles registrados{d.unclassified ? ` · ${d.unclassified} sin clasificar` : ""}</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><i className="w-3 h-2 rounded-sm" style={{ background: "var(--granate)" }} /> Marcamos</span>
          <span className="inline-flex items-center gap-1"><i className="w-3 h-2 rounded-sm bg-gray-400" /> Encajamos</span>
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="¿En qué minutos?" sub="Tramos de 15 minutos y por parte">
          <DualBars rows={d.minutes} />
          <div className="mt-4 pt-3 border-t border-gray-100"><DualBars rows={d.parts} /></div>
        </Card>
        <Card title="Tipo de gol" sub="Ataque organizado, transición o balón parado">
          <DualBars rows={d.phase} />
        </Card>
        <Card title="Dónde (juego no parado)" sub="Zona y sector del campo">
          <DualBars rows={d.area} />
          <div className="mt-4 pt-3 border-t border-gray-100"><DualBars rows={d.sector} /></div>
        </Card>
        <Card title="Balón parado" sub="Tipo, cómo y por qué lado">
          {hasBp ? (
            <>
              <DualBars rows={d.bp.type} />
              <div className="mt-4 pt-3 border-t border-gray-100"><DualBars rows={d.bp.how.filter((r) => r.f || r.a)} /></div>
              <div className="mt-4 pt-3 border-t border-gray-100"><DualBars rows={d.bp.side} /></div>
            </>
          ) : <p className="text-xs text-gray-400">Sin goles de balón parado clasificados.</p>}
        </Card>
      </div>
    </div>
  );
}
