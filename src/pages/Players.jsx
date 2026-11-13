// Jugadores (rediseño del 13/11/2026, maqueta «Maqueta Jugadores · RS Manager» aprobada por Nacho): resumen que filtra,
// filtros a la izquierda, tabla agrupada por equipo o posición con estadísticas de la temporada y exportación a Excel.
// Cálculos puros en src/lib/playersList.js.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Trash2, Search, Download, SlidersHorizontal } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddPlayerDialog from "@/components/team/AddPlayerDialog";
import PlayerArchive from "@/components/players/PlayerArchive";
import { Page, RS, YearBadge, useDensity, DensityToggle } from "@/components/rs2/kit";
import { Flag, countryOf, isForeign } from "@/lib/countries";
import { playerSearchName, playerFullName } from "@/lib/playerName";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { sortTeams } from "@/lib/teamOrder";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { getCategoryLabel } from "@/components/fcfCategories";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { juvenilYear } from "@/lib/juvenilYear";
import { toCsv, exportFileName, downloadCsv } from "@/lib/staffExport";
import { usePlayerRows } from "@/lib/usePlayerRows";
import { EMPTY_FILTERS, matchesFilters, hasAnyFilter, kpiCounts, yearOptions, sortRows, groupRows, exportTable, statusOf, accountOf } from "@/lib/playersList";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, useDateLocale, msg } from "@/i18n";
import { BRAND } from "@/lib/brand";

const POS_LABEL = { portero: msg("POR"), lateral: msg("LAT"), central: msg("CEN"), libre: msg("LIB"), mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT") };
const POS_NAME = { portero: "Portero", lateral: "Lateral", central: "Central", libre: "Libre", mediocentro: "Mediocentro", interior: "Interior", mediapunta: "Mediapunta", delantero_centro: "Delantero centro", extremo: "Extremo" };
const POS_PILLS = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];
const FOOT_NAME = { diestro: msg("Diestro"), zurdo: msg("Zurdo"), ambidiestro: msg("Ambidiestro") };
const GROUPS = [["team", msg("Por equipo")], ["position", msg("Por posición")], ["none", msg("Sin agrupar")]];
const GROUP_KEY = "rs_players_group";
const LOW_ATT = 70;   // asistencia a entrenos por debajo de este % = en rojo (igual que en Mi equipo)
const LOSS = "#B91C1C";

const chip = (bg, fg) => ({ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap", display: "inline-block" });
const seasonLabel = (s) => String(s || "").replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");

function Avatar({ p, size }) {
  const ini = `${p.first_name?.[0] || ""}${p.last_name?.[0] || ""}`.toUpperCase() || "?";
  return (
    <span style={{ width: size, height: size, borderRadius: 6, background: RS.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size > 24 ? 10 : 9, color: RS.muted, overflow: "hidden", flex: "none" }}>
      {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini}
    </span>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: RS.muted, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function Pill({ on, onClick, children, testId, title, style }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId} title={title}
      style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, border: "1px solid", background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2, borderColor: on ? RS.granate : RS.line, fontWeight: on ? 700 : 500, ...style }}>
      {children}
    </button>
  );
}

function Segmented({ options, value, onChange, testPrefix, label }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} data-testid={`${testPrefix}-${k}`}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: 0, fontWeight: value === k ? 700 : 400, background: value === k ? "#fff" : "none", color: value === k ? RS.granate : RS.ink2, boxShadow: value === k ? "0 1px 2px rgba(0,0,0,.08)" : "none", whiteSpace: "nowrap" }}>{t(l)}</button>
      ))}
    </div>
  );
}

export default function Players() {
  const t = useT();
  const dfl = useDateLocale();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { perms } = useTeamAccess();
  const [view, setView] = useState("current");
  const [f, setF] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: "position", dir: "asc" });
  const [group, setGroupState] = useState(() => { try { return localStorage.getItem(GROUP_KEY) || "team"; } catch { return "team"; } });
  const setGroup = (g) => { setGroupState(g); try { localStorage.setItem(GROUP_KEY, g); } catch { /* sin almacenamiento */ } };
  const [density, setDensity] = useDensity();
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: players = [], isLoading } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: teamsRaw = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: archivedPlayers = [] } = useQuery({ queryKey: ["players_archived"], queryFn: () => base44.entities.Player.archived({}, "only"), enabled: !!perms.editPlayers });
  // Cuentas vinculadas (propia del jugador o de un familiar): solo para quien gestiona jugadores
  const { data: accounts } = useQuery({ queryKey: ["playerAccounts"], queryFn: () => base44.club.playerAccounts(), enabled: !!perms.editPlayers, retry: false });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); setDeleteId(null); },
  });

  const teams = useMemo(() => sortTeams(teamsRaw), [teamsRaw]);
  const rows = usePlayerRows(players, teams, accounts);
  const historyCount = new Set([...archivedPlayers.map((p) => p.id), ...players.filter((p) => p.status === "baja").map((p) => p.id)]).size;
  const fctx = { season: CURRENT_SEASON, searchName: playerSearchName, isForeign, countryA3: (p) => countryOf(p)?.a3 || null };
  const kpi = useMemo(() => kpiCounts(rows, { isForeign }), [rows]);
  const filtered = useMemo(() => rows.filter((r) => matchesFilters(r, f, fctx)), [rows, f]);
  const sorted = useMemo(() => sortRows(filtered, sort.key, sort.dir), [filtered, sort]);
  const groups = useMemo(() => groupRows(sorted, group, teams), [sorted, group, teams]);
  const teamCounts = useMemo(() => { const m = new Map(); for (const r of rows) m.set(r.p.team_id, (m.get(r.p.team_id) || 0) + 1); return m; }, [rows]);
  const years = useMemo(() => yearOptions(rows, CURRENT_SEASON), [rows]);
  const any = hasAnyFilter(f);
  const lista = density === "lista";

  if (perms.players !== "all") {
    return <div className="p-12 text-center"><p className="text-gray-400">{t("No tienes acceso a esta sección.")}</p></div>;
  }

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: ["pj", "pctMin", "goals", "att"].includes(key) ? "desc" : "asc" }));
  const yearLabel = (k) => (k === "senior" ? t("Sénior") : k === "none" ? t("Sin año") : k);

  // Resumen de arriba: cada número filtra la lista
  const kpis = [
    { k: "total", n: kpi.total, label: t("jugadores"), color: RS.granate, on: !f.noDorsal && f.status === "all" && f.nat === "all" && f.account === "all", go: () => set({ status: "all", nat: "all", account: "all", noDorsal: false }) },
    { k: "activos", n: kpi.activos, label: t("activos"), color: "#15803D", on: f.status === "activo", go: () => set({ status: f.status === "activo" ? "all" : "activo" }) },
    { k: "lesionados", n: kpi.lesionados, label: t("lesionados"), color: LOSS, on: f.status === "lesionado", go: () => set({ status: f.status === "lesionado" ? "all" : "lesionado" }) },
    { k: "bajas", n: kpi.bajas, label: t("bajas esta temporada"), color: RS.ink2, on: f.status === "baja", go: () => set({ status: f.status === "baja" ? "all" : "baja" }) },
    { k: "extranjeros", n: kpi.extranjeros, label: t("extranjeros"), color: RS.ink2, on: f.nat === "foreign", go: () => set({ nat: f.nat === "foreign" ? "all" : "foreign" }) },
    ...(accounts ? [{ k: "sincuenta", n: kpi.sinCuenta, label: t("sin cuenta en la app"), color: "#B45309", on: f.account === "none", go: () => set({ account: f.account === "none" ? "all" : "none" }) }] : []),
    { k: "sindorsal", n: kpi.sinDorsal, label: t("sin dorsal"), color: RS.ink2, on: f.noDorsal, go: () => set({ noDorsal: !f.noDorsal }) },
  ];

  // Filtros activos como etiquetas que se quitan con ✕
  const teamName = (id) => teams.find((x) => x.id === id)?.name || t("Sin equipo");
  const chips = [
    ...(f.search ? [{ k: "q", label: `«${f.search}»`, clear: () => set({ search: "" }) }] : []),
    ...f.teams.map((id) => ({ k: `t${id}`, label: teamName(id), clear: () => toggle("teams", id) })),
    ...(f.years.length ? [{ k: "y", label: f.years.map(yearLabel).join(", "), clear: () => set({ years: [] }) }] : []),
    ...(f.positions.length ? [{ k: "p", label: f.positions.map((p) => t(POS_LABEL[p])).join(", "), clear: () => set({ positions: [] }) }] : []),
    ...(f.foot !== "all" ? [{ k: "f", label: t(FOOT_NAME[f.foot]), clear: () => set({ foot: "all" }) }] : []),
    ...(f.status !== "all" ? [{ k: "s", label: { activo: t("Activo"), lesionado: t("Lesionado"), baja: t("Baja") }[f.status], clear: () => set({ status: "all" }) }] : []),
    ...(f.nat !== "all" ? [{ k: "n", label: f.nat === "foreign" ? t("Extranjeros") : t("España"), clear: () => set({ nat: "all" }) }] : []),
    ...(f.account !== "all" ? [{ k: "a", label: { own: t("Cuenta propia"), family: t("Familia"), none: t("Sin cuenta") }[f.account], clear: () => set({ account: "all" }) }] : []),
    ...(f.noDorsal ? [{ k: "d", label: t("Sin dorsal"), clear: () => set({ noDorsal: false }) }] : []),
  ];

  const exportExcel = () => {
    const { header, rows: data } = exportTable(sorted, {
      posName: (p) => POS_NAME[p] || "",
      countryName: (p) => countryOf(p)?.name || p.nationality || "",
      withAccount: !!accounts,
    });
    downloadCsv(exportFileName(`jugadores-${BRAND.clubName}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")), toCsv(header, data));
  };

  const status = (r) => {
    const s = statusOf(r);
    if (s === "baja") return <span style={chip(RS.lineSoft, RS.muted)}>{t("Baja")}</span>;
    if (s === "lesionado") {
      const until = r.injury?.expected_return;
      return <span style={chip("#FEE2E2", LOSS)} title={r.injury?.diagnosis || ""}>{t("Lesión")}{until ? ` · ${format(new Date(until), "d MMM", { locale: dfl })}` : ""}</span>;
    }
    if (r.level === "alert") return <span style={chip(RS.lineSoft, RS.ink2)} title={t("Por debajo del mínimo de minutos del club")}>{t("Pocos minutos")}</span>;
    return null;
  };
  const account = (r) => {
    const a = accountOf(r);
    if (a === "own") return <span style={chip("#DCFCE7", "#15803D")} title={t("Tiene su propia cuenta")}>{t("Propia")}</span>;
    if (a === "family") return <span style={chip("#E0E7FF", "#3730A3")} title={t("Familiar vinculado: {n}", { n: r.acc.family })}>{t("Familia")}{r.acc.family > 1 ? ` · ${r.acc.family}` : ""}</span>;
    if (r.acc?.pending) return <span style={chip("#FEF3C7", "#92400E")} title={t("Solicitud de familiar pendiente: {n}", { n: r.acc.pending })}>{t("Pendiente")}</span>;
    return <span style={chip("#FEF3C7", "#92400E")}>{t("Sin cuenta")}</span>;
  };

  const showTeamCol = group !== "team";
  const cols = 12 + (accounts ? 1 : 0) + (showTeamCol && lista ? 1 : 0);
  const pad = lista ? "3px 8px" : "6px 8px";
  const th = (label, key, right) => (
    <th key={label} onClick={key ? () => onSort(key) : undefined} aria-sort={key && sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      style={{ textAlign: right ? "right" : "left", padding: "6px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: sort.key === key ? RS.granate : RS.muted, fontWeight: 700, borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
      {label}{key ? <span style={{ opacity: sort.key === key ? 1 : 0.4, marginLeft: 3 }}>{sort.key === key ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span> : null}
    </th>
  );

  const groupHead = (g) => {
    if (group === "none") return null;
    const title = group === "team" ? (g.team?.name || t("Sin equipo")) : t(g.label);
    const sub = group === "team" && g.team
      ? [teamPlaysF7(g.team) ? "F7" : "F11", getCategoryLabel(g.team.category), t("{n} jugadores", { n: g.rows.length })].filter(Boolean).join(" · ")
      : t("{n} jugadores", { n: g.rows.length });
    return (
      <tr key={`h-${g.key}`}>
        <td colSpan={cols} style={{ padding: "12px 8px 4px" }}>
          <div className="flex items-baseline" style={{ gap: 10 }}>
            <span className="rs2-display" style={{ fontSize: 17, color: RS.granate, textTransform: "uppercase" }}>{title}</span>
            <span style={{ fontSize: 11, color: RS.muted }}>{sub}</span>
            {group === "team" && g.team && <Link to={`/TeamDetail?id=${g.team.id}`} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: RS.granate }}>{t("Ver equipo →")}</Link>}
          </div>
        </td>
      </tr>
    );
  };

  const row = (r) => {
    const p = r.p;
    const td = { padding: pad, borderTop: `1px solid ${RS.lineSoft}` };
    const lowAtt = r.attPct != null && r.attPct < LOW_ATT;
    const barColor = r.level === "alert" ? LOSS : r.level === "warn" ? "#B45309" : RS.granate;
    return (
      <tr key={p.id} data-testid={`player-row-${p.id}`} style={{ opacity: p.status === "baja" ? 0.6 : 1 }}>
        <td className="rs2-display tabular-nums" style={{ ...td, fontSize: 15, color: RS.granate, width: 30 }}>{p.jersey_number ?? <span style={{ color: RS.faint }}>–</span>}</td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <Link to={`/PlayerProfile?id=${p.id}`} className="inline-flex items-center hover:underline" style={{ gap: 7, fontWeight: 700, color: RS.ink }}>
            <Avatar p={p} size={lista ? 20 : 26} />
            <span>
              {playerFullName(p)}
              {!lista && showTeamCol && r.team && <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: RS.muted }}>{r.team.name}</span>}
            </span>
          </Link>
        </td>
        {showTeamCol && lista && <td style={{ ...td, color: RS.muted, whiteSpace: "nowrap", fontSize: 11 }}>{r.team?.name || "—"}</td>}
        <td style={{ ...td, whiteSpace: "nowrap" }}>{juvenilYear(r.year, CURRENT_SEASON) ? <YearBadge year={r.year} sm /> : <span className="tabular-nums" style={{ fontSize: 11, color: RS.muted }}>{r.year || "—"}</span>}</td>
        <td style={{ ...td, color: RS.muted }} title={POS_NAME[p.position] ? t(POS_NAME[p.position]) : undefined}>{POS_LABEL[p.position] ? t(POS_LABEL[p.position]) : "—"}</td>
        <td style={{ ...td, color: RS.muted }} title={FOOT_NAME[p.laterality] ? t(FOOT_NAME[p.laterality]) : undefined}>{FOOT_NAME[p.laterality] ? t(FOOT_NAME[p.laterality]).charAt(0) : "—"}</td>
        <td style={{ ...td, fontSize: 11, color: RS.muted, whiteSpace: "nowrap" }}>{isForeign(p) ? <Flag player={p} /> : null}</td>
        <td className="tabular-nums" style={{ ...td, textAlign: "right" }}>{r.pj || <span style={{ color: RS.faint }}>–</span>}</td>
        <td className="tabular-nums" style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
          {r.pctMin == null ? <span style={{ color: RS.faint }}>–</span> : (<>
            <span style={{ display: "inline-block", width: 36, height: 5, background: RS.lineSoft, borderRadius: 9, verticalAlign: "middle", marginRight: 5, overflow: "hidden" }}><span style={{ display: "block", width: `${Math.min(100, r.pctMin)}%`, height: "100%", background: barColor }} /></span>
            {r.pctMin} %
          </>)}
        </td>
        <td className="tabular-nums" style={{ ...td, textAlign: "right", fontWeight: r.goals ? 700 : 400 }}>{r.goals || <span style={{ color: RS.faint }}>–</span>}</td>
        <td className="tabular-nums" style={{ ...td, textAlign: "right", ...(lowAtt ? { color: LOSS, fontWeight: 700 } : {}) }} title={r.attN ? t("{n} entrenos registrados", { n: r.attN }) : undefined}>{r.attPct == null ? <span style={{ color: RS.faint }}>–</span> : `${r.attPct} %`}</td>
        <td style={td}>{status(r)}</td>
        {accounts && <td style={td}>{account(r)}</td>}
        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
          {perms.editPlayers && (
            <span className="inline-flex" style={{ gap: 2 }}>
              <button type="button" onClick={() => { setEditingPlayer(p); setDialogOpen(true); }} title={t("Editar")} aria-label={t("Editar")} data-testid={`player-edit-${p.id}`} className="p-1 rounded hover:bg-gray-100" style={{ color: "#B8ACAD" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setDeleteId(p.id)} title={t("Eliminar")} aria-label={t("Eliminar")} className="p-1 rounded hover:bg-red-50" style={{ color: "#B8ACAD" }}><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          )}
        </td>
      </tr>
    );
  };

  const filtersPanel = (
    <aside className="rs2-card" data-testid="players-filters"
      style={{ flex: isMobile ? "1 1 100%" : "0 0 238px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14, alignSelf: "flex-start" }}>
      <label className="flex items-center" style={{ gap: 8, border: `1px solid ${RS.line}`, borderRadius: 8, padding: "6px 9px" }}>
        <Search width={14} height={14} color={RS.muted} aria-hidden="true" />
        <span className="sr-only">{t("Buscar nombre o dorsal…")}</span>
        <input type="search" value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder={t("Buscar nombre o dorsal…")} data-testid="players-search"
          style={{ fontSize: 12, border: 0, outline: 0, flex: 1, minWidth: 0, background: "none", color: RS.ink }} />
      </label>
      <FilterGroup title={t("Equipo")}>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {teams.map((tm) => (
            <label key={tm.id} className="flex items-center" style={{ gap: 7, fontSize: 12, padding: "3px 0", color: RS.ink, cursor: "pointer" }}>
              <input type="checkbox" checked={f.teams.includes(tm.id)} onChange={() => toggle("teams", tm.id)} style={{ accentColor: RS.granate }} data-testid={`players-team-${tm.id}`} />
              <span style={{ flex: 1, minWidth: 0 }} className="truncate">{tm.name}</span>
              <span style={{ fontSize: 10, color: RS.muted }}>{teamPlaysF7(tm) ? "F7" : "F11"}</span>
              <span className="tabular-nums" style={{ fontSize: 11, color: RS.muted, width: 22, textAlign: "right" }}>{teamCounts.get(tm.id) || 0}</span>
            </label>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("Año de nacimiento")}>
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {years.map((y) => (
            <Pill key={y.key} on={f.years.includes(y.key)} onClick={() => toggle("years", y.key)} testId={`players-year-${y.key}`}>
              {yearLabel(y.key)} <span style={{ opacity: 0.6 }}>{y.n}</span>
            </Pill>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("Posición")}>
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {POS_PILLS.map((p) => <Pill key={p} on={f.positions.includes(p)} onClick={() => toggle("positions", p)} testId={`players-pos-${p}`} title={t(POS_NAME[p])}>{t(POS_LABEL[p])}</Pill>)}
        </div>
      </FilterGroup>
      <FilterGroup title={t("Pierna")}>
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {[["all", t("Todas")], ["diestro", t("Diestro")], ["zurdo", t("Zurdo")], ["ambidiestro", t("Ambas")]].map(([k, l]) => <Pill key={k} on={f.foot === k} onClick={() => set({ foot: k })} testId={`players-foot-${k}`}>{l}</Pill>)}
        </div>
      </FilterGroup>
      <FilterGroup title={t("Estado")}>
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {[["all", t("Todos")], ["activo", t("Activo")], ["lesionado", t("Lesionado")], ["baja", t("Baja")]].map(([k, l]) => <Pill key={k} on={f.status === k} onClick={() => set({ status: k })} testId={`players-status-${k}`}>{l}</Pill>)}
        </div>
      </FilterGroup>
      <FilterGroup title={t("Nacionalidad")}>
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          <Pill on={f.nat === "all"} onClick={() => set({ nat: "all" })} testId="players-nat-all">{t("Todas")}</Pill>
          <Pill on={f.nat === "ESP"} onClick={() => set({ nat: "ESP" })} testId="players-nat-ESP">{t("España")}</Pill>
          <Pill on={f.nat === "foreign"} onClick={() => set({ nat: "foreign" })} testId="players-nat-foreign">{t("Extranjeros")} <span style={{ opacity: 0.6 }}>{kpi.extranjeros}</span></Pill>
        </div>
      </FilterGroup>
      {accounts && (
        <FilterGroup title={t("Cuenta en la app")}>
          <div className="flex flex-wrap" style={{ gap: 4 }}>
            {[["all", t("Todas")], ["own", t("Propia")], ["family", t("Familia")], ["none", t("Sin cuenta")]].map(([k, l]) => (
              <Pill key={k} on={f.account === k} onClick={() => set({ account: k })} testId={`players-acc-${k}`}>{l}{k === "none" ? <span style={{ opacity: 0.6 }}> {kpi.sinCuenta}</span> : null}</Pill>
            ))}
          </div>
        </FilterGroup>
      )}
      {any && <button type="button" onClick={() => setF(EMPTY_FILTERS)} style={{ fontSize: 12, fontWeight: 700, color: RS.granate, textAlign: "left", background: "none", textDecoration: "underline" }} data-testid="players-clear">{t("Limpiar filtros")}</button>}
    </aside>
  );

  return (
    <Page testId="players">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Cabecera */}
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Directorio · Temporada {s}", { s: seasonLabel(CURRENT_SEASON) })}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("JUGADORES")}</span></h1>
          </div>
          {perms.editPlayers && (
            <div className="flex" style={{ gap: 4, background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 999, padding: 3, marginLeft: isMobile ? 0 : 14 }} role="group" aria-label={t("Vista")}>
              {[["current", t("Plantilla actual")], ["history", `${t("Histórico")} · ${historyCount}`]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} data-testid={`players-view-${k}`}
                  style={{ fontSize: 12, fontWeight: view === k ? 700 : 400, padding: "5px 12px", borderRadius: 999, border: 0, background: view === k ? RS.granate : "none", color: view === k ? "#fff" : RS.ink2 }}>{l}</button>
              ))}
            </div>
          )}
          <div className="flex" style={{ marginLeft: "auto", gap: 8 }}>
            {view === "current" && (
              <button type="button" onClick={exportExcel} data-testid="players-export" title={t("Descarga la lista con los filtros puestos")}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, display: "flex", gap: 6, alignItems: "center" }}>
                <Download width={14} height={14} aria-hidden="true" /> {t("Exportar Excel")}
              </button>
            )}
            {perms.editPlayers && (
              <button type="button" onClick={() => { setEditingPlayer(null); setDialogOpen(true); }} data-testid="players-new"
                style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: 0, background: RS.granate, color: "#fff" }}>+ {t("Nuevo jugador")}</button>
            )}
          </div>
        </div>

        {view === "history" && <div className="rs2-card" style={{ padding: 12 }}><PlayerArchive players={players} teams={teamsRaw} /></div>}

        {view === "current" && (<>
          {/* Resumen que filtra */}
          <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="players-kpis">
            {kpis.map((k) => (
              <button key={k.k} type="button" onClick={k.go} aria-pressed={k.on} data-testid={`players-kpi-${k.k}`}
                style={{ flex: isMobile ? "1 1 100px" : "1 1 120px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${k.on ? RS.granate : RS.line}`, borderRadius: 10, textAlign: "left", boxShadow: k.on ? `inset 0 0 0 1px ${RS.granate}` : "none" }}>
                <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: k.color }}>{k.n}</span>
                <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{k.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
            {isMobile && (
              <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} data-testid="players-filters-toggle"
                style={{ flex: "1 1 100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: RS.ink2 }}>
                <SlidersHorizontal width={15} height={15} aria-hidden="true" /> {t("Filtros")}{chips.length ? ` · ${chips.length}` : ""}
                <span style={{ marginLeft: "auto", color: RS.muted }}>{showFilters ? "▲" : "▼"}</span>
              </button>
            )}
            {(!isMobile || showFilters) && filtersPanel}

            <section className="rs2-card" style={{ flex: "1 1 640px", minWidth: 0, overflow: "hidden", padding: 0 }} data-testid="players-table">
              <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "9px 14px", borderBottom: `1px solid ${RS.line}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: RS.ink }} data-testid="players-count">{filtered.length === 1 ? t("1 jugador") : t("{n} jugadores", { n: filtered.length })}</span>
                {chips.length > 0 && (
                  <span className="flex flex-wrap" style={{ gap: 4 }}>
                    {chips.map((c) => (
                      <button key={c.k} type="button" onClick={c.clear} title={t("Quitar filtro")} data-testid="players-chip"
                        style={{ ...chip(RS.soft, RS.granate), border: 0 }}>{c.label} ✕</button>
                    ))}
                  </span>
                )}
                <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 6 }}>
                  <span style={{ fontSize: 11, color: RS.muted }}>{t("Agrupar")}</span>
                  <Segmented options={GROUPS} value={group} onChange={setGroup} testPrefix="players-group" label={t("Agrupar")} />
                  <DensityToggle value={density} onChange={setDensity} />
                </div>
              </div>

              {isLoading ? (
                <div style={{ padding: 14 }} className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 rounded animate-pulse" style={{ background: RS.soft }} />)}</div>
              ) : filtered.length === 0 ? (
                <p style={{ padding: "40px 14px", textAlign: "center", color: RS.muted, fontSize: 13 }}>{any ? t("Sin resultados con estos filtros") : t("No hay jugadores registrados")}</p>
              ) : (
                <div style={{ overflow: "auto", maxHeight: isMobile ? "none" : "calc(100vh - 230px)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: RS.ink }}>
                    <thead>
                      <tr>
                        {th("#", "dorsal")}
                        {th(t("Jugador"), "name")}
                        {showTeamCol && lista && th(t("Equipo"), "team")}
                        {th(t("Año"), "year")}
                        {th(t("Pos"), "position")}
                        {th(t("Pie"))}
                        {th(t("Nac."))}
                        {th(t("PJ"), "pj", true)}
                        {th(t("% min"), "pctMin", true)}
                        {th(t("G"), "goals", true)}
                        {th(t("Entrenos"), "att", true)}
                        {th(t("Estado"))}
                        {accounts && th(t("Cuenta"))}
                        {th("")}
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <React.Fragment key={g.key}>
                          {groupHead(g)}
                          {g.rows.map(row)}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: "8px 14px 10px", fontSize: 11, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}` }}>
                {t("Rojo = juvenil de 1.º año · naranja = 2.º año. En rojo, asistencia a entrenos por debajo del 70 %. Estadísticas de esta temporada con su equipo.")}
              </div>
            </section>
          </div>
        </>)}
      </div>

      <AddPlayerDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingPlayer(null); }}
        teamId={editingPlayer?.team_id || ""}
        editingPlayer={editingPlayer}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("¿Eliminar jugador?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Esta acción no se puede deshacer.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">{t("Eliminar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

