import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { playerFullName } from "@/lib/playerName";
import { participationOf } from "@/lib/participation";
import { useParticipationContext } from "@/lib/useParticipation";
import { ReasonChips, QuartersBar, FormatPills, FORMAT_OPTIONS, QUARTER_COLORS } from "@/components/stats/ParticipationBits";

const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "extremo", "delantero_centro"];

function Th({ label, k, sort, setSort, className = "", title }) {
  const active = sort.key === k;
  return (
    <th title={title} className={`px-2 py-2 font-bold whitespace-nowrap cursor-pointer hover:text-gray-700 select-none ${className}`}
      onClick={() => setSort({ key: k, dir: active && sort.dir === "desc" ? "asc" : "desc" })}>
      {label}
      {active ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : <ChevronsUpDown className="w-3 h-3 inline ml-0.5 opacity-30" />}
    </th>
  );
}

// Participación de cada jugador del equipo en los partidos: titular, suplente, no convocado (y por qué),
// minutos y, en fútbol 7, cuántos cuartos juega.
export default function PlayerParticipationTable({ teamId, players, scope }) {
  const ctx = useParticipationContext(scope);
  const [format, setFormat] = useState("all");
  const [sort, setSort] = useState({ key: "pos", dir: "asc" });

  const rows = useMemo(() => players
    .filter((p) => p.team_id === teamId && p.status !== "baja")
    .map((p) => ({ p, ...participationOf(p, ctx) })), [players, teamId, ctx]);

  const has = (k) => rows.some((r) => r[k].conv + r[k].noConv > 0);
  const hasF11 = has("f11"), hasF7 = has("f7");
  const view = (r) => r[format];
  const showQuarters = format !== "f11" && rows.some((r) => view(r).qMatches > 0);

  const sorted = useMemo(() => {
    const val = (r) => {
      const b = r[format];
      switch (sort.key) {
        case "name": return `${r.p.last_name || ""} ${r.p.first_name || ""}`.toLowerCase();
        case "pos": { const i = POS_ORDER.indexOf(r.p.position); return (i < 0 ? 99 : i) * 1000 + (r.p.jersey_number ?? 999); }
        case "qAvg": return b.qAvg ?? -1;
        case "pctMin": return b.pctMin ?? -1;
        default: return b[sort.key] ?? -1;
      }
    };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [rows, sort, format]);

  const num = "text-center px-2 py-1.5";
  const hdr = { sort, setSort };
  const options = FORMAT_OPTIONS.filter((o) => o.value === "all" || (o.value === "f11" ? hasF11 : hasF7));

  if (!teamId) {
    return <div className="bg-white border border-gray-200 rounded-sm p-8 text-center text-sm text-gray-400">Elige un equipo arriba para ver la participación de sus jugadores en los partidos.</div>;
  }

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
      <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Participación de los jugadores</h2>
        {options.length > 2 && <FormatPills value={format} onChange={setFormat} options={options} />}
      </div>
      {rows.length === 0 || (!hasF11 && !hasF7) ? (
        <p className="p-6 text-center text-gray-400 text-sm">Todavía no hay partidos cerrados de este equipo en esta competición.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <Th label="Jugador" k="name" {...hdr} className="text-left" />
                  <Th label="Conv." k="conv" {...hdr} title="Partidos en los que estuvo convocado" />
                  <Th label="Tit." k="titular" {...hdr} title="Partidos como titular" />
                  <Th label="Sup." k="suplente" {...hdr} title="Partidos como suplente (entre paréntesis, los que no llegó a jugar)" />
                  <Th label="No conv." k="noConv" {...hdr} title="Partidos del equipo en los que no fue convocado" />
                  <th className="px-2 py-2 font-bold text-left">Motivo de la ausencia</th>
                  <Th label="Min" k="mins" {...hdr} />
                  <Th label="% min" k="pctMin" {...hdr} title="Minutos jugados sobre los minutos de los partidos en que estuvo convocado" />
                  {showQuarters && <Th label="Cuartos" k="qAvg" {...hdr} title="Reparto de los partidos de fútbol 7 según los cuartos que jugó, y media de cuartos por partido jugado" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((r) => {
                  const b = view(r);
                  return (
                    <tr key={r.p.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <Link to={`/PlayerProfile?id=${r.p.id}`} className="font-bold text-gray-900 hover:underline" style={{ fontFamily: "var(--font-display)" }}>{playerFullName(r.p)}</Link>
                        <span className="ml-1.5 text-[9px] font-black px-1 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)" }}>{POS_LABEL[r.p.position] || "—"}</span>
                      </td>
                      <td className={`${num} font-black`}>{b.conv}</td>
                      <td className={`${num} font-bold text-gray-700`}>{b.titular}</td>
                      <td className={`${num} text-gray-600`}>{b.suplente}{b.suplenteSin > 0 && <span className="text-gray-400" title="Convocado y no llegó a jugar"> ({b.suplenteSin})</span>}</td>
                      <td className={`${num} font-bold ${b.noConv ? "text-gray-700" : "text-gray-300"}`}>{b.noConv || "—"}</td>
                      <td className="px-2 py-1.5"><ReasonChips reasons={b.reasons} /></td>
                      <td className={`${num} text-gray-700`} title={`${b.mins}' de ${b.availMin}' disponibles (convocado)`}>{b.mins > 0 ? `${b.mins}'` : "—"}</td>
                      <td className={`${num} font-bold`} style={{ color: "var(--granate)" }}>{b.pctMin != null && b.mins > 0 ? `${b.pctMin}%` : "—"}</td>
                      {showQuarters && <td className="px-2 py-1.5"><QuartersBar b={b} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showQuarters && (
            <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
              <span className="font-bold uppercase tracking-wider text-gray-400">Cuartos por partido</span>
              {[[4, "4"], [3, "3"], [2, "2"], [1, "1"], [0, "no jugó"]].map(([q, l]) => (
                <span key={q} className="inline-flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: QUARTER_COLORS[q] }} />{l}</span>
              ))}
              <span className="text-gray-400">· el número es la media de cuartos en los partidos que jugó · cuartos = minutos ÷ duración del cuarto, redondeado</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
