// Mi equipo → Plantilla. Rediseño del 13/11/2026 con el diseño rs2 (maqueta «Maqueta Mi equipo · Plantilla», Nacho: «me
// parece todo muy bien» a las 7 propuestas): vistas Rendimiento · Ficha · Contacto, lista por posición o dorsal (juveniles
// por colores), cifras de disponibilidad, composición, «Revisar fichas» que filtra la lista, vista Lista / Campo,
// imprimir y exportar a Excel. Cálculos puros en src/lib/teamPages.js; las filas, en src/lib/useSquadRows.js.
import BelowMinBadge from "@/components/match/BelowMinBadge";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Download, Plus, Printer, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSelectedTeam } from "@/lib/useSelectedTeam";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { useSquadRows } from "@/lib/useSquadRows";
import { squadGroups, sortSquad, LINES, unavailable } from "@/lib/myTeamStats";
import { nextMatch } from "@/lib/teamsOverview";
import { squadChecks, composition, dorsalDupes } from "@/lib/teamPages";
import { cycleWarning, CARD_CYCLE } from "@/lib/statsOverview";
import { isPrimerEquipo } from "@/lib/primerEquipo";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { getExtraPositions } from "@/lib/playerPositions";
import { roleShort } from "@/lib/squadPlan";
import { playerFullName, playerSearchName } from "@/lib/playerName";
import { juvenilYear } from "@/lib/juvenilYear";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { countryOf, Flag } from "@/lib/countries";
import { toCsv, exportFileName, downloadCsv, printHtml, staffPrintHtml } from "@/lib/staffExport";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { BRAND } from "@/lib/brand";
import { getCategoryLabel } from "@/components/fcfCategories";
import { POS_LABEL } from "@/components/myteam/MyTeamCards";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import FcfOriginsDialog from "@/components/myteam/FcfOriginsDialog";
import { isRacingTeam } from "@/components/planning/labels";
import { originLabel } from "@/lib/fcfNames";
import SquadField from "@/components/myteam/SquadField";
import TeamTop, { NoTeam } from "@/components/myteam/TeamTop";
import { Page, RS, YearBadge, SearchBox } from "@/components/rs2/kit";
import { Head, Big, Label, WIN, LOSS } from "@/components/rs2/dashParts";
import { useT, msg } from "@/i18n";

const WARN = "#B45309";
const VIEWS = [{ k: "rend", l: msg("Rendimiento") }, { k: "ficha", l: msg("Ficha") }, { k: "contacto", l: msg("Contacto") }];
const LAYOUTS = [{ k: "lista", l: msg("Lista") }, { k: "campo", l: msg("Campo") }];
const SORTS = [{ k: "pos", l: msg("Por posición") }, { k: "dorsal", l: msg("Por dorsal") }];
const FOOT = { diestro: msg("Diestro"), zurdo: msg("Zurdo"), ambidiestro: msg("Ambidiestro") };
const REASON = { lesion: msg("Lesión"), enfermo: msg("Enfermo"), sancion: msg("Sanción"), viaje: msg("Viaje"), estudios: msg("Estudios") };
const CHECKS = {
  dup: msg("dorsales repetidos"), nodorsal: msg("sin dorsal"), nopos: msg("sin posición"), notutor: msg("sin teléfono del tutor"),
  noaccount: msg("sin cuenta en la app"),
};
const CHECK_COLOR = { dup: LOSS, nodorsal: WARN, nopos: WARN, notutor: WARN, noaccount: RS.muted };
const LINE_SHORT = { porteros: "POR", defensas: "DEF", medios: "MED", delanteros: "DEL" };

// Temporada anterior («2025-2026» si estamos en «2026-2027»)
const PREV_SEASON = (() => { const y = Number(String(CURRENT_SEASON).slice(0, 4)); return y ? `${y - 1}-${y}` : ""; })();
const stored = (k, d, ok) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const fmt1 = (n) => (n == null ? "—" : String(Math.round(n * 10) / 10).replace(".", ","));
const lineOf = (p) => LINES.find((l) => l.pos.includes(p.position))?.key || null;

function Seg({ options, value, onChange, testPrefix }) {
  const t = useT();
  return (
    <div className="flex" style={{ gap: 3, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 2 }} role="group">
      {options.map((o) => (
        <button key={o.k} type="button" onClick={() => onChange(o.k)} aria-pressed={value === o.k} data-testid={`${testPrefix}-${o.k}`}
          style={{ fontSize: 12, padding: "4px 11px", whiteSpace: "nowrap", borderRadius: 999, border: 0, fontWeight: value === o.k ? 700 : 400, background: value === o.k ? RS.granate : "none", color: value === o.k ? "#fff" : RS.ink2 }}>{t(o.l)}</button>
      ))}
    </div>
  );
}

function Kpi({ value, label, sub, color = RS.granate, testId }) {
  return (
    <div className="rs2-card" style={{ flex: "1 1 160px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", borderRadius: 10 }} data-testid={testId}>
      <span style={{ whiteSpace: "nowrap" }}><Big size={24} color={color}>{value}</Big></span>
      <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{label}{sub && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{sub}</span>}</span>
    </div>
  );
}

const Pill = ({ children, warn, color }) => (
  <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 999, border: `1px solid ${warn ? "#F5C2A0" : RS.line}`, background: warn ? "#FFF7ED" : "#fff", color: color || (warn ? "#9A3412" : RS.ink2), whiteSpace: "nowrap" }}>{children}</span>
);

function MinBar({ pct, level }) {
  if (pct == null) return <span style={{ color: RS.faint }}>—</span>;
  const c = level === "alert" ? LOSS : level === "warn" ? WARN : RS.granate;
  return (
    <span className="inline-flex items-center" style={{ gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-block", width: 44, height: 5, background: RS.lineSoft, borderRadius: 9, overflow: "hidden" }}><span style={{ display: "block", width: `${Math.min(100, pct)}%`, height: "100%", background: c }} /></span>
      <b style={{ fontSize: 11.5, color: level === "alert" || level === "warn" ? c : RS.ink }}>{Math.round(pct)} %</b>
    </span>
  );
}

const Chip = ({ children, bg, fg }) => <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>;

export default function Squad() {
  const t = useT();
  const { selectedTeamId } = useSelectedTeam();
  const { canManageTeam, perms } = useTeamAccess();
  const [view, setView] = useState(() => stored("rs_squad_view", "rend", ["rend", "ficha", "contacto"]));
  const [layout, setLayout] = useState(() => stored("rs_squad_layout", "lista", ["lista", "campo"]));
  const [sort, setSort] = useState(() => stored("rs_squad_sort", "pos", ["pos", "dorsal"]));
  const [q, setQ] = useState("");
  const [issue, setIssue] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [originsOpen, setOriginsOpen] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: convocs = [] } = useQuery({ queryKey: ["convocatorias_all"], queryFn: () => base44.entities.Convocatoria.list() });
  const { data: accounts } = useQuery({ queryKey: ["playerAccounts"], queryFn: () => base44.club.playerAccounts(), enabled: !!perms?.editPlayers, retry: false });
  const { data: lastHist = [] } = useQuery({
    queryKey: ["player-hist-season", PREV_SEASON],
    queryFn: () => base44.entities.PlayerSeasonHistory.pick(["player_id", "season", "team_name", "category"], { season: PREV_SEASON }),
    retry: false,
  });
  const { rows, guests } = useSquadRows(selectedTeamId);

  const team = teams.find((x) => x.id === selectedTeamId);
  const canManage = !!selectedTeamId && canManageTeam(selectedTeamId);
  const isF7 = teamPlaysF7(team);
  const withCycle = isPrimerEquipo(team);
  const now = new Date();
  const players = rows.map((r) => r.p);

  const next = nextMatch(events, selectedTeamId, now);
  const nextConv = next ? convocs.find((c) => c.event_id === next.id) : null;
  const out = unavailable({ players, injuries: rows.map((r) => r.injury).filter(Boolean), conv: nextConv });
  const outById = new Map(out.map((u) => [u.player.id, u]));
  const injured = out.filter((u) => u.reason === "lesion" || u.reason === "enfermo").length;
  const sanctioned = out.filter((u) => u.reason === "sancion").length;
  const lowMin = rows.filter((r) => r.level === "alert");
  const cards = withCycle ? rows.filter((r) => cycleWarning(r.ta)) : [];
  const attSum = rows.reduce((a, r) => a + (r.attN || 0), 0);
  const attAvg = attSum ? Math.round(rows.reduce((a, r) => a + (r.attPct || 0) * (r.attN || 0), 0) / attSum) : null;

  const accOf = accounts ? (p) => {
    const o = accounts.own?.[p.id] || 0, f = accounts.family?.[p.id] || 0;
    return o > 0 ? "own" : f > 0 ? "family" : accounts.pending?.[p.id] ? "pending" : "none";
  } : null;
  const seasonEndYear = Number(String(CURRENT_SEASON).slice(0, 4)) + 1;
  const checks = squadChecks(players, { adultYear: seasonEndYear - 18, accountOf: accOf });
  // Procedencia: lo escrito en la ficha («Equipo de procedencia») o, si no, su equipo del club la temporada pasada
  const histBy = useMemo(() => new Map(lastHist.map((h) => [h.player_id, h])), [lastHist]);
  const originOf = (p) => {
    const pc = String(p.previous_club || "").trim();
    if (pc && p.previous_club_source === "fcf") {
      const old = p.previous_club_season && p.previous_club_season !== PREV_SEASON;
      const yy = old ? ` (${p.previous_club_season.slice(2, 4)}-${p.previous_club_season.slice(7, 9)})` : "";
      const club = isRacingTeam(pc);
      return { text: `${originLabel(pc, p.previous_club_comp, { isClub: club, clubShort: BRAND.shortName })}${yy}`, kind: club ? "club" : "fcf", title: [pc, p.previous_club_comp, p.previous_club_season].filter(Boolean).join(" · ") };
    }
    if (pc) return { text: pc, kind: "manual" };
    const h = histBy.get(p.id);
    if (!h?.team_name) return null;
    return h.team_name === team?.name ? { text: t("Mismo equipo"), kind: "same" } : { text: h.team_name, kind: "club" };
  };
  const dupIds = new Set(dorsalDupes(players).flatMap((d) => d.ids));
  const comp = composition(players, lineOf);

  const issueIds = issue ? new Set(checks.find((c) => c.key === issue)?.ids || []) : null;
  const filtered = rows.filter((r) => (!issueIds || issueIds.has(r.p.id)) && (!q || playerSearchName(r.p).toLowerCase().includes(q.toLowerCase()) || String(r.p.jersey_number ?? "") === q.trim()));
  const groups = sort === "pos" ? squadGroups(filtered) : [{ key: "all", label: null, rows: sortSquad(filtered, "dorsal") }];

  const posText = (p) => {
    const ex = getExtraPositions(p)[0];
    return [t(POS_LABEL[p.position] || "—"), ex ? t(POS_LABEL[ex.position] || "") : null];
  };
  const stateOf = (r) => {
    const o = outById.get(r.p.id);
    if (o) {
      const until = r.injury?.expected_return && o.reason === "lesion" ? ` · ${t("vuelve {d}", { d: format(new Date(r.injury.expected_return), "dd/MM") })}` : "";
      return { text: `${t(REASON[o.reason] || o.reason)}${until}`, bg: o.reason === "lesion" || o.reason === "enfermo" ? "#FEE2E2" : "#FEF3C7", fg: o.reason === "lesion" || o.reason === "enfermo" ? "#991B1B" : "#92400E" };
    }
    if (withCycle && cycleWarning(r.ta)) return { text: t("A 1 de sanción"), bg: "#FEF3C7", fg: "#92400E" };
    if (r.level === "alert") return { text: t("Pocos minutos"), bg: "#FFF7ED", fg: "#9A3412" };
    return null;
  };
  const accText = { own: msg("Propia"), family: msg("Familia"), pending: msg("Pendiente"), none: msg("Sin cuenta") };

  const exportRows = () => filtered.map((r) => {
    const p = r.p, st = stateOf(r);
    return [
      p.jersey_number ?? "", playerFullName(p), r.year ?? "", POS_LABEL[p.position] || "", FOOT[p.laterality] || "", countryOf(p)?.name || p.nationality || "", originOf(p)?.text || "",
      r.pj || 0, r.tit || 0, r.pctMin == null ? "" : Math.round(r.pctMin), r.goals || 0, r.assists || 0, r.ta || 0, r.rating == null ? "" : fmt1(r.rating),
      r.attPct ?? "", st?.text || "", p.phone || "", p.email || "", p.guardian_name || "", p.guardian_phone || "", p.guardian_email || "",
      ...(accOf ? [accText[accOf(p)]] : []),
    ];
  });
  const EXPORT_HEAD = ["Dorsal", "Jugador", "Año", "Posición", "Pie", "Nacionalidad", "Procedencia", "PJ", "Titular", "% minutos", "Goles", "Asistencias", "Amarillas", "Valoración", "% entrenos", "Estado", "Teléfono", "Email", "Tutor", "Teléfono tutor", "Email tutor", ...(accOf ? ["Cuenta en la app"] : [])];
  const fileBase = `plantilla-${team?.name || "equipo"}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const doExport = () => downloadCsv(exportFileName(fileBase), toCsv(EXPORT_HEAD, exportRows()));
  const doPrint = () => {
    const list = groups.flatMap((g) => g.rows);
    const header = view === "contacto" ? ["Nº", "Jugador", "Año", "Pos.", "Teléfono", "Tutor", "Teléfono tutor", "Email tutor"]
      : view === "ficha" ? ["Nº", "Jugador", "Año", "Posiciones", "Pie", "Nacionalidad", "Procedencia", "Estado"]
      : ["Nº", "Jugador", "Año", "Pos.", "PJ", "Tit.", "% min", "G", "A", "TA", "Entr.", "Estado"];
    const body = list.map((r) => {
      const p = r.p, st = stateOf(r)?.text || "";
      const base = [p.jersey_number ?? "", playerFullName(p), r.year ?? ""];
      if (view === "contacto") return [...base, POS_LABEL[p.position] || "", p.phone || "", [p.guardian_name, p.guardian_relationship].filter(Boolean).join(" · "), p.guardian_phone || "", p.guardian_email || ""];
      if (view === "ficha") return [...base, [p.position && POS_LABEL[p.position], ...getExtraPositions(p).map((e) => POS_LABEL[e.position])].filter(Boolean).join(" · "), FOOT[p.laterality] || "", countryOf(p)?.name || p.nationality || "", originOf(p)?.text || "", st];
      return [...base, POS_LABEL[p.position] || "", r.pj || 0, r.tit || 0, r.pctMin == null ? "" : `${Math.round(r.pctMin)} %`, r.goals || 0, r.assists || 0, r.ta || 0, r.attPct == null ? "" : `${r.attPct} %`, st];
    });
    printHtml(staffPrintHtml({ header, rows: body, title: `Plantilla · ${team?.name || ""}`, subtitle: `${BRAND.clubName} · ${CURRENT_SEASON}`, logoUrl: CLUB_LOGO_URL, origin: window.location.origin, countText: `${body.length} jugadores` }));
  };

  if (!selectedTeamId) {
    return <Page testId="team-squad"><div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}><TeamTop kicker={t("Mi equipo")} title={t("Plantilla")} teams={teams} /><NoTeam teams={teams} /></div></Page>;
  }

  const kicker = [t("Mi equipo"), team?.name, getCategoryLabel(team?.category) !== team?.name && getCategoryLabel(team?.category)].filter(Boolean).join(" · ");
  const btn = { gap: 5, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2 };
  const td = { padding: "5px 8px" };
  const cols = view === "rend" ? 14 : view === "ficha" ? 8 : 9 - (accOf ? 0 : 1);

  return (
    <Page testId="team-squad">
      <div className="rs2-wrap flex flex-col" style={{ gap: 12, maxWidth: 1440 }}>
        <AddPlayerDialog open={addOpen} onOpenChange={setAddOpen} teamId={selectedTeamId} />
        {perms?.administration && <FcfOriginsDialog open={originsOpen} onOpenChange={setOriginsOpen} />}
        <TeamTop kicker={kicker} title={t("Plantilla")} teams={teams}>
          {perms?.administration && view === "ficha" && (
            <button type="button" onClick={() => setOriginsOpen(true)} className="inline-flex items-center" style={btn} data-testid="squad-origins">{t("Procedencia desde la FCF")}</button>
          )}
          <button type="button" onClick={doPrint} className="inline-flex items-center" style={btn} data-testid="squad-print"><Printer className="w-4 h-4" /> {t("Imprimir lista")}</button>
          <button type="button" onClick={doExport} className="inline-flex items-center" style={btn} data-testid="squad-export"><Download className="w-4 h-4" /> {t("Exportar Excel")}</button>
          {canManage && (
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center" data-testid="squad-add"
              style={{ ...btn, fontWeight: 700, border: 0, background: RS.granate, color: "#fff" }}><Plus className="w-4 h-4" /> {t("Jugador")}</button>
          )}
        </TeamTop>

        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <Kpi testId="squad-kpi-total" value={rows.length} label={t("jugadores")} sub={guests.length ? t("+{n} de otros equipos han jugado", { n: guests.length }) : null} />
          <Kpi testId="squad-kpi-available" value={rows.length - out.length} label={t("disponibles hoy")} color={out.length ? RS.granate : WIN}
            sub={out.length ? [injured && t("{n} lesionados", { n: injured }), sanctioned && t("{n} sancionados", { n: sanctioned }), out.length - injured - sanctioned > 0 && t("{n} por otros motivos", { n: out.length - injured - sanctioned })].filter(Boolean).join(" · ") : t("Todos")} />
          <Kpi testId="squad-kpi-lowmin" value={lowMin.length} label={t("con pocos minutos")} sub={t("por debajo del mínimo del club")} color={lowMin.length ? WARN : WIN} />
          {withCycle && <Kpi testId="squad-kpi-cards" value={cards.length} label={t("a 1 amarilla de sanción")} sub={t("ciclo de {n}", { n: CARD_CYCLE })} color={cards.length ? WARN : WIN} />}
          <Kpi testId="squad-kpi-att" value={attAvg == null ? "—" : `${attAvg} %`} label={t("entrenos")} sub={t("de la temporada")} color={attAvg != null && attAvg < 70 ? LOSS : RS.granate} />
        </div>

        <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
          <div className="rs2-card" style={{ flex: "999 1 640px", minWidth: 0, overflow: "hidden" }} data-testid="squad-list">
            <Head title={t("{e} · {n} jugadores", { e: team?.name || "", n: rows.length })} />
            <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "8px 14px" }}>
              {layout === "lista" && <Seg options={VIEWS} value={view} onChange={(k) => { setView(k); keep("rs_squad_view", k); }} testPrefix="squad-view" />}
              <Seg options={LAYOUTS} value={layout} onChange={(k) => { setLayout(k); keep("rs_squad_layout", k); }} testPrefix="squad-layout" />
              {layout === "lista" && (
                <span className="flex items-center" style={{ gap: 6, marginLeft: "auto" }}>
                  <Seg options={SORTS} value={sort} onChange={(k) => { setSort(k); keep("rs_squad_sort", k); }} testPrefix="squad-sort" />
                  <span style={{ width: 170 }}><SearchBox value={q} onChange={setQ} placeholder={t("Buscar")} testId="squad-search" /></span>
                </span>
              )}
            </div>
            {issue && (
              <div className="flex items-center" style={{ gap: 8, padding: "0 14px 8px" }}>
                <button type="button" onClick={() => setIssue(null)} className="inline-flex items-center" data-testid="squad-issue-clear"
                  style={{ gap: 4, fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, border: 0, background: RS.orangeSoft, color: RS.orangeInk }}>
                  {t(CHECKS[issue])} <X className="w-3 h-3" />
                </button>
                <span style={{ fontSize: 11.5, color: RS.muted }}>{t("{n} de {m}", { n: filtered.length, m: rows.length })}</span>
              </div>
            )}

            {layout === "campo" ? (
              <SquadField rows={rows} teams={teams} teamId={selectedTeamId} isF7={isF7} outById={outById} />
            ) : (
              <div className="overflow-x-auto">
                <table className="rs2-tbl rs2-left" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead><tr>
                    <th style={{ paddingLeft: 14, textAlign: "center" }}>{t("Nº")}</th><th>{t("Jugador")}</th><th>{t("Año")}</th>
                    {view === "rend" && <>
                      <th>{t("Pos.")}</th><th>{t("Pie")}</th><th style={{ textAlign: "center" }}>{t("PJ")}</th><th style={{ textAlign: "center" }}>{t("Tit.")}</th>
                      <th>{t("% min")}</th><th style={{ textAlign: "center" }}>{t("G")}</th><th style={{ textAlign: "center" }}>{t("A")}</th><th style={{ textAlign: "center" }}>{t("TA")}</th>
                      <th style={{ textAlign: "center" }}>{t("Val.")}</th><th style={{ textAlign: "right" }}>{t("Entr.")}</th>
                    </>}
                    {view === "ficha" && <>
                      <th>{t("Posiciones")}</th><th>{t("Pie")}</th><th>{t("Nacionalidad")}</th><th>{t("Procedencia")}</th>
                    </>}
                    {view === "contacto" && <>
                      <th>{t("Teléfono")}</th><th>{t("Email")}</th><th>{t("Tutor")}</th><th>{t("Tel. tutor")}</th><th>{t("Email tutor")}</th>{accOf && <th>{t("App")}</th>}
                    </>}
                    {view !== "contacto" && <th style={{ textAlign: "right", paddingRight: 14 }}>{t("Estado")}</th>}
                  </tr></thead>
                  <tbody>
                    {groups.map((g) => {
                      const avail = g.rows.filter((r) => !outById.has(r.p.id)).length;
                      return (
                        <React.Fragment key={g.key}>
                          {g.label && (
                            <tr><td colSpan={cols} style={{ padding: "6px 14px", background: RS.head, borderTop: `1px solid ${RS.line}`, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: RS.granateDark }}>
                              {t(g.label)} <span style={{ color: RS.muted, fontWeight: 500, letterSpacing: 0 }}>{g.rows.length}{avail < g.rows.length ? ` · ${t("{n} disponibles", { n: avail })}` : ""}</span>
                            </td></tr>
                          )}
                          {g.rows.map((r) => {
                            const p = r.p, st = stateOf(r), dup = dupIds.has(p.id);
                            const [pos, sec] = posText(p);
                            return (
                              <tr key={p.id} style={{ borderTop: `1px solid ${RS.lineSoft}` }} data-testid={`squad-row-${p.id}`}>
                                <td style={{ ...td, paddingLeft: 14, textAlign: "center", fontWeight: 800, fontSize: 13, color: dup ? LOSS : p.jersey_number == null || p.jersey_number === "" ? WARN : RS.granate }}>{p.jersey_number ?? "—"}</td>
                                <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>
                                  <Link to={`/PlayerProfile?id=${p.id}`} style={{ color: RS.ink }}>{playerFullName(p)}</Link>
                                  {dup && <span style={{ fontSize: 10, fontWeight: 700, color: LOSS, marginLeft: 6 }}>{t("dorsal repetido")}</span>}
                                </td>
                                <td style={td}>{juvenilYear(r.year, CURRENT_SEASON) ? <YearBadge year={r.year} sm /> : <span style={{ color: RS.muted }}>{r.year ?? "—"}</span>}</td>
                                {view === "rend" && <>
                                  <td style={{ ...td, fontSize: 11, fontWeight: 700, color: RS.muted }}>{pos}{sec && <span style={{ fontWeight: 500, color: RS.faint }}> · {sec}</span>}</td>
                                  <td style={{ ...td, fontSize: 11, color: RS.muted }} title={FOOT[p.laterality] ? t(FOOT[p.laterality]) : ""}>{FOOT[p.laterality] ? t(FOOT[p.laterality]).charAt(0) : "—"}</td>
                                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{r.pj}</td>
                                  <td style={{ ...td, textAlign: "center", color: RS.muted, fontSize: 11.5 }}>{r.tit ?? 0}</td>
                                  <td style={{ ...td, whiteSpace: "nowrap" }}><MinBar pct={r.pctMin} level={r.level} /><BelowMinBadge n={r.belowMin} perf={r.perf} testId={`squad-below-${r.p.id}`} /></td>
                                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: r.goals ? RS.granate : RS.muted }}>{p.position === "portero" ? <span title={t("Goles encajados")} style={{ color: RS.muted, fontWeight: 500 }}>{r.conceded}</span> : r.goals}</td>
                                  <td style={{ ...td, textAlign: "center", color: RS.muted }}>{r.assists}</td>
                                  <td style={{ ...td, textAlign: "center" }}>
                                    {r.ta ? <span style={{ display: "inline-block", minWidth: 14, padding: "0 3px", borderRadius: 2, background: "#FACC15", fontSize: 10, fontWeight: 800 }}>{r.ta}</span> : <span style={{ color: RS.faint }}>—</span>}
                                    {r.tr ? <span style={{ display: "inline-block", minWidth: 14, padding: "0 3px", marginLeft: 2, borderRadius: 2, background: "#DC2626", color: "#fff", fontSize: 10, fontWeight: 800 }}>{r.tr}</span> : null}
                                  </td>
                                  <td style={{ ...td, textAlign: "center", fontSize: 12 }}>{r.rating == null ? <span style={{ color: RS.faint }}>—</span> : `★ ${fmt1(r.rating)}`}</td>
                                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: r.attPct != null && r.attPct < 70 ? LOSS : RS.ink }}>{r.attPct == null ? "—" : `${r.attPct} %`}</td>
                                </>}
                                {view === "ficha" && <>
                                  <td style={{ ...td, fontSize: 11.5 }}>
                                    {p.position ? <b style={{ color: RS.ink2 }}>{t(POS_LABEL[p.position] || p.position)}{p.reference_role && roleShort(p.reference_role) ? ` (${t(roleShort(p.reference_role))})` : ""}</b> : <span style={{ color: WARN }}>{t("sin posición")}</span>}
                                    {getExtraPositions(p).map((e, i) => <span key={i} style={{ color: RS.muted }}> · {t(POS_LABEL[e.position] || e.position)}{e.role && roleShort(e.role) ? ` (${t(roleShort(e.role))})` : ""}</span>)}
                                  </td>
                                  <td style={{ ...td, fontSize: 11.5, color: RS.muted }}>{FOOT[p.laterality] ? t(FOOT[p.laterality]) : "—"}</td>
                                  <td style={{ ...td, fontSize: 11.5 }}>{countryOf(p) ? <Flag player={p} /> : (p.nationality || "—")}</td>
                                  <td style={{ ...td, fontSize: 11.5, maxWidth: 220 }} className="truncate" data-testid={`squad-origin-${p.id}`} title={originOf(p)?.title || originOf(p)?.text || ""}>
                                    {(() => { const o = originOf(p); return !o ? <span style={{ color: RS.faint }}>—</span> : <span style={{ color: o.kind === "same" ? RS.muted : RS.ink, fontWeight: o.kind === "manual" || o.kind === "fcf" ? 600 : 400 }}>{o.text}</span>; })()}
                                  </td>
                                </>}
                                {view === "contacto" && <>
                                  <td style={{ ...td, fontSize: 12 }}>{p.phone ? <a href={`tel:${p.phone}`} style={{ color: RS.ink }}>{p.phone}</a> : <span style={{ color: RS.faint }}>—</span>}</td>
                                  <td style={{ ...td, fontSize: 12, maxWidth: 200 }} className="truncate">{p.email ? <a href={`mailto:${p.email}`} style={{ color: RS.ink }}>{p.email}</a> : <span style={{ color: RS.faint }}>—</span>}</td>
                                  <td style={{ ...td, fontSize: 12 }}>{p.guardian_name ? <>{p.guardian_name}{p.guardian_relationship && <span style={{ color: RS.muted }}> · {p.guardian_relationship}</span>}</> : <span style={{ color: RS.faint }}>—</span>}</td>
                                  <td style={{ ...td, fontSize: 12 }}>{p.guardian_phone ? <a href={`tel:${p.guardian_phone}`} style={{ color: RS.ink }}>{p.guardian_phone}</a> : r.year && r.year > seasonEndYear - 18 ? <span style={{ color: WARN }}>{t("Falta")}</span> : <span style={{ color: RS.faint }}>—</span>}</td>
                                  <td style={{ ...td, fontSize: 12, maxWidth: 200 }} className="truncate">{p.guardian_email ? <a href={`mailto:${p.guardian_email}`} style={{ color: RS.ink }}>{p.guardian_email}</a> : <span style={{ color: RS.faint }}>—</span>}</td>
                                  {accOf && <td style={{ ...td, fontSize: 11.5, color: accOf(p) === "none" ? WARN : accOf(p) === "pending" ? RS.muted : WIN, paddingRight: 14 }}>{t(accText[accOf(p)])}</td>}
                                </>}
                                {view !== "contacto" && <td style={{ ...td, paddingRight: 14, textAlign: "right" }}>{st ? <Chip bg={st.bg} fg={st.fg}>{st.text}</Chip> : <span style={{ color: RS.faint, fontSize: 11 }}>—</span>}</td>}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {filtered.length === 0 && <tr><td colSpan={cols} style={{ padding: "18px 14px", color: RS.muted }}>{t("Ningún jugador.")}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {layout === "lista" && (
              <p style={{ padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}`, fontSize: 11.5, color: RS.muted, margin: 0 }}>
                {view === "rend" ? t("Partidos de liga cerrados de este equipo · % min = sobre los minutos en que estaba disponible · Val. = valoración del postpartido (1–3) · Entr. = % de entrenos.")
                  : view === "ficha" ? t("Procedencia = lo escrito en la ficha del jugador («Equipo de procedencia») o, si no, su equipo del club la temporada pasada.")
                  : t("Teléfonos y correos de la ficha del jugador.")}
              </p>
            )}
          </div>

          <div className="flex flex-col" style={{ flex: "1 1 290px", maxWidth: 340, minWidth: 0, gap: 12 }}>
            <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="squad-composition">
              <Head title={t("Composición")} />
              <div className="flex flex-col" style={{ padding: "10px 14px", gap: 10 }}>
                <div>
                  <Label>{t("Por línea")}</Label>
                  <div className="flex flex-wrap" style={{ gap: 5, marginTop: 5 }}>
                    {LINES.map((l) => <Pill key={l.key}><b>{t(LINE_SHORT[l.key])}</b> {comp.lines[l.key] || 0}</Pill>)}
                    {comp.lines.none > 0 && <Pill warn><b>{t("Sin pos.")}</b> {comp.lines.none}</Pill>}
                  </div>
                </div>
                <div>
                  <Label>{t("Por año")}</Label>
                  <div className="flex flex-wrap" style={{ gap: 5, marginTop: 5 }}>
                    {comp.years.map((y) => {
                      const jy = juvenilYear(y.year, CURRENT_SEASON);
                      return <Pill key={y.year} color={jy === 1 ? "#C62828" : jy === 2 ? "#E8590C" : undefined}><b>{y.year}{jy ? ` ${jy}.º` : ""}</b> {y.n}</Pill>;
                    })}
                    {comp.noYear > 0 && <Pill warn><b>{t("Sin año")}</b> {comp.noYear}</Pill>}
                  </div>
                </div>
                <div>
                  <Label>{t("Pierna")}</Label>
                  <div className="flex flex-wrap" style={{ gap: 5, marginTop: 5 }}>
                    <Pill><b>{t("Diestros")}</b> {comp.foot.diestro}</Pill>
                    <Pill><b>{t("Zurdos")}</b> {comp.foot.zurdo}</Pill>
                    {comp.foot.ambidiestro > 0 && <Pill><b>{t("Ambidiestros")}</b> {comp.foot.ambidiestro}</Pill>}
                    {comp.foot.none > 0 && <Pill warn><b>{t("Sin dato")}</b> {comp.foot.none}</Pill>}
                  </div>
                </div>
                <div>
                  <Label>{t("Hoy disponibles")}</Label>
                  <div className="flex flex-wrap" style={{ gap: 5, marginTop: 5 }}>
                    <Pill><b>{t("{n} de {m}", { n: rows.length - out.length, m: rows.length })}</b></Pill>
                    {Object.keys(REASON).map((k) => {
                      const n = out.filter((u) => u.reason === k).length;
                      return n ? <Pill key={k} warn><b>{t(REASON[k])}</b> {n}</Pill> : null;
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="squad-checks">
              <Head title={t("Revisar fichas")} />
              <div className="flex flex-col" style={{ padding: "8px 14px", gap: 6, fontSize: 12.5 }}>
                {checks.length === 0 ? <span style={{ color: WIN, fontWeight: 600 }}>{t("Todas las fichas están completas")}</span> : checks.map((c) => (
                  <button key={c.key} type="button" onClick={() => { setIssue(issue === c.key ? null : c.key); setLayout("lista"); }} data-testid={`squad-check-${c.key}`}
                    className="flex items-baseline" style={{ gap: 8, background: issue === c.key ? RS.soft : "none", border: 0, borderRadius: 6, padding: "2px 4px", textAlign: "left" }}>
                    <b style={{ color: CHECK_COLOR[c.key], width: 20, textAlign: "right" }}>{c.ids.length}</b>
                    <span style={{ flex: 1 }}>{t(CHECKS[c.key])}{c.extra ? ` (${c.extra})` : ""}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: RS.granate }}>{issue === c.key ? t("Quitar") : t("Ver")} ›</span>
                  </button>
                ))}
                {checks.length > 0 && <span style={{ fontSize: 11.5, color: RS.muted }}>{t("Tocar uno filtra la lista.")}</span>}
              </div>
            </div>

            {guests.length > 0 && (
              <div className="rs2-card" style={{ overflow: "hidden" }} data-testid="squad-guests">
                <Head title={t("De otros equipos")} />
                <div className="flex flex-col" style={{ padding: "8px 14px", gap: 5, fontSize: 12.5 }}>
                  {guests.map((g) => (
                    <Link key={g.p.id} to={`/PlayerProfile?id=${g.p.id}`} className="flex" style={{ gap: 8, color: RS.ink }}>
                      <span className="truncate" style={{ flex: 1 }}><b>{playerFullName(g.p)}</b> <span style={{ color: RS.muted, fontSize: 11.5 }}>· {g.team?.name || "—"}</span></span>
                      <span style={{ color: RS.muted, whiteSpace: "nowrap" }}>{g.pj} {t("PJ")} · {g.mins}'</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
