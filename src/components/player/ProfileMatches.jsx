// Ficha del jugador → pestaña Partidos (14/11/2026, maqueta «Maqueta Ficha del jugador · pestañas» aprobada por Nacho)
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import { RS } from "@/components/rs2/kit";
import { LOSS } from "@/components/rs2/dashParts";
import MatchResultPill from "@/components/calendar/MatchResultPill";
import MatchStatDialog from "./MatchStatDialog";
import { Box, Chip, CHIP, Note, Empty, SmallBtn, Seg, Bar, Stars, th, td, Cols, AMBER } from "./ProfileParts";
import { matchRows, MATCHES } from "@/lib/playerProfile";
import { manualRows, participationSplit, ratingInfo } from "@/lib/profileTabs";
import { reasonShort, MIN_PCT } from "@/lib/participation";
import { eventMinutes } from "@/lib/matchDuration";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { goalsFor, playerGoals, seasonPace, GOAL_LABEL, GOAL_SHORT } from "@/lib/participationGoals";
import { useT, useFormat, msg } from "@/i18n";

const TYPES = [
  ["liga", msg("Liga"), ["partido_liga"]],
  ["amistoso", msg("Amistosos"), ["partido_amistoso"]],
  ["torneo", msg("Torneos"), ["torneo"]],
  ["todos", msg("Todos"), MATCHES],
];
const GOAL_COLOR = { done: CHIP.ok, ok: CHIP.gray, behind: CHIP.warn, impossible: CHIP.bad };
const SUB = "#C9A3A8";

export default function ProfileMatches({ player, team, teamsById, events, convs, stats, counted, countedOther, part, goals, playerMode, staffEdit, mobile, now }) {
  const t = useT();
  const fmt = useFormat();
  const [type, setType] = useState("liga");
  const [edit, setEdit] = useState(null); // {item} | {item:null} = nuevo
  const pid = player.id;
  const closed = useMemo(() => new Set([...(counted || []), ...(countedOther || [])]), [counted, countedOther]);

  const byType = useMemo(() => {
    const out = {};
    for (const [k, , types] of TYPES) out[k] = matchRows({ events, convs, stats, playerId: pid, teamId: player.team_id, counted: k === "liga" ? counted : closed, types });
    const known = new Set(events.map((e) => e.id));
    out.manual = manualRows(stats, pid, known);
    out.todos = [...out.todos, ...out.manual].sort((a, b) => new Date(b.ev.date) - new Date(a.ev.date));
    return out;
  }, [events, convs, stats, pid, player.team_id, counted, closed]);
  const rows = byType[type] || [];
  const liga = byType.liga;

  const split = participationSplit(rows);
  const rating = ratingInfo(rows);
  const f7 = teamPlaysF7(team);
  const rule = part?.rules?.[f7 ? "f7" : "f11"] || MIN_PCT[f7 ? "f7" : "f11"];
  const teamOf = (ev) => teamsById.get(ev.team_id) || team;
  const pctOf = (r) => {
    if (!r.ev?.id) return null;
    const total = eventMinutes(r.ev, teamOf(r.ev));
    return total ? Math.min(100, Math.round((r.minutes / total) * 100)) : null;
  };
  const chart = liga.slice(0, 12).reverse();
  const g = !playerMode && team ? goalsFor(team, goals) : null;
  const pace = g ? seasonPace(events, team.id, now) : null;
  const goalList = g && part ? playerGoals(part.all, g, { played: part.all.availMatches, remaining: pace.remaining }) : [];
  const canEdit = staffEdit && !playerMode;

  const roleCell = (r) => {
    if (r.called) {
      const label = r.starter ? t("Titular") : r.minutes > 0 ? t("Suplente") : t("Suplente · no jugó");
      return <span style={{ color: r.starter ? RS.ink : RS.ink2 }}>{label}{r.guest ? <span style={{ color: RS.muted }}> · {t("de invitado")}</span> : null}</span>;
    }
    const k = r.reason || "sin_motivo";
    const coach = ["decision_tecnica", "descanso", "sin_motivo"].includes(k);
    const [bg, fg] = coach ? CHIP.gray : CHIP.warn;
    return <Chip bg={bg} fg={fg}>{coach ? t("Fuera") : t("No disponible")} · {t(reasonShort(k)).toLowerCase()}</Chip>;
  };
  const jLabel = (ev) => (ev.type === "manual" ? t("A mano") : ev.fcf_jornada ? `J${ev.fcf_jornada}` : ev.type === "partido_amistoso" ? t("Amist.") : ev.type === "torneo" ? t("Torneo") : "");
  const dateOf = (d) => { try { return new Date(d).toLocaleDateString(fmt.tag, { day: "2-digit", month: "2-digit" }); } catch { return "—"; } };

  const table = (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }} data-testid="pm-table">
        <thead><tr>
          <th style={th()}>J</th><th style={th()}>{t("Fecha")}</th><th style={th()}>{t("Rival")}</th><th style={th()}>{t("Resultado")}</th>
          <th style={th()}>{t("Papel")}</th><th style={th()}>{t("Min")}</th><th style={th("center")}>{t("Gol")}</th><th style={th("center")}>{t("As.")}</th>
          <th style={th("center")}>{t("Tarj.")}</th>{!playerMode && <th style={th()}>{t("Val.")}</th>}{!playerMode && !mobile && <th style={th()}>{t("Corrección del entrenador")}</th>}
          {canEdit && <th style={th()} />}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const p = pctOf(r);
            const away = r.ev.is_home === false;
            const rival = r.ev.opponent || r.ev.title || "—";
            return (
              <tr key={(r.ev.id || "m") + i} style={{ opacity: r.called ? 1 : 0.8 }} data-testid={`pm-row-${r.ev.id || r.stat?.id}`}>
                <td style={td({ color: RS.muted, whiteSpace: "nowrap" })}>{jLabel(r.ev)}</td>
                <td style={td({ whiteSpace: "nowrap" })}>{dateOf(r.ev.date)}</td>
                <td style={td({ fontWeight: 600, maxWidth: 190 })}>
                  {r.ev.id ? <Link to={`/MatchDetail?id=${r.ev.id}`} style={{ color: RS.ink }}>{rival}</Link> : rival}
                  {r.ev.id && <span style={{ color: RS.muted, fontWeight: 400, fontSize: 11 }}> · {away ? t("fuera") : t("casa")}</span>}
                  {r.mvp && <span title={t("Jugador del partido")} style={{ marginLeft: 4 }}>🏅</span>}
                </td>
                <td style={td()}>{r.ev.id ? <MatchResultPill event={r.ev} size="xs" /> : <span style={{ color: RS.faint }}>—</span>}</td>
                <td style={td({ whiteSpace: "nowrap" })}>{roleCell(r)}</td>
                <td style={td({ whiteSpace: "nowrap" })}>
                  {r.called && (r.minutes > 0 || r.starter) ? (
                    <span className="inline-flex items-center" style={{ gap: 6 }}>
                      {p != null && <Bar pct={p} color={r.starter ? RS.granate : SUB} h={5} w={42} />}
                      <b className="tabular-nums">{r.minutes}'</b>
                    </span>
                  ) : null}
                </td>
                <td style={td({ textAlign: "center", fontWeight: 700 })}>{r.goals || ""}</td>
                <td style={td({ textAlign: "center", fontWeight: 700, color: RS.granate })}>{r.assists || ""}</td>
                <td style={td({ textAlign: "center" })}>
                  {r.yellow > 0 && <span title={t("Amarilla")} style={{ display: "inline-block", width: 8, height: 11, background: "#FACC15", borderRadius: 2, marginRight: 2 }} />}
                  {r.red > 0 && <span title={t("Roja")} style={{ display: "inline-block", width: 8, height: 11, background: LOSS, borderRadius: 2 }} />}
                </td>
                {!playerMode && <td style={td()}>{r.rating ? <Stars n={r.rating} /> : null}</td>}
                {!playerMode && !mobile && <td style={td({ color: RS.muted, fontSize: 11.5, maxWidth: 260 })}><span className="line-clamp-2" title={r.notes || ""}>{r.notes || ""}</span></td>}
                {canEdit && (
                  <td style={td({ textAlign: "right" })}>
                    {r.stat && <button type="button" onClick={() => setEdit({ item: r.stat })} title={t("Corregir a mano")} data-testid={`pm-edit-${r.stat.id}`} style={{ border: 0, background: "none", color: RS.muted, padding: 3 }}><Pencil className="w-3.5 h-3.5" /></button>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ padding: "14px 4px" }}><Empty>{t("Sin partidos cerrados de este tipo.")}</Empty></div>}
    </div>
  );

  const left = (
    <Box title={t("Partido a partido")} testId="pm-list"
      right={canEdit && <SmallBtn onClick={() => setEdit({ item: null })} testId="pm-add"><Plus className="w-3.5 h-3.5" />{t("Añadir partido a mano")}</SmallBtn>}>
      <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 8 }}>
        <Seg testPrefix="pm-type" value={type} onChange={setType}
          options={TYPES.map(([k, label]) => [k, `${t(label)} · ${(byType[k] || []).length}`])} />
      </div>
      {table}
      {byType.manual.length > 0 && type !== "todos" && <Note>{t("{n} partidos apuntados a mano: salen en «Todos».", { n: byType.manual.length })}</Note>}
      <Note>{t("Tocar el rival abre el partido. El lápiz corrige a mano sus minutos, goles o valoración.")}</Note>
    </Box>
  );

  const minutesChart = (
    <Box title={t("Minutos por jornada")} testId="pm-chart">
      {chart.length === 0 ? <Empty>{t("Aún no hay partidos de liga cerrados.")}</Empty> : (
        <>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 16 + 80 * (rule.alert / 100), borderTop: `1.5px dashed ${RS.naranja}` }} aria-hidden="true" />
            <div className="flex items-end" style={{ gap: 5 }}>
              {chart.map((r, i) => {
                const p = pctOf(r) ?? 0;
                return (
                  <div key={r.ev.id || i} className="flex flex-col items-center" style={{ flex: 1, gap: 3 }} title={`${r.ev.opponent || ""} · ${r.minutes}'`}>
                    <div style={{ height: 80, width: "100%", maxWidth: 22, display: "flex", alignItems: "flex-end", background: "#F7F3F2", borderRadius: 4 }}>
                      <div style={{ height: `${Math.max(p, r.called ? 2 : 0)}%`, width: "100%", background: r.starter ? RS.granate : SUB, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 10, color: RS.muted }}>{r.ev.fcf_jornada ? `J${r.ev.fcf_jornada}` : dateOf(r.ev.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Note><span style={{ color: RS.naranja, fontWeight: 700 }}>- - -</span> {t("mínimo del club ({n} %)", { n: rule.alert })} · {t("granate titular, claro suplente")}</Note>
        </>
      )}
    </Box>
  );

  const totalSplit = split.starter + split.sub + split.benched + split.unavailable;
  const seg = (n, color) => (n ? <div style={{ width: `${(n / totalSplit) * 100}%`, background: color }} /> : null);
  const reasonsLine = Object.entries(split.reasons).filter(([k]) => !["decision_tecnica", "descanso", "sin_motivo"].includes(k)).map(([k, n]) => `${t(reasonShort(k)).toLowerCase()} ${n}`).join(" · ");
  const participation = (
    <Box title={t("Cómo ha participado")} testId="pm-split">
      {totalSplit === 0 ? <Empty>{t("Sin partidos.")}</Empty> : (
        <>
          <div className="flex" style={{ height: 16, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
            {seg(split.starter, RS.granate)}{seg(split.sub, SUB)}{seg(split.benched, "#9CA3AF")}{seg(split.unavailable, "#F59E0B")}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 12 }}>
            <span><b>{split.starter}</b> {t("titular")}</span>
            <span><b>{split.sub}</b> {t("suplente")}{split.subUnused ? <span style={{ color: RS.muted }}> ({t("{n} sin jugar", { n: split.subUnused })})</span> : null}</span>
            <span><b>{split.benched}</b> {t("fuera por decisión del entrenador")}</span>
            <span title={reasonsLine}><b>{split.unavailable}</b> {t("no disponible")}{reasonsLine ? <span style={{ color: RS.muted }}> · {reasonsLine}</span> : null}</span>
          </div>
        </>
      )}
    </Box>
  );

  const goalsBox = goalList.length > 0 && type === "liga" && (
    <Box title={t("Objetivos de participación")} testId="pm-goals">
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {goalList.map((x) => {
          const [bg, fg] = GOAL_COLOR[x.state];
          const word = x.state === "done" ? t("cumplido") : x.state === "behind" ? t("por detrás del ritmo") : x.state === "impossible" ? t("ya no llega con los partidos que quedan") : t("va a ritmo");
          return <Chip key={x.key} bg={bg} fg={fg} title={`${t(GOAL_LABEL[x.key])}: ${word}`} testId={`pm-goal-${x.key}`}>{x.state === "done" ? "✓ " : ""}{t(GOAL_SHORT[x.key])} {x.value}/{x.target} · {word}</Chip>;
        })}
      </div>
      <Note>{t("Quedan {n} partidos de liga · objetivos del club para este equipo", { n: pace.remaining })}</Note>
    </Box>
  );

  const ratingBox = !playerMode && (
    <Box title={t("Valoración del entrenador")} testId="pm-rating">
      {rating.n === 0 ? <Empty>{t("Sin valorar todavía.")}</Empty> : (
        <>
          <div className="flex flex-wrap items-baseline" style={{ gap: 8 }}>
            <span className="rs2-display tabular-nums" style={{ fontSize: 28, color: AMBER, lineHeight: 1 }}>{fmt.num(rating.avg)}</span>
            <span style={{ fontSize: 12, color: RS.ink2 }}>{t("de 3 · {n} partidos valorados", { n: rating.n })}</span>
            {rating.trend && (() => {
              const [bg, fg] = rating.trend === "up" ? CHIP.ok : rating.trend === "down" ? CHIP.bad : CHIP.gray;
              return <span style={{ marginLeft: "auto" }}><Chip bg={bg} fg={fg}>{rating.trend === "up" ? "▲" : rating.trend === "down" ? "▼" : "="} {t("últimos 3: {n}", { n: fmt.num(rating.recent) })}</Chip></span>;
            })()}
          </div>
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 6 }}>{rating.last.map((n, i) => <Stars key={i} n={n} />)}</div>
          {rating.mvp > 0 && <Note>🏅 {t("Jugador del partido: {n}", { n: rating.mvp })}</Note>}
        </>
      )}
    </Box>
  );

  return (
    <>
      <Cols mobile={mobile} left={left} right={<>{minutesChart}{participation}{goalsBox}{ratingBox}</>} />
      {canEdit && <MatchStatDialog playerId={pid} item={edit?.item || null} open={!!edit} onClose={() => setEdit(null)} />}
    </>
  );
}

