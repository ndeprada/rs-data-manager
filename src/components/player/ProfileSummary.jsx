import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Phone, Mail, Check, X, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { RS } from "@/components/rs2/kit";
import { WIN, LOSS } from "@/components/rs2/dashParts";
import { Flag, countryOf } from "@/lib/countries";
import { LEVELS, getPositionList, getPitchMarkers } from "@/lib/playerPositions";
import { findRole } from "@/lib/competencyCatalog";
import { AREAS, areasFor, computeAverages, scoreColor } from "@/lib/eval360";
import { reasonShort } from "@/lib/participation";
import { SEVERITY_LABELS, INJURY_TYPE_LABELS, BODY_PART_LABELS, labelOf } from "@/lib/injuryLabels";
import { playerFullName } from "@/lib/playerName";
import { scoreText } from "@/lib/matchScore";
import { birthYearOf } from "@/lib/birthYear";
import PlayerFoot from "./PlayerFoot";
import FamiliesSection from "./FamiliesSection";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT, useFormat, msg } from "@/i18n";

const AMBER = "#B45309";
const SOFT_LINE = "1px solid #F3EEEE";
const POS_SHORT = { portero: msg("POR"), lateral: msg("LAT"), central: msg("CT"), libre: msg("LIB"), mediocentro: msg("MC"), interior: msg("INT"), mediapunta: msg("MP"), delantero_centro: msg("DC"), extremo: msg("EXT") };
const POS_FULL = { portero: msg("Portero"), lateral: msg("Lateral"), central: msg("Central"), libre: msg("Libre"), mediocentro: msg("Mediocentro"), interior: msg("Interior"), mediapunta: msg("Mediapunta"), delantero_centro: msg("Delantero"), extremo: msg("Extremo") };
const RESULT = { W: [msg("V"), WIN], D: [msg("E"), AMBER], L: [msg("D"), LOSS] };
const ATT_REASON = { lesion: msg("Lesión"), enfermo: msg("Enfermo"), clase: msg("Clase"), examen: msg("Examen"), estudios: msg("Estudios"), viaje: msg("Viaje"), familiar: msg("Familiar"), permiso: msg("Permiso"), otro: msg("Otro") };
const GUARDIAN_REL = { padre: msg("Padre"), madre: msg("Madre"), tutor: msg("Tutor"), otro: msg("Contacto") };
const ATT_COLOR = { present: WIN, apart: "#F59E0B", absent: LOSS };
const PDI_STATE = { trabajando: [msg("Trabajando"), "#DBEAFE", "#1D4ED8"], a_mejorar: [msg("A mejorar"), "#FEF3C7", "#92400E"], mejorado: [msg("Mejorado"), "#DCFCE7", WIN] };
const TYPE_LABEL = { partido_liga: msg("Liga"), partido_amistoso: msg("Amistoso"), torneo: msg("Torneo") };

function Box({ title, more, onMore, children, testId, extra }) {
  const t = useT();
  return (
    <section className="rs2-card" style={{ padding: "10px 14px" }} data-testid={testId}>
      <div className="flex items-center" style={{ gap: 6, marginBottom: 8 }}>
        <h2 style={{ margin: 0, borderLeft: `3px solid ${RS.naranja}`, paddingLeft: 7, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 17, color: RS.granate }}>{title}</span></h2>
        {extra}
        {onMore && <button type="button" onClick={onMore} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: RS.granate, background: "none", border: 0 }}>{more || t("Ver")} ›</button>}
      </div>
      {children}
    </section>
  );
}

const Chip = ({ children, bg, fg, testId }) => <span data-testid={testId} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>;
const Empty = ({ children }) => <p style={{ fontSize: 12, color: RS.faint, margin: 0 }}>{children}</p>;

function Row({ k, children }) {
  return (
    <div className="flex items-center" style={{ gap: 8, padding: "5px 0", borderTop: SOFT_LINE, fontSize: 12 }}>
      <span style={{ width: 92, color: RS.muted, flex: "none" }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, color: RS.ink }}>{children}</span>
    </div>
  );
}

/** Campo con sus posiciones (natural, secundaria y competente) */
function PositionsPitch({ player }) {
  const t = useT();
  const order = { competente: 0, secundaria: 1, natural: 2 };
  const pts = getPitchMarkers(player, player.laterality).sort((a, b) => order[a.level] - order[b.level]);
  const line = "rgba(255,255,255,0.6)";
  return (
    <svg viewBox="0 0 200 300" width="92" height="138" role="img" aria-label={t("Posiciones")} style={{ display: "block", flex: "none", borderRadius: 6 }}>
      <rect x="0" y="0" width="200" height="300" fill="#2E7D32" rx="6" />
      <g fill="none" stroke={line} strokeWidth="2">
        <rect x="8" y="10" width="184" height="280" />
        <line x1="8" y1="150" x2="192" y2="150" />
        <circle cx="100" cy="150" r="26" />
        <rect x="50" y="10" width="100" height="48" />
        <rect x="50" y="242" width="100" height="48" />
      </g>
      {pts.map((x) => {
        const cx = (x.c.x / 100) * 200, cy = (x.c.y / 100) * 300, nat = x.level === "natural";
        return (
          <g key={x.position + (x.role || "") + x.c.x}>
            {nat && <circle cx={cx} cy={cy} r="24" fill={LEVELS[x.level].color} fillOpacity="0.3" />}
            <circle cx={cx} cy={cy} r={nat ? 14 : 12} fill={LEVELS[x.level].color} stroke="#fff" strokeWidth={nat ? 3 : 2} />
          </g>
        );
      })}
    </svg>
  );
}

function FichaCard({ player, footMode }) {
  const t = useT();
  const { locale } = useFormat();
  const list = getPositionList(player);
  const country = countryOf(player);
  const year = birthYearOf(player);
  const born = player.birth_date ? format(new Date(player.birth_date), "dd/MM/yyyy", { locale }) : null;
  const place = [player.birth_place, player.birth_province && player.birth_province !== player.birth_place ? player.birth_province : ""].filter(Boolean).join(", ");
  return (
    <Box title={t("Ficha")} testId="profile-ficha">
      {player.position ? (
        <div className="flex" style={{ gap: 12 }}>
          <PositionsPitch player={player} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {list.map((x) => {
              const role = x.role ? t(findRole(x.role)?.role.label) : "";
              return (
                <div key={x.position + (x.role || "")} className="flex items-center" style={{ gap: 6, fontSize: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 4, minWidth: 30, textAlign: "center", background: LEVELS[x.level].color, color: LEVELS[x.level].text }}>{t(POS_SHORT[x.position] || x.position)}</span>
                  <span style={{ minWidth: 0, lineHeight: 1.2 }}>
                    <span style={{ fontWeight: x.level === "natural" ? 700 : 500, color: RS.ink }}>{POS_FULL[x.position] ? t(POS_FULL[x.position]) : x.position}</span>
                    <span style={{ color: RS.muted }}> · {t(LEVELS[x.level].label).toLowerCase()}</span>
                    {role && <span style={{ display: "block", fontSize: 11, color: RS.ink2 }}>{t("Rol")}: {role}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : <Empty>{t("Sin posición en su ficha.")}</Empty>}
      <div style={{ marginTop: 8 }}>
        {(born || year) && <Row k={t("Nacimiento")}>{born || year}{born && year ? <span style={{ color: RS.muted }}> · {year}</span> : null}</Row>}
        {country && <Row k={t("Nacionalidad")}><span className="inline-flex items-center flex-wrap" style={{ gap: 6 }}><Flag player={player} />{place && <span style={{ color: RS.muted, fontSize: 11 }}>{place}</span>}</span></Row>}
        {player.laterality && <Row k={t("Pierna")}><span className="inline-block"><PlayerFoot player={player} light mode={footMode} /></span></Row>}
        {player.jersey_number && <Row k={t("Dorsal")}>{player.jersey_number}</Row>}
        {player.phone && <Row k={t("Teléfono")}><a href={`tel:${player.phone}`} style={{ color: RS.granate }}>{player.phone}</a></Row>}
        {player.email && <Row k={t("Email")}><a href={`mailto:${player.email}`} style={{ color: RS.granate, wordBreak: "break-all" }}>{player.email}</a></Row>}
      </div>
    </Box>
  );
}

function ContactCard({ player, showFamilies }) {
  const t = useT();
  const has = player.guardian_name || player.guardian_phone || player.guardian_email;
  if (!has && !showFamilies) return null;
  const rel = t(GUARDIAN_REL[player.guardian_relationship] || msg("Tutor legal"));
  const mail = player.guardian_email
    ? `mailto:${player.guardian_email}?subject=${encodeURIComponent(`Contacto sobre ${playerFullName(player)}`)}&body=${encodeURIComponent(`Estimado/a ${player.guardian_name || "tutor/a"},\n\nNos ponemos en contacto con usted en relación a ${playerFullName(player)}.\n\nQuedamos a su disposición.\n\nUn saludo`)}`
    : null;
  const btn = { flex: 1, display: "flex", gap: 5, justifyContent: "center", alignItems: "center", fontSize: 12, fontWeight: 700, padding: "6px 8px", borderRadius: 8, background: RS.soft, color: RS.granate, textDecoration: "none" };
  return (
    <Box title={t("Contacto")} testId="profile-contact">
      {has ? (
        <div style={{ fontSize: 12, marginBottom: showFamilies ? 10 : 0 }}>
          <b>{player.guardian_name || t("Tutor legal")}</b> <span style={{ color: RS.muted }}>· {rel}</span>
          {player.guardian_phone && <div style={{ color: RS.ink2, marginTop: 2 }}>{player.guardian_phone}{player.guardian_email ? ` · ${player.guardian_email}` : ""}</div>}
          <div className="flex" style={{ gap: 6, marginTop: 6 }}>
            {player.guardian_phone && <a href={`tel:${player.guardian_phone}`} style={btn} data-testid="profile-call"><Phone className="w-3.5 h-3.5" />{t("Llamar")}</a>}
            {mail && <a href={mail} style={btn}><Mail className="w-3.5 h-3.5" />{t("Email")}</a>}
          </div>
        </div>
      ) : null}
      {showFamilies && <FamiliesSection playerId={player.id} bare />}
    </Box>
  );
}

function NextMatchCard({ next, team }) {
  const t = useT();
  const { locale } = useFormat();
  if (!next) return null;
  const { ev, state, reason, conv } = next;
  const d = new Date(ev.date);
  const chip = state === "called" ? <Chip bg="#DCFCE7" fg={WIN} testId="profile-next-state"><Check className="w-3 h-3 inline -mt-0.5" /> {t("Convocado")}</Chip>
    : state === "out" ? <Chip bg="#FEE2E2" fg={LOSS} testId="profile-next-state"><X className="w-3 h-3 inline -mt-0.5" /> {t("No convocado")}{reason ? ` · ${t(reasonShort(reason)).toLowerCase()}` : ""}</Chip>
    : <Chip bg={RS.soft} fg={RS.ink2} testId="profile-next-state"><Clock className="w-3 h-3 inline -mt-0.5" /> {t("Convocatoria sin hacer")}</Chip>;
  return (
    <Box title={t("Próximo partido")} testId="profile-next">
      <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
        <div style={{ textAlign: "center", background: RS.soft, borderRadius: 10, padding: "6px 10px", flex: "none" }}>
          <div className="rs2-display capitalize" style={{ fontSize: 19, color: RS.granate }}>{format(d, "EEE d", { locale })}</div>
          <div style={{ fontSize: 11, color: RS.muted }}>{format(d, "HH:mm")}</div>
        </div>
        <div style={{ flex: "1 1 180px", minWidth: 0, fontSize: 13 }}>
          <b>{ev.opponent ? `vs ${ev.opponent}` : ev.title || team?.name}</b>
          <span style={{ color: RS.muted }}> · {t(TYPE_LABEL[ev.type] || "")}{ev.fcf_jornada ? ` J${ev.fcf_jornada}` : ""} · {ev.is_home === false ? t("fuera") : t("casa")}</span>
          <div style={{ fontSize: 12, color: RS.ink2 }}>{[conv?.callup_time ? t("Convocatoria a las {hora}", { hora: conv.callup_time }) : null, ev.location].filter(Boolean).join(" · ")}</div>
        </div>
        {chip}
      </div>
    </Box>
  );
}

function SeasonCard({ rows, isGK, onMore }) {
  const t = useT();
  if (!rows.length) return <Box title={t("Temporada partido a partido")} testId="profile-season"><Empty>{t("Sin partidos de liga cerrados todavía.")}</Empty></Box>;
  const bars = rows.slice(0, 12).reverse();
  const maxMin = Math.max(90, ...bars.map((r) => r.minutes));
  return (
    <Box title={t("Temporada partido a partido")} onMore={onMore} more={t("Ver todos")} testId="profile-season">
      <div className="flex items-center" style={{ gap: 8, fontSize: 11, color: RS.muted, marginBottom: 4 }}>
        {t("Minutos por partido")}
        <span style={{ marginLeft: "auto" }} className="inline-flex items-center gap-1"><span style={{ width: 8, height: 8, background: RS.granate, borderRadius: 2 }} />{t("titular")}</span>
        <span className="inline-flex items-center gap-1"><span style={{ width: 8, height: 8, background: "#C9A3A8", borderRadius: 2 }} />{t("suplente")}</span>
      </div>
      <div className="flex items-end" style={{ gap: 5, marginBottom: 8 }} data-testid="profile-minutes-bars">
        {bars.map((r) => (
          <div key={r.ev.id} className="flex flex-col items-center" style={{ flex: 1, gap: 3, minWidth: 0 }} title={`${r.ev.opponent || ""} · ${r.minutes}'`}>
            <div className="flex items-end" style={{ height: 64, width: "100%", maxWidth: 26, background: RS.soft, borderRadius: 4 }}>
              <div style={{ height: `${Math.max(r.minutes ? 4 : 0, (r.minutes / maxMin) * 100)}%`, width: "100%", background: r.starter ? RS.granate : "#C9A3A8", borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 10, color: RS.muted, whiteSpace: "nowrap" }}>{r.ev.fcf_jornada ? `J${r.ev.fcf_jornada}` : format(new Date(r.ev.date), "d/M")}</span>
          </div>
        ))}
      </div>
      {rows.slice(0, 6).map((r) => {
        const res = r.result ? RESULT[r.result] : null;
        const role = !r.called ? (r.reason ? t(reasonShort(r.reason)) : t("No convocado")) : r.starter ? t("Titular") : r.minutes ? t("Suplente") : t("No jugó");
        return (
          <div key={r.ev.id} className="flex items-center" style={{ gap: 8, padding: "5px 0", borderTop: SOFT_LINE, fontSize: 12 }} data-testid={`profile-match-${r.ev.id}`}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: res ? res[1] : RS.lineSoft, color: "#fff", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{res ? t(res[0]) : "–"}</span>
            <span style={{ width: 28, color: RS.muted, flex: "none" }}>{r.ev.fcf_jornada ? `J${r.ev.fcf_jornada}` : format(new Date(r.ev.date), "d/M")}</span>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.ev.opponent || t("Rival")}{r.guest ? <span style={{ color: RS.muted }}> · {t("con otro equipo")}</span> : null}</span>
            <span style={{ width: 34, fontWeight: 700, flex: "none" }}>{scoreText(r.ev, "-") || "–"}</span>
            <span style={{ width: 62, color: r.called ? RS.ink2 : RS.muted, flex: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role}</span>
            <span style={{ width: 28, textAlign: "right", flex: "none" }}>{r.minutes ? `${r.minutes}'` : ""}</span>
            <span style={{ width: 40, textAlign: "right", color: RS.granate, fontWeight: 700, flex: "none", whiteSpace: "nowrap" }}>
              {r.goals ? (isGK ? "" : `${r.goals}G`) : ""}{r.assists ? ` ${r.assists}A` : ""}{r.red ? " 🟥" : r.yellow ? " 🟨" : ""}
            </span>
          </div>
        );
      })}
    </Box>
  );
}

function TrainingCard({ win, strip, onMore }) {
  const t = useT();
  const { locale } = useFormat();
  const color = win.pct == null ? RS.faint : win.pct >= 80 ? WIN : win.pct >= 70 ? AMBER : LOSS;
  return (
    <Box title={t("Entrenos · 30 días")} onMore={onMore} testId="profile-training">
      {win.pct == null ? <Empty>{t("Sin sesiones registradas.")}</Empty> : (
        <div className="flex items-baseline flex-wrap" style={{ gap: 8 }}>
          <span className="rs2-display tabular-nums" style={{ fontSize: 30, color, lineHeight: 1 }}>{win.pct}%</span>
          <span style={{ fontSize: 12, color: RS.ink2 }}>{win.present} {t("asiste")} · {win.apart} {t("a parte")} · {win.absent} {t("no asiste")}</span>
        </div>
      )}
      {strip.length > 0 && (
        <>
          <div className="flex flex-wrap" style={{ gap: 3, margin: "8px 0 4px" }} data-testid="profile-att-strip">
            {strip.map((a, i) => (
              <span key={i} title={`${format(new Date(a.date), "d MMM", { locale })} · ${a.status === "present" ? t("Asiste") : a.status === "apart" ? t("A parte") : t("No asiste")}${a.reason && ATT_REASON[a.reason] ? ` · ${t(ATT_REASON[a.reason])}` : ""}`}
                style={{ width: 14, height: 14, borderRadius: 4, background: ATT_COLOR[a.status] || RS.lineSoft }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: RS.muted }}>
            {t("Últimas {n} sesiones", { n: strip.length })}
            {win.topReason ? ` · ${t("motivo más frecuente:")} ${ATT_REASON[win.topReason.reason] ? t(ATT_REASON[win.topReason.reason]).toLowerCase() : win.topReason.reason} (${win.topReason.n})` : ""}
          </div>
        </>
      )}
    </Box>
  );
}

function MedicalCard({ injuries, onMore }) {
  const t = useT();
  const { locale } = useFormat();
  const fmt = (d) => (d ? format(new Date(d), "d MMM", { locale }) : "");
  const active = injuries.filter((i) => i.status !== "alta");
  const last = [...injuries].sort((a, b) => new Date(b.injury_date || 0) - new Date(a.injury_date || 0))[0];
  const what = (i) => [i.type ? labelOf(INJURY_TYPE_LABELS, i.type, t) : null, i.body_part ? labelOf(BODY_PART_LABELS, i.body_part, t).toLowerCase() : null].filter(Boolean).join(" · ") || t("Lesión");
  return (
    <Box title={t("Médico")} onMore={onMore} testId="profile-medical">
      {active.length ? active.slice(0, 2).map((i) => (
        <div key={i.id} style={{ fontSize: 12, marginBottom: 4 }}>
          <b style={{ color: LOSS }}>{what(i)}</b>{i.severity ? <span style={{ color: RS.muted }}> · {labelOf(SEVERITY_LABELS, i.severity, t)}</span> : null}
          <div style={{ color: RS.muted }}>{t("Desde")} {fmt(i.injury_date)}{i.expected_return ? ` · ${t("alta prevista")} ${fmt(i.expected_return)}` : ""}</div>
        </div>
      )) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: WIN }}>{t("Sin lesiones activas")}</div>
          {last && <div style={{ fontSize: 12, color: RS.muted, marginTop: 2 }}>{t("Última:")} {what(last).toLowerCase()} · {fmt(last.injury_date)}{last.actual_return ? ` – ${fmt(last.actual_return)}` : ""}</div>}
        </>
      )}
    </Box>
  );
}

function PdiCard({ playerId, onMore }) {
  const t = useT();
  const { data: goals = [] } = useQuery({ queryKey: ["pdi_goals", playerId], queryFn: () => base44.entities.PDIGoal.filter({ player_id: playerId }, "-created_date") });
  const rank = { trabajando: 0, a_mejorar: 1, mejorado: 2 };
  const st = (g) => (g.status === "mejorado" || g.status === "trabajando" ? g.status : "a_mejorar");
  const list = [...goals].sort((a, b) => rank[st(a)] - rank[st(b)]).slice(0, 4);
  return (
    <Box title={t("PDI")} onMore={onMore} more={t("Ver plan")} testId="profile-pdi">
      {!list.length ? <Empty>{t("Sin objetivos pendientes.")}</Empty> : list.map((g) => {
        const [label, bg, fg] = PDI_STATE[st(g)];
        return (
          <div key={g.id} className="flex items-center" style={{ gap: 8, padding: "5px 0", borderTop: SOFT_LINE, fontSize: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }} className="line-clamp-2">{g.objective || t(g.competency_text || "")}</span>
            <Chip bg={bg} fg={fg}>{t(label)}</Chip>
          </div>
        );
      })}
    </Box>
  );
}

function Eval360Card({ playerId, position }) {
  const t = useT();
  const { tag } = useFormat();
  const { data: evals = [] } = useQuery({ queryKey: ["eval360", playerId], queryFn: () => base44.entities.Evaluation360.filter({ player_id: playerId }, "-date") });
  const latest = evals[0] ?? null;
  const avg = computeAverages(latest?.scores, areasFor(position));
  return (
    <Box title={t("Evaluación 360")} testId="profile-360" extra={avg.overall != null ? <span className="rs2-display" style={{ fontSize: 15, color: "#fff", background: RS.granate, borderRadius: 6, padding: "2px 6px" }}>{avg.overall}</span> : null}>
      {!latest ? <Empty>{t("Se rellena con la Evaluación 360 (pestaña PDI)")}</Empty> : (
        <>
          {AREAS.map((a) => {
            const v = avg[a.key];
            return (
              <div key={a.key} className="flex items-center" style={{ gap: 8, fontSize: 12, padding: "3px 0" }}>
                <span style={{ width: 60, color: RS.ink2 }}>{t(a.label)}</span>
                <div style={{ flex: 1, height: 6, background: RS.lineSoft, borderRadius: 9, overflow: "hidden" }}><div style={{ width: `${(v || 0) * 10}%`, height: "100%", background: scoreColor(v), borderRadius: 9 }} /></div>
                <b style={{ width: 26, textAlign: "right" }}>{v ?? "–"}</b>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: RS.muted, marginTop: 4 }}>{t("Escala 1–10")} · {latest.period || (latest.date ? new Date(latest.date).toLocaleDateString(tag, { month: "short", year: "numeric" }) : "")}</div>
        </>
      )}
    </Box>
  );
}

/** Pestaña Resumen de la ficha: tres columnas (ficha y contacto · temporada · entrenos, médico, PDI y 360) */
export default function ProfileSummary({ player, team, footMode, rows, next, attWin, attStrip, injuries, showFamilies, showPdi, can, onGoTab }) {
  const mobile = useIsMobile();
  const col = { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
  const ficha = <FichaCard key="ficha" player={player} footMode={footMode} />;
  const contact = <ContactCard key="contact" player={player} showFamilies={showFamilies} />;
  const nextM = <NextMatchCard key="next" next={next} team={team} />;
  const season = <SeasonCard key="season" rows={rows} isGK={player.position === "portero"} onMore={can("stats") ? () => onGoTab("stats") : null} />;
  const train = <TrainingCard key="train" win={attWin} strip={attStrip} onMore={can("entrenos") ? () => onGoTab("entrenos") : null} />;
  const med = can("injuries") ? <MedicalCard key="med" injuries={injuries} onMore={() => onGoTab("injuries")} /> : null;
  const pdi = showPdi ? <PdiCard key="pdi" playerId={player.id} onMore={() => onGoTab("pdi")} /> : null;
  const e360 = showPdi ? <Eval360Card key="360" playerId={player.id} position={player.position} /> : null;
  // En el móvil, primero lo del día a día (próximo partido, partidos, entrenos) y la ficha al final
  if (mobile) return <div style={col} data-testid="profile-summary">{[nextM, season, train, med, pdi, e360, ficha, contact]}</div>;
  return (
    <div className="flex flex-wrap items-start" style={{ gap: 12 }} data-testid="profile-summary">
      <div style={{ ...col, flex: "1 1 260px" }}>{ficha}{contact}</div>
      <div style={{ ...col, flex: "1.4 1 360px" }}>{nextM}{season}</div>
      <div style={{ ...col, flex: "1 1 260px" }}>{train}{med}{pdi}{e360}</div>
    </div>
  );
}
