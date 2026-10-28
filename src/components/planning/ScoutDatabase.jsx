// Planificación → Scouting → Base de datos (maqueta «Scouting · Base de datos» aprobada por Nacho)
// Dos listas: toda la FCF (jugadores leídos de las actas) o solo los jugadores en seguimiento del club.
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import ScoutedPlayerForm from "@/components/scouting/ScoutedPlayerForm";
import { base44 } from "@/api/base44Client";
import { juvenilYear, JUV_STYLE } from "@/lib/juvenilYear";
import { RS, YearBadge, Dorsals, DecisionChip, Tag, Pills, ORIGIN, ORIGIN_KEYS, DECISION_KEYS, DECISION, originOf, seasonShort, JuvLegend } from "@/components/rs2/kit";
import { titleCase, fcfDisplayName } from "@/lib/fcfNames";
import { SEASON, useScouted, useScoutedByFcf, useFcfMeta, useAlerts, usePlanningNav, useIsPlanningAdmin } from "./useScouting";
import { spName, spYear } from "./labels";

const PAGE = 50;
const csv = (s) => String(s || "").split(",").filter(Boolean);
const flabel = { fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: RS.muted };
const sel = { height: 44, border: `1px solid ${RS.input}`, borderRadius: 8, padding: "0 10px", font: "inherit", fontSize: 15, background: "#fff", width: "100%" };

function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function ScoutDatabase() {
  const admin = useIsPlanningAdmin();
  const { get, go } = usePlanningNav();
  const set = (patch) => go(patch, { keep: true, replace: true });
  const mode = admin ? (get("mode") === "seg" ? "seg" : "fcf") : "seg";
  const year = get("year");
  const comp = get("comp");
  const grp = get("grp");
  const sort = get("sort", "tit");
  const origins = csv(get("origin"));
  const states = csv(get("state"));
  const alertsFirst = get("af") !== "0";
  const [q, setQ] = useState(get("q"));
  const dq = useDebounced(q);
  useEffect(() => { if (dq !== get("q")) set({ q: dq.trim() || null }); }, [dq]);
  const [pages, setPages] = useState(1);
  useEffect(() => { setPages(1); }, [mode, year, comp, grp, sort, dq]);

  const qc = useQueryClient();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const create = useMutation({
    mutationFn: (data) => base44.entities.ScoutedPlayer.create(data),
    onSuccess: (created) => { qc.invalidateQueries({ queryKey: ["scouted_players"] }); setNewOpen(false); toast({ title: "Jugador añadido a seguimiento" }); if (created?.id) go({ s: "jugador", sp: created.id }); },
    onError: (e) => toast({ title: "No se ha podido añadir", description: e?.message, variant: "destructive" }),
  });
  const { data: meta } = useFcfMeta(admin);
  const { data: scouted = [] } = useScouted();
  const byFcf = useScoutedByFcf();
  const alerts = useAlerts(admin);
  const alertOf = useMemo(() => {
    const m = new Map();
    for (const a of alerts.list) if (!m.has(String(a.player_id))) m.set(String(a.player_id), a);
    return m;
  }, [alerts.list]);

  const comps = useMemo(() => {
    const m = new Map();
    for (const c of meta?.competitions || []) {
      if (c.season !== SEASON) continue;
      const e = m.get(c.competition) || [];
      e.push(c.grp); m.set(c.competition, e);
    }
    return m;
  }, [meta]);

  // ── Toda la FCF ──
  const { data: yc } = useQuery({ queryKey: ["fcf-years", SEASON], enabled: admin, queryFn: () => base44.club.fcfYears(SEASON), staleTime: 60_000 });
  const fcfFilters = { season: SEASON, sort, q: dq.trim().length >= 2 ? dq.trim() : undefined, year: year || undefined, competition: comp || undefined, grp: grp || undefined, limit: PAGE * pages };
  const fcf = useQuery({
    queryKey: ["fcf-search", fcfFilters], enabled: admin && mode === "fcf",
    queryFn: () => base44.club.fcfSearch(fcfFilters), placeholderData: (p) => p,
  });

  // ── En seguimiento ── (con sus números de la FCF si están vinculados)
  const segBase = useMemo(() => {
    const nq = dq.trim().toLowerCase();
    return scouted.filter((p) => {
      if (nq && !`${spName(p)} ${p.current_club || ""}`.toLowerCase().includes(nq)) return false;
      if (year && String(spYear(p)) !== String(year)) return false;
      if (origins.length && !origins.includes(originOf(p))) return false;
      if (states.length && !states.includes(DECISION[p.decision] ? p.decision : "sin")) return false;
      return true;
    });
  }, [scouted, dq, year, origins.join(), states.join()]);
  const segIds = segBase.map((p) => p.fcf_id).filter(Boolean).map(String);
  const segStats = useQuery({
    queryKey: ["fcf-search", "ids", SEASON, segIds.join(",")], enabled: admin && mode === "seg" && segIds.length > 0,
    queryFn: () => base44.club.fcfSearch({ season: SEASON, ids: segIds.join(","), limit: 500 }),
  });
  const statOf = useMemo(() => new Map((segStats.data?.rows || []).map((r) => [String(r.player_id), r])), [segStats.data]);

  const rows = useMemo(() => {
    if (mode === "fcf") {
      const list = (fcf.data?.rows || []).map((r) => {
        const sp = byFcf.get(String(r.player_id)) || null;
        return { key: `f:${r.player_id}`, fcf: r.player_id, sp, name: fcfDisplayName(r.name), year: r.birth_year, team: titleCase(r.team), comp: `${titleCase(r.competition)} · ${titleCase(r.grp)}`,
          dorsals: r.dorsals, pj: r.pj, tit: r.tit, goals: r.goals, origin: sp ? ORIGIN[originOf(sp)] : "—", decision: sp?.decision, alert: alertOf.get(String(r.player_id)) || null };
      });
      return alertsFirst ? [...list.filter((r) => r.alert), ...list.filter((r) => !r.alert)] : list;
    }
    return segBase.map((p) => {
      const st = p.fcf_id ? statOf.get(String(p.fcf_id)) : null;
      return { key: `s:${p.id}`, sp: p, fcf: p.fcf_id || null, name: spName(p), year: spYear(p) || st?.birth_year || null,
        team: st ? titleCase(st.team) : p.current_club || "—", comp: st ? `${titleCase(st.competition)} · ${titleCase(st.grp)}` : p.category || "",
        dorsals: st?.dorsals, pj: st?.pj ?? "", tit: st?.tit ?? "", goals: st?.goals ?? "", origin: ORIGIN[originOf(p)], decision: p.decision,
        alert: p.fcf_id ? alertOf.get(String(p.fcf_id)) || null : null };
    });
  }, [mode, fcf.data, segBase, statOf, byFcf, alertOf, alertsFirst]);
  const total = mode === "fcf" ? fcf.data?.total || 0 : segBase.length;
  const loading = mode === "fcf" ? fcf.isFetching : segStats.isFetching;

  const toggle = (key, list, v) => {
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    set({ [key]: next.join(",") || null, ...(admin ? { mode: "seg" } : {}) });
  };
  const yearButtons = mode === "fcf" ? (yc?.years || []).filter((y) => y.year >= 2006 && y.year <= 2020) : [...new Set(scouted.map(spYear).filter(Boolean))].sort().map((y) => ({ year: y, n: scouted.filter((p) => spYear(p) === y).length }));
  const open = (r) => (r.sp ? go({ s: "jugador", sp: r.sp.id }) : go({ s: "jugador", fcf: r.fcf }));
  const title = `${total.toLocaleString("es-ES")} ${total === 1 ? "jugador" : "jugadores"}${year ? ` · nacidos en ${year}` : ""}`;
  const subtitle = mode === "fcf"
    ? [comp ? titleCase(comp) : "Todas las competiciones", grp ? titleCase(grp) : null, "Delegació Barcelona", `temporada ${seasonShort(SEASON)}`].filter(Boolean).join(" · ")
    : "Jugadores en seguimiento del club";

  return (
    <div className="flex flex-wrap items-start" style={{ gap: 20 }} data-testid="scout-db">
      <aside aria-label="Filtros" className="rs2-card flex flex-col lg:sticky lg:top-4" style={{ flex: "1 1 260px", minWidth: 0, padding: "16px 18px", gap: 18 }}>
        <label className="flex flex-col" style={{ gap: 6 }}>
          <span style={flabel}>Buscar</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, equipo o club" className="rs2-input" data-testid="db-q" />
        </label>

        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend style={{ ...flabel, padding: 0, marginBottom: 8 }}>Año de nacimiento</legend>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 6 }}>
            {yearButtons.map((y) => {
              const on = String(y.year) === String(year);
              const jy = juvenilYear(y.year, SEASON);
              return (
                <button key={y.year} type="button" onClick={() => set({ year: on ? null : y.year })} title={`${y.n} jugadores`} data-testid={`db-year-${y.year}`}
                  style={{ minHeight: 40, borderRadius: 8, fontSize: 14, fontWeight: on ? 700 : 500, border: `1px solid ${on ? RS.granate : RS.input}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2,
                    display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.1, padding: "3px 2px" }}>
                  <span className="inline-flex items-center" style={{ gap: 4 }}>
                    {jy && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: JUV_STYLE[jy].bg, border: jy === 3 ? `1px solid ${RS.input}` : on ? "1px solid #fff" : "none" }} />}
                    {y.year}
                  </span>
                  {jy && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>Juv. {JUV_STYLE[jy].short}</span>}
                </button>
              );
            })}
          </div>
          {mode === "fcf" && yc?.unknown > 0 && <p style={{ fontSize: 12, color: RS.faint, margin: "6px 0 0" }}>{yc.unknown.toLocaleString("es-ES")} sin año todavía (juveniles: se deduce con la temporada anterior).</p>}
        </fieldset>

        {mode === "fcf" && (
          <>
            <label className="flex flex-col" style={{ gap: 6 }}>
              <span style={flabel}>Competición</span>
              <select value={comp} onChange={(e) => set({ comp: e.target.value || null, grp: null })} style={sel} data-testid="db-comp">
                <option value="">Todas</option>
                {[...comps.keys()].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </select>
            </label>
            {comp && (
              <label className="flex flex-col" style={{ gap: 6 }}>
                <span style={flabel}>Grupo</span>
                <select value={grp} onChange={(e) => set({ grp: e.target.value || null })} style={sel}>
                  <option value="">Todos</option>
                  {(comps.get(comp) || []).map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}
                </select>
              </label>
            )}
          </>
        )}

        <fieldset style={{ border: "none", margin: 0, padding: 0 }} className="flex flex-col">
          <legend style={{ ...flabel, padding: 0, marginBottom: 6 }}>Origen</legend>
          {ORIGIN_KEYS.map((k) => (
            <label key={k} className="flex items-center" style={{ gap: 10, minHeight: 36, fontSize: 15 }}>
              <input type="checkbox" checked={origins.includes(k)} onChange={() => toggle("origin", origins, k)} style={{ width: 18, height: 18, accentColor: RS.granate }} />
              <span style={{ flex: 1 }}>{ORIGIN[k]}</span>
              <span style={{ fontSize: 13, color: RS.muted }}>{scouted.filter((p) => originOf(p) === k).length}</span>
            </label>
          ))}
        </fieldset>

        <fieldset style={{ border: "none", margin: 0, padding: 0 }} className="flex flex-col">
          <legend style={{ ...flabel, padding: 0, marginBottom: 6 }}>Estado</legend>
          {[...DECISION_KEYS, "sin"].map((k) => (
            <label key={k} className="flex items-center" style={{ gap: 10, minHeight: 36, fontSize: 15 }}>
              <input type="checkbox" checked={states.includes(k)} onChange={() => toggle("state", states, k)} style={{ width: 18, height: 18, accentColor: RS.granate }} />
              <span>{k === "sin" ? "Sin valorar" : `${DECISION[k].letter} · ${DECISION[k].label}`}</span>
            </label>
          ))}
        </fieldset>

        {admin && mode === "fcf" && (
          <label className="flex items-center" style={{ gap: 10, minHeight: 44, fontSize: 15, fontWeight: 600, borderTop: `1px solid ${RS.lineSoft}`, paddingTop: 12 }}>
            <input type="checkbox" checked={alertsFirst} onChange={() => set({ af: alertsFirst ? "0" : null })} style={{ width: 18, height: 18, accentColor: RS.granate }} />
            Con alerta activa primero
          </label>
        )}
        {(year || comp || origins.length || states.length || q) && (
          <button type="button" onClick={() => { setQ(""); go({ s: "bd", mode: mode === "seg" ? "seg" : null }, { replace: true }); }} style={{ fontSize: 14, color: RS.granate, fontWeight: 600, background: "none", textAlign: "left" }}>Quitar filtros</button>
        )}
      </aside>

      <section aria-labelledby="db-title" className="rs2-card" style={{ flex: "999 1 680px", minWidth: 0, overflow: "hidden" }}>
        <div className="flex flex-wrap justify-between items-center" style={{ gap: 10, padding: "16px 18px" }}>
          <div className="flex flex-col" style={{ gap: 2 }}>
            <h1 id="db-title" style={{ margin: 0, fontSize: 22 }}>{title}</h1>
            <span style={{ fontSize: 13, color: RS.muted }}>{subtitle}</span>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
            {admin && (
              <Pills value={mode} onChange={(v) => set({ mode: v === "seg" ? "seg" : null, comp: v === "seg" ? null : comp, grp: v === "seg" ? null : grp })}
                options={[{ value: "fcf", label: `Toda la FCF${meta ? ` (${meta.players.toLocaleString("es-ES")})` : ""}`, testId: "db-mode-fcf" }, { value: "seg", label: `En seguimiento (${scouted.length})`, testId: "db-mode-seg" }]} />
            )}
            {mode === "fcf" && (
              <label className="flex items-center" style={{ gap: 8, fontSize: 14, color: RS.ink2 }}>Ordenar por
                <select value={sort} onChange={(e) => set({ sort: e.target.value === "tit" ? null : e.target.value })} style={{ ...sel, height: 40, width: "auto", fontSize: 14 }}>
                  <option value="tit">Partidos de titular</option><option value="goals">Goles</option><option value="pj">Partidos jugados</option><option value="name">Apellido</option>
                </select>
              </label>
            )}
            {mode === "seg" && (
              <button type="button" onClick={() => setNewOpen(true)} data-testid="db-new" className="inline-flex items-center"
                style={{ height: 36, gap: 6, padding: "0 12px", borderRadius: 8, background: RS.granate, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                <Plus width={16} height={16} />Añadir jugador
              </button>
            )}
            {loading && <Loader2 className="animate-spin" width={16} height={16} color={RS.faint} />}
          </div>
        </div>
        <div className="rs2-scroll-x">
          <table className="rs2-tbl" style={{ minWidth: 960 }} data-testid="db-table">
            <thead>
              <tr>
                <th className="l" scope="col">Jugador</th><th scope="col">Año</th><th scope="col" title="Dorsal habitual esta temporada (y otros que ha llevado)">Dorsal</th><th className="l" scope="col">Equipo · competición</th>
                <th scope="col">PJ</th><th scope="col">Titular</th><th scope="col">Goles</th><th className="l" scope="col">Origen</th><th className="l" scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="rs2-click" onClick={() => open(r)} data-testid={`db-row-${r.fcf || r.sp?.id}`}>
                  <td className="l">
                    <button type="button" onClick={(e) => { e.stopPropagation(); open(r); }} className="inline-flex items-center" style={{ gap: 8, fontWeight: 600, color: RS.ink, background: "none", textAlign: "left" }}>
                      {r.name}
                      {r.alert && <Tag kind={r.alert.kind === "arriba" ? "orange" : "dark"}>{r.alert.kind === "arriba" ? "POR ARRIBA" : "1.º AÑO"}</Tag>}
                    </button>
                  </td>
                  <td><YearBadge year={r.year} up={r.alert?.kind === "arriba"} estimated={!!r.fcf} /></td>
                  <td>{r.fcf ? <Dorsals list={r.dorsals} /> : <span style={{ color: RS.faint }}>—</span>}</td>
                  <td className="l" style={{ whiteSpace: "normal", minWidth: 240 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{r.team}</span>
                    {r.comp && <span style={{ display: "block", fontSize: 13, color: RS.muted }}>{r.comp}</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.pj}</td>
                  <td>{r.tit}</td>
                  <td style={{ fontWeight: 700, color: RS.granate }}>{r.goals}</td>
                  <td className="l" style={{ fontSize: 14, color: RS.ink2 }}>{r.origin}</td>
                  <td className="l"><DecisionChip decision={r.decision} empty={r.sp ? "Sin valorar" : "—"} short /></td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td colSpan={9} style={{ padding: "40px 18px", color: RS.faint, textAlign: "center" }}>
                  {mode === "fcf" ? (meta?.actas ? "Ningún jugador con estos filtros." : "Todavía no hay datos de la FCF.") : "Ningún jugador en seguimiento con estos filtros."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center" style={{ gap: 10, padding: "12px 18px", fontSize: 14, color: RS.ink2, borderTop: `1px solid ${RS.lineSoft}` }}>
          <span className="flex flex-wrap items-center" style={{ gap: "4px 18px" }}><span>Mostrando {rows.length.toLocaleString("es-ES")} de {total.toLocaleString("es-ES")}</span><JuvLegend /></span>
          {mode === "fcf" && rows.length < total && (
            <button type="button" onClick={() => setPages((p) => p + 1)} disabled={loading} style={{ fontWeight: 600, color: RS.granate, background: "none" }}>Cargar más</button>
          )}
        </div>
        <p style={{ margin: 0, padding: "10px 18px", fontSize: 12, color: RS.faint, borderTop: `1px solid ${RS.lineSoft}` }}>
          PJ = partidos en acta (titular + suplente); las actas de fútbol base no registran cambios, por eso no hay minutos. El año sale de la categoría más joven en la que ha jugado (en naranja, si juega por arriba).
        </p>
      </section>
      <ScoutedPlayerForm open={newOpen} onOpenChange={setNewOpen} player={null} onSave={(d) => create.mutate(d)} isLoading={create.isPending} />
    </div>
  );
}
