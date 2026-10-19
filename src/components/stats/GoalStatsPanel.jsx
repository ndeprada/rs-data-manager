import React, { useMemo } from "react";
import { eventMinutes } from "@/lib/matchDuration";
import { fromStored, GOAL_PHASES, GOAL_AREAS, GOAL_SECTORS, SP_TYPES, SP_HOW, CREATE_ALL, FINISHES } from "@/lib/goalTypes";
import { playerFullName } from "@/lib/playerName";

const BUCKETS = ["1-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90'", "+90'"];

// Filas compactas: etiqueta a la izquierda (centrada con las barras), dos barras finas (marcamos / encajamos) y su número
function DualBars({ rows }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.f, r.a]));
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 h-[20px]">
          <span className="w-[104px] sm:w-[128px] shrink-0 text-[11px] leading-none text-gray-600 truncate">{r.label}</span>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-[3px]">
            {[["var(--granate)", r.f], ["#9ca3af", r.a]].map(([color, v], i) => (
              <div key={i} className="h-[6px] rounded-sm" style={{ width: `${(v / max) * 100}%`, minWidth: v ? 3 : 0, background: color }} />
            ))}
          </div>
          <span className="w-10 shrink-0 text-right text-[11px] leading-none tabular-nums">
            <b style={{ color: "var(--granate)" }}>{r.f || "·"}</b><span className="text-gray-300"> / </span><b className="text-gray-500">{r.a || "·"}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

// Columnas por tramo de 15': granate = marcamos, gris = encajamos (compacto)
function Timeline({ rows, parts }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.f, r.a]));
  const H = 64;
  return (
    <div>
      <div className="flex items-end gap-1">
        {rows.map((r, i) => (
          <div key={r.label} className={`flex-1 min-w-0 ${i === 3 ? "border-l border-dashed border-gray-300 pl-1" : ""}`}>
            <div className="flex items-end justify-center gap-[3px]" style={{ height: H + 14 }}>
              {[[r.f, "var(--granate)", "#73000A"], [r.a, "#9ca3af", "#6b7280"]].map(([v, bg, tx], k) => (
                <div key={k} className="flex flex-col items-center justify-end w-[40%] max-w-[22px]">
                  <span className="text-[10px] leading-none font-bold mb-0.5" style={{ color: tx }}>{v || ""}</span>
                  <div className="w-full rounded-t-sm" style={{ height: v ? Math.max(3, (v / max) * H) : 1, background: v ? bg : "#e5e7eb" }} />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 text-center mt-1 leading-none">{r.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 text-[11px] text-gray-500 mt-2">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <b className="text-gray-700">{p.label}</b>
            <span style={{ color: "var(--granate)" }} className="font-bold">{p.f}</span><span>/</span><span className="font-bold text-gray-500">{p.a}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      {sub && <p className="text-[10px] text-gray-400 mb-2">{sub}</p>}
      {!sub && <div className="mb-2" />}
      {children}
    </div>
  );
}

// Estadísticas de goles marcados y encajados: minutos (tramos de 15' y partes), tipo, zona/sector y balón parado
// Campo (ataque hacia arriba): 6 zonas = dentro/fuera del área × izquierda/centro/derecha
function GoalMap({ title, color, cells }) {
  const max = Math.max(1, ...Object.values(cells));
  const xs = [10, 103, 197], w = 93;
  const zones = [["dentro", 12, 78], ["fuera", 90, 78]];
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">{title}</p>
      <svg viewBox="0 0 300 172" className="w-full rounded-lg border border-gray-200 bg-white">
        {zones.flatMap(([a, y, h]) => ["izquierda", "centro", "derecha"].map((sct, i) => {
          const v = cells[`${a}_${sct}`] || 0;
          return (
            <g key={a + sct}>
              <rect x={xs[i]} y={y} width={w} height={h} fill={color} fillOpacity={v ? 0.12 + 0.7 * (v / max) : 0} stroke="#e5e7eb" strokeWidth="1" />
              {v > 0 && <text x={xs[i] + w / 2} y={y + h / 2 + 7} textAnchor="middle" fontSize="22" fontWeight="700" fill={v / max > 0.55 ? "#fff" : "#374151"}>{v}</text>}
            </g>
          );
        }))}
        <rect x="10" y="12" width="280" height="156" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
        <rect x="75" y="12" width="150" height="78" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
        <rect x="125" y="4" width="50" height="8" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function GoalStatsPanel({ events = [], players = [], teams = [] }) {
  const d = useMemo(() => {
    const goals = [];
    let matches = 0;
    for (const e of events) {
      if (!e.goal_events?.length) continue;
      matches++;
      const total = eventMinutes(e, teams.find((t) => t.id === e.team_id));
      const sorted = [...e.goal_events].sort((a, b) => (Number(a.minute) || 0) - (Number(b.minute) || 0));
      const subs = (e.match_events || []).filter((m) => m.type === "sub");
      let diff = 0;
      for (const g of sorted) {
        const f = g.team === "home", minute = Number(g.minute) || 0;
        const afterSub = subs.some((sb) => sb.team === g.team && minute > Number(sb.minute) && minute - Number(sb.minute) <= 10);
        goals.push({ f, minute, total, c: fromStored(g), state: diff < 0 ? "perdiendo" : diff > 0 ? "ganando" : "empatando", afterSub, scorer: g.player_id, assist: g.assist_player_id });
        diff += f ? 1 : -1;
      }
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
    const create = cnt2(goals, "create", CREATE_ALL).filter((r) => r.f || r.a);
    const finish = cnt2(goals, "finish", FINISHES).filter((r) => r.f || r.a);
    const stateRows = [["perdiendo", "Yendo perdiendo"], ["empatando", "Con empate"], ["ganando", "Yendo ganando"]].map(([k, label]) => ({ label, f: goals.filter((g) => g.f && g.state === k).length, a: goals.filter((g) => !g.f && g.state === k).length }));
    const afterSub = { f: goals.filter((g) => g.f && g.afterSub).length, a: goals.filter((g) => !g.f && g.afterSub).length };
    const tally = (list, keyFn) => { const m = new Map(); list.forEach((g) => { const k = keyFn(g); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); };
    const ours = goals.filter((g) => g.f);
    const scorers = tally(ours, (g) => g.scorer);
    const assisters = tally(ours, (g) => g.assist);
    const pairs = tally(ours, (g) => g.scorer && g.assist ? `${g.assist}>${g.scorer}` : "");
    const mapCells = (isOurs) => { const m = {}; goals.filter((g) => g.f === isOurs && g.c.phase !== "balon_parado" && g.c.area && g.c.sector).forEach((g) => { const k = `${g.c.area}_${g.c.sector}`; m[k] = (m[k] || 0) + 1; }); return m; };
    return { create, finish, stateRows, afterSub, scorers, assisters, pairs, mapF: mapCells(true), mapA: mapCells(false), goals, matches, minutes, parts, phase, area, sector, bp: { type: cnt2(bp, "sp", SP_TYPES).filter((r) => r.f || r.a), how: cnt2(bp, "how", SP_HOW), side: cnt2(bp, "sector", GOAL_SECTORS) }, total: { f: goals.filter((g) => g.f).length, a: goals.filter((g) => !g.f).length }, unclassified: goals.filter((g) => !g.c.phase).length };
  }, [events, teams]);

  if (!d.goals.length) return <p className="text-sm text-gray-400 text-center py-10">Aún no hay goles registrados con minuto. Se rellenan en cada partido (Acta o Estadísticas).</p>;
  const hasBp = d.bp.type.length > 0;
  const pname = (id) => { const p = players.find((x) => x.id === id); return p ? playerFullName(p) : "—"; };
  const List = ({ title, items, fmt }) => (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-1">{title}</p>
      {items.length ? items.map(([k, n]) => (
        <div key={k} className="flex items-center justify-between text-xs py-0.5"><span className="text-gray-600 truncate">{fmt(k)}</span><b className="text-gray-800 tabular-nums">{n}</b></div>
      )) : <p className="text-[11px] text-gray-400">Sin datos</p>}
    </div>
  );

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
        <Card title="¿En qué minutos?" sub="Por tramos de 15' · la línea discontinua marca el descanso">
          <Timeline rows={d.minutes} parts={d.parts} />
        </Card>
        <Card title="Tipo de gol" sub="Ataque organizado, transición o balón parado">
          <DualBars rows={d.phase} />
        </Card>
        <Card title="Dónde (juego no parado)" sub="Zona y sector del campo">
          <DualBars rows={d.area} />
          <div className="mt-2.5 pt-2.5 border-t border-gray-100"><DualBars rows={d.sector} /></div>
        </Card>
        <Card title="Fábrica de goles" sub="Cómo se crean y cómo acaban">
          {d.create.length || d.finish.length ? (
            <>
              <DualBars rows={d.create} />
              {d.finish.length > 0 && <div className="mt-2.5 pt-2.5 border-t border-gray-100"><DualBars rows={d.finish} /></div>}
            </>
          ) : <p className="text-xs text-gray-400">Aún no hay goles con «cómo se creó» o «remate».</p>}
        </Card>
        <Card title="Marcador y cambios" sub="Cuándo marcamos y encajamos según el momento del partido">
          <DualBars rows={d.stateRows} />
          <div className="mt-2.5 pt-2.5 border-t border-gray-100">
            <DualBars rows={[{ label: "Tras un cambio (10')", f: d.afterSub.f, a: d.afterSub.a }]} />
          </div>
        </Card>
        <Card title="Mapa de goles" sub="Dónde marcamos y dónde encajamos (juego no parado; ataque hacia arriba)">
          <div className="grid grid-cols-2 gap-3">
            <GoalMap title="Marcamos" color="#73000A" cells={d.mapF} />
            <GoalMap title="Encajamos" color="#4b5563" cells={d.mapA} />
          </div>
        </Card>
        <Card title="Quién marca y quién asiste" sub="Solo goles nuestros con jugador indicado">
          <div className="grid sm:grid-cols-3 gap-4">
            <List title="Goleadores" items={d.scorers} fmt={pname} />
            <List title="Asistentes" items={d.assisters} fmt={pname} />
            <List title="Parejas" items={d.pairs} fmt={(k) => { const [a, s] = k.split(">"); return `${pname(a)} → ${pname(s)}`; }} />
          </div>
        </Card>
        <Card title="Balón parado" sub="Tipo, cómo y por qué lado">
          {hasBp ? (
            <>
              <DualBars rows={d.bp.type} />
              <div className="mt-2.5 pt-2.5 border-t border-gray-100"><DualBars rows={d.bp.how.filter((r) => r.f || r.a)} /></div>
              <div className="mt-2.5 pt-2.5 border-t border-gray-100"><DualBars rows={d.bp.side} /></div>
            </>
          ) : <p className="text-xs text-gray-400">Sin goles de balón parado clasificados.</p>}
        </Card>
      </div>
    </div>
  );
}
