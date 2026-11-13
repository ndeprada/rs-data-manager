import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { sortTeams, isF7Team } from "@/lib/teamOrder";
import { BRAND } from "@/lib/brand";
import { RS } from "@/components/rs2/kit";
import { Head } from "@/components/rs2/dashParts";
import PeoplePicker, { peopleLabel } from "@/components/avisos/PeoplePicker";
import { Pick, Lab, Seg, KindChip } from "@/components/avisos/AvisoParts";
import { KINDS, quickTimes, toLocalInput, fromLocalInput, scheduleError, pushPreview } from "@/lib/noticeUi";
import { useT, msg, useDateLocale } from "@/i18n";

const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STAGES = [
  ["Primer equipo", "primer"], ["Juvenil", "juvenil"], ["Cadete", "cadet"], ["Infantil", "infantil"],
  ["Aleví", "alevi"], ["Benjamín", "benjam"], ["Prebenjamín", "prebenjam"], ["Escuela", "escuela"],
];
const inStage = (team, key) => norm(team.name).startsWith(key);
const GROUPS = [
  { key: "jugadores", label: msg("Jugadores") },
  { key: "familiares", label: msg("Familiares") },
  { key: "tecnico", label: msg("Cuerpo técnico") },
];
const COORD_ROLES = ["director", "director_deportivo", "coordinador_general", "coordinador_f7", "coordinador_f11"];
const TEAMS_SHOWN = 12;
const input = { width: "100%", border: `1px solid ${RS.input}`, borderRadius: 8, padding: "8px 11px", fontSize: 14, color: RS.ink, background: "#fff", outline: "none" };
const section = { padding: "10px 14px", borderBottom: `1px solid ${RS.lineSoft}` };

// Nuevo aviso (página Avisos): plantillas, para quién, tipo, texto, cómo se ve en el móvil y cuándo sale.
export default function NoticeForm({ onSent }) {
  const t = useT();
  const locale = useDateLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isCoord = user?.role === "admin" || COORD_ROLES.includes(user?.app_role);
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["notice-templates"], queryFn: () => base44.club.noticeTemplates(), staleTime: 10 * 60_000 });
  const myTeamIds = useMemo(() => new Set([...(user?.team_ids || []), ...(user?.team_id ? [user.team_id] : [])]), [user]);
  const available = useMemo(() => sortTeams(isCoord ? teams : teams.filter((x) => myTeamIds.has(x.id))), [teams, isCoord, myTeamIds]);
  const quick = useMemo(() => [
    ["Fútbol 11", available.filter((x) => !isF7Team(x))],
    ["Fútbol 7", available.filter((x) => isF7Team(x))],
    ...STAGES.map(([label, key]) => [label, available.filter((x) => inStage(x, key))]),
  ].filter(([, ts]) => ts.length > 0).map(([label, ts]) => ({ label, ids: ts.map((x) => x.id) })), [available]);

  const [mode, setMode] = useState("teams");
  const [picked, setPicked] = useState([]);
  const [teamIds, setTeamIds] = useState([]);
  const [allClub, setAllClub] = useState(false);
  const [groups, setGroups] = useState(["jugadores", "familiares"]);
  const [allTeams, setAllTeams] = useState(false);
  const [kind, setKind] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tplName, setTplName] = useState("");       // plantilla de la que viene el texto
  const [when, setWhen] = useState("now");          // now | later
  const [at, setAt] = useState("");                 // «yyyy-MM-ddTHH:mm» (hora local)
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(null);       // nombre de la plantilla que se está guardando

  const people = mode === "people";
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const quickOn = (ids) => !allClub && ids.every((id) => teamIds.includes(id));
  const toggleQuick = (ids) => { setAllClub(false); setTeamIds(quickOn(ids) ? teamIds.filter((id) => !ids.includes(id)) : [...new Set([...teamIds, ...ids])]); };

  const audience = useMemo(() => (people
    ? { all_club: false, team_ids: [], player_ids: [], user_ids: picked.map((p) => p.id), groups: [] }
    : { all_club: allClub, team_ids: teamIds, player_ids: [], groups }), [people, picked, allClub, teamIds, groups]);
  const label = useMemo(() => {
    if (people) return peopleLabel(picked);
    const who = groups.map((g) => GROUPS.find((x) => x.key === g)?.label).filter(Boolean).join(" + ");
    const where = allClub ? "Todo el club" : teams.filter((x) => teamIds.includes(x.id)).map((x) => x.name).join(", ");
    return `${where} · ${who}`;
  }, [people, picked, allClub, teamIds, groups, teams]);
  const hasTarget = people ? picked.length > 0 : allClub || teamIds.length > 0;
  const groupsOk = people || groups.length > 0;

  useEffect(() => {
    setCount(null);
    if (!hasTarget || !groupsOk) return;
    const tm = setTimeout(() => base44.club.preview(audience).then(setCount).catch(() => setCount(null)), 300);
    return () => clearTimeout(tm);
  }, [audience, hasTarget, groupsOk]);

  const atDate = fromLocalInput(at);
  const schedErr = when === "later" ? scheduleError(atDate) : null;
  const n = count?.recipients ?? 0;
  const canSend = title.trim() && body.trim() && hasTarget && groupsOk && n > 0 && !schedErr;

  const applyTemplate = (tp) => { setTitle(tp.title || ""); setBody(tp.body || ""); setKind(tp.kind || "general"); setTplName(tp.name); };
  const removeTemplate = async (tp) => {
    if (!window.confirm(t("¿Quitar la plantilla «{name}»?", { name: tp.name }))) return;
    await base44.club.deleteNoticeTemplate(tp.id);
    qc.invalidateQueries({ queryKey: ["notice-templates"] });
  };
  const saveTemplate = async () => {
    const name = (saving || "").trim();
    if (!name) return;
    const same = templates.find((x) => norm(x.name) === norm(name) && x.editable);
    await base44.club.saveNoticeTemplate({ id: same?.id, name, title, body, kind });
    setSaving(null); setTplName(name);
    qc.invalidateQueries({ queryKey: ["notice-templates"] });
    setNote({ ok: true, text: same ? t("Plantilla «{name}» actualizada.", { name }) : t("Plantilla «{name}» guardada.", { name }) });
  };

  const send = async () => {
    setBusy(true); setNote(null);
    try {
      const send_at = when === "later" ? atDate.toISOString() : undefined;
      const r = await base44.club.send({ title, body, kind, audience, audience_label: label, send_at });
      setNote({ ok: true, text: r.scheduled
        ? t("Programado para el {when}. Saldrá solo a esa hora.", { when: format(new Date(r.scheduled), "EEEE d MMM, HH:mm", { locale }) })
        : `${r.recipients === 1 ? t("Enviado a {n} persona", { n: 1 }) : t("Enviado a {n} personas", { n: r.recipients })} (${r.sent === 1 ? t("{n} dispositivo con aviso activado", { n: 1 }) : t("{n} dispositivos con aviso activado", { n: r.sent })}).` });
      setTitle(""); setBody(""); setPicked([]); setTplName(""); setWhen("now"); setAt("");
      qc.invalidateQueries({ queryKey: ["noticeHistory"] });
      onSent?.(r);
    } catch (e) {
      const err = e.data?.error;
      setNote({ ok: false, text: err === "no_recipients" ? t("No hay nadie a quien enviar con esa selección.") : err === "bad_send_at" ? t("La hora de envío no vale.") : (e.message || t("No se pudo enviar")) });
    }
    setBusy(false);
  };

  const shownTeams = allTeams ? available : available.slice(0, TEAMS_SHOWN);
  const hiddenOn = available.slice(TEAMS_SHOWN).filter((x) => teamIds.includes(x.id)).length;

  return (
    <section className="rs2-card" style={{ overflow: "hidden" }} data-testid="notice-form">
      <Head title={t("Nuevo aviso")} />

      {/* Plantillas */}
      <div style={section}>
        <Lab>{t("Plantillas")}</Lab>
        <div className="flex flex-wrap" style={{ gap: 6 }} data-testid="tpl-list">
          {templates.map((tp) => (
            <span key={tp.id} className="inline-flex items-center" style={{ gap: 0 }}>
              <Pick on={tplName === tp.name} onClick={() => applyTemplate(tp)} testId={`tpl-${tp.id}`}>{tp.name}</Pick>
              {tp.editable && (
                <button type="button" onClick={() => removeTemplate(tp)} aria-label={t("Quitar la plantilla «{name}»", { name: tp.name })} title={t("Quitar la plantilla")}
                  style={{ marginLeft: -4, padding: 3, background: "none", border: "none", color: RS.faint, cursor: "pointer" }}><X className="w-3 h-3" /></button>
              )}
            </span>
          ))}
          {templates.length === 0 && <span style={{ fontSize: 12.5, color: RS.faint }}>{t("Escribe un aviso y pulsa «Guardar como plantilla» para reutilizarlo.")}</span>}
        </div>
      </div>

      {/* Para quién */}
      <div style={section}>
        <Lab>{t("Para")}</Lab>
        <div style={{ marginBottom: 8 }}>
          <Seg testPrefix="form-mode" value={mode} onChange={setMode} options={[{ value: "teams", label: "Por equipos" }, { value: "people", label: "A personas concretas" }]} />
        </div>
        {people ? <PeoplePicker picked={picked} setPicked={setPicked} /> : (
          <>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {isCoord && <Pick on={allClub} onClick={() => setAllClub(!allClub)} testId="form-all-club">{t("Todo el club")}</Pick>}
              {quick.map((g) => <Pick key={g.label} on={quickOn(g.ids)} onClick={() => toggleQuick(g.ids)} testId={`form-quick-${norm(g.label).replace(/\s+/g, "-")}`}>{t(g.label)}</Pick>)}
            </div>
            <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${RS.line}` }}>
              {shownTeams.map((x) => (
                <Pick key={x.id} on={!allClub && teamIds.includes(x.id)} onClick={() => { setAllClub(false); toggle(teamIds, setTeamIds, x.id); }} testId={`form-team-${x.id}`}>{x.name}</Pick>
              ))}
              {available.length > TEAMS_SHOWN && (
                <Pick dashed onClick={() => setAllTeams(!allTeams)} testId="form-more-teams">
                  {allTeams ? t("Menos") : `+${available.length - TEAMS_SHOWN}${hiddenOn ? ` · ${hiddenOn} ✓` : ""}`}
                </Pick>
              )}
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 12.5, color: RS.muted }}>{t("Les llega a")}</span>
              {GROUPS.map((g) => <Pick key={g.key} on={groups.includes(g.key)} onClick={() => toggle(groups, setGroups, g.key)} testId={`form-group-${g.key}`}>{t(g.label)}</Pick>)}
            </div>
          </>
        )}
        <p data-testid="form-count" style={{ margin: "10px 0 0", padding: "7px 10px", borderRadius: 8, background: RS.soft, fontSize: 12.5, color: RS.ink2 }}>
          {count ? (
            <>{t("Llegará a")} <b>{count.recipients}</b> {count.recipients === 1 ? t("persona") : t("personas")} · <b style={{ color: "#15803D" }}>{count.with_push}</b> {t("con avisos activados")}
              {count.recipients > count.with_push && <> · {t("{n} lo verán al abrir la app", { n: count.recipients - count.with_push })}</>}</>
          ) : hasTarget && groupsOk ? t("Calculando…") : people ? t("Busca a quién enviar") : t("Elige equipos y a quién les llega")}
        </p>
      </div>

      {/* Mensaje */}
      <div style={section}>
        <Lab>{t("Mensaje")}</Lab>
        <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 8 }} data-testid="form-kinds">
          <span style={{ fontSize: 12.5, color: RS.muted }}>{t("Tipo")}</span>
          {KINDS.map((k) => {
            const on = kind === k.key;
            return (
              <button key={k.key} type="button" onClick={() => setKind(k.key)} data-testid={`form-kind-${k.key}`}
                style={{ border: `1px solid ${on ? k.fg : "transparent"}`, background: on ? k.bg : "#F8F5F5", color: on ? k.fg : RS.faint, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                {t(k.label)}
              </button>
            );
          })}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={t("Título")} data-testid="form-title" style={{ ...input, fontWeight: 700, marginBottom: 6 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1800} rows={5} placeholder={t("Mensaje")} data-testid="form-body" style={{ ...input, resize: "vertical", lineHeight: 1.45 }} />
        <div className="flex justify-between" style={{ fontSize: 11.5, color: RS.faint, marginTop: 2 }}>
          <span>{tplName ? t("Plantilla: «{name}»", { name: tplName }) : ""}</span>
          <span className="tabular-nums">{body.length} / 1800</span>
        </div>
      </div>

      {/* Vista del móvil */}
      <div style={section}>
        <Lab>{t("Así llega al móvil")}</Lab>
        <div data-testid="form-phone" style={{ background: "#1E1416", borderRadius: 18, padding: 9, maxWidth: 360 }}>
          <div className="flex" style={{ gap: 9, background: "#F1EEEE", borderRadius: 12, padding: "8px 10px" }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: RS.granate, flexShrink: 0 }} />
            <span className="min-w-0 flex-1">
              <span className="flex justify-between" style={{ fontSize: 10.5, color: RS.muted, textTransform: "uppercase" }}><span>{BRAND.appName}</span><span style={{ textTransform: "none" }}>{when === "later" && atDate ? format(atDate, "HH:mm") : t("ahora")}</span></span>
              <b style={{ display: "block", fontSize: 13, color: RS.ink, lineHeight: 1.25 }}>{title || t("Título del aviso")}</b>
              <span style={{ display: "block", fontSize: 12.5, color: RS.ink2, lineHeight: 1.3 }}>{pushPreview(body) || t("El texto del aviso")}</span>
            </span>
          </div>
        </div>
        {body.length > 110 && <p style={{ fontSize: 11.5, color: RS.faint, margin: "4px 0 0" }}>{t("En el móvil se corta; el texto completo se lee al abrir el aviso.")}</p>}
      </div>

      {/* Cuándo */}
      <div style={section} data-testid="form-when">
        <Lab>{t("Cuándo")}</Lab>
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <Seg testPrefix="form-when" value={when} onChange={setWhen} options={[{ value: "now", label: "Enviar ahora" }, { value: "later", label: "Programar" }]} />
          {when === "later" && (
            <>
              {quickTimes().map((q) => (
                <Pick key={q.key} on={at === toLocalInput(q.date)} onClick={() => setAt(toLocalInput(q.date))} testId={`form-at-${q.key}`}>{t(q.label)}</Pick>
              ))}
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} data-testid="form-at" aria-label={t("Día y hora del envío")}
                style={{ ...input, width: "auto", padding: "5px 9px", fontSize: 13 }} />
            </>
          )}
        </div>
        {when === "later" && (
          <p style={{ fontSize: 11.5, color: schedErr && at ? "#B91C1C" : RS.faint, margin: "6px 0 0" }}>
            {schedErr && at ? t(schedErr) : t("Sale solo a esa hora (puede tardar unos minutos). Se envía a quien esté en los equipos en ese momento; hasta entonces lo puedes cancelar.")}
          </p>
        )}
      </div>

      {/* Guardar plantilla y enviar */}
      <div className="flex flex-wrap items-center" style={{ gap: 8, padding: "10px 14px" }}>
        {saving === null ? (
          <button type="button" onClick={() => setSaving(tplName || title)} disabled={!title.trim() && !body.trim()} data-testid="tpl-save-open"
            style={{ border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, opacity: !title.trim() && !body.trim() ? 0.5 : 1 }}>
            {t("Guardar como plantilla")}
          </button>
        ) : (
          <span className="inline-flex items-center" style={{ gap: 6 }}>
            <input value={saving} onChange={(e) => setSaving(e.target.value)} maxLength={60} autoFocus placeholder={t("Nombre de la plantilla")} data-testid="tpl-save-name"
              onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); if (e.key === "Escape") setSaving(null); }}
              style={{ ...input, width: 210, padding: "6px 10px", fontSize: 13 }} />
            <button type="button" onClick={saveTemplate} disabled={!saving.trim()} data-testid="tpl-save" style={{ border: "none", background: RS.granate, color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700 }}>{t("Guardar")}</button>
            <button type="button" onClick={() => setSaving(null)} aria-label={t("Cancelar")} style={{ border: "none", background: "none", color: RS.muted }}><X className="w-4 h-4" /></button>
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="inline-flex items-center" style={{ gap: 6 }}><KindChip kind={kind} /></span>
        <button type="button" onClick={send} disabled={!canSend || busy} data-testid="form-send"
          style={{ border: "none", background: when === "later" ? RS.granateDark : RS.granate, color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 700, opacity: !canSend || busy ? 0.45 : 1 }}>
          {busy ? t("Enviando…")
            : when === "later" && atDate && !schedErr ? t("Programar · {when}", { when: format(atDate, "EEE d MMM, HH:mm", { locale }) })
              : n > 0 ? (n === 1 ? t("Enviar a {n} persona", { n }) : t("Enviar a {n} personas", { n })) : t("Enviar")}
        </button>
      </div>
      {note && <p data-testid="form-note" style={{ margin: 0, padding: "0 14px 10px", fontSize: 12.5, color: note.ok ? "#15803D" : "#B91C1C" }}>{note.text}</p>}
    </section>
  );
}
