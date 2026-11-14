// Ficha del jugador → pestaña Entrenos (14/11/2026, maqueta «Maqueta Ficha del jugador · pestañas» aprobada por Nacho)
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { RS } from "@/components/rs2/kit";
import { WIN, LOSS } from "@/components/rs2/dashParts";
import { REASON_LABEL } from "@/components/myteam/AttendanceParts";
import TrainingLoadSection from "./TrainingLoadSection";
import { Box, Chip, CHIP, Note, Empty, Seg, Bar, Cols, AMBER } from "./ProfileParts";
import { trainingSeason, attendanceStreak, absenceReasons } from "@/lib/profileTabs";
import { pastTrainings, teamRates, periodStart } from "@/lib/trainingAttendance";
import { useT, useFormat, msg } from "@/i18n";

const CODE = {
  s: [WIN, msg("Asiste")], a: ["#F59E0B", msg("A parte")], n: [LOSS, msg("No asiste")], c: ["#D1D5DB", msg("Cancelado")],
  x: ["#EDE7E6", msg("Sin marcar")], p: ["#EDE7E6", msg("Sin pasar lista")], f: [null, msg("Por venir")],
};
const PERIODS = [["temporada", msg("Temporada")], ["30", msg("30 días")], ["mes", msg("Este mes")]];
const pctColor = (p) => (p == null ? RS.faint : p >= 80 ? WIN : p >= 70 ? AMBER : LOSS);

export default function ProfileTrainings({ player, events, attendance, now, mobile, showLoad, playerMode }) {
  const t = useT();
  const fmt = useFormat();
  const [period, setPeriod] = useState("temporada");
  const since = periodStart(period, now);
  const season = useMemo(() => trainingSeason(events, attendance, { teamId: player.team_id, playerId: player.id, now, since: periodStart("temporada", now) }), [events, attendance, player.team_id, player.id, now]);
  const view = useMemo(() => {
    const from = since.getTime();
    const months = season.months.map((m) => ({ ...m, items: m.items.filter((i) => new Date(i.date).getTime() >= from) })).filter((m) => m.items.length);
    return months;
  }, [season, since]);
  const inPeriod = view.flatMap((m) => m.items);
  const c = (code) => inPeriod.filter((i) => i.code === code).length;
  const marked = c("s") + c("a") + c("n");
  const pct = marked ? Math.round(((c("s") + c("a")) / marked) * 100) : null;
  const last30 = useMemo(() => {
    const from = now.getTime() - 30 * 86400000;
    const l = season.items.filter((i) => new Date(i.date).getTime() >= from && ["s", "a", "n"].includes(i.code));
    return l.length ? Math.round((l.filter((i) => i.code !== "n").length / l.length) * 100) : null;
  }, [season, now]);
  const teamAvg = useMemo(() => (player.team_id ? teamRates(pastTrainings(events, attendance, { teamId: player.team_id, now }), { since, now }).period : null), [events, attendance, player.team_id, now, since]);
  const streak = attendanceStreak(season.items);
  const reasons = absenceReasons(inPeriod);
  const apart = c("a");
  const reasonsMax = Math.max(1, ...reasons.map((r) => r[1]), apart);
  const missed = inPeriod.filter((i) => i.code === "n" || i.code === "a").reverse();
  const monthName = (m) => new Date(m.year, m.month, 1).toLocaleDateString(fmt.tag, { month: "short" });
  const dayLabel = (d) => new Date(d).toLocaleDateString(fmt.tag, { weekday: "short", day: "numeric", month: "short" });
  const EXTRA = { estudios: msg("Estudios"), sancion: msg("Sanción"), lesion: msg("Lesión"), enfermo: msg("Enfermo") };
  const reasonText = (k) => (REASON_LABEL[k] ? t(REASON_LABEL[k]) : EXTRA[k] ? t(EXTRA[k]) : k ? k.charAt(0).toUpperCase() + k.slice(1) : t("Otro"));
  const { data: loads = [] } = useQuery({ queryKey: ["trainingload", player.id], queryFn: () => base44.entities.TrainingLoad.filter({ player_id: player.id }, "-date"), enabled: showLoad });
  const [loadOpen, setLoadOpen] = useState(null);
  const loadVisible = loadOpen ?? loads.length > 0;

  const grid = (
    <Box title={t("La temporada entreno a entreno")} testId="pt-grid" right={<Seg testPrefix="pt-period" value={period} onChange={setPeriod} options={PERIODS.map(([k, l]) => [k, t(l)])} />}>
      {view.length === 0 ? <Empty>{t("Sin entrenos en este periodo.")}</Empty> : view.map((m) => (
        <div key={m.key} className="flex items-start" style={{ gap: 8, padding: "4px 0" }}>
          <span style={{ width: 34, fontSize: 11, fontWeight: 700, color: RS.muted, textTransform: "capitalize", paddingTop: 1 }}>{monthName(m)}</span>
          <div className="flex flex-wrap" style={{ gap: 3, flex: 1 }}>
            {m.items.map((i) => {
              const [bg, label] = CODE[i.code];
              const tip = `${dayLabel(i.date)} · ${t(label)}${i.reason ? ` · ${reasonText(i.reason)}` : ""}${i.note ? ` · ${i.note}` : ""}${i.guest ? ` · ${t("con otro equipo")}` : ""}`;
              return <span key={i.id} title={tip} data-code={i.code} style={{ width: 16, height: 16, borderRadius: 4, background: bg || "transparent", border: bg ? (i.guest ? `2px solid ${RS.granate}` : 0) : `1.5px solid ${RS.line}`, boxSizing: "border-box" }} />;
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap" style={{ gap: 12, fontSize: 11, color: RS.muted, marginTop: 6 }}>
        {["s", "a", "n", "c", "f"].map((k) => (
          <span key={k} className="inline-flex items-center" style={{ gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: CODE[k][0] || "transparent", border: CODE[k][0] ? 0 : `1.5px solid ${RS.line}` }} />{t(CODE[k][1])}</span>
        ))}
        <span style={{ marginLeft: "auto" }}>{t("Pasa el ratón por un cuadrito: fecha, motivo y nota")}</span>
      </div>
    </Box>
  );

  const absences = (
    <Box title={t("Faltas y a parte")} testId="pt-missed" right={<span style={{ fontSize: 11, color: RS.muted }}>{t("{n} de {m}", { n: missed.length, m: marked })}</span>}>
      {missed.length === 0 ? <Empty>{t("No ha faltado a ningún entreno en este periodo.")}</Empty> : missed.slice(0, 30).map((i) => {
        const [bg, fg] = i.code === "a" ? CHIP.warn : CHIP.bad;
        return (
          <div key={i.id} className="flex items-center" style={{ gap: 10, padding: "6px 0", borderTop: "1px solid #F3EEEE", fontSize: 12.5 }} data-testid={`pt-miss-${i.id}`}>
            <span style={{ width: 92, color: RS.muted, textTransform: "capitalize" }}>{dayLabel(i.date)}</span>
            <Chip bg={bg} fg={fg}>{i.code === "a" ? t("A parte") : reasonText(i.reason)}</Chip>
            <span style={{ color: RS.ink2, flex: 1, minWidth: 0 }} className="truncate">{i.note || ""}</span>
          </div>
        );
      })}
    </Box>
  );

  const summary = (
    <Box title={t("Resumen")} testId="pt-summary">
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
        {[[pct, t("este periodo")], [last30, t("30 días")], [teamAvg, t("media del equipo")]].map(([v, l], k) => (
          <div key={k}><div className="rs2-display tabular-nums" style={{ fontSize: 26, lineHeight: 1, color: k === 2 ? RS.ink2 : pctColor(v) }}>{v == null ? "–" : `${v}%`}</div><div style={{ fontSize: 11, color: RS.muted }}>{l}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between" style={{ fontSize: 12, marginTop: 10, borderTop: "1px solid #F3EEEE", paddingTop: 8, gap: 6 }}>
        <span><b>{c("s")}</b> {t("asiste")}</span><span><b>{c("a")}</b> {t("a parte")}</span><span><b>{c("n")}</b> {t("no asiste")}</span><span><b>{c("c")}</b> {t("cancelados")}</span>
      </div>
      {streak.n > 1 && <Note>{t("{n} entrenos seguidos sin faltar hasta el {fecha}", { n: streak.n, fecha: new Date(streak.until).toLocaleDateString(fmt.tag, { day: "numeric", month: "short" }) })}</Note>}
    </Box>
  );

  const motives = (
    <Box title={t("Motivos")} testId="pt-reasons">
      {reasons.length === 0 && !apart ? <Empty>{t("Sin faltas.")}</Empty> : (
        <>
          {reasons.map(([k, n]) => (
            <div key={k} className="flex items-center" style={{ gap: 8, fontSize: 12, padding: "3px 0" }}>
              <span style={{ width: 74 }}>{reasonText(k)}</span><Bar pct={(n / reasonsMax) * 100} color={LOSS} /><b style={{ width: 16, textAlign: "right" }}>{n}</b>
            </div>
          ))}
          {apart > 0 && (
            <div className="flex items-center" style={{ gap: 8, fontSize: 12, padding: "3px 0" }}>
              <span style={{ width: 74 }}>{t("A parte")}</span><Bar pct={(apart / reasonsMax) * 100} color="#F59E0B" /><b style={{ width: 16, textAlign: "right" }}>{apart}</b>
            </div>
          )}
        </>
      )}
    </Box>
  );

  const load = showLoad && !playerMode && (
    <Box title={t("Carga (RPE)")} testId="pt-load"
      right={<button type="button" onClick={() => setLoadOpen(!loadVisible)} data-testid="pt-load-toggle" style={{ border: 0, background: "none", color: RS.granate, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
        {loadVisible ? t("Ocultar") : loads.length ? t("Ver {n} registros", { n: loads.length }) : t("Abrir")}{loadVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>}>
      {!loadVisible ? <Empty>{loads.length ? t("{n} registros de esfuerzo.", { n: loads.length }) : t("Sin registros de esfuerzo esta temporada.")}</Empty> : <TrainingLoadSection playerId={player.id} />}
    </Box>
  );

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <Cols mobile={mobile} left={<>{grid}{absences}</>} right={<>{summary}{motives}</>} />
      {load}
    </div>
  );
}
