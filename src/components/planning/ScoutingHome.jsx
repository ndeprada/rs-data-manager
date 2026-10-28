// Planificación → Scouting → Resumen (maqueta «Scouting · Resumen» aprobada por Nacho)
import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, Kpi, Tag, Empty, Btn, SearchBox, RS, DECISION, ORIGIN, ORIGIN_KEYS, originOf, fmtDateTime, fmtDate, YearBadge } from "@/components/rs2/kit";
import { titleCase, fcfDisplayName } from "@/lib/fcfNames";
import { useScouted, useAllReports, useFollows, useFcfMeta, useAlerts, usePlanningNav, useIsPlanningAdmin } from "./useScouting";
import { spName, spYear, spMeta, contacted, teamInitials } from "./labels";

const selectStyle = { height: 48, border: "none", borderRadius: 10, padding: "0 12px", font: "inherit", fontSize: 15, color: RS.ink, background: "#fff", flex: "1 1 160px", minWidth: 0 };

export default function ScoutingHome() {
  const admin = useIsPlanningAdmin();
  const { go } = usePlanningNav();
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [comp, setComp] = useState("");
  const { data: scouted = [] } = useScouted();
  const { data: reports = [] } = useAllReports();
  const { data: follows = [] } = useFollows(admin);
  const { data: meta } = useFcfMeta(admin);
  const alerts = useAlerts(admin);

  const byId = useMemo(() => new Map(scouted.map((s) => [s.id, s])), [scouted]);
  const monthAgo = Date.now() - 30 * 864e5;
  const reportsMonth = reports.filter((r) => r.report_date && new Date(r.report_date).getTime() >= monthAgo).length;
  const groupsCount = meta ? new Set(meta.competitions.filter((c) => c.season === meta.seasons[0]).map((c) => `${c.competition}|${c.grp}`)).size : 0;
  const comps = meta ? [...new Set(meta.competitions.filter((c) => c.season === meta.seasons[0]).map((c) => c.competition))] : [];

  // En seguimiento por año de nacimiento (A/B/C)
  const years = useMemo(() => {
    const m = new Map();
    for (const p of scouted) {
      const y = spYear(p) || "Sin año";
      const e = m.get(y) || { year: y, fichar: 0, seguir_viendo: 0, descartar: 0, total: 0 };
      e[DECISION[p.decision] ? p.decision : "seguir_viendo"] += 1; e.total += 1;
      m.set(y, e);
    }
    return [...m.values()].sort((a, b) => (a.year === "Sin año") - (b.year === "Sin año") || a.year - b.year);
  }, [scouted]);
  const maxYear = Math.max(1, ...years.map((y) => y.total));
  const origins = ORIGIN_KEYS.map((k) => ({ k, n: scouted.filter((p) => originOf(p) === k).length }));

  const followCount = (f) => {
    if (f.kind !== "team") return null;
    const t = titleCase(f.team).toLowerCase();
    return scouted.filter((p) => String(p.current_club || "").toLowerCase() === t).length;
  };

  const search = (e) => {
    e?.preventDefault();
    go({ s: "bd", q: q.trim() || null, year: year || null, comp: comp || null });
  };

  return (
    <div className="flex flex-col" style={{ gap: 20 }} data-testid="scout-home">
      <section aria-label="Buscar" className="rs2-band flex flex-col" style={{ padding: "20px 22px", gap: 12 }}>
        <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 8 }}>
          <h1 className="rs2-display" style={{ margin: 0, fontSize: 40, lineHeight: 1 }}>Scouting</h1>
          {admin && (
            <span style={{ fontSize: 13, opacity: 0.85 }}>
              Cobertura FCF · Delegació Barcelona · {groupsCount} {groupsCount === 1 ? "grupo" : "grupos"} · actualizado {fmtDateTime(meta?.last_import)}
            </span>
          )}
        </div>
        <form onSubmit={search} className="flex flex-wrap" style={{ gap: 10 }}>
          <SearchBox big value={q} onChange={setQ} placeholder={admin ? "Jugador, equipo o club" : "Jugador o club"} testId="home-q" />
          {admin && (
            <>
              <label className="contents"><span className="sr-only">Año</span>
                <select value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle} aria-label="Año de nacimiento">
                  <option value="">Todos los años</option>
                  {Array.from({ length: 13 }, (_, i) => 2008 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="contents"><span className="sr-only">Competición</span>
                <select value={comp} onChange={(e) => setComp(e.target.value)} style={selectStyle} aria-label="Competición">
                  <option value="">Todas las competiciones</option>
                  {comps.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                </select>
              </label>
            </>
          )}
          <Btn kind="orange" type="submit" style={{ height: 48, padding: "0 22px" }} testId="home-search">Buscar</Btn>
        </form>
      </section>

      <section aria-label="Resumen" className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {admin && <Kpi label="Jugadores en base de datos" value={(meta?.players || 0).toLocaleString("es-ES")} sub={`${(meta?.actas || 0).toLocaleString("es-ES")} actas leídas`} testId="kpi-db" />}
        <Kpi label="En seguimiento" value={scouted.length} sub={`${reportsMonth} ${reportsMonth === 1 ? "informe" : "informes"} este mes`} testId="kpi-followed" />
        {admin && <Kpi label="Alertas nuevas" value={alerts.fresh.length} sub="Sin revisar todavía" testId="kpi-alerts" />}
        <Kpi label="Contactados" value={scouted.filter(contacted).length} sub={(() => { const n = scouted.filter((p) => p.contact_status === "interesado").length; return `${n} interesado${n === 1 ? "" : "s"}`; })()} testId="kpi-contacted" />
        {!admin && <Kpi label="Informes" value={reports.length} sub="De todos los jugadores" />}
      </section>

      <div className="flex flex-wrap items-start" style={{ gap: 20 }}>
        <div className="flex flex-col" style={{ flex: "999 1 620px", minWidth: 0, gap: 20 }}>
          {admin && (
            <Card pad={false} title="Acceso rápido · equipos y grupos seguidos" testId="home-follows"
              action={<button type="button" onClick={() => go({ s: "equipos" })} className="rs2-link" style={{ fontSize: 14, fontWeight: 600, color: RS.granate, background: "none" }}>Gestionar</button>}>
              {follows.length === 0 ? (
                <div style={{ padding: "0 18px 14px" }}><Empty>Marca equipos o grupos con la estrella en «Equipos y grupos» para tenerlos aquí.</Empty></div>
              ) : follows.slice(0, 8).map((f) => {
                const n = followCount(f);
                return (
                  <button key={f.id} type="button" className="rs2-row w-full text-left" onClick={() => go({ s: "equipos", comp: f.competition, grp: f.grp, team: f.kind === "team" ? f.team : null, season: f.season })}
                    style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) 92px 92px 20px", gap: 14, alignItems: "center", padding: "12px 18px", background: "none" }}>
                    <span style={{ width: 40, height: 40, borderRadius: 8, background: RS.soft, color: RS.granate, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {f.kind === "team" ? teamInitials(f.team) : `G${String(f.grp || "").replace(/\D/g, "")}`}
                    </span>
                    <span className="flex flex-col" style={{ minWidth: 0 }}>
                      <span className="truncate" style={{ fontWeight: 600, fontSize: 16 }}>{f.kind === "team" ? titleCase(f.team) : `${titleCase(f.competition)} · ${titleCase(f.grp)}`}</span>
                      <span className="truncate" style={{ fontSize: 13, color: RS.muted }}>{f.kind === "team" ? `${titleCase(f.competition)} · ${titleCase(f.grp)}` : "Grupo completo"}</span>
                    </span>
                    <span style={{ fontSize: 14, color: RS.ink2 }}>{f.kind === "team" ? "Equipo" : "Grupo"}</span>
                    <span className="hidden sm:inline">
                      {n !== null && <span style={{ display: "inline-block", fontSize: 13, fontWeight: n ? 600 : 400, padding: "3px 10px", borderRadius: 999, background: n ? RS.orangeSoft : RS.bg, color: n ? RS.orangeInk : RS.muted }}>{n ? `${n} seguido${n === 1 ? "" : "s"}` : "Ninguno"}</span>}
                    </span>
                    <ChevronRight width={18} height={18} color={RS.faint} aria-hidden="true" />
                  </button>
                );
              })}
            </Card>
          )}

          <Card title="Últimos informes" testId="home-reports"
            action={reports.length > 0 && <button type="button" onClick={() => go({ s: "informes" })} style={{ fontSize: 14, fontWeight: 600, color: RS.granate, background: "none" }}>Ver todos</button>}>
            {reports.length === 0 ? <Empty>Todavía no hay informes. Se crean desde la ficha de cada jugador.</Empty> : reports.slice(0, 4).map((r) => {
              const p = byId.get(r.player_id);
              return (
                <button key={r.id} type="button" onClick={() => p && go({ s: "jugador", sp: p.id })} className="rs2-row w-full text-left"
                  style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "2px 12px", padding: "10px 0", background: "none" }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{p ? spName(p) : "Jugador eliminado"}</span>
                  <span style={{ fontSize: 13, color: RS.muted }}>{fmtDate(r.report_date)}</span>
                  {p && <span style={{ fontSize: 13, color: RS.ink2, gridColumn: "1 / -1" }}>{spMeta(p)}</span>}
                  {(r.summary || r.strengths) && <span className="line-clamp-2" style={{ fontSize: 14, gridColumn: "1 / -1" }}>{r.summary || r.strengths}</span>}
                </button>
              );
            })}
          </Card>
        </div>

        <div className="flex flex-col" style={{ flex: "1 1 380px", minWidth: 0, gap: 20 }}>
          {admin && (
            <Card title="Alertas nuevas" testId="home-alerts"
              action={alerts.fresh.length > 0 && <button type="button" onClick={() => go({ s: "alertas" })} style={{ fontSize: 14, fontWeight: 600, color: RS.granate, background: "none" }}>Ver las {alerts.fresh.length}</button>}>
              {alerts.fresh.length === 0 ? <Empty>{alerts.isLoading ? "Calculando…" : "No hay alertas nuevas."}</Empty> : alerts.fresh.slice(0, 3).map((a) => (
                <button key={a.key} type="button" onClick={() => go({ s: "jugador", fcf: a.player_id })} className="rs2-row w-full text-left flex" style={{ gap: 12, padding: "10px 0", background: "none" }}>
                  <span style={{ flex: "none", alignSelf: "flex-start" }}><Tag kind={a.kind === "arriba" ? "orange" : "dark"}>{a.kind === "arriba" ? "POR ARRIBA" : "1.º AÑO"}</Tag></span>
                  <span className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                    <span className="flex flex-wrap items-center" style={{ gap: 8, fontWeight: 600, fontSize: 15 }}>{fcfDisplayName(a.name)}{a.birth_year ? <YearBadge year={a.birth_year} estimated /> : null}</span>
                    <span style={{ fontSize: 13, color: RS.ink2 }}>{titleCase(a.team)} · {titleCase(a.competition)} · {a.pj} PJ, {a.tit} titular</span>
                  </span>
                </button>
              ))}
            </Card>
          )}

          <Card title="En seguimiento por año" testId="home-years" action={<span style={{ fontSize: 13, color: RS.muted }}>{scouted.length} jugadores</span>}>
            {years.length === 0 ? <Empty>Nadie en seguimiento todavía.</Empty> : (
              <div className="flex flex-col" style={{ gap: 10, paddingTop: 4 }}>
                {years.map((y) => (
                  <div key={y.year} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 28px", gap: 10, alignItems: "center" }}>
                    <span className={y.year === "Sin año" ? "" : "rs2-display"} style={{ fontSize: y.year === "Sin año" ? 13 : 22, color: y.year === "Sin año" ? RS.muted : RS.granateDark }}>{y.year}</span>
                    <span className="flex" style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "#F1EBEA" }} title={`A ${y.fichar} · B ${y.seguir_viendo} · C ${y.descartar}`}>
                      <span style={{ width: `${(y.fichar / maxYear) * 100}%`, background: RS.granate }} />
                      <span style={{ width: `${(y.seguir_viendo / maxYear) * 100}%`, background: RS.naranja }} />
                      <span style={{ width: `${(y.descartar / maxYear) * 100}%`, background: "#CFC4C3" }} />
                    </span>
                    <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, textAlign: "right" }}>{y.total}</span>
                  </div>
                ))}
                <div className="flex flex-wrap" style={{ gap: 14, fontSize: 12, color: RS.ink2 }}>
                  {[["A · Fichar", RS.granate], ["B · Seguir viendo", RS.naranja], ["C · Descartado", "#CFC4C3"]].map(([l, c]) => (
                    <span key={l} className="flex items-center" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, borderTop: `1px solid ${RS.lineSoft}`, paddingTop: 10, marginTop: 12 }}>
              {origins.map((o) => (
                <button key={o.k} type="button" onClick={() => go({ s: "bd", mode: "seg", origin: o.k })} className="flex justify-between items-center"
                  style={{ background: RS.head, borderRadius: 8, padding: "8px 10px", fontSize: 14, textAlign: "left" }}>
                  <span>{ORIGIN[o.k]}</span><strong style={{ fontSize: 16 }}>{o.n}</strong>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
