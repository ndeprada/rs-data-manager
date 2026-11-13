// Personal (rediseño del 13/11/2026, maqueta «Maqueta Personal · RS Manager» aprobada por Nacho: «esto me parece perfecto»).
// Una fila por persona con el seguimiento de los últimos 30 días (feedback, 360 del periodo abierto, sesiones registradas,
// listas pasadas, actas por cerrar, objetivos de participación) y, para coordinación, sus ausencias y multas.
// «Contacto» cambia esas columnas por edad, teléfono y email. Cálculos puros en src/lib/coachOverview.js.
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Download, Printer, ChevronRight } from "lucide-react";
import { useTeamAccess } from "@/lib/TeamAccessContext";
import { buildLinks } from "@/lib/staffLink";
import { STAFF_FUNCTION_VALUES, teamRoleLabel, CURRENT_SEASON } from "@/lib/staffRoles";
import { compareTeams, teamRank } from "@/lib/teamOrder";
import { stageSeesCoach, STAGE_COORD_ROLES } from "@/lib/coachStage";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { ageOf } from "@/lib/staffList";
import { downloadCsv, exportFileName, printHtml, staffPrintHtml, toCsv } from "@/lib/staffExport";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { BRAND } from "@/lib/brand";
import { useCoachFollow } from "@/lib/useCoachFollow";
import {
  feedbackSummary, areaAverages, personFollow, absenceSummary, fineSummary, roleGroup, levelOf, alertScore,
  SESSION_LEVELS, LIST_LEVELS,
} from "@/lib/coachOverview";
import { Page, RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { TeamChip, Avatar, AreaBars, Pct, OkMark, AccessMark, agoText, euro, Segmented, LEVEL_COLOR, AMBER } from "@/components/coach/StaffParts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, useFormat, msg } from "@/i18n";

const ROLE_LABELS = {
  entrenador: msg("Entrenador"),
  ayudante: msg("Ayudante"),
  preparador_fisico: msg("Prep. Físico"),
  portero_coach: msg("Portero Coach"),
  medico: msg("Médico"),
  fisioterapeuta: msg("Fisioterapeuta"),
  coordinador: msg("Coordinador"),
  otro: msg("Otro"),
  coordinador_general: msg("Coord. General"),
  director: msg("Director"),
  director_deportivo: msg("Director Deportivo"),
  coordinador_f7: msg("Coord. F7"),
  coordinador_f11: msg("Coord. F11"),
  entrenador_porteros: msg("Entren. Porteros"),
  psicologo: msg("Técnico · Área psicología"),
  admin: msg("Director / Admin"),
};

const APP_STAFF_ROLES = STAFF_FUNCTION_VALUES;
const VIEW_KEY = "rs_staff_view";   // tabla o tarjetas
const COLS_KEY = "rs_staff_cols";   // seguimiento o contacto
const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const seasonLabel = (s) => String(s || "").replace(/^(\d{4})-\d{2}(\d{2})$/, "$1–$2");
const SORTS = [["equipo", msg("Por equipo")], ["nombre", msg("Por nombre")], ["alerta", msg("Por alerta")]];
const th = { padding: "7px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${RS.line}`, background: RS.head };
const td = { padding: "7px 8px", fontSize: 12, borderBottom: `1px solid ${RS.lineSoft}`, verticalAlign: "middle" };
const DASH = <span style={{ color: RS.faint }}>—</span>;

export default function Coaches() {
  const t = useT();
  const { num } = useFormat();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isCoordinator, coordType, isCoordinatorGeneral, perms } = useTeamAccess();
  const admin = !!(perms.isAdmin || perms.administration);
  const [view, setViewState] = useState(() => (lsGet(VIEW_KEY, "tabla") === "tarjetas" ? "tarjetas" : "tabla"));
  const [cols, setColsState] = useState(() => (lsGet(COLS_KEY, "seguimiento") === "contacto" ? "contacto" : "seguimiento"));
  const setView = (v) => { setViewState(v); lsSet(VIEW_KEY, v); };
  const setCols = (v) => { setColsState(v); lsSet(COLS_KEY, v); };
  const [group, setGroup] = useState("todos");
  const [stage, setStage] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("equipo");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [], isLoading } = useQuery({ queryKey: ["staff"], queryFn: () => base44.entities.StaffMember.list() });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ["team_staff_assignments"], queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }) });
  const data = useCoachFollow({ admin });

  // ── Personas: una por ficha de personal; los usuarios registrados sin ficha salen aparte ──
  const people = useMemo(() => {
    const liveUsers = users.filter((u) => u.access_status !== "deleted");
    const links = buildLinks(liveUsers, staff);
    const userOfStaff = new Map([...links.entries()].map(([uid, s]) => [s.id, liveUsers.find((u) => u.id === uid)]));
    const accessOf = (u) => {
      if (!u) return null;
      if (u.role === "admin" || u.access_status === "approved" || (!u.access_status && u.app_role)) return "approved";
      return u.access_status === "pending" ? "pending" : null;
    };
    const teamsOfStaff = (staffId, fallback) => {
      const list = assignments.filter((a) => a.staff_member_id === staffId).map((a) => ({ team_id: a.team_id, team_role: a.team_role }));
      if (!list.length && fallback) list.push({ team_id: fallback, team_role: null });
      return list;
    };
    const fromStaff = staff.map((s) => {
      const u = userOfStaff.get(s.id);
      return {
        id: s.id, ids: new Set([s.id, ...(u ? [`user_${u.id}`] : [])]), url: `/CoachProfile?id=${s.id}`,
        first_name: s.first_name, last_name: s.last_name, role: u?.app_role || s.role,
        photo_url: s.photo_url || u?.photo_url || null, phone: s.phone || u?.phone || null, email: s.email || u?.email || null,
        birth_date: s.birth_date || u?.birth_date || null, access: accessOf(u), team_list: teamsOfStaff(s.id, s.team_id),
      };
    });
    const asUser = (u, extra = {}) => {
      const teamIds = u.team_ids || (u.team_id ? [u.team_id] : []);
      return {
        id: `user_${u.id}`, ids: new Set([`user_${u.id}`]), url: `/CoachProfile?userId=${u.id}`,
        first_name: u.full_name?.split(" ")[0] || u.full_name || "", last_name: u.full_name?.split(" ").slice(1).join(" ") || "",
        role: u.app_role, photo_url: u.photo_url || null, phone: u.phone || null, email: u.email, birth_date: u.birth_date || null,
        access: "approved", team_list: teamIds.map((id) => ({ team_id: id, team_role: null })), ...extra,
      };
    };
    const usersAsStaff = liveUsers.filter((u) => APP_STAFF_ROLES.includes(u.app_role) && u.access_status === "approved" && !links.has(u.id)).map((u) => asUser(u));
    const admins = liveUsers.filter((u) => u.role === "admin" && !links.has(u.id) && !usersAsStaff.some((s) => s.id === `user_${u.id}`))
      .map((u) => asUser(u, { role: "admin", team_list: [], isAdmin: true }));
    return [...fromStaff, ...usersAsStaff, ...admins].filter((s) => s.role !== "medico");
  }, [users, staff, assignments]);

  const teamById = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams]);
  const rows = useMemo(() => {
    const now = new Date();
    return people.map((s) => {
      const list = (s.team_list || []).map((a) => ({ a, tm: teamById.get(a.team_id) })).filter((x) => x.tm).sort((x, y) => compareTeams(x.tm, y.tm));
      const teamIds = list.map((x) => x.tm.id);
      const grp = s.isAdmin ? "coordinacion" : roleGroup(s.role);
      const isCoach = grp === "entrenadores";
      const fb = feedbackSummary(data.feedback, s.ids, now);
      const row = {
        ...s, name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || t("Sin nombre"),
        initials: `${s.first_name?.[0] || ""}${s.last_name?.[0] || ""}`, group: grp, isCoach,
        roleLabel: ROLE_LABELS[s.role] ? t(ROLE_LABELS[s.role]) : s.role || "—", roleEs: ROLE_LABELS[s.role] || s.role || "—",
        teams: list, teamIds, rank: list.length ? teamRank(list[0].tm) : 999,
        feedback: fb, area: isCoach || fb.total ? areaAverages(data.obs, data.closes, s.ids, CURRENT_SEASON) : null,
        follow: isCoach && teamIds.length ? personFollow(teamIds.map(data.follow)) : null,
        behind: isCoach ? teamIds.reduce((n, id) => n + (data.behind.get(id) || 0), 0) : 0,
        pendingTeams: isCoach ? list.map(({ tm }) => ({ tm, n: data.follow(tm.id).pendingLists })).filter((x) => x.n) : [],
        absences: admin ? absenceSummary(data.absences, s.ids, CURRENT_SEASON, now) : null,
        fines: admin ? fineSummary(data.fines, s.ids, CURRENT_SEASON) : null,
      };
      row.alert = alertScore(row);
      return row;
    });
  }, [people, teamById, data, admin, t]);

  // Coordinador de etapa: solo quien lleva algún equipo de su etapa (misma regla que la ficha, lib/coachStage.js)
  const visibleRows = rows.filter((r) => {
    if (r.isAdmin) return true;
    if (!isCoordinatorGeneral && STAGE_COORD_ROLES.includes(coordType)) return stageSeesCoach(coordType, r.teams.map((x) => x.tm));
    return true;
  });
  const counts = { todos: visibleRows.length, entrenadores: 0, coordinacion: 0, otros: 0 };
  for (const r of visibleRows) counts[r.group]++;
  const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtered = visibleRows.filter((r) => {
    if (group !== "todos" && r.group !== group) return false;
    if (stage !== "all" && !r.teams.some(({ tm }) => (teamPlaysF7(tm) ? "f7" : "f11") === stage)) return false;
    if (filterTeam !== "all" && !r.teamIds.includes(filterTeam)) return false;
    if (q.trim() && !norm(`${r.name} ${r.teams.map((x) => x.tm.name).join(" ")}`).includes(norm(q.trim()))) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "nombre") return a.name.localeCompare(b.name, "es");
    if (sort === "alerta") return b.alert - a.alert || a.rank - b.rank || a.name.localeCompare(b.name, "es");
    return a.rank - b.rank || a.name.localeCompare(b.name, "es");
  });

  // ── Resumen (con los filtros puestos); los equipos que llevan varias personas cuentan una vez ──
  const kpis = useMemo(() => {
    const coaches = filtered.filter((r) => r.isCoach);
    const teamIds = [...new Set(coaches.flatMap((r) => r.teamIds))];
    const tf = teamIds.map(data.follow);
    const held = tf.reduce((s, f) => s + f.held, 0), withS = tf.reduce((s, f) => s + f.withSession, 0);
    const pendingT = teamIds.map((id) => ({ tm: teamById.get(id), n: data.follow(id).pendingLists })).filter((x) => x.n);
    const noFb = coaches.filter((r) => r.feedback.n30 === 0);
    const noApp = filtered.filter((r) => !r.access);
    const pendingApp = filtered.filter((r) => r.access === "pending");
    return [
      { k: "people", n: filtered.length, label: filtered.length === 1 ? t("persona") : t("personas"), sub: t("{a} entrenadores · {b} otros", { a: coaches.length, b: filtered.length - coaches.length }) },
      { k: "feedback", n: noFb.length, color: noFb.length ? "#B91C1C" : undefined, label: t("sin feedback 30 días"), sub: noFb.slice(0, 2).map((r) => r.name).join(" · ") },
      ...(admin ? [{ k: "sessions", n: held ? `${Math.round((withS / held) * 100)} %` : "—", color: LEVEL_COLOR[levelOf(held ? Math.round((withS / held) * 100) : null, SESSION_LEVELS)], label: t("sesiones registradas"), sub: t("de los entrenos de los últimos 30 días") }] : []),
      { k: "lists", n: pendingT.reduce((s, x) => s + x.n, 0), color: pendingT.length ? AMBER : undefined, label: t("listas por pasar"), sub: pendingT.slice(0, 2).map((x) => `${x.tm?.name} ${x.n}`).join(" · ") || t("últimos 30 días") },
      { k: "actas", n: tf.reduce((s, f) => s + f.actas, 0), color: tf.some((f) => f.actas) ? "#B91C1C" : undefined, label: t("actas por cerrar"), sub: t("partidos jugados") },
      { k: "app", n: noApp.length, label: t("sin acceso a la app"), sub: pendingApp.length ? t("+{n} pendiente de aprobar", { n: pendingApp.length }) : "" },
    ];
  }, [filtered, data, teamById, admin, t]);

  if (!isCoordinator && !perms.canViewCoachProfiles) {
    return <div className="p-12 text-center"><p className="text-gray-400">{t("No tienes acceso a esta sección.")}</p></div>;
  }

  // ── Excel e impresión (siempre en español): lo que se ve, con el mismo filtro y orden ──
  const filterLabel = filterTeam === "all" ? "Todos los equipos" : teamById.get(filterTeam)?.name || "Equipo";
  const teamsText = (r) => r.teams.map(({ a, tm }) => (a.team_role ? `${tm.name} (${teamRoleLabel(a.team_role)})` : tm.name)).join("; ");
  const accessEs = (r) => (r.access === "approved" ? "Con acceso" : r.access === "pending" ? "Pendiente de aprobar" : "Sin acceso");
  const exportExcel = () => {
    const header = ["Nombre", "Rol", "Equipos", "Edad", "Teléfono", "Email", "Acceso a la app", "Feedback 30 días", "Último feedback", "360 periodo abierto", "Sesiones registradas %", "Listas pasadas %", "Actas por cerrar", "Jugadores por detrás de objetivos",
      ...(admin ? ["Ausencias temporada", "Multas pendientes €", "Multas pagadas €"] : [])];
    const data2 = filtered.map((r) => [
      r.name, r.roleEs, teamsText(r), ageOf(r.birth_date)?.age ?? "", r.phone || "", r.email || "", accessEs(r),
      r.isCoach || r.feedback.total ? r.feedback.n30 : "", r.feedback.last || "", r.area?.overall ?? "",
      r.follow?.sessionsPct ?? "", r.follow?.listsPct ?? "", r.follow ? r.follow.actas : "", r.isCoach ? r.behind : "",
      ...(admin ? [r.absences.season, r.fines.pendingAmount, r.fines.paidAmount] : []),
    ]);
    downloadCsv(exportFileName("personal"), toCsv(header, data2));
  };
  const exportPrint = () => {
    const header = ["Nombre", "Edad", "Rol", "Equipos que entrena", "Teléfono", "Email", "Acceso a la app"];
    printHtml(staffPrintHtml({
      header, rows: filtered.map((r) => [r.name, ageOf(r.birth_date)?.age ?? "", r.roleEs, teamsText(r), r.phone || "", r.email || "", accessEs(r)]),
      title: "Personal", subtitle: `${BRAND.clubName} · ${filterLabel}`, logoUrl: CLUB_LOGO_URL, origin: window.location.origin,
    }));
  };

  const open = (r) => navigate(r.url);
  const feedbackCell = (r) => {
    if (!r.isCoach && !r.feedback.total) return DASH;
    const late = r.feedback.daysAgo == null || r.feedback.daysAgo > 30;
    return (
      <span style={{ whiteSpace: "nowrap" }}>
        <b className="tabular-nums">{r.feedback.n30}</b>
        <span style={{ color: late ? "#B91C1C" : RS.muted }}> · {r.feedback.last ? agoText(t, r.feedback.daysAgo) : t("nunca")}</span>
      </span>
    );
  };
  const countCell = (n, color) => (n ? <b className="tabular-nums" style={{ color }}>{n}</b> : <OkMark />);
  const absCell = (r) => (r.absences.season ? (
    <span style={{ whiteSpace: "nowrap" }} title={t("{a} en los últimos 30 días · {b} sin avisar", { a: r.absences.n30, b: r.absences.unnotified })}>
      <b className="tabular-nums" style={{ color: r.absences.unnotified ? "#B91C1C" : RS.ink }}>{r.absences.season}</b>
      {r.absences.n30 > 0 && <span style={{ color: RS.muted }}> · {t("{n} este mes", { n: r.absences.n30 })}</span>}
    </span>
  ) : <span style={{ color: RS.faint }}>0</span>);
  const fineCell = (r) => (r.fines.n ? (
    <span style={{ whiteSpace: "nowrap" }} title={t("{n} multas · {p} pagado", { n: r.fines.n, p: euro(num, r.fines.paidAmount) })}>
      {r.fines.pendingAmount ? <b className="tabular-nums" style={{ color: "#B91C1C" }}>{euro(num, r.fines.pendingAmount)}</b> : <span style={{ color: RS.muted }}>{t("pagadas")}</span>}
    </span>
  ) : <span style={{ color: RS.faint }}>—</span>);

  const personCell = (r) => (
    <div className="flex items-center" style={{ gap: 9, minWidth: 0 }}>
      <Avatar name={r.name} initials={r.initials} photo={r.photo_url} accent={r.isAdmin} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: RS.ink }}>{r.name}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: RS.naranja, letterSpacing: ".05em", textTransform: "uppercase" }}>{r.roleLabel}</div>
      </div>
    </div>
  );
  const teamsCell = (r) => (r.teams.length ? <div className="flex flex-col" style={{ gap: 3, alignItems: "flex-start" }}>{r.teams.map(({ a, tm }) => <TeamChip key={tm.id} team={tm} role={a.team_role} />)}</div> : DASH);

  const tableView = (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="staff-table">
        <thead>
          <tr>
            <th style={th}>{t("Persona")}</th>
            <th style={th}>{t("Equipos")}</th>
            {cols === "seguimiento" ? (<>
              <th style={th}>{t("Feedback 30 d")}</th>
              <th style={th}>{t("360 · periodo")}</th>
              {admin && <th style={th}>{t("Sesiones")}</th>}
              <th style={th}>{t("Listas")}</th>
              <th style={th}>{t("Actas")}</th>
              <th style={th}>{t("Objetivos")}</th>
              {admin && <th style={th}>{t("Ausencias")}</th>}
              {admin && <th style={th}>{t("Multas")}</th>}
            </>) : (<>
              <th style={th}>{t("Edad")}</th>
              <th style={th}>{t("Teléfono")}</th>
              <th style={th}>{t("Email")}</th>
            </>)}
            <th style={{ ...th, textAlign: "center" }}>{t("App")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} tabIndex={0} onClick={() => open(r)} onKeyDown={(e) => { if (e.key === "Enter") open(r); }} data-testid={`staff-row-${r.id}`}
              className="cursor-pointer hover:bg-[#FBF8F8] focus:outline-none focus:bg-[#FBF8F8]">
              <td style={td}>{personCell(r)}</td>
              <td style={td}>{teamsCell(r)}</td>
              {cols === "seguimiento" ? (<>
                <td style={td} data-testid={`staff-fb-${r.id}`}>{feedbackCell(r)}</td>
                <td style={td}>{r.area ? <AreaBars data={r.area} /> : DASH}</td>
                {admin && <td style={td}>{r.follow ? <Pct value={r.follow.sessionsPct} level={levelOf(r.follow.sessionsPct, SESSION_LEVELS)} /> : DASH}</td>}
                <td style={td} title={r.pendingTeams.map((x) => `${x.tm.name}: ${x.n}`).join(" · ")}>{r.follow ? <Pct value={r.follow.listsPct} level={levelOf(r.follow.listsPct, LIST_LEVELS)} /> : DASH}</td>
                <td style={td}>{r.follow ? countCell(r.follow.actas, "#B91C1C") : DASH}</td>
                <td style={td}>{r.isCoach && r.teams.length ? countCell(r.behind, AMBER) : DASH}</td>
                {admin && <td style={td} data-testid={`staff-abs-${r.id}`}>{absCell(r)}</td>}
                {admin && <td style={td} data-testid={`staff-fine-${r.id}`}>{fineCell(r)}</td>}
              </>) : (<>
                <td style={td} className="tabular-nums">{ageOf(r.birth_date)?.age ?? DASH}</td>
                <td style={td}>{r.phone ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: RS.ink }}>{r.phone}</a> : DASH}</td>
                <td style={td}>{r.email ? <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} style={{ color: RS.ink, wordBreak: "break-all" }}>{r.email}</a> : DASH}</td>
              </>)}
              <td style={{ ...td, textAlign: "center" }}><AccessMark access={r.access} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const cardsView = (
    <div className={isMobile ? "" : "grid"} style={isMobile ? {} : { gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 10, padding: 12 }} data-testid="staff-cards">
      {filtered.map((r) => (
        <button key={r.id} type="button" onClick={() => open(r)} data-testid={`staff-card-${r.id}`}
          style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", padding: isMobile ? "11px 12px" : 12, border: isMobile ? 0 : `1px solid ${RS.line}`, borderBottom: `1px solid ${RS.lineSoft}`, borderRadius: isMobile ? 0 : 10 }}>
          <div className="flex items-start" style={{ gap: 10 }}>
            <Avatar name={r.name} initials={r.initials} photo={r.photo_url} size={38} accent={r.isAdmin} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-start" style={{ gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: RS.ink }}>{r.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: RS.naranja, letterSpacing: ".05em", textTransform: "uppercase" }}>{r.roleLabel}</div>
                </div>
                {cols === "seguimiento" && r.area && <AreaBars data={r.area} />}
                {!isMobile && <ChevronRight width={15} height={15} color={RS.faint} aria-hidden="true" />}
              </div>
              {r.teams.length > 0 && <div className="flex flex-wrap" style={{ gap: 4, marginTop: 4 }}>{r.teams.map(({ a, tm }) => <TeamChip key={tm.id} team={tm} role={a.team_role} />)}</div>}
            </div>
          </div>
          {cols === "seguimiento" ? (
            (r.isCoach || r.feedback.total > 0) && (
              <div className="flex flex-wrap" style={{ gap: "2px 12px", marginTop: 6, fontSize: 12, color: RS.ink2 }}>
                <span>{t("Feedback")} {feedbackCell(r)}</span>
                {r.follow && admin && <span>{t("Sesiones")} <Pct value={r.follow.sessionsPct} level={levelOf(r.follow.sessionsPct, SESSION_LEVELS)} /></span>}
                {r.follow && <span>{t("Listas")} <Pct value={r.follow.listsPct} level={levelOf(r.follow.listsPct, LIST_LEVELS)} /></span>}
                {r.follow?.actas > 0 && <span style={{ color: "#B91C1C" }}>{t("Actas {n}", { n: r.follow.actas })}</span>}
                {r.behind > 0 && <span style={{ color: AMBER }}>{t("Objetivos {n}", { n: r.behind })}</span>}
                {admin && r.absences.season > 0 && <span>{t("Ausencias")} {absCell(r)}</span>}
                {admin && r.fines.pendingAmount > 0 && <span style={{ color: "#B91C1C" }}>{t("Multas {e}", { e: euro(num, r.fines.pendingAmount) })}</span>}
              </div>
            )
          ) : (
            <div className="flex flex-wrap" style={{ gap: "2px 12px", marginTop: 6, fontSize: 12, color: RS.ink2 }}>
              {r.phone && <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: RS.ink }}>{r.phone}</a>}
              {r.email && <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} style={{ color: RS.ink, wordBreak: "break-all" }}>{r.email}</a>}
              <AccessMark access={r.access} />
            </div>
          )}
        </button>
      ))}
    </div>
  );

  const showCards = isMobile || view === "tarjetas";
  const sortedTeams = [...teams].sort(compareTeams);
  return (
    <Page testId="staff">
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: isMobile ? "12px 10px 24px" : "18px 22px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-end" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", color: RS.muted, textTransform: "uppercase" }}>{t("Administración · Temporada {s}", { s: seasonLabel(CURRENT_SEASON) })}</div>
            <h1 style={{ margin: "2px 0 0", lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: isMobile ? 30 : 36, color: RS.granate }}>{t("PERSONAL")}</span></h1>
          </div>
          {!isMobile && (
            <div className="flex" style={{ marginLeft: "auto", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={exportExcel} data-testid="staff-export" title={t("Descarga un archivo que se abre con Excel")}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, display: "flex", gap: 6, alignItems: "center" }}>
                <Download width={14} height={14} aria-hidden="true" /> {t("Exportar Excel")}
              </button>
              <button type="button" onClick={exportPrint} data-testid="staff-print"
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, display: "flex", gap: 6, alignItems: "center" }}>
                <Printer width={14} height={14} aria-hidden="true" /> {t("Imprimir")}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="staff-kpis">
          {kpis.map((k) => (
            <div key={k.k} data-testid={`staff-kpi-${k.k}`} style={{ flex: isMobile ? "1 1 130px" : "1 1 150px", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 10 }}>
              <span className="rs2-display tabular-nums" style={{ fontSize: 24, color: k.color || RS.granateDark, whiteSpace: "nowrap" }}>{k.n}</span>
              <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.15 }}>{k.label}{k.sub && !isMobile && <span style={{ display: "block", fontSize: 11, color: RS.muted }}>{k.sub}</span>}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <Segmented options={[["todos", `${t("Todos")} · ${counts.todos}`], ["entrenadores", `${t("Entrenadores")} · ${counts.entrenadores}`], ["coordinacion", `${t("Coordinación")} · ${counts.coordinacion}`], ["otros", `${t("Otros")} · ${counts.otros}`]]}
            value={group} onChange={setGroup} testPrefix="staff-group" label={t("Función")} />
          <Segmented options={[["all", msg("Todas las etapas")], ["f11", "F11"], ["f7", "F7"]]} value={stage} onChange={setStage} testPrefix="staff-stage" label={t("Etapa")} />
          <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} data-testid="staff-team" aria-label={t("Equipo")}
            style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink, maxWidth: 200 }}>
            <option value="all">{t("Todos los equipos")}</option>
            {sortedTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
          <label className="flex items-center" style={{ gap: 7, border: `1px solid ${RS.line}`, borderRadius: 8, padding: "4px 9px", flex: "1 1 200px", minWidth: 160, background: "#fff" }}>
            <Search width={13} height={13} color={RS.muted} aria-hidden="true" />
            <span className="sr-only">{t("Buscar persona o equipo…")}</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Buscar persona o equipo…")} data-testid="staff-search" style={{ fontSize: 12, border: 0, outline: 0, flex: 1, minWidth: 0, background: "none", color: RS.ink }} />
          </label>
          <Segmented options={SORTS} value={sort} onChange={setSort} testPrefix="staff-sort" label={t("Ordenar")} />
        </div>

        <section className="rs2-card" style={{ padding: 0, overflow: "hidden" }}>
          <Head title={t("PERSONAL Y SEGUIMIENTO")} testId="staff-head" right={<>
            <span style={{ color: RS.muted }}>{filtered.length === 1 ? t("1 persona") : t("{n} personas", { n: filtered.length })}</span>
            <Segmented options={[["seguimiento", msg("Seguimiento")], ["contacto", msg("Contacto")]]} value={cols} onChange={setCols} testPrefix="staff-cols" label={t("Columnas")} />
            {!isMobile && <Segmented options={[["tabla", msg("Tabla")], ["tarjetas", msg("Tarjetas")]]} value={view} onChange={setView} testPrefix="staff-view" label={t("Vista")} />}
          </>} />
          {isLoading ? (
            <div style={{ padding: 14 }} className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-9 rounded animate-pulse" style={{ background: RS.soft }} />)}</div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "40px 14px", textAlign: "center", color: RS.muted, fontSize: 13 }}>{visibleRows.length ? t("Nadie con estos filtros") : t("No hay miembros del cuerpo técnico registrados")}</p>
          ) : showCards ? cardsView : tableView}
          <div style={{ padding: "8px 14px 10px", fontSize: 11, color: RS.muted, borderTop: `1px solid ${RS.lineSoft}`, lineHeight: 1.5 }}>
            <b style={{ color: RS.ink2 }}>{t("Seguimiento de los últimos 30 días:")}</b>{" "}
            {t("feedback = anotaciones hechas sobre él · 360 = media de cada área en el periodo abierto · sesiones = hojas de sesión registradas sobre los entrenos celebrados de sus equipos · listas = entrenos con la asistencia pasada · actas = partidos por cerrar · objetivos = jugadores por detrás del ritmo de participación.")}
            {admin && <> {t("Ausencias y multas: de la temporada (solo las ve coordinación).")}</>}
          </div>
        </section>
      </div>
    </Page>
  );
}
