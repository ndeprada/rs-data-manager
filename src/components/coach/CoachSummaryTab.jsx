// Pestaña «Resumen» de la ficha del entrenador (13/11/2026, maqueta «Maqueta Personal · RS Manager» aprobada por Nacho):
// sus equipos en los últimos 30 días, último feedback, la 360 del periodo abierto por área, lo que sigue en seguimiento
// y, para coordinación, sus ausencias y multas. Solo lectura: cada cosa se cambia en su pestaña.
import React, { useMemo } from "react";
import { format } from "date-fns";
import { RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import { useCoachFollow } from "@/lib/useCoachFollow";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { COACH_AREAS, areaInfo, feedbackArea } from "@/lib/coachAreas";
import { progressOf, progressInfo } from "@/lib/coachPeriods";
import { avgColor } from "@/lib/coachMethod";
import { teamPlaysF7 } from "@/lib/matchFormat";
import {
  areaAverages, followingUp, absenceSummary, fineSummary, levelOf, SESSION_LEVELS, LIST_LEVELS, ofPerson, reasonInfo, kindInfo, conceptInfo,
} from "@/lib/coachOverview";
import { Pct, OkMark, AMBER, euro } from "@/components/coach/StaffParts";
import { useT, useFormat } from "@/i18n";

const card = { background: "#fff", border: `1px solid ${RS.line}`, borderRadius: 12, overflow: "hidden" };
const small = { fontSize: 10, color: RS.muted, display: "block" };
const PROGRESS_STYLE = { pendiente: [RS.soft, RS.ink2], seguir: ["#FEF3C7", "#92400E"], asimilado: ["#DCFCE7", "#166534"] };
const chip = ([bg, fg]) => ({ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" });

export default function CoachSummaryTab({ ids, teams = [], admin, onTab }) {
  const t = useT();
  const { locale, num } = useFormat();
  const idList = useMemo(() => [...ids], [ids]);
  const idSet = useMemo(() => new Set(idList), [idList]);
  const data = useCoachFollow({ admin, staffIds: idList });
  const short = (d) => (d ? format(new Date(`${String(d).slice(0, 10)}T12:00:00`), "d MMM", { locale }) : "");
  const one = (v) => (v == null ? "—" : num(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  const area = areaAverages(data.obs, data.closes, idSet, CURRENT_SEASON);
  const lastFb = ofPerson(data.feedback, idSet).filter((f) => f.date).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
  const follow = followingUp(data.feedback, idSet, CURRENT_SEASON);
  const abs = admin ? absenceSummary(data.absences, idSet, CURRENT_SEASON) : null;
  const fines = admin ? fineSummary(data.fines, idSet, CURRENT_SEASON) : null;

  const stat = (value, label, color) => <div><b className="tabular-nums" style={{ fontSize: 13, color: color || RS.ink }}>{value}</b><span style={small}>{label}</span></div>;
  const teamRow = ({ tm }) => {
    const f = data.follow(tm.id);
    const behind = data.behind.get(tm.id) || 0;
    return (
      <div key={tm.id} className="grid items-center" data-testid={`summary-team-${tm.id}`}
        style={{ gridTemplateColumns: admin ? "minmax(120px,1.4fr) repeat(6, minmax(58px,1fr))" : "minmax(120px,1.4fr) repeat(5, minmax(58px,1fr))", gap: 8, padding: "9px 14px", borderTop: `1px solid ${RS.lineSoft}` }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{tm.name} <span style={{ fontSize: 10, color: RS.faint, fontWeight: 400 }}>{teamPlaysF7(tm) ? "F7" : "F11"}</span></div>
        {admin && <div><Pct value={f.sessionsPct} level={levelOf(f.sessionsPct, SESSION_LEVELS)} /><span style={small}>{t("sesiones")}</span></div>}
        <div><Pct value={f.listsPct} level={levelOf(f.listsPct, LIST_LEVELS)} /><span style={small}>{t("listas")}</span></div>
        <div>{f.actas ? <b style={{ color: "#B91C1C" }}>{f.actas}</b> : <OkMark />}<span style={small}>{t("actas")}</span></div>
        {stat(f.attendance == null ? "—" : `${f.attendance} %`, t("asistencia"), f.attendance != null && f.attendance < 80 ? "#B91C1C" : undefined)}
        <div>{behind ? <b style={{ color: AMBER }}>{behind}</b> : <OkMark />}<span style={small}>{t("objetivos")}</span></div>
        {stat(`${f.rec.w}-${f.rec.d}-${f.rec.l}`, t("V-E-D"))}
      </div>
    );
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 12, alignItems: "start" }} data-testid="coach-summary">
      <div className="flex flex-col" style={{ gap: 12 }}>
        <section style={card}>
          <Head title={t("SUS EQUIPOS · ÚLTIMOS 30 DÍAS")} />
          {teams.length ? <div style={{ overflowX: "auto" }}>{teams.map(teamRow)}</div> : <p style={{ padding: 14, fontSize: 13, color: RS.muted }}>{t("No tiene equipos asignados.")}</p>}
        </section>
        <section style={card}>
          <Head title={t("ÚLTIMO FEEDBACK")} right={<button type="button" onClick={() => onTab("feedback")} style={{ color: RS.granate, fontWeight: 600 }}>{t("Ver todo ›")}</button>} />
          {lastFb.length ? lastFb.map((f) => {
            const p = progressOf(f);
            return (
              <div key={f.id} style={{ padding: "8px 14px", borderTop: `1px solid ${RS.lineSoft}` }}>
                <div className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 11, color: RS.muted }}>
                  <span>{short(f.date)} · {t(areaInfo(feedbackArea(f)).label)}</span>
                  <span style={chip(f.tone === "positivo" ? ["#DCFCE7", "#166534"] : ["#FEF3C7", "#92400E"])}>{f.tone === "positivo" ? t("Positivo") : t("A mejorar")}</span>
                  <span style={chip(PROGRESS_STYLE[p])}>{t(progressInfo(p).label)}</span>
                </div>
                <p style={{ fontSize: 13, color: RS.ink, margin: "2px 0 0" }}>{(f.text || "").trim() || t("(feedback por apartados)")}</p>
              </div>
            );
          }) : <p style={{ padding: 14, fontSize: 13, color: RS.muted }}>{t("Sin feedback esta temporada.")}</p>}
        </section>
      </div>

      <div className="flex flex-col" style={{ gap: 12 }}>
        <section style={card} data-testid="summary-360">
          <Head title={t("EVALUACIÓN 360 · PERIODO ABIERTO")} right={<button type="button" onClick={() => onTab("eval360")} style={{ color: RS.granate, fontWeight: 600 }}>{t("Evaluar ›")}</button>} />
          <div style={{ padding: "8px 14px 12px" }}>
            {COACH_AREAS.map((a) => {
              const x = area.areas[a.key];
              return (
                <div key={a.key} className="grid items-center" style={{ gridTemplateColumns: "minmax(120px,1fr) 1.2fr 34px 50px", gap: 10, padding: "4px 0", fontSize: 13 }}>
                  <span>{t(a.label)}</span>
                  <span style={{ height: 7, borderRadius: 4, background: RS.lineSoft, position: "relative" }}>
                    {x.avg != null && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(x.avg / 4) * 100}%`, background: avgColor(x.avg), borderRadius: 4 }} />}
                  </span>
                  <b className="tabular-nums" style={{ textAlign: "right" }}>{one(x.avg)}</b>
                  <span style={{ fontSize: 11, color: RS.muted }}>{x.n ? t("{n} obs.", { n: x.n }) : ""}</span>
                </div>
              );
            })}
            {!area.n && <p style={{ fontSize: 12, color: RS.muted, marginTop: 4 }}>{t("Todavía no hay observaciones en el periodo abierto.")}</p>}
          </div>
        </section>
        <section style={card}>
          <Head title={t("EN SEGUIMIENTO")} />
          <div style={{ padding: "8px 14px 12px" }}>
            {follow.length ? (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                {follow.slice(0, 5).map((f) => <li key={f.id}>{(f.text || "").trim() || t(areaInfo(feedbackArea(f)).label)} <span style={{ color: RS.muted }}>({t("desde {d}", { d: short(f.date) })})</span></li>)}
              </ul>
            ) : <p style={{ fontSize: 13, color: RS.muted, margin: 0 }}>{t("Nada marcado «Seguir trabajando».")}</p>}
            <p style={{ fontSize: 11, color: RS.muted, margin: "6px 0 0" }}>{t("Lo marcado «Seguir trabajando» que sigue abierto.")}</p>
          </div>
        </section>
        {admin && (
          <section style={card} data-testid="summary-absences">
            <Head title={t("AUSENCIAS Y MULTAS")} right={<button type="button" onClick={() => onTab("ausencias")} style={{ color: RS.granate, fontWeight: 600 }}>{t("Anotar ›")}</button>} />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, padding: "10px 14px 12px", fontSize: 13 }}>
              <div>
                <div><b className="rs2-display tabular-nums" style={{ fontSize: 22, color: abs.season ? RS.granate : RS.faint }}>{abs.season}</b> <span style={{ color: RS.ink2 }}>{abs.season === 1 ? t("ausencia esta temporada") : t("ausencias esta temporada")}</span></div>
                {abs.season > 0 && <div style={{ fontSize: 11, color: RS.muted }}>{t("{a} entrenos · {b} partidos · {c} sin avisar", { a: abs.trainings, b: abs.matches, c: abs.unnotified })}</div>}
                {abs.last && <div style={{ fontSize: 12, marginTop: 4 }}>{t("Última:")} {short(abs.last.date)} · {t(kindInfo(abs.last.kind).label)} · {t(reasonInfo(abs.last.reason).label)}</div>}
              </div>
              <div>
                <div><b className="rs2-display tabular-nums" style={{ fontSize: 22, color: fines.pendingAmount ? "#B91C1C" : RS.faint }}>{euro(num, fines.pendingAmount)}</b> <span style={{ color: RS.ink2 }}>{t("por pagar")}</span></div>
                {fines.n > 0 && <div style={{ fontSize: 11, color: RS.muted }}>{t("{n} multas · {p} pagado", { n: fines.n, p: euro(num, fines.paidAmount) })}</div>}
                {fines.list[0] && <div style={{ fontSize: 12, marginTop: 4 }}>{t("Última:")} {short(fines.list[0].date)} · {t(conceptInfo(fines.list[0].concept).label)} · {euro(num, fines.list[0].amount)}</div>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
