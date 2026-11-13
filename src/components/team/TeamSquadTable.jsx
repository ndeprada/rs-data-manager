import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, ChevronUp, ChevronDown, ChevronsUpDown, User } from "lucide-react";
import { useSquadRows } from "@/lib/useSquadRows";
import { Flag, countryOf } from "@/lib/countries";
import { playerFullName } from "@/lib/playerName";
import { PctPill } from "@/components/stats/ParticipationBits";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CTR", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
const POS_ORDER = ["portero", "central", "libre", "lateral", "mediocentro", "interior", "mediapunta", "extremo", "delantero_centro"];

const pctColor = (p) => (p == null ? "#9ca3af" : p >= 80 ? "#16a34a" : p >= 60 ? "#ea580c" : "#dc2626");

function Th({ label, k, sort, setSort, className = "" }) {
  const active = sort.key === k;
  return (
    <th className={`px-2 py-2 font-bold whitespace-nowrap cursor-pointer hover:text-gray-700 select-none ${className}`} onClick={() => setSort({ key: k, dir: active && sort.dir === "asc" ? "desc" : "asc" })}>
      {label}
      {active ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />) : <ChevronsUpDown className="w-3 h-3 inline ml-0.5 opacity-30" />}
    </th>
  );
}

// Tabla única de plantilla: datos del jugador + estadísticas de partidos + entrenos + lesiones.
export default function TeamSquadTable({ teamId, onAddPlayer }) {
  const t = useT();
  const [sort, setSort] = useState({ key: "pos", dir: "asc" });
  const { rows, guests } = useSquadRows(teamId);

  const sorted = useMemo(() => {
    const val = (r) => {
      switch (sort.key) {
        case "name": return `${r.p.last_name || ""} ${r.p.first_name || ""}`.toLowerCase();
        case "num": return r.p.jersey_number ?? 999;
        case "year": return r.year ?? 0;
        case "nat": { const c = countryOf(r.p); return c ? (c.a3 === "ESP" ? "0" : `1${c.a3}`) : "2"; }
        case "pos": { const i = POS_ORDER.indexOf(r.p.position); return (i < 0 ? 99 : i) * 1000 + (r.p.jersey_number ?? 999); }
        default: return r[sort.key] ?? -1;
      }
    };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [rows, sort]);

  const num = "text-center px-2 py-1.5";
  const hdr = { sort, setSort };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Plantilla")} <span className="text-gray-400 font-bold">({rows.length})</span></h2>
          {onAddPlayer && (
            <Button variant="club" size="sm" onClick={onAddPlayer} className="gap-1"><Plus className="w-3.5 h-3.5" /> {t("Jugador")}</Button>
          )}
        </div>
        {rows.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">{t("No hay jugadores en este equipo")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <Th label="#" k="num" {...hdr} className="text-left" />
                  <Th label={t("Jugador")} k="name" {...hdr} className="text-left" />
                  <Th label={t("Año")} k="year" {...hdr} />
                  <Th label={t("Nac")} k="nat" {...hdr} />
                  <Th label={t("Pos")} k="pos" {...hdr} />
                  <Th label={t("PJ")} k="pj" {...hdr} />
                  <Th label={t("Goles")} k="goals" {...hdr} />
                  <Th label={t("Asist")} k="assists" {...hdr} />
                  <Th label={t("Min")} k="mins" {...hdr} />
                  <Th label={t("Min/PJ")} k="minPJ" {...hdr} />
                  <Th label={t("% min")} k="pctMin" {...hdr} />
                  <Th label={t("Val.")} k="rating" {...hdr} />
                  <Th label={t("TA")} k="ta" {...hdr} />
                  <Th label={t("TR")} k="tr" {...hdr} />
                  <Th label={t("Entr.")} k="attPct" {...hdr} />
                  <th className="px-2 py-2 font-bold">{t("Estado")}</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((r) => (
                  <tr key={r.p.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-black text-gray-400" style={{ fontFamily: "var(--font-display)" }}>{r.p.jersey_number ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <Link to={`/PlayerProfile?id=${r.p.id}`} className="flex items-center gap-2 group">
                        <span className="w-6 h-6 rounded overflow-hidden border border-gray-200 flex items-center justify-center shrink-0" style={{ background: "var(--granate-pale)" }}>
                          {r.p.photo_url ? <img src={r.p.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <User className="w-3.5 h-3.5 text-gray-400" />}
                        </span>
                        <span className="font-bold text-gray-900 group-hover:underline whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>{playerFullName(r.p)}</span>
                      </Link>
                    </td>
                    <td className={`${num} text-gray-600`}>{r.year ?? "—"}</td>
                    <td className={num}>{countryOf(r.p) ? <Flag player={r.p} className="justify-center" /> : <span className="text-gray-300">—</span>}</td>
                    <td className={num}><span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm" style={{ background: "var(--granate-pale)", color: "var(--granate)" }}>{POS_LABEL[r.p.position] || "—"}</span></td>
                    <td className={`${num} font-black`}>{r.pj}</td>
                    <td className={`${num} font-black`} style={{ color: r.p.position === "portero" ? undefined : r.goals > 0 ? "var(--granate)" : undefined }} title={r.p.position === "portero" ? t("Goles encajados (y marcados entre paréntesis)") : undefined}>
                      {r.p.position === "portero" ? (
                        <span>
                          <span style={{ color: r.conceded > 0 ? "#dc2626" : "#9ca3af" }}>{r.conceded > 0 ? `-${r.conceded}` : "0"}</span>
                          {r.goals > 0 && <span className="text-gray-700"> ({r.goals})</span>}
                        </span>
                      ) : r.goals}
                    </td>
                    <td className={`${num} font-bold text-gray-600`}>{r.assists}</td>
                    <td className={`${num} text-gray-700`} title={t("{mins}' de {totalMin}' de partidos jugados", { mins: r.mins, totalMin: r.totalMin })}>{r.mins > 0 ? `${r.mins}'` : "—"}</td>
                    <td className={`${num} text-gray-600`}>{r.minPJ ? `${r.minPJ}'` : "—"}</td>
                    <td className={num}><PctPill value={r.pctMin} level={r.level} title={t("{mins}' de {availMin}' disponibles (no cuentan los partidos de lesión, viaje, sanción…)", { mins: r.mins, availMin: r.availMin })} /></td>
                    <td className={`${num} font-bold`}>{r.rating != null ? r.rating.toFixed(1) : "—"}</td>
                    <td className={num}>{r.ta > 0 ? <span className="inline-block min-w-4 px-1 rounded-sm bg-yellow-400 text-[10px] font-bold text-yellow-900">{r.ta}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className={num}>{r.tr > 0 ? <span className="inline-block min-w-4 px-1 rounded-sm bg-red-500 text-[10px] font-bold text-white">{r.tr}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className={`${num} font-bold`} style={{ color: pctColor(r.attPct) }} title={r.attN ? t("{attN} entrenos registrados", { attN: r.attN }) : ""}>{r.attPct != null ? `${r.attPct}%` : "—"}</td>
                    <td className="px-2 py-1.5">
                      {r.injury ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200 whitespace-nowrap" title={r.injury.diagnosis || ""}>{t("Lesión")}{r.injury.body_part ? ` · ${r.injury.body_part}` : ""}</span>
                      ) : r.p.status === "lesionado" ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-red-50 text-red-700 border-red-200">{t("Lesionado")}</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border bg-green-50 text-green-700 border-green-200">{t("Activo")}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Link to={`/PlayerProfile?id=${r.p.id}&edit=1`} title={t("Editar jugador")} className="inline-flex p-1 rounded text-gray-300 hover:text-gray-700 hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {guests.length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-4 py-2.5 border-b border-gray-100">
            <h2 className="font-black text-sm uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{t("Jugadores de otros equipos con este equipo")} <span className="text-gray-400 font-bold">({guests.length})</span></h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
                  <th className="px-2 py-2 text-left font-bold">{t("Jugador")}</th><th className="px-2 py-2 font-bold">{t("Año")}</th><th className="px-2 py-2 text-left font-bold">{t("Equipo")}</th>
                  <th className="px-2 py-2 font-bold">{t("PJ")}</th><th className="px-2 py-2 font-bold">{t("Goles")}</th><th className="px-2 py-2 font-bold">{t("Asist")}</th><th className="px-2 py-2 font-bold">{t("Min")}</th><th className="px-2 py-2 font-bold">{t("Val.")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {guests.map((g) => (
                  <tr key={g.p.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5"><Link to={`/PlayerProfile?id=${g.p.id}`} className="font-bold text-gray-900 hover:underline" style={{ fontFamily: "var(--font-display)" }}>{playerFullName(g.p)}</Link></td>
                    <td className={`${num} text-gray-600`}>{g.year ?? "—"}</td>
                    <td className="px-2 py-1.5 text-gray-500">{g.team?.name || "—"}</td>
                    <td className={`${num} font-black`}>{g.pj}</td>
                    <td className={`${num} font-black`} style={{ color: g.goals > 0 ? "var(--granate)" : undefined }}>{g.goals}</td>
                    <td className={`${num} text-gray-600`}>{g.assists}</td>
                    <td className={`${num} text-gray-700`}>{g.mins}'</td>
                    <td className={`${num} font-bold`}>{g.rating != null ? g.rating.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
