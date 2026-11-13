// Ficha del partido (13/11/2026): cabecera en banda oscura y «pasos del partido» con su estado.
import React, { useRef, useState } from "react";
import { Upload, Pencil, Trash2, FileText, Check, X, Minus } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import { RS } from "@/components/rs2/kit";
import { FormChips } from "@/components/rs2/dashParts";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { playerFullName } from "@/lib/playerName";
import { reasonLabel } from "@/lib/matchStatus";
import { useT, useDateLocale, msg } from "@/i18n";

const TYPE_LABEL = { partido_liga: msg("Liga"), partido_amistoso: msg("Amistoso"), torneo: msg("Torneo") };
const STEP_LABEL = { convocatoria: msg("Convocatoria"), tactica: msg("Preparación"), acta: msg("Acta"), postpartido: msg("Postpartido") };

function Shield({ src, name, canUpload, onUpload, small }) {
  const t = useT();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const size = small ? 46 : 62;
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); onUpload(file_url); }
    finally { setUploading(false); }
  };
  return (
    <div className="flex flex-col items-center relative group" style={{ gap: 6, minWidth: 0 }}>
      <div className="relative flex items-center justify-center overflow-hidden" style={{ width: size, height: size, borderRadius: 14, background: src ? "#fff" : "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.25)" }}>
        {src ? <img src={src} alt={name} className="w-full h-full object-contain" style={{ padding: 6 }} />
          : <span className="rs2-display" style={{ fontSize: small ? 22 : 28, color: "rgba(255,255,255,.75)" }}>{name?.[0] || "?"}</span>}
        {canUpload && (
          <>
            <button type="button" onClick={() => inputRef.current?.click()} title={t("Subir escudo del rival")}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
              {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Upload className="w-4 h-4 text-white" /><span style={{ fontSize: 9, color: "#fff", fontWeight: 700, textTransform: "uppercase" }}>{t("Subir")}</span></>}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </>
        )}
      </div>
      <span className="rs2-display text-center" style={{ fontSize: small ? 13 : 16, lineHeight: 1.05, color: "#fff", maxWidth: small ? 110 : 160 }}>{name}</span>
    </div>
  );
}

const ghostBtn = { fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.3)", background: "none", color: "#fff", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" };

/** Cabecera del partido: escudos, hora o marcador, goleadores y datos */
export function MatchHeader({ event, team, players, ourLogo, rival, canManage, mobile, onBack, onSheet, onEdit, onDelete, onRivalLogo }) {
  const t = useT();
  const dfl = useDateLocale();
  const date = event.date ? new Date(event.date) : null;
  const hasScore = event.score_home != null && event.score_home !== "" && event.score_away != null && event.score_away !== "";
  const diff = hasScore ? Number(event.score_home) - Number(event.score_away) : null;
  const isHome = event.is_home !== false;
  const ourName = team?.name || t("Nosotros");
  const rivalName = event.opponent || t("Rival");
  const left = isHome ? event.score_home : event.score_away;
  const right = isHome ? event.score_away : event.score_home;

  const goals = event.goal_events || [];
  const ours = goals.filter((g) => g.team === "home").sort((a, b) => a.minute - b.minute).map((g, i) => {
    const p = players.find((x) => x.id === g.player_id);
    return { k: "o" + i, minute: g.minute, label: p ? (p.last_name || playerFullName(p)) : (g.goal_type === "gol_propio" ? t("Propia puerta") : "—") };
  });
  const theirs = goals.filter((g) => g.team === "away").sort((a, b) => a.minute - b.minute).map((g, i) => {
    const ev = (event.match_events || []).find((e) => e.id === g.id);
    return { k: "t" + i, minute: g.minute, label: ev?.fcfName || "" };
  });

  const usShield = <Shield src={ourLogo} name={ourName} small={mobile} />;
  const themShield = <Shield src={event.opponent_logo_url} name={rivalName} small={mobile} canUpload={canManage} onUpload={onRivalLogo} />;
  const scorers = (list) => list.length > 0 && (
    <div className="flex flex-col items-center" style={{ gap: 1, marginTop: 4 }}>
      {list.map((g) => <span key={g.k} style={{ fontSize: 11, color: "rgba(255,255,255,.75)", lineHeight: 1.35 }}>⚽ {g.label} {g.minute}'</span>)}
    </div>
  );

  const days = date ? differenceInCalendarDays(date, new Date()) : null;
  const when = days == null ? null : days < 0 ? null : days === 0 ? t("Hoy") : days === 1 ? t("Mañana") : t("En {n} días", { n: days });
  const result = diff == null ? null : diff > 0 ? { label: t("Victoria"), bg: "#DCFCE7", fg: "#166534", Icon: Check } : diff < 0 ? { label: t("Derrota"), bg: "#FEE2E2", fg: "#991B1B", Icon: X } : { label: t("Empate"), bg: "#FEF3C7", fg: "#92400E", Icon: Minus };

  const meta = [
    t(TYPE_LABEL[event.type] || "Partido"),
    event.fcf_jornada ? t("Jornada {n}", { n: event.fcf_jornada }) : null,
    date ? format(date, "EEE d MMM", { locale: dfl }) : null,
    date ? format(date, "HH:mm") : null,
    isHome ? `🏠 ${t("Casa")}` : `✈️ ${t("Fuera")}`,
    event.location || null,
  ].filter(Boolean);

  return (
    <section className="rs2-band" style={{ padding: mobile ? "12px 12px 14px" : "14px 18px 16px", overflow: "hidden", background: `linear-gradient(120deg, ${RS.granateDark}, ${RS.granate})` }} data-testid="match-band">
      <div className="flex flex-wrap items-center justify-between" style={{ gap: 8 }}>
        <div className="flex items-center" style={{ gap: 6, fontSize: 12, color: "rgba(255,255,255,.85)", minWidth: 0 }}>
          <button type="button" onClick={onBack} style={{ color: "#fff" }} data-testid="match-back">‹ {ourName}</button>
          {event.postponed_from && <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: "rgba(251,191,36,.18)", color: "#FDE68A" }}>{t("Aplazado · antes {format}", { format: format(new Date(event.postponed_from), "d MMM", { locale: dfl }) })}</span>}
          {isCancelled(event) && <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: "rgba(255,255,255,.18)" }} title={t("Para restaurarlo: Editar → botón de cancelado")}>{cancelText(event, t)}</span>}
        </div>
        <div className="flex items-center" style={{ gap: 6 }}>
          <button type="button" style={ghostBtn} onClick={onSheet} data-testid="match-sheet"><FileText className="w-3.5 h-3.5" />{!mobile && t("Hoja del entrenador")}</button>
          {canManage && <button type="button" style={ghostBtn} onClick={onEdit} data-testid="match-edit"><Pencil className="w-3.5 h-3.5" />{!mobile && t("Editar")}</button>}
          {canManage && <button type="button" style={ghostBtn} onClick={onDelete} aria-label={t("Eliminar")} data-testid="match-delete"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="grid items-start" style={{ gridTemplateColumns: "1fr auto 1fr", gap: mobile ? 8 : 28, marginTop: 8, maxWidth: 640, marginInline: "auto" }}>
        <div className="flex flex-col items-center">{isHome ? usShield : themShield}{scorers(isHome ? ours : theirs)}</div>
        <div className="flex flex-col items-center" style={{ paddingTop: mobile ? 6 : 10, gap: 6 }}>
          {hasScore ? (
            <div className="flex items-center" style={{ gap: 6, fontSize: mobile ? 40 : 54, lineHeight: 1, color: "#fff" }} data-testid="match-score">
              <span className="rs2-display">{left}</span><span className="rs2-display" style={{ color: "rgba(255,255,255,.35)", fontSize: mobile ? 26 : 34 }}>:</span><span className="rs2-display">{right}</span>
            </div>
          ) : (
            <div className="rs2-display" style={{ fontSize: mobile ? 36 : 48, lineHeight: 1, color: "#fff" }} data-testid="match-time">{date ? format(date, "HH:mm") : "–"}</div>
          )}
          {result ? (
            <span className="inline-flex items-center" style={{ gap: 4, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 10px", borderRadius: 999, background: result.bg, color: result.fg }} data-testid="match-result"><result.Icon className="w-3 h-3" strokeWidth={3} />{result.label}</span>
          ) : when && !isCancelled(event) ? (
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", padding: "2px 10px", borderRadius: 999, background: RS.naranja, color: "#fff" }} data-testid="match-when">{when}</span>
          ) : (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Sin resultado")}</span>
          )}
        </div>
        <div className="flex flex-col items-center">{isHome ? themShield : usShield}{scorers(isHome ? theirs : ours)}</div>
      </div>

      <div className="flex flex-wrap items-center justify-center" style={{ gap: "4px 10px", marginTop: 10, fontSize: mobile ? 10.5 : 11.5, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.8)" }} data-testid="match-meta">
        <span>{meta.join(" · ")}</span>
        {rival && (
          <span className="inline-flex items-center" style={{ gap: 6, textTransform: "none", letterSpacing: 0, fontSize: 11.5, padding: "2px 9px", borderRadius: 999, background: "rgba(255,255,255,.12)" }} data-testid="match-rival">
            {t("Rival: {pos}º · {pts} pts", { pos: rival.pos, pts: rival.pts })}
            {(rival.form || []).length > 0 && <FormChips form={(rival.form || []).slice().reverse().slice(-5)} size={13} />}
          </span>
        )}
      </div>
    </section>
  );
}

/** Los cuatro pasos del partido; el elegido va en granate y cada uno lleva su estado */
export function MatchStepsNav({ steps, active, onChange, mobile }) {
  const t = useT();
  return (
    <nav className="grid" style={{ gridTemplateColumns: mobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: mobile ? 6 : 8 }} data-testid="match-steps">
      {steps.map((s, i) => {
        const on = s.key === active;
        const sub = s.sub ? t(s.sub.key, s.sub.reason ? { ...s.sub.vars, r: reasonLabel(s.sub.reason, t) } : s.sub.vars) : "";
        const circle = s.state === "done" ? { bg: "#16A34A", fg: "#fff", c: <Check className="w-3.5 h-3.5" strokeWidth={3} /> }
          : s.state === "now" ? { bg: on ? "#fff" : RS.naranja, fg: on ? RS.granate : "#fff", c: "!" }
          : { bg: on ? "rgba(255,255,255,.25)" : "#D6CCCD", fg: "#fff", c: i + 1 };
        return (
          <button key={s.key} type="button" onClick={() => onChange(s.key)} data-testid={`step-${s.key}`} data-state={s.state} aria-current={on ? "page" : undefined}
            className="flex items-center text-left"
            style={{ gap: 10, padding: mobile ? "8px 10px" : "9px 14px", borderRadius: 12, minWidth: 0,
              background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink, border: `1px solid ${on ? RS.granate : s.state === "now" ? RS.naranja : RS.line}` }}>
            <span className="flex items-center justify-center shrink-0" style={{ width: 24, height: 24, borderRadius: 999, background: circle.bg, color: circle.fg, fontSize: 12, fontWeight: 800 }}>{circle.c}</span>
            <span style={{ minWidth: 0 }}>
              <span className="block" style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{t(STEP_LABEL[s.key])}</span>
              <span className="block truncate" style={{ fontSize: 11.5, lineHeight: 1.3, color: on ? "rgba(255,255,255,.82)" : RS.muted }}>{sub}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
