import React, { useMemo } from "react";
import { eventMinutes } from "@/lib/matchDuration";
import { fromStored, GOAL_PHASES, GOAL_AREAS, GOAL_SECTORS, SP_TYPES, SP_HOW, CREATE_ALL, FINISHES } from "@/lib/goalTypes";
import { playerFullName } from "@/lib/playerName";
import { useT, msg } from "@/i18n";
import { C as clubColor } from "@/lib/brand";
import { RS } from "@/components/rs2/kit";
import { Head, Label, Big } from "@/components/rs2/dashParts";
import { mirrorRows, circleRadius } from "@/lib/statsOverview";

const BUCKETS = ["1-15'", "16-30'", "31-45'", "46-60'", "61-75'", "76-90'", "+90'"];

// Gráficos «en espejo» (estilo B elegido por Nacho el 13/11/2026): encajamos a la izquierda en naranja, la etiqueta
// en el centro y marcamos a la derecha en granate, con el número al lado de cada barra.
const OUR = clubColor.primary, THEIR = clubColor.accent;

function Mirror({ rows, labelW = 112, head = true }) {
  const t = useT();
  const list = mirrorRows(rows);
  return (
    <div>
      {head && (
        <div className="grid items-center" style={{ gridTemplateColumns: `1fr ${labelW}px 1fr`, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
          <span style={{ textAlign: "right", color: THEIR }}>{t("Encajamos")}</span><span />
          <span style={{ color: OUR }}>{t("Marcamos")}</span>
        </div>
      )}
      <div className="flex flex-col" style={{ gap: 5 }}>
        {list.map((r) => (
          <div key={r.label} className="grid items-center" style={{ gridTemplateColumns: `1fr ${labelW}px 1fr` }} data-testid="mirror-row">
            <div className="flex items-center justify-end" style={{ gap: 5 }}>
              <b className="tabular-nums" style={{ fontSize: 12, color: THEIR }}>{r.a || ""}</b>
              <div style={{ height: 14, width: `${r.aw}%`, minWidth: r.a ? 6 : 0, background: THEIR, borderRadius: "7px 3px 3px 7px" }} />
            </div>
            <div className="truncate" style={{ textAlign: "center", fontSize: 11.5, fontWeight: 600, color: RS.ink, padding: "0 6px" }} title={t(r.label)}>{t(r.label)}</div>
            <div className="flex items-center" style={{ gap: 5 }}>
              <div style={{ height: 14, width: `${r.fw}%`, minWidth: r.f ? 6 : 0, background: OUR, borderRadius: "3px 7px 7px 3px" }} />
              <b className="tabular-nums" style={{ fontSize: 12, color: OUR }}>{r.f || ""}</b>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, sub, children, testId }) {
  return (
    <section className="rs2-card" style={{ overflow: "hidden" }} data-testid={testId}>
      <Head title={title} right={sub ? <span style={{ fontSize: 11, fontWeight: 400, color: RS.muted }}>{sub}</span> : null} />
      <div style={{ padding: "12px 14px 14px" }}>{children}</div>
    </section>
  );
}

const Sep = () => <div style={{ borderTop: `1px solid ${RS.line}`, margin: "10px 0" }} />;

// Campo (ataque hacia arriba): 6 zonas = dentro/fuera del área × izquierda/centro/derecha, con un círculo por zona que crece con los goles
function GoalMap({ title, color, cells }) {
  const max = Math.max(0, ...Object.values(cells));
  const xs = [10, 103, 197], w = 93;
  const zones = [["dentro", 12, 78], ["fuera", 90, 78]];
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: RS.ink2, marginBottom: 4 }}>{title}</p>
      <svg viewBox="0 0 300 172" className="w-full" style={{ borderRadius: 10, border: `1px solid ${RS.line}`, background: "#fff" }} role="img" aria-label={title}>
        <rect x="10" y="12" width="280" height="156" fill="none" stroke="#C9BEBF" strokeWidth="1.5" />
        <rect x="75" y="12" width="150" height="78" fill="none" stroke="#C9BEBF" strokeWidth="1.5" />
        <rect x="125" y="4" width="50" height="8" fill="none" stroke="#C9BEBF" strokeWidth="1.5" />
        {zones.flatMap(([a, y, h]) => ["izquierda", "centro", "derecha"].map((sct, i) => {
          const v = cells[`${a}_${sct}`] || 0;
          if (!v) return null;
          const r = circleRadius(v, max, { min: 10, max_r: 30 });
          return (
            <g key={a + sct}>
              <circle cx={xs[i] + w / 2} cy={y + h / 2} r={r} fill={color} fillOpacity="0.92" />
              <text x={xs[i] + w / 2} y={y + h / 2 + 6} textAnchor="middle" fontSize={r > 16 ? 18 : 13} fontWeight="700" fill="#fff">{v}</text>
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

export default function GoalStatsPanel({ events = [], players = [], teams = [] }) {
  const t = useT();
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
    const parts = count(half, [{ value: "1", label: msg("1ª parte") }, { value: "2", label: msg("2ª parte") }]);
    const phase = count((g) => g.c.phase || "", [...GOAL_PHASES, { value: "", label: msg("Sin clasificar") }]).filter((r) => r.f || r.a || r.label !== "Sin clasificar");
    const open = goals.filter((g) => g.c.phase !== "balon_parado" && g.c.phase !== "gol_propio");
    const cnt2 = (list, field, items) => items.map((it) => ({ label: it.label, f: list.filter((g) => g.f && g.c[field] === it.value).length, a: list.filter((g) => !g.f && g.c[field] === it.value).length }));
    const area = cnt2(open, "area", GOAL_AREAS);
    const sector = cnt2(open, "sector", GOAL_SECTORS);
    const bp = goals.filter((g) => g.c.phase === "balon_parado");
    const create = cnt2(goals, "create", CREATE_ALL).filter((r) => r.f || r.a);
    const finish = cnt2(goals, "finish", FINISHES).filter((r) => r.f || r.a);
    const stateRows = [["perdiendo", msg("Yendo perdiendo")], ["empatando", msg("Con empate")], ["ganando", msg("Yendo ganando")]].map(([k, label]) => ({ label, f: goals.filter((g) => g.f && g.state === k).length, a: goals.filter((g) => !g.f && g.state === k).length }));
    const afterSub = { f: goals.filter((g) => g.f && g.afterSub).length, a: goals.filter((g) => !g.f && g.afterSub).length };
    const tally = (list, keyFn) => { const m = new Map(); list.forEach((g) => { const k = keyFn(g); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); };
    const ours = goals.filter((g) => g.f);
    const scorers = tally(ours, (g) => g.scorer);
    const assisters = tally(ours, (g) => g.assist);
    const pairs = tally(ours, (g) => g.scorer && g.assist ? `${g.assist}>${g.scorer}` : "");
    const mapCells = (isOurs) => { const m = {}; goals.filter((g) => g.f === isOurs && g.c.phase !== "balon_parado" && g.c.area && g.c.sector).forEach((g) => { const k = `${g.c.area}_${g.c.sector}`; m[k] = (m[k] || 0) + 1; }); return m; };
    return { create, finish, stateRows, afterSub, scorers, assisters, pairs, mapF: mapCells(true), mapA: mapCells(false), goals, matches, minutes, parts, phase, area, sector, bp: { type: cnt2(bp, "sp", SP_TYPES).filter((r) => r.f || r.a), how: cnt2(bp, "how", SP_HOW), side: cnt2(bp, "sector", GOAL_SECTORS) }, total: { f: goals.filter((g) => g.f).length, a: goals.filter((g) => !g.f).length }, unclassified: goals.filter((g) => !g.c.phase).length };
  }, [events, teams]);

  if (!d.goals.length) return <p className="rs2-card" style={{ padding: 32, textAlign: "center", fontSize: 13, color: RS.muted }}>{t("Aún no hay goles registrados con minuto. Se rellenan en cada partido (Acta o Estadísticas).")}</p>;
  const hasBp = d.bp.type.length > 0;
  const pname = (id) => { const p = players.find((x) => x.id === id); return p ? playerFullName(p) : "—"; };
  const List = ({ title, items, fmt }) => (
    <div className="min-w-0">
      <Label>{title}</Label>
      <div className="flex flex-col" style={{ gap: 5, marginTop: 6 }}>
        {items.length ? items.map(([k, n], i) => (
          <div key={k} className="flex items-center" style={{ gap: 6, fontSize: 12 }}>
            <span style={{ width: 14, color: RS.muted }}>{i + 1}</span>
            <b className="truncate" style={{ flex: 1, minWidth: 0 }}>{fmt(k)}</b>
            <span className="rs2-display tabular-nums" style={{ fontSize: 18, color: OUR }}>{n}</span>
          </div>
        )) : <p style={{ fontSize: 11, color: RS.faint }}>{t("Sin datos")}</p>}
      </div>
    </div>
  );

  const lastQ = d.minutes.filter((_, i) => i >= 5);
  const late = { f: lastQ.reduce((x, r) => x + r.f, 0), a: lastQ.reduce((x, r) => x + r.a, 0) };
  const bpTot = d.phase.find((r) => r.label === "Balón parado") || { f: 0, a: 0 };
  const kpi = (title, big, small, foot, testId) => (
    <div className="rs2-card flex flex-col" style={{ flex: "1 1 190px", padding: "11px 14px", gap: 4, minWidth: 0 }} data-testid={testId}>
      <Label>{title}</Label>
      <div className="flex items-baseline" style={{ gap: 8 }}><Big size={28}>{big}</Big><span style={{ fontSize: 12, color: RS.muted }}>{small}</span></div>
      {foot && <div style={{ fontSize: 11, color: RS.muted }}>{foot}</div>}
    </div>
  );
  const per = (n) => (d.matches ? String(Math.round((n / d.matches) * 10) / 10).replace(".", ",") : "—");

  return (
    <div className="flex flex-col" style={{ gap: 12 }} data-testid="goal-stats">
      <div className="flex flex-wrap" style={{ gap: 12 }}>
        {kpi(t("Goles a favor"), d.total.f, t("{n} por partido", { n: per(d.total.f) }), d.unclassified ? t("{unclassified} sin clasificar", { unclassified: d.unclassified }) : (d.matches === 1 ? t("en {matches} partido con goles registrados", { matches: d.matches }) : t("en {matches} partidos con goles registrados", { matches: d.matches })), "goals-kpi-for")}
        {kpi(t("Goles en contra"), d.total.a, t("{n} por partido", { n: per(d.total.a) }), null, "goals-kpi-against")}
        {kpi(t("Balón parado"), bpTot.f, t("a favor · {n} en contra", { n: bpTot.a }), d.total.f ? t("{n} % de nuestros goles", { n: Math.round((bpTot.f / d.total.f) * 100) }) : null, "goals-kpi-sp")}
        {kpi(t("Último cuarto de hora"), late.f, t("a favor · {n} en contra", { n: late.a }), t("desde el minuto 76"), "goals-kpi-late")}
      </div>
      <div className="grid lg:grid-cols-2" style={{ gap: 12 }}>
        <Card title={t("¿En qué minutos?")} sub={t("Por tramos de 15'")} testId="goals-minutes">
          <Mirror rows={d.minutes} labelW={70} />
          <Sep />
          <Mirror rows={d.parts} labelW={70} head={false} />
        </Card>
        <Card title={t("Tipo de gol")} sub={t("Ataque organizado, transición o balón parado")}>
          <Mirror rows={d.phase} labelW={132} />
        </Card>
        <Card title={t("Mapa de goles")} sub={t("Juego no parado · atacamos hacia arriba")}>
          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            <GoalMap title={t("Marcamos")} color={OUR} cells={d.mapF} />
            <GoalMap title={t("Encajamos")} color={THEIR} cells={d.mapA} />
          </div>
        </Card>
        <Card title={t("Dónde (juego no parado)")} sub={t("Zona y sector del campo")}>
          <Mirror rows={d.area} />
          <Sep />
          <Mirror rows={d.sector} head={false} />
        </Card>
        <Card title={t("Marcador y cambios")} sub={t("Según el momento del partido")}>
          <Mirror rows={d.stateRows} />
          <Sep />
          <Mirror rows={[{ label: msg("Tras un cambio (10')"), f: d.afterSub.f, a: d.afterSub.a }]} head={false} />
        </Card>
        <Card title={t("Fábrica de goles")} sub={t("Cómo se crean y cómo acaban")}>
          {d.create.length || d.finish.length ? (
            <>
              <Mirror rows={d.create} labelW={140} />
              {d.finish.length > 0 && <><Sep /><Mirror rows={d.finish} labelW={140} head={false} /></>}
            </>
          ) : <p style={{ fontSize: 12, color: RS.faint }}>{t("Aún no hay goles con «cómo se creó» o «remate».")}</p>}
        </Card>
        <Card title={t("Quién marca y quién asiste")} sub={t("Solo goles nuestros con jugador indicado")}>
          <div className="grid sm:grid-cols-3" style={{ gap: 16 }}>
            <List title={t("Goleadores")} items={d.scorers} fmt={pname} />
            <List title={t("Asistentes")} items={d.assisters} fmt={pname} />
            <List title={t("Parejas")} items={d.pairs} fmt={(k) => { const [a, s] = k.split(">"); return `${pname(a)} → ${pname(s)}`; }} />
          </div>
        </Card>
        <Card title={t("Balón parado")} sub={t("Tipo, cómo y por qué lado")}>
          {hasBp ? (
            <>
              <Mirror rows={d.bp.type} />
              <Sep />
              <Mirror rows={d.bp.how.filter((r) => r.f || r.a)} head={false} />
              <Sep />
              <Mirror rows={d.bp.side} head={false} />
            </>
          ) : <p style={{ fontSize: 12, color: RS.faint }}>{t("Sin goles de balón parado clasificados.")}</p>}
        </Card>
      </div>
    </div>
  );
}
