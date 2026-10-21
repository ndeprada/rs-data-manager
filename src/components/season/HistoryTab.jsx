import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { compareTeams } from "@/lib/teamOrder";
import { Link } from "react-router-dom";
import EmptyState from "@/components/common/EmptyState";
import { useT } from "@/i18n";

const lbl = (s) => String(s || "").replace("-", "–");

// Historial de equipos de las temporadas cerradas: clasificación, resultados y plantilla.
export default function HistoryTab() {
  const t = useT();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["team_season_history"], queryFn: () => base44.entities.TeamSeasonHistory.list() });
  const seasons = useMemo(() => [...new Set(rows.map((r) => r.season))].sort().reverse(), [rows]);
  const [season, setSeason] = useState("");
  const [open, setOpen] = useState(null);
  const cur = season || seasons[0] || "";
  const list = useMemo(() => rows.filter((r) => r.season === cur).sort((a, b) => compareTeams({ name: a.team_name, category: a.category }, { name: b.team_name, category: b.category })), [rows, cur]);

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-400">{t("Cargando…")}</p>;
  if (!rows.length) {
    return <div className="bg-white border border-gray-200" style={{ borderRadius: "4px" }}>
      <EmptyState icon={History} title={t("Todavía no hay temporadas cerradas")} hint={t("Cuando cierres una temporada, aquí quedará la clasificación, los resultados y la plantilla de cada equipo.")} />
    </div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {seasons.map((s) => (
          <button key={s} type="button" onClick={() => { setSeason(s); setOpen(null); }}
            className={`px-3 py-1.5 rounded text-xs font-bold ${s === cur ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            style={s === cur ? { background: "var(--granate)" } : undefined}>{lbl(s)}</button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 shadow-sm overflow-x-auto" style={{ borderRadius: "4px" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider text-center" style={{ fontFamily: "var(--font-display)" }}>
              <th className="px-3 py-2 text-left">{t("Equipo")}</th>
              <th className="px-2 py-2 text-left">{t("Competición")}</th>
              <th className="px-2 py-2">{t("Pos")}</th><th className="px-2 py-2">{t("Pts")}</th>
              <th className="px-2 py-2">{t("PJ")}</th><th className="px-2 py-2">{t("G")}</th><th className="px-2 py-2">{t("E")}</th><th className="px-2 py-2">{t("P")}</th>
              <th className="px-2 py-2">{t("GF–GC")}</th><th className="px-2 py-2">{t("Jugadores")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((tm) => {
              const st = tm.standing, rec = tm.record || {};
              const isOpen = open === tm.id;
              return (
                <React.Fragment key={tm.id}>
                  <tr className="text-center hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(isOpen ? null : tm.id)}>
                    <td className="px-3 py-1.5 text-left font-bold text-gray-900 whitespace-nowrap">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 inline mr-1 text-gray-400" />}{tm.team_name}
                    </td>
                    <td className="px-2 py-1.5 text-left text-gray-500">{[tm.competition, tm.group].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-2 py-1.5 font-black" style={{ color: "var(--granate)" }}>{st?.pos ? `${st.pos}º` : "—"}</td>
                    <td className="px-2 py-1.5 font-bold">{st?.pts ?? rec.pts ?? "—"}</td>
                    <td className="px-2 py-1.5">{st?.pj ?? rec.pj ?? "—"}</td>
                    <td className="px-2 py-1.5">{st?.g ?? rec.g ?? "—"}</td>
                    <td className="px-2 py-1.5">{st?.e ?? rec.e ?? "—"}</td>
                    <td className="px-2 py-1.5">{st?.p ?? rec.p ?? "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{(st?.gf ?? rec.gf) != null ? `${st?.gf ?? rec.gf}–${st?.gc ?? rec.gc}` : "—"}</td>
                    <td className="px-2 py-1.5">{(tm.roster || []).length}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={10} className="bg-gray-50 px-4 py-3">
                        {(tm.staff || []).length > 0 && (
                          <p className="mb-2 text-gray-600"><span className="font-bold uppercase text-[10px] tracking-wider text-gray-400 mr-2">{t("Cuerpo técnico")}</span>{tm.staff.map((s) => s.name).join(" · ")}</p>
                        )}
                        <table className="w-full max-w-2xl">
                          <thead><tr className="text-[10px] text-gray-400 uppercase text-center"><th className="text-left py-1">{t("Jugador")}</th><th>{t("Año")}</th><th>{t("PJ")}</th><th>{t("Min")}</th><th>{t("Goles")}</th><th>{t("Asist")}</th></tr></thead>
                          <tbody className="divide-y divide-gray-100">
                            {(tm.roster || []).map((p) => (
                              <tr key={p.player_id} className="text-center">
                                <td className="text-left py-1"><Link to={`/PlayerProfile?id=${p.player_id}`} className="font-semibold text-gray-800 hover:underline">{p.name}</Link></td>
                                <td className="text-gray-500">{p.birth_year || ""}</td><td>{p.matches}</td><td>{p.minutes}</td><td>{p.goals}</td><td>{p.assists}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">{t("Las estadísticas de jugadores del historial cuentan solo partidos de liga. La asistencia a entrenos está en la ficha de cada jugador.")}</p>
    </div>
  );
}
