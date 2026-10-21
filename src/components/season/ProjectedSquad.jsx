import React, { useMemo } from "react";
import { birthYearOf } from "@/lib/birthYear";
import { playerFullName } from "@/lib/playerName";
import EmptyState from "@/components/common/EmptyState";
import { useT, msg } from "@/i18n";

export const POS = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
export const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];

const posRank = (p) => { const i = POS_ORDER.indexOf(p.position); return i < 0 ? 99 : i; };
const byPosYearName = (a, b) => posRank(a.p) - posRank(b.p) || (birthYearOf(a.p) || 0) - (birthYearOf(b.p) || 0) || playerFullName(a.p).localeCompare(playerFullName(b.p), "es");

const Chip = ({ children, strong }) => (
  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${strong ? "bg-[var(--granate-pale)] border-[var(--granate)] text-[var(--granate)]" : "bg-gray-50 border-gray-200 text-gray-700"}`}>{children}</span>
);

// Plantilla prevista de un equipo para la temporada siguiente, según los destinos decididos en Traspasos.
// entry = { stay: [], undecided: [], arrive: [], leave: [{ p, to }] }  (jugadores del club)
export default function ProjectedSquad({ title, nextLabel, entry, teamName }) {
  const t = useT();
  const { stay, undecided, arrive, leave } = entry;
  const undecidedIds = useMemo(() => new Set(undecided.map((p) => p.id)), [undecided]);
  const squad = useMemo(
    () => [...stay.map((p) => ({ p, kind: undecidedIds.has(p.id) ? "undecided" : "stay" })), ...arrive.map((p) => ({ p, kind: "arrive" }))].sort(byPosYearName),
    [stay, arrive, undecidedIds]
  );
  const positions = useMemo(() => {
    const m = new Map();
    squad.forEach(({ p }) => { const k = POS[p.position] ? p.position : "none"; m.set(k, (m.get(k) || 0) + 1); });
    return [...POS_ORDER, "none"].filter((k) => m.has(k)).map((k) => [k === "none" ? msg("Sin posición") : POS[k], m.get(k)]);
  }, [squad]);
  const years = useMemo(() => {
    const m = new Map();
    squad.forEach(({ p }) => { const y = birthYearOf(p) || "s/a"; m.set(y, (m.get(y) || 0) + 1); });
    return [...m.entries()].sort((a, b) => (a[0] === "s/a") - (b[0] === "s/a") || String(a[0]).localeCompare(String(b[0])));
  }, [squad]);
  const leaving = useMemo(() => leave.slice().sort((a, b) => byPosYearName({ p: a.p }, { p: b.p })), [leave]);

  const badge = ({ p, kind }) => {
    if (kind === "arrive") return <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "var(--granate-pale)", color: "var(--granate)", borderColor: "var(--granate)" }}>← {teamName(p.team_id)}</span>;
    if (kind === "undecided") return <span className="text-[11px] text-gray-300">{t("Sin decidir")}</span>;
    return <span className="text-[11px] font-semibold text-gray-400">{t("Continúa")}</span>;
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>
          {title} <span className="text-gray-400 font-bold">{t("· plantilla prevista {nextLabel} ({length})", { nextLabel, length: squad.length })}</span>
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>{t("Continúan ·")} <b>{stay.length}</b></Chip>
          <Chip strong={arrive.length > 0}>{t("Llegan ·")} <b>{arrive.length}</b></Chip>
          <Chip>{t("Salen ·")} <b>{leave.length}</b></Chip>
        </div>
        {squad.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-0.5">{t("Posición")}</span>
            {positions.map(([k, n]) => <Chip key={k}>{t(k)} <b>{n}</b></Chip>)}
          </div>
        )}
        {squad.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-0.5">{t("Año")}</span>
            {years.map(([y, n]) => <Chip key={y}>{y} <b>{n}</b></Chip>)}
          </div>
        )}
        {undecided.length > 0 && <p className="mt-2 text-[11px] text-gray-400">{t("{length} sin decidir: se cuentan como que continúan en este equipo.", { length: undecided.length })}</p>}
      </div>

      {squad.length === 0 ? <EmptyState title={t("Este equipo se queda sin jugadores según los traspasos decididos")} /> : (
        <div className="divide-y divide-gray-100">
          {squad.map((it) => (
            <div key={it.p.id} className="flex items-center gap-3 px-4 py-1.5 text-sm">
              <span className="w-6 text-center text-[11px] font-bold text-gray-400">{it.p.jersey_number ?? ""}</span>
              <span className="flex-1 min-w-0 truncate font-semibold text-gray-900">{playerFullName(it.p)}</span>
              <span className="hidden sm:inline text-[11px] text-gray-400 w-10 text-center">{birthYearOf(it.p) || ""}</span>
              <span className="hidden sm:inline text-[10px] font-bold text-gray-400 w-8 text-center">{POS[it.p.position] ? t(POS[it.p.position]) : ""}</span>
              <span className="w-36 text-right">{badge(it)}</span>
            </div>
          ))}
        </div>
      )}

      {leaving.length > 0 && (
        <>
          <div className="px-4 py-1.5 border-y border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Salen de este equipo ({length})", { length: leaving.length })}</div>
          <div className="divide-y divide-gray-100">
            {leaving.map(({ p, to }) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-1.5 text-sm text-gray-400">
                <span className="w-6" />
                <span className="flex-1 min-w-0 truncate">{playerFullName(p)}</span>
                <span className="hidden sm:inline text-[11px] w-10 text-center">{birthYearOf(p) || ""}</span>
                <span className="hidden sm:inline text-[10px] font-bold w-8 text-center">{POS[p.position] ? t(POS[p.position]) : ""}</span>
                <span className="w-36 text-right text-[11px] font-semibold">{to === "baja" ? <span className="text-red-600/80">{t("Baja")}</span> : `→ ${teamName(to)}`}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
