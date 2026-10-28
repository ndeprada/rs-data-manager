// Planificación → Plantillas, piezas con el diseño de la maqueta aprobada por Nacho (28/10/2026): selector de equipos en pastillas, banda del
// equipo planificado, cobertura por línea y vista en columnas (Continúan · En duda · No continúan · Incorporaciones). El campograma no cambia.
import React from "react";
import { RS, DECISION as DEC2 } from "@/components/rs2/kit";
import { GROUPS, groupOf, POSITION_LABEL, zoneTitle, LEAVE, roleFull } from "@/lib/squadPlan";

const POS_SHORT = { portero: "POR", libre: "LIB", central: "DFC", lateral: "LAT", mediocentro: "MC", interior: "INT", mediapunta: "MP", extremo: "EXT", delantero_centro: "DC" };

export function TeamPills({ teams, value, onChange }) {
  return (
    <nav aria-label="Equipos" className="flex flex-wrap" style={{ gap: 6 }} data-testid="plan-team-pills">
      {teams.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} data-testid={`plan-team-${t.id}`}
            style={{ minHeight: 28, padding: "0 11px", borderRadius: 7, fontSize: 12.5, fontWeight: on ? 600 : 400, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, border: `1px solid ${on ? RS.granate : RS.line}` }}>
            {t.name}
          </button>
        );
      })}
    </nav>
  );
}

const mode = (arr) => {
  const m = new Map(); let best = null, n = 0;
  for (const x of arr) { if (!x) continue; const c = (m.get(x) || 0) + 1; m.set(x, c); if (c > n) { n = c; best = x; } }
  return best;
};

export function PlanBand({ team, season, isF7, plan, players }) {
  const { total } = plan.summary;
  const year = mode(players.filter((p) => p.status !== "baja").map((p) => Number(p.birth_year) || Number(String(p.birth_date || "").slice(0, 4)) || null));
  const stats = [
    ["Prevista", total.prevista, true], ["Continúan", total.continua], ["Dudas", total.duda], ["Bajas", total.sale], ["Objetivos", total.objetivo], ["Pases", total.llega + total.pasa],
  ];
  return (
    <section aria-label="Equipo planificado" className="rs2-band flex flex-wrap items-center" style={{ padding: "7px 14px", gap: "6px 24px", borderRadius: 10 }} data-testid="plan-band">
      <div className="flex flex-wrap items-baseline" style={{ flex: "999 1 340px", gap: "2px 12px", minWidth: 0 }}>
        <h1 className="rs2-display" style={{ margin: 0, fontSize: 22, color: "#fff" }}>{team.name}</h1>
        <span style={{ fontSize: 11.5, opacity: 0.85 }}>Temporada {season} · {isF7 ? "F7" : "F11"}{year ? ` · nacidos en ${year}` : ""} · base: {players.filter((p) => p.status !== "baja").length} jugadores</span>
      </div>
      <div className="flex flex-wrap items-baseline" style={{ gap: "2px 16px" }} data-testid="plan-stats">
        {stats.map(([l, v, accent]) => (
          <span key={l} className="inline-flex items-baseline" style={{ gap: 5 }}>
            <span className="rs2-display tabular-nums" style={{ fontSize: 19, lineHeight: 1, color: accent ? RS.naranja : "#fff" }} data-testid={l === "Prevista" ? "plan-total" : undefined}>{v}</span>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.8 }}>{l}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

export function Coverage({ plan, onZone }) {
  const { groups } = plan.summary;
  const max = Math.max(1, ...GROUPS.map((g) => groups[g].continua + groups[g].objetivo + groups[g].duda));
  return (
    <section aria-labelledby="cobertura" className="rs2-card flex flex-wrap items-center" style={{ padding: "6px 14px", gap: "6px 24px" }} data-testid="plan-coverage">
      <h2 id="cobertura" style={{ margin: 0, fontSize: 13, flex: "none" }}>Cobertura por línea</h2>
      <div className="grid" style={{ flex: "1 1 600px", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {GROUPS.map((g) => {
          const r = groups[g];
          const needs = plan.needs.filter((z) => groupOf(z.pos) === g);
          return (
            <div key={g} className="flex flex-col" style={{ gap: 3 }}>
              <span className="flex justify-between" style={{ fontSize: 12 }}>
                <strong>{g}</strong>
                <span className="tabular-nums" title="Continúan + objetivos">{r.prevista} previstos{r.duda ? ` · ${r.duda} en duda` : ""}</span>
              </span>
              <span className="flex" style={{ height: 6, borderRadius: 999, background: "#F1EBEA", overflow: "hidden" }}>
                <span style={{ width: `${(r.continua / max) * 100}%`, background: RS.granate }} />
                <span style={{ width: `${(r.objetivo / max) * 100}%`, background: RS.naranja }} />
                <span style={{ width: `${(r.duda / max) * 100}%`, background: "#F2C38B" }} />
              </span>
              {needs.length ? (
                <span style={{ fontSize: 11, color: RS.orangeInk }}>
                  A reforzar: {needs.map((z, i) => (
                    <button key={z.key} type="button" onClick={() => onZone(z.key)} style={{ color: RS.orangeInk, fontWeight: 600, background: "none", textDecoration: "underline" }}>
                      {zoneTitle(z).toLowerCase()}{i < needs.length - 1 ? ", " : ""}
                    </button>
                  ))}
                </span>
              ) : <span style={{ fontSize: 11, color: RS.muted }}>Sin puestos a reforzar</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col" style={{ gap: 2, fontSize: 10.5, color: RS.ink2, flex: "none" }}>
        {[["Continúan", RS.granate], ["Objetivos de scouting", RS.naranja], ["En duda", "#F2C38B"]].map(([l, c]) => (
          <span key={l} className="flex items-center" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}</span>
        ))}
      </div>
    </section>
  );
}

function tagOf(it) {
  const b = { fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap" };
  if (it.kind === "scout") {
    const d = DEC2[it.decision];
    return it.status === "seguido" ? { text: "Seguido", style: { ...b, background: "#EEF2FF", color: "#3730A3" } }
      : { text: d ? `Objetivo · ${d.letter}` : "Objetivo", style: { ...b, background: RS.orangeSoft, color: RS.orangeInk } };
  }
  if (it.pass === "out") return { text: `Pasa a ${it.passTeam?.name || "otro equipo"}`, style: { ...b, background: "#CCFBF1", color: "#115E59" } };
  if (it.pass === "in" && it.status !== "sale") return { text: `Viene de ${it.passTeam?.name || "otro equipo"}`, style: { ...b, background: "#DDEEDF", color: "#1F5A2A" } };
  if (it.status === "sale") return { text: it.leave ? LEAVE[it.leave].label : "Baja", style: { ...b, background: "#ECE8E8", color: "#5A5052" } };
  if (it.status === "duda") return { text: "Duda", style: { ...b, background: "#FDF0D9", color: "#8A5A00" } };
  return null;
}

function PlanCard({ it, onOpen }) {
  const tag = tagOf(it);
  const sub = [it.year, it.position ? (it.posRole ? roleFull(it.posRole) : POSITION_LABEL[it.position]) : "Sin posición", it.kind === "scout" && it.club ? it.club : null, it.note || null].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={() => onOpen(it)} data-testid={`col-${it.key}`}
      style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) auto", gap: 10, alignItems: "center", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10, padding: "8px 10px", textAlign: "left", width: "100%" }}>
      <span style={{ height: 32, borderRadius: 6, background: RS.soft, color: RS.granateDark, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{POS_SHORT[it.position] || "—"}</span>
      <span className="flex flex-col" style={{ minWidth: 0 }}>
        <span className="truncate" style={{ fontWeight: 600, fontSize: 13, color: it.status === "sale" ? RS.faint : RS.ink, textDecoration: it.status === "sale" ? "line-through" : "none" }}>{it.name}</span>
        <span className="truncate" style={{ fontSize: 11, color: RS.muted }}>{sub}</span>
      </span>
      {tag ? <span style={tag.style}>{tag.text}</span> : <span />}
    </button>
  );
}

const byPos = (a, b) => (POSITIONS_ORDER[a.position] ?? 99) - (POSITIONS_ORDER[b.position] ?? 99) || a.name.localeCompare(b.name, "es");
const POSITIONS_ORDER = { portero: 0, libre: 1, central: 2, lateral: 3, mediocentro: 4, interior: 5, mediapunta: 6, extremo: 7, delantero_centro: 8 };

export function ColumnsView({ plan, onItem, onAddScout, onAddClub }) {
  const items = plan.items;
  const cont = items.filter((i) => i.kind === "player" && i.status === "continua" && i.pass !== "in").sort(byPos);
  const duda = items.filter((i) => i.kind === "player" && i.status === "duda").sort(byPos);
  const out = items.filter((i) => i.kind === "player" && (i.status === "sale" || i.pass === "out")).sort(byPos);
  const promo = items.filter((i) => i.kind === "player" && i.pass === "in" && i.status === "continua").sort(byPos);
  const scout = items.filter((i) => i.kind === "scout").sort((a, b) => (a.status === "seguido") - (b.status === "seguido") || byPos(a, b));
  const dot = (c) => <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />;
  const col = (title, color, list, groups, footer, testId) => (
    <section style={{ background: "#EFE9E8", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }} data-testid={testId}>
      <div className="flex justify-between items-center" style={{ padding: "2px 4px 4px" }}>
        <h3 className="flex items-center" style={{ margin: 0, fontSize: 14, gap: 8 }}>{dot(color)}{title}</h3>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{list.length}</span>
      </div>
      {(groups || [{ label: "", list }]).map((g) => (
        <React.Fragment key={g.label || "all"}>
          {g.label && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: RS.muted, padding: "6px 4px 0" }}>{g.label}</span>}
          {g.list.map((it) => <PlanCard key={it.key} it={it} onOpen={onItem} />)}
          {g.label && g.list.length === 0 && <span style={{ fontSize: 12, color: RS.faint, padding: "0 4px" }}>Ninguno</span>}
        </React.Fragment>
      ))}
      {!groups && list.length === 0 && <span style={{ fontSize: 12, color: RS.faint, padding: "0 4px" }}>Nadie</span>}
      {footer}
    </section>
  );
  const addBtn = (label, onClick, testId) => (
    <button type="button" onClick={onClick} data-testid={testId} style={{ minHeight: 32, border: "1px dashed #BFB2B1", borderRadius: 10, background: "transparent", color: RS.ink2, fontSize: 13 }}>{label}</button>
  );
  return (
    <div className="grid items-start" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }} data-testid="plan-columns">
      {col("Continúan", RS.granate, cont, null, null, "colgroup-continua")}
      {col("En duda", RS.naranja, duda, null, null, "colgroup-duda")}
      {col("No continúan", RS.faint, out, null, null, "colgroup-sale")}
      {col("Incorporaciones", RS.granateDark, [...promo, ...scout], [{ label: "Promocionados del club", list: promo }, { label: "Scouting", list: scout }],
        <div className="flex flex-col" style={{ gap: 6 }}>{addBtn("+ Proponer desde Scouting", onAddScout, "col-add-scout")}{addBtn("+ Traer de otro equipo", onAddClub, "col-add-club")}</div>, "colgroup-in")}
    </div>
  );
}
