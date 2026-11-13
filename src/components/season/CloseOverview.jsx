import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMatchStatus } from "@/lib/matchStatus";
import { RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { transferKpis, seasonChecklist, nextSeasonOf, shortSeason } from "@/lib/seasonView";
import { useSeasonPlan } from "./useSeasonPlan";
import { useT, useLocaleTag, msg } from "@/i18n";

const OK = "#15803D", WARN = "#B45309";
const COLORS = { ok: OK, warn: WARN, todo: "#C9BEBF", now: RS.granate };

function Step({ n, title, sub, state, testId }) {
  const c = COLORS[state];
  return (
    <div data-testid={testId} data-state={state} className="flex" style={{ flex: "1 1 210px", gap: 10, padding: "10px 12px", background: "#fff", border: `1px solid ${RS.line}`, borderTop: `3px solid ${c}`, borderRadius: 12 }}>
      <span style={{ width: 26, height: 26, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", background: c, flex: "none" }}>
        {state === "ok" ? <Check className="w-4 h-4" /> : state === "warn" ? "!" : n}
      </span>
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 13, color: RS.ink }}>{title}</b>
        <div style={{ fontSize: 11.5, color: RS.muted, lineHeight: 1.3 }}>{sub}</div>
      </div>
    </div>
  );
}

/** Pasos antes de cerrar: traspasos, actas, copia de seguridad, clasificación y cierre */
export function CloseSteps({ season, closed }) {
  const t = useT();
  const tag = useLocaleTag();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: backups = [] } = useQuery({ queryKey: ["backups"], queryFn: () => base44.club.backupList() });
  const { moves } = useSeasonPlan(season);
  const { pending, events } = useMatchStatus();
  const teamIds = useMemo(() => new Set(teams.map((x) => x.id)), [teams]);
  const squad = useMemo(() => players.filter((p) => p.team_id && p.status !== "baja"), [players]);
  const k = transferKpis(squad, moves, teamIds);
  const pendingTeams = [...new Set([...pending.keys()].map((id) => events.find((e) => e.id === id)?.team_id).filter(Boolean))]
    .map((id) => teams.find((x) => x.id === id)?.name).filter(Boolean);
  const last = backups[0];
  const withFcf = teams.filter((x) => x.fcf_team_code || x.fcf_group_url).length;
  const when = (d) => new Date(d).toLocaleString(tag, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex flex-wrap" style={{ gap: 10 }} data-testid="close-steps">
      <Step testId="close-step-transfers" n={1} title={t("Traspasos")} state={closed || k.undecided === 0 ? "ok" : "warn"}
        sub={closed ? t("Aplicados") : t("{d} de {n} decididos · {u} se quedarán donde están", { d: k.decided, n: k.total, u: k.undecided })} />
      <Step testId="close-step-matches" n={2} title={t("Partidos cerrados")} state={closed || pending.size === 0 ? "ok" : "warn"}
        sub={pending.size === 0 ? t("Todas las actas cerradas") : t("{n} actas por cerrar ({teams})", { n: pending.size, teams: pendingTeams.slice(0, 3).join(", ") + (pendingTeams.length > 3 ? "…" : "") })} />
      <Step testId="close-step-backup" n={3} title={t("Copia de seguridad")} state={last ? "ok" : "now"}
        sub={last ? t("Última: {when} · se hará otra al cerrar", { when: when(last.created_at) }) : t("Se hará una al cerrar")} />
      <Step testId="close-step-standings" n={4} title={t("Clasificación final")} state={closed ? "ok" : "now"}
        sub={t("Se lee de la FCF al revisar · {n} de {m} equipos con grupo", { n: withFcf, m: teams.length })} />
      <Step testId="close-step-close" n={5} title={t("Revisar y cerrar")} state={closed ? "ok" : "todo"}
        sub={closed ? t("Temporada cerrada") : t("Resumen de lo que va a pasar y confirmación")} />
    </div>
  );
}

const CHECKS = [
  { key: "fcf", label: msg("Grupo de la FCF de cada equipo ({n} de {total})"), link: "/Teams", page: msg("Equipos") },
  { key: "staff", label: msg("Cuerpo técnico de cada equipo ({n} de {total})"), link: "/Coaches", page: msg("Personal") },
  { key: "dorsal", label: msg("Jugadores sin dorsal ({n})"), link: "/Players", page: msg("Jugadores") },
  { key: "trainings", label: msg("Entrenos programados ({n} de {total} equipos)"), link: "/Calendar", page: msg("Calendario") },
  { key: "rules", label: msg("Objetivos de participación y mínimo de minutos"), link: "/Stats", page: msg("Estadísticas") },
];

/** Lista para empezar la temporada nueva: se marca sola con lo que ya está hecho en la app */
export function StartChecklist({ season, closed }) {
  const t = useT();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ["team_staff_assignments"], queryFn: () => base44.entities.TeamStaffAssignment.filter({ active: true }) });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: rules = [] } = useQuery({ queryKey: ["minutes-rules"], queryFn: () => base44.entities.MinutesRule.list() });
  const list = seasonChecklist({ teams, assignments, players, events, rules });
  const target = closed ? season : nextSeasonOf(season);
  return (
    <section style={{ background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" }} data-testid="start-checklist">
      <Head title={closed ? t("Lista para empezar {s}", { s: shortSeason(target) }) : t("Después de cerrar · lista para empezar {s}", { s: shortSeason(target) })} />
      <div className="flex flex-col" style={{ padding: "10px 14px", gap: 7, fontSize: 12.5 }}>
        {CHECKS.map((c) => {
          const it = list.find((x) => x.key === c.key);
          return (
            <div key={c.key} className="flex items-center" style={{ gap: 8 }} data-testid={`start-check-${c.key}`} data-done={it.done ? "1" : "0"}>
              <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${it.done ? OK : "#C9BEBF"}`, background: it.done ? OK : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                {it.done && <Check className="w-3 h-3" />}
              </span>
              <span style={{ flex: 1, color: RS.ink }}>{t(c.label, { n: it.n, total: it.total })}</span>
              <Link to={c.link} style={{ color: RS.granate, fontWeight: 700, fontSize: 12 }}>{t(c.page)} ›</Link>
            </div>
          );
        })}
        <div style={{ fontSize: 11.5, color: RS.muted }}>{t("La lista se va marcando sola según lo que ya está hecho en la app.")}</div>
      </div>
    </section>
  );
}
