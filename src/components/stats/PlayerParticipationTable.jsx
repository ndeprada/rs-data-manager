import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { playerFullName } from "@/lib/playerName";
import { participationOf, minutesAlerts, playerLevel, MIN_PCT, FORMAT_LABEL } from "@/lib/participation";
import { useParticipationContext } from "@/lib/useParticipation";
import { ReasonChips, FormatPills, FORMAT_OPTIONS, PctPill, alertText } from "@/components/stats/ParticipationBits";
import { useT } from "@/i18n";

const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];

function Th({ label, k, sort, setSort, className = "", title }) {
  const t = useT();
  const active = sort.key === k;
  return (
    <th title={title} className={`px-2 py-2 font-bold whitespace-nowrap cursor-pointer hover:text-gray-700 select-none ${className}`}
      onClick={() => setSort({ key: k, dir: active && sort.dir === "desc" ? "asc" : "desc" })}>
      {t(label)}
      {active ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : <ChevronsUpDown className="w-3 h-3 inline ml-0.5 opacity-30" />}
    </th>
  );
}

const mins = (n) => (n == null ? "—" : `${n}'`);

// Participación de cada jugador del equipo en los partidos: titular, suplente, no convocado (y por qué), minutos,
// porcentaje y media sobre los partidos disponibles y sobre los totales, y alerta si juega por debajo del mínimo.
export default function PlayerParticipationTable({ teamId, players, scope }) {
  const t = useT();
  const allCtx = useParticipationContext(scope);
  // Solo cuentan los partidos del propio equipo (lo que juegan como invitados en otro equipo cuenta en ese equipo)
  const ctx = useMemo(() => ({ ...allCtx, events: allCtx.events.filter((e) => e.team_id === teamId) }), [allCtx, teamId]);
  const [format, setFormat] = useState("all");
  const [sort, setSort] = useState({ key: "pos", dir: "asc" });

  const rows = useMemo(() => players
    .filter((p) => p.team_id === teamId && p.status !== "baja")
    .map((p) => ({ p, ...participationOf(p, ctx) })), [players, teamId, ctx]);

  const has = (k) => rows.some((r) => r[k].conv + r[k].noConv > 0);
  const hasF11 = has("f11"), hasF7 = has("f7");
  const fmt = (format === "f11" && hasF11) || (format === "f7" && hasF7) ? format : "all";
  const view = (r) => r[fmt];
  const alertsOf = (r) => minutesAlerts(r).filter((a) => fmt === "all" || a.format === fmt);

  const sorted = useMemo(() => {
    const val = (r) => {
      const b = r[fmt];
      switch (sort.key) {
        case "name": return `${r.p.last_name || ""} ${r.p.first_name || ""}`.toLowerCase();
        case "pos": { const i = POS_ORDER.indexOf(r.p.position); return (i < 0 ? 99 : i) * 1000 + (r.p.jersey_number ?? 999); }
        default: return b[sort.key] ?? -1;
      }
    };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [rows, sort, fmt]);

  const flagged = rows.map((r) => ({ r, alerts: alertsOf(r) })).filter((x) => x.alerts.length > 0);

  const num = "text-center px-2 py-1.5";
  const hdr = { sort, setSort };
  const options = FORMAT_OPTIONS.filter((o) => o.value === "all" || (o.value === "f11" ? hasF11 : hasF7));

  if (!teamId) {
    return <div className="bg-white border border-gray-200 rounded-sm p-8 text-center text-sm text-gray-400">{t("Elige un equipo arriba para ver la participación de sus jugadores en los partidos.")}</div>;
  }

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Participación de los jugadores")}</h2>
        {options.length > 2 && <FormatPills value={fmt} onChange={setFormat} options={options} />}
      </div>
      {rows.length === 0 || (!hasF11 && !hasF7) ? (
        <p className="p-6 text-center text-gray-400 text-sm">{t("Todavía no hay partidos cerrados de este equipo en esta competición.")}</p>
      ) : (
        <>
          {flagged.length > 0 && (
            <div className="px-4 py-2 border-b border-red-100 bg-red-50 text-[11px] text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>
                <b>{t("Por debajo del mínimo de minutos ({length}):", { length: flagged.length })}</b>{" "}
                {flagged.map(({ r, alerts }, i) => (
                  <span key={r.p.id}>
                    {i > 0 && " · "}
                    <Link to={`/PlayerProfile?id=${r.p.id}`} className="font-bold hover:underline">{playerFullName(r.p)}</Link>{" "}
                    ({alerts.map((a) => `${a.format === "f7" ? "F7" : "F11"} ${a.pct} %`).join(", ")})
                  </span>
                ))}
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] text-gray-400 uppercase tracking-wider border-b border-gray-100" style={{ fontFamily: "var(--font-display)" }}>
                  <th colSpan={7} />
                  <th colSpan={3} className="px-2 pt-1.5 pb-0.5 text-center font-bold border-l border-gray-100" title={t("Partidos en los que el jugador estaba a disposición del entrenador")}>{t("Sobre disponibles")}</th>
                  <th colSpan={2} className="px-2 pt-1.5 pb-0.5 text-center font-bold border-l border-gray-100" title={t("Todos los partidos del jugador, también aquellos en que no pudo estar")}>{t("Sobre totales")}</th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <Th label={t("Jugador")} k="name" {...hdr} className="text-left" />
                  <Th label={t("Conv.")} k="conv" {...hdr} title={t("Partidos en los que estuvo convocado")} />
                  <Th label={t("Tit.")} k="titular" {...hdr} title={t("Partidos como titular")} />
                  <Th label={t("Sup.")} k="suplente" {...hdr} title={t("Partidos como suplente (entre paréntesis, los que no llegó a jugar)")} />
                  <Th label={t("No conv.")} k="noConv" {...hdr} title={t("Partidos del equipo en los que no fue convocado")} />
                  <th className="px-2 py-2 font-bold text-left">{t("Motivo de la ausencia")}</th>
                  <Th label={t("Min")} k="mins" {...hdr} title={t("Minutos jugados en total")} />
                  <Th label={t("Part.")} k="availMatches" {...hdr} className="border-l border-gray-100" title={t("Partidos disponibles (sobre los totales del jugador)")} />
                  <Th label="%" k="pctAvail" {...hdr} title={t("Minutos jugados sobre los minutos de los partidos disponibles")} />
                  <Th label={t("Media")} k="avgAvail" {...hdr} title={t("Minutos por partido disponible")} />
                  <Th label="%" k="pctTotal" {...hdr} className="border-l border-gray-100" title={t("Minutos jugados sobre los minutos de todos sus partidos")} />
                  <Th label={t("Media")} k="avgTotal" {...hdr} title={t("Minutos por partido (todos)")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((r) => {
                  const b = view(r);
                  const alerts = alertsOf(r);
                  const level = playerLevel(r, fmt);
                  const pctTitle = alerts.length
                    ? alerts.map((a) => alertText(a, t)).join(" · ")
                    : t("{mins}' de {avail}' disponibles", { mins: b.mins, avail: b.availMin });
                  return (
                    <tr key={r.p.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <Link to={`/PlayerProfile?id=${r.p.id}`} className="font-bold text-gray-900 hover:underline" style={{ fontFamily: "var(--font-display)" }}>{playerFullName(r.p)}</Link>
                        <span className="ml-1.5 text-[9px] font-black px-1 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)" }}>{POS_LABEL[r.p.position] || "—"}</span>
                        {alerts.length > 0 && (
                          <span title={alerts.map((a) => alertText(a, t)).join(" · ")} className="inline-flex align-middle ml-1.5 text-red-600"><AlertTriangle className="w-3.5 h-3.5" /></span>
                        )}
                      </td>
                      <td className={`${num} font-black`}>{b.conv}</td>
                      <td className={`${num} font-bold text-gray-700`}>{b.titular}</td>
                      <td className={`${num} text-gray-600`}>{b.suplente}{b.suplenteSin > 0 && <span className="text-gray-400" title={t("Convocado y no llegó a jugar")}> ({b.suplenteSin})</span>}</td>
                      <td className={`${num} font-bold ${b.noConv ? "text-gray-700" : "text-gray-300"}`}>{b.noConv || "—"}</td>
                      <td className="px-2 py-1.5"><ReasonChips reasons={b.reasons} /></td>
                      <td className={`${num} font-bold text-gray-800`}>{b.mins > 0 ? `${b.mins}'` : "—"}</td>
                      <td className={`${num} border-l border-gray-100 text-gray-700`} title={t("{availMatches} partidos disponibles de {totalMatches}", { availMatches: b.availMatches, totalMatches: b.totalMatches })}>
                        <b>{b.availMatches}</b><span className="text-gray-400">/{b.totalMatches}</span>
                      </td>
                      <td className={num}><PctPill value={b.pctAvail} level={level} title={pctTitle} /></td>
                      <td className={`${num} text-gray-700`}>{mins(b.avgAvail)}</td>
                      <td className={`${num} border-l border-gray-100 font-bold text-gray-700`} title={t("{mins}' de {totalMin}' de todos sus partidos", { mins: b.mins, totalMin: b.totalMin })}>{b.pctTotal != null ? `${b.pctTotal}%` : "—"}</td>
                      <td className={`${num} text-gray-600`}>{mins(b.avgTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-[10px] leading-relaxed text-gray-500 space-y-0.5">
            <p>
              <b className="text-gray-600">{t("Disponible")}</b> {t("= partido en el que el jugador estaba a disposición del entrenador. No cuentan los partidos en que no pudo estar por lesión, enfermedad, sanción, viaje, estudios u otro motivo; sí cuentan, con 0 minutos, aquellos en que lo deja fuera el entrenador (decisión técnica, descanso) o no hay motivo indicado.")}
            </p>
            <p>
              <b className="text-gray-600">{t("Alerta")}</b> {t("(rojo): {f7} por debajo del {a7} % de los minutos disponibles · {f11} por debajo del {a11} %. En {f11} el objetivo del club es el {target} %: entre el {a11} y el {target} % sale en ámbar.", { f7: t(FORMAT_LABEL.f7), a7: MIN_PCT.f7.alert, f11: t(FORMAT_LABEL.f11), a11: MIN_PCT.f11.alert, target: MIN_PCT.f11.target })}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
