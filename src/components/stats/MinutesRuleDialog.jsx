// Mínimo de minutos sobre los disponibles (13/11/2026, pedido por Nacho): coordinación fija el del club para fútbol 7
// y fútbol 11 y, si hace falta, uno propio para un equipo concreto. Se guarda en una sola fila MinutesRule.
import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RS } from "@/components/rs2/kit";
import { cleanRule, MIN_PCT } from "@/lib/participation";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { goalsOf, cleanGoals, GOAL_KEYS, GOAL_LABEL } from "@/lib/participationGoals";
import { useT } from "@/i18n";

const box = { width: 64, padding: "5px 8px", border: `1px solid ${RS.line}`, borderRadius: 8, fontSize: 13, textAlign: "right" };

function GoalInputs({ format, value, onChange, testPrefix, t }) {
  return (
    <span className="inline-flex items-center flex-wrap" style={{ gap: 8, fontSize: 12, color: RS.ink2 }}>
      {GOAL_KEYS[format].map((k) => (
        <label key={k} className="inline-flex items-center" style={{ gap: 5 }}>{t(GOAL_LABEL[k])} ≥
          <input type="number" min={0} max={60} value={value?.[k] ?? ""} onChange={(e) => onChange({ ...(value || {}), [k]: e.target.value })} style={box} data-testid={`${testPrefix}-${k}`} />
        </label>
      ))}
      <span style={{ color: RS.muted }}>{t("partidos")}</span>
    </span>
  );
}

function RuleInputs({ value, onChange, testPrefix, t }) {
  return (
    <span className="inline-flex items-center flex-wrap" style={{ gap: 8, fontSize: 12, color: RS.ink2 }}>
      <label className="inline-flex items-center" style={{ gap: 5 }}>{t("Mínimo")}
        <input type="number" min={0} max={100} value={value.alert ?? ""} onChange={(e) => onChange({ ...value, alert: e.target.value })} style={box} data-testid={`${testPrefix}-alert`} /> %
      </label>
      <label className="inline-flex items-center" style={{ gap: 5 }}>{t("Objetivo (opcional)")}
        <input type="number" min={0} max={100} value={value.target ?? ""} onChange={(e) => onChange({ ...value, target: e.target.value })} style={box} data-testid={`${testPrefix}-target`} /> %
      </label>
    </span>
  );
}

export default function MinutesRuleDialog({ open, onOpenChange, doc, team, teams }) {
  const t = useT();
  const qc = useQueryClient();
  const [f7, setF7] = useState({});
  const [f11, setF11] = useState({});
  const [own, setOwn] = useState(null); // null = como el club
  const [others, setOthers] = useState({});
  const [g7, setG7] = useState({});
  const [g11, setG11] = useState({});
  const [teamGoal, setTeamGoal] = useState("club"); // club | own | off
  const [ownGoal, setOwnGoal] = useState({});
  const [otherGoals, setOtherGoals] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    const cur = (k) => cleanRule(doc?.[k]) || MIN_PCT[k];
    setF7({ ...cur("f7") }); setF11({ ...cur("f11") });
    const teamsRules = { ...(doc?.teams || {}) };
    setOwn(team && teamsRules[team.id] ? { ...teamsRules[team.id] } : null);
    if (team) delete teamsRules[team.id];
    setOthers(teamsRules);
    const gl = goalsOf(doc);
    setG7({ ...(gl.f7 || {}) }); setG11({ ...(gl.f11 || {}) });
    const tg = { ...(doc?.team_goals || {}) };
    const mine = team ? tg[team.id] : null;
    setTeamGoal(mine?.off ? "off" : mine ? "own" : "club");
    setOwnGoal(mine && !mine.off ? { ...mine } : {});
    if (team) delete tg[team.id];
    setOtherGoals(tg);
    setErr("");
  }, [open, doc, team]);

  const fmt = team ? (teamPlaysF7(team) ? "f7" : "f11") : null;
  const clubOf = fmt === "f7" ? f7 : f11;
  const teamName = (id) => teams.find((x) => x.id === id)?.name || t("Equipo que ya no existe");

  const save = async () => {
    const c7 = cleanRule(f7), c11 = cleanRule(f11);
    if (!c7 || !c11) { setErr(t("Pon un mínimo entre 0 y 100 %.")); return; }
    const rules = { ...others };
    if (team && own) {
      const c = cleanRule(own);
      if (!c) { setErr(t("Pon un mínimo entre 0 y 100 % para el equipo o elige «Como el club».")); return; }
      rules[team.id] = c;
    }
    const teamGoals = { ...otherGoals };
    if (team && teamGoal === "off") teamGoals[team.id] = { off: true };
    if (team && teamGoal === "own") {
      const c = cleanGoals(ownGoal, fmt);
      if (c) teamGoals[team.id] = { ...c, format: fmt };
    }
    const data = { f7: c7, f11: c11, teams: rules, goals: { f7: cleanGoals(g7, "f7"), f11: cleanGoals(g11, "f11") }, team_goals: teamGoals, updated_at: new Date().toISOString() };
    setSaving(true);
    try {
      if (doc?.id) await base44.entities.MinutesRule.update(doc.id, data);
      else await base44.entities.MinutesRule.create(data);
      await qc.invalidateQueries({ queryKey: ["minutes-rules"] });
      onOpenChange(false);
    } catch {
      setErr(t("No se ha podido guardar. Inténtalo de nuevo."));
    } finally { setSaving(false); }
  };

  const seg = (on, label, onClick, testId) => (
    <button type="button" onClick={onClick} data-testid={testId}
      style={{ font: "inherit", fontSize: 12, padding: "4px 11px", borderRadius: 999, border: 0, cursor: "pointer", fontWeight: on ? 700 : 500, background: on ? "#fff" : "transparent", color: on ? RS.granate : RS.ink2, boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{label}</button>
  );
  const section = { borderTop: `1px solid ${RS.line}`, paddingTop: 12, marginTop: 12 };
  const lab = { fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: RS.muted, marginBottom: 6 };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="minutes-rule-dialog">
        <DialogHeader><DialogTitle>{t("Minutos y objetivos de participación")}</DialogTitle></DialogHeader>
        <p style={{ fontSize: 12, color: RS.muted, margin: 0 }}>{t("Porcentaje de los minutos disponibles que debería jugar cada jugador. Por debajo del mínimo sale en rojo («Pocos minutos»); por debajo del objetivo, en ámbar.")}</p>

        <div style={section}>
          <div style={lab}>{t("Todo el club")}</div>
          <div className="flex flex-col" style={{ gap: 8 }}>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}><b style={{ width: 80, fontSize: 13 }}>{t("Fútbol 7")}</b><RuleInputs value={f7} onChange={setF7} testPrefix="rule-f7" t={t} /></div>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}><b style={{ width: 80, fontSize: 13 }}>{t("Fútbol 11")}</b><RuleInputs value={f11} onChange={setF11} testPrefix="rule-f11" t={t} /></div>
          </div>
        </div>

        {team && (
          <div style={section}>
            <div style={lab}>{team.name} · {fmt === "f7" ? "F7" : "F11"}</div>
            <div className="inline-flex" style={{ gap: 3, background: "#F3ECEB", borderRadius: 999, padding: 3 }}>
              {seg(!own, t("Como el club ({n} %)", { n: clubOf.alert ?? "—" }), () => setOwn(null), "rule-team-club")}
              {seg(!!own, t("Propio de este equipo"), () => setOwn(own || { alert: clubOf.alert, target: clubOf.target }), "rule-team-own")}
            </div>
            {own && <div style={{ marginTop: 8 }}><RuleInputs value={own} onChange={setOwn} testPrefix="rule-team" t={t} /></div>}
          </div>
        )}

        <div style={section} data-testid="goals-section">
          <div style={lab}>{t("Objetivos de participación a final de liga")}</div>
          <p style={{ fontSize: 12, color: RS.muted, margin: "0 0 8px" }}>{t("Mínimo de partidos que debería llegar a tener cada jugador al acabar la liga. En Estadísticas se ve si cada uno va a ritmo. Déjalo vacío para no fijar ese objetivo.")}</p>
          <div className="flex flex-col" style={{ gap: 8 }}>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}><b style={{ width: 80, fontSize: 13 }}>{t("Fútbol 11")}</b><GoalInputs format="f11" value={g11} onChange={setG11} testPrefix="goal-f11" t={t} /></div>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}><b style={{ width: 80, fontSize: 13 }}>{t("Fútbol 7")}</b><GoalInputs format="f7" value={g7} onChange={setG7} testPrefix="goal-f7" t={t} /></div>
          </div>
          {team && (
            <div style={{ marginTop: 10 }}>
              <div className="inline-flex flex-wrap" style={{ gap: 3, background: "#F3ECEB", borderRadius: 999, padding: 3 }}>
                {seg(teamGoal === "club", t("{team}: como el club", { team: team.name }), () => setTeamGoal("club"), "goal-team-club")}
                {seg(teamGoal === "own", t("Propios"), () => { setTeamGoal("own"); if (!Object.keys(ownGoal).length) setOwnGoal({ ...((fmt === "f7" ? g7 : g11) || {}) }); }, "goal-team-own")}
                {seg(teamGoal === "off", t("Sin objetivos (rendimiento)"), () => setTeamGoal("off"), "goal-team-off")}
              </div>
              {teamGoal === "own" && <div style={{ marginTop: 8 }}><GoalInputs format={fmt} value={ownGoal} onChange={setOwnGoal} testPrefix="goal-team" t={t} /></div>}
            </div>
          )}
          {Object.keys(otherGoals).length > 0 && (
            <div style={{ marginTop: 10 }}>
              {Object.entries(otherGoals).map(([id, r]) => (
                <div key={id} className="flex items-center" style={{ gap: 8, fontSize: 12, padding: "3px 0" }}>
                  <span style={{ flex: 1 }}>{teamName(id)}</span>
                  <span style={{ color: RS.ink2 }}>{r.off ? t("Sin objetivos (rendimiento)") : GOAL_KEYS[r.format === "f7" ? "f7" : "f11"].filter((k) => r[k]).map((k) => `${t(GOAL_LABEL[k])} ${r[k]}`).join(" · ")}</span>
                  <button type="button" onClick={() => setOtherGoals((o) => { const n = { ...o }; delete n[id]; return n; })} style={{ fontSize: 11, fontWeight: 700, color: RS.granate, background: "none", border: 0, cursor: "pointer" }}>{t("Volver al del club")}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {Object.keys(others).length > 0 && (
          <div style={section}>
            <div style={lab}>{t("Otros equipos con mínimo propio")}</div>
            {Object.entries(others).map(([id, r]) => (
              <div key={id} className="flex items-center" style={{ gap: 8, fontSize: 12, padding: "3px 0" }}>
                <span style={{ flex: 1 }}>{teamName(id)}</span>
                <span className="tabular-nums" style={{ color: RS.ink2 }}>{r.alert} %{r.target ? ` · ${t("objetivo")} ${r.target} %` : ""}</span>
                <button type="button" onClick={() => setOthers((o) => { const n = { ...o }; delete n[id]; return n; })} style={{ fontSize: 11, fontWeight: 700, color: RS.granate, background: "none", border: 0, cursor: "pointer" }}>{t("Volver al del club")}</button>
              </div>
            ))}
          </div>
        )}

        {err && <p style={{ color: "#B91C1C", fontSize: 12, margin: "8px 0 0" }}>{err}</p>}
        <div className="flex justify-end" style={{ gap: 8, marginTop: 14 }}>
          <button type="button" onClick={() => onOpenChange(false)} style={{ font: "inherit", fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2 }}>{t("Cancelar")}</button>
          <button type="button" disabled={saving} onClick={save} data-testid="rule-save" style={{ font: "inherit", fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: 0, background: RS.granate, color: "#fff", opacity: saving ? 0.6 : 1 }}>{saving ? t("Guardando…") : t("Guardar")}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
