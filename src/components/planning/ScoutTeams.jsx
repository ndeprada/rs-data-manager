// Planificación → Scouting → Equipos y grupos (maqueta «Scouting · Plantilla de un equipo» aprobada por Nacho)
// Competiciones → grupos → equipos, la plantilla de cada equipo según las actas de la FCF y la estrella para tenerlo en «Acceso rápido».
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import ObservedTeamsList from "@/components/scouting/ObservedTeamsList";
import { RS, Card, Btn, BackLink, YearBadge, Dorsals, DecisionChip, Empty, SearchBox, fmtDateTime, seasonShort } from "@/components/rs2/kit";
import { titleCase, fcfDisplayName } from "@/lib/fcfNames";
import { SEASON, useFcfMeta, useFollows, useScoutedByFcf, useAlerts, useUpIds, usePlanningNav, useIsPlanningAdmin } from "./useScouting";
import { SCOUT_POSITION, LATERALITY, teamInitials } from "./labels";

const isF7Comp = (c) => /ALEV|BENJAM|PREBENJ/i.test(c);
const stageOf = (c) => (/JUVENIL/i.test(c) ? "Juvenil" : /CADET/i.test(c) ? "Cadet" : /INFANTIL/i.test(c) ? "Infantil" : /ALEV/i.test(c) ? "Aleví" : /BENJAM/i.test(c) ? "Benjamí" : "Otras");
const STAGES = ["Juvenil", "Cadet", "Infantil", "Aleví", "Benjamí", "Otras"];

function useFollowToggle() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: follows = [] } = useFollows();
  const find = (kind, comp, grp, team) => follows.find((f) => f.kind === kind && f.competition === comp && f.grp === grp && (kind === "group" || f.team === team));
  const m = useMutation({
    mutationFn: async ({ kind, season, competition, grp, team }) => {
      const ex = find(kind, competition, grp, team);
      if (ex) { await base44.entities.ScoutFollow.delete(ex.id); return false; }
      await base44.entities.ScoutFollow.create({ kind, season, competition, grp, team: kind === "team" ? team : null });
      return true;
    },
    onSuccess: (on) => { qc.invalidateQueries({ queryKey: ["scout_follows"] }); toast({ title: on ? "Añadido a Acceso rápido" : "Quitado de Acceso rápido" }); },
    onError: () => toast({ title: "No se ha podido guardar", variant: "destructive" }),
  });
  return { find, toggle: m.mutate, busy: m.isPending };
}

function StarButton({ on, onClick, busy, label }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} data-testid="follow-toggle"
      className="inline-flex items-center" style={{ height: 44, gap: 8, padding: "0 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: on ? "none" : "1px solid #fff",
        background: on ? RS.naranja : "transparent", color: on ? RS.ink : "#fff" }}>
      <Star width={16} height={16} fill={on ? RS.ink : "none"} color={on ? RS.ink : "#fff"} aria-hidden="true" />
      {on ? `${label} seguido` : `Seguir ${label.toLowerCase()}`}
    </button>
  );
}

export default function ScoutTeams() {
  const admin = useIsPlanningAdmin();
  const { get } = usePlanningNav();
  if (!admin) return <ObservedTeamsList />;
  const comp = get("comp"), grp = get("grp"), team = get("team");
  const season = get("season") || SEASON;
  if (team) return <TeamView season={season} comp={comp} grp={grp} team={team} />;
  if (comp && grp) return <GroupView season={season} comp={comp} grp={grp} />;
  return <Browser />;
}

function Browser() {
  const { go } = usePlanningNav();
  const { data: meta, isLoading } = useFcfMeta();
  const { data: follows = [] } = useFollows();
  const [stage, setStage] = useState("todas");
  const tree = useMemo(() => {
    const m = new Map();
    for (const c of meta?.competitions || []) {
      if (c.season !== SEASON) continue;
      const e = m.get(c.competition) || { name: c.competition, groups: [], actas: 0 };
      e.groups.push({ grp: c.grp, actas: c.actas }); e.actas += c.actas;
      m.set(c.competition, e);
    }
    return [...m.values()];
  }, [meta]);
  const stages = STAGES.filter((s) => tree.some((c) => stageOf(c.name) === s));
  const shown = stage === "todas" ? tree : tree.filter((c) => stageOf(c.name) === stage);

  return (
    <div className="flex flex-col" style={{ gap: 20 }} data-testid="scout-teams">
      <div className="flex flex-wrap items-end justify-between" style={{ gap: 12 }}>
        <div>
          <h1 className="rs2-display" style={{ margin: 0, fontSize: 40, color: RS.granateDark }}>Equipos y grupos</h1>
          <span style={{ fontSize: 14, color: RS.ink2 }}>Competiciones leídas de la FCF · temporada {seasonShort(SEASON)} · pulsa un grupo para ver sus equipos</span>
        </div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {["todas", ...stages].map((s) => (
            <button key={s} type="button" onClick={() => setStage(s)} style={{ height: 36, padding: "0 12px", borderRadius: 999, fontSize: 13, fontWeight: stage === s ? 600 : 400,
              border: `1px solid ${stage === s ? RS.granate : RS.input}`, background: stage === s ? RS.granate : "#fff", color: stage === s ? "#fff" : RS.ink2 }}>{s === "todas" ? "Todas" : s}</button>
          ))}
        </div>
      </div>

      {follows.length > 0 && (
        <Card title="Seguidos" testId="teams-follows">
          <div className="flex flex-wrap" style={{ gap: 8, paddingTop: 4 }}>
            {follows.map((f) => (
              <button key={f.id} type="button" onClick={() => go({ s: "equipos", comp: f.competition, grp: f.grp, team: f.kind === "team" ? f.team : null, season: f.season })}
                className="inline-flex items-center" style={{ gap: 8, minHeight: 40, padding: "0 12px", borderRadius: 8, background: RS.orangeSoft, color: RS.orangeInk, fontSize: 14, fontWeight: 600 }}>
                <Star width={14} height={14} fill={RS.orangeInk} color={RS.orangeInk} aria-hidden="true" />
                {f.kind === "team" ? titleCase(f.team) : `${titleCase(f.competition)} · ${titleCase(f.grp)}`}
              </button>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? <Loader2 className="animate-spin" color={RS.faint} /> : shown.length === 0 ? (
        <Card><Empty>Todavía no hay competiciones leídas de la FCF.</Empty></Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {shown.map((c) => (
            <section key={c.name} className="rs2-card" style={{ padding: "14px 18px" }}>
              <div className="flex justify-between items-baseline" style={{ gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17 }}>{titleCase(c.name)}</h2>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: RS.soft, color: RS.granateDark }}>{isF7Comp(c.name) ? "F7" : "F11"}</span>
              </div>
              <span style={{ fontSize: 13, color: RS.muted }}>{c.groups.length} {c.groups.length === 1 ? "grupo" : "grupos"} · {c.actas} actas</span>
              <div className="flex flex-wrap" style={{ gap: 6, marginTop: 10 }}>
                {c.groups.map((g) => (
                  <button key={g.grp} type="button" onClick={() => go({ s: "equipos", comp: c.name, grp: g.grp })} data-testid={`grp-${g.grp}`}
                    style={{ minHeight: 36, padding: "0 12px", borderRadius: 8, background: RS.bg, color: RS.ink2, fontSize: 14 }}>
                    {titleCase(g.grp).replace("Grup ", "G")}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card title="Equipos observados" action={<span style={{ fontSize: 13, color: RS.muted }}>Fichas propias con notas y jugadores apuntados a mano</span>}>
        <ObservedTeamsList />
      </Card>
    </div>
  );
}

function GroupView({ season, comp, grp }) {
  const { go } = usePlanningNav();
  const { find, toggle, busy } = useFollowToggle();
  const { data: teams = [], isLoading } = useQuery({ queryKey: ["fcf-group-teams", season, comp, grp], queryFn: () => base44.club.fcfGroupTeams({ season, competition: comp, grp }) });
  const followed = !!find("group", comp, grp);
  return (
    <div className="flex flex-col" style={{ gap: 20 }} data-testid="scout-group">
      <BackLink onClick={() => go({ s: "equipos" })}>Equipos y grupos</BackLink>
      <section className="rs2-band flex flex-wrap items-center" style={{ padding: "18px 22px", gap: "18px 32px" }}>
        <div className="flex flex-col" style={{ flex: "999 1 360px", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{isF7Comp(comp) ? "Fútbol 7" : "Fútbol 11"} · temporada {seasonShort(season)}</span>
          <h1 className="rs2-display" style={{ margin: 0, fontSize: 40 }}>{titleCase(comp)}</h1>
          <span style={{ fontSize: 15, opacity: 0.9 }}>{titleCase(grp)} · {teams.length} equipos</span>
        </div>
        <StarButton on={followed} busy={busy} label="Grupo" onClick={() => toggle({ kind: "group", season, competition: comp, grp })} />
      </section>
      <Card pad={false} title="Equipos" action={isLoading && <Loader2 className="animate-spin" width={16} height={16} color={RS.faint} />}>
        {teams.map((t) => (
          <button key={t.team} type="button" onClick={() => go({ s: "equipos", comp, grp, team: t.team, season })} className="rs2-row w-full text-left" data-testid={`team-${t.team}`}
            style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) 110px 80px 20px", gap: 14, alignItems: "center", padding: "12px 18px", background: "none" }}>
            <span style={{ width: 40, height: 40, borderRadius: 8, background: RS.soft, color: RS.granate, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{teamInitials(t.team)}</span>
            <span className="flex flex-col" style={{ minWidth: 0 }}>
              <span className="truncate" style={{ fontWeight: 600, fontSize: 16 }}>{titleCase(t.team)}</span>
              {find("team", comp, grp, t.team) && <span style={{ fontSize: 12, color: RS.orangeInk, fontWeight: 600 }}>★ Seguido</span>}
            </span>
            <span style={{ fontSize: 14, color: RS.ink2 }}>{t.players} jugadores</span>
            <span style={{ fontSize: 14, color: RS.ink2 }}>{t.pj} PJ</span>
            <ChevronRight width={18} height={18} color={RS.faint} aria-hidden="true" />
          </button>
        ))}
        {!isLoading && teams.length === 0 && <div style={{ padding: "0 18px 14px" }}><Empty>No hay actas leídas de este grupo.</Empty></div>}
      </Card>
    </div>
  );
}

function TeamView({ season, comp, grp, team }) {
  const { go } = usePlanningNav();
  const { find, toggle, busy } = useFollowToggle();
  const byFcf = useScoutedByFcf();
  const alerts = useAlerts();
  const upIds = useUpIds(alerts.list);
  const [q, setQ] = useState("");
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const { data: sq, isLoading } = useQuery({ queryKey: ["fcf-team", season, comp, grp, team], queryFn: () => base44.club.fcfTeam({ season, competition: comp || undefined, grp: grp || undefined, team }) });
  const players = sq?.players || [];
  const followedCount = players.filter((p) => byFcf.has(String(p.player_id))).length;
  const nq = q.trim().toLowerCase();
  const rows = players.filter((p) => (!onlyFollowed || byFcf.has(String(p.player_id))) && (!nq || fcfDisplayName(p.name).toLowerCase().includes(nq)));
  // Composición por año de nacimiento
  const comp2 = useMemo(() => {
    const m = new Map();
    for (const p of players) { const y = p.birth_year || "—"; const e = m.get(y) || { year: y, n: 0, up: 0 }; e.n += 1; if (upIds.has(String(p.player_id))) e.up += 1; m.set(y, e); }
    return [...m.values()].sort((a, b) => (a.year === "—") - (b.year === "—") || b.n - a.n);
  }, [players, upIds]);
  const followed = !!find("team", sq?.competition || comp, sq?.grp || grp, team);

  return (
    <div className="flex flex-col" style={{ gap: 20 }} data-testid="scout-team">
      <BackLink onClick={() => go(comp && grp ? { s: "equipos", comp, grp, season } : { s: "equipos" })}>{comp && grp ? `${titleCase(comp)} · ${titleCase(grp)}` : "Equipos y grupos"}</BackLink>

      <section aria-label="Equipo" className="rs2-band flex flex-wrap items-center" style={{ padding: "22px 24px", gap: "20px 32px" }}>
        <div className="flex items-center" style={{ gap: 16, flex: "999 1 420px", minWidth: 0 }}>
          <span style={{ width: 64, height: 64, borderRadius: 12, background: RS.granate, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{teamInitials(team)}</span>
          <div className="flex flex-col" style={{ gap: 4, minWidth: 0 }}>
            <h1 className="rs2-display" style={{ margin: 0, fontSize: 40 }}>{titleCase(team)}</h1>
            <span style={{ fontSize: 15, opacity: 0.9 }}>{[titleCase(sq?.competition || comp), titleCase(sq?.grp || grp), seasonShort(season)].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(64px, auto))", gap: "4px 22px", flex: "1 1 auto" }}>
          {["Partidos", "Jugadores", "Goles", "Seguidos"].map((l) => <span key={l} style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.8 }}>{l}</span>)}
          {[sq?.pj ?? "–", players.length, sq?.goals ?? "–", followedCount].map((v, i) => (
            <span key={i} className="rs2-display tabular-nums" style={{ fontSize: 34, lineHeight: 1, color: i === 3 && v ? RS.naranja : "#fff" }}>{v}</span>
          ))}
        </div>
        <div className="flex flex-col items-start" style={{ gap: 8, flex: "1 1 200px" }}>
          <StarButton on={followed} busy={busy} label="Equipo" onClick={() => toggle({ kind: "team", season, competition: sq?.competition || comp, grp: sq?.grp || grp, team })} />
          <span style={{ fontSize: 12, opacity: 0.8 }}>Última lectura FCF · {fmtDateTime(sq?.last_import)}</span>
        </div>
      </section>

      <section aria-label="Composición por año" className="flex flex-wrap items-center" style={{ gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: RS.ink2, marginRight: 4 }}>Año de nacimiento</span>
        {comp2.map((c) => (
          <span key={c.year} className="inline-flex items-center" style={{ gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 14,
            background: c.up ? RS.orangeSoft : "#fff", border: `1px solid ${c.up ? "#F6C9A6" : RS.line}`, color: c.up ? RS.orangeInk : RS.ink }}>
            <strong style={{ fontSize: 16 }}>{c.n}</strong> × {c.year === "—" ? "sin año" : c.year}{c.up ? ` · ${c.up} juega${c.up === 1 ? "" : "n"} por arriba` : ""}
          </span>
        ))}
        <span style={{ flex: "1 1 auto" }} />
        <label className="inline-flex items-center" style={{ gap: 8, fontSize: 14, color: RS.ink2, minHeight: 44 }}>
          <input type="checkbox" checked={onlyFollowed} onChange={(e) => setOnlyFollowed(e.target.checked)} style={{ width: 18, height: 18, accentColor: RS.granate }} />
          Solo seguidos
        </label>
        <div style={{ width: 240, maxWidth: "100%" }}><SearchBox value={q} onChange={setQ} placeholder="Nombre o apellidos" /></div>
      </section>

      <section aria-labelledby="squad-title" className="rs2-card" style={{ overflow: "hidden" }}>
        <div className="flex flex-wrap justify-between items-baseline" style={{ gap: 8, padding: "16px 18px" }}>
          <h2 id="squad-title" className="rs2-title">Plantilla · {players.length} jugadores</h2>
          <span style={{ fontSize: 13, color: RS.muted }}>Según las actas de la temporada {seasonShort(season)} en esta competición</span>
        </div>
        <div className="rs2-scroll-x">
          <table className="rs2-tbl" style={{ minWidth: 900 }} data-testid="squad-table">
            <thead>
              <tr>
                <th scope="col" title="Dorsal habitual en este equipo (y otros que ha llevado)">Dorsal</th><th className="l" scope="col">Jugador</th><th scope="col">Año</th><th scope="col">PJ</th><th scope="col">Titular</th><th scope="col">Suplente</th>
                <th scope="col">Goles</th><th scope="col" title="Amarillas">TA</th><th scope="col" title="Rojas">TR</th><th className="l" scope="col">Posición · Lateralidad</th><th className="l" scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const sp = byFcf.get(String(p.player_id));
                const pos = sp ? [SCOUT_POSITION[sp.position], LATERALITY[sp.laterality]].filter(Boolean).join(" · ") : "";
                return (
                  <tr key={p.player_id} className="rs2-click" onClick={() => go(sp ? { s: "jugador", sp: sp.id } : { s: "jugador", fcf: p.player_id })}>
                    <td><Dorsals list={p.dorsals} /></td>
                    <td className="l"><span style={{ fontWeight: 600 }}>{fcfDisplayName(p.name)}</span></td>
                    <td><YearBadge year={p.birth_year} up={upIds.has(String(p.player_id))} estimated /></td>
                    <td style={{ fontWeight: 600 }}>{p.pj}</td><td>{p.tit}</td><td>{p.sup}</td>
                    <td style={{ fontWeight: 700, color: RS.granate }}>{p.goals}</td><td>{p.yellow || ""}</td><td>{p.reds || ""}</td>
                    <td className="l" style={{ fontSize: 14, color: RS.ink2 }}>{pos || "—"}</td>
                    <td className="l"><DecisionChip decision={sp?.decision} empty="—" short /></td>
                  </tr>
                );
              })}
              {isLoading && <tr><td colSpan={11} style={{ padding: 30 }}><Loader2 className="animate-spin mx-auto" color={RS.faint} /></td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={11} style={{ padding: "30px 18px", color: RS.faint }}>Ningún jugador.</td></tr>}
            </tbody>
          </table>
        </div>
        <p style={{ margin: 0, padding: "12px 18px", fontSize: 13, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
          PJ = partidos en acta (titular + suplente). En fútbol base las actas no registran cambios, por eso no se calculan minutos. Posición, lateralidad y estado los introduce el club en la ficha del jugador. Los goles no incluyen los de propia puerta. Dorsal = el que más ha llevado en este equipo (al lado, otros que ha usado).
        </p>
      </section>
      {!isLoading && !sq && <Btn kind="ghost" onClick={() => go({ s: "equipos" })}>Volver</Btn>}
    </div>
  );
}
